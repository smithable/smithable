// Studio mode: the spec as YAML, every operation, the last change's diff, logs and concepts.
import { humanize, type JsonSchema, OPERATIONS } from "@smithable/core";
import type { ConceptInfo } from "@smithable/index";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Project } from "../api";
import { FieldShapeForm, identifier, type Run } from "../builder/ChangeForms";
import { readSpec, type Spec } from "../engine";
import { Preview, Trace } from "../shared";
import { Button, cx, Input, Label, Panel, Select, Tabs } from "../ui";

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
}: {
  project: Project;
  spec: Spec;
  run: Run;
  version: number;
  logs: string[];
  onCustomize: (page: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("spec");
  const [selected, setSelected] = useState<string>();
  // "Show in smithable.yml": the editor selects the concept's lines.
  const [jump, setJump] = useState<{ concept: string; at: number }>();
  const concept = project.concepts.find((c) => c.concept === selected);
  return (
    <div className="grid h-full min-h-0 grid-cols-[240px_1fr_300px] divide-x divide-neutral-200">
      <Panel title="Concepts">
        <ConceptTree concepts={project.concepts} selected={selected} onSelect={setSelected} />
      </Panel>
      <Panel
        title={
          <Tabs
            tabs={[
              ["spec", "smithable.yml"],
              ["operation", "Operation"],
              ["diff", "Last change"],
              ["logs", "Logs"],
              ["preview", "Preview"],
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      >
        {tab === "spec" && <SpecEditor project={project} run={run} jump={jump} />}
        {tab === "operation" && <OperationForm run={run} />}
        {/* Remounted for every new change. */}
        {tab === "diff" && <Diff key={version} />}
        {tab === "logs" && (
          <section aria-label="Logs">
            <pre className="whitespace-pre-wrap p-3 font-mono text-xs text-neutral-700">
              {logs.slice(-300).join("\n")}
            </pre>
          </section>
        )}
        {tab === "preview" && <Preview url={project.preview} version={version} />}
      </Panel>
      <div className="grid min-h-0 grid-rows-[1fr_1fr] divide-y divide-neutral-200">
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
  run,
  jump,
}: {
  project: Project;
  run: Run;
  jump?: { concept: string; at: number };
}) {
  const saved = project.files.spec ?? "";
  const [text, setText] = useState(saved);
  useEffect(() => setText(saved), [saved]);
  const area = useRef<HTMLTextAreaElement>(null);
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
  const { diagnostics } = useMemo(() => readSpec(project.files, text), [project.files, text]);
  const errors = diagnostics.filter((d) => d.severity === "error");
  return (
    <div className="flex h-full flex-col">
      <textarea
        ref={area}
        aria-label="smithable.yml"
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-0 flex-1 resize-none p-3 font-mono text-[13px] leading-5 outline-none"
      />
      <div className="flex items-center justify-between gap-3 border-t border-neutral-200 p-2">
        <ul aria-label="Problems" className="min-w-0 space-y-0.5 text-xs">
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
const ARGUMENT_HINTS: Record<string, string> = {
  model: "A kind of record, e.g. Customer.",
  field: "A field of that kind of record, e.g. email.",
  page: "A page's name, e.g. customers.",
  type: `The field's kind, e.g. string!, email unique or "draft | sent".`,
  value: "One of the choice field's values.",
  column: "A field shown as a column of the page's table.",
  columns: "Fields, in the order to show them.",
  fields: "Fields, e.g. name email.",
  from: "The current name.",
  to: "The new name (letters and digits, starting lowercase).",
  roles: "Roles from smithable.auth.yml, e.g. admin sales.",
  target: "What the rule is for, e.g. model:Order.create.",
  menu: 'Usually "main".',
  pages: "Pages' names, in order.",
  name: "A name, letters and digits, starting lowercase.",
};

/** Any operation, with a form built from its JSON Schema: the same definition MCP tools use. */
function OperationForm({ run }: { run: Run }) {
  const operations = OPERATIONS.filter((o) => o.name !== "editSpec");
  const [name, setName] = useState(operations[0]?.name ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const op = operations.find((o) => o.name === name);
  const properties = (op?.schema.properties ?? {}) as Record<string, JsonSchema>;
  const args = () =>
    Object.fromEntries(
      Object.entries(values)
        .filter(([, v]) => v.trim())
        .map(([key, v]) => {
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
        <Label
          key={key}
          text={`${key}${(op?.schema.required as string[] | undefined)?.includes(key) ? " *" : ""}`}
          hint={[
            schema.description ?? ARGUMENT_HINTS[key],
            Array.isArray(schema.enum) ? `One of: ${schema.enum.join(", ")}.` : "",
            schema.type === "array" ? "Separate with spaces or commas." : "",
            schema.type === "object" ? "name=value pairs, separated by commas." : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <Input
            aria-label={key}
            value={values[key] ?? ""}
            onChange={(e) => setValues({ ...values, [key]: e.target.value })}
          />
        </Label>
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

/** One visible text, saved with setText; empty restores the text Smithable derives. */
function TextSetting({
  label,
  path,
  current,
  fallback,
  run,
}: {
  label: string;
  path: string[];
  current?: string;
  fallback: string;
  run: Run;
}) {
  const [text, setText] = useState(current ?? "");
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run("setText", { path, text: text.trim() });
      }}
    >
      <Label text={label}>
        <Input
          aria-label={label}
          value={text}
          placeholder={fallback}
          onChange={(e) => setText(e.target.value)}
        />
      </Label>
      <Button
        type="submit"
        variant="ghost"
        aria-label={`Save ${label.toLowerCase()}`}
        className="border border-neutral-200"
        disabled={text.trim() === (current ?? "")}
      >
        Save
      </Button>
    </form>
  );
}

const PAGE_ICONS = [
  "auto",
  "users",
  "user",
  "file",
  "receipt",
  "cart",
  "package",
  "calendar",
  "layers",
  "book",
  "briefcase",
  "building",
  "chart",
  "clipboard",
  "home",
  "mail",
  "settings",
  "star",
  "tag",
  "truck",
  "list",
];

/** The selected concept's properties, changed with operations (the Photoshop-like panel). */
function Properties({ concept, spec, run }: { concept: string; spec: Spec; run: Run }) {
  const ir = spec.ir;
  const [kind = "", rest = ""] = concept.split(":");
  const [name = "", fieldName] = rest.split(".");
  const [rename, setRename] = useState("");
  if (!ir) return null;
  const heading = <h3 className="text-xs font-semibold text-neutral-500">Properties</h3>;
  if (kind === "field" && fieldName) {
    const field = ir.models.find((m) => m.name === name)?.fields.find((f) => f.name === fieldName);
    if (!field) return null;
    const models = ir.models.map((m) => m.name);
    const to = identifier(rename);
    return (
      <div className="space-y-3 border-b border-neutral-200 p-3 text-sm">
        {heading}
        {field.formula || (field.type.kind === "relation" && field.type.many) ? (
          <p className="text-neutral-600">
            {field.formula ? "Calculated" : "Lists related records"}: change it in smithable.yml.
          </p>
        ) : (
          <FieldShapeForm
            field={field}
            models={models}
            run={(type) => run("changeField", { model: name, field: fieldName, type })}
          />
        )}
        <TextSetting
          label="Label"
          path={["models", name, "fields", fieldName, "label"]}
          current={spec.content?.models[name]?.fields[fieldName]?.label}
          fallback={humanize(fieldName)}
          run={run}
        />
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (to) void run("renameField", { model: name, from: fieldName, to });
          }}
        >
          <Label
            text="Rename"
            hint={to ? `Will be named ${to}; the data is kept` : "The data is kept"}
          >
            <Input aria-label="Rename" value={rename} onChange={(e) => setRename(e.target.value)} />
          </Label>
          <Button
            type="submit"
            variant="ghost"
            className="border border-neutral-200"
            disabled={!to}
          >
            Rename
          </Button>
        </form>
        <Button
          variant="ghost"
          className="border border-red-200 text-red-700"
          onClick={() => void run("removeField", { model: name, field: fieldName })}
        >
          Remove field
        </Button>
      </div>
    );
  }
  if (kind === "page") {
    const page = ir.pages.find((p) => p.id === name);
    if (!page) return null;
    const texts = spec.content?.pages[name];
    return (
      <div className="space-y-3 border-b border-neutral-200 p-3 text-sm">
        {heading}
        <TextSetting
          label="Title"
          path={["pages", name, "title"]}
          current={texts?.title}
          fallback={humanize(name)}
          run={run}
        />
        <TextSetting
          label="Subtitle"
          path={["pages", name, "subtitle"]}
          current={texts?.subtitle}
          fallback="None"
          run={run}
        />
        <Label text="Icon in the menu">
          <Select
            aria-label="Icon in the menu"
            value=""
            onChange={(e) =>
              e.target.value && void run("setIcon", { page: name, icon: e.target.value })
            }
            options={[
              ["", "Choose…"],
              ...PAGE_ICONS.map((i): [string, string] => [
                i,
                i === "auto" ? "Automatic" : humanize(i),
              ]),
            ]}
          />
        </Label>
        <Button
          variant="ghost"
          className="border border-red-200 text-red-700"
          disabled={ir.pages.length < 2}
          onClick={() => void run("removePage", { page: name })}
        >
          Remove page
        </Button>
      </div>
    );
  }
  if (kind === "model") {
    const texts = spec.content?.models[name];
    return (
      <div className="space-y-3 border-b border-neutral-200 p-3 text-sm">
        {heading}
        <TextSetting
          label="Name for one"
          path={["models", name, "label"]}
          current={texts?.label}
          fallback={humanize(name)}
          run={run}
        />
        <TextSetting
          label="Name for several"
          path={["models", name, "pluralLabel"]}
          current={texts?.pluralLabel}
          fallback={`${humanize(name)}s`}
          run={run}
        />
      </div>
    );
  }
  return null;
}
