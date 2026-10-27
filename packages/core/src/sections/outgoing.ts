import { isSeq } from "yaml";
import {
  conditionArgs,
  conditionText,
  followRenamed,
  lostValues,
  readCondition,
} from "../condition.js";
import { checkKeys, mapEntries, readNameList, readString } from "../context.js";
import type { YamlValue } from "../edit.js";
import type {
  ActionIR,
  Condition,
  ModelIR,
  OutgoingIR,
  RecipientIR,
  StandardActionIR,
  TimerIR,
} from "../ir.js";
import { humanize } from "../naming.js";
import { type AnyOperation, type Operation, OperationError, refTo } from "../operation.js";
import type { SpecSection } from "../section.js";
import { didYouMean } from "../suggest.js";
import { FIELD_NAME_PATTERN, nameRule } from "./names.js";

/**
 * Outgoing: something happens to a record and the app tells someone (docs/design/integrations.md
 * §4). A mail to the record's owner, a role or an address on the record; later a signed call to a
 * named target. The spec says when and whom; the adapter writes the call in the change's
 * transaction and sends it afterwards.
 */

const EVENTS = ["created", "changed", "deleted"] as const;

/** `Booking created`, or an action's name. */
const WHEN = /^([A-Z][A-Za-z0-9]*)\s+(created|changed|deleted)$/;

type When = OutgoingIR["when"];

/**
 * Reads `when`: a model's event, an action (standard or custom) or a timer; says what is wrong
 * otherwise.
 */
function readWhen(
  text: string,
  models: ModelIR[],
  actions: ActionIR[],
  timers: TimerIR[] = [],
): { when: When } | { problem: string; hint?: string } {
  const event = WHEN.exec(text.trim());
  if (event) {
    const [, model = "", kind = ""] = event;
    if (!models.some((m) => m.name === model))
      return {
        problem: `There is no model named "${model}".`,
        hint: didYouMean(
          model,
          models.map((m) => m.name),
        ),
      };
    return { when: { model, event: kind as (typeof EVENTS)[number] } };
  }
  const action = actions.find((a) => a.name === text.trim());
  const timer = timers.find((t) => t.name === text.trim());
  // A timer may run an action of the same name (the design's own example); "when" then cannot
  // tell them apart, so it asks for one of them to be renamed.
  if (action && timer)
    return {
      problem: `"${text.trim()}" is both an action and a timer, so "when" cannot tell which; rename one of them.`,
    };
  // A custom action has no record: the call carries its input and output (integrations.md §4.3).
  if (action)
    return {
      when: action.custom ? { custom: action.name } : { model: action.on, action: action.name },
    };
  if (timer) {
    // A timer's event comes per record; one without records has nothing to tell about.
    if (!timer.on)
      return {
        problem: `the timer "${timer.name}" runs for no records (no "on"), so there is no record to tell anyone about; the action it runs may mail.`,
      };
    return { when: { model: timer.on, timer: timer.name } };
  }
  return {
    problem: `"when" is "<Model> created", "<Model> changed", "<Model> deleted", the name of an action or the name of a timer; "${text}" is none of them.`,
    hint: didYouMean(text.trim(), [...actions.map((a) => a.name), ...timers.map((t) => t.name)]),
  };
}

/**
 * The mail's recipient: owner, a role, an address on the record (one reference away at most), or
 * the records of a list field and then the owner or an address of each (`bookings.owner`).
 */
function readRecipient(
  text: string,
  model: ModelIR,
  models: ModelIR[],
): { recipient: RecipientIR; role?: string } | { problem: string } {
  if (text === "owner") return { recipient: { kind: "owner" } };
  const path = text.split(".");
  const addressOf = (of: ModelIR, name: string): "email" | "user" | undefined => {
    const f = of.fields.find((x) => x.name === name);
    if (!f) return undefined;
    if (f.type.kind === "scalar" && f.type.name === "email") return "email";
    if (f.type.kind === "relation" && !f.type.many && f.type.model === "User") return "user";
    return undefined;
  };
  if (path.length === 1) {
    const via = addressOf(model, text);
    if (via) return { recipient: { kind: "field", path, via } };
    if (model.fields.some((f) => f.name === text))
      return {
        problem: `${model.name}.${text} is neither an email field nor a field that refers to User, so it holds no address.`,
      };
    if (!FIELD_NAME_PATTERN.test(text))
      return {
        problem: `"recipient" is owner, a role, or a field with an address; "${text}" is none.`,
      };
    // A role, checked once every section is parsed.
    return { recipient: { kind: "role", role: text }, role: text };
  }
  if (path.length === 2) {
    const [first = "", second = ""] = path;
    const ref = model.fields.find((f) => f.name === first);
    const type = ref?.type;
    if (!ref || type?.kind !== "relation")
      return {
        problem: `${model.name}.${first} is not a reference to one record or a list of them, so "${text}" leads nowhere.`,
      };
    const other = models.find((m) => m.name === type.model);
    if (type.many) {
      // Every record of the list: its owner, or an address on it.
      if (second === "owner")
        return {
          recipient: { kind: "list", list: first, model: type.model, each: { kind: "owner" } },
        };
      const via = other ? addressOf(other, second) : undefined;
      if (!via)
        return {
          problem: `${type.model}.${second} is not owner, an email field or a field that refers to User, so "${text}" tells nobody.`,
        };
      return {
        recipient: {
          kind: "list",
          list: first,
          model: type.model,
          each: { kind: "field", field: second, via },
        },
      };
    }
    const via = other ? addressOf(other, second) : undefined;
    if (!via)
      return {
        problem: `${type.model}.${second} is not an email field or a field that refers to User, so "${text}" holds no address.`,
      };
    return { recipient: { kind: "field", path, via } };
  }
  return { problem: `"recipient" goes one reference away at most: "${text}" goes further.` };
}

/** A recipient as the spec writes it. */
function recipientText(r: RecipientIR): string {
  return r.kind === "owner"
    ? "owner"
    : r.kind === "role"
      ? r.role
      : r.kind === "field"
        ? r.path.join(".")
        : `${r.list}.${r.each.kind === "owner" ? "owner" : r.each.field}`;
}

/**
 * `fields`: the stored fields of the model whose change counts, only for `<Model> changed`; says
 * what is wrong otherwise.
 */
function readFields(
  fields: string[],
  when: When,
  model: ModelIR,
): { fields: string[] } | { problem: string } {
  if (!("event" in when) || when.event !== "changed")
    return {
      problem: `"fields" says which fields' change counts, so it goes with "${model.name} changed" only.`,
    };
  if (!fields.length) return { problem: `"fields" names at least one field of ${model.name}.` };
  for (const name of fields) {
    const f = model.fields.find((x) => x.name === name);
    if (!f)
      return {
        problem: `${model.name} has no field named "${name}".${
          didYouMean(
            name,
            model.fields.map((x) => x.name),
          )
            ? ` ${didYouMean(
                name,
                model.fields.map((x) => x.name),
              )}`
            : ""
        }`,
      };
    if (f.formula)
      return {
        problem: `${model.name}.${name} is worked out from other fields, so it never changes by itself; name those.`,
      };
    if (f.type.kind === "relation" && f.type.many)
      return {
        problem: `${model.name}.${name} lists other records and stores nothing, so it never changes by itself.`,
      };
  }
  return { fields: [...new Set(fields)] };
}

const EVENT_WORDS = { created: "added", changed: "changed", deleted: "deleted" } as const;

/**
 * "When a booking is added and status is confirmed: mails its owner." The model's word comes from
 * `label` when the summary has the content file's labels.
 */
export function outgoingText(o: OutgoingIR, label?: (model: string) => string): string {
  const to = toText(o, label);
  if ("custom" in o.when) return `When “${humanize(o.when.custom)}” runs: ${to}.`;
  const name = (label ?? ((m: string) => humanize(m).toLowerCase()))(o.when.model);
  const changes = "event" in o.when && o.when.event === "changed" && o.where;
  const watched = o.fields?.length
    ? o.fields.map((f) => humanize(f).toLowerCase()).join(" or ")
    : undefined;
  const what = watched
    ? `When a ${name}'s ${watched} changes${o.where ? ` so that ${conditionText(o.where as Condition)}` : ""}`
    : changes
      ? `When a ${name} changes so that ${conditionText(o.where as Condition)}`
      : "event" in o.when
        ? `When a ${name} is ${EVENT_WORDS[o.when.event]}${o.where ? ` and ${conditionText(o.where)}` : ""}`
        : "timer" in o.when
          ? `When the timer “${humanize(o.when.timer)}” comes for a ${name}${o.where ? ` and ${conditionText(o.where)}` : ""}`
          : `When “${humanize(o.when.action)}” runs on a ${name}${o.where ? ` and ${conditionText(o.where)}` : ""}`;
  return `${what}: ${to}.`;
}

/** Whom an entry tells, in words: "mails its owner", "tells statusfeed". */
function toText(o: OutgoingIR, label?: (model: string) => string): string {
  return o.to !== "mail"
    ? `tells ${humanize(o.to).toLowerCase()}`
    : !o.recipient
      ? "mails"
      : o.recipient.kind === "owner"
        ? "mails its owner"
        : o.recipient.kind === "role"
          ? `mails every ${o.recipient.role}`
          : o.recipient.kind === "list"
            ? `mails every ${(label ?? ((m: string) => humanize(m).toLowerCase()))(o.recipient.model)}'s ${o.recipient.each.kind === "owner" ? "owner" : humanize(o.recipient.each.field).toLowerCase()}`
            : `mails ${o.recipient.path.map((p) => humanize(p).toLowerCase()).join("'s ")}`;
}

const named = refTo(
  { ref: "outgoing", label: "Which" },
  { description: "The name, e.g. bookingMade." },
);

const whenSchema = {
  type: "string",
  description:
    'What happens: "<Model> created", "<Model> changed" or "<Model> deleted", or the name of an action (a custom one too: after it returns), e.g. "Booking created" or "resolve".',
};
const whereSchema = {
  type: "object",
  propertyNames: { pattern: FIELD_NAME_PATTERN.source },
  additionalProperties: { type: ["string", "boolean", "array"], items: { type: "string" } },
  description:
    "Only for records with these values, e.g. { status: confirmed }; a change counts when the record comes to fit them.",
};

const fieldsSchema = {
  type: "array",
  items: { type: "string", pattern: FIELD_NAME_PATTERN.source },
  minItems: 1,
  description:
    'For "<Model> changed": only a change of one of these fields counts, e.g. [startsAt].',
};

const addOutgoing: Operation<{
  outgoing: string;
  when: string;
  where?: Record<string, string | boolean | string[]>;
  fields?: string[];
  to?: string;
  recipient?: string;
}> = {
  name: "addOutgoing",
  summary:
    "Tell someone when something happens to a record: mail the record's owner, a role or an address on the record when a record is added, changed or deleted, or an action runs (e.g. a confirmation when a booking is made).",
  schema: {
    type: "object",
    required: ["outgoing", "when"],
    additionalProperties: false,
    properties: {
      outgoing: { type: "string", minLength: 1, description: "camelCase name, e.g. bookingMade." },
      when: whenSchema,
      where: whereSchema,
      fields: fieldsSchema,
      to: {
        type: "string",
        description: '"mail" (the default), or the name of a target whose address is a setting.',
      },
      recipient: {
        type: "string",
        description:
          'For mail: "owner", a role (admin), an email field of the record (email), a field that refers to User (assignee), one reference away (customer.email), or a list field and then the owner or an address of each of its records (bookings.owner).',
      },
    },
  },
  positional: ["outgoing", "when"],
  describe: ({ outgoing, when, to, recipient }) =>
    `Add ${outgoing}: when ${when}, ${to && to !== "mail" ? `tell ${to}` : `mail ${recipient ?? "someone"}`}`,
  destructive: () => false,
  apply({ spec }, { outgoing, when, where, fields, to = "mail", recipient }, ir) {
    if (!FIELD_NAME_PATTERN.test(outgoing))
      throw new OperationError(nameRule("outgoing", outgoing));
    if (ir.outgoing.some((o) => o.name === outgoing))
      throw new OperationError(`"${outgoing}" exists already under outgoing.`);
    const read = readWhen(when, ir.models, ir.actions, ir.timers);
    if ("problem" in read)
      throw new OperationError(`${read.problem}${read.hint ? ` ${read.hint}` : ""}`);
    if ("custom" in read.when) {
      const r = readCustom(read.when.custom, { where, fields, to, recipient });
      if (r) throw new OperationError(r);
    }
    const model = ir.models.find(
      (m) => "model" in read.when && m.name === read.when.model,
    ) as ModelIR;
    if (fields && !("custom" in read.when)) {
      const f = readFields(fields, read.when, model);
      if ("problem" in f) throw new OperationError(f.problem);
    }
    if (to === "mail") {
      if (!recipient)
        throw new OperationError(
          "Mail needs a recipient: --recipient owner, a role, or a field with an address (email, customer.email).",
        );
      if (!("custom" in read.when)) {
        const r = readRecipient(recipient, model, ir.models);
        if ("problem" in r) throw new OperationError(r.problem);
      }
    } else {
      if (!FIELD_NAME_PATTERN.test(to)) throw new OperationError(nameRule("outgoing", to));
      if (recipient)
        throw new OperationError(`A target has its own address: "recipient" is for mail.`);
    }
    const value: Record<string, YamlValue> = { when };
    if (where && Object.keys(where).length) value.where = conditionArgs(where);
    if (fields?.length) value.fields = [...new Set(fields)];
    value.to = to;
    if (recipient) value.recipient = recipient;
    if (spec.has(["outgoing"])) spec.add(["outgoing"], outgoing, value);
    else spec.add([], "outgoing", { [outgoing]: value });
    return [];
  },
};

const removeOutgoing: Operation<{ outgoing: string }> = {
  name: "removeOutgoing",
  summary: "Stop telling someone when something happens: remove an outgoing mail or call.",
  schema: {
    type: "object",
    required: ["outgoing"],
    additionalProperties: false,
    properties: { outgoing: named },
  },
  positional: ["outgoing"],
  describe: ({ outgoing }) => `Remove ${outgoing} from outgoing`,
  destructive: () => false,
  apply({ spec }, { outgoing }, ir) {
    if (!ir.outgoing.some((o) => o.name === outgoing))
      throw new OperationError(`There is nothing named "${outgoing}" under outgoing.`);
    spec.removeAndPrune(["outgoing", outgoing], 0);
    return [];
  },
};

export const outgoingSection: SpecSection<"outgoing"> = {
  key: "outgoing",
  required: false,
  operations: [addOutgoing, removeOutgoing] as AnyOperation[],
  schema: {
    type: "object",
    description:
      "Who is told when something happens to a record: a mail to the owner, a role or an address on the record; or a signed call to a named target.",
    propertyNames: { pattern: FIELD_NAME_PATTERN.source },
    additionalProperties: {
      type: "object",
      required: ["when", "to"],
      additionalProperties: false,
      properties: {
        when: whenSchema,
        where: whereSchema,
        fields: fieldsSchema,
        to: {
          type: "string",
          pattern: FIELD_NAME_PATTERN.source,
          description: '"mail", or the name of a target whose address and secret are settings.',
        },
        recipient: {
          type: "string",
          pattern: "^[a-z][A-Za-z0-9]*(?:\\.[a-z][A-Za-z0-9]*)?$",
          description:
            "For mail: owner, a role, an email field or a field that refers to User, one reference away (customer.email), or a list field and then the owner or an address of each of its records (bookings.owner).",
        },
      },
    },
  },
  parse(ctx, node, parsed) {
    if (node === undefined) return [];
    const models = parsed.models ?? [];
    const actions = parsed.actions ?? [];
    const out: OutgoingIR[] = [];
    for (const { key, keyNode, value } of mapEntries(ctx, node, `"outgoing"`) ?? []) {
      if (!FIELD_NAME_PATTERN.test(key)) {
        ctx.error(keyNode, "invalid-name", nameRule("outgoing", key));
        continue;
      }
      const where = `outgoing "${key}"`;
      const known = checkKeys(ctx, mapEntries(ctx, value, where) ?? [], where, {
        allowed: ["when", "where", "fields", "to", "recipient"],
      });
      const byKey = new Map(known.map((e) => [e.key, e]));
      const whenEntry = byKey.get("when");
      if (!whenEntry) {
        ctx.error(keyNode, "missing-key", `${capital(where)} needs "when".`);
        continue;
      }
      const whenText = readString(ctx, whenEntry.value, `"when" of ${where}`);
      if (whenText === undefined) continue;
      const read = readWhen(whenText, models, actions, parsed.timers ?? []);
      if ("problem" in read) {
        ctx.error(
          whenEntry.value,
          "invalid-outgoing",
          `${capital(where)}: ${read.problem}`,
          read.hint,
        );
        continue;
      }
      const model = models.find(
        (m) => "model" in read.when && m.name === read.when.model,
      ) as ModelIR;
      // A model's event names the model in the text; a standard action names only the action.
      if ("event" in read.when) ctx.reference("model", read.when.model, whenEntry.value);
      if ("custom" in read.when) {
        const problem = readCustom(read.when.custom, {
          where: byKey.has("where") ? {} : undefined,
          fields: byKey.has("fields") ? [] : undefined,
          to: byKey.has("to")
            ? readString(ctx, byKey.get("to")?.value, `"to" of ${where}`)
            : undefined,
          recipient: byKey.has("recipient")
            ? readString(ctx, byKey.get("recipient")?.value, `"recipient" of ${where}`)
            : undefined,
        });
        if (problem) {
          ctx.error(whenEntry.value, "invalid-outgoing", `${capital(where)}: ${problem}`);
          continue;
        }
      }
      const toEntry = byKey.get("to");
      if (!toEntry) {
        ctx.error(keyNode, "missing-key", `${capital(where)} needs "to": mail, or a target.`);
        continue;
      }
      const to = readString(ctx, toEntry.value, `"to" of ${where}`);
      if (to === undefined) continue;
      if (!FIELD_NAME_PATTERN.test(to)) {
        ctx.error(
          toEntry.value,
          "invalid-outgoing",
          `${capital(where)}: ${nameRule("outgoing", to)}`,
        );
        continue;
      }
      const entry: OutgoingIR = { name: key, when: read.when, to };
      const whereEntry = byKey.get("where");
      if (whereEntry) {
        const condition = readCondition(ctx, whereEntry.value, `"where" of ${where}`, model);
        if (condition && Object.keys(condition).length) entry.where = condition;
      }
      const fieldsEntry = byKey.get("fields");
      if (fieldsEntry) {
        const names = readNameList(ctx, fieldsEntry.value, `"fields" of ${where}`).map(
          (n) => n.name,
        );
        // Not a list: said once already.
        if (!isSeq(fieldsEntry.value)) continue;
        const f = readFields(names, read.when, model);
        if ("problem" in f) {
          ctx.error(fieldsEntry.value, "invalid-outgoing", `${capital(where)}: ${f.problem}`);
          continue;
        }
        entry.fields = f.fields;
      }
      const recipientEntry = byKey.get("recipient");
      const recipientText = recipientEntry
        ? readString(ctx, recipientEntry.value, `"recipient" of ${where}`)
        : undefined;
      if (to === "mail") {
        if (!recipientEntry) {
          ctx.error(
            keyNode,
            "missing-key",
            `${capital(where)} mails, so it needs "recipient": owner, a role, or a field with an address.`,
          );
          continue;
        }
        if (recipientText === undefined) continue;
        if ("custom" in read.when) {
          ctx.reference("role", recipientText, recipientEntry.value);
          entry.recipient = { kind: "role", role: recipientText };
          out.push(entry);
          continue;
        }
        const r = readRecipient(recipientText, model, models);
        if ("problem" in r) {
          ctx.error(recipientEntry.value, "invalid-outgoing", `${capital(where)}: ${r.problem}`);
          continue;
        }
        if (r.role) ctx.reference("role", r.role, recipientEntry.value);
        entry.recipient = r.recipient;
      } else if (recipientEntry) {
        ctx.error(
          recipientEntry.keyNode,
          "invalid-outgoing",
          `${capital(where)} tells ${to}, which has its own address: "recipient" is for mail.`,
        );
        continue;
      }
      out.push(entry);
    }
    return out;
  },
  follow(spec, effect, ir) {
    for (const o of ir.outgoing) {
      const at = ["outgoing", o.name];
      const path = o.recipient?.kind === "field" ? o.recipient.path : [];
      const waits =
        "action" in o.when ? o.when.action : "custom" in o.when ? o.when.custom : undefined;
      if (effect.kind === "remove-action" && waits === effect.action)
        return {
          refusal: `"${o.name}" under outgoing waits for the action "${effect.action}"; remove it first.`,
        };
      // A custom action's entry names no field of a record.
      if ("custom" in o.when) continue;
      const on = o.when.model;
      const list = o.recipient?.kind === "list" ? o.recipient : undefined;
      if (effect.kind === "rename-field") {
        if (o.when.model === effect.model && o.where?.[effect.from] !== undefined)
          spec.renameKey([...at, "where", effect.from], effect.to);
        if (o.when.model === effect.model && o.fields?.includes(effect.from))
          spec.set(
            [...at, "fields"],
            o.fields.map((f) => (f === effect.from ? effect.to : f)),
          );
        if (list && o.when.model === effect.model && list.list === effect.from)
          spec.set([...at, "recipient"], recipientText({ ...list, list: effect.to }));
        if (
          list &&
          list.model === effect.model &&
          list.each.kind === "field" &&
          list.each.field === effect.from
        )
          spec.set(
            [...at, "recipient"],
            recipientText({ ...list, each: { ...list.each, field: effect.to } }),
          );
        if (path[0] === effect.from && o.when.model === effect.model)
          spec.set([...at, "recipient"], [effect.to, ...path.slice(1)].join("."));
        if (path.length === 2 && path[1] === effect.from) {
          const ref = ir.models.find((m) => m.name === on)?.fields.find((f) => f.name === path[0]);
          if (ref?.type.kind === "relation" && ref.type.model === effect.model)
            spec.set([...at, "recipient"], [path[0], effect.to].join("."));
        }
      }
      if (effect.kind === "remove-field" || effect.kind === "change-field") {
        const uses = (model: string, field: string) =>
          `"${o.name}" under outgoing uses ${model}.${field}; change or remove it first.`;
        const wanted = o.when.model === effect.model ? o.where?.[effect.field] : undefined;
        if (wanted !== undefined) {
          if (effect.kind === "remove-field") return { refusal: uses(effect.model, effect.field) };
          const now = followRenamed(
            spec,
            [...at, "where", effect.field],
            wanted,
            effect.renamed ?? {},
          );
          if (lostValues(now, effect.choices).length)
            return {
              refusal: `"${o.name}" under outgoing wants a value ${effect.model}.${effect.field} no longer has; change or remove it first.`,
            };
        }
        if (o.when.model === effect.model && path[0] === effect.field)
          return { refusal: uses(effect.model, effect.field) };
        if (
          effect.kind === "remove-field" &&
          o.when.model === effect.model &&
          o.fields?.includes(effect.field)
        )
          return { refusal: uses(effect.model, effect.field) };
        if (list && o.when.model === effect.model && list.list === effect.field)
          return { refusal: uses(effect.model, effect.field) };
        if (
          list &&
          list.model === effect.model &&
          list.each.kind === "field" &&
          list.each.field === effect.field
        )
          return { refusal: uses(effect.model, effect.field) };
        if (path.length === 2 && path[1] === effect.field) {
          const ref = ir.models.find((m) => m.name === on)?.fields.find((f) => f.name === path[0]);
          if (ref?.type.kind === "relation" && ref.type.model === effect.model)
            return { refusal: uses(effect.model, effect.field) };
        }
      }
    }
    return undefined;
  },
};

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * What a custom action's entry may say: it has no record, so no `where` or `fields`, and a mail
 * goes to a role (an owner or an address field would be a record's). Returns what is wrong.
 */
function readCustom(
  action: string,
  o: { where?: object; fields?: string[]; to?: string; recipient?: string },
): string | undefined {
  if (o.where !== undefined || o.fields !== undefined)
    return `the custom action "${action}" has no record, so "where" and "fields" say nothing; leave them out.`;
  if (o.to === "mail" && o.recipient !== undefined && !/^[a-z][A-Za-z0-9]*$/.test(o.recipient))
    return `the custom action "${action}" has no record, so its mail goes to a role; "${o.recipient}" is not one.`;
  if (o.to === "mail" && o.recipient === "owner")
    return `the custom action "${action}" has no record and so no owner; mail a role instead.`;
  return undefined;
}
