import { conditionArgs } from "../condition.js";
import { type AnyOperation, type Operation, OperationError, refTo } from "../operation.js";
import { FIELD_NAME_PATTERN } from "./names.js";

const fields = (description: string) => ({
  type: "object",
  propertyNames: { pattern: FIELD_NAME_PATTERN.source },
  additionalProperties: { type: "string" },
  description,
});

/** An action's values: text from the command line, or a model's JSON (numbers, true, null). */
const values = (description: string) => ({
  type: "object",
  propertyNames: { pattern: FIELD_NAME_PATTERN.source },
  additionalProperties: { type: ["string", "number", "boolean", "null"] },
  description,
});

type Value = string | number | boolean | null;

/**
 * Adds an action. With `on` and `set` it is standard: it sets fields of one record, offered on
 * the model's crud page (when it has exactly one) for records `when` fits. Without, it is custom:
 * what it takes and returns, its behavior code in src/custom/actions/ that `smithable code`
 * starts as a stub.
 */
const addAction: Operation<{
  action: string;
  on?: string;
  when?: Record<string, string | boolean | string[]>;
  set?: Record<string, Value>;
  add?: Record<string, Value | Record<string, Value>>;
  copy?: Record<string, Value>;
  with?: string[];
  input?: Record<string, string>;
  output?: Record<string, string>;
  allow?: string[];
  intent?: string;
}> = {
  name: "addAction",
  summary:
    "Add an action: standard with --on and --set (it sets fields of a record), else custom (its behavior is code in src/custom/actions/).",
  schema: {
    type: "object",
    required: ["action"],
    additionalProperties: false,
    properties: {
      action: { type: "string", minLength: 1, description: "camelCase name, e.g. mergeCustomers." },
      on: refTo(
        { ref: "model", label: "Changes a record of" },
        { description: "A standard action: the model whose record it changes." },
      ),
      when: {
        type: "object",
        propertyNames: { pattern: FIELD_NAME_PATTERN.source },
        additionalProperties: {
          type: ["string", "boolean", "array"],
          items: { type: "string" },
        },
        description:
          'Only for records with these values, e.g. { status: "investigating | identified" } or { status: [investigating, identified] }.',
      },
      set: values(
        'The new values: a value, a formula, or nothing to ask the person, e.g. { status: canceled, cancelReason: "" }.',
      ),
      add: {
        type: "object",
        additionalProperties: {
          type: ["string", "number", "boolean", "null", "object"],
          additionalProperties: { type: ["string", "number", "boolean", "null"] },
        },
        description:
          'A related record to create, by model, e.g. { IncidentUpdate: { status: resolved, at: "NOW()", message: "" } }, or as Model.field pairs from the command line.',
      },
      copy: values(
        'A copy of the record instead of a change: what differs (a value, a formula, or nothing to ask), e.g. { status: draft, number: "" }; empty copies as is.',
      ),
      with: {
        type: "array",
        items: { type: "string" },
        description: "Lists of the model whose records the copy takes along, e.g. [lines].",
      },
      input: fields(
        'A custom action: the values it needs, as field shorthand, e.g. { keep: "Customer!" }.',
      ),
      output: fields("A custom action: the values it returns, if any."),
      allow: refTo(
        { ref: "role", label: "Who may run it" },
        { description: "Roles from smithable.auth.yml; none means the default access." },
        true,
      ),
      intent: { type: "string", description: "What it is for, in a sentence." },
    },
  },
  positional: ["action", "...input"],
  describe: ({ action, on }) => `Add the ${on ? "standard" : "custom"} action ${action}`,
  destructive: () => false,
  apply(
    { spec },
    {
      action,
      on,
      when = {},
      set = {},
      add = {},
      copy,
      with: lists = [],
      input = {},
      output = {},
      allow = [],
      intent,
    },
    ir,
  ) {
    if (!FIELD_NAME_PATTERN.test(action))
      throw new OperationError(
        `Action name "${action}" must start with a lowercase letter and use only letters and digits, like "mergeCustomers".`,
      );
    if (ir.actions.some((a) => a.name === action))
      throw new OperationError(`Action "${action}" already exists.`);
    const text = {
      ...(allow.length ? { allow } : {}),
      ...(intent?.trim() ? { intent: intent.trim() } : {}),
    };
    if (!on) {
      if (
        Object.keys(set).length ||
        Object.keys(when).length ||
        Object.keys(add).length ||
        copy ||
        lists.length
      )
        throw new OperationError(
          `A standard action needs "on": the model whose record it changes.`,
        );
      spec.add(["actions"], action, {
        custom: true,
        ...(Object.keys(input).length ? { input } : {}),
        ...(Object.keys(output).length ? { output } : {}),
        ...text,
      });
      return [];
    }
    if (Object.keys(input).length || Object.keys(output).length)
      throw new OperationError(
        "A standard action sets fields of a record, so it takes no input or output.",
      );
    const model = ir.models.find((m) => m.name === on);
    if (!model) throw new OperationError(`There is no model named "${on}".`);
    if (!Object.keys(set).length && !Object.keys(add).length && !copy)
      throw new OperationError(
        `A standard action needs "set" (the new values), "add" (a related record), both, or "copy".`,
      );
    // Command-line values are text: a yes/no or a number becomes one, as the field holds it;
    // nothing means the person is asked for it.
    const typed = (field: string, value: Value, of = model): Value => {
      if (typeof value !== "string") return value;
      if (value === "") return null;
      const type = of.fields.find((f) => f.name === field)?.type;
      if (value.includes("(") || type?.kind !== "scalar") return value;
      if (type.name === "bool" && (value === "true" || value === "false")) return value === "true";
      if (
        ["int", "decimal", "money"].includes(type.name) &&
        value.trim() &&
        !Number.isNaN(Number(value))
      )
        return Number(value);
      return value;
    };
    // "IncidentUpdate.status=resolved": the records to add, grouped by model.
    const added: Record<string, Record<string, string | number | boolean | null>> = {};
    // A model's values as a map ({ IncidentUpdate: { status: resolved } }), as the YAML reads.
    const pairs = Object.entries(add).flatMap(([key, value]) =>
      value !== null && typeof value === "object"
        ? Object.entries(value).map(([f, v]) => [`${key}.${f}`, v] as const)
        : [[key, value] as const],
    );
    for (const [key, value] of pairs) {
      const [name, field] = key.split(".");
      const target = ir.models.find((m) => m.name === name);
      if (!name || !field || !target)
        throw new OperationError(`"${key}" in "add" must be Model.field, with a model of the app.`);
      added[name] = { ...added[name], [field]: typed(field, value, target) };
    }
    spec.add(["actions"], action, {
      on,
      ...(Object.keys(when).length ? { when: conditionArgs(when) } : {}),
      ...(Object.keys(set).length
        ? { set: Object.fromEntries(Object.entries(set).map(([k, v]) => [k, typed(k, v)])) }
        : {}),
      ...(Object.keys(added).length ? { add: added } : {}),
      ...(copy
        ? { copy: Object.fromEntries(Object.entries(copy).map(([k, v]) => [k, typed(k, v)])) }
        : {}),
      ...(lists.length ? { with: lists } : {}),
      ...text,
    });
    // One operation gives a working button: on the model's crud page, when there is just one.
    const pages = ir.pages.filter((p) => p.pattern.kind === "crud" && p.pattern.model === on);
    const page = pages.length === 1 ? pages[0] : undefined;
    if (page?.actions) spec.set(["pages", page.id, "actions"], [...page.actions, action]);
    else if (page) spec.add(["pages", page.id], "actions", [action]);
    return [];
  },
};

export const actionOperations: AnyOperation[] = [addAction];
