import { defaultColumns } from "../columns.js";
import { conditionArgs, conditionText } from "../condition.js";
import type { YamlEditor, YamlValue } from "../edit.js";
import { renameInFormula, renameTextInFormula } from "../formula.js";
import {
  type FieldIR,
  type FieldValue,
  isUpload,
  type ModelIR,
  type SpecIR,
  storageOf,
  typeKey,
  USER_MODEL,
} from "../ir.js";
import { humanize, plural } from "../naming.js";
import {
  type AnyOperation,
  type Editors,
  type Operation,
  OperationError,
  refTo,
} from "../operation.js";
import { pageModel } from "../patterns.js";
import { parseFieldShorthand } from "./field-type.js";
import { readDeadline } from "./models.js";
import { nameCircle, partText, readNamePart } from "./name-parts.js";
import { FIELD_NAME_PATTERN, MODEL_NAME_PATTERN, nameRule } from "./names.js";
import { scheduleOperations } from "./schedule-operations.js";
import { put } from "./ux-operations.js";

const name = { type: "string", minLength: 1 };

/**
 * The model named, or a calculator page's fields as a model (docs/design/calculator.md): the
 * field operations work on a calculator as on a model, at its own place in the spec.
 */
function model(ir: SpecIR, name: string): ModelIR {
  const found = ir.models.find((m) => m.name === name);
  if (found) return found;
  const page = ir.pages.find((p) => p.id === name && p.pattern.kind === "calculator");
  if (page && page.pattern.kind === "calculator")
    return { name, fields: page.pattern.calculator.fields };
  throw new OperationError(`There is no model named "${name}".`);
}

/** Whether a name is a calculator page's, whose fields live under the page. */
function isCalculator(ir: SpecIR, name: string): boolean {
  return ir.pages.some((p) => p.id === name && p.pattern.kind === "calculator");
}

function field(ir: SpecIR, modelName: string, name: string): FieldIR {
  const found = model(ir, modelName).fields.find((f) => f.name === name);
  if (!found) throw new OperationError(`Model "${modelName}" has no field named "${name}".`);
  return found;
}

function checkFieldName(name: string): void {
  if (!FIELD_NAME_PATTERN.test(name)) {
    throw new OperationError(nameRule("field", name));
  }
}

function checkType(type: string): void {
  const parsed = parseFieldShorthand(type);
  if (!parsed.ok) throw new OperationError(parsed.message + (parsed.hint ? ` ${parsed.hint}` : ""));
}

/** A field as an operation is given it: the shorthand, or the long form of a computed field. */
/** A field as the operations take it: the shorthand, or the long form for what it cannot say (a
 *  computed field's formula, a number's or a text's bounds; the default then as its own key). */
export type FieldArg =
  | string
  | {
      type: string;
      formula?: string;
      min?: number;
      max?: number;
      default?: FieldValue;
      /** Its rules on the record (record-rules.md), as the long form writes them. */
      by?: "app";
      locked?: true | Record<string, string | boolean | string[]>;
      required?: boolean | Record<string, string | boolean | string[]>;
    };

/** The bounds and the default of a field's long form, for the operations that take them. */
export const FIELD_BOUNDS = {
  min: {
    type: "number",
    description: "The least value (int, decimal, money) or the shortest length (string, text).",
  },
  max: {
    type: "number",
    description: "The greatest value (int, decimal, money) or the longest length (string, text).",
  },
  default: {
    type: ["string", "number", "boolean"],
    description: 'With "min" or "max": the default, as its own value (never "=" in "type").',
  },
};

/** The JSON Schema of a FieldArg, for addModel's and addCalculatorPage's fields. */
export const FIELD_ARG = {
  anyOf: [
    { type: "string" },
    {
      type: "object",
      required: ["type"],
      additionalProperties: false,
      properties: {
        type: { type: "string" },
        formula: { type: "string", minLength: 1 },
        ...FIELD_BOUNDS,
        by: { enum: ["app"] },
        locked: { anyOf: [{ const: true }, { type: "object" }] },
        required: { anyOf: [{ type: "boolean" }, { type: "object" }] },
      },
    },
  ],
  description:
    'Field shorthand, e.g. "string!", or the long form for a computed field, e.g. { "type": "money", "formula": "quantity * unitPrice" }, for a number within bounds, e.g. { "type": "int!", "min": 1, "max": 5, "default": 3 }, or with its rules on the record, e.g. { "type": "User", "by": "app", "default": "ME()" }, { "type": "int!", "locked": { "status": "closed" } }, { "type": "User", "required": { "status": "inProgress" } }.',
};

/** Checks a field given to an operation; a computed one's formula is checked with the spec. */
export function checkFieldArg(name: string, value: FieldArg): void {
  checkFieldName(name);
  checkType(typeof value === "string" ? value : value.type);
  if (typeof value === "string") return;
  const ruled =
    value.by !== undefined || value.locked !== undefined || value.required !== undefined;
  if (value.formula === undefined && value.min === undefined && value.max === undefined && !ruled)
    throw new OperationError(
      `Field "${name}": the long form is for a formula, bounds (min, max) or rules (by, locked, required); otherwise write the shorthand, like "int! = 3".`,
    );
  if (value.formula !== undefined && (value.min !== undefined || value.max !== undefined))
    throw new OperationError(
      `Field "${name}": a computed field has no bounds; leave out "min" and "max".`,
    );
}

/** The base type of a field, ignoring "!", "unique" and defaults: changing it can lose data. */
function baseType(type: string): string {
  const parsed = parseFieldShorthand(type);
  return parsed.ok ? typeKey(parsed.value.type) : type;
}

/** Where a field lives (a calculator's under its page); smithable.content.yml keys texts the same way. */
function fieldPath(m: string, f: string, ir?: SpecIR) {
  return ir && isCalculator(ir, m)
    ? ["pages", m, "calculator", "fields", f]
    : ["models", m, "fields", f];
}

const addModel: Operation<{ model: string; fields: Record<string, FieldArg> }> = {
  name: "addModel",
  summary: "Add a model with its fields.",
  schema: {
    type: "object",
    required: ["model", "fields"],
    additionalProperties: false,
    properties: {
      model: { ...name, description: "PascalCase name, e.g. Invoice." },
      fields: { type: "object", minProperties: 1, additionalProperties: FIELD_ARG },
    },
  },
  positional: ["model", "...fields"],
  describe: ({ model, fields }) => `Add model ${model} with ${Object.keys(fields).join(", ")}`,
  destructive: () => false,
  apply({ spec }, { model: name, fields }, ir) {
    if (!MODEL_NAME_PATTERN.test(name)) {
      throw new OperationError(nameRule("model", name));
    }
    if (ir.models.some((m) => m.name === name))
      throw new OperationError(`Model "${name}" already exists.`);
    for (const [f, value] of Object.entries(fields)) checkFieldArg(f, value);
    spec.add(["models"], name, { fields });
    return [];
  },
};

/** The shorthand of a list of related records ("InvoiceLine[]"). */
const isMany = (type: string) => /\[\]\s*$/.test(type);

const addField: Operation<{
  model: string;
  field: string;
  type: string;
  formula?: string;
  min?: number;
  max?: number;
  default?: FieldValue;
  list?: boolean;
}> = {
  name: "addField",
  summary: "Add a field to a model.",
  schema: {
    type: "object",
    required: ["model", "field", "type"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }, name),
      field: { ...name, description: "camelCase name, e.g. phone." },
      type: { ...name, description: 'Field shorthand, e.g. "phone", "string!", "draft | sent".' },
      formula: {
        ...name,
        description:
          'A computed field: worked out from the record\'s other fields, never entered, e.g. "quantity * unitPrice" (the type is then its kind only, e.g. "money").',
      },
      ...FIELD_BOUNDS,
      list: {
        type: "boolean",
        description: "Also show it as a column of its list page's table, in the same change.",
      },
    },
  },
  positional: ["model", "field", "...type"],
  describe: ({ model, field, type, formula, min, max, list }) =>
    `Add field ${field} (${type}${formula ? ` = ${formula}` : ""}${min !== undefined || max !== undefined ? `, ${min ?? "…"} to ${max ?? "…"}` : ""}) to ${model}${list && !isMany(type) ? ", shown in its list" : ""}`,
  destructive: () => false,
  apply({ spec, ux }, { model: m, field: f, type, formula, min, max, default: given, list }, ir) {
    // The long form when the shorthand cannot say it; the default then as its own key.
    const long = formula !== undefined || min !== undefined || max !== undefined;
    const value: FieldArg = long
      ? {
          type,
          ...(formula !== undefined ? { formula } : {}),
          ...(min !== undefined ? { min } : {}),
          ...(max !== undefined ? { max } : {}),
          ...(given !== undefined ? { default: given } : {}),
        }
      : type;
    checkFieldArg(f, value);
    if (model(ir, m).fields.some((x) => x.name === f))
      throw new OperationError(`${m} already has a field named "${f}".`);
    spec.add(fieldPath(m, f, ir).slice(0, -1), f, value);
    // A list of related records is never a column (the record's page shows them), so "list" is
    // ignored for one rather than refused: a draft asks for every field in its list.
    if (!list || isMany(type)) return [];
    // Shown in its list (the model's first list page), in the same change: added to the columns
    // the page names, or, where the app picks them and would not pick it, to the ones it picks.
    const page = ir.pages.find((p) => p.pattern.kind === "crud" && pageModel(p) === m);
    if (!page) throw new OperationError(`${m} has no list page to show it in.`);
    const path = ["pages", page.id, "table", "columns"];
    const named = ux.get(path);
    if (Array.isArray(named)) put(ux, path, [...named.map(String), f]);
    else {
      const parsed = parseFieldShorthand(type);
      const before = model(ir, m);
      const added = parsed.ok
        ? defaultColumns({ ...before, fields: [...before.fields, { name: f, ...parsed.value }] })
        : [];
      if (!added.includes(f)) put(ux, path, [...defaultColumns(before), f]);
    }
    return [];
  },
};

const changeField: Operation<{ model: string; field: string; type: string; renames?: string[] }> = {
  name: "changeField",
  summary: "Change a field's type, required flag, uniqueness or default.",
  schema: {
    type: "object",
    required: ["model", "field", "type"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }, name),
      field: refTo({ ref: "field", model: "model", label: "Field" }, name),
      type: { ...name, description: 'Field shorthand, e.g. "email! unique".' },
      renames: {
        type: "array",
        items: { type: "string" },
        description:
          'For a choice field: what records holding a value that goes get instead, as "old=new" (e.g. doing=inProgress); "old=" leaves them empty.',
      },
    },
  },
  positional: ["model", "field", "...type"],
  describe: ({ model, field, type, renames = [] }) =>
    `Change ${model}.${field} to ${type}${renames.length ? `, records with ${renames.map((r) => r.replace("=", " becoming ").replace(/ becoming $/, " left empty")).join(", ")}` : ""}`,
  destructive: ({ model: m, field: f, type }, ir) => {
    return typeKey(field(ir, m, f).type) !== baseType(type);
  },
  apply({ spec }, { model: m, field: f, type, renames = [] }, ir) {
    checkType(type);
    const before = field(ir, m, f);
    const parsed = parseFieldShorthand(type);
    // A field unique together with others (docs/design/uniqueness.md) stays one stored value.
    const rule = ir.models.find((x) => x.name === m)?.unique?.find((u) => u.fields.includes(f));
    if (rule && parsed.ok) {
      const t = parsed.value.type;
      const why = parsed.value.unique
        ? "unique by itself"
        : t.kind === "relation" && t.many
          ? "a list of records"
          : t.kind === "scalar" && ["picture", "pictures", "file", "files"].includes(t.name)
            ? `a ${t.name}`
            : undefined;
      if (why)
        throw new OperationError(
          `${m}.${f} is unique together with ${rule.fields.filter((x) => x !== f).join(" and ")}, so it cannot become ${why}; remove that rule first (setUnique --remove).`,
        );
    }
    // The field that names the model's records (namedBy) stays a text.
    if (ir.models.find((x) => x.name === m)?.namedBy === f && parsed.ok) {
      const t = parsed.value.type;
      if (!(t.kind === "scalar" && ["string", "text", "markdown"].includes(t.name)))
        throw new OperationError(
          `${m}.${f} names a ${m.toLowerCase()} (namedBy), so it stays a string, text or markdown field; name another field first (setNamedBy).`,
        );
    }
    const choices =
      parsed.ok && parsed.value.type.kind === "choice" ? parsed.value.type.values : [];
    // A choice value that goes: what the records holding it get instead.
    const renamed: Record<string, string> = {};
    // A field that must have a value (required, or with a default) cannot be left empty.
    const mustHave =
      parsed.ok &&
      (parsed.value.required ||
        (parsed.value.defaultText !== undefined && parsed.value.defaultText !== "none"));
    for (const pair of renames) {
      if (!pair.includes("="))
        throw new OperationError(
          `"${pair}" says no new value: write it as old=new, e.g. ${pair}=${choices[0] ?? "…"}, or ${pair}= to leave the records empty.`,
        );
      const [from = "", to = ""] = pair.split("=").map((s) => s.trim());
      const old = before.type.kind === "choice" ? before.type.values : [];
      if (choices.includes(from))
        throw new OperationError(
          `"${from}" stays one of ${m}.${f}'s values, so its records keep it; name only values that go.`,
        );
      if (!old.includes(from))
        throw new OperationError(
          `${m}.${f} has no value "${from}" to replace. Values: ${old.join(", ")}.`,
        );
      if (!to && mustHave)
        throw new OperationError(
          `${m}.${f} must have a value, so records holding "${from}" cannot be left empty: name one of ${choices.join(", ")}.`,
        );
      if (to && !choices.includes(to))
        throw new OperationError(`"${to}" is not one of the new values: ${choices.join(", ")}.`);
      renamed[from] = to;
    }
    const path = fieldPath(m, f, ir);
    const current = spec.get(path);
    if (typeof current === "object" && current !== null) {
      // Long form: replace only the type and keep description, bounds and the rest.
      if (parsed.ok && parsed.value.defaultText !== undefined) {
        throw new OperationError(
          `${m}.${f} uses the long form; set its default with the "default:" key instead of "=".`,
        );
      }
      spec.set([...path, "type"], type);
      // Its default follows a renamed value.
      const byDefault = renamed[String((current as { default?: unknown }).default)];
      if (byDefault) spec.set([...path, "default"], byDefault);
    } else {
      spec.set(path, type);
    }
    return [
      {
        kind: "change-field",
        model: m,
        field: f,
        choices,
        ...(Object.keys(renamed).length ? { renamed } : {}),
      },
    ];
  },
};

const renameField: Operation<{ model: string; from: string; to: string }> = {
  name: "renameField",
  summary: "Rename a field, keeping its data.",
  schema: {
    type: "object",
    required: ["model", "from", "to"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }, name),
      from: refTo({ ref: "field", model: "model", label: "Field" }, name),
      to: name,
    },
  },
  positional: ["model", "from", "to"],
  describe: ({ model, from, to }) => `Rename ${model}.${from} to ${to}`,
  destructive: () => false,
  apply({ spec }, { model: m, from, to }, ir) {
    field(ir, m, from);
    checkFieldName(to);
    if (model(ir, m).fields.some((x) => x.name === to))
      throw new OperationError(`${m} already has a field named "${to}".`);
    spec.renameKey(fieldPath(m, from, ir), to);
    if (isCalculator(ir, m)) {
      // A calculator's formulas and examples name its fields; nothing else does.
      renameInCalculator(spec, ir, m, from, to);
      return [];
    }
    return [{ kind: "rename-field", model: m, from, to, storage: storageOf(field(ir, m, from)) }];
  },
};

const renameModel: Operation<{ from: string; to: string }> = {
  name: "renameModel",
  summary:
    "Rename a kind of record, keeping its records. Every field, page, action, rule and grant that names it follows.",
  schema: {
    type: "object",
    required: ["from", "to"],
    additionalProperties: false,
    properties: {
      from: refTo({ ref: "model", label: "Kind of record" }, name),
      to: { ...name, description: "The new name, like Customer." },
    },
  },
  positional: ["from", "to"],
  describe: ({ from, to }) => `Rename ${from} to ${to}`,
  destructive: () => false,
  apply(_editors, { from, to }, ir) {
    if (isCalculator(ir, from))
      throw new OperationError(`${from} is a calculator page, not a kind of record.`);
    model(ir, from);
    if (!MODEL_NAME_PATTERN.test(to)) throw new OperationError(nameRule("model", to));
    if (to === from) throw new OperationError(`${from} is already called that.`);
    if (ir.models.some((m) => m.name === to) || isCalculator(ir, to))
      throw new OperationError(`There is a kind of record named "${to}" already.`);
    // The key and every place the spec names the model are rewritten by applyOperation from the
    // effect, and the companions follow it (companion.ts).
    return [{ kind: "rename-model", from, to }];
  },
};

const removeField: Operation<{ model: string; field: string }> = {
  name: "removeField",
  summary: "Remove a field and its data.",
  schema: {
    type: "object",
    required: ["model", "field"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }, name),
      field: refTo({ ref: "field", model: "model", label: "Field" }, name),
    },
  },
  positional: ["model", "field"],
  describe: ({ model, field }) => `Remove field ${field} from ${model}`,
  destructive: ({ model: m, field: f }, ir) =>
    !isCalculator(ir, m) && storageOf(field(ir, m, f)) !== "none",
  apply(editors: Editors, { model: m, field: f }, ir) {
    field(ir, m, f);
    if (model(ir, m).fields.length === 1)
      throw new OperationError(`${f} is the only field of ${m}; a model needs at least one.`);
    editors.spec.remove(fieldPath(m, f, ir));
    if (isCalculator(ir, m)) return [];
    return [{ kind: "remove-field", model: m, field: f, storage: storageOf(field(ir, m, f)) }];
  },
};

const setCapacity: Operation<{
  model: string;
  per: string;
  max?: string;
  where?: Record<string, string | boolean | string[]>;
  closes?: string;
  cancelUntil?: string;
}> = {
  name: "setCapacity",
  summary:
    'Limit how many records of a model each referenced record may have, e.g. a session\'s bookings up to its capacity ("none" as per removes the limit). The capacity is set whole: a where or a deadline left out is lifted.',
  schema: {
    type: "object",
    required: ["model", "per"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }),
      per: refTo(
        { ref: "field", model: "model", label: "Per" },
        {
          description:
            'A required reference of the model, e.g. session; "none" removes the capacity.',
        },
      ),
      max: {
        type: "string",
        description:
          'A whole number, or a whole-number field of the referenced record, e.g. "session.capacity".',
      },
      where: {
        type: "object",
        description:
          'Only records with these values count, e.g. { "status": "confirmed" } or { "status": "confirmed | paid" }.',
      },
      closes: {
        type: "string",
        description:
          'Until when a record may be added: a date-time of the referenced record ("session.startsAt"), as it is or a period before it ("2 hours before session.startsAt"); "none" lifts it.',
      },
      cancelUntil: {
        type: "string",
        description:
          'Until when a record\'s owner may delete it ("24 hours before session.startsAt"); roles that delete everyone\'s pass; "none" lifts it.',
      },
    },
  },
  positional: ["model", "per", "max", "...where"],
  describe: ({ model, per, max, closes, cancelUntil }) =>
    per === "none"
      ? `Remove the capacity of ${model}`
      : `Limit ${model} to ${max} per ${per}${closes && closes !== "none" ? `, added until ${closes}` : ""}${cancelUntil && cancelUntil !== "none" ? `, deleted by its owner until ${cancelUntil}` : ""}`,
  destructive: () => false,
  apply({ spec }, { model, per, max, where, closes, cancelUntil }, ir) {
    if (!ir.models.some((m) => m.name === model))
      throw new OperationError(`There is no model named "${model}".`);
    const path = ["models", model, "capacity"];
    if (per === "none") {
      if (spec.has(path)) spec.removeAndPrune(path, 0);
      return [];
    }
    if (max === undefined)
      throw new OperationError('Say "max": a whole number, or a field like session.capacity.');
    const value: Record<string, YamlValue> = { per, max: /^\d+$/.test(max) ? Number(max) : max };
    const conditions = conditionArgs(where ?? {});
    if (Object.keys(conditions).length) value.where = conditions;
    for (const [key, given] of [
      ["closes", closes],
      ["cancelUntil", cancelUntil],
    ] as const) {
      if (given === undefined || given === "none") continue;
      if (!readDeadline(given))
        throw new OperationError(
          `"${key}" is a date-time of the ${per} record ("${per}.startsAt"), as it is or a period before it ("2 hours before ${per}.startsAt").`,
        );
      value[key] = given.trim();
    }
    if (spec.has(path)) spec.set(path, value);
    else spec.add(["models", model], "capacity", value);
    return [];
  },
};

const importRecords: Operation<{
  model: string;
  from?: string;
  text?: string;
  map?: Record<string, string>;
  dryRun?: boolean;
}> = {
  name: "importRecords",
  summary:
    "Add records from a CSV file (a header row; columns matched to fields by name or --map). --dry-run shows the first rows and every problem without adding anything.",
  schema: {
    type: "object",
    required: ["model"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }, name),
      from: { type: "string", description: "The CSV file, e.g. customers.csv." },
      text: { type: "string", description: "The CSV itself, instead of a file." },
      map: {
        type: "object",
        additionalProperties: { type: "string" },
        description: 'Columns for fields where the names differ, e.g. { "Company": "name" }.',
      },
      dryRun: { type: "boolean", description: "Show what would be added; add nothing." },
    },
  },
  positional: ["model"],
  describe: ({ model, from }) =>
    `Import ${humanize(plural(model)).toLowerCase()} from ${from ?? "a CSV text"}`,
  destructive: () => false,
  apply(_editors, { model: m, from, text, map = {}, dryRun = false }, ir) {
    const target = model(ir, m);
    if (isCalculator(ir, m))
      throw new OperationError(`${m} is a calculator: it keeps no records to import.`);
    if (text === undefined && !from)
      throw new OperationError("Give the CSV file with --from, or its text.");
    // An import adds data, not grammar: the spec stays as it is and the host does the rest.
    return [
      {
        kind: "import-records",
        model: target.name,
        source: text !== undefined ? { text } : { path: from as string },
        map,
        dryRun,
      },
    ];
  },
};

/**
 * Deleted records of a model go to a trash for thirty days (docs/design/trash.md). Turning the
 * trash off removes what is in it for good, so that asks first.
 */
const setTrash: Operation<{ model: string; trash: boolean }> = {
  name: "setTrash",
  summary:
    "Keep a model's deleted records in a trash for thirty days, where whoever may delete them can restore them (true), or delete for good at once (false, the default).",
  schema: {
    type: "object",
    required: ["model", "trash"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }),
      trash: { type: "boolean", description: "true: a trash with restore; false: none." },
    },
  },
  positional: ["model", "trash"],
  describe: ({ model, trash }) =>
    trash
      ? `Keep deleted ${model} records in a trash for thirty days`
      : `Delete ${model} records for good at once`,
  destructive: ({ model, trash }, ir) =>
    !trash && ir.models.find((m) => m.name === model)?.trash === true,
  apply({ spec }, { model, trash }, ir) {
    const found = ir.models.find((m) => m.name === model);
    if (!found) throw new OperationError(`There is no model named "${model}".`);
    if (Boolean(found.trash) === trash)
      throw new OperationError(trash ? `${model} has a trash already.` : `${model} has no trash.`);
    const path = ["models", model, "trash"];
    if (trash) spec.add(["models", model], "trash", true);
    else spec.remove(path);
    return [];
  },
};

/**
 * Pictures and files that wait for a reviewer before others see them (docs/design/file-review.md):
 * a list of a model's picture and file fields, all of them, or none. A required one holds the
 * record until it is approved, an optional one only the file. Who reviews is the auth file's
 * `review` grant; the files wait on a review page (addReviewPage).
 */
const setReview: Operation<{ model: string; fields: string[] }> = {
  name: "setReview",
  summary:
    'Hold a model\'s pictures and files for review before others see them: the fields named, "all" (every picture and file field), or "none". A required one holds the whole record until approved, an optional one only the file; admins and the roles granted review approve them on a review page.',
  schema: {
    type: "object",
    required: ["model", "fields"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }),
      fields: refTo(
        { ref: "field", model: "model", label: "Reviewed" },
        { description: 'Picture and file fields, ["all"] for every one, or ["none"].' },
        true,
      ),
    },
  },
  positional: ["model", "...fields"],
  describe: ({ model, fields }) =>
    fields[0] === "none" || fields.length === 0
      ? `Show ${model} pictures and files without review`
      : fields[0] === "all"
        ? `Review every picture and file of ${model} before others see it`
        : `Review ${fields.join(", ")} of ${model} before others see ${fields.length === 1 ? "it" : "them"}`,
  destructive: () => false,
  apply({ spec }, { model, fields }, ir) {
    const found = ir.models.find((m) => m.name === model);
    if (!found) throw new OperationError(`There is no model named "${model}".`);
    const uploads = found.fields.filter(isUpload).map((f) => f.name);
    const path = ["models", model, "review"];
    if (fields.length === 0 || fields[0] === "none") {
      if (!found.review) throw new OperationError(`${model} has no review.`);
      spec.remove(path);
      return [];
    }
    if (!uploads.length)
      throw new OperationError(`${model} has no picture or file field to review.`);
    const value = fields[0] === "all" ? "all" : fields;
    if (value !== "all")
      for (const f of fields)
        if (!uploads.includes(f))
          throw new OperationError(
            `${f} is not a picture or file field of ${model}: ${uploads.join(", ")}.`,
          );
    if (spec.has(path)) spec.set(path, value);
    else spec.add(["models", model], "review", value);
    return [];
  },
};

/** A condition argument as setAction's --when takes one: field=value, a list as "a | b". */
const CONDITION_ARG = {
  type: "object",
  propertyNames: { pattern: FIELD_NAME_PATTERN.source },
  additionalProperties: { type: ["string", "boolean", "array"], items: { type: "string" } },
};

const setFieldRules: Operation<{
  model: string;
  field: string;
  by?: "app" | "";
  locked?: Record<string, string | boolean | string[]>;
  once?: boolean;
  required?: Record<string, string | boolean | string[]>;
  unique?: "true" | "false" | "owner" | "app";
}> = {
  name: "setFieldRules",
  summary:
    "Set who fills a field and when it may change: by app (the form never shows it), locked (after it is made, or while a condition holds), required while a condition holds; and whether it is unique, and where (owner or app).",
  schema: {
    type: "object",
    required: ["model", "field"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }, name),
      field: refTo({ ref: "field", model: "model", label: "Field" }, name),
      by: {
        enum: ["app", ""],
        description:
          'app: the form never shows it; its default, an action or code fills it. "" removes it.',
      },
      locked: {
        ...CONDITION_ARG,
        description:
          "Read-only while the record fits the condition, e.g. { status: closed }; {} removes it.",
      },
      once: {
        type: "boolean",
        description:
          "Locked once made: set when the record is made, never changed after; false removes it.",
      },
      required: {
        ...CONDITION_ARG,
        description:
          'Required while the record fits the condition, e.g. { status: "inProgress | closed" }; {} removes it. Always required is "!" in the type (changeField).',
      },
      unique: {
        enum: ["true", "false", "owner", "app"],
        description:
          "No two records hold the same value: true (per owner or in the app as the access says), owner (among one owner's records), app (in the whole app); false removes it.",
      },
    },
  },
  positional: ["model", "field"],
  describe: ({ model, field, by, locked, once, required, unique }) =>
    `Set ${model}.${field}'s rules: ${[
      unique !== undefined &&
        {
          true: "unique",
          false: "not unique",
          owner: "unique per owner",
          app: "unique in the whole app",
        }[unique],
      by !== undefined && (by ? "filled by the app" : "filled in the form"),
      once !== undefined && (once ? "locked once made" : "not locked once made"),
      locked !== undefined &&
        (Object.keys(locked).length
          ? `locked when ${conditionText(conditionArgs(locked))}`
          : "not locked"),
      required !== undefined &&
        (Object.keys(required).length
          ? `required when ${conditionText(conditionArgs(required))}`
          : "required only as its type says"),
    ]
      .filter(Boolean)
      .join(", ")}`,
  destructive: () => false,
  apply({ spec }, { model: m, field: f, by, locked, once, required, unique }, ir) {
    const found = field(ir, m, f);
    if (found.formula)
      throw new OperationError(`${m}.${f} is computed by its formula: nobody fills it in.`);
    if (
      by === undefined &&
      locked === undefined &&
      once === undefined &&
      required === undefined &&
      unique === undefined
    )
      throw new OperationError("Say what to set: --by, --locked, --once, --required or --unique.");
    if (unique !== undefined && unique !== "false" && isUpload(found))
      throw new OperationError(
        `${m}.${f} is a ${found.type.kind === "scalar" ? found.type.name : "file"}: it cannot be unique.`,
      );
    if (
      unique !== undefined &&
      unique !== "false" &&
      found.type.kind === "relation" &&
      found.type.many
    )
      throw new OperationError(`${m}.${f} is a list of records: it cannot be unique.`);
    if (unique === "false" && found.sequence)
      throw new OperationError(`${m}.${f} is a number counting up, unique by its nature.`);
    const inRule = ir.models.find((x) => x.name === m)?.unique?.find((u) => u.fields.includes(f));
    if (unique !== undefined && unique !== "false" && inRule)
      throw new OperationError(
        `${m}.${f} is unique together with ${inRule.fields.filter((x) => x !== f).join(" and ")}; remove that rule first (setUnique --remove).`,
      );
    if (once && locked && Object.keys(locked).length)
      throw new OperationError("A field is locked once made or while a condition holds, not both.");
    const path = fieldPath(m, f, ir);
    const current = spec.get(path);
    // The long form, from the shorthand when the field has none yet ("int! = 3" gives its default its own key).
    const long: Record<string, YamlValue> =
      typeof current === "object" && current !== null
        ? { ...(current as Record<string, YamlValue>) }
        : longForm(String(current));
    const keep = (key: string, value: YamlValue | undefined) => {
      if (value === undefined) delete long[key];
      else long[key] = value;
    };
    if (by !== undefined) keep("by", by || undefined);
    if (unique !== undefined) {
      // The shorthand's "unique" moves to the key, which says where.
      long.type = String(long.type).replace(/\s+unique\b/, "");
      keep("unique", unique === "false" ? undefined : unique === "true" ? true : unique);
    }
    if (once !== undefined) keep("locked", once || undefined);
    if (locked !== undefined)
      keep("locked", Object.keys(locked).length ? (conditionArgs(locked) as YamlValue) : undefined);
    if (required !== undefined)
      keep(
        "required",
        Object.keys(required).length ? (conditionArgs(required) as YamlValue) : undefined,
      );
    // Back to the shorthand when nothing but the type (and a default, and a plain unique) is left.
    if (
      long.unique === true &&
      Object.keys(long).every((k) => ["type", "default", "unique"].includes(k))
    ) {
      long.type = `${String(long.type)} unique`;
      delete long.unique;
    }
    const keys = Object.keys(long).filter((k) => k !== "type" && k !== "default");
    spec.set(
      path,
      keys.length
        ? long
        : long.default === undefined
          ? String(long.type)
          : `${String(long.type)} = ${String(long.default)}`,
    );
    return [];
  },
};

/** A field's shorthand as the long form: its type, and its default as its own key. */
export function longForm(shorthand: string): Record<string, YamlValue> {
  const at = shorthand.indexOf("=");
  if (at < 0) return { type: shorthand.trim() };
  const raw = shorthand.slice(at + 1).trim();
  const value: YamlValue =
    raw === "true" || raw === "false"
      ? raw === "true"
      : /^-?\d+(\.\d+)?$/.test(raw)
        ? Number(raw)
        : raw;
  return { type: shorthand.slice(0, at).trim(), default: value };
}

/**
 * Fields unique together (docs/design/uniqueness.md): no two records of the model hold the same
 * values in all of them, among one owner's records or in the whole app. One rule per set of fields;
 * naming the same set again changes where, --remove takes it away.
 */
const setUnique: Operation<{
  model: string;
  fields: string[];
  scope?: "owner" | "app";
  remove?: boolean;
}> = {
  name: "setUnique",
  summary:
    "Make two or more fields of a model unique together: no two records hold the same values in all of them, among one owner's records (owner), in the whole app (app), or as the access says; --remove takes the rule away. One field alone is unique through setFieldRules.",
  schema: {
    type: "object",
    required: ["model", "fields"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }),
      fields: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        description: "Two or more of the model's stored fields.",
      },
      scope: {
        enum: ["owner", "app"],
        description:
          "owner: among one owner's records; app: in the whole app. Left out: as the access says, like a field's unique: true.",
      },
      remove: { type: "boolean", description: "true removes the rule for these fields." },
    },
  },
  positional: ["model", "fields"],
  describe: ({ model, fields, scope, remove }) =>
    remove
      ? `Let ${model} records share the same ${fields.join(" and ")}`
      : `No two ${model} records with the same ${fields.join(" and ")}${scope === "owner" ? " for one owner" : scope === "app" ? " in the whole app" : ""}`,
  destructive: () => false,
  apply({ spec }, { model, fields, scope, remove }, ir) {
    const found = ir.models.find((m) => m.name === model);
    if (!found) throw new OperationError(`There is no model named "${model}".`);
    const names = [...new Set(fields)];
    if (names.length < 2) throw new OperationError("Name two or more different fields.");
    for (const name of names) {
      const f = found.fields.find((x) => x.name === name);
      if (!f) throw new OperationError(`${model} has no field "${name}".`);
      if (remove) continue;
      if (f.formula || isUpload(f) || (f.type.kind === "relation" && f.type.many))
        throw new OperationError(
          `${model}.${name} cannot be part of the rule: a computed field, a picture, a file or a list of records is not stored as one value.`,
        );
      if (f.unique)
        throw new OperationError(
          `${model}.${name} is unique by itself already; remove that first.`,
        );
    }
    const same = (a: string[]) => a.length === names.length && a.every((n) => names.includes(n));
    const path = ["models", model, "unique"];
    const current = spec.has(path) ? spec.get(path) : [];
    const entries: { fields: string[]; scope?: string }[] = (
      Array.isArray(current) ? current : []
    ).map((e) =>
      Array.isArray(e) ? { fields: e.map(String) } : (e as { fields: string[]; scope?: string }),
    );
    const at = entries.findIndex((e) => same(e.fields));
    if (remove) {
      if (at < 0) throw new OperationError(`${model} has no such rule for ${names.join(" and ")}.`);
      entries.splice(at, 1);
    } else if (at < 0) entries.push({ fields: names, scope });
    else entries[at] = { fields: names, scope };
    const value = entries.map((e) => (e.scope ? { fields: e.fields, scope: e.scope } : e.fields));
    if (value.length === 0) spec.remove(path);
    else if (spec.has(path)) spec.set(path, value as YamlValue);
    else spec.add(["models", model], "unique", value as YamlValue);
    return [];
  },
};

/**
 * What a model's records are when a page shows them as a conversation (docs/design/conversation.md
 * §2): which field is the body, who wrote it, which side is ours. Each part given replaces what was
 * there; "none" takes the whole setting away, and the rule reads the fields again.
 */
const setThread: Operation<{
  model: string;
  body?: string;
  author?: string;
  side?: string;
  ours?: string;
  none?: boolean;
}> = {
  name: "setThread",
  summary:
    "Say which fields a conversation reads from a model's records: the message's body (a text field), its author (a person or email field) and the side that is ours (a two-valued choice and its value); --none leaves it to the rule again.",
  schema: {
    type: "object",
    required: ["model"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }),
      body: {
        type: "string",
        description: "The text, markdown or string field shown as the message.",
      },
      author: {
        type: "string",
        description: "The field that says who wrote it: a person, or an email.",
      },
      side: {
        type: "string",
        description: "The two-valued choice field that says which side a message is on.",
      },
      ours: {
        type: "string",
        description: "The side field's value that is our side; needed with --side.",
      },
      none: {
        type: "boolean",
        description: "true removes the setting: the rule reads the fields again.",
      },
    },
  },
  positional: ["model"],
  describe: ({ model, body, author, side, ours, none }) =>
    none
      ? `Let the rule say what a ${model} shows as a message`
      : `A ${model} as a message: ${[
          body && `its text is ${body}`,
          author && `written by ${author}`,
          side && `${side} says the side (${ours} is ours)`,
        ]
          .filter(Boolean)
          .join(", ")}`,
  destructive: () => false,
  apply({ spec }, { model, body, author, side, ours, none }, ir) {
    const found = ir.models.find((m) => m.name === model);
    if (!found) throw new OperationError(`There is no model named "${model}".`);
    const path = ["models", model, "thread"];
    if (none) {
      if (!spec.has(path)) throw new OperationError(`${model} has no thread setting.`);
      spec.remove(path);
      return [];
    }
    if (body === undefined && author === undefined && side === undefined)
      throw new OperationError(
        "Say what to set: --body, --author or --side with --ours (or --none).",
      );
    if ((side === undefined) !== (ours === undefined))
      throw new OperationError(
        "--side and --ours go together: the field, and the value that is our side.",
      );
    const field = (name: string) => {
      const f = found.fields.find((x) => x.name === name);
      if (!f) throw new OperationError(`${model} has no field "${name}".`);
      return f;
    };
    const current = (spec.has(path) ? spec.get(path) : {}) as Record<string, YamlValue>;
    const next: Record<string, YamlValue> = { ...current };
    if (body !== undefined) {
      const f = field(body);
      if (!(f.type.kind === "scalar" && ["text", "markdown", "string"].includes(f.type.name)))
        throw new OperationError(`${model}.${body} is not a text, markdown or string field.`);
      next.body = body;
    }
    if (author !== undefined) {
      const f = field(author);
      const person = f.type.kind === "relation" && f.type.model === USER_MODEL && !f.type.many;
      if (!person && !(f.type.kind === "scalar" && f.type.name === "email"))
        throw new OperationError(`${model}.${author} refers to no person and is no email field.`);
      next.author = author;
    }
    if (side !== undefined && ours !== undefined) {
      const f = field(side);
      if (!(f.type.kind === "choice" && f.type.values.length === 2))
        throw new OperationError(`${model}.${side} is not a choice with two values.`);
      if (!f.type.values.includes(ours))
        throw new OperationError(
          `"${ours}" is not one of ${model}.${side}'s values (${f.type.values.join(", ")}).`,
        );
      next.side = { field: side, ours };
    }
    if (spec.has(path)) spec.set(path, next);
    else spec.add(["models", model], "thread", next);
    return [];
  },
};

const setNamedBy: Operation<{ model: string; parts?: string[]; field?: string; none?: boolean }> = {
  name: "setNamedBy",
  summary:
    'Say what names a record of a model, its title wherever one record is shown or referred to: one part or several (a field, a reference for that record\'s own name, or a field one reference away like classType.name), joined with " · "; --none leaves it to the rule again (the first short text, else the first long text).',
  schema: {
    type: "object",
    required: ["model"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }),
      parts: {
        type: "array",
        items: { type: "string" },
        description: "The parts in order, e.g. classType startsAt, or one: company, or session.",
      },
      field: refTo(
        { ref: "field", model: "model", label: "Field" },
        { description: "One part: the same as parts with one item." },
      ),
      none: {
        type: "boolean",
        description: "true removes the setting: the rule picks the title again.",
      },
    },
  },
  positional: ["model", "parts"],
  describe: ({ model, parts, field, none }) =>
    none
      ? `Let the rule say what names a ${model}`
      : `A ${model} is named by its ${(parts ?? (field ? [field] : [])).join(" · ")}`,
  destructive: () => false,
  apply({ spec }, { model, parts, field, none }, ir) {
    const found = ir.models.find((m) => m.name === model);
    if (!found) throw new OperationError(`There is no model named "${model}".`);
    const path = ["models", model, "namedBy"];
    if (none) {
      if (!spec.has(path)) throw new OperationError(`${model} has no namedBy setting.`);
      spec.remove(path);
      return [];
    }
    const written = [...(parts ?? []), ...(field ? [field] : [])];
    if (!written.length)
      throw new OperationError("Say what names the record: one part or several (or --none).");
    const parts_ = written.map((text) => {
      const r = readNamePart(text, found, ir.models);
      if ("problem" in r) throw new OperationError(`${r.problem}${r.hint ? ` ${r.hint}` : ""}`);
      return r.part;
    });
    const read = parts_.map(partText);
    const twice = read.find((t, i) => read.indexOf(t) !== i);
    if (twice) throw new OperationError(`${model} would be named by ${twice} twice.`);
    // Named by a reference whose record is named by this one, round and round: refused as when read.
    const next = { ...found, nameParts: parts_ };
    const circle = nameCircle(
      next,
      ir.models.map((m) => (m.name === model ? next : m)),
    );
    if (circle)
      throw new OperationError(
        `${model}'s name would come back to itself: ${circle.join(" → ")}. One of them must be named by its own fields.`,
      );
    const value = read.length === 1 ? (read[0] as string) : read;
    if (spec.has(path)) spec.set(path, value);
    else spec.add(["models", model], "namedBy", value);
    return [];
  },
};

export const modelOperations: AnyOperation[] = [
  setNamedBy,
  setThread,
  setUnique,
  addModel,
  addField,
  changeField,
  setFieldRules,
  renameField,
  removeField,
  renameModel,
  setCapacity,
  ...scheduleOperations,
  setTrash,
  setReview,
  importRecords,
];

/** Renames a field in a calculator's own formulas and examples. */
function renameInCalculator(
  spec: YamlEditor,
  ir: SpecIR,
  page: string,
  from: string,
  to: string,
): void {
  const p = ir.pages.find((x) => x.id === page);
  if (p?.pattern.kind !== "calculator") return;
  const base = ["pages", page, "calculator"];
  for (const f of p.pattern.calculator.fields) {
    const path = [...base, "fields", f.name, "formula"];
    const text = spec.has(path) ? spec.get(path) : undefined;
    if (typeof text !== "string") continue;
    const next = renameInFormula(text, (name, list) =>
      name === from && list === undefined ? to : undefined,
    );
    if (next !== text) spec.set(path, next);
  }
  p.pattern.calculator.examples.forEach((e, i) => {
    for (const part of ["input", "expected"] as const)
      if (from in e[part]) spec.renameKey([...base, "examples", String(i), part, from], to);
  });
}

/**
 * Follows a choice field's renamed values where formulas compare with them: the model's own
 * formulas (and their examples' inputs) and `COUNTIF` over it from other models. A value whose
 * records were left empty is not followed: the formula then names a value that is gone, which
 * the check refuses.
 */
export function renameValuesInFormulas(
  spec: YamlEditor,
  ir: SpecIR,
  m: string,
  field: string,
  renamed: Record<string, string>,
): void {
  for (const x of ir.models)
    for (const f of x.fields) {
      if (!f.formula) continue;
      const path = [...fieldPath(x.name, f.name), "formula"];
      const text = spec.has(path) ? spec.get(path) : undefined;
      if (typeof text !== "string") continue;
      const next = renameTextInFormula(text, (name, list, value) => {
        const type = list === undefined ? undefined : x.fields.find((l) => l.name === list)?.type;
        const ours =
          list === undefined ? x.name === m : type?.kind === "relation" && type.model === m;
        return name === field && ours ? renamed[value] || undefined : undefined;
      });
      if (next !== text) spec.set(path, next);
      if (x.name !== m) continue;
      (f.examples ?? []).forEach((e, i) => {
        const to = renamed[String(e.input[field])];
        if (field in e.input && to)
          spec.set([...fieldPath(x.name, f.name), "examples", String(i), "input", field], to);
      });
    }
}

/**
 * Renames a field where formulas use it: the model's own formulas (and their examples' inputs)
 * and aggregates over it from other models (`SUM(lines.amount)`).
 */
export function renameInFormulas(
  spec: YamlEditor,
  ir: SpecIR,
  m: string,
  from: string,
  to: string,
): void {
  for (const x of ir.models)
    for (const f of x.fields) {
      if (!f.formula) continue;
      const path = [...fieldPath(x.name, f.name), "formula"];
      const text = spec.has(path) ? spec.get(path) : undefined;
      if (typeof text !== "string") continue;
      const listsOfM = (list: string) => {
        const type = x.fields.find((l) => l.name === list)?.type;
        return type?.kind === "relation" && type.many && type.model === m;
      };
      const next = renameInFormula(text, (name, list) =>
        name !== from
          ? undefined
          : list === undefined
            ? x.name === m
              ? to
              : undefined
            : listsOfM(list)
              ? to
              : undefined,
      );
      if (next !== text) spec.set(path, next);
      if (x.name !== m) continue;
      (f.examples ?? []).forEach((e, i) => {
        if (from in e.input)
          spec.renameKey([...fieldPath(x.name, f.name), "examples", String(i), "input", from], to);
      });
    }
}
