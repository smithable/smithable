// What the Builder's forms share: how an operation is run, and a field's shape as controls
// (the field form in Behavior). Adding a kind of record, a page or an action is the creation
// wizard's (Wizard.tsx, docs/design/studio-v3.md §4).
import {
  defaultColumns,
  type FieldIR,
  humanize,
  identifier,
  pageModel,
  typeKey,
} from "@smithable/core";
import { useState } from "react";
import type { Spec } from "../engine";
import { Button, Check, Input, Label, Select } from "../ui";
import { UNIQUE, type UniqueChoice, uniqueOf, uniqueRule } from "./unique";

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
  unique: UniqueChoice;
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
    unique: uniqueOf(field.unique),
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
      unique: "no",
    };
  const [, base = "string", bang, unique, rest] = /^\s*(\w+)(!?)(\s+unique)?(.*)$/.exec(type) ?? [];
  const relation = models.includes(base) || base === "User";
  return {
    kind: relation ? "relation" : KINDS.some(([k]) => k === base) ? base : "string",
    values: "",
    target: relation ? base : (models[0] ?? ""),
    required: bang === "!",
    unique: unique ? "yes" : "no",
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
  return `${type}${shape.required ? "!" : ""}${shape.unique === "yes" ? " unique" : ""}${shape.rest ?? kept}`;
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
        </div>
      )}
      {shape.kind !== "choice" && (
        <Label
          text="Unique"
          hint="No two records with the same value here: among one owner's records, in the whole app, or as who may read them says"
        >
          <Select
            aria-label="Unique"
            value={shape.unique}
            onChange={(e) => set({ unique: e.target.value as UniqueChoice })}
            options={UNIQUE}
          />
        </Label>
      )}
    </>
  );
}

/** A note under a form: the change it will make, or (in Studio) what it writes in the spec. */
function SpecNote({ label, text }: { label: string; text: string }) {
  return text ? (
    <p className="text-xs text-quiet">
      {label} <code className="rounded bg-subtle px-1">{text}</code>
    </p>
  ) : null;
}

/** Operations whose form can hold everything a proposal gives them (the change box → the Change tab). */
export const PREFILLED = ["addField", "changeField", "renameField", "removeField", "addPage"];

export type Prefill = { op: string; args: Record<string, unknown> };

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

export function FieldShapeForm({
  field,
  models,
  type: proposed,
  describe,
  run,
  rule,
}: {
  field: FieldIR;
  models: string[];
  /** A proposed type to start from instead of the field's own. */
  type?: string;
  /** The change in plain words (Builder); without it, the spec's shorthand (Studio). */
  describe?: (type: string) => string;
  /** The new type, and for a choice field what records holding a value that goes get ("old=new"). */
  run: (type: string, renames: string[]) => Promise<boolean>;
  /** setFieldRules --unique, for where a value is unique (owner or app): the field's own key. */
  rule: (unique: string) => Promise<boolean>;
}) {
  const [shape, setShape] = useState(() =>
    proposed ? parseShape(proposed, models) : shapeOf(field),
  );
  const [becomes, setBecomes] = useState<Record<string, string>>({});
  // What the person changed here and has not written yet.
  const [touched, setTouched] = useState<(keyof FieldShape)[]>([]);
  const edit = (next: FieldShape) => {
    const keys = (Object.keys(next) as (keyof FieldShape)[]).filter((k) => next[k] !== shape[k]);
    setTouched((t) => [...new Set([...t, ...keys])]);
    setShape(next);
  };
  // The field changed (this change, an undo, another window): start again from it, in place, so
  // the form keeps its spot and focus instead of being made again (A 121); a control the person
  // changed and has not written yet keeps their choice, so a refresh arriving a moment after a
  // change never takes back the next one being made.
  const now = JSON.stringify(field);
  const [seen, setSeen] = useState(now);
  if (now !== seen) {
    setSeen(now);
    const base = proposed ? parseShape(proposed, models) : shapeOf(field);
    const kept = { ...base, ...Object.fromEntries(touched.map((k) => [k, shape[k]])) };
    setShape(kept);
    setTouched(touched.filter((k) => kept[k] !== base[k]));
    if (!touched.length) setBecomes({});
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
    <Form
      onSubmit={async () => {
        const unique = uniqueRule(shape.unique, field.unique);
        // Only where it is unique changed: that rule alone, one change.
        const same =
          shorthand({ ...shape, unique: "no" }, field) ===
          shorthand({ ...shapeOf(field), unique: "no" }, field);
        if (unique && same && !renames.length) return rule(unique);
        const changed = await run(type, renames);
        return changed && unique ? rule(unique) : changed;
      }}
    >
      <FieldShapeControls shape={shape} onChange={edit} models={models} />
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
      {/* Where it is unique is no part of the shorthand: a change of it alone is a change too. */}
      <Submit
        label="Change field"
        disabled={type === shorthandOf(field) && !uniqueRule(shape.unique, field.unique)}
      />
    </Form>
  );
}
