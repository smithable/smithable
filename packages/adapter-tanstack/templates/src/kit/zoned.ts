// Smithable app kit: date-and-time values in the app's own time zone (its settings),
// the same for forms as for pages, whatever zone the browser or the server is in. Without a
// time zone the browser's own is used, as a date-and-time input does by itself.

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar date and clock time an instant shows in a time zone. */
function parts(ms: number, timeZone: string) {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, format);
  }
  const p: Record<string, number> = {};
  for (const { type, value } of format.formatToParts(new Date(ms))) p[type] = Number(value);
  return {
    year: p.year ?? 1970,
    month: p.month ?? 1,
    day: p.day ?? 1,
    hour: (p.hour ?? 0) % 24,
    minute: p.minute ?? 0,
    second: p.second ?? 0,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The wall time an instant shows in `timeZone`, as a date-and-time input takes it: "2026-09-30T09:30". */
export function wallTime(date: Date, timeZone?: string): string {
  if (!timeZone) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }
  const p = parts(date.getTime(), timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** How far `timeZone` is ahead of UTC at an instant, in milliseconds. */
function offset(ms: number, timeZone: string): number {
  const p = parts(ms, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

/**
 * The instant a wall time such as "2026-09-30T09:30" means in `timeZone`. A time that happens
 * twice (when clocks go back) is the first; one that never happens (when they go forward) moves
 * forward by the gap, as clocks do.
 */
export function instant(wall: string, timeZone?: string): Date {
  if (!timeZone) return new Date(wall);
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(wall);
  if (!m) return new Date(Number.NaN);
  const asUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  // A zone changes its offset at most once within a day: try the offsets a day before and after.
  const day = 86_400_000;
  const candidates = [asUtc - offset(asUtc - day, timeZone), asUtc - offset(asUtc + day, timeZone)];
  const exact = candidates.filter((ms) => wallTime(new Date(ms), timeZone) === wall.slice(0, 16));
  return new Date(exact.length ? Math.min(...exact) : (candidates[0] as number));
}
