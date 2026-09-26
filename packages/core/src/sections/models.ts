import { isMap, isScalar, type ParsedNode } from "yaml";
import {
  checkKeys,
  type Entry,
  mapEntries,
  type ParseContext,
  readBoolean,
  readNumber,
  readString,
} from "../context.js";
import { type FieldIR, type FieldValue, type ModelIR, SCALAR_TYPES } from "../ir.js";
import type { JsonSchema, SpecSection } from "../section.js";
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
    allowed: ["type", "required", "unique", "default", "min", "max", ...TEXT_KEYS],
    later: ["formula", "examples"],
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
  Object.assign(field, readSemanticText(ctx, known));
  return field;
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
