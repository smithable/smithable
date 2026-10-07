// The Studio guide (docs/design/studio-guide.md): a card beside each place, in order, with Next
// and Skip; the rest of the screen dims and takes no clicks while it runs. A stop whose place is
// not on the screen is left out.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { doneKey, STOPS, type Stop } from "./guide";
import { Button } from "./ui";

const CARD = { width: 320, height: 190, gap: 10 };

/** The stops whose places are on the screen now, each with its element. */
function present(): { stop: Stop; element: HTMLElement }[] {
  return STOPS.flatMap((stop) => {
    const element = document.querySelector<HTMLElement>(`[data-guide="${stop.anchor}"]`);
    if (!element) return [];
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 ? [{ stop, element }] : [];
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

export function Guide({
  app,
  onEnd,
  onCode,
}: {
  app: string;
  onEnd: () => void;
  /** The first stop's Code: the tour ends and Studio switches to Code mode (remembered). */
  onCode: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [stops] = useState(present);
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
    (before.current as HTMLElement | null)?.focus?.();
    onEnd();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the tour starts
  useEffect(() => {
    before.current = document.activeElement;
    if (!dialog.current?.open) dialog.current?.showModal();
    if (stops.length === 0) end();
  }, []);

  // The place in view (on a phone, its panel scrolled to), then measured; again on resizing.
  useLayoutEffect(() => {
    if (!current) return;
    // A place laid over a panel (the preview on a phone) is brought in by scrolling to the panel.
    const panel = document.querySelector(`[data-guide-place="${current.stop.anchor}"]`);
    (panel ?? current.element).scrollIntoView({ block: "nearest", inline: "nearest" });
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
          className="fixed space-y-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-lg"
          style={{ ...position, width: CARD.width }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
              e.preventDefault();
              if (last) end();
              else setAt(at + 1);
            }
          }}
        >
          <p className="text-xs text-neutral-500">
            {at + 1} of {stops.length}
          </p>
          <h2 id="guide-title" className="text-sm font-semibold">
            {current.stop.title}
          </h2>
          <p id="guide-text" className="text-sm text-neutral-700">
            {current.stop.text}
          </p>
          {current.stop.choice ? (
            // How the person wants to work: No code goes on with the tour, Code switches to it.
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  end();
                  onCode();
                }}
              >
                Code
              </Button>
              <Button
                // biome-ignore lint/a11y/noAutofocus: the card is the dialog's only content
                autoFocus
                onClick={() => setAt(at + 1)}
              >
                No code
              </Button>
            </div>
          ) : (
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
          )}
        </section>
      )}
    </dialog>
  );
}
