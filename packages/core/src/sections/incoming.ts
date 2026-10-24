import type { ParsedNode } from "yaml";
import { isScalar } from "yaml";
import { followRenamed, lostValues } from "../condition.js";
import { checkKeys, type Entry, mapEntries, type ParseContext, readString } from "../context.js";
import type { YamlValue } from "../edit.js";
import { checkFormula, FormulaError, parseFormula, valueTypeOf } from "../formula.js";
import type { FieldIR, IncomingIR, IncomingValueIR, ModelIR } from "../ir.js";
import { humanize } from "../naming.js";
import { type AnyOperation, type Operation, OperationError, refTo } from "../operation.js";
import type { SpecSection } from "../section.js";
import { didYouMean } from "../suggest.js";
import { parseDefault } from "./field-type.js";
import { FIELD_NAME_PATTERN, nameRule } from "./names.js";

/**
 * Incoming calls (docs/design/integrations.md §3): a named address of the app,
 * /incoming/<name>, that another service calls with its secret. Either one record per call
 * (`create` with `set`, values filled from the call's JSON by {path} templates) or the call
 * handed, verified, to code under src/custom/incoming/.
 */

/** Why a field cannot be set by a call, if it cannot. */
function unsettable(field: FieldIR): string | undefined {
  if (field.formula) return "it is computed";
  if (field.type.kind === "relation")
    return field.type.many ? "it is a list" : "a call cannot pick a record to refer to yet";
  if (
    field.type.kind === "scalar" &&
    ["picture", "pictures", "file", "files"].includes(field.type.name)
  )
    return "it holds a file";
  return undefined;
}

/** A template's placeholders, e.g. "{check.name} is down" → ["check.name"]. */
const placeholders = (text: string) => [...text.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1] ?? "");
const PATH = /^[A-Za-z_][\w-]*(\.[A-Za-z_][\w-]*|\.\d+)*$/;

function readValues(
  ctx: ParseContext,
  node: ParsedNode | null,
  model: ModelIR,
  models: ModelIR[],
  where: string,
  /** The map's own name in messages: set, or a reply's then. */
  label = "set",
): IncomingValueIR[] {
  const values: IncomingValueIR[] = [];
  for (const { key, keyNode, value } of mapEntries(ctx, node, `"${label}" of ${where}`) ?? []) {
    const field = model.fields.find((f) => f.name === key);
    if (!field) {
      ctx.error(
        keyNode,
        "unknown-field",
        `${where}: ${model.name} has no field named "${key}".`,
        didYouMean(
          key,
          model.fields.filter((f) => !unsettable(f)).map((f) => f.name),
        ),
      );
      continue;
    }
    const why = unsettable(field);
    if (why) {
      ctx.error(keyNode, "invalid-set", `${where}: ${model.name}.${key} cannot be set, ${why}.`);
      continue;
    }
    const raw = isScalar(value) ? value.value : undefined;
    if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") {
      ctx.error(
        value,
        "invalid-set",
        `${where}: ${key} must be a value, a formula or a {path} text.`,
      );
      continue;
    }
    if (typeof raw === "string" && placeholders(raw).length) {
      const bad = placeholders(raw).find((p) => !PATH.test(p.trim()));
      if (bad !== undefined) {
        ctx.error(
          value,
          "invalid-template",
          `${where}, ${key}: "{${bad}}" is not a path in the call's JSON, like {check.name}.`,
        );
        continue;
      }
      values.push({ field: key, template: raw });
      continue;
    }
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
        ctx.error(value, "invalid-formula", `${where}, ${key}: ${error.message}`, error.hint);
      }
      continue;
    }
    const converted = parseDefault(field.type, raw);
    if (!converted.ok) {
      ctx.error(value, converted.code, `${where}, ${key}: ${converted.message}`, converted.hint);
      continue;
    }
    values.push({ field: key, value: converted.value });
  }
  return values;
}

function readIncoming(
  ctx: ParseContext,
  name: string,
  keyNode: ParsedNode,
  node: ParsedNode | null,
  models: ModelIR[],
): IncomingIR | undefined {
  const where = `incoming "${name}"`;
  const known = checkKeys(ctx, mapEntries(ctx, node, where) ?? [], where, {
    allowed: ["create", "set", "custom", "signed", "header", "id", "as", "mail", "fields", "reply"],
    later: ["run", "find"],
  });
  const byKey = new Map<string, Entry>(known.map((e) => [e.key, e]));
  const text = (key: string) => {
    const entry = byKey.get(key);
    return entry ? readString(ctx, entry.value, `"${key}" of ${where}`) : undefined;
  };
  const customEntry = byKey.get("custom");
  const custom =
    customEntry !== undefined && isScalar(customEntry.value) && customEntry.value.value === true;
  if (customEntry && !custom)
    ctx.error(customEntry.value, "invalid-incoming", `"custom" of ${where} is true or left out.`);
  const create = text("create");
  if (custom === (create !== undefined)) {
    ctx.error(
      keyNode,
      "invalid-incoming",
      `${where.charAt(0).toUpperCase()}${where.slice(1)} needs "create: <Model>" (with "set") or "custom: true", one of them.`,
    );
    return undefined;
  }
  let set: IncomingValueIR[] = [];
  if (create !== undefined) {
    const model = models.find((m) => m.name === create);
    if (model) ctx.reference("model", create, byKey.get("create")?.value);
    if (!model) {
      ctx.error(
        byKey.get("create")?.value ?? keyNode,
        "unknown-model",
        `There is no model named "${create}".`,
        didYouMean(
          create,
          models.map((m) => m.name),
        ),
      );
      return undefined;
    }
    const given = byKey.get("set");
    if (given) set = readValues(ctx, given.value, model, models, where);
  } else if (byKey.has("set"))
    ctx.error(
      byKey.get("set")?.value ?? keyNode,
      "invalid-incoming",
      `A custom ${where} has no "set": its code decides.`,
    );
  const signed = text("signed");
  if (signed !== undefined && signed !== "sha256")
    ctx.error(byKey.get("signed")?.value ?? keyNode, "invalid-incoming", `"signed" is sha256.`);
  const header = text("header");
  if (header !== undefined && !/^[A-Za-z][A-Za-z0-9-]*$/.test(header))
    ctx.error(
      byKey.get("header")?.value ?? keyNode,
      "invalid-incoming",
      `"header" is a header's name, like X-Signature.`,
    );
  const id = text("id");
  if (
    id !== undefined &&
    (placeholders(id).length !== 1 || !PATH.test(placeholders(id)[0]?.trim() ?? ""))
  )
    ctx.error(
      byKey.get("id")?.value ?? keyNode,
      "invalid-template",
      `"id" of ${where} is one {path} in the call's JSON, like "{event.id}".`,
    );
  const as = text("as") ?? "admin";
  // A mail that becomes a record: which field each part of the mail goes to.
  const mailEntry = byKey.get("mail");
  const isMail =
    mailEntry !== undefined && isScalar(mailEntry.value) && mailEntry.value.value === true;
  if (mailEntry && !isMail)
    ctx.error(mailEntry.value, "invalid-incoming", `"mail" of ${where} is true or left out.`);
  let mail: IncomingIR["mail"];
  const fieldsEntry = byKey.get("fields");
  if (isMail) {
    const model = models.find((m) => m.name === create);
    if (!model)
      ctx.error(
        mailEntry?.value ?? keyNode,
        "invalid-incoming",
        `A mail ${where} needs "create: <Model>": the record each mail becomes.`,
      );
    else mail = readMailFields(ctx, fieldsEntry?.value ?? null, model, set, where);
  } else if (fieldsEntry)
    ctx.error(
      fieldsEntry.value,
      "invalid-incoming",
      `"fields" of ${where} is for a mail ("mail: true").`,
    );
  const replyEntry = byKey.get("reply");
  let reply: IncomingIR["reply"];
  if (replyEntry && !mail)
    ctx.error(
      replyEntry.value,
      "invalid-incoming",
      `"reply" of ${where} is for a mail ("mail: true", with "create").`,
    );
  else if (replyEntry && create !== undefined)
    reply = readReply(ctx, replyEntry.value, create, models, where);
  return {
    name,
    ...(create !== undefined ? { create } : {}),
    set,
    custom,
    ...(signed === "sha256" ? { signed: "sha256" as const } : {}),
    ...(header ? { header } : {}),
    ...(id ? { id } : {}),
    as,
    ...(mail ? { mail } : {}),
    ...(reply ? { reply } : {}),
  };
}

/**
 * What a mail of a record's thread becomes (mail-threads.md §2): a record of a model that refers
 * to the entry's own once, the mail's parts in its fields, and what it changes on the record.
 */
function readReply(
  ctx: ParseContext,
  node: ParsedNode | null,
  create: string,
  models: ModelIR[],
  entry: string,
): IncomingIR["reply"] {
  const where = `"reply" of ${entry}`;
  const known = checkKeys(ctx, mapEntries(ctx, node, where) ?? [], where, {
    allowed: ["create", "fields", "set", "then"],
  });
  const byKey = new Map<string, Entry>(known.map((e) => [e.key, e]));
  const createEntry = byKey.get("create");
  const name = createEntry ? readString(ctx, createEntry.value, `"create" of ${where}`) : undefined;
  if (name === undefined) {
    ctx.error(
      node,
      "invalid-incoming",
      `${where} needs "create: <Model>": the record a reply becomes.`,
    );
    return undefined;
  }
  const model = models.find((m) => m.name === name);
  if (model) ctx.reference("model", name, createEntry?.value ?? node);
  if (!model) {
    ctx.error(
      createEntry?.value ?? node,
      "unknown-model",
      `There is no model named "${name}".`,
      didYouMean(
        name,
        models.map((m) => m.name),
      ),
    );
    return undefined;
  }
  const refs = model.fields.filter(
    (f) => f.type.kind === "relation" && !f.type.many && f.type.model === create,
  );
  if (refs.length !== 1 || !refs[0]) {
    ctx.error(
      createEntry?.value ?? node,
      "invalid-incoming",
      `${where}: ${name} must refer to ${create} exactly once, and it does ${refs.length ? `${refs.length} times` : "not"}.`,
      refs.length
        ? undefined
        : `Add a field like "${create[0]?.toLowerCase()}${create.slice(1)}: ${create}!" to ${name}.`,
    );
    return undefined;
  }
  const ref = refs[0].name;
  const set = byKey.get("set")
    ? readValues(ctx, byKey.get("set")?.value ?? null, model, models, where)
    : [];
  const mail = readMailFields(ctx, byKey.get("fields")?.value ?? null, model, set, where);
  const owner = models.find((m) => m.name === create) as ModelIR;
  const update = byKey.get("then")
    ? readValues(ctx, byKey.get("then")?.value ?? null, owner, models, where, "then")
    : [];
  return { create: name, ref, mail, set, update };
}

/** What kinds of field each part of a mail may go to. */
const MAIL_PARTS: Record<string, string[]> = {
  from: ["email", "string"],
  subject: ["string", "text"],
  body: ["text", "markdown", "string"],
  attachments: ["files", "file"],
};

function readMailFields(
  ctx: ParseContext,
  node: ParsedNode | null,
  model: ModelIR,
  set: IncomingValueIR[],
  where: string,
): NonNullable<IncomingIR["mail"]> {
  const mail: NonNullable<IncomingIR["mail"]> = {};
  if (node === null) {
    ctx.error(
      null,
      "invalid-incoming",
      `A mail ${where} needs "fields": which field the sender, subject, body and attachments go to.`,
    );
    return mail;
  }
  for (const { key, keyNode, value } of mapEntries(ctx, node, `"fields" of ${where}`) ?? []) {
    const kinds = MAIL_PARTS[key];
    if (!kinds) {
      ctx.error(
        keyNode,
        "invalid-incoming",
        `"${key}" is no part of a mail: from, subject, body or attachments.`,
      );
      continue;
    }
    const name = isScalar(value) && typeof value.value === "string" ? value.value : undefined;
    const field = model.fields.find((f) => f.name === name);
    if (!field) {
      ctx.error(value, "unknown-field", `${where}: ${model.name} has no field named "${name}".`);
      continue;
    }
    const kind = field.type.kind === "scalar" ? field.type.name : field.type.kind;
    if (!kinds.includes(kind)) {
      ctx.error(
        value,
        "invalid-incoming",
        `${where}: a mail's ${key} goes to a ${kinds.join(" or ")} field, and ${field.name} is a ${kind}.`,
      );
      continue;
    }
    if (set.some((v) => v.field === field.name)) {
      ctx.error(
        value,
        "invalid-incoming",
        `${where}: ${field.name} is in "set" too; give it one way.`,
      );
      continue;
    }
    mail[key as keyof typeof mail] = field.name;
  }
  return mail;
}

/** The values a set takes from the command line: field=value. */
function setArgs(set: string[] | undefined): Record<string, YamlValue> {
  return Object.fromEntries(
    (set ?? []).map((pair) => {
      const at = pair.indexOf("=");
      if (at < 1) throw new OperationError(`"${pair}" is not field=value.`);
      return [pair.slice(0, at), pair.slice(at + 1)];
    }),
  );
}

/** What a reply becomes, as the command line gives it (mail-threads.md §2). */
const REPLY_ARGS = {
  reply: refTo(
    { ref: "model", label: "A reply becomes" },
    { description: "For a mail: the model a reply to one of its records becomes, e.g. Message." },
  ),
  replyFields: {
    type: "array",
    items: { type: "string" },
    description: "For a reply: part=field pairs, e.g. from=from body=body attachments=files.",
  },
  replySet: {
    type: "array",
    items: { type: "string" },
    description: "For a reply: field=value pairs on it, e.g. direction=in.",
  },
  replyThen: {
    type: "array",
    items: { type: "string" },
    description: "For a reply: field=value pairs on the record it joins, e.g. status=open.",
  },
} as const;

function replyValue(
  create: string,
  fields: string[] | undefined,
  set: string[] | undefined,
  then: string[] | undefined,
): Record<string, YamlValue> {
  return {
    create,
    fields: setArgs(fields),
    ...(set?.length ? { set: setArgs(set) } : {}),
    // biome-ignore lint/suspicious/noThenProperty: the spec's own key (mail-threads.md §2)
    ...(then?.length ? { then: setArgs(then) } : {}),
  };
}

const addIncoming: Operation<{
  name: string;
  create?: string;
  set?: string[];
  custom?: boolean;
  signed?: boolean;
  as?: string;
  mail?: boolean;
  fields?: string[];
  reply?: string;
  replyFields?: string[];
  replySet?: string[];
  replyThen?: string[];
}> = {
  name: "addIncoming",
  summary:
    'Add an address other services call (/incoming/<name>, with its own secret): one record per call (--create Model --set field=value, a value may take {path} from the call\'s JSON, like "{check.name}"), or --custom to hand the call to code. --signed checks a sha256 signature of the body instead of the secret itself.',
  schema: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: { type: "string", description: "camelCase, e.g. monitorDown." },
      create: refTo(
        { ref: "model", label: "Kind of record" },
        { description: "The model a call adds a record of." },
      ),
      set: {
        type: "array",
        items: { type: "string" },
        description: 'field=value pairs, e.g. title="{check.name} is down" status=investigating.',
      },
      custom: { type: "boolean", description: "Hand the call to src/custom/incoming/<name>.ts." },
      signed: {
        type: "boolean",
        description: "A sha256 signature of the body, not the secret itself.",
      },
      as: refTo(
        { ref: "role", label: "Acts as" },
        { description: "The role the call acts as (admin when not said)." },
      ),
      mail: {
        type: "boolean",
        description: "The call is a mail that becomes a record (with --create and --fields).",
      },
      fields: {
        type: "array",
        items: { type: "string" },
        description:
          "For a mail: part=field pairs, e.g. from=email subject=title body=body attachments=files.",
      },
      ...REPLY_ARGS,
    },
  },
  positional: ["name"],
  describe: ({ name, create, custom, mail }) =>
    custom
      ? `Add incoming call ${name} (handled by code)`
      : mail
        ? `Add incoming mail ${name} (each mail becomes ${/^[aeiou]/i.test(create ?? "") ? "an" : "a"} ${humanize(create ?? "").toLowerCase()})`
        : `Add incoming call ${name} (adds ${/^[aeiou]/i.test(create ?? "") ? "an" : "a"} ${humanize(create ?? "").toLowerCase()} per call)`,
  destructive: () => false,
  apply(
    { spec },
    {
      name,
      create,
      set,
      custom,
      signed,
      as,
      mail,
      fields,
      reply,
      replyFields,
      replySet,
      replyThen,
    },
    ir,
  ) {
    if (!FIELD_NAME_PATTERN.test(name)) throw new OperationError(nameRule("incoming", name));
    if (ir.incoming.some((i) => i.name === name))
      throw new OperationError(`There is an incoming call named "${name}" already.`);
    if (Boolean(custom) === Boolean(create))
      throw new OperationError("Say --create <Model> or --custom, one of them.");
    if (create && !ir.models.some((m) => m.name === create))
      throw new OperationError(`There is no model named "${create}".`);
    if (mail && !create)
      throw new OperationError("A mail needs --create <Model>: the record each mail becomes.");
    if (reply && !mail)
      throw new OperationError(
        "--reply is for a mail (--mail): what a reply to one of its records becomes.",
      );
    const values = setArgs(set);
    const value: Record<string, YamlValue> = {
      ...(mail ? { mail: true } : {}),
      ...(create
        ? { create, ...(Object.keys(values).length || !mail ? { set: values } : {}) }
        : { custom: true }),
      ...(mail ? { fields: setArgs(fields) } : {}),
      ...(reply ? { reply: replyValue(reply, replyFields, replySet, replyThen) } : {}),
      ...(signed ? { signed: "sha256" } : {}),
      ...(as && as !== "admin" ? { as } : {}),
    };
    if (spec.has(["incoming"])) spec.add(["incoming"], name, value);
    else spec.add([], "incoming", { [name]: value });
    return [];
  },
};

const setIncomingReply: Operation<{
  name: string;
  create?: string;
  fields?: string[];
  set?: string[];
  then?: string[];
  none?: boolean;
}> = {
  name: "setIncomingReply",
  summary:
    "Say what a reply to one of an incoming mail's records becomes (--create Message --fields from=from body=body, --set on it, --then on the record it joins), or --none to make every mail a new record again.",
  schema: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: refTo({ ref: "incoming", label: "Incoming call" }),
      create: REPLY_ARGS.reply,
      fields: REPLY_ARGS.replyFields,
      set: REPLY_ARGS.replySet,
      // biome-ignore lint/suspicious/noThenProperty: the operation's --then, as the spec says it
      then: REPLY_ARGS.replyThen,
      none: { type: "boolean", description: "No replies: every mail becomes a new record." },
    },
  },
  positional: ["name"],
  describe: ({ name, create, none }) =>
    none
      ? `Make every mail to ${name} a new record`
      : `Add a reply to ${name}'s records as ${/^[aeiou]/i.test(create ?? "") ? "an" : "a"} ${humanize(create ?? "").toLowerCase()}`,
  destructive: () => false,
  apply({ spec }, { name, create, fields, set, then, none }, ir) {
    const entry = ir.incoming.find((i) => i.name === name);
    if (!entry) throw new OperationError(`There is no incoming call named "${name}".`);
    if (!entry.mail) throw new OperationError(`${name} is no mail: only a mail has replies.`);
    if (none) {
      if (!entry.reply) throw new OperationError(`${name} has no reply to remove.`);
      spec.remove(["incoming", name, "reply"]);
      return [];
    }
    if (!create) throw new OperationError("Say --create <Model> (and --fields), or --none.");
    if (!ir.models.some((m) => m.name === create))
      throw new OperationError(`There is no model named "${create}".`);
    const value = replyValue(create, fields, set, then);
    if (entry.reply) spec.set(["incoming", name, "reply"], value);
    else spec.add(["incoming", name], "reply", value);
    return [];
  },
};

const removeIncoming: Operation<{ name: string }> = {
  name: "removeIncoming",
  summary: "Remove an incoming call: its address answers no more. Custom code for it stays.",
  schema: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: { name: refTo({ ref: "incoming", label: "Incoming call" }) },
  },
  positional: ["name"],
  describe: ({ name }) => `Remove incoming call ${name}`,
  destructive: () => false,
  apply({ spec }, { name }, ir) {
    if (!ir.incoming.some((i) => i.name === name))
      throw new OperationError(`There is no incoming call named "${name}".`);
    spec.removeAndPrune(["incoming", name], 0);
    return [];
  },
};

/**
 * The summary's words for one: "When monitor down is called: adds an incident, as staff." The
 * model's name in the app's words comes from the caller.
 */
export function incomingText(incoming: IncomingIR, one: (model: string) => string): string {
  const thing = one(incoming.create ?? "");
  const what = incoming.custom
    ? "its code decides what happens"
    : incoming.mail
      ? `a mail becomes ${/^[aeiou]/i.test(thing) ? "an" : "a"} ${thing}${incoming.mail.attachments ? ", its attachments with it" : ""}${incoming.reply ? `; a reply to one of them is added to it as ${/^[aeiou]/i.test(one(incoming.reply.create)) ? "an" : "a"} ${one(incoming.reply.create)}${incoming.reply.update.length ? ` and sets its ${incoming.reply.update.map((v) => v.field).join(" and ")}` : ""}` : ""}`
      : `adds ${/^[aeiou]/i.test(thing) ? "an" : "a"} ${thing}`;
  return `When ${humanize(incoming.name).toLowerCase()} is called: ${what}, as ${incoming.as}${incoming.signed ? "; the call is signed" : ""}.`;
}

export const incomingOperations: AnyOperation[] = [addIncoming, setIncomingReply, removeIncoming];

/** Where a mail's parts go, for an entry and for its reply. */
const MAIL_FIELDS_SCHEMA = {
  type: "object",
  description: "For a mail: the fields its parts go to.",
  additionalProperties: false,
  properties: {
    from: { type: "string", description: "An email field for the sender." },
    subject: { type: "string", description: "A text field for the subject." },
    body: { type: "string", description: "A text or markdown field for the mail's text." },
    attachments: {
      type: "string",
      description: "A file or files field for its attachments.",
    },
  },
} as const;

export const incomingSection: SpecSection<"incoming"> = {
  key: "incoming",
  required: false,
  operations: incomingOperations,
  // A renamed field follows into the entries that name it; a removed one an entry needs is refused.
  follow(spec, effect, ir) {
    // A choice's renamed values follow into the values an entry sets; a value it loses is refused.
    if (effect.kind === "change-field") {
      const before = ir.models
        .find((m) => m.name === effect.model)
        ?.fields.find((f) => f.name === effect.field);
      if (before?.type.kind !== "choice") return undefined;
      for (const i of ir.incoming) {
        const places: [string[], IncomingValueIR[]][] = [
          ...(i.create === effect.model ? [[["set"], i.set] as [string[], IncomingValueIR[]]] : []),
          ...(i.create === effect.model && i.reply
            ? [[["reply", "then"], i.reply.update] as [string[], IncomingValueIR[]]]
            : []),
          ...(i.reply?.create === effect.model
            ? [[["reply", "set"], i.reply.set] as [string[], IncomingValueIR[]]]
            : []),
        ];
        for (const [at, values] of places)
          for (const v of values) {
            if (v.field !== effect.field || !("value" in v) || typeof v.value !== "string")
              continue;
            const now = followRenamed(
              spec,
              ["incoming", i.name, ...at, effect.field],
              v.value,
              effect.renamed ?? {},
            );
            if (lostValues(now, effect.choices).length)
              return {
                refusal: `The incoming call "${i.name}" wants a value ${effect.model}.${effect.field} no longer has; change or remove it first.`,
              };
          }
      }
      return undefined;
    }
    if (effect.kind !== "rename-field" && effect.kind !== "remove-field") return undefined;
    const from = effect.kind === "rename-field" ? effect.from : effect.field;
    for (const i of ir.incoming) {
      const path = ["incoming", i.name];
      // Each place a field of the model is named: [where in the entry, the names there, whether by key].
      const places: [string[], Record<string, string | undefined>, boolean][] = [];
      if (i.create === effect.model) {
        places.push([["set"], Object.fromEntries(i.set.map((v) => [v.field, v.field])), true]);
        if (i.mail) places.push([["fields"], i.mail, false]);
        if (i.reply)
          places.push([
            ["reply", "then"],
            Object.fromEntries(i.reply.update.map((v) => [v.field, v.field])),
            true,
          ]);
      }
      if (i.reply?.create === effect.model) {
        places.push([
          ["reply", "set"],
          Object.fromEntries(i.reply.set.map((v) => [v.field, v.field])),
          true,
        ]);
        places.push([["reply", "fields"], i.reply.mail, false]);
      }
      const named = places.filter(([, names]) => Object.values(names).includes(from));
      const theRef = i.reply?.create === effect.model && i.reply.ref === from;
      if (effect.kind === "remove-field") {
        if (named.length || theRef)
          return {
            refusal: `The incoming call "${i.name}" uses ${effect.model}.${from}; change or remove it first.`,
          };
        continue;
      }
      for (const [at, names, byKey] of named) {
        if (byKey) spec.renameKey([...path, ...at, from], effect.to);
        else
          for (const [part, field] of Object.entries(names))
            if (field === from) spec.set([...path, ...at, part], effect.to);
      }
    }
    return undefined;
  },
  schema: {
    type: "object",
    description:
      "Addresses other services call (/incoming/<name>, each with its own secret): one record per call, or the call handed to code.",
    propertyNames: { pattern: FIELD_NAME_PATTERN.source },
    additionalProperties: {
      type: "object",
      additionalProperties: false,
      properties: {
        create: { type: "string", description: "The model a call adds a record of." },
        set: {
          type: "object",
          description:
            "The record's values: a literal, a formula (NOW()), or a text with {path} from the call's JSON (\"{check.name} is down\").",
          additionalProperties: { type: ["string", "number", "boolean"] },
        },
        custom: {
          const: true,
          description: "Hand the verified call to src/custom/incoming/<name>.ts.",
        },
        signed: {
          const: "sha256",
          description: "A sha256 signature of the body, made with the secret.",
        },
        header: { type: "string", description: "The header the secret or signature comes in." },
        id: {
          type: "string",
          description: 'The call\'s own id, e.g. "{event.id}": a repeat is not acted on.',
        },
        as: { type: "string", description: "The role the call acts as (admin when not said)." },
        mail: {
          const: true,
          description: "The call's body is a mail (from, to, subject, text, html, attachments).",
        },
        fields: MAIL_FIELDS_SCHEMA,
        reply: {
          type: "object",
          description:
            "For a mail: what a mail of one of its records' threads becomes (a reply, by its headers or the subject's [app #id] tag), instead of a new record.",
          additionalProperties: false,
          required: ["create", "fields"],
          properties: {
            create: {
              type: "string",
              description: "The model a reply becomes; it refers to the entry's own once.",
            },
            fields: MAIL_FIELDS_SCHEMA,
            set: {
              type: "object",
              description: "The reply's other values, e.g. { direction: in }.",
              additionalProperties: { type: ["string", "number", "boolean"] },
            },
            // biome-ignore lint/suspicious/noThenProperty: the spec's own key (mail-threads.md §2)
            then: {
              type: "object",
              description: "Values set on the record it joins, e.g. { status: open }.",
              additionalProperties: { type: ["string", "number", "boolean"] },
            },
          },
        },
      },
    },
  },
  parse(ctx, node, parsed) {
    if (node === undefined) return [];
    const models = parsed.models ?? [];
    const incoming: IncomingIR[] = [];
    const seenLower = new Set<string>();
    for (const { key, keyNode, value } of mapEntries(ctx, node, `"incoming"`) ?? []) {
      if (!FIELD_NAME_PATTERN.test(key)) {
        ctx.error(keyNode, "invalid-name", nameRule("incoming", key));
        continue;
      }
      const lower = key.toLowerCase();
      if (seenLower.has(lower)) {
        ctx.error(
          keyNode,
          "duplicate-incoming",
          `There is already an incoming call named "${key}" (names are case-insensitive).`,
        );
        continue;
      }
      seenLower.add(lower);
      ctx.define("incoming", key);
      const read = readIncoming(ctx, key, keyNode, value, models);
      if (read) incoming.push(read);
    }
    return incoming;
  },
};
