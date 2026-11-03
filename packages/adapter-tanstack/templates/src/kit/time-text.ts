// Smithable app kit: how times are written, 24-hour unless the app says 12 (app.clock in the spec),
// and in whose zone: a person's own over the app's, for what they read and enter. Display only:
// records stay placed in the app's zone, and the API and exports answer ISO.
import { language } from "./words";

/** A person's own time zone and clock; what they leave out is the app's. */
export interface Person {
  zone?: string;
  clock?: "12h" | "24h";
}

/** The cookie that carries it, so the server renders a page as the browser will. */
export const TIME_COOKIE = "smithable-time";

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
    ? `${TIME_COOKIE}=${writtenPerson(settings)}; path=/; max-age=31536000; samesite=lax`
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

/** A time's parts for Intl's formats: "14:30", or "2:30 PM" with no leading zero. */
export function timeParts() {
  const cycle = hourCycle();
  return {
    hour: cycle === "h12" ? "numeric" : "2-digit",
    minute: "2-digit",
    hourCycle: cycle,
  } as const;
}

/** A wall time ("14:30") as the app writes a clock. */
export function wallClock(time: string): string {
  return new Intl.DateTimeFormat(language(), {
    timeZone: "UTC",
    ...timeParts(),
  }).format(new Date(`2000-01-01T${time}:00Z`));
}
