// Smithable app kit: the spreadsheet functions used by the formulas in src/generated/*.formulas.ts.
// Blank values behave like blank spreadsheet cells: 0 in arithmetic, "" in text.
import { now } from "./now";

type Value = unknown;

/** A number, or 0 for a blank value. */
function n(value: Value): number {
  return typeof value === "number" ? value : value == null || value === "" ? 0 : Number(value);
}

/** Text, or "" for a blank value. */
function t(value: Value): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** A date as YYYY-MM-DD, or "" for a blank value. */
function d(value: Value): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value == null ? "" : String(value).slice(0, 10);
}

/** Comparable form of a value: numbers, dates and text compare like in a spreadsheet. */
function key(value: Value): number | string {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" || typeof value === "boolean") return Number(value);
  return t(value);
}

function compare(op: "=" | "<>" | "<" | ">" | "<=" | ">=", a: Value, b: Value): boolean {
  const x = key(a);
  const y = key(b);
  switch (op) {
    case "=":
      return x === y;
    case "<>":
      return x !== y;
    case "<":
      return x < y;
    case ">":
      return x > y;
    case "<=":
      return x <= y;
    case ">=":
      return x >= y;
  }
}

/**
 * Rounds half away from zero, like spreadsheets. Float noise far below the last digit is
 * removed first, so 0.5 * 19.99 (9.995) rounds to 10.00 and ROUND(1.005, 2) to 1.01.
 */
function ROUND(value: number, digits = 0): number {
  const scaled = Number((Math.abs(value) * 10 ** digits).toFixed(9));
  return (Math.sign(value) * Math.round(scaled)) / 10 ** digits;
}

function TODAY(): string {
  return now().toISOString().slice(0, 10);
}

/** The current date and time, e.g. for "placed at" when a record is created. */
function NOW(): string {
  return now().toISOString();
}

function DATEADD(date: string, amount: number, unit: "day" | "month" | "year"): string {
  if (date === "") return "";
  const value = new Date(`${date}T00:00:00Z`);
  if (unit === "day") value.setUTCDate(value.getUTCDate() + amount);
  else {
    const day = value.getUTCDate();
    value.setUTCDate(1);
    if (unit === "month") value.setUTCMonth(value.getUTCMonth() + amount);
    else value.setUTCFullYear(value.getUTCFullYear() + amount);
    const last = new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0),
    ).getUTCDate();
    value.setUTCDate(Math.min(day, last)); // 31 January + 1 month is 28 or 29 February
  }
  return value.toISOString().slice(0, 10);
}

/**
 * The payment per period that repays `amount` over `periods` at `rate` per period (the
 * spreadsheet PMT, as a positive number); with no interest, the amount split evenly.
 */
function PMT(rate: number, periods: number, amount: number): number {
  if (!(periods > 0)) return 0;
  if (rate === 0) return amount / periods;
  const growth = (1 + rate) ** periods;
  return (amount * rate * growth) / (growth - 1);
}

/** Days from `start` to `end`. */
function DAYS(end: string, start: string): number {
  if (end === "" || start === "") return 0;
  return Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000,
  );
}

/** The related records a formula aggregates over (a list relation), or none. */
function list(value: Value): Record<string, unknown>[] {
  return Array.isArray(value) ? value : [];
}

const SUM = (values: number[]) => values.reduce((a, b) => a + b, 0);
const AVG = (values: number[]) => (values.length ? SUM(values) / values.length : 0);
const MIN = (values: number[]) => (values.length ? Math.min(...values) : 0);
const MAX = (values: number[]) => (values.length ? Math.max(...values) : 0);
/** The newest (LAST) or oldest (FIRST) record of a list by when it was made, then its number. */
const when = (row: Record<string, unknown>) => [
  new Date(String(row.createdAt ?? 0)).getTime() || 0,
  Number(row.id) || 0,
];
const newest = (rows: Record<string, unknown>[], last: boolean) =>
  rows.reduce<Record<string, unknown> | undefined>((best, row) => {
    if (!best) return row;
    const [a, b] = [when(row), when(best)] as [number[], number[]];
    const later = (a[0] as number) - (b[0] as number) || (a[1] as number) - (b[1] as number);
    return (last ? later > 0 : later < 0) ? row : best;
  }, undefined);
const LAST = <T>(rows: Record<string, unknown>[], value: (row: Record<string, unknown>) => T) => {
  const row = newest(rows, true);
  return row ? value(row) : null;
};
const FIRST = <T>(rows: Record<string, unknown>[], value: (row: Record<string, unknown>) => T) => {
  const row = newest(rows, false);
  return row ? value(row) : null;
};

/** Money is stored in cents; formulas work in whole currency units. */
const fromCents = (value: Value) => n(value) / 100;
const toCents = (value: number) => Math.round(ROUND(value, 2) * 100);

export const F = {
  n,
  t,
  d,
  compare,
  ROUND,
  PMT,
  TODAY,
  NOW,
  DATEADD,
  DAYS,
  list,
  SUM,
  AVG,
  MIN,
  MAX,
  LAST,
  FIRST,
  fromCents,
  toCents,
};
