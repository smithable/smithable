// Studio mode: the spec as YAML, every operation, the last change's diff, logs and concepts.
import {
  type ArgRef,
  defaultColumns,
  EDITABLE_FILES,
  type EditableFile,
  emptyFile,
  type JsonSchema,
  operationsFor,
  pageModel,
  refHint,
} from "@smithable/core";
import type { ConceptInfo } from "@smithable/index";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { api, type Project } from "../api";
import { ArgumentField, type ArgValues, argumentProblem, argumentsOf } from "../arguments";
import type { Run } from "../builder/ChangeForms";
import { FILE_DOCS } from "../docs";
import { checkFile, type Spec } from "../engine";
import type { Place } from "../preview";
import { Properties } from "../properties";
import { Trace } from "../shared";
import { Button, cx, Label, Panel, Select, Tabs, useMedia } from "../ui";

// The editor is its own piece of code, fetched when the spec tab is first shown.
const SpecText = lazy(() => import("./SpecText"));

type Tab = "spec" | "operation" | "diff" | "logs";

const STATUS: Record<string, string> = {
  "not-implemented": "Not implemented",
  untested: "Implemented, untested",
  "not-run": "Tests not run",
  failing: "Test failing",
  tested: "Implemented and tested",
  changed: "Changed since implemented",
};

export function Studio({
  project,
  spec,
  run,
  version,
  logs,
  onCustomize,
  place,
  onPlace,
  previewHidden,
}: {
  project: Project;
  spec: Spec;
  run: Run;
  version: number;
  logs: string[];
  onCustomize: (page: string) => void;
  /** Where the person was in this mode, and a way to say where they are now (App.tsx). */
  place: Place["studio"];
  onPlace: (place: Place["studio"]) => void;
  /** With the preview's column hidden there is room for the details beside the tree from lg. */
  previewHidden: boolean;
}) {
  // A tab kept from before there was no Preview tab opens the files.
  const [tab, setTabState] = useState<Tab>(() =>
    TABS.includes(place.tab as Tab) ? (place.tab as Tab) : "spec",
  );
  const setTab = (next: Tab) => {
    setTabState(next);
    onPlace({ tab: next });
  };
  const framed = useMedia("(min-width: 1024px)");
  const [selected, setSelectedState] = useState<string | undefined>(place.concept);
  const setSelected = (concept: string) => {
    setSelectedState(concept);
    onPlace({ concept });
  };
  // "Show in smithable.yml": the editor selects the concept's lines.
  const [jump, setJump] = useState<{ concept: string; at: number }>();
  const concept = project.concepts.find((c) => c.concept === selected);
  // On a phone: which panel of the row is shown, and a bar to go to another (as Builder has).
  const strip = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<PhonePanel>("editor");
  const show = (id: PhonePanel) =>
    strip.current
      ?.querySelector<HTMLElement>(`[data-panel="${id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  const onScroll = () => {
    const el = strip.current;
    if (!el || framed) return;
    const near = [...el.querySelectorAll<HTMLElement>("[data-panel]")].find(
      (c) => Math.abs(c.offsetLeft - el.scrollLeft) < el.clientWidth / 2,
    );
    if (near) setShown(near.dataset.panel as PhonePanel);
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      {!framed && (
        <nav
          aria-label="Panels"
          className="flex shrink-0 border-b border-line bg-panel px-3 py-1.5"
        >
          <div className="flex rounded-md bg-subtle p-0.5">
            {PHONE_PANELS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-current={shown === id ? "true" : undefined}
                onClick={() => show(id)}
                className={cx(
                  "h-7 rounded px-3 text-xs font-medium",
                  shown === id ? "bg-panel shadow-xs" : "text-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      )}
      {/* The details sit beside the concept tree from lg when the preview is hidden, else only on
          very wide screens (the preview takes the right of the window from lg); under it
          otherwise. On a phone (under lg) the panels are one horizontal row that snaps, as in
          Builder: the editor, then the concepts, the details and the trace, each the screen's
          width. */}
      <div
        ref={strip}
        data-strip
        onScroll={onScroll}
        className={cx(
          "flex min-h-0 flex-1 snap-x snap-mandatory divide-x divide-line overflow-x-auto overscroll-x-contain",
          "lg:grid lg:snap-none lg:grid-cols-[260px_1fr] lg:overflow-visible",
          previewHidden
            ? "lg:grid-cols-[240px_320px_1fr]"
            : "min-[1800px]:grid-cols-[240px_320px_1fr]",
        )}
      >
        <div
          className={cx(
            "grid min-h-0 grid-rows-[1fr_2fr] max-lg:contents",
            previewHidden ? "lg:contents" : "min-[1800px]:contents",
          )}
        >
          <Panel title="Concepts" className={PHONE_PANEL} panel="concepts">
            <ConceptTree concepts={project.concepts} selected={selected} onSelect={setSelected} />
          </Panel>
          <div
            data-panel="details"
            className={cx(
              "grid min-h-0 grid-rows-[1fr_1fr] divide-y divide-line border-t border-line",
              PHONE_PANEL,
              "max-lg:border-t-0",
              previewHidden
                ? "lg:border-t-0 lg:border-l"
                : "min-[1800px]:border-t-0 min-[1800px]:border-l",
            )}
          >
            <Panel title="Details">
              {concept ? (
                <>
                  <Properties
                    key={concept.concept}
                    concept={concept.concept}
                    spec={spec}
                    run={run}
                  />
                  <ConceptDetails
                    info={concept}
                    onCustomize={onCustomize}
                    onShow={() => {
                      setTab("spec");
                      setJump({ concept: concept.concept, at: Date.now() });
                    }}
                  />
                </>
              ) : (
                <p className="p-3 text-sm text-quiet">Choose a concept.</p>
              )}
            </Panel>
            <Trace entries={project.trace} />
          </div>
        </div>
        {/* On a phone the editor comes first: Code mode is for editing the text. */}
        <Panel
          className={cx(PHONE_PANEL, "max-lg:order-first")}
          panel="editor"
          title={
            <Tabs
              tabs={[
                ["spec", "Files", "files"],
                ["operation", "Operation", "operation"],
                ["diff", "Last change", "last-change"],
                ["logs", "Logs"],
              ]}
              value={tab}
              onChange={setTab}
            />
          }
        >
          {tab === "spec" && (
            <SpecEditor
              project={project}
              plugins={spec.plugins}
              run={run}
              jump={jump}
              file={place.file ?? "smithable.yml"}
              onFile={(file) => onPlace({ file })}
            />
          )}
          {tab === "operation" && <OperationForm run={run} spec={spec} />}
          {/* Remounted for every new change. */}
          {tab === "diff" && <Diff key={version} />}
          {tab === "logs" && (
            <section aria-label="Logs">
              <pre className="whitespace-pre-wrap p-3 font-mono text-xs text-fg-soft">
                {logs.slice(-300).join("\n")}
              </pre>
            </section>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ConceptTree({
  concepts,
  selected,
  onSelect,
}: {
  concepts: ConceptInfo[];
  selected?: string;
  onSelect: (c: string) => void;
}) {
  // Models open to show their fields, like a properties panel.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (name: string) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const item = (c: ConceptInfo, label: string, nested = false, expander?: React.ReactNode) => (
    <li key={c.concept} className="flex items-center">
      {expander}
      <button
        type="button"
        onClick={() => onSelect(c.concept)}
        aria-current={selected === c.concept ? "true" : undefined}
        className={cx(
          "block w-full truncate rounded px-2 py-1 text-left text-sm",
          nested && "pl-6 text-muted",
          selected === c.concept ? "bg-accent-soft font-medium text-accent" : "hover:bg-subtle",
        )}
      >
        {label}
        {c.rules.length > 0 && (
          <span className="ml-1 text-xs text-faint">· {c.rules.length} rules</span>
        )}
      </button>
    </li>
  );
  const groups: [string, ConceptInfo[]][] = [
    ["Models", concepts.filter((c) => c.concept.startsWith("model:"))],
    ["Actions", concepts.filter((c) => c.concept.startsWith("action:"))],
    ["Pages", concepts.filter((c) => c.concept.startsWith("page:"))],
  ];
  return (
    <nav aria-label="Concepts" data-guide="concepts" className="space-y-3 p-2">
      {groups.map(([title, list]) =>
        list.length ? (
          <div key={title}>
            <p className="px-2 pb-1 text-xs font-medium text-quiet">{title}</p>
            <ul>
              {list.flatMap((c) => {
                const name = c.concept.split(":")[1] ?? "";
                const fields = c.concept.startsWith("model:")
                  ? concepts.filter((f) => f.concept.startsWith(`field:${name}.`))
                  : [];
                const expanded = open.has(name) || selected?.startsWith(`field:${name}.`);
                const expander = fields.length ? (
                  <button
                    key="expander"
                    type="button"
                    aria-label={`${expanded ? "Close" : "Open"} ${name}`}
                    aria-expanded={Boolean(expanded)}
                    onClick={() => toggle(name)}
                    className="w-5 shrink-0 text-xs text-quiet"
                  >
                    {expanded ? "▾" : "▸"}
                  </button>
                ) : (
                  <span key="expander" className="w-5 shrink-0" />
                );
                return [
                  item(c, name, false, expander),
                  ...(expanded
                    ? fields.map((f) => item(f, f.concept.split(".")[1] ?? "", true))
                    : []),
                ];
              })}
            </ul>
          </div>
        ) : null,
      )}
    </nav>
  );
}

function ConceptDetails({
  info,
  onCustomize,
  onShow,
}: {
  info: ConceptInfo;
  onCustomize: (page: string) => void;
  onShow: () => void;
}) {
  const page = info.concept.startsWith("page:") ? info.concept.slice(5) : undefined;
  const customized = info.files.some((f) => f.path.startsWith("src/custom/pages/"));
  return (
    <div className="space-y-3 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs text-quiet">{info.concept}</p>
        <button type="button" onClick={onShow} className="text-xs text-accent hover:underline">
          Show in smithable.yml
        </button>
      </div>
      <p>{info.summary}</p>
      {page &&
        (customized ? (
          <p className="text-xs text-quiet">
            This page has its own component in src/custom/pages/{page}.tsx.
          </p>
        ) : (
          <Button variant="ghost" className="border border-line" onClick={() => onCustomize(page)}>
            Give this page its own component
          </Button>
        ))}
      {info.description && <p className="text-muted">{info.description}</p>}
      {info.intent && <p className="text-muted">Intent: {info.intent}</p>}
      {info.rules.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-quiet">Rules</h3>
          <ul className="mt-1 space-y-1">
            {info.rules.map((r) => (
              <li key={r.text}>
                <span
                  className={cx(
                    "mr-1 rounded px-1 text-xs",
                    r.status === "tested" ? "bg-green-100 text-green-800" : "bg-subtle text-muted",
                  )}
                >
                  {STATUS[r.status]}
                </span>
                {r.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {info.files.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-quiet">Files</h3>
          <ul className="mt-1 space-y-0.5 font-mono text-xs">
            {info.files.map((f) => (
              <li key={`${f.path}-${f.role}`}>
                {f.path} <span className="text-faint">({f.role})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * The spec files as text: smithable.yml and its companions, each checked as you type by the
 * same validator the CLI uses, and saved whole as one change (editSpec). A file the project does
 * not have yet starts from its first line; the auth file is only offered when there is one.
 */
function SpecEditor({
  project,
  plugins,
  run,
  jump,
  file,
  onFile: setFile,
}: {
  project: Project;
  plugins: Spec["plugins"];
  run: Run;
  jump?: { concept: string; at: number };
  /** The file open, kept in Code mode's place (App.tsx), so a mode switch comes back to it. */
  file: EditableFile;
  onFile: (file: EditableFile) => void;
}) {
  const offered = (Object.keys(EDITABLE_FILES) as EditableFile[]).filter(
    (f) => project.files[EDITABLE_FILES[f]] !== undefined || emptyFile(f) !== undefined,
  );
  const saved = project.files[EDITABLE_FILES[file]] ?? emptyFile(file) ?? "";
  // Unsaved edits, by file, and each file as it was when its editing began: a change on disk
  // replaces the text only when it has not been edited, and is otherwise offered, so typing is
  // never lost. Kept for the browser tab's session, so a mode switch or a reload keeps them
  // (studio-v2.md §2).
  const [drafts, setDrafts] = useState(() => keptDrafts(project.name, "text"));
  const [bases, setBases] = useState(() => keptDrafts(project.name, "base"));
  useEffect(() => {
    for (const f of Object.keys(EDITABLE_FILES) as EditableFile[]) {
      const key = draftKey(project.name, f);
      const text = drafts[f];
      const base = bases[f];
      try {
        if (text === undefined || base === undefined) sessionStorage.removeItem(key);
        else sessionStorage.setItem(key, JSON.stringify({ text, base }));
      } catch {}
    }
  }, [drafts, bases, project.name]);
  const text = drafts[file] ?? saved;
  const base = bases[file] ?? saved;
  const edited = text !== base;
  const setText = (next: string) => {
    setDrafts((d) => ({ ...d, [file]: next }));
    if (bases[file] === undefined) setBases((b) => ({ ...b, [file]: saved }));
  };
  const dropEdits = () => {
    setDrafts(({ [file]: _, ...rest }) => rest);
    setBases(({ [file]: _, ...rest }) => rest);
  };
  const draft = drafts[file];
  const began = bases[file];
  useEffect(() => {
    // A save of this text lands here too.
    if (edited && saved !== text) return;
    if (draft !== undefined || began !== undefined) {
      setDrafts(({ [file]: _, ...rest }) => rest);
      setBases(({ [file]: _, ...rest }) => rest);
    }
  }, [saved, edited, text, file, draft, began]);
  // Unsaved edits: the browser asks before a link, Back or closing the tab loses them.
  const unsaved = Object.values(drafts).length > 0;
  useEffect(() => {
    if (!unsaved) return;
    const ask = (event: BeforeUnloadEvent) => event.preventDefault();
    addEventListener("beforeunload", ask);
    return () => removeEventListener("beforeunload", ask);
  }, [unsaved]);
  // Where a concept is declared, to select and bring into view when asked (not as the text
  // changes).
  // biome-ignore lint/correctness/useExhaustiveDependencies: a jump is asked by its time
  useEffect(() => {
    if (jump) setFile("smithable.yml");
  }, [jump]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a jump is asked by its time
  const select = useMemo(() => {
    const spec = drafts["smithable.yml"] ?? project.files.spec ?? "";
    const range = jump && specRange(spec, jump.concept);
    return range && jump ? { from: range[0], to: range[1], at: jump.at } : undefined;
  }, [jump]);
  const { diagnostics, roles } = useMemo(
    () => checkFile(project.files, file, text, plugins, project.ownThemes),
    [project.files, file, text, plugins, project.ownThemes],
  );
  const errors = diagnostics.filter((d) => d.severity === "error");
  // "What goes here?": the editor's list of what can be written at the cursor, for a phone,
  // which has no Ctrl-Space.
  const [ask, setAsk] = useState(0);
  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* In a narrow column the toolbar wraps onto a second line, never a word per line. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-2 py-1.5 text-xs">
        <Select
          aria-label="File"
          value={file}
          onChange={(e) => setFile(e.target.value as EditableFile)}
          className="text-xs"
          options={offered.map((f) => [
            f,
            drafts[f] !== undefined &&
            drafts[f] !== (project.files[EDITABLE_FILES[f]] ?? emptyFile(f))
              ? `${f} (edited)`
              : f,
          ])}
        />
        {/* How the open file is written: its part of the spec reference, as Help opens. */}
        <a
          href={FILE_DOCS[file]}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 whitespace-nowrap text-xs text-muted hover:underline"
        >
          How this file is written
        </a>
        {project.files[EDITABLE_FILES[file]] === undefined && (
          <span className="text-quiet">Not in the project yet: saving adds it.</span>
        )}
        <Button
          variant="ghost"
          className="ml-auto h-6 whitespace-nowrap text-xs"
          // Keeps the editor's focus (and a phone's keyboard) where it is.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setAsk((n) => n + 1)}
        >
          What goes here?
        </Button>
      </div>
      <Suspense fallback={<p className="flex-1 p-3 text-xs text-quiet">Opening the editor…</p>}>
        <SpecText
          key={file}
          label={file}
          value={text}
          onChange={setText}
          problems={diagnostics.filter((d) => d.file === file)}
          select={select}
          kept={`smithable:editor:${project.name}:${file}`}
          assist
          ask={ask}
          known={{
            ...(roles ? { roles } : {}),
            spec: drafts["smithable.yml"] ?? project.files.spec ?? "",
          }}
        />
      </Suspense>
      {edited && saved !== base && saved !== text && (
        <p
          role="status"
          className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 p-2 text-xs"
        >
          {file} changed on disk while you were editing.
          <Button variant="ghost" onClick={dropEdits}>
            Use the file on disk
          </Button>
        </p>
      )}
      <div
        data-guide="problems"
        className="flex items-center justify-between gap-3 border-t border-line p-2"
      >
        <ul aria-label="Problems" aria-live="polite" className="min-w-0 space-y-0.5 text-xs">
          {diagnostics.length === 0 ? (
            <li className="text-green-700">No problems.</li>
          ) : (
            diagnostics.slice(0, 5).map((d) => (
              <li
                key={`${d.file}:${d.line}:${d.column}:${d.code}`}
                className={d.severity === "error" ? "text-red-700" : "text-amber-700"}
              >
                {d.file === file ? "Line" : `${d.file} line`} {d.line}: {d.message}
              </li>
            ))
          )}
        </ul>
        <div className="flex shrink-0 gap-2">
          {/* A mistaken edit, or one that cannot be saved, is dropped for the file as saved. */}
          <Button
            variant="ghost"
            disabled={text === saved}
            onClick={() => {
              if (confirm(`Discard your edits to ${file}?`)) dropEdits();
            }}
          >
            Discard
          </Button>
          <Button
            disabled={errors.length > 0 || text === saved}
            onClick={() => run("editSpec", { text, ...(file === "smithable.yml" ? {} : { file }) })}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Where a file's unsaved edit is kept for the session: its text and the file as it was. */
const draftKey = (app: string, file: EditableFile) => `smithable:draft:${app}:${file}`;

/** The kept edits' texts, or the files as they were when editing began, by file. */
function keptDrafts(app: string, part: "text" | "base"): Partial<Record<EditableFile, string>> {
  const kept: Partial<Record<EditableFile, string>> = {};
  for (const f of Object.keys(EDITABLE_FILES) as EditableFile[]) {
    try {
      const value = JSON.parse(sessionStorage.getItem(draftKey(app, f)) ?? "null") as {
        text: string;
        base: string;
      } | null;
      if (value) kept[f] = value[part];
    } catch {}
  }
  return kept;
}

/** What common arguments mean, for operations whose schema doesn't say. */

/**
 * What a list argument holds now, so its checkboxes open as the app is: a page's columns as its
 * table shows them, its form's fields in their order.
 */
function currentList(op: string, key: string, page: unknown, spec: Spec): string[] | undefined {
  const found = spec.ir?.pages.find((p) => p.id === page);
  const model = found && spec.ir?.models.find((m) => m.name === pageModel(found));
  if (!found || !model) return undefined;
  const ux = spec.ux?.pages[found.id];
  if (op === "setColumns" && key === "columns") return ux?.columns ?? defaultColumns(model);
  if (op === "setFieldOrder" && key === "fields")
    return ux?.fieldOrder ?? model.fields.map((f) => f.name);
  return undefined;
}

/** Any operation, with a form built from its JSON Schema: the same definition MCP tools use. */
function OperationForm({ run, spec }: { run: Run; spec: Spec }) {
  // In order of name, so the adds, the removes and the sets each sit together.
  const operations = operationsFor(spec.plugins)
    .filter((o) => o.name !== "editSpec")
    .sort((a, b) => a.name.localeCompare(b.name));
  const [name, setName] = useState(operations[0]?.name ?? "");
  const [typed, setValues] = useState<ArgValues>({});
  const op = operations.find((o) => o.name === name);
  const properties = (op?.schema.properties ?? {}) as Record<string, JsonSchema>;
  const required = (op?.schema.required as string[] | undefined) ?? [];
  // A list not yet changed holds what the app has now (the page chosen decides it).
  const chosen = op ? argumentsOf(op.schema, typed, spec) : {};
  const values: ArgValues = { ...typed };
  for (const key of Object.keys(properties))
    if (values[key] === undefined) {
      const now = currentList(name, key, chosen.page, spec);
      if (now) values[key] = now;
    }
  const effective = op ? argumentsOf(op.schema, values, spec) : {};
  // Each name as typed, against its rule: said under it, and the operation waits.
  const problems = Object.fromEntries(
    Object.entries(properties).map(([key, schema]) => [
      key,
      argumentProblem(name, key, schema, values[key]),
    ]),
  );
  // Typed text for a list or name=value pairs becomes what the operation takes.
  const args = () =>
    Object.fromEntries(
      Object.entries(effective).map(([key, v]) => {
        if (typeof v !== "string") return [key, v];
        const type = properties[key]?.type;
        if (type === "array") return [key, v.split(/[\s,]+/).filter(Boolean)];
        if (type === "object")
          return [
            key,
            Object.fromEntries(
              v
                .split(/[\n,]+/)
                .filter(Boolean)
                .map((pair) => pair.split("=").map((s) => s.trim())),
            ),
          ];
        return [key, v];
      }),
    );
  return (
    <form
      className="max-w-md space-y-3 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(name, args())) setValues({});
      }}
    >
      <Label text="Operation">
        <Select
          aria-label="Operation"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setValues({});
          }}
          options={operations.map((o) => o.name)}
        />
      </Label>
      {op && (
        <section aria-label="What it does" className="rounded-md bg-surface p-2 text-xs">
          <p className="text-fg-soft">{op.summary}</p>
          <p className="mt-1 text-quiet">
            On the command line:{" "}
            <code className="font-mono">
              smithable op {name} {op.positional.map((p) => `<${p.replace("...", "")}…>`).join(" ")}
            </code>
          </p>
        </section>
      )}
      {Object.entries(properties).map(([key, schema]) => (
        <ArgumentField
          key={key}
          name={key}
          schema={schema}
          required={required.includes(key)}
          values={values}
          effective={effective}
          setValue={(v) =>
            // Another page starts its lists again from what that page has.
            setValues(
              key === "page"
                ? Object.fromEntries(
                    Object.entries({ ...typed, page: v }).filter(
                      ([k]) => k === "page" || properties[k]?.type !== "array",
                    ),
                  )
                : { ...values, [key]: v },
            )
          }
          spec={spec}
          label={key}
          problem={problems[key]}
          hint={[
            (schema.description as string | undefined) ??
              (schema["x-smithable"] ? refHint(schema["x-smithable"] as ArgRef) : undefined),
            schema.type === "array" && !schema["x-smithable"]
              ? "Separate with spaces or commas."
              : "",
            schema.type === "object" ? "name=value pairs, separated by commas." : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ))}
      <Button type="submit" disabled={Object.values(problems).some(Boolean)}>
        Apply {name}
      </Button>
    </form>
  );
}

function Diff() {
  const [patch, setPatch] = useState<string>();
  useEffect(() => {
    api.diff().then((d) => setPatch(d.patch));
  }, []);
  if (patch === undefined) return null;
  if (!patch) return <p className="p-3 text-sm text-quiet">No changes yet.</p>;
  return (
    <section aria-label="Last change">
      <pre className="p-3 font-mono text-xs leading-5">
        {patch
          .split("\n")
          .map((text, number) => ({ text, number }))
          .map(({ text: line, number }) => (
            <div
              key={number}
              className={cx(
                line.startsWith("+") && !line.startsWith("+++") && "bg-green-50 text-green-800",
                line.startsWith("-") && !line.startsWith("---") && "bg-red-50 text-red-800",
                line.startsWith("diff ") && "mt-3 font-semibold text-fg",
              )}
            >
              {line || " "}
            </div>
          ))}
      </pre>
    </section>
  );
}

/**
 * Where a concept is declared in smithable.yml, as character offsets: a model, page, action or
 * query's name line under its section, or a field's line inside its model.
 */
export function specRange(text: string, concept: string): [number, number] | undefined {
  const [kind = "", rest = ""] = concept.split(":");
  const [name = "", field] = rest.split(".");
  const section = {
    model: "models",
    field: "models",
    page: "pages",
    action: "actions",
    outgoing: "outgoing",
    query: "queries",
  }[kind];
  if (!section) return;
  const lines = text.split("\n");
  const offset = (i: number) => lines.slice(0, i).reduce((n, l) => n + l.length + 1, 0);
  const start = lines.indexOf(`${section}:`);
  if (start < 0) return;
  const at = lines.findIndex((l, i) => i > start && new RegExp(`^ {2}${name}:`).test(l));
  if (at < 0) return;
  let end = at + 1;
  while (end < lines.length && /^( {3,}|\s*$)/.test(lines[end] ?? "")) end++;
  if (!field) return [offset(at), offset(at) + (lines[at]?.length ?? 0)];
  const line = lines.findIndex(
    (l, i) => i > at && i < end && new RegExp(`^ {4,}${field}:`).test(l),
  );
  return line < 0 ? undefined : [offset(line), offset(line) + (lines[line]?.length ?? 0)];
}

const TABS: Tab[] = ["spec", "operation", "diff", "logs"];

type PhonePanel = "editor" | "concepts" | "details";
const PHONE_PANELS: [PhonePanel, string][] = [
  ["editor", "Editor"],
  ["concepts", "Concepts"],
  ["details", "Details"],
];

/** A panel of the phone's snapping row: the screen's width, snapping to its start. */
const PHONE_PANEL = "max-lg:w-full max-lg:shrink-0 max-lg:snap-start";
