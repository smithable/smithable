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
import { Languages } from "./Languages";
import { Look } from "./Look";
import { Selected, selectedField } from "./Selected";
import { SpecForm } from "./SpecForm";
import { WhoCan } from "./WhoCan";

export function Builder({
  project,
  spec,
  run,
  place,
  onPlace,
  undo,
}: {
  project: Project;
  spec: Spec;
  run: Run;
  /** Undoes the newest change (App.tsx's, as its status line does). */
  undo: () => void;
  /** Where the person was in this mode, and a way to say where they are now (App.tsx). */
  place: Place["builder"];
  onPlace: (place: Place["builder"]) => void;
}) {
  const [tab, setTabState] = useState<"app" | "spec" | "look" | "who" | "languages" | "changes">(
    place.tab ?? "app",
  );
  const setTab = (next: "app" | "spec" | "look" | "who" | "languages" | "changes") => {
    setTabState(next);
    onPlace({ tab: next });
  };
  const [prefill, setPrefill] = useState<Prefill>();
  // A column of the Who can tab a click in the summary points at (a role, or "anyone").
  const [marked, setMarked] = useState<string>();
  // Requests typed while the app was made are taken by the prompt, which is the Changes tab's.
  const waiting = project.waiting?.length ?? 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: when requests start waiting
  useEffect(() => {
    if (waiting > 0) setTab("changes");
  }, [waiting > 0]);
  // The Changes tab's forms, folded until a click elsewhere opens one filled in.
  const [forms, setForms] = useState(false);
  const openForm = (p: Prefill | undefined) => {
    setPrefill(p);
    setForms(true);
    setTab("changes");
  };
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
    () => (spec.ir ? summarize(spec.ir, spec.auth, spec.content, spec.plugins, spec.ux) : []),
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
  const panels = PANELS;
  const [twoUp, setTwoUp] = useState(() => localStorage.getItem("builder-two-up") !== "no");
  const last = project.trace[0];
  // As the list words it: an undo says so ("Undid: …"), its operation is the one undone.
  const plain = last?.operation && words(last.operation.op, last.operation.args);
  const lastWords = !last
    ? ""
    : plain
      ? `${last.isUndo ? "Undid: " : ""}${plain}`
      : last.description;
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
    if (s && selectedField(s, spec) && !paired) show("details");
  };
  selectRef.current = select;
  // Back in this mode with something picked (here or in Code mode): open at its details.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, as the mode opens
  useEffect(() => {
    if (place.selection && selectedField(place.selection, spec) && !paired) show("details");
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
                  ["spec", "Every setting"],
                  ["look", "Look", "look"],
                  ["who", "Who can"],
                  ["languages", "Languages"],
                  ["changes", "Changes", "change"],
                ]}
                value={tab}
                onChange={setTab}
              />
            }
          >
            {tab === "spec" ? (
              <SpecForm files={project.files} run={run} />
            ) : tab === "languages" ? (
              <Languages spec={spec} run={run} />
            ) : tab === "look" ? (
              <Look spec={spec} run={run} themes={project.themes} />
            ) : tab === "who" ? (
              <WhoCan spec={spec} run={run} authText={project.files.auth} marked={marked} />
            ) : tab === "app" ? (
              <AppSummary
                app={project.name}
                sections={sections}
                spec={spec}
                run={run}
                onWho={(column) => {
                  setMarked(column);
                  setTab("who");
                }}
                onLook={() => setTab("look")}
              />
            ) : (
              // The prompt first, the forms folded, then every change with the rest of the room.
              <div className="flex h-full min-h-0 flex-col">
                <div className="shrink-0 border-b border-line">
                  <Ask
                    example={example}
                    words={words}
                    waiting={project.waiting}
                    onEdit={(p) => {
                      openForm(p);
                      show("app");
                    }}
                  />
                </div>
                <details
                  open={forms}
                  onToggle={(e) => setForms(e.currentTarget.open)}
                  className="shrink-0 border-b border-line"
                >
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                    Change by form
                  </summary>
                  {/* A new proposal to edit starts the form afresh with its values. */}
                  <ChangeForms
                    key={JSON.stringify(prefill ?? null)}
                    spec={spec}
                    run={run}
                    prefill={prefill}
                  />
                </details>
                <div className="min-h-0 flex-1 overflow-auto">
                  {project.trace.length > 0 && (
                    <h2 className="px-3 pt-3 text-xs font-semibold tracking-wide text-quiet uppercase">
                      Previous changes
                    </h2>
                  )}
                  <Trace entries={project.trace} words={words} plugins={spec.plugins} />
                </div>
              </div>
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
          {/* What this panel cannot show (a model picked in Code mode, a field since removed)
              leaves the app's details, not an empty panel. */}
          {selection && selectedField(selection, spec) ? (
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
              onWho={() => {
                setTab("who");
                show("app");
              }}
            />
          )}
        </div>
      </div>
      {/* The newest change under the panels, while looking at the preview: what it was, and
          Undo while it is still in place. The list and the prompt are the Changes tab's. */}
      <section
        aria-label="Last change"
        className="flex shrink-0 items-center gap-3 border-t border-line bg-panel px-3 py-1.5 text-xs text-muted"
      >
        <span className="min-w-0 flex-1 truncate">
          {last ? `Last change: ${lastWords}` : "No changes yet."}
        </span>
        {last && !last.undone && !last.isUndo && (
          <Button variant="ghost" className="h-6" onClick={undo} aria-label="Undo the last change">
            Undo
          </Button>
        )}
        {tab !== "changes" && (
          <Button variant="ghost" className="h-6" onClick={() => setTab("changes")}>
            All changes
          </Button>
        )}
      </section>
    </div>
  );
}

type PanelId = "app" | "details";
const PANELS: [PanelId, string][] = [
  ["app", "Your app"],
  ["details", "Details"],
];
