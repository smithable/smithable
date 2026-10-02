// How imported records are stored (importRecords, ARCHITECTURE §4): the SQL the host runs in one
// transaction, in the columns the generated schema (schema.ts) has. Storage is this adapter's
// knowledge, so the host only runs statements; pure, so the same input gives the same SQL.
import { type AuthIR, type FieldIR, type ModelIR, plural, snake } from "@smithable/core";
import { hasSignIn } from "./auth.js";
import { dataKey, ownerKey } from "./shared.js";

/** A value as importRecords converted it, with references already looked up (their ids). */
export type StoredValue = string | number | boolean | null;

/** The table a model's records are in, and the column naming them (to look titles up). */
export function recordTable(model: ModelIR): string {
  return snake(plural(model.name));
}

/** A field's column, as Drizzle names a key (snake_case). */
export function fieldColumn(field: FieldIR): string {
  return snake(dataKey(field));
}

/**
 * The statement adding one record: the given fields, the owner (the importing user) and the
 * timestamps the schema otherwise sets in JavaScript. A date-time without a zone is the app's.
 */
export function insertRecord(
  model: ModelIR,
  auth: AuthIR,
  values: Record<string, StoredValue>,
  owner: string | null,
  now: number,
  timeZone?: string,
): { sql: string; params: (string | number | null)[] } {
  const columns: string[] = [];
  const params: (string | number | null)[] = [];
  for (const [name, value] of Object.entries(values)) {
    const field = model.fields.find((f) => f.name === name);
    if (!field) continue;
    columns.push(fieldColumn(field));
    params.push(stored(field, value, timeZone));
  }
  if (hasSignIn(auth) && !(model.ownedBy && model.ownedBy in values)) {
    columns.push(snake(ownerKey(model)));
    params.push(owner);
  }
  columns.push("created_at", "updated_at");
  params.push(now, now);
  return {
    sql: `INSERT INTO "${recordTable(model)}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    params,
  };
}

/** A value as its column keeps it: yes/no as 1/0, a date-time as milliseconds. */
function stored(field: FieldIR, value: StoredValue, timeZone?: string): string | number | null {
  if (value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (field.type.kind === "scalar" && field.type.name === "datetime" && typeof value === "string")
    return instantOf(value, timeZone);
  return value;
}

/** How far `timeZone`'s wall clock is ahead of UTC at an instant, in milliseconds. */
function offsetAt(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
  return wall - Math.floor(instant / 60_000) * 60_000;
}

/**
 * The instant a wall time ("2026-10-05T08:00") is in `timeZone`, as the kit's zoned.ts reads a
 * form (the first of a doubled autumn hour); without a zone, UTC.
 */
function instantOf(wall: string, timeZone?: string): number {
  const asUtc = Date.parse(`${wall.slice(0, 16)}:00Z`);
  if (!timeZone) return asUtc;
  const candidates = [
    asUtc - offsetAt(asUtc - 86_400_000, timeZone),
    asUtc - offsetAt(asUtc + 86_400_000, timeZone),
  ];
  const fits = candidates.filter((t) => asUtc === t + offsetAt(t, timeZone)).sort((a, b) => a - b);
  return fits[0] ?? (candidates[0] as number);
}
