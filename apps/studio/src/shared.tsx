// Parts both modes show: the app's preview and the change trace (ARCHITECTURE §9.7).
import { useEffect, useRef, useState } from "react";
import type { TraceEntry } from "./api";
import { isPreviewMessage, previewTarget, setPreview } from "./preview";
import { Button, cx, Input, Panel } from "./ui";

export function Preview({
  url,
  version,
  updating,
  selecting,
  onSelecting,
  onHide,
}: {
  url: string;
  version: number;
  /** A change went through and the preview is about to reload with it. */
  updating?: boolean;
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
  // The app's dev server may be starting, or restarting after a change, and a frame never
  // retries a page that failed to load: the frame is made once the server answers ("Starting…"
  // until then, retried with a short backoff), and after a few minutes a Retry button.
  const [attempt, setAttempt] = useState(0);
  // A new frame after every change, Go or Retry; the server's state is for one frame.
  const frameKey = `${version}-${opened}-${attempt}`;
  const [answer, setAnswer] = useState({
    key: "",
    server: "starting" as "starting" | "up" | "down",
  });
  const server = answer.key === frameKey ? answer.server : "starting";
  // The last page that was up stays on screen while the next one starts (a change can restart
  // the app's server for seconds), instead of an empty panel.
  const [shown, setShown] = useState<{ key: string; src: string }>();
  useEffect(() => {
    if (server === "up") setShown({ key: frameKey, src: `${url}${current.current}` });
  }, [server, frameKey, url]);
  const stale = server === "starting" ? shown : undefined;
  useEffect(() => {
    let stopped = false;
    (async () => {
      const until = Date.now() + 180_000;
      for (let wait = 250; !stopped; wait = Math.min(wait * 2, 4000)) {
        if (await answers(url)) return stopped || setAnswer({ key: frameKey, server: "up" });
        if (Date.now() > until) return stopped || setAnswer({ key: frameKey, server: "down" });
        await new Promise((r) => setTimeout(r, wait));
      }
    })();
    return () => {
      stopped = true;
    };
  }, [url, frameKey]);
  // A page that loaded without the preview editor's "ready" (the server's error page, or one
  // that stopped while loading) is loaded again: a server that no longer answers is waited for.
  const ready = useRef(false);
  // Error pages in a row: a request that arrived while the server rebuilt after a change gets
  // a 500 page, which answers but has no editor; it is loaded again, a few times.
  const errors = useRef(0);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (isPreviewMessage(e) && e.data.type === "ready") {
        ready.current = true;
        errors.current = 0;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  const loaded = () => {
    ready.current = false;
    setTimeout(async () => {
      if (ready.current) return;
      if (!(await answers(url)) || errors.current++ < 3) setAttempt((n) => n + 1);
    }, 8000);
  };
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
      busy={updating}
      className="h-full"
      actions={
        <div className="flex items-center gap-2">
          {updating && <span className="text-xs text-neutral-500">Updating…</span>}
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
      {/* Remounted after every change, so server code and data are fresh; until the new one is
          up, the last one stays. */}
      {server !== "up" && !stale ? (
        <div role="status" className="grid h-full place-items-center p-6 text-sm text-neutral-500">
          {server === "starting" ? (
            <p>Starting…</p>
          ) : (
            <div className="space-y-3 text-center">
              <p>The preview is not answering.</p>
              <Button onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
            </div>
          )}
        </div>
      ) : (
        <iframe
          ref={(el) => {
            frame.current = el;
            // The one window whose messages count, recorded as the frame is (re)made.
            setPreview(el?.contentWindow ?? null, url);
          }}
          key={stale?.key ?? frameKey}
          title="App preview"
          src={stale?.src ?? `${url}${current.current}`}
          onLoad={loaded}
          className="h-full w-full border-0"
        />
      )}
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
                {/* The Builder (words given) says only when, and the model's use where there was
                    one; Studio says how every change was made. */}
                {!words || e.tokens > 0 ? (
                  <>
                    {e.isUndo ? "undo" : e.engine}
                    {e.model ? ` (${e.model})` : ""} · {e.tokens.toLocaleString("en")} tokens
                    {e.cost ? ` · ${e.currency === "USD" ? "$" : "€"}${e.cost.toFixed(4)}` : ""}
                    {!words && e.ms !== undefined ? ` · ${(e.ms / 1000).toFixed(1)} s` : ""} ·{" "}
                  </>
                ) : null}
                {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/**
 * Whether the app's server answers at all. A cross-origin request reads nothing, but it fails
 * only when nothing answers (a server that is starting or has stopped).
 */
async function answers(url: string): Promise<boolean> {
  try {
    await fetch(`${url}/health`, { mode: "no-cors", cache: "no-store" });
    return true;
  } catch {
    return false;
  }
}
