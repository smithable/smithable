// Part of the TanStack adapter's generator: the timers' tick (docs/design/timed-actions.md §5).
import {
  type ActionIR,
  type Condition,
  camel,
  type FieldIR,
  kebab,
  type ModelIR,
  type SpecIR,
  type TimerIR,
} from "@smithable/core";
import { actionNames } from "./actions.js";
import {
  dataKey,
  HEADER,
  modelNamed,
  names,
  SCHEMA_IMPORT,
  type Texts,
  tableRef,
} from "./shared.js";

/**
 * What each timer ran, once: a row is taken before acting, so two processes or a restart never
 * run the same thing twice. `record` is 0 for a clock timer's single run; `due` the time as
 * written (a record's instant plus its offset, or a clock's local "YYYY-MM-DDTHH:MM"). A timer's
 * first sighting is the row with due "seen", and the last tick is the row of timer "" (§5).
 */
export const TIMER_RUNS_TABLE = `export const timerRuns = sqliteTable(
  "timer_runs",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    timer: text().notNull(),
    record: integer().notNull(),
    due: text().notNull(),
    ranAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    /** running, done, skipped, gone, failed, given up; seen for a timer's first sighting. */
    outcome: text().notNull(),
    tries: integer().notNull().default(0),
  },
  (t) => [uniqueIndex("timer_runs_once").on(t.timer, t.record, t.due)],
);`;

const UNIT_MS = { minute: 60_000, hour: 3_600_000, day: 86_400_000 } as const;

/** The module of the timers: the minute's tick, and one timer run as if its time had come. */
export function timersModule(ir: SpecIR, t: Texts): string {
  const imports = new Map<string, Set<string>>();
  const use = (module: string, ...what: string[]) => {
    const set = imports.get(module) ?? new Set<string>();
    for (const w of what) set.add(w);
    imports.set(module, set);
  };
  const drizzle = new Set(["and", "eq", "lt", "or", "sql"]);
  const action = (name: string | undefined) => ir.actions.find((a) => a.name === name);
  let events = false;
  let zoned = false;
  const fns = ir.timers.map((timer) => {
    const model = timer.on ? modelNamed(ir, timer.on) : undefined;
    const run = action(timer.run);
    // An outgoing entry listens: the tick tells it, for each record.
    const told = ir.outgoing.some((o) => "timer" in o.when && o.when.timer === timer.name);
    if (told) events = true;
    const forRecord = model ? recordRun(timer, model, run, told, t, use) : "";
    if (timer.schedule.kind === "record") {
      const m = model as ModelIR;
      const { query, instant } = recordQuery(timer, m, ir, drizzle);
      if (instant.includes("instantOf")) zoned = true;
      const offset = timer.schedule.offset;
      const shift = offset
        ? ` ${offset.direction === "before" ? "-" : "+"} ${offset.amount * UNIT_MS[offset.unit]}`
        : "";
      return `
/** ${timer.name}: for each record whose time has come, in the window since \`from\`. */
const ${camel(timer.name)}Timer: RecordTimer = async (now, from, late) => {
  let missed = 0;
  for (const row of ${query}) {
    if (row.at == null) continue;
    const due = ${instant}${shift};
    if (due > now.getTime()) continue;
    const run = { timer: ${JSON.stringify(timer.name)}, record: row.id, due: new Date(due).toISOString() };
    if (due <= from) {
      if (due > late && !ran(run)) missed++;
      continue;
    }
    await attempt(run, ${JSON.stringify(m.name)}, () => ${camel(timer.name)}Record(row.id));
  }
  return missed;
};
${forRecord}`;
    }
    const clock =
      timer.schedule.kind === "every"
        ? { every: timer.schedule.every, at: timer.schedule.at }
        : { cron: timer.schedule.cron };
    if (model) {
      const n = names(model, t);
      use(n.module.replace("#/generated/", "./").concat(".server"), n.data);
      return `
/** ${timer.name}: on its clock, for every record that fits. */
const ${camel(timer.name)}Timer: ClockTimer = {
  clock: ${JSON.stringify(clock)},
  async run(due) {
    for (const row of await ${n.data}.list(as(${JSON.stringify(timer.name)}))) {${timer.where ? `\n      if (!(${fitsCode(timer.where, "row")})) continue;` : ""}
      await attempt({ timer: ${JSON.stringify(timer.name)}, record: row.id, due }, ${JSON.stringify(model.name)}, () => ${camel(timer.name)}Record(row.id));
    }
  },
};
${forRecord}`;
    }
    // A custom action, run once.
    const a = run as ActionIR;
    const names_ = actionNames(a);
    use(names_.custom, a.name);
    use(names_.module, `type ${names_.inputType}`);
    return `
/** ${timer.name}: on its clock, runs "${a.name}" once. */
const ${camel(timer.name)}Timer: ClockTimer = {
  clock: ${JSON.stringify(clock)},
  async run(due) {
    await attempt({ timer: ${JSON.stringify(timer.name)}, record: 0, due }, undefined, async () => {
      await ${a.name}({} as ${names_.inputType}, as(${JSON.stringify(timer.name)}));
      return "done";
    });
  },
};
`;
  });
  if (events) use("./outgoing.server", "outgoing");
  use("#/kit/zoned", "wallTime", ...(zoned ? ["instantOf"] : []));
  use("#/kit/clock", "latestDue", "type Clock");
  use("./app", "app");
  const record = ir.timers.filter((x) => x.schedule.kind === "record");
  const clock = ir.timers.filter((x) => x.schedule.kind !== "record");
  const lines = [...imports]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([module, what]) => `import { ${[...what].sort().join(", ")} } from "${module}";`);
  return `${HEADER}import { ${[...drizzle].sort().join(", ")} } from "drizzle-orm";
import { db } from "#/db";
${SCHEMA_IMPORT}
import type { Viewer } from "#/kit/access";
import { audit } from "#/kit/audit.server";
import { log } from "#/kit/log.server";
${lines.join("\n")}

const DAY = 24 * 60 * 60 * 1000;
/** A run that fails is tried again on the next ticks, this many times in all. */
const TRIES = 3;
/** A run still "running" after this long was left by a process that stopped. */
const STALE = 10 * 60 * 1000;

/** The app itself, as a timer runs: no role's grants apply (docs/design/timed-actions.md §2). */
const as = (timer: string): Viewer => ({ id: \`timer:\${timer}\`, name: "", email: "", role: "", system: true });

interface Due {
  timer: string;
  record: number;
  due: string;
}
/** A record timer: runs what is due after \`from\`; counts what fell due before it and after \`late\` without running. */
type RecordTimer = (now: Date, from: number, late: number) => Promise<number>;
/** A clock timer: its clock, and its run for one due time. */
type ClockTimer = { clock: Clock; run: (due: string) => Promise<void> };

const runs = schema.timerRuns;
const at = (run: Due) => and(eq(runs.timer, run.timer), eq(runs.record, run.record), eq(runs.due, run.due));
${record.length ? "const ran = (run: Due) => db.select({ id: runs.id }).from(runs).where(at(run)).get() !== undefined;\n" : ""}
/**
 * Takes a run, by one tick only: a new one, a failed one to try again, or one left running by a
 * process that stopped (counted as a failed try). False when it is done, skipped, given up, or
 * running elsewhere.
 */
function take(run: Due): boolean {
  if (db.insert(runs).values({ ...run, outcome: "running" }).onConflictDoNothing().run().changes === 1) return true;
  const stale = new Date(Date.now() - STALE);
  return (
    db
      .update(runs)
      .set({ outcome: "running", ranAt: new Date(), tries: sql\`\${runs.tries} + case when \${runs.outcome} = 'running' then 1 else 0 end\` })
      .where(and(at(run), lt(runs.tries, TRIES), or(eq(runs.outcome, "failed"), and(eq(runs.outcome, "running"), lt(runs.ranAt, stale)))))
      .run().changes === 1
  );
}

/** Runs one due thing once; a failure is tried again next tick, then given up with a line in Activity. */
async function attempt(run: Due, model: string | undefined, work: () => Promise<string>) {
  if (!take(run)) return;
  try {
    const outcome = await work();
    db.update(runs).set({ outcome, ranAt: new Date() }).where(at(run)).run();
  } catch (error) {
    const tries = (db.select({ tries: runs.tries }).from(runs).where(at(run)).get()?.tries ?? 0) + 1;
    const given = tries >= TRIES;
    db.update(runs).set({ outcome: given ? "given up" : "failed", tries, ranAt: new Date() }).where(at(run)).run();
    log.error("A timer's run failed", { ...run, tries, error });
    if (given)
      audit(db, as(run.timer), {
        action: "timer given up",
        model,
        record: run.record || undefined,
        details: { error: error instanceof Error ? error.message : String(error) },
      });
  }
}

/** When a timer was first seen, written then: a new timer never runs for a time before it. */
function seen(timer: string, now: Date): number {
  const row = db.select({ ranAt: runs.ranAt }).from(runs).where(and(eq(runs.timer, timer), eq(runs.record, 0), eq(runs.due, "seen"))).get();
  if (row) return row.ranAt.getTime();
  db.insert(runs).values({ timer, record: 0, due: "seen", outcome: "seen", ranAt: now }).onConflictDoNothing().run();
  return now.getTime();
}
${fns.join("")}
const RECORD_TIMERS: Record<string, RecordTimer> = {${record.map((x) => `\n  ${JSON.stringify(x.name)}: ${camel(x.name)}Timer,`).join("")}
};
const CLOCK_TIMERS: Record<string, ClockTimer> = {${clock.map((x) => `\n  ${JSON.stringify(x.name)}: ${camel(x.name)}Timer,`).join("")}
};

/** The last tick, kept as the row of timer "": a server down for a while catches up from it. */
const LAST = { timer: "", record: 0, due: "tick" };

/** One tick: every timer, what has come due since the last. */
export async function tick(now = new Date()): Promise<void> {
  const last = db.select({ ranAt: runs.ranAt }).from(runs).where(at(LAST)).get()?.ranAt.getTime() ?? now.getTime();
  for (const [name, timer] of Object.entries(RECORD_TIMERS)) {
    try {
      const first = seen(name, now);
      // Due within the last day runs late; older is skipped, said once per tick.
      const missed = await timer(now, Math.max(first, now.getTime() - DAY), Math.max(first, last - DAY));
      if (missed) audit(db, as(name), { action: "timer skipped", details: { late: missed } });
    } catch (error) {
      log.error("A timer could not run", { timer: name, error });
    }
  }
  for (const [name, timer] of Object.entries(CLOCK_TIMERS)) {
    try {
      const since = Math.max(seen(name, now), last);
      const due = latestDue(timer.clock, new Date(since), now, app.timeZone);
      if (due) await timer.run(due);
    } catch (error) {
      log.error("A timer could not run", { timer: name, error });
    }
  }
  db.insert(runs).values({ ...LAST, outcome: "done", ranAt: now }).onConflictDoUpdate({ target: [runs.timer, runs.record, runs.due], set: { ranAt: now } }).run();
}

/**
 * Runs one timer as if its time had come (\`smithable timers run\`): a record timer for what fell
 * due in the day before \`now\`, a clock timer once, keyed by \`now\`'s minute.
 */
export async function runTimer(name: string, now = new Date()): Promise<void> {
  const record = RECORD_TIMERS[name];
  if (record) {
    await record(now, now.getTime() - DAY, now.getTime() - DAY);
    return;
  }
  const clock = CLOCK_TIMERS[name];
  if (!clock) throw new Error(\`There is no timer \${name}.\`);
  await clock.run(wallTime(now, app.timeZone));
}

// Every minute in production, from a second past the minute.
if (import.meta.env.SSR && import.meta.env.PROD) {
  const next = () =>
    setTimeout(() => void tick().catch((error) => log.error("The timers' tick failed", { error })).finally(next), 60_000 - (Date.now() % 60_000) + 1000).unref();
  next();
}
`;
}

/** The records a record timer reads: their id and the date-time it counts from, as rows. */
function recordQuery(
  timer: TimerIR,
  model: ModelIR,
  ir: SpecIR,
  drizzle: Set<string>,
): { query: string; instant: string } {
  const schedule = timer.schedule as Extract<TimerIR["schedule"], { kind: "record" }>;
  const table = tableRef(model);
  const [first, second] = schedule.path;
  const ref = second ? (model.fields.find((f) => f.name === first) as FieldIR) : undefined;
  const target = ref?.type.kind === "relation" ? modelNamed(ir, ref.type.model) : model;
  const field = target.fields.find((f) => f.name === (second ?? first)) as FieldIR;
  const targetTable = tableRef(target);
  const conditions = [
    ...(model.trash ? [`isNull(${table}.deletedAt)`] : []),
    ...(target !== model && target.trash ? [`isNull(${targetTable}.deletedAt)`] : []),
    ...conditionCode(timer.where, model, table, drizzle),
  ];
  if (conditions.some((c) => c.startsWith("isNull"))) drizzle.add("isNull");
  const join = ref
    ? `.innerJoin(${targetTable}, eq(${table}.${dataKey(ref)}, ${targetTable}.id))`
    : "";
  const where = conditions.length
    ? `.where(${conditions.length > 1 ? `and(${conditions.join(", ")})` : conditions[0]})`
    : "";
  const date = field.type.kind === "scalar" && field.type.name === "date";
  return {
    query: `db.select({ id: ${table}.id, at: ${targetTable}.${dataKey(field)} }).from(${table})${join}${where}.all()`,
    // A date is its day's start in the app's zone.
    instant: date ? "instantOf(`${row.at}T00:00`, app.timeZone).getTime()" : "row.at.getTime()",
  };
}

/** A timer's condition as Drizzle conditions on its model's table. */
function conditionCode(
  where: Condition | undefined,
  model: ModelIR,
  table: string,
  drizzle: Set<string>,
): string[] {
  return Object.entries(where ?? {}).map(([key, value]) => {
    const column = `${table}.${dataKey(model.fields.find((f) => f.name === key) as FieldIR)}`;
    if (Array.isArray(value)) {
      drizzle.add("inArray");
      return `inArray(${column}, ${JSON.stringify(value)})`;
    }
    return `eq(${column}, ${JSON.stringify(value)})`;
  });
}

/** A timer's condition on a row already read. */
function fitsCode(where: Condition, row: string): string {
  return Object.entries(where)
    .map(([key, value]) =>
      Array.isArray(value)
        ? `${JSON.stringify(value)}.includes(String(${row}.${key}))`
        : `${row}.${key} === ${JSON.stringify(value)}`,
    )
    .join(" && ");
}

/** What a timer does for one record: its action where it fits, then its event for outgoing. */
function recordRun(
  timer: TimerIR,
  model: ModelIR,
  run: ActionIR | undefined,
  told: boolean,
  t: Texts,
  use: (module: string, ...what: string[]) => void,
): string {
  const n = names(model, t);
  const actor = `as(${JSON.stringify(timer.name)})`;
  const steps: string[] = [];
  if (run) {
    const a = actionNames(run);
    use(n.module.replace("#/generated/", "./").concat(".server"), n.data);
    use(a.module.replace("#/generated/", "./"), a.fits);
    use(`./actions/${kebab(run.name)}.server`, a.run);
    steps.push(`  const row = await ${n.data}.get(${actor}, id);
  if (!row) return "gone";
  // A record its action's condition does not fit is skipped, and Activity says so.
  if (!${a.fits}(row)) {
    audit(db, ${actor}, { action: "timer skipped", model: ${JSON.stringify(model.name)}, record: id, details: { action: ${JSON.stringify(run.name)} } });
    return "skipped";
  }
  await ${a.run}(${actor}, id);`);
  }
  if (told)
    steps.push(`  db.transaction((tx) => {
    const now = tx.select().from(${n.table}).where(eq(${n.table}.id, id)).get();
    if (now) outgoing(tx, ${actor}, ${JSON.stringify(model.name)}, ${JSON.stringify(`timer:${timer.name}`)}, now);
  });`);
  return `
async function ${camel(timer.name)}Record(${steps.length ? "id" : "_id"}: number): Promise<string> {
${steps.join("\n")}
  return "done";
}
`;
}
