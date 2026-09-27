// Parts both modes show: the app's preview and the change trace (ARCHITECTURE §9.7).
import { useEffect, useRef, useState } from "react";
import type { TraceEntry } from "./api";
import { isPreviewMessage } from "./preview";
import { Button, cx, Input, Panel } from "./ui";

export function Preview({
  url,
  version,
  selecting,
  onSelecting,
}: {
  url: string;
  version: number;
  /** Select mode: clicking in the preview selects a part of the spec instead of using the app. */
  selecting?: boolean;
  onSelecting?: (on: boolean) => void;
}) {
  const [path, setPath] = useState("/");
  const [typed, setTyped] = useState("/");
  const frame = useRef<HTMLIFrameElement>(null);
  // Tell the page's editor about select mode now, and whenever the page (re)loads.
  useEffect(() => {
    const send = () =>
      frame.current?.contentWindow?.postMessage(
        { type: "smithable:select-mode", on: Boolean(selecting) },
        "*",
      );
    send();
    const onMessage = (e: MessageEvent) => {
      if (isPreviewMessage(e.data) && e.data.type === "ready") send();
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
              setPath(typed.startsWith("/") ? typed : `/${typed}`);
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
        </div>
      }
    >
      {/* Remounted after every change, so server code and data are fresh. */}
      <iframe
        ref={frame}
        key={`${version}-${path}`}
        title="App preview"
        src={`${url}${path}`}
        className="h-full w-full border-0"
      />
    </Panel>
  );
}

export function Trace({ entries }: { entries: TraceEntry[] }) {
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
              <p className={cx("text-sm", e.undone && "line-through")}>{e.description}</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {e.isUndo ? "undo" : e.engine}
                {e.model ? ` (${e.model})` : ""} · {e.tokens.toLocaleString("en")} tokens
                {e.cost ? ` · €${e.cost.toFixed(4)}` : ""}
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
