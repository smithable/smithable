# Signing in to a published app: email codes, the owner as admin, and what a first publish carries

Status: 2026-10-03, proposed by Fable after the tester journey on the beta (smithable-cloud `docs/tester-journey-2026-10-03.md`). Johan decided on 2026-10-03 (section 6): email codes as the default, apps may mail sign-in codes and invitations to any address, and no copying of preview records: a published app starts empty and the preview says so. Merging this document is the go-ahead for the steps in section 5.

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

## 3. The owner is the first admin

Two different things, kept apart. The **owner** owns the project at Smithable: edits it in Studio, publishes it, exports it, deletes it. That lives in the service (or, self-hosted, in whoever holds the repository and the server) and never depends on a row in the app's database. An **admin** is a user inside the app who may manage its users and all its records. The app needs one admin to start with, because someone has to be able to sign in and invite the others, and the owner is the only person we know: so the owner's address is the first admin. It is a start, not a tie: the owner can name other admins and take themself off the list, and stays the owner.

- **`setAdmins <address…>`**, an operation on the auth file (rule 2: the file is the truth, and the summary says who the admins are). Refused when it would leave an app with sign-in and no admin.
- **`smithable new` sets it.** `--admin <address>` or, without it, the Git user's address; the starter's sample address never survives into a new project. The hosted service passes the owner's address when it creates the project, and again through `setAdmins` when a project changes hands.
- **Starters keep a sample address only on `.example`** (`owner@northwind.example`), which nobody can receive mail at.
- **Demo sign-in** (`DEMO_SIGN_IN=1`, the showcase sites) is a separate path: it turns on the address-and-password endpoint its buttons use, so there a visitor could also sign up as a sample admin. That gives nothing the "Try it as admin" button does not give by design, and the hourly reset removes it; the variable is only ever set on showcase apps, and their seeds are rebuilt once the starters' admins move to `.example`.
- **The validator** warns when `admins` is empty with sign-in on ("nobody can manage users"), and errors at release when an address is on a starter's sample domain.

## 4. A published app starts empty, and the preview says so

Johan's decision: nothing is copied from the preview. The records in a new app are fiction for trying things out, and that is said where the person meets them, not asked about at publishing.

- **In Studio and on the hosted first-build page:** a notice by the preview, shown when the app is made and until dismissed: "The records you see are samples for trying the app. Your published app starts empty: what you add or change here is not published." The publish step repeats the last sentence.
- **In the published app:** the owner signs in with a code, is the admin, and every empty list offers to add its first record. Real records in bulk come in through the import (`importRecords`, a spreadsheet).
- **Later:** a guide in Studio, an overlay that walks through its places (the preview, the summary, the change box, the Look tab, publishing) and says what each means. It gets its own design; this notice is the first piece of it.

## 5. Steps

1. **Core (Fable):** `email` as a provider with its validation (it needs no keys; `selfSignUp` and `allowedDomains` apply), `setAdmins`, the two validator rules, the summary's sentence ("People sign in with a code sent to their email"), the spec reference.
2. **Adapter and CLI (A):** the code flow with the auth library's email-code plugin, the sign-in page (address, then code), the limiter, the mail text from content, the outbox in development, `smithable new --admin`, the release check, the generated access and smoke tests signing in by code through the outbox, all six starters on `[email]` with `.example` admins, and Studio's notice by the preview that the records are samples and are not published.
3. **Service (B):** the owner's address at project creation and on hand-over, the relay's allowance for sign-in codes, and the sample-data notice on the first-build page and at publishing.
4. **Docs (C):** "Sign in with Google" as a how-to for those who bring keys; the getting-started page's sign-in paragraph.

Exit: on the beta, a stranger builds an app from a sentence, is told its records are samples, publishes it, signs in with a code as its admin and adds a record, with no step outside Smithable.

## 6. Decided (Johan, 2026-10-03)

1. **Email codes are the default sign-in for every new app.** Google and Facebook stay for those who bring their own keys; Smithable's own are never used for a published app.
2. **Apps may mail a sign-in code or an invitation to any address,** within the relay's limits and its bounce and complaint handling. Other app mail stays as `2026-10-03-app-mail-recipients.md` decides.
3. **No first-publish question.** A published app starts empty; the preview says its records are samples and that edits there are not published (section 4). A guide overlay in Studio comes later.
