// Builder mode: the app in plain language, forms for changes, and the preview.
import { humanize, pageModel, plural } from "@smithable/core";
import { describeChange, summarize } from "@smithable/index";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "../api";
import type { Spec } from "../engine";
import { isPreviewMessage, type Place, type Selection } from "../preview";
import { Trace } from "../shared";
import { Button, cx, Panel, Tabs, useMedia } from "../ui";
import { AppDetails } from "./AppDetails";
import { AppSummary } from "./AppSummary";
import { Ask } from "./Ask";
import { ChangeForms, type Prefill, type Run } from "./ChangeForms";
import { Look } from "./Look";
import { Selected } from "./Selected";

export function Builder({
  project,
  spec,
  run,
  place,
  onPlace,
}: {
  project: Project;
  spec: Spec;
  run: Run;
  /** Where the person was in this mode, and a way to say where they are now (App.tsx). */
  place: Place["builder"];
  onPlace: (place: Place["builder"]) => void;
}) {
  const [tab, setTabState] = useState<"app" | "look" | "change">(place.tab ?? "app");
  const setTab = (next: "app" | "look" | "change") => {
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
  // The change box's example in the app's own records (a booking app has no customers): the
  // first listed on a page, and the last.
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
  // The panels are a strip that snaps, one wide each; the change box stays docked under
  // whichever is shown. From lg the app's preview has its own column beside the panels; below it,
  // Preview in the mode switch (App.tsx). Very wide windows may show Your app and Details side
  // by side.
  const strip = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<PanelId>("app");
  const wide = useMedia("(min-width: 1680px)");
  const phone = useMedia("(max-width: 639px)");
  const panels = PANELS;
  const [twoUp, setTwoUp] = useState(() => localStorage.getItem("builder-two-up") !== "no");
  // The change box folded to one line: as the person left it, else folded at phone width.
  const [folded, setFolded] = useState(() => {
    const kept = localStorage.getItem("builder-change-box");
    return kept ? kept === "folded" : matchMedia("(max-width: 639px)").matches;
  });
  const fold = (on: boolean) => {
    setFolded(on);
    localStorage.setItem("builder-change-box", on ? "folded" : "open");
  };
  const last = project.trace[0];
  const lastWords = last
    ? ((last.operation && words(last.operation.op, last.operation.args)) ?? last.description)
    : "";
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
        className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-panel px-3 py-1.5"
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: arrow keys between the panels' buttons */}
        <div
          className="flex rounded-md bg-subtle p-0.5"
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
                  current ? "bg-panel shadow-xs" : "text-muted",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        {wide && (
          <label className="flex items-center gap-1.5 text-xs text-muted">
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
        data-strip
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
                  ["app", "What it does"],
                  ["look", "Look", "look"],
                  ["change", "Change"],
                ]}
                value={tab}
                onChange={setTab}
              />
            }
          >
            {tab === "look" ? (
              <Look spec={spec} run={run} themes={project.themes} />
            ) : tab === "app" ? (
              <AppSummary
                app={project.name}
                sections={sections}
                spec={spec}
                run={run}
                onAdd={(p) => {
                  setPrefill(p);
                  setTab("change");
                }}
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
        <div
          data-panel="details"
          data-guide="details"
          className={cx(
            "flex min-h-0 shrink-0 flex-col border-l border-line *:min-h-0 *:flex-1",
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
            <AppDetails
              key={`${spec.ir?.app.name}|${spec.ir?.app.description}`}
              spec={spec}
              run={run}
              onLook={() => {
                setTab("look");
                show("app");
              }}
            />
          )}
        </div>
      </div>
      {/* The change box and the changes made, newest first, under every panel: type a request
          while looking at the preview. The box stays; the list scrolls. Folded to one line it
          leaves the panels the room (at phone width it starts folded). */}
      {folded ? (
        // Folded, the bar is the guide's change stop: it says where the box opens.
        <div
          data-guide="change"
          className="flex shrink-0 items-center gap-3 border-t border-line bg-panel px-3 py-1.5 text-xs text-muted"
        >
          <span className="min-w-0 flex-1 truncate">
            {project.trace[0] ? `Last change: ${lastWords}` : "No changes yet."}
          </span>
          <Button variant="ghost" className="h-6" onClick={() => fold(false)}>
            Show the change box
          </Button>
        </div>
      ) : (
        <div className="flex max-h-[35vh] shrink-0 flex-col border-t border-line bg-panel">
          <div className="flex justify-end px-3 pt-1">
            <Button variant="ghost" className="h-6 text-xs" onClick={() => fold(true)}>
              Fold
            </Button>
          </div>
          <div className="max-h-[22vh] shrink-0 overflow-auto">
            <Ask
              example={example}
              // On a phone the box folds once a change is made, so the preview has the room again.
              onDone={() => phone && setFolded(true)}
              words={words}
              waiting={project.waiting}
              onEdit={(p) => {
                setPrefill(p);
                setTab("change");
                show("app");
              }}
            />
          </div>
          <div className="flex min-h-24 flex-1 flex-col border-t border-line *:min-h-0 *:flex-1">
            <Trace entries={project.trace} words={words} />
          </div>
        </div>
      )}
    </div>
  );
}

type PanelId = "app" | "details";
const PANELS: [PanelId, string][] = [
  ["app", "Your app"],
  ["details", "Details"],
];
