// Smithable app kit: Notifications under the person's name (docs/design/notifications.md §4). Each
// entry that may push to them is a toggle, off until they turn it on, in each browser they want
// it in: the first one on asks the browser and subscribes it; the last one off, or signing out
// here, removes this browser's subscription. Nobody turns it on for someone else.
import { useEffect, useState } from "react";
import { w } from "./words";

interface Browser {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushApi {
  list: () => Promise<{
    publicKey: string;
    entries: { entry: string; label: string; on: boolean }[];
  }>;
  set: (data: { entry: string; on: boolean; browser?: Browser }) => Promise<{ on: string[] }>;
  forget: (data: { endpoint: string }) => Promise<void>;
}

const supported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const b64 = (buffer: ArrayBuffer | null) =>
  buffer
    ? btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
    : "";

/** This browser's subscription, made (asking the browser) when `make` and none is there yet. */
async function thisBrowser(publicKey?: string): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.register("/sw.js");
  if (!registration?.pushManager) throw new Error("no push here");
  let kept = await registration.pushManager.getSubscription();
  // Made with an earlier key pair of the app's: no longer good, so made again.
  if (
    kept &&
    publicKey &&
    b64(kept.options.applicationServerKey as ArrayBuffer | null) !== publicKey
  ) {
    await kept.unsubscribe();
    kept = null;
  }
  if (kept || !publicKey) return kept;
  if ((await Notification.requestPermission()) !== "granted") return null;
  const key = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

const asBrowser = (s: PushSubscription): Browser => ({
  endpoint: s.endpoint,
  p256dh: b64(s.getKey("p256dh")),
  auth: b64(s.getKey("auth")),
});

/** Signing out: this browser's subscription goes, before the session does. */
export async function forgetThisBrowser(api: Pick<PushApi, "forget">): Promise<void> {
  if (!supported()) return;
  try {
    const kept = await (
      await navigator.serviceWorker.getRegistration("/sw.js")
    )?.pushManager.getSubscription();
    if (!kept) return;
    await api.forget({ endpoint: kept.endpoint });
    await kept.unsubscribe();
  } catch {
    // Signing out goes on; a subscription left behind is removed at its first push (gone).
  }
}

export function PushChoices({ api }: { api: PushApi }) {
  const [list, setList] = useState<Awaited<ReturnType<PushApi["list"]>>>();
  const [problem, setProblem] = useState<string>();
  useEffect(() => {
    if (!supported()) return;
    void (async () => {
      const found = await api.list();
      // On here only where this browser is subscribed: another browser of the person's turns
      // them on for itself.
      const here = await (
        await navigator.serviceWorker.getRegistration("/sw.js")
      )?.pushManager.getSubscription();
      setList(
        here ? found : { ...found, entries: found.entries.map((e) => ({ ...e, on: false })) },
      );
    })().catch(() => undefined);
  }, [api]);
  if (!list?.entries.length) return null;
  const toggle = async (entry: string, on: boolean) => {
    setProblem(undefined);
    try {
      // A browser that cannot keep the app's worker (some headless or private windows) says so
      // in the app's words, not a script error.
      let sub: PushSubscription | null;
      try {
        sub = await thisBrowser(on ? list.publicKey : undefined);
      } catch {
        return setProblem(on ? w.pushUnavailable : undefined);
      }
      if (on && !sub) return setProblem(w.pushRefused);
      const { on: left } = await api.set({
        entry,
        on,
        ...(sub ? { browser: asBrowser(sub) } : {}),
      });
      if (!left.length) await sub?.unsubscribe();
      setList({
        ...list,
        entries: list.entries.map((e) => ({ ...e, on: left.includes(e.entry) })),
      });
    } catch (error) {
      setProblem((error as Error).message);
    }
  };
  return (
    <fieldset data-kit="push-choices" className="space-y-1.5">
      <legend className="text-sm font-medium">{w.notifications}</legend>
      <p className="text-xs text-muted-foreground">{w.notificationsHelp}</p>
      {list.entries.map((e) => (
        <label key={e.entry} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={e.on}
            onChange={(ev) => void toggle(e.entry, ev.target.checked)}
          />
          {e.label}
        </label>
      ))}
      {problem && (
        <p role="alert" className="text-xs text-destructive">
          {problem}
        </p>
      )}
    </fieldset>
  );
}
