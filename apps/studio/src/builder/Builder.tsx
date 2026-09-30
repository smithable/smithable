// Builder mode: the app in plain language, forms for changes, and the preview.
import { describeChange, summarize } from "@smithable/index";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "../api";
import type { Spec } from "../engine";
import { isPreviewMessage, type Place, type Selection } from "../preview";
import { Trace } from "../shared";
import { cx, Panel, Tabs, useMedia } from "../ui";
import { AppSummary } from "./AppSummary";
import { Ask } from "./Ask";
import { ChangeForms, type Prefill, type Run } from "./ChangeForms";
import { Selected } from "./Selected";

export function Builder({
  project,
  spec,
  run,
  previewSlot,
  place,
  onPlace,
}: {
  project: Project;
  spec: Spec;
  run: Run;
  /** Where the app's preview frame goes on a narrow window (App.tsx places it over this). */
  previewSlot: (element: HTMLElement | null) => void;
  /** Where the person was in this mode, and a way to say where they are now (App.tsx). */
  place: Place["builder"];
  onPlace: (place: Place["builder"]) => void;
}) {
  const [tab, setTabState] = useState<"app" | "change">(place.tab ?? "app");
  const setTab = (next: "app" | "change") => {
    setTabState(next);
    onPlace({ tab: next });
  };
  const [prefill, setPrefill] = useState<Prefill>();
  const [selection, setSelectionState] = useState<Selection | undefined>(place.selection);
  const setSelection = (next: Selection | undefined) => {
    setSelectionState(next);
    onPlace({ selection: next });
  };
  const selectRef = useRef<(s: Selection) => void>(setSelection);
  // The preview reports what was clicked in select mode, and columns dragged to a new place.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isPreviewMessage(e)) return;
      if (e.data.type === "select") selectRef.current(e.data);
      if (e.data.type === "columns")
        run("setColumns", { page: e.data.page, columns: e.data.columns });
      if (e.data.type === "text")
        run("setText", { path: e.data.path.split("."), text: e.data.text });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [run]);
  const words = (op: string, args: Record<string, unknown>) =>
    spec.ir ? describeChange(op, args, spec.ir, spec.content) : undefined;
  const sections = useMemo(
    () => (spec.ir ? summarize(spec.ir, spec.auth, spec.content, spec.plugins) : []),
    [spec],
  );
  // The panels are a strip that snaps, one wide each; the change box stays docked under
  // whichever is shown. From lg the app's preview has its own column beside the panels (App.tsx);
  // below it the Preview panel is where the frame is placed. Very wide windows may show Your
  // app and Details side by side.
  const strip = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<PanelId>("app");
  const framed = useMedia("(min-width: 1024px)");
  const wide = useMedia("(min-width: 1680px)");
  const panels = framed ? PANELS.filter(([id]) => id !== "preview") : PANELS;
  const [twoUp, setTwoUp] = useState(() => localStorage.getItem("builder-two-up") !== "no");
  const paired = wide && twoUp;
  const show = (id: PanelId) =>
    strip.current
      ?.querySelector<HTMLElement>(`[data-panel="${id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  const onScroll = () => {
    const el = strip.current;
    if (!el) return;
    const at = [...el.children].findIndex(
      (c) => Math.abs((c as HTMLElement).offsetLeft - el.scrollLeft) < el.clientWidth / 2,
    );
    const id = panels[at]?.[0];
    if (id) setShown(id);
  };
  // Something picked in the preview is changed in the Details panel.
  const select = (s: Selection | undefined) => {
    setSelection(s);
    if (s && !paired) show("details");
  };
  selectRef.current = select;
  // Back in this mode with something picked (here or in Code mode): open at its details.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, as the mode opens
  useEffect(() => {
    if (place.selection && !paired) show("details");
  }, []);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <nav
        aria-label="Panels"
        className="flex shrink-0 flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-3 py-1.5"
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: arrow keys between the panels' buttons */}
        <div
          className="flex rounded-md bg-neutral-100 p-0.5"
          onKeyDown={(e) => {
            const at = panels.findIndex(([id]) => id === shown);
            const to = { ArrowRight: at + 1, ArrowLeft: at - 1 }[e.key];
            const next = to === undefined ? undefined : panels[to];
            if (!next) return;
            e.preventDefault();
            show(next[0]);
            (e.currentTarget.children[to as number] as HTMLElement).focus();
          }}
        >
          {panels.map(([id, label]) => {
            const current = shown === id || (paired && id === "details");
            return (
              <button
                key={id}
                type="button"
                aria-current={current ? "true" : undefined}
                onClick={() => show(id)}
                className={cx(
                  "h-7 rounded px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
                  current ? "bg-white shadow-xs" : "text-neutral-600",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        {wide && (
          <label className="flex items-center gap-1.5 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={twoUp}
              onChange={(e) => {
                setTwoUp(e.target.checked);
                localStorage.setItem("builder-two-up", e.target.checked ? "yes" : "no");
              }}
            />
            Your app + Details
          </label>
        )}
      </nav>
      <div
        ref={strip}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        <div
          data-panel="app"
          className={cx(
            "flex shrink-0 snap-start flex-col *:min-h-0 *:flex-1",
            paired ? "w-[calc(100%-22rem)]" : "w-full",
          )}
        >
          <Panel
            className="min-h-0 flex-1"
            title={
              <Tabs
                tabs={[
                  ["app", "Your app"],
                  ["change", "Change"],
                ]}
                value={tab}
                onChange={setTab}
              />
            }
          >
            {tab === "app" ? (
              <AppSummary
                app={project.name}
                sections={sections}
                spec={spec}
                run={run}
                words={words}
              />
            ) : (
              // A new proposal to edit starts the form afresh with its values.
              <ChangeForms
                key={JSON.stringify(prefill ?? null)}
                spec={spec}
                run={run}
                prefill={prefill}
              />
            )}
          </Panel>
        </div>
        {!framed && (
          // The preview frame is placed over this panel (it never moves, so it keeps its page).
          <div
            data-panel="preview"
            ref={previewSlot}
            className="w-full shrink-0 snap-start border-l border-neutral-200"
          />
        )}
        <div
          data-panel="details"
          className={cx(
            "flex min-h-0 shrink-0 flex-col border-l border-neutral-200 *:min-h-0 *:flex-1",
            paired ? "w-[22rem]" : "w-full snap-start",
          )}
        >
          {selection ? (
            <Selected
              selection={selection}
              spec={spec}
              run={run}
              onClose={() => setSelection(undefined)}
            />
          ) : (
            <p className="p-4 text-sm text-neutral-500">
              Choose Select above the preview, then click a part of the app to change it here.
            </p>
          )}
        </div>
      </div>
      {/* The change box and the changes made, newest first, under every panel: type a request
          while looking at the preview. The box stays; the list scrolls. */}
      <div className="flex max-h-[45vh] shrink-0 flex-col border-t border-neutral-200 bg-white">
        <div className="max-h-[30vh] shrink-0 overflow-auto">
          <Ask
            words={words}
            onEdit={(p) => {
              setPrefill(p);
              setTab("change");
              show("app");
            }}
          />
        </div>
        <div className="flex min-h-24 flex-1 flex-col border-t border-neutral-200 *:min-h-0 *:flex-1">
          <Trace entries={project.trace} words={words} />
        </div>
      </div>
    </div>
  );
}

type PanelId = "app" | "preview" | "details";
const PANELS: [PanelId, string][] = [
  ["app", "Your app"],
  ["preview", "Preview"],
  ["details", "Details"],
];
