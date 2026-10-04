import type { AuthIR, Condition } from "./auth.js";
import {
  ACCESS_OPERATIONS,
  type AccessOperation,
  type ActionIR,
  type ModelIR,
  type PageIR,
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
  /**
   * Only users with one of these roles, whichever way they qualify (by role or as the owner):
   * a standard action's `allow`, with admin.
   */
  among?: string[];
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

/**
 * The effective access to a model: the defaults of `defaultAccess`, replaced per operation
 * by the model's `access` exceptions, plus what the public section opens (ARCHITECTURE §3.1).
 */
export function modelAccess(model: ModelIR, auth: AuthIR): ModelAllowed {
  const everyone = auth.roles.map((r) => r.name);
  const defaults: Record<AccessOperation, string[]> =
    auth.defaultAccess === "shared"
      ? { read: everyone, create: everyone, write: ["owner"], delete: ["owner"] }
      : { read: ["owner"], create: everyone, write: ["owner"], delete: ["owner"] };
  const result = {} as ModelAllowed;
  for (const op of ACCESS_OPERATIONS) {
    const listed = model.access?.[op] ?? defaults[op];
    const isPublic =
      (op === "read" && auth.public.read.includes(model.name)) ||
      (op === "create" && auth.public.create.includes(model.name));
    const where = op === "read" && isPublic ? auth.public.readWhere[model.name] : undefined;
    result[op] = {
      ...(auth.signIn === "none"
        ? { public: isPublic, roles: [], owner: false }
        : {
            public: isPublic,
            roles: withAdmin(
              listed.filter((r) => r !== "owner"),
              everyone,
            ),
            owner: listed.includes("owner"),
          }),
      ...(where ? { where } : {}),
    };
  }
  return result;
}

/**
 * Pages need sign-in unless public; `access` narrows them to roles, and a pattern may have its
 * own default (a users page is for admins).
 */
export function pageAccess(page: PageIR, auth: AuthIR): Allowed {
  const everyone = auth.roles.map((r) => r.name);
  const roles = page.access ?? patternInfo(page).access ?? everyone;
  return {
    public: auth.public.pages.includes(page.id),
    roles: auth.signIn === "none" ? [] : withAdmin(roles, everyone),
    owner: false,
  };
}

/**
 * Custom actions are for signed-in users; `allow` narrows them to roles. A standard action
 * follows its model's write access (ARCHITECTURE §3), by role or as the record's owner, and
 * `allow` narrows that to people with a listed role (`among`; admins always).
 */
export function actionAccess(action: ActionIR, auth: AuthIR, models: ModelIR[] = []): Allowed {
  const everyone = auth.roles.map((r) => r.name);
  if (auth.signIn === "none") return { public: false, roles: [], owner: false };
  const model = action.custom ? undefined : models.find((m) => m.name === action.on);
  if (!model || action.custom)
    return { public: false, roles: withAdmin(action.allow ?? everyone, everyone), owner: false };
  const write = modelAccess(model, auth).write;
  // Adding a related record also needs the right to create one (§7), and a copy that of its
  // lists' records (§8): only roles that may.
  let among = action.allow && withAdmin(action.allow, everyone);
  const lists = (action.with ?? []).map(
    (l) => (model.fields.find((f) => f.name === l)?.type as { model?: string } | undefined)?.model,
  );
  for (const name of [...(action.add ?? []).map((a) => a.model), ...lists]) {
    const added = models.find((m) => m.name === name);
    const create = added && modelAccess(added, auth).create;
    if (!create || create.public) continue;
    among = (among ?? everyone).filter((r) => create.roles.includes(r));
  }
  // A copy changes nothing: it needs to read the record (its data function checks) and to
  // create one like it, not to write the original.
  if (action.copy) {
    const create = modelAccess(model, auth).create;
    const roles = create.public ? everyone : create.roles;
    return {
      public: false,
      roles: among ? roles.filter((r) => among?.includes(r)) : roles,
      owner: false,
      ...(among ? { among } : {}),
    };
  }
  return {
    public: false,
    roles: among ? write.roles.filter((r) => among?.includes(r)) : write.roles,
    owner: write.owner,
    ...(among ? { among } : {}),
  };
}

/** Adds "admin", keeping the order roles are declared in. */
function withAdmin(roles: string[], everyone: string[]): string[] {
  return everyone.filter((r) => r === "admin" || roles.includes(r));
}
