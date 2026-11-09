// Smithable app kit: live notices (docs/design/notifications.md §3). While the app is open, a
// change another person makes that an outgoing entry tells this person about shows at the top
// (its title line and a link, several stacked into one with a count), the page's lists load again
// when they show that kind of record, and a hidden tab counts in its title. A chime only once the
// person says yes, which the first notice offers; the choice is kept in this browser.
import { useRouter } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { w } from "./words";

interface Notice {
  entry: string;
  model: string;
  id: number;
  title: string;
  link?: string;
}

const SOUND = "smithable:notice-sound";

function soundChoice(): "on" | "off" | undefined {
  try {
    const kept = localStorage.getItem(SOUND);
    return kept === "on" || kept === "off" ? kept : undefined;
  } catch {
    return undefined;
  }
}

function keepSound(on: boolean): void {
  try {
    localStorage.setItem(SOUND, on ? "on" : "off");
  } catch {}
}

/** A short tone, drawn rather than a file: nothing to fetch. */
function chime(): void {
  try {
    const context = new AudioContext();
    const tone = context.createOscillator();
    const gain = context.createGain();
    tone.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.4);
    tone.connect(gain).connect(context.destination);
    tone.onended = () => void context.close();
    tone.start();
    tone.stop(context.currentTime + 0.4);
  } catch {}
}

const COUNTED = /^\(\d+\) /;

/** The notices bar, for a signed-in person; `model` is the open page's kind of record, if any. */
export function Live({ model }: { model?: string }) {
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [offer, setOffer] = useState(() => soundChoice() === undefined);
  const page = useRef(model);
  page.current = model;
  const unseen = useRef(0);
  useEffect(() => {
    const source = new EventSource("/events");
    let opened = false;
    // Back after a break: events missed are not replayed, so the page loads its lists again.
    source.addEventListener("open", () => {
      if (opened) void router.invalidate();
      opened = true;
    });
    // A sixth tab took this one's place: it stops, rather than taking another's back.
    source.addEventListener("replaced", () => source.close());
    source.addEventListener("notice", (e) => {
      const notice = JSON.parse((e as MessageEvent<string>).data) as Notice;
      setNotices((all) =>
        [
          notice,
          ...all.filter(
            (n) => !(n.entry === notice.entry && n.model === notice.model && n.id === notice.id),
          ),
        ].slice(0, 50),
      );
      // A page of that kind of record, or one of several kinds (a dashboard): its loader again.
      if (!page.current || page.current === notice.model) void router.invalidate();
      if (soundChoice() === "on") chime();
      if (document.visibilityState === "hidden") {
        unseen.current++;
        document.title = `(${unseen.current}) ${document.title.replace(COUNTED, "")}`;
      }
    });
    const seen = () => {
      if (document.visibilityState !== "visible" || !unseen.current) return;
      unseen.current = 0;
      document.title = document.title.replace(COUNTED, "");
    };
    document.addEventListener("visibilitychange", seen);
    return () => {
      source.close();
      document.removeEventListener("visibilitychange", seen);
    };
  }, [router]);
  const first = notices[0];
  if (!first) return null;
  return (
    <div
      role="status"
      data-kit="live-notice"
      className="sticky top-0 z-40 flex flex-wrap items-center gap-x-4 gap-y-1 bg-primary px-4 py-2 text-sm text-primary-foreground"
    >
      {first.link ? (
        <a
          href={first.link}
          className="font-medium underline"
          onClick={(e) => {
            e.preventDefault();
            setNotices([]);
            void router.navigate({ to: first.link as string });
          }}
        >
          {first.title}
        </a>
      ) : (
        <span className="font-medium">{first.title}</span>
      )}
      {notices.length > 1 && <span>{w.noticesMore(notices.length - 1)}</span>}
      {offer && (
        <span className="flex items-center gap-2">
          {w.noticeSoundOffer}
          <button
            type="button"
            className="underline"
            onClick={() => {
              keepSound(true);
              setOffer(false);
              chime();
            }}
          >
            {w.yes}
          </button>
          <button
            type="button"
            className="underline"
            onClick={() => {
              keepSound(false);
              setOffer(false);
            }}
          >
            {w.no}
          </button>
        </span>
      )}
      <button
        type="button"
        aria-label={w.close}
        className="ms-auto rounded p-1 hover:bg-primary-foreground/10"
        onClick={() => setNotices([])}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** Under the person's name: a chime with each notice, or none. */
export function NoticeSound() {
  const [on, setOn] = useState(() => soundChoice() === "on");
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          keepSound(e.target.checked);
          setOn(e.target.checked);
        }}
      />
      {w.noticeSound}
    </label>
  );
}
