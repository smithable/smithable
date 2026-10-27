// A sideways pan on a phone (Johan, 2026-10-27, A 173–174): the row of windows follows the finger
// and goes on to the next when the slide passed a third of the width or was a flick, else back.
// It works anywhere in a window, unless what is under the finger scrolls sideways itself (a wide
// table, a range, a carousel), which keeps the gesture; vertical panning stays the content's.
import { useRef, useState } from "react";

/** Whether the element, or one between it and `root`, scrolls sideways itself or takes the pan. */
export function ownsSideways(start: Element | null, root: Element | null): boolean {
  for (let e = start; e && e !== root; e = e.parentElement) {
    if (e instanceof HTMLInputElement && e.type === "range") return true;
    const style = getComputedStyle(e);
    if (style.touchAction === "none" || style.touchAction.includes("pan-x")) return true;
    if (e.scrollWidth > e.clientWidth + 1 && /auto|scroll/.test(style.overflowX)) return true;
  }
  return false;
}

/**
 * The pan's handlers and where the row is: `dx` while a finger moves it (only where `follows`
 * says the row moves with it), then `onRelease` with the direction (1 the next, -1 the one
 * before) when the slide went far or fast enough. Touch and pen only: a mouse selects text.
 */
export function usePan(options: {
  enabled: boolean;
  follows: (start: Element) => boolean;
  onRelease: (direction: 1 | -1, start: Element) => void;
}) {
  const [dx, setDx] = useState(0);
  const pan = useRef<{
    x: number;
    y: number;
    start: Element;
    root: Element;
    sideways?: boolean;
    last: { x: number; t: number }[];
  }>(undefined);
  const end = (x?: number) => {
    const p = pan.current;
    pan.current = undefined;
    setDx(0);
    if (!p?.sideways || x === undefined) return;
    const moved = x - p.x;
    // The speed over the last tenth of a second: a flick goes on however short it was.
    const recent = p.last.filter((m) => p.last.at(-1) && (p.last.at(-1)?.t ?? 0) - m.t < 100);
    const first = recent[0];
    const final = recent.at(-1);
    const speed =
      first && final && final.t > first.t ? (final.x - first.x) / (final.t - first.t) : 0;
    const width = (p.root as HTMLElement).clientWidth || window.innerWidth;
    if (Math.abs(moved) > width / 3 || Math.abs(speed) > 0.5)
      options.onRelease(moved < 0 ? 1 : -1, p.start);
  };
  const handlers = options.enabled
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          if (e.pointerType === "mouse" || !e.isPrimary) return;
          const start = e.target as Element;
          if (ownsSideways(start, e.currentTarget)) return;
          pan.current = {
            x: e.clientX,
            y: e.clientY,
            start,
            root: e.currentTarget,
            last: [{ x: e.clientX, t: e.timeStamp }],
          };
        },
        onPointerMove: (e: React.PointerEvent) => {
          const p = pan.current;
          if (!p) return;
          const x = e.clientX - p.x;
          const y = e.clientY - p.y;
          // Decided once the finger has moved: mostly sideways is the pan, else the content's.
          if (p.sideways === undefined) {
            if (Math.abs(x) < 10 && Math.abs(y) < 10) return;
            p.sideways = Math.abs(x) > Math.abs(y) * 1.2;
            if (!p.sideways) {
              pan.current = undefined;
              return;
            }
          }
          p.last = [...p.last.slice(-5), { x: e.clientX, t: e.timeStamp }];
          if (options.follows(p.start)) setDx(x);
        },
        onPointerUp: (e: React.PointerEvent) => end(e.clientX),
        onPointerCancel: () => end(),
      }
    : {};
  return { dx, dragging: pan.current?.sideways === true, handlers };
}
