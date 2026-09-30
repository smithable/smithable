import { isMap, isScalar, isSeq, LineCounter, type ParsedNode, parseDocument } from "yaml";
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
import { conditionFits, type SpecIR, USER_MODEL } from "./ir.js";
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
}

/** Field values a record must have: a choice field's value, or a yes/no field's true or false. */
export type Condition = Record<string, string | boolean>;

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
export const PROVIDERS = ["google", "facebook"] as const;
export type Provider = (typeof PROVIDERS)[number];
const LATER_PROVIDERS = ["microsoft", "github", "apple", "email", "magicLink"];

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
  if (roles) {
    for (const { key, keyNode, value } of mapEntries(ctx, roles.value, `"roles"`) ?? []) {
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
  } else {
    auth.roles.push({ name: "member" });
  }
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
  if (ir) checkAgainstSpec(ctx, auth, ir, publicNodes);
  return done();
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
    const condition: Condition = {};
    for (const c of where
      ? (mapEntries(ctx, where.value, `"where" of "${entry.key}" in ${what}`) ?? [])
      : []) {
      if (
        isScalar(c.value) &&
        (typeof c.value.value === "string" || typeof c.value.value === "boolean")
      )
        condition[c.key] = c.value.value;
      else
        ctx.error(
          c.value,
          "invalid-value",
          `"where" of "${entry.key}" in ${what} compares a field with a choice value or true/false.`,
        );
    }
    if (Object.keys(condition).length) readWhere[entry.key] = condition;
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
): void {
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
              `"where" of ${name}: "${field}" must be a choice field of ${name} with one of its values, or a yes/no field with true or false.`,
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
