// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import { type AuthIR, humanize, type SpecIR, USER_MODEL } from "@smithable/core";
import { hasSignIn, roleLabels } from "./auth.js";
import { hasKeys } from "./keys.js";
import { HEADER, literal, type Texts, tableRef } from "./shared.js";

/**
 * Every column that names a person: each reference to a user, and a record's owner. Removing a
 * person gives these to another member, or clears the ones that may be empty (docs/design/
 * admin.md).
 */
function userUses(ir: SpecIR, auth: AuthIR, t: Texts) {
  return ir.models.flatMap((model) => {
    const noun = [t.modelLabel(model).toLowerCase(), t.modelPluralLabel(model).toLowerCase()];
    const refs = model.fields.flatMap((f) =>
      f.type.kind === "relation" && !f.type.many && f.type.model === USER_MODEL
        ? [
            {
              column: `${f.name}Id`,
              field: (t.field(model, f).label ?? humanize(f.name)).toLowerCase() as string | null,
              required: f.required,
            },
          ]
        : [],
    );
    const owner =
      hasSignIn(auth) && !model.ownedBy
        ? [{ column: "ownerId", field: null, required: false }]
        : [];
    return [...refs, ...owner].map((use) => ({
      ...use,
      model: model.name,
      table: tableRef(model),
      noun,
    }));
  });
}

/** The users page's id (there is one). */
function usersPage(ir: SpecIR): string {
  const page = ir.pages.find((p) => p.pattern.kind === "users");
  if (!page) throw new Error("No users page");
  return page.id;
}

/**
 * src/generated/users.server.ts: the users, the open invitations and what an administrator (or
 * the users page's roles) does with them. Acceptance is by verified email address at sign-in
 * (src/lib/auth.ts); the token in the link only tells the sign-in page whom it is for.
 */
export function usersServerModule(ir: SpecIR, auth: AuthIR, t: Texts): string {
  const roles = auth.roles.map((r) => r.name);
  const uses = userUses(ir, auth, t);
  return `${HEADER}// Who has access: the users and the open invitations, and what an administrator does with them.
// Server-only. The users page's server functions pass the viewer; nothing here trusts the client.
import { randomBytes, randomUUID } from "node:crypto";
import { getRequestUrl } from "@tanstack/react-start/server";
import { ${hasKeys(ir, auth) ? "and, asc, eq, isNull" : "asc, eq"} } from "drizzle-orm";
import { db } from "#/db";
import { ${hasKeys(ir, auth) ? "apiKey, invitation, user" : "invitation, user"} } from "#/db/schema";${uses.length ? '\nimport * as schema from "#/db/schema";' : ""}
import { app } from "#/generated/app";
import { pageAccess } from "#/generated/pages";
import { AccessDenied, check, personOf, type Viewer } from "#/kit/access";
import { audit } from "#/kit/audit.server";
import { sendMail } from "#/kit/mail";
import { w } from "#/kit/words";

export const ROLES = ${literal(roles)} as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<string, string> = ${literal(roleLabels(auth))};
/** How long an invitation can be accepted. */
export const INVITATION_DAYS = 14;

/** Who may manage users: the ${usersPage(ir)} page's rule (administrators always). */
const RULE = pageAccess[${JSON.stringify(usersPage(ir))}];

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface InvitationRow {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  link: string;
}

/** Where invitation links point: the app's public address, or the address this request used. */
export const origin = () => process.env.BETTER_AUTH_URL ?? getRequestUrl().origin;

/** Who may manage users: a person with the page's role; an API key never, whatever its role. */
function manager(viewer: Viewer | null): Viewer {
  check(RULE, viewer);
  if (!personOf(viewer)) throw new AccessDenied(true);
  return viewer as Viewer;
}

const link = (origin: string, token: string) => \`\${origin}/sign-in?invite=\${token}\`;

const row = (i: typeof invitation.$inferSelect, origin: string): InvitationRow => ({
  id: i.id,
  email: i.email,
  role: i.role,
  expiresAt: i.expiresAt,
  link: link(origin, i.token),
});

/** Everyone with access, and the invitations not yet accepted. */
export async function listUsers(
  viewer: Viewer | null,
  origin: string,
): Promise<{ users: UserRow[]; invitations: InvitationRow[] }> {
  manager(viewer);
  return {
    users: db
      .select({ id: user.id, name: user.name, email: user.email, role: user.role })
      .from(user)
      .orderBy(asc(user.name))
      .all(),
    invitations: db
      .select()
      .from(invitation)
      .orderBy(asc(invitation.email))
      .all()
      .map((i) => row(i, origin)),
  };
}

/** Invites an address with a role, replacing an open invitation to it, and sends the mail. */
export async function invite(
  viewer: Viewer | null,
  email: string,
  role: Role,
  origin: string,
): Promise<InvitationRow> {
  const by = manager(viewer);
  const address = email.trim().toLowerCase();
  if (db.select({ id: user.id }).from(user).where(eq(user.email, address)).get())
    throw new Error(\`\${address} already has access.\`);
  const created = db.transaction((tx) => {
    tx.delete(invitation).where(eq(invitation.email, address)).run();
    audit(tx, by, { action: "invited", model: "User", details: { email: address, role } });
    return tx
      .insert(invitation)
      .values({
        id: randomUUID(),
        email: address,
        role,
        token: randomBytes(24).toString("base64url"),
        invitedById: by.id,
        expiresAt: new Date(Date.now() + INVITATION_DAYS * 86_400_000),
      })
      .returning()
      .get();
  });
  const result = row(created, origin);
  await sendInvitation(by, result);
  return result;
}

/** Sends an open invitation again, and gives it the full time to be accepted once more. */
export async function resendInvitation(
  viewer: Viewer | null,
  invitationId: string,
  origin: string,
): Promise<void> {
  const by = manager(viewer);
  const renewed = db.transaction((tx) => {
    const sent = tx
      .update(invitation)
      .set({ expiresAt: new Date(Date.now() + INVITATION_DAYS * 86_400_000) })
      .where(eq(invitation.id, invitationId))
      .returning()
      .get();
    if (sent)
      audit(tx, by, { action: "invitation sent again", model: "User", details: { email: sent.email, role: sent.role } });
    return sent;
  });
  if (!renewed) throw new Error("This invitation no longer exists.");
  await sendInvitation(by, row(renewed, origin));
}

export async function withdrawInvitation(viewer: Viewer | null, invitationId: string): Promise<void> {
  const by = manager(viewer);
  db.transaction((tx) => {
    const gone = tx.delete(invitation).where(eq(invitation.id, invitationId)).returning().get();
    if (gone)
      audit(tx, by, { action: "invitation withdrawn", model: "User", details: { email: gone.email, role: gone.role } });
  });
}

/** Gives a user another role; never your own, and the last administrator stays one. */
export async function setRole(viewer: Viewer | null, userId: string, role: Role): Promise<void> {
  const by = manager(viewer);
  if (userId === by.id) throw new Error("You cannot change your own role.");
  const target = db.select({ role: user.role, name: user.name }).from(user).where(eq(user.id, userId)).get();
  if (!target) throw new Error("This user no longer exists.");
  if (target.role === "admin" && role !== "admin" && admins() === 1)
    throw new Error("The last administrator stays an administrator.");
  db.transaction((tx) => {
    tx.update(user).set({ role }).where(eq(user.id, userId)).run();
    // What touches security keeps its values: who, what they were and what they became.
    audit(tx, by, { action: "role changed", model: "User", details: { user: userId, from: target.role, to: role } });${
      hasKeys(ir, auth)
        ? `
    // The keys they made were made at the role they had: a new role ends them.
    if (role !== target.role)
      for (const key of tx
        .update(apiKey)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiKey.createdById, userId), isNull(apiKey.revokedAt)))
        .returning()
        .all())
        audit(tx, by, { action: "key revoked", details: { name: key.name, role: key.role, why: "its maker's role changed" } });`
        : ""
    }
  });
}

/** What names a person: how many records of each kind, live or in the trash, by the column. */
export interface UserUse {
  model: string;
  /** The reference's label ("assignee"); null for the records that are the person's own. */
  field: string | null;
  noun: [string, string];
  /** A required reference: removing the person needs someone to give these to. */
  required: boolean;
  count: number;
}

/** The records that name a person, for the remove dialog. */
export function usesOf(viewer: Viewer | null, userId: string): UserUse[] {
  manager(viewer);
  const uses: UserUse[] = [
${uses
  .map(
    (u) =>
      `    { model: ${JSON.stringify(u.model)}, field: ${JSON.stringify(u.field)}, noun: ${literal(u.noun)}, required: ${u.required}, count: db.select({ id: ${u.table}.id }).from(${u.table}).where(eq(${u.table}.${u.column}, userId)).all().length },`,
  )
  .join("\n")}
  ];
  return uses.filter((use) => use.count > 0);
}

/**
 * Removes a user: they can no longer sign in and their sessions end. What names them (a
 * reference, the records that are theirs, in the trash too) goes to the heir, another member,
 * in the same transaction; without one, what may be empty is cleared and a required reference
 * (a record they are the account manager of, say) refuses the removal. Never yourself or the
 * last administrator.
 */
export async function removeUser(viewer: Viewer | null, userId: string, heirId?: string): Promise<void> {
  const by = manager(viewer);
  if (userId === by.id) throw new Error("You cannot remove yourself.");
  const heir = heirId ? db.select({ id: user.id }).from(user).where(eq(user.id, heirId)).get() : undefined;
  if (heirId && (!heir || heirId === userId)) throw new Error("Choose someone on the team to give them to.");
  const target = db
    .select({ role: user.role, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .get();
  if (!target) return;
  if (target.role === "admin" && admins() === 1)
    throw new Error("The last administrator cannot be removed.");
  try {
    db.transaction((tx) => {${
      hasKeys(ir, auth)
        ? `
      // Their keys go with them: a key outlives nobody who made it.
      for (const key of tx
        .update(apiKey)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiKey.createdById, userId), isNull(apiKey.revokedAt)))
        .returning()
        .all())
        audit(tx, by, { action: "key revoked", details: { name: key.name, role: key.role, why: "its maker was removed" } });`
        : ""
    }
${uses
  .map(
    (u) => `
      {
        const moved = ${u.required ? "heir ? " : ""}tx.update(${u.table}).set({ ${u.column}: ${u.required ? "heir.id" : "heir?.id ?? null"} }).where(eq(${u.table}.${u.column}, userId)).returning({ id: ${u.table}.id }).all()${u.required ? " : []" : ""};
        if (moved.length) audit(tx, by, { action: heir ? "records reassigned" : "records cleared", model: ${JSON.stringify(u.model)}, details: { column: ${JSON.stringify(u.column)}, user: userId, to: heir?.id ?? null, records: moved.map((r) => r.id) } });
      }`,
  )
  .join("")}
      tx.delete(user).where(eq(user.id, userId)).run();
      audit(tx, by, { action: "user removed", model: "User", title: target.name, details: { user: userId, email: target.email, role: target.role } });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("FOREIGN KEY constraint failed"))
      throw new Error(\`\${target.name} is still named in records: choose someone to give them to.\`);
    throw error;
  }
}

function admins(): number {
  return db.select({ id: user.id }).from(user).where(eq(user.role, "admin")).all().length;
}

async function sendInvitation(by: Viewer, invited: InvitationRow): Promise<void> {
  const until = invited.expiresAt.toISOString().slice(0, 10);
  await sendMail({
    to: invited.email,
    subject: w.invitationSubject(app.name),
    text: w.invitationText(by.name, app.name, ROLE_LABELS[invited.role] ?? invited.role, invited.email, invited.link, until),
  });
}
`;
}

/**
 * src/generated/users.test.ts: an invited address gets in with its role, closed sign-up keeps
 * everyone else out, and an administrator cannot lock the app by changing their own account.
 */
export function usersTestSource(ir: SpecIR, auth: AuthIR): string {
  if (auth.signIn === "none") throw new Error("No sign-in");
  const domain = auth.signIn.allowedDomains?.[0] ?? "example.com";
  const other = auth.roles.map((r) => r.name).find((r) => r !== "admin");
  const closed = !auth.signIn.selfSignUp;
  return `${HEADER}// Invitations and user management: who gets in, with which role, and what an administrator may
// not do to their own account. Against the test database, like access.test.ts.
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { db } from "#/db";
import { auditLog, invitation, user } from "#/db/schema";
import { AccessDenied } from "#/kit/access";
${other ? 'import { forgetInLog } from "#/kit/audit.server";\n' : ""}import { outbox } from "#/kit/mail";
import { auth } from "#/lib/auth";
import { pageAccess } from "#/generated/pages";
import { invite, listUsers, removeUser, resendInvitation, ROLES, setRole, withdrawInvitation } from "./users.server";

const ORIGIN = "https://team.example";
/** The audit log's lines of one kind, oldest first. */
const audited = (action: string) =>
  db.select().from(auditLog).where(eq(auditLog.action, action)).all();
const admin = { id: "users-test-admin", name: "Users test admin", email: "users-test-admin@${domain}", role: "admin" };
db.insert(user).values(admin).run();

async function signUp(email: string) {
  const result = await auth.api.signUpEmail({
    body: { email, password: "users-test-password", name: email.split("@")[0] ?? email },
  });
  return db.select().from(user).where(eq(user.id, result.user.id)).get();
}

test("an invited address signs up with the invited role, and the invitation is used up", async () => {
  const before = outbox().length;
  const invited = await invite(admin, "Users-Test-Invited@${domain}", ${JSON.stringify(other ?? "admin")}, ORIGIN);
  expect(invited.email).toBe("users-test-invited@${domain}");
  expect(invited.link).toMatch(new RegExp(\`^\${ORIGIN}/sign-in\\\\?invite=[A-Za-z0-9_-]+$\`));
  const mail = outbox().at(-1);
  expect(outbox().length).toBe(before + 1);
  expect(mail).toMatchObject({ to: "users-test-invited@${domain}", subject: ${JSON.stringify(`Invitation to ${ir.app.name}`)} });
  expect(mail?.text).toContain(invited.link);
  const listed = await listUsers(admin, ORIGIN);
  expect(listed.invitations.map((i) => i.email)).toContain("users-test-invited@${domain}");

  const created = await signUp("users-test-invited@${domain}");
  expect(created?.role).toBe(${JSON.stringify(other ?? "admin")});
  expect(db.select().from(invitation).where(eq(invitation.email, "users-test-invited@${domain}")).get()).toBeUndefined();
  // The audit log has both ends, with their values: who was invited as what, and who accepted.
  expect(audited("invited").at(-1)).toMatchObject({ who: admin.id, details: { email: "users-test-invited@${domain}", role: ${JSON.stringify(other ?? "admin")} } });
  expect(audited("invitation accepted").at(-1)).toMatchObject({ who: created?.id, details: { role: ${JSON.stringify(other ?? "admin")} } });
});
${
  closed
    ? `
test("with sign-up closed, an address nobody invited is refused", async () => {
  await expect(signUp("users-test-stranger@${domain}")).rejects.toThrow(/invited/);
  expect(db.select().from(user).where(eq(user.email, "users-test-stranger@${domain}")).get()).toBeUndefined();
});
`
    : `
test("with sign-up open, an address nobody invited gets the default role", async () => {
  const created = await signUp("users-test-stranger@${domain}");
  expect(created?.role).toBe(${JSON.stringify(auth.defaultRole)});
});
`
}
test("a role the ${usersPage(ir)} page does not give, and a key whatever its role, is refused every change to who has access", async () => {
  const rule = pageAccess[${JSON.stringify(usersPage(ir))}];
  const pending = await invite(admin, "users-test-target@${domain}", ${JSON.stringify(other ?? "admin")}, ORIGIN);
  const outsiders = [
    ...ROLES.filter((role) => role !== "admin" && !rule.roles.includes(role)).map((role) => ({
      id: \`users-test-\${role}\`,
      name: role,
      email: \`users-test-\${role}@${domain}\`,
      role,
    })),
    // An API key with the administrator's role is still no person.
    { id: "key:users-test", name: "A key", email: "", role: "admin" },
  ];
  for (const outsider of outsiders) {
    await expect(listUsers(outsider, ORIGIN)).rejects.toThrow(AccessDenied);
    await expect(invite(outsider, "users-test-sneak@${domain}", "admin", ORIGIN)).rejects.toThrow(AccessDenied);
    await expect(setRole(outsider, admin.id, ${JSON.stringify(other ?? "admin")})).rejects.toThrow(AccessDenied);
    await expect(removeUser(outsider, admin.id)).rejects.toThrow(AccessDenied);
    await expect(resendInvitation(outsider, pending.id, ORIGIN)).rejects.toThrow(AccessDenied);
    await expect(withdrawInvitation(outsider, pending.id)).rejects.toThrow(AccessDenied);
  }
  // Nothing changed: the administrator, the invitation, and no new one.
  expect(db.select({ role: user.role }).from(user).where(eq(user.id, admin.id)).get()?.role).toBe("admin");
  const open = (await listUsers(admin, ORIGIN)).invitations.map((i) => i.email);
  expect(open).toContain("users-test-target@${domain}");
  expect(open).not.toContain("users-test-sneak@${domain}");
  await withdrawInvitation(admin, pending.id);
});

test("only the page's roles manage users; an administrator cannot change or remove themselves", async () => {
  const outsider = await signUp("users-test-outsider@${domain}").catch(() => undefined);
  if (outsider && outsider.role !== "admin")
    await expect(listUsers(outsider, ORIGIN)).rejects.toThrow(AccessDenied);
  await expect(setRole(admin, admin.id, ${JSON.stringify(other ?? "admin")})).rejects.toThrow(/own role/);
  await expect(removeUser(admin, admin.id)).rejects.toThrow(/yourself/);
${
  other
    ? `
  const colleague = db
    .insert(user)
    .values({ id: "users-test-colleague", name: "Colleague", email: "users-test-colleague@${domain}", role: ${JSON.stringify(other)} })
    .returning()
    .get();
  await setRole(admin, colleague.id, "admin");
  expect(db.select({ role: user.role }).from(user).where(eq(user.id, colleague.id)).get()?.role).toBe("admin");
  await removeUser(admin, colleague.id);
  expect(db.select().from(user).where(eq(user.id, colleague.id)).get()).toBeUndefined();
  // What touches security keeps its values in the audit log: from what to what, and who.
  expect(audited("role changed").at(-1)).toMatchObject({ who: admin.id, role: "admin", details: { user: colleague.id, from: ${JSON.stringify(other)}, to: "admin" } });
  expect(audited("user removed").at(-1)).toMatchObject({ who: admin.id, details: { user: colleague.id, email: "users-test-colleague@${domain}" } });
  // Forget in the log: every line naming them goes blank, by id or by address (an invitation).
  db.insert(auditLog).values({ who: admin.id, action: "invited", details: { email: "users-test-colleague@${domain}", role: "admin" } }).run();
  forgetInLog(admin, { user: colleague.id });
  expect(JSON.stringify(db.select().from(auditLog).all())).not.toContain("users-test-colleague@");
`
    : ""
}
  const pending = await invite(admin, "users-test-pending@${domain}", "admin", ORIGIN);
  await withdrawInvitation(admin, pending.id);
  expect((await listUsers(admin, ORIGIN)).invitations.map((i) => i.id)).not.toContain(pending.id);${
    closed
      ? `
  // A withdrawn invitation lets nobody in.
  await expect(signUp("users-test-pending@${domain}")).rejects.toThrow(/invited/);`
      : ""
  }
});
`;
}

/** The README section on the users page and invitations; detached, it names no Smithable file. */
export function usersReadme(ir: SpecIR, auth: AuthIR, detached = false): string {
  const page = usersPage(ir);
  const closed = auth.signIn !== "none" && !auth.signIn.selfSignUp;
  const setting = detached
    ? "the sign-up hook in `src/lib/auth.ts`"
    : "`selfSignUp` under `signIn` in `smithable.auth.yml`";
  const admins = detached
    ? "`ADMINS` in `src/lib/auth.ts`"
    : "the `admins` of `smithable.auth.yml`";
  return `
## Users and invitations

The ${page} page lists who has access and lets administrators invite people by email address with a role, change roles, and remove users. An invitation mail carries a link to the sign-in page; the invited address then signs in with a configured provider and has the invited role. The link is also shown on the page, for sending by hand when the app has no mail settings (see Mail). Invitations are valid for 14 days and can be resent or withdrawn.
${
  closed
    ? `
Sign-up is closed (see ${setting}): only invited addresses and ${admins} can sign in. Everyone else is refused at sign-in and told to ask an administrator. A demo (\`DEMO_SIGN_IN=1\`) is the exception: its "Try it as" buttons sign in demo users, who join whatever the setting says; set it only on a showcase app whose data is reset.
`
    : `
Anyone with an account at the sign-in provider may sign up and gets the default role; an invitation gives its role instead. Close sign-up in ${setting} to let only invited people in.
`
}`;
}
