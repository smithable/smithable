// Part of the TanStack adapter's generator: keys for the API (docs/design/integrations.md §2).
// An administrator makes a key on the users page with a name, a role and an optional end date;
// it is shown once, stored as a hash, can be revoked, and shows when it was last used.
import type { AuthIR, SpecIR } from "@smithable/core";
import { HEADER, literal } from "./shared.js";

/** Whether the app has keys: an `api` block, sign-in, and a users page to make them on. */
export function hasKeys(ir: SpecIR, auth: AuthIR): boolean {
  return (
    Boolean(auth.api) && auth.signIn !== "none" && ir.pages.some((p) => p.pattern.kind === "users")
  );
}

export const KEY_TABLE = `export const apiKey = sqliteTable("api_key", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  role: text().notNull(),
  /** The key's SHA-256, never the key itself. */
  hash: text().notNull().unique(),
  /** Its first characters, to tell keys apart. */
  prefix: text().notNull(),
  expiresAt: integer({ mode: "timestamp_ms" }),
  lastUsedAt: integer({ mode: "timestamp_ms" }),
  revokedAt: integer({ mode: "timestamp_ms" }),
  createdById: text().notNull(),
  createdAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});`;

/** src/generated/keys.server.ts: making, listing, revoking and checking keys. */
export function keysModule(auth: AuthIR): string {
  return `${HEADER}// Keys for the API (docs/design/integrations.md §2). Server-only. A key is a role, not a person:
// what it creates has no owner, and the audit log names it by its name.
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "#/db";
import { apiKey } from "#/db/schema";
import { AccessDenied, personOf, type Viewer } from "#/kit/access";
import { audit } from "#/kit/audit.server";

export const KEY_ROLES = ${literal(auth.roles.map((r) => r.name))} as const;

const hash = (key: string) => createHash("sha256").update(key).digest("hex");

/** An administrator, a person: a key with the admin role never makes or revokes keys. */
function admin(viewer: Viewer | null): Viewer {
  if (viewer?.role !== "admin" || !personOf(viewer)) throw new AccessDenied(viewer !== null);
  return viewer;
}

/** The keys, newest first: what they are for, their role, when they end and were last used. */
export function listKeys(viewer: Viewer | null) {
  admin(viewer);
  return db
    .select({
      id: apiKey.id,
      name: apiKey.name,
      role: apiKey.role,
      prefix: apiKey.prefix,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      revokedAt: apiKey.revokedAt,
      createdAt: apiKey.createdAt,
    })
    .from(apiKey)
    .orderBy(desc(apiKey.id))
    .all();
}

/** Makes a key and returns it: the only time it is shown. */
export function makeKey(
  viewer: Viewer | null,
  name: string,
  role: (typeof KEY_ROLES)[number],
  until?: Date,
): string {
  const by = admin(viewer);
  // Its own check, not only the route's: a key stands for a role the app has.
  if (!(KEY_ROLES as readonly string[]).includes(role)) throw new Error("No such role.");
  if (until && until.getTime() < Date.now()) throw new Error("The end date is in the past.");
  const key = \`smk_\${randomBytes(24).toString("base64url")}\`;
  db.transaction((tx) => {
    tx.insert(apiKey)
      .values({ name: name.trim(), role, hash: hash(key), prefix: key.slice(0, 10), expiresAt: until, createdById: by.id })
      .run();
    // What touches security keeps its values (never the key): its name, role and end.
    audit(tx, by, { action: "key made", details: { name: name.trim(), role, until: until?.toISOString().slice(0, 10) ?? "none" } });
  });
  return key;
}

/** Revokes a key: it stops working at once. */
export function revokeKey(viewer: Viewer | null, id: number): void {
  const by = admin(viewer);
  db.transaction((tx) => {
    const revoked = tx
      .update(apiKey)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKey.id, id), isNull(apiKey.revokedAt)))
      .returning()
      .get();
    if (revoked) audit(tx, by, { action: "key revoked", details: { name: revoked.name, role: revoked.role } });
  });
}

/**
 * The caller a request's key stands for (\\\`Authorization: Bearer smk_…\\\`), or null: a key not
 * revoked and not past its end. Its id is "key:<n>", so nothing it does is anyone's own.
 */
export function keyViewer(authorization: string | null | undefined): Viewer | null {
  const key = /^Bearer (smk_[A-Za-z0-9_-]+)$/.exec(authorization ?? "")?.[1];
  if (!key) return null;
  const found = db
    .select()
    .from(apiKey)
    .where(
      and(
        eq(apiKey.hash, hash(key)),
        isNull(apiKey.revokedAt),
        or(isNull(apiKey.expiresAt), gt(apiKey.expiresAt, new Date())),
      ),
    )
    .get();
  if (!found) return null;
  db.update(apiKey).set({ lastUsedAt: new Date() }).where(eq(apiKey.id, found.id)).run();
  return { id: \`key:\${found.id}\`, name: found.name, email: "", role: found.role };
}
`;
}

/** src/generated/keys.test.ts: a key's life, against the test database. */
export function keysTestSource(auth: AuthIR): string {
  const other = auth.roles.map((r) => r.name).find((r) => r !== "admin");
  const role = other ?? "admin";
  return `${HEADER}// A key's life: made by an administrator, standing for its role, revoked or past its end.
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { db } from "#/db";
import { apiKey, auditLog, user } from "#/db/schema";
import { AccessDenied } from "#/kit/access";
import { keyViewer, listKeys, makeKey, revokeKey } from "./keys.server";
import { removeUser${other ? ", setRole" : ""} } from "./users.server";

const admin = { id: "keys-test-admin", name: "Keys test admin", email: "keys-test-admin@example.com", role: "admin" };

test("an administrator makes a key; it stands for its role until revoked or past its end", async () => {
  const key = makeKey(admin, "Billing sync", ${JSON.stringify(role)});
  expect(key).toMatch(/^smk_/);
  expect(keyViewer(\`Bearer \${key}\`)).toMatchObject({ id: expect.stringMatching(/^key:/), name: "Billing sync", role: ${JSON.stringify(role)} });
  // Stored as a hash: the key itself is nowhere, not in the table and not in the audit log.
  expect(JSON.stringify(db.select().from(apiKey).all())).not.toContain(key);
  expect(JSON.stringify(db.select().from(auditLog).all())).not.toContain(key);
  const made = listKeys(admin).find((k) => k.name === "Billing sync");
  expect(made?.lastUsedAt).toBeInstanceOf(Date);
  revokeKey(admin, made?.id ?? 0);
  expect(keyViewer(\`Bearer \${key}\`)).toBeNull();
  // A key cannot be made already ended; one whose end has passed stops working.
  expect(() => makeKey(admin, "Ended", ${JSON.stringify(role)}, new Date(Date.now() - 1000))).toThrow("The end date is in the past.");
  const old = makeKey(admin, "Old", ${JSON.stringify(role)}, new Date(Date.now() + 1000));
  db.update(apiKey).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(apiKey.name, "Old")).run();
  expect(keyViewer(\`Bearer \${old}\`)).toBeNull();
  expect(keyViewer("Bearer smk_madeup")).toBeNull();
  expect(keyViewer(null)).toBeNull();
${other ? `  expect(() => makeKey({ ...admin, id: "keys-test-other", role: ${JSON.stringify(other)} }, "Mine", ${JSON.stringify(other)})).toThrow(AccessDenied);\n` : ""}  // A key cannot make keys, whatever its role.
  expect(() => makeKey(admin, "Made up", "superuser" as never)).toThrow("No such role.");
  const adminKey = makeKey(admin, "Admin key", "admin");
  expect(() => makeKey(keyViewer(\`Bearer \${adminKey}\`), "Minted", "admin")).toThrow(AccessDenied);
  revokeKey(admin, listKeys(admin).find((k) => k.name === "Admin key")?.id ?? 0);
  // A key goes with the person who made it.
  const maker = { id: "keys-test-maker", name: "Maker", email: "keys-test-maker@example.com", role: "admin" };
  db.insert(user).values(maker).run();
  const theirs = makeKey(maker, "Theirs", ${JSON.stringify(role)});
  await removeUser(admin, maker.id);
  expect(keyViewer(\`Bearer \${theirs}\`)).toBeNull();
${
  other
    ? `  // And with the role they had: a new role ends the keys they made.
  const demoted = { id: "keys-test-demoted", name: "Demoted", email: "keys-test-demoted@example.com", role: "admin" };
  db.insert(user).values(demoted).run();
  const before = makeKey(demoted, "Before", "admin");
  await setRole(admin, demoted.id, ${JSON.stringify(other)});
  expect(keyViewer(\`Bearer \${before}\`)).toBeNull();
`
    : ""
}  // What touches security keeps its values: the key's name and role, never the key.
  const lines = db.select().from(auditLog).all().filter((l) => l.action.startsWith("key "));
  expect(lines.map((l) => [l.action, l.who, l.details?.name])).toEqual([
    ["key made", admin.id, "Billing sync"],
    ["key revoked", admin.id, "Billing sync"],
    ["key made", admin.id, "Old"],
    ["key made", admin.id, "Admin key"],
    ["key revoked", admin.id, "Admin key"],
    ["key made", maker.id, "Theirs"],
    ["key revoked", admin.id, "Theirs"],${other ? `\n    ["key made", "keys-test-demoted", "Before"],\n    ["key revoked", admin.id, "Before"],` : ""}
  ]);
});
`;
}
