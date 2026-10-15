// "What it does" from the spec (docs/design/what-it-does.md §2, step 2): every file's every key
// as its control, labelled by the schema, showing the value written and changing it. A change is
// one operation: editSpec with the key's path (the specific operations come per key next), so
// it is checked as a whole, refused in the validator's words, and taken back by undo.
import {
  buildJsonSchema,
  COMPANION_SCHEMAS,
  type EditableFile,
  type JsonSchema,
} from "@smithable/core";
import { createContext, useContext, useMemo, useState } from "react";
import { parse } from "yaml";
import type { Project } from "../api";
import { cx } from "../ui";
import type { Run } from "./ChangeForms";
import { alternativeFor, controlOf, labelOf, operationFor } from "./spec-form";

const FILES: [Exclude<keyof Project["files"], "translations">, EditableFile, string][] = [
  ["spec", "smithable.yml", "What the app does"],
  ["auth", "smithable.auth.yml", "Sign-in and access"],
  ["ux", "smithable.ux.yml", "The look"],
  ["content", "smithable.content.yml", "The texts"],
  ["context", "smithable.context.yml", "How it is built"],
];

const read = (text: string | undefined): unknown => {
  try {
    return text ? parse(text) : undefined;
  } catch {
    return undefined;
  }
};

type Path = (string | number)[];

/** Writes one key: through its own operation when it has one, else editSpec with its path. */
const writeKey = (run: Run, file: EditableFile, path: Path, value: unknown) => {
  const own = operationFor(file, path, value);
  return own
    ? run(own[0], own[1])
    : run("editSpec", { file, path, value: value === undefined ? null : value });
};
/** Writes a part of the file being shown: its path and the new value (undefined takes it away). */
const Writer = createContext<(path: Path, value: unknown) => Promise<boolean>>(async () => false);

export function SpecForm({ files, run }: { files: Project["files"]; run: Run }) {
  const schemas = useMemo(
    () =>
      ({ "smithable.yml": buildJsonSchema(), ...COMPANION_SCHEMAS }) as Record<string, JsonSchema>,
    [],
  );
  return (
    <div className="space-y-6 p-4 text-sm">
      <p className="rounded-md border border-dashed border-line p-2 text-xs text-quiet">
        Experimental: everything the spec can say, as a form. A change is checked like any other and
        Undo takes it back.
      </p>
      {FILES.map(([key, file, title]) => {
        const schema = schemas[file];
        if (!schema || (key !== "spec" && files[key] === undefined)) return null;
        const write = (path: Path, value: unknown) => writeKey(run, file, path, value);
        return (
          <section key={file} aria-label={title}>
            <h2 className="mb-2 border-b border-line pb-1 text-xs font-semibold tracking-wide text-quiet uppercase">
              {title} <span className="font-normal normal-case">({file})</span>
            </h2>
            <Writer.Provider value={write}>
              <Value schema={schema} value={read(files[key])} path={[]} />
            </Writer.Provider>
          </section>
        );
      })}
    </div>
  );
}

const box = "block h-7 w-full rounded-md border border-line bg-panel px-2 text-sm text-fg";

/** A value under its schema: its control, filled with what the file says, writing at `path`. */
function Value({ schema, value, path }: { schema: JsonSchema; value: unknown; path: Path }) {
  const write = useContext(Writer);
  const control = controlOf(schema);
  if (!control) return <code className="text-xs">{JSON.stringify(value)}</code>;
  const label = String(path.at(-1) ?? "");
  switch (control.kind) {
    case "alternatives": {
      const chosen = alternativeFor(control.options, value);
      return chosen ? (
        <Value schema={chosen} value={value} path={path} />
      ) : (
        <code className="text-xs">{JSON.stringify(value)}</code>
      );
    }
    case "choice":
      return (
        <select
          aria-label={label}
          value={value === undefined ? "" : String(value)}
          onChange={(e) => void write(path, e.target.value === "" ? undefined : e.target.value)}
          className={box}
        >
          <option value="">Not set</option>
          {control.values.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      );
    case "check":
      return (
        <input
          type="checkbox"
          aria-label={label}
          checked={value === true}
          onChange={(e) => void write(path, e.target.checked)}
        />
      );
    case "number":
    case "text":
      return (
        <TextBox
          label={label}
          value={value}
          numeric={control.kind === "number"}
          onCommit={(next) => write(path, next)}
        />
      );
    case "fixed":
      return <span className="text-muted">{String(control.value)}</span>;
    case "nothing":
      return <span className="text-quiet">Nothing more</span>;
    case "list": {
      const items = Array.isArray(value) ? value : [];
      const simple = ["choice", "text", "number", "fixed"].includes(
        controlOf(control.items)?.kind ?? "",
      );
      return simple ? (
        <Chips
          label={label}
          items={items}
          onChange={(next) => write(path, next.length ? next : undefined)}
        />
      ) : (
        <ol className="space-y-2">
          {items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a list's items are by their place
            <li key={i} className="rounded-md border border-line p-2">
              <Value schema={control.items} value={item} path={[...path, i]} />
            </li>
          ))}
          {!items.length && <li className="text-xs text-quiet">None</li>}
        </ol>
      );
    }
    case "entries": {
      const entries = Object.entries((value ?? {}) as Record<string, unknown>);
      return (
        <div className="space-y-1">
          {entries.map(([name, v]) => (
            <details key={name} className="rounded-md border border-line" open={path.length === 0}>
              <summary className="cursor-pointer px-2 py-1 font-medium">{name}</summary>
              <div className="border-t border-line p-2">
                <Value schema={control.entry} value={v} path={[...path, name]} />
              </div>
            </details>
          ))}
          <AddEntry label={label} onAdd={(name) => write([...path, name], {})} />
        </div>
      );
    }
    case "group": {
      const own = (value ?? {}) as Record<string, unknown>;
      const set = control.keys.filter(([key]) => own[key] !== undefined);
      const unset = control.keys.filter(([key]) => own[key] === undefined);
      // A group of kinds (a page) names the kind it is: chosen when it was added, then fixed.
      const kind = control.kinds?.find((k) => own[k] !== undefined);
      return (
        <div className="space-y-2">
          {control.kinds && (
            <p className="text-xs text-muted">
              Kind: <span className="font-medium">{kind ?? "not chosen"}</span>
            </p>
          )}
          {set.map(([key, s]) => (
            <Key key={key} name={key} schema={s} value={own[key]} path={[...path, key]} />
          ))}
          {unset.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-quiet">
                Not set: {unset.length} more
              </summary>
              <div className="mt-2 space-y-2">
                {unset.map(([key, s]) => (
                  <Key key={key} name={key} schema={s} value={undefined} path={[...path, key]} />
                ))}
              </div>
            </details>
          )}
        </div>
      );
    }
  }
}

/** A text or number, written when the box is left or Enter is pressed; empty takes it away. */
function TextBox({
  label,
  value,
  numeric,
  onCommit,
}: {
  label: string;
  value: unknown;
  numeric: boolean;
  onCommit: (value: unknown) => Promise<boolean>;
}) {
  const shown =
    value === undefined ? "" : typeof value === "string" ? value : JSON.stringify(value);
  const [text, setText] = useState(shown);
  const commit = () => {
    if (text === shown) return;
    const trimmed = text.trim();
    const next =
      trimmed === ""
        ? undefined
        : numeric && !Number.isNaN(Number(trimmed))
          ? Number(trimmed)
          : trimmed;
    void onCommit(next).then((ok) => {
      if (!ok) setText(shown);
    });
  };
  return (
    <input
      aria-label={label}
      className={box}
      value={text}
      placeholder="Not set"
      inputMode={numeric ? "numeric" : undefined}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
    />
  );
}

/** A list of plain values as chips: × takes one away, the box adds one. */
function Chips({
  label,
  items,
  onChange,
}: {
  label: string;
  items: unknown[];
  onChange: (items: unknown[]) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map((item, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a list may hold one value twice
          key={`${i}:${String(item)}`}
          className="inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-xs"
        >
          {typeof item === "string" ? item : JSON.stringify(item)}
          <button
            type="button"
            aria-label={`Remove ${String(item)}`}
            className="text-quiet hover:text-red-700"
            onClick={() => void onChange(items.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        aria-label={`Add to ${label}`}
        className="h-6 w-28 rounded-md border border-line bg-panel px-1.5 text-xs"
        placeholder="Add…"
        value={adding}
        onChange={(e) => setAdding(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !adding.trim()) return;
          void onChange([...items, adding.trim()]).then((ok) => ok && setAdding(""));
        }}
      />
    </div>
  );
}

/** A new entry of a named map (a kind of record, a page): its name, then its own keys. */
function AddEntry({ label, onAdd }: { label: string; onAdd: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  return (
    <div className="flex items-center gap-1">
      <input
        aria-label={`New entry in ${label}`}
        className="h-6 w-36 rounded-md border border-line bg-panel px-1.5 text-xs"
        placeholder="Name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        type="button"
        disabled={!name.trim()}
        className="text-xs font-medium text-accent disabled:opacity-50"
        onClick={() => void onAdd(name.trim()).then((ok) => ok && setName(""))}
      >
        Add
      </button>
    </div>
  );
}

/** One key: its label (the key's own name on hover), and its control. */
function Key({
  name,
  schema,
  value,
  path,
}: {
  name: string;
  schema: JsonSchema;
  value: unknown;
  path: Path;
}) {
  const nested = ["group", "entries", "list"].includes(controlOf(schema)?.kind ?? "");
  return (
    <div className={cx(nested && "rounded-md border border-line p-2")} data-key={name}>
      <p
        className="mb-1 text-xs font-medium"
        title={`${name}: ${String(schema.description ?? "")}`}
      >
        {labelOf(name, schema)}
      </p>
      <Value schema={schema} value={value} path={path} />
    </div>
  );
}

/** The schema of the part at `path`, walking groups, entries, lists and the value's alternative. */
function schemaAt(root: JsonSchema, value: unknown, path: Path): JsonSchema | undefined {
  let schema: JsonSchema | undefined = root;
  let here = value;
  for (const step of path) {
    if (!schema) return undefined;
    let control = controlOf(schema);
    if (control?.kind === "alternatives") {
      schema = alternativeFor(control.options, here);
      control = schema && controlOf(schema);
    }
    schema =
      control?.kind === "group"
        ? control.keys.find(([key]) => key === step)?.[1]
        : control?.kind === "entries"
          ? control.entry
          : control?.kind === "list"
            ? control.items
            : undefined;
    here = (here as Record<string | number, unknown> | undefined)?.[step];
  }
  return schema;
}

/**
 * One part of a file as its form (what-it-does.md §5 step 3): a field, a kind of record, a page or
 * an action, shown in its properties under "All settings", each key writing as in the tab.
 */
export function SpecPart({
  files,
  run,
  path,
  file = "smithable.yml",
}: {
  files: Project["files"];
  run: Run;
  path: Path;
  file?: EditableFile;
}) {
  const entry = FILES.find(([, name]) => name === file);
  const root = file === "smithable.yml" ? buildJsonSchema() : COMPANION_SCHEMAS[file];
  const whole = entry ? read(files[entry[0]]) : undefined;
  const schema = root && schemaAt(root, whole, path);
  if (!schema) return null;
  let value = whole;
  for (const step of path) value = (value as Record<string | number, unknown> | undefined)?.[step];
  const write = (at: Path, next: unknown) => writeKey(run, file, at, next);
  return (
    <Writer.Provider value={write}>
      <Value schema={schema} value={value} path={path} />
    </Writer.Provider>
  );
}
