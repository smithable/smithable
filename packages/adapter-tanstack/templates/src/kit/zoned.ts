// Smithable app kit: date-times in the app's time zone (app.timeZone in generated/app.ts), whoever
// looks at them and wherever the server runs. A studio in Mariehamn shows a 09:00 class at 09:00
// to a visitor in Stockholm, and a form entered from anywhere stores the moment the app means.
// Without a time zone, the browser's own is used, as the tables do.

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
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  return wall - Math.floor(instant / 1000) * 1000;
}

/** The wall time an instant shows in `timeZone`, as "2026-09-30T09:00". */
export function wallTime(instant: Date, timeZone?: string): string {
  const shift = timeZone
    ? offsetAt(instant.getTime(), timeZone)
    : -instant.getTimezoneOffset() * 60_000;
  return new Date(instant.getTime() + shift).toISOString().slice(0, 16);
}

/**
 * The instant a wall time ("2026-09-30T09:00") is in `timeZone`. Around a change to or from summer
 * time both offsets are tried: a wall time that happens twice (03:30 on the autumn night) is its
 * first occurrence, and one the change skips (03:30 in spring) is read with the offset before it.
 */
export function instantOf(wall: string, timeZone?: string): Date {
  if (!timeZone) return new Date(wall);
  const asUtc = Date.parse(`${wall.slice(0, 16)}:00Z`);
  const before = asUtc - offsetAt(asUtc - 86_400_000, timeZone);
  const after = asUtc - offsetAt(asUtc + 86_400_000, timeZone);
  const shows = (t: number) => wallTime(new Date(t), timeZone) === wall.slice(0, 16);
  const fits = [before, after].filter(shows).sort((a, b) => a - b);
  return new Date(fits[0] ?? before);
}

/** A date filter's relative values: resolved when the query runs, in the app's time zone. */
export const RELATIVE = ["upcoming", "past", "today", "thisWeek", "thisMonth"] as const;
export type Relative = (typeof RELATIVE)[number];

/** The day `days` after a date ("2026-10-05"), as a date. */
const shifted = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * The days a relative value spans, from (inclusive) to (exclusive), as "YYYY-MM-DD" in the
 * app's time zone; "upcoming" and "past" have one open side. A week starts on Monday.
 */
export function relativeDays(
  value: Relative,
  now: Date,
  timeZone?: string,
): { from?: string; to?: string } {
  const today = wallTime(now, timeZone).slice(0, 10);
  if (value === "upcoming") return { from: today };
  if (value === "past") return { to: today };
  if (value === "today") return { from: today, to: shifted(today, 1) };
  if (value === "thisWeek") {
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
    const monday = shifted(today, -weekday);
    return { from: monday, to: shifted(monday, 7) };
  }
  const first = `${today.slice(0, 7)}-01`;
  const next = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1));
  return { from: first, to: next.toISOString().slice(0, 10) };
}
