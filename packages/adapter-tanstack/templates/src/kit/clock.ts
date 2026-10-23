// Smithable app kit: a timer's clock (docs/design/timed-actions.md §2, §5). Whether a minute of
// the app's time zone is one a timer's `every` and `at`, or its cron expression, names; and the
// latest such minute in a stretch of time, for the tick to run once.
import { wallTime } from "./zoned";

/** `every` and a time "HH:MM", or a five-field cron expression, in the app's time zone. */
export type Clock = { every: string; at: string } | { cron: string };

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MINUTE = 60_000;
/** How far back the tick looks for a time it missed (the server down). */
const LOOK_BACK = 31 * 24 * 60 * MINUTE;

/** Whether a wall time ("YYYY-MM-DDTHH:MM") is one the clock names. */
export function names(clock: Clock, wall: string): boolean {
  const [date = "", time = ""] = wall.split("T");
  const [y = 0, m = 0, d = 0] = date.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if ("every" in clock) {
    if (time !== clock.at) return false;
    if (clock.every === "day") return true;
    if (clock.every === "weekday") return weekday >= 1 && weekday <= 5;
    // A week and a month start on their first day.
    if (clock.every === "week") return weekday === 1;
    if (clock.every === "month") return d === 1;
    return WEEKDAYS[weekday] === clock.every;
  }
  const [mi = "*", ho = "*", dom = "*", mon = "*", dow = "*"] = clock.cron.trim().split(/\s+/);
  const inMonth = matches(dom, d, 1, 31);
  // Sunday is 0 or 7.
  // A step runs Monday to Saturday from Sunday as 0; Sunday as 7 only where the field writes 7.
  const inWeek =
    matches(dow, weekday, 0, 6) ||
    (weekday === 0 && /(^|[,-])7($|[,/])/.test(dow) && matches(dow, 7, 0, 7));
  // As cron has it: with both days restricted, either one will do.
  const day = dom !== "*" && dow !== "*" ? inMonth || inWeek : inMonth && inWeek;
  return matches(mi, minute, 0, 59) && matches(ho, hour, 0, 23) && matches(mon, m, 1, 12) && day;
}

/**
 * Whether a cron field ("*", "*\/15", "1-5", "0,30", "8-18/2", "5/15") takes a value; a step
 * counts from the field's first value (`min`: 1 for the day of the month and the month), and a
 * start with a step runs to its last (`max`).
 */
function matches(field: string, value: number, min: number, max: number): boolean {
  return field.split(",").some((part) => {
    const [range = "*", stepText] = part.split("/");
    const step = stepText ? Number(stepText) : 1;
    if (range === "*") return value >= min && value <= max && (value - min) % step === 0;
    const [from = min, to = stepText && !range.includes("-") ? max : from] = range
      .split("-")
      .map(Number);
    return value >= from && value <= to && (value - from) % step === 0;
  });
}

/**
 * The latest minute after `since` and up to `now` that the clock names, as a wall time in the
 * zone; none when there is none. A stretch longer than a month is looked at for its last month.
 * A time the clock skips (the spring change) is due at the first minute after it, as written; one
 * it repeats (the autumn change) is the same wall time, due once.
 */
export function latestDue(
  clock: Clock,
  since: Date,
  now: Date,
  timeZone?: string,
): string | undefined {
  const from = Math.max(since.getTime(), now.getTime() - LOOK_BACK);
  for (let t = Math.floor(now.getTime() / MINUTE) * MINUTE; t > from; t -= MINUTE) {
    const wall = wallTime(new Date(t), timeZone);
    if (names(clock, wall)) return wall;
    const skipped = skippedBefore(wallTime(new Date(t - MINUTE), timeZone), wall)
      .reverse()
      .find((w) => names(clock, w));
    if (skipped) return skipped;
  }
  return undefined;
}

/** The wall times a clock change skipped between two minutes in a row: none on any other night. */
function skippedBefore(before: string, wall: string): string[] {
  const at = (w: string) => Date.parse(`${w}:00Z`);
  const skipped: string[] = [];
  for (let t = at(before) + MINUTE; t < at(wall); t += MINUTE)
    skipped.push(new Date(t).toISOString().slice(0, 16));
  return skipped;
}
