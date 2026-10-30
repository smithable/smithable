import { humanize } from "@smithable/core";
import { describeChange, present, summarize } from "@smithable/index";
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
import {
  type Assumption,
  api,
  EXPECT_RELOAD,
  type Making as MakingState,
  type PeopleState,
  type Project,
  waking,
} from "./api";
import wordmark from "./brand/wordmark.svg";
import wordmarkDark from "./brand/wordmark-dark.svg";
import { Ask, usePresentation } from "./builder/Ask";
import { NoCode, OPEN_PART } from "./builder/NoCode";
import { SmithFace } from "./builder/SmithFace";
import { Visualize } from "./builder/Visualize";
import { ASK_SMITH } from "./builder/Wizard";
import { type CodeJump, SHOW_CODE } from "./code-jump";
import { type Spec, useSpec } from "./engine";
import { doneKey, guideOff, presentedKey, TOURS } from "./guide";
import { logStore } from "./logs";
import { Making } from "./Making";
import { OutboxDialog } from "./Outbox";
import { PeoplePanel } from "./People";
import { usePan } from "./pan";
import { isPreviewMessage, type Place, touched, touchesPage } from "./preview";
import { ReportDialog } from "./Report";
import { plainRefusal } from "./refusal";
import { type Bounds, type LayerMode, SmithLayer, sideFor, useSmithPlace } from "./SmithLayer";
import { keptPage, Preview, Trace } from "./shared";
import { TroubleshootDialog } from "./Troubleshoot";
import { Button, cx, Panel, Tabs, useMedia } from "./ui";
import {
  gridOf,
  LayoutBar,
  type ManualView,
  PhoneSettingsButton,
  type PhoneWindow,
  phoneWindows,
  type SlotContent,
  shownSlots,
  useArrangement,
  usePhoneSettings,
  WINDOW_NAMES,
  type WindowId,
} from "./windows";

// The Code window (its editor, CodeMirror) and the tour load when first shown, so No code
// starts without them (the main chunk under Vite's 500 kB, backlog A 64).
const Code = lazy(() => import("./studio/Code").then((m) => ({ default: m.Code })));
const Guide = lazy(() => import("./GuideTour").then((m) => ({ default: m.Guide })));

import type { GuideLine } from "./GuideTour";

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
    /** Left for Studio by the making or the daemon (a description that could not be used). */
    notice?: boolean;
  }>();
  const [reporting, setReporting] = useState(false);
  const [troubleshooting, setTroubleshooting] = useState(false);
  const wakingNow = useSyncExternalStore(waking.subscribe, waking.get);
  const [outbox, setOutbox] = useState(false);
  // The sample users' panel, their state as the daemon last said, and a page for the preview (Follow).
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [people, setPeople] = useState<PeopleState>();
  const [go, setGo] = useState<{ path: string; key: number }>();
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
  // across it: Smith, the preview, No code and Code, Changes as its settings say
  // (smith-first.md §6). It opens on Smith (smith-first.md §2).
  const narrow = useMedia("(max-width: 1023px)");
  // The effects of the overlay and the guide (smith-first.md §12.2), off when the system asks.
  const motion = !useMedia("(prefers-reduced-motion: reduce)");
  // Smith floating over the preview, or docked as the left window (smith-first.md §12.3); a
  // phone has him in its row of windows.
  const [smithAt, setSmithAt] = useSmithPlace();
  const floating = !narrow && smithAt === "floating";
  const [panelOpen, setPanelOpen] = useState(true);
  // The preview's edges on the screen, which the floating panel hangs between.
  const previewBox = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState<Bounds>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: measured again as the preview's box changes
  useEffect(() => {
    const box = previewBox.current;
    if (!box) return;
    const measure = () => {
      const r = box.getBoundingClientRect();
      setOver(r.width > 0 ? { left: r.left, right: r.right } : undefined);
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(box);
    window.addEventListener("resize", measure);
    return () => {
      watch.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [Boolean(previewBox.current)]);
  const [phone, setPhone] = usePhoneSettings();
  const phoneList = phoneWindows(phone);
  const phoneWindow: PhoneWindow = phoneList.includes(place.window as PhoneWindow)
    ? (place.window as PhoneWindow)
    : place.window === "changes" && phone.changesUnderSmith
      ? "smith"
      : place.window === "nocode" || place.window === "code"
        ? "manual"
        : "smith";
  // Which of No code and Code the view shows; a phone without Code shows No code.
  const manual = narrow && !phone.code ? "nocode" : (arrangement.manual ?? "nocode");
  // Visualize: the app map's views over the windows, which stay as they are underneath (A 150).
  const [visualize, setVisualize] = useState(false);
  const showWindow = (window: WindowId | PhoneWindow) => {
    setVisualize(false);
    if (window === "nocode" || window === "code")
      setArrangement({ ...arrangement, manual: window });
    setPlace((p) => ({
      ...p,
      window:
        window === "changes" && phone.changesUnderSmith
          ? "smith"
          : window === "nocode" || window === "code"
            ? "manual"
            : window,
    }));
  };
  // Smith's window on a phone: Smith or, under him, Changes, chosen by the tabs or a swipe.
  const [phoneSub, setPhoneSub] = useState<"smith" | "changes">("smith");
  // The preview's arrows hide the window left or right of it for a while, for a bigger preview.
  // Floating, Smith leaves the first place and the preview takes the width: the window there
  // (Changes) comes back by the arrow or its tab (smith-first.md §12.3).
  const [hidden, setHidden] = useState({ left: floating, right: false });
  const layout = narrow ? "one" : arrangement.layout;
  // A phone has every window in one row, side by side, and shows one of them; a swipe moves the
  // row (A 173).
  // Floating, his place holds Changes alone.
  const laid = arrangement.slots.map((s) =>
    floating && (s === "smith+changes" || s === "smith") ? "changes" : s,
  );
  const slots: SlotContent[] = narrow
    ? phoneList.map((w) => (w === "smith" && phone.changesUnderSmith ? "smith+changes" : w))
    : laid;
  // One window with Smith floating shows the preview, wherever it is laid.
  const shown = (
    narrow
      ? slots.map((_, i) => i)
      : floating && layout === "one"
        ? [Math.max(0, slots.indexOf("preview"))]
        : shownSlots(layout, hidden)
  ) as (0 | 1 | 2)[];
  const phoneIndex = Math.max(0, phoneList.indexOf(phoneWindow));
  /**
   * The slot a window is drawn in among those shown (the first that names it), or none. No code
   * and Code are in the view's slot when it shows them.
   */
  const placed = (window: WindowId) =>
    shown.find(
      (s) =>
        slots[s] === window ||
        (slots[s] === "smith+changes" && (window === "smith" || window === "changes")) ||
        (slots[s] === "manual" && window === manual),
    );
  /** The slot a window is on screen in, or none: on a phone, only the window the row shows. */
  const slotOf = (window: WindowId) => {
    const at = placed(window);
    return narrow && at !== phoneIndex ? undefined : at;
  };
  // The sub-tabs a phone's window has: No code and Code, or Smith and Changes under him.
  const subStep = (content: string | undefined, direction: 1 | -1): boolean => {
    if (content === "manual") {
      const subs: ManualView[] = phone.code ? ["nocode", "code"] : ["nocode"];
      const next = subs[subs.indexOf(manual) + direction];
      if (next) setArrangement({ ...arrangement, manual: next });
      return Boolean(next);
    }
    if (content === "smith+changes") {
      const subs = ["smith", "changes"] as const;
      const next = subs[subs.indexOf(phoneSub) + direction];
      if (next) setPhoneSub(next);
      return Boolean(next);
    }
    return false;
  };
  // A swipe (A 173–174, Johan 2026-10-27): in a window's content with sub-tabs it goes to the
  // next sub-tab, then on to the next window at the last; above it (the header and the tab rows)
  // and in any other window it moves the row with the finger.
  const subContent = (start: Element) =>
    start.closest("[data-subtabs]")
      ? undefined
      : start.closest<HTMLElement>('[data-window="manual"], [data-window="smith+changes"]')?.dataset
          .window;
  const stepRow = (direction: 1 | -1) => {
    const next = phoneList[phoneIndex + direction];
    if (next) showWindow(next);
  };
  const swipeKey = useRef<(direction: 1 | -1) => void>(() => {});
  swipeKey.current = (direction) => {
    if (narrow && !project?.making) stepRow(direction);
  };
  const rowPan = usePan({
    enabled: narrow && !project?.making,
    follows: (start) => subContent(start) === undefined,
    onRelease: (direction, start) => {
      if (!subStep(subContent(start), direction)) stepRow(direction);
    },
  });
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
              : anchor === "manual"
                ? manual
                : undefined;
    if (floating && window === "smith") return setPanelOpen(true);
    if (!window || slotOf(window) !== undefined) return;
    if (narrow) showWindow(window);
    else workIn(window);
  };
  // A setting another window names (Who can's Why?): the Code window on screen, beside No code
  // and not over the preview where there is room, and the setting shown there.
  const [codeJump, setCodeJump] = useState<CodeJump>();
  const forgetJump = useCallback(() => setCodeJump(undefined), []);
  useEffect(() => {
    const onShow = (e: Event) => {
      const { file, path } = (e as CustomEvent<Omit<CodeJump, "at">>).detail;
      setCodeJump({ file, path, at: Date.now() });
      if (narrow) showWindow("code");
      else workIn("code");
    };
    window.addEventListener(SHOW_CODE, onShow);
    return () => window.removeEventListener(SHOW_CODE, onShow);
  });

  /**
   * A window on screen from the header's tabs, a guide's stop or a link (smith-first.md §6). No
   * code or Code: the view switches to it, and comes into view. A window in the third place,
   * the arrow's (the view with No code and Code by default), opens the three windows; one hidden
   * by an arrow comes back; any other takes the last place on screen that is not the preview, or
   * the only one in one window, and the window moved out takes its place, so none is lost.
   */
  const workIn = (window: WindowId) => {
    setVisualize(false);
    if (floating && window === "smith") return setPanelOpen(true);
    const sub = window === "nocode" || window === "code" ? window : undefined;
    const kept = { ...arrangement, ...(sub ? { manual: sub } : {}) };
    if (slotOf(window) !== undefined) return;
    const content: SlotContent = window === "nocode" || window === "code" ? "manual" : window;
    const from = laid.findIndex(
      (s) =>
        s === content || (s === "smith+changes" && (window === "smith" || window === "changes")),
    );
    if (from >= 0 && shown.includes(from as 0 | 1 | 2)) return setArrangement(kept);
    if (from === 0 && hidden.left) {
      setHidden((h) => ({ ...h, left: false }));
      return setArrangement(kept);
    }
    if (from === 2 && (layout === "two" || layout === "three")) {
      setHidden((h) => ({ ...h, right: false }));
      return setArrangement({ ...kept, layout: "three" });
    }
    const at =
      layout === "one"
        ? (shown[0] ?? 0)
        : ([...shown].reverse().find((i) => slots[i] !== "preview") ?? shown[0] ?? 0);
    const next = [...laid] as typeof arrangement.slots;
    if (from >= 0) [next[at], next[from]] = [next[from] as SlotContent, next[at] as SlotContent];
    else next[at] = content;
    // Floating, the place Smith left keeps his name for when he is docked again.
    const smithWas = arrangement.slots.findIndex((s) => s === "smith+changes" || s === "smith");
    if (floating && smithWas >= 0 && next[smithWas] === "changes")
      next[smithWas] = arrangement.slots[smithWas] as SlotContent;
    setArrangement({ ...kept, slots: next });
  };
  // The header's tabs: the windows of the arrangement in their order, the view with No code and
  // Code named by the one it shows, and a window off screen brought back by its tab.
  const tabs: WindowId[] = [
    ...new Set(
      laid.map((s): WindowId => (s === "smith+changes" ? "smith" : s === "manual" ? manual : s)),
    ),
  ];

  // The spec the preview shows now, for what a change touches (refresh).
  const shownIR = useRef<Spec["ir"]>(undefined);
  // The newest change the preview has had: a "changed" without a new one (a file edited by hand,
  // a restart) always loads it again.
  const seen = useRef<string>(undefined);
  const refresh = useCallback(async () => {
    // While the daemon restarts, what is shown stays; the next event brings it up to date.
    const next = await api.project().catch(() => undefined);
    if (!next) return;
    if (next.notice) setMessage({ ok: false, text: next.notice, notice: true });
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
      // The hosted beta's facts, written at a sandbox's hand-over (smith-first.md §8).
      else if (event === "beta")
        setProject((p) => p && { ...p, beta: (data as Project["beta"] | null) ?? undefined });
      // After a reconnect: the project as it is now, without reloading the preview.
      else if (event === "open") api.project().then(setProject, () => {});
      else if (event === "people") setPeople(data as PeopleState);
      else logStore.push(String(data));
    });
  }, [refresh]);

  const spec = useSpec(project);
  shownIR.current = spec.ir;
  // Smith's presentation of the app (smith-first.md §3).
  const parts = useMemo(
    () => (spec.ir ? present(spec.ir, spec.auth, spec.content) : []),
    [spec.ir, spec.auth, spec.content],
  );
  const sections = useMemo(
    () => (spec.ir ? summarize(spec.ir, spec.auth, spec.content, spec.plugins, spec.ux) : []),
    [spec],
  );
  // A change in the words Changes and Smith use ("Customers: added a website").
  const words = (op: string, args: Record<string, unknown>) =>
    spec.ir ? describeChange(op, args, spec.ir, spec.content) : undefined;
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
      // A swipe over the page in the preview, which is another document (A 174).
      if (isPreviewMessage(e) && e.data.type === "swipe") swipeKey.current(e.data.direction);
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
  const tour = manual === "code" && slotOf("code") !== undefined && !narrow ? "code" : "nocode";
  const firstVisit = project && !project.making && !guideOff() && !seenGuide(project.name);
  // The first tour waits for the preview's page (its second stop points at the running app),
  // or twenty seconds when the preview is slow to start.
  const [previewUp, setPreviewUp] = useState(false);
  // The preview's page has said it is there: the overlay's way out (smith-first.md §12.1).
  const [previewRuns, setPreviewRuns] = useState(false);
  useEffect(() => {
    if (previewRuns) return;
    const ready = (e: MessageEvent) => {
      if (isPreviewMessage(e) && e.data.type === "ready") setPreviewRuns(true);
    };
    window.addEventListener("message", ready);
    return () => window.removeEventListener("message", ready);
  }, [previewRuns]);
  useEffect(() => {
    if (previewUp) return;
    if (previewRuns) return setPreviewUp(true);
    const ready = (e: MessageEvent) => {
      if (isPreviewMessage(e) && e.data.type === "ready") setPreviewUp(true);
    };
    const late = setTimeout(() => setPreviewUp(true), 20_000);
    window.addEventListener("message", ready);
    return () => {
      clearTimeout(late);
      window.removeEventListener("message", ready);
    };
  }, [previewUp, previewRuns]);
  // The tour visits every window: one not shown as it starts would be left out of it, so the
  // third window comes into view in the same render the tour starts in.
  // A phone shows each stop's window as the tour reaches it, and the preview after it (A 161).
  const startGuide = () => {
    // The view with No code and Code comes into view for the tour's stops in it.
    if (tour === "nocode" && !narrow) workIn("nocode");
    // Floating, Smith's panel opens for his lines, and the window he left comes on screen for its
    // stop.
    setPanelOpen(true);
    if (floating) setHidden((h) => ({ ...h, left: false }));
    setGuiding(true);
  };
  // Smith says the stops in his thread when he is on the screen (smith-first.md §7); a phone, or
  // an arrangement without him, shows the cards.
  const [guideLine, setGuideLine] = useState<GuideLine>();
  // The lit place of the guide's stop, which the floating panel moves off (smith-first.md §12.3).
  const [lit, setLit] = useState<{ anchor: string; box: DOMRect }>();
  // On a phone too: the guide switches to a stop's window and says it at the window's foot.
  const smithSays = narrow || floating || slotOf("smith") !== undefined;
  // What the draft assumed (smith-first.md §4), kept from the making for Smith to ask at its
  // part, for the browser tab's session.
  // Kept with the app's name: another app opened in the same tab has its own.
  const app = project?.name;
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  useEffect(() => {
    if (!app) return;
    try {
      const kept = JSON.parse(sessionStorage.getItem("smithable:assumptions") ?? "null") as {
        app?: string;
        assumptions?: Assumption[];
      } | null;
      setAssumptions(kept?.app === app ? (kept.assumptions ?? []) : []);
    } catch {
      setAssumptions([]);
    }
  }, [app]);
  const madeAssumptions = project?.making?.assumptions;
  // biome-ignore lint/correctness/useExhaustiveDependencies: kept when a making gives them
  useEffect(() => {
    if (!madeAssumptions?.length) return;
    setAssumptions(madeAssumptions);
    try {
      sessionStorage.setItem(
        "smithable:assumptions",
        JSON.stringify({ app, assumptions: madeAssumptions }),
      );
    } catch {}
  }, [madeAssumptions]);
  // A new project: Smith presents it on the overlay, Studio loading behind; the overlay closes on
  // the person's word, then the guide (smith-first.md §12.1). A reload between the two gives the
  // guide alone; an app with nothing to present goes straight to the guide.
  const [layer, setLayer] = useState<LayerMode>();
  const overlaid = layer === "overlay" || layer === "closing";
  const show = usePresentation(parts, assumptions, layer === "overlay");
  const [presented, setPresented] = useState(false);
  const decided = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the app is read
  useEffect(() => {
    if (!firstVisit || decided.current || !spec.ir) return;
    decided.current = true;
    if (!parts.length || seenOverlay(project.name)) return setPresented(true);
    setLayer("overlay");
    show.start();
  }, [firstVisit, spec.ir]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once the preview is up and the overlay is closed
  useEffect(() => {
    if (firstVisit && previewUp && presented) startGuide();
  }, [firstVisit, previewUp, presented]);
  // The preview running behind: said with the next part.
  // biome-ignore lint/correctness/useExhaustiveDependencies: when it starts to run
  useEffect(() => {
    if (previewRuns && layer === "overlay") show.markRuns();
  }, [previewRuns]);
  // Closing: the parts not said are not said; the thread moves to Smith's place while the
  // backdrop lifts.
  const closeOverlay = () => {
    if (layer !== "overlay") return;
    try {
      if (project) localStorage.setItem(presentedKey(project.name), "1");
    } catch {}
    show.stop();
    setPanelOpen(true);
    setLayer("closing");
  };
  // A failure behind the overlay closes it to Studio, with the failure's own notice; a change
  // refused (an answer to a question) is Smith's to say on the overlay.
  // biome-ignore lint/correctness/useExhaustiveDependencies: when a failure is said
  useEffect(() => {
    if ((message?.failure || message?.notice) && layer === "overlay") closeOverlay();
  }, [message]);
  // Where the closing takes the thread: the panel's place, or the left window docked.
  const dockedAt = () => {
    const box = document.querySelector("[data-smith-dock]")?.getBoundingClientRect();
    return box && box.width > 0
      ? { top: box.top, left: box.left, width: box.width, height: box.height }
      : undefined;
  };
  // After the guide, the floating panel folds into his face when nothing happens in it a while.
  const [guided, setGuided] = useState(false);
  // Docked again: his place back in the arrangement if a move took it, and the window shown.
  const dock = () => {
    if (!arrangement.slots.some((s) => s === "smith" || s === "smith+changes")) {
      const next = [...arrangement.slots] as typeof arrangement.slots;
      next[Math.max(0, next.indexOf("changes"))] = "smith+changes";
      setArrangement({ ...arrangement, slots: next });
    }
    setHidden((h) => ({ ...h, left: false }));
    setSmithAt("docked");
  };
  const float = () => {
    setPanelOpen(true);
    setSmithAt("floating");
    setHidden((h) => ({ ...h, left: true }));
  };

  if (!project) return <p className="p-6 text-sm text-quiet">Opening the project…</p>;
  // Smith's thread, wherever it is: on the overlay, in the floating panel, or in a window.
  const layerOn = !project.making && (overlaid || floating);
  const smith = (stage: "overlay" | "panel" | "window") => (
    <div data-guide="change" className="flex h-full min-h-0 flex-col">
      <Ask
        stage={stage}
        show={show}
        previewRuns={previewRuns}
        onClose={closeOverlay}
        peopleRunning={people?.running}
        guide={guiding ? guideLine : undefined}
        assumptions={assumptions}
        {...(project.beta ? { beta: project.beta } : {})}
        words={words}
        waiting={project.waiting}
        trace={project.trace}
        ready={{
          sections,
          parts,
          appName: project.name,
          notes: (spec.diagnostics ?? []).filter((d) => d.severity === "note"),
          ...(project.home ? { home: project.home } : {}),
          apply: (op, args) => void run(op, args),
        }}
      />
    </div>
  );
  const presentAgain = () => {
    show.start();
    if (narrow) showWindow("smith");
    else workIn("smith");
  };
  return (
    <div className={cx("h-full", motion && "motion")}>
      {/* Behind the overlay Studio loads as ever, taking no click or key (smith-first.md §12.1). */}
      <div inert={overlaid || undefined} className="flex h-full flex-col">
        {/* On a phone the items wrap onto a second line instead of running off the screen. */}
        <header
          className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-panel px-4 py-1.5 sm:flex-nowrap sm:py-0"
          // On a phone a swipe on the header moves the row of windows too (A 174).
          style={narrow ? { touchAction: "pan-y" } : undefined}
          {...rowPan.handlers}
        >
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
            <fieldset className="flex rounded-md bg-subtle p-0.5">
              <legend className="sr-only">Window</legend>
              {phoneList.map((w) => (
                <label
                  key={w}
                  className={cx(
                    "flex h-7 cursor-pointer items-center rounded px-2 text-xs font-medium has-focus-visible:ring-2 has-focus-visible:ring-accent/30",
                    phoneWindow === w && !visualize ? "bg-panel shadow-xs" : "text-muted",
                  )}
                >
                  <input
                    type="radio"
                    name="window"
                    className="sr-only"
                    checked={phoneWindow === w && !visualize}
                    onChange={() => showWindow(w)}
                  />
                  {WINDOW_NAMES[w === "manual" ? manual : w]}
                </label>
              ))}
              {/* Visualize on a narrow screen too, over the window shown (A 150). */}
              <label
                className={cx(
                  "flex h-7 cursor-pointer items-center rounded px-2 text-xs font-medium has-focus-visible:ring-2 has-focus-visible:ring-accent/30",
                  visualize ? "bg-panel shadow-xs" : "text-muted",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={visualize}
                  onChange={() => setVisualize(!visualize)}
                />
                Map
              </label>
            </fieldset>
          ) : (
            <>
              <LayoutBar arrangement={arrangement} onChange={setArrangement} />
              {/* The windows of the arrangement, each brought into view by its tab; the view with
                No code and Code named by the one it shows (smith-first.md §6). */}
              <fieldset className="flex rounded-md bg-subtle p-0.5">
                <legend className="sr-only">Windows</legend>
                {tabs.map((mode) => (
                  <label
                    key={mode}
                    className={cx(
                      "flex h-7 cursor-pointer items-center rounded px-2 text-xs font-medium has-focus-visible:ring-2 has-focus-visible:ring-accent/30",
                      slotOf(mode) !== undefined ? "bg-panel shadow-xs" : "text-muted",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={slotOf(mode) !== undefined}
                      onChange={() => workIn(mode)}
                    />
                    {WINDOW_NAMES[mode]}
                  </label>
                ))}
                <label
                  className={cx(
                    "flex h-7 cursor-pointer items-center rounded px-2 text-xs font-medium has-focus-visible:ring-2 has-focus-visible:ring-accent/30",
                    visualize ? "bg-panel shadow-xs" : "text-muted",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={visualize}
                    onChange={() => setVisualize(!visualize)}
                  />
                  Map
                </label>
              </fieldset>
            </>
          )}
          {narrow && !project.making && (
            <PhoneSettingsButton settings={phone} onChange={setPhone} />
          )}
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
              <GuideMenu onTour={startGuide} onPresent={parts.length ? presentAgain : undefined} />
            )}
            <button
              type="button"
              title="People of the sample data who use the app by themselves in the preview"
              onClick={() => setPeopleOpen(true)}
              className="text-xs font-medium text-muted hover:underline"
            >
              Sample users{people?.running ? " (running)" : ""}
            </button>
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
                busy ||
                Boolean(project.making) ||
                !project.trace.some((t) => !t.undone && !t.isUndo)
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
            {!project.making && (
              // Smith's button, his face (smith-first.md §12.3): opens and closes the floating
              // panel, or brings his window on screen.
              <button
                type="button"
                aria-label="Smith"
                aria-pressed={floating ? panelOpen : undefined}
                title={floating ? (panelOpen ? "Close Smith" : "Ask Smith") : "Ask Smith"}
                onClick={() =>
                  floating
                    ? setPanelOpen(!panelOpen)
                    : narrow
                      ? showWindow("smith")
                      : workIn("smith")
                }
                className={cx(
                  "smith-chip -my-1 flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border",
                  floating && panelOpen
                    ? "border-accent bg-accent-soft"
                    : "border-line hover:border-accent",
                )}
              >
                <span className="scale-[0.8]">
                  <SmithFace mood={guiding ? "pointing" : "waiting"} />
                </span>
              </button>
            )}
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
        {peopleOpen && (
          <PeoplePanel
            state={people}
            auth={spec.auth}
            onState={setPeople}
            onFollow={(id) =>
              setGo((g) => ({
                path: `/sign-in?as=${encodeURIComponent(id)}&redirect=/`,
                key: (g?.key ?? 0) + 1,
              }))
            }
            onClose={() => setPeopleOpen(false)}
          />
        )}
        {guiding && !project.making && (
          // Made again for the other way's tour, which finds its own places.
          <Suspense fallback={null}>
            <Guide
              key={tour}
              app={project.name}
              stops={TOURS[tour]}
              onEnd={() => {
                setGuiding(false);
                setGuided(true);
                setLit(undefined);
                if (narrow) showWindow("smith");
              }}
              onStop={guideStop}
              onPlace={(anchor, box) => setLit({ anchor, box })}
              asLine={smithSays ? setGuideLine : undefined}
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
          <PhoneRow narrow={narrow} pan={rowPan.handlers}>
            <main
              className={cx(
                "relative grid min-h-0 flex-1 divide-line *:min-h-0 *:min-w-0",
                narrow && "h-full",
              )}
              style={
                narrow
                  ? {
                      gridTemplateAreas: `"${slots.map((_, i) => area(i)).join(" ")}"`,
                      gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))`,
                      gridTemplateRows: "minmax(0, 1fr)",
                      width: `${slots.length * 100}%`,
                      transform: `translateX(calc(${(-phoneIndex * 100) / slots.length}% + ${rowPan.dx}px))`,
                      transition: rowPan.dx ? "none" : "transform 250ms ease-out",
                    }
                  : gridOf(layout, shown, slots)
              }
            >
              <div
                key="preview"
                ref={previewBox}
                data-guide-view
                className={cx(
                  "relative flex flex-col border-line bg-panel",
                  placed("preview") === undefined && "hidden",
                )}
                style={{ gridArea: area(placed("preview")) }}
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
                  go={go}
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
                      // In two windows the arrow opens the third (No code and Code by default).
                      layout === "two" && slotOf("preview") === 1
                        ? {
                            hidden: true,
                            toggle: () => {
                              setHidden((h) => ({ ...h, right: false }));
                              setArrangement({ ...arrangement, layout: "three" });
                            },
                          }
                        : layout === "three" && slotOf("preview") !== 2
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
                if (
                  content === "preview" ||
                  placed(windowsIn(content, manual)[0] as WindowId) !== s
                )
                  return null;
                return (
                  <div
                    key={content}
                    data-window={content}
                    className={cx(
                      "flex flex-col border-line",
                      s > 0 && "border-l",
                      layout === "three-below" && s === 2 && "border-t border-l-0",
                    )}
                    style={{ gridArea: area(s) }}
                  >
                    {narrow && content === "smith+changes" && (
                      // A phone: Smith or Changes, by these tabs or a swipe in the window.
                      <div
                        data-subtabs
                        className="shrink-0 border-b border-line bg-panel px-3 py-1.5"
                      >
                        <Tabs
                          tabs={[
                            ["smith", WINDOW_NAMES.smith],
                            ["changes", "Changes"],
                          ]}
                          value={phoneSub}
                          onChange={setPhoneSub}
                        />
                      </div>
                    )}
                    {content === "manual" && (
                      // No code and Code: the view's two sub-tabs (smith-first.md §6).
                      <div
                        data-guide="manual"
                        data-subtabs
                        className="shrink-0 border-b border-line bg-panel px-3 py-1.5"
                      >
                        <Tabs
                          tabs={[
                            ["nocode", WINDOW_NAMES.nocode],
                            ...(narrow && !phone.code
                              ? []
                              : [["code", WINDOW_NAMES.code] as [ManualView, string]]),
                          ]}
                          value={manual}
                          onChange={(sub) => setArrangement({ ...arrangement, manual: sub })}
                        />
                      </div>
                    )}
                    {(content === "manual" ? [manual] : windowsIn(content)).map((w) => {
                      const made =
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
                              onJumped={forgetJump}
                              onLook={() => {
                                nocodePlace({ sub: "look" });
                                if (narrow) showWindow("nocode");
                                else workIn("nocode");
                              }}
                            />
                          </Suspense>
                        ) : w === "smith" ? (
                          <Panel
                            key={w}
                            title="Ask Smith"
                            className="min-h-0 flex-[3]"
                            actions={
                              !narrow && (
                                <button
                                  type="button"
                                  onClick={float}
                                  title="Smith over the preview, opened from his face in the top bar"
                                  className="text-xs font-medium text-muted hover:underline"
                                >
                                  Float
                                </button>
                              )
                            }
                          >
                            {/* While the overlay is on, the thread is there; this is where it comes. */}
                            {layerOn ? <div data-smith-dock className="h-full" /> : smith("window")}
                          </Panel>
                        ) : (
                          <Panel
                            key={w}
                            title="Changes"
                            className={cx(
                              "min-h-0",
                              content === "smith+changes" ? "flex-[2] border-t" : "flex-1",
                            )}
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
                        );
                      // On a phone Smith and Changes share a window: the one not shown stays,
                      // hidden, so Smith's presentation and the guide's line go on.
                      return narrow && content === "smith+changes" ? (
                        <div key={w} className={w === phoneSub ? "contents" : "hidden"}>
                          {made}
                        </div>
                      ) : (
                        made
                      );
                    })}
                  </div>
                );
              })}
              {visualize && (
                // Over the whole window below the header; the windows keep their state underneath.
                <div className="absolute inset-0 z-20">
                  <Visualize
                    ir={spec.ir}
                    auth={spec.auth}
                    onOpen={(concept) => {
                      workIn("nocode");
                      // After No code is on screen to hear it.
                      setTimeout(() =>
                        window.dispatchEvent(new CustomEvent(OPEN_PART, { detail: concept })),
                      );
                    }}
                  />
                </div>
              )}
            </main>
            {narrow && guiding && guideLine && phoneWindow !== "smith" && (
              // The guide's line where Smith's thread is not on screen: one line at the window's
              // foot, with its chips (A 172).
              <div
                data-guide-card={guideLine.stop.anchor}
                className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-line bg-panel px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {guideLine.stop.title}: {guideLine.stop.text}
                </span>
                <Button onClick={guideLine.next}>
                  {guideLine.at === guideLine.count - 1 ? "Done" : "Next"}
                </Button>
                {guideLine.at < guideLine.count - 1 && (
                  <Button variant="ghost" onClick={guideLine.end}>
                    Skip guide
                  </Button>
                )}
              </div>
            )}
          </PhoneRow>
        )}
      </div>
      {layerOn && (
        <SmithLayer
          mode={layer ?? "panel"}
          appName={project.name}
          lighter={previewRuns}
          phone={narrow}
          motion={motion}
          open={panelOpen}
          {...(over ? { over } : {})}
          side={
            guiding
              ? sideFor(lit?.anchor, lit?.box, window.innerWidth, window.innerHeight, over)
              : "right"
          }
          {...(layer === "closing" && !floating ? { target: narrow ? undefined : dockedAt() } : {})}
          {...(guided && !guiding && !show.going ? { foldAfter: 90_000 } : {})}
          activity={project.trace.length}
          onNext={() => (show.said >= parts.length ? previewRuns && closeOverlay() : show.next())}
          onSkip={closeOverlay}
          onClosed={() => {
            setLayer(floating ? "panel" : undefined);
            setPresented(true);
            if (narrow) showWindow("smith");
          }}
          onFold={() => setPanelOpen(false)}
          onDock={dock}
        >
          {smith(layer === "overlay" ? "overlay" : "panel")}
        </SmithLayer>
      )}
    </div>
  );
}

/** Guide in the top bar: the tour of Studio, and Smith's presentation again (smith-first.md §12.6). */
function GuideMenu({ onTour, onPresent }: { onTour: () => void; onPresent?: () => void }) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const item = (label: string, act: () => void) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        act();
      }}
      className="block w-full px-3 py-1.5 text-left text-sm whitespace-nowrap hover:bg-subtle"
    >
      {label}
    </button>
  );
  return (
    <div ref={menu} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="text-xs font-medium text-muted hover:underline"
      >
        Guide
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Guide"
          className="absolute top-full right-0 z-[60] mt-2 rounded-md border border-line bg-panel py-1 shadow-lg"
        >
          {item("Tour Studio", onTour)}
          {onPresent && item("Present the app again", onPresent)}
        </div>
      )}
    </div>
  );
}

/** The windows a slot holds (the view with No code and Code: the one it shows, chosen by the caller). */
const windowsIn = (content: SlotContent, manual: ManualView = "nocode"): WindowId[] =>
  content === "smith+changes" ? ["smith", "changes"] : content === "manual" ? [manual] : [content];

/** A slot's grid area. */
const area = (slot: number | undefined) => (slot === undefined ? undefined : "abcdef"[slot]);

/**
 * A phone's row of windows: the window shown fills the screen and the row follows a sideways
 * finger (A 173); vertical panning stays the content's. On a wide screen, the grid alone.
 */
function PhoneRow({
  narrow,
  pan,
  children,
}: {
  narrow: boolean;
  pan: React.HTMLAttributes<HTMLDivElement>;
  children: React.ReactNode;
}) {
  if (!narrow) return <>{children}</>;
  return (
    <div
      className="relative min-h-0 flex-1 overflow-hidden"
      style={{ touchAction: "pan-y" }}
      // A place brought into view (the guide's) must not scroll the row sideways: the row's
      // own transform says which window shows.
      onScroll={(e) => {
        e.currentTarget.scrollLeft = 0;
      }}
      {...pan}
    >
      {children}
    </div>
  );
}

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

/** Whether this browser has seen Smith present this app on the overlay. */
function seenOverlay(app: string): boolean {
  try {
    return localStorage.getItem(presentedKey(app)) === "1";
  } catch {
    return false;
  }
}

/** Whether this browser has seen the guide for this app. */
function seenGuide(app: string): boolean {
  try {
    return localStorage.getItem(doneKey(app)) === "1";
  } catch {
    return false;
  }
}
