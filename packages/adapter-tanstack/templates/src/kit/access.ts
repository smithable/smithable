// Smithable app kit: who may read, create, change and delete records, and open pages.
// Every generated data function checks access here, so the rules live in one place.
import { redirect } from "@tanstack/react-router";
import { w } from "./words";

/** The signed-in user, or null for a visitor who has not signed in. */
export interface Viewer {
  id: string;
  name: string;
  email: string;
  role: string;
  /**
   * The app itself, as a timer runs (docs/design/timed-actions.md §2): no role's grants apply, so
   * every rule allows it. Never made from a request: only the timers' tick makes one.
   */
  system?: true;
}

/** Who may do something: anyone (public), users with one of `roles`, and a record's owner. */
export interface Rule {
  public: boolean;
  roles: readonly string[];
  owner: boolean;
  /** Reading only: the records anyone may read, when not all (e.g. { status: "published" }). */
  where?: Readonly<Record<string, string | boolean | readonly string[]>>;
  /** Only users with one of these roles, whichever way they qualify (a standard action's allow). */
  among?: readonly string[];
}

export interface ModelAccess {
  read: Rule;
  create: Rule;
  write: Rule;
  delete: Rule;
}

export class AccessDenied extends Error {
  /** What the server answers with it: 403 for a signed-in person, 401 before signing in. */
  readonly status: number;
  /** `why`: the refusal in words the caller can act on, when there are better ones than "not allowed". */
  constructor(signedIn: boolean, why?: string) {
    super(why ?? (signedIn ? w.notAllowed : w.signInFirst));
    this.name = "AccessDenied";
    this.status = signedIn ? 403 : 401;
  }
}

/** A refusal, also once it has crossed from the server as plain data (its name kept). */
export const isRefusal = (error: unknown): boolean =>
  error instanceof AccessDenied || (error instanceof Error && error.name === "AccessDenied");

/** A change the database refused, as a code the form turns into words: "taken:<column>" or "in-use". */
export class Conflict extends Error {}

/**
 * The person a viewer is, for owning records: their user id, or null for an API key, which is a
 * role and not a person (docs/design/integrations.md §2), and for the app itself (a timer).
 */
export function personOf(viewer: Viewer | null): string | null {
  return viewer && !viewer.system && !viewer.id.startsWith("key:") ? viewer.id : null;
}

/** Whether the viewer may do something; `ownerId` is the owner of the record involved, if any. */
export function allows(rule: Rule, viewer: Viewer | null, ownerId?: string | null): boolean {
  if (rule.public || viewer?.system) return true;
  if (!viewer) return false;
  if (rule.among && !rule.among.includes(viewer.role)) return false;
  if (rule.roles.includes(viewer.role)) return true;
  return rule.owner && ownerId != null && ownerId === viewer.id;
}

export function check(rule: Rule, viewer: Viewer | null, ownerId?: string | null): void {
  if (!allows(rule, viewer, ownerId)) throw new AccessDenied(viewer !== null);
}

/** Which records the viewer may read: all of them, only their own, or none. */
/**
 * Which records the viewer may read: all of them, their own (and the public ones where the
 * rule limits those), only the public ones, or none.
 */
export function readScope(rule: Rule, viewer: Viewer | null): "all" | "own" | "public" | "none" {
  if (viewer && (viewer.system || rule.roles.includes(viewer.role))) return "all";
  if (rule.public && !rule.where) return "all";
  if (viewer && rule.owner) return "own";
  return rule.public ? "public" : "none";
}

/** For a page's beforeLoad: sends visitors to sign in, and refuses users without the role. */
export function guardPage(rule: Rule, viewer: Viewer | null, href: string): void {
  if (allows(rule, viewer)) return;
  if (!viewer) throw redirect({ href: `/sign-in?redirect=${encodeURIComponent(href)}` });
  throw new AccessDenied(true);
}
