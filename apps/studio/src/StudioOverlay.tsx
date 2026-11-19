import {
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cx } from "./ui";

type Point = { left: number; top: number };
type Corner = "Top left" | "Top right" | "Bottom left" | "Bottom right";
const corners = ["Top left", "Top right", "Bottom left", "Bottom right"] as const;
const margin = 12;

export function useOverlayPosition(
  key: string,
  box: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  const storageKey = `smithable:overlay:${key}`;
  const [preferred, setPreferred] = useState<Point>();
  const [size, setSize] = useState({ width: 0, height: 0, viewWidth: 0, viewHeight: 0 });
  const drag = useRef<{ id: number; x: number; y: number; start: Point; moved: boolean }>(
    undefined,
  );
  const [moving, setMoving] = useState<Point>();
  const lastMove = useRef<Point>(undefined);
  const suppressClick = useRef(false);

  useLayoutEffect(() => {
    try {
      const kept = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Point | null;
      setPreferred(
        kept && Number.isFinite(kept.left) && Number.isFinite(kept.top) ? kept : undefined,
      );
    } catch {
      setPreferred(undefined);
    }
  }, [storageKey]);

  useLayoutEffect(() => {
    const node = box.current;
    if (!node || !enabled) return;
    const measure = () => {
      const { width, height } = node.getBoundingClientRect();
      if (!width || !height) return;
      const next = { width, height, viewWidth: window.innerWidth, viewHeight: window.innerHeight };
      setSize((previous) =>
        Object.entries(next).every(([key, value]) => previous[key as keyof typeof next] === value)
          ? previous
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [box, enabled]);

  const right = Math.max(margin, size.viewWidth - size.width - margin);
  const bottom = Math.max(margin, size.viewHeight - size.height - margin);
  const top = Math.min(60, bottom);
  const clamp = (point: Point) => ({
    left: Math.max(margin, Math.min(right, point.left)),
    top: Math.max(top, Math.min(bottom, point.top)),
  });
  const place = (point?: Point) => {
    setPreferred(point);
    try {
      if (point) localStorage.setItem(storageKey, JSON.stringify(point));
      else localStorage.removeItem(storageKey);
    } catch {}
  };
  const finish = (event: PointerEvent<HTMLButtonElement>, keep: boolean) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = undefined;
    if (keep && lastMove.current && start.moved) place(lastMove.current);
    suppressClick.current = start.moved;
    lastMove.current = undefined;
    setMoving(undefined);
  };
  return {
    position: enabled && (moving || preferred) ? clamp((moving ?? preferred) as Point) : undefined,
    choose: (corner: Corner) =>
      place({
        left: corner.endsWith("right") ? right : margin,
        top: corner.startsWith("Bottom") ? bottom : top,
      }),
    reset: () => place(),
    consumeDrag: () => {
      const result = suppressClick.current;
      suppressClick.current = false;
      return result;
    },
    gestures: {
      onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        const rect = box.current?.getBoundingClientRect();
        if (!rect || event.button !== 0) return;
        suppressClick.current = false;
        drag.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          start: { left: rect.left, top: rect.top },
          moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        const start = drag.current;
        if (start?.id !== event.pointerId) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!start.moved && Math.hypot(dx, dy) < 4) return;
        start.moved = true;
        lastMove.current = clamp({ left: start.start.left + dx, top: start.start.top + dy });
        setMoving(lastMove.current);
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => finish(event, true),
      onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => finish(event, false),
      onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => finish(event, false),
    },
  };
}

export function OverlayPositionControl({
  label,
  movement,
}: {
  label: string;
  movement: ReturnType<typeof useOverlayPosition>;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const choose = (act: () => void) => {
    act();
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <fieldset
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (!open || event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={`Move ${label}`}
        aria-expanded={open}
        title="Drag or choose a corner"
        className="grid size-8 cursor-grab touch-none place-items-center rounded text-sm text-muted hover:bg-subtle active:cursor-grabbing"
        {...movement.gestures}
        onClick={(event) => {
          if (event.detail === 0 || !movement.consumeDrag()) setOpen(!open);
        }}
      >
        <span aria-hidden="true">⋮</span>
      </button>
      {open && (
        <fieldset
          aria-label={`${label} position`}
          className="absolute right-0 top-full z-10 w-max rounded-md border border-line bg-panel p-1 text-sm shadow-xl"
        >
          {corners.map((corner) => (
            <button
              key={corner}
              type="button"
              className="block w-full rounded px-3 py-1.5 text-left hover:bg-subtle"
              onClick={() => choose(() => movement.choose(corner))}
            >
              {corner}
            </button>
          ))}
          <button
            type="button"
            className="block w-full rounded border-t border-line px-3 py-1.5 text-left hover:bg-subtle"
            onClick={() => choose(movement.reset)}
          >
            Reset position
          </button>
        </fieldset>
      )}
    </fieldset>
  );
}

export function StudioOverlay({
  name,
  title,
  narrow,
  width = "panel",
  modal = false,
  closeLabel = "Close",
  canClose = true,
  onClose,
  children,
}: {
  name: string;
  title: string;
  narrow: boolean;
  width?: "panel" | "wide" | "editor";
  modal?: boolean;
  closeLabel?: string;
  canClose?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const movement = useOverlayPosition(name, dialog, !narrow);
  useLayoutEffect(() => {
    const previous = document.activeElement;
    if (modal) dialog.current?.showModal();
    else dialog.current?.show();
    close.current?.focus();
    return () => {
      if (previous instanceof HTMLElement)
        queueMicrotask(() => {
          if (previous.isConnected && document.activeElement === document.body) previous.focus();
        });
    };
  }, [modal]);
  return (
    <dialog
      ref={dialog}
      data-studio-overlay={name}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (canClose) onClose();
      }}
      onKeyDown={(event) => {
        if (modal || event.key !== "Escape" || !canClose) return;
        event.stopPropagation();
        onClose();
      }}
      className={cx(
        "fixed z-[55] m-0 max-w-none overflow-visible rounded-2xl border border-line bg-panel p-0 text-fg shadow-2xl open:flex open:flex-col",
        narrow
          ? "inset-x-1.5 top-auto bottom-1.5 max-h-[72dvh] w-auto"
          : cx(
              "right-4 left-auto top-24 bottom-auto max-h-[calc(100dvh-7rem)]",
              width === "editor"
                ? "w-[min(72rem,calc(100vw-2rem))]"
                : width === "wide"
                  ? "w-[min(54rem,calc(100vw-2rem))]"
                  : "w-[min(25rem,calc(100vw-2rem))]",
            ),
      )}
      style={
        movement.position ? { ...movement.position, right: "auto", bottom: "auto" } : undefined
      }
    >
      {narrow && (
        <div
          aria-hidden="true"
          className="mx-auto mt-3 h-1 w-9 shrink-0 rounded-full bg-line-strong"
        />
      )}
      <header className="flex shrink-0 items-center gap-1 border-b border-line px-4 py-2">
        <h2 className="min-w-0 flex-1 text-base font-semibold">{title}</h2>
        {!narrow && <OverlayPositionControl label={title} movement={movement} />}
        <button
          ref={close}
          type="button"
          aria-label={closeLabel}
          title={closeLabel}
          disabled={!canClose}
          className="grid size-8 shrink-0 place-items-center rounded text-muted hover:bg-subtle disabled:opacity-40"
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className="min-h-0 overflow-auto overscroll-contain rounded-b-2xl">{children}</div>
    </dialog>
  );
}
