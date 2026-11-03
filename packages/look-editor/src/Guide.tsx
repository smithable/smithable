// The theme lab's guide (A 158, Johan 2026-10-25), as Studio's (apps/studio/src/GuideTour.tsx):
// a card beside each place, in order, with Next and Skip; the rest dims and takes no clicks while
// it runs. Shown once in a browser, again from the Guide button; ?guide=off leaves it out (the
// screenshot scripts and the tests).
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface Stop {
  /** The `data-guide` name of the element the card is beside. */
  anchor: string;
  title: string;
  text: string;
}

/** The stops, in the order the lab is used: where the words live. */
export const STOPS: Stop[] = [
  {
    anchor: "start",
    title: "Start from a theme",
    text: "Choose a theme to begin with: its light and its dark colors both come with it.",
  },
  {
    anchor: "controls",
    title: "Change it",
    text: "Colors, fonts, corners and spacing: each change shows on the page at once. The colors are those of the mode on screen.",
  },
  {
    anchor: "mode",
    title: "Light and dark, each its own",
    text: "Switch to see and change each mode's own colors: the theme's until you change them, then yours, however often you switch.",
  },
  {
    anchor: "page",
    title: "The same theme on every page",
    text: "Look at it on the app's pages: the landing page, lists, a form, a dialog.",
  },
  {
    anchor: "width",
    title: "Any size",
    text: "Phone to desktop, or drag the page's right edge for any width; Phone beside shows both at once.",
  },
  {
    anchor: "notes",
    title: "What may be hard to read",
    text: "If some text may be hard to read, it says so here in plain words. Your colors apply anyway.",
  },
  {
    anchor: "save",
    title: "Keep it",
    text: "Save adds the theme to your project, ready to use; on the website, Download gives you its file.",
  },
];

/** The key that says this browser has seen the guide. */
export const GUIDE_DONE = "themeLabGuideDone";

/** Whether the guide shows by itself: not seen yet in this browser, and not turned off. */
export function guideFirst(): boolean {
  if (new URLSearchParams(location.search).get("guide") === "off") return false;
  try {
    return localStorage.getItem(GUIDE_DONE) !== "1";
  } catch {
    return false;
  }
}

const CARD = { width: 300, height: 180, gap: 10 };

/** Where the card goes: below its place, else above, else over its lower edge; always on screen. */
function cardAt(box: DOMRect): { top: number; left: number } {
  const room = window.innerHeight;
  const top =
    box.bottom + CARD.gap + CARD.height <= room
      ? box.bottom + CARD.gap
      : box.top - CARD.gap - CARD.height >= 0
        ? box.top - CARD.gap - CARD.height
        : box.bottom - CARD.height - 2 * CARD.gap;
  const left = Math.min(Math.max(box.left, CARD.gap), window.innerWidth - CARD.width - CARD.gap);
  return {
    top: Math.min(Math.max(top, CARD.gap), room - CARD.height - CARD.gap),
    left: Math.max(left, CARD.gap),
  };
}

export function Guide({ onEnd }: { onEnd: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // The stops whose places are on the screen, found once the lab has drawn them.
  const [stops, setStops] = useState<{ stop: Stop; element: HTMLElement }[]>([]);
  const [at, setAt] = useState(0);
  const [box, setBox] = useState<DOMRect>();
  const current = stops[at];

  const end = () => {
    try {
      localStorage.setItem(GUIDE_DONE, "1");
    } catch {
      // Without storage the guide may show again next time; nothing else depends on it.
    }
    dialog.current?.close();
    onEnd();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the guide starts
  useEffect(() => {
    const found = STOPS.flatMap((stop) => {
      const element = document.querySelector<HTMLElement>(`[data-guide="${stop.anchor}"]`);
      const shown = element?.getBoundingClientRect();
      return element && shown && shown.width > 0 && shown.height > 0 ? [{ stop, element }] : [];
    });
    if (found.length === 0) return end();
    setStops(found);
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  // The place measured as each stop opens, and again on resizing.
  useLayoutEffect(() => {
    if (!current) return;
    current.element.scrollIntoView({ block: "nearest", inline: "nearest" });
    const measure = () => setBox(current.element.getBoundingClientRect());
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [current]);

  const last = at === stops.length - 1;
  const position = box && cardAt(box);
  return (
    <dialog
      ref={dialog}
      aria-label="Guide"
      className="guide"
      onCancel={(e) => {
        e.preventDefault();
        end();
      }}
    >
      {box && (
        // The cut-out: the rest of the screen dimmed around the place.
        <div
          aria-hidden
          className="guide-place"
          style={{
            top: box.top - 4,
            left: box.left - 4,
            width: box.width + 8,
            height: box.height + 8,
          }}
        />
      )}
      {current && position && (
        <section
          aria-labelledby="guide-title"
          aria-describedby="guide-text"
          data-guide-card={current.stop.anchor}
          className="guide-card"
          style={{ ...position, width: CARD.width }}
        >
          <p className="guide-count">
            {at + 1} of {stops.length}
          </p>
          <h2 id="guide-title">{current.stop.title}</h2>
          <p id="guide-text">{current.stop.text}</p>
          <div className="guide-buttons">
            {!last && (
              <button type="button" onClick={end}>
                Skip
              </button>
            )}
            <button
              type="button"
              className="primary"
              // biome-ignore lint/a11y/noAutofocus: the card is the dialog's only content
              autoFocus
              onClick={() => (last ? end() : setAt(at + 1))}
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        </section>
      )}
    </dialog>
  );
}
