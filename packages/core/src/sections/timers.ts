import { isScalar, type ParsedNode } from "yaml";
import {
  conditionArgs,
  conditionText,
  followRenamed,
  lostValues,
  readCondition,
} from "../condition.js";
import { checkKeys, type Entry, mapEntries, type ParseContext, readString } from "../context.js";
import type { YamlValue } from "../edit.js";
import {
  type ActionIR,
  type Condition,
  type ModelIR,
  TIMER_EVERY,
  type TimerEvery,
  type TimerIR,
  type TimerScheduleIR,
} from "../ir.js";
import { capitalize, humanize, plural } from "../naming.js";
import { type AnyOperation, type Operation, OperationError, refTo } from "../operation.js";
import type { SpecSection } from "../section.js";
import { didYouMean } from "../suggest.js";
import { FIELD_NAME_PATTERN, nameRule } from "./names.js";

/**
 * Timers (docs/design/timed-actions.md): an event the app raises itself at a time, on a clock or
 * relative to a date-time of a record, running an action over the records the time has come for.
 * Delivery is `outgoing`'s, whose `when` names a timer as it names an action.
 */

/** `1 day before session.startsAt`, `publishAt`: an offset and a field path. */
const RECORD_AT =
  /^(?:(\d+)\s+(minute|minutes|hour|hours|day|days)\s+(before|after)\s+)?([a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)?)$/;
const CLOCK_AT = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** One cron field: *, a number, a range, any of those with /step, and lists of them. */
const CRON_FIELD = /^(\*|\d+(?:-\d+)?)(?:\/\d+)?(?:,(\*|\d+(?:-\d+)?)(?:\/\d+)?)*$/;
const CRON_RANGES: [string, number, number][] = [
  ["minute", 0, 59],
  ["hour", 0, 23],
  ["day of the month", 1, 31],
  ["month", 1, 12],
  ["weekday", 0, 7],
];

const isDate = (f: ModelIR["fields"][number]) =>
  f.type.kind === "scalar" && (f.type.name === "date" || f.type.name === "datetime");

/** The field a record timer's path names, or why it cannot: a stored date of `on`, or one reference away. */
function resolvePath(
  path: string[],
  model: ModelIR,
  models: ModelIR[],
): { ok: true } | { ok: false; problem: string; hint?: string } {
  const [first = "", second] = path;
  const field = model.fields.find((f) => f.name === first);
  if (!field)
    return {
      ok: false,
      problem: `${model.name} has no field named "${first}".`,
      hint: didYouMean(
        first,
        model.fields.filter((f) => isDate(f) || f.type.kind === "relation").map((f) => f.name),
      ),
    };
  if (second === undefined) {
    if (!isDate(field))
      return { ok: false, problem: `${model.name}.${first} is not a date or a date-time.` };
    if (field.formula)
      return {
        ok: false,
        problem: `${model.name}.${first} is computed; a timer needs a stored date.`,
      };
    return { ok: true };
  }
  if (field.type.kind !== "relation" || field.type.many)
    return {
      ok: false,
      problem: `${model.name}.${first} does not refer to one record, so "${first}.${second}" names nothing.`,
    };
  const other = models.find((m) => m.name === (field.type as { model: string }).model);
  const target = other?.fields.find((f) => f.name === second);
  if (!other || !target)
    return {
      ok: false,
      problem: `${other?.name ?? first} has no field named "${second}".`,
      hint: other
        ? didYouMean(
            second,
            other.fields.filter(isDate).map((f) => f.name),
          )
        : undefined,
    };
  if (!isDate(target) || target.formula)
    return {
      ok: false,
      problem: `${other.name}.${second} is not a stored date or date-time.`,
    };
  return { ok: true };
}

/** Checks a cron expression field by field; a problem in words, or nothing. */
export function cronProblem(cron: string): string | undefined {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5)
    return `a cron expression has five fields (minute, hour, day of the month, month, weekday); "${cron}" has ${fields.length}.`;
  for (const [i, text] of fields.entries()) {
    const [name = "", min = 0, max = 0] = CRON_RANGES[i] ?? [];
    if (/[A-Za-z]/.test(text))
      return `the ${name} field "${text}" names a day or a month; cron takes numbers, and "every" takes the words.`;
    if (!CRON_FIELD.test(text))
      return `the ${name} field "${text}" is not *, a number, a range (1-5), a step (*/15) or a list of them.`;
    for (const n of text.match(/\d+/g) ?? []) {
      const value = Number(n);
      if (text.includes(`/${n}`) && text.indexOf(`/${n}`) >= 0 && !text.includes(`${n}-`)) {
        // A step: at least 1.
        if (value < 1) return `the ${name} field "${text}" steps by 0.`;
        continue;
      }
      if (value < min || value > max)
        return `the ${name} field "${text}" is outside ${min}–${max}.`;
    }
  }
  return undefined;
}

function readTimer(
  ctx: ParseContext,
  name: string,
  keyNode: ParsedNode,
  node: ParsedNode | null,
  models: ModelIR[],
  actions: ActionIR[],
): TimerIR | undefined {
  const where = `timer "${name}"`;
  const known = checkKeys(ctx, mapEntries(ctx, node, where) ?? [], where, {
    allowed: ["on", "at", "every", "cron", "where", "run"],
  });
  const byKey = new Map<string, Entry>(known.map((e) => [e.key, e]));
  const text = (key: string) => {
    const entry = byKey.get(key);
    return entry ? readString(ctx, entry.value, `"${key}" of ${where}`) : undefined;
  };
  const at = (key: string) => byKey.get(key)?.value ?? keyNode;
  const on = text("on");
  const model = on === undefined ? undefined : models.find((m) => m.name === on);
  if (on !== undefined && !model) {
    ctx.error(
      at("on"),
      "unknown-model",
      `There is no model named "${on}".`,
      didYouMean(
        on,
        models.map((m) => m.name),
      ),
    );
    return undefined;
  }
  if (model) ctx.reference("model", model.name, at("on"));
  // Exactly one form: every with a clock time, cron, or at with a date of the record.
  const forms = ["every", "cron"].filter((k) => byKey.has(k));
  if (!byKey.has("every") && byKey.has("at")) forms.push("at");
  if (forms.length !== 1) {
    ctx.error(
      keyNode,
      "invalid-timer",
      `${capitalize(where)} is on a clock ("every: day" with "at: 08:00", or "cron"), or at a date of its records ("on: Booking" with "at: 1 day before session.startsAt"): one of the three${forms.length ? `, not ${forms.join(" and ")}` : ""}.`,
    );
    return undefined;
  }
  let schedule: TimerScheduleIR | undefined;
  if (forms[0] === "cron") {
    const cron = text("cron");
    if (cron === undefined) return undefined;
    const problem = cronProblem(cron);
    if (problem) {
      ctx.error(at("cron"), "invalid-timer", `${capitalize(where)}: ${problem}`);
      return undefined;
    }
    if (byKey.has("at"))
      ctx.error(
        at("at"),
        "invalid-key",
        `${capitalize(where)} has "cron", which says the time; "at" goes with "every".`,
      );
    schedule = { kind: "cron", cron: cron.trim().split(/\s+/).join(" ") };
  } else if (forms[0] === "every") {
    const every = text("every");
    const clock = text("at");
    if (every === undefined) return undefined;
    if (!(TIMER_EVERY as readonly string[]).includes(every)) {
      ctx.error(
        at("every"),
        "invalid-timer",
        `${capitalize(where)}: "every" is ${TIMER_EVERY.slice(0, -1).join(", ")} or ${TIMER_EVERY.at(-1)}; "${every}" is none of them.`,
        didYouMean(every, [...TIMER_EVERY]),
      );
      return undefined;
    }
    if (clock === undefined) {
      if (!byKey.has("at"))
        ctx.error(
          keyNode,
          "missing-key",
          `${capitalize(where)} runs every ${every}, so it needs "at": a clock time like "08:00".`,
        );
      return undefined;
    }
    if (!CLOCK_AT.test(clock)) {
      ctx.error(
        at("at"),
        "invalid-timer",
        `${capitalize(where)}: "at" with "every" is a clock time like "08:00" (the app's time zone); "${clock}" is not.`,
      );
      return undefined;
    }
    schedule = { kind: "every", every: every as TimerEvery, at: clock };
  } else {
    const spec = text("at");
    if (spec === undefined) return undefined;
    if (!model) {
      ctx.error(
        keyNode,
        "missing-key",
        `${capitalize(where)} is at a date of a record, so it needs "on": the model whose records it runs for.`,
      );
      return undefined;
    }
    const m = RECORD_AT.exec(spec.trim());
    if (!m) {
      ctx.error(
        at("at"),
        "invalid-timer",
        `${capitalize(where)}: "at" is a date field of ${model.name} (or one reference away, like session.startsAt), alone or after an offset: "<number> minutes|hours|days before|after <field>"; "${spec}" is neither.`,
      );
      return undefined;
    }
    const [, amount, unit, direction, pathText = ""] = m;
    const path = pathText.split(".");
    const resolved = resolvePath(path, model, models);
    if (!resolved.ok) {
      ctx.error(
        at("at"),
        "invalid-timer",
        `${capitalize(where)}: ${resolved.problem}`,
        resolved.hint,
      );
      return undefined;
    }
    if (amount !== undefined && Number(amount) < 1) {
      ctx.error(
        at("at"),
        "invalid-timer",
        `${capitalize(where)}: the offset is a whole number above 0.`,
      );
      return undefined;
    }
    schedule = {
      kind: "record",
      path,
      ...(amount !== undefined && unit && direction
        ? {
            offset: {
              amount: Number(amount),
              unit: unit.replace(/s$/, "") as "minute" | "hour" | "day",
              direction: direction as "before" | "after",
            },
          }
        : {}),
    };
  }
  const timer: TimerIR = { name, schedule, ...(model ? { on: model.name } : {}) };
  const whereEntry = byKey.get("where");
  if (whereEntry) {
    if (!model)
      ctx.error(
        whereEntry.keyNode,
        "invalid-key",
        `${capitalize(where)} has no "on", so there are no records for "where" to choose among.`,
      );
    else {
      const condition = readCondition(ctx, whereEntry.value, `"where" of ${where}`, model);
      if (condition && Object.keys(condition).length) timer.where = condition;
    }
  }
  const run = text("run");
  if (run !== undefined) {
    const action = actions.find((a) => a.name === run);
    if (!action) {
      ctx.error(
        at("run"),
        "unknown-action",
        `There is no action named "${run}".`,
        didYouMean(
          run,
          actions.map((a) => a.name),
        ),
      );
      return undefined;
    }
    ctx.reference("action", action.name, at("run"));
    if (!action.custom && action.merge) {
      ctx.error(
        at("run"),
        "invalid-timer",
        `${capitalize(where)} runs "${run}", a merge: a person picks the two records and which stays, so no timer runs it.`,
      );
      return undefined;
    }
    // A timer runs as the app, for nobody in particular: a condition on the person signed in
    // (ME(), not ME()) would hold for everyone or no one.
    if (
      !action.custom &&
      Object.values(action.when ?? {}).some((w) => w === "ME()" || w === "not ME()")
    ) {
      ctx.error(
        at("run"),
        "invalid-timer",
        `${capitalize(where)} runs "${run}", whose condition names the person signed in (ME()); a timer runs as the app, for nobody in particular. Run an action whose condition names no person.`,
      );
      return undefined;
    }
    if (action.custom) {
      if (model) {
        ctx.error(
          at("run"),
          "invalid-timer",
          `${capitalize(where)} runs the custom action "${run}", which runs once with no record, so it takes no "on"; a standard action of ${model.name} runs for each record.`,
        );
        return undefined;
      }
    } else if (!model) {
      ctx.error(
        at("run"),
        "invalid-timer",
        `${capitalize(where)} runs "${run}", a standard action of ${action.on}: give it "on: ${action.on}".`,
      );
      return undefined;
    } else if (action.on !== model.name) {
      ctx.error(
        at("run"),
        "invalid-timer",
        `${capitalize(where)} runs "${run}", which is an action of ${action.on}, not of ${model.name}.`,
      );
      return undefined;
    }
    timer.run = run;
  } else if (!model) {
    ctx.error(
      keyNode,
      "invalid-timer",
      `${capitalize(where)} does nothing: give it "on" (records whose event it raises, for outgoing) or "run" (an action).`,
    );
    return undefined;
  }
  return timer;
}

const ORDINALS = ["", "1st", "2nd", "3rd"];
const ordinal = (n: number) =>
  ORDINALS[n] ??
  (n % 10 === 1 && n !== 11
    ? `${n}st`
    : n % 10 === 2 && n !== 12
      ? `${n}nd`
      : n % 10 === 3 && n !== 13
        ? `${n}rd`
        : `${n}th`);
const MONTHS = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** A cron expression in words where it is plain; the expression itself otherwise. */
export function cronText(cron: string): string {
  const [minute = "", hour = "", dom = "", month = "", dow = ""] = cron.split(" ");
  const plain = /^\d+$/;
  if (
    plain.test(minute) &&
    plain.test(hour) &&
    (plain.test(dom) || dom === "*") &&
    (plain.test(month) || month === "*") &&
    (plain.test(dow) || dow === "*")
  ) {
    const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
    const day = plain.test(dom) ? ` on the ${ordinal(Number(dom))}` : "";
    const when = plain.test(month)
      ? ` of ${MONTHS[Number(month)]}`
      : plain.test(dom)
        ? " of every month"
        : "";
    const weekday = plain.test(dow) ? ` on ${WEEKDAYS[Number(dow)]}s` : "";
    return `at ${time}${day}${when}${weekday}${!day && !weekday ? " every day" : ""}`;
  }
  return `on the schedule "${cron}"`;
}

const EVERY_WORDS: Record<TimerEvery, string> = {
  day: "every day",
  weekday: "every weekday",
  week: "every week, on its first day",
  month: "every month, on its first day",
  monday: "every Monday",
  tuesday: "every Tuesday",
  wednesday: "every Wednesday",
  thursday: "every Thursday",
  friday: "every Friday",
  saturday: "every Saturday",
  sunday: "every Sunday",
};

/**
 * A timer in one sentence: "A day before a booking's session's starts at, where status is
 * confirmed: runs “Remind”." The model's word comes from `label` when the summary has the
 * content file's labels.
 */
/** "a session", "an invoice": a "u" that sounds like "you" takes "a". */
const article = (word: string) =>
  `${/^[aeiou]/i.test(word) && !/^u(ni|s[eu])/i.test(word) ? "an" : "a"} ${word}`;

export function timerText(t: TimerIR, label?: (model: string) => string): string {
  const one = (label ?? ((m: string) => humanize(m).toLowerCase()))(t.on ?? "");
  const many = t.on ? plural(one) : "";
  const s = t.schedule;
  let when: string;
  if (s.kind === "record") {
    const field = s.path.map((p) => humanize(p).toLowerCase()).join("'s ");
    if (!s.offset) when = `When ${article(one)}'s ${field} comes`;
    else {
      const { amount, unit, direction } = s.offset;
      const n = amount === 1 ? (unit === "hour" ? "An" : "A") : String(amount);
      when = `${n} ${unit}${amount === 1 ? "" : "s"} ${direction} ${article(one)}'s ${field}`;
    }
  } else if (s.kind === "every") {
    when = `${capitalize(EVERY_WORDS[s.every])} at ${s.at}${t.on ? `, for every ${one}` : ""}`;
  } else {
    when = `${capitalize(cronText(s.cron))}${t.on ? `, for every ${one}` : ""}`;
  }
  const only = t.where ? `, where ${conditionText(t.where)}` : "";
  const does = t.run
    ? `runs “${humanize(t.run)}”${t.on && s.kind !== "record" ? ` on each of the ${many}` : ""}`
    : "raises its event, for outgoing to tell someone";
  return `${when}${only}: ${does}.`;
}

/** The YAML a timer's arguments write. */
function timerValue(args: {
  on?: string;
  at?: string;
  every?: string;
  cron?: string;
  where?: Record<string, string | boolean | string[]>;
  run?: string;
}): Record<string, YamlValue> {
  const condition =
    args.where && Object.keys(args.where).length ? conditionArgs(args.where) : undefined;
  return {
    ...(args.on ? { on: args.on } : {}),
    ...(args.every ? { every: args.every } : {}),
    ...(args.at ? { at: args.at } : {}),
    ...(args.cron ? { cron: args.cron } : {}),
    ...(condition ? { where: condition } : {}),
    ...(args.run ? { run: args.run } : {}),
  };
}

const TIMER_ARGS = {
  on: refTo(
    { ref: "model", label: "Records" },
    {
      description:
        "The model whose records it runs for; a clock timer running a custom action has none.",
    },
  ),
  at: {
    type: "string",
    description:
      'With "on": a date field of the records, alone or after an offset ("1 day before session.startsAt"); with "every": a clock time ("08:00").',
  },
  every: {
    type: "string",
    enum: [...TIMER_EVERY],
    description: "A clock timer: day, weekday, week, month or a weekday's name, with at.",
  },
  cron: {
    type: "string",
    description: 'A five-field cron expression ("0 6 25 * *"), for what every cannot say.',
  },
  where: {
    type: "object",
    description: 'Only records with these values, e.g. { "status": "confirmed" }.',
  },
  run: {
    type: "string",
    description:
      "The action it runs: a standard action of the records' model, or a custom one (once).",
  },
} as const;

type TimerArgs = {
  name: string;
  on?: string;
  at?: string;
  every?: string;
  cron?: string;
  where?: Record<string, string | boolean | string[]>;
  run?: string;
};

const addTimer: Operation<TimerArgs> = {
  name: "addTimer",
  summary:
    "Add a timer: an event the app raises at a time, on a clock (every day at 08:00, or cron) or relative to a date of a record (1 day before session.startsAt), running an action over the records it is due for; outgoing may listen to it.",
  schema: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: { type: "string", description: "The timer's name, e.g. remind." },
      ...TIMER_ARGS,
    },
  },
  positional: ["name"],
  describe: ({ name }) => `Add the timer ${name}`,
  destructive: () => false,
  apply({ spec }, { name, ...args }, ir) {
    if (!FIELD_NAME_PATTERN.test(name)) throw new OperationError(nameRule("timer", name));
    if (ir.timers.some((t) => t.name === name))
      throw new OperationError(`There is already a timer named "${name}".`);
    const value = timerValue(args);
    if (!("every" in value) && !("cron" in value) && !("at" in value))
      throw new OperationError(
        'Say when: "every" with "at", "cron", or "at" a date of the records ("on").',
      );
    if (spec.has(["timers"])) spec.add(["timers"], name, value);
    else spec.add([], "timers", { [name]: value });
    return [];
  },
};

const setTimer: Operation<TimerArgs> = {
  name: "setTimer",
  summary:
    'Change a timer: its records, time, condition or action. "none" takes a key away (where, run, on); a new time form replaces the old.',
  schema: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: refTo({ ref: "timer", label: "Timer" }),
      ...TIMER_ARGS,
    },
  },
  positional: ["name"],
  describe: ({ name }) => `Change the timer ${name}`,
  destructive: () => false,
  apply({ spec }, { name, ...args }, ir) {
    const timer = ir.timers.find((t) => t.name === name);
    if (!timer) throw new OperationError(`There is no timer named "${name}".`);
    const path = ["timers", name];
    const given = Object.entries(args).filter(([, v]) => v !== undefined);
    if (!given.length)
      throw new OperationError("Say what to change: on, at, every, cron, where or run.");
    // A new time form takes the old one's keys away.
    if (args.cron || args.every)
      for (const k of ["at", "every", "cron"])
        if (spec.has([...path, k])) spec.remove([...path, k]);
        else if (args.at && timer.schedule.kind === "cron" && spec.has([...path, "cron"]))
          spec.remove([...path, "cron"]);
    for (const [key, raw] of given) {
      const value = key === "where" ? (raw as TimerArgs["where"]) : (raw as string);
      const none =
        value === "none" ||
        (key === "where" && typeof value === "object" && !Object.keys(value).length);
      if (none) {
        if (spec.has([...path, key])) spec.remove([...path, key]);
        continue;
      }
      const written =
        key === "where"
          ? conditionArgs(value as Record<string, string | boolean | string[]>)
          : value;
      if (spec.has([...path, key])) spec.set([...path, key], written as YamlValue);
      else spec.add(path, key, written as YamlValue);
    }
    return [];
  },
};

const removeTimer: Operation<{ name: string }> = {
  name: "removeTimer",
  summary: "Remove a timer. An outgoing entry that listens to it is removed first.",
  schema: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: { name: refTo({ ref: "timer", label: "Timer" }) },
  },
  positional: ["name"],
  describe: ({ name }) => `Remove the timer ${name}`,
  destructive: () => true,
  apply({ spec }, { name }, ir) {
    if (!ir.timers.some((t) => t.name === name))
      throw new OperationError(`There is no timer named "${name}".`);
    const listening = ir.outgoing.filter((o) => "timer" in o.when && o.when.timer === name);
    if (listening.length)
      throw new OperationError(
        `${listening.map((o) => `"${o.name}"`).join(" and ")} under outgoing ${listening.length > 1 ? "listen" : "listens"} to the timer "${name}"; remove ${listening.length > 1 ? "them" : "it"} first.`,
      );
    spec.removeAndPrune(["timers", name], 0);
    return [];
  },
};

export const timerOperations: AnyOperation[] = [addTimer, setTimer, removeTimer];

/** A record timer's `at`, written back after a field's rename. */
function atText(s: Extract<TimerScheduleIR, { kind: "record" }>): string {
  const field = s.path.join(".");
  if (!s.offset) return field;
  const { amount, unit, direction } = s.offset;
  return `${amount} ${unit}${amount === 1 ? "" : "s"} ${direction} ${field}`;
}

export const timersSection: SpecSection<"timers"> = {
  key: "timers",
  required: false,
  operations: timerOperations,
  schema: {
    type: "object",
    description:
      "What the app does on a clock: an event raised at a time, on a schedule or relative to a date of a record, running an action over the records it is due for; outgoing may listen to it.",
    propertyNames: { pattern: FIELD_NAME_PATTERN.source },
    additionalProperties: {
      type: "object",
      additionalProperties: false,
      properties: {
        on: { type: "string", description: "The model whose records the timer runs for." },
        at: {
          type: "string",
          description:
            'With "on": a date field of the records, alone or after an offset ("1 day before session.startsAt", "7 days after dueOn"); with "every": a clock time ("08:00") in the app\'s time zone.',
        },
        every: {
          enum: [...TIMER_EVERY],
          description:
            "A clock timer: day, weekday, week, month (the first day of theirs) or a weekday's name; with at.",
        },
        cron: {
          type: "string",
          description:
            "A five-field cron expression (minute, hour, day of the month, month, weekday), for what every cannot say; the app's time zone.",
        },
        where: {
          type: "object",
          description: "Only records with these values, e.g. { status: confirmed }.",
        },
        run: {
          type: "string",
          description:
            "The action it runs: a standard action of the records' model (for each record), or a custom action (once).",
        },
      },
    },
  },
  parse(ctx, node, parsed) {
    if (node === undefined) return [];
    const models = parsed.models ?? [];
    const actions = parsed.actions ?? [];
    const timers: TimerIR[] = [];
    for (const { key, keyNode, value } of mapEntries(ctx, node, `"timers"`) ?? []) {
      if (!FIELD_NAME_PATTERN.test(key)) {
        ctx.error(keyNode, "invalid-name", nameRule("timer", key));
        continue;
      }
      const timer = readTimer(ctx, key, keyNode, value, models, actions);
      if (timer) timers.push(timer);
    }
    return timers;
  },
  follow(spec, effect, ir) {
    for (const t of ir.timers) {
      const at = ["timers", t.name];
      if (effect.kind === "remove-action" && t.run === effect.action)
        return {
          refusal: `The timer "${t.name}" runs the action "${effect.action}"; remove or change the timer first.`,
        };
      if (
        effect.kind === "change-field" &&
        t.on === effect.model &&
        t.where?.[effect.field] !== undefined
      ) {
        const now = followRenamed(
          spec,
          [...at, "where", effect.field],
          t.where[effect.field] as Condition[string],
          effect.renamed ?? {},
        );
        if (lostValues(now, effect.choices).length)
          return {
            refusal: `The timer "${t.name}" runs only where ${effect.field} has a value it no longer has; change its "where" first.`,
          };
      }
      if (effect.kind !== "rename-field" && effect.kind !== "remove-field") continue;
      const from = effect.kind === "rename-field" ? effect.from : effect.field;
      // The date the timer is at: the record's own field, or the referenced record's.
      const s = t.schedule;
      let names = false;
      if (s.kind === "record" && t.on) {
        const ref = ir.models
          .find((m) => m.name === t.on)
          ?.fields.find((f) => f.name === s.path[0]);
        const refModel = ref?.type.kind === "relation" ? ref.type.model : undefined;
        const own = t.on === effect.model && s.path[0] === from;
        const far = s.path.length === 2 && refModel === effect.model && s.path[1] === from;
        names = own || far;
        if (names && effect.kind === "rename-field") {
          const path = own ? [effect.to, ...s.path.slice(1)] : [s.path[0] as string, effect.to];
          spec.set([...at, "at"], atText({ ...s, path }));
        }
      }
      const inWhere = t.on === effect.model && t.where?.[from] !== undefined;
      if (effect.kind === "remove-field" && (names || inWhere))
        return {
          refusal: `The timer "${t.name}" uses ${effect.model}.${from}; change or remove the timer first.`,
        };
      if (effect.kind === "rename-field" && inWhere)
        spec.renameKey([...at, "where", from], effect.to);
    }
    return undefined;
  },
};
