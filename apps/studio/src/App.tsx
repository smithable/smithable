import { humanize, pageModel, plural } from "@smithable/core";
import { describeChange, summarize } from "@smithable/index";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { api, EXPECT_RELOAD, type Making as MakingState, type Project, waking } from "./api";
import wordmark from "./brand/wordmark.svg";
import wordmarkDark from "./brand/wordmark-dark.svg";
import { Ask } from "./builder/Ask";
import { NoCode, OPEN_PART } from "./builder/NoCode";
import { ASK_SMITH } from "./builder/Wizard";
import { type CodeJump, SHOW_CODE } from "./code-jump";
import { type Spec, useSpec } from "./engine";
import { doneKey, guideOff, TOURS } from "./guide";
import { logStore } from "./logs";
import { Making } from "./Making";
import { OutboxDialog } from "./Outbox";
import { isPreviewMessage, type Place, touched, touchesPage } from "./preview";
import { ReportDialog } from "./Report";
import { plainRefusal } from "./refusal";
import { keptPage, Preview, Trace } from "./shared";
import { TroubleshootDialog } from "./Troubleshoot";
import { Button, cx, Panel, Tabs, useMedia } from "./ui";
import {
  gridOf,
  LayoutBar,
  PhoneSettingsButton,
  phoneWindows,
  type SlotContent,
  shownSlots,
  swipe,
  useArrangement,
  usePhoneSettings,
  WINDOW_NAMES,
  type WindowId,
} from "./windows";

// The Code window (its editor, CodeMirror) and the tour load when first shown, so No code
// starts without them (the main chunk under Vite's 500 kB, backlog A 64).
const Code = lazy(() => import("./studio/Code").then((m) => ({ default: m.Code })));
const Guide = lazy(() => import("./GuideTour").then((m) => ({ default: m.Guide })));

/** A change that stopped to ask, because it loses data. */
interface Pending {
  name: string;
  args: Record<string, unknown>;
  impact: string;
  /** An undo of these changes that loses data, asked first like any change. */
  undo?: string[];
}

/**
 * A project fetched again, with the waiting requests as the page has them: those follow the
 * "waiting" events, and a fetch answered just before a request was taken would put it back.
 * What has not changed keeps its object, and a project that has not changed at all is the one
 * shown: the spec is not read again and nothing re-renders for a fetch that brought nothing new
 * (a change is fetched when it is made and again when the app has it, A 121).
 */
function keepWaiting(shown: Project | undefined, next: Project): Project {
  if (!shown) return next;
  const merged = { ...next, waiting: shown.waiting } as Record<string, unknown>;
  const before = shown as unknown as Record<string, unknown>;
  // Over both projects' keys: one missing on a side is undefined there (the first project has no
  // waiting key yet), which compares like any value.
  let same = true;
  for (const key of new Set([...Object.keys(merged), ...Object.keys(before)])) {
    if (JSON.stringify(merged[key]) === JSON.stringify(before[key])) merged[key] = before[key];
    else same = false;
  }
  return same ? shown : (merged as unknown as Project);
}

export function App() {
  const [project, setProject] = useState<Project>();
  // Which windows are shown and where (studio-v3.md §8), kept in this browser.
  const [arrangement, setArrangement] = useArrangement();
  // A change's notice offers to undo it; errors stay until dismissed, other notices fade.
  const [message, setMessage] = useState<{
    ok: boolean;
    text: string;
    change?: boolean;
    report?: "sent" | "offer";
    /** Something went wrong (not a change refused): the bar offers Troubleshoot. */
    failure?: boolean;
  }>();
  const [reporting, setReporting] = useState(false);
  const [troubleshooting, setTroubleshooting] = useState(false);
  const wakingNow = useSyncExternalStore(waking.subscribe, waking.get);
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
  // The preview's Select, and where the person was in each window (kept for the tab's session).
  const [selecting, setSelecting] = useState(false);
  const [place, setPlace] = useState<Place>(() => {
    try {
      const kept = JSON.parse(sessionStorage.getItem("smithable:place") ?? "") as Place;
      return kept.nocode && kept.code ? kept : { nocode: {}, code: {} };
    } catch {
      return { nocode: {}, code: {} };
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("smithable:place", JSON.stringify(place));
    } catch {}
  }, [place]);
  const nocodePlace = (next: Place["nocode"]) =>
    setPlace((p) => ({ ...p, nocode: { ...p.nocode, ...next } }));
  const codePlace = (next: Place["code"]) =>
    setPlace((p) => ({ ...p, code: { ...p.code, ...next } }));
  // What the newest change touched (not an undo), for the preview to flash once it has it.
  const last = project?.trace[0];
  const changeKey = last && !last.isUndo && !last.undone ? `${last.at}:${last.description}` : "";
  const concepts = changeKey ? touched(last?.operation).join("\n") : "";
  const highlight = useMemo(
    () => (changeKey && concepts ? { key: changeKey, concepts: concepts.split("\n") } : undefined),
    [changeKey, concepts],
  );
  // A phone shows one window at a time (studio-v3.md §8), chosen in the header or by a swipe
  // across it; No code, Preview and Smith by default, Changes and Code as its settings say.
  const narrow = useMedia("(max-width: 1023px)");
  const [phone, setPhone] = usePhoneSettings();
  const phoneList = phoneWindows(phone);
  const phoneWindow = (
    phoneList.includes(place.window as WindowId)
      ? place.window
      : place.window === "changes" && phone.changesUnderSmith
        ? "smith"
        : "nocode"
  ) as WindowId;
  const showWindow = (window: WindowId) =>
    setPlace((p) => ({
      ...p,
      window: window === "changes" && phone.changesUnderSmith ? "smith" : window,
    }));
  const stepWindow = (by: number) =>
    showWindow(
      phoneList[(phoneList.indexOf(phoneWindow) + by + phoneList.length) % phoneList.length] ??
        "nocode",
    );
  // Smith's window on a phone: Smith or, under him, Changes, chosen by the tabs or a swipe.
  const [phoneSub, setPhoneSub] = useState<"smith" | "changes">("smith");
  // The preview's arrows hide the window left or right of it for a while, for a bigger preview.
  const [hidden, setHidden] = useState({ left: false, right: false });
  const layout = narrow ? "one" : arrangement.layout;
  const slots: SlotContent[] = narrow
    ? [phoneWindow === "smith" && phone.changesUnderSmith ? "smith+changes" : phoneWindow]
    : arrangement.slots;
  const shown = shownSlots(layout, narrow ? { left: false, right: false } : hidden);
  /** The slot a window is in among those shown (the first that names it), or none. */
  const slotOf = (window: WindowId) =>
    shown.find(
      (s) =>
        slots[s] === window ||
        (slots[s] === "smith+changes" && (window === "smith" || window === "changes")),
    );
  // The creation wizard's "Ask Smith for help": Smith comes into view to take the words.
  const smithRef = useRef(() => {});
  smithRef.current = () => guideStop("change");
  useEffect(() => {
    const handed = () => smithRef.current();
    window.addEventListener(ASK_SMITH, handed);
    return () => window.removeEventListener(ASK_SMITH, handed);
  }, []);
  // Requests typed while the app was made are taken by Smith: he comes into view for them.
  const waitingNow = (project?.waiting?.length ?? 0) > 0 && !project?.making;
  // biome-ignore lint/correctness/useExhaustiveDependencies: when requests start waiting
  useEffect(() => {
    if (waitingNow) guideStop("change");
  }, [waitingNow]);
  // A guide's stop brings its window on screen: the first window shows it when no slot does.
  const guideStop = (anchor: string) => {
    const window: WindowId | undefined =
      anchor === "preview"
        ? "preview"
        : anchor === "change"
          ? "smith"
          : anchor === "changes"
            ? "changes"
            : ["behavior", "look"].includes(anchor)
              ? "nocode"
              : undefined;
    if (!window || slotOf(window) !== undefined) return;
    if (narrow) showWindow(window);
    // Smith and Changes are the third place's by default: the layout with three shows them.
    else if (arrangement.slots[2] === window || arrangement.slots[2] === "smith+changes")
      setArrangement({ ...arrangement, layout: "three" });
    else
      setArrangement({ ...arrangement, slots: [window, ...arrangement.slots.slice(1)] as never });
  };
  // A setting another window names (Who can's Why?): the Code window on screen, beside No code
  // where there is room, and the setting shown there.
  const [codeJump, setCodeJump] = useState<CodeJump>();
  useEffect(() => {
    const onShow = (e: Event) => {
      const { file, path } = (e as CustomEvent<Omit<CodeJump, "at">>).detail;
      setCodeJump({ file, path, at: Date.now() });
      if (narrow) showWindow("code");
      else if (slotOf("code") === undefined) {
        const free = Math.max(
          0,
          arrangement.slots.findIndex((s) => s !== "nocode"),
        );
        setArrangement({
          ...arrangement,
          slots: arrangement.slots.map((s, i) =>
            i === free ? "code" : s,
          ) as typeof arrangement.slots,
        });
      }
    };
    window.addEventListener(SHOW_CODE, onShow);
    return () => window.removeEventListener(SHOW_CODE, onShow);
  });

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
    // A project without changes yet has "" as its newest, so its first change is a new one too
    // and reloads the preview only when it touches the page shown (A 121).
    const key = change ? `${change.at}:${change.description}` : "";
    const fresh = seen.current !== undefined && key !== seen.current;
    seen.current = key;
    // An undo is reloaded as a change without an operation, unless it only changed words.
    if (
      !fresh ||
      !change ||
      touchesPage(
        change.isUndo ? undefined : change.operation,
        keptPage(),
        shownIR.current,
        change.rewritten,
      )
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
  // The app in words, for Smith's "What does this app do?".
  const sections = useMemo(
    () => (spec.ir ? summarize(spec.ir, spec.auth, spec.content, spec.plugins, spec.ux) : []),
    [spec],
  );
  // A change in the words Changes and Smith use ("Customers: added a website").
  const words = (op: string, args: Record<string, unknown>) =>
    spec.ir ? describeChange(op, args, spec.ir, spec.content) : undefined;
  // Smith's example in the app's own records (a booking app has no customers): the first listed
  // on a page, and the last.
  const example = useMemo(() => {
    const ir = spec.ir;
    if (!ir) return undefined;
    const listed = ir.pages.flatMap((p) => (p.pattern.kind === "crud" ? [pageModel(p)] : []));
    const models = ir.models.filter((m) => listed.includes(m.name));
    const [first, last] = [models[0] ?? ir.models[0], models.at(-1) ?? ir.models.at(-1)];
    if (!first || !last) return undefined;
    const many = (name: string) => humanize(plural(name)).toLowerCase();
    const field = first.fields.some((f) => f.name === "phone") ? "a website" : "a phone number";
    return `For example: ${many(first.name)} should have ${field}. Or: who can delete ${many(last.name)}?`;
  }, [spec]);
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
        setMessage({ ok: false, text: (error as Error).message, failure: true });
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
        : plainRefusal(result.output);
      // Said in the words the Changes window uses.
      const plain =
        result.ok && spec.ir ? describeChange(name, args, spec.ir, spec.content) : undefined;
      setMessage({
        ok: result.ok,
        text:
          result.report === "sent"
            ? `${plain ?? summary}\nA report of this was sent.`
            : (plain ?? summary),
        change: result.ok,
        report: result.report,
        failure: Boolean(result.report),
      });
      return result.ok;
    },
  );

  const undo = inTurn(async () => {
    // What is undone: the newest change that is still in place.
    const last = project?.trace.find((e) => !e.undone && !e.isUndo)?.operation;
    const plain =
      last && spec.ir ? describeChange(last.op, last.args, spec.ir, spec.content) : undefined;
    setBusy(true);
    const result = await api.undo().catch((e: Error) => ({ ok: false, output: e.message }));
    if (result.ok) await catchUp();
    setBusy(false);
    setMessage({
      ok: result.ok,
      text: result.ok && plain ? `Undid: ${plain}` : (result.output.split("\n")[0] ?? ""),
    });
  });

  // The Changes window's X: these changes undone, the newest first (studio-v3.md §3). An earlier
  // change is reversed as a new change, or refused in the validator's words when a later one
  // depends on it; one that loses data asks first.
  const undoChanges = inTurn(async (ids: string[], confirm?: boolean) => {
    setBusy(true);
    setMessage(undefined);
    let said = "";
    let ok = true;
    for (const [at, id] of ids.entries()) {
      const entry = project?.trace.find((t) => t.id === id);
      // The confirmation is for the change that asked (the first left), not the ones after it.
      const result = await api
        .undoChange(id, confirm === true && at === 0)
        .catch((e: Error) => ({ ok: false, output: e.message, needsConfirm: false }));
      if (result.needsConfirm) {
        setPending({
          name: "undo",
          args: {},
          impact: result.output.replace(/\n?Run again with --yes.*$/s, ""),
          undo: ids.slice(ids.indexOf(id)),
        });
        ok = false;
        break;
      }
      if (!result.ok) {
        said = plainRefusal(result.output);
        ok = false;
        setPending(undefined);
        break;
      }
      // In the Changes window's words: the operation's where it has them, else its own.
      const plain =
        (entry?.operation && spec.ir
          ? describeChange(entry.operation.op, entry.operation.args, spec.ir, spec.content)
          : undefined) ?? entry?.description;
      said = `Undid: ${plain ?? "the change"}`;
    }
    if (ok) setPending(undefined);
    await catchUp();
    setBusy(false);
    if (said) setMessage({ ok, text: said });
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

  // The guide, once per project in this browser (docs/design/studio-guide.md): after the making
  // screen, never with ?guide=off; Guide in the header shows it again. Code's tour when Code is
  // the first window.
  const [guiding, setGuiding] = useState(false);
  const tour = arrangement.slots[0] === "code" && !narrow ? "code" : "nocode";
  const firstVisit = project && !project.making && !guideOff() && !seenGuide(project.name);
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
  // The tour visits every window: one not shown as it starts would be left out of it, so the
  // third window comes into view in the same render the tour starts in.
  const startGuide = () => {
    if (tour === "nocode") guideStop("change");
    setGuiding(true);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: once the preview is up
  useEffect(() => {
    if (firstVisit && previewUp) startGuide();
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
        {project.making ? null : narrow ? (
          // A phone: one window at a time.
          <fieldset
            data-guide="layout"
            className="flex rounded-md bg-subtle p-0.5"
            {...swipe(
              () => stepWindow(1),
              () => stepWindow(-1),
            )}
          >
            <legend className="sr-only">Window</legend>
            {phoneList.map((w) => (
              <label
                key={w}
                className={cx(
                  "flex h-7 cursor-pointer items-center rounded px-2 text-xs font-medium has-focus-visible:ring-2 has-focus-visible:ring-accent/30",
                  phoneWindow === w ? "bg-panel shadow-xs" : "text-muted",
                )}
              >
                <input
                  type="radio"
                  name="window"
                  className="sr-only"
                  checked={phoneWindow === w}
                  onChange={() => showWindow(w)}
                />
                {WINDOW_NAMES[w]}
              </label>
            ))}
          </fieldset>
        ) : (
          <LayoutBar arrangement={arrangement} onChange={setArrangement} />
        )}
        {narrow && !project.making && <PhoneSettingsButton settings={phone} onChange={setPhone} />}
        <div className="ml-auto flex items-center gap-3">
          {busy && <span className="text-xs text-quiet">Working…</span>}
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
              // The tour of the first window.
              onClick={startGuide}
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
      {wakingNow && (
        // A hosted workspace waking (B 58): a bar that goes by itself once it answers.
        <div role="status" className="border-b border-line bg-accent-soft px-4 py-1.5 text-xs">
          <div className="mb-1 h-1 overflow-hidden rounded bg-panel">
            <div className="h-full w-1/3 animate-pulse rounded bg-accent" />
          </div>
          {wakingNow === "busy"
            ? "Every workspace is busy; yours starts as soon as one is free."
            : wakingNow === "preparing"
              ? "Your workspace is starting; its packages are installed first, which takes about half a minute."
              : "Your workspace is starting…"}
        </div>
      )}
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
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  pending.undo
                    ? undoChanges(pending.undo, true)
                    : run(pending.name, pending.args, true)
                }
              >
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
              {message?.failure && (
                <Button variant="ghost" onClick={() => setTroubleshooting(true)}>
                  Troubleshoot
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
      {troubleshooting && message && (
        <TroubleshootDialog
          error={message.text}
          canUndo={project.trace.some((t) => !t.undone && !t.isUndo)}
          onReport={() => setReporting(true)}
          onUndo={() => void undo()}
          onClose={() => setTroubleshooting(false)}
        />
      )}
      {outbox && <OutboxDialog onClose={() => setOutbox(false)} />}
      {guiding && !project.making && (
        // Made again for the other way's tour, which finds its own places.
        <Suspense fallback={null}>
          <Guide
            key={tour}
            app={project.name}
            stops={TOURS[tour]}
            onEnd={() => setGuiding(false)}
            onCode={() =>
              setArrangement({
                ...arrangement,
                slots: ["code", ...arrangement.slots.slice(1)] as typeof arrangement.slots,
              })
            }
            onStop={guideStop}
          />
        </Suspense>
      )}
      {project.making ? (
        // Until the described app is in place: what is being made, not the placeholder.
        <main className="min-h-0 flex-1 overflow-auto">
          <Making making={project.making} project={project} />
        </main>
      ) : (
        // The windows in one grid (studio-v3.md §1, §8). The preview is always its first child
        // and only placed, so its frame is made once and keeps its page whatever moves; a window
        // in no slot shown is not drawn, except the preview, hidden.
        <main
          className="grid min-h-0 flex-1 divide-line *:min-h-0 *:min-w-0"
          style={gridOf(layout, shown)}
        >
          <div
            key="preview"
            data-guide-view
            className={cx(
              "relative flex flex-col border-line bg-panel",
              slotOf("preview") === undefined && "hidden",
            )}
            style={{ gridArea: area(slotOf("preview")) }}
          >
            <Preview
              url={project.preview}
              version={version}
              updating={updating || busy}
              selecting={selecting}
              inCode={slotOf("code") !== undefined && slotOf("nocode") === undefined}
              onSelecting={setSelecting}
              highlight={highlight}
              pages={pages}
            />
            {!narrow && (
              <PreviewArrows
                left={
                  layout !== "one" && slotOf("preview") !== 0
                    ? {
                        hidden: hidden.left,
                        toggle: () => setHidden((h) => ({ ...h, left: !h.left })),
                      }
                    : undefined
                }
                right={
                  layout === "three" && slotOf("preview") !== 2
                    ? {
                        hidden: hidden.right,
                        toggle: () => setHidden((h) => ({ ...h, right: !h.right })),
                      }
                    : undefined
                }
              />
            )}
          </div>
          {shown.map((s) => {
            const content = slots[s] as SlotContent;
            if (content === "preview" || slotOf(windowsIn(content)[0] as WindowId) !== s)
              return null;
            return (
              <div
                key={content}
                className={cx(
                  "flex flex-col border-line",
                  s > 0 && "border-l",
                  layout === "three-below" && s === 2 && "border-t border-l-0",
                )}
                style={{ gridArea: area(s) }}
              >
                {narrow && content === "smith+changes" && (
                  // A phone: Smith or Changes, by these tabs or a swipe across them.
                  <div
                    className="shrink-0 border-b border-line bg-panel px-3 py-1.5"
                    {...swipe(
                      () => setPhoneSub("changes"),
                      () => setPhoneSub("smith"),
                    )}
                  >
                    <Tabs
                      tabs={[
                        ["smith", "Smith"],
                        ["changes", "Changes"],
                      ]}
                      value={phoneSub}
                      onChange={setPhoneSub}
                    />
                  </div>
                )}
                {(narrow && content === "smith+changes" ? [phoneSub] : windowsIn(content)).map(
                  (w) =>
                    w === "nocode" ? (
                      <NoCode
                        key={w}
                        project={project}
                        spec={spec}
                        run={run}
                        place={place.nocode}
                        onPlace={nocodePlace}
                      />
                    ) : w === "code" ? (
                      <Suspense
                        key={w}
                        fallback={<p className="p-3 text-sm text-quiet">Opening Code…</p>}
                      >
                        <Code
                          project={project}
                          spec={spec}
                          run={run}
                          place={place.code}
                          onPlace={codePlace}
                          jumpTo={codeJump}
                          onLook={() => {
                            nocodePlace({ sub: "look" });
                            if (narrow) showWindow("nocode");
                            else if (slotOf("nocode") === undefined)
                              setArrangement({
                                ...arrangement,
                                slots: [
                                  "nocode",
                                  ...arrangement.slots.slice(1),
                                ] as typeof arrangement.slots,
                              });
                          }}
                        />
                      </Suspense>
                    ) : w === "smith" ? (
                      <Panel key={w} title="Smith" className="min-h-0 flex-1">
                        <div data-guide="change" className="min-h-0 flex-1 overflow-auto">
                          <Ask
                            example={example}
                            words={words}
                            waiting={project.waiting}
                            trace={project.trace}
                            ready={{
                              sections,
                              notes: (spec.diagnostics ?? []).filter((d) => d.severity === "note"),
                              ...(project.home ? { home: project.home } : {}),
                              apply: (op, args) => void run(op, args),
                              onJump: (concept) => {
                                guideStop("behavior");
                                // After No code is on screen to hear it.
                                setTimeout(() =>
                                  window.dispatchEvent(
                                    new CustomEvent(OPEN_PART, { detail: concept }),
                                  ),
                                );
                              },
                            }}
                          />
                        </div>
                      </Panel>
                    ) : (
                      <Panel
                        key={w}
                        title="Changes"
                        className={cx("min-h-0 flex-1", content === "smith+changes" && "border-t")}
                      >
                        <div data-guide="changes" className="min-h-0 flex-1 overflow-auto">
                          <Trace
                            entries={project.trace}
                            words={words}
                            plugins={spec.plugins}
                            onUndo={(ids) => void undoChanges(ids)}
                          />
                        </div>
                      </Panel>
                    ),
                )}
              </div>
            );
          })}
        </main>
      )}
    </div>
  );
}

/** The windows a slot holds. */
const windowsIn = (content: SlotContent): WindowId[] =>
  content === "smith+changes" ? ["smith", "changes"] : [content];

/** A slot's grid area. */
const area = (slot: number | undefined) => (slot === undefined ? undefined : "abc"[slot]);

/** The arrows at the preview's edges: hide the window beside it for a while, and bring it back. */
function PreviewArrows({
  left,
  right,
}: {
  left?: { hidden: boolean; toggle: () => void };
  right?: { hidden: boolean; toggle: () => void };
}) {
  const arrow = (side: "left" | "right", state: { hidden: boolean; toggle: () => void }) => {
    const points = (side === "left") !== state.hidden ? "‹" : "›";
    const name = `${state.hidden ? "Show" : "Hide"} the window on the ${side}`;
    return (
      <button
        type="button"
        aria-label={name}
        title={name}
        onClick={state.toggle}
        className={cx(
          "absolute top-1/2 z-10 flex h-10 w-4 -translate-y-1/2 items-center justify-center border border-line bg-panel text-xs text-muted shadow-xs hover:text-fg",
          side === "left" ? "left-0 rounded-r" : "right-0 rounded-l",
        )}
      >
        {points}
      </button>
    );
  };
  return (
    <>
      {left && arrow("left", left)}
      {right && arrow("right", right)}
    </>
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
