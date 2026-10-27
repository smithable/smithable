// "What it does" from the spec (docs/design/what-it-does.md §2, step 2): every file's every key
// as its control, labelled by the schema, showing the value written and changing it. A change is
// one operation: editSpec with the key's path (the specific operations come per key next), so
// it is checked as a whole, refused in the validator's words, and taken back by undo.
import {
  buildJsonSchema,
  COMPANION_SCHEMAS,
  type EditableFile,
  type JsonSchema,
  type SpecIR,
} from "@smithable/core";
import { createContext, useContext, useId, useMemo, useState } from "react";
import { parse } from "yaml";
import type { Project } from "../api";
import { cx } from "../ui";
import { FieldShapeForm, type Run } from "./ChangeForms";
import {
  alternativeFor,
  choicesFor,
  controlOf,
  entryHeading,
  labelOf,
  operationFor,
  renameFor,
  wordOrList,
} from "./spec-form";

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
/**
 * A field's type (its short form, or type: in its long form) as the field's own control: the
 * kind, required, unique, a choice's values, through changeField. Undefined for any other key,
 * a calculated field and a list of related records, which keep the plain text.
 */
const Shape = createContext<(path: Path) => React.ReactNode>(() => undefined);
const shapeOf = (run: Run, file: EditableFile, ir: SpecIR | undefined) => (path: Path) => {
  const [first, model, third, name, key] = path;
  if (file !== "smithable.yml" || !ir || first !== "models" || third !== "fields") return undefined;
  if (!(path.length === 4 || (path.length === 5 && key === "type"))) return undefined;
  const field = ir.models.find((m) => m.name === model)?.fields.find((f) => f.name === name);
  if (!field || field.formula || (field.type.kind === "relation" && field.type.many))
    return undefined;
  return (
    <FieldShapeForm
      key={`${String(model)}.${String(name)}`}
      field={field}
      models={ir.models.map((m) => m.name)}
      run={(type, renames) =>
        run("changeField", {
          model: String(model),
          field: String(name),
          type,
          ...(renames.length ? { renames } : {}),
        })
      }
      rule={(unique) => run("setFieldRules", { model: String(model), field: String(name), unique })}
    />
  );
};

/** Renames the entry at a path through its operation; undefined where there is none. */
const Renamer = createContext<(path: Path) => ((to: string) => Promise<boolean>) | undefined>(
  () => undefined,
);
const renamerOf = (run: Run, file: EditableFile) => (path: Path) => {
  const op = (to: string) => renameFor(file, path, to);
  return op(" ")
    ? (to: string) => run(...(op(to) as [string, Record<string, unknown>]))
    : undefined;
};
/** The names a list at a path offers (a role's pages, kinds of record, actions); none for most. */
const Choices = createContext<(path: Path) => string[]>(() => []);
const choicesOf = (files: Project["files"], file: EditableFile) => {
  const spec = read(files.spec);
  return (path: Path) => choicesFor(file, path, spec);
};

/** An area's own way of adding (the creation wizard), by its path; the plain name box for most. */
const Adder = createContext<(path: Path) => React.ReactNode>(() => undefined);
/** What an entry can do beyond its settings (EntryTools.tsx), by its path; nothing for most. */
const Tools = createContext<(path: Path) => React.ReactNode>(() => undefined);

/** The part asked to be shown (a kind of record, a field picked in the preview): open down to it. */
const Opened = createContext<Path | undefined>(undefined);
/** Whether the file is the content file, whose entries are named by other files (A 168). */
const InContent = createContext(false);
const leadsTo = (path: Path, target: Path | undefined) =>
  target !== undefined && path.length <= target.length && path.every((p, i) => p === target[i]);

/**
 * The spec's files as a form from their schemas. `parts` are the files shown: Behavior shows
 * the spec, Content the content file (docs/design/studio-v3.md §1, §5); `open` opens the form
 * down to one part.
 */
/** The companion files' format version keys, never shown in a form. */
const COMPANION_VERSIONS = ["smithableAuth", "smithableUx", "smithableContent", "smithableContext"];

export function SpecForm({
  files,
  run,
  ir,
  parts = ["spec"],
  open,
  tools,
  adder,
}: {
  files: Project["files"];
  run: Run;
  ir?: SpecIR;
  parts?: Exclude<keyof Project["files"], "translations">[];
  open?: Path;
  /** What an entry can do beyond its settings (an import, a page's own code). */
  tools?: (path: Path) => React.ReactNode;
  /** An area's own way of adding instead of the name box (the creation wizard). */
  adder?: (path: Path) => React.ReactNode;
}) {
  const schemas = useMemo(
    () => ({ "smithable.yml": specSchema(), ...COMPANION_SCHEMAS }) as Record<string, JsonSchema>,
    [],
  );
  return (
    <div className="space-y-6 p-4 text-sm">
      {FILES.map(([key, file, title]) => {
        const schema = schemas[file];
        if (!schema || !parts.includes(key) || (key !== "spec" && files[key] === undefined))
          return null;
        const write = (path: Path, value: unknown) => writeKey(run, file, path, value);
        return (
          <section key={file} aria-label={title}>
            <h2 className="mb-2 border-b border-line pb-1 text-xs font-semibold tracking-wide text-quiet uppercase">
              {title} <span className="font-normal normal-case">({file})</span>
            </h2>
            <Writer.Provider value={write}>
              <Choices.Provider value={choicesOf(files, file)}>
                <Renamer.Provider value={renamerOf(run, file)}>
                  <Shape.Provider value={shapeOf(run, file, ir)}>
                    <Opened.Provider value={open}>
                      <Tools.Provider value={tools ?? (() => undefined)}>
                        <Adder.Provider value={adder ?? (() => undefined)}>
                          <InContent.Provider value={key === "content"}>
                            <Value schema={schema} value={read(files[key])} path={[]} />
                          </InContent.Provider>
                        </Adder.Provider>
                      </Tools.Provider>
                    </Opened.Provider>
                  </Shape.Provider>
                </Renamer.Provider>
              </Choices.Provider>
            </Writer.Provider>
          </section>
        );
      })}
    </div>
  );
}

const box = "block h-7 w-full rounded-md border border-line bg-panel px-2 text-sm text-fg";

/** The spec's areas by a short name and an icon (A 167); the description stays the tooltip. */
const AREAS: Record<string, { label: string; icon: string }> = {
  app: { label: "App", icon: "M4 5h16v14H4zM4 9h16" },
  models: {
    label: "Data",
    icon: "M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3Zm0 0v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3",
  },
  actions: { label: "Actions", icon: "M13 3 5 14h6l-1 7 8-11h-6l1-7Z" },
  pages: { label: "Pages", icon: "M7 3h7l4 4v14H7zM14 3v4h4" },
  navigation: { label: "Menus", icon: "M5 7h14M5 12h14M5 17h14" },
  // Every area has its own (Johan, 2026-10-27): a clock, a paper plane, a tray, a magnifier.
  timers: { label: "Timers", icon: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 1.5M10 2h4" },
  outgoing: { label: "Outgoing", icon: "M21 3 3 10.5l7 2.5 2.5 7L21 3ZM10 13l5-5" },
  incoming: { label: "Incoming", icon: "M3 13h5l2 3h4l2-3h5M5.5 5h13L21 13v6H3v-6l2.5-8Z" },
  queries: { label: "Queries", icon: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4" },
};

function AreaIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" aria-hidden="true">
      <path
        d={d}
        className="fill-none stroke-current"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A value under its schema: its control, filled with what the file says, writing at `path`. */
function Value({ schema, value, path }: { schema: JsonSchema; value: unknown; path: Path }) {
  const write = useContext(Writer);
  const choices = useContext(Choices);
  const renamer = useContext(Renamer);
  const opened = useContext(Opened);
  const inContent = useContext(InContent);
  const tools = useContext(Tools);
  const adder = useContext(Adder);
  const shaped = useContext(Shape)(path);
  if (shaped && (typeof value === "string" || value === undefined)) return shaped;
  const control = controlOf(schema);
  if (!control) return <code className="text-xs">{JSON.stringify(value)}</code>;
  const label = String(path.at(-1) ?? "");
  switch (control.kind) {
    case "alternatives": {
      const either = wordOrList(control.options);
      if (either) {
        const whole = value === either.word;
        return (
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                aria-label={`${label}: ${either.word}`}
                checked={whole}
                onChange={() => void write(path, whole ? undefined : either.word)}
              />
              {either.word}
            </label>
            {!whole && <Value schema={either.list} value={value} path={path} />}
          </div>
        );
      }
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
          placeholder={Array.isArray(schema.examples) ? String(schema.examples[0]) : undefined}
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
          choices={choices(path)}
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
            <details
              key={name}
              data-path={JSON.stringify([...path, name])}
              className="rounded-md border border-line"
              open={leadsTo([...path, name], opened) || undefined}
            >
              <summary className="cursor-pointer px-2 py-1 font-medium">
                {entryHeading(name, inContent)}
              </summary>
              <div className="space-y-2 border-t border-line p-2">
                <div className="flex flex-wrap items-center gap-2">
                  {renamer([...path, name]) && (
                    <Rename
                      name={name}
                      onRename={renamer([...path, name]) as (to: string) => Promise<boolean>}
                    />
                  )}
                  {/* Taken away through its own operation where it has one; a loss of data
                      asks first, as every change does. */}
                  {tools([...path, name])}
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    className="ml-auto h-6 rounded-md border border-line px-2 text-xs text-muted hover:text-red-700"
                    onClick={() => void write([...path, name], undefined)}
                  >
                    Remove
                  </button>
                </div>
                <Value schema={control.entry} value={v} path={[...path, name]} />
              </div>
            </details>
          ))}
          {adder(path) ?? <AddEntry label={label} onAdd={(name) => write([...path, name], {})} />}
        </div>
      );
    }
    case "group": {
      const own = (value ?? {}) as Record<string, unknown>;
      // A key the schema hides (the spec format version) is not shown, nor a companion file's
      // version line (smithableContent: 0.1 and the like).
      const shown = control.keys.filter(
        ([key, s]) => s["x-hidden"] !== true && !COMPANION_VERSIONS.includes(key),
      );
      const set = shown.filter(([key]) => own[key] !== undefined);
      const unset = shown.filter(([key]) => own[key] === undefined);
      // A group of kinds (a page) names the kind it is: chosen when it was added, then fixed.
      const kind = control.kinds?.find((k) => own[k] !== undefined);
      return (
        <div className="space-y-3">
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
  placeholder,
  onCommit,
}: {
  label: string;
  value: unknown;
  numeric: boolean;
  /** An example from the schema, else "Not set". */
  placeholder?: string;
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
      placeholder={placeholder ?? "Not set"}
      inputMode={numeric ? "numeric" : undefined}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
    />
  );
}

/** A list of plain values as chips: × takes one away, the box adds one (offering `choices`). */
function Chips({
  label,
  items,
  choices,
  onChange,
}: {
  label: string;
  items: unknown[];
  choices: string[];
  onChange: (items: unknown[]) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState("");
  const listId = useId();
  const offered = choices.filter((c) => !items.includes(c));
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
        list={offered.length ? listId : undefined}
        value={adding}
        onChange={(e) => setAdding(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !adding.trim()) return;
          void onChange([...items, adding.trim()]).then((ok) => ok && setAdding(""));
        }}
      />
      {offered.length > 0 && (
        <datalist id={listId}>
          {offered.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      )}
    </div>
  );
}

/** An entry's new name, renamed through its operation (a field keeps its data). */
function Rename({ name, onRename }: { name: string; onRename: (to: string) => Promise<boolean> }) {
  const [to, setTo] = useState(name);
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-quiet">Its name in the files:</span>
      <input
        aria-label={`New name for ${name}`}
        className="h-6 w-40 rounded-md border border-line bg-panel px-1.5 text-xs"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      <button
        type="button"
        className="h-6 rounded-md border border-line px-2 text-xs disabled:opacity-50"
        disabled={!to.trim() || to.trim() === name}
        onClick={() => void onRename(to.trim())}
      >
        Rename
      </button>
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
  const opened = useContext(Opened);
  // The areas of a file (the app, kinds of record, pages, menus…) are closed at first, as their
  // entries are, whatever the value's shape: the tab's own folding (A 167).
  if (path.length === 1 && (nested || AREAS[name]))
    return (
      <details
        className="rounded-md border border-line"
        data-key={name}
        data-path={JSON.stringify(path)}
        open={leadsTo(path, opened) || undefined}
      >
        <summary
          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium"
          title={typeof schema.description === "string" ? schema.description : undefined}
        >
          {AREAS[name] ? (
            <>
              <AreaIcon d={AREAS[name].icon} />
              {schema.title ? labelOf(name, schema) : AREAS[name].label}
            </>
          ) : (
            labelOf(name, schema)
          )}
        </summary>
        <div className="border-t border-line p-3">
          <Value schema={schema} value={value} path={path} />
        </div>
      </details>
    );
  return (
    <div className={cx(nested && "rounded-md border border-line p-2")} data-key={name}>
      {/* The label in words, the description as its tooltip, and where a text a model reads is
          explained, the docs page (opens in a new tab). */}
      <p
        className="mb-1 text-xs font-medium"
        title={typeof schema.description === "string" ? schema.description : undefined}
      >
        {labelOf(name, schema)}
        {typeof schema["x-docs"] === "string" && (
          <a
            href={schema["x-docs"]}
            target="_blank"
            rel="noreferrer"
            className="ml-2 font-normal text-accent underline"
          >
            What this is for
          </a>
        )}
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

/** The spec's JSON Schema: the same for every part, so made once. */
let builtSchema: JsonSchema | undefined;
const specSchema = () => {
  builtSchema ??= buildJsonSchema() as JsonSchema;
  return builtSchema;
};

/**
 * One part of a file as its form (what-it-does.md §5 step 3): a field, a kind of record, a page or
 * an action, shown in its properties under "All settings", each key writing as in the tab.
 */
export function SpecPart({
  files,
  run,
  path,
  file = "smithable.yml",
  ir,
}: {
  files: Project["files"];
  run: Run;
  path: Path;
  file?: EditableFile;
  ir?: SpecIR;
}) {
  const entry = FILES.find(([, name]) => name === file);
  const root = file === "smithable.yml" ? specSchema() : COMPANION_SCHEMAS[file];
  const text = entry ? files[entry[0]] : undefined;
  // Read again only when the file's text changes, not on every render.
  const whole = useMemo(() => (entry ? read(text) : undefined), [entry, text]);
  const schema = root && schemaAt(root, whole, path);
  if (!schema) return null;
  let value = whole;
  for (const step of path) value = (value as Record<string | number, unknown> | undefined)?.[step];
  const write = (at: Path, next: unknown) => writeKey(run, file, at, next);
  return (
    <Writer.Provider value={write}>
      <Choices.Provider value={choicesOf(files, file)}>
        <Renamer.Provider value={renamerOf(run, file)}>
          <Shape.Provider value={shapeOf(run, file, ir)}>
            <Value schema={schema} value={value} path={path} />
          </Shape.Provider>
        </Renamer.Provider>
      </Choices.Provider>
    </Writer.Provider>
  );
}
