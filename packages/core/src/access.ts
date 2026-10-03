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
}

export type ModelAllowed = Record<AccessOperation, Allowed>;

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
 * follows its model's write access (ARCHITECTURE §3), and `allow` narrows that to the roles
 * listed: the record's owner may run it only when there is no `allow`.
 */
export function actionAccess(action: ActionIR, auth: AuthIR, models: ModelIR[] = []): Allowed {
  const everyone = auth.roles.map((r) => r.name);
  if (auth.signIn === "none") return { public: false, roles: [], owner: false };
  const model = action.custom ? undefined : models.find((m) => m.name === action.on);
  if (!model)
    return { public: false, roles: withAdmin(action.allow ?? everyone, everyone), owner: false };
  const write = modelAccess(model, auth).write;
  return {
    public: false,
    roles: write.roles.filter((r) => !action.allow || r === "admin" || action.allow.includes(r)),
    owner: write.owner && !action.allow,
  };
}

/** Adds "admin", keeping the order roles are declared in. */
function withAdmin(roles: string[], everyone: string[]): string[] {
  return everyone.filter((r) => r === "admin" || roles.includes(r));
}
