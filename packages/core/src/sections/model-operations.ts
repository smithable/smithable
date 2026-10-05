import { conditionArgs } from "../condition.js";
import type { YamlEditor, YamlValue } from "../edit.js";
import { renameInFormula } from "../formula.js";
import { type FieldIR, type ModelIR, type SpecIR, storageOf, typeKey } from "../ir.js";
import { humanize, plural } from "../naming.js";
import {
  type AnyOperation,
  type Editors,
  type Operation,
  OperationError,
  refTo,
} from "../operation.js";
import { parseFieldShorthand } from "./field-type.js";
import { FIELD_NAME_PATTERN, MODEL_NAME_PATTERN } from "./names.js";

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
    throw new OperationError(
      `Field name "${name}" must start with a lowercase letter and use only letters and digits.`,
    );
  }
}

function checkType(type: string): void {
  const parsed = parseFieldShorthand(type);
  if (!parsed.ok) throw new OperationError(parsed.message + (parsed.hint ? ` ${parsed.hint}` : ""));
}

/** A field as an operation is given it: the shorthand, or the long form of a computed field. */
export type FieldArg = string | { type: string; formula: string };

/** The JSON Schema of a FieldArg, for addModel's and addCalculatorPage's fields. */
export const FIELD_ARG = {
  anyOf: [
    { type: "string" },
    {
      type: "object",
      required: ["type", "formula"],
      additionalProperties: false,
      properties: { type: { type: "string" }, formula: { type: "string", minLength: 1 } },
    },
  ],
  description:
    'Field shorthand, e.g. "string!", or a computed field\'s long form, e.g. { "type": "money", "formula": "quantity * unitPrice" }.',
};

/** Checks a field given to an operation; a computed one's formula is checked with the spec. */
export function checkFieldArg(name: string, value: FieldArg): void {
  checkFieldName(name);
  checkType(typeof value === "string" ? value : value.type);
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
      throw new OperationError(
        `Model name "${name}" must start with a capital letter and use only letters and digits.`,
      );
    }
    if (ir.models.some((m) => m.name === name))
      throw new OperationError(`Model "${name}" already exists.`);
    for (const [f, value] of Object.entries(fields)) checkFieldArg(f, value);
    spec.add(["models"], name, { fields });
    return [];
  },
};

const addField: Operation<{ model: string; field: string; type: string; formula?: string }> = {
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
    },
  },
  positional: ["model", "field", "...type"],
  describe: ({ model, field, type, formula }) =>
    `Add field ${field} (${type}${formula ? ` = ${formula}` : ""}) to ${model}`,
  destructive: () => false,
  apply({ spec }, { model: m, field: f, type, formula }, ir) {
    checkFieldArg(f, formula ? { type, formula } : type);
    if (model(ir, m).fields.some((x) => x.name === f))
      throw new OperationError(`${m} already has a field named "${f}".`);
    spec.add(fieldPath(m, f, ir).slice(0, -1), f, formula ? { type, formula } : type);
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
}> = {
  name: "setCapacity",
  summary:
    'Limit how many records of a model each referenced record may have, e.g. a session\'s bookings up to its capacity ("none" as per removes the limit).',
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
    },
  },
  positional: ["model", "per", "max", "...where"],
  describe: ({ model, per, max }) =>
    per === "none" ? `Remove the capacity of ${model}` : `Limit ${model} to ${max} per ${per}`,
  destructive: () => false,
  apply({ spec }, { model, per, max, where }, ir) {
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

export const modelOperations: AnyOperation[] = [
  addModel,
  addField,
  changeField,
  renameField,
  removeField,
  setCapacity,
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
