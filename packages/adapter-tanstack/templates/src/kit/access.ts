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

/** Whether the viewer may do something; `ownerId` is the owner of the record involved, if any. */
export function allows(rule: Rule, viewer: Viewer | null, ownerId?: string | null): boolean {
  if (rule.public) return true;
  if (!viewer) return false;
  if (rule.roles.includes(viewer.role)) return true;
  return rule.owner && ownerId != null && ownerId === viewer.id;
}

export function check(rule: Rule, viewer: Viewer | null, ownerId?: string | null): void {
  if (!allows(rule, viewer, ownerId)) throw new AccessDenied(viewer !== null);
}

/** Which records the viewer may read: all of them, only their own, or none. */
export function readScope(rule: Rule, viewer: Viewer | null): "all" | "own" | "none" {
  if (allows(rule, viewer)) return "all";
  return viewer && rule.owner ? "own" : "none";
}

/** For a page's beforeLoad: sends visitors to sign in, and refuses users without the role. */
export function guardPage(rule: Rule, viewer: Viewer | null, href: string): void {
  if (allows(rule, viewer)) return;
  if (!viewer) throw redirect({ href: `/sign-in?redirect=${encodeURIComponent(href)}` });
  throw new AccessDenied(true);
}
