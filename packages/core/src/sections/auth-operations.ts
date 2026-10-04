import { PROVIDERS } from "../auth.js";
import { conditionArgs, conditionText } from "../condition.js";
import type { YamlValue } from "../edit.js";
import { humanize, plural } from "../naming.js";
import { type AnyOperation, type Operation, OperationError, refTo } from "../operation.js";

const setSignUp: Operation<{ who: "anyone" | "invited" }> = {
  name: "setSignUp",
  summary:
    "Choose who may sign in: anyone with an account at the sign-in provider (within allowedDomains, when set), or only invited people and the admins (needs a users page).",
  schema: {
    type: "object",
    required: ["who"],
    additionalProperties: false,
    properties: {
      who: {
        type: "string",
        enum: ["anyone", "invited"],
        description: "anyone: open sign-up; invited: only invited addresses and the admins.",
      },
    },
  },
  positional: ["who"],
  describe: ({ who }) =>
    who === "invited" ? "Only invited people may sign in" : "Anyone may sign up",
  destructive: () => false,
  apply({ auth }, { who }) {
    if (!auth) throw new OperationError("This project has no smithable.auth.yml.");
    if (auth.get(["signIn"]) === "none")
      throw new OperationError("This app has no sign-in, so nobody signs up.");
    const path = ["signIn", "selfSignUp"];
    if (who === "anyone") {
      if (auth.has(path)) auth.removeAndPrune(path, 1);
    } else if (auth.has(path)) {
      auth.set(path, false);
    } else {
      auth.add(["signIn"], "selfSignUp", false);
    }
    return [];
  },
};

const setProviders: Operation<{ providers: string[] }> = {
  name: "setProviders",
  summary:
    "Choose how people sign in, in button order: email (a code by mail, needs only the app's mail settings), google or facebook (each needs its keys in the environment, see the README).",
  schema: {
    type: "object",
    required: ["providers"],
    additionalProperties: false,
    properties: {
      providers: {
        type: "array",
        items: { type: "string", enum: [...PROVIDERS] },
        description: "The sign-in methods in button order, e.g. [email, google].",
      },
    },
  },
  positional: ["...providers"],
  describe: ({ providers }) =>
    `Sign in with ${[...new Set(providers)].map((p) => (p === "email" ? "a code by email" : humanize(p))).join(" or ")}`,
  destructive: () => false,
  apply({ auth }, { providers }) {
    if (!auth) throw new OperationError("This project has no smithable.auth.yml.");
    if (auth.get(["signIn"]) === "none")
      throw new OperationError("This app has no sign-in, so it has no sign-in methods.");
    // The schema allows only the known methods; a repeated one counts once.
    const list = [...new Set(providers)];
    if (list.length === 0)
      throw new OperationError("An app with sign-in needs at least one way to sign in.");
    if (auth.has(["signIn", "providers"])) auth.set(["signIn", "providers"], list);
    else if (auth.has(["signIn"])) auth.add(["signIn"], "providers", list);
    else auth.add([], "signIn", { providers: list });
    return [];
  },
};

const setDefaultAccess: Operation<{ access: "shared" | "private" }> = {
  name: "setDefaultAccess",
  summary:
    "Choose the default access to records: shared (a team sees and changes everything; smithable.yml lists the exceptions) or private (each person sees only their own records).",
  schema: {
    type: "object",
    required: ["access"],
    additionalProperties: false,
    properties: {
      access: {
        type: "string",
        enum: ["shared", "private"],
        description: "shared: everyone signed in sees everything; private: only their own records.",
      },
    },
  },
  positional: ["access"],
  describe: ({ access }) =>
    access === "shared"
      ? "Everyone signed in sees and changes every record"
      : "Everyone sees and changes only their own records",
  destructive: () => false,
  apply({ auth }, { access }) {
    if (!auth) throw new OperationError("This project has no smithable.auth.yml.");
    if (auth.get(["signIn"]) === "none")
      throw new OperationError("This app has no sign-in, so there is nobody to share with.");
    if (auth.has(["defaultAccess"])) auth.set(["defaultAccess"], access);
    else auth.add([], "defaultAccess", access);
    return [];
  },
};

const setAdmins: Operation<{ admins: string[] }> = {
  name: "setAdmins",
  summary:
    "Say who the administrators are, by email address: they become admins when they first sign in, and may always sign in.",
  schema: {
    type: "object",
    required: ["admins"],
    additionalProperties: false,
    properties: {
      admins: {
        type: "array",
        items: { type: "string" },
        description: "The administrators' email addresses, e.g. [you@your-domain].",
      },
    },
  },
  positional: ["...admins"],
  describe: ({ admins }) =>
    admins.length === 1
      ? `Make ${admins[0]} the administrator`
      : `Make ${admins.join(", ")} the administrators`,
  destructive: () => false,
  apply({ auth }, { admins }) {
    if (!auth) throw new OperationError("This project has no smithable.auth.yml.");
    if (auth.get(["signIn"]) === "none")
      throw new OperationError("This app has no sign-in, so it has no administrators.");
    const list = [...new Set(admins.map((a) => a.trim().toLowerCase()))];
    const wrong = list.find((a) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a));
    if (wrong !== undefined) throw new OperationError(`"${wrong}" is not an email address.`);
    if (list.length === 0)
      throw new OperationError("An app with sign-in needs at least one administrator.");
    if (auth.has(["admins"])) auth.set(["admins"], list);
    else auth.add([], "admins", list);
    return [];
  },
};

const ROLE_NAME = /^[a-z][A-Za-z0-9]*$/;

const setRoles: Operation<{ roles: Record<string, string>; defaultRole?: string }> = {
  name: "setRoles",
  summary:
    'Set the app\'s roles with a description each ("admin" always exists), and which one new users get.',
  schema: {
    type: "object",
    required: ["roles"],
    additionalProperties: false,
    properties: {
      roles: {
        type: "object",
        minProperties: 1,
        additionalProperties: { type: "string" },
        description:
          'Role name (camelCase) to description, e.g. { "sales": "Works with customers." }.',
      },
      defaultRole: { type: "string", description: "The role new users get; needed with several." },
    },
  },
  positional: ["...roles"],
  describe: ({ roles, defaultRole }) =>
    `Set roles ${Object.keys(roles).join(", ")}${defaultRole ? ` (new users: ${defaultRole})` : ""}`,
  destructive: () => false,
  apply({ auth }, { roles, defaultRole }) {
    if (!auth) throw new OperationError("This project has no smithable.auth.yml.");
    const names = Object.keys(roles);
    for (const name of names)
      if (!ROLE_NAME.test(name) || name === "owner")
        throw new OperationError(
          `"${name}" is not a role name: lowercase letters and digits, not "owner".`,
        );
    const value: YamlValue = Object.fromEntries(
      names.map((name): [string, YamlValue] => [
        name,
        roles[name] ? { description: roles[name] as string } : {},
      ]),
    );
    if (auth.has(["roles"])) auth.set(["roles"], value);
    else auth.add([], "roles", value);
    const others = ["admin", ...names].filter((r, i, all) => r !== "admin" && all.indexOf(r) === i);
    // "admin" is never what new users get: that would make everyone an administrator. Asked for,
    // it means "no other role named": the only other role, or member when there is none.
    const wanted = defaultRole === "admin" ? undefined : defaultRole;
    if (defaultRole === "admin" && others.length > 1)
      throw new OperationError(
        `New users cannot all be administrators: say which of ${others.join(", ")} they get.`,
      );
    const chosen = wanted ?? (others.length === 1 ? others[0] : undefined);
    if (chosen !== undefined) {
      if (!names.includes(chosen)) throw new OperationError(`There is no role named "${chosen}".`);
      if (auth.has(["defaultRole"])) auth.set(["defaultRole"], chosen);
      else auth.add([], "defaultRole", chosen);
    } else if (auth.has(["defaultRole"])) auth.removeAndPrune(["defaultRole"], 0);
    return [];
  },
};

const setPublic: Operation<{ pages?: string[]; read?: string[]; create?: string[] }> = {
  name: "setPublic",
  summary:
    "Set what anyone on the internet may use without signing in: pages to open, models to read, models to create (a contact form). Each list replaces the old one; an empty list closes it.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      pages: refTo(
        { ref: "page", label: "Pages" },
        { description: "Pages anyone may open." },
        true,
      ),
      read: refTo(
        { ref: "model", label: "Read" },
        { description: "Models anyone may read." },
        true,
      ),
      create: refTo(
        { ref: "model", label: "Create" },
        { description: "Models anyone may add a record of, e.g. a contact form's." },
        true,
      ),
    },
  },
  positional: [],
  describe: (args) =>
    `Set what is public: ${Object.entries(args)
      .map(([k, v]) => `${k} ${(v as string[]).join(", ") || "nothing"}`)
      .join("; ")}`,
  destructive: () => false,
  apply({ auth }, args) {
    if (!auth) throw new OperationError("This project has no smithable.auth.yml.");
    if (Object.keys(args).length === 0)
      throw new OperationError("Say what to set: pages, read or create.");
    for (const key of ["pages", "read", "create"] as const) {
      const given = args[key];
      if (given === undefined) continue;
      const path = ["public", key];
      // Models that stay readable keep the records they are limited to.
      const before = auth.has(path) ? (auth.get(path) as unknown[]) : [];
      const list = given.map(
        (name) =>
          before.find((item) => item && typeof item === "object" && name in (item as object)) ??
          name,
      ) as YamlValue[];
      if (list.length === 0) {
        if (auth.has(path)) auth.removeAndPrune(path, 0);
      } else if (auth.has(path)) auth.set(path, list);
      else if (auth.has(["public"])) auth.add(["public"], key, list);
      else auth.add([], "public", { [key]: list });
    }
    return [];
  },
};

const setPublicWhere: Operation<{
  model: string;
  where?: Record<string, string | boolean | string[]>;
}> = {
  name: "setPublicWhere",
  summary:
    "Limit which records of a model anyone on the internet may read, e.g. published posts only; with no condition, every record.",
  schema: {
    type: "object",
    required: ["model"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }),
      where: {
        type: "object",
        description:
          'Field values a record must have to be read by visitors, e.g. { "status": "published" }, or one of several, { "status": "investigating | identified" }; none means every record.',
      },
    },
  },
  positional: ["model", "...where"],
  describe: ({ model, where }) =>
    Object.keys(where ?? {}).length
      ? `Let visitors read only ${model} records where ${conditionText(conditionArgs(where ?? {}))}`
      : `Let visitors read every ${model} record`,
  destructive: () => false,
  apply({ auth }, { model, where }, ir) {
    if (!auth) throw new OperationError("This project has no smithable.auth.yml.");
    if (!ir.models.some((m) => m.name === model))
      throw new OperationError(`There is no model named "${model}".`);
    const path = ["public", "read"];
    const items = auth.has(path) ? (auth.get(path) as unknown[]) : [];
    const index = items.findIndex(
      (item) => item === model || (item && typeof item === "object" && model in (item as object)),
    );
    if (index < 0)
      throw new OperationError(`${model} is not public to read; add it with setPublic read first.`);
    const conditions = conditionArgs(where ?? {});
    auth.setItem(
      path,
      index,
      Object.keys(conditions).length ? { [model]: { where: conditions } } : model,
    );
    return [];
  },
};

const setApi: Operation<{
  models?: string[];
  actions?: string[];
  except?: string[];
  assistants?: boolean;
}> = {
  name: "setApi",
  summary:
    'Say what other programs may reach with a key: models ("all" for every model, also later ones), the standard actions they may run, and whether AI assistants may use it too. No models turns the API off. A key\'s role still decides what it may do.',
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      models: {
        type: "array",
        items: { type: "string" },
        description:
          "The models offered, e.g. [Customer, Order], or [all]; none turns the API off.",
      },
      actions: {
        type: "array",
        items: { type: "string" },
        description: "The standard actions programs may run, e.g. [resolve], or [all].",
      },
      except: {
        type: "array",
        items: { type: "string" },
        description: 'With "all": the models left out, e.g. [AuditEntry].',
      },
      assistants: {
        type: "boolean",
        description: "Offer the same to AI assistants as tools.",
      },
    },
  },
  positional: ["...models"],
  describe: ({ models = [], actions = [], assistants }) => {
    if (!models.length) return "Turn the API off";
    const what = models.includes("all")
      ? "every model, also ones added later,"
      : list(models.map((m) => humanize(plural(m)).toLowerCase()));
    const run = actions.includes("all")
      ? ", and let them run every standard action"
      : actions.length
        ? `, and let them run ${list(actions.map((a) => humanize(a).toLowerCase()))}`
        : "";
    const tools =
      assistants === true
        ? ", also as tools for AI assistants"
        : assistants === false
          ? ", not to AI assistants"
          : "";
    return `Offer ${what} to other programs${run}${tools}`;
  },
  destructive: () => false,
  apply({ auth }, { models = [], actions = [], except = [], assistants }, ir) {
    if (!auth) throw new OperationError("This project has no smithable.auth.yml.");
    const path = ["api"];
    if (!models.length) {
      if (actions.length || except.length || assistants)
        throw new OperationError(
          "Say which models the API offers (or all); without models it is turned off.",
        );
      if (auth.has(path)) auth.removeAndPrune(path, 0);
      return [];
    }
    if (auth.get(["signIn"]) === "none")
      throw new OperationError(
        "This app has no sign-in, and a key is made by an administrator in the app.",
      );
    const all = models.includes("all");
    if (all && models.length > 1)
      throw new OperationError('"all" is every model: give it alone, with --except for the rest.');
    if (except.length && !all)
      throw new OperationError('"except" leaves models out of "all"; with a list, leave it out.');
    for (const name of [...(all ? [] : models), ...except])
      if (!ir.models.some((m) => m.name === name))
        throw new OperationError(`There is no model named "${name}".`);
    const allActions = actions.includes("all");
    if (allActions && actions.length > 1)
      throw new OperationError('"all" is every standard action: give it alone.');
    const value: Record<string, YamlValue> = {
      models: all ? "all" : [...new Set(models)],
      ...(except.length ? { except: [...new Set(except)] } : {}),
      ...(actions.length ? { actions: allActions ? "all" : [...new Set(actions)] } : {}),
      ...(assistants ? { assistants: true } : {}),
    };
    if (auth.has(path)) auth.set(path, value);
    else auth.add([], "api", value);
    return [];
  },
};

/** "a", "a and b", "a, b and c". */
function list(items: string[]): string {
  return items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export const authOperations: AnyOperation[] = [
  setSignUp,
  setDefaultAccess,
  setAdmins,
  setProviders,
  setRoles,
  setPublic,
  setPublicWhere,
  setApi,
];
