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
 * The instant a wall time ("2026-09-30T09:00") is in `timeZone`. The offset is found in at most
 * two steps, so the hours around a change to or from summer time come out right; a wall time the
 * change skips (02:30 on the spring-forward night) is read with the offset before it.
 */
export function instantOf(wall: string, timeZone?: string): Date {
  if (!timeZone) return new Date(wall);
  const asUtc = Date.parse(`${wall.slice(0, 16)}:00Z`);
  const first = offsetAt(asUtc, timeZone);
  const second = offsetAt(asUtc - first, timeZone);
  return new Date(asUtc - (first === second ? first : second));
}
