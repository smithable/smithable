// Smithable app kit: how often one person, or one address, may write. Sign-in and its callbacks
// are limited by Better Auth itself (3 attempts per 10 seconds in production); this covers the
// app's own server functions: creating, changing and deleting records, booking, inviting, and
// the sign-in codes it mails.
// Counts live in memory: the app runs as one process, so that is the whole picture.
import { getRequestIP } from "@tanstack/react-start/server";
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
};

const counts = new Map<string, { n: number; until: number }>();
/** When the expired counts were last dropped: at most once a second, not on every request. */
let pruned = 0;

/** One more `what` under `key`, or TooMany when `max` happened within `seconds`. */
export function count(
  key: string,
  { max, seconds }: { max: number; seconds: number },
  what: string,
  now = Date.now(),
): void {
  if (counts.size > 10_000 && now - pruned >= 1000) {
    pruned = now;
    for (const [k, v] of counts) if (v.until <= now) counts.delete(k);
  }
  // Bounded even under a flood of new addresses within the hour: while it is full, a new key
  // is refused for the window, and no live count is dropped (which would clear its limit).
  if (counts.size >= 50_000 && !counts.has(key)) throw new TooMany(what);
  const entry = counts.get(key);
  if (!entry || entry.until <= now) {
    counts.set(key, { n: 1, until: now + seconds * 1000 });
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
 * nothing says.
 */
export function address(headers: Pick<Headers, "get">): string {
  const forwarded =
    process.env.TRUST_PROXY === "1"
      ? headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
      : undefined;
  return forwarded || getRequestIP() || "unknown";
}

/** Counts a write by the viewer, or by the visitor's address (from the request's headers). */
export function writeAllowed(viewer: { id: string } | null, headers: Headers): void {
  if (viewer) count(`write:${viewer.id}`, LIMITS.writes, w.changes);
  else count(`write:${address(headers)}`, LIMITS.visitorWrites, w.submissions);
}

/** Counts an invitation sent by the viewer. */
export function inviteAllowed(viewer: { id: string } | null): void {
  if (viewer) count(`invite:${viewer.id}`, LIMITS.invitations, w.invitations);
}

/** Counts a sign-in code mailed to the address, asked for from the request's network address. */
export function codeAllowed(email: string, headers: Headers): void {
  // The network address first: one past its own limit spends none of an email's codes.
  count(`code-from:${address(headers)}`, LIMITS.codesFromAddress, "sign-in codes");
  // The same address however it is written.
  count(`code:${email.trim().toLowerCase()}`, LIMITS.codes, w.signInCodes);
}
