// Who a new page is for, checked by rule before a plan is proposed (T760), whichever tier made it:
// a role the request's words make the page's audience ("for staff", "so staff can see") must be
// able to open a page it adds; a role only mentioned is never a reason to grant anything, and the
// note asks about it; a page only the administrator opens is said so; and a plan that only adds a
// page the app already has (the same kind of record, the same filter, for the same people) is
// answered with that page instead.
import {
  type AuthIR,
  humanize,
  type PageIR,
  type ProjectFiles,
  pageAccess,
  validateAuth,
  validateContent,
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
  const content =
    ir && files.content !== undefined
      ? validateContent({ path: "smithable.content.yml", text: files.content }, ir).content
      : undefined;
  return { ir, auth, content };
};

/** A role's name as a request may write it: itself, a plural, or a Swedish definite or plural form. */
const ENDINGS = "(?:s|es|en|et|er|erna|ens|arna|orna|na)?";

/** The roles a request mentions at all, by their own names (a role has no label of its own). */
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

/**
 * The roles a request names as the page's audience, where its words say so: for X, to X, so (that)
 * X can, X should (or can) see, get or have, X's page; Swedish för X, åt X, så att X kan, X ska (or
 * kan) se or få. A role mentioned any other way ("a page listing members, for staff": members) is
 * not one.
 */
export function rolesFor(auth: AuthIR, request: string): string[] {
  const text = request.toLowerCase();
  // For X (and Y, Z): the words after for, to, för or åt, as a list joined by commas or "and".
  const the = "(?:(?:the|our|all|every|de|alla|våra|vår)\\s+)?";
  const listed = [
    ...text.matchAll(
      new RegExp(
        `(?:^|[^\\p{L}])(?:for|to|för|åt)\\s+(${the}\\p{L}+(?:\\s*(?:,|&|\\band\\b|\\bor\\b|\\boch\\b|\\beller\\b)\\s*${the}\\p{L}+)*)`,
        "gu",
      ),
    ),
  ].flatMap((m) => m[1]?.match(/\p{L}+/gu) ?? []);
  return rolesNamed(auth, request).filter((name) => {
    const r = `${name.toLowerCase()}${ENDINGS}`;
    if (listed.some((w) => new RegExp(`^${r}$`, "u").test(w))) return true;
    return [
      `\\bso\\s+(?:that\\s+)?${the}${r}\\s+can\\b`,
      `\\b${r}\\s+(?:should|can|could|must|will|may)\\s+(?:see|get|have|use|open|read)\\b`,
      `\\b${r}'s\\s+(?:own\\s+)?page\\b`,
      `(?:^|[^\\p{L}])så\\s+att\\s+${the}${r}\\s+kan(?![\\p{L}])`,
      `(?:^|[^\\p{L}])${r}\\s+(?:ska|skall|kan|får)\\s+(?:se|få|ha|använda|öppna|läsa)(?![\\p{L}])`,
    ].some((pattern) => new RegExp(pattern, "u").test(text));
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

/**
 * Whether an operation only makes a given new page: adds it, sets its own list options, its title,
 * or puts it in a menu or in a role's pages.
 */
const onlyFor = (page: string, op: { op: string; args: Record<string, unknown> }) =>
  op.args.page === page ||
  op.op === "grant" ||
  op.op === "setNavigation" ||
  (op.op === "setText" && Array.isArray(op.args.path) && op.args.path[1] === page);

/** The rule's reading of a plan's new pages against the request and the app before it. */
export function checkAudience(
  before: ProjectFiles,
  after: ProjectFiles,
  request: string,
  operations: { op: string; args: Record<string, unknown> }[] = [],
): AudienceCheck {
  const was = parsed(before);
  const now = parsed(after);
  if (!was.ir || !now.ir || !now.auth || now.auth.signIn === "none") return undefined;
  const auth = now.auth;
  const had = new Set(was.ir.pages.map((p) => p.id));
  const added = now.ir.pages.filter((p) => !had.has(p.id));
  if (!added.length) return undefined;
  // A page as the person sees it: its title, its name in brackets.
  const titled = (p: PageIR, content = now.content) =>
    `"${content?.pages[p.id]?.title ?? humanize(p.id)}" (${p.id})`;
  const opens = (p: PageIR, role: string) => {
    const who = audience(p, auth);
    return who.everyone || who.roles.includes(role);
  };
  // 1. Each role the request makes the audience opens a page it adds (first, so that a plan which
  // left a role out is repaired before it is compared with the app's pages).
  const wanted = rolesFor(auth, request);
  const shut = wanted.filter((role) => !added.some((p) => opens(p, role)));
  if (shut.length)
    return {
      problem: `The request is for ${shut.join(" and ")}, who cannot open ${added.map((p) => `the new page ${titled(p)}`).join(" or ")}: add it to their pages (grant <role> pages <the role's pages and the new one>).`,
    };
  const notes: string[] = [];
  // 2. A page the app already has: that page instead, when the plan does nothing else; said in
  // the note when it does other things too. Not when another one was asked for.
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
      if (!twin) continue;
      const same = `The app has that page already: ${titled(twin, was.content)} at ${twin.route} lists the same records${twin.defaultFilter ? " with the same filter" : ""}, for the same people.`;
      if (operations.length && operations.every((o) => onlyFor(page.id, o)))
        return {
          answer: `${same} Open it from the menu, or ask for another page if you want a second one.`,
        };
      notes.push(same);
    }
  }
  // 3. Who can open each new page, when the request did not make that plain: a page only the
  // administrator opens, and a role it mentions without making it the audience.
  const mentioned = rolesNamed(auth, request).filter((r) => !wanted.includes(r));
  for (const p of added) {
    const who = audience(p, auth);
    if (who.everyone) continue;
    const missing = mentioned.filter((r) => !who.roles.includes(r));
    if (missing.length)
      notes.push(
        `${who.roles.join(" and ") || "Nobody"} can open the page ${titled(p)}; should ${missing.join(" and ")} too?`,
      );
    else if (!wanted.length && who.roles.length && who.roles.every((r) => r === "admin"))
      notes.push(
        `Only administrators can open the page ${titled(p)}; say who else should, and I'll add them.`,
      );
  }
  return notes.length ? { note: notes.join(" ") } : undefined;
}
