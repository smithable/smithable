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
import type { YamlEditor, YamlValue } from "../edit.js";
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
  type DeadlineIR,
  type FieldExample,
  type FieldIR,
  type FieldType,
  type FieldValue,
  isUpload,
  type ModelIR,
  SCALAR_TYPES,
  type SpecIR,
  type ThreadIR,
  type UniqueIR,
  type UniqueScope,
  USER_MODEL,
} from "../ir.js";
import { capitalize } from "../naming.js";
import type { JsonSchema, SpecSection } from "../section.js";
import { sensitiveKind, sensitiveMessage } from "../sensitive.js";
import { didYouMean } from "../suggest.js";
import { type FieldShorthand, parseDefault, parseFieldShorthand } from "./field-type.js";
import { modelOperations, renameInFormulas, renameValuesInFormulas } from "./model-operations.js";
import { FIELD_NAME_PATTERN, MODEL_NAME_PATTERN, nameRule } from "./names.js";
import {
  checkSchedules,
  followSchedules,
  occupiesSchema,
  readOccupies,
  readSchedule,
  scheduleSchema,
} from "./schedule.js";
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
        unique: {
          oneOf: [{ type: "boolean" }, { type: "string", enum: ["owner", "app"] }],
          description:
            "No two records may hold the same value: true (among one owner's records when records are read by their owners only, else in the whole app), owner or app to say which outright.",
        },
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
    const scheduled = followSchedules(spec, effect, ir.models);
    if (scheduled) return scheduled;
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
      followUnique(spec, effect.model, effect.field);
      followThread(spec, effect.model, effect.field);
      followNamedBy(spec, effect.model, effect.field);
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
    followUnique(spec, effect.model, effect.from, effect.to);
    followThread(spec, effect.model, effect.from, effect.to);
    followNamedBy(spec, effect.model, effect.from, effect.to);
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
        namedBy: {
          type: "string",
          description:
            "The field that names a record, shown as its title wherever one record is shown or referred to: a stored string, text or markdown field. Left out, the first short text field is the title, else the first long text, else the record's number.",
        },
        thread: {
          type: "object",
          additionalProperties: false,
          description:
            "The records as messages of a conversation (a page shows a list of them as a thread): which field is the body, who wrote it, which side is ours; what is left out is read from the fields.",
          properties: {
            body: {
              type: "string",
              description: "The message's text: a text or markdown field (or a string).",
            },
            author: {
              type: "string",
              description: "Who wrote it: a field that refers to User, or an email field.",
            },
            side: {
              type: "object",
              required: ["field", "ours"],
              additionalProperties: false,
              description:
                "Which side a message is on: a two-valued choice field, and the value that is our side.",
              properties: {
                field: { type: "string", description: "A choice field with two values." },
                ours: {
                  type: "string",
                  description: "The value that means our side (shown on the right).",
                },
              },
            },
          },
        },
        unique: {
          type: "array",
          minItems: 1,
          items: {
            oneOf: [
              { type: "array", items: { type: "string" }, minItems: 2 },
              {
                type: "object",
                required: ["fields"],
                additionalProperties: false,
                properties: {
                  fields: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 2,
                    description: "Two or more of the model's stored fields, unique together.",
                  },
                  scope: {
                    type: "string",
                    enum: ["owner", "app"],
                    description:
                      "owner: among one owner's records; app: in the whole app. Left out, as the access says, like a field's unique: true.",
                  },
                },
              },
            ],
          },
          description:
            "Fields unique together, e.g. [[customer, number]]: no two records hold the same values in all of them; { fields: [customer, number], scope: app } says where (owner: among one owner's records; app: in the whole app).",
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
            closes: {
              type: "string",
              description:
                'Until when a record may be added: a date-time of the referenced record ("session.startsAt"), as it is or a period before it ("2 hours before session.startsAt").',
            },
            cancelUntil: {
              type: "string",
              description:
                "Until when a record's owner may delete it (\"24 hours before session.startsAt\"); roles that delete everyone's pass.",
            },
            where: {
              type: "object",
              description: "Only records with these choice or yes/no values count.",
            },
          },
        },
        schedule: scheduleSchema,
        occupies: occupiesSchema,
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
    checkSchedules(ctx, models);
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
    allowed: [
      "fields",
      "ownedBy",
      "namedBy",
      "capacity",
      "schedule",
      "occupies",
      "trash",
      "review",
      "unique",
      "thread",
      ...TEXT_KEYS,
    ],
    later: ["examples"],
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
  const schedule = known.find((e) => e.key === "schedule");
  const readSched = schedule && readSchedule(ctx, schedule.value, name);
  if (readSched) model.schedule = readSched;
  const occupies = known.find((e) => e.key === "occupies");
  const readOcc = occupies && readOccupies(ctx, occupies.value, name);
  if (readOcc) {
    model.occupies = readOcc;
    ctx.mark(`occupies:${name}`, occupies?.value);
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
    if (field.type.kind === "relation")
      relationNodes.set(`${name}.${field.name}`, entry.value ?? entry.keyNode);
  }
  for (const read of pending) read(model);
  const review = known.find((e) => e.key === "review");
  if (review) readReview(ctx, model, review);
  const unique = known.find((e) => e.key === "unique");
  if (unique) readUniqueTogether(ctx, model, unique);
  const thread = known.find((e) => e.key === "thread");
  if (thread) readThread(ctx, model, thread);
  const namedBy = known.find((e) => e.key === "namedBy");
  if (namedBy) readNamedBy(ctx, model, namedBy);
  return model;
}

/**
 * A model's `namedBy` (docs/design/inference.md): the stored string, text or markdown field that
 * names a record. Said outright, so that no rule (and never a field's name) decides the title.
 */
function readNamedBy(ctx: ParseContext, model: ModelIR, { value, keyNode }: Entry): void {
  const where = `"namedBy" of "${model.name}"`;
  const name = readString(ctx, value, where);
  if (name === undefined) return;
  const f = model.fields.find((x) => x.name === name);
  if (!f) {
    ctx.error(keyNode, "unknown-field", `${model.name} has no field "${name}" (${where}).`);
    return;
  }
  const text =
    f.type.kind === "scalar" && ["string", "text", "markdown"].includes(f.type.name) && !f.formula;
  if (!text) {
    ctx.error(
      keyNode,
      "invalid-value",
      `${model.name}.${name} cannot name a ${model.name.toLowerCase()}: the title is a stored string, text or markdown field.`,
    );
    return;
  }
  model.namedBy = name;
  ctx.mark(`namedBy:${model.name}`, keyNode);
}

/** A field a model's `namedBy` names that is renamed (to) or removed (no to): the setting follows. */
function followNamedBy(spec: YamlEditor, model: string, field: string, to?: string): void {
  const path = ["models", model, "namedBy"];
  if (spec.get(path) !== field) return;
  if (to) spec.set(path, to);
  else spec.remove(path);
}

/**
 * A field named in a model's `review` list that is renamed (to) or removed (no to): the list
 * follows, and goes when it is left empty. `review: all` names no field and needs nothing.
 */
/**
 * A field named in a model's `unique` rules (docs/design/uniqueness.md) that is renamed (to) or
 * removed (no to): the rules follow; a rule left with one field goes, and the key when none is left.
 */
function followUnique(spec: YamlEditor, model: string, field: string, to?: string): void {
  const path = ["models", model, "unique"];
  const rules = spec.get(path);
  if (!Array.isArray(rules)) return;
  const names = (rule: unknown): string[] =>
    Array.isArray(rule) ? rule.map(String) : ((rule as { fields?: string[] })?.fields ?? []);
  if (!rules.some((rule) => names(rule).includes(field))) return;
  const next = rules.flatMap((rule) => {
    const fields = names(rule).flatMap((f) => (f === field ? (to ? [to] : []) : [f]));
    if (fields.length < 2) return [];
    const scope = Array.isArray(rule) ? undefined : (rule as { scope?: string }).scope;
    return [scope ? { fields, scope } : fields];
  });
  // A rule that shrank onto another goes too.
  const seen: string[][] = [];
  const kept = next.filter((rule) => {
    const fields = Array.isArray(rule) ? rule : rule.fields;
    if (seen.some((s) => s.length === fields.length && s.every((f) => fields.includes(f))))
      return false;
    seen.push(fields);
    return true;
  });
  if (kept.length) spec.set(path, kept as YamlValue);
  else spec.remove(path);
}

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
    // The model a relation names, at the type itself, for a rename to follow.
    if (shorthand.value.type.kind === "relation")
      ctx.reference("model", shorthand.value.type.model, value);
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
  if (parsed.value.type.kind === "relation")
    ctx.reference("model", parsed.value.type.model, typeEntry.value);
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
  const unique = uniqueEntry && readUniqueScope(ctx, uniqueEntry.value, `"unique" of ${where}`);
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
  if (field.unique && field.type.kind === "relation" && field.type.many) {
    ctx.error(at, "invalid-field", `${capitalize(where)}: a list of records cannot be unique.`);
    return undefined;
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
  const known = checkKeys(ctx, entries, where, {
    allowed: ["per", "max", "where", "closes", "cancelUntil"],
  });
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
  for (const key of ["closes", "cancelUntil"] as const) {
    const entry = known.find((e) => e.key === key);
    if (!entry) continue;
    const text = readString(ctx, entry.value, `"${key}" in ${where}`);
    if (text === undefined) return undefined;
    const deadline = readDeadline(text);
    if (!deadline) {
      ctx.error(
        entry.value,
        "invalid-value",
        `"${key}" in ${where} is a date-time of the ${perName} record ("${perName}.startsAt"), as it is or a period before it ("2 hours before ${perName}.startsAt": minutes, hours or days).`,
      );
      return undefined;
    }
    result[key] = deadline;
  }
  return result;
}

/** A deadline as written: "session.startsAt", or "2 hours before session.startsAt". */
export function readDeadline(text: string): DeadlineIR | undefined {
  const m =
    /^(?:(\d+) (minute|minutes|hour|hours|day|days) before )?([A-Za-z_]\w*\.[A-Za-z_]\w*)$/.exec(
      text.trim(),
    );
  if (!m) return undefined;
  const field = m[3] as string;
  if (!m[1]) return { field };
  const amount = Number(m[1]);
  if (amount < 1) return undefined;
  const unit = `${(m[2] as string).replace(/s$/, "")}s` as "minutes" | "hours" | "days";
  return { field, before: { amount, unit } };
}

/** A deadline as the spec writes it. */
export function deadlineText(deadline: DeadlineIR): string {
  if (!deadline.before) return deadline.field;
  const { amount, unit } = deadline.before;
  return `${amount} ${amount === 1 ? unit.slice(0, -1) : unit} before ${deadline.field}`;
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
  for (const key of ["closes", "cancelUntil"] as const) {
    const deadline = capacity[key];
    if (!deadline) continue;
    const [ref, field, ...rest] = deadline.field.split(".");
    const found =
      ref === capacity.per && rest.length === 0
        ? target?.fields.find((f) => f.name === field)
        : undefined;
    if (found?.type.kind !== "scalar" || found.type.name !== "datetime" || found.formula) {
      ctx.error(
        at,
        "invalid-capacity",
        `"${key}" in ${where} must name a date-time of the ${target?.name ?? "referenced"} record, like "${capacity.per}.startsAt".`,
        target
          ? didYouMean(
              field ?? "",
              target.fields
                .filter((f) => f.type.kind === "scalar" && f.type.name === "datetime" && !f.formula)
                .map((f) => `${capacity.per}.${f.name}`),
            )
          : undefined,
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

/** A field's `unique`: true or false, or where it is unique, `owner` or `app` (docs/design/uniqueness.md). */
function readUniqueScope(
  ctx: ParseContext,
  node: ParsedNode | null,
  what: string,
): boolean | UniqueScope | undefined {
  if (isScalar(node) && typeof node.value === "boolean") return node.value;
  if (isScalar(node) && (node.value === "owner" || node.value === "app")) return node.value;
  ctx.error(
    node,
    "expected-boolean",
    `${capitalize(what)} is true or false, or where the value is unique: owner (among one owner's records) or app (in the whole app).`,
  );
  return undefined;
}

/**
 * A model's `unique`: lists of two or more stored fields that are unique together, each a list
 * of names or `{ fields, scope }` (docs/design/uniqueness.md). A field already unique by itself
 * makes the pair pointless, so that is refused.
 */
function readUniqueTogether(ctx: ParseContext, model: ModelIR, { value, keyNode }: Entry): void {
  const where = `"unique" of "${model.name}"`;
  if (!isSeq(value)) {
    ctx.error(
      value ?? keyNode,
      "invalid-value",
      `${capitalize(where)} is a list of field lists, e.g. [[customer, number]].`,
    );
    return;
  }
  const storable = (f: FieldIR) =>
    !f.formula && !isUpload(f) && !(f.type.kind === "relation" && f.type.many);
  const together: UniqueIR[] = [];
  for (const item of value.items) {
    let names: ParsedNode | null | undefined;
    let scope: true | UniqueScope = true;
    if (isSeq(item)) names = item as ParsedNode;
    else if (isMap(item)) {
      const entries = mapEntries(ctx, item as ParsedNode, where) ?? [];
      const known = checkKeys(ctx, entries, where, { allowed: ["fields", "scope"] });
      names = known.find((e) => e.key === "fields")?.value;
      const scopeEntry = known.find((e) => e.key === "scope");
      if (scopeEntry) {
        const read = readString(ctx, scopeEntry.value, `"scope" of ${where}`);
        if (read === "owner" || read === "app") scope = read;
        else if (read !== undefined) {
          ctx.error(scopeEntry.value, "invalid-value", `"scope" of ${where} is owner or app.`);
          continue;
        }
      }
      if (!names) {
        ctx.error(item as ParsedNode, "missing-key", `Each entry of ${where} needs "fields".`);
        continue;
      }
    } else {
      ctx.error(
        item as ParsedNode,
        "invalid-value",
        `${capitalize(where)} is a list of field lists, e.g. [[customer, number]].`,
      );
      continue;
    }
    const named = readNameList(ctx, names, `a list of ${where}`);
    if (!named.length) continue;
    const fields = named.map((n) => n.name);
    if (new Set(fields).size < 2) {
      ctx.error(names, "invalid-value", `A list of ${where} names two or more different fields.`);
      continue;
    }
    let ok = true;
    const sameSet = together.find(
      (u) => u.fields.length === fields.length && u.fields.every((f) => fields.includes(f)),
    );
    if (sameSet) {
      ctx.error(names, "invalid-value", `${fields.join(" and ")} are listed twice in ${where}.`);
      continue;
    }
    for (const name of fields) {
      const field = model.fields.find((f) => f.name === name);
      if (!field) {
        ctx.error(names, "unknown-field", `${model.name} has no field "${name}" (in ${where}).`);
        ok = false;
      } else if (!storable(field)) {
        ctx.error(
          names,
          "invalid-value",
          `${model.name}.${name} cannot be part of ${where}: a computed field, a picture, a file or a list of records is not stored as one value.`,
        );
        ok = false;
      } else if (field.unique || field.sequence) {
        ctx.error(
          names,
          "invalid-value",
          `${model.name}.${name} is unique by itself${field.sequence ? " (a number counting up)" : ""}, so ${fields.join(" and ")} together add nothing; remove one.`,
        );
        ok = false;
      }
    }
    if (ok) together.push({ fields, scope });
  }
  if (together.length) {
    model.unique = together;
    ctx.mark(`unique:${model.name}`, keyNode);
  }
}

/**
 * A model's `thread` (docs/design/conversation.md §2): which field is a message's body (text,
 * markdown or string), who wrote it (a person or an email) and which side is ours (a two-valued
 * choice and one of its values). Each part optional; the rest is read from the fields.
 */
function readThread(ctx: ParseContext, model: ModelIR, { value, keyNode }: Entry): void {
  const where = `"thread" of "${model.name}"`;
  const entries = mapEntries(ctx, value, where);
  if (!entries) return;
  const known = checkKeys(ctx, entries, where, { allowed: ["body", "author", "side"] });
  const thread: ThreadIR = {};
  const field = (name: string, what: string, fits: (f: FieldIR) => boolean, kinds: string) => {
    const f = model.fields.find((x) => x.name === name);
    if (!f) {
      ctx.error(
        keyNode,
        "unknown-field",
        `${model.name} has no field "${name}" (${what} of ${where}).`,
      );
      return undefined;
    }
    if (!fits(f)) {
      ctx.error(
        keyNode,
        "invalid-value",
        `${model.name}.${name} cannot be the ${what} of a thread: it is ${kinds}.`,
      );
      return undefined;
    }
    return f;
  };
  const scalar = (f: FieldIR, ...names: string[]) =>
    f.type.kind === "scalar" && names.includes(f.type.name);
  const body = known.find((e) => e.key === "body");
  if (body) {
    const name = readString(ctx, body.value, `"body" of ${where}`);
    if (
      name &&
      field(
        name,
        "body",
        (f) => scalar(f, "text", "markdown", "string"),
        "a text, markdown or string field",
      )
    )
      thread.body = name;
  }
  const author = known.find((e) => e.key === "author");
  if (author) {
    const name = readString(ctx, author.value, `"author" of ${where}`);
    if (
      name &&
      field(
        name,
        "author",
        (f) =>
          scalar(f, "email") ||
          (f.type.kind === "relation" && f.type.model === USER_MODEL && !f.type.many),
        "a field that refers to User, or an email",
      )
    )
      thread.author = name;
  }
  const side = known.find((e) => e.key === "side");
  if (side) {
    const parts = mapEntries(ctx, side.value, `"side" of ${where}`);
    if (parts) {
      const sideKnown = checkKeys(ctx, parts, `"side" of ${where}`, { allowed: ["field", "ours"] });
      const fieldEntry = sideKnown.find((e) => e.key === "field");
      const oursEntry = sideKnown.find((e) => e.key === "ours");
      const name = fieldEntry && readString(ctx, fieldEntry.value, `"field" of "side" of ${where}`);
      const ours = oursEntry && readString(ctx, oursEntry.value, `"ours" of "side" of ${where}`);
      if (!name || !ours)
        ctx.error(
          side.keyNode,
          "missing-key",
          `"side" of ${where} needs "field" (a two-valued choice) and "ours" (the value that is our side).`,
        );
      else {
        const f = field(
          name,
          "side",
          (x) => x.type.kind === "choice" && x.type.values.length === 2,
          "not a choice with two values",
        );
        if (f?.type.kind === "choice") {
          if (!f.type.values.includes(ours))
            ctx.error(
              oursEntry?.value ?? side.keyNode,
              "invalid-value",
              `"${ours}" is not one of ${model.name}.${name}'s values (${f.type.values.join(", ")}).`,
            );
          else thread.side = { field: name, ours };
        }
      }
    }
  }
  if (Object.keys(thread).length) {
    model.thread = thread;
    ctx.mark(`thread:${model.name}`, keyNode);
  }
}

/**
 * A field a model's `thread` names that is renamed (to) or removed (no to): the setting follows,
 * and goes when nothing is left.
 */
function followThread(spec: YamlEditor, model: string, field: string, to?: string): void {
  const path = ["models", model, "thread"];
  const current = spec.get(path);
  if (typeof current !== "object" || current === null) return;
  const thread = { ...(current as Record<string, YamlValue>) };
  let touched = false;
  for (const key of ["body", "author"] as const) {
    if (thread[key] !== field) continue;
    touched = true;
    if (to) thread[key] = to;
    else delete thread[key];
  }
  const side = thread.side as { field?: string; ours?: string } | undefined;
  if (side?.field === field) {
    touched = true;
    if (to) thread.side = { ...side, field: to };
    else delete thread.side;
  }
  if (!touched) return;
  if (Object.keys(thread).length) spec.set(path, thread);
  else spec.remove(path);
}
