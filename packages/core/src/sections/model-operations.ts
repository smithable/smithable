import type { YamlEditor, YamlValue } from "../edit.js";
import { renameInFormula } from "../formula.js";
import { type FieldIR, type ModelIR, type SpecIR, storageOf, typeKey } from "../ir.js";
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

function model(ir: SpecIR, name: string): ModelIR {
  const found = ir.models.find((m) => m.name === name);
  if (!found) throw new OperationError(`There is no model named "${name}".`);
  return found;
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

/** The base type of a field, ignoring "!", "unique" and defaults: changing it can lose data. */
function baseType(type: string): string {
  const parsed = parseFieldShorthand(type);
  return parsed.ok ? typeKey(parsed.value.type) : type;
}

/** Where a field lives; smithable.content.yml uses the same path for its texts. */
function fieldPath(m: string, f: string) {
  return ["models", m, "fields", f];
}

const addModel: Operation<{ model: string; fields: Record<string, string> }> = {
  name: "addModel",
  summary: "Add a model with its fields.",
  schema: {
    type: "object",
    required: ["model", "fields"],
    additionalProperties: false,
    properties: {
      model: { ...name, description: "PascalCase name, e.g. Invoice." },
      fields: { type: "object", minProperties: 1, additionalProperties: { type: "string" } },
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
    for (const [f, type] of Object.entries(fields)) {
      checkFieldName(f);
      checkType(type);
    }
    spec.add(["models"], name, { fields });
    return [];
  },
};

const addField: Operation<{ model: string; field: string; type: string }> = {
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
    },
  },
  positional: ["model", "field", "...type"],
  describe: ({ model, field, type }) => `Add field ${field} (${type}) to ${model}`,
  destructive: () => false,
  apply({ spec }, { model: m, field: f, type }, ir) {
    checkFieldName(f);
    checkType(type);
    if (model(ir, m).fields.some((x) => x.name === f))
      throw new OperationError(`${m} already has a field named "${f}".`);
    spec.add(["models", m, "fields"], f, type);
    return [];
  },
};

const changeField: Operation<{ model: string; field: string; type: string }> = {
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
    },
  },
  positional: ["model", "field", "...type"],
  describe: ({ model, field, type }) => `Change ${model}.${field} to ${type}`,
  destructive: ({ model: m, field: f, type }, ir) => {
    return typeKey(field(ir, m, f).type) !== baseType(type);
  },
  apply({ spec }, { model: m, field: f, type }, ir) {
    checkType(type);
    field(ir, m, f);
    const parsed = parseFieldShorthand(type);
    const choices =
      parsed.ok && parsed.value.type.kind === "choice" ? parsed.value.type.values : [];
    const path = fieldPath(m, f);
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
    return [{ kind: "change-field", model: m, field: f, choices }];
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
    spec.renameKey(fieldPath(m, from), to);
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
  destructive: ({ model: m, field: f }, ir) => storageOf(field(ir, m, f)) !== "none",
  apply(editors: Editors, { model: m, field: f }, ir) {
    field(ir, m, f);
    if (model(ir, m).fields.length === 1)
      throw new OperationError(`${f} is the only field of ${m}; a model needs at least one.`);
    editors.spec.remove(fieldPath(m, f));
    return [{ kind: "remove-field", model: m, field: f, storage: storageOf(field(ir, m, f)) }];
  },
};

const setCapacity: Operation<{
  model: string;
  per: string;
  max?: string;
  where?: Record<string, string>;
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
        additionalProperties: { type: "string" },
        description: 'Only records with these values count, e.g. { "status": "confirmed" }.',
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
    const conditions = Object.fromEntries(
      Object.entries(where ?? {}).map(([k, v]) => [
        k,
        v === "true" ? true : v === "false" ? false : v,
      ]),
    );
    if (Object.keys(conditions).length) value.where = conditions;
    if (spec.has(path)) spec.set(path, value);
    else spec.add(["models", model], "capacity", value);
    return [];
  },
};

export const modelOperations: AnyOperation[] = [
  addModel,
  addField,
  changeField,
  renameField,
  removeField,
  setCapacity,
];

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
