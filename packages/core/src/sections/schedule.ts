// One person's time (docs/design/appointments.md §2): a model whose records are booked by their
// time (`schedule`: weekly hours, breaks, a gap, records of time away) and a model whose records
// take that time (`occupies`: a resource, a start, a length, while a condition holds).
import { isMap, isSeq, type ParsedNode } from "yaml";
import { followRenamed, lostValues, readCondition } from "../condition.js";
import {
  checkKeys,
  mapEntries,
  type ParseContext,
  readNameList,
  readNumber,
  readString,
} from "../context.js";
import type { YamlEditor } from "../edit.js";
import { readHours, readSpan, type Span } from "../hours.js";
import {
  conditionFits,
  type FieldIR,
  type ModelIR,
  type OccupiesIR,
  type ScheduleIR,
  USER_MODEL,
} from "../ir.js";
import type { Effect } from "../operation.js";
import type { JsonSchema } from "../section.js";
import { didYouMean } from "../suggest.js";
import { type FieldShorthand, parseFieldShorthand } from "./field-type.js";

const spanOrList: JsonSchema = {
  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" }, minItems: 1 }],
};

export const scheduleSchema: JsonSchema = {
  type: "object",
  description:
    'Its records are people (or rooms, chairs) whose time is booked, e.g. { hours: { mon-fri: "09:00-17:00" }, breaks: "12:00-12:30", gap: 10, away: TimeOff }.',
  required: ["hours"],
  additionalProperties: false,
  properties: {
    hours: {
      type: "object",
      description:
        'The weekly hours in the app\'s time zone: a weekday or a range of them (mon-fri) to a span ("09:00-17:00") or a list of spans. A day not named is closed.',
      additionalProperties: spanOrList,
    },
    breaks: {
      ...spanOrList,
      description: 'Spans kept free every open day: "12:00-12:30", or a list of them.',
    },
    gap: { type: "integer", minimum: 0, description: "Minutes kept free after each booking." },
    away: {
      oneOf: [
        { type: "string" },
        {
          type: "object",
          required: ["model"],
          additionalProperties: false,
          properties: {
            model: { type: "string", description: "The model of time away." },
            resource: {
              type: "string",
              description: "Its reference to this model; left out, its only one.",
            },
            from: {
              type: "string",
              description: "When the time away starts; left out, its first date-and-time field.",
            },
            until: {
              type: "string",
              description: "When it ends; left out, its second date-and-time field.",
            },
          },
        },
      ],
      description:
        "A model whose records block time (days off, holidays): its reference to this model and two date-time fields, from and until. Its name alone takes its one reference here and its first two date-time fields; { model, resource, from, until } says them.",
    },
  },
};

export const occupiesSchema: JsonSchema = {
  type: "object",
  description:
    "Each record takes a scheduled record's time, e.g. { resource: barber, starts: startsAt, duration: service.minutes, while: { status: [requested, confirmed] }, cancelUntil: 12h }.",
  required: ["resource", "starts", "duration"],
  additionalProperties: false,
  properties: {
    resource: {
      type: "string",
      description: "A required reference of this model to a model with a schedule.",
    },
    starts: { type: "string", description: "A date-and-time field: when the time is taken." },
    duration: {
      type: "string",
      description:
        'Minutes: a whole-number field of this model, or of a record it refers to ("service.minutes").',
    },
    while: {
      type: "object",
      description:
        "Only records with these choice or yes/no values take the time; the others free it.",
    },
    cancelUntil: {
      type: "string",
      pattern: "^[1-9][0-9]*[mhd]$",
      description:
        'How long before the start the record\'s owner may cancel it: "30m", "12h" or "2d". Without it, until the start.',
    },
    cancelTo: {
      type: "string",
      description:
        "The value the owner's Cancel sets, outside while; needed when several values are outside it.",
    },
  },
};

/** "30m", "12h", "2d" as minutes; undefined when the text is not one. */
export function durationMinutes(text: string): number | undefined {
  const m = /^([1-9]\d*)([mhd])$/.exec(text);
  if (!m) return undefined;
  return Number(m[1]) * (m[2] === "m" ? 1 : m[2] === "h" ? 60 : 1440);
}

/** Spans written as one text or a list of them, sorted; each problem said where it is. */
function readSpans(ctx: ParseContext, node: ParsedNode | null, what: string): Span[] {
  const texts = isSeq(node)
    ? readNameList(ctx, node, what).map((n) => ({ text: n.name, at: n.at }))
    : [{ text: readString(ctx, node, what), at: node }];
  const spans: Span[] = [];
  for (const { text, at } of texts) {
    if (text === undefined) continue;
    const span = readSpan(text);
    if (typeof span === "string") ctx.error(at, "invalid-value", span);
    else spans.push(span);
  }
  spans.sort((a, b) => a[0] - b[0]);
  if (spans.some((s, i) => i > 0 && s[0] < (spans[i - 1] as Span)[1]))
    ctx.error(node, "invalid-value", `The spans of ${what} overlap.`);
  return spans;
}

/** A model's schedule as written; its `away` model's fields are found once every model is in. */
export function readSchedule(
  ctx: ParseContext,
  node: ParsedNode | null,
  model: string,
): ScheduleIR | undefined {
  const where = `the schedule of "${model}"`;
  const entries = mapEntries(ctx, node, where);
  if (!entries) return undefined;
  const known = checkKeys(ctx, entries, where, { allowed: ["hours", "breaks", "gap", "away"] });
  const byKey = new Map(known.map((e) => [e.key, e]));
  const hoursEntry = byKey.get("hours");
  if (!hoursEntry) {
    ctx.error(node, "missing-key", `${where} needs "hours", e.g. { mon-fri: "09:00-17:00" }.`);
    return undefined;
  }
  const pairs: [string, string | string[]][] = [];
  const keyAt = new Map<string, ParsedNode>();
  for (const { key, keyNode, value } of mapEntries(ctx, hoursEntry.value, `"hours" in ${where}`) ??
    []) {
    keyAt.set(key, keyNode);
    const what = `"${key}" in the hours of "${model}"`;
    if (isSeq(value)) pairs.push([key, readNameList(ctx, value, what).map((n) => n.name)]);
    else {
      const span = readString(ctx, value, what);
      if (span !== undefined) pairs.push([key, span]);
    }
  }
  const read = readHours(pairs);
  for (const problem of read.problems)
    ctx.error(keyAt.get(problem.key) ?? hoursEntry.value, "invalid-value", problem.message);
  if (!keyAt.size)
    ctx.error(
      hoursEntry.value,
      "invalid-value",
      `"hours" in ${where} names no day, so nothing can ever be booked: give at least one, e.g. { mon-fri: "09:00-17:00" }.`,
    );
  const schedule: ScheduleIR = { hours: read.hours, breaks: [], gap: 0 };
  const breaks = byKey.get("breaks");
  if (breaks) schedule.breaks = readSpans(ctx, breaks.value, `the breaks of "${model}"`);
  const gap = byKey.get("gap");
  if (gap) {
    const minutes = readNumber(ctx, gap.value, `"gap" in ${where}`);
    if (minutes !== undefined && (!Number.isInteger(minutes) || minutes < 0))
      ctx.error(gap.value, "invalid-value", `"gap" in ${where} is a whole number of minutes.`);
    else if (minutes !== undefined) schedule.gap = minutes;
  }
  const away = byKey.get("away");
  if (away) {
    const what = `"away" in ${where}`;
    const long = isMap(away.value) ? mapEntries(ctx, away.value, what) : undefined;
    let named: Record<string, string> = {};
    // Where the model's name is written, so a renamed model is rewritten there.
    let modelAt: ParsedNode | null = away.value;
    if (long) {
      for (const e of checkKeys(ctx, long, what, {
        allowed: ["model", "resource", "from", "until"],
      })) {
        const text = readString(ctx, e.value, `"${e.key}" in ${what}`);
        if (text !== undefined) named[e.key] = text;
        if (e.key === "model") modelAt = e.value;
      }
    } else {
      const text = readString(ctx, away.value, what);
      if (text !== undefined) named = { model: text };
    }
    if (named.model) {
      ctx.reference("model", named.model, modelAt);
      ctx.mark(`away:${model}`, away.value);
      schedule.away = {
        model: named.model,
        resource: named.resource ?? "",
        from: named.from ?? "",
        until: named.until ?? "",
      };
    } else if (long) ctx.error(away.value, "missing-key", `${what} needs "model".`);
  }
  return schedule;
}

/** A model's occupies as written; what it names is checked once every model is in. */
export function readOccupies(
  ctx: ParseContext,
  node: ParsedNode | null,
  model: string,
): OccupiesIR | undefined {
  const where = `"occupies" of "${model}"`;
  const entries = mapEntries(ctx, node, where);
  if (!entries) return undefined;
  const known = checkKeys(ctx, entries, where, {
    allowed: ["resource", "starts", "duration", "while", "cancelUntil", "cancelTo"],
  });
  const byKey = new Map(known.map((e) => [e.key, e]));
  const text = (key: string) => {
    const e = byKey.get(key);
    return e && readString(ctx, e.value, `"${key}" in ${where}`);
  };
  const resource = text("resource");
  const starts = text("starts");
  const duration = text("duration");
  if (!resource || !starts || !duration) {
    if (!byKey.has("resource") || !byKey.has("starts") || !byKey.has("duration"))
      ctx.error(
        node,
        "missing-key",
        `${where} needs "resource" (a reference), "starts" (a date-and-time field) and "duration" (minutes).`,
      );
    return undefined;
  }
  const occupies: OccupiesIR = { resource, starts, duration };
  const condition = byKey.get("while");
  const read = condition && readCondition(ctx, condition.value, `"while" in ${where}`);
  if (read) occupies.while = read;
  const until = text("cancelUntil");
  if (until !== undefined) {
    if (durationMinutes(until) === undefined)
      ctx.error(
        byKey.get("cancelUntil")?.value,
        "invalid-value",
        `"cancelUntil" in ${where} is a whole number and a unit: "30m", "12h" or "2d".`,
      );
    else occupies.cancelUntil = until;
  }
  const to = text("cancelTo");
  // The field is found once the model's fields are read.
  if (to !== undefined) occupies.cancel = { field: "", to };
  else if (occupies.cancelUntil) occupies.cancel = { field: "", to: "" };
  return occupies;
}

const isDateTime = (f: FieldIR | undefined) =>
  f?.type.kind === "scalar" && f.type.name === "datetime" && !f.formula;
const isInt = (f: FieldIR | undefined) =>
  f?.type.kind === "scalar" && f.type.name === "int" && !f.formula;

/** A single reference of `model` to `target` ("barber: Barber!"), or undefined. */
function referenceTo(model: ModelIR, field: string, target?: string): FieldIR | undefined {
  const f = model.fields.find((x) => x.name === field);
  return f?.type.kind === "relation" && !f.type.many && (!target || f.type.model === target)
    ? f
    : undefined;
}

/** The field a duration names, on the record or one reference away; undefined if none. */
export function durationField(
  models: ModelIR[],
  model: ModelIR,
  duration: string,
): FieldIR | undefined {
  const [first, second, ...rest] = duration.split(".");
  if (rest.length) return undefined;
  if (second === undefined) return model.fields.find((f) => f.name === first);
  const ref = referenceTo(model, first ?? "");
  const target = ref?.type.kind === "relation" ? ref.type.model : undefined;
  return models.find((m) => m.name === target)?.fields.find((f) => f.name === second);
}

/** Every schedule's away model and every occupies, checked once all models are parsed. */
export function checkSchedules(ctx: ParseContext, models: ModelIR[]): void {
  for (const model of models) checkSchedule(ctx, models, model);
  for (const model of models) checkOccupies(ctx, models, model);
}

function checkSchedule(ctx: ParseContext, models: ModelIR[], model: ModelIR): undefined {
  const away = model.schedule?.away;
  if (!away) return;
  const at = ctx.at(`away:${model.name}`);
  const where = `"away" in the schedule of "${model.name}"`;
  const target = models.find((m) => m.name === away.model);
  // An unknown model is reported as a reference.
  if (!target) {
    delete model.schedule?.away;
    return;
  }
  const refs = target.fields.filter((f) => referenceTo(target, f.name, model.name));
  const dates = target.fields.filter(isDateTime);
  const fail = (message: string, hint?: string): undefined => {
    ctx.error(at, "invalid-schedule", `${where}: ${message}`, hint);
    delete model.schedule?.away;
  };
  if (away.resource) {
    if (!referenceTo(target, away.resource, model.name))
      return fail(
        `"${away.resource}" must be ${target.name}'s reference to ${model.name}.`,
        didYouMean(
          away.resource,
          refs.map((f) => f.name),
        ),
      );
  } else if (refs.length === 1) away.resource = (refs[0] as FieldIR).name;
  else
    return fail(
      refs.length
        ? `${target.name} refers to ${model.name} in ${refs.map((f) => f.name).join(" and ")}; say which with "resource".`
        : `${target.name} needs a reference to ${model.name} (a field like "${model.name.charAt(0).toLowerCase()}${model.name.slice(1)}: ${model.name}!").`,
    );
  for (const key of ["from", "until"] as const) {
    if (!away[key]) continue;
    if (!isDateTime(target.fields.find((f) => f.name === away[key])))
      return fail(
        `"${away[key]}" must be a date-and-time field of ${target.name}.`,
        didYouMean(
          away[key],
          dates.map((f) => f.name),
        ),
      );
  }
  if (away.from && away.from === away.until)
    return fail(
      `"from" and "until" are the same field, ${away.from}: the time away needs a start and an end.`,
    );
  // Not said: the first two date-and-time fields, in the order the model writes them.
  const rest = dates.map((f) => f.name).filter((n) => n !== away.from && n !== away.until);
  if (!away.from) away.from = rest.shift() ?? "";
  if (!away.until) away.until = rest.shift() ?? "";
  if (!away.from || !away.until)
    return fail(
      `${target.name} needs two date-and-time fields, when the time away starts and when it ends.`,
    );
}

function checkOccupies(ctx: ParseContext, models: ModelIR[], model: ModelIR): undefined {
  const occupies = model.occupies;
  if (!occupies) return;
  const at = ctx.at(`occupies:${model.name}`);
  const where = `"occupies" of "${model.name}"`;
  const fail = (message: string, hint?: string): undefined => {
    ctx.error(at, "invalid-occupies", `${where}: ${message}`, hint);
    delete model.occupies;
  };
  const scheduled = models.filter((m) => m.schedule).map((m) => m.name);
  const resource = referenceTo(model, occupies.resource);
  const target = resource?.type.kind === "relation" ? resource.type.model : undefined;
  if (!resource?.required || target === USER_MODEL)
    return fail(
      `"resource" must be one of ${model.name}'s required references (a field like "barber: Barber!").`,
      didYouMean(
        occupies.resource,
        model.fields.filter((f) => referenceTo(model, f.name) && f.required).map((f) => f.name),
      ),
    );
  if (!scheduled.includes(target ?? ""))
    return fail(
      `${target} has no schedule, so there is no time of its to take.`,
      `Give ${target} one: "schedule: { hours: { mon-fri: "09:00-17:00" } }".`,
    );
  if (!isDateTime(model.fields.find((f) => f.name === occupies.starts)))
    return fail(
      `"starts" must be a date-and-time field of ${model.name}.`,
      didYouMean(
        occupies.starts,
        model.fields.filter(isDateTime).map((f) => f.name),
      ),
    );
  if (!isInt(durationField(models, model, occupies.duration)))
    return fail(
      `"duration" must be a whole-number field of ${model.name}, or of a record it refers to ("service.minutes").`,
    );
  for (const [name, wanted] of Object.entries(occupies.while ?? {}))
    if (!conditionFits(model, name, wanted))
      return fail(
        `"while": "${name}" must be a choice field of ${model.name} with one of its values (or a list of them), or a yes/no field with true or false.`,
      );
  if (!occupies.cancel) return;
  // The owner's Cancel sets the one choice field of `while` to a value outside it.
  const choices = Object.keys(occupies.while ?? {}).filter(
    (n) => model.fields.find((f) => f.name === n)?.type.kind === "choice",
  );
  if (choices.length !== 1)
    return fail(
      choices.length
        ? `a Cancel needs one choice field in "while", but it names ${choices.join(" and ")}.`
        : `a Cancel needs "while" to name a choice field, the one it sets (e.g. while: { status: [requested, confirmed] }).`,
    );
  const field = choices[0] as string;
  const type = model.fields.find((f) => f.name === field)?.type;
  const values = type?.kind === "choice" ? type.values : [];
  const wanted = [occupies.while?.[field]].flat() as string[];
  const outside = values.filter((v) => !wanted.includes(v));
  if (occupies.cancel.to) {
    if (!outside.includes(occupies.cancel.to))
      return fail(
        `"cancelTo" must be a value of ${field} outside "while": ${outside.join(", ") || "there is none"}.`,
      );
  } else if (outside.length === 1) occupies.cancel.to = outside[0] as string;
  else
    return fail(
      outside.length
        ? `say with "cancelTo" which value a Cancel sets: ${outside.join(" or ")}.`
        : `every value of ${field} takes the time, so a Cancel has none to set; add one, like cancelled.`,
    );
  occupies.cancel.field = field;
}

/** The fields an occupies names on its own model, and its duration one reference away. */
function occupiesUses(models: ModelIR[], model: ModelIR, field: string, target: string): boolean {
  const o = model.occupies;
  if (!o) return false;
  const [first, second] = o.duration.split(".");
  if (model.name === target) {
    if ([o.resource, o.starts, first].includes(field) || (o.while && field in o.while)) return true;
  }
  if (second === undefined) return false;
  const ref = referenceTo(model, first ?? "");
  return ref?.type.kind === "relation" && ref.type.model === target && second === field;
}

/** The field as the spec writes it now (after a change): its type, whether required, computed. */
function fieldNow(
  spec: YamlEditor,
  model: string,
  field: string,
): (FieldShorthand & { computed: boolean }) | undefined {
  const value = spec.get(["models", model, "fields", field]);
  const long = value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
  const text = typeof value === "string" ? value : (long as { type?: unknown } | undefined)?.type;
  if (typeof text !== "string") return undefined;
  const read = parseFieldShorthand(text);
  return read.ok ? { ...read.value, computed: Boolean(long && "formula" in long) } : undefined;
}

type Now = FieldShorthand & { computed: boolean };
const dateTime = (f: Now) => f.type.kind === "scalar" && f.type.name === "datetime" && !f.computed;
const wholeNumber = (f: Now) => f.type.kind === "scalar" && f.type.name === "int" && !f.computed;
const refersTo = (target: string, required: boolean) => (f: Now) =>
  f.type.kind === "relation" &&
  !f.type.many &&
  f.type.model === target &&
  (!required || f.required);

/** What a schedule or an occupies needs of a field, if one relies on it. */
function reliedOn(
  models: ModelIR[],
  model: string,
  field: string,
): { who: string; what: string; fits: (f: Now) => boolean } | undefined {
  for (const m of models) {
    const o = m.occupies;
    if (o) {
      const who = `${m.name}'s occupies`;
      const ref = referenceTo(m, o.resource);
      const target = ref?.type.kind === "relation" ? ref.type.model : "";
      const [first = "", second] = o.duration.split(".");
      if (m.name === model && field === o.resource)
        return { who, what: `a required reference to ${target}`, fits: refersTo(target, true) };
      if (m.name === model && field === o.starts)
        return { who, what: "a date and time", fits: dateTime };
      if (m.name === model && field === first) {
        if (second === undefined) return { who, what: "a whole number", fits: wholeNumber };
        const via = referenceTo(m, first);
        const to = via?.type.kind === "relation" ? via.type.model : "";
        return { who, what: `a reference to ${to}`, fits: refersTo(to, false) };
      }
      const via = second === undefined ? undefined : referenceTo(m, first);
      if (via?.type.kind === "relation" && via.type.model === model && field === second)
        return { who, what: "a whole number", fits: wholeNumber };
    }
    const away = m.schedule?.away;
    if (away?.model === model) {
      const who = `The schedule of ${m.name}`;
      if (field === away.resource)
        return { who, what: `a reference to ${m.name}`, fits: refersTo(m.name, false) };
      if (field === away.from || field === away.until)
        return { who, what: "a date and time", fits: dateTime };
    }
  }
  return undefined;
}

/**
 * The schedules and occupies follow a field renamed, refuse a field removed that they name,
 * and follow (or refuse) a choice value renamed (or removed) that `while` or `cancelTo` names.
 */
export function followSchedules(
  spec: YamlEditor,
  effect: Effect,
  models: ModelIR[],
): { refusal: string } | undefined {
  if (effect.kind === "remove-field") {
    for (const m of models) {
      if (occupiesUses(models, m, effect.field, effect.model))
        return {
          refusal: `${m.name}'s occupies names ${effect.model}.${effect.field}; change it first.`,
        };
      const away = m.schedule?.away;
      if (
        away?.model === effect.model &&
        [away.resource, away.from, away.until].includes(effect.field)
      )
        return {
          refusal: `The schedule of ${m.name} reads time away from ${effect.model}.${effect.field}; change it first.`,
        };
    }
    return undefined;
  }
  if (effect.kind === "change-field") {
    // A field the time relies on keeps the kind it needs: a start stays a date and time, a length a
    // whole number, whose time a required reference to the scheduled model.
    const relied = reliedOn(models, effect.model, effect.field);
    if (relied) {
      const now = fieldNow(spec, effect.model, effect.field);
      if (!now || !relied.fits(now))
        return {
          refusal: `${relied.who} needs ${effect.model}.${effect.field} to stay ${relied.what}; change it first.`,
        };
    }
    const m = models.find((x) => x.name === effect.model);
    const o = m?.occupies;
    if (!o) return undefined;
    const path = ["models", effect.model, "occupies"];
    const named = o.while?.[effect.field];
    let wanted = named;
    if (named !== undefined) {
      wanted = followRenamed(spec, [...path, "while", effect.field], named, effect.renamed);
      const lost = lostValues(wanted, effect.choices);
      if (lost.length)
        return {
          refusal: `${effect.model} takes its ${o.resource}'s time while ${effect.field} is ${lost.join(" or ")}; change its occupies first.`,
        };
    }
    if (o.cancel?.field !== effect.field) return undefined;
    if (spec.has([...path, "cancelTo"])) {
      const to = effect.renamed?.[o.cancel.to] || o.cancel.to;
      if (!effect.choices.includes(to))
        return {
          refusal: `${effect.model}'s Cancel sets ${effect.field} to ${o.cancel.to}; change its occupies first.`,
        };
      if (to !== o.cancel.to) spec.set([...path, "cancelTo"], to);
      return undefined;
    }
    // The Cancel's value was the one outside while: there must still be exactly one.
    const holding = [wanted].flat().map(String);
    const outside = effect.choices.filter((v) => !holding.includes(v));
    if (outside.length !== 1)
      return {
        refusal: `${effect.model}'s Cancel sets ${effect.field} to the one value outside "while" (${o.cancel.to}); after this change ${outside.length ? `there are ${outside.length} (${outside.join(", ")})` : "there is none"}. Write cancelTo first.`,
      };
    return undefined;
  }
  if (effect.kind !== "rename-field") return undefined;
  const { from, to } = effect;
  for (const m of models) {
    const o = m.occupies;
    const path = ["models", m.name, "occupies"];
    if (o && m.name === effect.model) {
      if (o.resource === from) spec.set([...path, "resource"], to);
      if (o.starts === from) spec.set([...path, "starts"], to);
      if (o.while && from in o.while) spec.renameKey([...path, "while", from], to);
    }
    if (o && occupiesUses(models, m, from, effect.model)) {
      const [first, second] = o.duration.split(".");
      const next =
        second === undefined
          ? first === from && m.name === effect.model
            ? to
            : o.duration
          : m.name === effect.model && first === from
            ? `${to}.${second}`
            : referenceTo(m, first ?? "", effect.model) && second === from
              ? `${first}.${to}`
              : o.duration;
      if (next !== o.duration) spec.set([...path, "duration"], next);
    }
    // Only keys written out follow; the ones found by shape find the new name by themselves.
    const away = m.schedule?.away;
    const awayPath = ["models", m.name, "schedule", "away"];
    if (away?.model === effect.model)
      for (const key of ["resource", "from", "until"] as const)
        if (away[key] === from && spec.has([...awayPath, key])) spec.set([...awayPath, key], to);
  }
  return undefined;
}
