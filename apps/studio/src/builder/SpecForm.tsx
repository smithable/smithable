// "What it does" from the spec (docs/design/what-it-does.md §2, step 2): every file's every key
// as its control, labelled by the schema, showing the value written and changing it. A change is
// one operation: editSpec with the key's path (the specific operations come per key next), so
// it is checked as a whole, refused in the validator's words, and taken back by undo.
import {
  buildJsonSchema,
  COMPANION_SCHEMAS,
  type EditableFile,
  humanize,
  type JsonSchema,
  type SpecIR,
  validateAuth,
} from "@smithable/core";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { parse } from "yaml";
import type { Project } from "../api";
import { HelpMark, type HelpTopic } from "../help";
import { cx } from "../ui";
import { CopyPicker, MergePicker, SplitPicker } from "./action-pickers";
import { ActionRowsEditor } from "./action-rows";
import { AreaIcon } from "./areas";
import { FieldShapeForm, type Run } from "./ChangeForms";
import { ConditionRows } from "./ConditionRows";
import { conditionContext, conditionTreeReady } from "./condition-paths";
import { DateSetting } from "./DateExpression";
import { dateControl, dateTreeReady } from "./date-expression";
import { NumberBox } from "./NumberBox";
import { usePendingEdit } from "./pending-edit";
import { ReferencePicker } from "./ReferencePicker";
import { type CreateReference, ReferenceCreation } from "./reference-creation";

export type { CreateReference } from "./reference-creation";

import type { ReferenceOption } from "./reference-options";
import {
  referenceAt,
  referenceControl,
  referenceGroup,
  referenceKeys,
  referenceReady,
  referenceWith,
} from "./reference-paths";
import {
  alternativeFor,
  choicesFor,
  controlOf,
  entryHeading,
  finiteAlternatives,
  isRuleList,
  labelOf,
  numberLimits,
  operationFor,
  renameFor,
  semanticDraftReady,
  wordOrList,
} from "./spec-form";
import { TimerForm } from "./TimerForm";

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
const References = createContext<
  | {
      document: unknown;
      ir: SpecIR;
      auth?: ReturnType<typeof validateAuth>["auth"];
      create?: CreateReference;
    }
  | undefined
>(undefined);

/** Writes one key: through its own operation when it has one, else editSpec with its path. */
const writeKey = (run: Run, file: EditableFile, path: Path, value: unknown, whole?: unknown) => {
  const own = operationFor(file, path, value, whole);
  return own
    ? run(own[0], own[1])
    : run("editSpec", { file, path, value: value === undefined ? null : value });
};
/** Writes a part of the file being shown: its path and the new value (undefined takes it away). */
const Writer = createContext<(path: Path, value: unknown) => Promise<boolean>>(async () => false);
const InDraft = createContext(false);
/**
 * A field's type (its short form, or type: in its long form) as the field's own control: the
 * kind, required, unique, a choice's values, through changeField. Undefined for any other key,
 * a calculated field and a list of related records, which keep the plain text.
 */
const Shape = createContext<(path: Path, value?: unknown) => React.ReactNode>(() => undefined);
const Omitted = createContext<string[]>([]);
const shapeOf =
  (run: Run, file: EditableFile, ir: SpecIR | undefined) => (path: Path, value?: unknown) => {
    const [first, model, third, name, key] = path;
    if (file === "smithable.yml" && ir && first === "timers" && path.length === 2) {
      const timer = ir.timers.find((item) => item.name === model);
      if (timer) return <TimerForm key={JSON.stringify(value)} timer={timer} ir={ir} run={run} />;
    }
    // A standard action's condition and values as rows of controls (A 203), in place of its
    // settings as text; a merge, split, copy or custom action keeps the text for now.
    if (file === "smithable.yml" && ir && first === "actions" && path.length === 2) {
      const action = ir.actions.find((a) => a.name === model);
      if (!action || action.custom) return undefined;
      const on = ir.models.find((m) => m.name === action.on);
      // A merge, a split and a copy: their own pickers, each key written at its path as the spec has
      // it (A 206); editSpec adds a key the action has not written yet, its comments kept.
      const written = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
      // Taking away a key the action never wrote is nothing to do.
      const write = (key: string, next: unknown) =>
        next === undefined && !(key in written)
          ? Promise.resolve(true)
          : run("editSpec", {
              file: "smithable.yml",
              path: ["actions", String(model), key],
              value: next === undefined ? null : next,
            });
      const intro = (
        <p className="text-xs text-muted">
          On each {humanize(action.on).toLowerCase()}
          {action.intent ? `: ${action.intent}` : ""}
        </p>
      );
      if (action.merge)
        return (
          <div className="space-y-3">
            {intro}
            <MergePicker
              key={JSON.stringify(action.merge.fields)}
              model={on}
              into={action.merge.into}
              fields={action.merge.fields}
              write={write}
            />
          </div>
        );
      if (action.split)
        return (
          <div className="space-y-3">
            {intro}
            <SplitPicker
              key={JSON.stringify(action.split)}
              model={on}
              move={action.split.move}
              copy={action.split.copy}
              write={write}
            />
          </div>
        );
      if (action.copy)
        return (
          <div className="space-y-3">
            {intro}
            <CopyPicker
              key={JSON.stringify(action.copy)}
              model={on}
              copy={action.copy}
              lists={action.with ?? []}
              write={write}
              help={<HelpMark topic="formula" />}
            />
          </div>
        );
      // What the rows do not hold (who sees it, its add, its look…), shown as written.
      const { on: _on, when: _when, set: _set, intent: _intent, ...rest } = written;
      const rulesSchema = schemaAt(specSchema(), { actions: { [String(model)]: written } }, [
        "actions",
        String(model),
        "rules",
      ]);
      if (rulesSchema) delete rest.rules;
      const save = (part: "when" | "set") => (value: unknown) =>
        run("setAction", { action: String(model), [part]: value });
      const help = (topic: "condition" | "formula") => <HelpMark topic={topic} />;
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            On each {humanize(action.on).toLowerCase()}
            {action.intent ? `: ${action.intent}` : ""}
          </p>
          <div className="space-y-1">
            <p className="text-xs font-medium">It sets</p>
            <ActionRowsEditor
              // Each part made anew when it changes in the file, so the other keeps what is typed.
              key={`set:${JSON.stringify(action.set)}`}
              part="set"
              model={on}
              set={action.set}
              onSave={save("set")}
              help={help}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">For records with</p>
            <ActionRowsEditor
              key={`when:${JSON.stringify(action.when ?? null)}`}
              part="when"
              model={on}
              {...(action.when ? { when: action.when } : {})}
              onSave={save("when")}
              help={help}
            />
          </div>
          {rulesSchema && (
            <div className="space-y-1" data-key="rules">
              <p className="text-xs font-medium">Rules</p>
              <Value
                schema={rulesSchema}
                value={written.rules}
                path={["actions", String(model), "rules"]}
              />
            </div>
          )}
          {Object.keys(rest).length > 0 && (
            <code className="block text-xs text-quiet">{JSON.stringify(rest)}</code>
          )}
        </div>
      );
    }
    if (file !== "smithable.yml" || !ir || first !== "models" || third !== "fields")
      return undefined;
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
        rule={(unique) =>
          run("setFieldRules", { model: String(model), field: String(name), unique })
        }
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
/** Entries with a dedicated editor beside the form. */
const OmitEntry = createContext<(path: Path) => boolean>(() => false);
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
  omit = [],
  omitEntry,
  createReference,
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
  /** Root settings that have a dedicated control beside this form. */
  omit?: string[];
  omitEntry?: (path: Path) => boolean;
  createReference?: CreateReference;
}) {
  const hostedCreation = useContext(ReferenceCreation);
  const create = createReference ?? hostedCreation;
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
        const write = (path: Path, value: unknown) =>
          writeKey(run, file, path, value, read(files[key]));
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
                            <Omitted.Provider value={omit}>
                              <References.Provider
                                value={
                                  file === "smithable.yml" && ir
                                    ? {
                                        document: read(files[key]),
                                        ir,
                                        auth: validateAuth(
                                          {
                                            path: "smithable.auth.yml",
                                            text: files.auth ?? "smithableAuth: 0.1\n",
                                          },
                                          ir,
                                        ).auth,
                                        create,
                                      }
                                    : undefined
                                }
                              >
                                <OmitEntry.Provider value={omitEntry ?? (() => false)}>
                                  <Value schema={schema} value={read(files[key])} path={[]} />
                                </OmitEntry.Provider>
                              </References.Provider>
                            </Omitted.Provider>
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
export const AREAS: Record<string, { label: string; icon: string }> = {
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

/** A value under its schema: its control, filled with what the file says, writing at `path`. */
function Value({
  schema,
  value,
  path,
  drafted = false,
  variants = true,
  labelOverride,
}: {
  schema: JsonSchema;
  value: unknown;
  path: Path;
  drafted?: boolean;
  variants?: boolean;
  labelOverride?: string;
}) {
  const write = useContext(Writer);
  const choices = useContext(Choices);
  const renamer = useContext(Renamer);
  const opened = useContext(Opened);
  const inContent = useContext(InContent);
  const tools = useContext(Tools);
  const adder = useContext(Adder);
  const omitted = useContext(Omitted);
  const omitEntry = useContext(OmitEntry);
  const shaped = useContext(Shape)(path, value);
  const references = useContext(References);
  const inDraft = useContext(InDraft);
  const nextListKey = useRef(0);
  const listKeys = useRef<number[]>([]);
  const listCount = Array.isArray(value) ? value.length : 0;
  while (listKeys.current.length < listCount) listKeys.current.push(++nextListKey.current);
  listKeys.current.length = listCount;
  const latest = useRef({ write, value, path });
  latest.current = { write, value, path };
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  if (
    shaped &&
    (typeof value === "string" ||
      value === undefined ||
      path[0] === "actions" ||
      path[0] === "timers")
  )
    return shaped;
  const condition = references && conditionContext(path, references.document, references.ir);
  const rules = Boolean(references && isRuleList(schema));
  const date = references && dateControl(path, references.document, references.ir);
  if (references && !drafted && !inDraft && (referenceGroup(path) || condition || rules || date))
    return (
      <ReferenceDraft
        schema={schema}
        value={value}
        path={path}
        condition={Boolean(condition)}
        rules={rules}
      />
    );
  if (date) return <DateSetting value={value} control={date} write={(next) => write(path, next)} />;
  if (condition)
    return (
      <ConditionRows
        context={condition}
        value={value}
        onChange={(next) => void write(path, next)}
      />
    );
  if (references && variants && referenceVariant(path))
    return <ReferenceVariant schema={schema} value={value} path={path} />;
  const reference =
    references &&
    referenceControl(path, value, references.document, references.ir, references.auth);
  if (reference) {
    const label = String(path.at(-1) ?? "Reference");
    const parent = schemaAt(specSchema(), references.document, path.slice(0, -1));
    const parentControl = parent && controlOf(parent);
    const required =
      (Array.isArray(parent?.required) && parent.required.includes(label)) ||
      (parentControl?.kind === "group" &&
        Boolean(parentControl.kinds?.includes(label)) &&
        value !== undefined);
    const word = reference.word;
    return (
      <div className="space-y-2">
        {word && (
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              aria-label={`${label}: ${word}`}
              checked={value === word}
              onChange={() => void write(path, value === word ? undefined : word)}
            />
            {word}
          </label>
        )}
        {(!word || value !== word) && (
          <ReferencePicker
            label={label}
            options={reference.options}
            value={
              typeof value === "string" || Array.isArray(value)
                ? (value as string | string[])
                : undefined
            }
            multiple={reference.multiple}
            unset={required ? undefined : "Not set"}
            onChange={(next) =>
              write(
                path,
                reference.multiple &&
                  Array.isArray(next) &&
                  !next.length &&
                  !required &&
                  path[0] !== "navigation"
                  ? undefined
                  : next,
              )
            }
            create={
              reference.create && references.create
                ? {
                    label: `New ${reference.create}…`,
                    open: () => {
                      const requestedPath = JSON.stringify(path);
                      void (
                        reference.create && references.create
                          ? references.create(reference.create)
                          : Promise.resolve(undefined)
                      ).then((name) => {
                        const current = latest.current;
                        if (
                          name &&
                          mounted.current &&
                          JSON.stringify(current.path) === requestedPath
                        )
                          void current.write(
                            current.path,
                            reference.multiple
                              ? [
                                  ...new Set([
                                    ...(Array.isArray(current.value)
                                      ? current.value
                                      : typeof current.value === "string"
                                        ? [current.value]
                                        : []),
                                    name,
                                  ]),
                                ]
                              : name,
                          );
                      });
                    },
                  }
                : undefined
            }
          />
        )}
      </div>
    );
  }
  const control = controlOf(schema);
  if (!control) return <code className="text-xs">{JSON.stringify(value)}</code>;
  const label = labelOverride ?? String(path.at(-1) ?? "");
  switch (control.kind) {
    case "alternatives": {
      const finite = references && finiteAlternatives(control.options);
      if (finite) {
        const selected = value === undefined ? "" : JSON.stringify(value);
        return (
          <select
            aria-label={label}
            className={box}
            value={selected}
            onChange={(event) =>
              void write(
                path,
                event.target.value === "" ? undefined : JSON.parse(event.target.value),
              )
            }
          >
            <option value="">Not set</option>
            {value !== undefined && !finite.some((item) => JSON.stringify(item) === selected) && (
              <option value={selected}>Saved: {String(value)}</option>
            )}
            {finite.map((item) => (
              <option key={JSON.stringify(item)} value={JSON.stringify(item)}>
                {typeof item === "boolean" ? (item ? "Yes" : "No") : String(item)}
              </option>
            ))}
          </select>
        );
      }
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
        <Value schema={chosen} value={value} path={path} labelOverride={labelOverride} />
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
          {/* A choice with examples (the app's formats) shows each value as it reads, and what
              unset means: the default and why (formats.md §4). */}
          <option value="">
            {typeof schema["x-unset"] === "string" ? `Not set: ${schema["x-unset"]}` : "Not set"}
          </option>
          {control.values.map((v) => {
            const example = (schema["x-examples"] as Record<string, string> | undefined)?.[v];
            return (
              <option key={v} value={v}>
                {example ? `${v} · ${example}` : v}
              </option>
            );
          })}
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
      if (control.kind === "number" && references)
        return (
          <NumberBox
            label={label}
            value={value}
            {...numberLimits(schema, path, references.document)}
            onCommit={(next) => write(path, next)}
            {...(inDraft
              ? {
                  onDraft: (next: unknown) => {
                    void write(path, next);
                  },
                }
              : {})}
          />
        );
      return (
        <TextBox
          label={label}
          value={value}
          placeholder={Array.isArray(schema.examples) ? String(schema.examples[0]) : undefined}
          suggestions={
            schema["x-suggest"] === "time-zones" ? Intl.supportedValuesOf("timeZone") : undefined
          }
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
      const unique = path[0] === "models" && path[2] === "unique" && path.length === 3;
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
            <li key={rules ? listKeys.current[i] : i} className="rounded-md border border-line p-2">
              <Value
                schema={control.items}
                value={item}
                path={[...path, i]}
                labelOverride={rules ? `Rule ${i + 1}` : undefined}
              />
              {(unique || rules) && (
                <button
                  type="button"
                  className="text-xs underline"
                  aria-label={`Remove ${unique ? "unique " : ""}rule ${i + 1}`}
                  onClick={() => {
                    if (rules) listKeys.current.splice(i, 1);
                    const next = items.filter((_, index) => index !== i);
                    void write(path, next.length ? next : undefined);
                  }}
                >
                  Remove rule
                </button>
              )}
            </li>
          ))}
          {!items.length && <li className="text-xs text-quiet">None</li>}
          {unique && (
            <li>
              <button
                type="button"
                className="text-xs underline"
                onClick={() => void write(path, [...items, []])}
              >
                Add unique rule
              </button>
            </li>
          )}
          {rules && (
            <li>
              <button
                type="button"
                className="text-xs underline"
                onClick={() => void write(path, [...items, ""])}
              >
                Add a rule
              </button>
            </li>
          )}
        </ol>
      );
    }
    case "entries": {
      const entries = Object.entries((value ?? {}) as Record<string, unknown>);
      const visibleEntries = entries.filter(([name]) => !omitEntry([...path, name]));
      const keys = references && referenceKeys(path, references.document, references.ir);
      return (
        <div className="space-y-1">
          {visibleEntries.map(([name, v]) => (
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
          {keys ? (
            <ReferenceKeyAdd
              label={label}
              options={keys.filter((option) => !entries.some(([name]) => name === option.value))}
              onAdd={(name, value) => write([...path, name], value)}
              valueOptions={
                path[0] === "pages" && path[2] === "period" && references
                  ? (name) =>
                      referenceControl(
                        [...path, name],
                        undefined,
                        references.document,
                        references.ir,
                        references.auth,
                      )?.options ?? []
                  : undefined
              }
            />
          ) : (
            (adder(path) ?? <AddEntry label={label} onAdd={(name) => write([...path, name], {})} />)
          )}
        </div>
      );
    }
    case "group": {
      const own = (value ?? {}) as Record<string, unknown>;
      // A key the schema hides (the spec format version) is not shown, nor a companion file's
      // version line (smithableContent: 0.1 and the like).
      const shown = control.keys.filter(
        ([key, s]) =>
          s["x-hidden"] !== true &&
          !COMPANION_VERSIONS.includes(key) &&
          (path.length > 0 || !omitted.includes(key)),
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

function referenceVariant(path: Path) {
  return (
    (path[0] === "models" &&
      ((path.length === 4 && path[2] === "capacity" && path[3] === "max") ||
        (path.length === 4 && path[2] === "schedule" && path[3] === "away"))) ||
    (path[0] === "pages" &&
      path.length === 3 &&
      ["calendar", "articles", "period"].includes(String(path[2]))) ||
    (path[0] === "outgoing" && path.length === 3 && path[2] === "to")
  );
}

/** The grammar's scalar/object and literal/reference alternatives remain explicit local choices. */
function ReferenceVariant({
  schema,
  value,
  path,
}: {
  schema: JsonSchema;
  value: unknown;
  path: Path;
}) {
  const write = useContext(Writer);
  const references = useContext(References);
  const capacity = path[0] === "models" && path[2] === "capacity";
  const channels = path[0] === "outgoing";
  const period = path[0] === "pages" && path[2] === "period";
  const initial = capacity
    ? typeof value === "string"
      ? "reference"
      : "literal"
    : channels
      ? typeof value === "string" && !["mail", "push", "sms"].includes(value)
        ? "target"
        : "channels"
      : value && typeof value === "object"
        ? "detailed"
        : "short";
  const [mode, setMode] = useState(initial);
  const current = JSON.stringify(value);
  const [seen, setSeen] = useState(current);
  if (current !== seen) {
    setSeen(current);
    // An empty value is also the intermediate state of an explicit format change.
    if (value !== undefined) setMode(initial);
  }
  const modes = capacity
    ? [
        ["literal", "Fixed number"],
        ["reference", "A referenced field"],
      ]
    : channels
      ? [
          ["channels", "Built-in channels"],
          ["target", "A named target"],
        ]
      : period
        ? [
            ["short", "One field for every model"],
            ["detailed", "A field per model"],
          ]
        : [
            ["short", "Model only"],
            ["detailed", "Choose model and fields"],
          ];
  const label = String(path.at(-1));
  return (
    <fieldset className="space-y-2">
      <label className="block text-xs">
        {label} format
        <select
          className={box}
          aria-label={`${label} format`}
          value={mode}
          onChange={(event) => {
            const next = event.target.value;
            setMode(next);
            if (channels && references) {
              let parent = referenceWith(
                referenceAt(references.document, path.slice(0, -1)),
                ["to"],
                next === "target" ? "" : [],
              );
              if (next === "target") parent = referenceWith(parent, ["recipient"], undefined);
              void write(path.slice(0, -1), parent);
            } else if (capacity) void write(path, next === "reference" ? "" : 1);
            else if (period) void write(path, next === "detailed" ? {} : undefined);
            else
              void write(
                path,
                next === "detailed"
                  ? { model: typeof value === "string" ? value : "" }
                  : value && typeof value === "object"
                    ? (value as Record<string, unknown>).model
                    : undefined,
              );
          }}
        >
          {modes.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {capacity && mode === "literal" ? (
        <input
          type="number"
          min={1}
          step={1}
          className={box}
          aria-label="Maximum records"
          value={typeof value === "number" ? value : ""}
          onChange={(event) =>
            void write(path, event.target.value === "" ? undefined : Number(event.target.value))
          }
        />
      ) : channels ? (
        mode === "target" ? (
          <TextBox
            label="Target name"
            numeric={false}
            value={value}
            onCommit={(next) => write(path, next)}
          />
        ) : (
          <ReferencePicker
            label="Channels"
            options={["mail", "push", "sms"].map((value) => ({ value, label: value }))}
            value={
              Array.isArray(value)
                ? value
                : typeof value === "string" && ["mail", "push", "sms"].includes(value)
                  ? [value]
                  : []
            }
            multiple
            onChange={(next) => write(path, next)}
          />
        )
      ) : mode === "detailed" ? (
        <Value
          schema={
            controlOf(schema)?.kind === "alternatives"
              ? (((schema.oneOf ?? schema.anyOf) as JsonSchema[] | undefined)?.find(
                  (item: JsonSchema) => item.type === "object",
                ) ?? schema)
              : schema
          }
          value={value ?? {}}
          path={path}
          variants={false}
        />
      ) : capacity && references ? (
        <ReferencePicker
          label="Maximum field"
          options={
            referenceControl(path, "", references.document, references.ir, references.auth)
              ?.options ?? []
          }
          value={typeof value === "string" ? value : undefined}
          onChange={(next) => write(path, next)}
        />
      ) : (
        <Value schema={schema} value={value} path={path} variants={false} />
      )}
    </fieldset>
  );
}

/** Mapping keys refer to existing fields; the value remains the call's template or plain value. */
function ReferenceKeyAdd({
  label,
  options,
  onAdd,
  valueOptions,
}: {
  label: string;
  options: ReferenceOption[];
  onAdd: (name: string, value: unknown) => Promise<boolean>;
  valueOptions?: (name: string) => ReferenceOption[];
}) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  usePendingEdit(Boolean(name || value) || busy);
  return (
    <fieldset disabled={busy} className="space-y-2">
      <ReferencePicker
        label={`Field in ${label}`}
        options={options}
        value={name || undefined}
        onChange={async (value) => {
          setName(String(value ?? ""));
          setValue("");
          return true;
        }}
      />
      {valueOptions ? (
        <ReferencePicker
          label={`Date for ${name || label}`}
          options={valueOptions(name)}
          value={value || undefined}
          onChange={async (value) => {
            setValue(String(value ?? ""));
            return true;
          }}
        />
      ) : (
        <input
          aria-label={`Value in ${label}`}
          className={box}
          value={value}
          placeholder="Value or {path}"
          onChange={(event) => setValue(event.target.value)}
        />
      )}
      <button
        type="button"
        disabled={busy || !options.some((option) => option.value === name) || !value.trim()}
        className="text-xs underline"
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          let next: unknown = value;
          try {
            next = JSON.parse(value);
          } catch {
            /* A template or ordinary string stays text. */
          }
          try {
            if (await onAdd(name, next)) {
              setName("");
              setValue("");
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        Add {label}
      </button>
    </fieldset>
  );
}

/** Local dependent choices are submitted as a complete value through the original Writer. */
function ReferenceDraft({
  schema,
  value,
  path,
  condition = false,
  rules = false,
}: {
  schema: JsonSchema;
  value: unknown;
  path: Path;
  condition?: boolean;
  rules?: boolean;
}) {
  const write = useContext(Writer);
  const references = useContext(References);
  const [draft, setDraft] = useState(value);
  const [baseline, setBaseline] = useState(JSON.stringify(value));
  const [seen, setSeen] = useState(JSON.stringify(value));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [generation, setGeneration] = useState(0);
  const current = JSON.stringify(value);
  const dirty = JSON.stringify(draft) !== baseline;
  if (!dirty && current !== seen) {
    setSeen(current);
    setBaseline(current);
    setDraft(value);
  }
  const stale = dirty && current !== seen;
  usePendingEdit(dirty || busy);
  if (!references) return null;
  const document = referenceWith(references.document, path, draft);
  const ready =
    referenceReady(schema, draft, path, document, references.ir, references.auth) &&
    conditionTreeReady(path, draft, document, references.ir) &&
    semanticDraftReady(schema, draft, value) &&
    dateTreeReady(path, draft, document, references.ir);
  const reset = () => {
    setDraft(value);
    setBaseline(current);
    setSeen(current);
    setProblem(undefined);
    setGeneration((value) => value + 1);
  };
  return (
    <fieldset
      disabled={busy}
      className="space-y-3"
      aria-label={
        rules
          ? "Edit domain rules"
          : `Edit ${String(path.at(-1))} ${condition ? "condition" : "references"}`
      }
    >
      <References.Provider
        value={{ ...references, document: referenceWith(references.document, path, draft) }}
      >
        <Writer.Provider
          value={async (at, next) => {
            if (busy) return false;
            setDraft((before: unknown) => referenceWith(before, at.slice(path.length), next));
            setProblem(undefined);
            return true;
          }}
        >
          <InDraft.Provider value={true}>
            <Value key={generation} schema={schema} value={draft} path={path} drafted />
          </InDraft.Provider>
        </Writer.Provider>
      </References.Provider>
      {dirty && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy || stale || !ready}
            className="rounded-md border border-line px-2 py-1 text-xs"
            onClick={async () => {
              if (busy || stale || !ready) return;
              setBusy(true);
              try {
                if (await write(path, draft)) setBaseline(JSON.stringify(draft));
                else
                  setProblem(
                    "These settings were not applied. Check the selected references and required values.",
                  );
              } catch (error) {
                setProblem(error instanceof Error ? error.message : String(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            Save {String(path.at(-1))}
          </button>
          <button type="button" disabled={busy} className="text-xs underline" onClick={reset}>
            Cancel changes
          </button>
        </div>
      )}
      {stale && (
        <p role="alert">
          The saved settings changed. Cancel these changes to load the current settings.
        </p>
      )}
      {problem && <p role="alert">{problem}</p>}
    </fieldset>
  );
}

/** A text or number, written when the box is left or Enter is pressed; empty takes it away. */
function TextBox({
  label,
  value,
  numeric,
  placeholder,
  suggestions,
  onCommit,
}: {
  label: string;
  value: unknown;
  numeric: boolean;
  /** Values offered as it is typed in (the browser filters them). */
  suggestions?: string[];
  /** An example from the schema, else "Not set". */
  placeholder?: string;
  onCommit: (value: unknown) => Promise<boolean>;
}) {
  const shown =
    value === undefined ? "" : typeof value === "string" ? value : JSON.stringify(value);
  const [text, setText] = useState(shown);
  usePendingEdit(
    text !== shown &&
      JSON.stringify(
        text.trim() === ""
          ? undefined
          : numeric && !Number.isNaN(Number(text.trim()))
            ? Number(text.trim())
            : text.trim(),
      ) !== JSON.stringify(value),
  );
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
  const listId = useId();
  return (
    <>
      <input
        aria-label={label}
        className={box}
        value={text}
        placeholder={placeholder ?? "Not set"}
        inputMode={numeric ? "numeric" : undefined}
        list={suggestions ? listId : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </>
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
  usePendingEdit(Boolean(adding));
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
  usePendingEdit(to !== name);
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
  usePendingEdit(Boolean(name));
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
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium">
        <span title={typeof schema.description === "string" ? schema.description : undefined}>
          {labelOf(name, schema)}
        </span>
        {/* A key that is hard to grasp has its question mark (A 204). */}
        {HARD[name] && <HelpMark topic={HARD[name]} />}
        {typeof schema["x-docs"] === "string" && (
          // A small "?" as the help marks are; its name, read aloud and as the tooltip, says where it
          // leads (T907).
          <a
            href={schema["x-docs"]}
            target="_blank"
            rel="noreferrer"
            aria-label="What this is for"
            title="What this is for"
            className="flex size-5 shrink-0 items-center justify-center rounded-full border border-line text-[11px] font-semibold text-muted no-underline hover:border-accent hover:text-accent"
          >
            ?
          </a>
        )}
      </div>
      <Value schema={schema} value={value} path={path} />
    </div>
  );
}

/** The keys whose meaning does not fit a tooltip, and their help (help.tsx). */
const HARD: Record<string, HelpTopic> = {
  formula: "formula",
  when: "condition",
  merge: "merge",
  touches: "contract",
  ai: "aiPolicy",
};

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
  const create = useContext(ReferenceCreation);
  const entry = FILES.find(([, name]) => name === file);
  const root = file === "smithable.yml" ? specSchema() : COMPANION_SCHEMAS[file];
  const text = entry ? files[entry[0]] : undefined;
  // Read again only when the file's text changes, not on every render.
  const whole = useMemo(() => (entry ? read(text) : undefined), [entry, text]);
  const schema = root && schemaAt(root, whole, path);
  if (!schema) return null;
  let value = whole;
  for (const step of path) value = (value as Record<string | number, unknown> | undefined)?.[step];
  const write = (at: Path, next: unknown) => writeKey(run, file, at, next, whole);
  return (
    <Writer.Provider value={write}>
      <Choices.Provider value={choicesOf(files, file)}>
        <Renamer.Provider value={renamerOf(run, file)}>
          <Shape.Provider value={shapeOf(run, file, ir)}>
            <References.Provider
              value={
                file === "smithable.yml" && ir
                  ? {
                      document: whole,
                      ir,
                      auth: validateAuth(
                        { path: "smithable.auth.yml", text: files.auth ?? "smithableAuth: 0.1\n" },
                        ir,
                      ).auth,
                      create,
                    }
                  : undefined
              }
            >
              <Value schema={schema} value={value} path={path} />
            </References.Provider>
          </Shape.Provider>
        </Renamer.Provider>
      </Choices.Provider>
    </Writer.Provider>
  );
}
