// Smithable app kit: how often one person, or one address, may write. Sign-in and its callbacks
// are limited by Better Auth itself (3 attempts per 10 seconds in production); this covers the
// app's own server functions: creating, changing and deleting records, booking, inviting, and
// the sign-in codes it mails.
// Counts live in memory: the app runs as one process, so that is the whole picture.
import { getRequestIP } from "@tanstack/react-start/server";
import { addressKey } from "./address.server";
import { w } from "./words";

/** Refused because of how often, not because of who: the words are shown as they are. */
export class TooMany extends Error {
  constructor(what: string) {
    super(w.tooMany(what));
  }
}

/** How many of each within how many seconds. */
export const LIMITS = {
  /** Writes by a signed-in person. */
  writes: { max: 60, seconds: 60 },
  /** Writes by a visitor (a contact form), per address. */
  visitorWrites: { max: 10, seconds: 60 },
  /** Invitations sent by one administrator. */
  invitations: { max: 20, seconds: 3600 },
  /** Sign-in codes mailed to one address. */
  codes: { max: 5, seconds: 3600 },
  /** Sign-in codes asked for from one network address. */
  codesFromAddress: { max: 20, seconds: 3600 },
  /** Questions to Ask that the host's model answers, by one person. */
  questions: { max: 30, seconds: 900 },
};

/** A count, its window's end, and its limit's own ceiling (limits differ: 5 codes, 60 calls). */
type Counts = Map<string, { n: number; until: number; max: number }>;
/**
 * Two lists: the counts of signed-in people (by their id), and those of strangers (by address,
 * or by the mail address a sign-in code is asked for). Strangers can make new keys at will; they
 * fill only their own list, never the one signed-in people's writes are counted in.
 */
const people: Counts = new Map();
const strangers: Counts = new Map();
/** When each list's expired counts were last dropped: at most once a second, not every request. */
const pruned = new Map<Counts, number>();
/** How many counts a list holds at most. */
const MAX_KEYS = 50_000;

/**
 * Room for a new key in a full list: the expired counts go first, then a tenth of the list, the
 * least full against their own limits first and of those the soonest to end. A flood of new keys is mostly low counts,
 * so it pushes out mostly its own, and the counts nearest their limit are the last to go; a full
 * list never refuses everyone new, and the sorting is done once per tenth, not per request.
 */
function room(counts: Counts, now: number): void {
  if (counts.size < MAX_KEYS) return;
  for (const [k, v] of counts) if (v.until <= now) counts.delete(k);
  if (counts.size < MAX_KEYS) return;
  // How full each count is, against its own limit: one at its limit goes last, so pushing out
  // a flood's keys never clears the limit someone (a mailbox's codes) has reached.
  const order = [...counts].sort(([, a], [, b]) => a.n / a.max - b.n / b.max || a.until - b.until);
  for (const [k] of order.slice(0, MAX_KEYS / 10)) counts.delete(k);
}

/**
 * One more `what` under `key`, or TooMany when `max` happened within `seconds`. A key of a
 * signed-in person (`person`) is counted apart from strangers' keys.
 */
export function count(
  key: string,
  { max, seconds }: { max: number; seconds: number },
  what: string,
  now = Date.now(),
  person = false,
): void {
  const counts = person ? people : strangers;
  if (counts.size > 10_000 && now - (pruned.get(counts) ?? 0) >= 1000) {
    pruned.set(counts, now);
    for (const [k, v] of counts) if (v.until <= now) counts.delete(k);
  }
  const entry = counts.get(key);
  if (!entry || entry.until <= now) {
    // Bounded even under a flood of new keys within the hour.
    if (!entry) room(counts, now);
    counts.set(key, { n: 1, until: now + seconds * 1000, max });
    return;
  }
  if (entry.n >= max) throw new TooMany(what);
  entry.n += 1;
}

/**
 * The address a request came from: behind a proxy that says who the visitor is (TRUST_PROXY=1,
 * e.g. the hosted service) the last hop of X-Forwarded-For, the one that proxy added; otherwise
 * the connection's own, since anyone could send a new X-Forwarded-For (or X-Real-IP) with every
 * request and so escape every limit. As in server.mjs and address.server.ts; "unknown" when
 * nothing says. As the limits count it: an IPv6 address by its /64 (addressKey).
 */
export function address(headers: Pick<Headers, "get">): string {
  const forwarded =
    process.env.TRUST_PROXY === "1"
      ? headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
      : undefined;
  return addressKey(forwarded || getRequestIP() || "unknown");
}

/** Counts a write by the viewer, or by the visitor's address (from the request's headers). */
export function writeAllowed(viewer: { id: string } | null, headers: Headers): void {
  if (viewer) count(`write:${viewer.id}`, LIMITS.writes, w.changes, Date.now(), true);
  else count(`write:${address(headers)}`, LIMITS.visitorWrites, w.submissions);
}

/** Counts an invitation sent by the viewer. */
export function inviteAllowed(viewer: { id: string } | null): void {
  if (viewer) count(`invite:${viewer.id}`, LIMITS.invitations, w.invitations, Date.now(), true);
}

/** Counts a sign-in code mailed to the address, asked for from the request's network address. */
export function codeAllowed(email: string, headers: Headers): void {
  // The network address first: one past its own limit spends none of an email's codes.
  count(`code-from:${address(headers)}`, LIMITS.codesFromAddress, "sign-in codes");
  // The same address however it is written.
  count(`code:${email.trim().toLowerCase()}`, LIMITS.codes, w.signInCodes);
}
