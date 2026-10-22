// One person's time in the generated app (docs/design/appointments.md §4): the parts of a model
// that `occupies` a scheduled model's time, for its data module (the check in the write's
// transaction, the free times) and its client module (the picker's server function).
import type { FieldIR, ModelIR, OccupiesIR, SpecIR } from "@smithable/core";
import { dataKey, literal, modelNamed, tableRef } from "./shared.js";

/** What an occupying model's modules need, all read from the spec once. */
export interface Occupying {
  occupies: OccupiesIR;
  /** The scheduled model and the reference to it. */
  resource: ModelIR;
  resourceKey: string;
  startsKey: string;
  /** The record's own key that gives its length: the minutes, or the reference whose field does. */
  lengthKey: string;
  /** The record the length is read from, when it is one reference away ("service.minutes"). */
  lengthTarget?: { model: ModelIR; minutesKey: string };
  /** How the length is read in a transaction from a record `r` (a number or null). */
  lengthOf: (r: string) => string;
}

export function occupying(model: ModelIR, ir: SpecIR): Occupying | undefined {
  const occupies = model.occupies;
  if (!occupies) return undefined;
  const field = (name: string) => model.fields.find((f) => f.name === name) as FieldIR;
  const ref = field(occupies.resource);
  const resource = modelNamed(ir, ref.type.kind === "relation" ? ref.type.model : "");
  const [first = "", second] = occupies.duration.split(".");
  const own = field(first);
  const lengthKey = dataKey(own);
  let lengthOf = (r: string) => `(${r}.${lengthKey} ?? null)`;
  let lengthTarget: Occupying["lengthTarget"];
  if (second !== undefined && own.type.kind === "relation") {
    const target = modelNamed(ir, own.type.model);
    const table = tableRef(target);
    const minutesKey = dataKey(target.fields.find((f) => f.name === second) as FieldIR);
    lengthTarget = { model: target, minutesKey };
    lengthOf = (r: string) =>
      `(${r}.${lengthKey} == null ? null : (tx.select({ n: ${table}.${minutesKey} }).from(${table}).where(eq(${table}.id, ${r}.${lengthKey} as number)).get()?.n ?? null))`;
  }
  return {
    occupies,
    resource,
    resourceKey: dataKey(ref),
    startsKey: dataKey(field(occupies.starts)),
    lengthKey,
    lengthTarget,
    lengthOf,
  };
}

/** The drizzle functions the data module's parts use. */
export const OCCUPIES_DRIZZLE = ["and", "asc", "eq", "gt", "gte", "inArray", "lt", "ne"];

/** The data module's imports for the parts. */
export const occupiesImports = () =>
  `import { app } from "./app";
import { addDays, around, fits as fitsTime, freeTimes, type Schedule, type Taken } from "#/kit/slots";
import { wallTime } from "#/kit/zoned";
`;

/** Module-level helpers in the data module: the schedule, what holds time, what is taken. */
export function occupiesHelpers(model: ModelIR, ir: SpecIR, o: Occupying): string {
  const table = tableRef(model);
  const schedule = o.resource.schedule;
  if (!schedule) return "";
  const holds = Object.entries(o.occupies.while ?? {}).map(([k, v]) =>
    typeof v === "boolean"
      ? `Boolean(row.${k}) === ${v}`
      : `${JSON.stringify([v].flat())}.includes(String(row.${k}))`,
  );
  const holdsSql = Object.entries(o.occupies.while ?? {}).map(([k, v]) =>
    Array.isArray(v)
      ? `inArray(${table}.${k}, ${JSON.stringify(v)})`
      : `eq(${table}.${k}, ${JSON.stringify(v)})`,
  );
  const target = o.lengthTarget && tableRef(o.lengthTarget.model);
  const booked = target
    ? `tx.select({ starts: ${table}.${o.startsKey}, minutes: ${target}.${o.lengthTarget?.minutesKey} }).from(${table}).innerJoin(${target}, eq(${target}.id, ${table}.${o.lengthKey}))`
    : `tx.select({ starts: ${table}.${o.startsKey}, minutes: ${table}.${o.lengthKey} }).from(${table})`;
  const away = schedule.away;
  const awayModel = away && modelNamed(ir, away.model);
  const key = (m: ModelIR, name: string) =>
    dataKey(m.fields.find((f) => f.name === name) as FieldIR);
  const awayRows =
    away && awayModel
      ? `
  const away = tx.select({ from: ${tableRef(awayModel)}.${key(awayModel, away.from)}, until: ${tableRef(awayModel)}.${key(awayModel, away.until)} }).from(${tableRef(awayModel)}).where(and(eq(${tableRef(awayModel)}.${key(awayModel, away.resource)}, ${o.resourceKey}), lt(${tableRef(awayModel)}.${key(awayModel, away.from)}, until), gt(${tableRef(awayModel)}.${key(awayModel, away.until)}, from)${awayModel.trash ? `, isNull(${tableRef(awayModel)}.deletedAt)` : ""})).all();`
      : "";
  return `
/** The time a ${o.occupies.resource} is booked by (smithable.yml, models.${o.resource.name}.schedule). */
const SCHEDULE: Schedule = ${literal({ hours: schedule.hours, breaks: schedule.breaks, gap: schedule.gap })};

/** Whether a record takes its ${o.occupies.resource}'s time${o.occupies.while ? " (while it fits occupies.while)" : ""}. */
const holdsTime = (${holds.length ? "row" : "_row"}: Record<string, unknown>) => ${holds.length ? holds.join(" && ") : "true"};

/** What is taken of a ${o.occupies.resource}'s time between two instants: the records that hold it${away ? ", and time away" : ""}. */
function takenOf(tx: Tx | typeof db, ${o.resourceKey}: number, from: Date, until: Date, except?: number): Taken[] {
  const booked = ${booked}.where(and(eq(${table}.${o.resourceKey}, ${o.resourceKey}), gte(${table}.${o.startsKey}, from), lt(${table}.${o.startsKey}, until)${holdsSql.map((c) => `, ${c}`).join("")}${model.trash ? `, isNull(${table}.deletedAt)` : ""}, except === undefined ? undefined : ne(${table}.id, except))).all();${awayRows}
  return [
    ...booked.map((b) => ({ from: b.starts.getTime(), until: b.starts.getTime() + (b.minutes ?? 0) * 60_000 })),${away ? "\n    ...away.map((a) => ({ from: a.from.getTime(), until: a.until.getTime(), away: true }))," : ""}
  ];
}

/**
 * Refuses a record that would take time its ${o.occupies.resource} does not have: outside the hours, in a
 * break${away ? " or time away" : ""}, or over another booking with the gap after it. The refusal names the
 * next free times that day (docs/design/appointments.md §4).
 */
function checkTime(tx: Tx, row: Record<string, unknown>, except?: number) {
  const resource = row.${o.resourceKey} as number | null | undefined;
  const starts = row.${o.startsKey} == null ? undefined : new Date(row.${o.startsKey} as Date | string | number);
  const minutes = ${o.lengthOf("row")} as number | null;
  if (resource == null || !starts || minutes == null || !holdsTime(row)) return;
  const [from, until] = around(wallTime(starts, app.timeZone).slice(0, 10), app.timeZone);
  const taken = takenOf(tx, resource, from, until, except);
  if (fitsTime(SCHEDULE, starts, minutes, taken, app.timeZone)) return;
  const next = freeTimes(SCHEDULE, wallTime(starts, app.timeZone).slice(0, 10), minutes, taken, app.timeZone).slice(0, 3);
  throw new Conflict(\`not-free:\${next.map((t) => t.toISOString()).join(",")}\`);
}
`;
}

/** The keys whose change moves a record's time: its resource, start, length and `while` fields. */
export function movingKeys(o: Occupying): string[] {
  return [o.resourceKey, o.startsKey, o.lengthKey, ...Object.keys(o.occupies.while ?? {})];
}

/** The data module's member that answers the picker: a day's free times. */
export function freeTimesMember(o: Occupying, resourceData: string, lengthData?: string): string {
  const table = tableRef(o.resource);
  const target = o.lengthTarget && tableRef(o.lengthTarget.model);
  // The length is the minutes given, or those of the record given (a service), if the viewer may read it.
  const minutes =
    target && lengthData
      ? `${lengthData}.canRead(viewer, input.length) ? (db.select({ n: ${target}.${o.lengthTarget?.minutesKey} }).from(${target}).where(eq(${target}.id, input.length)).get()?.n ?? null) : null`
      : "input.length";
  return `  /**
   * A day's free times for the picker: of one ${o.occupies.resource}, or of every one the viewer may read, the
   * first free one in their order taking each time. With \`first\`, the first day from \`date\` that
   * has any, within 60 days.
   */
  freeTimes(viewer: Viewer | null, input: { resource?: number | null; length: number; date: string; first?: boolean }): { date: string; times: { at: string; resource: number }[] } {
    const minutes = ${minutes};
    const resources =
      input.resource == null
        ? db.select({ id: ${table}.id }).from(${table}).where(${resourceData}.readable(viewer)).orderBy(asc(${table}.id)).all().map((r) => r.id)
        : ${resourceData}.canRead(viewer, input.resource) ? [input.resource] : [];
    for (let day = 0; minutes && day < (input.first ? 60 : 1); day++) {
      const date = addDays(input.date, day);
      const [from, until] = around(date, app.timeZone);
      const free = new Map<number, number>();
      for (const resource of resources)
        for (const at of freeTimes(SCHEDULE, date, minutes, takenOf(db, resource, from, until), app.timeZone))
          if (!free.has(at.getTime())) free.set(at.getTime(), resource);
      if (free.size || !input.first)
        return { date, times: [...free].sort((a, b) => a[0] - b[0]).map(([at, resource]) => ({ at: new Date(at).toISOString(), resource })) };
    }
    return { date: input.date, times: [] };
  },

`;
}

/** "12h" in minutes (validated by core), or 0 without a window. */
const windowMinutes = (text?: string) =>
  text ? Number(text.slice(0, -1)) * ({ m: 1, h: 60, d: 1440 }[text.slice(-1)] ?? 0) : 0;

/**
 * The data module's members for the owner's Cancel (appointments.md §4): whether the viewer may
 * cancel a record now, and the cancel itself, which sets the `while` field to the value outside it.
 */
export function cancelMembers(
  o: Occupying,
  model: ModelIR,
  n: { table: string; data: string; values: string; label: string },
  owner: string,
): string {
  const cancel = o.occupies.cancel;
  if (!cancel) return "";
  const label = n.label.toLowerCase();
  return `  /** Whether the viewer may cancel this ${label} themselves now: their own, holding time, ${o.occupies.cancelUntil ? `more than ${o.occupies.cancelUntil} before its start` : "before its start"}. */
  cancelState(viewer: Viewer | null, id: number): { can: boolean; late: boolean } | null {
    if (!viewer) return null;
    const row = db.select().from(${n.table}).where(and(eq(${n.table}.id, id), ${n.data}.readable(viewer))).get();
    if (!row || row.${owner} !== viewer.id || !holdsTime(row)) return null;
    const closes = row.${o.startsKey}.getTime() - ${windowMinutes(o.occupies.cancelUntil)} * 60_000;
    return { can: Date.now() < closes, late: Date.now() >= closes };
  },

  /** Cancels the viewer's own ${label} while they may: ${model.name}.${cancel.field} becomes ${cancel.to}. */
  async cancelOwn(viewer: Viewer | null, id: number) {
    if (!${n.data}.cancelState(viewer, id)?.can) throw new AccessDenied(viewer !== null);
    return ${n.data}.update(viewer, id, { ${cancel.field}: ${JSON.stringify(cancel.to)} }, "cancelled");
  },

`;
}

/** A booking length the generated tests use: it fits any span of half an hour. */
export const TEST_MINUTES = 30;

/**
 * A wall time in the week of Monday 12 January 2026 that a booking of TEST_MINUTES fits, the
 * first in the schedule's hours outside its breaks: the generated tests book it.
 */
export function testStart(model: ModelIR, ir: SpecIR): string | undefined {
  const o = occupying(model, ir);
  const schedule = o?.resource.schedule;
  if (!schedule) return undefined;
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  for (const [i, day] of days.entries())
    for (const [opens, closes] of schedule.hours[day] ?? [])
      for (let m = opens; m + TEST_MINUTES <= closes; m += 15)
        if (!schedule.breaks.some(([a, b]) => m < b && m + TEST_MINUTES > a))
          return `2026-01-${String(12 + i).padStart(2, "0")}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return undefined;
}

/** Whether a field is the length some model's bookings take: its tests give it TEST_MINUTES. */
export function isTestLength(field: FieldIR, model: ModelIR, ir: SpecIR): boolean {
  return ir.models.some((m) => {
    const o = occupying(m, ir);
    if (!o) return false;
    if (o.lengthTarget)
      return o.lengthTarget.model === model && o.lengthTarget.minutesKey === dataKey(field);
    return m === model && o.lengthKey === dataKey(field);
  });
}
