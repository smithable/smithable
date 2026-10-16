// The Ask panel's place (docs/design/ask-in-studio.md §1, §3): on a desktop right of the preview
// or under it, chosen from the panel's own corner and kept per device; on a phone a sheet over
// the preview, half its height first, dragged up to most of it or down to a one-line bar. Never
// the whole window: a change is confirmed looking at the app. App.tsx owns the slots; the
// Builder fills the one shown, so the panel keeps its words and forms.
import { type ReactNode, useEffect, useState } from "react";

export type Dock = "right" | "foot";
export type Sheet = "bar" | "half" | "full";

/** Where the panel is put: the slot App.tsx shows, and how to move it. */
export interface AskPlace {
  slot: HTMLElement | null;
  /** A phone: the sheet, not the dock. */
  narrow: boolean;
  dock: Dock;
  onDock: (dock: Dock) => void;
  sheet: Sheet;
  onSheet: (sheet: Sheet) => void;
}

const DOCK = "smithable:ask-dock";

/** The dock kept per device, and the sheet's height for the page's life. */
export function useAskPlace(narrow: boolean) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // Unchosen, under the preview, unless the window has room for a third column beside the
  // mode's panels and the preview.
  const [dock, setDockState] = useState<Dock>(() => {
    const unchosen = window.innerWidth >= 1600 ? "right" : "foot";
    try {
      return (localStorage.getItem(DOCK) as Dock | null) ?? unchosen;
    } catch {
      return unchosen;
    }
  });
  const onDock = (next: Dock) => {
    setDockState(next);
    try {
      localStorage.setItem(DOCK, next);
    } catch {}
  };
  const [sheet, onSheet] = useState<Sheet>("half");
  const place: AskPlace = { slot, narrow, dock, onDock, sheet, onSheet };
  return { place, setSlot };
}

/** The sheet's height for each state, of the room under the header. */
const HEIGHTS: Record<Sheet, string> = { bar: "2.75rem", half: "50%", full: "85%" };

/** A phone's sheet over the preview: a handle to drag, and the panel or its last line. */
export function AskSheet({
  sheet,
  onSheet,
  slotRef,
}: {
  sheet: Sheet;
  onSheet: (sheet: Sheet) => void;
  slotRef: (element: HTMLElement | null) => void;
}) {
  return (
    <section
      aria-label="Ask"
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-xl border-t border-line bg-panel shadow-lg"
      style={{ height: HEIGHTS[sheet] }}
    >
      <SheetHandle sheet={sheet} onSheet={onSheet} />
      <div ref={slotRef} className="flex min-h-0 flex-1 flex-col" />
    </section>
  );
}

/**
 * The sheet's handle: dragged, it settles at the nearest of the bar, half and most of the room;
 * clicked, it opens a bar to half and folds the rest to the bar; the arrow keys step.
 */
function SheetHandle({ sheet, onSheet }: { sheet: Sheet; onSheet: (sheet: Sheet) => void }) {
  const order: Sheet[] = ["bar", "half", "full"];
  const [start, setStart] = useState<number>();
  return (
    // biome-ignore lint/a11y/useSemanticElements: a window splitter has no element of its own
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Ask's height"
      aria-valuetext={{ bar: "folded", half: "half", full: "open" }[sheet]}
      aria-valuenow={order.indexOf(sheet)}
      aria-valuemin={0}
      aria-valuemax={2}
      tabIndex={0}
      title="Drag to make Ask taller or shorter"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setStart(e.clientY);
      }}
      onPointerUp={(e) => {
        if (start === undefined) return;
        setStart(undefined);
        const room = e.currentTarget.closest("main")?.getBoundingClientRect();
        if (!room || Math.abs(e.clientY - start) < 8) {
          onSheet(sheet === "bar" ? "half" : "bar");
          return;
        }
        const share = (room.bottom - e.clientY) / room.height;
        onSheet(share < 0.25 ? "bar" : share < 0.7 ? "half" : "full");
      }}
      onKeyDown={(e) => {
        const step = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
        const next = order[order.indexOf(sheet) + step];
        if (!step || !next) return;
        e.preventDefault();
        onSheet(next);
      }}
      className="flex h-4 shrink-0 cursor-row-resize touch-none items-center justify-center outline-none focus-visible:bg-accent/20"
    >
      <span className="h-1 w-10 rounded-full bg-line-strong" />
    </div>
  );
}

/**
 * The panel itself: its title with the dock's choice in its corner (a desktop), then the thread
 * and the box; on a phone's folded sheet, only the thread's last line.
 */
export function AskPanel({
  place,
  lastLine,
  children,
}: {
  place: AskPlace;
  lastLine: string;
  children: ReactNode;
}) {
  const { narrow, dock, onDock, sheet, onSheet } = place;
  // The thread's newest line in view, as a conversation scrolls.
  const [body, setBody] = useState<HTMLElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a new last line
  useEffect(() => {
    body?.scrollTo({ top: body.scrollHeight });
  }, [body, lastLine]);
  if (narrow && sheet === "bar")
    return (
      <button
        type="button"
        onClick={() => onSheet("half")}
        className="min-w-0 truncate px-3 text-left text-sm text-muted"
      >
        <span className="font-medium text-fg">Ask</span> · {lastLine}
      </button>
    );
  return (
    <div data-guide="change" className="flex min-h-0 flex-1 flex-col">
      {!narrow && (
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-1.5">
          <h2 className="flex-1 text-sm font-semibold">Ask</h2>
          <button
            type="button"
            className="text-xs text-muted underline"
            onClick={() => onDock(dock === "right" ? "foot" : "right")}
          >
            {dock === "right" ? "Dock under the preview" : "Dock right of the preview"}
          </button>
        </div>
      )}
      <div ref={setBody} className="min-h-0 flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
