import { isMap, isScalar, isSeq, LineCounter, type ParsedNode, parseDocument } from "yaml";
import { modelAccess, uniquePerOwner } from "./access.js";
import { readCondition } from "./condition.js";
import {
  type At,
  checkKeys,
  type Entry,
  mapEntries,
  ParseContext,
  readBoolean,
  readNameList,
  readString,
} from "./context.js";
import { type Diagnostic, hasErrors } from "./diagnostics.js";
import { type Condition, conditionFits, type SpecIR, USER_MODEL } from "./ir.js";

export type { Condition } from "./ir.js";

import { patternInfo } from "./patterns.js";
import { FIELD_NAME_PATTERN } from "./sections/names.js";
import { didYouMean } from "./suggest.js";

/**
 * Who signs in, the roles, the default access and everything public, from
 * smithable.auth.yml (ARCHITECTURE §3.1).
 */
export interface AuthIR {
  signIn: "none" | SignInIR;
  /** Meaningful only with sign-in. */
  defaultAccess: "shared" | "private";
  /** Always starts with "admin". */
  roles: RoleIR[];
  /** The role new users get. */
  defaultRole: string;
  /** Email addresses that become admins when they first sign in. */
  admins: string[];
  public: {
    pages: string[];
    read: string[];
    create: string[];
    /** For a model in `read`, the records visitors may read (`Post: { where: { status: published } }`). */
    readWhere: Record<string, Condition>;
  };
  /**
   * What other programs may reach with a key (docs/design/integrations.md §2); absent when the
   * app offers nothing. Listing is not granting: a key's role decides what it may do.
   */
  api?: ApiIR;
}

export interface ApiIR {
  /** The models offered: all of them (also ones added later), or these. */
  models: "all" | string[];
  /** With `models: all`, the models left out. */
  except: string[];
  /** The standard actions offered: all whose model is offered, or these. */
  actions: "all" | string[];
  /** Offered to AI assistants as tools too; deleting only when it says so. */
  assistants?: { delete: boolean };
}

/** What an app's API offers a program: with a key, and to anyone without one. */
export interface ApiOffers {
  /** The models offered to a key, with `all` and `except` resolved; its role decides the rest. */
  models: string[];
  /** The standard actions offered to a key. */
  actions: string[];
  /**
   * What a call without a key may reach (docs/design/api-only.md §3.4): it is the visitor, so it
   * reads the offered models `public.read` lists (within their `where`) and adds the offered
   * ones `public.create` lists. It never changes, deletes or runs an action. The tools for
   * assistants follow the same rule.
   */
  visitors: { read: string[]; create: string[] };
}

/** The models and standard actions an app's `api` block offers, with `all` and `except` resolved. */
export function apiOffers(auth: AuthIR, ir: SpecIR): ApiOffers {
  const api = auth.api;
  if (!api) return { models: [], actions: [], visitors: { read: [], create: [] } };
  const known = ir.models.map((m) => m.name);
  const models =
    api.models === "all"
      ? known.filter((m) => !api.except.includes(m))
      : api.models.filter((m) => known.includes(m));
  const standard = ir.actions.filter((a) => !a.custom && models.includes(a.on));
  const actions =
    api.actions === "all"
      ? standard.map((a) => a.name)
      : api.actions.filter((name) => standard.some((a) => a.name === name));
  const visitors = {
    read: models.filter((m) => auth.public.read.includes(m)),
    create: models.filter((m) => auth.public.create.includes(m)),
  };
  return { models, actions, visitors };
}

export interface SignInIR {
  /** In button order. */
  providers: Provider[];
  /** Only email addresses in these domains may sign in. */
  allowedDomains?: string[];
  /** False: only invited addresses and the admins may sign in (needs a users page). */
  selfSignUp: boolean;
}

export interface RoleIR {
  name: string;
  description?: string;
}

export const AUTH_VERSION = "0.1";
/** `email` is a one-time code sent to the person's address: no keys, the app's own mail settings. */
export const PROVIDERS = ["email", "google", "facebook"] as const;
export type Provider = (typeof PROVIDERS)[number];
const LATER_PROVIDERS = ["microsoft", "github", "apple", "magicLink"];
/** Domains nobody receives mail at (RFC 2606): an administrator there can never sign in. */
const RESERVED_DOMAIN = /(^|\.)(example|test|invalid|localhost)$|^example\.(com|org|net)$/;

/** A domain nobody has an address at (a starter's sample, like acme.example). */
export const reservedDomain = (domain: string) => RESERVED_DOMAIN.test(domain);

/** Personal data that should never be readable by anyone on the internet. */
const PERSONAL_TYPES = ["email", "phone"];

/**
 * Parses smithable.auth.yml. With the IR of smithable.yml, also checks what the public
 * section names and how the spec uses users and access.
 */
export function validateAuth(
  file: { path: string; text: string },
  ir?: SpecIR,
): { auth?: AuthIR; diagnostics: Diagnostic[] } {
  const lines = new LineCounter();
  const doc = parseDocument(file.text, {
    lineCounter: lines,
    uniqueKeys: true,
    prettyErrors: false,
  });
  const ctx = new ParseContext(file.path, lines);
  const auth: AuthIR = {
    signIn: { providers: ["google"], selfSignUp: true },
    defaultAccess: "private",
    roles: [{ name: "admin" }],
    defaultRole: "admin",
    admins: [],
    public: { pages: [], read: [], create: [], readWhere: {} },
  };
  const done = () => ({
    ...(hasErrors(ctx.diagnostics) ? {} : { auth }),
    diagnostics: [...ctx.diagnostics].sort((a, b) => a.line - b.line || a.column - b.column),
  });

  for (const error of doc.errors) {
    ctx.errorAtOffset(
      error.pos[0],
      error.code === "DUPLICATE_KEY" ? "duplicate-key" : "yaml-syntax",
      error.message.split("\n")[0] ?? "",
    );
  }
  if (hasErrors(ctx.diagnostics)) return done();

  const root = doc.contents as ParsedNode | null;
  const entries = mapEntries(ctx, root, "smithable.auth.yml") ?? [];
  const byKey = new Map(
    checkKeys(ctx, entries, "smithable.auth.yml", {
      allowed: [
        "smithableAuth",
        "signIn",
        "defaultAccess",
        "roles",
        "defaultRole",
        "admins",
        "public",
        "api",
      ],
      later: ["user", "teams"],
    }).map((e) => [e.key, e]),
  );
  const version = byKey.get("smithableAuth");
  const versionText = isScalar(version?.value)
    ? (version.value.source ?? String(version.value.value))
    : undefined;
  if (versionText !== AUTH_VERSION) {
    ctx.error(
      version?.value ?? root,
      "invalid-version",
      `The auth file must start with "smithableAuth: ${AUTH_VERSION}".`,
    );
    return done();
  }

  const signIn = byKey.get("signIn");
  if (!signIn) {
    ctx.error(
      root,
      "missing-key",
      `smithable.auth.yml needs "signIn": the sign-in methods, or "none" for an app without sign-in.`,
    );
  } else if (isScalar(signIn.value) && signIn.value.value === "none") {
    auth.signIn = "none";
  } else {
    auth.signIn = readSignIn(ctx, signIn.value);
  }

  const defaultAccess = byKey.get("defaultAccess");
  if (defaultAccess) {
    const value = readString(ctx, defaultAccess.value, `"defaultAccess"`);
    if (value === "shared" || value === "private") auth.defaultAccess = value;
    else if (value !== undefined)
      ctx.error(
        defaultAccess.value,
        "invalid-value",
        `"defaultAccess" must be "shared" (signed-in users see all records) or "private" (users see their own records).`,
      );
  } else if (auth.signIn !== "none") {
    ctx.error(
      root,
      "missing-key",
      `smithable.auth.yml needs "defaultAccess": shared (signed-in users see all records) or private (users see only their own).`,
    );
  }

  const roles = byKey.get("roles");
  const roleNodes = new Map<string, At>();
  if (roles) {
    for (const { key, keyNode, value } of mapEntries(ctx, roles.value, `"roles"`) ?? []) {
      roleNodes.set(key, keyNode);
      if (!FIELD_NAME_PATTERN.test(key) || key === "owner") {
        ctx.error(
          keyNode,
          "invalid-name",
          key === "owner"
            ? `"owner" is not a role: it means the owner of a record.`
            : `Role name "${key}" must start with a lowercase letter and use only letters and digits.`,
        );
        continue;
      }
      const role: RoleIR = { name: key };
      if (value !== null && !(isScalar(value) && value.value === null)) {
        const where = `role "${key}"`;
        for (const entry of checkKeys(ctx, mapEntries(ctx, value, where) ?? [], where, {
          allowed: ["description"],
        })) {
          const description = readString(ctx, entry.value, `The description of ${where}`);
          if (description !== undefined) role.description = description;
        }
      }
      if (key === "admin") auth.roles[0] = role;
      else auth.roles.push(role);
    }
  }
  // "admin" always exists, and so does a role for everyone else: "member" when none is declared
  // (also when "roles" lists only admin, which would otherwise make every newcomer one).
  if (!auth.roles.some((r) => r.name !== "admin")) auth.roles.push({ name: "member" });
  const roleNames = auth.roles.map((r) => r.name);

  const defaultRole = byKey.get("defaultRole");
  const others = roleNames.filter((r) => r !== "admin");
  if (defaultRole) {
    const name = readString(ctx, defaultRole.value, `"defaultRole"`);
    if (name !== undefined && !roleNames.includes(name)) {
      ctx.error(
        defaultRole.value,
        "unknown-role",
        `There is no role named "${name}".`,
        didYouMean(name, roleNames),
      );
    } else if (name === "admin") {
      ctx.error(
        defaultRole.value,
        "admin-default-role",
        `"defaultRole: admin" would make everyone who signs in an administrator.`,
        `Name another role, or list the administrators' addresses under "admins".`,
      );
      if (others.length === 1) auth.defaultRole = others[0] as string;
    } else if (name !== undefined) {
      auth.defaultRole = name;
    }
  } else if (others.length === 1) {
    auth.defaultRole = others[0] as string;
  } else if (others.length > 1 && auth.signIn !== "none") {
    ctx.error(
      roles?.keyNode ?? root,
      "missing-key",
      `With several roles, "defaultRole" says which one new users get.`,
    );
  }

  const admins = byKey.get("admins");
  if (admins) {
    auth.admins = readNameList(ctx, admins.value, `"admins"`).flatMap(({ name, at }) => {
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(name)) return [name.toLowerCase()];
      ctx.error(at, "invalid-email", `"${name}" in "admins" is not an email address.`);
      return [];
    });
  }

  const pub = byKey.get("public");
  const publicNodes: Partial<Record<keyof AuthIR["public"], { name: string; at: At }[]>> = {};
  if (pub) {
    const entries =
      isScalar(pub.value) && pub.value.value === null
        ? []
        : (mapEntries(ctx, pub.value, `"public"`) ?? []);
    for (const { key, value } of checkKeys(ctx, entries, `"public"`, {
      allowed: ["pages", "read", "create"],
      later: ["actions", "write", "delete"],
    })) {
      const k = key as "pages" | "read" | "create";
      publicNodes[k] =
        k === "read"
          ? readPublicRead(ctx, value, auth.public.readWhere)
          : readNameList(ctx, value, `"${key}" in "public"`);
      auth.public[k] = publicNodes[k].map((n) => n.name);
    }
  }

  const api = byKey.get("api");
  const apiNodes = api ? readApi(ctx, api, auth) : undefined;
  if (api && auth.signIn === "none")
    ctx.error(
      api.keyNode,
      "invalid-api",
      `"api" needs sign-in: a key is made by an administrator in the app, and "signIn" is "none".`,
    );
  // "models: all" also offers models added later. That is said where it is chosen (setApi's
  // confirmation, the summary), not as a warning on every later change.

  if (
    auth.signIn !== "none" &&
    auth.defaultAccess === "shared" &&
    !auth.signIn.allowedDomains &&
    auth.signIn.selfSignUp
  ) {
    ctx.warning(
      defaultAccess?.value,
      "open-shared-access",
      "With shared access and no allowedDomains, anyone with an account at the sign-in provider can sign up and read all records.",
      `Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".`,
    );
  }
  if (auth.signIn !== "none") {
    // Invited people and administrators only, and no administrator: nobody could ever sign in.
    if (!auth.signIn.selfSignUp && auth.admins.length === 0)
      ctx.warning(
        signIn?.keyNode ?? root,
        "no-admin",
        "Only invited people and administrators may sign in, and there is no administrator: nobody can sign in.",
        `Name one under "admins" (smithable op setAdmins you@your-domain).`,
      );
    // A domain nobody has: only administrators and invited people can ever sign in.
    const domains = auth.signIn.allowedDomains;
    const sample = domains?.filter(reservedDomain) ?? [];
    const allSample = sample.length > 0 && sample.length === domains?.length;
    if (sample.length)
      ctx.warning(
        signIn?.keyNode ?? root,
        "example-domain",
        allSample
          ? `Only ${sample.join(" and ")} accounts may sign up, and nobody has one: only administrators and invited people can sign in.`
          : `${sample.join(" and ")} in allowedDomains ${sample.length > 1 ? "are domains" : "is a domain"} nobody has an account at: remove ${sample.length > 1 ? "them" : "it"}.`,
        allSample
          ? `Change "allowedDomains" under "signIn" to your people's domains, or remove it.`
          : undefined,
      );
    // An admin outside allowedDomains may sign in (admins always can), but the domains were
    // likely a starter's and keep everyone else from the admin's own domain out.
    for (const address of auth.admins)
      if (domains && !allSample && !domains.includes(address.split("@")[1] ?? ""))
        ctx.warning(
          admins?.value ?? root,
          "admin-outside-domains",
          `${address} is an administrator outside allowedDomains (${domains.join(", ")}): they may sign in, but nobody else from their domain may.`,
          `Change "allowedDomains" under "signIn" to your people's domains, or remove it.`,
        );
    for (const address of auth.admins)
      if (reservedDomain(address.split("@")[1] ?? ""))
        ctx.warning(
          admins?.value ?? root,
          "example-admin",
          `Nobody receives mail at ${address}, so nobody can sign in as this administrator.`,
          "Replace it with a real address (smithable op setAdmins you@your-domain).",
        );
  }
  if (ir) checkAgainstSpec(ctx, auth, ir, publicNodes, defaultAccess?.value ?? root);
  if (ir && apiNodes) checkApi(ctx, auth, ir, apiNodes);
  // A standard action follows its model's write access: "allow" narrows it and never widens it,
  // so a role there that may not edit the record still cannot run the action.
  for (const action of ir?.actions ?? []) {
    const model = !action.custom && ir?.models.find((m) => m.name === action.on);
    if (!model || action.custom) continue;
    const write = modelAccess(model, auth).write;
    // Neither by role nor as an owner: the action is out of their reach.
    // A related record it adds needs the right to create one, too.
    for (const add of action.add ?? []) {
      const added = ir?.models.find((m) => m.name === add.model);
      const create = added && modelAccess(added, auth).create;
      if (!create || create.public) continue;
      for (const role of action.allow ?? [])
        if (roleNames.includes(role) && !create.roles.includes(role))
          ctx.warning(
            roleNodes.get(role) ?? roles?.keyNode,
            "action-role-cannot-create",
            `The action "${action.name}" allows ${role} and adds a ${add.model}, but ${role} may not create ${add.model} records, so ${role} still cannot run it.`,
            `Let ${role} create ${add.model} (its "access" in smithable.yml), or take ${role} out of the action's "allow".`,
          );
    }
    for (const role of action.allow ?? [])
      if (!write.roles.includes(role) && !write.owner && roleNames.includes(role))
        ctx.warning(
          roleNodes.get(role) ?? roles?.keyNode,
          "action-role-cannot-write",
          `The action "${action.name}" allows ${role}, but ${role} may not edit ${model.name} records, so ${role} still cannot run it.`,
          `Let ${role} edit ${model.name} (its "access" in smithable.yml), or take ${role} out of the action's "allow".`,
        );
  }
  return done();
}

/** Where the `api` block's names are written, for errors about them. */
interface ApiNodes {
  models?: At;
  modelNames: { name: string; at: At }[];
  exceptNames: { name: string; at: At }[];
  exceptAt?: At;
  actionNames: { name: string; at: At }[];
}

/** "all", or a list of names. */
function readAllOrList(
  ctx: ParseContext,
  node: ParsedNode | null,
  what: string,
): "all" | { name: string; at: At }[] {
  if (isScalar(node) && node.value === "all") return "all";
  return readNameList(ctx, node, what);
}

/**
 * The `api` block: what other programs may reach with a key.
 * `{ models: all | [..], except: [..], actions: all | [..], assistants: true | { delete: true } }`.
 */
function readApi(ctx: ParseContext, entry: Entry, auth: AuthIR): ApiNodes | undefined {
  const where = `"api"`;
  const nodes: ApiNodes = { modelNames: [], exceptNames: [], actionNames: [] };
  const byKey = new Map(
    checkKeys(ctx, mapEntries(ctx, entry.value, where) ?? [], where, {
      allowed: ["models", "except", "actions", "assistants"],
    }).map((e) => [e.key, e]),
  );
  const models = byKey.get("models");
  if (!models) {
    ctx.error(
      entry.keyNode,
      "missing-key",
      `"api" needs "models": all, or the models other programs may reach, like [Customer, Order].`,
    );
    return undefined;
  }
  nodes.models = models.value;
  const api: ApiIR = { models: [], except: [], actions: [] };
  const offered = readAllOrList(ctx, models.value, `"models" in "api"`);
  if (offered === "all") api.models = "all";
  else {
    nodes.modelNames = offered;
    api.models = offered.map((m) => m.name);
  }
  const except = byKey.get("except");
  if (except) {
    nodes.exceptAt = except.keyNode;
    nodes.exceptNames = readNameList(ctx, except.value, `"except" in "api"`);
    api.except = nodes.exceptNames.map((m) => m.name);
    if (api.models !== "all")
      ctx.error(
        except.keyNode,
        "invalid-api",
        `"except" in "api" leaves models out of "models: all"; with a list, leave the model out of the list.`,
      );
  }
  const actions = byKey.get("actions");
  if (actions) {
    const listed = readAllOrList(ctx, actions.value, `"actions" in "api"`);
    if (listed === "all") api.actions = "all";
    else {
      nodes.actionNames = listed;
      api.actions = listed.map((a) => a.name);
    }
  }
  const assistants = byKey.get("assistants");
  if (assistants) {
    if (isMap(assistants.value)) {
      const what = `"assistants" in "api"`;
      let del = false;
      for (const { key, value } of checkKeys(
        ctx,
        mapEntries(ctx, assistants.value, what) ?? [],
        what,
        { allowed: ["delete"] },
      )) {
        if (key === "delete") del = readBoolean(ctx, value, `"delete" in ${what}`) === true;
      }
      api.assistants = { delete: del };
    } else if (readBoolean(ctx, assistants.value, `"assistants" in "api"`) === true) {
      api.assistants = { delete: false };
    }
  }
  auth.api = api;
  return nodes;
}

/** What the `api` block names must exist, and only standard actions of offered models can be run. */
function checkApi(ctx: ParseContext, auth: AuthIR, ir: SpecIR, nodes: ApiNodes): void {
  const known = ir.models.map((m) => m.name);
  for (const { name, at } of [...nodes.modelNames, ...nodes.exceptNames])
    if (!known.includes(name))
      ctx.error(
        at,
        "unknown-model",
        `There is no model named "${name}" in smithable.yml.`,
        didYouMean(name, known),
      );
  const offered = apiOffers(auth, ir).models;
  for (const { name, at } of nodes.actionNames) {
    const action = ir.actions.find((a) => a.name === name);
    if (!action)
      ctx.error(
        at,
        "unknown-action",
        `There is no action named "${name}" in smithable.yml.`,
        didYouMean(
          name,
          ir.actions.map((a) => a.name),
        ),
      );
    else if (action.custom)
      ctx.error(
        at,
        "invalid-api",
        `"${name}" is a custom action: only standard actions (on, set) can be offered to other programs.`,
      );
    else if (!offered.includes(action.on))
      ctx.error(
        at,
        "invalid-api",
        `"${name}" changes a ${action.on}, which "api" does not offer: add ${action.on} to "models".`,
      );
  }
  // A key with a role that may read the model reads its personal data too.
  for (const name of offered) {
    const personal = ir.models
      .find((m) => m.name === name)
      ?.fields.filter((f) => f.type.kind === "scalar" && PERSONAL_TYPES.includes(f.type.name));
    if (personal?.length)
      ctx.warning(
        nodes.modelNames.find((m) => m.name === name)?.at ?? nodes.models,
        "api-personal-data",
        `Anyone holding a key with a role that may read ${name} reads ${personal.map((f) => f.name).join(", ")}.`,
      );
  }
}

function readSignIn(ctx: ParseContext, node: ParsedNode | null): SignInIR {
  const signIn: SignInIR = { providers: ["google"], selfSignUp: true };
  if (!isMap(node)) {
    ctx.error(
      node,
      "expected-mapping",
      `"signIn" must be "none" or a mapping like { providers: [google] }.`,
    );
    return signIn;
  }
  const where = `"signIn"`;
  for (const { key, value } of checkKeys(ctx, mapEntries(ctx, node, where) ?? [], where, {
    allowed: ["providers", "allowedDomains", "selfSignUp"],
  })) {
    if (key === "providers") {
      const providers = readNameList(ctx, value, `"providers"`).flatMap(({ name, at }) => {
        if ((PROVIDERS as readonly string[]).includes(name)) return [name as Provider];
        if (LATER_PROVIDERS.includes(name))
          ctx.error(
            at,
            "not-yet-supported",
            `Sign-in with "${name}" is not available in version 0.1 yet.`,
          );
        else
          ctx.error(
            at,
            "unknown-provider",
            `Unknown sign-in provider "${name}".`,
            didYouMean(name, PROVIDERS) ?? `Available: ${PROVIDERS.join(", ")}.`,
          );
        return [];
      });
      if (providers.length === 0 && isMap(node))
        ctx.error(
          value,
          "missing-key",
          `"providers" needs at least one sign-in method, like [google].`,
        );
      else signIn.providers = [...new Set(providers)];
    } else if (key === "selfSignUp") {
      const allowed = readBoolean(ctx, value, `"selfSignUp"`);
      if (allowed !== undefined) signIn.selfSignUp = allowed;
    } else {
      signIn.allowedDomains = readNameList(ctx, value, `"allowedDomains"`).flatMap(
        ({ name, at }) => {
          if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(name)) return [name];
          ctx.error(at, "invalid-domain", `"${name}" is not a domain like "acme.com".`);
          return [];
        },
      );
    }
  }
  return signIn;
}

/**
 * The models anyone may read: names, or a name with the records it is limited to,
 * `Post: { where: { status: published } }`.
 */
function readPublicRead(
  ctx: ParseContext,
  node: At,
  readWhere: Record<string, Condition>,
): { name: string; at: At }[] {
  const what = '"read" in "public"';
  if (!isSeq(node)) {
    ctx.error(node, "expected-list", `${what} must be a list, like [a, b].`);
    return [];
  }
  const names: { name: string; at: At }[] = [];
  for (const item of node.items as ParsedNode[]) {
    if (!isMap(item)) {
      const name = readString(ctx, item, `Each item in ${what}`);
      if (name !== undefined) names.push({ name, at: item });
      continue;
    }
    const entries = mapEntries(ctx, item, what) ?? [];
    if (entries.length !== 1) {
      ctx.error(
        item,
        "invalid-value",
        `Each item in ${what} is a model, or one model with "where".`,
      );
      continue;
    }
    const [entry] = entries as [Entry];
    const options = checkKeys(
      ctx,
      mapEntries(ctx, entry.value, `"${entry.key}" in ${what}`) ?? [],
      `"${entry.key}" in ${what}`,
      { allowed: ["where"] },
    );
    const where = options.find((o) => o.key === "where");
    const condition = where
      ? readCondition(ctx, where.value, `"where" of "${entry.key}" in ${what}`)
      : undefined;
    if (condition) readWhere[entry.key] = condition;
    names.push({ name: entry.key, at: entry.keyNode });
  }
  return names;
}

/** What the public section names must exist, and the spec must fit the sign-in setting. */
function checkAgainstSpec(
  ctx: ParseContext,
  auth: AuthIR,
  ir: SpecIR,
  publicNodes: Partial<Record<keyof AuthIR["public"], { name: string; at: At }[]>>,
  accessAt: At,
): void {
  // A capacity per a unique reference holds one record per referenced record when "unique" is
  // global (not per owner): a max above 1 is never reached. The default access decides which.
  for (const model of ir.models) {
    const capacity = model.capacity;
    const per = capacity && model.fields.find((f) => f.name === capacity.per);
    if (!capacity || !per?.unique || uniquePerOwner(model, auth)) continue;
    if (typeof capacity.max === "number" && capacity.max <= 1) continue;
    const one = model.name.toLowerCase();
    ctx.warning(
      accessAt,
      "capacity-unique-shared",
      `${model.name}.${per.name} is unique, and ${model.name} records are not private to their owners, so that means one ${one} per ${per.name} in all: the capacity of ${capacity.max} is never reached. "unique" is one per person only when each person reads just their own records.`,
      `Remove "unique" from ${per.name}, or make the model's records private.`,
    );
  }
  const known = { pages: ir.pages.map((p) => p.id), read: ir.models.map((m) => m.name) };
  for (const key of ["pages", "read", "create"] as const) {
    const names = key === "pages" ? known.pages : known.read;
    for (const { name, at } of publicNodes[key] ?? []) {
      if (!names.includes(name)) {
        const kind = key === "pages" ? "page" : "model";
        ctx.error(
          at,
          `unknown-${kind}`,
          `There is no ${kind} named "${name}" in smithable.yml.`,
          didYouMean(name, names),
        );
        continue;
      }
      const model = key === "read" ? ir.models.find((m) => m.name === name) : undefined;
      const where = model && auth.public.readWhere[model.name];
      if (model && where)
        for (const [field, wanted] of Object.entries(where))
          if (!conditionFits(model, field, wanted))
            ctx.error(
              at,
              "invalid-where",
              `"where" of ${name}: "${field}" must be a choice field of ${name} with one of its values (or a list of them), or a yes/no field with true or false.`,
            );
      const personal = model?.fields.filter(
        (f) =>
          (f.type.kind === "scalar" && PERSONAL_TYPES.includes(f.type.name)) ||
          (f.type.kind === "relation" && f.type.model === USER_MODEL),
      );
      if (personal?.length) {
        ctx.warning(
          at,
          "public-personal-data",
          `Anyone on the internet can read ${name}, including personal data in ${personal.map((f) => f.name).join(", ")}.`,
        );
      }
    }
  }
  // A public page's contact form is sent by visitors: they must be allowed to add its records.
  for (const { name, at } of publicNodes.pages ?? []) {
    const page = ir.pages.find((p) => p.id === name);
    for (const form of page ? patternInfo(page).forms() : []) {
      if (!auth.public.create.includes(form))
        ctx.warning(
          at,
          "contact-form-closed",
          `The contact form on the ${name} page adds a ${form}, but visitors may not add one, so nobody without an account can send it.`,
          `Add ${form} to "create" under "public".`,
        );
    }
  }
  // A public landing page's shortcuts are for visitors (one behind sign-in has none to mislead):
  // a shortcut to a page they cannot open meets sign-in.
  // (A hero's button into the app is often meant to: "Get started" leads to signing in.)
  for (const { name, at } of publicNodes.pages ?? []) {
    const page = ir.pages.find((p) => p.id === name);
    if (page?.pattern.kind !== "landing") continue;
    for (const target of page.pattern.sections.flatMap((s) => s.shortcuts ?? []))
      if (!auth.public.pages.includes(target))
        ctx.warning(
          at,
          "shortcut-closed",
          `Visitors can't open ${target} from the ${name} hero's shortcuts: list it under public.pages, or choose another page.`,
        );
  }
  // A page of the viewer's own records has nothing to show a visitor, who owns nothing.
  for (const { name, at } of publicNodes.pages ?? []) {
    if (ir.pages.find((p) => p.id === name)?.mine)
      ctx.warning(
        at,
        "mine-public",
        `${name} lists only the viewer's own records, so a visitor sees nothing there: take it out of public.pages.`,
      );
  }
  // A public blog of a model with a draft state shows its drafts, unless a "where" keeps them.
  for (const { name, at } of publicNodes.pages ?? []) {
    const page = ir.pages.find((p) => p.id === name);
    if (page?.pattern.kind !== "articles") continue;
    const model = ir.models.find((m) => m.name === (page.pattern as { model: string }).model);
    const state = model?.fields.find(
      (f) => f.type.kind === "choice" || (f.type.kind === "scalar" && f.type.name === "bool"),
    );
    if (
      model &&
      state &&
      auth.public.read.includes(model.name) &&
      !auth.public.readWhere[model.name]
    )
      ctx.warning(
        at,
        "visitors-read-drafts",
        `Visitors can read every ${model.name} on the ${name} page, drafts too: ${model.name} has "${state.name}" but its public read has no "where".`,
        `Write "- ${model.name}: { where: { ${state.name}: ${state.type.kind === "choice" ? state.type.values.at(-1) : "true"} } }" under "public: read".`,
      );
  }
  const usersPage = ir.pages.find((p) => p.pattern.kind === "users");
  if (auth.signIn !== "none") {
    if (!auth.signIn.selfSignUp && !usersPage)
      ctx.error(
        null,
        "no-users-page",
        `With "selfSignUp: false" only invited people can sign in, but no page invites them.`,
        `Add a page with "users: manage" to smithable.yml.`,
      );
    return;
  }
  if (usersPage)
    ctx.error(
      null,
      "no-sign-in",
      `The ${usersPage.id} page manages users, but "signIn" is "none".`,
    );
  // A data page shows and changes everyone's records: it is for signed-in administrators.
  for (const page of ir.pages.filter((p) => p.pattern.kind === "data"))
    ctx.error(
      null,
      "no-sign-in",
      `The ${page.id} page shows the app's data to administrators, but "signIn" is "none".`,
    );
  const usesUsers = ir.models.flatMap((m) =>
    m.fields
      .filter((f) => f.type.kind === "relation" && f.type.model === USER_MODEL)
      .map((f) => `${m.name}.${f.name}`),
  );
  if (usesUsers.length) {
    ctx.error(
      null,
      "no-sign-in",
      `smithable.yml refers to users (${usesUsers.join(", ")}), but "signIn" is "none".`,
    );
  }
  const unreachable = ir.pages.filter((p) => !auth.public.pages.includes(p.id)).map((p) => p.id);
  if (unreachable.length) {
    ctx.warning(
      null,
      "unreachable-page",
      `Without sign-in only public pages can be opened, so nobody can open ${unreachable.join(", ")}.`,
      `List them under "public: pages", or enable sign-in.`,
    );
  }
}
