// Smithable app kit: the app's "now". A development build's clock can be moved, so "a week later"
// is a call rather than a wait (POST /_dev/clock, docs/design/sample-users.md §3): NOW(), TODAY(),
// a booking's closing time and the timers read it. Any other build reads the real clock.

// Kept on the process, so the modules a development server reloads share one offset.
const shared = globalThis as { appClockOffset?: number; appClockFixed?: number };

/** The time now: in a development build, moved by the development clock's offset. */
export function now(): Date {
  if (import.meta.env?.DEV && shared.appClockFixed !== undefined)
    return new Date(shared.appClockFixed);
  return new Date(Date.now() + (import.meta.env?.DEV ? (shared.appClockOffset ?? 0) : 0));
}

/** Moves a development build's clock `ms` from the real one; 0 puts it back. */
export function setClockOffset(ms: number): void {
  if (import.meta.env?.DEV) {
    delete shared.appClockFixed;
    shared.appClockOffset = ms;
  }
}

/** Freezes a disposable development replay at an exact recorded instant. */
export function setClockAt(ms: number): void {
  if (import.meta.env?.DEV && Number.isFinite(ms)) shared.appClockFixed = ms;
}
