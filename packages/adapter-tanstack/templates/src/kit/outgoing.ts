// Smithable app kit: the rules of outgoing mail (docs/design/integrations.md §4.1b) that need
// nothing but values: which change counts, and how long to wait before trying again.

const MINUTE = 60_000;

/**
 * Whether an entry counts for what happened (`what`: created, deleted, changed or an action's
 * name). With a condition, a creation, deletion or action counts when the record fits it, and a
 * change when the record fits after it and did not before; an action's change is a change too.
 */
export function counts(
  when: string,
  what: string,
  fits: ((record: Record<string, unknown>) => boolean) | undefined,
  record: Record<string, unknown>,
  before?: Record<string, unknown>,
): boolean {
  if (when === "changed") {
    if (what === "created" || what === "deleted") return false;
    return !fits || (fits(record) && !(before && fits(before)));
  }
  return what === when && (!fits || fits(record));
}

/** The pause before the next try: a minute, then doubling, at most three hours. */
export function pauseAfter(tries: number): number {
  return Math.min(MINUTE * 2 ** Math.max(tries - 1, 0), 3 * 60 * MINUTE);
}
