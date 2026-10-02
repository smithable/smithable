import { isMap, isScalar, isSeq, type ParsedNode } from "yaml";
import { lostValues, readCondition } from "../condition.js";
import {
  checkKeys,
  type Entry,
  mapEntries,
  type ParseContext,
  readBoolean,
  readNumber,
  readRoleList,
  readString,
} from "../context.js";
import {
  checkFormula,
  type Expr,
  FormulaError,
  fieldsUsed,
  parseFormula,
  valueTypeOf,
} from "../formula.js";
import {
  ACCESS_OPERATIONS,
  type CapacityIR,
  conditionFits,
  type FieldExample,
  type FieldIR,
  type FieldValue,
  type ModelAccessIR,
  type ModelIR,
  SCALAR_TYPES,
  USER_MODEL,
} from "../ir.js";
import { capitalize } from "../naming.js";
import type { JsonSchema, SpecSection } from "../section.js";
import { didYouMean } from "../suggest.js";
import { type FieldShorthand, parseDefault, parseFieldShorthand } from "./field-type.js";
import { modelOperations, renameInFormulas } from "./model-operations.js";
import { FIELD_NAME_PATTERN, MODEL_NAME_PATTERN } from "./names.js";
import { readSemanticText, TEXT_KEYS } from "./text.js";
import { textSchema } from "./text-schema.js";

/** Fields every model gets automatically. */
const RESERVED_FIELDS = ["id", "owner", "createdAt", "updatedAt"];

const NUMERIC_TYPES = ["int", "decimal", "money"];
const TEXT_TYPES = ["string", "text"];

const types = SCALAR_TYPES.join("|");
const choice = "[a-z][A-Za-z0-9]*";
const model = "[A-Z][A-Za-z0-9]*";
const shorthandPattern = `^\\s*(?:(?:${types})!?(?:\\s+unique)?(?:\\s*=\\s*\\S.*)?|${model}!?(?:\\s+unique)?|${model}\\[\\]|${choice}(?:\\s*\\|\\s*${choice})+)\\s*$`;
const typePattern = `^\\s*(?:(?:${types})!?|${model}!?|${model}\\[\\]|${choice}(?:\\s*\\|\\s*${choice})+)\\s*$`;

const fieldSchema: JsonSchema = {
  oneOf: [
    {
      type: "string",
      pattern: shorthandPattern,
      description: `A type with optional "!" (required), "unique" and "= default", e.g. "string!" or "int! = 60". Or choices: "draft | sent | paid" (the first is the default).`,
    },
    {
      type: "object",
      required: ["type"],
      additionalProperties: false,
      properties: {
        type: { type: "string", pattern: typePattern },
        required: { type: "boolean" },
        unique: { type: "boolean" },
        default: {
          type: ["string", "number", "boolean"],
          description: `For choices, "none" means no default.`,
        },
        min: { type: "number" },
        max: { type: "number" },
        formula: {
          type: "string",
          description:
            'Computes the value, spreadsheet-style, e.g. "quantity * unitPrice" or "SUM(lines.amount)".',
        },
        examples: {
          type: "array",
          description: "Inputs and the expected result of the formula; each becomes a test.",
          items: {
            type: "object",
            required: ["input", "expected"],
            additionalProperties: false,
            properties: { input: { type: "object" }, expected: {} },
          },
        },
        ...textSchema,
      },
    },
  ],
};

export const modelsSection: SpecSection<"models"> = {
  key: "models",
  required: false,
  operations: modelOperations,
  follow(spec, effect, ir) {
    // Formulas (and their examples) and an owner field follow a renamed field.
    // A field a capacity counts on cannot go while it does.
    if (effect.kind === "remove-field") {
      for (const m of ir.models) {
        const c = m.capacity;
        if (!c) continue;
        const perField = m.fields.find((f) => f.name === c.per);
        const target = perField?.type.kind === "relation" ? perField.type.model : undefined;
        const uses =
          (m.name === effect.model &&
            (c.per === effect.field || (c.where && effect.field in c.where))) ||
          (target === effect.model && c.max === `${c.per}.${effect.field}`);
        if (uses)
          return {
            refusal: `${m.name}'s capacity counts on ${effect.model}.${effect.field}; change the capacity first.`,
          };
      }
      return undefined;
    }
    // Nor can a capacity count on a choice value that goes.
    if (effect.kind === "change-field") {
      for (const m of ir.models) {
        const wanted = m.name === effect.model ? m.capacity?.where?.[effect.field] : undefined;
        const lost = wanted === undefined ? [] : lostValues(wanted, effect.choices);
        if (lost.length)
          return {
            refusal: `${m.name}'s capacity counts ${effect.model} records where ${effect.field} is ${lost.join(" or ")}; change the capacity first.`,
          };
      }
      return undefined;
    }
    if (effect.kind !== "rename-field") return undefined;
    renameInFormulas(spec, ir, effect.model, effect.from, effect.to);
    if (ir.models.find((m) => m.name === effect.model)?.ownedBy === effect.from)
      spec.set(["models", effect.model, "ownedBy"], effect.to);
    for (const m of ir.models) {
      const c = m.capacity;
      if (!c) continue;
      const path = ["models", m.name, "capacity"];
      if (m.name === effect.model && c.per === effect.from) {
        spec.set([...path, "per"], effect.to);
        if (typeof c.max === "string")
          spec.set([...path, "max"], `${effect.to}.${c.max.split(".")[1]}`);
      }
      if (m.name === effect.model && c.where && effect.from in c.where)
        spec.renameKey([...path, "where", effect.from], effect.to);
      const perField = m.fields.find((f) => f.name === c.per);
      const target = perField?.type.kind === "relation" ? perField.type.model : undefined;
      if (
        target === effect.model &&
        typeof c.max === "string" &&
        c.max === `${c.per}.${effect.from}`
      )
        spec.set([...path, "max"], `${c.per}.${effect.to}`);
    }
    return undefined;
  },
  schema: {
    type: "object",
    description: "The data the application stores. Model names are PascalCase.",
    propertyNames: { pattern: MODEL_NAME_PATTERN.source },
    additionalProperties: {
      type: "object",
      required: ["fields"],
      additionalProperties: false,
      properties: {
        fields: {
          type: "object",
          minProperties: 1,
          propertyNames: { pattern: FIELD_NAME_PATTERN.source, not: { enum: RESERVED_FIELDS } },
          additionalProperties: fieldSchema,
        },
        ownedBy: {
          type: "string",
          description: "A User field whose user owns the record, instead of its creator.",
        },
        access: {
          type: "object",
          description:
            'Exceptions to the default access in smithable.auth.yml, e.g. { delete: [admin] }. "owner" is the record\'s owner.',
          additionalProperties: false,
          properties: Object.fromEntries(
            ACCESS_OPERATIONS.map((op) => [op, { type: "array", items: { type: "string" } }]),
          ),
        },
        capacity: {
          type: "object",
          description:
            "At most max records per record that per refers to, e.g. { per: session, max: session.capacity }: a booking's places.",
          required: ["per", "max"],
          additionalProperties: false,
          properties: {
            per: { type: "string", description: "A required reference of this model." },
            max: {
              oneOf: [{ type: "integer", minimum: 1 }, { type: "string" }],
              description:
                'A whole number, or a whole-number field of the referenced record, "reference.field".',
            },
            where: {
              type: "object",
              description: "Only records with these choice or yes/no values count.",
            },
          },
        },
        ...textSchema,
      },
    },
  },
  parse(ctx, node) {
    if (node === undefined) return [];
    const models: ModelIR[] = [];
    const relationNodes: RelationNodes = new Map();
    ctx.define("model", USER_MODEL);
    for (const { key, keyNode, value } of mapEntries(ctx, node, `"models"`) ?? []) {
      if (key === USER_MODEL) {
        ctx.error(
          keyNode,
          "reserved-name",
          `"${USER_MODEL}" is built in: it is the people who sign in, described in smithable.auth.yml.`,
          `Every record already has an owner, the user who created it. To point at a user, add a field of type User (e.g. "seller: User"), or make that field the owner with "ownedBy".`,
        );
        continue;
      }
      if (!MODEL_NAME_PATTERN.test(key)) {
        ctx.error(
          keyNode,
          "invalid-name",
          `Model name "${key}" must start with a capital letter and use only letters and digits, like "Customer".`,
        );
        continue;
      }
      ctx.define("model", key);
      models.push(readModel(ctx, key, keyNode, value, relationNodes));
    }
    checkRelations(ctx, models, relationNodes);
    checkFormulas(ctx, models);
    return models;
  },
};

function readModel(
  ctx: ParseContext,
  name: string,
  keyNode: ParsedNode,
  node: ParsedNode | null,
  relationNodes: RelationNodes,
): ModelIR {
  const model: ModelIR = { name, fields: [] };
  const entries = mapEntries(ctx, node, `model "${name}"`);
  if (!entries) return model;
  const known = checkKeys(ctx, entries, `model "${name}"`, {
    allowed: ["fields", "ownedBy", "access", "capacity", ...TEXT_KEYS],
    later: ["unique", "examples"],
    content: ["label", "title"],
  });
  Object.assign(model, readSemanticText(ctx, known));
  const access = known.find((e) => e.key === "access");
  if (access) model.access = readModelAccess(ctx, access.value, `the access of "${name}"`);
  const ownedBy = known.find((e) => e.key === "ownedBy");
  if (ownedBy) {
    const field = readString(ctx, ownedBy.value, `"ownedBy" of "${name}"`);
    if (field !== undefined) {
      model.ownedBy = field;
      ctx.mark(`ownedBy:${name}`, ownedBy.value);
    }
  }
  const capacity = known.find((e) => e.key === "capacity");
  if (capacity) {
    const read = readCapacity(ctx, capacity.value, name);
    if (read) {
      model.capacity = read;
      ctx.mark(`capacity:${name}`, capacity.value);
    }
  }
  const fields = known.find((e) => e.key === "fields");
  if (!fields) {
    ctx.error(keyNode, "missing-key", `Model "${name}" needs "fields".`);
    return model;
  }
  const fieldEntries = mapEntries(ctx, fields.value, `the fields of "${name}"`) ?? [];
  if (fieldEntries.length === 0 && isMap(fields.value)) {
    ctx.error(fields.keyNode, "missing-key", `Model "${name}" needs at least one field.`);
  }
  for (const entry of fieldEntries) {
    const field = readField(ctx, name, entry);
    if (!field) continue;
    model.fields.push(field);
    if (field.type.kind === "relation") {
      ctx.reference("model", field.type.model, entry.value);
      relationNodes.set(`${name}.${field.name}`, entry.value ?? entry.keyNode);
    }
  }
  return model;
}

function readModelAccess(ctx: ParseContext, node: ParsedNode | null, where: string): ModelAccessIR {
  const access: ModelAccessIR = {};
  const entries = mapEntries(ctx, node, where) ?? [];
  for (const { key, value } of checkKeys(ctx, entries, where, { allowed: ACCESS_OPERATIONS })) {
    const op = key as (typeof ACCESS_OPERATIONS)[number];
    access[op] = readRoleList(ctx, value, `"${op}" in ${where}`, op !== "create");
  }
  return access;
}

export function readField(
  ctx: ParseContext,
  model: string,
  { key: name, keyNode, value }: Entry,
): FieldIR | undefined {
  const where = `field "${model}.${name}"`;
  if (!FIELD_NAME_PATTERN.test(name)) {
    ctx.error(
      keyNode,
      "invalid-name",
      `Field name "${name}" must start with a lowercase letter and use only letters and digits, like "email" or "createdBy".`,
    );
    return undefined;
  }
  if (RESERVED_FIELDS.includes(name)) {
    ctx.error(
      keyNode,
      "reserved-name",
      `"${name}" is added to every model automatically, so it cannot be declared.`,
      name === "owner"
        ? `Every record already has an owner: whoever created it. To make someone else the owner, add a user field (like "lender: User") and "ownedBy: lender".`
        : undefined,
    );
    return undefined;
  }
  if (isScalar(value) && typeof value.value === "string") {
    const shorthand = parseFieldShorthand(value.value);
    if (!shorthand.ok) {
      ctx.error(
        value,
        shorthand.code,
        `${capitalize(where)}: ${shorthand.message}`,
        shorthand.hint,
      );
      return undefined;
    }
    return buildField(ctx, name, shorthand.value, value, where);
  }
  if (isMap(value)) return readLongField(ctx, name, value, where);
  ctx.error(
    value ?? keyNode,
    "invalid-field",
    `${capitalize(where)} needs a type, like "string" or "int!".`,
  );
  return undefined;
}

function readLongField(
  ctx: ParseContext,
  name: string,
  node: ParsedNode,
  where: string,
): FieldIR | undefined {
  const entries = mapEntries(ctx, node, where) ?? [];
  const known = checkKeys(ctx, entries, where, {
    allowed: [
      "type",
      "required",
      "unique",
      "default",
      "min",
      "max",
      "formula",
      "examples",
      ...TEXT_KEYS,
    ],
    content: ["label", "help", "placeholder"],
  });
  const byKey = new Map(known.map((e) => [e.key, e]));
  const typeEntry = byKey.get("type");
  if (!typeEntry) {
    ctx.error(node, "missing-key", `${capitalize(where)} needs a "type".`);
    return undefined;
  }
  const typeText = readString(ctx, typeEntry.value, `The type of ${where}`);
  if (typeText === undefined) return undefined;
  const parsed = parseFieldShorthand(typeText);
  if (!parsed.ok) {
    ctx.error(typeEntry.value, parsed.code, `${capitalize(where)}: ${parsed.message}`, parsed.hint);
    return undefined;
  }
  if (parsed.value.defaultText !== undefined) {
    ctx.error(
      typeEntry.value,
      "invalid-field",
      `In the long form, write the default as a separate "default:" key.`,
    );
    return undefined;
  }
  const shorthand: FieldShorthand = { ...parsed.value };
  const requiredEntry = byKey.get("required");
  const uniqueEntry = byKey.get("unique");
  const required = requiredEntry && readBoolean(ctx, requiredEntry.value, `"required"`);
  const unique = uniqueEntry && readBoolean(ctx, uniqueEntry.value, `"unique"`);
  if (unique !== undefined) shorthand.unique = unique;

  const field = buildField(ctx, name, shorthand, typeEntry.value, where, byKey.get("default"));
  if (!field) return undefined;
  if (field.type.kind === "choice") {
    // A choice with a default always has a value; without one, only "required: true" makes it required.
    field.required = field.default !== undefined || required === true;
  } else {
    if (shorthand.required && required === false) {
      ctx.error(
        requiredEntry?.value,
        "conflict",
        `${capitalize(where)}: the type says "!" (required), but "required" is false.`,
      );
    }
    field.required = shorthand.required || required === true;
  }

  for (const bound of ["min", "max"] as const) {
    const entry = byKey.get(bound);
    if (!entry) continue;
    const n = readNumber(ctx, entry.value, `"${bound}"`);
    if (n === undefined) continue;
    // Numbers are bounded in value, texts in length.
    if (
      field.type.kind !== "scalar" ||
      ![...NUMERIC_TYPES, ...TEXT_TYPES].includes(field.type.name)
    ) {
      ctx.error(
        entry.keyNode,
        "invalid-field",
        `${capitalize(where)}: "${bound}" only applies to numbers (int, decimal, money) and texts (string, text: a length).`,
      );
      continue;
    }
    field[bound] = n;
  }
  if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
    ctx.error(
      byKey.get("min")?.value,
      "invalid-field",
      `${capitalize(where)}: "min" (${field.min}) is larger than "max" (${field.max}).`,
    );
  }
  if (typeof field.default === "number") {
    if (
      (field.min !== undefined && field.default < field.min) ||
      (field.max !== undefined && field.default > field.max)
    ) {
      ctx.error(
        byKey.get("default")?.value,
        "invalid-default",
        `${capitalize(where)}: the default ${field.default} is outside min/max.`,
      );
    }
  }
  const formulaEntry = byKey.get("formula");
  if (formulaEntry) {
    const formula = readFormula(ctx, formulaEntry.value, where);
    if (formula) field.formula = formula;
    ctx.mark(`formula:${where}`, formulaEntry.value);
    for (const key of ["required", "unique", "default", "min", "max"] as const) {
      const entry = byKey.get(key);
      if (entry) {
        ctx.error(
          entry.keyNode,
          "invalid-field",
          `${capitalize(where)} is computed by its formula, so "${key}" does not apply.`,
        );
      }
    }
    if (field.required) {
      ctx.error(
        typeEntry.value,
        "invalid-field",
        `${capitalize(where)} is computed by its formula, so it cannot be required ("!").`,
      );
    }
  }
  const examplesEntry = byKey.get("examples");
  if (examplesEntry) {
    if (!formulaEntry) {
      ctx.error(
        examplesEntry.keyNode,
        "invalid-field",
        `Examples on ${where} need a formula to check.`,
      );
    } else {
      field.examples = readExamples(ctx, examplesEntry.value, where);
      ctx.mark(`examples:${where}`, examplesEntry.value);
    }
  }
  Object.assign(field, readSemanticText(ctx, known));
  return field;
}

/** Parses a formula, reporting problems at the formula's position. */
function readFormula(ctx: ParseContext, node: ParsedNode | null, where: string): Expr | undefined {
  const text = readString(ctx, node, `The formula of ${where}`);
  if (text === undefined) return undefined;
  try {
    return parseFormula(text);
  } catch (error) {
    if (!(error instanceof FormulaError)) throw error;
    ctx.error(node, "invalid-formula", `${capitalize(where)}: ${error.message}`, error.hint);
    return undefined;
  }
}

/** Examples: a list of { input: { field: value }, expected: value }. */
function readExamples(ctx: ParseContext, node: ParsedNode | null, where: string): FieldExample[] {
  if (!isSeq(node)) {
    ctx.error(node, "expected-list", `The examples of ${where} must be a list.`);
    return [];
  }
  const examples: FieldExample[] = [];
  for (const item of node.items as ParsedNode[]) {
    const entries = mapEntries(ctx, item, `an example of ${where}`) ?? [];
    const known = checkKeys(ctx, entries, `an example of ${where}`, {
      allowed: ["input", "expected"],
    });
    const input = known.find((e) => e.key === "input");
    const expected = known.find((e) => e.key === "expected");
    if (!input || !expected) {
      ctx.error(item, "missing-key", `An example of ${where} needs "input" and "expected".`);
      continue;
    }
    const values: Record<string, FieldValue | null> = {};
    for (const entry of mapEntries(ctx, input.value, "the input of an example") ?? []) {
      values[entry.key] = scalarValue(ctx, entry.value);
    }
    examples.push({ input: values, expected: scalarValue(ctx, expected.value) });
  }
  return examples;
}

function scalarValue(ctx: ParseContext, node: ParsedNode | null): FieldValue | null {
  if (node === null || (isScalar(node) && node.value === null)) return null;
  if (isScalar(node) && ["string", "number", "boolean"].includes(typeof node.value)) {
    return node.value as FieldValue;
  }
  ctx.error(
    node,
    "invalid-example",
    'Example values must be single values, like 150, "standard" or true.',
  );
  return null;
}

/** Builds a field from its shorthand, converting the default from shorthand text or a long-form value. */
function buildField(
  ctx: ParseContext,
  name: string,
  shorthand: FieldShorthand,
  at: ParsedNode | null,
  where: string,
  defaultEntry?: Entry,
): FieldIR | undefined {
  const field: FieldIR = {
    name,
    type: shorthand.type,
    required: shorthand.required,
    unique: shorthand.unique,
  };
  let raw: FieldValue | undefined = shorthand.defaultText;
  let rawAt: ParsedNode | null = at;
  // A picture is a stored file with its description: nothing to compare or default to.
  if (
    field.type.kind === "scalar" &&
    (field.type.name === "picture" || field.type.name === "pictures")
  ) {
    if (field.unique || raw !== undefined || defaultEntry) {
      ctx.error(
        at,
        "invalid-field",
        `${capitalize(where)}: ${field.type.name} cannot be unique or have a default.`,
      );
      return undefined;
    }
  }
  if (defaultEntry) {
    rawAt = defaultEntry.value;
    const v = isScalar(defaultEntry.value) ? defaultEntry.value.value : undefined;
    if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") {
      ctx.error(
        defaultEntry.value,
        "invalid-default",
        `The default of ${where} must be a single value.`,
      );
      return undefined;
    }
    raw = v;
  }
  if (shorthand.type.kind === "choice") {
    if (raw === "none") return field;
    raw ??= shorthand.type.values[0];
  }
  if (raw === undefined) return field;
  if (typeof raw === "string" && raw.includes("(")) {
    try {
      field.defaultFormula = parseFormula(raw);
      ctx.mark(`default:${where}`, rawAt);
    } catch (error) {
      if (!(error instanceof FormulaError)) throw error;
      ctx.error(rawAt, "invalid-formula", `The default of ${where}: ${error.message}`, error.hint);
      return undefined;
    }
    return field;
  }
  const converted = parseDefault(shorthand.type, raw);
  if (!converted.ok) {
    ctx.error(rawAt, converted.code, `${capitalize(where)}: ${converted.message}`, converted.hint);
    return undefined;
  }
  field.default = converted.value;
  return field;
}

/** The keys of a model's capacity as written; what they name is checked once every model is parsed. */
function readCapacity(
  ctx: ParseContext,
  node: ParsedNode | null,
  model: string,
): CapacityIR | undefined {
  const where = `the capacity of "${model}"`;
  const entries = mapEntries(ctx, node, where);
  if (!entries) return undefined;
  const known = checkKeys(ctx, entries, where, { allowed: ["per", "max", "where"] });
  const per = known.find((e) => e.key === "per");
  const max = known.find((e) => e.key === "max");
  if (!per || !max) {
    ctx.error(node, "missing-key", `${capitalize(where)} needs "per" (a reference) and "max".`);
    return undefined;
  }
  const perName = readString(ctx, per.value, `"per" in ${where}`);
  if (perName === undefined) return undefined;
  let maxValue: number | string | undefined;
  if (isScalar(max.value) && typeof max.value.value === "number") {
    if (!Number.isInteger(max.value.value) || max.value.value < 1) {
      ctx.error(
        max.value,
        "invalid-value",
        `"max" in ${where} must be a whole number of at least 1.`,
      );
      return undefined;
    }
    maxValue = max.value.value;
  } else {
    maxValue = readString(ctx, max.value, `"max" in ${where}`);
    if (maxValue === undefined) return undefined;
  }
  const result: CapacityIR = { per: perName, max: maxValue };
  const conditions = known.find((e) => e.key === "where");
  const condition = conditions
    ? readCondition(ctx, conditions.value, `"where" in ${where}`)
    : undefined;
  if (condition) result.where = condition;
  return result;
}

/** A model's capacity names its own fields and the referenced model's: checked once all are parsed. */
function checkCapacity(ctx: ParseContext, models: ModelIR[], model: ModelIR): void {
  const capacity = model.capacity;
  if (!capacity) return;
  const at = ctx.at(`capacity:${model.name}`);
  const where = `the capacity of "${model.name}"`;
  const per = model.fields.find((f) => f.name === capacity.per);
  if (
    per?.type.kind !== "relation" ||
    per.type.many ||
    per.type.model === USER_MODEL ||
    !per.required
  ) {
    ctx.error(
      at,
      "invalid-capacity",
      `"per" in ${where} must be one of ${model.name}'s required references (a field like "session: Session!").`,
      didYouMean(
        capacity.per,
        model.fields
          .filter((f) => f.type.kind === "relation" && !f.type.many && f.required)
          .map((f) => f.name),
      ),
    );
    delete model.capacity;
    return;
  }
  const target = models.find((m) => m.name === (per.type as { model: string }).model);
  if (typeof capacity.max === "string") {
    const [ref, field, ...rest] = capacity.max.split(".");
    const found =
      ref === capacity.per && rest.length === 0
        ? target?.fields.find((f) => f.name === field)
        : undefined;
    if (found?.type.kind !== "scalar" || found.type.name !== "int" || found.formula) {
      ctx.error(
        at,
        "invalid-capacity",
        `"max" in ${where} must be a whole number, or a whole-number field of the ${target?.name ?? "referenced"} record, like "${capacity.per}.capacity".`,
        target
          ? didYouMean(
              field ?? "",
              target.fields
                .filter((f) => f.type.kind === "scalar" && f.type.name === "int")
                .map((f) => `${capacity.per}.${f.name}`),
            )
          : undefined,
      );
      delete model.capacity;
      return;
    }
  }
  for (const [name, wanted] of Object.entries(capacity.where ?? {})) {
    if (!conditionFits(model, name, wanted)) {
      ctx.error(
        at,
        "invalid-capacity",
        `"where" in ${where}: "${name}" must be a choice field of ${model.name} with one of its values (or a list of them), or a yes/no field with true or false.`,
      );
      delete model.capacity;
      return;
    }
  }
  if (!per.unique)
    ctx.warning(
      at,
      "capacity-no-unique",
      `${model.name} has a capacity per ${capacity.per}, but "${capacity.per}" is not unique: one person can take several places.`,
      `Write "${capacity.per}: ${(per.type as { model: string }).model}! unique" for one ${model.name.toLowerCase()} per person and ${target?.name.toLowerCase() ?? "record"} (unique per owner with private access).`,
    );
}

/** Where each relation field was written ("Model.field"), for positioning cross-model errors. */
type RelationNodes = Map<string, ParsedNode>;

/**
 * A list relation (`orders: Order[]`) needs exactly one reference back on the other model
 * (`customer: Customer!`), which holds the foreign key. A reference's column
 * (`customer` → `customerId`) must not clash with another field.
 */
function checkRelations(ctx: ParseContext, models: ModelIR[], relationNodes: RelationNodes): void {
  for (const model of models) {
    checkCapacity(ctx, models, model);
    if (model.ownedBy !== undefined) {
      const owner = model.fields.find((f) => f.name === model.ownedBy);
      if (owner?.type.kind !== "relation" || owner.type.model !== USER_MODEL || owner.type.many) {
        ctx.error(
          ctx.at(`ownedBy:${model.name}`),
          "invalid-owner",
          `"ownedBy" of "${model.name}" must name one of its ${USER_MODEL} fields.`,
          didYouMean(
            model.ownedBy,
            model.fields
              .filter((f) => f.type.kind === "relation" && f.type.model === USER_MODEL)
              .map((f) => f.name),
          ),
        );
      }
    }
    for (const field of model.fields) {
      if (field.type.kind !== "relation") continue;
      const at = relationNodes.get(`${model.name}.${field.name}`);
      if (field.type.model === USER_MODEL) {
        if (field.type.many) {
          ctx.error(
            at,
            "invalid-field",
            `"${model.name}.${field.name}": a list of users is not available in spec version 0.1.`,
            `Refer to one user with "${field.name}: ${USER_MODEL}".`,
          );
        }
        continue;
      }
      const target = models.find((m) => m.name === (field.type as { model: string }).model);
      if (!target) continue; // reported as an unknown model
      if (!field.type.many) {
        if (model.fields.some((f) => f.name === `${field.name}Id`)) {
          ctx.error(
            at,
            "invalid-field",
            `"${field.name}" stores its reference as "${field.name}Id", which is also the name of another field of ${model.name}.`,
          );
        }
        continue;
      }
      const back = target.fields.filter(
        (f) => f.type.kind === "relation" && !f.type.many && f.type.model === model.name,
      );
      if (back.length === 0) {
        const suggestion = model.name.charAt(0).toLowerCase() + model.name.slice(1);
        // Both sides listing each other (talks and attendees) need a record in between.
        const mutual = target.fields.some(
          (f) => f.type.kind === "relation" && f.type.many && f.type.model === model.name,
        );
        const link = `${model.name}${target.name}`;
        ctx.error(
          at,
          "missing-inverse",
          `${target.name} has no reference to ${model.name}, so "${model.name}.${field.name}" cannot list anything.`,
          mutual
            ? `${model.name} and ${target.name} list each other: add a model that links them, like ${link} with "${suggestion}: ${model.name}!" and "${target.name.charAt(0).toLowerCase()}${target.name.slice(1)}: ${target.name}!", and list ${link} records on both sides.`
            : `Add a field like "${suggestion}: ${model.name}!" to ${target.name}.`,
        );
      } else if (back.length > 1) {
        ctx.error(
          at,
          "ambiguous-inverse",
          `${target.name} refers to ${model.name} more than once (${back.map((f) => f.name).join(", ")}), so it is unclear which records "${model.name}.${field.name}" lists.`,
        );
      }
    }
  }
}

/**
 * Type-checks formulas and formula defaults once every model is known (aggregates read
 * other models), rejects cycles between computed fields, and checks examples' inputs.
 */
function checkFormulas(ctx: ParseContext, models: ModelIR[]): void {
  for (const model of models) checkModelFormulas(ctx, model, models);
}

/** The formulas, defaults and examples of one model (or a calculator, which is one to them). */
export function checkModelFormulas(ctx: ParseContext, model: ModelIR, models: ModelIR[]): void {
  {
    const computed = new Map(model.fields.filter((f) => f.formula).map((f) => [f.name, f]));
    for (const field of model.fields) {
      const where = `field "${model.name}.${field.name}"`;
      const expected = valueTypeOf({ ...field, type: field.type });
      for (const [kind, expr] of [
        ["formula", field.formula],
        ["default", field.defaultFormula],
      ] as const) {
        if (!expr) continue;
        try {
          const actual = checkFormula(expr, model, models);
          const fits = actual === expected || (actual === "date" && expected === "datetime");
          if (!fits)
            throw new FormulaError(
              `The ${kind === "formula" ? "formula" : "default"} gives a ${actual}, but the field is a ${expected ?? "relation"}.`,
              0,
            );
          if (kind === "default" && fieldsUsed(expr).includes(field.name)) {
            throw new FormulaError(`A default cannot use the field itself.`, 0);
          }
        } catch (error) {
          if (!(error instanceof FormulaError)) throw error;
          ctx.error(
            ctx.at(`${kind}:${where}`),
            "invalid-formula",
            `${capitalize(where)}: ${error.message}`,
            error.hint,
          );
        }
      }
      if (field.formula && dependsOn(field.name, field.name, computed, new Set())) {
        ctx.error(
          ctx.at(`formula:${where}`),
          "formula-cycle",
          `${capitalize(where)} depends on itself through other formulas.`,
        );
      }
      for (const example of field.examples ?? []) {
        for (const key of Object.keys(example.input)) {
          const input = model.fields.find((f) => f.name === key);
          if (!input || input.formula) {
            ctx.error(
              ctx.at(`examples:${where}`),
              "invalid-example",
              `An example of ${where} uses "${key}", which is not a stored field of ${model.name}.`,
              didYouMean(
                key,
                model.fields.filter((f) => !f.formula).map((f) => f.name),
              ),
            );
          }
        }
      }
    }
  }
}

function dependsOn(
  target: string,
  name: string,
  computed: Map<string, FieldIR>,
  seen: Set<string>,
): boolean {
  const formula = computed.get(name)?.formula;
  if (!formula || seen.has(name)) return false;
  seen.add(name);
  return fieldsUsed(formula).some(
    (used) => used === target || dependsOn(target, used, computed, seen),
  );
}
