// Studio mode: the spec as YAML, every operation, the last change's diff, logs and concepts.
import { type JsonSchema, OPERATIONS } from "@smithable/core";
import type { ConceptInfo } from "@smithable/index";
import { useEffect, useMemo, useState } from "react";
import { api, type Project } from "../api";
import type { Run } from "../builder/ChangeForms";
import { readSpec } from "../engine";
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
  run,
  version,
  logs,
  onCustomize,
}: {
  project: Project;
  run: Run;
  version: number;
  logs: string[];
  onCustomize: (page: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("spec");
  const [selected, setSelected] = useState<string>();
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
        {tab === "spec" && <SpecEditor project={project} run={run} />}
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
            <ConceptDetails info={concept} onCustomize={onCustomize} />
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
  const item = (c: ConceptInfo, label: string, nested = false) => (
    <li key={c.concept}>
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
                return [
                  item(c, name),
                  ...fields.map((f) => item(f, f.concept.split(".")[1] ?? "", true)),
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
}: {
  info: ConceptInfo;
  onCustomize: (page: string) => void;
}) {
  const page = info.concept.startsWith("page:") ? info.concept.slice(5) : undefined;
  const customized = info.files.some((f) => f.path.startsWith("src/custom/pages/"));
  return (
    <div className="space-y-3 p-3 text-sm">
      <p className="font-mono text-xs text-neutral-500">{info.concept}</p>
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

function SpecEditor({ project, run }: { project: Project; run: Run }) {
  const saved = project.files.spec ?? "";
  const [text, setText] = useState(saved);
  useEffect(() => setText(saved), [saved]);
  // Checked in the tab, as you type: the same validator the CLI uses.
  const { diagnostics } = useMemo(() => readSpec(project.files, text), [project.files, text]);
  const errors = diagnostics.filter((d) => d.severity === "error");
  return (
    <div className="flex h-full flex-col">
      <textarea
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
      <Label text="Operation" hint={op?.summary}>
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
      {Object.entries(properties).map(([key, schema]) => (
        <Label
          key={key}
          text={`${key}${(op?.schema.required as string[] | undefined)?.includes(key) ? " *" : ""}`}
          hint={[
            schema.description,
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
