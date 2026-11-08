import { isScalar, type ParsedNode } from "yaml";
import {
  conditionArgs,
  conditionText,
  followRenamed,
  lostValues,
  readCondition,
} from "../condition.js";
import { placeholderProblem } from "../content.js";
import {
  checkKeys,
  type Entry,
  mapEntries,
  type ParseContext,
  readRoleList,
  readString,
} from "../context.js";
import { THREE_DECIMAL_CURRENCIES } from "../currencies.js";
import type { YamlValue } from "../edit.js";
import { fieldsUsed, renameInFormula } from "../formula.js";
import {
  type ActionIR,
  type Condition,
  type FieldIR,
  type ModelIR,
  PAYMENT_STATUSES,
  type PaymentIR,
  type ScalarType,
  type SpecIR,
  type TimerIR,
  USER_MODEL,
} from "../ir.js";
import { capitalize, humanize, plural } from "../naming.js";
import { type AnyOperation, type Operation, OperationError, refTo } from "../operation.js";
import type { SpecSection } from "../section.js";
import { didYouMean } from "../suggest.js";
import { placeholdersOf } from "../template.js";
import { typedAll } from "./action-operations.js";
import { readValues } from "./actions.js";
import { FIELD_NAME_PATTERN, nameRule } from "./names.js";
import { article } from "./timers.js";

/**
 * Payments (docs/design/payments.md): a record paid for on a payment provider's own page, recorded
 * by the provider's verified word. The section says what is paid, how much, when and what follows;
 * the provider is the context file's, and the flow is the kit's.
 */

/** The built-in models a `payments` section brings (§3.3); a maker's model may not take their names. */
export const PAYMENT_MODEL = "Payment";
export const PAYMENT_REFUND_MODEL = "PaymentRefund";

const field = (
  name: string,
  type: FieldIR["type"],
  required: boolean,
  description: string,
  extra: Partial<FieldIR> = {},
): FieldIR => ({ name, type, required, unique: false, description, ...extra });
const scalar = (name: ScalarType): FieldIR["type"] => ({ kind: "scalar", name });

/**
 * The Payment and its refund lines, written only by the kit (§3.3, §4.4). The paid record is kept
 * as its id, a plain value, so the line stays when a held record is released.
 */
export function paymentModels(): ModelIR[] {
  return [
    {
      name: PAYMENT_MODEL,
      description: "A payment asked of the payment provider for a record, and what became of it.",
      fields: [
        field("entry", scalar("string"), true, "The payments entry's name."),
        field("record", scalar("string"), true, "The paid record's id, a plain value."),
        field("amount", scalar("money"), true, "The amount asked of the provider."),
        field("currency", scalar("string"), true, "The app's currency when it was asked."),
        field("status", { kind: "choice", values: [...PAYMENT_STATUSES] }, true, "Its state.", {
          default: "pending",
        }),
        field(
          "provider",
          scalar("string"),
          true,
          "The provider's name, test or live mode, and its account id where it gives one.",
        ),
        field("reference", scalar("string"), false, "The provider's own id for the payment."),
        field("note", scalar("text"), false, "What went wrong, in the app's words."),
        field("createdAt", scalar("datetime"), true, "When it was asked."),
        field("paidAt", scalar("datetime"), false, "When the provider said it was paid."),
        field("refundedAt", scalar("datetime"), false, "When the whole amount went back."),
        field(
          "refunds",
          { kind: "relation", model: PAYMENT_REFUND_MODEL, many: true },
          false,
          "Its refund lines.",
        ),
      ],
    },
    {
      name: PAYMENT_REFUND_MODEL,
      description:
        "One refund of a Payment, asked in the app or made at the provider (a partial one too).",
      fields: [
        field(
          "payment",
          { kind: "relation", model: PAYMENT_MODEL, many: false },
          true,
          "The Payment.",
        ),
        field("amount", scalar("money"), true, "The amount refunded."),
        field("reference", scalar("string"), false, "The provider's refund id."),
        field(
          "status",
          { kind: "choice", values: ["asked", "done", "refused"] },
          true,
          "Its state.",
          { default: "asked" },
        ),
        field(
          "by",
          { kind: "relation", model: USER_MODEL, many: false },
          false,
          "Who asked for it; empty for the app itself or the provider's dashboard.",
        ),
        field("createdAt", scalar("datetime"), true, "When it was asked or learned of."),
      ],
    },
  ];
}

const isMoney = (f: FieldIR) => f.type.kind === "scalar" && f.type.name === "money";
const namesMe = (c: Condition) => Object.values(c).some((w) => w === "ME()" || w === "not ME()");

/** A condition on the record: the actions' `when` grammar, with no person (it is checked as the app too). */
function readRecordCondition(
  ctx: ParseContext,
  node: ParsedNode | null,
  what: string,
  model: ModelIR,
): Condition | undefined {
  const condition = readCondition(ctx, node, what, model, true, true);
  if (condition && namesMe(condition)) {
    ctx.error(
      node,
      "invalid-payment",
      `${capitalize(what)} names the person signed in (ME()); a payment is recorded as the app, when the provider's word comes, for nobody in particular.`,
    );
    return undefined;
  }
  return condition;
}

/** The placeholders a description may hold: the record's fields as outgoing mail has them, one reference away. */
export function descriptionProblem(
  text: string,
  name: string,
  model: ModelIR,
  models: ModelIR[],
): string | undefined {
  for (const path of new Set(placeholdersOf(text))) {
    const [first] = path.split(".");
    if (first === "link" || first === "by" || first === "pay" || first === "before")
      return `"{${path}}" means nothing on the provider's page; a description names fields of the ${model.name}, like {number}, or {title}.`;
    // placeholderProblem reads only the models (and, for {pay}, refused above, the payments).
    const problem = placeholderProblem(
      path,
      { name, when: { model: model.name, payment: name }, to: "provider" },
      { models } as SpecIR,
    );
    if (problem && !problem.warning)
      return `${problem.message}${problem.hint ? ` ${problem.hint}` : ""}`;
  }
  return undefined;
}

function readPayment(
  ctx: ParseContext,
  name: string,
  keyNode: ParsedNode,
  node: ParsedNode | null,
  models: ModelIR[],
): PaymentIR | undefined {
  const where = `payment "${name}"`;
  const known = checkKeys(ctx, mapEntries(ctx, node, where) ?? [], where, {
    allowed: ["on", "amount", "when", "paid", "refund", "description"],
  });
  const byKey = new Map<string, Entry>(known.map((e) => [e.key, e]));
  for (const key of ["on", "amount", "when"])
    if (!byKey.has(key)) {
      ctx.error(
        keyNode,
        "missing-key",
        `${capitalize(where)} needs "on" (the model paid for), "amount" (a money field of it) and "when" (created, or a condition); it has no "${key}".`,
      );
      return undefined;
    }
  const entry = (key: string) => byKey.get(key) as Entry;
  const on = readString(ctx, entry("on").value, `"on" of ${where}`);
  if (on === undefined) return undefined;
  const model = models.find((m) => m.name === on);
  if (!model) {
    ctx.error(
      entry("on").value,
      "unknown-model",
      `There is no model named "${on}".`,
      didYouMean(
        on,
        models.map((m) => m.name),
      ),
    );
    return undefined;
  }
  ctx.reference("model", on, entry("on").value);
  let failed = false;
  const fail = (at: ParsedNode | null, message: string, hint?: string) => {
    ctx.error(at, "invalid-payment", `${capitalize(where)}: ${message}`, hint);
    failed = true;
  };

  const amount = readString(ctx, entry("amount").value, `"amount" of ${where}`);
  const amountField = model.fields.find((f) => f.name === amount);
  if (amount === undefined) failed = true;
  else if (!amountField)
    fail(
      entry("amount").value,
      `${on} has no field named "${amount}".`,
      didYouMean(
        amount,
        model.fields.filter(isMoney).map((f) => f.name),
      ),
    );
  else if (!isMoney(amountField))
    fail(entry("amount").value, `"amount" is a money field of ${on}; ${on}.${amount} is not.`);

  const whenNode = entry("when").value;
  let when: PaymentIR["when"] | undefined;
  if (isScalar(whenNode)) {
    if (whenNode.value === "created") when = "created";
    else
      fail(
        whenNode,
        `"when" is created (pay to create the record) or a condition on the record, like { status: sent }; "${String(whenNode.value)}" is neither.`,
      );
  } else {
    const before = ctx.diagnostics.length;
    when = readRecordCondition(ctx, whenNode, `"when" of ${where}`, model);
    if (!when) {
      if (ctx.diagnostics.length === before)
        fail(whenNode, `"when" names at least one field and the value it must have.`);
      failed = true;
    }
  }

  const payment: Partial<PaymentIR> = { name, on, ...(amount ? { amount } : {}) };
  const paidEntry = byKey.get("paid");
  if (paidEntry) {
    const paidKeys = checkKeys(
      ctx,
      mapEntries(ctx, paidEntry.value, `"paid" of ${where}`) ?? [],
      `"paid" of ${where}`,
      { allowed: ["set"] },
    );
    const set = paidKeys.find((e) => e.key === "set");
    if (!set) fail(paidEntry.keyNode, `"paid" holds "set": the fields a payment changes.`);
    else {
      const before = ctx.diagnostics.filter((d) => d.severity === "error").length;
      const values = readValues(ctx, set, model, model, models, `"paid.set" of ${where}`);
      if (ctx.diagnostics.filter((d) => d.severity === "error").length > before) failed = true;
      for (const v of values) {
        if ("asked" in v)
          fail(
            set.value,
            `"paid.set" gives ${v.field} no value; nobody is there to be asked when the provider's word comes. Give a value or a formula.`,
          );
        else if ("me" in v)
          fail(
            set.value,
            `"paid.set" sets ${v.field} to ME(); a payment is recorded as the app, for nobody in particular.`,
          );
      }
      if (!values.length && !failed) fail(set.value, `"paid.set" names at least one field.`);
      payment.paid = { set: values };
    }
  }

  const refundEntry = byKey.get("refund");
  if (refundEntry) {
    const refundKeys = checkKeys(
      ctx,
      mapEntries(ctx, refundEntry.value, `"refund" of ${where}`) ?? [],
      `"refund" of ${where}`,
      { allowed: ["by", "when"] },
    );
    const by = refundKeys.find((e) => e.key === "by");
    const refundWhen = refundKeys.find((e) => e.key === "when");
    if (!by) fail(refundEntry.keyNode, `"refund" needs "by": the roles that may refund.`);
    else {
      const roles = readRoleList(ctx, by.value, `"refund.by" of ${where}`, false);
      const condition = refundWhen
        ? readRecordCondition(ctx, refundWhen.value, `"refund.when" of ${where}`, model)
        : undefined;
      payment.refund = { by: roles, ...(condition ? { when: condition } : {}) };
    }
  }

  const descriptionEntry = byKey.get("description");
  if (descriptionEntry) {
    const description = readString(ctx, descriptionEntry.value, `"description" of ${where}`);
    const problem =
      description === undefined ? undefined : descriptionProblem(description, name, model, models);
    if (problem) fail(descriptionEntry.value, problem);
    else if (description) payment.description = description;
  }
  if (failed || !when || !payment.amount) return undefined;
  return { ...payment, when } as PaymentIR;
}

/** A condition's choice values as one word list ("sent or overdue"), when it is one choice field. */
function choiceWords(c: Condition, model: ModelIR | undefined): string | undefined {
  const [only, ...more] = Object.entries(c);
  if (!only || more.length) return undefined;
  const [key, wanted] = only;
  const f = model?.fields.find((x) => x.name === key);
  if (f?.type.kind !== "choice" || typeof wanted === "boolean") return undefined;
  return (Array.isArray(wanted) ? wanted : [wanted])
    .map((v) => humanize(v).toLowerCase())
    .join(" or ");
}

/**
 * A payments entry in words (§3.6): "An order is paid when it is placed, on the payment provider's
 * page; a paid order becomes paid: yes. Admins may refund a declined order." The model's word comes
 * from `label` when the summary has the content file's labels.
 */
export function paymentText(
  p: PaymentIR,
  models: ModelIR[],
  label?: (model: string) => string,
): string {
  const one = (label ?? ((m: string) => humanize(m).toLowerCase()))(p.on);
  const model = models.find((m) => m.name === p.on);
  const when =
    p.when === "created"
      ? `${capitalize(article(one))} is paid when it is placed, on the payment provider's page`
      : `${capitalize(article(one))} can be paid while ${
          choiceWords(p.when, model) ? `it is ${choiceWords(p.when, model)}` : conditionText(p.when)
        }`;
  const becomes = (p.paid?.set ?? []).map((v) => {
    const word = humanize(v.field).toLowerCase();
    const f = model?.fields.find((x) => x.name === v.field);
    if ("formula" in v) return `${word}: ${v.text}`;
    if (!("value" in v)) return word;
    if (f?.type.kind === "choice") return humanize(String(v.value)).toLowerCase();
    if (typeof v.value === "boolean") return `${word}: ${v.value ? "yes" : "no"}`;
    return `${word}: ${v.value}`;
  });
  const paid = becomes.length ? `; a paid ${one} becomes ${becomes.join(", ")}` : "";
  let refund = "";
  if (p.refund) {
    const roles = [...new Set(["admin", ...p.refund.by])].map((r) =>
      plural(humanize(r).toLowerCase()),
    );
    const who = capitalize(
      roles.length > 1 ? `${roles.slice(0, -1).join(", ")} and ${roles.at(-1)}` : `${roles[0]}`,
    );
    const which = !p.refund.when
      ? `a paid ${one}`
      : choiceWords(p.refund.when, model)
        ? article(`${choiceWords(p.refund.when, model)} ${one}`)
        : `${article(one)} where ${conditionText(p.refund.when)}`;
    refund = ` ${who} may refund ${which}.`;
  }
  return `${when}${paid}.${refund}`;
}

type PaymentArgs = {
  name: string;
  on?: string;
  amount?: string;
  when?: string | Record<string, string | boolean | string[]>;
  paidSet?: Record<string, string | number | boolean | null>;
  refundBy?: string[];
  refundWhen?: Record<string, string | boolean | string[]>;
  description?: string;
};

/** `created`, a condition, or a condition written as text ("status=sent|overdue"). */
function whenValue(when: NonNullable<PaymentArgs["when"]>): YamlValue {
  if (when === "created") return "created";
  const pairs =
    typeof when === "string"
      ? Object.fromEntries(
          when
            .split(",")
            .filter((p) => p.trim())
            .map((p) => {
              const eq = p.indexOf("=");
              if (eq < 1)
                throw new OperationError(
                  `"when" is created, or field=value pairs like status=sent|overdue; "${when}" is neither.`,
                );
              return [p.slice(0, eq).trim(), p.slice(eq + 1).trim()];
            }),
        )
      : when;
  if (!Object.keys(pairs).length)
    throw new OperationError(`"when" is created, or field=value pairs like status=sent.`);
  return conditionArgs(pairs) as YamlValue;
}

/** The word "none", or an empty mapping, for a part that is taken away. */
const isNone = (v: unknown) =>
  v === "none" ||
  (Array.isArray(v) && v.length === 1 && v[0] === "none") ||
  (typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    (!Object.keys(v).length ||
      (Object.keys(v).length === 1 && "none" in v && !(v as Record<string, unknown>).none)));

const PAYMENT_ARGS = {
  on: refTo(
    { ref: "model", label: "Paid for" },
    { description: "The model whose record is paid for." },
  ),
  amount: refTo(
    { ref: "field", model: "on", label: "Amount" },
    { description: "A money field of the record, stored or computed." },
  ),
  when: {
    type: ["string", "object"],
    description:
      'created (pay to create the record), or the records Pay is offered on, e.g. { "status": "sent|overdue" }.',
  },
  paidSet: {
    type: "object",
    additionalProperties: { type: ["string", "number", "boolean", "null"] },
    description:
      'What a payment sets on the record, e.g. { "paid": true }; empty or "none" removes it.',
  },
  refundBy: refTo(
    { ref: "role", label: "Who may refund" },
    { description: 'The roles that may refund (admins always may); "none" takes refunds away.' },
    true,
  ),
  refundWhen: {
    type: "object",
    description:
      'Only records that fit may be refunded, e.g. { "status": "declined" }; empty removes it.',
  },
  description: {
    type: "string",
    description:
      'What the payer sees on the provider\'s page, with {field} placeholders, e.g. "Order {number}"; "none" for the record\'s title.',
  },
} as const;

const addPayment: Operation<PaymentArgs> = {
  name: "addPayment",
  summary:
    "Take payments for a model's records on the payment provider's page: the amount field, when (created, or a condition), what a payment sets, who may refund.",
  schema: {
    type: "object",
    required: ["name", "on", "amount", "when"],
    additionalProperties: false,
    properties: {
      name: { type: "string", description: "The entry's name, e.g. orderPayment." },
      ...PAYMENT_ARGS,
    },
  },
  positional: ["name"],
  describe: ({ name, on }) => `Take payments for ${on} (${name})`,
  destructive: () => false,
  apply({ spec }, { name, on, amount, when, paidSet, refundBy, refundWhen, description }, ir) {
    if (!FIELD_NAME_PATTERN.test(name)) throw new OperationError(nameRule("payment", name));
    if (ir.payments.some((p) => p.name === name))
      throw new OperationError(`There is already a payment named "${name}".`);
    const model = ir.models.find((m) => m.name === on);
    if (!model) throw new OperationError(`There is no model named "${on}".`);
    if (refundWhen && !refundBy?.length)
      throw new OperationError(`Say who may refund (--refund-by) to say when they may.`);
    const value: Record<string, YamlValue> = {
      on: model.name,
      amount: amount as string,
      when: whenValue(when as NonNullable<PaymentArgs["when"]>),
      ...(paidSet && !isNone(paidSet) ? { paid: { set: typedAll(model, paidSet) } } : {}),
      ...(refundBy?.length && !isNone(refundBy)
        ? {
            refund: {
              by: refundBy,
              ...(refundWhen && !isNone(refundWhen)
                ? { when: conditionArgs(refundWhen) as YamlValue }
                : {}),
            },
          }
        : {}),
      ...(description && description !== "none" ? { description } : {}),
    };
    if (spec.has(["payments"])) spec.add(["payments"], name, value);
    else spec.add([], "payments", { [name]: value });
    return [];
  },
};

const setPayment: Operation<PaymentArgs> = {
  name: "setPayment",
  summary:
    'Change a payments entry: each part given replaces the old one; "none" removes paid.set, refund (--refund-by none) or the description.',
  schema: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: { name: refTo({ ref: "payment", label: "Payment" }), ...PAYMENT_ARGS },
  },
  positional: ["name"],
  describe: ({ name }) => `Change the payment ${name}`,
  destructive: () => false,
  apply({ spec }, { name, ...args }, ir) {
    const payment = ir.payments.find((p) => p.name === name);
    if (!payment) throw new OperationError(`There is no payment named "${name}".`);
    if (!Object.values(args).some((v) => v !== undefined))
      throw new OperationError(
        "Say what to change: on, amount, when, paidSet, refundBy, refundWhen or description.",
      );
    const at = ["payments", name];
    const model = ir.models.find((m) => m.name === (args.on ?? payment.on));
    if (!model) throw new OperationError(`There is no model named "${args.on}".`);
    const put = (path: string[], value: YamlValue | undefined) => {
      const full = [...at, ...path];
      if (value === undefined) {
        if (spec.has(full)) spec.removeAndPrune(full, at.length);
      } else if (spec.has(full)) spec.set(full, value);
      else if (path.length === 1 || spec.has([...at, ...path.slice(0, -1)]))
        spec.add([...at, ...path.slice(0, -1)], path.at(-1) as string, value);
      else spec.add(at, path[0] as string, { [path[1] as string]: value });
    };
    if (args.on) put(["on"], model.name);
    if (args.amount) put(["amount"], args.amount);
    if (args.when !== undefined) put(["when"], whenValue(args.when));
    if (args.paidSet !== undefined)
      put(["paid", "set"], isNone(args.paidSet) ? undefined : typedAll(model, args.paidSet));
    if (args.refundBy !== undefined) {
      if (isNone(args.refundBy)) {
        if (args.refundWhen && !isNone(args.refundWhen))
          throw new OperationError("A refund condition needs roles that may refund.");
        put(["refund"], undefined);
      } else put(["refund", "by"], args.refundBy);
    }
    if (args.refundWhen !== undefined) {
      if (!payment.refund && !args.refundBy?.length)
        throw new OperationError(`Say who may refund (--refund-by) to say when they may.`);
      put(
        ["refund", "when"],
        isNone(args.refundWhen) ? undefined : (conditionArgs(args.refundWhen) as YamlValue),
      );
    }
    if (args.description !== undefined)
      put(["description"], args.description === "none" ? undefined : args.description);
    return [];
  },
};

const removePayment: Operation<{ name: string }> = {
  name: "removePayment",
  summary:
    "Stop taking a payments entry's payments. The Payment lines already made stay until the owner removes their table.",
  schema: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: { name: refTo({ ref: "payment", label: "Payment" }) },
  },
  positional: ["name"],
  describe: ({ name }) => `Remove the payment ${name}`,
  destructive: () => true,
  apply({ spec }, { name }, ir) {
    if (!ir.payments.some((p) => p.name === name))
      throw new OperationError(`There is no payment named "${name}".`);
    const listening = ir.outgoing.filter((o) => "payment" in o.when && o.when.payment === name);
    if (listening.length)
      throw new OperationError(
        `${listening.map((o) => `"${o.name}"`).join(" and ")} under outgoing ${listening.length > 1 ? "listen" : "listens"} to the payment "${name}"; remove ${listening.length > 1 ? "them" : "it"} first.`,
      );
    spec.removeAndPrune(["payments", name], 0);
    return [
      {
        note: "the Payment lines already made stay, until the owner removes their table with a migration",
      },
    ];
  },
};

export const paymentOperations: AnyOperation[] = [addPayment, setPayment, removePayment];

export const paymentsSection: SpecSection<"payments"> = {
  key: "payments",
  required: false,
  operations: paymentOperations,
  schema: {
    type: "object",
    description:
      "What a record is paid for on the payment provider's own page: how much, when, what a payment changes, and who may refund (docs/design/payments.md). The provider is named in smithable.context.yml.",
    propertyNames: { pattern: FIELD_NAME_PATTERN.source },
    additionalProperties: {
      type: "object",
      required: ["on", "amount", "when"],
      additionalProperties: false,
      properties: {
        on: { type: "string", description: "The model whose record is paid for; one entry each." },
        amount: { type: "string", description: "A money field of the record, stored or computed." },
        when: {
          oneOf: [
            {
              const: "created",
              description: "Pay to create: the record is held until it is paid.",
            },
            {
              type: "object",
              description:
                "Pay is offered on records that fit, as an action's when, e.g. { status: [sent, overdue] }.",
            },
          ],
        },
        paid: {
          type: "object",
          description: "What a successful payment does to the record.",
          additionalProperties: false,
          properties: {
            set: {
              type: "object",
              description:
                "Stored fields of the record and their values when the payment succeeds: literals or formulas, as an action's set.",
            },
          },
        },
        refund: {
          type: "object",
          description:
            "Who may refund in the app, and on which records; without it, refunds are made at the provider.",
          required: ["by"],
          additionalProperties: false,
          properties: {
            by: {
              type: "array",
              items: { type: "string" },
              description: "The roles that may refund in the app (admins always may).",
            },
            when: {
              type: "object",
              description: "Only records that fit, e.g. { status: declined }.",
            },
          },
        },
        description: {
          type: "string",
          description:
            "What the payer sees on the provider's page, with {field} placeholders; the record's title when left out.",
        },
      },
    },
  },
  parse(ctx, node, parsed) {
    if (node === undefined) return [];
    const models = parsed.models ?? [];
    const payments: PaymentIR[] = [];
    const entries = mapEntries(ctx, node, `"payments"`) ?? [];
    if (!entries.length) return [];
    const currency = parsed.app?.currency;
    if (!currency)
      ctx.error(
        node,
        "payments-currency",
        `The app takes payments, so it needs a currency: "currency" under "app", an ISO 4217 code like EUR.`,
      );
    else if (THREE_DECIMAL_CURRENCIES.includes(currency))
      ctx.error(
        node,
        "payments-currency",
        `${currency} counts in thousandths, which an amount kept in hundredths cannot hold, so the app cannot take payments in it.`,
      );
    for (const reserved of [PAYMENT_MODEL, PAYMENT_REFUND_MODEL])
      if (models.some((m) => m.name === reserved))
        ctx.error(
          node,
          "reserved-model",
          `With "payments", the app keeps its own ${reserved} records, so a model of the spec cannot be named ${reserved}.`,
          `Rename yours, e.g. "smithable op renameModel ${reserved} Manual${reserved}".`,
        );
    const taken = new Map<string, string>([
      ...(parsed.actions ?? []).map((a: ActionIR): [string, string] => [a.name, "an action"]),
      ...(parsed.timers ?? []).map((t: TimerIR): [string, string] => [t.name, "a timer"]),
    ]);
    for (const { key, keyNode, value } of entries) {
      if (!FIELD_NAME_PATTERN.test(key)) {
        ctx.error(keyNode, "invalid-name", nameRule("payment", key));
        continue;
      }
      // An outgoing entry's `when` names a payment as it names an action or a timer.
      const other = taken.get(key);
      if (other) {
        ctx.error(
          keyNode,
          "duplicate-name",
          `"${key}" is already ${other}'s name, and outgoing's "when" names both; rename the payment.`,
        );
        continue;
      }
      const payment = readPayment(ctx, key, keyNode, value, models);
      if (!payment) continue;
      const first = payments.find((p) => p.on === payment.on);
      if (first) {
        ctx.error(
          keyNode,
          "invalid-payment",
          `${payment.on} is paid for by "${first.name}" already; a model has one payments entry (deposits and balances come later).`,
        );
        continue;
      }
      payments.push(payment);
      ctx.mark(`payment:${key}`, keyNode);
    }
    return payments;
  },
  follow(spec, effect, ir) {
    for (const p of ir.payments) {
      const at = ["payments", p.name];
      if (effect.kind === "change-field" && p.on === effect.model) {
        const renamed = effect.renamed ?? {};
        const conditions: [string[], Condition | undefined][] = [
          [[...at, "when"], p.when === "created" ? undefined : p.when],
          [[...at, "refund", "when"], p.refund?.when],
        ];
        for (const [path, c] of conditions) {
          const wanted = c?.[effect.field];
          if (wanted === undefined) continue;
          const now = followRenamed(spec, [...path, effect.field], wanted, renamed);
          if (lostValues(now, effect.choices).length)
            return {
              refusal: `The payment "${p.name}" wants a value ${effect.model}.${effect.field} no longer has; change it first.`,
            };
        }
        for (const v of p.paid?.set ?? []) {
          if (v.field !== effect.field || !("value" in v) || typeof v.value !== "string") continue;
          const now = renamed[v.value] || v.value;
          if (now !== v.value) spec.set([...at, "paid", "set", v.field], now);
          if (!effect.choices.includes(now))
            return {
              refusal: `The payment "${p.name}" sets ${effect.model}.${effect.field} to "${v.value}", a value it no longer has; change it first.`,
            };
        }
        continue;
      }
      if (effect.kind !== "rename-field" && effect.kind !== "remove-field") continue;
      const from = effect.kind === "rename-field" ? effect.from : effect.field;
      const own = p.on === effect.model;
      const keyed: string[][] = own
        ? [
            ...(p.when !== "created" && from in p.when ? [[...at, "when"]] : []),
            ...(p.refund?.when && from in p.refund.when ? [[...at, "refund", "when"]] : []),
            ...(p.paid?.set.some((v) => v.field === from) ? [[...at, "paid", "set"]] : []),
          ]
        : [];
      // The description's placeholders: the record's own field, or a field one reference away.
      const model = ir.models.find((m) => m.name === p.on);
      const target = (ref: string) => {
        const f = model?.fields.find((x) => x.name === ref);
        return f?.type.kind === "relation" ? f.type.model : undefined;
      };
      const rewrite = (path: string) => {
        const [first = "", second] = path.split(".");
        // {title} is the record's title, whatever field is named so (as in outgoing texts).
        if (first === "title" && second === undefined) return undefined;
        if (own && first === from)
          return [effect.kind === "rename-field" ? effect.to : first, second];
        if (second === from && target(first) === effect.model)
          return [first, effect.kind === "rename-field" ? effect.to : second];
        return undefined;
      };
      const named = p.description && placeholdersOf(p.description).some((x) => rewrite(x));
      const amount = own && p.amount === from;
      // A paid.set formula names the record's fields, or a list's in an aggregate (SUM(lines.amount)).
      const listOf = (list: string) => {
        const type = model?.fields.find((f) => f.name === list)?.type;
        return type?.kind === "relation" && type.many && type.model === effect.model;
      };
      const formulas = (p.paid?.set ?? []).flatMap((v) => ("formula" in v ? [v] : []));
      if (effect.kind === "remove-field") {
        const inFormula = own && formulas.some((v) => fieldsUsed(v.formula).includes(from));
        if (amount || keyed.length || named || inFormula)
          return {
            refusal: `The payment "${p.name}" uses ${effect.model}.${from}; change or remove the payment first.`,
          };
        continue;
      }
      if (amount) spec.set([...at, "amount"], effect.to);
      for (const v of formulas) {
        const next = renameInFormula(v.text, (name, list) =>
          name === from && (list === undefined ? own : listOf(list)) ? effect.to : undefined,
        );
        if (next !== v.text) spec.set([...at, "paid", "set", v.field], next);
      }
      for (const path of keyed) spec.renameKey([...path, from], effect.to);
      if (named && p.description)
        spec.set(
          [...at, "description"],
          p.description.replace(/\{([^{}]+)\}/g, (whole, inner: string) => {
            const parts = rewrite(inner.trim());
            return parts ? `{${parts.filter(Boolean).join(".")}}` : whole;
          }),
        );
    }
    return undefined;
  },
};
