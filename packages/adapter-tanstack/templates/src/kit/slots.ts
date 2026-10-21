// Smithable app kit: one person's time (docs/design/appointments.md §4), in the app's time zone.
// Whether a booking fits a schedule (inside its hours, outside its breaks and time away, the gap
// kept after every booking), and the free times of a day. The server checks with the same
// function that offers the times, so the picker and the check never disagree.
import { instantOf, wallTime } from "./zoned";

/** Minutes after midnight, [starts, ends). */
export type Span = [number, number];

/** The business's week: each open weekday's spans, breaks every day, minutes after each booking. */
export interface Schedule {
  hours: Partial<Record<string, Span[]>>;
  breaks: Span[];
  gap: number;
}

/** Time already taken, in milliseconds: a booking (the gap is kept after it) or time away. */
export interface Taken {
  from: number;
  until: number;
  away?: boolean;
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const dayOf = (date: string) => DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] as string;
const minutesOf = (wall: string) => Number(wall.slice(11, 13)) * 60 + Number(wall.slice(14, 16));
const clock = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** The date `days` after a date, both "2026-10-21". */
export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Whether a booking of `minutes` from `start` fits the schedule and what is taken. */
export function fits(
  schedule: Schedule,
  start: Date,
  minutes: number,
  taken: Taken[],
  timeZone?: string,
): boolean {
  // A booking lasts some time, and no longer than a day.
  if (!(minutes > 0 && minutes <= 24 * 60)) return false;
  const wall = wallTime(start, timeZone);
  const a = minutesOf(wall);
  const b = a + minutes;
  if (!(schedule.hours[dayOf(wall.slice(0, 10))] ?? []).some(([o, c]) => a >= o && b <= c))
    return false;
  if (schedule.breaks.some(([o, c]) => a < c && b > o)) return false;
  const s = start.getTime();
  const e = s + minutes * 60_000;
  const gap = schedule.gap * 60_000;
  // Two bookings each keep the gap after them; time away is only itself.
  return !taken.some((t) =>
    t.away ? s < t.until && e > t.from : s < t.until + gap && e + gap > t.from,
  );
}

/**
 * The free starts on a date: every 15 minutes (or the booking's length, when shorter) from each
 * span's start where the whole length fits, after `now`.
 */
export function freeTimes(
  schedule: Schedule,
  date: string,
  minutes: number,
  taken: Taken[],
  timeZone?: string,
  now = new Date(),
): Date[] {
  if (!(minutes > 0 && minutes <= 24 * 60)) return [];
  const step = Math.min(15, minutes);
  const times: Date[] = [];
  for (const [opens, closes] of schedule.hours[dayOf(date)] ?? [])
    for (let m = opens; m + minutes <= closes; m += step) {
      const wall = `${date}T${clock(m)}`;
      const at = instantOf(wall, timeZone);
      // A wall time the change to summer time skips is no time to offer.
      if (
        at > now &&
        wallTime(at, timeZone) === wall &&
        fits(schedule, at, minutes, taken, timeZone)
      )
        times.push(at);
    }
  return times;
}

/** The instants from the start of the day before `date` to the end of the day after it. */
export function around(date: string, timeZone?: string): [Date, Date] {
  return [
    instantOf(`${addDays(date, -1)}T00:00`, timeZone),
    instantOf(`${addDays(date, 2)}T00:00`, timeZone),
  ];
}
