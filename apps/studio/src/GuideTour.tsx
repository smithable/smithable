// The Studio guide (docs/design/studio-guide.md): each place lit in order, and what it is said
// by Smith in his thread with Next and Skip as chips (smith-first.md §7, `asLine`); on a phone,
// or with Smith off screen, a card beside the place, the rest of the screen dimmed. A stop whose
// place is not on the screen is left out, except the preview, which is brought on screen (onStop).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { doneKey, type Stop } from "./guide";
import { Button } from "./ui";

const CARD = { width: 320, height: 190, gap: 10 };

/**
 * The stops whose places are on the screen now, each with its element. A place marked
 * data-guide-view (the preview, which a narrow window shows only when chosen) counts even unseen:
 * its stop brings it on screen.
 */
function present(stops: Stop[]): { stop: Stop; element: HTMLElement }[] {
  return stops.flatMap((stop) => {
    const element = document.querySelector<HTMLElement>(`[data-guide="${stop.anchor}"]`);
    if (!element) return [];
    const box = element.getBoundingClientRect();
    return (box.width > 0 && box.height > 0) || element.closest("[data-guide-view]")
      ? [{ stop, element }]
      : [];
  });
}

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

/** A stop as Smith says it: its words, where it is in the tour, and the chips' actions. */
export interface GuideLine {
  stop: Stop;
  at: number;
  count: number;
  next: () => void;
  end: () => void;
}

export function Guide({
  app,
  stops: tour,
  onEnd,
  onStop,
  asLine,
}: {
  app: string;
  /** The tour of the view's open sub-tab (guide.ts). */
  stops: Stop[];
  onEnd: () => void;
  /** Each stop as it opens, so a place that is not shown (the preview) can be. */
  onStop?: (anchor: string) => void;
  /** Smith says the stops (his thread shows the line); none for the cards. */
  asLine?: (line: GuideLine | undefined) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Found once the tour's mode is on the screen: after the render that may have just switched to
  // it, not during it.
  const [stops, setStops] = useState<{ stop: Stop; element: HTMLElement }[]>([]);
  const [at, setAt] = useState(0);
  const [box, setBox] = useState<DOMRect>();
  const current = stops[at];
  // Back to where the person was when the tour ends.
  const before = useRef<Element | null>(null);

  const end = () => {
    try {
      localStorage.setItem(doneKey(app), "1");
    } catch {
      // Without storage the tour may show again next time; nothing else depends on it.
    }
    dialog.current?.close();
    asLine?.(undefined);
    (before.current as HTMLElement | null)?.focus?.();
    onEnd();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the tour starts
  useEffect(() => {
    before.current = document.activeElement;
    // A mode's places may still be loading (Code mode comes in its own chunk, App.tsx): looked
    // for again for a moment before the tour goes on without the ones that are not there.
    let tries = 0;
    const look = () => {
      const found = present(tour);
      if (found.length < tour.length && tries++ < 30) {
        timer = setTimeout(look, 100);
        return;
      }
      if (found.length === 0) return end();
      setStops(found);
      if (!asLine && !dialog.current?.open) dialog.current?.showModal();
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    look();
    return () => clearTimeout(timer);
  }, []);

  // The place in view (on a phone, its panel scrolled to), then measured; again on resizing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: each stop once, as it opens (onStop is made anew each render)
  useLayoutEffect(() => {
    if (!current) return;
    onStop?.(current.stop.anchor);
    current.element.scrollIntoView({ block: "nearest", inline: "nearest" });
    const measure = () => setBox(current.element.getBoundingClientRect());
    measure();
    const later = setTimeout(measure, 350);
    const settled = setTimeout(measure, 800);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(later);
      clearTimeout(settled);
      window.removeEventListener("resize", measure);
    };
  }, [current]);

  const last = at === stops.length - 1;
  // Smith's line for the stop, with its chips; Esc ends the tour as on a card.
  // biome-ignore lint/correctness/useExhaustiveDependencies: each stop once, as it opens
  useEffect(() => {
    if (!asLine || !current) return;
    asLine({
      stop: current.stop,
      at,
      count: stops.length,
      next: () => (last ? end() : setAt(at + 1)),
      end,
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, asLine]);
  if (asLine)
    return box ? (
      // The place lit, nothing dimmed: the person reads Smith's line beside it and may go on
      // working.
      <div
        aria-hidden
        data-guide-lit={current?.stop.anchor}
        className="pointer-events-none fixed z-30 rounded-md ring-2 ring-accent"
        style={{
          top: box.top - 4,
          left: box.left - 4,
          width: box.width + 8,
          height: box.height + 8,
        }}
      />
    ) : null;
  const position = box && cardAt(box);
  return (
    <dialog
      ref={dialog}
      aria-label="Guide"
      onCancel={(e) => {
        e.preventDefault();
        end();
      }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-transparent"
    >
      {box && (
        // The cut-out: the rest of the screen dimmed around the place.
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-md ring-2 ring-accent"
          style={{
            top: box.top - 4,
            left: box.left - 4,
            width: box.width + 8,
            height: box.height + 8,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.35)",
          }}
        />
      )}
      {current && position && (
        <section
          aria-labelledby="guide-title"
          aria-describedby="guide-text"
          data-guide-card={current.stop.anchor}
          className="fixed space-y-3 rounded-lg border border-line bg-panel p-4 shadow-lg"
          style={{ ...position, width: CARD.width }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
              e.preventDefault();
              if (last) end();
              else setAt(at + 1);
            }
          }}
        >
          <p className="text-xs text-quiet">
            {at + 1} of {stops.length}
          </p>
          <h2 id="guide-title" className="text-sm font-semibold">
            {current.stop.title}
          </h2>
          <p id="guide-text" className="text-sm text-fg-soft">
            {current.stop.text}
          </p>
          <div className="flex justify-end gap-2">
            {!last && (
              <Button variant="ghost" onClick={end}>
                Skip
              </Button>
            )}
            <Button
              // biome-ignore lint/a11y/noAutofocus: the card is the dialog's only content
              autoFocus
              onClick={() => (last ? end() : setAt(at + 1))}
            >
              {last ? "Done" : "Next"}
            </Button>
          </div>
        </section>
      )}
    </dialog>
  );
}
