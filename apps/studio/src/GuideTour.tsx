// The Studio guide (docs/design/studio-guide.md, smith-first.md §12.4): each place lit in order,
// said by Smith in his thread with its chips (`asLine`) and, beside the place, a small card with
// the stop's title, one sentence and the same chips; the rest of the screen dims a little and
// takes no clicks, Smith's panel excepted. On a phone the card and the dimming are left out and a
// stop scrolls its window into view (A 172). A stop whose place is not on the screen is left out,
// except the preview, which is brought on screen (onStop). After "Ask me", Smith offers to show one
// change made three ways (§12.5, `shown`).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { doneKey, SHOWN, type Stop } from "./guide";
import { Button } from "./ui";

const CARD = { width: 300, height: 170, gap: 10 };

/** A control has the focus: Enter and Esc are the control's then (smith-first.md §12.2). */
const inControl = (el: Element | null) =>
  Boolean(el?.closest("button, a, input, textarea, select, label, [contenteditable]"));

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

/** A chip under the stop: what it says and does; the main one is what Enter does. */
export interface GuideChip {
  label: string;
  act: () => void;
  main?: boolean;
}

/** A stop as Smith says it: its words, where it is in the tour, and its chips. */
export interface GuideLine {
  stop: Stop;
  at: number;
  count: number;
  chips: GuideChip[];
}

/**
 * One change shown three ways (smith-first.md §12.5), made by Studio: Smith's own change, then the
 * same change by hand and in the text, kept or undone at the end.
 */
export interface ShownChange {
  /** The kind of record the field goes on, as the person reads it. */
  label: string;
  /** Smith's way: the field added, and the preview at the new record's form; false if refused. */
  apply: () => Promise<boolean>;
  /** No code at the kind of record, the new field's row lit. */
  byHand: () => void;
  /** Code at the field's line. */
  inCode: () => void;
  /** Kept or undone; the manual view closes and the preview is in front. */
  end: (keep: boolean) => void;
  /** Where each step's place is on the screen. */
  places: { smith: string; byHand: string; code: string };
}
type Shown = "offer" | "smith" | "byHand" | "code" | "end";

/** The first sentence of a stop's text, for its card. */
const firstSentence = (text: string) => text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;

export function Guide({
  app,
  stops: tour,
  onEnd,
  onStop,
  onPlace,
  asLine,
  cards = true,
  shown: offer,
}: {
  app: string;
  /** The tour of the view's open sub-tab (guide.ts). */
  stops: Stop[];
  onEnd: () => void;
  /** Each stop as it opens, so a place that is not shown (the preview) can be. */
  onStop?: (anchor: string) => void;
  /** Where the stop's place is on the screen, as it is measured: Smith's panel moves off it. */
  onPlace?: (anchor: string, box: DOMRect) => void;
  /** Smith says the stops (his thread shows the line). */
  asLine?: (line: GuideLine | undefined) => void;
  /** The card beside the place, and the rest dimmed; a phone has neither. */
  cards?: boolean;
  /** The change Smith offers to show after "Ask me"; none when the app has nothing to add it to. */
  shown?: ShownChange;
}) {
  // Found once the tour's mode is on the screen: after the render that may have just switched to
  // it, not during it.
  const [stops, setStops] = useState<{ stop: Stop; element: HTMLElement }[]>([]);
  const [at, setAt] = useState(0);
  const [box, setBox] = useState<DOMRect>();
  // The shown change's step, while it runs, and its place once found.
  const [step, setStep] = useState<Shown>();
  const [stepPlace, setStepPlace] = useState<HTMLElement>();
  const offered = useRef(false);
  // Smith's change is being made: Esc and Next wait for it (no Undo of nothing, no field left).
  const applying = useRef(false);
  // The shown change as it was offered: Studio makes it anew each render, and once its field is
  // added the next kind of record without one would be the one named.
  const [shown, setShown] = useState<ShownChange>();
  const current = stops[at];
  // Back to where the person was when the tour ends.
  const before = useRef<Element | null>(null);

  const end = () => {
    try {
      localStorage.setItem(doneKey(app), "1");
    } catch {
      // Without storage the tour may show again next time; nothing else depends on it.
    }
    asLine?.(undefined);
    (before.current as HTMLElement | null)?.focus?.();
    onEnd();
  };
  const onward = () => (at === stops.length - 1 ? end() : setAt(at + 1));
  const next = () => {
    if (current?.stop.anchor === "change" && offer && !offered.current) {
      offered.current = true;
      setShown(offer);
      return setStep("offer");
    }
    onward();
  };
  const leave = (keep: boolean) => {
    shown?.end(keep);
    setStep(undefined);
    setStepPlace(undefined);
    onward();
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
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    look();
    return () => clearTimeout(timer);
  }, []);

  // A step of the shown change: its place looked for until it is on the screen (the preview's
  // form, No code's row and Code's text come after the step's own action).
  useEffect(() => {
    setStepPlace(undefined);
    if (!step || step === "offer" || step === "end" || !shown) return;
    let tries = 0;
    const look = () => {
      const found = document.querySelector<HTMLElement>(shown.places[step]);
      const seen = found?.getBoundingClientRect();
      if (found && seen && seen.width > 0) return setStepPlace(found);
      if (tries++ < 50) timer = setTimeout(look, 100);
    };
    let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(look, 150);
    return () => clearTimeout(timer);
  }, [step, shown]);

  // A step of the shown change is lit at its own place once found; the offer and the end at the
  // stop's.
  const own = step === "smith" || step === "byHand" || step === "code";
  const place = own ? stepPlace : current?.element;
  // The place in view (on a phone, its panel scrolled to), then measured; again on resizing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: each place once, as it opens (onStop is made anew each render)
  useLayoutEffect(() => {
    if (!current || !place) return;
    if (!step) onStop?.(current.stop.anchor);
    place.scrollIntoView({ block: "nearest", inline: "nearest" });
    const anchor = own ? `shown-${step}` : current.stop.anchor;
    const measure = () => {
      const now = place.getBoundingClientRect();
      setBox(now);
      onPlace?.(anchor, now);
    };
    measure();
    const later = setTimeout(measure, 350);
    const settled = setTimeout(measure, 800);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(later);
      clearTimeout(settled);
      window.removeEventListener("resize", measure);
    };
  }, [current, place]);

  // The line said now: a stop of the tour, or a step of the shown change with its own chips.
  const last = at === stops.length - 1;
  const line: GuideLine | undefined = current && {
    stop: step
      ? { anchor: current.stop.anchor, title: SHOWN.title, text: SHOWN[step](shown?.label ?? "") }
      : current.stop,
    at,
    count: stops.length,
    chips:
      step === "offer"
        ? [
            {
              label: "Yes",
              main: true,
              act: () => {
                // Smith says what he did once it is done.
                if (applying.current) return;
                applying.current = true;
                void shown?.apply().then((ok) => {
                  applying.current = false;
                  if (ok) setStep("smith");
                  else {
                    setStep(undefined);
                    onward();
                  }
                });
              },
            },
            {
              label: "Skip",
              act: () => {
                setStep(undefined);
                onward();
              },
            },
          ]
        : step === "smith"
          ? [
              {
                label: "Next",
                main: true,
                act: () => {
                  if (applying.current) return;
                  shown?.byHand();
                  setStep("byHand");
                },
              },
            ]
          : step === "byHand"
            ? [{ label: "Next", main: true, act: () => (shown?.inCode(), setStep("code")) }]
            : step === "code"
              ? [{ label: "Next", main: true, act: () => setStep("end") }]
              : step === "end"
                ? [
                    { label: "Keep", main: true, act: () => leave(true) },
                    { label: "Undo", act: () => leave(false) },
                  ]
                : [
                    { label: last ? "Done" : "Next", main: true, act: next },
                    ...(last ? [] : [{ label: "Skip guide", act: end }]),
                  ],
  };
  // Esc: Skip on the offer, Undo during the shown change (and on), else the end of the tour.
  const onEscape = () => {
    if (applying.current) return;
    if (step === "offer") {
      setStep(undefined);
      onward();
    } else if (step) leave(false);
    else end();
  };
  const keys = useRef({ line, onEscape });
  keys.current = { line, onEscape };

  // Smith's line for the stop, with its chips.
  // biome-ignore lint/correctness/useExhaustiveDependencies: each stop and step once, as it opens
  useEffect(() => {
    if (line) asLine?.(line);
  }, [current, step, shown, asLine]);
  // Enter is the main chip and Esc as above, while no control has the focus (§12.2).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inControl(document.activeElement)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        keys.current.onEscape();
      } else if (e.key === "Enter") {
        e.preventDefault();
        keys.current.line?.chips.find((c) => c.main)?.act();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!box || !line) return null;
  const lit = own ? `shown-${step}` : current?.stop.anchor;
  const ring = (
    <div
      key={lit}
      aria-hidden
      data-guide-lit={lit}
      className="guide-lit pointer-events-none fixed z-[45] rounded-md ring-2 ring-accent"
      style={{ top: box.top - 4, left: box.left - 4, width: box.width + 8, height: box.height + 8 }}
    />
  );
  // A phone: the place lit, nothing dimmed; Smith's line says the stop.
  if (!cards && asLine) return ring;
  const hole = {
    top: box.top - 4,
    left: box.left - 4,
    right: box.right + 4,
    bottom: box.bottom + 4,
  };
  const dim = "fixed z-40 bg-black/25";
  const position = cardAt(box);
  return (
    <>
      {/* The rest dimmed a little and taking no clicks: four panes around the place. */}
      <div aria-hidden className={dim} style={{ top: 0, left: 0, right: 0, height: hole.top }} />
      <div aria-hidden className={dim} style={{ top: hole.bottom, left: 0, right: 0, bottom: 0 }} />
      <div
        aria-hidden
        className={dim}
        style={{ top: hole.top, left: 0, width: hole.left, height: hole.bottom - hole.top }}
      />
      <div
        aria-hidden
        className={dim}
        style={{ top: hole.top, left: hole.right, right: 0, height: hole.bottom - hole.top }}
      />
      {ring}
      <section
        aria-label={`Guide: ${line.stop.title}`}
        data-guide-beside={line.stop.anchor}
        data-guide-step={step}
        className="smith-line fixed z-[55] space-y-2 rounded-lg border border-line bg-panel p-3 shadow-lg"
        style={{ ...position, width: CARD.width }}
      >
        <p className="text-xs text-quiet">
          {at + 1} of {stops.length}
        </p>
        <h2 className="text-sm font-semibold">{line.stop.title}</h2>
        <p className="text-sm text-fg-soft">{firstSentence(line.stop.text)}</p>
        <div className="flex justify-end gap-2">
          {[...line.chips].reverse().map((chip) => (
            <Button
              key={chip.label}
              variant={chip.main ? undefined : "ghost"}
              className="smith-chip"
              onClick={chip.act}
            >
              {chip.label}
            </Button>
          ))}
        </div>
      </section>
    </>
  );
}
