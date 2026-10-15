import { isMap, isScalar, isSeq, type ParsedNode } from "yaml";
import { conditionText, followRenamed, lostValues, readCondition } from "../condition.js";
import {
  checkKeys,
  type Entry,
  mapEntries,
  type ParseContext,
  readBoolean,
  readNameList,
  readNumber,
  readString,
} from "../context.js";
import type { YamlEditor } from "../edit.js";
import {
  checkFormula,
  type Expr,
  FormulaError,
  fieldsUsed,
  parseFormula,
  valueTypeOf,
} from "../formula.js";
import {
  type CapacityIR,
  conditionFits,
  type FieldExample,
  type FieldIR,
  type FieldType,
  type FieldValue,
  isUpload,
  type ModelIR,
  SCALAR_TYPES,
  type SpecIR,
  USER_MODEL,
} from "../ir.js";
import { capitalize } from "../naming.js";
import type { JsonSchema, SpecSection } from "../section.js";
import { sensitiveKind, sensitiveMessage } from "../sensitive.js";
import { didYouMean } from "../suggest.js";
import { type FieldShorthand, parseDefault, parseFieldShorthand } from "./field-type.js";
import { modelOperations, renameInFormulas, renameValuesInFormulas } from "./model-operations.js";
import { FIELD_NAME_PATTERN, MODEL_NAME_PATTERN, nameRule } from "./names.js";
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

/** A condition's value, as an action's `when` writes it: a choice's value, a list of them, or true/false. */
const conditionValueSchema: JsonSchema = {
  oneOf: [{ type: ["string", "boolean"] }, { type: "array", items: { type: "string" } }],
};

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
        type: {
          type: "string",
          pattern: typePattern,
          description:
            'What the field holds: a type (string, money, date, …), another model (Customer, or Order[] for all that refer here), or choices ("draft | sent | paid").',
        },
        required: {
          type: ["boolean", "object"],
          description:
            "A record cannot be saved without it; or a condition, e.g. { status: [inProgress, closed] }: required while the record fits it.",
          additionalProperties: conditionValueSchema,
        },
        by: {
          enum: ["app"],
          description:
            "app: the form never shows it; its default (a value, or ME()), an action, an incoming entry or code fills it.",
        },
        sequence: {
          type: "boolean",
          description:
            "On an int!: the app gives each new record the next number after the highest (an order or invoice number); the form never shows it.",
        },
        locked: {
          type: ["boolean", "object"],
          description:
            "true: set when the record is made, never changed after; or a condition, e.g. { status: closed }: read-only while the record fits it. An action's set may still change it.",
          additionalProperties: conditionValueSchema,
        },
        unique: { type: "boolean", description: "No two records may hold the same value." },
        default: {
          type: ["string", "number", "boolean"],
          description: `For choices, "none" means no default. ME() on a field that refers to User: who makes the record.`,
        },
        min: {
          type: "number",
          description: "The smallest number allowed; for a text, its shortest length.",
        },
        max: {
          type: "number",
          description: "The largest number allowed; for a text, its longest length.",
        },
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
            properties: {
              input: { type: "object", description: "The values of the fields the formula reads." },
              expected: { description: "What the formula must give for them." },
            },
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
      // Nor one a sibling's lock or requirement names (record-rules.md §2–3).
      const named = ruleConditions(ir, effect.model).find(
        (r) => r.field !== effect.field && effect.field in r.condition,
      );
      if (named)
        return {
          refusal: `${effect.model}.${named.field} is ${named.rule} when ${conditionText(named.condition)}; change its rules first.`,
        };
      followReview(spec, effect.model, effect.field);
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
    // Nor can a capacity count on a choice value that goes; one that was renamed is followed,
    // there and in the formulas that compare with it.
    if (effect.kind === "change-field") {
      if (effect.renamed)
        renameValuesInFormulas(spec, ir, effect.model, effect.field, effect.renamed);
      // A lock's or a requirement's condition follows a renamed value; one that goes is refused.
      for (const r of ruleConditions(ir, effect.model)) {
        const named = r.condition[effect.field];
        if (named === undefined) continue;
        const path = ["models", effect.model, "fields", r.field, r.key, effect.field];
        const lost = lostValues(followRenamed(spec, path, named, effect.renamed), effect.choices);
        if (lost.length)
          return {
            refusal: `${effect.model}.${r.field} is ${r.rule} when ${effect.field} is ${lost.join(" or ")}; change its rules first.`,
          };
      }
      for (const m of ir.models) {
        const named = m.name === effect.model ? m.capacity?.where?.[effect.field] : undefined;
        const wanted =
          named === undefined
            ? undefined
            : followRenamed(
                spec,
                ["models", m.name, "capacity", "where", effect.field],
                named,
                effect.renamed,
              );
        const lost = wanted === undefined ? [] : lostValues(wanted, effect.choices);
        if (lost.length)
          return {
            refusal: `${m.name}'s capacity counts ${effect.model} records where ${effect.field} is ${lost.join(" or ")}; change the capacity first.`,
          };
      }
      return undefined;
    }
    if (effect.kind !== "rename-field") return undefined;
    // A lock's or a requirement's condition names the field by its new name.
    for (const r of ruleConditions(ir, effect.model))
      if (effect.from in r.condition)
        spec.renameKey(
          [
            "models",
            effect.model,
            "fields",
            r.field === effect.from ? effect.to : r.field,
            r.key,
            effect.from,
          ],
          effect.to,
        );
    followReview(spec, effect.model, effect.from, effect.to);
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
          description: "What a record holds: each field's name and its type.",
          minProperties: 1,
          propertyNames: { pattern: FIELD_NAME_PATTERN.source, not: { enum: RESERVED_FIELDS } },
          additionalProperties: fieldSchema,
        },
        ownedBy: {
          type: "string",
          description: "A User field whose user owns the record, instead of its creator.",
        },
        review: {
          oneOf: [
            { type: "string", enum: ["all"] },
            { type: "array", items: { type: "string" }, minItems: 1 },
          ],
          description:
            "Pictures and files that wait for a reviewer before others see them: all (every picture and file field) or a list of them. A required one holds the whole record until it is approved; an optional one only the file.",
        },
        trash: {
          type: "boolean",
          description:
            "Deleted records stay in a trash for thirty days, where whoever may delete them can restore them; then they are removed for good.",
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
        ctx.error(keyNode, "invalid-name", nameRule("model", key));
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
  ctx.mark(`model:${name}`, keyNode);
  const entries = mapEntries(ctx, node, `model "${name}"`);
  if (!entries) return model;
  const known = checkKeys(ctx, entries, `model "${name}"`, {
    allowed: ["fields", "ownedBy", "capacity", "trash", "review", ...TEXT_KEYS],
    later: ["unique", "examples"],
    content: ["label", "title"],
    moved: {
      access: `who may read, add, change and delete ${name} records is said by the roles in smithable.auth.yml (roles.<role>.write: [${name}], and so on).`,
    },
  });
  Object.assign(model, readSemanticText(ctx, known));
  const trash = known.find((e) => e.key === "trash");
  if (trash) {
    const on = readBoolean(ctx, trash.value, `"trash" of "${name}"`);
    if (on) model.trash = true;
  }
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
  // A field's conditions (locked, required) name the model's other fields: read once all are in.
  const pending: ((model: ModelIR) => void)[] = [];
  for (const entry of fieldEntries) {
    const field = readField(ctx, name, entry, pending);
    if (!field) continue;
    model.fields.push(field);
    // A name that looks like data an app should not hold, or hold with great care.
    const sensitive = sensitiveKind(field);
    if (sensitive)
      ctx.warning(entry.keyNode, sensitive, sensitiveMessage(sensitive, name, field.name));
    if (field.type.kind === "relation") {
      ctx.reference("model", field.type.model, entry.value);
      relationNodes.set(`${name}.${field.name}`, entry.value ?? entry.keyNode);
    }
  }
  for (const read of pending) read(model);
  const review = known.find((e) => e.key === "review");
  if (review) readReview(ctx, model, review);
  return model;
}

/**
 * A field named in a model's `review` list that is renamed (to) or removed (no to): the list
 * follows, and goes when it is left empty. `review: all` names no field and needs nothing.
 */
function followReview(spec: YamlEditor, model: string, field: string, to?: string): void {
  const path = ["models", model, "review"];
  const listed = spec.get(path);
  if (!Array.isArray(listed) || !listed.includes(field)) return;
  const next = listed.flatMap((f) => (f === field ? (to ? [to] : []) : [f as string]));
  if (next.length) spec.set(path, next);
  else spec.remove(path);
}

/**
 * A model's `review` (docs/design/file-review.md): `all`, every picture and file field, or a
 * list of them. A name that is no such field is an error; `all` with none is a warning.
 */
function readReview(ctx: ParseContext, model: ModelIR, { value }: Entry): void {
  const uploads = model.fields.filter(isUpload).map((f) => f.name);
  const where = `"review" of "${model.name}"`;
  if (isScalar(value)) {
    if (readString(ctx, value, where) !== "all") {
      ctx.error(
        value,
        "invalid-value",
        `${capitalize(where)} is "all" or a list of picture and file fields.`,
      );
      return;
    }
    if (!uploads.length) {
      ctx.warning(
        value,
        "review-nothing",
        `${model.name} has no picture or file field, so "review: all" holds nothing.`,
        `Remove "review", or add a picture or file field.`,
      );
      return;
    }
    model.review = uploads;
    return;
  }
  const named = readNameList(ctx, value, where);
  const fields: string[] = [];
  for (const { name, at } of named) {
    if (uploads.includes(name)) {
      if (!fields.includes(name)) fields.push(name);
      continue;
    }
    const field = model.fields.find((f) => f.name === name);
    ctx.error(
      at,
      "review-not-file",
      field
        ? `"${name}" of ${model.name} is not a picture or a file, so there is nothing to review.`
        : `${model.name} has no field named "${name}".`,
      field
        ? `Review lists picture, pictures, file and files fields: ${uploads.join(", ") || "none here"}.`
        : didYouMean(name, uploads),
    );
  }
  if (fields.length) model.review = fields;
}

export function readField(
  ctx: ParseContext,
  model: string,
  { key: name, keyNode, value }: Entry,
  /** Reads to do once the model's fields are all in (a condition names its other fields). */
  pending: ((model: ModelIR) => void)[] = [],
): FieldIR | undefined {
  const where = `field "${model}.${name}"`;
  if (!FIELD_NAME_PATTERN.test(name)) {
    ctx.error(keyNode, "invalid-name", nameRule("field", name));
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
  if (isMap(value)) return readLongField(ctx, name, value, where, pending);
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
  pending: ((model: ModelIR) => void)[] = [],
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
      "by",
      "locked",
      "sequence",
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
  // "required" is true or false, or a condition (record-rules.md §3), read once the fields are in.
  const requiredWhen = requiredEntry && isMap(requiredEntry.value) ? requiredEntry : undefined;
  const required =
    requiredEntry && !requiredWhen
      ? readBoolean(ctx, requiredEntry.value, `"required"`)
      : undefined;
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
  readRules(ctx, field, byKey, where, pending, requiredWhen);
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

/** The conditions of a model's fields' locks and requirements, each with where it is written. */
function ruleConditions(ir: SpecIR, model: string) {
  return (ir.models.find((m) => m.name === model)?.fields ?? []).flatMap((f) => [
    ...(f.locked && f.locked !== true
      ? [{ field: f.name, key: "locked", rule: "locked", condition: f.locked }]
      : []),
    ...(f.requiredWhen
      ? [{ field: f.name, key: "required", rule: "required", condition: f.requiredWhen }]
      : []),
  ]);
}

/**
 * A field's rules on the record (record-rules.md §1–3): `by: app`, `locked` (true, or a
 * condition as an action's `when` writes it) and `required` as a condition. A computed field
 * has none of them: nobody fills it in.
 */
function readRules(
  ctx: ParseContext,
  field: FieldIR,
  byKey: Map<string, Entry>,
  where: string,
  pending: ((model: ModelIR) => void)[],
  requiredWhen: Entry | undefined,
): void {
  const by = byKey.get("by");
  const locked = byKey.get("locked");
  const sequence = byKey.get("sequence");
  for (const entry of [by, locked, requiredWhen, sequence]) {
    if (entry && field.formula) {
      ctx.error(
        entry.keyNode,
        "invalid-field",
        `${capitalize(where)} is computed by its formula, so "${entry.key}" does not apply.`,
      );
      return;
    }
  }
  if (by) {
    if (readString(ctx, by.value, `"by" of ${where}`) === "app") {
      field.byApp = true;
      ctx.mark(`by:${where}`, by.keyNode);
    } else
      ctx.error(
        by.value,
        "invalid-value",
        `"by" of ${where} is "app": the app fills it, and the form never shows it.`,
      );
  }
  if (sequence && readBoolean(ctx, sequence.value, `"sequence" of ${where}`)) {
    if (
      field.type.kind !== "scalar" ||
      field.type.name !== "int" ||
      !field.required ||
      field.default !== undefined ||
      field.defaultFormula
    )
      ctx.error(
        sequence.keyNode,
        "invalid-field",
        `${capitalize(where)} counts up only as a required whole number with no default: its type is "int!".`,
      );
    else {
      field.sequence = true;
      field.byApp = true;
    }
  }
  if (locked && !isMap(locked.value)) {
    if (readBoolean(ctx, locked.value, `"locked" of ${where}`)) field.locked = true;
  } else if (locked)
    pending.push((model) => {
      const condition = readCondition(ctx, locked.value, `"locked" of ${where}`, model, true);
      if (condition) field.locked = condition;
    });
  if (requiredWhen && field.required)
    ctx.error(
      requiredWhen.keyNode,
      "conflict",
      `${capitalize(where)} is always required (its type says "!", or a choice has a default), so a condition on "required" adds nothing.`,
    );
  else if (requiredWhen)
    pending.push((model) => {
      const condition = readCondition(
        ctx,
        requiredWhen.value,
        `"required" of ${where}`,
        model,
        true,
      );
      if (condition) field.requiredWhen = condition;
    });
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

/**
 * A default that reads like an expression (an operator between names, e.g. quantity * unitPrice)
 * was meant as a computed field: say how one is written.
 */
function computedHint(where: string, type: FieldType, raw: FieldValue): string | undefined {
  const names = /"(\w+)\.(\w+)"/.exec(where);
  if (!names || type.kind !== "scalar" || typeof raw !== "string") return undefined;
  if (!/[A-Za-z]\w*\s*[-+*/]\s*\S|\S\s*[-+*/]\s*[A-Za-z]/.test(raw)) return undefined;
  return `A computed field is written with a formula: \`addField ${names[1]} ${names[2]} ${type.name} --formula "${raw}"\`.`;
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
  // A picture or a document is a stored file: nothing to compare or default to.
  if (field.type.kind === "scalar" && isUpload(field)) {
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
  // ME(): who makes the record, for a field that refers to a person (record-rules.md §1).
  if (typeof raw === "string" && raw.replace(/\s/g, "") === "ME()") {
    if (field.type.kind === "relation" && field.type.model === "User" && !field.type.many) {
      field.defaultMe = true;
      return field;
    }
    ctx.error(
      rawAt,
      "invalid-default",
      `The default of ${where} is ME(), a person: the field must refer to User.`,
    );
    return undefined;
  }
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
    ctx.error(
      rawAt,
      converted.code,
      `${capitalize(where)}: ${converted.message}`,
      computedHint(where, shorthand.type, raw) ?? converted.hint,
    );
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
