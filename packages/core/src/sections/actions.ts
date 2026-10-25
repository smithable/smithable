import { isScalar, type ParsedNode } from "yaml";
import { followRenamed, lostValues, readCondition } from "../condition.js";
import {
  checkKeys,
  type Entry,
  mapEntries,
  type ParseContext,
  readBoolean,
  readNameList,
  readString,
} from "../context.js";
import {
  checkFormula,
  FormulaError,
  fieldsUsed,
  parseFormula,
  renameInFormula,
  renameTextInFormula,
  valueTypeOf,
} from "../formula.js";
import {
  type ActionAddIR,
  type ActionIR,
  type ActionValueIR,
  type Condition,
  type FieldIR,
  type ModelIR,
  type SemanticText,
  type StandardActionIR,
  storesFiles,
  storesPictures,
  USER_MODEL,
} from "../ir.js";
import { capitalize } from "../naming.js";
import type { JsonSchema, SpecSection } from "../section.js";
import { didYouMean } from "../suggest.js";
import { actionOperations } from "./action-operations.js";
import { parseDefault, parseFieldShorthand } from "./field-type.js";
import { FIELD_NAME_PATTERN, nameRule, RESERVED_WORDS } from "./names.js";
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
      oneOf: [
        { required: ["custom"] },
        {
          required: ["on"],
          anyOf: [{ required: ["set"] }, { required: ["add"] }, { required: ["copy"] }],
        },
      ],
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
          additionalProperties: { type: ["string", "number", "boolean", "null"] },
          description:
            "The new values: a literal the field accepts, a formula on the record as it was, or nothing to ask the person for it, e.g. { status: canceled, cancelReason: }.",
        },
        add: {
          type: "object",
          minProperties: 1,
          additionalProperties: {
            type: "object",
            propertyNames: { pattern: FIELD_NAME_PATTERN.source },
            additionalProperties: { type: ["string", "number", "boolean", "null"] },
          },
          description:
            "Related records to create with the change, one per model that refers to this one, e.g. { IncidentUpdate: { status: resolved, at: NOW() } }.",
        },
        copy: {
          type: ["object", "null"],
          propertyNames: { pattern: FIELD_NAME_PATTERN.source },
          additionalProperties: { type: ["string", "number", "boolean", "null"] },
          description:
            "A new record from this one instead of a change: what differs, as in set (a value, a formula, ME() or nothing to ask); {} copies as is.",
        },
        with: {
          type: "array",
          items: { type: "string" },
          description: "Lists of the model whose records a copy takes along, e.g. [lines].",
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
    // The values an action writes to records of a model: its own `set`, or what it adds.
    const writes = (action: StandardActionIR, model: string) => [
      ...(action.on === model ? [{ path: ["set"], values: action.set }] : []),
      ...(action.on === model && action.copy ? [{ path: ["copy"], values: action.copy }] : []),
      ...(action.add ?? [])
        .filter((a) => a.model === model)
        .map((a) => ({ path: ["add", a.model], values: a.values })),
    ];
    // Formulas are worked out on the action's record, in `set` and in `add` alike.
    const formulas = (action: StandardActionIR) => [
      ...action.set.map((v) => ({ path: ["set", v.field], v })),
      ...(action.copy ?? []).map((v) => ({ path: ["copy", v.field], v })),
      ...(action.add ?? []).flatMap((a) =>
        a.values.map((v) => ({ path: ["add", a.model, v.field], v })),
      ),
    ];
    if (effect.kind === "remove-field" || effect.kind === "change-field") {
      for (const action of standard) {
        const named = action.on === effect.model ? action.when?.[effect.field] : undefined;
        const renamed = effect.kind === "change-field" ? (effect.renamed ?? {}) : {};
        const at = ["actions", action.name];
        // A renamed choice value is followed: in "when", in what the action writes, and in its
        // formulas that compare with it.
        const wanted =
          named === undefined
            ? undefined
            : followRenamed(spec, [...at, "when", effect.field], named, renamed);
        const stillNamed: string[] = [];
        for (const w of writes(action, effect.model))
          for (const v of w.values) {
            if (v.field !== effect.field || !("value" in v) || typeof v.value !== "string")
              continue;
            const to = renamed[v.value];
            if (to) spec.set([...at, ...w.path, v.field], to);
            stillNamed.push(to || v.value);
          }
        if (action.on === effect.model)
          for (const { path, v } of formulas(action)) {
            if (!("formula" in v)) continue;
            const next = renameTextInFormula(v.text, (name, list, value) =>
              name === effect.field && list === undefined ? renamed[value] || undefined : undefined,
            );
            if (next !== v.text) spec.set([...at, ...path], next);
          }
        const written = writes(action, effect.model).flatMap((w) =>
          w.values.filter((v) => v.field === effect.field),
        );
        const lost =
          effect.kind === "change-field" &&
          ((wanted !== undefined && lostValues(wanted, effect.choices).length > 0) ||
            stillNamed.some((v) => !effect.choices.includes(v)));
        const uses =
          effect.kind === "remove-field" &&
          (wanted !== undefined ||
            (action.on === effect.model && (action.with ?? []).includes(effect.field)) ||
            written.length > 0 ||
            (action.add ?? []).some(
              (a) => a.model === effect.model && a.reference === effect.field,
            ) ||
            (action.on === effect.model &&
              formulas(action).some(
                ({ v }) => "formula" in v && fieldsUsed(v.formula).includes(effect.field),
              )));
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
      for (const { path: at, v } of formulas(action))
        if ("formula" in v) {
          const next = renameInFormula(v.text, (name, list) =>
            name !== effect.from
              ? undefined
              : (list === undefined ? action.on === effect.model : listOf(list))
                ? effect.to
                : undefined,
          );
          if (next !== v.text) spec.set([...path, ...at], next);
        }
      // A renamed list a copy takes along.
      if (action.on === effect.model && action.with?.includes(effect.from))
        spec.set(
          [...path, "with"],
          action.with.map((l) => (l === effect.from ? effect.to : l)),
        );
      if (action.on === effect.model && action.when && effect.from in action.when)
        spec.renameKey([...path, "when", effect.from], effect.to);
      for (const w of writes(action, effect.model))
        if (w.values.some((v) => v.field === effect.from))
          spec.renameKey([...path, ...w.path, effect.from], effect.to);
    }
    return undefined;
  },
  parse(ctx, node, parsed) {
    if (node === undefined) return [];
    const actions: ActionIR[] = [];
    const entries = mapEntries(ctx, node, `"actions"`) ?? [];
    const taken = new Set(entries.map((e) => e.key));
    for (const { key, keyNode, value } of entries) {
      if (!FIELD_NAME_PATTERN.test(key)) {
        ctx.error(keyNode, "invalid-name", nameRule("action", key));
        continue;
      }
      ctx.define("action", key);
      const action = readAction(ctx, key, keyNode, value, parsed.models ?? []);
      if (!action) continue;
      // A name the app's code cannot take as its own (A 159): refused with a name that fits.
      const models = (parsed.models ?? []).map((m) => m.name);
      const clash = models.find((m) => m.charAt(0).toLowerCase() + m.slice(1) === key);
      if (RESERVED_WORDS.has(key) || clash) {
        const better = `${key}${("on" in action && action.on) || "Action"}`;
        const fits =
          !RESERVED_WORDS.has(better) &&
          !taken.has(better) &&
          !models.some((m) => m.charAt(0).toLowerCase() + m.slice(1) === better);
        const why = clash
          ? `is also the name of the model ${clash}`
          : "is a word the code reserves";
        ctx.error(
          keyNode,
          "invalid-name",
          `Action name "${key}" ${why}: ${fits ? `name the action "${better}"` : "choose another name"}.`,
        );
      }
      // Kept even when refused, so what refers to it finds it: the error alone stops the build.
      actions.push(action);
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
    allowed: [
      "custom",
      "input",
      "output",
      "on",
      "when",
      "set",
      "add",
      "copy",
      "with",
      ...TEXT_KEYS,
    ],
    later: ["confirm", "examples"],
    content: ["label", "title"],
    moved: {
      allow: `who may run ${name} is said by the roles in smithable.auth.yml: a custom action under roles.<role>.actions, a standard one by "write" on its model.`,
    },
  });
  const byKey = new Map(known.map((e) => [e.key, e]));
  const common = {
    name,
    ...readSemanticText(ctx, known),
  };
  const custom = byKey.get("custom");
  const standard = ["on", "when", "set", "add", "copy", "with"]
    .map((k) => byKey.get(k))
    .filter((e) => e !== undefined);
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
  if (storesPictures(field)) return "it is a picture";
  if (storesFiles(field)) return "it is a document";
  return undefined;
}

function readStandardAction(
  ctx: ParseContext,
  where: string,
  keyNode: ParsedNode,
  byKey: Map<string, Entry>,
  models: ModelIR[],
  common: Pick<StandardActionIR, "name" | keyof SemanticText>,
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
  const addEntry = byKey.get("add");
  const copyEntry = byKey.get("copy");
  const withEntry = byKey.get("with");
  if (!on || (!set && !addEntry && !copyEntry)) {
    ctx.error(
      (on ?? set ?? addEntry ?? copyEntry)?.keyNode ?? keyNode,
      "missing-key",
      `${capitalize(where)} needs "on" (the model whose record it changes) and "set" (the new values), "add" (a related record to create), both, or "copy" (a new record from this one).`,
    );
    return undefined;
  }
  // It changes this record or makes a new one, never both.
  if (copyEntry && (set || addEntry)) {
    ctx.error(
      copyEntry.keyNode,
      "invalid-action",
      `${capitalize(where)} makes a copy ("copy") or changes the record ("set", "add"), not both.`,
    );
    return undefined;
  }
  if (withEntry && !copyEntry) {
    ctx.error(
      withEntry.keyNode,
      "invalid-action",
      `"with" of ${where} names lists a copy takes along; it needs "copy".`,
    );
    return undefined;
  }
  const modelName = readString(ctx, on.value, `"on" of ${where}`);
  if (modelName === undefined) return undefined;
  const model = models.find((m) => m.name === modelName);
  if (model) ctx.reference("model", modelName, on.value);
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
    ? readCondition(ctx, whenEntry.value, `"when" of ${where}`, model, true, true)
    : undefined;
  let failed = false;
  const read = (entry: Entry, target: ModelIR, what: string, skip?: string) => {
    const before = ctx.diagnostics.filter((d) => d.severity === "error").length;
    const values = readValues(ctx, entry, target, model, models, what, skip);
    if (ctx.diagnostics.filter((d) => d.severity === "error").length > before) failed = true;
    return values;
  };
  const values = set ? read(set, model, `"set" of ${where}`) : [];
  if (set && !values.length && !failed)
    ctx.error(
      set.value,
      "invalid-set",
      `"set" of ${where} needs at least one field and its new value.`,
    );
  const add: ActionAddIR[] = [];
  for (const { key, keyNode: at, value } of addEntry
    ? (mapEntries(ctx, addEntry.value, `"add" of ${where}`) ?? [])
    : []) {
    const target = models.find((m) => m.name === key);
    if (target) ctx.reference("model", key, at);
    if (!target) {
      ctx.error(
        at,
        "unknown-model",
        `"add" of ${where}: there is no model named "${key}".`,
        didYouMean(
          key,
          models.map((m) => m.name),
        ),
      );
      failed = true;
      continue;
    }
    // The new record hangs off the record the action runs on, through its one reference to it.
    const back = target.fields.filter(
      (f) => f.type.kind === "relation" && !f.type.many && f.type.model === model.name,
    );
    if (back.length !== 1) {
      ctx.error(
        at,
        "invalid-add",
        `"add" of ${where}: ${key} must refer to ${model.name} exactly once to be added to it (it does ${back.length === 0 ? "not" : `${back.length} times`}).`,
      );
      failed = true;
      continue;
    }
    const reference = back[0]?.name as string;
    const what = `${key} in "add" of ${where}`;
    const added = read({ key, keyNode: at, value } as Entry, target, what, reference);
    const given = new Set(added.map((v) => v.field));
    const missing = target.fields.filter(
      (f) =>
        f.required &&
        f.name !== reference &&
        !f.formula &&
        !f.sequence &&
        f.default === undefined &&
        !f.defaultFormula &&
        !(f.type.kind === "relation" && f.type.many) &&
        !given.has(f.name),
    );
    // A reference cannot be set or asked: a model that needs another one is out of reach for now.
    const otherReference = missing.find((f) => f.type.kind === "relation");
    if (otherReference) {
      ctx.error(
        at,
        "invalid-add",
        `"add" of ${where}: ${key} also needs ${otherReference.name}, another required reference, which an action cannot fill yet; a model with another required reference cannot be added by an action.`,
      );
      failed = true;
      continue;
    }
    if (missing.length) {
      ctx.error(
        at,
        "invalid-add",
        `Adding a ${key} needs a value for ${missing.map((f) => f.name).join(", ")}, or ask for ${missing.length > 1 ? "them" : "it"} (a key with no value).`,
      );
      failed = true;
      continue;
    }
    add.push({ model: key, reference, values: added });
  }
  const copy = copyEntry
    ? readCopy(ctx, where, copyEntry, model, (v) => read(v, model, `"copy" of ${where}`))
    : undefined;
  const lists = withEntry && copy ? readWith(ctx, where, withEntry, model, models) : undefined;
  if (copyEntry && (!copy || (withEntry && !lists))) failed = true;
  if (failed) return undefined;
  // Only when every value is one the condition already requires does the action change nothing.
  if (!copy && !add.length && values.every((v) => "value" in v && when?.[v.field] === v.value))
    ctx.warning(
      set?.value ?? keyNode,
      "action-changes-nothing",
      `${capitalize(where)} runs only on records that already have the values it sets: it leaves the record as it was.`,
    );
  const rules = byKey.get("rules");
  if (rules)
    ctx.warning(
      rules.keyNode,
      "rules-not-enforced",
      `The rules of ${where} are documentation only: a standard action does what "set" and "add" say.`,
    );
  const asks = copy ? [] : requiredBy(model, when, values);
  return {
    ...common,
    custom: false,
    input: [],
    on: model.name,
    ...(when ? { when } : {}),
    set: values,
    ...(asks.length ? { asksRequired: asks } : {}),
    ...(add.length ? { add } : {}),
    ...(copy ? { copy } : {}),
    ...(lists?.length ? { with: lists } : {}),
  };
}

/**
 * The fields an action's change makes required (record-rules.md §3): a field required while the
 * record fits a condition that the record surely fits after the change (each value the action
 * sets, or its `when` allows only, is one the condition wants). Its dialog asks for them, with the
 * record's value filled in; one the action sets itself is not asked.
 */
function requiredBy(
  model: ModelIR,
  when: Condition | undefined,
  values: ActionValueIR[],
): string[] {
  const set = new Map(values.map((v) => [v.field, v]));
  const wantedBy = (wanted: Condition[string], value: unknown) =>
    typeof wanted === "boolean"
      ? value === wanted
      : (Array.isArray(wanted) ? wanted : [wanted]).includes(String(value));
  return model.fields
    .filter((f) => f.requiredWhen && !set.has(f.name))
    .filter((f) =>
      Object.entries(f.requiredWhen as Condition).every(([key, wanted]) => {
        const given = set.get(key);
        if (given && "value" in given) return wantedBy(wanted, given.value);
        const allowed = when?.[key];
        if (allowed === undefined || given) return false;
        return typeof allowed === "boolean"
          ? wantedBy(wanted, allowed)
          : (Array.isArray(allowed) ? allowed : [allowed]).every((v) => wantedBy(wanted, v));
      }),
    )
    .map((f) => f.name);
}

/**
 * Why a record of `model` cannot be copied by an action, if it cannot: a required picture (a copy
 * starts without), or a required unique field the copy does not give a new value. `values` are
 * the copy's own; a list's records (none) get nothing asked.
 */
function copyGap(model: ModelIR, values: ActionValueIR[] | undefined): string | undefined {
  for (const f of model.fields) {
    if (!f.required || f.formula) continue;
    if (storesPictures(f))
      return `${model.name}.${f.name} is a required picture, which a copy starts without: ${model.name} cannot be copied by an action yet.`;
    if (storesFiles(f))
      return `${model.name}.${f.name} is a required document, which a copy starts without: ${model.name} cannot be copied by an action yet.`;
    const given = values?.find((v) => v.field === f.name);
    if (f.unique && !(given && ("formula" in given || "asked" in given)))
      return values
        ? `A copy needs its own ${f.name} (it is unique): give it in copy as a formula, or ask for it.`
        : `${model.name}.${f.name} is unique and required, and nothing can be asked for a list's records: ${model.name} cannot come along in a copy.`;
  }
  return undefined;
}

function readCopy(
  ctx: ParseContext,
  where: string,
  entry: Entry,
  model: ModelIR,
  read: (entry: Entry) => ActionValueIR[],
): ActionValueIR[] | undefined {
  // "copy: {}" (or nothing) copies as is.
  const empty = entry.value === null || (isScalar(entry.value) && entry.value.value === null);
  const values = empty ? [] : read(entry);
  const gap = copyGap(model, values);
  if (!gap) return values;
  ctx.error(entry.keyNode, "invalid-copy", `"copy" of ${where}: ${gap}`);
  return undefined;
}

function readWith(
  ctx: ParseContext,
  where: string,
  entry: Entry,
  model: ModelIR,
  models: ModelIR[],
): string[] | undefined {
  const names: string[] = [];
  let ok = true;
  for (const { name, at } of readNameList(ctx, entry.value, `"with" of ${where}`)) {
    const field = model.fields.find((f) => f.name === name);
    if (!field || field.type.kind !== "relation" || !field.type.many) {
      ctx.error(
        at,
        "invalid-copy",
        `"with" of ${where}: ${model.name} has no list named "${name}".`,
        didYouMean(
          name,
          model.fields.filter((f) => f.type.kind === "relation" && f.type.many).map((f) => f.name),
        ),
      );
      ok = false;
      continue;
    }
    const listed = models.find((m) => m.name === (field.type as { model: string }).model);
    const gap = listed && copyGap(listed, undefined);
    if (gap) {
      ctx.error(at, "invalid-copy", `"with" of ${where}: ${gap}`);
      ok = false;
      continue;
    }
    names.push(name);
  }
  return ok ? names : undefined;
}

/**
 * The values of `set`, or of one record in `add`: a literal the field accepts, a formula worked
 * out on the record the action runs on (as a default is), or nothing, to ask the person for it.
 */
function readValues(
  ctx: ParseContext,
  entry: Entry,
  target: ModelIR,
  record: ModelIR,
  models: ModelIR[],
  what: string,
  reference?: string,
): ActionValueIR[] {
  const values: ActionValueIR[] = [];
  for (const { key, keyNode: at, value } of mapEntries(ctx, entry.value, what) ?? []) {
    const field = target.fields.find((f) => f.name === key);
    if (!field) {
      ctx.error(
        at,
        "unknown-field",
        `${what}: ${target.name} has no field named "${key}".`,
        didYouMean(
          key,
          target.fields.filter((f) => !unsettable(f)).map((f) => f.name),
        ),
      );
      continue;
    }
    if (key === reference) {
      ctx.error(
        at,
        "invalid-add",
        `${what}: ${key} is filled with the record the action runs on; leave it out.`,
      );
      continue;
    }
    const raw = isScalar(value) ? value.value : value === null ? null : undefined;
    // ME(): the person who pressed the button, the one reference an action sets (§10).
    if (typeof raw === "string" && raw.replace(/\s/g, "") === "ME()") {
      if (field.type.kind === "relation" && field.type.model === USER_MODEL && !field.type.many)
        values.push({ field: key, me: true });
      else ctx.error(value, "invalid-set", `${what}: ME() is a person: ${key} must refer to User.`);
      continue;
    }
    // A reference with no value is asked for, with the form's own control for it (a record's
    // combobox, the people chooser): the dialog needs nothing new (record-rules.md §4). A
    // literal reference stays refused: a record's id in a spec means nothing.
    if (
      (raw === null || raw === "") &&
      field.type.kind === "relation" &&
      !field.type.many &&
      !field.formula
    ) {
      values.push({ field: key, asked: true });
      continue;
    }
    const why = unsettable(field);
    if (why) {
      ctx.error(at, "invalid-set", `${what}: ${target.name}.${key} cannot be set, ${why}.`);
      continue;
    }
    // No value: the person is asked for it when they press the button.
    if (raw === null || raw === "") {
      values.push({ field: key, asked: true });
      continue;
    }
    if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") {
      ctx.error(
        value,
        "invalid-set",
        `${what}: ${key} must be a single value, a formula or nothing (asked for).`,
      );
      continue;
    }
    // As a default: a value with parentheses is a formula, anything else a literal.
    if (typeof raw === "string" && raw.includes("(")) {
      try {
        const formula = parseFormula(raw);
        const actual = checkFormula(formula, record, models);
        const expected = valueTypeOf(field);
        if (!(actual === expected || (actual === "date" && expected === "datetime")))
          throw new FormulaError(`The formula gives a ${actual}, but ${key} is a ${expected}.`, 0);
        values.push({ field: key, formula, text: raw });
      } catch (error) {
        if (!(error instanceof FormulaError)) throw error;
        ctx.error(value, "invalid-formula", `${what}, ${key}: ${error.message}`, error.hint);
      }
      continue;
    }
    const converted = parseDefault(field.type, raw);
    if (!converted.ok) {
      ctx.error(value, converted.code, `${what}, ${key}: ${converted.message}`, converted.hint);
      continue;
    }
    values.push({ field: key, value: converted.value });
  }
  return values;
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
