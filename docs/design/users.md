# Invitations and user management (design)

Status: 2026-09-29, implemented as written (the `users` pattern, `selfSignUp`, `addUsersPage` and `setSignUp`, the phrases, the generated `users.server.ts`, `Users.tsx`, the sign-up hook, the app's `users.test.ts` and the CRM example's team page). Decided over a calendar pattern as the next feature, because every app with sign-in needs a way to get colleagues in, and the current answer ("everyone with a Google account in your domain, or nobody") only fits internal tools. ARCHITECTURE §3.1 foresaw `selfSignUp: false` and said it needs user management; this is that.

## 1. What people get

- A **users page**: who has access, invited or active, with their role. An administrator invites someone by email address with a role, changes a role, withdraws an invitation, resends one or removes a user.
- **Invitations by mail**: the invited person gets a link to the app's sign-in page, signs in with a configured provider (Google) using the invited address, and has the invited role. The link can also be copied from the page and sent by hand, so apps without mail settings work too.
- **Closed sign-up**: with `selfSignUp: false`, only invited addresses and the `admins` list can sign in at all. Everyone else is refused at sign-in with a clear message. `allowedDomains` keeps working on top.

## 2. The DSL growth test (ARCHITECTURE §2.4)

1. Common: every multi-user app needs it (team tools, client portals, member sites).
2. Deterministic: entirely (a table, a mail, a sign-up rule, a page).
3. Reduces AI use and ambiguity: today this needs custom auth code written by a model, in the one place a mistake exposes everything.
4. Technology-neutral: "invite by email, with a role" says nothing about Better Auth or SMTP.
5. Better than free text plus custom code: sign-up rules belong in the generated access layer, not in per-app code.

## 3. The spec

`smithable.auth.yml`:

```yaml
signIn:
  providers: [google]
  selfSignUp: false          # only invited addresses (and admins) may sign in; default true
```

`smithable.yml`:

```yaml
pages:
  team:
    users: manage            # invite people, change roles, remove them
    # access: [admin]        # the default for a users page; widen it with more roles
```

- `users` is a page pattern like `crud`, `dashboard` or `settings`. Its value is what the page offers; `manage` is the only value for now. A read-only `directory` (names and roles for everyone signed in) is a likely second value and is left out until asked for.
- A users page is **admin-only by default**. `access:` may widen it, as for any page. Because it is a page like any other, it shows in the main menu (icon `users`), takes a title and subtitle in `smithable.content.yml`, and its texts are editable in the preview.
- Validation: a users page needs sign-in (error with `signIn: none`); `selfSignUp: false` without a users page is an error ("nobody could be invited"). With `selfSignUp: false` the `open-shared-access` warning no longer applies, since only invited people can sign in.
- Operations: `addUsersPage page [route]` registered by the pattern (like `addLandingPage`), and `setSelfSignUp true|false` on the auth companion. Tier 0 learns "add a users page", "add a page to invite people", "only invited people may sign in" and "anyone may sign up".

## 4. How it works

**Invitation records.** With sign-in and a users page (or `selfSignUp: false`), `src/db/schema.ts` gets an `invitation` table next to Better Auth's: `id`, `email` (unique, lowercase), `role`, `token` (unique), `invitedById` (→ user, set null), `createdAt`, `expiresAt` (14 days). drizzle-kit produces the migration as for any new table, so an existing app that adds a users page gets one migration and nothing else changes. An accepted invitation is deleted; the user row is the record from then on.

**Sign-up rule.** The generated `src/lib/auth.ts` already has the one place where a new user is created (Better Auth's `user.create.before` hook), which checks `allowedDomains` and sets the role. It gains: look up an invitation for the address; with one, the new user gets the invited role; without one, `selfSignUp: false` refuses ("Ask an administrator of <app> for an invitation") unless the address is in `admins`. The `after` hook deletes the accepted invitation. Acceptance is by **verified email address**, never by token possession: the token in the link only lets the sign-in page say "You were invited to Acme CRM as sales; sign in with Google as name@acme.com". A leaked link exposes nothing; an expired one is refused with a clear message.

**Server functions** in `src/generated/users.server.ts`, each checking the page's rule (`pageAccess`, admins always pass):
- `listUsers`: users (name, email, role, created) and open invitations (email, role, expires, link), one list with a status.
- `invite(email, role)`: refuses an address that already has a user, replaces an open invitation for the same address (resend), writes the row and sends the mail with `sendMail` from the kit. Without mail settings the mail lands in the dev outbox and the page shows the link to copy; the page always shows it.
- `setRole(userId, role)`: not on yourself, and the last admin stays an admin.
- `removeUser(userId)`: not yourself, not the last admin. Sessions and accounts go with the user (Better Auth's cascade); records they owned keep existing with no owner; a required `User` field that still refers to them refuses the removal ("still referred to by 3 orders; reassign them first"), like any record in use.
- `withdraw(invitationId)`.

**The page.** `src/kit/Users.tsx` (copied only into apps with a users page): the table with a status column ("Active" or "Invited, expires 12 Oct"), an invite form (email, role from the app's roles, with descriptions), a role menu per row and Remove / Withdraw / Resend / Copy link. The route file is generated per page like a dashboard's, and reads its texts (title, subtitle, and the invite form's texts by part name) from `smithable.content.yml`.

**Mail.** One template, in the kit's plain style: "<Inviter> invited you to <app> as <role>. Sign in here: <link>. The invitation is valid until <date>." Subject "Invitation to <app>". No branding beyond the app's name until the presentation vocabulary exists. The sign-in page reads `?invite=<token>` and shows whom the invitation is for.

**Development.** The dev sign-in ("sign in as admin") is unaffected: dev users are created through the same hook, so with `selfSignUp: false` the generator lists their addresses as allowed in development builds only. The generated smoke test opens the users page as admin, checks a non-admin is refused, and, through the outbox, that an invitation mail is written and that signing in with an invited address gets the invited role; with `selfSignUp: false`, that an uninvited address is refused.

## 5. Where it touches the code

| Layer | Change |
|---|---|
| core `patterns.ts` | The `users` pattern object: schema, example, parse, `models: []`, icon `users`, `inMenu`, `operations: [addUsersPage]`, default access `[admin]` (a new optional `access` on the pattern, read by `pageAccess`) |
| core `auth.ts` | `selfSignUp` parsed into `SignInIR`; checks against the spec (needs a users page; users page needs sign-in); the `open-shared-access` warning skips closed sign-up |
| core `ir.ts` | `{ kind: "users"; mode: "manage" }` in the pattern union |
| core companion operations | `setSelfSignUp` |
| index `phrases.ts` | the four phrases in §3 |
| adapter `pages/users.ts`, `auth.ts`, `schema.ts` | route generator and kit registration; the sign-up hook and the sign-in page's invitation banner; the `invitation` table |
| adapter `users.server.ts` generator, `templates/src/kit/Users.tsx` | server functions and the component |
| adapter `smoke.ts`, README | the tests above; a "Users and invitations" section |
| spec `docs/spec/v0.1.md`, ARCHITECTURE §3.1, schema JSON | the grammar, the "not in v0.1" line goes, regenerated schema |
| Studio | the pattern picker's kind list comes from `PATTERN_KINDS`; the Builder's addUsersPage form is schema-built like the others |

Apps without a users page and with `selfSignUp` unset generate byte-identically (the snapshot tests prove it), so nothing needs a migration in existing apps.

## 6. Out of scope

Directories for non-admins, groups and teams (ARCHITECTURE §3.1 leaves room), extra user fields, magic-link or email sign-in for invited people without a Google account (a later provider), per-app mail branding, and a hosted mail service for published apps (a `smithable-cloud` concern: per-app SMTP settings and a quota, noted in the improvement plan).
