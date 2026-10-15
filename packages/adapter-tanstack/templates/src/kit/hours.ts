// Smithable app kit: opening hours (docs/design/orders.md §3), in the app's time zone: whether
// a moment is open, when it next opens, and the quarter hours an order may be wanted for.
import { instantOf, wallTime } from "./zoned";

/** Minutes after midnight, [opens, closes). */
export type Span = [number, number];
/** Each open weekday's spans: mon, tue, … sun. A day not named is closed. */
export type Hours = Partial<Record<string, Span[]>>;

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const dayOf = (date: string) => DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] as string;
const minutesOf = (wall: string) => Number(wall.slice(11, 13)) * 60 + Number(wall.slice(14, 16));
const clock = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Whether the hours are open at a moment. */
export function openAt(hours: Hours, now: Date, timeZone?: string): boolean {
  const wall = wallTime(now, timeZone);
  const minute = minutesOf(wall);
  return (hours[dayOf(wall.slice(0, 10))] ?? []).some(([a, b]) => minute >= a && minute < b);
}

/** The next moment the hours open after `now`, within a week; undefined when they never do. */
export function nextOpening(hours: Hours, now: Date, timeZone?: string): Date | undefined {
  const today = wallTime(now, timeZone).slice(0, 10);
  for (let d = 0; d <= 7; d++) {
    const date = addDays(today, d);
    for (const [opens] of hours[dayOf(date)] ?? []) {
      const at = instantOf(`${date}T${clock(opens)}`, timeZone);
      if (at > now) return at;
    }
  }
  return undefined;
}

/**
 * The quarter hours today an order may be wanted for: from `lead` minutes after now to the
 * span's close, in the spans still open.
 */
export function wantedTimes(hours: Hours, now: Date, timeZone?: string, lead = 0): Date[] {
  const today = wallTime(now, timeZone).slice(0, 10);
  const earliest = now.getTime() + lead * 60_000;
  const times: Date[] = [];
  for (const [opens, closes] of hours[dayOf(today)] ?? [])
    for (let m = Math.ceil(opens / 15) * 15; m <= closes; m += 15) {
      const at = instantOf(`${today}T${clock(m)}`, timeZone);
      if (at.getTime() >= earliest) times.push(at);
    }
  return times;
}
