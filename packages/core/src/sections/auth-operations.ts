import type { YamlValue } from "../edit.js";
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
    const chosen = defaultRole ?? (others.length === 1 ? others[0] : undefined);
    if (chosen !== undefined) {
      if (chosen !== "admin" && !names.includes(chosen))
        throw new OperationError(`There is no role named "${chosen}".`);
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
      const list = args[key];
      if (list === undefined) continue;
      const path = ["public", key];
      if (list.length === 0) {
        if (auth.has(path)) auth.removeAndPrune(path, 0);
      } else if (auth.has(path)) auth.set(path, list);
      else if (auth.has(["public"])) auth.add(["public"], key, list);
      else auth.add([], "public", { [key]: list });
    }
    return [];
  },
};

export const authOperations: AnyOperation[] = [setSignUp, setRoles, setPublic];
