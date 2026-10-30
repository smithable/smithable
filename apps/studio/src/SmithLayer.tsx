// Smith floating (docs/design/smith-first.md §12.1, §12.3): one layer that is first the overlay a
// new project opens on, Smith's thread alone at reading width over a calm backdrop with Studio
// loading behind, and then, closed, the panel hanging from the top bar's right over the preview.
// Closing moves the thread to its place while the backdrop lifts: floating, it stays the same
// element; docked, it moves to the left window, where it is drawn anew with everything said and
// the presentation as it was (Studio holds those), a proposal not yet applied being asked again.
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cx } from "./ui";

export type LayerMode = "overlay" | "closing" | "panel";
type Rect = { top: number; left: number; width: number; height: number };

/** A control has the focus: a key is the control's, not the overlay's. */
const inControl = (el: Element | null) =>
  Boolean(el?.closest("button, a, input, textarea, select, label, [contenteditable]"));

export function SmithLayer({
  mode,
  appName,
  lighter,
  phone,
  motion,
  side = "right",
  over,
  open = true,
  target,
  foldAfter,
  activity,
  onNext,
  onSkip,
  onClosed,
  onFold,
  onDock,
  children,
}: {
  mode: LayerMode;
  appName: string;
  /** The preview runs behind: the backdrop lets more of it through. */
  lighter: boolean;
  /** A phone: the overlay is the whole screen. */
  phone: boolean;
  /** Effects on (prefers-reduced-motion off): the closing moves, the panel's moves glide. */
  motion: boolean;
  /** The panel's side: the left when a guide's stop is under it on the right. */
  side?: "left" | "right";
  /** What the panel hangs over: the preview. */
  over?: Bounds;
  /** The panel open, or folded into Smith's face in the top bar. */
  open?: boolean;
  /** Where the closing takes the thread; the panel's place when not given. */
  target?: Rect;
  /** The panel folds after this long with nothing happening in it (after the guide). */
  foldAfter?: number;
  /** Changes when something happens in the thread (a new line). */
  activity?: number;
  onNext: () => void;
  onSkip: () => void;
  /** The closing has moved the thread to its place. */
  onClosed: () => void;
  onFold: () => void;
  /** Smith goes into the left window. */
  onDock: () => void;
  children: ReactNode;
}) {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const resize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const panel: Rect = panelRect(side, size.w, size.h, over);
  const overlay: Rect = phone
    ? { top: 0, left: 0, width: size.w, height: size.h }
    : (() => {
        const width = Math.min(672, size.w - 32);
        return { width, height: Math.min(760, size.h - 136), top: 112, left: (size.w - width) / 2 };
      })();
  const rect = mode === "overlay" ? overlay : mode === "closing" ? (target ?? panel) : panel;

  // The closing takes half a second with effects on (the one motion longer than a third of one,
  // §12.2), at once without.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, as the closing starts
  useEffect(() => {
    if (mode !== "closing") return;
    const done = setTimeout(onClosed, motion ? 500 : 0);
    return () => clearTimeout(done);
  }, [mode]);

  // A dialog while it is the overlay: the focus in it, and back where it was when it closes.
  const layer = useRef<HTMLDivElement>(null);
  const before = useRef<Element | null>(null);
  // The focus goes back once the closing is over, when Studio takes it again.
  const overlaid = mode !== "panel";
  useEffect(() => {
    if (!overlaid) return;
    before.current = document.activeElement;
    layer.current?.focus();
    return () => (before.current as HTMLElement | null)?.focus?.();
  }, [overlaid]);

  // The overlay's keys (§12.2): Enter or Space is Next and Esc is Skip while no control has the
  // focus, so nothing typed is eaten; no key reaches Studio behind it.
  const keys = useRef({ onNext, onSkip });
  keys.current = { onNext, onSkip };
  useEffect(() => {
    if (mode !== "overlay") return;
    const onKey = (e: KeyboardEvent) => {
      if (inControl(document.activeElement)) return;
      e.stopImmediatePropagation();
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        keys.current.onNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        keys.current.onSkip();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [mode]);

  // Folded into the face after a while with nothing happening in it.
  const [stirred, setStirred] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: again after each stir and line
  useEffect(() => {
    if (mode !== "panel" || !open || foldAfter === undefined) return;
    const later = setTimeout(onFold, foldAfter);
    return () => clearTimeout(later);
  }, [mode, open, foldAfter, stirred, activity]);
  const stir = () => setStirred((n) => n + 1);

  const shown = mode !== "panel" || open;
  return (
    <>
      {mode !== "panel" && (
        // The backdrop: the brand's dark tone with Studio softened behind; a click on it does
        // nothing (too easy beside an open question).
        <div
          aria-hidden="true"
          className={cx(
            "fixed inset-0 z-40 backdrop-blur-sm",
            motion && "transition-[opacity,background-color] duration-500",
            mode === "closing" && "opacity-0",
          )}
          style={{
            backgroundColor: lighter ? "oklch(17% 0.015 260 / 0.72)" : "oklch(17% 0.015 260 / 0.9)",
          }}
        >
          {!phone && (
            <p className="absolute inset-x-0 top-10 truncate px-6 text-center text-3xl font-semibold tracking-tight text-white">
              {appName}
            </p>
          )}
        </div>
      )}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a dialog or a region by its mode, whose taps and keys are the overlay's (§12.2) */}
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-modal only while it is the dialog */}
      <div
        ref={layer}
        tabIndex={-1}
        role={mode === "panel" ? "complementary" : "dialog"}
        aria-modal={mode === "panel" ? undefined : true}
        aria-label={mode === "panel" ? "Smith" : `Smith presents ${appName}`}
        data-smith-layer={mode}
        hidden={!shown}
        onPointerDown={stir}
        onKeyDown={stir}
        onClick={(e) => {
          // A tap on the thread, not on a control, brings the next part at once.
          if (mode === "overlay" && !inControl(e.target as Element)) onNext();
        }}
        className={cx(
          "fixed z-50 flex flex-col overflow-hidden bg-panel shadow-2xl outline-none",
          phone && mode !== "panel" ? "" : "rounded-xl border border-line",
          motion &&
            (mode === "closing"
              ? "transition-[top,left,width,height] duration-500 ease-in-out"
              : "transition-[left] duration-300 ease-out"),
        )}
        style={rect}
      >
        <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
          <h2 className="flex-1 text-xs font-semibold tracking-wide text-quiet uppercase">
            {mode === "panel" ? "Smith" : phone ? appName : "Smith"}
          </h2>
          {mode === "panel" ? (
            <>
              <button
                type="button"
                onClick={onDock}
                title="Put Smith in the window on the left"
                className="text-xs font-medium text-muted hover:underline"
              >
                Dock
              </button>
              <button
                type="button"
                onClick={onFold}
                aria-label="Close Smith"
                title="Close; his face in the top bar opens him again"
                className="flex size-6 items-center justify-center rounded text-muted hover:bg-subtle hover:text-fg"
              >
                ✕
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onSkip}
              className="smith-chip rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:border-accent hover:text-accent"
            >
              Skip
            </button>
          )}
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </>
  );
}

/** The floating panel's place on a side of what it hangs over, in a window this size. */
export function panelRect(side: "left" | "right", w: number, h: number, over?: Bounds) {
  const { left, right } = over ?? { left: 0, right: w };
  const width = Math.min(400, right - left - 24);
  return {
    width,
    height: Math.min(640, h - 72),
    top: 60,
    left: side === "right" ? right - width - 12 : left + 12,
  };
}

/** Where the panel hangs: over the preview, between its edges; the window without one. */
export type Bounds = { left: number; right: number };

/**
 * The side for the panel while a guide's stop is lit (§12.3): the other side when the stop's place
 * is under it on this one and not on that one, folded into his face when it is under it on both
 * (the stop's card then says it alone), else the right. The preview's stop is the place the panel
 * hangs over by design, and Smith's own stop is the panel.
 */
export function sideFor(
  anchor: string | undefined,
  box: DOMRect | undefined,
  w: number,
  h: number,
  over?: Bounds,
) {
  if (!anchor || !box || anchor === "preview" || anchor === "change") return "right";
  const hits = (side: "left" | "right") => {
    const r = panelRect(side, w, h, over);
    return (
      r.left < box.right &&
      r.left + r.width > box.left &&
      r.top < box.bottom &&
      r.top + r.height > box.top
    );
  };
  return !hits("right") ? "right" : !hits("left") ? "left" : "fold";
}

/** Where Smith lives (§12.3): floating over the preview, or docked as the left window. Per device. */
export function useSmithPlace(): ["floating" | "docked", (next: "floating" | "docked") => void] {
  const [place, setPlace] = useState<"floating" | "docked">(() => {
    try {
      return localStorage.getItem(PLACE) === "docked" ? "docked" : "floating";
    } catch {
      return "floating";
    }
  });
  return [
    place,
    (next) => {
      setPlace(next);
      try {
        localStorage.setItem(PLACE, next);
      } catch {}
    },
  ];
}
const PLACE = "smithable:smith";
