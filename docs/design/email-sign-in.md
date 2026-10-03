# Signing in to a published app: email codes, the owner as admin, and what a first publish carries

Status: 2026-10-03, proposed by Fable after the tester journey on the beta (smithable-cloud `docs/tester-journey-2026-10-03.md`). Three decisions are Johan's (section 6); merging this document is the go-ahead for the steps in section 5.

## 1. What the journey found

Three apps were built from a sentence and published. In each, "Get started" ends at "Signing in is not available right now", for everyone, the owner included; and the published app is empty. A published app is a shell: nobody can get in to fill it.

The causes:

- **Sign-in needs keys nobody has.** The spec knows two providers, `google` and `facebook`. Each needs an OAuth client registered for the app's address, which a non-developer cannot do and the hosted service does not do for them. `email` has been reserved since 0.1 and never built.
- **Nobody is the admin.** The service sets no admin. Whatever `admins:` the starter wrote ships as it is: `owner@acme.com`, `owner@stillwater.ax`, `ops@northwind.ax`. So the owner would not be an admin even if they could sign in, and whoever holds one of those mailboxes would be. With no working sign-in this is latent today; with one it is a hole. It must close in the same step.
- **A first publish starts with an empty database.** The preview's records stay in the workspace.

## 2. Email sign-in

```yaml
signIn:
  providers: [email]        # or [email, google]
```

- **What it is:** the person types their address and gets a six-digit code by mail, good for ten minutes and one use. No passwords, nothing to register anywhere. Signing in and signing up are the same form.
- **Who gets a code** follows what the auth file already says. With `selfSignUp: false`, only invited addresses and the admins; with `allowedDomains`, only those domains. Anyone else sees the same "If this address may sign in, a code is on its way" and no mail is sent, so the form tells nobody who has an account.
- **How it is sent:** through the app's own mail settings (`SMTP_URL`, the kit's `mail.ts`), like every other mail the app sends. Nothing depends on Smithable at run time (rule 4); a self-hosted app works the same with any SMTP account. In development and in a preview there is no SMTP: the code lands in the outbox, and the development sign-in stays as it is.
- **Limits:** five codes an hour per address and twenty per network address, five wrong tries per code, through the kit's existing limiter; the hosted relay's own limits and its bounce handling (smithable-cloud #51) sit behind that.
- **The mail's words** are content (`smithable.content.yml`, `signIn.mail`), with a default that names the app: "Your code for Stillwater Yoga is 482 913. It works for ten minutes. If you did not ask for it, ignore this mail."
- **Without mail settings in production** the sign-in page says so plainly, and the release checks warn before publishing: "Email sign-in needs mail settings (SMTP_URL)".
- **The default.** New apps use `providers: [email]`: the six starters, the blank app a first build starts from, and `addLandingPage`'s "Get started". `google` and `facebook` stay for those who bring keys; a page on docs.smithable.ai says how. A provider listed without keys is not offered on the sign-in page (today it shows as unavailable).

It is not a new construct: the value was reserved, and the five questions were answered when `signIn.providers` was designed. What is new is that it becomes the default.

## 3. The owner is the admin

- **`setAdmins <address…>`**, an operation on the auth file (rule 2: the file is the truth, and the summary says who the admins are). Refused when it would leave an app with sign-in and no admin.
- **`smithable new` sets it.** `--admin <address>` or, without it, the Git user's address; the starter's sample address never survives into a new project. The hosted service passes the owner's address when it creates the project, and again through `setAdmins` when a project changes hands.
- **Starters keep a sample address only on `.example`** (`owner@northwind.example`), which nobody can receive mail at.
- **The validator** warns when `admins` is empty with sign-in on ("nobody can manage users"), and errors at release when an address is on a starter's sample domain.

## 4. What a first publish carries

Today: an empty database, always. Proposed: the first publish of an environment asks once.

- **"Start empty"** (the default): the owner signs in, is the admin, and every list's empty state offers to add the first record.
- **"Take the records from my preview along (37 records in 4 lists)"**: for someone who edited the samples into their real classes or products. The service applies its existing seed mechanism once, before the first start. The development users are left behind; their records are given to the owner, who is created as a user with the admin role, so the first sign-in finds the account.

Sample data that was never edited is somebody else's fiction ("Morning Flow with Anna" on a real studio's site), which is why empty is the default and the choice says how many records there are.

## 5. Steps

1. **Core (Fable):** `email` as a provider with its validation (it needs no keys; `selfSignUp` and `allowedDomains` apply), `setAdmins`, the two validator rules, the summary's sentence ("People sign in with a code sent to their email"), the spec reference.
2. **Adapter and CLI (A):** the code flow with the auth library's email-code plugin, the sign-in page (address, then code), the limiter, the mail text from content, the outbox in development, `smithable new --admin`, the release check, the generated access and smoke tests signing in by code through the outbox, and all six starters on `[email]` with `.example` admins.
3. **Service (B):** the owner's address at project creation and on hand-over, the relay's allowance for sign-in codes, the first-publish question and the seed with the owner as the records' owner.
4. **Docs (C):** "Sign in with Google" as a how-to for those who bring keys; the getting-started page's sign-in paragraph.

Exit: on the beta, a stranger builds an app from a sentence, publishes it, signs in with a code as its admin and adds a record, with no step outside Smithable.

## 6. Decisions for Johan

1. **Email codes as the default sign-in for every new app.** Recommended: yes. The alternative, the service as sign-in provider for its apps, would tie every published app to Smithable and break leaving with everything.
2. **Apps may mail a sign-in code to any address that asks for one.** This is part of the open question in `2026-10-03-app-mail-recipients.md`. A code is transactional mail to the person who typed the address, within the relay's limits (100 a day per app) and its bounce and complaint handling. Recommended: yes for sign-in codes and invitations; other app mail stays as that file decides.
3. **The first-publish question, with empty as the default.** Recommended: yes, as step 3, after sign-in works.
