import { humanize } from "@smithable/core";
import { describeChange } from "@smithable/index";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, EXPECT_RELOAD, type Making as MakingState, type Project } from "./api";
import wordmark from "./brand/wordmark.svg";
import wordmarkDark from "./brand/wordmark-dark.svg";
import { AskSheet, useAskPlace } from "./builder/AskDock";
import { Builder } from "./builder/Builder";
import { type Spec, useSpec } from "./engine";
import { doneKey, guideOff, TOURS } from "./guide";
import { logStore } from "./logs";
import { Making } from "./Making";
import { OutboxDialog } from "./Outbox";
import { isPreviewMessage, type Place, shared, touched, touchesPage } from "./preview";
import { ReportDialog } from "./Report";
import { plainRefusal } from "./refusal";
import { keptPage, Preview } from "./shared";
import { Button, cx, useMedia } from "./ui";

// Code mode (its editor, CodeMirror and the operation forms) and the tour load when first
// opened, so No code starts without them (the main chunk under Vite's 500 kB, backlog A 64).
const Studio = lazy(() => import("./studio/Studio").then((m) => ({ default: m.Studio })));
const Guide = lazy(() => import("./GuideTour").then((m) => ({ default: m.Guide })));

type Mode = "builder" | "studio";

/** A change that stopped to ask, because it loses data. */
interface Pending {
  name: string;
  args: Record<string, unknown>;
  impact: string;
}

/**
 * A project fetched again, with the waiting requests as the page has them: those follow the
 * "waiting" events, and a fetch answered just before a request was taken would put it back.
 */
function keepWaiting(shown: Project | undefined, next: Project): Project {
  return shown ? { ...next, waiting: shown.waiting } : next;
}

export function App() {
  const [project, setProject] = useState<Project>();
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem("mode") as Mode) ?? "builder");
  // A change's notice offers to undo it; errors stay until dismissed, other notices fade.
  const [message, setMessage] = useState<{
    ok: boolean;
    text: string;
    change?: boolean;
    report?: "sent" | "offer";
  }>();
  const [reporting, setReporting] = useState(false);
  const [outbox, setOutbox] = useState(false);
  const [holding, setHolding] = useState(false);
  useEffect(() => {
    if (!message?.ok || holding) return;
    const timer = setTimeout(() => setMessage(undefined), 8000);
    return () => clearTimeout(timer);
  }, [message, holding]);
  const [pending, setPending] = useState<Pending>();
  const [version, setVersion] = useState(0);
  // A change went through and the preview will reload with it (EXPECT_RELOAD), until "changed".
  const [updating, setUpdating] = useState(false);
  useEffect(() => {
    // The daemon says "changed" within seconds; a reload that never comes ends the wait anyway.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expect = () => {
      setUpdating(true);
      clearTimeout(timer);
      timer = setTimeout(() => setUpdating(false), 15_000);
    };
    window.addEventListener(EXPECT_RELOAD, expect);
    return () => {
      window.removeEventListener(EXPECT_RELOAD, expect);
      clearTimeout(timer);
    };
  }, []);
  const [busy, setBusy] = useState(false);
  // The preview: select mode, and the mode's slot it is placed over on narrow windows.
  const [selecting, setSelecting] = useState(false);
  const [place, setPlace] = useState<Place>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("smithable:place") ?? "") as Place;
    } catch {
      return { builder: {}, studio: {} };
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("smithable:place", JSON.stringify(place));
    } catch {}
  }, [place]);
  // What one mode picks, the other opens at when it can show it.
  const builderPlace = (next: Place["builder"]) =>
    setPlace((p) => ({
      builder: { ...p.builder, ...next },
      studio: next.selection ? { ...p.studio, concept: next.selection.concept } : p.studio,
    }));
  const studioPlace = (next: Place["studio"]) =>
    setPlace((p) => {
      const selection = next.concept ? shared(next.concept) : undefined;
      return {
        studio: { ...p.studio, ...next },
        builder: selection ? { ...p.builder, selection } : p.builder,
      };
    });
  // What the newest change touched (not an undo), for the preview to flash once it has it.
  const last = project?.trace[0];
  const changeKey = last && !last.isUndo && !last.undone ? `${last.at}:${last.description}` : "";
  const concepts = changeKey ? touched(last?.operation).join("\n") : "";
  const highlight = useMemo(
    () => (changeKey && concepts ? { key: changeKey, concepts: concepts.split("\n") } : undefined),
    [changeKey, concepts],
  );
  // On a narrow window the preview is the mode switch's third choice, the window's width
  // (Johan, 2026-10-09); from lg it is a column beside either mode.
  const narrow = useMedia("(max-width: 1023px)");
  // The Ask panel's slot (docs/design/ask-in-studio.md): right of the preview or under it, a
  // sheet on a phone; No code fills it.
  const { place: ask, setSlot: setAskSlot } = useAskPlace(narrow);
  // The preview's share of a wide window, in percent: the edge between the two is dragged.
  const room = useRef<HTMLElement>(null);
  const [previewWidth, setPreviewWidth] = useState(() => {
    try {
      return clampWidth(Number(localStorage.getItem(PREVIEW_WIDTH)) || 55);
    } catch {
      return 55;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(PREVIEW_WIDTH, String(previewWidth));
    } catch {}
  }, [previewWidth]);
  const viewing = narrow && Boolean(place.viewing);
  const view = (on: boolean) =>
    setPlace((p) => (Boolean(p.viewing) === on ? p : { ...p, viewing: on }));
  // A guide's stop brings its place on screen: the preview chosen (narrow) or shown (wide), any
  // other the mode again.
  const guideStop = (anchor: string) => {
    if (anchor === "preview" && !narrow) setPlace((p) => ({ ...p, previewHidden: false }));
    else view(anchor === "preview");
  };

  // The spec the preview shows now, for what a change touches (refresh).
  const shownIR = useRef<Spec["ir"]>(undefined);
  // The newest change the preview has had: a "changed" without a new one (a file edited by hand,
  // a restart) always loads it again.
  const seen = useRef<string>(undefined);
  const refresh = useCallback(async () => {
    // While the daemon restarts, what is shown stays; the next event brings it up to date.
    const next = await api.project().catch(() => undefined);
    if (!next) return;
    if (next.notice) setMessage({ ok: false, text: next.notice });
    setProject((p) => keepWaiting(p, next));
    // The preview loads again only when the change touches the page it shows (studio-v2 §2):
    // another kind of record's field leaves it, and the person's place in it, as it is.
    const change = next.trace[0];
    const key = change && `${change.at}:${change.description}`;
    const fresh = key !== undefined && seen.current !== undefined && key !== seen.current;
    seen.current = key;
    if (
      !fresh ||
      !change ||
      change.isUndo ||
      touchesPage(change.operation, keptPage(), shownIR.current)
    )
      setVersion((v) => v + 1);
    setUpdating(false);
  }, []);

  useEffect(() => {
    refresh();
    api.logs().then(logStore.set, () => {});
    return api.events((event, data) => {
      if (event === "changed") refresh();
      // A described app being made: its stage, then null once it is in place ("changed" follows).
      else if (event === "making")
        setProject((p) => p && { ...p, making: (data as MakingState | null) ?? undefined });
      else if (event === "waiting")
        setProject((p) => p && { ...p, waiting: (data as string[] | null) ?? undefined });
      // After a reconnect: the project as it is now, without reloading the preview.
      else if (event === "open") api.project().then(setProject, () => {});
      else logStore.push(String(data));
    });
  }, [refresh]);

  const spec = useSpec(project);
  shownIR.current = spec.ir;
  // The pages the preview's address offers: each page's address and title, and sign-in.
  const pages = useMemo(
    (): [string, string][] => [
      ...(spec.ir?.pages ?? [])
        .filter((p) => !p.route.includes("$"))
        .map((p): [string, string] => [
          p.route,
          spec.content?.pages[p.id]?.title ?? humanize(p.id),
        ]),
      ...(spec.auth ? [["/sign-in", "Sign in"] as [string, string]] : []),
    ],
    [spec],
  );

  // After a change went through: the spec as it is now, before the app has restarted with it
  // ("changed" later reloads the preview), so the left side never shows the old state.
  const catchUp = async () => {
    const next = await api.project().catch(() => undefined);
    if (next) setProject((p) => keepWaiting(p, next));
  };

  // Changes go one after the other: one made while another is still being applied (two Look
  // controls clicked quickly) waits for it, instead of being refused while the first one's
  // "Last change" covers the refusal.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inTurn =
    <A extends unknown[], R>(task: (...args: A) => Promise<R>) =>
    (...args: A): Promise<R> => {
      const turn = queue.current.then(() => task(...args));
      queue.current = turn.catch(() => undefined);
      return turn;
    };

  /** Applies an operation; a change that loses data first asks for confirmation. */
  const run = inTurn(
    async (
      name: string,
      args: Record<string, unknown>,
      confirm?: boolean,
      file?: { path: string; data: string },
    ) => {
      setBusy(true);
      setMessage(undefined);
      let result: Awaited<ReturnType<typeof api.operation>>;
      try {
        result = await api.operation(name, args, confirm ?? false, file);
      } catch (error) {
        setMessage({ ok: false, text: (error as Error).message });
        return false;
      } finally {
        setBusy(false);
      }
      if (result.needsConfirm) {
        setPending({
          name,
          args,
          impact: result.output.replace(/\n?Run again with --yes to apply it\.$/, ""),
        });
        return false;
      }
      setPending(undefined);
      if (result.ok) await catchUp();
      // The last line says what happened; the rest is tool output.
      const lines = result.output.split("\n").filter((l) => l.trim());
      const summary = result.ok
        ? (lines.at(-1) ?? "Done.").replace(/ Undo with: smithable undo$/, "")
        : mode === "builder"
          ? plainRefusal(result.output)
          : result.output;
      // Builder says it in the words of its summary.
      const plain =
        result.ok && mode === "builder" && spec.ir
          ? describeChange(name, args, spec.ir, spec.content)
          : undefined;
      setMessage({
        ok: result.ok,
        text:
          result.report === "sent"
            ? `${plain ?? summary}\nA report of this was sent.`
            : (plain ?? summary),
        change: result.ok,
        report: result.report,
      });
      return result.ok;
    },
  );

  const undo = inTurn(async () => {
    // What is undone: the newest change that is still in place.
    const last = project?.trace.find((e) => !e.undone && !e.isUndo)?.operation;
    const plain =
      mode === "builder" && last && spec.ir
        ? describeChange(last.op, last.args, spec.ir, spec.content)
        : undefined;
    setBusy(true);
    const result = await api.undo().catch((e: Error) => ({ ok: false, output: e.message }));
    if (result.ok) await catchUp();
    setBusy(false);
    setMessage({
      ok: result.ok,
      text: result.ok && plain ? `Undid: ${plain}` : (result.output.split("\n")[0] ?? ""),
    });
  });

  const redo = inTurn(async () => {
    setBusy(true);
    const result = await api.redo().catch((e: Error) => ({ ok: false, output: e.message }));
    setBusy(false);
    setMessage({
      ok: result.ok,
      text: result.ok
        ? `Redid: ${(result.output.split("\n")[0] ?? "").replace(/ Undo with: smithable undo$/, "")}`
        : (result.output.split("\n")[0] ?? ""),
    });
  });

  // Ctrl+Z (Cmd+Z) undoes the last change, outside text fields, here and in the preview;
  // Ctrl+Shift+Z or Ctrl+Y makes it again.
  const undoKey = useRef(() => {});
  undoKey.current = () => {
    if (!busy) void undo();
  };
  const redoKey = useRef(() => {});
  redoKey.current = () => {
    if (!busy && project?.canRedo) void redo();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      const typing =
        t instanceof HTMLElement &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        undoKey.current();
      }
      const redoing =
        (e.shiftKey && e.key.toLowerCase() === "z") || (!e.shiftKey && e.key.toLowerCase() === "y");
      if ((e.ctrlKey || e.metaKey) && redoing && !typing) {
        e.preventDefault();
        redoKey.current();
      }
    };
    const onMessage = (e: MessageEvent) => {
      if (isPreviewMessage(e) && e.data.type === "undo") undoKey.current();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  const customize = async (page: string) => {
    setBusy(true);
    const result = await api
      .customize(page)
      .catch((e: Error) => ({ ok: false, output: e.message }));
    setBusy(false);
    const lines = result.output.split("\n").filter((l) => l.trim());
    setMessage({ ok: result.ok, text: result.ok ? (lines.at(-1) ?? "") : result.output });
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    localStorage.setItem("mode", next);
  };

  // The guide, once per project in this browser (docs/design/studio-guide.md): in Builder, after
  // the making screen, never with ?guide=off; Guide in the header shows it again.
  const [guiding, setGuiding] = useState(false);
  const firstVisit =
    project && !project.making && mode === "builder" && !guideOff() && !seenGuide(project.name);
  // The first tour waits for the preview's page (its second stop points at the running app),
  // or twenty seconds when the preview is slow to start.
  const [previewUp, setPreviewUp] = useState(false);
  useEffect(() => {
    if (previewUp) return;
    const ready = (e: MessageEvent) => {
      if (isPreviewMessage(e) && e.data.type === "ready") setPreviewUp(true);
    };
    const late = setTimeout(() => setPreviewUp(true), 20_000);
    window.addEventListener("message", ready);
    return () => {
      clearTimeout(late);
      window.removeEventListener("message", ready);
    };
  }, [previewUp]);
  useEffect(() => {
    if (firstVisit && previewUp) setGuiding(true);
  }, [firstVisit, previewUp]);
  if (!project) return <p className="p-6 text-sm text-quiet">Opening the project…</p>;
  return (
    <div className="flex h-full flex-col">
      {/* On a phone the items wrap onto a second line instead of running off the screen. */}
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-panel px-4 py-1.5 sm:flex-nowrap sm:py-0">
        {project.home ? (
          // Hosted: back to the apps overview.
          <a href={project.home} className="shrink-0">
            <Wordmark />
          </a>
        ) : (
          <Wordmark />
        )}
        {/* While an app is being made, the project is a placeholder: its name says nothing. */}
        <span className="min-w-0 truncate text-sm text-quiet">
          {project.making ? "" : project.name}
        </span>
        <fieldset data-guide="mode" className="flex rounded-md bg-subtle p-0.5 sm:ml-4">
          <legend className="sr-only">Mode</legend>
          {(narrow
            ? (["builder", "preview", "studio"] as const)
            : (["builder", "studio"] as const)
          ).map((m) => {
            const checked = viewing ? m === "preview" : mode === m;
            return (
              <label
                key={m}
                className={cx(
                  "flex h-7 cursor-pointer items-center rounded px-3 text-xs font-medium has-focus-visible:ring-2 has-focus-visible:ring-accent/30",
                  checked ? "bg-panel shadow-xs" : "text-muted",
                )}
              >
                <input
                  type="radio"
                  name="mode"
                  className="sr-only"
                  checked={checked}
                  disabled={Boolean(project.making)}
                  onChange={() => {
                    view(m === "preview");
                    if (m !== "preview") switchMode(m);
                  }}
                />
                {{ builder: "No code", preview: "Preview", studio: "Code" }[m]}
              </label>
            );
          })}
        </fieldset>
        <div className="ml-auto flex items-center gap-3">
          {busy && <span className="text-xs text-quiet">Working…</span>}
          {place.previewHidden && (
            <Button
              variant="ghost"
              className="max-lg:hidden"
              onClick={() => setPlace((p) => ({ ...p, previewHidden: false }))}
            >
              Show preview
            </Button>
          )}
          {project.making ? null : project.home ? (
            <a
              href={project.home}
              data-guide="publish"
              className="text-xs font-medium text-accent hover:underline"
            >
              Publish and share
            </a>
          ) : (
            // On your own machine an app is published as an ordinary container.
            <a
              href="https://docs.smithable.ai/self-host.html"
              data-guide="publish"
              target="_blank"
              rel="noreferrer"
              title="smithable deploy runs it, with its Release checks, as a container"
              className="text-xs font-medium text-accent hover:underline"
            >
              How to publish
            </a>
          )}
          {!project.making && !guideOff() && (
            <button
              type="button"
              // The tour of the mode shown.
              onClick={() => setGuiding(true)}
              className="text-xs font-medium text-muted hover:underline"
            >
              Guide
            </button>
          )}
          <button
            type="button"
            title="The mail the preview kept instead of sending: invitations, sign-in codes"
            onClick={() => setOutbox(true)}
            className="text-xs font-medium text-muted hover:underline"
          >
            Outbox
          </button>
          <a
            href="https://docs.smithable.ai/start.html"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-muted hover:underline"
          >
            Help
          </a>
          <Button
            variant="ghost"
            onClick={undo}
            disabled={
              busy || Boolean(project.making) || !project.trace.some((t) => !t.undone && !t.isUndo)
            }
          >
            Undo
          </Button>
          <Button
            variant="ghost"
            onClick={redo}
            disabled={busy || Boolean(project.making) || !project.canRedo}
          >
            Redo
          </Button>
        </div>
      </header>
      {(message || pending) && (
        // Hovering or focusing the notice keeps it while it is read.
        // biome-ignore lint/a11y/noStaticElementInteractions: a status or alert, which pauses its fading
        <div
          role={message?.ok === false || pending ? "alert" : "status"}
          onMouseEnter={() => setHolding(true)}
          onMouseLeave={() => setHolding(false)}
          onFocus={() => setHolding(true)}
          onBlur={() => setHolding(false)}
          className={cx(
            "flex items-center gap-3 border-b px-4 py-2 text-sm",
            pending
              ? "border-amber-200 bg-amber-50"
              : message?.ok
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50",
          )}
        >
          <span className="min-w-0 flex-1 whitespace-pre-wrap">
            {pending ? pending.impact : message?.text}
          </span>
          {pending ? (
            <>
              <Button variant="danger" onClick={() => run(pending.name, pending.args, true)}>
                Apply anyway
              </Button>
              <Button variant="ghost" onClick={() => setPending(undefined)}>
                Cancel
              </Button>
            </>
          ) : message?.change ? (
            // The change is the latest one, so undo takes back exactly it.
            <Button variant="ghost" disabled={busy} onClick={() => void undo()}>
              Undo this change
            </Button>
          ) : (
            <>
              {message?.report === "offer" && (
                <Button variant="ghost" onClick={() => setReporting(true)}>
                  Report this
                </Button>
              )}
              <Button variant="ghost" onClick={() => setMessage(undefined)}>
                Dismiss
              </Button>
            </>
          )}
        </div>
      )}
      {reporting && <ReportDialog onClose={() => setReporting(false)} />}
      {outbox && <OutboxDialog onClose={() => setOutbox(false)} />}
      {guiding && !project.making && (
        // Made again for the other mode's tour, which finds that mode's places.
        <Suspense fallback={null}>
          <Guide
            key={mode}
            app={project.name}
            stops={TOURS[mode]}
            onEnd={() => {
              setGuiding(false);
              view(false);
            }}
            onCode={() => switchMode("studio")}
            onStop={guideStop}
          />
        </Suspense>
      )}
      {/* One preview for both modes (docs/design/studio-v2.md §1): the frame is made once and
          never moves in the page, so switching modes keeps its page. Wide windows show it on
          the right; narrow ones show it alone when Preview is chosen, the mode hidden (not
          unmade, so it is as it was). */}
      {project.making ? (
        // Until the described app is in place: what is being made, not the placeholder.
        <main className="min-h-0 flex-1 overflow-auto">
          <Making making={project.making} project={project} />
        </main>
      ) : (
        <main ref={room} className="relative flex min-h-0 flex-1">
          <div className={cx("min-h-0 min-w-0 flex-1", viewing && "hidden")}>
            {mode === "builder" ? (
              <Builder
                project={project}
                spec={spec}
                run={run}
                place={place.builder}
                onPlace={builderPlace}
                undo={() => void undo()}
                ask={ask}
              />
            ) : (
              <Suspense fallback={<p className="p-3 text-sm text-quiet">Opening Code mode…</p>}>
                <Studio
                  project={project}
                  spec={spec}
                  run={run}
                  onCustomize={customize}
                  place={place.studio}
                  onPlace={studioPlace}
                  previewHidden={Boolean(place.previewHidden)}
                  onLook={() => {
                    builderPlace({ tab: "look" });
                    switchMode("builder");
                  }}
                />
              </Suspense>
            )}
          </div>
          {!narrow && !place.previewHidden && (
            <PreviewEdge
              width={previewWidth}
              onWidth={setPreviewWidth}
              of={() => room.current?.getBoundingClientRect()}
            />
          )}
          <div
            data-guide-view
            className={cx(
              "flex min-h-0 flex-col bg-panel",
              narrow
                ? viewing
                  ? "min-w-0 flex-1"
                  : "hidden"
                : place.previewHidden
                  ? "hidden"
                  : "",
            )}
            style={narrow || place.previewHidden ? undefined : { width: `${previewWidth}%` }}
          >
            <Preview
              url={project.preview}
              version={version}
              updating={updating || busy}
              selecting={selecting}
              inCode={mode === "studio"}
              onSelecting={setSelecting}
              onHide={narrow ? undefined : () => setPlace((p) => ({ ...p, previewHidden: true }))}
              highlight={highlight}
              pages={pages}
            />
            {mode === "builder" && !narrow && ask.dock === "foot" && !place.previewHidden && (
              <section
                aria-label="Ask"
                ref={setAskSlot}
                className="flex h-[40%] shrink-0 flex-col border-t border-line"
              />
            )}
          </div>
          {mode === "builder" && !narrow && (ask.dock === "right" || place.previewHidden) && (
            <aside
              aria-label="Ask"
              ref={setAskSlot}
              className="flex w-[22rem] shrink-0 flex-col border-l border-line bg-panel"
            />
          )}
          {mode === "builder" && narrow && (
            <AskSheet sheet={ask.sheet} onSheet={ask.onSheet} slotRef={setAskSlot} />
          )}
        </main>
      )}
    </div>
  );
}

/** Where the preview's width is kept, and how narrow or wide it may be. */
const PREVIEW_WIDTH = "smithable:preview-width";
const clampWidth = (percent: number) => Math.min(75, Math.max(30, Math.round(percent)));

/**
 * The edge between the mode and the preview: dragged (or moved with the arrow keys) to give the
 * preview more or less of the window, so an app's page can be seen as wide as it needs.
 */
function PreviewEdge({
  width,
  onWidth,
  of,
}: {
  width: number;
  onWidth: (percent: number) => void;
  of: () => DOMRect | undefined;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a window splitter has no element of its own
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Preview width"
      aria-valuenow={width}
      aria-valuemin={30}
      aria-valuemax={75}
      tabIndex={0}
      title="Drag to make the preview wider or narrower"
      // Kept on the edge while dragging, also over the preview's frame.
      onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
      onPointerMove={(e) => {
        const box = of();
        if (!box || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
        onWidth(clampWidth(((box.right - e.clientX) / box.width) * 100));
      }}
      onKeyDown={(e) => {
        const step = e.key === "ArrowLeft" ? 2 : e.key === "ArrowRight" ? -2 : 0;
        if (!step) return;
        e.preventDefault();
        onWidth(clampWidth(width + step));
      }}
      className="w-1 shrink-0 cursor-col-resize border-l border-line outline-none hover:bg-accent/40 focus-visible:bg-accent"
    />
  );
}

/** The wordmark (docs/site/brand), 20 px tall; its light lettering on a dark page. */
function Wordmark() {
  return (
    <picture className="shrink-0">
      <source srcSet={wordmarkDark} media="(prefers-color-scheme: dark)" />
      <img src={wordmark} alt="Smithable" className="h-5 w-auto" />
    </picture>
  );
}

/** Whether this browser has seen the guide for this app. */
function seenGuide(app: string): boolean {
  try {
    return localStorage.getItem(doneKey(app)) === "1";
  } catch {
    return false;
  }
}
