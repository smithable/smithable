import {
  conditionArgs,
  conditionText,
  followRenamed,
  lostValues,
  readCondition,
} from "../condition.js";
import { checkKeys, mapEntries, readString } from "../context.js";
import type { YamlValue } from "../edit.js";
import type { Condition, ModelIR, OutgoingIR, RecipientIR, StandardActionIR } from "../ir.js";
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

/** Reads `when`: a model's event, or a standard action; says what is wrong otherwise. */
function readWhen(
  text: string,
  models: ModelIR[],
  actions: StandardActionIR[],
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
  if (action) return { when: { model: action.on, action: action.name } };
  return {
    problem: `"when" is "<Model> created", "<Model> changed", "<Model> deleted" or the name of a standard action; "${text}" is neither.`,
    hint: didYouMean(
      text.trim(),
      actions.map((a) => a.name),
    ),
  };
}

/** The mail's recipient: owner, a role, or an address on the record (one reference away at most). */
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
    if (!ref || type?.kind !== "relation" || type.many)
      return {
        problem: `${model.name}.${first} is not a reference to one record, so "${text}" leads nowhere.`,
      };
    const other = models.find((m) => m.name === type.model);
    const via = other ? addressOf(other, second) : undefined;
    if (!via)
      return {
        problem: `${type.model}.${second} is not an email field or a field that refers to User, so "${text}" holds no address.`,
      };
    return { recipient: { kind: "field", path, via } };
  }
  return { problem: `"recipient" goes one reference away at most: "${text}" goes further.` };
}

const EVENT_WORDS = { created: "added", changed: "changed", deleted: "deleted" } as const;

/**
 * "When a booking is added and status is confirmed: mails its owner." The model's word comes from
 * `label` when the summary has the content file's labels.
 */
export function outgoingText(o: OutgoingIR, label?: (model: string) => string): string {
  const name = (label ?? ((m: string) => humanize(m).toLowerCase()))(o.when.model);
  const changes = "event" in o.when && o.when.event === "changed" && o.where;
  const what = changes
    ? `When a ${name} changes so that ${conditionText(o.where as Condition)}`
    : "event" in o.when
      ? `When a ${name} is ${EVENT_WORDS[o.when.event]}${o.where ? ` and ${conditionText(o.where)}` : ""}`
      : `When “${humanize(o.when.action)}” runs on a ${name}${o.where ? ` and ${conditionText(o.where)}` : ""}`;
  const to =
    o.to !== "mail"
      ? `tells ${humanize(o.to).toLowerCase()}`
      : !o.recipient
        ? "mails"
        : o.recipient.kind === "owner"
          ? "mails its owner"
          : o.recipient.kind === "role"
            ? `mails every ${o.recipient.role}`
            : `mails ${o.recipient.path.map((p) => humanize(p).toLowerCase()).join("'s ")}`;
  return `${what}: ${to}.`;
}

const named = refTo(
  { ref: "outgoing", label: "Which" },
  { description: "The name, e.g. bookingMade." },
);

const whenSchema = {
  type: "string",
  description:
    'What happens: "<Model> created", "<Model> changed" or "<Model> deleted", or the name of a standard action, e.g. "Booking created" or "resolve".',
};
const whereSchema = {
  type: "object",
  propertyNames: { pattern: FIELD_NAME_PATTERN.source },
  additionalProperties: { type: ["string", "boolean", "array"], items: { type: "string" } },
  description:
    "Only for records with these values, e.g. { status: confirmed }; a change counts when the record comes to fit them.",
};

const addOutgoing: Operation<{
  outgoing: string;
  when: string;
  where?: Record<string, string | boolean | string[]>;
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
      to: {
        type: "string",
        description: '"mail" (the default), or the name of a target whose address is a setting.',
      },
      recipient: {
        type: "string",
        description:
          'For mail: "owner", a role (admin), an email field of the record (email), a field that refers to User (assignee), or one reference away (customer.email).',
      },
    },
  },
  positional: ["outgoing", "when"],
  describe: ({ outgoing, when, to, recipient }) =>
    `Add ${outgoing}: when ${when}, ${to && to !== "mail" ? `tell ${to}` : `mail ${recipient ?? "someone"}`}`,
  destructive: () => false,
  apply({ spec }, { outgoing, when, where, to = "mail", recipient }, ir) {
    if (!FIELD_NAME_PATTERN.test(outgoing))
      throw new OperationError(nameRule("outgoing", outgoing));
    if (ir.outgoing.some((o) => o.name === outgoing))
      throw new OperationError(`"${outgoing}" exists already under outgoing.`);
    const read = readWhen(
      when,
      ir.models,
      ir.actions.filter((a): a is StandardActionIR => !a.custom),
    );
    if ("problem" in read)
      throw new OperationError(`${read.problem}${read.hint ? ` ${read.hint}` : ""}`);
    const model = ir.models.find((m) => m.name === read.when.model) as ModelIR;
    if (to === "mail") {
      if (!recipient)
        throw new OperationError(
          "Mail needs a recipient: --recipient owner, a role, or a field with an address (email, customer.email).",
        );
      const r = readRecipient(recipient, model, ir.models);
      if ("problem" in r) throw new OperationError(r.problem);
    } else {
      if (!FIELD_NAME_PATTERN.test(to)) throw new OperationError(nameRule("outgoing", to));
      if (recipient)
        throw new OperationError(`A target has its own address: "recipient" is for mail.`);
    }
    const value: Record<string, YamlValue> = { when };
    if (where && Object.keys(where).length) value.where = conditionArgs(where);
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
        to: {
          type: "string",
          pattern: FIELD_NAME_PATTERN.source,
          description: '"mail", or the name of a target whose address and secret are settings.',
        },
        recipient: {
          type: "string",
          pattern: "^[a-z][A-Za-z0-9]*(?:\\.[a-z][A-Za-z0-9]*)?$",
          description:
            "For mail: owner, a role, an email field or a field that refers to User, or one reference away (customer.email).",
        },
      },
    },
  },
  parse(ctx, node, parsed) {
    if (node === undefined) return [];
    const models = parsed.models ?? [];
    const actions = (parsed.actions ?? []).filter((a): a is StandardActionIR => !a.custom);
    const out: OutgoingIR[] = [];
    for (const { key, keyNode, value } of mapEntries(ctx, node, `"outgoing"`) ?? []) {
      if (!FIELD_NAME_PATTERN.test(key)) {
        ctx.error(keyNode, "invalid-name", nameRule("outgoing", key));
        continue;
      }
      const where = `outgoing "${key}"`;
      const known = checkKeys(ctx, mapEntries(ctx, value, where) ?? [], where, {
        allowed: ["when", "where", "to", "recipient"],
      });
      const byKey = new Map(known.map((e) => [e.key, e]));
      const whenEntry = byKey.get("when");
      if (!whenEntry) {
        ctx.error(keyNode, "missing-key", `${capital(where)} needs "when".`);
        continue;
      }
      const whenText = readString(ctx, whenEntry.value, `"when" of ${where}`);
      if (whenText === undefined) continue;
      const read = readWhen(whenText, models, actions);
      if ("problem" in read) {
        ctx.error(
          whenEntry.value,
          "invalid-outgoing",
          `${capital(where)}: ${read.problem}`,
          read.hint,
        );
        continue;
      }
      const model = models.find((m) => m.name === read.when.model) as ModelIR;
      // A model's event names the model in the text; a standard action names only the action.
      if ("event" in read.when) ctx.reference("model", read.when.model, whenEntry.value);
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
      if (effect.kind === "remove-action" && "action" in o.when && o.when.action === effect.action)
        return {
          refusal: `"${o.name}" under outgoing waits for the action "${effect.action}"; remove it first.`,
        };
      if (effect.kind === "rename-field") {
        if (o.when.model === effect.model && o.where?.[effect.from] !== undefined)
          spec.renameKey([...at, "where", effect.from], effect.to);
        if (path[0] === effect.from && o.when.model === effect.model)
          spec.set([...at, "recipient"], [effect.to, ...path.slice(1)].join("."));
        if (path.length === 2 && path[1] === effect.from) {
          const ref = ir.models
            .find((m) => m.name === o.when.model)
            ?.fields.find((f) => f.name === path[0]);
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
        if (path.length === 2 && path[1] === effect.field) {
          const ref = ir.models
            .find((m) => m.name === o.when.model)
            ?.fields.find((f) => f.name === path[0]);
          if (ref?.type.kind === "relation" && ref.type.model === effect.model)
            return { refusal: uses(effect.model, effect.field) };
        }
      }
    }
    return undefined;
  },
};

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
