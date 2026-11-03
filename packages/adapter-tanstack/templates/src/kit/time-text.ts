// Smithable app kit: how times are written, 24-hour unless the app says 12 (app.clock in the spec).
import { language } from "./words";

/** Where the clock now comes from: 24-hour until the root route says another. */
let now: () => "12h" | "24h" = () => "24h";

/** Sets where the clock now comes from (the root route). */
export function clockFrom(source: () => "12h" | "24h"): void {
  now = source;
}

/** The hour cycle for Intl's formats. */
export function hourCycle(): "h12" | "h23" {
  return now() === "12h" ? "h12" : "h23";
}

/** A wall time ("14:30") as the app writes a clock. */
export function wallClock(time: string): string {
  return new Intl.DateTimeFormat(language(), {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: hourCycle(),
  }).format(new Date(`2000-01-01T${time}:00Z`));
}
