// Smithable app kit: the condition for records in a list filter's range (src/kit/Filters.tsx).
import { and, asc, type Column, desc, gte, lt, lte, type SQL } from "drizzle-orm";
import { instantOf, RELATIVE, type Relative, relativeDays } from "./zoned";

/**
 * Records whose value lies in a filter's range, "from..to" with either side left out: numbers
 * (amounts in the currency's units, stored in cents with `scale` 100), or dates as written
 * ("2026-10-05"; a date and time column compares from the start of "from" to the end of "to").
 * A date filter also takes a relative value (upcoming, past, today, thisWeek, thisMonth), read
 * when the query runs in the app's time zone: "upcoming" is from this moment, "past" before it.
 * "all" is no condition.
 */
export function inRange(
  column: Column,
  text: string,
  kind: "number" | "date" | "instant",
  scale = 1,
  timeZone?: string,
): SQL | undefined {
  if (text === "all") return undefined;
  if (kind !== "number" && (RELATIVE as readonly string[]).includes(text)) {
    const now = new Date();
    if (kind === "instant" && (text === "upcoming" || text === "past"))
      return text === "upcoming" ? gte(column, now) : lt(column, now);
    const { from, to } = relativeDays(text as Relative, now, timeZone);
    const at = (day: string) => (kind === "date" ? day : instantOf(`${day}T00:00`, timeZone));
    return and(
      from === undefined ? undefined : gte(column, at(from)),
      to === undefined ? undefined : lt(column, at(to)),
    );
  }
  const [from = "", to = ""] = text.split("..").map((v) => v.trim());
  const bound = (value: string, end: boolean) => {
    if (!value) return undefined;
    if (kind === "number") {
      const n = Number(value.replace(",", "."));
      return Number.isFinite(n) ? Math.round(n * scale) : undefined;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    if (kind === "date") return value;
    return new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  };
  const low = bound(from, false);
  const high = bound(to, true);
  return and(
    low === undefined ? undefined : gte(column, low),
    high === undefined ? undefined : lte(column, high),
  );
}

/**
 * The list's order from the address, "price" from low and "-price" from high, among the columns
 * the page lets its viewer sort by; anything else leaves the newest first.
 */
export function orderOf(
  columns: Record<string, Column>,
  sort: string | undefined,
): SQL | undefined {
  const column =
    sort && Object.hasOwn(columns, sort.replace(/^-/, ""))
      ? columns[sort.replace(/^-/, "")]
      : undefined;
  if (!column || !sort) return undefined;
  return sort.startsWith("-") ? desc(column) : asc(column);
}
