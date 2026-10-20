import { conditionArgs } from "../condition.js";
import type { ModelIR } from "../ir.js";
import { type AnyOperation, type Operation, OperationError, refTo } from "../operation.js";
import { FIELD_NAME_PATTERN, nameRule } from "./names.js";

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
 * Command-line values are text: a yes/no or a number becomes one, as the model's field holds
 * it; nothing means the person is asked for it.
 */
function typed(of: ModelIR, field: string, value: Value): Value {
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
}
const typedAll = (of: ModelIR, values: Record<string, Value>) =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, typed(of, k, v)]));

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
      intent,
    },
    ir,
  ) {
    if (!FIELD_NAME_PATTERN.test(action)) throw new OperationError(nameRule("action", action));
    if (ir.actions.some((a) => a.name === action))
      throw new OperationError(`Action "${action}" already exists.`);
    const text = {
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
      added[name] = { ...added[name], [field]: typed(target, field, value) };
    }
    spec.add(["actions"], action, {
      on,
      ...(Object.keys(when).length ? { when: conditionArgs(when) } : {}),
      ...(Object.keys(set).length ? { set: typedAll(model, set) } : {}),
      ...(Object.keys(added).length ? { add: added } : {}),
      ...(copy ? { copy: typedAll(model, copy) } : {}),
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

const named = {
  type: "string",
  minLength: 1,
  description: "The action's name, e.g. mergeCustomers.",
};

/**
 * Changes an action there is: its intent, the records it is offered for, or the values a
 * standard action sets. Each part named replaces what was there, and an empty one removes it.
 * Who may run it is grant's (a role's `actions`); anything else is removeAction and addAction.
 */
const setAction: Operation<{
  action: string;
  intent?: string;
  when?: Record<string, string | boolean | string[]>;
  set?: Record<string, Value>;
}> = {
  name: "setAction",
  summary:
    "Change an action: its intent, the records it is for (--when) or the values it sets (--set). Each replaces what was there; an empty one removes it. Who may run it is grant <role> actions <name>.",
  schema: {
    type: "object",
    required: ["action"],
    additionalProperties: false,
    properties: {
      action: named,
      intent: {
        type: "string",
        description: 'What it is for, in a sentence; "" removes it.',
      },
      when: {
        type: "object",
        propertyNames: { pattern: FIELD_NAME_PATTERN.source },
        additionalProperties: {
          type: ["string", "boolean", "array"],
          items: { type: "string" },
        },
        description:
          'A standard action: only for records with these values, e.g. { status: "todo | doing" }; empty means every record.',
      },
      set: values(
        'A standard action: the new values, all of them, e.g. { status: done, doneOn: "TODAY()" }.',
      ),
    },
  },
  positional: ["action"],
  describe: ({ action, intent, when, set }) =>
    `Change ${
      [intent !== undefined && "the intent", when && "the condition", set && "the values"]
        .filter(Boolean)
        .join(" and ") || "nothing"
    } of the action ${action}`,
  destructive: () => false,
  apply({ spec }, { action, intent, when, set }, ir) {
    const found = ir.actions.find((a) => a.name === action);
    if (!found) throw new OperationError(`There is no action named "${action}".`);
    if (intent === undefined && !when && !set)
      throw new OperationError("Say what to change: --intent, --when or --set.");
    const put = (key: string, value: Parameters<typeof spec.set>[1] | undefined) => {
      const at = ["actions", action, key];
      if (value === undefined) {
        if (spec.has(at)) spec.remove(at);
      } else if (spec.has(at)) spec.set(at, value);
      else spec.add(["actions", action], key, value);
    };
    if (intent !== undefined) put("intent", intent.trim() || undefined);
    if (!when && !set) return [];
    const model = found.custom ? undefined : ir.models.find((m) => m.name === found.on);
    if (!model)
      throw new OperationError(
        `"${action}" is a custom action: what it does is its code, so it has no "when" or "set".`,
      );
    if (when) put("when", Object.keys(when).length ? conditionArgs(when) : undefined);
    if (set) put("set", Object.keys(set).length ? typedAll(model, set) : undefined);
    return [];
  },
};

const removeAction: Operation<{ action: string }> = {
  name: "removeAction",
  summary:
    "Remove an action, from the pages that offer it too. A custom action's code in src/custom/actions/ stays.",
  schema: {
    type: "object",
    required: ["action"],
    additionalProperties: false,
    properties: { action: named },
  },
  positional: ["action"],
  describe: ({ action }) => `Remove the action ${action}`,
  destructive: () => false,
  apply({ spec, content }, { action }, ir) {
    const found = ir.actions.find((a) => a.name === action);
    if (!found) throw new OperationError(`There is no action named "${action}".`);
    spec.removeAndPrune(["actions", action], 0);
    if (content.has(["actions", action])) content.removeAndPrune(["actions", action], 0);
    for (const page of ir.pages) {
      if (!page.actions?.includes(action)) continue;
      const rest = page.actions.filter((a) => a !== action);
      if (rest.length) spec.set(["pages", page.id, "actions"], rest);
      else spec.remove(["pages", page.id, "actions"]);
    }
    // What programs are offered follows (the access file); the code is the owner's to remove.
    return [
      { kind: "remove-action", action },
      ...(found.custom ? [{ note: "its code in src/custom/actions/ stays" }] : []),
    ];
  },
};

export const actionOperations: AnyOperation[] = [addAction, setAction, removeAction];
