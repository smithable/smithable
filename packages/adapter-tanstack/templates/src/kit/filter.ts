// Smithable app kit: the condition for records in a list filter's range (src/kit/Filters.tsx).
import { and, asc, type Column, desc, gte, lte, type SQL } from "drizzle-orm";

/**
 * Records whose value lies in a filter's range, "from..to" with either side left out: numbers
 * (amounts in the currency's units, stored in cents with `scale` 100), or dates as written
 * ("2026-10-05"; a date and time column compares from the start of "from" to the end of "to").
 */
export function inRange(
  column: Column,
  text: string,
  kind: "number" | "date" | "instant",
  scale = 1,
): SQL | undefined {
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
  const column = sort ? columns[sort.replace(/^-/, "")] : undefined;
  if (!column || !sort) return undefined;
  return sort.startsWith("-") ? desc(column) : asc(column);
}
