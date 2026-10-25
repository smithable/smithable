// The Who can tab's reading of smithable.auth.yml (docs/design/who-can.md §3): what a cell
// shows, the list a tick writes, and the four warnings it shows in place. Pure, so it is tested
// alone; the validator keeps its own copy of the same rules, with line numbers.
import {
  type AuthIR,
  GRANT_KEYS,
  type GrantKey,
  type GrantNames,
  humanize,
  type PageIR,
  patternInfo,
  plural,
  type RoleGrants,
  type SpecIR,
  USER_MODEL,
} from "@smithable/core";

/** A page a pattern keeps for administrators (users, data): `pages: all` leaves it out. */
export const adminPage = (page: PageIR) => patternInfo(page).access !== undefined;

/** The names a grant of this kind chooses from, in the spec's order. */
export function grantChoices(ir: SpecIR, key: GrantKey): string[] {
  if (key === "pages") return ir.pages.map((p) => p.id);
  if (key === "actions") return ir.actions.filter((a) => a.custom).map((a) => a.name);
  if (key === "review") return ir.models.filter((m) => m.review?.length).map((m) => m.name);
  return ir.models.map((m) => m.name);
}

/** What `all` covers today: every name, but for pages not the administrators'. */
function allOf(ir: SpecIR, key: GrantKey): string[] {
  const names = grantChoices(ir, key);
  return key === "pages" ? names.filter((n) => !isAdminPage(ir, n)) : names;
}

const isAdminPage = (ir: SpecIR, id: string) => {
  const page = ir.pages.find((p) => p.id === id);
  return page ? adminPage(page) : false;
};

/** Whether a role's grants include this name. */
export function granted(
  ir: SpecIR,
  grants: "all" | RoleGrants,
  key: GrantKey,
  name: string,
): boolean {
  if (grants === "all") return true;
  const names = grants[key];
  if (names === "all") return key !== "pages" || !isAdminPage(ir, name);
  return names?.includes(name) ?? false;
}

/**
 * The grant's names after one tick: written whole, in the spec's order; under `all` an untick
 * writes the rest, and `["none"]` stands for nothing.
 */
export function ticked(
  ir: SpecIR,
  names: GrantNames | undefined,
  key: GrantKey,
  name: string,
  on: boolean,
): string[] {
  const now = names === "all" ? allOf(ir, key) : (names ?? []);
  const next = grantChoices(ir, key).filter((n) => (n === name ? on : now.includes(n)));
  return next.length ? next : ["none"];
}

/**
 * The "all" header of a group: `all` (also ones added later), `every` (each one ticked by hand,
 * not ones added later: a dash), or `some`.
 */
export function headerState(
  ir: SpecIR,
  names: GrantNames | undefined,
  key: GrantKey,
): "all" | "every" | "some" {
  if (names === "all") return "all";
  const every = allOf(ir, key);
  return every.length > 0 && every.every((n) => names?.includes(n)) ? "every" : "some";
}

const VERBS: Record<GrantKey, string> = {
  pages: "open",
  read: "see everyone's",
  create: "add",
  write: "change everyone's",
  delete: "delete everyone's",
  actions: "run",
  review: "approve the files of",
};

/** The sentence a cell says on hover, as the summary would word it. */
export function cellSentence(who: string, key: GrantKey, name: string, on: boolean): string {
  const thing =
    key === "pages"
      ? `the ${humanize(name).toLowerCase()} page`
      : key === "actions"
        ? humanize(name).toLowerCase()
        : humanize(plural(name)).toLowerCase();
  return `${who} ${on ? "may" : "may not"} ${VERBS[key]} ${thing}`;
}

export type GridWarning =
  | { kind: "write-without-read"; role: string; key: "write" | "delete"; model: string }
  | { kind: "role-opens-nothing"; role: string }
  | { kind: "public-personal-data"; model: string; fields: string[] }
  | { kind: "public-page-closed-records"; page: string; models: string[] };

/** The same personal data the validator keeps from anyone on the internet. */
const personalFields = (ir: SpecIR, model: string) =>
  (ir.models.find((m) => m.name === model)?.fields ?? [])
    .filter(
      (f) =>
        (f.type.kind === "scalar" && (f.type.name === "email" || f.type.name === "phone")) ||
        (f.type.kind === "relation" && f.type.model === USER_MODEL),
    )
    .map((f) => f.name);

/**
 * The four warnings the grid shows beside its cells (the validator's write-without-read,
 * role-opens-nothing, public-personal-data and public-page-closed-records), read from the files.
 */
export function gridWarnings(ir: SpecIR, auth: AuthIR): GridWarning[] {
  const warnings: GridWarning[] = [];
  const models = ir.models.map((m) => m.name);
  const offered = !auth.api
    ? []
    : auth.api.models === "all"
      ? models.filter((m) => !auth.api?.except.includes(m))
      : auth.api.models;
  const closed = ir.pages.some((p) => !auth.public.pages.includes(p.id));
  for (const role of auth.roles) {
    if (role.name === "admin" || role.grants === "all") continue;
    const grants = role.grants;
    if (auth.defaultAccess === "private")
      for (const key of ["write", "delete"] as const)
        for (const model of models)
          if (granted(ir, grants, key, model) && !granted(ir, grants, "read", model))
            warnings.push({ kind: "write-without-read", role: role.name, key, model });
    // A role for keys (granted something on a model the API offers) needs no page.
    const keyed = (["read", "create", "write", "delete"] as const).some((k) =>
      offered.some((m) => granted(ir, grants, k, m)),
    );
    const opens = grants.pages === "all" || (grants.pages?.length ?? 0) > 0;
    if (auth.signIn !== "none" && closed && !opens && !keyed)
      warnings.push({ kind: "role-opens-nothing", role: role.name });
  }
  for (const model of auth.public.read) {
    const fields = personalFields(ir, model);
    if (fields.length) warnings.push({ kind: "public-personal-data", model, fields });
  }
  for (const id of auth.public.pages) {
    const page = ir.pages.find((p) => p.id === id);
    if (!page || page.mine) continue;
    const shut = [...new Set(patternInfo(page).models())].filter(
      (m) => m !== USER_MODEL && !auth.public.read.includes(m),
    );
    if (shut.length) warnings.push({ kind: "public-page-closed-records", page: id, models: shut });
  }
  return warnings;
}

/** A warning in the tab's words, with what to do. */
export function warningText(w: GridWarning): string {
  switch (w.kind) {
    case "write-without-read":
      return `Tick See too, or ${w.role} cannot open the ${humanize(plural(w.model)).toLowerCase()} they may ${w.key === "write" ? "change" : "delete"}.`;
    case "role-opens-nothing":
      return `${w.role} opens no page yet: tick the pages they use.`;
    case "public-personal-data":
      return `Anyone on the internet can read ${w.fields.join(", ")}.`;
    case "public-page-closed-records":
      return `Anyone may open this page but not read ${w.models.map((m) => humanize(plural(m)).toLowerCase()).join(" or ")}, so it shows them none.`;
  }
}

/** Names as a list in words: "customers, orders and invoices". */
const listed = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");

/** The things a grant names, in words: pages, actions or kinds of record. */
const things = (key: GrantKey, names: string[]) =>
  key === "pages"
    ? `the ${listed(names.map((n) => humanize(n).toLowerCase()))} page${names.length > 1 ? "s" : ""}`
    : listed(
        names.map((n) =>
          key === "actions" ? humanize(n).toLowerCase() : humanize(plural(n)).toLowerCase(),
        ),
      );

/** What a role may do, in one sentence: Who can's simple view (A 166). */
export function roleSentence(ir: SpecIR, grants: "all" | RoleGrants): string {
  if (grants === "all") return "May do everything.";
  const parts = GRANT_KEYS.flatMap((key) => {
    const names = grantChoices(ir, key).filter((n) => granted(ir, grants, key, n));
    return names.length ? [`${VERBS[key]} ${things(key, names)}`] : [];
  });
  return parts.length ? `May ${parts.join("; ")}.` : "May do nothing beyond their own records.";
}

/** What a visitor who has not signed in may do, in one sentence. */
export function visitorSentence(auth: AuthIR): string {
  const { pages, read, create } = auth.public;
  const parts = [
    pages.length > 0 && `open ${things("pages", pages)}`,
    read.length > 0 && `see ${things("read", read)}`,
    create.length > 0 && `add ${things("create", create)}`,
  ].filter(Boolean);
  return parts.length ? `May ${parts.join("; ")}.` : "Nothing without signing in.";
}
