// Who a new page is for, checked by rule before a plan is proposed (T760), whichever tier made it:
// a request that names a role must leave that role able to open the pages it adds; a page only the
// administrator can open is said so; and a page that is one the app already has (the same kind of
// record, the same filter, for the same people) is answered with that page instead.
import {
  type AuthIR,
  type PageIR,
  type ProjectFiles,
  pageAccess,
  type SpecIR,
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

/**
 * The roles a request names, by their own names (the spec's identifiers; a role has no label of
 * its own): a word that is the name or starts with it (plural "staffs", Swedish "personalen").
 * Never the administrator, who opens everything anyway.
 */
export function rolesNamed(auth: AuthIR, request: string): string[] {
  const words = request.toLowerCase().match(/\p{L}+/gu) ?? [];
  return auth.roles
    .map((r) => r.name)
    .filter((name) => name !== "admin")
    .filter((name) => {
      const role = name.toLowerCase();
      return words.some((w) => w === role || (role.length >= 4 && w.startsWith(role)));
    });
}

/** Whether a request asks for another page outright, beside one the app has. */
const another = (request: string) =>
  /\b(another|second|separate|new one anyway|en till|ytterligare|en annan|en ny till)\b/i.test(
    request,
  );

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Who opens a page, as a sorted list (or "public"). */
const audience = (page: PageIR, auth: AuthIR) => {
  const access = pageAccess(page, auth);
  return access.public ? ["public"] : [...access.roles].sort();
};

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
  // 1. A page that is one the app already has: that page, unless another was asked for.
  if (!another(request) && was.auth) {
    for (const page of added) {
      if (page.pattern.kind !== "crud") continue;
      const model = page.pattern.model;
      const twin = (was.ir as SpecIR).pages.find(
        (p) =>
          p.pattern.kind === "crud" &&
          p.pattern.model === model &&
          same(p.defaultFilter, page.defaultFilter) &&
          same(audience(p, was.auth as AuthIR), audience(page, auth)),
      );
      if (twin)
        return {
          answer: `The app has that page already: "${twin.id}" (${twin.route}) lists the same records${twin.defaultFilter ? ` with the same filter` : ""}, for the same people. Open it from the menu, or ask for another page if you want a second one.`,
        };
    }
  }
  // 2. A role the request names opens every page it adds.
  const named = rolesNamed(auth, request);
  const shut = named.flatMap((role) =>
    added
      .filter((p) => !audience(p, auth).includes(role) && !audience(p, auth).includes("public"))
      .map((p) => ({ role, page: p.id })),
  );
  if (shut.length)
    return {
      problem: `The request is for ${[...new Set(shut.map((s) => s.role))].join(" and ")}, but ${shut
        .map((s) => `${s.role} cannot open the new page ${s.page}`)
        .join(
          "; ",
        )}: add the page to their pages (grant <role> pages <the role's pages and the new one>).`,
    };
  // 3. Nobody named: a page only the administrator opens is said so, not guessed at.
  const adminOnly = added.filter((p) => {
    const who = audience(p, auth);
    return !who.includes("public") && who.every((r) => r === "admin");
  });
  if (adminOnly.length)
    return {
      note: `Only administrators can open ${adminOnly.map((p) => `the page ${p.id}`).join(" and ")}; say who else should, and I'll add them.`,
    };
  return undefined;
}
