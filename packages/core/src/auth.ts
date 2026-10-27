import { isMap, isScalar, isSeq, LineCounter, type ParsedNode, parseDocument } from "yaml";
import { modelAccess, uniqueScope } from "./access.js";
import { readCondition } from "./condition.js";
import {
  type At,
  checkKeys,
  type Entry,
  mapEntries,
  type NameReference,
  ParseContext,
  readBoolean,
  readNameList,
  readString,
} from "./context.js";
import { type Diagnostic, hasErrors } from "./diagnostics.js";
import { type Condition, conditionFits, type SpecIR, USER_MODEL } from "./ir.js";

export type { Condition } from "./ir.js";

import { capitalize } from "./naming.js";
import { patternInfo } from "./patterns.js";
import { FIELD_NAME_PATTERN, nameRule } from "./sections/names.js";
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
  /** Email addresses that become admins when they sign in (also one added later). */
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
  /**
   * "Ask" in the app (docs/design/assistant.md §6): who gets it and whether it may change
   * things. Absent: the people who use the app do not get it.
   */
  assistant?: AssistantIR;
}

export interface AssistantIR {
  /**
   * The roles that get "Ask"; `signed-in` is everyone who signs in; `anyone` is visitors too,
   * who are answered by the wording rules only, never by a model.
   */
  for: "signed-in" | "anyone" | string[];
  /** `read` (the default): it finds and counts. `change`: it also adds, changes and runs actions, each confirmed. */
  may: "read" | "change";
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

/** Names a grant lists, or `all`. */
export type GrantNames = "all" | string[];
export const GRANT_KEYS = [
  "pages",
  "read",
  "create",
  "write",
  "delete",
  "actions",
  "review",
] as const;
export type GrantKey = (typeof GRANT_KEYS)[number];
/**
 * What a role may do beyond the record rule (docs/design/access-in-auth.md): the pages it opens,
 * the models it adds to, reads (with private access), changes and deletes for anyone, the
 * custom actions it runs, and the models whose waiting files it approves or rejects (review,
 * docs/design/file-review.md). `all` on the role is every grant; `all` in a grant is every name.
 */
export type RoleGrants = Partial<Record<GrantKey, GrantNames>>;

export interface RoleIR {
  name: string;
  description?: string;
  /** `all` for the whole app (always admin's), or the role's grants, each absent when nothing. */
  grants: "all" | RoleGrants;
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
): { auth?: AuthIR; diagnostics: Diagnostic[]; references: NameReference[] } {
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
    roles: [{ name: "admin", grants: "all" }],
    defaultRole: "admin",
    admins: [],
    public: { pages: [], read: [], create: [], readWhere: {} },
  };
  const done = () => ({
    ...(hasErrors(ctx.diagnostics) ? {} : { auth }),
    diagnostics: [...ctx.diagnostics].sort((a, b) => a.line - b.line || a.column - b.column),
    references: ctx.nameReferences(),
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
        "assistant",
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
  const grantNodes: { role: string; key: GrantKey; at: At; items: { name: string; at: At }[] }[] =
    [];
  if (roles) {
    for (const { key, keyNode, value } of mapEntries(ctx, roles.value, `"roles"`) ?? []) {
      roleNodes.set(key, keyNode);
      if (!FIELD_NAME_PATTERN.test(key) || key === "owner") {
        ctx.error(
          keyNode,
          "invalid-name",
          key === "owner"
            ? `"owner" is not a role: it means the owner of a record.`
            : nameRule("role", key),
        );
        continue;
      }
      const role: RoleIR = { name: key, grants: key === "admin" ? "all" : {} };
      const where = `role "${key}"`;
      if (isScalar(value) && value.value === "all") {
        role.grants = "all";
      } else if (isScalar(value) && value.value !== null) {
        ctx.error(
          value,
          "invalid-value",
          `${capitalize(where)} is "all" (the whole app) or a block: description, pages, read, create, write, delete, actions, review.`,
        );
      } else if (value !== null && !isScalar(value)) {
        for (const entry of checkKeys(ctx, mapEntries(ctx, value, where) ?? [], where, {
          allowed: ["description", ...GRANT_KEYS],
        })) {
          if (entry.key === "description") {
            const description = readString(ctx, entry.value, `The description of ${where}`);
            if (description !== undefined) role.description = description;
            continue;
          }
          const grant = entry.key as GrantKey;
          if (key === "admin") {
            ctx.error(
              entry.keyNode,
              "invalid-key",
              `Administrators do everything: "admin" is "all", or a block with only a description.`,
            );
            continue;
          }
          const read = readGrant(ctx, entry.value, `"${grant}" of ${where}`);
          if (!read) continue;
          (role.grants as RoleGrants)[grant] = read.names;
          grantNodes.push({ role: key, key: grant, at: entry.keyNode, items: read.items });
          // Names of the spec's things, for a rename to follow (checked by checkGrants).
          if (grant !== "actions")
            for (const item of read.items)
              ctx.reference(grant === "pages" ? "page" : "model", item.name, item.at);
        }
      }
      if (key === "admin") auth.roles[0] = role;
      else auth.roles.push(role);
    }
  }
  // "admin" always exists, and so does a role for everyone else: "member" when none is declared
  // (also when "roles" lists only admin, which would otherwise make every newcomer one).
  if (!auth.roles.some((r) => r.name !== "admin")) auth.roles.push({ name: "member", grants: {} });
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
      for (const item of publicNodes[k])
        ctx.reference(k === "pages" ? "page" : "model", item.name, item.at);
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
  const assistant = byKey.get("assistant");
  if (assistant) readAssistant(ctx, assistant, auth, roleNames);
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
  if (ir) {
    checkAgainstSpec(ctx, auth, ir, publicNodes, defaultAccess?.value ?? root);
    checkGrants(ctx, auth, ir, grantNodes, roleNodes, roles?.keyNode ?? root);
  }
  if (ir && apiNodes) checkApi(ctx, auth, ir, apiNodes);
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
/** `assistant: { for: [admin, staff] | signed-in | anyone, may: read | change }`. */
function readAssistant(ctx: ParseContext, entry: Entry, auth: AuthIR, roleNames: string[]): void {
  const where = `"assistant"`;
  const byKey = new Map(
    checkKeys(ctx, mapEntries(ctx, entry.value, where) ?? [], where, {
      allowed: ["for", "may"],
    }).map((e) => [e.key, e]),
  );
  const who = byKey.get("for");
  if (!who) {
    ctx.error(
      entry.keyNode,
      "missing-key",
      `"assistant" needs "for": the roles that get it, like [admin, staff], or signed-in, or anyone.`,
    );
    return;
  }
  let whom: AssistantIR["for"];
  if (isScalar(who.value)) {
    const word = readString(ctx, who.value, `"for" in "assistant"`);
    if (word !== "signed-in" && word !== "anyone") {
      if (word !== undefined)
        ctx.error(
          who.value,
          "invalid-value",
          `"for" in "assistant" is a list of roles, like [admin], or signed-in (everyone who signs in), or anyone (visitors too).`,
        );
      return;
    }
    whom = word;
  } else {
    const roles = readNameList(ctx, who.value, `"for" in "assistant"`);
    for (const { name, at } of roles)
      if (!roleNames.includes(name))
        ctx.error(
          at,
          "unknown-role",
          `There is no role named "${name}".`,
          didYouMean(name, roleNames),
        );
    if (roles.length === 0) return;
    whom = roles.map((r) => r.name);
  }
  const mayEntry = byKey.get("may");
  const may = mayEntry ? readString(ctx, mayEntry.value, `"may" in "assistant"`) : "read";
  if (may !== "read" && may !== "change") {
    if (may !== undefined)
      ctx.error(
        mayEntry?.value ?? entry.keyNode,
        "invalid-value",
        `"may" in "assistant" is read (it finds and counts) or change (it also adds, changes and runs actions, each confirmed).`,
      );
    return;
  }
  if (auth.signIn === "none" && whom !== "anyone")
    ctx.error(
      who.value,
      "no-sign-in",
      `Nobody signs in to this app ("signIn" is "none"), so "Ask" can only be for anyone.`,
    );
  // Visitors are answered over what is public: with nothing public there is nothing to ask about.
  if (whom === "anyone" && auth.public.read.length === 0)
    ctx.warning(
      who.value,
      "assistant-nothing-public",
      `"Ask" is for anyone, but visitors may read nothing (public.read is empty), so it has nothing to answer them with.`,
    );
  auth.assistant = { for: whom, may };
}

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
    for (const item of offered) ctx.reference("model", item.name, item.at);
  }
  const except = byKey.get("except");
  if (except) {
    nodes.exceptAt = except.keyNode;
    nodes.exceptNames = readNameList(ctx, except.value, `"except" in "api"`);
    api.except = nodes.exceptNames.map((m) => m.name);
    for (const item of nodes.exceptNames) ctx.reference("model", item.name, item.at);
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

/** A role's grant: `all`, or a list of names. */
function readGrant(
  ctx: ParseContext,
  node: At,
  what: string,
): { names: GrantNames; items: { name: string; at: At }[] } | undefined {
  if (isScalar(node) && node.value === "all") return { names: "all", items: [] };
  if (!isSeq(node)) {
    ctx.error(node, "expected-list", `${what} is "all" or a list of names, like [a, b].`);
    return undefined;
  }
  const items = readNameList(ctx, node, what);
  return { names: items.map((i) => i.name), items };
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

/**
 * A role's grants name what exists: pages, models and actions (a standard action is run by
 * whoever may change the record too, docs/design/actions.md). A role that can open no page is warned about, and so is
 * "read" under shared access, where everyone who signs in reads every record already.
 */
function checkGrants(
  ctx: ParseContext,
  auth: AuthIR,
  ir: SpecIR,
  grantNodes: { role: string; key: GrantKey; at: At; items: { name: string; at: At }[] }[],
  roleNodes: Map<string, At>,
  at: At,
): void {
  const pages = ir.pages.map((p) => p.id);
  const models = ir.models.map((m) => m.name);
  const actions = ir.actions.map((a) => a.name);
  for (const { role, key, at, items } of grantNodes) {
    const names = key === "pages" ? pages : key === "actions" ? actions : models;
    const kind = key === "pages" ? "page" : key === "actions" ? "action" : "model";
    for (const { name, at: itemAt } of items) {
      if (names.includes(name)) continue;
      ctx.error(
        itemAt,
        `unknown-${kind.replace(" ", "-")}`,
        `There is no ${kind} named "${name}" in smithable.yml.`,
        didYouMean(name, names),
      );
    }
    // With private access a role reads only its own records unless granted "read", so "write" or
    // "delete" on records it cannot read is odd: nothing lets it open them. "create" without
    // "read" is fine (a form-only role).
    if ((key === "write" || key === "delete") && auth.defaultAccess === "private") {
      const grants = auth.roles.find((r) => r.name === role)?.grants;
      const read = grants && grants !== "all" ? grants.read : undefined;
      const wanted = items.length ? items.map((i) => i.name) : ["all"];
      const unread =
        read === "all" ? [] : wanted.filter((n) => n === "all" || !(read ?? []).includes(n));
      if (unread.length)
        ctx.warning(
          at,
          "write-without-read",
          `${role} may ${key === "write" ? "change" : "delete"} ${unread.includes("all") ? "every record" : `others' ${unread.join(", ")}`} it cannot read: with private access a role reads only its own records unless granted "read".`,
          `Grant ${role} "read" on ${unread.includes("all") ? "all" : "them"} too, or drop the "${key}".`,
        );
    }
    if (key === "read" && auth.defaultAccess === "shared")
      ctx.warning(
        at,
        "read-with-shared",
        `Everyone who signs in reads every record under shared access, so "read" of ${role} says nothing.`,
        `Remove it, or use "defaultAccess: private" and grant reading to the roles that read everyone's records.`,
      );
  }
  if (auth.signIn === "none") return;
  const closed = ir.pages.filter((p) => !auth.public.pages.includes(p.id));
  // A role for keys: with an api block, a role granted something on a model the API offers is
  // used through the API (docs/design/integrations.md §2) and needs no page.
  const offered = !auth.api
    ? []
    : auth.api.models === "all"
      ? models.filter((m) => !auth.api?.except.includes(m))
      : auth.api.models;
  const keyed = (grants: RoleGrants) =>
    (["read", "create", "write", "delete"] as const).some((k) => {
      const g = grants[k];
      return g === "all" ? offered.length > 0 : (g ?? []).some((n) => offered.includes(n));
    });
  for (const role of auth.roles) {
    if (role.grants === "all" || !closed.length) continue;
    const opens = role.grants.pages === "all" || (role.grants.pages?.length ?? 0) > 0;
    if (!opens && keyed(role.grants)) continue;
    if (!opens)
      ctx.warning(
        roleNodes.get(role.name) ?? at,
        "role-opens-nothing",
        `${role.name} can open no page: a role opens only the pages its "pages" lists.`,
        `Add "pages: all" (or a list of pages) under roles.${role.name} in smithable.auth.yml.`,
      );
  }
}

/** What the public section names must exist, and the spec must fit the sign-in setting. */
function checkAgainstSpec(
  ctx: ParseContext,
  auth: AuthIR,
  ir: SpecIR,
  publicNodes: Partial<Record<keyof AuthIR["public"], { name: string; at: At }[]>>,
  accessAt: At,
): void {
  // "unique: owner" is per owner, which an app without sign-in has none of.
  if (auth.signIn === "none")
    for (const model of ir.models) {
      const owned = [
        ...model.fields.filter((f) => f.unique === "owner").map((f) => `${model.name}.${f.name}`),
        ...(model.unique ?? [])
          .filter((u) => u.scope === "owner")
          .map((u) => `${model.name}'s ${u.fields.join(" and ")}`),
      ];
      if (owned.length)
        ctx.error(
          accessAt,
          "unique-owner-no-sign-in",
          `${owned.join(", ")} ${owned.length > 1 ? "are" : "is"} unique per owner, but nobody signs in to this app, so records have no owner. Write "unique: app" (or true), or let people sign in.`,
        );
    }
  // A capacity per a unique reference holds one record per referenced record when "unique" is
  // global (not per owner): a max above 1 is never reached. The default access decides which.
  for (const model of ir.models) {
    const capacity = model.capacity;
    const per = capacity && model.fields.find((f) => f.name === capacity.per);
    if (!capacity || !per?.unique || uniqueScope(per.unique, model, auth) !== "app") continue;
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
    const what = page?.pattern.kind === "order" ? "order form" : "contact form";
    for (const form of page ? patternInfo(page).forms() : []) {
      if (!auth.public.create.includes(form))
        ctx.warning(
          at,
          "contact-form-closed",
          `The ${what} on the ${name} page adds a ${form}, but visitors may not add one, so nobody without an account can send it.`,
          `Add ${form} to "create" under "public".`,
        );
    }
  }
  // An incoming call acts as its role (integrations.md §3): the role must exist, and a record it
  // adds goes through that role's create rule.
  for (const i of ir.incoming) {
    if (!auth.roles.some((r) => r.name === i.as)) {
      ctx.error(
        accessAt,
        "unknown-role",
        `Incoming call "${i.name}" acts as "${i.as}", which is no role in smithable.auth.yml.`,
        didYouMean(
          i.as,
          auth.roles.map((r) => r.name),
        ),
      );
      continue;
    }
    const model = i.create ? ir.models.find((m) => m.name === i.create) : undefined;
    if (model && !modelAccess(model, auth).create.roles.includes(i.as))
      ctx.warning(
        accessAt,
        "incoming-cannot-create",
        `Incoming call "${i.name}" acts as ${i.as}, who may not add ${model.name} records: every call would be refused.`,
        `Grant ${i.as} create on ${model.name}, or let the call act as another role.`,
      );
    // What a reply changes on its record (then) is a change made as that role.
    if (model && i.reply?.update.length && !modelAccess(model, auth).write.roles.includes(i.as))
      ctx.warning(
        accessAt,
        "incoming-cannot-update",
        `Incoming call "${i.name}" acts as ${i.as}, who may not change ${model.name} records: a reply would be added but change nothing on its ${model.name.toLowerCase()}.`,
        `Grant ${i.as} write on ${model.name}, or let the call act as another role.`,
      );
    // A reply to one of its records (mail-threads.md §2) is added the same way.
    const reply = i.reply ? ir.models.find((m) => m.name === i.reply?.create) : undefined;
    if (reply && !modelAccess(reply, auth).create.roles.includes(i.as))
      ctx.warning(
        accessAt,
        "incoming-cannot-create",
        `Incoming call "${i.name}" acts as ${i.as}, who may not add ${reply.name} records: every reply would be refused.`,
        `Grant ${i.as} create on ${reply.name}, or let the call act as another role.`,
      );
  }
  // Outgoing mail (integrations.md §4.1b) meets the access rules here. An address typed by a
  // visitor is not sent to when the visitor's own change sends it: the app would mail whoever a
  // stranger names. On a standard action staff press (an order accepted, orders.md §4) it is the
  // staff's decision, and the mail goes. A role that may not read the record would be told what
  // it holds.
  for (const o of ir.outgoing) {
    const r = o.recipient;
    // A custom action's mail goes to a role and tells no record.
    if (o.to !== "mail" || !r || "custom" in o.when) continue;
    const on = o.when.model;
    const model = ir.models.find((m) => m.name === on);
    if (!model) continue;
    // The address is typed on the record itself, or on each record of a list of them.
    const typed =
      r.kind === "field" && r.via === "email" && r.path.length === 1
        ? { field: r.path[0], on: model }
        : r.kind === "list" && r.each.kind === "field" && r.each.via === "email"
          ? { field: r.each.field, on: ir.models.find((m) => m.name === r.model) ?? model }
          : undefined;
    const createdByVisitors = typed && publicNodes.create?.find((n) => n.name === typed.on.name);
    if (typed && createdByVisitors && "event" in o.when)
      ctx.warning(
        createdByVisitors.at,
        "visitor-typed-recipient",
        `Visitors may add ${typed.on.name} records and type any address in ${typed.field}, so the app does not send "${o.name}" to it: a stranger could make the app mail anyone.`,
        `Mail the owner or a role instead, or take ${typed.on.name} out of "create" under "public".`,
      );
    if (r.kind === "role") {
      const read = modelAccess(model, auth).read;
      if (!read.public && !read.roles.includes(r.role))
        ctx.warning(
          accessAt,
          "recipient-cannot-read",
          `"${o.name}" mails every ${r.role} about ${model.name} records, which ${r.role} may not read: the mail would tell them what the record holds.`,
          `Let ${r.role} read ${model.name} (read: [${model.name}] under roles.${r.role} in smithable.auth.yml), or mail another role.`,
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
  // A public page shows a visitor only what visitors may read: records of a model that is not
  // under public.read are simply missing there (an empty catalogue, a landing section with no
  // cards), which looks broken rather than closed.
  for (const { name, at } of publicNodes.pages ?? []) {
    const page = ir.pages.find((p) => p.id === name);
    if (!page || page.mine) continue;
    const closed = [...new Set(patternInfo(page).reads())].filter(
      (m) => m !== USER_MODEL && !auth.public.read.includes(m),
    );
    if (closed.length)
      ctx.warning(
        at,
        "public-page-closed-records",
        `Visitors can open ${name}, but may not read ${closed.join(" or ")}, so the page shows them none: add ${closed.length > 1 ? "them" : "it"} under public.read, or ${page.pattern.kind === "landing" ? `remove the section of ${name} that shows ${closed.length > 1 ? "them" : "it"}` : `take ${name} out of public.pages`}.`,
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
