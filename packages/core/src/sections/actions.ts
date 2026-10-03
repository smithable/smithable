import { isScalar, type ParsedNode } from "yaml";
import { lostValues, readCondition } from "../condition.js";
import {
  checkKeys,
  type Entry,
  mapEntries,
  type ParseContext,
  readBoolean,
  readRoleList,
  readString,
} from "../context.js";
import {
  checkFormula,
  FormulaError,
  fieldsUsed,
  parseFormula,
  renameInFormula,
  valueTypeOf,
} from "../formula.js";
import type {
  ActionIR,
  ActionValueIR,
  FieldIR,
  ModelIR,
  SemanticText,
  StandardActionIR,
} from "../ir.js";
import { capitalize } from "../naming.js";
import type { JsonSchema, SpecSection } from "../section.js";
import { didYouMean } from "../suggest.js";
import { actionOperations } from "./action-operations.js";
import { parseDefault, parseFieldShorthand } from "./field-type.js";
import { FIELD_NAME_PATTERN } from "./names.js";
import { readSemanticText, TEXT_KEYS } from "./text.js";
import { textSchema } from "./text-schema.js";

const fieldsSchema: JsonSchema = {
  type: "object",
  propertyNames: { pattern: FIELD_NAME_PATTERN.source },
  additionalProperties: {
    type: "string",
    description: 'Field shorthand, e.g. "Customer!" or "int".',
  },
};

/**
 * Actions: operations of the application beyond create, edit and delete. A custom action
 * declares its input and output here and its behavior is code in src/custom/actions/; a
 * standard action sets fields of one record (on, when, set) and needs no code.
 */
export const actionsSection: SpecSection<"actions"> = {
  key: "actions",
  required: false,
  operations: actionOperations,
  schema: {
    type: "object",
    description: "Operations of the application beyond create, edit and delete.",
    propertyNames: { pattern: FIELD_NAME_PATTERN.source },
    additionalProperties: {
      type: "object",
      description: "Custom (custom: true, with input and output) or standard (on, when, set).",
      oneOf: [{ required: ["custom"] }, { required: ["on", "set"] }],
      additionalProperties: false,
      properties: {
        custom: { const: true, description: "Implemented in src/custom/actions/." },
        on: {
          type: "string",
          description: "A standard action: the model whose record it changes.",
        },
        when: {
          type: "object",
          description:
            "Offered and allowed only for records with these choice values (or lists of them) or yes/no values, e.g. { status: [investigating, identified] }.",
        },
        set: {
          type: "object",
          minProperties: 1,
          propertyNames: { pattern: FIELD_NAME_PATTERN.source },
          additionalProperties: { type: ["string", "number", "boolean"] },
          description:
            'The new values: a literal the field accepts, or a formula on the record as it was, e.g. { status: resolved, resolvedAt: "NOW()" }.',
        },
        input: { ...fieldsSchema, description: "The values the action needs." },
        output: { ...fieldsSchema, description: "The values the action returns, if any." },
        allow: {
          type: "array",
          items: { type: "string" },
          description: "Only these roles may run the action (admins always can).",
        },
        ...textSchema,
      },
    },
  },
  follow(spec, effect, ir) {
    const standard = ir.actions.filter((a): a is StandardActionIR => !a.custom);
    if (effect.kind === "remove-field" || effect.kind === "change-field") {
      for (const action of standard) {
        if (action.on !== effect.model) continue;
        const wanted = action.when?.[effect.field];
        const set = action.set.find((v) => v.field === effect.field);
        const lost =
          effect.kind === "change-field" &&
          ((wanted !== undefined && lostValues(wanted, effect.choices).length > 0) ||
            (set &&
              "value" in set &&
              typeof set.value === "string" &&
              !effect.choices.includes(set.value)));
        const uses =
          effect.kind === "remove-field" &&
          (wanted !== undefined ||
            set !== undefined ||
            action.set.some((v) => "formula" in v && fieldsUsed(v.formula).includes(effect.field)));
        if (lost || uses)
          return {
            refusal: `The action "${action.name}" uses ${effect.model}.${effect.field}${lost ? " and a value it would no longer have" : ""}; change or remove the action first.`,
          };
      }
      return undefined;
    }
    if (effect.kind !== "rename-field") return undefined;
    for (const action of standard) {
      const path = ["actions", action.name];
      const model = ir.models.find((m) => m.name === action.on);
      // A list of the renamed field's model, followed in an aggregate (`SUM(lines.amount)`).
      const listOf = (list: string) => {
        const type = model?.fields.find((f) => f.name === list)?.type;
        return type?.kind === "relation" && type.many && type.model === effect.model;
      };
      for (const v of action.set)
        if ("formula" in v) {
          const next = renameInFormula(v.text, (name, list) =>
            name !== effect.from
              ? undefined
              : (list === undefined ? action.on === effect.model : listOf(list))
                ? effect.to
                : undefined,
          );
          if (next !== v.text) spec.set([...path, "set", v.field], next);
        }
      if (action.on !== effect.model) continue;
      if (action.when && effect.from in action.when)
        spec.renameKey([...path, "when", effect.from], effect.to);
      if (action.set.some((v) => v.field === effect.from))
        spec.renameKey([...path, "set", effect.from], effect.to);
    }
    return undefined;
  },
  parse(ctx, node, parsed) {
    if (node === undefined) return [];
    const actions: ActionIR[] = [];
    for (const { key, keyNode, value } of mapEntries(ctx, node, `"actions"`) ?? []) {
      if (!FIELD_NAME_PATTERN.test(key)) {
        ctx.error(
          keyNode,
          "invalid-name",
          `Action name "${key}" must start with a lowercase letter and use only letters and digits, like "mergeCustomers".`,
        );
        continue;
      }
      ctx.define("action", key);
      const action = readAction(ctx, key, keyNode, value, parsed.models ?? []);
      if (action) actions.push(action);
    }
    return actions;
  },
};

function readAction(
  ctx: ParseContext,
  name: string,
  keyNode: ParsedNode,
  node: ParsedNode | null,
  models: ModelIR[],
): ActionIR | undefined {
  const where = `action "${name}"`;
  const entries = mapEntries(ctx, node, where);
  if (!entries) return undefined;
  const known = checkKeys(ctx, entries, where, {
    allowed: ["custom", "input", "output", "on", "when", "set", "allow", ...TEXT_KEYS],
    later: ["confirm", "examples"],
    content: ["label", "title"],
  });
  const byKey = new Map(known.map((e) => [e.key, e]));
  const allow = byKey.get("allow");
  const common = {
    name,
    ...(allow ? { allow: readRoleList(ctx, allow.value, `"allow" of ${where}`, false) } : {}),
    ...readSemanticText(ctx, known),
  };
  const custom = byKey.get("custom");
  const standard = ["on", "when", "set"].map((k) => byKey.get(k)).filter((e) => e !== undefined);
  if (custom && standard.length) {
    ctx.error(
      standard[0]?.keyNode ?? keyNode,
      "invalid-action",
      `${capitalize(where)} is either custom (custom: true, with input and output) or standard (on, when and set), not both.`,
    );
    return undefined;
  }
  if (standard.length) return readStandardAction(ctx, where, keyNode, byKey, models, common);
  if (!custom || readBoolean(ctx, custom.value, `"custom"`) !== true) {
    ctx.error(
      custom?.value ?? keyNode,
      "missing-key",
      `${capitalize(where)} needs "custom: true" (its behavior is code), or "on" and "set" (it sets fields of a record).`,
    );
    return undefined;
  }
  const input = byKey.get("input");
  const output = byKey.get("output");
  return {
    ...common,
    custom: true,
    input: input ? readFields(ctx, input, `the input of ${where}`) : [],
    ...(output ? { output: readFields(ctx, output, `the output of ${where}`) } : {}),
  };
}

/** Fields an action cannot set: computed, references, lists, pictures. */
function unsettable(field: FieldIR): string | undefined {
  if (field.formula) return "it is computed";
  if (field.type.kind === "relation") return "it is a reference";
  if (
    field.type.kind === "scalar" &&
    (field.type.name === "picture" || field.type.name === "pictures")
  )
    return "it is a picture";
  return undefined;
}

function readStandardAction(
  ctx: ParseContext,
  where: string,
  keyNode: ParsedNode,
  byKey: Map<string, Entry>,
  models: ModelIR[],
  common: Pick<StandardActionIR, "name" | "allow" | keyof SemanticText>,
): StandardActionIR | undefined {
  for (const key of ["input", "output"]) {
    const entry = byKey.get(key);
    if (entry)
      ctx.error(
        entry.keyNode,
        "invalid-action",
        `${capitalize(where)} sets fields of a record, so it has no "${key}"; a custom action (custom: true) takes input and output.`,
      );
  }
  const on = byKey.get("on");
  const set = byKey.get("set");
  if (!on || !set) {
    ctx.error(
      (on ?? set)?.keyNode ?? keyNode,
      "missing-key",
      `${capitalize(where)} needs "on" (the model whose record it changes) and "set" (the new values).`,
    );
    return undefined;
  }
  const modelName = readString(ctx, on.value, `"on" of ${where}`);
  if (modelName === undefined) return undefined;
  const model = models.find((m) => m.name === modelName);
  if (!model) {
    ctx.error(
      on.value,
      "unknown-model",
      `"on" of ${where}: there is no model named "${modelName}".`,
      didYouMean(
        modelName,
        models.map((m) => m.name),
      ),
    );
    return undefined;
  }
  const whenEntry = byKey.get("when");
  const when = whenEntry
    ? readCondition(ctx, whenEntry.value, `"when" of ${where}`, model)
    : undefined;
  const values: ActionValueIR[] = [];
  const setEntries = mapEntries(ctx, set.value, `"set" of ${where}`);
  if (setEntries?.length === 0)
    ctx.error(
      set.value,
      "invalid-set",
      `"set" of ${where} needs at least one field and its new value.`,
    );
  for (const { key, keyNode: at, value } of setEntries ?? []) {
    const field = model.fields.find((f) => f.name === key);
    if (!field) {
      ctx.error(
        at,
        "unknown-field",
        `"set" of ${where}: ${model.name} has no field named "${key}".`,
        didYouMean(
          key,
          model.fields.filter((f) => !unsettable(f)).map((f) => f.name),
        ),
      );
      continue;
    }
    const why = unsettable(field);
    if (why) {
      ctx.error(
        at,
        "invalid-set",
        `"set" of ${where}: ${model.name}.${key} cannot be set, ${why}.`,
      );
      continue;
    }
    const raw = isScalar(value) ? value.value : undefined;
    if (raw === null || raw === undefined || raw === "") {
      ctx.error(
        value ?? at,
        "invalid-set",
        `"set" of ${where}: ${key} needs a value (asking the person for one comes in a later version).`,
      );
      continue;
    }
    if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") {
      ctx.error(
        value,
        "invalid-set",
        `"set" of ${where}: ${key} must be a single value or a formula.`,
      );
      continue;
    }
    // As a default: a value with parentheses is a formula, anything else a literal.
    if (typeof raw === "string" && raw.includes("(")) {
      try {
        const formula = parseFormula(raw);
        const actual = checkFormula(formula, model, models);
        const expected = valueTypeOf(field);
        if (!(actual === expected || (actual === "date" && expected === "datetime")))
          throw new FormulaError(`The formula gives a ${actual}, but ${key} is a ${expected}.`, 0);
        values.push({ field: key, formula, text: raw });
      } catch (error) {
        if (!(error instanceof FormulaError)) throw error;
        ctx.error(
          value,
          "invalid-formula",
          `"set" of ${where}, ${key}: ${error.message}`,
          error.hint,
        );
      }
      continue;
    }
    const converted = parseDefault(field.type, raw);
    if (!converted.ok) {
      ctx.error(
        value,
        converted.code,
        `"set" of ${where}, ${key}: ${converted.message}`,
        converted.hint,
      );
      continue;
    }
    values.push({ field: key, value: converted.value });
  }
  if (!values.length) return undefined;
  // Only when every value is one the condition already requires does the action change nothing.
  if (values.every((v) => "value" in v && when?.[v.field] === v.value))
    ctx.warning(
      set.value,
      "action-changes-nothing",
      `${capitalize(where)} runs only on records that already have the values it sets: it leaves the record as it was.`,
    );
  const rules = byKey.get("rules");
  if (rules)
    ctx.warning(
      rules.keyNode,
      "rules-not-enforced",
      `The rules of ${where} are documentation only: a standard action does what "set" says.`,
    );
  return {
    ...common,
    custom: false,
    input: [],
    on: model.name,
    ...(when ? { when } : {}),
    set: values,
  };
}

/** Input or output fields: shorthand only; no lists, no defaults. */
function readFields(ctx: ParseContext, entry: Entry, where: string): FieldIR[] {
  const fields: FieldIR[] = [];
  for (const { key, keyNode, value } of mapEntries(ctx, entry.value, where) ?? []) {
    if (!FIELD_NAME_PATTERN.test(key)) {
      ctx.error(
        keyNode,
        "invalid-name",
        `"${key}" in ${where} must start with a lowercase letter and use only letters and digits.`,
      );
      continue;
    }
    const text =
      isScalar(value) && typeof value.value === "string"
        ? value.value
        : readString(ctx, value, `"${key}" in ${where}`);
    if (text === undefined) continue;
    const parsed = parseFieldShorthand(text);
    if (!parsed.ok) {
      ctx.error(value, parsed.code, `"${key}" in ${where}: ${parsed.message}`, parsed.hint);
      continue;
    }
    const { type, required, unique, defaultText } = parsed.value;
    if (type.kind === "relation" && type.many) {
      ctx.error(
        value,
        "invalid-field",
        `"${key}" in ${where}: a list of records cannot be an input or output.`,
      );
      continue;
    }
    if (unique || defaultText !== undefined) {
      ctx.error(
        value,
        "invalid-field",
        `"${key}" in ${where}: "unique" and defaults do not apply here.`,
      );
      continue;
    }
    if (type.kind === "relation") ctx.reference("model", type.model, value);
    fields.push({ name: key, type, required: required || type.kind === "choice", unique: false });
  }
  return fields;
}
