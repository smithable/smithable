// Smithable app kit: who may read, create, change and delete records, and open pages.
// Every generated data function checks access here, so the rules live in one place.
import { redirect } from "@tanstack/react-router";

/** The signed-in user, or null for a visitor who has not signed in. */
export interface Viewer {
  id: string;
  name: string;
  email: string;
  role: string;
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
  constructor(signedIn: boolean) {
    super(signedIn ? "You are not allowed to do this." : "Please sign in first.");
  }
}

/** A change the database refused, as a code the form turns into words: "taken:<column>" or "in-use". */
export class Conflict extends Error {}

/**
 * A database error as people may see it: a unique value already taken, or a record still in
 * use. Anything else stays in the server's log; the page gets a plain apology.
 */
export function refusal(error: unknown): Error {
  const message = error instanceof Error ? error.message : "";
  // With several columns (unique per owner), the last one is the field.
  const column = /UNIQUE constraint failed: (?:\w+\.\w+, )*\w+\.(\w+)/.exec(message)?.[1];
  if (column) return new Conflict(`taken:${column}`);
  if (message.includes("FOREIGN KEY constraint failed")) return new Conflict("in-use");
  console.error(error);
  return new Error("Something went wrong. Please try again.");
}

/** Whether the viewer may do something; `ownerId` is the owner of the record involved, if any. */
export function allows(rule: Rule, viewer: Viewer | null, ownerId?: string | null): boolean {
  if (rule.public) return true;
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
  if (viewer && rule.roles.includes(viewer.role)) return "all";
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
