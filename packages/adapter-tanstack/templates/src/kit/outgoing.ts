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

/** An IPv6 address written out in full (eight groups of four), so no short form slips past. */
function normalizeV6(address: string): string {
  // A zone ("fe80::1%eth0") names the interface, not the address.
  const ip = address.replace(/%.*$/, "");
  // Two "::" is no address: left as it is, so the check refuses it.
  if (!ip.includes(":") || (ip.match(/::/g) ?? []).length > 1) return ip;
  let parts = ip.toLowerCase().split(":");
  const last = parts[parts.length - 1];
  if (last?.includes(".")) {
    const v4 = last.split(".").map(Number);
    if (v4.length === 4 && v4.every((n) => n >= 0 && n <= 255)) {
      parts.pop();
      parts.push(((v4[0] ?? 0) * 256 + (v4[1] ?? 0)).toString(16));
      parts.push(((v4[2] ?? 0) * 256 + (v4[3] ?? 0)).toString(16));
    }
  }

  const emptyIndex = parts.indexOf("");
  if (emptyIndex !== -1) {
    const nonEmpties = parts.filter((p) => p !== "").length;
    const missing = 8 - nonEmpties;
    // "::" stands for at least one group: more than eight in all is no address.
    if (missing < 1) return ip;
    const before = parts.slice(0, emptyIndex).filter((p) => p !== "");
    const after = parts.slice(emptyIndex + 1).filter((p) => p !== "");
    parts = [...before, ...Array(missing).fill("0"), ...after];
  }

  if (parts.length !== 8) return ip;
  return parts.map((p) => (p || "0").padStart(4, "0")).join(":");
}

/**
 * Whether an address (IPv4 or IPv6) is the machine itself or a private, shared, link-local or
 * reserved network: a target there could reach what only the app's own machine should (§4.1's
 * guard). An IPv6 address that carries an IPv4 one is judged by that.
 */
export function privateAddress(ip: string): boolean {
  const v6 = normalizeV6(ip);
  // Not an IPv6 address written out in full: refused, never guessed at.
  if (v6.includes(":") && !/^(?:[0-9a-f]{4}:){7}[0-9a-f]{4}$/.test(v6)) return true;
  if (v6.includes(":")) {
    if (
      v6.startsWith("0000:0000:0000:0000:0000:ffff:") ||
      v6.startsWith("0064:ff9b:0000:0000:0000:0000:") ||
      v6.startsWith("0000:0000:0000:0000:ffff:0000:") ||
      (v6.startsWith("0000:0000:0000:0000:0000:0000:") &&
        v6 !== "0000:0000:0000:0000:0000:0000:0000:0001" &&
        v6 !== "0000:0000:0000:0000:0000:0000:0000:0000")
    ) {
      const parts = v6.split(":");
      const hi = Number.parseInt(parts[6] ?? "0", 16);
      const lo = Number.parseInt(parts[7] ?? "0", 16);
      ip = `${Math.floor(hi / 256)}.${hi % 256}.${Math.floor(lo / 256)}.${lo % 256}`;
    } else {
      return (
        v6 === "0000:0000:0000:0000:0000:0000:0000:0000" ||
        v6 === "0000:0000:0000:0000:0000:0000:0000:0001" ||
        v6.startsWith("fc") ||
        v6.startsWith("fd") ||
        v6.startsWith("fe8") ||
        v6.startsWith("fe9") ||
        v6.startsWith("fea") ||
        v6.startsWith("feb") ||
        v6.startsWith("ff") ||
        v6.startsWith("2001:0db8:") ||
        // 6to4 and Teredo carry an IPv4 address that may be a private one.
        v6.startsWith("2002:") ||
        v6.startsWith("0064:ff9b:0001:") ||
        v6.startsWith("2001:0000:")
      );
    }
  }

  const v4Match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  if (v4Match) {
    const [a, b, c] = [Number(v4Match[1]), Number(v4Match[2]), Number(v4Match[3])];
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
      (a ?? 0) >= 224
    );
  }
  // Neither form of address: refused, never guessed at.
  return true;
}
