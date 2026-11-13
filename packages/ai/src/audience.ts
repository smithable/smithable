// Who a new page is for, checked by rule before a plan is proposed (T760), whichever tier made it:
// a request that names a role must leave that role able to open a page it adds; a page only the
// administrator can open is said so; and a page that is one the app already has (the same kind of
// record, the same filter, for the same people) is answered with that page instead.
import {
  type AuthIR,
  type PageIR,
  type ProjectFiles,
  pageAccess,
  validateAuth,
  validateSpec,
} from "@smithable/core";

export type AudienceCheck =
  /** The plan leaves out the access the request asked for: back to the model with this. */
  | { problem: string }
  /** The app has this page already: said instead of a second one. */
  | { answer: string }
  /** Something the person should know about the plan, said with it. */
  | { note: string }
  | undefined;

const parsed = (files: ProjectFiles) => {
  const ir = validateSpec({ path: "smithable.yml", text: files.spec }).ir;
  const auth =
    ir && files.auth !== undefined
      ? validateAuth({ path: "smithable.auth.yml", text: files.auth }, ir).auth
      : undefined;
  return { ir, auth };
};

/** A role's name as a request may write it: itself, a plural, or a Swedish definite or plural form. */
const ENDINGS = "(?:s|es|en|et|er|erna|ens|arna|orna|na)?";

/**
 * The roles a request names, by their own names (the spec's identifiers; a role has no label of
 * its own): the name, or the name with a plural or Swedish ending ("staffs", "personalen"), never a
 * longer word that merely starts with it ("membership"). Never the administrator, who opens
 * everything anyway.
 */
export function rolesNamed(auth: AuthIR, request: string): string[] {
  const words = request.toLowerCase().match(/\p{L}+/gu) ?? [];
  return auth.roles
    .map((r) => r.name)
    .filter((name) => name !== "admin")
    .filter((name) => {
      const form = new RegExp(`^${name.toLowerCase()}${ENDINGS}$`, "u");
      return words.some((w) => form.test(w));
    });
}

/** Whether a request asks for another page outright, beside one the app has. */
const another = (request: string) =>
  /\b(another|second|separate|new one anyway|en till|ytterligare|en annan|en ny till)\b/i.test(
    request,
  );

/** A value as JSON with its keys sorted, so the same filter in another order is the same. */
const sorted = (value: unknown): string =>
  JSON.stringify(
    value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : (value ?? null),
  );

/** Who opens a page: everyone, or these roles (sorted). */
const audience = (page: PageIR, auth: AuthIR) => {
  const access = pageAccess(page, auth);
  return { everyone: access.public, roles: [...access.roles].sort() };
};
const sameAudience = (a: ReturnType<typeof audience>, b: ReturnType<typeof audience>) =>
  a.everyone === b.everyone && a.roles.join() === b.roles.join();

/** The rule's reading of a plan's new pages against the request and the app before it. */
export function checkAudience(
  before: ProjectFiles,
  after: ProjectFiles,
  request: string,
): AudienceCheck {
  const was = parsed(before);
  const now = parsed(after);
  if (!was.ir || !now.ir || !now.auth || now.auth.signIn === "none") return undefined;
  const auth = now.auth;
  const had = new Set(was.ir.pages.map((p) => p.id));
  const added = now.ir.pages.filter((p) => !had.has(p.id));
  if (!added.length) return undefined;
  const opens = (p: PageIR, role: string) => {
    const who = audience(p, auth);
    return who.everyone || who.roles.includes(role);
  };
  // 1. Each role the request names opens a page it adds (first, so that a plan which left a
  // role out is repaired before it is compared with the app's pages).
  const named = rolesNamed(auth, request);
  const shut = named.filter((role) => !added.some((p) => opens(p, role)));
  if (shut.length)
    return {
      problem: `The request is for ${shut.join(" and ")}, but ${shut.join(" and ")} cannot open ${added.map((p) => `the new page ${p.id}`).join(" or ")}: add it to their pages (grant <role> pages <the role's pages and the new one>).`,
    };
  // 2. A page that is one the app already has: that page, unless another was asked for.
  if (!another(request) && was.auth) {
    const old = was.auth;
    for (const page of added) {
      if (page.pattern.kind !== "crud") continue;
      const model = page.pattern.model;
      const twin = was.ir.pages.find(
        (p) =>
          p.pattern.kind === "crud" &&
          p.pattern.model === model &&
          sorted(p.defaultFilter) === sorted(page.defaultFilter) &&
          sameAudience(audience(p, old), audience(page, auth)),
      );
      if (twin)
        return {
          answer: `The app has that page already: "${twin.id}" (${twin.route}) lists the same records${twin.defaultFilter ? " with the same filter" : ""}, for the same people. Open it from the menu, or ask for another page if you want a second one.`,
        };
    }
  }
  // 3. Nobody named: a page only the administrator opens is said so, not guessed at.
  const adminOnly = added.filter((p) => {
    const who = audience(p, auth);
    return !who.everyone && who.roles.length > 0 && who.roles.every((r) => r === "admin");
  });
  if (adminOnly.length)
    return {
      note: `Only administrators can open ${adminOnly.map((p) => `the page ${p.id}`).join(" and ")}; say who else should, and I'll add them.`,
    };
  return undefined;
}
