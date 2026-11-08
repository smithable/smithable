import { isScalar, isSeq, type ParsedNode } from "yaml";
import { listReaderProblem } from "../access.js";
import { type AuthIR, validateAuth } from "../auth.js";
import {
  conditionArgs,
  conditionText,
  followRenamed,
  lostValues,
  readCondition,
} from "../condition.js";
import {
  checkKeys,
  type Entry,
  mapEntries,
  type ParseContext,
  readBoolean,
  readNameList,
  readNumber,
  readString,
} from "../context.js";
import type { YamlEditor, YamlValue } from "../edit.js";
import type {
  ActionIR,
  Channel,
  Condition,
  ModelIR,
  OutgoingIR,
  OutgoingListIR,
  QueryIR,
  RecipientIR,
  SpecIR,
  StandardActionIR,
  TimerIR,
} from "../ir.js";
import { channelsOf, DUE_WITHIN, type FieldIR, isUpload } from "../ir.js";
import { capitalize, humanize, plural } from "../naming.js";
import {
  type AnyOperation,
  type Effect,
  type Operation,
  OperationError,
  type Refusal,
  refTo,
} from "../operation.js";
import type { SpecSection } from "../section.js";
import { sensitiveKind } from "../sensitive.js";
import { didYouMean } from "../suggest.js";
import { FIELD_NAME_PATTERN, nameRule } from "./names.js";
import { clockText, resolveDatePath } from "./timers.js";

/**
 * Outgoing: something happens to a record and the app tells someone (docs/design/integrations.md
 * §4). A mail, a browser push or a text to the record's owner, a role or an address on the record
 * (docs/design/notifications.md), or a signed call to a named target. The spec says when and
 * whom; the adapter writes the call in the change's transaction and sends it afterwards.
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
): { when: When } | { clock: string } | { problem: string; hint?: string } {
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
    // A timer's event comes per record; one on a clock with no records makes the entry a list
    // mail (reports.md §2.2), whose model is its list's.
    if (!timer.on) return { clock: timer.name };
    return { when: { model: timer.on, timer: timer.name } };
  }
  return {
    problem: `"when" is "<Model> created", "<Model> changed", "<Model> deleted", the name of an action or the name of a timer; "${text}" is none of them.`,
    hint: didYouMean(text.trim(), [...actions.map((a) => a.name), ...timers.map((t) => t.name)]),
  };
}

/**
 * The recipient: owner, a role, an address on the record (an email or phone field, or a field that
 * refers to User; one reference away at most), or the records of a list field and then the owner
 * or an address of each (`bookings.owner`). Whether the entry's channels reach it is
 * `reachProblem`'s.
 */
function readRecipient(
  text: string,
  model: ModelIR,
  models: ModelIR[],
): { recipient: RecipientIR; role?: string } | { problem: string } {
  if (text === "owner") return { recipient: { kind: "owner" } };
  const path = text.split(".");
  const addressOf = (of: ModelIR, name: string): "email" | "phone" | "user" | undefined => {
    const f = of.fields.find((x) => x.name === name);
    if (!f) return undefined;
    if (f.type.kind === "scalar" && (f.type.name === "email" || f.type.name === "phone"))
      return f.type.name;
    if (f.type.kind === "relation" && !f.type.many && f.type.model === "User") return "user";
    return undefined;
  };
  if (path.length === 1) {
    const via = addressOf(model, text);
    if (via) return { recipient: { kind: "field", path, via } };
    if (model.fields.some((f) => f.name === text))
      return {
        problem: `${model.name}.${text} is not an email field, a phone field or a field that refers to User, so it holds no address.`,
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
          problem: `${type.model}.${second} is not owner, an email field, a phone field or a field that refers to User, so "${text}" tells nobody.`,
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
        problem: `${type.model}.${second} is not an email field, a phone field or a field that refers to User, so "${text}" holds no address.`,
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

/** The built-in channels (notifications.md §4), in the order an entry's `channels` keeps them. */
const CHANNELS: readonly Channel[] = ["mail", "push", "sms"];
const isChannel = (s: string): s is Channel => (CHANNELS as readonly string[]).includes(s);

/**
 * `to`: a channel, a list of channels, or a target's name, which stands alone; says what is wrong
 * otherwise.
 */
function readTo(
  to: string | string[],
): { channels: Channel[] } | { target: string } | { problem: string } {
  if (!Array.isArray(to))
    return isChannel(to)
      ? { channels: [to] }
      : FIELD_NAME_PATTERN.test(to)
        ? { target: to }
        : { problem: nameRule("outgoing", to) };
  if (!to.length) return { problem: `"to" lists no channel: mail, push or sms.` };
  const other = to.find((c) => !isChannel(c));
  if (other !== undefined)
    return {
      problem: `"to" lists channels (mail, push, sms), and "${other}" is none; a target is named alone (to: ${other}).`,
    };
  const twice = to.find((c, i) => to.indexOf(c) !== i);
  if (twice) return { problem: `"to" lists ${twice} twice.` };
  return { channels: CHANNELS.filter((c) => to.includes(c)) };
}

/** An operation's `--to`: one name, or channels separated by commas (mail,push). */
const toArg = (to: string): string | string[] =>
  to.includes(",") ? to.split(",").map((c) => c.trim()) : to.trim();

/** How the spec writes an entry's `to`: a target, one channel, or the list of them. */
const toValue = (t: { channels: Channel[] } | { target: string }): YamlValue =>
  "target" in t ? t.target : t.channels.length === 1 ? (t.channels[0] as Channel) : [...t.channels];

/** "a and b", "a, b and c". */
const andList = (words: string[]) =>
  words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : (words[0] ?? "");

/**
 * What a recipient is reached by: a person (the owner, a role's users, a field that refers to
 * User) by every channel; an email field by mail; a phone field by sms (notifications.md §2).
 */
const REACHES: Record<Channel, string> = {
  mail: "owner, a role, an email field or a field that refers to User",
  push: "a person with an account: owner, a role or a field that refers to User",
  sms: "owner, a role, a phone field or a field that refers to User",
};
function reachProblem(r: RecipientIR, channels: Channel[]): string | undefined {
  const via =
    r.kind === "field" ? r.via : r.kind === "list" && r.each.kind === "field" ? r.each.via : "user";
  if (via === "user") return undefined;
  const c = channels.find((x) => (via === "email" ? x !== "mail" : x !== "sms"));
  return (
    c &&
    `${c} cannot reach ${via === "email" ? "an email field" : "a phone field"}; it reaches ${REACHES[c]}.`
  );
}

/** A lone push or sms without a recipient may be a target of the old name (notifications.md §9). */
const renameHint = (c: Channel) =>
  `If ${c} is the name of a target, rename it here and in its settings OUTGOING_${c.toUpperCase()}_URL and OUTGOING_${c.toUpperCase()}_SECRET: ${c} is a built-in channel now.`;

/** An operation's refusal of channels without a recipient. */
const missingRecipient = (channels: Channel[]) => {
  const alone = channels.length === 1 && channels[0] !== "mail" ? channels[0] : undefined;
  return `${capital(andList([...channels]))} ${channels.length > 1 ? "need" : "needs"} a recipient: --recipient owner, a role, or a field with an address (email, customer.email).${alone ? ` ${renameHint(alone)}` : ""}`;
};

/** A list mail goes by mail alone (reports.md §2.2, notifications.md §5). */
const listMailOnly = (t: { channels: Channel[] } | { target: string }) =>
  "target" in t
    ? `goes by mail; a call to a target ("${t.target}") comes later.`
    : `goes by mail alone: push and sms tell a person about their own record or work, not a list.`;

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

/**
 * Why a field never goes in a mail or a call (docs/design/outgoing-templates.md §4): it holds
 * files, it looks sensitive, or it lists other records. Undefined when it may go.
 */
export function notSendable(f: FieldIR): string | undefined {
  if (isUpload(f)) return "holds files or pictures";
  if (sensitiveKind(f)) return "looks like a card number, a password or an identity number";
  if (f.type.kind === "relation" && f.type.many) return "lists other records";
  return undefined;
}

/**
 * `show` (or a list mail's `columns`): the fields the mail lists and a call carries, each one
 * the record page shows.
 */
function readShow(
  names: string[],
  model: ModelIR,
  key = "show",
): { show: string[] } | { problem: string } {
  if (!names.length)
    return {
      problem: `"${key}" names at least one field of ${model.name}${key === "show" ? ", or is none" : ""}.`,
    };
  for (const name of names) {
    const f = model.fields.find((x) => x.name === name);
    if (!f) {
      const hint = didYouMean(
        name,
        model.fields.map((x) => x.name),
      );
      return { problem: `${model.name} has no field named "${name}".${hint ? ` ${hint}` : ""}` };
    }
    const why = f.formula
      ? "is worked out when the record is read, which a mail or a call does not do"
      : notSendable(f);
    if (why) return { problem: `${model.name}.${name} ${why}, so it cannot be shown.` };
  }
  return { show: [...new Set(names)] };
}

/**
 * `show` and `previous` as the spec or an operation gives them (outgoing-templates.md §2): the
 * fields in order or "none", and whether a change says what the fields were.
 */
function readBody(
  body: { show?: string[] | "none"; previous?: boolean },
  when: When,
  model: ModelIR,
): { show?: string[] | "none"; previous?: boolean } | { problem: string } {
  const out: { show?: string[] | "none"; previous?: boolean } = {};
  if (body.show !== undefined) {
    const none =
      body.show === "none" ||
      (Array.isArray(body.show) && body.show.length === 1 && body.show[0] === "none");
    if (none) out.show = "none";
    else {
      const r = readShow(body.show as string[], model);
      if ("problem" in r) return r;
      out.show = r.show;
    }
  }
  if (body.previous) {
    if (!("event" in when) || when.event !== "changed")
      return {
        problem: `"previous" says what the changed fields were, so it goes with "${model.name} changed" only.`,
      };
    out.previous = true;
  }
  return out;
}

/** A list mail's `list` as the spec or an operation gives it, before it is checked. */
interface ListInput {
  model?: string;
  query?: string;
  where?: Condition;
  when?: string;
  within?: string;
  limit?: number;
  columns?: string[];
}

const WITHIN = /^(\d+) (day|days|week|weeks)$/;
const DATE_PATH = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)?$/;

/**
 * `list` of a list mail (reports.md §2.2): the dashboard list tile's keys (`model` or `query`,
 * `where`, `when` with `within`, `limit`) and `columns`; or what is wrong, and under which key.
 */
function readList(
  input: ListInput,
  models: ModelIR[],
  queries: QueryIR[],
): { list: OutgoingListIR } | { problem: string; key: string; hint?: string } {
  const { model: modelName, query: queryName } = input;
  if (modelName !== undefined && queryName !== undefined)
    return { key: "query", problem: `"list" takes "model" or "query", not both.` };
  if (modelName === undefined && queryName === undefined)
    return {
      key: "list",
      problem: `"list" needs "model" (the records the mail shows) or "query" (a query's records).`,
    };
  if (queryName !== undefined && input.when !== undefined)
    return {
      key: "when",
      problem: `"when" goes with "model": a query chooses its own records, its days too.`,
    };
  const query = queryName === undefined ? undefined : queries.find((q) => q.name === queryName);
  if (queryName !== undefined && !query)
    return {
      key: "query",
      problem: `There is no query named "${queryName}".`,
      hint: didYouMean(
        queryName,
        queries.map((q) => q.name),
      ),
    };
  const wanted = query ? query.returns : (modelName as string);
  const model = models.find((m) => m.name === wanted);
  if (!model)
    return {
      key: query ? "query" : "model",
      problem: `There is no model named "${wanted}".`,
      hint: didYouMean(
        wanted,
        models.map((m) => m.name),
      ),
    };
  const list: OutgoingListIR = { model: model.name, columns: [] };
  if (query) {
    list.query = query.name;
    for (const key of ["where", "when", "within"] as const)
      if (input[key] !== undefined)
        return {
          key,
          problem: `"${key}" does not apply to a query: its code chooses the records.`,
        };
  }
  if (input.where && Object.keys(input.where).length) list.where = input.where;
  if (input.when !== undefined) {
    if (!DATE_PATH.test(input.when))
      return {
        key: "when",
        problem: `"when" is a date field of ${model.name}, or one reference away like session.startsAt; "${input.when}" is neither.`,
      };
    const path = input.when.split(".");
    const resolved = resolveDatePath(path, model, models, "a list mail");
    if (!resolved.ok) return { key: "when", problem: resolved.problem, hint: resolved.hint };
    list.when = { path };
  }
  if (input.within !== undefined) {
    if (list.when === undefined)
      return {
        key: "within",
        problem: `"within" goes with "when": how far the list reaches from the timer's time.`,
      };
    const said = WITHIN.exec(input.within);
    if (input.within === "today" || input.within === "tomorrow") list.within = input.within;
    else if (!said || Number(said[1]) < 1)
      return {
        key: "within",
        problem: `"within" is today, tomorrow, or a number of days or weeks, as in 7 days or 2 weeks.`,
      };
    else
      list.within = {
        amount: Number(said[1]),
        unit: said[2]?.startsWith("week") ? "week" : "day",
      };
  }
  if (input.limit !== undefined) {
    if (!Number.isInteger(input.limit) || input.limit < 1)
      return { key: "limit", problem: `"limit" must be a whole number above 0.` };
    list.limit = input.limit;
  }
  if (!input.columns)
    return {
      key: "list",
      problem: `"list" needs "columns": the fields the mail's table shows, in order, like [session, attendee].`,
    };
  const columns = readShow(input.columns, model, "columns");
  if ("problem" in columns) return { key: "columns", problem: columns.problem };
  list.columns = columns.show;
  return { list };
}

/** A list mail's `list`, as the spec writes it. */
function listValue(list: OutgoingListIR): Record<string, YamlValue> {
  return {
    ...(list.query ? { query: list.query } : { model: list.model }),
    ...(list.where ? { where: list.where } : {}),
    ...(list.when ? { when: list.when.path.join(".") } : {}),
    ...(list.within ? { within: withinText(list.within) } : {}),
    ...(list.limit ? { limit: list.limit } : {}),
    columns: list.columns,
  };
}

const withinText = (w: NonNullable<OutgoingListIR["within"]>) =>
  typeof w === "string" ? w : `${w.amount} ${w.unit}${w.amount === 1 ? "" : "s"}`;

/**
 * A list mail's recipient: a role (admin), since there is no record whose owner or address could
 * be meant. `roles` are the auth file's when known: a role named like a field is still a role.
 * Whether the role reads every record is the auth file's check (listReaderProblem).
 */
function readListRecipient(
  text: string,
  model: ModelIR,
  roles?: ReadonlySet<string> | string[],
): { role: string } | { problem: string } {
  const known = roles ? [...roles].includes(text) : undefined;
  const shaped = /^[a-z][A-Za-z0-9]*$/.test(text) && text !== "owner";
  if (known || (known === undefined && shaped && !model.fields.some((f) => f.name === text)))
    return { role: text };
  const what =
    text === "owner"
      ? "owner"
      : shaped && model.fields.some((f) => f.name === text)
        ? `"${text}", a field of ${model.name}`
        : `"${text}"`;
  return {
    problem: `a list mail has no record: name a role that reads every ${model.name}; ${what} is not a role.`,
  };
}

const EMPTY = ["skip", "send"] as const;
const emptyProblem = (text: string) =>
  `"empty" is skip (nothing to show, no mail) or send (a mail that says so); "${text}" is neither.`;

/** Why `list` and `empty` are refused on an entry whose when is not a clock timer. */
const notAListMail = (when: string) =>
  `"list" and "empty" are for a mail on a clock timer (one with "every" or "cron" and no "on"); "${when}" tells about one record at a time.`;

const EVENT_WORDS = { created: "added", changed: "changed", deleted: "deleted" } as const;

/**
 * "When a booking is added and status is confirmed: mails its owner." The model's word comes from
 * `label` when the summary has the content file's labels.
 */
export function outgoingText(
  o: OutgoingIR,
  label?: (model: string) => string,
  timers: TimerIR[] = [],
): string {
  const to = toText(o, label);
  if ("custom" in o.when) return `When “${humanize(o.when.custom)}” runs: ${to}.`;
  const name = (label ?? ((m: string) => humanize(m).toLowerCase()))(o.when.model);
  if (o.list && "timer" in o.when) return listText(o, o.list, o.when.timer, name, timers);
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
  return `${what}: ${to}${bodyText(o)}.`;
}

/**
 * "Every day at 06:30: the day's bookings (session, attendee, status) to the administrators by
 * mail; nothing to send is skipped."
 */
function listText(
  o: OutgoingIR,
  list: OutgoingListIR,
  timer: string,
  one: string,
  timers: TimerIR[],
): string {
  const schedule = timers.find((t) => t.name === timer)?.schedule;
  const clock =
    schedule && schedule.kind !== "record"
      ? capitalize(clockText(schedule))
      : `When the timer “${humanize(timer)}” comes`;
  const many = plural(one);
  const within = list.within ?? DUE_WITHIN;
  const what = list.query
    ? `the ${many} of “${humanize(list.query)}”`
    : !list.when
      ? `the newest ${many}`
      : within === "today"
        ? `the day's ${many}`
        : within === "tomorrow"
          ? `tomorrow's ${many}`
          : `the ${many} whose ${list.when.path.map((p) => humanize(p).toLowerCase()).join("'s ")} comes within ${withinText(within)}`;
  const only = list.where ? ` where ${conditionText(list.where)}` : "";
  const first = list.limit ? `, the first ${list.limit}` : "";
  const columns = list.columns.map((c) => humanize(c).toLowerCase()).join(", ");
  const role = o.recipient?.kind === "role" ? o.recipient.role : "";
  const to = role === "admin" ? "the administrators" : `every ${role}`;
  const empty =
    o.empty === "send" ? "with nothing to send, a mail says so" : "nothing to send is skipped";
  return `${clock}: ${what}${only}${first} (${columns}) to ${to} by mail; ${empty}.`;
}

/** What the mail or call carries beyond its text, in words: " with its number and date". */
function bodyText(o: OutgoingIR): string {
  const shown =
    o.show === "none"
      ? " with the text alone"
      : o.show?.length
        ? ` with its ${o.show.map((f) => humanize(f).toLowerCase()).join(", ")}`
        : "";
  return `${shown}${o.previous ? " and what the changed fields were" : ""}`;
}

const VERBS: Record<Channel, string> = { mail: "mails", push: "pushes to", sms: "texts" };

/**
 * Whom an entry tells and how, in words: "mails its owner", "mails and pushes to every staff",
 * "texts phone", "tells statusfeed".
 */
function toText(o: OutgoingIR, label?: (model: string) => string): string {
  const channels = channelsOf(o);
  if (!channels) return `tells ${humanize(o.to).toLowerCase()}`;
  const verb = andList(channels.map((c) => VERBS[c]));
  const r = o.recipient;
  return !r
    ? verb
    : r.kind === "owner"
      ? `${verb} its owner`
      : r.kind === "role"
        ? `${verb} every ${r.role}`
        : r.kind === "list"
          ? `${verb} every ${(label ?? ((m: string) => humanize(m).toLowerCase()))(r.model)}'s ${r.each.kind === "owner" ? "owner" : humanize(r.each.field).toLowerCase()}`
          : `${verb} ${r.path.map((p) => humanize(p).toLowerCase()).join("'s ")}`;
}

/** An operation's `--to` and `--recipient` in words: "mail and push staff", "tell kitchen". */
function howText(to: string, recipient: string | undefined): string {
  const t = readTo(toArg(to));
  return "channels" in t ? `${andList([...t.channels])} ${recipient ?? "someone"}` : `tell ${to}`;
}

const toArgSchema = {
  type: "string",
  description:
    '"mail" (the default), push or sms, or several separated by commas (mail,push); or the name of a target whose address is a setting.',
};
const recipientArgSchema = {
  type: "string",
  description:
    'For mail, push and sms: "owner", a role (admin), a field that refers to User (assignee), an email field of the record (email, for mail) or a phone field (phone, for sms), one reference away (customer.email), or a list field and then the owner or an address of each of its records (bookings.owner). For a list mail: a role that reads every record of the model.',
};

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

const showSchema = {
  anyOf: [
    {
      type: "array",
      items: { type: "string", pattern: FIELD_NAME_PATTERN.source },
      minItems: 1,
    },
    { const: "none" },
  ],
  description:
    "The fields the mail lists under its text and a call's record carries, in this order, e.g. [number, wanted]; none for the text alone. Without it, the fields as the record page shows them.",
};
const showArgSchema = {
  type: "array",
  items: { type: "string" },
  minItems: 1,
  description: `${showSchema.description} "none" for the text alone.`,
};
const previousSchema = {
  type: "boolean",
  description:
    'For "<Model> changed": the mail and the call also say what the changed fields were before the change.',
};

/** The arguments a list mail's `list` takes, on addOutgoing and setOutgoingList. */
const LIST_ARGS = {
  list: refTo(
    { ref: "model", label: "Records" },
    {
      description:
        "A list mail (when names a clock timer): the model whose records the mail's table shows, e.g. Booking; or --query.",
    },
  ),
  query: {
    type: "string",
    description: "A list mail: a query whose records the table shows, instead of a model's.",
  },
  date: {
    type: "string",
    description:
      'A list mail: the date field that puts a record in the list, on the model (dueOn) or one reference away (session.startsAt); the list\'s "when".',
  },
  within: {
    type: "string",
    description:
      'A list mail, with --date: how far the list reaches from the timer\'s time: today, tomorrow, "7 days" or "2 weeks" (7 days unsaid).',
  },
  columns: {
    type: "array",
    items: { type: "string" },
    minItems: 1,
    description:
      "A list mail: the fields the mail's table shows, in this order, e.g. session,attendee,status; each one the record page could show.",
  },
  limit: {
    type: ["integer", "string"],
    description: "A list mail: at most this many records; none for no limit.",
  },
  empty: {
    type: "string",
    enum: [...EMPTY],
    description:
      "A list mail with nothing to show: skip (no mail; unsaid) or send (a mail that says so).",
  },
} as const;

type ListArgs = {
  list?: string;
  query?: string;
  where?: Record<string, string | boolean | string[]>;
  date?: string;
  within?: string;
  columns?: string[];
  limit?: number | string;
  empty?: string;
};

/** A list mail's `list` and `empty` from an operation's arguments, checked; or the reason. */
function listFromArgs(
  args: ListArgs,
  ir: Pick<SpecIR, "models" | "queries">,
  base?: OutgoingListIR,
): { list: OutgoingListIR; empty?: "send" } {
  const none = (v: string | undefined) => (v === "none" ? undefined : v);
  const input: ListInput = {
    // A model given replaces a query and the other way round (both given is said by readList);
    // a query list keeps only its query, since its model is the query's.
    model: args.list ?? (args.query !== undefined || base?.query ? undefined : base?.model),
    query: args.query ?? (args.list !== undefined ? undefined : base?.query),
    where:
      args.where !== undefined
        ? Object.keys(args.where).length
          ? conditionArgs(args.where)
          : undefined
        : base?.where,
    when: args.date !== undefined ? none(args.date) : base?.when?.path.join("."),
    within:
      args.within !== undefined
        ? none(args.within)
        : base?.within
          ? withinText(base.within)
          : undefined,
    limit:
      args.limit === undefined
        ? base?.limit
        : args.limit === "none"
          ? undefined
          : Number(args.limit),
    columns: args.columns ?? base?.columns,
  };
  if (args.columns?.length === 1 && args.columns[0] === "none")
    throw new OperationError(
      "A list mail's table has at least one column; --columns none is no table.",
    );
  if (args.empty !== undefined && !(EMPTY as readonly string[]).includes(args.empty))
    throw new OperationError(emptyProblem(args.empty));
  const read = readList(input, ir.models, ir.queries);
  if ("problem" in read)
    throw new OperationError(`${read.problem}${read.hint ? ` ${read.hint}` : ""}`);
  return { list: read.list, ...(args.empty === "send" ? { empty: "send" } : {}) };
}

/**
 * The recipient of a list mail must read every record of its model (reports.md §2.2): checked
 * against the auth file when the project has one, as the auth file's own check does.
 */
const authOf = (auth: YamlEditor | undefined) =>
  auth ? validateAuth({ path: "smithable.auth.yml", text: auth.text }).auth : undefined;

function checkListReader(auth: AuthIR | undefined, role: string, model: ModelIR): void {
  const problem = auth ? listReaderProblem(role, model, auth) : undefined;
  if (problem) throw new OperationError(`${capital(problem.message)} ${problem.hint}`);
}

const addOutgoing: Operation<
  {
    outgoing: string;
    when: string;
    fields?: string[];
    show?: string[];
    previous?: boolean;
    to?: string;
    recipient?: string;
  } & ListArgs
> = {
  name: "addOutgoing",
  summary:
    "Tell someone when something happens to a record: mail, push to or text (--to mail,push) the record's owner, a role or an address on the record when a record is added, changed or deleted, or an action runs (e.g. a confirmation when a booking is made); or call a target. On a clock timer (every day at 06:30), a list mail: a table of records (--list Booking --columns …) to a role that reads them all.",
  schema: {
    type: "object",
    required: ["outgoing", "when"],
    additionalProperties: false,
    properties: {
      outgoing: { type: "string", minLength: 1, description: "camelCase name, e.g. bookingMade." },
      when: whenSchema,
      where: {
        ...whereSchema,
        description: `${whereSchema.description} For a list mail, the list's where.`,
      },
      fields: fieldsSchema,
      show: showArgSchema,
      previous: previousSchema,
      to: toArgSchema,
      recipient: recipientArgSchema,
      ...LIST_ARGS,
    },
  },
  positional: ["outgoing", "when"],
  describe: ({ outgoing, when, to = "mail", recipient, list, query }) =>
    `Add ${outgoing}: when ${when}, ${howText(to, recipient)}${list || query ? ` the ${list ?? query} list` : ""}`,
  destructive: () => false,
  apply(
    { spec, auth },
    { outgoing, when, where, fields, show, previous, to = "mail", recipient, ...listArgs },
    ir,
  ) {
    if (!FIELD_NAME_PATTERN.test(outgoing))
      throw new OperationError(nameRule("outgoing", outgoing));
    if (ir.outgoing.some((o) => o.name === outgoing))
      throw new OperationError(`"${outgoing}" exists already under outgoing.`);
    const read = readWhen(when, ir.models, ir.actions, ir.timers);
    if ("problem" in read)
      throw new OperationError(`${read.problem}${read.hint ? ` ${read.hint}` : ""}`);
    const t = readTo(toArg(to));
    if ("problem" in t) throw new OperationError(capital(t.problem));
    const value: Record<string, YamlValue> = { when };
    if ("clock" in read) {
      // A list mail: the timer has no records, so the entry carries the list instead.
      if (fields !== undefined || show !== undefined || previous !== undefined)
        throw new OperationError(
          `The timer "${read.clock}" is on a clock with no records, so "${outgoing}" is a list mail: "fields", "show" and "previous" say nothing for it.`,
        );
      if (!("channels" in t) || t.channels.join() !== "mail")
        throw new OperationError(`A list mail ${listMailOnly(t)}`);
      const { list, empty } = listFromArgs({ ...listArgs, where }, ir);
      const model = ir.models.find((m) => m.name === list.model) as ModelIR;
      if (!recipient)
        throw new OperationError(
          `A list mail needs a recipient: --recipient a role that reads every ${model.name} (admin).`,
        );
      const known = authOf(auth);
      const r = readListRecipient(
        recipient,
        model,
        known?.roles.map((x) => x.name),
      );
      if ("problem" in r) throw new OperationError(capital(r.problem));
      checkListReader(known, r.role, model);
      value.to = "mail";
      value.recipient = recipient;
      value.list = listValue(list);
      if (empty) value.empty = empty;
      if (spec.has(["outgoing"])) spec.add(["outgoing"], outgoing, value);
      else spec.add([], "outgoing", { [outgoing]: value });
      return [];
    }
    if (Object.values(listArgs).some((v) => v !== undefined))
      throw new OperationError(capital(notAListMail(when)));
    if ("custom" in read.when) {
      const r = readCustom(read.when.custom, {
        where,
        fields,
        show,
        previous,
        channels: "channels" in t,
        recipient,
      });
      if (r) throw new OperationError(r);
    }
    const model = ir.models.find(
      (m) => "model" in read.when && m.name === read.when.model,
    ) as ModelIR;
    if (fields && !("custom" in read.when)) {
      const f = readFields(fields, read.when, model);
      if ("problem" in f) throw new OperationError(f.problem);
    }
    const body = "custom" in read.when ? {} : readBody({ show, previous }, read.when, model);
    if ("problem" in body) throw new OperationError(body.problem);
    if ("channels" in t) {
      if (!recipient) throw new OperationError(missingRecipient(t.channels));
      if (!("custom" in read.when)) checkRecipient(recipient, t.channels, model, ir.models);
    } else if (recipient) throw new OperationError(TARGET_RECIPIENT);
    if (where && Object.keys(where).length) value.where = conditionArgs(where);
    if (fields?.length) value.fields = [...new Set(fields)];
    value.to = toValue(t);
    if (recipient) value.recipient = recipient;
    if (body.show !== undefined) value.show = body.show;
    if (body.previous) value.previous = true;
    if (spec.has(["outgoing"])) spec.add(["outgoing"], outgoing, value);
    else spec.add([], "outgoing", { [outgoing]: value });
    return [];
  },
};

const TARGET_RECIPIENT = `A target has its own address: "recipient" is for mail, push and sms.`;

/** An operation's recipient for the channels of an entry about a record of `model`, checked. */
function checkRecipient(
  recipient: string,
  channels: Channel[],
  model: ModelIR,
  models: ModelIR[],
): void {
  const r = readRecipient(recipient, model, models);
  if ("problem" in r) throw new OperationError(r.problem);
  const far = reachProblem(r.recipient, channels);
  if (far) throw new OperationError(capital(far));
}

const setOutgoingTo: Operation<{ outgoing: string; to: string; recipient?: string }> = {
  name: "setOutgoingTo",
  summary:
    "Change how an outgoing entry tells: its channels (mail, push, sms; several separated by commas) or a target, and with --recipient whom. A target has its own address, so a recipient goes with the change to one.",
  schema: {
    type: "object",
    required: ["outgoing", "to"],
    additionalProperties: false,
    properties: { outgoing: named, to: toArgSchema, recipient: recipientArgSchema },
  },
  positional: ["outgoing", "to"],
  describe: ({ outgoing, to, recipient }) =>
    `Let ${outgoing} ${howText(to, recipient).replace(/ someone$/, "")}`,
  destructive: () => false,
  apply({ spec }, { outgoing, to, recipient }, ir) {
    const o = ir.outgoing.find((x) => x.name === outgoing);
    if (!o) throw new OperationError(`There is nothing named "${outgoing}" under outgoing.`);
    if (o.list)
      throw new OperationError(
        `"${outgoing}" is a list mail, which goes by mail alone; setOutgoingTo is for an entry about a record or an action.`,
      );
    const t = readTo(toArg(to));
    if ("problem" in t) throw new OperationError(capital(t.problem));
    const at = ["outgoing", outgoing];
    const put = (key: string, v: YamlValue) =>
      spec.has([...at, key]) ? spec.set([...at, key], v) : spec.add(at, key, v);
    if ("target" in t) {
      if (recipient !== undefined) throw new OperationError(TARGET_RECIPIENT);
      put("to", t.target);
      if (spec.has([...at, "recipient"])) spec.remove([...at, "recipient"]);
      return [];
    }
    const whom = recipient ?? (o.recipient ? recipientText(o.recipient) : undefined);
    if (!whom) throw new OperationError(missingRecipient(t.channels));
    if ("custom" in o.when) {
      const problem = readCustom(o.when.custom, { channels: true, recipient: whom });
      if (problem) throw new OperationError(capital(problem));
    } else {
      const on = o.when.model;
      const model = ir.models.find((m) => m.name === on) as ModelIR;
      checkRecipient(whom, t.channels, model, ir.models);
    }
    put("to", toValue(t));
    if (recipient !== undefined) put("recipient", recipient);
    return [];
  },
};

const setOutgoingList: Operation<{ outgoing: string } & ListArgs> = {
  name: "setOutgoingList",
  summary:
    "Change what a list mail shows: its records (--list Model replaces a query, --query a model; a query list takes no where, date or within), their condition, the date and how far it reaches, the columns, how many, and whether a quiet day is mailed. A given key replaces the old; {} takes where away, none the date, within or limit.",
  schema: {
    type: "object",
    required: ["outgoing"],
    additionalProperties: false,
    properties: {
      outgoing: named,
      ...LIST_ARGS,
      where: { ...whereSchema, description: "The list's where; {} takes it away." },
    },
  },
  positional: ["outgoing"],
  describe: ({ outgoing }) => `Change the list ${outgoing} mails`,
  destructive: () => false,
  apply({ spec, auth }, { outgoing, ...args }, ir) {
    const o = ir.outgoing.find((x) => x.name === outgoing);
    if (!o) throw new OperationError(`There is nothing named "${outgoing}" under outgoing.`);
    if (!o.list || !("timer" in o.when))
      throw new OperationError(
        `"${outgoing}" tells about one record at a time; setOutgoingList is for a list mail on a clock timer.`,
      );
    if (!Object.values(args).some((v) => v !== undefined))
      throw new OperationError(
        "Say what to change: --list, --query, --where, --date, --within, --columns, --limit or --empty.",
      );
    const { list, empty } = listFromArgs(args, ir, o.list);
    const model = ir.models.find((m) => m.name === list.model) as ModelIR;
    if (o.recipient?.kind === "role" && list.model !== o.list.model)
      checkListReader(authOf(auth), o.recipient.role, model);
    const at = ["outgoing", outgoing];
    spec.set([...at, "list"], listValue(list));
    if (args.empty !== undefined) {
      if (empty) {
        if (spec.has([...at, "empty"])) spec.set([...at, "empty"], empty);
        else spec.add(at, "empty", empty);
      } else if (spec.has([...at, "empty"])) spec.remove([...at, "empty"]);
    }
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
    const fires = ir.actions.find((a) => a.custom && a.triggers?.includes(outgoing));
    if (fires)
      throw new OperationError(
        `The action "${fires.name}" may fire ${outgoing} (its triggers); change the action first.`,
      );
    spec.removeAndPrune(["outgoing", outgoing], 0);
    return [];
  },
};

const setOutgoingBody: Operation<{ outgoing: string; show?: string[]; previous?: boolean }> = {
  name: "setOutgoingBody",
  summary:
    "Choose what an outgoing mail lists under its text and a call carries: the fields in order, none for the text alone, or default for the record page's fields; and whether a change's mail or call says what the changed fields were.",
  schema: {
    type: "object",
    required: ["outgoing"],
    additionalProperties: false,
    properties: {
      outgoing: named,
      show: {
        ...showArgSchema,
        description: `${showArgSchema.description} "default" returns to the record page's fields.`,
      },
      previous: previousSchema,
    },
  },
  positional: ["outgoing"],
  describe: ({ outgoing, show, previous }) =>
    `Set what ${outgoing} carries${show ? `: ${show.join(", ")}` : ""}${previous !== undefined ? `, previous ${previous ? "on" : "off"}` : ""}`,
  destructive: () => false,
  apply({ spec }, { outgoing, show, previous }, ir) {
    const o = ir.outgoing.find((x) => x.name === outgoing);
    if (!o) throw new OperationError(`There is nothing named "${outgoing}" under outgoing.`);
    if (show === undefined && previous === undefined)
      throw new OperationError(
        "Say --show (fields in order, none, or default) or --previous true|false.",
      );
    if ("custom" in o.when)
      throw new OperationError(
        `The custom action "${o.when.custom}" has no record, so "show" and "previous" say nothing for "${outgoing}".`,
      );
    const model = ir.models.find((m) => "model" in o.when && m.name === o.when.model) as ModelIR;
    const at = ["outgoing", outgoing];
    if (show !== undefined) {
      if (show.length === 1 && show[0] === "default") {
        if (spec.has([...at, "show"])) spec.remove([...at, "show"]);
      } else {
        const r = readBody({ show }, o.when, model);
        if ("problem" in r) throw new OperationError(r.problem);
        if (spec.has([...at, "show"])) spec.set([...at, "show"], r.show ?? "none");
        else spec.add(at, "show", r.show ?? "none");
      }
    }
    if (previous !== undefined) {
      if (!previous) {
        if (spec.has([...at, "previous"])) spec.remove([...at, "previous"]);
      } else {
        const r = readBody({ previous }, o.when, model);
        if ("problem" in r) throw new OperationError(r.problem);
        if (spec.has([...at, "previous"])) spec.set([...at, "previous"], true);
        else spec.add(at, "previous", true);
      }
    }
    return [];
  },
};

export const outgoingSection: SpecSection<"outgoing"> = {
  key: "outgoing",
  required: false,
  operations: [
    addOutgoing,
    removeOutgoing,
    setOutgoingBody,
    setOutgoingList,
    setOutgoingTo,
  ] as AnyOperation[],
  schema: {
    type: "object",
    description:
      "Who is told when something happens to a record: a mail, a browser push or a text to the owner, a role or an address on the record; or a signed call to a named target.",
    propertyNames: { pattern: FIELD_NAME_PATTERN.source },
    additionalProperties: {
      type: "object",
      required: ["when", "to"],
      additionalProperties: false,
      properties: {
        when: whenSchema,
        where: whereSchema,
        fields: fieldsSchema,
        show: showSchema,
        previous: previousSchema,
        to: {
          anyOf: [
            { type: "string", pattern: FIELD_NAME_PATTERN.source },
            { type: "array", items: { enum: [...CHANNELS] }, minItems: 1, uniqueItems: true },
          ],
          description:
            "A channel (mail, push or sms), a list of channels ([mail, push]) that each reach the recipient, or the name of a target whose address and secret are settings (alone; push and sms are not target names).",
        },
        recipient: {
          type: "string",
          pattern: "^[a-z][A-Za-z0-9]*(?:\\.[a-z][A-Za-z0-9]*)?$",
          description:
            "For mail, push and sms: owner, a role or a field that refers to User (every channel), an email field (mail) or a phone field (sms), one reference away (customer.email), or a list field and then the owner or an address of each of its records (bookings.owner). For a list mail, a role that reads every record of the model.",
        },
        list: {
          type: "object",
          required: ["columns"],
          additionalProperties: false,
          description:
            'When "when" names a clock timer (every or cron, no on): the records the mail shows as a table, with a dashboard list tile\'s keys, e.g. { model: Booking, when: session.startsAt, within: today, columns: [session, attendee, status] }.',
          properties: {
            model: { type: "string", description: "The model whose records the mail shows." },
            query: {
              type: "string",
              description: "A query whose records the mail shows, instead of a model's.",
            },
            where: whereSchema,
            when: {
              type: "string",
              pattern: DATE_PATH.source,
              description:
                "A stored date or date-time field of the model, or one reference away (session.startsAt): the records whose date falls within the span.",
            },
            within: {
              type: "string",
              pattern: "^(today|tomorrow|[1-9][0-9]* (day|days|week|weeks))$",
              description:
                'With "when": how far the list reaches from the timer\'s time, in the app\'s time zone: today (the day that starts when the timer fires), tomorrow, "7 days" or "2 weeks" (7 days unsaid).',
            },
            limit: { type: "integer", minimum: 1, description: "At most this many records." },
            columns: {
              type: "array",
              items: { type: "string", pattern: FIELD_NAME_PATTERN.source },
              minItems: 1,
              description:
                "The fields the mail's table shows, in this order; each one the record page could show (no files, nothing sensitive, no lists, no worked-out fields).",
            },
          },
        },
        empty: {
          enum: [...EMPTY],
          description:
            "A list mail with nothing to show: skip (no mail; unsaid) or send (a mail that says so).",
        },
      },
    },
  },
  parse(ctx, node, parsed) {
    const out: OutgoingIR[] = [];
    if (node === undefined) {
      idleClockTimers(ctx, parsed.timers ?? [], out);
      return out;
    }
    const models = parsed.models ?? [];
    const actions = parsed.actions ?? [];
    for (const { key, keyNode, value } of mapEntries(ctx, node, `"outgoing"`) ?? []) {
      if (!FIELD_NAME_PATTERN.test(key)) {
        ctx.error(keyNode, "invalid-name", nameRule("outgoing", key));
        continue;
      }
      const where = `outgoing "${key}"`;
      ctx.define("outgoing", key);
      const known = checkKeys(ctx, mapEntries(ctx, value, where) ?? [], where, {
        allowed: [
          "when",
          "where",
          "fields",
          "show",
          "previous",
          "to",
          "recipient",
          "list",
          "empty",
        ],
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
      if ("clock" in read) {
        const entry = readListMail(
          ctx,
          key,
          keyNode,
          read.clock,
          byKey,
          models,
          parsed.queries ?? [],
        );
        if (entry) out.push(entry);
        continue;
      }
      for (const k of ["list", "empty"] as const) {
        const given = byKey.get(k);
        if (given)
          ctx.error(given.keyNode, "invalid-key", `${capital(where)}: ${notAListMail(whenText)}`);
      }
      if (byKey.has("list") || byKey.has("empty")) continue;
      const model = models.find(
        (m) => "model" in read.when && m.name === read.when.model,
      ) as ModelIR;
      // A model's event names the model in the text; a standard action names only the action.
      if ("event" in read.when) ctx.reference("model", read.when.model, whenEntry.value);
      const toEntry = byKey.get("to");
      if (!toEntry) {
        ctx.error(
          keyNode,
          "missing-key",
          `${capital(where)} needs "to": mail, push, sms, a list of them, or a target.`,
        );
        continue;
      }
      const t = readToNode(ctx, toEntry.value, where);
      if (!t) continue;
      if ("custom" in read.when) {
        const problem = readCustom(read.when.custom, {
          where: byKey.has("where") ? {} : undefined,
          fields: byKey.has("fields") ? [] : undefined,
          show: byKey.has("show") ? [] : undefined,
          previous: byKey.has("previous") ? true : undefined,
          channels: "channels" in t,
          recipient: byKey.has("recipient")
            ? readString(ctx, byKey.get("recipient")?.value, `"recipient" of ${where}`)
            : undefined,
        });
        if (problem) {
          ctx.error(whenEntry.value, "invalid-outgoing", `${capital(where)}: ${problem}`);
          continue;
        }
      }
      const entry: OutgoingIR =
        "channels" in t
          ? { name: key, when: read.when, to: t.channels[0] as Channel, channels: t.channels }
          : { name: key, when: read.when, to: t.target };
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
      const showEntry = byKey.get("show");
      if (showEntry) {
        let show: string[] | "none" | undefined;
        if (isScalar(showEntry.value)) {
          const text = readString(ctx, showEntry.value, `"show" of ${where}`);
          if (text === undefined) continue;
          if (text !== "none") {
            ctx.error(
              showEntry.value,
              "invalid-outgoing",
              `${capital(where)}: "show" lists the fields the mail or call carries, or is none; "${text}" is neither.`,
            );
            continue;
          }
          show = "none";
        } else {
          const names = readNameList(ctx, showEntry.value, `"show" of ${where}`).map((n) => n.name);
          if (!isSeq(showEntry.value)) continue;
          show = names;
        }
        const b = readBody({ show }, read.when, model);
        if ("problem" in b) {
          ctx.error(showEntry.value, "invalid-outgoing", `${capital(where)}: ${b.problem}`);
          continue;
        }
        entry.show = b.show;
      }
      const previousEntry = byKey.get("previous");
      if (previousEntry) {
        const previous = readBoolean(ctx, previousEntry.value, `"previous" of ${where}`);
        if (previous === undefined) continue;
        const b = readBody({ previous }, read.when, model);
        if ("problem" in b) {
          ctx.error(previousEntry.value, "invalid-outgoing", `${capital(where)}: ${b.problem}`);
          continue;
        }
        if (b.previous) entry.previous = true;
      }
      const recipientEntry = byKey.get("recipient");
      const recipientText = recipientEntry
        ? readString(ctx, recipientEntry.value, `"recipient" of ${where}`)
        : undefined;
      if ("channels" in t) {
        const alone =
          t.channels.length === 1 && t.channels[0] !== "mail" ? t.channels[0] : undefined;
        if (!recipientEntry && alone) {
          // A target of that name, from before push and sms were channels (notifications.md §9).
          ctx.error(
            toEntry.value,
            "reserved-name",
            `${capital(where)} goes by ${alone}, a built-in channel, so it needs "recipient": owner, a role or a field with an address.`,
            renameHint(alone),
          );
          continue;
        }
        if (!recipientEntry) {
          ctx.error(
            keyNode,
            "missing-key",
            `${capital(where)} ${t.channels.length === 1 ? "mails" : `goes by ${andList([...t.channels])}`}, so it needs "recipient": owner, a role, or a field with an address.`,
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
        const problem = "problem" in r ? r.problem : reachProblem(r.recipient, t.channels);
        if (problem) {
          ctx.error(recipientEntry.value, "invalid-outgoing", `${capital(where)}: ${problem}`);
          continue;
        }
        if ("problem" in r) continue;
        if (r.role) ctx.reference("role", r.role, recipientEntry.value);
        entry.recipient = r.recipient;
      } else if (recipientEntry) {
        ctx.error(
          recipientEntry.keyNode,
          "invalid-outgoing",
          `${capital(where)} tells ${t.target}, which has its own address: "recipient" is for mail, push and sms.`,
        );
        continue;
      }
      out.push(entry);
    }
    idleClockTimers(ctx, parsed.timers ?? [], out);
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
      if (o.list) {
        const followed = followList(spec, effect, o, o.list, ir);
        if (followed) return followed;
        continue;
      }
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
        if (o.when.model === effect.model && Array.isArray(o.show) && o.show.includes(effect.from))
          spec.set(
            [...at, "show"],
            o.show.map((f) => (f === effect.from ? effect.to : f)),
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
        if (
          effect.kind === "remove-field" &&
          o.when.model === effect.model &&
          Array.isArray(o.show) &&
          o.show.includes(effect.field)
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

/** An entry's `to` as the spec gives it, checked; said and undefined when wrong. */
function readToNode(
  ctx: ParseContext,
  node: Entry["value"],
  where: string,
): { channels: Channel[] } | { target: string } | undefined {
  const what = `"to" of ${where}`;
  const given = isSeq(node)
    ? readNameList(ctx, node, what).map((n) => n.name)
    : readString(ctx, node, what);
  if (given === undefined) return undefined;
  const t = readTo(given);
  if (!("problem" in t)) return t;
  ctx.error(node, "invalid-outgoing", `${capital(where)}: ${t.problem}`);
  return undefined;
}

/**
 * A clock timer with neither "on" nor "run" is for a list mail; one no entry names does nothing,
 * which is said (a mistyped "run" would otherwise go quiet).
 */
function idleClockTimers(ctx: ParseContext, timers: TimerIR[], out: OutgoingIR[]): void {
  for (const t of timers) {
    if (t.on || t.run || t.schedule.kind === "record") continue;
    if (out.some((o) => "timer" in o.when && o.when.timer === t.name)) continue;
    ctx.warning(
      ctx.at(`timer:${t.name}`),
      "timer-does-nothing",
      `Timer "${t.name}" does nothing: it is on a clock with no records, runs no action, and no outgoing entry names it.`,
      `Give it "run" (an action), "on" (records whose event it raises), or an outgoing entry with "list" that names it (a list mail).`,
    );
  }
}

/**
 * An entry on a clock timer: a list mail (reports.md §2.2). It carries `list` and may carry
 * `empty`; the record's keys say nothing; it goes by mail to a role.
 */
function readListMail(
  ctx: ParseContext,
  name: string,
  keyNode: ParsedNode,
  timer: string,
  byKey: Map<string, Entry>,
  models: ModelIR[],
  queries: QueryIR[],
): OutgoingIR | undefined {
  const where = `outgoing "${name}"`;
  const listEntry = byKey.get("list");
  if (!listEntry) {
    ctx.error(
      keyNode,
      "missing-key",
      `${capital(where)} listens to the timer "${timer}", which is on a clock with no records, so it needs "list": the records the mail shows, as { model: Booking, columns: [session, attendee] }.`,
    );
    return undefined;
  }
  const recordKeys = ["where", "fields", "show", "previous"].filter((k) => byKey.has(k));
  if (recordKeys.length) {
    ctx.error(
      byKey.get(recordKeys[0] ?? "")?.keyNode ?? keyNode,
      "invalid-key",
      `${capital(where)} is a list mail (its timer "${timer}" is on a clock with no records), so ${recordKeys.map((k) => `"${k}"`).join(" and ")} ${recordKeys.length > 1 ? "say" : "says"} nothing; the list's own "where" goes under "list".`,
    );
    return undefined;
  }
  const listWhere = `"list" of ${where}`;
  const known = checkKeys(ctx, mapEntries(ctx, listEntry.value, listWhere) ?? [], listWhere, {
    allowed: ["model", "query", "where", "when", "within", "limit", "columns"],
  });
  const listKeys = new Map(known.map((e) => [e.key, e]));
  const text = (key: string) => {
    const e = listKeys.get(key);
    return e ? readString(ctx, e.value, `"${key}" of ${listWhere}`) : undefined;
  };
  const input: ListInput = { model: text("model"), query: text("query") };
  const modelName =
    input.query !== undefined ? queries.find((q) => q.name === input.query)?.returns : input.model;
  const model = models.find((m) => m.name === modelName);
  const whereEntry = listKeys.get("where");
  if (whereEntry && model)
    input.where = readCondition(ctx, whereEntry.value, `"where" of ${listWhere}`, model);
  input.when = text("when");
  input.within = text("within");
  const limitEntry = listKeys.get("limit");
  if (limitEntry) input.limit = readNumber(ctx, limitEntry.value, `"limit" of ${listWhere}`);
  const columnsEntry = listKeys.get("columns");
  if (columnsEntry) {
    const names = readNameList(ctx, columnsEntry.value, `"columns" of ${listWhere}`);
    if (!isSeq(columnsEntry.value)) return undefined;
    input.columns = names.map((n) => n.name);
  }
  const read = readList(input, models, queries);
  if ("problem" in read) {
    const at = listKeys.get(read.key)?.value ?? listEntry.value;
    ctx.error(at, "invalid-outgoing", `${capital(where)}: ${read.problem}`, read.hint);
    return undefined;
  }
  const list = read.list;
  const modelEntry = listKeys.get("model");
  if (modelEntry) ctx.reference("model", list.model, modelEntry.value);
  const queryEntry = listKeys.get("query");
  if (queryEntry && list.query) ctx.reference("query", list.query, queryEntry.value);
  const toEntry = byKey.get("to");
  if (!toEntry) {
    ctx.error(keyNode, "missing-key", `${capital(where)} needs "to": mail.`);
    return undefined;
  }
  const t = readToNode(ctx, toEntry.value, where);
  if (!t) return undefined;
  if (!("channels" in t) || t.channels.join() !== "mail") {
    ctx.error(
      toEntry.value,
      "invalid-outgoing",
      `${capital(where)} is a list mail, which ${listMailOnly(t)}`,
    );
    return undefined;
  }
  const recipientEntry = byKey.get("recipient");
  if (!recipientEntry) {
    ctx.error(
      keyNode,
      "missing-key",
      `${capital(where)} mails a list, so it needs "recipient": a role that reads every ${list.model}.`,
    );
    return undefined;
  }
  const recipientText = readString(ctx, recipientEntry.value, `"recipient" of ${where}`);
  if (recipientText === undefined) return undefined;
  const r = readListRecipient(recipientText, model as ModelIR, ctx.defined("role"));
  if ("problem" in r) {
    ctx.error(recipientEntry.value, "invalid-outgoing", `${capital(where)}: ${r.problem}`);
    return undefined;
  }
  ctx.reference("role", r.role, recipientEntry.value);
  const entry: OutgoingIR = {
    name,
    when: { model: list.model, timer, clock: true },
    to: "mail",
    channels: ["mail"],
    recipient: { kind: "role", role: r.role },
    list,
    empty: "skip",
  };
  const emptyEntry = byKey.get("empty");
  if (emptyEntry) {
    const empty = readString(ctx, emptyEntry.value, `"empty" of ${where}`);
    if (empty === undefined) return undefined;
    if (!(EMPTY as readonly string[]).includes(empty)) {
      ctx.error(emptyEntry.value, "invalid-outgoing", `${capital(where)}: ${emptyProblem(empty)}`);
      return undefined;
    }
    entry.empty = empty as "skip" | "send";
  }
  return entry;
}

/**
 * A list mail follows a renamed field in its columns, condition and date, and refuses the
 * removal of one it uses (or of a choice value its condition wants).
 */
function followList(
  spec: YamlEditor,
  effect: Effect,
  o: OutgoingIR,
  list: OutgoingListIR,
  ir: SpecIR,
): Refusal | undefined {
  const at = ["outgoing", o.name, "list"];
  const uses = (field: string) =>
    `"${o.name}" under outgoing shows ${list.model}.${field} in its list; change or remove it first.`;
  // The date may be one reference away: the first name is this model's field, the second the
  // referenced model's.
  const [first, second] = list.when?.path ?? [];
  const ref = ir.models.find((m) => m.name === list.model)?.fields.find((f) => f.name === first);
  const refModel = ref?.type.kind === "relation" ? ref.type.model : undefined;
  if (effect.kind === "rename-field") {
    const own = list.model === effect.model;
    if (own && list.columns.includes(effect.from))
      spec.set(
        [...at, "columns"],
        list.columns.map((c) => (c === effect.from ? effect.to : c)),
      );
    if (own && list.where?.[effect.from] !== undefined)
      spec.renameKey([...at, "where", effect.from], effect.to);
    // Both names may be the renamed field (a reference to the model itself, parent.parent).
    const newFirst = own && first === effect.from ? effect.to : first;
    const newSecond =
      second !== undefined && refModel === effect.model && second === effect.from
        ? effect.to
        : second;
    if (first !== undefined && (newFirst !== first || newSecond !== second))
      spec.set([...at, "when"], [newFirst, ...(newSecond ? [newSecond] : [])].join("."));
  }
  // The date's type changed, or the reference it goes through: the list's "when" may no longer
  // hold, so it is changed first.
  if (
    effect.kind === "change-field" &&
    first !== undefined &&
    ((list.model === effect.model && first === effect.field) ||
      (second !== undefined && refModel === effect.model && second === effect.field))
  )
    return {
      refusal: `"${o.name}" under outgoing lists ${list.model} records by ${list.when?.path.join(".")}, whose type is changing; change or remove it first.`,
    };
  if (effect.kind === "remove-field") {
    if (list.model === effect.model) {
      if (list.columns.includes(effect.field) || list.where?.[effect.field] !== undefined)
        return { refusal: uses(effect.field) };
      if (first === effect.field)
        return {
          refusal: `"${o.name}" under outgoing lists ${list.model} records by ${list.model}.${effect.field}; change or remove it first.`,
        };
    }
    if (second !== undefined && refModel === effect.model && second === effect.field)
      return {
        refusal: `"${o.name}" under outgoing lists ${list.model} records by ${effect.model}.${effect.field}; change or remove it first.`,
      };
  }
  if (effect.kind === "change-field" && list.model === effect.model) {
    const wanted = list.where?.[effect.field];
    if (wanted !== undefined) {
      const now = followRenamed(spec, [...at, "where", effect.field], wanted, effect.renamed ?? {});
      if (lostValues(now, effect.choices).length)
        return {
          refusal: `"${o.name}" under outgoing wants a value ${effect.model}.${effect.field} no longer has in its list; change or remove it first.`,
        };
    }
  }
  return undefined;
}

/**
 * What a custom action's entry may say: it has no record, so no `where` or `fields`, and a mail
 * goes to a role (an owner or an address field would be a record's). Returns what is wrong.
 */
function readCustom(
  action: string,
  o: {
    where?: object;
    fields?: string[];
    show?: unknown;
    previous?: unknown;
    /** The entry goes by built-in channels (to a role), not to a target. */
    channels?: boolean;
    recipient?: string;
  },
): string | undefined {
  if (o.where !== undefined || o.fields !== undefined)
    return `the custom action "${action}" has no record, so "where" and "fields" say nothing; leave them out.`;
  if (o.show !== undefined || o.previous !== undefined)
    return `the custom action "${action}" has no record, so "show" and "previous" say nothing; leave them out.`;
  if (o.channels && o.recipient !== undefined && !/^[a-z][A-Za-z0-9]*$/.test(o.recipient))
    return `the custom action "${action}" has no record, so its mail goes to a role; "${o.recipient}" is not one.`;
  if (o.channels && o.recipient === "owner")
    return `the custom action "${action}" has no record and so no owner; mail a role instead.`;
  return undefined;
}
