// The Builder's forms for the most common changes. Each one becomes an operation.
import {
  type ArgRef,
  defaultColumns,
  type FieldIR,
  findOperation,
  humanize,
  identifier,
  type JsonSchema,
  kebab,
  type ModelIR,
  pageModel,
  pascal,
  typeKey,
} from "@smithable/core";
import { describeChange } from "@smithable/index";
import { useState } from "react";
import { api } from "../api";
import { ArgumentField, type ArgValues, argumentsOf } from "../arguments";
import type { Spec } from "../engine";
import { Button, Check, Input, Label, Select } from "../ui";
import { CustomCode, customFile } from "./custom-code";

/**
 * Applies an operation; `confirm` accepts a loss of data the user has already seen, and `file`
 * is a picture the change brings (its path in the project, base64).
 */
export type Run = (
  name: string,
  args: Record<string, unknown>,
  confirm?: boolean,
  file?: { path: string; data: string },
) => Promise<boolean>;

const KINDS: [string, string][] = [
  ["string", "Text"],
  ["text", "Long text"],
  ["markdown", "Formatted text"],
  ["picture", "Picture"],
  ["int", "Whole number"],
  ["decimal", "Number"],
  ["money", "Amount"],
  ["bool", "Yes or no"],
  ["date", "Date"],
  ["datetime", "Date and time"],
  ["email", "Email address"],
  ["phone", "Phone number"],
  ["url", "Web address"],
  ["choice", "One of a list…"],
  ["relation", "A link to…"],
];

/** A name a field of each type might have, for the name box's example. */
const EXAMPLE_NAMES: Record<string, string> = {
  string: "Title",
  text: "Notes",
  markdown: "Description",
  picture: "Photo",
  int: "Seats",
  decimal: "Weight",
  money: "Price",
  bool: "Paid",
  date: "Due date",
  datetime: "Starts at",
  email: "Email",
  phone: "Phone",
  url: "Website",
  choice: "Status",
};

/** A field as written in the spec's shorthand, e.g. "email! unique" or "a | b". */
export function shorthandOf(field: FieldIR): string {
  const type = field.type.kind === "choice" ? field.type.values.join(" | ") : typeKey(field.type);
  const required = field.required && field.type.kind !== "choice" ? "!" : "";
  return `${type}${required}${field.unique ? " unique" : ""}${field.default !== undefined && field.type.kind !== "choice" ? ` = ${field.default}` : ""}`;
}

/** What a field form edits: the kind of value and its modifiers. */
interface FieldShape {
  kind: string;
  values: string;
  target: string;
  required: boolean;
  unique: boolean;
  /** The rest of a shorthand the form does not edit, e.g. " = 0". */
  rest?: string;
}

function shapeOf(field: FieldIR): FieldShape {
  const t = field.type;
  return {
    kind: t.kind === "scalar" ? t.name : t.kind,
    values: t.kind === "choice" ? t.values.join(", ") : "",
    target: t.kind === "relation" ? t.model : "",
    required: field.required,
    unique: field.unique,
  };
}

/** A shape from the spec's shorthand, e.g. a proposed field's type. */
function parseShape(type: string, models: string[]): FieldShape {
  if (type.includes("|"))
    return {
      kind: "choice",
      values: type
        .split("|")
        .map((v) => v.trim().replace(/!$/, ""))
        .join(", "),
      target: "",
      required: false,
      unique: false,
    };
  const [, base = "string", bang, unique, rest] = /^\s*(\w+)(!?)(\s+unique)?(.*)$/.exec(type) ?? [];
  const relation = models.includes(base) || base === "User";
  return {
    kind: relation ? "relation" : KINDS.some(([k]) => k === base) ? base : "string",
    values: "",
    target: relation ? base : (models[0] ?? ""),
    required: bang === "!",
    unique: Boolean(unique),
    rest: rest?.trim() ? rest : undefined,
  };
}

/**
 * A shape's choice values as the spec writes them: a value the field has, or one already written
 * as one word, as it is; anything else as fields' names are made ("in progress" → inProgress).
 */
function choiceValues(shape: FieldShape, field?: FieldIR): string[] {
  const kept = field?.type.kind === "choice" ? field.type.values : [];
  return shape.values
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => (kept.includes(v) || /^[A-Za-z][A-Za-z0-9]*$/.test(v) ? v : identifier(v)));
}

/** The spec's shorthand for a shape, e.g. "email! unique" or "draft | sent". */
function shorthand(shape: FieldShape, keepDefault?: FieldIR): string {
  if (shape.kind === "choice") return choiceValues(shape, keepDefault).join(" | ");
  const type = shape.kind === "relation" ? shape.target : shape.kind;
  const kept =
    keepDefault?.default !== undefined && shapeOf(keepDefault).kind === shape.kind
      ? ` = ${keepDefault.default}`
      : "";
  return `${type}${shape.required ? "!" : ""}${shape.unique ? " unique" : ""}${shape.rest ?? kept}`;
}

/** The controls for a field's kind of value, its choices or link, and its modifiers. */
function FieldShapeControls({
  shape,
  onChange,
  models,
}: {
  shape: FieldShape;
  onChange: (shape: FieldShape) => void;
  models: string[];
}) {
  const set = (change: Partial<FieldShape>) => onChange({ ...shape, ...change });
  return (
    <>
      <Label text="Field type">
        <Select
          aria-label="Field type"
          value={shape.kind}
          onChange={(e) => set({ kind: e.target.value, target: shape.target || (models[0] ?? "") })}
          options={KINDS}
        />
      </Label>
      {shape.kind === "choice" && (
        <Label text="Values" hint="Separated by commas; the first is the default">
          <Input
            aria-label="Values"
            value={shape.values}
            onChange={(e) => set({ values: e.target.value })}
            placeholder="draft, sent, paid"
          />
        </Label>
      )}
      {shape.kind === "relation" && (
        <Label text="Links to">
          <Select
            aria-label="Links to"
            value={shape.target}
            onChange={(e) => set({ target: e.target.value })}
            options={[...models, "User"].map((m) => [m, humanize(m)] as [string, string])}
          />
        </Label>
      )}
      {shape.kind !== "choice" && (
        <div className="flex gap-4">
          <Check
            className="text-sm"
            text="Required"
            tip="The form will not save a record until this field has a value."
            checked={shape.required}
            onChange={(required) => set({ required })}
          />
          <Check
            className="text-sm"
            text="Unique"
            tip="No two records may have the same value here; the form says so when one already does."
            checked={shape.unique}
            onChange={(unique) => set({ unique })}
          />
        </div>
      )}
    </>
  );
}

/** The change a form will make, in the words of "Your app". */
function changeText(spec: Spec, op: string, args: Record<string, unknown>) {
  return spec.ir ? (describeChange(op, args, spec.ir, spec.content) ?? "") : "";
}

/** A note under a form: the change it will make, or (in Studio) what it writes in the spec. */
function SpecNote({ label, text }: { label: string; text: string }) {
  return text ? (
    <p className="text-xs text-quiet">
      {label} <code className="rounded bg-subtle px-1">{text}</code>
    </p>
  ) : null;
}

const CHANGES = [
  ["addField", "Add a field"],
  ["changeField", "Change a field"],
  ["renameField", "Rename a field"],
  ["removeField", "Remove a field"],
  ["addModel", "Add a kind of record"],
  ["addPage", "Add a page"],
  ["setSearch", "Search on a page"],
  ["grant", "Who can do what"],
  ["setNavigation", "Menu order"],
  ["addTile", "A dashboard tile"],
  ["removePage", "Remove a page"],
  ["addSection", "A section on a landing page"],
  ["removeSection", "Remove a section"],
  ["addAction", "An action"],
  ["setAction", "Change what an action says"],
  ["removeAction", "Remove an action"],
  ["importRecords", "Records from a CSV file"],
] as const;

/** Operations whose form can hold everything a proposal gives them (the change box → the Change tab). */
export const PREFILLED = ["addField", "changeField", "renameField", "removeField", "addPage"];

export type Prefill = { op: string; args: Record<string, unknown> };

export function ChangeForms({ spec, run, prefill }: { spec: Spec; run: Run; prefill?: Prefill }) {
  const [change, setChange] = useState<(typeof CHANGES)[number][0]>(
    () => CHANGES.find(([op]) => op === prefill?.op)?.[0] ?? "addField",
  );
  // A change that went through starts its form again from the spec as it is now.
  const [done, setDone] = useState(0);
  const runAndReset: Run = async (...args) => {
    const ok = await run(...args);
    if (ok) setDone((n) => n + 1);
    return ok;
  };
  // A proposal's values, for its own form only, until it went through.
  const initial = change === prefill?.op && done === 0 ? prefill.args : undefined;
  if (!spec.ir)
    return <p className="p-3 text-sm text-quiet">The spec has errors; fix them in Studio mode.</p>;
  return (
    <div className="space-y-4 p-3">
      <Label text="What do you want to change?">
        <Select
          aria-label="What do you want to change?"
          value={change}
          onChange={(e) => setChange(e.target.value as typeof change)}
          options={CHANGES.map(([value, label]) => [value, label])}
        />
      </Label>
      <div key={done} className="rounded-lg border border-line bg-surface p-3">
        {change === "addField" && <AddField spec={spec} run={runAndReset} initial={initial} />}
        {change === "changeField" && (
          <ChangeField spec={spec} run={runAndReset} initial={initial} />
        )}
        {change === "renameField" && (
          <RenameField spec={spec} run={runAndReset} initial={initial} />
        )}
        {change === "removeField" && (
          <FromSchema
            op="removeField"
            spec={spec}
            run={runAndReset}
            initial={initial}
            submit="Remove field"
          />
        )}
        {change === "addModel" && <AddModel run={runAndReset} />}
        {change === "importRecords" && <ImportRecords spec={spec} run={runAndReset} />}
        {change === "addPage" && <AddPage spec={spec} run={runAndReset} initial={initial} />}
        {change === "setSearch" && <SetSearch spec={spec} run={runAndReset} />}
        {change === "grant" && <Grant spec={spec} run={runAndReset} />}
        {change === "setNavigation" && <SetNavigation spec={spec} run={runAndReset} />}
        {change === "addTile" && <AddTile spec={spec} run={runAndReset} />}
        {change === "removePage" && (
          <FromSchema
            op="removePage"
            spec={spec}
            run={runAndReset}
            submit="Remove page"
            hint="Its records and their data stay; Undo brings the page back."
            disabled={(spec.ir?.pages.length ?? 0) < 2}
          />
        )}
        {change === "addSection" && <AddSection spec={spec} run={runAndReset} />}
        {change === "addAction" && <AddAction spec={spec} run={runAndReset} initial={initial} />}
        {change === "setAction" && <SetActionIntent spec={spec} run={runAndReset} />}
        {change === "removeAction" && (
          <FromSchema
            op="removeAction"
            spec={spec}
            run={runAndReset}
            initial={{ action: spec.ir.actions[0]?.name ?? "" }}
            submit="Remove action"
            controls={{ action: actionPicker(spec) }}
            hint="Its buttons go too; a custom action's code stays. Undo brings it back."
            disabled={!spec.ir.actions.length}
          />
        )}
        {change === "removeSection" && (
          <FromSchema
            op="removeSection"
            spec={spec}
            run={runAndReset}
            submit="Remove section"
            hint="Its texts go too; Undo brings it back."
          />
        )}
      </div>
    </div>
  );
}

type FormProps = {
  spec: Spec;
  run: Run;
  initial?: Record<string, unknown>;
  /** Opened in place under the part it adds to (What it does): what that part gives is not asked. */
  inPlace?: boolean;
};

/** The part an addition made, as the summary and the properties name it. */
function addedConcept(op: string, args: Record<string, unknown>): string | undefined {
  if (op === "addField") return `field:${args.model}.${args.field}`;
  if (op === "addModel") return `model:${args.model}`;
  if (op === "addAction") return `action:${args.action}`;
  if (["addPage", "addLandingPage", "addCustomPage"].includes(op)) return `page:${args.page}`;
  return undefined;
}

/** What "What it does" adds in place: a field, a record, a page or an action. */
export const ADDS = ["addField", "addModel", "addPage", "addAction"] as const;

/**
 * An addition in place, under the part it adds to (docs/design/studio-v2.md §5): its form, and
 * once it went through, `onAdded` with the part it made, whose properties open next.
 */
export function AddForm({
  op,
  spec,
  run,
  initial,
  onAdded,
  onCancel,
}: {
  op: (typeof ADDS)[number];
  spec: Spec;
  run: Run;
  initial?: Record<string, unknown>;
  onAdded: (concept: string | undefined) => void;
  onCancel: () => void;
}) {
  const added: Run = async (name, args, ...rest) => {
    const ok = await run(name, args, ...rest);
    if (ok) onAdded(addedConcept(name, args));
    return ok;
  };
  const props = { spec, run: added, initial, inPlace: true };
  return (
    <div className="space-y-3 p-3 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-quiet">
          {CHANGES.find(([o]) => o === op)?.[1].replace(/^An action$/, "Add an action")}
        </h3>
        <Button variant="ghost" className="h-6 text-xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {op === "addField" && <AddField {...props} />}
      {op === "addModel" && <AddModel run={added} />}
      {op === "addPage" && <AddPage {...props} />}
      {op === "addAction" && <AddAction {...props} />}
    </div>
  );
}

/** The app's actions to choose from, by their friendly names, for the forms that change or remove one. */
const actionPicker = (spec: Spec) => (value: string, set: (value: string) => void) => (
  <Label text="Action">
    <Select
      aria-label="Action"
      value={value}
      onChange={(e) => set(e.target.value)}
      options={(spec.ir?.actions ?? []).map((a) => [a.name, humanize(a.name)] as [string, string])}
    />
  </Label>
);

/**
 * What an action says: its intent, starting from the one it has, so a change never clears or
 * overwrites it by accident; choosing another action brings that one's intent.
 */
function SetActionIntent({ spec, run }: FormProps) {
  const actions = spec.ir?.actions ?? [];
  const intentOf = (name: string) => actions.find((a) => a.name === name)?.intent ?? "";
  const [action, setAction] = useState(actions[0]?.name ?? "");
  const [intent, setIntent] = useState(intentOf(actions[0]?.name ?? ""));
  return (
    <Form onSubmit={() => run("setAction", { action, intent })}>
      {actionPicker(spec)(action, (name) => {
        setAction(name);
        setIntent(intentOf(name));
      })}
      <Label
        text="Intent"
        hint="What it is for, in a sentence; an assistant reads it too. Empty removes it."
      >
        <Input aria-label="Intent" value={intent} onChange={(e) => setIntent(e.target.value)} />
      </Label>
      <Submit label="Change action" disabled={!action || intent === intentOf(action)} />
    </Form>
  );
}

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

function useModelField(spec: Spec, initial?: { model?: string; field?: string }) {
  const models = spec.ir?.models ?? [];
  const [model, setModel] = useState(initial?.model ?? models[0]?.name ?? "");
  const fields = models.find((m) => m.name === model)?.fields ?? [];
  const [field, setField] = useState(initial?.field ?? fields[0]?.name ?? "");
  const current = fields.find((f) => f.name === field) ?? fields[0];
  const pickers = (
    <>
      <Label text="Kind of record">
        <Select
          aria-label="Kind of record"
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setField(models.find((m) => m.name === e.target.value)?.fields[0]?.name ?? "");
          }}
          options={models.map((m) => [m.name, humanize(m.name)])}
        />
      </Label>
      <Label text="Field">
        <Select
          aria-label="Field"
          value={current?.name ?? ""}
          onChange={(e) => setField(e.target.value)}
          options={fields.map((f) => [f.name, humanize(f.name)])}
        />
      </Label>
    </>
  );
  return { model, field: current, pickers };
}

function Submit({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <Button type="submit" disabled={disabled} className="w-full">
      {label}
    </Button>
  );
}

function Form({
  onSubmit,
  children,
}: {
  onSubmit: () => Promise<unknown>;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSubmit();
        setBusy(false);
      }}
    >
      <fieldset disabled={busy} className="space-y-3">
        {children}
      </fieldset>
    </form>
  );
}

/**
 * A kind of record's list page and the columns it shows now: those its look names, or the ones
 * the app picks (core's defaultColumns).
 */
export function listOf(
  spec: Spec,
  modelName: string,
): { page: string; columns: string[]; chosen: boolean } | undefined {
  const page = spec.ir?.pages.find((p) => p.pattern.kind === "crud" && pageModel(p) === modelName);
  const model = spec.ir?.models.find((m) => m.name === modelName);
  if (!page || !model) return undefined;
  const chosen = spec.ux?.pages[page.id]?.columns;
  return { page: page.id, columns: chosen ?? defaultColumns(model), chosen: Boolean(chosen) };
}

function AddField({ spec, run, initial, inPlace }: FormProps) {
  const models = spec.ir?.models ?? [];
  const [model, setModel] = useState(str(initial?.model) ?? models[0]?.name ?? "");
  const [label, setLabel] = useState(str(initial?.field) ?? "");
  const [shape, setShape] = useState(() =>
    parseShape(
      str(initial?.type) ?? "string",
      models.map((m) => m.name),
    ),
  );
  const name = identifier(label);
  const type = shorthand(shape);
  const list = listOf(spec, model);
  const [inList, setInList] = useState(true);
  return (
    <Form
      onSubmit={() =>
        run("addField", { model, field: name, type, ...(list && inList ? { list: true } : {}) })
      }
    >
      {!inPlace && (
        <Label text="Kind of record">
          <Select
            aria-label="Kind of record"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            options={models.map((m) => [m.name, humanize(m.name)])}
          />
        </Label>
      )}
      <Label text="Name">
        <Input
          aria-label="Name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={
            shape.kind === "relation"
              ? humanize(shape.target || "Customer")
              : (EXAMPLE_NAMES[shape.kind] ?? "Website")
          }
        />
      </Label>
      <FieldShapeControls shape={shape} onChange={setShape} models={models.map((m) => m.name)} />
      {list && (
        <Check
          className="text-sm"
          text="Show it in listings"
          tip="Adds this field as a column on the list page of these records."
          checked={inList}
          onChange={setInList}
        />
      )}
      <SpecNote
        label="Will read:"
        text={name && type ? changeText(spec, "addField", { model, field: name, type }) : ""}
      />
      <Submit label="Add field" disabled={!name} />
    </Form>
  );
}

function ChangeField({ spec, run, initial }: FormProps) {
  const { model, field, pickers } = useModelField(spec, {
    model: str(initial?.model),
    field: str(initial?.field),
  });
  const models = (spec.ir?.models ?? []).map((m) => m.name);
  return (
    <div className="space-y-3">
      {pickers}
      {field &&
        (field.formula || (field.type.kind === "relation" && field.type.many) ? (
          <p className="text-sm text-muted">
            {field.formula ? "This field is calculated" : "This field lists related records"}:
            change it in Studio mode.
          </p>
        ) : (
          // A new form for each field, starting from its current definition.
          <FieldShapeForm
            key={`${model}.${field.name}`}
            field={field}
            models={models}
            type={field.name === initial?.field ? str(initial?.type) : undefined}
            describe={(type) => changeText(spec, "changeField", { model, field: field.name, type })}
            run={(type, renames) =>
              run("changeField", {
                model,
                field: field.name,
                type,
                ...(renames.length ? { renames } : {}),
              })
            }
          />
        ))}
    </div>
  );
}

export function FieldShapeForm({
  field,
  models,
  type: proposed,
  describe,
  run,
}: {
  field: FieldIR;
  models: string[];
  /** A proposed type to start from instead of the field's own. */
  type?: string;
  /** The change in plain words (Builder); without it, the spec's shorthand (Studio). */
  describe?: (type: string) => string;
  /** The new type, and for a choice field what records holding a value that goes get ("old=new"). */
  run: (type: string, renames: string[]) => Promise<boolean>;
}) {
  const [shape, setShape] = useState(() =>
    proposed ? parseShape(proposed, models) : shapeOf(field),
  );
  const [becomes, setBecomes] = useState<Record<string, string>>({});
  // The field changed (this change, an undo, another window): start again from it, in place, so
  // the form keeps its spot and focus instead of being made again (A 121).
  const now = JSON.stringify(field);
  const [seen, setSeen] = useState(now);
  if (now !== seen) {
    setSeen(now);
    setShape(proposed ? parseShape(proposed, models) : shapeOf(field));
    setBecomes({});
  }
  const type = shorthand(shape, field);
  // A choice value that goes: the records and samples holding it get one of the new ones.
  const values = shape.kind === "choice" ? choiceValues(shape, field) : [];
  const gone =
    shape.kind === "choice" && field.type.kind === "choice"
      ? field.type.values.filter((v) => !values.includes(v))
      : [];
  const renames = gone.map(
    (v) => `${v}=${becomes[v] ?? (field.required ? (values[0] ?? "") : "")}`,
  );
  return (
    <Form onSubmit={() => run(type, renames)}>
      <FieldShapeControls shape={shape} onChange={setShape} models={models} />
      {gone.map((v) => (
        <Label key={v} text={`Records with “${v}” get`}>
          <Select
            aria-label={`Records with ${v} get`}
            value={becomes[v] ?? (field.required ? (values[0] ?? "") : "")}
            onChange={(e) => setBecomes({ ...becomes, [v]: e.target.value })}
            options={[...(field.required ? [] : [["", "nothing"] as [string, string]]), ...values]}
          />
        </Label>
      ))}
      {describe ? (
        <SpecNote label="Will read:" text={type === shorthandOf(field) ? "" : describe(type)} />
      ) : (
        <SpecNote label="In the spec:" text={`${field.name}: ${type}`} />
      )}
      <Submit label="Change field" disabled={type === shorthandOf(field)} />
    </Form>
  );
}

function RenameField({ spec, run, initial }: FormProps) {
  const { model, field, pickers } = useModelField(spec, {
    model: str(initial?.model),
    field: str(initial?.from),
  });
  const [label, setLabel] = useState(str(initial?.to) ?? "");
  const to = identifier(label);
  return (
    <Form onSubmit={() => run("renameField", { model, from: field?.name, to })}>
      {pickers}
      <Label text="New name" hint="The data is kept">
        <Input
          aria-label="New name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Max credit"
        />
      </Label>
      <SpecNote
        label="Will read:"
        text={field && to ? changeText(spec, "renameField", { model, from: field.name, to }) : ""}
      />
      <Submit label="Rename field" disabled={!field || !to} />
    </Form>
  );
}

function AddModel({ run }: { run: Run }) {
  const [name, setName] = useState("");
  const [field, setField] = useState("name");
  return (
    <Form
      onSubmit={() =>
        run("addModel", {
          model: pascal(identifier(name)),
          fields: { [identifier(field)]: "string!" },
        })
      }
    >
      <Label
        text="Name"
        hint={
          name.trim()
            ? `Saved as ${pascal(identifier(name))}`
            : "For one record, e.g. Product or Invoice line"
        }
      >
        <Input aria-label="Model name" value={name} onChange={(e) => setName(e.target.value)} />
      </Label>
      <Label text="First field (required text)">
        <Input aria-label="First field" value={field} onChange={(e) => setField(e.target.value)} />
      </Label>
      <Submit label="Add" disabled={!name || !field} />
    </Form>
  );
}

/** "name: type" lines as field shorthand, e.g. "keep: Customer!". */
const fieldLines = (text: string): Record<string, string> =>
  Object.fromEntries(
    text
      .split("\n")
      .map((line) => line.split(":").map((part) => part.trim()))
      .filter(([name, type]) => name && type),
  );

/**
 * An action, the standard kind first: a button on a record that sets one of its fields (Mark as
 * done: status becomes done), only when another has a value; the custom kind, whose behavior a
 * developer writes, after it.
 */
function AddAction(props: FormProps) {
  const [kind, setKind] = useState<"standard" | "custom">("standard");
  return (
    <div className="space-y-3">
      <Label text="Kind of action">
        <Select
          aria-label="Kind of action"
          value={kind}
          onChange={(e) => setKind(e.target.value as "standard" | "custom")}
          options={[
            ["standard", "A button that changes a record"],
            ["custom", "Something else: a developer writes it"],
          ]}
        />
      </Label>
      {kind === "standard" ? <AddStandardAction {...props} /> : <AddCustomAction {...props} />}
    </div>
  );
}

/** The fields a button can set or test: stored, one value each. */
const settable = (model: ModelIR | undefined) =>
  (model?.fields ?? []).filter((f) => !f.formula && !(f.type.kind === "relation" && f.type.many));

/** A value control for a field: its choices, yes or no, or text ("" asks the person). */
function ValueOf({
  field,
  value,
  onChange,
  label,
  ask,
}: {
  field: FieldIR | undefined;
  value: string;
  onChange: (value: string) => void;
  label: string;
  ask?: boolean;
}) {
  if (field?.type.kind === "choice")
    return (
      <Select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={[
          ...(ask ? [["", "ask the person"] as [string, string]] : []),
          ...field.type.values.map((v) => [v, humanize(v)] as [string, string]),
        ]}
      />
    );
  if (field?.type.kind === "scalar" && field.type.name === "bool")
    return (
      <Select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={[
          ["true", "yes"],
          ["false", "no"],
        ]}
      />
    );
  return (
    <Input
      aria-label={label}
      value={value}
      placeholder={ask ? "empty: ask the person" : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function AddStandardAction({ spec, run }: FormProps) {
  const models = spec.ir?.models ?? [];
  const [label, setLabel] = useState("");
  const [modelName, setModelName] = useState(models[0]?.name ?? "");
  const model = models.find((m) => m.name === modelName);
  const fields = settable(model);
  const [setName, setSetName] = useState("");
  const setField = fields.find((f) => f.name === setName) ?? fields[0];
  const [setValue, setSetValue] = useState("");
  const conditions = fields.filter(
    (f) => f.type.kind === "choice" || (f.type.kind === "scalar" && f.type.name === "bool"),
  );
  const [whenName, setWhenName] = useState("");
  const whenField = conditions.find((f) => f.name === whenName);
  const [whenValue, setWhenValue] = useState("");
  const action = identifier(label);
  const value =
    setField?.type.kind === "choice" ? setValue || (setField.type.values[0] ?? "") : setValue;
  const when = whenField
    ? whenValue || (whenField.type.kind === "choice" ? (whenField.type.values[0] ?? "") : "true")
    : "";
  return (
    <Form
      onSubmit={() =>
        run("addAction", {
          action,
          on: modelName,
          set: { [setField?.name ?? ""]: value },
          ...(whenField ? { when: { [whenField.name]: when } } : {}),
          intent: label,
        })
      }
    >
      <Label text="The button says" hint="e.g. Mark as done">
        <Input
          aria-label="The button says"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </Label>
      <Label text="On each">
        <Select
          aria-label="On each"
          value={modelName}
          onChange={(e) => {
            setModelName(e.target.value);
            setSetName("");
            setWhenName("");
          }}
          options={models.map((m) => [m.name, humanize(m.name)])}
        />
      </Label>
      <Label text="It sets">
        <Select
          aria-label="It sets"
          value={setField?.name ?? ""}
          onChange={(e) => {
            setSetName(e.target.value);
            setSetValue("");
          }}
          options={fields.map((f) => [f.name, humanize(f.name)] as [string, string])}
        />
      </Label>
      <Label text="To">
        <ValueOf field={setField} value={value} onChange={setSetValue} label="To" ask />
      </Label>
      <Label text="Only when (optional)">
        <Select
          aria-label="Only when"
          value={whenField?.name ?? ""}
          onChange={(e) => {
            setWhenName(e.target.value);
            setWhenValue("");
          }}
          options={[
            ["", "always"] as [string, string],
            ...conditions.map((f) => [f.name, humanize(f.name)] as [string, string]),
          ]}
        />
      </Label>
      {whenField && (
        <Label text="Is">
          <ValueOf field={whenField} value={when} onChange={setWhenValue} label="Is" />
        </Label>
      )}
      <SpecNote
        label="Will read:"
        text={
          action && setField
            ? `A "${label}" button on each ${modelName.toLowerCase()} sets ${humanize(setField.name).toLowerCase()} to ${value ? humanize(value).toLowerCase() : "what the person enters"}${whenField ? `, when ${humanize(whenField.name).toLowerCase()} is ${humanize(when).toLowerCase()}` : ""}.`
            : ""
        }
      />
      <Submit label="Add button" disabled={!action || !setField} />
    </Form>
  );
}

function AddCustomAction({ run, initial }: FormProps) {
  const [action, setAction] = useState(str(initial?.action) ?? "");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [intent, setIntent] = useState(str(initial?.intent) ?? "");
  const box =
    "block w-full rounded-md border border-line-strong bg-panel px-2 py-1.5 font-mono text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
  return (
    <Form
      onSubmit={() =>
        run("addAction", {
          action: identifier(action),
          input: fieldLines(input),
          output: fieldLines(output),
          intent,
        })
      }
    >
      <Label
        text="Name"
        hint={action.trim() ? `Saved as ${identifier(action)}` : "e.g. Merge customers"}
      >
        <Input
          aria-label="Action name"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
      </Label>
      <Label text="What it is for">
        <Input
          aria-label="What it is for"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
        />
      </Label>
      <Label text="What it needs" hint='One per line, e.g. "keep: Customer!"'>
        <textarea
          aria-label="What it needs"
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={box}
        />
      </Label>
      <Label text="What it returns (optional)">
        <textarea
          aria-label="What it returns"
          rows={2}
          value={output}
          onChange={(e) => setOutput(e.target.value)}
          className={box}
        />
      </Label>
      <CustomCode files={customFile("addAction", { action: identifier(action) || "yourAction" })} />
      <Submit label="Add action" disabled={!action} />
    </Form>
  );
}

function AddPage({ spec, run, initial }: FormProps) {
  const models = spec.ir?.models ?? [];
  const [page, setPage] = useState(str(initial?.page) ?? "");
  const [model, setModel] = useState(str(initial?.model) ?? models[0]?.name ?? "");
  const [kind, setKind] = useState("list");
  const [component, setComponent] = useState("");
  return (
    <Form
      onSubmit={() =>
        kind === "landing"
          ? run("addLandingPage", { page: kebab(identifier(page)) })
          : kind === "custom"
            ? run("addCustomPage", {
                page: kebab(identifier(page)),
                component: pascal(identifier(component || page)),
              })
            : run("addPage", { page: kebab(identifier(page)), model })
      }
    >
      <Label
        text="Page name"
        hint={page.trim() ? `Saved as ${kebab(identifier(page))}` : "e.g. Products or Open orders"}
      >
        <Input aria-label="Page name" value={page} onChange={(e) => setPage(e.target.value)} />
      </Label>
      <Label text="Kind of page">
        <Select
          aria-label="Kind of page"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={[
            ["list", "A list of records"],
            ["landing", "A landing page for visitors"],
            ["custom", "A page of your own, in code"],
          ]}
        />
      </Label>
      {kind === "custom" ? (
        <OwnComponent
          value={component}
          placeholder={pascal(page || "planner")}
          folder="pages"
          onChange={setComponent}
        />
      ) : kind === "landing" ? (
        <p className="text-xs text-quiet">
          It starts with a heading and a footer, opens without sign-in, and gets more sections from
          “A section on a landing page”.
        </p>
      ) : (
        <Label text="Lists">
          <Select
            aria-label="Lists"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            options={models.map((m) => [m.name, humanize(m.name)])}
          />
        </Label>
      )}
      <Submit label="Add page" disabled={!page} />
    </Form>
  );
}

/**
 * Records from a spreadsheet: the file is read here and sent as text; a dry run shows the first
 * rows as they would land and every problem, then Import adds them all (undo takes them back).
 */
function ImportRecords({ spec, run }: FormProps) {
  const models = (spec.ir?.models ?? []).filter((m) => m.name !== "User");
  const [model, setModel] = useState(models[0]?.name ?? "");
  const [text, setText] = useState<string>();
  const [preview, setPreview] = useState<{ ok: boolean; output: string }>();
  const check = async (csv: string, name: string) => {
    const result = await api.operation("importRecords", { model: name, text: csv, dryRun: true });
    setPreview({ ok: result.ok, output: result.output.trim() });
  };
  return (
    <Form
      onSubmit={async () => {
        if (text && (await run("importRecords", { model, text }))) {
          setText(undefined);
          setPreview(undefined);
        }
      }}
    >
      <Label text="Kind of record">
        <Select
          aria-label="Kind of record"
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            if (text) void check(text, e.target.value);
          }}
          options={models.map((m) => [m.name, humanize(m.name)])}
        />
      </Label>
      <Label text="CSV file" hint="A header row; columns are matched to fields by name.">
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          className="text-sm"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const csv = await file.text();
            setText(csv);
            await check(csv, model);
          }}
        />
      </Label>
      {preview && (
        <pre
          role="status"
          aria-label="Import preview"
          className={`max-h-64 overflow-auto rounded border p-2 text-xs whitespace-pre-wrap ${preview.ok ? "border-line bg-panel" : "border-red-200 bg-red-50 text-red-800"}`}
        >
          {preview.output}
        </pre>
      )}
      <Button type="submit" disabled={!text || !preview?.ok}>
        Import
      </Button>
    </Form>
  );
}

function SetSearch({ spec, run }: FormProps) {
  const pages = (spec.ir?.pages ?? []).filter((p) => pageModel(p) !== undefined);
  const [page, setPage] = useState(pages[0]?.id ?? "");
  const current = pages.find((p) => p.id === page);
  const model = spec.ir?.models.find((m) => current && m.name === pageModel(current));
  const searchable = (model?.fields ?? []).filter(
    (f) =>
      !f.formula &&
      (f.type.kind === "choice" ||
        (f.type.kind === "relation" && !f.type.many) ||
        (f.type.kind === "scalar" &&
          ["string", "text", "markdown", "email", "phone", "url"].includes(f.type.name))),
  );
  const [chosen, setChosen] = useState<string[] | undefined>();
  const fields = chosen ?? current?.search ?? [];
  return (
    <Form onSubmit={() => run("setSearch", { page, fields }).then(() => setChosen(undefined))}>
      <Label text="Page">
        <Select
          aria-label="Page"
          value={page}
          onChange={(e) => {
            setPage(e.target.value);
            setChosen(undefined);
          }}
          options={pages.map((p) => [p.id, humanize(p.id)])}
        />
      </Label>
      <fieldset className="space-y-1">
        <legend className="text-xs font-medium text-muted">Search by</legend>
        {searchable.map((f) => (
          <label key={f.name} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={fields.includes(f.name)}
              onChange={(e) =>
                setChosen(
                  e.target.checked ? [...fields, f.name] : fields.filter((x) => x !== f.name),
                )
              }
            />
            {humanize(f.name)}
          </label>
        ))}
      </fieldset>
      <Submit label={fields.length ? "Set search" : "Remove search"} disabled={!page} />
    </Form>
  );
}

function Grant({ spec, run }: FormProps) {
  return (
    <FromSchema
      op="grant"
      spec={spec}
      run={run}
      submit="Grant"
      hints={{ names: "all for every one; none for nothing." }}
    />
  );
}

function SetNavigation({ spec, run }: FormProps) {
  const initial = spec.ir?.navigation.find((m) => m.name === "main")?.pages ?? [];
  const [pages, setPages] = useState(initial);
  const move = (i: number, by: number) => {
    const next = [...pages];
    const [page] = next.splice(i, 1);
    next.splice(i + by, 0, page as string);
    setPages(next);
  };
  return (
    <Form onSubmit={() => run("setNavigation", { menu: "main", pages })}>
      <ol className="space-y-1">
        {pages.map((p, i) => (
          <li
            key={p}
            className="flex items-center justify-between rounded-md bg-panel px-2 py-1 text-sm shadow-xs"
          >
            {humanize(p)}
            <span className="flex gap-1">
              <Button
                variant="ghost"
                aria-label={`Move ${humanize(p)} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                aria-label={`Move ${humanize(p)} down`}
                disabled={i === pages.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </Button>
            </span>
          </li>
        ))}
      </ol>
      <Submit label="Save menu order" />
    </Form>
  );
}

const MEASURES: [string, string][] = [
  ["count", "How many records"],
  ["sum", "The total of a number"],
  ["average", "The average of a number"],
  ["list", "The latest records"],
  ["query", "A custom query's records"],
];

function AddTile({ spec, run }: FormProps) {
  const ir = spec.ir;
  const dashboards = (ir?.pages ?? [])
    .filter((p) => p.pattern.kind === "dashboard")
    .map((p) => p.id);
  const [page, setPage] = useState(dashboards[0] ?? "overview");
  const [label, setLabel] = useState("");
  const [measure, setMeasure] = useState("count");
  const models = (ir?.models ?? []).map((m) => m.name);
  const numbers = (ir?.models ?? []).flatMap((m) =>
    m.fields.flatMap((f) =>
      f.type.kind === "scalar" && ["int", "decimal", "money"].includes(f.type.name)
        ? [`${m.name}.${f.name}`]
        : [],
    ),
  );
  const queries = (ir?.queries ?? []).map((q) => q.name);
  const options =
    measure === "sum" || measure === "average" ? numbers : measure === "query" ? queries : models;
  const [of, setOf] = useState("");
  const shownOf = options.includes(of) ? of : (options[0] ?? "");
  const tile = identifier(label);
  return (
    <Form
      onSubmit={() =>
        run("addTile", {
          page: kebab(identifier(page)),
          tile,
          measure,
          of: shownOf,
          ...(measure === "list" || measure === "query" ? { limit: 5 } : {}),
        })
      }
    >
      <Label text="Dashboard page" hint="A new name makes a new dashboard in the menu">
        <Input
          aria-label="Dashboard page"
          value={page}
          onChange={(e) => setPage(e.target.value)}
          list="dashboards"
        />
      </Label>
      <datalist id="dashboards">
        {dashboards.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
      <Label text="Tile name">
        <Input
          aria-label="Tile name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Open orders"
        />
      </Label>
      <Label text="Shows">
        <Select
          aria-label="Shows"
          value={measure}
          onChange={(e) => setMeasure(e.target.value)}
          options={MEASURES}
        />
      </Label>
      <Label text="Of">
        <Select
          aria-label="Of"
          value={shownOf}
          onChange={(e) => setOf(e.target.value)}
          options={options.map((o) => [o, o])}
        />
      </Label>
      <Submit label="Add tile" disabled={!page || !tile || !shownOf} />
    </Form>
  );
}

/** The kinds of landing section, as the form offers them. */
const SECTIONS: [string, string][] = [
  ["hero", "Hero: a heading, a text and a button"],
  ["features", "Features"],
  ["pricing", "Pricing"],
  ["testimonials", "Testimonials"],
  ["faq", "Questions and answers"],
  ["callToAction", "Call to action"],
  ["contact", "Contact details and a form"],
  ["gallery", "Pictures (a gallery)"],
  ["footer", "Footer"],
  ["records", "Records as cards"],
  ["custom", "A section of your own, in code"],
];

/** A page's or section's own component: its name, and where the code goes. */
function OwnComponent({
  value,
  placeholder,
  folder,
  onChange,
}: {
  value: string;
  placeholder: string;
  folder: "pages" | "sections";
  onChange: (value: string) => void;
}) {
  return (
    <>
      <Label text="Component" hint="Capitalized, e.g. RepaymentChart">
        <Input
          aria-label="Component"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </Label>
      <p className="text-xs text-quiet">
        It starts as a stub in src/custom/{folder}/{value || placeholder}.tsx, for a developer or an
        agent to write; Smithable never changes it.
      </p>
    </>
  );
}

function AddSection({ spec, run }: FormProps) {
  const landings = (spec.ir?.pages ?? []).filter((p) => p.pattern.kind === "landing");
  const models = spec.ir?.models ?? [];
  const [page, setPage] = useState(landings[0]?.id ?? "");
  const [kind, setKind] = useState("contact");
  const [label, setLabel] = useState("");
  const [model, setModel] = useState(models[0]?.name ?? "");
  const [form, setForm] = useState("");
  const [component, setComponent] = useState("");
  const records = kind === "records";
  const own = kind === "custom";
  const section = records || own ? identifier(label) : kind;
  if (!landings.length)
    return <p className="text-sm text-muted">The app has no landing page yet.</p>;
  return (
    <Form
      onSubmit={() =>
        run("addSection", {
          page,
          section,
          ...(records ? { records: model } : {}),
          ...(own ? { custom: component || pascal(section) } : {}),
          ...(kind === "contact" && form ? { form } : {}),
        })
      }
    >
      <Label text="Landing page">
        <Select
          aria-label="Landing page"
          value={page}
          onChange={(e) => setPage(e.target.value)}
          options={landings.map((p) => [p.id, humanize(p.id)])}
        />
      </Label>
      <Label text="Section" hint="Its texts are changed in place in the preview">
        <Select
          aria-label="Section"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={SECTIONS}
        />
      </Label>
      {own && (
        <>
          <Label text="Name">
            <Input
              aria-label="Section name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Repayment"
            />
          </Label>
          <OwnComponent
            value={component}
            placeholder={pascal(section || "repaymentChart")}
            folder="sections"
            onChange={setComponent}
          />
        </>
      )}
      {records && (
        <>
          <Label text="Name">
            <Input
              aria-label="Section name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Our classes"
            />
          </Label>
          <Label text="Shows">
            <Select
              aria-label="Shows"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              options={models.map((m) => [m.name, humanize(m.name)])}
            />
          </Label>
        </>
      )}
      {kind === "contact" && (
        <Label text="Form" hint="Visitors send it without an account: a record of this kind">
          <Select
            aria-label="Form"
            value={form}
            onChange={(e) => setForm(e.target.value)}
            options={[
              ["", "No form, only the details"],
              ...models.map((m): [string, string] => [m.name, humanize(m.name)]),
            ]}
          />
        </Label>
      )}
      {kind === "gallery" && (
        <p className="text-xs text-quiet">
          Its pictures are listed in smithable.content.yml for now (Studio mode).
        </p>
      )}
      <Submit label="Add section" disabled={!page || !section} />
    </Form>
  );
}

/**
 * A change whose form is its operation's schema (C8): each argument that names something in the
 * spec is chosen from the names there are, asked for in the annotation's words.
 */
function FromSchema({
  op,
  spec,
  run,
  initial,
  submit,
  hint,
  disabled,
  controls,
  hints,
}: FormProps & {
  op: string;
  submit: string;
  hint?: string;
  disabled?: boolean;
  /** An argument whose control the change words its own way (an icon, a tone). */
  controls?: Record<string, (value: string, set: (value: string) => void) => React.ReactNode>;
  /** A word under an argument's control. */
  hints?: Record<string, string>;
}) {
  const operation = findOperation(op, spec.plugins);
  const [values, setValues] = useState<ArgValues>(
    () =>
      Object.fromEntries(
        Object.entries(initial ?? {}).filter(([, v]) => typeof v === "string" || Array.isArray(v)),
      ) as ArgValues,
  );
  if (!operation) return null;
  const properties = (operation.schema.properties ?? {}) as Record<string, JsonSchema>;
  const required = (operation.schema.required as string[] | undefined) ?? [];
  const effective = argumentsOf(operation.schema, values, spec);
  return (
    <Form onSubmit={() => run(op, effective)}>
      {Object.entries(properties).map(([key, schema]) =>
        controls?.[key] ? (
          <div key={key}>
            {controls[key](String(effective[key] ?? ""), (v) => setValues({ ...values, [key]: v }))}
          </div>
        ) : (
          <ArgumentField
            key={key}
            name={key}
            schema={schema}
            required={required.includes(key)}
            values={values}
            effective={effective}
            setValue={(v) => setValues({ ...values, [key]: v })}
            spec={spec}
            label={(schema["x-smithable"] as ArgRef | undefined)?.label ?? humanize(key)}
            {...(hints?.[key] ? { hint: hints[key] } : {})}
          />
        ),
      )}
      {hint && <p className="text-xs text-quiet">{hint}</p>}
      <Submit
        label={submit}
        disabled={disabled || required.some((k) => effective[k] === undefined)}
      />
    </Form>
  );
}
