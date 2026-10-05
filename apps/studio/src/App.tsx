import { describeChange } from "@smithable/index";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, EXPECT_RELOAD, type Making as MakingState, type Project } from "./api";
import { Builder } from "./builder/Builder";
import { useSpec } from "./engine";
import { Making } from "./Making";
import { isPreviewMessage, type Place, shared, touched } from "./preview";
import { ReportDialog } from "./Report";
import { plainRefusal } from "./refusal";
import { Preview } from "./shared";
import { Studio } from "./studio/Studio";
import { Button, cx } from "./ui";

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
  const [logs, setLogs] = useState<string[]>([]);
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
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const box = useSlotBox(slot);

  const refresh = useCallback(async () => {
    // While the daemon restarts, what is shown stays; the next event brings it up to date.
    const next = await api.project().catch(() => undefined);
    if (!next) return;
    if (next.notice) setMessage({ ok: false, text: next.notice });
    setProject((p) => keepWaiting(p, next));
    setVersion((v) => v + 1);
    setUpdating(false);
  }, []);

  useEffect(() => {
    refresh();
    api.logs().then(setLogs, () => {});
    return api.events((event, data) => {
      if (event === "changed") refresh();
      // A described app being made: its stage, then null once it is in place ("changed" follows).
      else if (event === "making")
        setProject((p) => p && { ...p, making: (data as MakingState | null) ?? undefined });
      else if (event === "waiting")
        setProject((p) => p && { ...p, waiting: (data as string[] | null) ?? undefined });
      // After a reconnect: the project as it is now, without reloading the preview.
      else if (event === "open") api.project().then(setProject, () => {});
      else setLogs((current) => [...current.slice(-499), String(data)]);
    });
  }, [refresh]);

  const spec = useSpec(project);

  // After a change went through: the spec as it is now, before the app has restarted with it
  // ("changed" later reloads the preview), so the left side never shows the old state.
  const catchUp = async () => {
    const next = await api.project().catch(() => undefined);
    if (next) setProject((p) => keepWaiting(p, next));
  };

  /** Applies an operation; a change that loses data first asks for confirmation. */
  const run = async (name: string, args: Record<string, unknown>, confirm = false) => {
    setBusy(true);
    setMessage(undefined);
    let result: Awaited<ReturnType<typeof api.operation>>;
    try {
      result = await api.operation(name, args, confirm);
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
  };

  const undo = async () => {
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
  };

  const redo = async () => {
    setBusy(true);
    const result = await api.redo().catch((e: Error) => ({ ok: false, output: e.message }));
    setBusy(false);
    setMessage({
      ok: result.ok,
      text: result.ok
        ? `Redid: ${(result.output.split("\n")[0] ?? "").replace(/ Undo with: smithable undo$/, "")}`
        : (result.output.split("\n")[0] ?? ""),
    });
  };

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

  if (!project) return <p className="p-6 text-sm text-neutral-500">Opening the project…</p>;
  return (
    <div className="flex h-full flex-col">
      {/* On a phone the items wrap onto a second line instead of running off the screen. */}
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-neutral-200 bg-white px-4 py-1.5 sm:flex-nowrap sm:py-0">
        {project.home ? (
          // Hosted: back to the apps overview.
          <a href={project.home} className="text-sm font-semibold tracking-tight hover:underline">
            Smithable
          </a>
        ) : (
          <span className="text-sm font-semibold tracking-tight">Smithable</span>
        )}
        {/* While an app is being made, the project is a placeholder: its name says nothing. */}
        <span className="min-w-0 truncate text-sm text-neutral-500">
          {project.making ? "" : project.name}
        </span>
        <fieldset className="flex rounded-md bg-neutral-100 p-0.5 sm:ml-4">
          <legend className="sr-only">Mode</legend>
          {(["builder", "studio"] as const).map((m) => (
            <label
              key={m}
              className={cx(
                "flex h-7 cursor-pointer items-center rounded px-3 text-xs font-medium has-focus-visible:ring-2 has-focus-visible:ring-accent/30",
                mode === m ? "bg-white shadow-xs" : "text-neutral-600",
              )}
            >
              <input
                type="radio"
                name="mode"
                className="sr-only"
                checked={mode === m}
                disabled={Boolean(project.making)}
                onChange={() => switchMode(m)}
              />
              {m === "builder" ? "No code" : "Code"}
            </label>
          ))}
        </fieldset>
        <div className="ml-auto flex items-center gap-3">
          {busy && <span className="text-xs text-neutral-500">Working…</span>}
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
            <a href={project.home} className="text-xs font-medium text-accent hover:underline">
              Publish and share
            </a>
          ) : (
            // On your own machine an app is published as an ordinary container.
            <a
              href="https://docs.smithable.ai/self-host.html"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-accent hover:underline"
            >
              Publish
            </a>
          )}
          <a
            href="https://docs.smithable.ai/start.html"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-neutral-600 hover:underline"
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
      {/* One preview for both modes (docs/design/studio-v2.md §1): the frame is made once and
          never moves in the page, so switching modes keeps its page. Wide windows show it on
          the right; narrow ones place it over the mode's preview slot. */}
      {project.making ? (
        // Until the described app is in place: what is being made, not the placeholder.
        <main className="min-h-0 flex-1 overflow-auto">
          <Making making={project.making} project={project} />
        </main>
      ) : (
        <main className="flex min-h-0 flex-1">
          <div className="min-h-0 min-w-0 flex-1">
            {mode === "builder" ? (
              <Builder
                project={project}
                spec={spec}
                run={run}
                previewSlot={setSlot}
                place={place.builder}
                onPlace={builderPlace}
              />
            ) : (
              <Studio
                project={project}
                spec={spec}
                run={run}
                version={version}
                logs={logs}
                onCustomize={customize}
                previewSlot={setSlot}
                place={place.studio}
                onPlace={studioPlace}
                previewHidden={Boolean(place.previewHidden)}
              />
            )}
          </div>
          <div
            style={box}
            className={cx(
              "flex min-h-0 flex-col border-l border-neutral-200 bg-white",
              box ? "fixed z-10" : place.previewHidden ? "hidden" : "max-lg:hidden lg:w-[55%]",
            )}
          >
            <Preview
              url={project.preview}
              version={version}
              updating={updating || busy}
              selecting={selecting}
              onSelecting={setSelecting}
              onHide={box ? undefined : () => setPlace((p) => ({ ...p, previewHidden: true }))}
              highlight={highlight}
            />
          </div>
        </main>
      )}
    </div>
  );
}

/**
 * Where a mode's preview slot is on the screen, followed frame by frame while it exists (a
 * snapping strip moves it); none means the preview has its own column.
 */
function useSlotBox(slot: HTMLElement | null) {
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number }>();
  useEffect(() => {
    if (!slot) {
      setBox(undefined);
      return;
    }
    let frame = 0;
    const measure = () => {
      const r = slot.getBoundingClientRect();
      setBox((b) =>
        b && b.top === r.top && b.left === r.left && b.width === r.width && b.height === r.height
          ? b
          : { top: r.top, left: r.left, width: r.width, height: r.height },
      );
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [slot]);
  return box;
}
