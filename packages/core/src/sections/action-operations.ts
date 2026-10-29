import { conditionArgs } from "../condition.js";
import type { YamlValue } from "../edit.js";
import type { CustomActionIR, ModelIR, SpecIR } from "../ir.js";
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

/** A custom action's contract (docs/design/intents.md §6), as addAction and setAction take it. */
const CONTRACT_ARGS = {
  reads: {
    type: "array",
    items: { type: "string" },
    description:
      'A custom action: the models its code reads, e.g. Invoice Payment; "none" for no list.',
  },
  writes: {
    type: "array",
    items: { type: "string" },
    description:
      'A custom action: the models, or fields of them, its code writes, e.g. Payment Invoice.status; "none" for no list.',
  },
  triggers: {
    type: "array",
    items: { type: "string" },
    description:
      'A custom action: the outgoing entries its code may fire, e.g. paymentBooked; "none" for no list.',
  },
};

/** The one word "none": an empty list, which removes the key. */
const noneOf = (list?: string[]) =>
  list === undefined ? undefined : list.length === 1 && list[0] === "none" ? [] : list;

/**
 * The contract's lists checked against the spec: models (or User) in reads, models or Model.field
 * in writes, outgoing entries in triggers. Nothing given is nothing; an empty list is removal.
 */
function contractOf(
  ir: SpecIR,
  reads?: string[],
  writes?: string[],
  triggers?: string[],
): { touches?: { reads?: string[]; writes?: string[] }; triggers?: string[] } | undefined {
  const r = noneOf(reads);
  const w = noneOf(writes);
  const t = noneOf(triggers);
  if (r === undefined && w === undefined && t === undefined) return undefined;
  const twice = (list: string[], name: string, flag: string) => {
    if (list.indexOf(name) !== list.lastIndexOf(name))
      throw new OperationError(`${name} is named twice in ${flag}.`);
  };
  for (const name of r ?? []) {
    if (name.includes("."))
      throw new OperationError(`"--reads" names models; a field is written, not read: "${name}".`);
    if (name !== "User" && !ir.models.some((m) => m.name === name))
      throw new OperationError(`There is no model named "${name}" to read.`);
    twice(r ?? [], name, "--reads");
  }
  const whole = new Set((w ?? []).filter((n) => !n.includes(".")));
  for (const name of w ?? []) {
    const [modelName = "", field, more] = name.split(".");
    const model = ir.models.find((m) => m.name === modelName);
    if (more !== undefined || (!model && modelName !== "User"))
      throw new OperationError(`"${name}" is not a model or Model.field to write.`);
    twice(w ?? [], name, "--writes");
    if (field === undefined) continue;
    const f = model?.fields.find((x) => x.name === field);
    if (!f) throw new OperationError(`${modelName} has no field named "${field}".`);
    if (f.formula) throw new OperationError(`${name} is computed, so nothing writes it.`);
    if (f.type.kind === "relation" && f.type.many)
      throw new OperationError(`${name} is a list, written through its records' reference.`);
    if (whole.has(modelName))
      throw new OperationError(`${modelName} is written whole, so ${name} adds nothing.`);
  }
  for (const name of t ?? []) {
    if (!ir.outgoing.some((o) => o.name === name))
      throw new OperationError(`There is nothing named "${name}" under outgoing to fire.`);
    twice(t ?? [], name, "--triggers");
  }
  return {
    ...(r !== undefined || w !== undefined
      ? {
          touches: {
            ...(r !== undefined ? { reads: r } : {}),
            ...(w !== undefined ? { writes: w } : {}),
          },
        }
      : {}),
    ...(t !== undefined ? { triggers: t } : {}),
  };
}

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
  merge?: string;
  keep?: string;
  fields?: string[];
  reads?: string[];
  writes?: string[];
  triggers?: string[];
  split?: string;
  move?: string;
}> = {
  name: "addAction",
  summary:
    "Add an action: standard with --on and --set (it sets fields of a record), a merge with --merge Model (two records become one), a split with --split Model --move list (one record becomes two), else custom (its behavior is code in src/custom/actions/).",
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
      ...CONTRACT_ARGS,
      merge: refTo(
        { ref: "model", label: "Merges two records of" },
        {
          description:
            "A merge: two records of this model become one; the other's references move to the kept record, and the other goes to the trash.",
        },
      ),
      keep: {
        enum: ["chosen", "oldest", "newest"],
        description: "For a merge: which record stays; chosen (the person says) unless said.",
      },
      fields: {
        type: "array",
        items: { type: "string" },
        description:
          "For a merge: field=rule pairs, the rule keep, other, ask, add (numbers summed) or append (texts joined), e.g. email=ask revenue=add; a field not named is asked. For a split: the fields the new record takes, e.g. customer deliverTo; unsaid, every stored field but the unique, the sequences and the lists.",
      },
      split: refTo(
        { ref: "model", label: "Splits a record of" },
        {
          description:
            "A split: one record of this model becomes two; the picked records of the list in --move go to a new record.",
        },
      ),
      move: {
        type: "string",
        description: "For a split: the list whose picked records go to the new record, e.g. lines.",
      },
    },
  },
  positional: ["action", "...input"],
  describe: ({ action, on, merge, split }) =>
    `Add the ${merge ? "merge" : split ? "split" : on ? "standard" : "custom"} action ${action}`,
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
      merge,
      keep,
      fields: rules = [],
      reads,
      writes,
      triggers,
      split,
      move,
    },
    ir,
  ) {
    if (!FIELD_NAME_PATTERN.test(action)) throw new OperationError(nameRule("action", action));
    if (ir.actions.some((a) => a.name === action))
      throw new OperationError(`Action "${action}" already exists.`);
    const text = {
      ...(intent?.trim() ? { intent: intent.trim() } : {}),
    };
    // One operation gives a working button: on the model's crud page, when there is just one.
    const offerOn = (model: string) => {
      const pages = ir.pages.filter((p) => p.pattern.kind === "crud" && p.pattern.model === model);
      const page = pages.length === 1 ? pages[0] : undefined;
      if (page?.actions) spec.set(["pages", page.id, "actions"], [...page.actions, action]);
      else if (page) spec.add(["pages", page.id], "actions", [action]);
    };
    const contract = contractOf(ir, reads, writes, triggers);
    if (contract && (on || merge !== undefined || split !== undefined))
      throw new OperationError(
        "--reads, --writes and --triggers are a custom action's contract: not for a standard action, a merge or a split.",
      );
    const somethingElse =
      on ||
      Object.keys(set).length ||
      Object.keys(when).length ||
      Object.keys(add).length ||
      copy ||
      lists.length ||
      Object.keys(input).length ||
      Object.keys(output).length;
    if (split !== undefined || move !== undefined) {
      if (split === undefined) throw new OperationError('"--move" goes with --split <Model>.');
      if (move === undefined)
        throw new OperationError(
          'A split needs "--move": the list whose picked records go to the new record.',
        );
      if (somethingElse || merge !== undefined || keep !== undefined)
        throw new OperationError(
          "A split names its model, its list and the fields the new record takes, nothing else: no --on, --merge, --set, --when, --add, --copy, --with, input or output.",
        );
      if (split === "User")
        throw new OperationError("Users cannot be split: they are who signs in.");
      const model = ir.models.find((m) => m.name === split);
      if (!model) throw new OperationError(`There is no model named "${split}".`);
      if (!model.fields.some((f) => f.name === move && f.type.kind === "relation" && f.type.many))
        throw new OperationError(`${split} has no list named "${move}".`);
      for (const field of rules)
        if (!model.fields.some((f) => f.name === field))
          throw new OperationError(`${split} has no field named "${field}".`);
      spec.add(["actions"], action, {
        split,
        move,
        ...(rules.length ? { copy: rules } : {}),
        ...text,
      });
      offerOn(split);
      return [];
    }
    if (merge !== undefined || keep !== undefined || rules.length) {
      if (merge === undefined)
        throw new OperationError(
          '"--keep" goes with --merge <Model>, and "--fields" with --merge or --split.',
        );
      if (somethingElse)
        throw new OperationError(
          "A merge names its model and nothing else: no --on, --set, --when, --add, --copy, --with, input or output.",
        );
      if (merge === "User")
        throw new OperationError("Users cannot be merged: they are who signs in.");
      if (!ir.models.some((m) => m.name === merge))
        throw new OperationError(`There is no model named "${merge}".`);
      if (keep !== undefined && !["chosen", "oldest", "newest"].includes(keep))
        throw new OperationError('"--keep" is chosen, oldest or newest.');
      const fieldRules: Record<string, string> = {};
      for (const pair of rules) {
        const at = pair.indexOf("=");
        const [field, rule] = at > 0 ? [pair.slice(0, at), pair.slice(at + 1)] : [pair, ""];
        if (!field || !["keep", "other", "ask", "add", "append"].includes(rule))
          throw new OperationError(
            `"${pair}" is not field=rule, with the rule keep, other, ask, add or append.`,
          );
        fieldRules[field] = rule;
      }
      spec.add(["actions"], action, {
        merge,
        ...(keep !== undefined && keep !== "chosen" ? { keep } : {}),
        ...(Object.keys(fieldRules).length ? { fields: fieldRules } : {}),
        ...text,
      });
      offerOn(merge);
      return [];
    }
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
        ...(contract?.touches ? { touches: contract.touches } : {}),
        ...(contract?.triggers?.length ? { triggers: contract.triggers } : {}),
      });
      // A rows action (one input a list of records) shows where a standard action would: on its
      // model's crud page, when there is just one (the page's "actions" is where an action shows).
      const rows = Object.values(input)
        .map((text) => /^([A-Z][A-Za-z0-9]*)\[\]$/.exec(String(text).trim())?.[1])
        .find((model) => model && ir.models.some((m) => m.name === model));
      if (rows) {
        const pages = ir.pages.filter((p) => p.pattern.kind === "crud" && p.pattern.model === rows);
        const page = pages.length === 1 ? pages[0] : undefined;
        if (page?.actions) spec.set(["pages", page.id, "actions"], [...page.actions, action]);
        else if (page) spec.add(["pages", page.id], "actions", [action]);
      }
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
    offerOn(on);
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
  reads?: string[];
  writes?: string[];
  triggers?: string[];
  touches?: string;
}> = {
  name: "setAction",
  summary:
    "Change an action: its intent, the records it is for (--when), the values it sets (--set), or a custom action's contract (--reads, --writes, --triggers). Each replaces what was there; an empty one (or none) removes it. Who may run it is grant <role> actions <name>.",
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
      ...CONTRACT_ARGS,
      touches: {
        type: "string",
        enum: ["none"],
        description: 'The one word "none": no touches at all, so no fence on the code.',
      },
    },
  },
  positional: ["action"],
  describe: ({ action, intent, when, set, reads, writes, triggers, touches }) =>
    `Change ${
      [
        intent !== undefined && "the intent",
        when && "the condition",
        set && "the values",
        (reads || writes || triggers || touches) && "the contract",
      ]
        .filter(Boolean)
        .join(" and ") || "nothing"
    } of the action ${action}`,
  destructive: () => false,
  apply({ spec }, { action, intent, when, set, reads, writes, triggers, touches }, ir) {
    const found = ir.actions.find((a) => a.name === action);
    if (!found) throw new OperationError(`There is no action named "${action}".`);
    if (touches !== undefined && touches !== "none")
      throw new OperationError('"--touches" takes the one word none, which removes the fence.');
    if (touches && (reads || writes))
      throw new OperationError("--touches none goes alone: no --reads or --writes with it.");
    const contract = contractOf(ir, reads, writes, triggers);
    if (intent === undefined && !when && !set && !contract && !touches)
      throw new OperationError(
        "Say what to change: --intent, --when, --set, --reads, --writes, --triggers or --touches none.",
      );
    if ((contract || touches) && !found.custom)
      throw new OperationError(
        `"${action}" is not a custom action: --reads, --writes and --triggers are a custom action's contract.`,
      );
    const put = (key: string, value: Parameters<typeof spec.set>[1] | undefined) => {
      const at = ["actions", action, key];
      if (value === undefined) {
        if (spec.has(at)) spec.remove(at);
      } else if (spec.has(at)) spec.set(at, value);
      else spec.add(["actions", action], key, value);
    };
    if (intent !== undefined) put("intent", intent.trim() || undefined);
    if (contract && found.custom) {
      // Each list replaces its own; the other stays as written. An empty list is kept: the code
      // reaches nothing of that kind, where no touches at all would be no fence.
      if (contract.touches) {
        const at = ["actions", action, "touches"];
        const kept = (key: "reads" | "writes") =>
          spec.has([...at, key]) ? (spec.get([...at, key]) as string[]) : undefined;
        const reads = contract.touches.reads ?? kept("reads");
        const writes = contract.touches.writes ?? kept("writes");
        put("touches", {
          ...(reads !== undefined ? { reads } : {}),
          ...(writes !== undefined ? { writes } : {}),
        });
      }
      // No triggers and an empty list say the same: the work sets off nothing.
      if (contract.triggers)
        put("triggers", contract.triggers.length ? contract.triggers : undefined);
    }
    if (touches && found.custom) put("touches", undefined);
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

const EXAMPLES = (action: string) => ["actions", action, "examples"];

/** The custom action named, for an operation on its examples. */
function customNamed(ir: SpecIR, action: string): CustomActionIR {
  const found = ir.actions.find((a) => a.name === action);
  if (!found) throw new OperationError(`There is no action named "${action}".`);
  if (!found.custom)
    throw new OperationError(
      `${action} is a standard action: examples are for custom actions, whose code they test.`,
    );
  return found;
}

const addExample: Operation<{
  action: string;
  as?: string;
  now?: string;
  given: Record<string, unknown>;
  input?: Record<string, unknown>;
  after?: Record<string, unknown>;
  nothingElse?: boolean;
  output?: Record<string, unknown> | string;
}> = {
  name: "addExample",
  summary:
    "Add an example to a custom action: the records given, the input, and the records and output expected after. The app tests its code by it.",
  schema: {
    type: "object",
    required: ["action", "given"],
    additionalProperties: false,
    properties: {
      action: named,
      as: {
        type: "string",
        description: "The role the action runs as; the first admin when left out.",
      },
      now: {
        type: "string",
        description: "The clock, a date or a date and time; today when left out.",
      },
      given: {
        type: "object",
        description:
          'The records before, by model, with the example\'s own ids, e.g. { "Invoice": [{ "id": 1, "total": 120 }] }; {} when none.',
      },
      input: { type: "object", description: "The input values; a file names one under samples/." },
      after: {
        type: "object",
        description: "The records after, by model; fields not named are not checked.",
      },
      nothingElse: {
        type: "boolean",
        description: "Fail on any other record created, changed or deleted.",
      },
      output: {
        type: ["object", "string"],
        description: 'The values returned, or "refused" when the action must refuse.',
      },
    },
  },
  positional: ["action"],
  describe: ({ action }) => `Add an example to the action ${action}`,
  destructive: () => false,
  apply({ spec }, { action, ...example }, ir) {
    const found = customNamed(ir, action);
    const value = Object.fromEntries(
      Object.entries(example).filter(([, v]) => v !== undefined),
    ) as YamlValue;
    const path = EXAMPLES(action);
    if (spec.has(path)) spec.set(path, [...(spec.get(path) as YamlValue[]), value]);
    else spec.add(["actions", action], "examples", [value]);
    return [{ note: `example ${(found.examples?.length ?? 0) + 1} of ${action}` }];
  },
};

const removeExample: Operation<{ action: string; example: number }> = {
  name: "removeExample",
  summary: "Remove one of a custom action's examples, by its number (the first is 1).",
  schema: {
    type: "object",
    required: ["action", "example"],
    additionalProperties: false,
    properties: {
      action: named,
      example: { type: "integer", minimum: 1, description: "Which example, counting from 1." },
    },
  },
  positional: ["action", "example"],
  describe: ({ action, example }) => `Remove example ${example} of the action ${action}`,
  destructive: () => false,
  apply({ spec }, { action, example }, ir) {
    const found = customNamed(ir, action);
    const count = found.examples?.length ?? 0;
    if (!Number.isInteger(example) || example < 1 || example > count)
      throw new OperationError(
        count
          ? `${action} has ${count === 1 ? "one example" : `${count} examples`}: "${example}" is not one of them.`
          : `${action} has no examples.`,
      );
    const path = EXAMPLES(action);
    const rest = (spec.get(path) as YamlValue[]).filter((_, i) => i !== example - 1);
    if (rest.length) spec.set(path, rest);
    else spec.remove(path);
    return [];
  },
};

export const actionOperations: AnyOperation[] = [
  addAction,
  setAction,
  removeAction,
  addExample,
  removeExample,
];
