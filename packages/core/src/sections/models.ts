import { isMap, isScalar, isSeq, type ParsedNode } from "yaml";
import {
  checkKeys,
  type Entry,
  mapEntries,
  type ParseContext,
  readBoolean,
  readNumber,
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
  type FieldExample,
  type FieldIR,
  type FieldValue,
  type ModelIR,
  SCALAR_TYPES,
} from "../ir.js";
import type { JsonSchema, SpecSection } from "../section.js";
import { didYouMean } from "../suggest.js";
import { type FieldShorthand, parseDefault, parseFieldShorthand } from "./field-type.js";
import { modelOperations } from "./model-operations.js";
import { FIELD_NAME_PATTERN, MODEL_NAME_PATTERN } from "./names.js";
import { readSemanticText, TEXT_KEYS } from "./text.js";
import { textSchema } from "./text-schema.js";

/** Fields every model gets automatically. */
const RESERVED_FIELDS = ["id", "owner", "createdAt", "updatedAt"];

const NUMERIC_TYPES = ["int", "decimal", "money"];

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
        ...textSchema,
      },
    },
  },
  parse(ctx, node) {
    if (node === undefined) return [];
    const models: ModelIR[] = [];
    const relationNodes: RelationNodes = new Map();
    for (const { key, keyNode, value } of mapEntries(ctx, node, `"models"`) ?? []) {
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
    allowed: ["fields", ...TEXT_KEYS],
    later: ["access", "ownedBy", "unique", "examples"],
    content: ["label", "title"],
  });
  Object.assign(model, readSemanticText(ctx, known));
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

function readField(
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
    if (field.type.kind !== "scalar" || !NUMERIC_TYPES.includes(field.type.name)) {
      ctx.error(
        entry.keyNode,
        "invalid-field",
        `${capitalize(where)}: "${bound}" only applies to numbers (int, decimal, money).`,
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
    for (const field of model.fields) {
      if (field.type.kind !== "relation") continue;
      const at = relationNodes.get(`${model.name}.${field.name}`);
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
        ctx.error(
          at,
          "missing-inverse",
          `${target.name} has no reference to ${model.name}, so "${model.name}.${field.name}" cannot list anything.`,
          `Add a field like "${suggestion}: ${model.name}!" to ${target.name}.`,
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
  for (const model of models) {
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
