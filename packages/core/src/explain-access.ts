// Why someone may or may not do something (docs/design/explain-access.md): one answer, computed
// from the same functions the generated apps enforce (pageAccess, modelAccess, actionAccess and
// the public conditions), never from a second reading of the files. Studio's Who can asks it for
// a cell's "Why?", an assistant for "why can X do Y". Each reason names the setting that decided
// it as a path in its file, so the asker can be taken there.
import { actionAccess, modelAccess, pageAccess, reviewRoles } from "./access.js";
import type { AuthIR, GrantKey, RoleIR } from "./auth.js";
import { conditionText } from "./condition.js";
import type {
  AccessOperation,
  Condition,
  ModelIR,
  PageIR,
  SpecIR,
  StandardActionIR,
} from "./ir.js";
import { capitalize, humanize, plural } from "./naming.js";
import { patternInfo } from "./patterns.js";

/** Who asks, and about which record. */
export interface AccessScenario {
  /** Signed in with this role; left out, a visitor who has not signed in. */
  as?: string;
  /** About one record: whose it is. Left out, the records in general (a list, no record chosen). */
  record?: "own" | "another's" | "ownerless";
  /**
   * The record's values a condition may read (a public `where`, an action's `when`); a field
   * left out is unknown, and the answer is then conditional on it.
   */
  values?: Record<string, string | boolean | null | undefined>;
}

export type AccessResource =
  | { kind: "page"; page: string }
  | { kind: "model"; model: string }
  | { kind: "action"; action: string };

/** `open` a page; read, create, write or delete a model's records, or `review` their files; `run` an action. */
export type AccessVerb = "open" | AccessOperation | "review" | "run";

export interface AccessReason {
  /** The setting that decided it: its file and the path in it (`roles.member.create`, `public.read`, `defaultAccess`, `actions.markSent.when`). */
  at: { file: "smithable.auth.yml" | "smithable.yml"; path: string };
  /** One sentence. */
  text: string;
}

export interface AccessExplanation {
  /** `conditional`: it depends on the record (whose it is, or its values), which the scenario did not say. */
  verdict: "allowed" | "denied" | "conditional";
  /** In the order the rules apply; the last decided it. */
  reasons: AccessReason[];
}

const inAuth = (path: string, text: string): AccessReason => ({
  at: { file: "smithable.auth.yml", path },
  text,
});
const inSpec = (path: string, text: string): AccessReason => ({
  at: { file: "smithable.yml", path },
  text,
});
const allowed = (...reasons: AccessReason[]): AccessExplanation => ({
  verdict: "allowed",
  reasons,
});
const denied = (...reasons: AccessReason[]): AccessExplanation => ({ verdict: "denied", reasons });
const conditional = (...reasons: AccessReason[]): AccessExplanation => ({
  verdict: "conditional",
  reasons,
});

const records = (model: string) => humanize(plural(model)).toLowerCase();
const record = (model: string) => humanize(model).toLowerCase();
const pageName = (id: string) => `the ${humanize(id).toLowerCase()} page`;
const actionName = (name: string) => humanize(name).toLowerCase();

/**
 * Why a role or a visitor may or may not do something, from the same rules the generated app
 * enforces. Throws on a name the spec or the auth file does not have, or a verb the resource
 * does not take.
 */
export function explainAccess(
  ir: SpecIR,
  auth: AuthIR,
  scenario: AccessScenario,
  resource: AccessResource,
  verb: AccessVerb,
): AccessExplanation {
  const role =
    scenario.as === undefined ? undefined : auth.roles.find((r) => r.name === scenario.as);
  if (scenario.as !== undefined && !role)
    throw new Error(`There is no role named "${scenario.as}".`);
  switch (resource.kind) {
    case "page": {
      const page = ir.pages.find((p) => p.id === resource.page);
      if (!page) throw new Error(`There is no page named "${resource.page}".`);
      if (verb !== "open") throw new Error(`A page is opened, not ${verb}.`);
      return explainPage(page, auth, role);
    }
    case "model": {
      const model = ir.models.find((m) => m.name === resource.model);
      if (!model) throw new Error(`There is no model named "${resource.model}".`);
      if (verb === "open" || verb === "run")
        throw new Error(`Records are not ${verb}: read, create, write, delete or review them.`);
      return explainModel(model, auth, role, scenario, verb);
    }
    case "action": {
      const action = ir.actions.find((a) => a.name === resource.action);
      if (!action) throw new Error(`There is no action named "${resource.action}".`);
      if (verb !== "run") throw new Error(`An action is run, not ${verb}.`);
      return explainAction(action, ir, auth, role, scenario);
    }
  }
}

/** The reason a role has a grant: administrators, `all` on the role, `all` in the grant, or the name in it. */
function whyGranted(
  role: RoleIR,
  key: GrantKey,
  name: string,
  what: string,
): AccessReason | undefined {
  if (role.name === "admin") return inAuth("roles.admin", "Administrators do everything.");
  if (role.grants === "all")
    return inAuth(`roles.${role.name}`, `${role.name} is granted all: the whole app.`);
  const names = role.grants[key];
  if (names === "all")
    return inAuth(
      `roles.${role.name}.${key}`,
      `${role.name}'s ${key} grant is all, which covers ${what}.`,
    );
  if (names?.includes(name))
    return inAuth(`roles.${role.name}.${key}`, `${role.name}'s ${key} grant names ${name}.`);
  return undefined;
}

const notGranted = (role: RoleIR, key: GrantKey, name: string): AccessReason =>
  inAuth(`roles.${role.name}.${key}`, `${role.name}'s ${key} grant does not name ${name}.`);

/** Whose the record is, as the scenario says. */
function whose(model: ModelIR, kind: NonNullable<AccessScenario["record"]>): AccessReason {
  const path = `models.${model.name}${model.ownedBy ? ".ownedBy" : ""}`;
  const owner = model.ownedBy ? `its ${humanize(model.ownedBy).toLowerCase()}` : "its owner";
  if (kind === "own")
    return inSpec(path, `This ${record(model.name)} is their own: they are ${owner}.`);
  if (kind === "another's")
    return inSpec(
      path,
      `This ${record(model.name)} is someone else's: ${owner} is another person.`,
    );
  return inSpec(path, `This ${record(model.name)} has no owner.`);
}

/**
 * Whether the values fit the condition, as the generated app tests a stored row (a yes/no field
 * that is false or empty is no); undefined while a field it reads is unknown.
 */
function fits(condition: Condition, values: AccessScenario["values"]): boolean | undefined {
  let unknown = false;
  for (const [field, wanted] of Object.entries(condition)) {
    const value = values?.[field];
    if (value === undefined) {
      unknown = true;
      continue;
    }
    const ok =
      typeof wanted === "boolean"
        ? wanted
          ? value === true
          : !value
        : Array.isArray(wanted)
          ? wanted.includes(String(value))
          : value === wanted;
    if (!ok) return false;
  }
  return unknown ? undefined : true;
}

/** The answer once a condition is the last word: decided by the values, or conditional on them. */
function onCondition(
  reasons: AccessReason[],
  condition: Condition,
  scenario: AccessScenario,
  model: string,
  at: AccessReason["at"],
  only: string,
): AccessExplanation {
  const fit = fits(condition, scenario.values);
  const text = conditionText(condition);
  if (fit === true)
    return allowed(...reasons, { at, text: `This ${record(model)} fits: ${text}.` });
  if (fit === false)
    return denied(...reasons, {
      at,
      text: `This ${record(model)} does not fit: ${only} only where ${text}.`,
    });
  return conditional(...reasons, { at, text: `${capitalize(only)} only where ${text}.` });
}

function explainPage(page: PageIR, auth: AuthIR, role: RoleIR | undefined): AccessExplanation {
  const a = pageAccess(page, auth);
  const name = pageName(page.id);
  if (a.public)
    return allowed(
      inAuth(
        "public.pages",
        `Anyone may open ${name} without signing in: public.pages names ${page.id}.`,
      ),
    );
  if (!role)
    return denied(
      inAuth(
        "public.pages",
        `Opening ${name} needs signing in: public.pages does not name ${page.id}.`,
      ),
    );
  if (role.name === "admin" || role.grants === "all")
    return allowed(whyGranted(role, "pages", page.id, name) as AccessReason);
  if (role.grants.pages === "all" && patternInfo(page).access !== undefined)
    return denied(
      inAuth(
        `roles.${role.name}.pages`,
        `${role.name}'s pages grant is all, which leaves out the pages kept for administrators, ${name} among them; a role opens one by naming it.`,
      ),
    );
  const why = whyGranted(role, "pages", page.id, name);
  if (why) return allowed(why);
  // The review page opens for the roles that approve files of any of its models.
  if (page.pattern.kind === "review") {
    const reviewed = page.pattern.models.find((m) => reviewRoles(m, auth).includes(role.name));
    if (reviewed)
      return allowed(
        inAuth(
          `roles.${role.name}.review`,
          `${role.name} approves the files of ${records(reviewed)}, so it opens ${name}.`,
        ),
      );
  }
  return denied(notGranted(role, "pages", page.id));
}

function explainModel(
  model: ModelIR,
  auth: AuthIR,
  role: RoleIR | undefined,
  scenario: AccessScenario,
  verb: AccessOperation | "review",
): AccessExplanation {
  if (verb === "review") return explainReview(model, auth, role);
  if (verb === "read") return explainRead(model, auth, role, scenario);
  if (verb === "create") return explainCreate(model, auth, role);
  return explainChange(model, auth, role, scenario, verb);
}

function explainReview(model: ModelIR, auth: AuthIR, role: RoleIR | undefined): AccessExplanation {
  const what = `the files of ${records(model.name)}`;
  if (!model.review?.length)
    return denied(
      inSpec(`models.${model.name}`, `${humanize(plural(model.name))} have no files to approve.`),
    );
  if (!role)
    return denied(
      inAuth("roles", `Approving ${what} needs signing in: a role's review grant says who.`),
    );
  if (reviewRoles(model.name, auth).includes(role.name))
    return allowed(whyGranted(role, "review", model.name, what) as AccessReason);
  return denied(notGranted(role, "review", model.name));
}

function explainRead(
  model: ModelIR,
  auth: AuthIR,
  role: RoleIR | undefined,
  scenario: AccessScenario,
): AccessExplanation {
  const a = modelAccess(model, auth).read;
  const what = records(model.name);
  const whereAt = { file: "smithable.auth.yml" as const, path: `public.read.${model.name}.where` };
  if (!role) {
    if (!a.public)
      return denied(
        inAuth(
          "public.read",
          `Reading ${what} needs signing in: public.read does not name ${model.name}.`,
        ),
      );
    const open = inAuth(
      "public.read",
      `Anyone may read ${what} without signing in: public.read names ${model.name}${a.where ? ", with a condition" : ""}.`,
    );
    return a.where
      ? onCondition([open], a.where, scenario, model.name, whereAt, `anyone reads ${what}`)
      : allowed(open);
  }
  if (a.roles.includes(role.name)) {
    if (role.name === "admin")
      return allowed(whyGranted(role, "read", model.name, what) as AccessReason);
    if (auth.defaultAccess === "shared")
      return allowed(
        inAuth(
          "defaultAccess",
          "With defaultAccess shared, everyone who signs in sees every record.",
        ),
      );
    return allowed(whyGranted(role, "read", model.name, what) as AccessReason);
  }
  if (a.public && !a.where)
    return allowed(
      inAuth(
        "public.read",
        `Anyone may read ${what}, signed in or not: public.read names ${model.name}.`,
      ),
    );
  const own = inAuth(
    "defaultAccess",
    `With defaultAccess private, ${role.name} sees only their own ${what}: its read grant does not name ${model.name}.`,
  );
  if (scenario.record === "own") return allowed(own, whose(model, "own"));
  if (scenario.record === undefined) {
    if (a.where) {
      const open = inAuth(
        "public.read",
        `Also the ${what} anyone may read, where ${conditionText(a.where)}.`,
      );
      if (fits(a.where, scenario.values) === true)
        return allowed(own, open, {
          at: whereAt,
          text: `This ${record(model.name)} fits: ${conditionText(a.where)}.`,
        });
      return conditional(own, open);
    }
    return conditional(own);
  }
  const reasons = [own, whose(model, scenario.record)];
  if (a.where)
    return onCondition(reasons, a.where, scenario, model.name, whereAt, `anyone reads ${what}`);
  return denied(...reasons);
}

function explainCreate(model: ModelIR, auth: AuthIR, role: RoleIR | undefined): AccessExplanation {
  const a = modelAccess(model, auth).create;
  const what = records(model.name);
  if (a.public)
    return allowed(
      inAuth(
        "public.create",
        `Anyone may add ${what} without signing in: public.create names ${model.name}.`,
      ),
    );
  if (!role)
    return denied(
      inAuth(
        "public.create",
        `Adding ${what} needs signing in: public.create does not name ${model.name}.`,
      ),
    );
  const why = whyGranted(role, "create", model.name, what);
  if (why && a.roles.includes(role.name)) return allowed(why);
  return denied(
    inAuth(
      `roles.${role.name}.create`,
      `${role.name}'s create grant does not name ${model.name}, and the record rule adds nothing.`,
    ),
  );
}

function explainChange(
  model: ModelIR,
  auth: AuthIR,
  role: RoleIR | undefined,
  scenario: AccessScenario,
  verb: "write" | "delete",
): AccessExplanation {
  const a = modelAccess(model, auth)[verb];
  const what = records(model.name);
  const doing = verb === "write" ? "Changing" : "Deleting";
  if (!role)
    return denied(
      inAuth(
        "roles",
        `${doing} ${what} needs signing in: the record rule and the roles' grants say who.`,
      ),
    );
  if (a.roles.includes(role.name))
    return allowed(whyGranted(role, verb, model.name, what) as AccessReason);
  const own = inAuth(
    "defaultAccess",
    `Everyone who signs in ${verb === "write" ? "changes" : "deletes"} their own ${what}; ${role.name}'s ${verb} grant does not name ${model.name}, so not everyone's.`,
  );
  if (!a.owner) return denied(own);
  if (scenario.record === "own") return allowed(own, whose(model, "own"));
  if (scenario.record === undefined) return conditional(own);
  return denied(own, whose(model, scenario.record));
}

function explainAction(
  action: SpecIR["actions"][number],
  ir: SpecIR,
  auth: AuthIR,
  role: RoleIR | undefined,
  scenario: AccessScenario,
): AccessExplanation {
  const label = actionName(action.name);
  if (auth.signIn === "none")
    return denied(inAuth("signIn", `The app has no sign-in, so no one runs ${label}.`));
  if (!role)
    return denied(inAuth("roles", `Running ${label} needs signing in: a role's grants say who.`));
  const at = `actions.${action.name}`;
  if (action.custom) {
    const custom = inSpec(
      at,
      `${humanize(action.name)} is a custom action: the roles whose actions grant names it run it.`,
    );
    const why = whyGranted(role, "actions", action.name, label);
    return why ? allowed(custom, why) : denied(custom, notGranted(role, "actions", action.name));
  }
  const model = ir.models.find((m) => m.name === action.on);
  if (!model)
    return denied(inSpec(at, `${humanize(action.name)} is on a model the spec does not have.`));
  const a = actionAccess(action, auth, ir.models);
  const what = records(model.name);
  if (action.merge?.into === "new") {
    const create = modelAccess(model, auth).create;
    const combines = inSpec(
      at,
      `${humanize(action.name)} combines ${what} into a new one: the roles whose actions grant names it run it, with the right to add ${what}; the picked stay as they were.`,
    );
    const named = whyGranted(role, "actions", action.name, label);
    if (!named) return denied(combines, notGranted(role, "actions", action.name));
    if (create.public)
      return allowed(
        combines,
        named,
        inAuth("public.create", `Anyone may add ${what}: public.create names ${model.name}.`),
      );
    const why = whyGranted(role, "create", model.name, what);
    return why && a.roles.includes(role.name)
      ? allowed(combines, named, why as AccessReason)
      : denied(combines, named, notGranted(role, "create", model.name));
  }
  if (action.merge) {
    const merges = inSpec(
      at,
      `${humanize(action.name)} merges ${what}: the roles whose actions grant names it run it, with write on ${what}; the others go to the trash where they may delete them, else they stay.`,
    );
    const named = whyGranted(role, "actions", action.name, label);
    if (!named) return denied(merges, notGranted(role, "actions", action.name));
    const write = modelAccess(model, auth).write;
    if (write.roles.includes(role.name))
      return allowed(merges, named, whyGranted(role, "write", model.name, what) as AccessReason);
    if (!write.owner) return denied(merges, named, notGranted(role, "write", model.name));
    // Their own only: the kept record is changed.
    const own = inAuth(
      "defaultAccess",
      `Everyone who signs in changes their own ${what}, so ${role.name} merges into ${what} they own only, where the grants do not say more.`,
    );
    if (scenario.record === "own") return allowed(merges, named, own, whose(model, "own"));
    if (scenario.record === undefined) return conditional(merges, named, own);
    return denied(merges, named, own, whose(model, scenario.record));
  }
  if (action.split) {
    const create = modelAccess(model, auth).create;
    const splits = inSpec(
      at,
      `${humanize(action.name)} splits a ${record(model.name)}: the roles whose actions grant names it run it, with the right to add ${what}; the records that move need write.`,
    );
    const named = whyGranted(role, "actions", action.name, label);
    if (!named) return denied(splits, notGranted(role, "actions", action.name));
    if (create.public)
      return allowed(
        splits,
        named,
        inAuth("public.create", `Anyone may add ${what}: public.create names ${model.name}.`),
      );
    const why = whyGranted(role, "create", model.name, what);
    return why && a.roles.includes(role.name)
      ? allowed(splits, named, why as AccessReason)
      : denied(splits, named, notGranted(role, "create", model.name));
  }
  if (action.copy) {
    const create = modelAccess(model, auth).create;
    const copies = inSpec(
      at,
      `${humanize(action.name)} copies a ${record(model.name)}: whoever may add one runs it.`,
    );
    if (create.public)
      return onWhen(
        [
          copies,
          inAuth("public.create", `Anyone may add ${what}: public.create names ${model.name}.`),
        ],
        action,
        model,
        scenario,
      );
    const why = whyGranted(role, "create", model.name, what);
    return why && a.roles.includes(role.name)
      ? onWhen([copies, why], action, model, scenario)
      : denied(copies, notGranted(role, "create", model.name));
  }
  const changes = inSpec(
    at,
    `${humanize(action.name)} changes a ${record(model.name)}: whoever may change one runs it, and the roles whose actions grant names it.`,
  );
  const write = modelAccess(model, auth).write;
  if (a.roles.includes(role.name)) {
    const why = write.roles.includes(role.name)
      ? whyGranted(role, "write", model.name, what)
      : whyGranted(role, "actions", action.name, label);
    return onWhen([changes, why as AccessReason], action, model, scenario);
  }
  // Named or a writer, but left out: it adds records the role may not add.
  const named = whyGranted(role, "actions", action.name, label);
  if (write.roles.includes(role.name) || named) {
    const added = addedModels(action, model).find((name) => {
      const create = ir.models.find((m) => m.name === name);
      return (
        create &&
        !modelAccess(create, auth).create.public &&
        !modelAccess(create, auth).create.roles.includes(role.name)
      );
    });
    return denied(
      changes,
      inSpec(
        `${at}.${action.add?.length ? "add" : "with"}`,
        `${humanize(action.name)} also adds ${records(added ?? "")}, which ${role.name} may not add: its create grant does not name ${added}.`,
      ),
    );
  }
  if (!a.owner)
    return denied(
      changes,
      inAuth(
        `roles.${role.name}`,
        `${role.name}'s write grant does not name ${model.name} and its actions grant does not name ${action.name}.`,
      ),
    );
  const own = inAuth(
    "defaultAccess",
    `Everyone who signs in changes their own ${what}; ${role.name}'s write grant does not name ${model.name} and its actions grant does not name ${action.name}, so ${role.name} runs ${label} on their own ${what} only.`,
  );
  if (scenario.record === "own")
    return onWhen([changes, own, whose(model, "own")], action, model, scenario);
  if (scenario.record === undefined) {
    const open = onWhen([changes, own], action, model, scenario);
    return open.verdict === "denied" ? open : conditional(...open.reasons);
  }
  return denied(changes, own, whose(model, scenario.record));
}

/** The models a standard action adds records of, with the related records a copy takes along. */
function addedModels(action: StandardActionIR, model: ModelIR): string[] {
  const lists = (action.with ?? []).flatMap((l) => {
    const type = model.fields.find((f) => f.name === l)?.type;
    return type?.kind === "relation" ? [type.model] : [];
  });
  return [...(action.add ?? []).map((a) => a.model), ...lists];
}

/** The action's `when`, the last word on a record: decided by the values, or conditional on them. */
function onWhen(
  reasons: AccessReason[],
  action: StandardActionIR,
  model: ModelIR,
  scenario: AccessScenario,
): AccessExplanation {
  if (!action.when) return allowed(...reasons);
  const at = { file: "smithable.yml" as const, path: `actions.${action.name}.when` };
  const fit = fits(action.when, scenario.values);
  const text = conditionText(action.when);
  if (fit === true)
    return allowed(...reasons, { at, text: `This ${record(model.name)} fits: ${text}.` });
  if (fit === false)
    return denied(...reasons, {
      at,
      text: `This ${record(model.name)} does not fit: ${actionName(action.name)} runs only while ${text}.`,
    });
  return conditional(...reasons, { at, text: `${humanize(action.name)} runs only while ${text}.` });
}
