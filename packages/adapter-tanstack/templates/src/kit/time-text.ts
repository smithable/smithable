// Smithable app kit: how times are written, 24-hour unless the app says 12 (app.clock in the spec),
// and in whose zone: a person's own over the app's, for what they read and enter. Display only:
// records stay placed in the app's zone, and the API and exports answer ISO.
import { FORMATS } from "./formats";
import { w } from "./words";
import { wallTime } from "./zoned";

/** A person's own time zone and clock; what they leave out is the app's. */
export interface Person {
  zone?: string;
  clock?: "12h" | "24h";
}

/** The cookie that carries it, so the server renders a page as the browser will. */
export const TIME_COOKIE = "time";

/** A day: then the person's record is read again, so a change on another device reaches this one. */
export const TIME_COOKIE_SECONDS = 86_400;

/** A person's settings from a Cookie header or document.cookie. */
export function readPerson(cookies: string): Person {
  const value = cookies
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${TIME_COOKIE}=`))
    ?.slice(TIME_COOKIE.length + 1);
  if (value === read.value) return read.person;
  const [zone, clock] = (value ?? "").split("~");
  const person = {
    ...(zone && zone !== "-" && knownZone(zone) ? { zone: decodeURIComponent(zone) } : {}),
    ...(clock === "12h" || clock === "24h" ? { clock: clock as "12h" | "24h" } : {}),
  };
  read = { value, person };
  return person;
}

/** The last cookie read: a page formats many times, and checks a zone's name once. */
let read: { value?: string; person: Person } = { person: {} };

/** Whether a cookie's zone is one the runtime knows: a browser's cookie may say anything. */
function knownZone(written: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: decodeURIComponent(written) });
    return true;
  } catch {
    return false;
  }
}

/** The cookie's value for a person's settings. */
export function writtenPerson({ zone, clock }: Person): string {
  return `${zone ? encodeURIComponent(zone) : "-"}~${clock ?? ""}`;
}

/** Where the person now comes from: the page's cookie; a request's on the server. */
let person: () => Person = () =>
  typeof document === "undefined" ? {} : readPerson(document.cookie);

/** Sets where the person now comes from (src/kit/person-time.server.ts). */
export function personFrom(source: () => Person): void {
  person = source;
}

/** The zone times are shown and entered in: the person's own, else the app's. */
export function shownZone(appZone?: string): string | undefined {
  return person().zone ?? appZone;
}

/** Keeps a person's settings in this browser, or forgets them (signing out). */
export function rememberPerson(settings?: Person): void {
  document.cookie = settings
    ? `${TIME_COOKIE}=${writtenPerson(settings)}; path=/; max-age=${TIME_COOKIE_SECONDS}; samesite=lax`
    : `${TIME_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** What the person has now, for the form that changes it. */
export function personNow(): Person {
  return person();
}

/** Where the clock now comes from: 24-hour until the root route says another. */
let now: () => "12h" | "24h" = () => "24h";

/** Sets where the clock now comes from (the root route). */
export function clockFrom(source: () => "12h" | "24h"): void {
  now = source;
}

/** The hour cycle for Intl's formats. */
export function hourCycle(): "h12" | "h23" {
  return (person().clock ?? now()) === "12h" ? "h12" : "h23";
}

/** A wall time ("14:30", or "9:00" as a day's hours write it) as the app writes a clock. */
export function wallClock(time: string): string {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return clockText(hour, minute);
}

/** A day and a time of day as numbers: the month from 1, the weekday from 0 for Monday. */
export interface When {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
}

/** A day as "2026-11-05" (a date field, a calendar's day) or a wall time "2026-11-05T09:00". */
export function whenOf(text: string): When {
  const [year = 1970, month = 1, day = 1] = text.slice(0, 10).split("-").map(Number);
  const [hour = 0, minute = 0] = (text.slice(11, 16) || "00:00").split(":").map(Number);
  return {
    year,
    month,
    day,
    weekday: (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7,
    hour,
    minute,
  };
}

/** An instant as the shown zone's wall clock (the person's own, else the app's). */
export function whenAt(instant: Date | string | number, appZone?: string): When {
  return whenOf(wallTime(new Date(instant), shownZone(appZone)));
}

/** A time of day as the app writes a clock: "14:30", or "2:30 PM" with no leading zero. */
export function clockText(hour: number, minute: number): string {
  const mm = String(minute).padStart(2, "0");
  if (hourCycle() === "h23") return `${String(hour).padStart(2, "0")}:${mm}`;
  return `${hour % 12 || 12}:${mm} ${hour < 12 ? w.am : w.pm}`;
}

/** What a date shows: the weekday and the year are left out unless asked; the month is short. */
export interface DateShown {
  weekday?: "short" | "long";
  month?: "short" | "long";
  year?: boolean;
  time?: boolean;
}

/**
 * A date in the app's order with the month's name in the page's language: "Thu 5 Nov 2026",
 * or "Thu, Nov 5, 2026" month first; with `time`, ", 14:30" after it. Never numeric (§2).
 */
export function dateText(when: When, shown: DateShown = {}): string {
  if (!Number.isFinite(when.weekday)) return "";
  const words = w;
  const month = (shown.month === "long" ? words.months : words.monthsShort)[when.month - 1];
  const weekday = shown.weekday
    ? (shown.weekday === "long" ? words.weekdays : words.weekdaysShort)[when.weekday]
    : undefined;
  const date =
    FORMATS.date === "month-day"
      ? [weekday, `${month} ${when.day}`].filter(Boolean).join(", ") +
        (shown.year ? `, ${when.year}` : "")
      : [weekday, String(when.day), month, shown.year ? String(when.year) : undefined]
          .filter(Boolean)
          .join(" ");
  return shown.time ? `${date}, ${clockText(when.hour, when.minute)}` : date;
}
