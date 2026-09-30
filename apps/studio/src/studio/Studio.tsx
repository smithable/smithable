// Studio mode: the spec as YAML, every operation, the last change's diff, logs and concepts.
import { type ArgRef, type JsonSchema, operationsFor, refHint } from "@smithable/core";
import type { ConceptInfo } from "@smithable/index";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Project } from "../api";
import { ArgumentField, type ArgValues, argumentsOf } from "../arguments";
import type { Run } from "../builder/ChangeForms";
import { readSpec, type Spec } from "../engine";
import type { Place } from "../preview";
import { Properties } from "../properties";
import { Trace } from "../shared";
import { Button, cx, Label, Panel, Select, Tabs, useMedia } from "../ui";

type Tab = "spec" | "operation" | "diff" | "logs" | "preview";

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
  previewSlot,
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
  /** Where the app's preview frame goes on a narrow window (App.tsx places it over this). */
  previewSlot: (element: HTMLElement | null) => void;
  /** Where the person was in this mode, and a way to say where they are now (App.tsx). */
  place: Place["studio"];
  onPlace: (place: Place["studio"]) => void;
  /** With the preview's column hidden there is room for the details beside the tree from lg. */
  previewHidden: boolean;
}) {
  const [tab, setTabState] = useState<Tab>((place.tab as Tab | undefined) ?? "spec");
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
  return (
    // The details sit beside the concept tree from lg when the preview is hidden, else only on
    // very wide screens (the preview takes the right of the window from lg); under it otherwise.
    <div
      className={cx(
        "grid h-full min-h-0 grid-cols-[260px_1fr] divide-x divide-neutral-200",
        previewHidden
          ? "lg:grid-cols-[240px_320px_1fr]"
          : "min-[1800px]:grid-cols-[240px_320px_1fr]",
      )}
    >
      <div
        className={cx(
          "grid min-h-0 grid-rows-[1fr_2fr]",
          previewHidden ? "lg:contents" : "min-[1800px]:contents",
        )}
      >
        <Panel title="Concepts">
          <ConceptTree concepts={project.concepts} selected={selected} onSelect={setSelected} />
        </Panel>
        <div
          className={cx(
            "grid min-h-0 grid-rows-[1fr_1fr] divide-y divide-neutral-200 border-t border-neutral-200",
            previewHidden
              ? "lg:border-t-0 lg:border-l"
              : "min-[1800px]:border-t-0 min-[1800px]:border-l",
          )}
        >
          <Panel title="Details">
            {concept ? (
              <>
                <Properties key={concept.concept} concept={concept.concept} spec={spec} run={run} />
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
              <p className="p-3 text-sm text-neutral-500">Choose a concept.</p>
            )}
          </Panel>
          <Trace entries={project.trace} />
        </div>
      </div>
      <Panel
        title={
          <Tabs
            tabs={[
              ["spec", "smithable.yml"],
              ["operation", "Operation"],
              ["diff", "Last change"],
              ["logs", "Logs"],
              // Narrow windows only: from lg the preview has its own column.
              ...(framed ? [] : [["preview", "Preview"] as [Tab, string]]),
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      >
        {tab === "spec" && (
          <SpecEditor project={project} plugins={spec.plugins} run={run} jump={jump} />
        )}
        {tab === "operation" && <OperationForm run={run} spec={spec} />}
        {/* Remounted for every new change. */}
        {tab === "diff" && <Diff key={version} />}
        {tab === "logs" && (
          <section aria-label="Logs">
            <pre className="whitespace-pre-wrap p-3 font-mono text-xs text-neutral-700">
              {logs.slice(-300).join("\n")}
            </pre>
          </section>
        )}
        {tab === "preview" && !framed && <div ref={previewSlot} className="h-full" />}
      </Panel>
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
          nested && "pl-6 text-neutral-600",
          selected === c.concept
            ? "bg-accent-soft font-medium text-accent"
            : "hover:bg-neutral-100",
        )}
      >
        {label}
        {c.rules.length > 0 && (
          <span className="ml-1 text-xs text-neutral-400">· {c.rules.length} rules</span>
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
    <nav aria-label="Concepts" className="space-y-3 p-2">
      {groups.map(([title, list]) =>
        list.length ? (
          <div key={title}>
            <p className="px-2 pb-1 text-xs font-medium text-neutral-500">{title}</p>
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
                    className="w-5 shrink-0 text-xs text-neutral-500"
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
        <p className="font-mono text-xs text-neutral-500">{info.concept}</p>
        <button type="button" onClick={onShow} className="text-xs text-accent hover:underline">
          Show in smithable.yml
        </button>
      </div>
      <p>{info.summary}</p>
      {page &&
        (customized ? (
          <p className="text-xs text-neutral-500">
            This page has its own component in src/custom/pages/{page}.tsx.
          </p>
        ) : (
          <Button
            variant="ghost"
            className="border border-neutral-200"
            onClick={() => onCustomize(page)}
          >
            Give this page its own component
          </Button>
        ))}
      {info.description && <p className="text-neutral-600">{info.description}</p>}
      {info.intent && <p className="text-neutral-600">Intent: {info.intent}</p>}
      {info.rules.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-neutral-500">Rules</h3>
          <ul className="mt-1 space-y-1">
            {info.rules.map((r) => (
              <li key={r.text}>
                <span
                  className={cx(
                    "mr-1 rounded px-1 text-xs",
                    r.status === "tested"
                      ? "bg-green-100 text-green-800"
                      : "bg-neutral-100 text-neutral-600",
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
          <h3 className="text-xs font-semibold text-neutral-500">Files</h3>
          <ul className="mt-1 space-y-0.5 font-mono text-xs">
            {info.files.map((f) => (
              <li key={`${f.path}-${f.role}`}>
                {f.path} <span className="text-neutral-400">({f.role})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SpecEditor({
  project,
  plugins,
  run,
  jump,
}: {
  project: Project;
  plugins: Spec["plugins"];
  run: Run;
  jump?: { concept: string; at: number };
}) {
  const saved = project.files.spec ?? "";
  const [text, setText] = useState(saved);
  // The file as it was when editing began: a change on disk replaces the text only when it has
  // not been edited, and is otherwise offered, so typing is never lost.
  const [base, setBase] = useState(saved);
  const edited = text !== base;
  useEffect(() => {
    // A save of this text lands here too.
    if (edited && saved !== text) return;
    setText(saved);
    setBase(saved);
  }, [saved, edited, text]);
  // Unsaved edits: the browser asks before a link, Back or closing the tab loses them.
  useEffect(() => {
    if (!edited) return;
    const ask = (event: BeforeUnloadEvent) => event.preventDefault();
    addEventListener("beforeunload", ask);
    return () => removeEventListener("beforeunload", ask);
  }, [edited]);
  const area = useRef<HTMLTextAreaElement>(null);
  // The cursor and scroll, kept for the session: coming back to Code mode opens the editor where
  // it was left (docs/design/studio-v2.md §2). Kept here, not in the app's state, since they
  // change with every key and scroll.
  useEffect(() => {
    const editor = area.current;
    if (!editor || jump) return;
    try {
      const { at, scroll } = JSON.parse(sessionStorage.getItem("smithable:editor") ?? "") as {
        at: number;
        scroll: number;
      };
      editor.setSelectionRange(at, at);
      editor.scrollTop = scroll;
    } catch {}
  }, [jump]);
  const keepCursor = () => {
    const editor = area.current;
    if (!editor) return;
    try {
      sessionStorage.setItem(
        "smithable:editor",
        JSON.stringify({ at: editor.selectionStart, scroll: editor.scrollTop }),
      );
    } catch {}
  };
  // Selects the lines a concept is declared on, and scrolls to them (when asked, not as the
  // text changes; the editor's own value is the text).
  useEffect(() => {
    const editor = area.current;
    const range = jump && editor && specRange(editor.value, jump.concept);
    if (!range || !editor) return;
    editor.focus();
    editor.setSelectionRange(range[0], range[1]);
    const line = editor.value.slice(0, range[0]).split("\n").length - 1;
    editor.scrollTop = Math.max(0, (line - 3) * 20);
  }, [jump]);
  // Checked in the tab, as you type: the same validator the CLI uses.
  const { diagnostics } = useMemo(
    () => readSpec(project.files, text, plugins),
    [project.files, text, plugins],
  );
  const errors = diagnostics.filter((d) => d.severity === "error");
  return (
    <div className="flex h-full flex-col">
      <textarea
        ref={area}
        aria-label="smithable.yml"
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onSelect={keepCursor}
        onScroll={keepCursor}
        className="min-h-0 flex-1 resize-none p-3 font-mono text-[13px] leading-5 outline-none"
      />
      {edited && saved !== base && saved !== text && (
        <p
          role="status"
          className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 p-2 text-xs"
        >
          smithable.yml changed on disk while you were editing.
          <Button
            variant="ghost"
            onClick={() => {
              setText(saved);
              setBase(saved);
            }}
          >
            Use the file on disk
          </Button>
        </p>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-neutral-200 p-2">
        <ul aria-label="Problems" aria-live="polite" className="min-w-0 space-y-0.5 text-xs">
          {diagnostics.length === 0 ? (
            <li className="text-green-700">No problems.</li>
          ) : (
            diagnostics.slice(0, 5).map((d) => (
              <li
                key={`${d.line}:${d.column}:${d.code}`}
                className={d.severity === "error" ? "text-red-700" : "text-amber-700"}
              >
                Line {d.line}: {d.message}
              </li>
            ))
          )}
        </ul>
        <Button
          disabled={errors.length > 0 || text === saved}
          onClick={() => run("editSpec", { text })}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

/** What common arguments mean, for operations whose schema doesn't say. */

/** Any operation, with a form built from its JSON Schema: the same definition MCP tools use. */
function OperationForm({ run, spec }: { run: Run; spec: Spec }) {
  const operations = operationsFor(spec.plugins).filter((o) => o.name !== "editSpec");
  const [name, setName] = useState(operations[0]?.name ?? "");
  const [values, setValues] = useState<ArgValues>({});
  const op = operations.find((o) => o.name === name);
  const properties = (op?.schema.properties ?? {}) as Record<string, JsonSchema>;
  const required = (op?.schema.required as string[] | undefined) ?? [];
  const effective = op ? argumentsOf(op.schema, values, spec) : {};
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
        <section aria-label="What it does" className="rounded-md bg-neutral-50 p-2 text-xs">
          <p className="text-neutral-700">{op.summary}</p>
          <p className="mt-1 text-neutral-500">
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
          setValue={(v) => setValues({ ...values, [key]: v })}
          spec={spec}
          label={key}
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
      <Button type="submit">Apply {name}</Button>
    </form>
  );
}

function Diff() {
  const [patch, setPatch] = useState<string>();
  useEffect(() => {
    api.diff().then((d) => setPatch(d.patch));
  }, []);
  if (patch === undefined) return null;
  if (!patch) return <p className="p-3 text-sm text-neutral-500">No changes yet.</p>;
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
                line.startsWith("diff ") && "mt-3 font-semibold text-neutral-900",
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
