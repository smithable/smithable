import type { AuthIR, Condition, GrantKey } from "./auth.js";
import {
  ACCESS_OPERATIONS,
  type AccessOperation,
  type ActionIR,
  type ModelIR,
  type PageIR,
  type UniqueScope,
} from "./ir.js";
import { patternInfo } from "./patterns.js";

/**
 * Who may do something: anyone (public), signed-in users with one of `roles`, and, for a
 * record, its owner. Admins are always in `roles` when there is sign-in.
 */
export interface Allowed {
  public: boolean;
  roles: string[];
  owner: boolean;
  /** Reading only: the records the public may read, when not all (`{ status: "published" }`). */
  where?: Condition;
}

export type ModelAllowed = Record<AccessOperation, Allowed>;

/**
 * Whether "unique" on a model means unique per owner: its records are read by their owners
 * only (for some role), so two people may each have one with the same value. Otherwise it is
 * unique across the app. The adapter's unique indexes and validation use this one test.
 */
export function uniquePerOwner(model: ModelIR, auth: AuthIR): boolean {
  const read = modelAccess(model, auth).read;
  return (
    auth.signIn !== "none" &&
    read.owner &&
    !read.public &&
    auth.roles.some((r) => !read.roles.includes(r.name))
  );
}

/** The roles whose grant `key` names `name` (or everything), admin always, in declaration order. */
function granted(auth: AuthIR, key: GrantKey, name: string): string[] {
  return auth.roles
    .filter((r) => {
      if (r.name === "admin" || r.grants === "all") return true;
      const names = r.grants[key];
      return names === "all" || (names?.includes(name) ?? false);
    })
    .map((r) => r.name);
}

/**
 * The roles that approve or reject a model's waiting pictures and files (docs/design/file-review.md):
 * admin, and those whose `review` grant names the model or is `all`.
 */
export function reviewRoles(model: string, auth: AuthIR): string[] {
  return auth.signIn === "none" ? [] : granted(auth, "review", model);
}

/**
 * The effective access to a model (docs/design/access-in-auth.md): the record rule of
 * `defaultAccess` (shared: everyone reads every record; private: their own; everyone changes
 * and deletes their own), the roles whose grants name the model, and what the public section
 * opens (ARCHITECTURE §3.1).
 */
export function modelAccess(model: ModelIR, auth: AuthIR): ModelAllowed {
  const everyone = auth.roles.map((r) => r.name);
  const result = {} as ModelAllowed;
  for (const op of ACCESS_OPERATIONS) {
    const isPublic =
      (op === "read" && auth.public.read.includes(model.name)) ||
      (op === "create" && auth.public.create.includes(model.name));
    const where = op === "read" && isPublic ? auth.public.readWhere[model.name] : undefined;
    const shared = op === "read" && auth.defaultAccess === "shared";
    result[op] = {
      ...(auth.signIn === "none"
        ? { public: isPublic, roles: [], owner: false }
        : {
            public: isPublic,
            roles: shared ? everyone : granted(auth, op, model.name),
            owner: op !== "create" && !shared,
          }),
      ...(where ? { where } : {}),
    };
  }
  return result;
}

/**
 * Pages need sign-in unless public, and a role opens the pages its `pages` grant names;
 * `all` is every page but those a pattern keeps for administrators (the users page, a data
 * page), which a role gets by naming them.
 */
export function pageAccess(page: PageIR, auth: AuthIR): Allowed {
  const reserved = patternInfo(page).access !== undefined;
  // The review page opens too for the roles granted review on any of its models.
  const reviewing = (r: AuthIR["roles"][number]) =>
    page.pattern.kind === "review" &&
    page.pattern.models.some((m) => reviewRoles(m, auth).includes(r.name));
  const roles = auth.roles
    .filter((r) => {
      if (r.name === "admin" || r.grants === "all") return true;
      const pages = r.grants.pages;
      if (reviewing(r)) return true;
      return pages === "all" ? !reserved : (pages?.includes(page.id) ?? false);
    })
    .map((r) => r.name);
  const isPublic = auth.public.pages.includes(page.id);
  return {
    public: isPublic,
    roles: auth.signIn === "none" ? [] : isPublic ? auth.roles.map((r) => r.name) : roles,
    owner: false,
  };
}

/**
 * A custom action is run by the roles whose `actions` grant names it. A standard action
 * follows its model's write access (ARCHITECTURE §3), by role or as the record's owner, and
 * is run too by the roles whose `actions` grant names it, as a page is opened by the roles whose
 * `pages` grant names it (docs/design/actions.md, 2026-10-21); one
 * that adds a related record also needs the right to create one (§7), and a copy that of its
 * lists' records (§8). A merge needs the action's grant, and write and delete on its model.
 */
export function actionAccess(action: ActionIR, auth: AuthIR, models: ModelIR[] = []): Allowed {
  if (auth.signIn === "none") return { public: false, roles: [], owner: false };
  const model = action.custom ? undefined : models.find((m) => m.name === action.on);
  if (!model || action.custom)
    return { public: false, roles: granted(auth, "actions", action.name), owner: false };
  // A merge (docs/design/intents.md §3): the action's grant, with write on the kept record and
  // delete on the other, which the generated server checks on the records themselves.
  if (action.merge) {
    const { write, delete: remove } = modelAccess(model, auth);
    const may = (a: Allowed, r: string) => a.owner || a.roles.includes(r);
    return {
      public: false,
      roles: granted(auth, "actions", action.name).filter((r) => may(write, r) && may(remove, r)),
      owner: false,
    };
  }
  const write = modelAccess(model, auth).write;
  const named = granted(auth, "actions", action.name);
  let roles = auth.roles
    .map((r) => r.name)
    .filter((r) => write.roles.includes(r) || named.includes(r));
  const lists = (action.with ?? []).map(
    (l) => (model.fields.find((f) => f.name === l)?.type as { model?: string } | undefined)?.model,
  );
  for (const name of [...(action.add ?? []).map((a) => a.model), ...lists]) {
    const added = models.find((m) => m.name === name);
    const create = added && modelAccess(added, auth).create;
    if (!create || create.public) continue;
    roles = roles.filter((r) => create.roles.includes(r));
  }
  // A copy changes nothing: it needs to read the record (its data function checks) and to
  // create one like it, not to write the original.
  if (action.copy) {
    const create = modelAccess(model, auth).create;
    return {
      public: false,
      roles: create.public ? auth.roles.map((r) => r.name) : create.roles,
      owner: false,
    };
  }
  return { public: false, roles, owner: write.owner };
}

/**
 * Where a unique field or a unique pair is unique (docs/design/uniqueness.md): `owner` (among one
 * owner's records) or `app` (in the whole app), as written, or for the short form `true` as
 * uniquePerOwner reads the access; nothing for a field that is not unique.
 */
export function uniqueScope(
  unique: boolean | UniqueScope | undefined,
  model: ModelIR,
  auth: AuthIR,
): UniqueScope | undefined {
  if (!unique) return undefined;
  if (unique === true) return uniquePerOwner(model, auth) ? "owner" : "app";
  return auth.signIn === "none" ? "app" : unique;
}
