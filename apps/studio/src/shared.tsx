// Parts both modes show: the app's preview and the change trace (ARCHITECTURE §9.7).

import type { SpecPlugin } from "@smithable/core";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { api, type ChangeDetail, type TraceEntry } from "./api";
import { type PartChange, summaryDiff } from "./builder/change-diff";
import { isPreviewMessage, previewTarget, setPreview } from "./preview";
import { ReportDialog } from "./Report";
import { Button, cx, Input, Panel } from "./ui";

const PAGE_KEY = "smithable:preview-page";
/** The page the preview is on, e.g. "/customers/12". */
export const keptPage = () => {
  try {
    return sessionStorage.getItem(PAGE_KEY) ?? "/";
  } catch {
    return "/";
  }
};

export function Preview({
  url,
  version,
  updating,
  selecting,
  inCode,
  onSelecting,
  onHide,
  highlight,
  pages = [],
}: {
  url: string;
  version: number;
  /** A change went through and the preview is about to reload with it. */
  updating?: boolean;
  /** Select mode: clicking in the preview selects a part of the spec instead of using the app. */
  selecting?: boolean;
  /** Code mode: a text clicked in select mode goes to its line in the content file instead of
   * being changed in place. */
  inCode?: boolean;
  onSelecting?: (on: boolean) => void;
  /** Hides the preview's column, for more room (wide windows). */
  onHide?: () => void;
  /** What the last change touched, flashed once in the preview (motion.md 9a); `key` names the change. */
  highlight?: { key: string; concepts: string[] };
  /** The app's pages, each its address and its title: offered under the address as it is typed. */
  pages?: [string, string][];
}) {
  // The preview's records are samples, and a published app starts empty: said until dismissed.
  const [samples, setSamples] = useState(() => {
    try {
      return localStorage.getItem("samplesNoticeDismissed") !== "1";
    } catch {
      return true;
    }
  });
  const dismissSamples = () => {
    setSamples(false);
    try {
      localStorage.setItem("samplesNoticeDismissed", "1");
    } catch {}
  };
  // The page the preview is on, as it reports it: a reload after a change comes back to it, and
  // so does reloading Studio (kept for the browser tab's session, like the place in each mode).
  const current = useRef(keptPage());
  const [opened, setOpened] = useState(0);
  const [typed, setTyped] = useState(current.current);
  const frame = useRef<HTMLIFrameElement>(null);
  // Ctrl+R with the pointer over the preview reloads the preview alone (Johan, 2026-10-10); with
  // the preview focused, its page's editor does the same.
  const over = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (over.current && (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        setAttempt((n) => n + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
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
  // The address a frame is made with, fixed for that frame: the app's own navigation inside it
  // updates the address bar (current), and a src that followed would load the page again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new frame (frameKey) takes the page shown now
  const src = useMemo(() => `${url}${current.current}`, [frameKey, url]);
  // The last page that was up stays on screen while the next one starts (a change can restart
  // the app's server for seconds), instead of an empty panel.
  // It is the last frame whose page said it was ready: one that loaded an error page while the
  // server rebuilt never replaces it, so a change shows the old page dimmed, never a white one.
  const [shown, setShown] = useState<{ key: string; src: string; opened: number }>();
  const now = useRef({ frameKey, opened, url });
  now.current = { frameKey, opened, url };
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isPreviewMessage(e) || e.data.type !== "ready") return;
      if (e.source !== frame.current?.contentWindow) return;
      const { frameKey: key, opened: at, url: base } = now.current;
      setShown({ key, src: `${base}${current.current}`, opened: at });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  // Only across a change to the app: after Go the page asked for comes, not the last one (whose
  // location messages would otherwise put the old address back).
  const stale = shown && shown.key !== frameKey && shown.opened === opened ? shown : undefined;
  useEffect(() => {
    let stopped = false;
    (async () => {
      const until = Date.now() + 180_000;
      for (let wait = 250; !stopped; wait = Math.min(wait * 2, 4000)) {
        if (await answers()) return stopped || setAnswer({ key: frameKey, server: "up" });
        if (Date.now() > until) return stopped || setAnswer({ key: frameKey, server: "down" });
        await new Promise((r) => setTimeout(r, wait));
      }
    })();
    return () => {
      stopped = true;
    };
  }, [frameKey]);
  // A page that loaded without the preview editor's "ready" (the server's error page, or one
  // that stopped while loading) is loaded again: a server that no longer answers is waited for.
  const ready = useRef(false);
  // Error pages in a row: a request that arrived while the server rebuilt after a change gets
  // a 500 page, which answers but has no editor; it is loaded again, a few times.
  const errors = useRef(0);
  // A page without its stylesheet starts the preview again, once for each change: one still
  // without it after that is the app's own (a broken src/custom/styles.css).
  const restyled = useRef<number>(undefined);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isPreviewMessage(e) || e.data.type !== "unstyled" || restyled.current === version)
        return;
      restyled.current = version;
      void api.previewRestart("unstyled").then(() => setAttempt((n) => n + 1));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [version]);
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
      if (!(await answers()) || errors.current++ < 3) setAttempt((n) => n + 1);
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
      try {
        sessionStorage.setItem(PAGE_KEY, e.data.path);
      } catch {}
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  // Tell the page's editor about select mode now, and whenever the page (re)loads.
  useEffect(() => {
    const send = () =>
      frame.current?.contentWindow?.postMessage(
        { type: "smithable:select-mode", on: Boolean(selecting), code: Boolean(inCode) },
        previewTarget(),
      );
    send();
    const onMessage = (e: MessageEvent) => {
      if (isPreviewMessage(e) && e.data.type === "ready") send();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [selecting, inCode]);
  // What the last change touched, flashed in the page (motion.md 9a): at once, for a change the
  // page shows without reloading (a text edited in place), and again to each page that says it
  // is ready until one answers that it has flashed it. A change may reload the page more than
  // once, the first time without the new content: marking it done when sent lost the flash.
  // After a minute it is no longer news.
  // The page may say it is ready before Studio hears of the change, so the newest one is kept.
  const flashed = useRef<string | undefined>(undefined);
  // What was flashed last, on the frame for tests to read: a flash is over in 1.6 s, this stays.
  const [flashedConcepts, setFlashedConcepts] = useState<string>();
  const latest = useRef(highlight);
  const since = useRef(0);
  useEffect(() => {
    latest.current = highlight;
    if (!highlight?.concepts.length) return;
    since.current = Date.now();
    frame.current?.contentWindow?.postMessage(
      { type: "smithable:highlight", key: highlight.key, concepts: highlight.concepts },
      previewTarget(),
    );
  }, [highlight]);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isPreviewMessage(e)) return;
      if (e.data.type === "flashed") {
        if (e.data.key) {
          flashed.current = e.data.key;
          if (latest.current?.key === e.data.key)
            setFlashedConcepts(latest.current.concepts.join(" "));
        }
        return;
      }
      const now = latest.current;
      if (e.data.type !== "ready" || !now?.concepts.length) return;
      if (flashed.current === now.key || Date.now() - since.current > 60_000) return;
      (e.source as Window | null)?.postMessage(
        { type: "smithable:highlight", key: now.key, concepts: now.concepts },
        previewTarget(),
      );
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  // The address's list of the app's pages: while the field has the focus, those whose address
  // or title has what is typed (all of them for an empty field or "/"), eight at most. Our own
  // list, not a datalist, which an iPhone does not show.
  const listId = useId();
  const [listing, setListing] = useState(false);
  const [active, setActive] = useState(-1);
  const wanted = typed.replace(/^\//, "").toLowerCase();
  const matches = pages
    .filter(([route, title]) => `${route} ${title}`.toLowerCase().includes(wanted))
    .slice(0, 8);
  const open = (path: string) => {
    current.current = path.startsWith("/") ? path : `/${path}`;
    setTyped(current.current);
    setListing(false);
    setActive(-1);
    setOpened((n) => n + 1);
  };
  // Updating until the new frame is up: the last one stays meanwhile, dimmed, then is replaced.
  const reloading = updating || Boolean(stale);
  return (
    <Panel
      title="Preview"
      busy={reloading}
      className="h-full"
      actions={
        <div className="flex items-center gap-2">
          {reloading && <span className="text-xs text-quiet">Updating…</span>}
          {onSelecting && (
            <Button
              variant={selecting ? "primary" : "ghost"}
              aria-pressed={Boolean(selecting)}
              className="h-7 border border-line"
              onClick={() => onSelecting(!selecting)}
            >
              Select
            </Button>
          )}
          <form
            className="relative flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              open(typed);
            }}
          >
            <Input
              aria-label="Preview address"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={listing && matches.length > 0}
              aria-controls={listId}
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              autoComplete="off"
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setListing(true);
                setActive(-1);
              }}
              onFocus={() => setListing(true)}
              onBlur={() => setListing(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (listing) e.stopPropagation();
                  setListing(false);
                  return;
                }
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setListing(true);
                  const step = e.key === "ArrowDown" ? 1 : -1;
                  setActive((at) => (at + step + matches.length) % Math.max(matches.length, 1));
                  return;
                }
                const chosen = matches[active];
                if (e.key === "Enter" && listing && chosen) {
                  e.preventDefault();
                  open(chosen[0]);
                }
              }}
              className="h-7 w-56 font-mono text-xs"
            />
            {listing && matches.length > 0 && (
              <div
                id={listId}
                role="listbox"
                aria-label="Pages"
                className="absolute top-8 left-0 z-30 w-72 rounded-md border border-line bg-panel py-1 shadow-lg"
              >
                {matches.map(([route, title], index) => (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: the keys are the address field's (a combobox)
                  <div
                    key={route}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    tabIndex={-1}
                    // Picked before the field loses the focus (and the list with it).
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => open(route)}
                    className={cx(
                      "flex cursor-pointer items-baseline gap-2 px-2 py-1 text-xs",
                      index === active ? "bg-accent-soft" : "hover:bg-subtle",
                    )}
                  >
                    <span className="font-mono">{route}</span>
                    <span className="truncate text-quiet">{title}</span>
                  </div>
                ))}
              </div>
            )}
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
      <div data-guide="preview" className="flex h-full flex-col">
        {samples && (
          <div
            role="note"
            className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          >
            <p className="flex-1">
              The records you see are samples for trying the app. Your published app starts empty:
              what you add or change here is not published.
            </p>
            <Button variant="ghost" className="h-6" onClick={dismissSamples}>
              Dismiss
            </Button>
          </div>
        )}
        <div className="min-h-0 flex-1">
          {/* Remounted after every change, so server code and data are fresh; until the new one
              is up, the last one stays, dimmed and inert. */}
          {server === "down" || (server !== "up" && !stale) ? (
            <div role="status" className="grid h-full place-items-center p-6 text-sm text-quiet">
              {server === "starting" ? (
                <p>Starting…</p>
              ) : (
                <Stuck key={frameKey} retry={() => setAttempt((n) => n + 1)} />
              )}
            </div>
          ) : (
            <div
              className="relative h-full"
              onPointerEnter={() => {
                over.current = true;
              }}
              onPointerLeave={() => {
                over.current = false;
              }}
            >
              {/* The last ready page, kept (same key, so not loaded again) until the new one is. */}
              {stale && (
                <iframe
                  key={stale.key}
                  title="Previous preview"
                  aria-hidden
                  tabIndex={-1}
                  src={stale.src}
                  // Dimmed only when the new page takes a while: a change the app takes in
                  // without restarting (an undo) reloads in about a second, with nothing to see.
                  className="pointer-events-none absolute inset-0 h-full w-full border-0 opacity-60 transition-opacity delay-500 duration-200"
                />
              )}
              {server === "up" && (
                <iframe
                  ref={(el) => {
                    frame.current = el;
                    // The one window whose messages count, recorded as the frame is (re)made.
                    setPreview(el?.contentWindow ?? null, url);
                  }}
                  key={frameKey}
                  title="App preview"
                  // The kit's copy buttons (keys, invitation links) write to the clipboard.
                  allow="clipboard-write"
                  data-flashed={flashedConcepts}
                  src={src}
                  onLoad={loaded}
                  className={cx("absolute inset-0 h-full w-full border-0", stale && "opacity-0")}
                />
              )}
              {stale && (
                <p
                  role="status"
                  className="appear-late absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-fg/80 px-3 py-1 text-xs text-panel"
                >
                  Updating the preview…
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

/** `words` words an entry the Builder's way ("Customers: added a website"), where it can. */
/** Consecutive changes made for one request to a model, which the list shows as one. */
function grouped(entries: TraceEntry[]): TraceEntry[][] {
  const groups: TraceEntry[][] = [];
  for (const e of entries) {
    const last = groups.at(-1);
    if (e.request && last?.[0]?.request === e.request && !e.isUndo && !last[0].isUndo) last.push(e);
    else groups.push([e]);
  }
  return groups;
}

export function Trace({
  entries,
  words,
  plugins = [],
}: {
  entries: TraceEntry[];
  /** Builder's wording of an operation: given, an opened change says what changed in the summary's words; not, it shows the files' patch. */
  words?: (op: string, args: Record<string, unknown>) => string | undefined;
  plugins?: SpecPlugin[];
}) {
  const [open, setOpen] = useState<string>();
  const text = (e: TraceEntry) => {
    const plain = e.operation && words?.(e.operation.op, e.operation.args);
    return plain ? (e.isUndo ? `Undid: ${plain}` : plain) : e.description;
  };
  if (entries.length === 0) return <p className="p-3 text-sm text-quiet">No changes yet.</p>;
  return (
    <ol aria-label="Change trace" className="divide-y divide-line">
      {grouped(entries).map((group) => {
        const [e] = group as [TraceEntry, ...TraceEntry[]];
        const opened = open === e.id;
        return (
          <li key={e.id} className={cx("px-3 py-2", e.undone && "opacity-50")}>
            <button
              type="button"
              aria-expanded={opened}
              onClick={() => setOpen(opened ? undefined : e.id)}
              className="block w-full text-left"
            >
              <span className={cx("block text-sm", e.undone && "line-through")}>
                {group.length > 1 && e.request ? `You asked: ${e.request}` : text(e)}
              </span>
              <span className="mt-0.5 block text-xs text-quiet">
                {/* The Builder (words given) says only when, and the model's use where there was
                    one; Studio says how every change was made, and the files. */}
                {!words || e.tokens > 0 ? (
                  <>
                    {e.isUndo ? "undo" : e.engine}
                    {e.model ? ` (${e.model})` : ""} · {e.tokens.toLocaleString("en")} tokens
                    {e.cost ? ` · ${e.currency === "USD" ? "$" : "€"}${e.cost.toFixed(4)}` : ""}
                    {!words && e.ms !== undefined ? ` · ${(e.ms / 1000).toFixed(1)} s` : ""} ·{" "}
                  </>
                ) : null}
                {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {!words && e.files.length > 0 && ` · ${e.files.join(", ")}`}
              </span>
            </button>
            {opened && (
              <div className="mt-2 space-y-2">
                {group.length > 1 && (
                  <ul className="list-disc pl-5 text-xs text-muted">
                    {[...group].reverse().map((g) => (
                      <li key={g.id}>{text(g)}</li>
                    ))}
                  </ul>
                )}
                {words ? (
                  <PlainChange newest={e} oldest={group.at(-1) ?? e} plugins={plugins} />
                ) : (
                  <FilesChange entry={e} />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** A change in the summary's words: the sentences that went struck through, those that came. */
function PlainChange({
  newest,
  oldest,
  plugins,
}: {
  newest: TraceEntry;
  oldest: TraceEntry;
  plugins: SpecPlugin[];
}) {
  const [parts, setParts] = useState<PartChange[]>();
  useEffect(() => {
    let current = true;
    void Promise.all([api.change(oldest.id), api.change(newest.id)]).then(
      ([first, last]) => current && setParts(summaryDiff(first.before, last.after, plugins)),
      () => current && setParts([]),
    );
    return () => {
      current = false;
    };
  }, [newest.id, oldest.id, plugins]);
  if (!parts) return <p className="text-xs text-quiet">Reading the change…</p>;
  if (!parts.length)
    return (
      <p className="text-xs text-quiet">
        Nothing the summary says changed (the look, a text, or code).
      </p>
    );
  return (
    <section aria-label="What changed" className="space-y-2 text-sm">
      {parts.map((p) => (
        <div key={p.concept}>
          <p className="text-xs font-semibold text-muted">{p.title}</p>
          {p.removed.map((l) => (
            <p key={`-${l}`} className="text-quiet line-through">
              {l.replace(/^[-•*]\s+/, "")}
            </p>
          ))}
          {p.added.map((l) => (
            <p key={`+${l}`}>{l.replace(/^[-•*]\s+/, "")}</p>
          ))}
        </div>
      ))}
    </section>
  );
}

/** A change's patch of the person's files, and the whole patch on request. */
function FilesChange({ entry }: { entry: TraceEntry }) {
  const [all, setAll] = useState(false);
  const [detail, setDetail] = useState<ChangeDetail>();
  useEffect(() => {
    let current = true;
    void api.change(entry.id, all).then(
      (d) => current && setDetail(d),
      () => current && setDetail({ patch: "", generated: 0, before: {}, after: {} }),
    );
    return () => {
      current = false;
    };
  }, [entry.id, all]);
  if (!detail) return <p className="text-xs text-quiet">Reading the change…</p>;
  return (
    <div className="space-y-1">
      <section aria-label="The change's patch">
        <pre className="max-h-96 overflow-auto rounded bg-subtle p-2 text-xs">
          {detail.patch || "No file a person edits changed."}
        </pre>
      </section>
      {!all && detail.generated > 0 && (
        <button type="button" className="text-xs text-accent" onClick={() => setAll(true)}>
          and {detail.generated} generated {detail.generated === 1 ? "file" : "files"}
        </button>
      )}
    </div>
  );
}

/**
 * Whether the preview's server answers, as Studio's own server finds:
 * a browser cannot see the status of another origin, so a hosting service's "Starting…" page
 * would pass for the app.
 */
async function answers(): Promise<boolean> {
  return api.previewAnswers().then(
    (r) => r.ok,
    () => false,
  );
}

/**
 * The preview did not answer within the wait: what Studio knows (its last log lines), starting
 * it again, and a report of it, offered as for a change that failed.
 */
function Stuck({ retry }: { retry: () => void }) {
  const [stuck, setStuck] = useState<{ log: string[]; report?: "sent" | "offer" }>();
  const [reporting, setReporting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  useEffect(() => {
    api.previewStuck().then(setStuck, () => setStuck({ log: [] }));
  }, []);
  return (
    <div className="w-full max-w-xl space-y-3 text-center">
      <p>The preview is not answering.</p>
      {stuck && stuck.log.length > 0 && (
        <pre
          title="The preview's last lines"
          className="max-h-48 overflow-auto rounded-md bg-subtle p-2 text-left font-mono text-xs text-fg-soft"
        >
          {stuck.log.join("\n")}
        </pre>
      )}
      <div className="flex justify-center gap-2">
        <Button
          disabled={restarting}
          onClick={async () => {
            setRestarting(true);
            await api.previewRestart().catch(() => undefined);
            retry();
          }}
        >
          Start it again
        </Button>
        {stuck?.report === "offer" && (
          <Button variant="ghost" onClick={() => setReporting(true)}>
            Report this
          </Button>
        )}
      </div>
      {stuck?.report === "sent" && <p className="text-xs">A report of this was sent.</p>}
      {reporting && <ReportDialog onClose={() => setReporting(false)} />}
    </div>
  );
}
