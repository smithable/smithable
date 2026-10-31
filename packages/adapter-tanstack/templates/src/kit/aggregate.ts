// Smithable app kit: the numbers a dashboard shows, worked out from records the viewer may read.
import { wallTime } from "./zoned";

/** The sum of a number over records; empty values count as nothing. */
export function sum<R>(rows: R[], value: (row: R) => unknown): number {
  return rows.reduce((total, row) => total + (Number(value(row)) || 0), 0);
}

/** The average of a number over records that have one, or null when none do. */
export function average<R>(rows: R[], value: (row: R) => unknown): number | null {
  const numbers = rows.map(value).filter((v) => v !== null && v !== undefined) as number[];
  return numbers.length ? sum(numbers, Number) / numbers.length : null;
}

/** The span of a chart's bars (docs/design/intents.md §5). */
export type Period = "week" | "month" | "quarter" | "year";

/** How many bars a period has: eight weeks, six months, four quarters, three years. */
const SPAN: Record<Period, number> = { week: 8, month: 6, quarter: 4, year: 3 };

/** A day as "2026-10-29": a date as it is, a date and time in the app's time zone. */
function dayOf(value: unknown, timeZone: string): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  // A date and time, as a Date or as its text, is the day it is in the app's time zone.
  const text = String(value);
  if (value instanceof Date || text.includes("T"))
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value instanceof Date ? value : new Date(text));
  return text.slice(0, 10);
}

/** The bar a day falls in: its week's Monday ("2026-10-26"), "2026-10", "2026-Q4" or "2026". */
function bucketOf(day: string, period: Period): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  if (period === "year") return String(y);
  if (period === "quarter") return `${y}-Q${Math.ceil(m / 3)}`;
  if (period === "month") return day.slice(0, 7);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/** The bar `steps` before a bar. */
function before(bucket: string, period: Period, steps: number): string {
  if (period === "year") return String(Number(bucket) - steps);
  if (period === "quarter") {
    const [y, q] = bucket.split("-Q").map(Number) as [number, number];
    const n = y * 4 + (q - 1) - steps;
    return `${Math.floor(n / 4)}-Q${(n % 4) + 1}`;
  }
  if (period === "month") {
    const [y, m] = bucket.split("-").map(Number) as [number, number];
    return new Date(Date.UTC(y, m - 1 - steps, 1)).toISOString().slice(0, 7);
  }
  const date = new Date(`${bucket}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 7 * steps);
  return date.toISOString().slice(0, 10);
}

/**
 * One total per period, up to the latest record's: eight weeks (from Monday), six months, four
 * quarters or three years, empty ones as 0, in the app's time zone. A record with no date is left out.
 */
export function byPeriod<R>(
  rows: R[],
  date: (row: R) => unknown,
  value: (row: R) => number,
  period: Period,
  timeZone: string,
): { key: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const day = dayOf(date(row), timeZone);
    if (!day) continue;
    const key = bucketOf(day, period);
    totals.set(key, (totals.get(key) ?? 0) + value(row));
  }
  const last = [...totals.keys()].sort().at(-1);
  if (!last) return [];
  const count = SPAN[period];
  return Array.from({ length: count }, (_, i) => {
    const key = before(last, period, count - 1 - i);
    return { key, value: totals.get(key) ?? 0 };
  });
}

/**
 * One total per value of a choice, in the choice's order; a record with no value is left out, and
 * so is a value no record has (the tile's `where` narrows first).
 */
export function byValue<R>(
  rows: R[],
  choice: (row: R) => unknown,
  value: (row: R) => number,
  values: readonly string[],
): { key: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const v = choice(row);
    if (v === null || v === undefined || v === "") continue;
    totals.set(String(v), (totals.get(String(v)) ?? 0) + value(row));
  }
  return values.filter((v) => totals.has(v)).map((v) => ({ key: v, value: totals.get(v) ?? 0 }));
}

/** The newest records first: the highest ids. */
export function latest<R extends { id: number }>(rows: R[], limit: number): R[] {
  return [...rows].sort((a, b) => b.id - a.id).slice(0, limit);
}

/** A date `days` after another, both "YYYY-MM-DD". */
const dayAfter = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * What is due (look-gap §4): the rows whose date falls before the end of the span from today, in
 * the app's time zone, earliest first, the overdue (before today) marked. A date-time counts by
 * its day there; a row without one is left out.
 */
export function due<R>(
  rows: R[],
  when: (row: R) => unknown,
  within: { amount: number; unit: "day" | "week" },
  timeZone: string,
  now = new Date(),
): { row: R; day: string; overdue: boolean }[] {
  const today = wallTime(now, timeZone).slice(0, 10);
  const end = dayAfter(today, within.amount * (within.unit === "week" ? 7 : 1));
  const dayOf = (value: unknown) =>
    value instanceof Date
      ? wallTime(value, timeZone).slice(0, 10)
      : typeof value === "string" && value
        ? value.slice(0, 10)
        : undefined;
  return rows
    .flatMap((row) => {
      const day = dayOf(when(row));
      return day && day < end ? [{ row, day, overdue: day < today }] : [];
    })
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}
