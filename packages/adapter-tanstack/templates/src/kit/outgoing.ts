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

/** A target's settings, e.g. statusFeed → OUTGOING_STATUSFEED_URL and OUTGOING_STATUSFEED_SECRET. */
export function targetSettings(target: string): { url: string; secret: string } {
  const name = `OUTGOING_${target.toUpperCase()}`;
  return { url: `${name}_URL`, secret: `${name}_SECRET` };
}

/**
 * Whether an address (IPv4 or IPv6) is the machine itself or a private, shared or link-local
 * network: a target there could reach what only the app's own machine should (§4.1's guard).
 */
export function privateAddress(ip: string): boolean {
  const v4 = /^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.(\d+)$/i.exec(ip);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    /^fe[89ab]/.test(v6) ||
    v6.startsWith("ff")
  );
}
