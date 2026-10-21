import { GRANT_KEYS, type GrantKey } from "../auth.js";
import type { YamlValue } from "../edit.js";
import { USER_MODEL } from "../ir.js";
import { humanize, plural } from "../naming.js";
import { type AnyOperation, type Operation, OperationError, refTo } from "../operation.js";
import { didYouMean } from "../suggest.js";

const WHATS = ["all", "none", ...GRANT_KEYS] as const;
const VERBS: Record<GrantKey, string> = {
  pages: "open",
  read: "read everyone's",
  create: "add",
  write: "change everyone's",
  delete: "delete everyone's",
  actions: "run",
  review: "review the files of",
};

const grant: Operation<{ role: string; what: string; names?: string[] }> = {
  name: "grant",
  summary:
    'Set what a role may do beyond the record rule, in smithable.auth.yml: the pages it opens, the models it adds to (create), reads, changes (write) or deletes for everyone, the custom actions it runs, or the models whose waiting pictures and files it approves (review). "all" names everything, "none" nothing; "grant <role> all" is the whole app and "grant <role> none" the record rule only.',
  schema: {
    type: "object",
    required: ["role", "what"],
    additionalProperties: false,
    properties: {
      role: refTo({ ref: "role", label: "Role" }),
      what: {
        type: "string",
        enum: [...WHATS],
        description:
          "pages, read, create, write, delete, actions or review; or all / none for the role as a whole.",
      },
      names: refTo(
        { ref: "grantNames", what: "what", label: "Which" },
        {
          description:
            'The pages, models or actions; ["all"] for every one, none (or ["none"]) for nothing.',
        },
        true,
      ),
    },
  },
  positional: ["role", "what", "...names"],
  describe: ({ role, what, names = [] }) => {
    if (what === "all") return `${role} may do everything`;
    if (what === "none") return `${role} may only work with their own records`;
    const verb = VERBS[what as GrantKey] ?? what;
    if (names.length === 0 || names[0] === "none")
      return what === "pages"
        ? `${role} may open no page`
        : what === "actions"
          ? `${role} may run no action`
          : what === "create"
            ? `${role} may add no records`
            : what === "review"
              ? `${role} may review no files`
              : `${role} may ${what === "read" ? "read" : what === "write" ? "change" : "delete"} only their own records`;
    if (names[0] === "all")
      return `${role} may ${verb} every ${what === "pages" ? "page" : what === "actions" ? "action" : "kind of record"}`;
    const named = names.map((n) =>
      what === "pages"
        ? `the ${humanize(n).toLowerCase()} page`
        : what === "actions"
          ? humanize(n).toLowerCase()
          : humanize(plural(n)).toLowerCase(),
    );
    return `${role} may ${verb} ${named.join(", ")}`;
  },
  destructive: () => false,
  apply({ auth }, { role, what, names = [] }, ir) {
    if (!auth) throw new OperationError("This project has no smithable.auth.yml.");
    if (role === "admin") throw new OperationError("Administrators do everything already.");
    if (!auth.has(["roles", role]))
      throw new OperationError(`There is no role named "${role}": setRoles adds one.`);
    if (!(WHATS as readonly string[]).includes(what))
      throw new OperationError(`Say what to grant: ${WHATS.join(", ")}.`);
    const path = ["roles", role];
    const block = auth.get(path);
    const kept: Record<string, YamlValue> =
      block && typeof block === "object" && !Array.isArray(block) && "description" in block
        ? { description: (block as { description: YamlValue }).description }
        : {};
    if (what === "all") {
      auth.set(path, "all");
      return [];
    }
    if (what === "none") {
      auth.set(path, kept);
      return [];
    }
    const key = what as GrantKey;
    const known =
      key === "pages"
        ? ir.pages.map((p) => p.id)
        : key === "actions"
          ? ir.actions.map((a) => a.name)
          : ir.models.map((m) => m.name);
    const kind = key === "pages" ? "page" : key === "actions" ? "action" : "model";
    for (const name of names)
      if (name !== "all" && name !== "none" && !known.includes(name))
        throw new OperationError(
          `There is no ${kind} named "${name}". ${didYouMean(name, known) ?? ""}`.trim(),
        );
    const value: YamlValue | undefined =
      names.length === 0 || names[0] === "none" ? undefined : names[0] === "all" ? "all" : names;
    // A role that was "all" becomes a block of every grant but this one.
    if (block === "all") {
      auth.set(path, {
        ...kept,
        ...Object.fromEntries(GRANT_KEYS.filter((k) => k !== key).map((k) => [k, "all"])),
        ...(value === undefined ? {} : { [key]: value }),
      });
      return [];
    }
    if (value === undefined) {
      if (auth.has([...path, key])) auth.removeAndPrune([...path, key], 2);
    } else if (auth.has([...path, key])) auth.set([...path, key], value);
    else if (block && typeof block === "object") auth.add(path, key, value);
    else auth.set(path, { ...kept, [key]: value });
    return [];
  },
};

const setOwner: Operation<{ model: string; field?: string }> = {
  name: "setOwner",
  summary:
    'Say whose a record is: the user in one of its User fields (the account manager, the salesperson who handles it) instead of whoever created it. Without a field, the creator again. "The owner" in the access rules is then that user.',
  schema: {
    type: "object",
    required: ["model"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }),
      field: refTo(
        { ref: "field", model: "model", label: "Owner" },
        {
          description:
            "A field of the model that refers to User, e.g. accountManager. Leave it out to make the creator the owner again.",
        },
      ),
    },
  },
  positional: ["model", "field"],
  describe: ({ model, field }) =>
    field
      ? `${humanize(plural(model))} belong to their ${humanize(field).toLowerCase()}`
      : `${humanize(plural(model))} belong to whoever created them`,
  destructive: () => false,
  apply({ spec }, { model, field }, ir) {
    const found = ir.models.find((m) => m.name === model);
    if (!found)
      throw new OperationError(
        `There is no model named "${model}". ${
          didYouMean(
            model,
            ir.models.map((m) => m.name),
          ) ?? ""
        }`.trim(),
      );
    const path = ["models", model, "ownedBy"];
    if (!field) {
      if (spec.has(path)) spec.remove(path);
      return [];
    }
    const users = found.fields
      .filter((f) => f.type.kind === "relation" && f.type.model === USER_MODEL && !f.type.many)
      .map((f) => f.name);
    if (!users.includes(field))
      throw new OperationError(
        users.length
          ? `The owner is one of ${model}'s fields that refer to a user: ${users.join(", ")}.`
          : `${model} has no field that refers to a user. Add one first, e.g. addField ${model} handledBy User.`,
      );
    if (spec.has(path)) spec.set(path, field);
    else spec.add(["models", model], "ownedBy", field);
    return [];
  },
};

export const accessOperations: AnyOperation[] = [grant, setOwner];
