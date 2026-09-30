// Parts both modes show: the app's preview and the change trace (ARCHITECTURE §9.7).
import { useEffect, useRef, useState } from "react";
import type { TraceEntry } from "./api";
import { isPreviewMessage, previewTarget, setPreview } from "./preview";
import { Button, cx, Input, Panel } from "./ui";

export function Preview({
  url,
  version,
  selecting,
  onSelecting,
  onHide,
}: {
  url: string;
  version: number;
  /** Select mode: clicking in the preview selects a part of the spec instead of using the app. */
  selecting?: boolean;
  onSelecting?: (on: boolean) => void;
  /** Hides the preview's column, for more room (wide windows). */
  onHide?: () => void;
}) {
  // The page the preview is on, as it reports it: a reload after a change comes back to it.
  const current = useRef("/");
  const [opened, setOpened] = useState(0);
  const [typed, setTyped] = useState("/");
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // The router reports the same page again (replaceState); only a new page is news, so
      // what is being typed in the address is not overwritten.
      if (!isPreviewMessage(e) || e.data.type !== "navigated" || e.data.path === current.current)
        return;
      current.current = e.data.path;
      setTyped(e.data.path);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  // Tell the page's editor about select mode now, and whenever the page (re)loads.
  useEffect(() => {
    const send = () =>
      frame.current?.contentWindow?.postMessage(
        { type: "smithable:select-mode", on: Boolean(selecting) },
        previewTarget(),
      );
    send();
    const onMessage = (e: MessageEvent) => {
      if (isPreviewMessage(e) && e.data.type === "ready") send();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [selecting]);
  return (
    <Panel
      title="Preview"
      className="h-full"
      actions={
        <div className="flex items-center gap-2">
          {onSelecting && (
            <Button
              variant={selecting ? "primary" : "ghost"}
              aria-pressed={Boolean(selecting)}
              className="h-7 border border-neutral-200"
              onClick={() => onSelecting(!selecting)}
            >
              Select
            </Button>
          )}
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              current.current = typed.startsWith("/") ? typed : `/${typed}`;
              setOpened((n) => n + 1);
            }}
          >
            <Input
              aria-label="Preview address"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="h-7 w-56 font-mono text-xs"
            />
            <Button type="submit" variant="ghost" className="h-7">
              Go
            </Button>
          </form>
          {onHide && (
            <Button variant="ghost" className="h-7" onClick={onHide}>
              Hide
            </Button>
          )}
        </div>
      }
    >
      {/* Remounted after every change, so server code and data are fresh. */}
      <iframe
        ref={(el) => {
          frame.current = el;
          // The one window whose messages count, recorded as the frame is (re)made.
          setPreview(el?.contentWindow ?? null, url);
        }}
        key={`${version}-${opened}`}
        title="App preview"
        src={`${url}${current.current}`}
        className="h-full w-full border-0"
      />
    </Panel>
  );
}

/** `words` words an entry the Builder's way ("Customers: added a website"), where it can. */
export function Trace({
  entries,
  words,
}: {
  entries: TraceEntry[];
  words?: (op: string, args: Record<string, unknown>) => string | undefined;
}) {
  const text = (e: TraceEntry) => {
    const plain = e.operation && words?.(e.operation.op, e.operation.args);
    return plain ? (e.isUndo ? `Undid: ${plain}` : plain) : e.description;
  };
  return (
    <Panel title="Changes" className="h-full">
      {entries.length === 0 ? (
        <p className="p-3 text-sm text-neutral-500">No changes yet.</p>
      ) : (
        <ol aria-label="Change trace" className="divide-y divide-neutral-100">
          {entries.map((e) => (
            <li
              key={`${e.at}-${e.description}`}
              className={cx("px-3 py-2", e.undone && "opacity-50")}
            >
              <p className={cx("text-sm", e.undone && "line-through")}>{text(e)}</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {e.isUndo ? "undo" : e.engine}
                {e.model ? ` (${e.model})` : ""} · {e.tokens.toLocaleString("en")} tokens
                {e.cost ? ` · ${e.currency === "USD" ? "$" : "€"}${e.cost.toFixed(4)}` : ""}
                {e.ms !== undefined ? ` · ${(e.ms / 1000).toFixed(1)} s` : ""} ·{" "}
                {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
