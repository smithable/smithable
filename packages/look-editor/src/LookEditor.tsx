// The theme lab (docs/design/theme-lab.md §3): the theme file as controls and as text, one of a
// real app's pages in a frame at full size (the page, the mode and the width chosen; the phone
// beside it on request), the fit lines and the problems under it. A change
// computes the theme's CSS here and posts it to every frame (the preview's runtime swaps it in);
// nothing is regenerated until Save adds the theme.
import { themeCss } from "@smithable/adapter-tanstack";
import {
  BUILT_IN_THEMES,
  contrast,
  DISPLAY_FONTS,
  deriveTokens,
  emptyUx,
  FONT_WEIGHTS,
  FONTS,
  hardToRead,
  hexOf,
  LOOK_KEYS,
  lookAuthorship,
  oppositeMode,
  type PreviewPage,
  type ProjectLook,
  parseTheme,
  SHADOWS,
  STYLE_VALUES,
  type ThemeIR,
  TOKEN_NAMES,
  themeFit,
  themeThumbnail,
} from "@smithable/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Guide, guideFirst } from "./Guide";
import { assertHostContext, readHostJson } from "./host-context";
import { openProjectLook, previewProjectLook } from "./project-look";
import {
  changeModes,
  draftHistory,
  editDraft,
  newDraft,
  redoDraft,
  remember,
  undoDraft,
} from "./theme-draft";
import { getField, resetColors, setField, themeText } from "./theme-text";
import { useLookFrames } from "./useLookFrames";

/** The look's settings in the person's words (Studio's Look tab says the same). */
const LOOK_LABELS: Record<(typeof LOOK_KEYS)[number], string> = {
  preset: "Look",
  primary: "Main colour",
  background: "Background",
  font: "Font",
  density: "Density",
  motion: "Motion",
};

export type Frames = (Partial<PreviewPage> & {
  label: string;
  path?: string;
  discovery?: "loading" | "empty" | "error";
})[];

export interface Start {
  preview: string;
  projectId?: string;
  open?: string;
  notice?: string;
  frames: Frames;
  /** The starters the switch offers, and the one shown (none when the app was given). */
  starters: string[];
  starter?: string;
  /** Public mode: every starter's saved pages, so the switch needs no server. */
  sets?: Record<string, Frames>;
  themes: { name: string; text: string }[];
  project: boolean;
  canApply?: boolean;
  target: string;
  look?: ProjectLook;
  staticIdentities?: Record<string, string>;
}

/** What each motion setting moves, beside its control; "Show the motion" plays it. */
const MOTION_NOTES = {
  none: "Nothing moves: notices, rows, dialogs and pages appear at once.",
  subtle:
    "Notices, new rows and dialogs ease in, under a fifth of a second; the landing page stays still.",
  lively:
    "As subtle with a little bounce, and the landing page's sections rise into view as they scroll in; the hero's picture settles once.",
};

/** On docs.smithable.ai (`pnpm site`): the exported pages beside it, no server, Save downloads. */
export interface LookEditorHost {
  kind: "public" | "local" | "studio";
  request(path: string, init?: RequestInit): Promise<Response>;
  onDirtyChange?(dirty: boolean): void;
  onBusyChange?(busy: boolean): void;
}

/** The common widths; the frame's edge drags to any width between them. */
const SIZES = [
  ["Phone", 390],
  ["Tablet", 820],
  ["Laptop", 1280],
  ["Desktop", 1600],
] as const;
const PHONE = 390;
const GAP = 16;

export function LookEditor({ host }: { host: LookEditorHost }) {
  const PUBLIC = host.kind === "public";
  const lookRoot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (!(event.target instanceof Node) || !lookRoot.current?.contains(event.target)) return;

      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        !["z", "y"].includes(event.key.toLowerCase())
      )
        return;
      event.stopImmediatePropagation();
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
        return;
      event.preventDefault();
      setHistory((h) =>
        event.shiftKey || event.key.toLowerCase() === "y" ? redoDraft(h) : undoDraft(h),
      );
    };
    window.addEventListener("keydown", keyboard, true);
    return () => window.removeEventListener("keydown", keyboard, true);
  }, []);
  const [start, setStart] = useState<Start>();
  const [startingTheme, setStartingTheme] = useState("modern");
  const [history, setHistory] = useState(() =>
    draftHistory(themeText(BUILT_IN_THEMES[0] as ThemeIR)),
  );
  const text = history.present.text;
  const setText = (edit: string | ((text: string) => string), yaml = false) =>
    setHistory((h) =>
      remember(
        h,
        editDraft(h.present, typeof edit === "function" ? edit(h.present.text) : edit, yaml),
      ),
    );
  const [pendingModes, setPendingModes] = useState<ThemeIR["modes"]>();
  const [page, setPage] = useState<string>();
  const [targetPage, setTargetPage] = useState<string | null>(null);
  const [baseScope, setBaseScope] = useState<string | null>(null);
  const [initialText, setInitialText] = useState(text);
  const [applyBusy, setApplyBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingLook, setOpeningLook] = useState(false);
  const applying = useRef(false);
  const applyRequest = useRef<{ key: string; id: string } | undefined>(undefined);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [width, setWidth] = useState(1280);
  const [beside, setBeside] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [grey, setGrey] = useState(false);
  const [signedIn, setSignedIn] = useState(host.kind !== "local");
  const [signInError, setSignInError] = useState(false);
  const [saved, setSaved] = useState<string>();
  // The guide (A 158): by itself once in a browser when the pages are in, again from its button.
  const [guiding, setGuiding] = useState(false);
  // A starter being made (local mode): its name while the lab waits, or what went wrong.
  const [making, setMaking] = useState<string>();
  const [switchBusy, setSwitchBusy] = useState(false);
  // Each new app is signed in again; the fallback below waits for it anew.
  const [round, setRound] = useState(0);
  const [loadError, setLoadError] = useState<string>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: loadAttempt deliberately retries this read-only host request.
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setLoadError(undefined);
    void (async () => {
      try {
        const response = await host.request(PUBLIC ? "start.json" : "/api/start", {
          signal: controller.signal,
        });
        const raw = await readHostJson(response);
        let data: Start;
        if (PUBLIC) {
          const starters = raw.starters as {
            name: string;
            frames: Frames;
            identity?: { engine: string; kit: string; fonts: string };
          }[];
          data = {
            preview: new URL(".", location.href).href.replace(/\/$/, ""),
            frames: starters[0]?.frames ?? [],
            starters: starters.map((s) => s.name),
            starter: starters[0]?.name,
            sets: Object.fromEntries(starters.map((s) => [s.name, s.frames])),
            themes: [],
            project: false,
            projectId: "public-export",
            target: "",
            staticIdentities: Object.fromEntries(
              starters.map((s) => [
                s.name,
                s.identity
                  ? `${s.identity.engine} / kit ${s.identity.kit.slice(0, 12)} / fonts ${s.identity.fonts.slice(0, 12)}`
                  : "unversioned export",
              ]),
            ),
          };
        } else {
          assertHostContext(raw);
          data = raw as unknown as Start;
        }
        if (!alive) return;
        if (data.look) {
          const selected =
            data.look.page && lookAuthorship(data.look.uxText)?.pages[data.look.page]?.preset
              ? data.look.page
              : null;
          const opened = openProjectLook(data.look, selected);
          setStartingTheme(
            opened.look.theme.source === "project"
              ? `shown:${opened.look.theme.name}`
              : opened.look.theme.name,
          );
          setHistory(draftHistory(opened.text));
          setInitialText(opened.text);
          setTargetPage(selected);
          setBaseScope(selected);
        }
        setPage(data.open);
        setStart(data);
      } catch (error) {
        if (alive && !controller.signal.aborted)
          setLoadError(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [host, PUBLIC, loadAttempt]);

  // Once the pages are in and the frames signed in, so every place the guide points at is drawn.
  const ready = signedIn && !!start?.frames.length;
  useEffect(() => {
    if (ready && host.kind !== "studio" && guideFirst()) setGuiding(true);
  }, [ready, host.kind]);

  const name = /^name:\s*(\S+)/m.exec(text)?.[1] ?? "my-theme";
  const { theme, diagnostics } = useMemo(
    // Every colour applies; text that may be hard to read is said, never refused (Johan, 2026-10-24).
    () => parseTheme({ path: `themes/${name}.yml`, text }),
    [name, text],
  );
  const errors = diagnostics.filter((d) => d.severity === "error");
  const palettePolicy = theme?.modes;
  useEffect(() => {
    if (palettePolicy && palettePolicy !== "both") setMode(palettePolicy);
  }, [palettePolicy]);
  const modes = (value: ThemeIR["modes"], generate = false) => {
    const result = changeModes(history.present, value, generate);
    setPendingModes(result.missing ? value : undefined);
    if (!result.missing) setHistory((h) => remember(h, result.draft));
    setSaved(undefined);
  };
  // A background on the wrong side (dark in light mode, pale in dark) cannot read with the
  // cards that mode makes; a refusal then says so first, in those words.
  const wrongSide = (["light", "dark"] as const).find((m) => {
    const bg = writtenColor(text, m, "background");
    return bg !== undefined && (textOn(bg) === "#ffffff") === (m === "light");
  });
  // A theme the checks refuse (a primary too close to its background) has no IR, but the
  // controls must stay so the person can change it back: they show the last theme that passed,
  // with the refusal beside them; the frames keep that theme's CSS too. (Johan, 2026-10-17:
  // choosing a colour made the controls disappear.)
  const lastGood = useRef<ThemeIR | undefined>(undefined);
  if (theme) lastGood.current = theme;
  const shown = theme ?? lastGood.current;
  const selectedFrame = start?.frames.find((f) => (f.id ?? f.label) === page) ?? start?.frames[0];
  const activePage = start?.look?.ir.pages
    .filter(
      (p) =>
        selectedFrame?.path === p.route ||
        (p.route !== "/" && selectedFrame?.path?.startsWith(`${p.route}/`)),
    )
    .sort((a, b) => b.route.length - a.route.length)[0]?.id;
  const projectDraft = useMemo(() => {
    if (!theme || !start?.look) return {};
    try {
      return {
        preview: previewProjectLook(
          start.look,
          theme,
          targetPage,
          activePage,
          history.present.resets,
        ),
      };
    } catch (error) {
      return { error: String(error instanceof Error ? error.message : error) };
    }
  }, [theme, start?.look, targetPage, activePage, history.present.resets]);
  const projectPreview = projectDraft.preview;
  const structural =
    projectPreview?.impact.kind === "structural" || (!start?.look && !!theme?.defaults);
  const galleryThemes = useMemo(
    () => [
      ...BUILT_IN_THEMES.map((theme) => ({ value: theme.name, theme })),
      ...(start?.look?.themeFiles ?? start?.themes ?? []).flatMap((file) => {
        const theme = parseTheme({ path: `themes/${file.name}.yml`, text: file.text }).theme;
        return theme ? [{ value: `${start?.look ? "shown" : "own"}:${file.name}`, theme }] : [];
      }),
    ],
    [start?.look?.themeFiles, start?.themes, start?.look],
  );
  const css = useMemo(
    () =>
      theme && (!start?.look || projectPreview)
        ? projectPreview
          ? themeCss(projectPreview.ux, projectPreview.themes)
          : themeCss(
              {
                ...emptyUx(),
                theme: { preset: theme.name, density: theme.density, motion: theme.motion },
              },
              [theme],
            )
        : undefined,
    [theme, projectPreview, start?.look],
  );
  const openPageLook = async () => {
    if (!start?.look || openingLook || applyBusy) return;
    setOpeningLook(true);
    try {
      const response = await host.request("/api/start");
      if (!response.ok) throw new Error("The saved project did not answer.");
      const fresh = (await response.json()) as Start;
      if (!fresh.look) throw new Error("The saved project could not be validated.");
      const currentPage = fresh.look.ir.pages.some((p) => p.id === activePage)
        ? activePage
        : fresh.look.page;
      const selected =
        currentPage && lookAuthorship(fresh.look.uxText)?.pages[currentPage]?.preset
          ? currentPage
          : null;
      const opened = openProjectLook(fresh.look, selected);
      setStartingTheme(
        opened.look.theme.source === "project"
          ? `shown:${opened.look.theme.name}`
          : opened.look.theme.name,
      );
      setStart(fresh);
      setHistory(draftHistory(opened.text));
      setInitialText(opened.text);
      setTargetPage(selected);
      setBaseScope(selected);
      setSaved(undefined);
    } catch (error) {
      setSaved(`Saved look did not open; the draft is kept. ${String(error)}`);
    } finally {
      setOpeningLook(false);
    }
  };

  // Every frame gets the CSS when it changes, and a frame that (re)loads gets it when it is ready.
  const frames = useRef(new Set<HTMLIFrameElement>());
  // "Show the motion" reloads the landing frames, which then scroll through once.
  const [replay, setReplay] = useState(0);
  const touring = useRef(false);
  const toured = useRef(new Set<string>());
  const origin = start && new URL(start.preview).origin;
  const protocol = useLookFrames(
    host,
    start?.projectId,
    origin,
    frames,
    css,
    mode,
    (frame, path, status) => {
      if (!frame.dataset.discovery) return;
      const base = frame.dataset.base;
      const prefix = base === "/" ? "/" : `${base}/`;
      const valid =
        typeof path === "string" &&
        path.startsWith(prefix) &&
        !/[?#]/.test(path) &&
        !path.slice(prefix.length).includes("/");
      setStart(
        (current) =>
          current && {
            ...current,
            frames: current.frames.map((f) =>
              f.id === frame.dataset.discovery
                ? {
                    ...f,
                    path: valid ? path : undefined,
                    discovery: valid ? undefined : status === "empty" ? "empty" : "error",
                  }
                : f,
            ),
          },
      );
    },
    (direction) => setHistory((h) => (direction === "undo" ? undoDraft(h) : redoDraft(h))),
    (_frame, path) => {
      const pathname = new URL(path, origin).pathname;
      const exact = start?.frames.find(
        (f) => f.path && new URL(f.path, origin).pathname === pathname,
      );
      if (exact) {
        if ((exact.id ?? exact.label) !== page) setPage(exact.id ?? exact.label);
        return;
      }
      const record = start?.frames.find(
        (f) =>
          f.kind === "record" &&
          f.discoverFrom &&
          pathname.startsWith(f.discoverFrom === "/" ? "/" : f.discoverFrom + "/") &&
          !pathname
            .slice((f.discoverFrom === "/" ? "/" : f.discoverFrom + "/").length)
            .includes("/"),
      );
      if (record && pathname !== record.discoverFrom && !pathname.endsWith("/new")) {
        setStart(
          (current) =>
            current && {
              ...current,
              frames: current.frames.map((f) => (f.id === record.id ? { ...f, path } : f)),
            },
        );
        setPage(record.id ?? record.label);
      }
    },
  );
  useEffect(() => {
    if (start?.projectId || !css || !origin) return;
    for (const frame of frames.current)
      frame.contentWindow?.postMessage({ type: "smithable:theme-css", css, mode }, origin);
  }, [css, origin, mode, start?.projectId]);
  useEffect(() => {
    const heard = (event: MessageEvent) => {
      if (event.origin !== origin || event.data?.source !== "smithable-preview") return;
      const from = event.source as Window;
      const ownedFrame = [...frames.current].find((f) => f.contentWindow === from);
      if (!ownedFrame) return;
      if (start?.projectId && ownedFrame.dataset.signIn === undefined) return;
      if (event.data.type === "ready") {
        // The frame's mode: the app's dark rules follow it, not the visitor's setting.
        const frame = [...frames.current].find((f) => f.contentWindow === from);
        if (frame?.dataset.signIn !== undefined)
          from.postMessage({ type: "smithable:dev-sign-in", role: "admin" }, origin);
        if (css) from.postMessage({ type: "smithable:theme-css", css, mode }, origin);
        if (touring.current && frame?.dataset.frame?.startsWith(start?.frames[0]?.label ?? "")) {
          from.postMessage({ type: "smithable:motion-tour" }, origin);
          // Once per click: a later reload of the frame (a save, Vite's own) does not tour again.
          toured.current.add(frame.dataset.frame);
          if (toured.current.size === (beside ? 2 : 1)) touring.current = false;
        }
        // Asked for its place, the page says where it is (and from then on, each move).
        from.postMessage({ type: "smithable:select-mode", on: false }, origin);
      }
      if (
        event.data.type === "signed-in" &&
        ownedFrame.dataset.signIn !== undefined &&
        typeof event.data.path === "string" &&
        event.data.path !== "/sign-in"
      ) {
        setSignInError(false);
        setSignedIn(true);
      }
      if (event.data.type === "ready" && ownedFrame.dataset.discovery) {
        from.postMessage(
          {
            type: "smithable:discover-record",
            request: ownedFrame.dataset.discovery,
            base: ownedFrame.dataset.base,
          },
          origin,
        );
      }
      if (
        event.data.type === "record-discovered" &&
        event.data.request === ownedFrame.dataset.discovery
      ) {
        const path = event.data.path;
        const base = ownedFrame.dataset.base;
        const prefix = base === "/" ? "/" : `${base}/`;
        const valid =
          typeof path === "string" &&
          path.startsWith(prefix) &&
          !/[?#]/.test(path) &&
          !path.slice(prefix.length).includes("/");
        setStart(
          (current) =>
            current && {
              ...current,
              frames: current.frames.map((f) =>
                f.id === event.data.request
                  ? { ...f, path: valid ? path : undefined, discovery: valid ? undefined : "empty" }
                  : f,
              ),
            },
        );
      }
    };
    window.addEventListener("message", heard);
    return () => window.removeEventListener("message", heard);
  }, [css, origin, mode, beside, start?.frames, start?.projectId]);
  // The frames open once the app has signed the lab in (its development sign-in, as an admin).
  useEffect(() => {
    if (round < 0) return;
    if (PUBLIC || host.kind === "studio" || signedIn) return;
    const later = setTimeout(() => setSignInError(true), 20000);
    return () => clearTimeout(later);
  }, [round, signedIn, PUBLIC, host.kind]);
  // Another starter: public mode has its pages already; locally the lab makes its app, a few
  // seconds, on the same address, then signs in to it.
  const switchTo = async (name: string) => {
    if (!start || switchBusy || name === start.starter) return;
    if (
      !start.sets?.[name] &&
      dirty &&
      !window.confirm("Discard this unsaved look draft and switch apps?")
    )
      return;
    setPage(undefined);
    const set = start.sets?.[name];
    if (set) return setStart({ ...start, starter: name, frames: set });
    setMaking(name);
    setSwitchBusy(true);
    try {
      setSignedIn(false);
      setSignInError(false);
      const answer = await host
        .request("/api/starter", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name }),
        })
        .then(
          (r) =>
            r.json() as Promise<{
              frames?: Frames;
              error?: string;
              look?: ProjectLook;
              projectId?: string;
            }>,
        );
      if (!answer.frames) throw new Error(answer.error ?? "The app could not be opened.");
      if (answer.look) {
        const selected =
          answer.look.page && lookAuthorship(answer.look.uxText)?.pages[answer.look.page]?.preset
            ? answer.look.page
            : null;
        const opened = openProjectLook(answer.look, selected);
        setStartingTheme(
          opened.look.theme.source === "project"
            ? `shown:${opened.look.theme.name}`
            : opened.look.theme.name,
        );
        const source = opened.text;
        setHistory(draftHistory(source));
        setInitialText(source);
        setTargetPage(selected);
        setBaseScope(selected);
      }
      setStart({
        ...start,
        starter: name,
        frames: answer.frames,
        look: answer.look,
        projectId: answer.projectId,
      });
      setMaking(undefined);
      setRound((n) => n + 1);
    } catch (error) {
      setMaking(`Not switched: ${String(error)}`);
    } finally {
      setSwitchBusy(false);
    }
  };

  const set = (path: (string | number)[], value: unknown) => {
    setText((t) => setField(t, path, value));
    setSaved(undefined);
  };
  const dirty =
    text !== initialText || !!history.present.resets?.length || targetPage !== baseScope;
  useEffect(() => host.onDirtyChange?.(dirty), [dirty, host]);
  useEffect(
    () => host.onBusyChange?.(applyBusy || openingLook || saving || switchBusy),
    [applyBusy, openingLook, saving, switchBusy, host],
  );
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  const builtin = BUILT_IN_THEMES.find((t) => t.name === name);
  const owned = start?.look?.themeFiles.find((t) => t.name === name);
  const applyMode =
    builtin && text === themeText(builtin)
      ? "select"
      : owned
        ? text === owned.text
          ? "select"
          : "update"
        : "create";
  const needsCopy = !!builtin && applyMode !== "select";
  const shared =
    applyMode === "update" && start?.look
      ? start.look.ir.pages
          .filter((p) => openProjectLook(start.look as ProjectLook, p.id).look.theme.name === name)
          .map((p) => p.id)
      : [];
  const copy = () => {
    const taken = new Set([
      ...BUILT_IN_THEMES.map((t) => t.name),
      ...(start?.look?.themes ?? []).map((t) => t.name),
    ]);
    const base = name.slice(0, 48);
    let next = `${base}-copy`;
    let count = 2;
    while (taken.has(next)) next = `${base}-copy-${count++}`;
    set(["name"], next);
  };
  const apply = async () => {
    if (applying.current || !start?.look?.revision || !theme) return;
    applying.current = true;
    setApplyBusy(true);
    setSaved(undefined);
    const payload = {
      name,
      text,
      mode: applyMode,
      ...(targetPage ? { page: targetPage } : {}),
      resets: history.present.resets ?? [],
      expectedRevision: start.look.revision,
    };
    const key = JSON.stringify(payload);
    if (applyRequest.current?.key !== key) applyRequest.current = { key, id: crypto.randomUUID() };
    let committed = false;
    try {
      const answer = await host
        .request("/api/apply", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, requestId: applyRequest.current.id }),
        })
        .then(
          (r) =>
            r.json() as Promise<{
              ok?: boolean;
              output?: string;
              error?: string;
              look?: ProjectLook;
              generation?: string;
            }>,
        );
      if (!answer.ok || !answer.look) {
        setSaved(`Not applied: ${answer.output ?? answer.error}`);
        return;
      }
      committed = true;
      if (start.projectId) await protocol.waitCommitted(answer.generation ?? "");
      const opened = openProjectLook(answer.look, targetPage);
      setStartingTheme(
        opened.look.theme.source === "project"
          ? `shown:${opened.look.theme.name}`
          : opened.look.theme.name,
      );
      const source = opened.text;
      setStart((current) => current && { ...current, look: answer.look });
      setHistory(draftHistory(source));
      setInitialText(source);
      setBaseScope(targetPage);
      setSaved(`Applied: ${answer.output ?? name}`);
    } catch (error) {
      setSaved(
        committed
          ? `Saved, but its preview was not confirmed. The draft is kept; reconnect and retry Apply: ${String(error)}`
          : `Apply did not answer; the draft is kept. Retry uses the same request: ${String(error)}`,
      );
    } finally {
      applying.current = false;
      setApplyBusy(false);
    }
  };
  const download = () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "text/yaml" }));
    link.download = `${name}.yml`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const save = async () => {
    if (saving || applying.current || openingLook) return;
    if (PUBLIC) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([text], { type: "text/yaml" }));
      link.download = `${name}.yml`;
      link.click();
      URL.revokeObjectURL(link.href);
      return setSaved(`Downloaded ${name}.yml: add it to a project with addTheme.`);
    }
    setSaving(true);
    try {
      const answer = await host
        .request("/api/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, text }),
        })
        .then((r) => r.json() as Promise<{ saved?: string; error?: string }>);
      if (!answer.saved) return setSaved(`Not saved: ${answer.error}`);
      setSaved(`Saved: ${answer.saved}`);
      // Save adds a checkpoint without selecting it. Refresh the known source revision and
      // theme catalogue while retaining this draft and its currently discovered frame.
      const response = await host.request("/api/start");
      if (!response.ok) throw new Error("The saved project did not answer.");
      const fresh = (await response.json()) as Start;
      setStart((current) => current && { ...current, look: fresh.look, themes: fresh.themes });
    } catch (error) {
      setSaved(
        `Save/context refresh did not finish; the draft is kept. Open the saved look before Apply. ${String(error)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const startFrom = (value: string) => {
    setStartingTheme(value);
    const own =
      start?.look?.themeFiles.find((t) => `shown:${t.name}` === value) ??
      start?.themes.find((t) => `own:${t.name}` === value);
    const builtIn = BUILT_IN_THEMES.find((t) => t.name === value);
    const source = own?.text ?? (builtIn && themeText(builtIn));
    if (source)
      setHistory((history) =>
        history.present.text === source
          ? history
          : remember(history, { ...newDraft(source), resets: history.present.resets }),
      );
    setPendingModes(undefined);
    setSaved(undefined);
  };

  // The frame at 100 %, scaled down only as much as the stage needs (both frames alike), and as
  // tall as the stage; its right edge drags the width.
  const stage = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ width: 1200, height: 700 });
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setRoom({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const scale = Math.min(1, (room.width - GAP * 2) / (width + (beside ? PHONE + GAP : 0)));
  const height = Math.round(room.height / scale);
  const drag = (down: React.PointerEvent<HTMLDivElement>) => {
    const from = down.clientX;
    const was = width;
    const edge = down.currentTarget;
    edge.setPointerCapture(down.pointerId);
    const move = (event: PointerEvent) =>
      setWidth(Math.round(Math.min(1920, Math.max(320, was + (event.clientX - from) / scale))));
    const up = () => {
      edge.removeEventListener("pointermove", move);
      edge.removeEventListener("pointerup", up);
    };
    edge.addEventListener("pointermove", move);
    edge.addEventListener("pointerup", up);
  };
  const onStage = start?.frames.find((f) => (f.id ?? f.label) === page) ?? start?.frames[0];
  useEffect(() => {
    if (!signedIn || !onStage?.id || onStage.path || onStage.discovery) return;
    const id = onStage.id;
    const deadline = setTimeout(
      () =>
        setStart(
          (s) =>
            s && {
              ...s,
              frames: s.frames.map((f) =>
                f.id === id && !f.path ? { ...f, discovery: "error" } : f,
              ),
            },
        ),
      20000,
    );
    return () => clearTimeout(deadline);
  }, [signedIn, onStage]);
  const previewAddress = (path: string) => {
    const url = new URL(`${start?.preview}${path}`);
    if (start?.projectId) url.searchParams.set("__sm_look", "1");
    return url.href;
  };
  const frame = (phone: boolean) =>
    start &&
    onStage?.path && (
      <div
        className="frame"
        style={{ width: (phone ? PHONE : width) * scale, height: room.height }}
      >
        <iframe
          key={`${start.starter}-${round}-${onStage.path}-${onStage === start.frames[0] ? replay : 0}`}
          title={`${onStage.label}, ${mode}${phone ? ", phone" : ""}`}
          src={previewAddress(onStage.path)}
          data-frame={`${onStage.label}-${mode}${phone ? "-phone" : ""}`}
          data-mode={mode}
          data-tour={onStage === start.frames[0] && replay ? replay : undefined}
          onLoad={(event) => protocol.loaded(event.currentTarget)}
          style={{
            width: phone ? PHONE : width,
            height,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
          }}
          ref={(f) => {
            if (!f) return;
            frames.current.add(f);
            protocol.connect(f);
            return () => {
              frames.current.delete(f);
              protocol.detach(f);
            };
          }}
        />
      </div>
    );
  const STUDIO = host.kind === "studio";
  /** A page by its title (the frames have them), or the whole app. */
  const pageTitle = (id: string | null) =>
    id ? (start?.frames.find((f) => f.page === id && f.kind === "page")?.label ?? id) : null;
  return (
    <div className="sm-look-editor" style={{ height: STUDIO ? "100%" : "100vh" }} ref={lookRoot}>
      <div className="lab" style={{ height: "100%" }}>
        <header inert={!start || openingLook || applyBusy || saving || switchBusy}>
          {/* Studio's dialog carries the title; the lab says its own. */}
          {!STUDIO && <strong>Theme lab</strong>}
          {PUBLIC && (
            <span>
              Static previews — {start?.staticIdentities?.[start.starter ?? ""] ?? "loading export"}
            </span>
          )}
          {!!start?.starters.length && (
            <label>
              App{" "}
              <select
                aria-label="App"
                value={start.starter}
                disabled={!!making && !making.startsWith("Not ")}
                onChange={(e) => void switchTo(e.target.value)}
              >
                {start.starters.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          <label data-guide="start">
            Start from theme{" "}
            <select
              aria-label="Start from theme"
              onChange={(e) => startFrom(e.target.value)}
              value={startingTheme}
            >
              <optgroup label="Built in">
                {BUILT_IN_THEMES.map((t) => (
                  <option key={t.name}>{t.name}</option>
                ))}
              </optgroup>
              {!!start?.look?.themeFiles.length && (
                <optgroup label="Preview app's themes">
                  {start.look.themeFiles.map((t) => (
                    <option key={t.name} value={`shown:${t.name}`}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {!!start?.themes.length && !start?.canApply && (
                <optgroup label="Save destination's themes">
                  {start.themes.map((t) => (
                    <option key={t.name} value={`own:${t.name}`}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <button
            type="button"
            aria-expanded={gallery}
            onClick={() => {
              setGallery((value) => !value);
              setBeside(false);
            }}
          >
            Look gallery
          </button>
          <label>
            Name{" "}
            <input aria-label="Name" value={name} onChange={(e) => set(["name"], e.target.value)} />
          </label>
          <button
            type="button"
            disabled={!signedIn}
            onClick={() => {
              setPage(start?.frames[0]?.id ?? start?.frames[0]?.label);
              touring.current = true;
              toured.current.clear();
              setReplay((n) => n + 1);
            }}
          >
            Show the motion
          </button>
          <button
            type="button"
            data-guide="save"
            disabled={!theme || errors.length > 0}
            onClick={save}
          >
            {PUBLIC ? "Download" : start?.project ? "Save as new theme" : "Save theme"}
          </button>
          {!PUBLIC && (
            <button type="button" onClick={download}>
              Download draft
            </button>
          )}
          {start?.canApply && (
            <>
              <label>
                Apply theme to{" "}
                <select
                  aria-label="Apply theme to"
                  value={targetPage ?? ""}
                  onChange={(e) => {
                    const scope = e.target.value || null;
                    if (
                      !start.look ||
                      (dirty && !window.confirm("Discard this draft and change its target?"))
                    )
                      return;
                    const source = openProjectLook(start.look, scope).text;
                    setHistory(draftHistory(source));
                    setTargetPage(scope);
                    setSaved(undefined);
                    if (scope) {
                      const route = start.look.ir.pages.find((p) => p.id === scope)?.route;
                      const frame = start.frames.find((f) => f.path === route);
                      if (frame) setPage(frame.id ?? frame.label);
                    }
                  }}
                >
                  <option value="">Entire app</option>
                  {start.look?.ir.pages
                    .filter((p) => p.pattern.kind === "landing")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {start.frames.find((f) => f.page === p.id && f.kind === "page")?.label ??
                          p.id}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!dirty || !theme || errors.length > 0 || needsCopy || applyBusy}
                onClick={apply}
              >
                {applyBusy
                  ? "Applying…"
                  : applyMode === "update"
                    ? "Update theme and apply"
                    : "Apply look"}
              </button>
              {(needsCopy || !!owned) && (
                <button type="button" onClick={copy}>
                  Make a project copy
                </button>
              )}
              {needsCopy && (
                <span>
                  This built-in look stays as it is: give your version a new name, or make a copy
                  for this app, before applying.
                </span>
              )}
              {!!shared.length && (
                <span>
                  Updating {name} also changes: {shared.join(", ")}. Make a copy to keep those pages
                  unchanged.
                </span>
              )}
            </>
          )}
          <button
            type="button"
            disabled={!history.past.length}
            onClick={() => {
              setHistory(undoDraft);
              setSaved(undefined);
              setPendingModes(undefined);
            }}
          >
            Undo draft
          </button>
          <button
            type="button"
            disabled={!history.future.length}
            onClick={() => {
              setHistory(redoDraft);
              setSaved(undefined);
              setPendingModes(undefined);
            }}
          >
            Redo draft
          </button>
          {saved && <span role="status">{saved}</span>}
          <button type="button" className="guide-open" onClick={() => setGuiding(true)}>
            Guide
          </button>
        </header>
        {guiding && <Guide onEnd={() => setGuiding(false)} />}
        <aside
          data-guide="controls"
          inert={!start || openingLook || applyBusy || saving || switchBusy}
        >
          {projectPreview && (
            <fieldset aria-label="Effective look">
              <legend>What this page shows</legend>
              <p>
                Editing {name} for {pageTitle(targetPage) ?? "the whole app"}.
                {projectPreview.look.theme.name !== projectPreview.draftName
                  ? ` This page uses the look ${projectPreview.look.theme.name}, so the draft does not show on it until it is applied.`
                  : " The page shows this draft, with the settings made for the page kept."}
              </p>
              <dl>
                {LOOK_KEYS.map((key) => {
                  const origin = projectPreview.look.provenance[key];
                  const label = STUDIO ? LOOK_LABELS[key] : key;
                  return (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>
                        {origin.kind === "theme"
                          ? origin.name === projectPreview.draftName
                            ? "this draft"
                            : STUDIO
                              ? `the saved look ${origin.name}`
                              : `${origin.source} theme ${origin.name}`
                          : origin.kind === "page-ux"
                            ? STUDIO
                              ? "this page's own setting"
                              : `Page UX (${origin.page})`
                            : origin.kind === "app-ux"
                              ? STUDIO
                                ? "the app's own setting"
                                : "App UX"
                              : "the default"}
                        {key !== "preset" &&
                          (origin.kind === "app-ux" || origin.kind === "page-ux") &&
                          (STUDIO
                            ? ", which stays over the draft until it is removed"
                            : " — this override masks the draft theme value")}
                        {key !== "preset" &&
                          (origin.kind === "app-ux" || origin.kind === "page-ux") && (
                            <button
                              type="button"
                              onClick={() => {
                                const reset = {
                                  key,
                                  ...(origin.kind === "page-ux" ? { page: origin.page } : {}),
                                };
                                setHistory((h) =>
                                  remember(h, {
                                    ...h.present,
                                    resets: [...(h.present.resets ?? []), reset],
                                  }),
                                );
                                setSaved(undefined);
                              }}
                            >
                              {STUDIO
                                ? `Use the draft's ${label.toLowerCase()} here`
                                : `Reset ${key} override in draft`}
                            </button>
                          )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {Object.values(projectPreview.look.ignored).map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
              <button
                type="button"
                disabled={openingLook || applyBusy}
                onClick={() => void openPageLook()}
              >
                {openingLook
                  ? "Opening saved look…"
                  : "Discard draft and open this page’s saved look"}
              </button>
            </fieldset>
          )}
          {shown && (
            <Controls
              theme={shown}
              text={text}
              set={set}
              mode={mode}
              modes={modes}
              valid={!!theme}
              reset={() => {
                setText((t) => resetColors(t, mode));
                setSaved(undefined);
              }}
            />
          )}
        </aside>
        <main>
          {!start && !loadError && <p role="status">Opening the saved look…</p>}
          {loadError && (
            <p role="alert">
              {loadError}{" "}
              <button type="button" onClick={() => setLoadAttempt((n) => n + 1)}>
                Retry opening project
              </button>
            </p>
          )}
          {start?.notice && <p role="status">{start.notice}</p>}
          {start?.look?.auth && start.look.auth.signIn !== "none" && (
            <p>
              Viewer: current app session. Available roles:{" "}
              {start.look.auth.roles.map((role) => role.name).join(", ")}. Choose “Sign in / viewer”
              and use the app’s own sign-in controls to change viewer.
            </p>
          )}
          {start?.projectId && (
            <p role="status">
              {structural && protocol.status.startsWith("Draft preview ready")
                ? STUDIO
                  ? "A full preview of this layout is not available yet. The draft is kept."
                  : "Structural preview unavailable. Draft retained."
                : protocol.status}{" "}
              <button type="button" onClick={protocol.reload}>
                Reconnect preview
              </button>
            </p>
          )}
          {start && !signedIn && !making && (
            <iframe
              key={round}
              title="Signing in"
              hidden
              data-sign-in
              src={`${start.preview}/sign-in`}
              ref={(f) => {
                if (!f) return;
                frames.current.add(f);
                protocol.connect(f);
                return () => {
                  frames.current.delete(f);
                  protocol.detach(f);
                };
              }}
            />
          )}
          {signInError && !signedIn && (
            <p role="alert">
              Preview sign-in has not completed. Check the app's sign-in page, then{" "}
              <button
                type="button"
                onClick={() => {
                  setSignInError(false);
                  setRound((n) => n + 1);
                }}
              >
                Retry
              </button>
              .
            </p>
          )}
          {gallery && (
            <section className="look-gallery" aria-label="Look gallery">
              <p>
                {PUBLIC
                  ? "Each card is a sample of a look's colours and type. The page below is a saved picture of a starter app."
                  : "Choose a look for this app. The settings you made yourself stay; Apply saves it as one change you can undo."}
              </p>
              <ul
                onKeyDown={(event) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return;
                  const choices = [
                    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                      "button[data-look-choice]",
                    ),
                  ];
                  const index = choices.indexOf(document.activeElement as HTMLButtonElement);
                  if (index < 0) return;
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? choices.length - 1
                        : (index +
                            (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1) +
                            choices.length) %
                          choices.length;
                  choices[next]?.focus();
                }}
              >
                {galleryThemes.map(({ value, theme: candidate }, index) => (
                  <li key={value}>
                    <button
                      type="button"
                      data-look-choice=""
                      aria-label={`Choose ${candidate.name}`}
                      aria-pressed={theme?.name === candidate.name}
                      tabIndex={
                        theme?.name === candidate.name ||
                        (!galleryThemes.some((item) => item.theme.name === theme?.name) &&
                          index === 0)
                          ? 0
                          : -1
                      }
                      onClick={() => startFrom(value)}
                    >
                      <img
                        src={`data:image/svg+xml;utf8,${encodeURIComponent(themeThumbnail(candidate))}`}
                        alt=""
                        width={320}
                        height={100}
                        loading="lazy"
                      />
                      <span>{candidate.name}</span>
                      <small>A sample of its colours and type</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="bar">
            <fieldset aria-label="Page" data-guide="page">
              {start?.frames.map((f) => (
                <button
                  type="button"
                  key={f.id ?? f.label}
                  aria-pressed={f === onStage}
                  onClick={() => setPage(f.id ?? f.label)}
                >
                  {f.label}
                </button>
              ))}
            </fieldset>
            <fieldset aria-label="Mode" data-guide="mode">
              {(["light", "dark"] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  aria-pressed={mode === m}
                  disabled={shown?.modes !== "both" && shown?.modes !== m}
                  onClick={() => setMode(m)}
                >
                  {m === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </fieldset>
            <fieldset aria-label="Width" data-guide="width">
              {SIZES.map(([label, w]) => (
                <button
                  type="button"
                  key={label}
                  aria-pressed={width === w}
                  onClick={() => setWidth(w)}
                >
                  {label} {w}
                </button>
              ))}
            </fieldset>
            <span data-width>
              {width} px{scale < 1 && `, shown at ${Math.round(scale * 100)} %`}
            </span>
            <label>
              <input
                type="checkbox"
                checked={beside}
                disabled={gallery}
                onChange={(e) => setBeside(e.target.checked)}
              />{" "}
              Phone beside
            </label>
            <label>
              <input type="checkbox" checked={grey} onChange={(e) => setGrey(e.target.checked)} />{" "}
              Greyscale
            </label>
          </div>
          <div
            ref={stage}
            className={grey ? "stage grey" : "stage"}
            data-structural={structural || undefined}
          >
            {structural && (
              <div className="structural-unavailable" role="status">
                <p>
                  {STUDIO
                    ? "A full preview of this layout is not available yet."
                    : "Structural preview unavailable."}
                </p>
                <p>
                  {projectPreview?.impact.reasons.join(", ") ||
                    (STUDIO
                      ? "This look changes how the pages are built, not only their colours and type."
                      : "This theme changes generated presentation.")}
                </p>
                <p>
                  {PUBLIC
                    ? "Download the theme to use it in a project."
                    : STUDIO
                      ? "Apply makes the app anew with it. The draft is kept; choose another look, or Undo draft to see the preview again."
                      : "Apply will regenerate the app. This draft is kept; choose another look or Undo to return to a CSS preview."}
                </p>
              </div>
            )}
            {making && (
              <p role="status" className="making">
                {making.startsWith("Not ") ? making : `Making the ${making} app…`}
              </p>
            )}
            {signedIn && onStage && !onStage.path && (
              <>
                <p role="status">
                  {onStage.discovery === "empty"
                    ? "No readable record is shown on this page. Preview its list or create a record through the app."
                    : onStage.discovery === "error"
                      ? "Record discovery did not complete."
                      : "Finding a readable record…"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRound((n) => n + 1);
                    setStart(
                      (s) =>
                        s && {
                          ...s,
                          frames: s.frames.map((f) =>
                            f === onStage ? { ...f, discovery: undefined } : f,
                          ),
                        },
                    );
                  }}
                >
                  Retry discovery
                </button>
                {onStage.discoverFrom && !onStage.discovery && (
                  <iframe
                    key={`${round}:${onStage.id}`}
                    hidden
                    title="Finding a readable record"
                    data-discovery={onStage.id}
                    onLoad={(event) => protocol.loaded(event.currentTarget)}
                    data-base={onStage.discoverFrom}
                    src={previewAddress(onStage.discoverFrom)}
                    ref={(f) => {
                      if (!f) return;
                      frames.current.add(f);
                      protocol.connect(f);
                      return () => {
                        frames.current.delete(f);
                        protocol.detach(f);
                      };
                    }}
                  />
                )}
              </>
            )}
            {signedIn && frame(false)}
            {signedIn && onStage && (
              // A pointer's drag; the width buttons are the keyboard's way.
              <div className="edge" title="Drag to change the width" onPointerDown={drag} />
            )}
            {signedIn && beside && !gallery && frame(true)}
          </div>
          <section className="notes" data-guide="notes">
            {pendingModes && (
              <p role="status">
                No authored palette is available for that mode.
                <button type="button" onClick={() => modes(pendingModes, true)}>
                  Generate the missing palette
                </button>
                <button type="button" onClick={() => setPendingModes(undefined)}>
                  Cancel
                </button>
              </p>
            )}
            {projectDraft.error && (
              <p role="alert" className="avoid">
                Preview unavailable: {projectDraft.error} The draft is kept.
              </p>
            )}
            {errors.length > 0 && (
              // Only a file that cannot make a theme (a colour that is no colour): never a choice of colours.
              <p className="avoid">
                Not applied yet: the pages show the last theme that worked. What to fix:
              </p>
            )}
            {theme &&
              hardToReadIn(theme).map((line) => (
                <p key={line} className="avoid" data-warning="">
                  {line}
                </p>
              ))}
            {wrongSide && (
              <p className="avoid">
                {wrongSide === "light"
                  ? "Light mode usually has a light background; with a dark one, some text may be hard to read."
                  : "Dark mode usually has a dark background; with a light one, some text may be hard to read."}
              </p>
            )}
            {errors.map((d) => (
              <p key={`${d.line}-${d.message}`} className="avoid">
                {d.message}
              </p>
            ))}
            {shown &&
              themeFit(shown).map((fit) => (
                <p key={fit.rule} className={fit.verdict} data-fit={fit.rule}>
                  {fit.text}
                </p>
              ))}
          </section>
          {/* The theme as its file: the lab is for designers and developers and shows it; in
              Studio it is folded away, for the few who want it. */}
          {STUDIO ? (
            <details className="file">
              <summary>Show the look as a file</summary>
              <label className="file">
                themes/{name}.yml
                <textarea
                  spellCheck={false}
                  disabled={!start || openingLook || applyBusy || saving || switchBusy}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value, true);
                    setPendingModes(undefined);
                    setSaved(undefined);
                  }}
                />
              </label>
            </details>
          ) : (
            <label className="file">
              themes/{name}.yml
              <textarea
                spellCheck={false}
                disabled={!start || openingLook || applyBusy || saving || switchBusy}
                value={text}
                onChange={(e) => {
                  setText(e.target.value, true);
                  setPendingModes(undefined);
                  setSaved(undefined);
                }}
              />
            </label>
          )}
        </main>
      </div>
    </div>
  );
}

/** The theme's pairs that may not read, one plain sentence each: a warning, never a refusal. */
const hardToReadIn = (theme: ThemeIR): string[] => [
  ...new Set((["light", "dark"] as const).flatMap((mode) => hardToRead(theme[mode], mode))),
];

/** A colour as the file writes it, as hex; undefined when absent or not a colour. */
function writtenColor(text: string, mode: "light" | "dark", token: string): string | undefined {
  const raw = getField(text, [mode, token]);
  return typeof raw === "string" && /^(#[0-9a-f]{6}|oklch\()/i.test(raw) ? hexOf(raw) : undefined;
}

/** The text that reads best on a background: white on a dark one, ink on a pale one. */
const textOn = (bg: string) =>
  contrast("#ffffff", bg) >= contrast("#101522", bg) ? "#ffffff" : "#101522";

/** The fields, grouped as the file is. Each shows the theme's value and writes the file's. */
function Controls({
  theme,
  text,
  set,
  mode,
  reset,
  modes,
  valid,
}: {
  modes: (value: ThemeIR["modes"]) => void;
  valid: boolean;
  reset: () => void;
  theme: ThemeIR;
  /** The mode on screen: its own colours are the ones shown and changed (Johan, 2026-10-25). */
  mode: "light" | "dark";
  /** The file as it is: a colour the checks refused is shown as written, so it can be picked again. */
  text: string;
  set: (path: (string | number)[], value: unknown) => void;
}) {
  const choice = (label: string, path: string[], value: string, values: readonly string[]) => (
    <label key={path.join(".")}>
      {label}
      <select aria-label={label} value={value} onChange={(e) => set(path, e.target.value)}>
        {values.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );
  type Token = "primary" | "background" | "card" | "foreground";
  const written = (mode: "light" | "dark", token: Token) => writtenColor(text, mode, token);
  const shownColor = (mode: "light" | "dark", token: Token) =>
    written(mode, token) ?? hexOf(theme[mode][token]);
  // The text follows the colours it sits on, as before (A 160): a new background or surface
  // changes it to the one that reads when the chosen one no longer does. Unticked, the chosen
  // text colour stays, and the warnings above say where it is hard to read.
  const [follows, setFollows] = useState(true);
  const color = (mode: "light" | "dark", token: Token, label: string) => (
    <label key={`${mode}.${token}`}>
      {label}
      <input
        type="color"
        aria-label={label}
        value={shownColor(mode, token)}
        onChange={(e) =>
          token === "background"
            ? background(mode, e.target.value)
            : token === "card"
              ? surface(mode, e.target.value)
              : set([mode, token], e.target.value)
        }
      />
    </label>
  );
  // A new background or surface: the colours that sit on the background are derived from it
  // again (the surfaces too, unless chosen), and the text follows when it should. The text is
  // one colour on the background and on the surfaces (cards, menus, forms), so it follows to the
  // one of white and ink that reads on both best.
  const background = (mode: "light" | "dark", value: string) => {
    set([mode, "background"], value);
    // The surfaces as they will be: chosen, or derived from the new background.
    const card =
      written(mode, "card") ??
      hexOf(deriveTokens({ ...theme[mode], background: value, card: undefined }, mode).card);
    follow(mode, value, card);
  };
  const surface = (mode: "light" | "dark", value: string) => {
    set([mode, "card"], value);
    follow(mode, shownColor(mode, "background"), value);
  };
  // The other mode made from this one: the same hues, the lightness turned over (oppositeMode),
  // written as the seven colours a theme file gives.
  const otherMode = (mode: "light" | "dark") => {
    const other = mode === "light" ? "dark" : "light";
    const made = oppositeMode(theme[mode], mode);
    const given = ["background", "foreground", "card", "primary", "muted", "border", "accent"];
    // The seven given colours written; any other colour the block had goes, so the rest derives.
    for (const token of TOKEN_NAMES)
      set([other, token], given.includes(token) ? hexOf(made[token]) : undefined);
  };
  const follow = (mode: "light" | "dark", bg: string, card: string) => {
    const reads = (fg: string) => Math.min(contrast(fg, bg), contrast(fg, card));
    if (!follows || reads(shownColor(mode, "foreground")) >= 4.5) return;
    set([mode, "foreground"], reads("#ffffff") >= reads("#101522") ? "#ffffff" : "#101522");
  };
  // The weights the headings' font has (a weight outside them is refused).
  const [lightest, heaviest] = FONT_WEIGHTS[
    (theme.style.headingFont ?? theme.font) as keyof typeof FONT_WEIGHTS
  ] ?? [100, 900];
  const inRange = (w: number) => w >= lightest && w <= heaviest;
  // A new font for the headings: a weight it lacks moves to the nearest it has.
  const font = (which: "body" | "heading", name: string | undefined) => {
    set(["fonts", which], name);
    const heading = which === "heading" ? (name ?? theme.font) : (theme.style.headingFont ?? name);
    const [low, high] = FONT_WEIGHTS[heading as keyof typeof FONT_WEIGHTS] ?? [100, 900];
    const weight = theme.style.headings.weight;
    if (weight < low || weight > high)
      set(["headings", "weight"], Math.min(Math.max(weight, low), Math.min(high, 800)));
  };
  const shadow = Object.entries(SHADOWS).find(([, css]) => css === theme.shadow)?.[0] ?? "none";
  return (
    <>
      <fieldset>
        <legend>Colours ({mode === "light" ? "light mode" : "dark mode"})</legend>
        {color(mode, "primary", "Primary")}
        {color(mode, "background", "Background")}
        {color(mode, "card", "Surfaces (cards, menus, forms)")}
        {color(mode, "foreground", "Text")}
        <button type="button" onClick={reset}>
          Let the other colours follow these again
        </button>
        <p className="hint">
          A colour you set yourself stays when the main colour or the background changes; this
          button lets the others follow those two again.
        </p>
        <label>
          <input type="checkbox" checked={follows} onChange={(e) => setFollows(e.target.checked)} />{" "}
          Text colour follows the others
        </label>
        <p className="hint">
          {follows
            ? "The text changes to white or ink when a background or surface would make it hard to read."
            : "The text stays as chosen; a warning above says where it is hard to read."}{" "}
          The text is one colour on the background and the surfaces; text on the primary colour
          (buttons) is a second one, white or ink, whichever reads on it.
        </p>
        <button
          type="button"
          disabled={!valid || theme.modes !== "both"}
          onClick={() => otherMode(mode)}
        >
          Make the {mode === "light" ? "dark" : "light"} mode from this one (replaces it)
        </button>
        <p className="hint">
          {follows
            ? "The text changes to white or ink when a background or surface would make it hard to read."
            : "The text stays as chosen; a warning above says where it is hard to read."}{" "}
          The text is one colour on the background and the surfaces; text on the primary colour
          (buttons) is a second one, white or ink, whichever reads on it.
        </p>
      </fieldset>
      <fieldset>
        <legend>Fonts</legend>
        <label>
          Body
          <select
            aria-label="Body font"
            value={theme.font}
            onChange={(e) => font("body", e.target.value)}
          >
            {FONTS.filter((f) => !DISPLAY_FONTS.includes(f)).map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Headings
          <select
            aria-label="Heading font"
            value={theme.style.headingFont ?? ""}
            onChange={(e) => font("heading", e.target.value || undefined)}
          >
            <option value="">the body font</option>
            {FONTS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Labels
          <select
            aria-label="Labels font"
            value={theme.style.labelsFont ?? ""}
            onChange={(e) => set(["fonts", "labels"], e.target.value || undefined)}
          >
            <option value="">the body font</option>
            {FONTS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
      </fieldset>
      {(Object.keys(STYLE_VALUES) as (keyof typeof STYLE_VALUES)[]).map((group) => (
        <fieldset key={group}>
          <legend>{group[0]?.toUpperCase() + group.slice(1)}</legend>
          {group === "headings" && (
            <label>
              weight
              <select
                aria-label="Heading weight"
                value={theme.style.headings.weight}
                onChange={(e) => set(["headings", "weight"], Number(e.target.value))}
              >
                {[300, 400, 500, 600, 700, 800, 900].filter(inRange).map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </label>
          )}
          {Object.entries(STYLE_VALUES[group]).map(([key, values]) =>
            choice(
              key,
              [group, key],
              String((theme.style[group] as Record<string, unknown>)[key]),
              values,
            ),
          )}
        </fieldset>
      ))}
      <fieldset>
        <legend>Shape and motion</legend>
        <label>
          radius
          <input value={theme.radius} onChange={(e) => set(["radius"], e.target.value)} />
        </label>
        {choice("shadow", ["shadow"], shadow, Object.keys(SHADOWS))}
        {choice("density", ["density"], theme.density, ["comfortable", "standard", "compact"])}
        {choice("motion", ["motion"], theme.motion, ["none", "subtle", "lively"])}
        {choice("texture", ["texture"], theme.style.texture, ["none", "grain", "paper"])}
        <label>
          modes
          <select
            aria-label="modes"
            disabled={!valid}
            value={theme.modes}
            onChange={(e) => modes(e.target.value as ThemeIR["modes"])}
          >
            <option>both</option>
            <option>light</option>
            <option>dark</option>
          </select>
        </label>
        <p className="hint">
          A mode you turn off keeps its colours in this draft, so turning it on again brings them
          back; only the modes that are on are saved. Undo draft brings the earlier text and colours
          back.
        </p>
        <p className="hint" data-motion-note>
          {MOTION_NOTES[theme.motion]}
        </p>
        <label>
          chroma
          <input
            type="number"
            min={0}
            max={0.4}
            step={0.01}
            value={theme.chroma}
            onChange={(e) => set(["chroma"], Number(e.target.value))}
          />
        </label>
      </fieldset>
    </>
  );
}
