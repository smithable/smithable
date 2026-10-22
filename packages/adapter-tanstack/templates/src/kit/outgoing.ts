// Smithable app kit: the rules of outgoing mail (docs/design/integrations.md §4.1b) that need
// nothing but values: which change counts, and how long to wait before trying again.

const MINUTE = 60_000;

/**
 * Whether an entry counts for what happened (`what`: created, deleted, changed or an action's
 * name). With a condition, a creation, deletion or action counts when the record fits it, and a
 * change when the record fits after it and did not before; an action's change is a change too.
 * With `fields`, a change counts only when one of them has another value than before.
 */
export function counts(
  when: string,
  what: string,
  fits: ((record: Record<string, unknown>) => boolean) | undefined,
  record: Record<string, unknown>,
  before?: Record<string, unknown>,
  fields?: string[],
): boolean {
  if (when === "changed") {
    if (what === "created" || what === "deleted") return false;
    if (fields && before && !fields.some((f) => !same(record[f], before[f]))) return false;
    return !fits || (fits(record) && !(before && fits(before)));
  }
  return what === when && (!fits || fits(record));
}

/** Whether two stored values are the same; a date by its instant. */
function same(a: unknown, b: unknown): boolean {
  return a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
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
 * The IPv4 address inside an IPv6 one that only carries it (::ffff:a.b.c.d, ::ffff:7f00:1, the
 * NAT64 prefix 64:ff9b::, the old ::a.b.c.d), as a.b.c.d; or nothing.
 */
function carriedV4(ip: string): string | undefined {
  const m =
    /^(?:::ffff:|64:ff9b::|::)(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/i.exec(ip);
  if (!m) return undefined;
  if (m[1]) return m[1];
  const [hi, lo] = [Number.parseInt(m[2] ?? "", 16), Number.parseInt(m[3] ?? "", 16)];
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

/**
 * Whether an address (IPv4 or IPv6) is the machine itself or a private, shared, link-local or
 * reserved network: a target there could reach what only the app's own machine should (§4.1's
 * guard). An IPv6 address that carries an IPv4 one is judged by that.
 */
export function privateAddress(ip: string): boolean {
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(carriedV4(ip) ?? ip);
  if (v4) {
    const [a, b, c] = [Number(v4[1]), Number(v4[2]), Number(v4[3])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
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
    v6.startsWith("ff") ||
    // Documentation addresses, and any other IPv4 carrier not read above.
    v6.startsWith("2001:db8:") ||
    v6.startsWith("::ffff:") ||
    v6.startsWith("64:ff9b:")
  );
}
