// Parts both modes show: the app's preview and the change trace (ARCHITECTURE §9.7).
import { useState } from "react";
import type { TraceEntry } from "./api";
import { Button, cx, Input, Panel } from "./ui";

export function Preview({ url, version }: { url: string; version: number }) {
  const [path, setPath] = useState("/");
  const [typed, setTyped] = useState("/");
  return (
    <Panel
      title="Preview"
      className="h-full"
      actions={
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
      }
    >
      {/* Remounted after every change, so server code and data are fresh. */}
      <iframe
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
                {e.isUndo ? "undo" : "generator"} · {e.tokens} tokens
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
