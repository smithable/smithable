import { isScalar, type ParsedNode } from "yaml";
import {
  checkKeys,
  type Entry,
  mapEntries,
  type ParseContext,
  readBoolean,
  readRoleList,
  readString,
} from "../context.js";
import type { ActionIR, FieldIR } from "../ir.js";
import { capitalize } from "../naming.js";
import type { JsonSchema, SpecSection } from "../section.js";
import { parseFieldShorthand } from "./field-type.js";
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
 * Actions: operations of the application beyond create, edit and delete. In spec version 0.1
 * every action is custom: its input and output are declared here, and the behaviour is
 * code in src/custom/actions/.
 */
export const actionsSection: SpecSection<"actions"> = {
  key: "actions",
  required: false,
  schema: {
    type: "object",
    description: "Operations of the application beyond create, edit and delete.",
    propertyNames: { pattern: FIELD_NAME_PATTERN.source },
    additionalProperties: {
      type: "object",
      required: ["custom"],
      additionalProperties: false,
      properties: {
        custom: { const: true, description: "Implemented in src/custom/actions/." },
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
  parse(ctx, node) {
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
      const action = readAction(ctx, key, keyNode, value);
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
): ActionIR | undefined {
  const where = `action "${name}"`;
  const entries = mapEntries(ctx, node, where);
  if (!entries) return undefined;
  const known = checkKeys(ctx, entries, where, {
    allowed: ["custom", "input", "output", "allow", ...TEXT_KEYS],
    later: ["on", "when", "set", "confirm", "examples"],
    content: ["label", "title"],
  });
  const byKey = new Map(known.map((e) => [e.key, e]));
  const custom = byKey.get("custom");
  if (!custom || readBoolean(ctx, custom.value, `"custom"`) !== true) {
    ctx.error(
      custom?.value ?? keyNode,
      "missing-key",
      `${capitalize(where)} needs "custom: true". Standard actions (on/when/set) are not available in spec version 0.1 yet.`,
    );
    return undefined;
  }
  const input = byKey.get("input");
  const output = byKey.get("output");
  const allow = byKey.get("allow");
  return {
    name,
    custom: true,
    input: input ? readFields(ctx, input, `the input of ${where}`) : [],
    ...(output ? { output: readFields(ctx, output, `the output of ${where}`) } : {}),
    ...(allow ? { allow: readRoleList(ctx, allow.value, `"allow" of ${where}`, false) } : {}),
    ...readSemanticText(ctx, known),
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
