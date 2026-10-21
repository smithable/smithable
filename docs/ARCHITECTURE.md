# Smithable — Architecture

This document records architectural decisions. When a decision changes, update it here. [VISION.md](VISION.md) explains *why*; [ROADMAP.md](ROADMAP.md) explains *when*.

## 1. Layers

```text
 smithable.yml            WHAT the app does and WHY (structured DSL + scoped free text)
 smithable.auth.yml       WHO the users are: sign-in methods, roles
 smithable.ux.yml         HOW it looks and feels: layout, density, ordering, theme
 smithable.content.yml    WHAT visitors read: labels, page texts, landing copy
 smithable.context.yml    HOW to implement it (stack, conventions, implementation guidance)
        │
        ▼  parse + validate
 Semantic model
        │
        ▼  normalize (defaults, references resolved)
 Smithable IR             technology-independent
        │
        ▼  adapter (v1: TanStack)
 Application code         ordinary web app + backend, no dependency on Smithable
        │
 .smithable/              Smithable's records: file hashes, operation log (committed); caches (disposable)
```

Every change, whether it comes from the CLI, Studio, AI or a plugin, goes through one **semantic operation layer** that mutates the manifest files (`smithable.yml` and its companions). Code is then regenerated from them. Nothing writes application code directly except (a) the compiler, into files it owns, and (b) humans or AI, into custom files (see §6).

**The engine runs anywhere.** The parser, validator, IR, operations, generator and index work on an in-memory set of files and never touch the disk, network or processes directly. Hosts supply that I/O: the CLI and daemon in Node (disk, Git, processes), and the browser in the hosted product (the project's files in the tab, synced with its Git repository and the preview VM). The same engine therefore powers the CLI, the local Studio and the hosted Builder. Engine packages must not import Node built-ins, and lint enforces this.

## 2. The manifest: `smithable.yml`

### 2.1 Content

The manifest describes application functionality in technology-neutral terms. It never contains React, Drizzle, Tailwind, file paths, CSS or visible copy.

v0.1 covers: `app`, `models` (fields, relations, formulas), `actions`, `outgoing` (who is told when something happens to a record: mail, later a signed call; [design/integrations.md §4](design/integrations.md)), `incoming` (an address another service calls, one record per call, or a mail that becomes a record; with `reply`, a mail of one of its records' threads becomes a record under it, found by its headers in the kit's `mail_threads` table or by the `[app #id]` tag in its subject, and every mail the app sends about such a record carries the tag and the thread's headers; [design/integrations.md §3](design/integrations.md), [design/mail-threads.md](design/mail-threads.md)), `queries`, `pages`, `navigation`, `jobs`. External endpoints come later. Roles, what each may do, and everything public are defined in `smithable.auth.yml`; `smithable.yml` names no role. Presentation lives in `smithable.ux.yml` and visible text in `smithable.content.yml` (§3).

### 2.2 Style: neat by default, explicit when needed

Each construct has a **short form** for the common case and a **long form** when more detail is needed. Operations write the shortest form that preserves meaning. The example below shows where the format is heading. The exact grammar of the current version is in [spec/v0.1.md](spec/v0.1.md):

```yaml
smithable: 0.1

app:
  name: CRM
  description: Lightweight CRM for a small B2B sales team.
  currency: EUR

models:
  Customer:
    description: A company we have a commercial relationship with.
    fields:
      name: string!                        # "!" = required
      email: email unique
      phone: phone
      segment: smb | enterprise | government   # one of; the first value is the default
      creditLimit:                         # long form
        type: money
        min: 0
        description: Maximum outstanding balance before orders are held.
      orders: Order[]                      # has many (inverse of Order.customer)

  Order:
    fields:
      number: string! unique
      customer: Customer!                  # belongs to
      shippingMethod: standard | express
      total: money!
      shippingCost:
        type: money
        formula: IF(AND(shippingMethod = "standard", total > 100), 0, IF(shippingMethod = "express", 15, 5))
        examples:
          - input: { total: 150, shippingMethod: standard }
            expected: 0
          - input: { total: 150, shippingMethod: express }
            expected: 15
      placedAt: datetime

actions:
  mergeCustomers:
    custom: true                           # implemented in a user-owned file
    input: { keep: Customer, duplicate: Customer }
    allow: [admin]
    intent: Merge a duplicate customer record into the one we keep.
    rules:
      - All orders of the duplicate move to the kept customer.
      - Empty fields on the kept customer are filled from the duplicate.
      - The duplicate is deleted afterwards.

pages:
  customers:
    intent: Find a customer quickly and keep their details current.
    crud: Customer                         # standard list + detail + form
    search: [name, email]
  dashboard:
    intent: Give salespeople a rapid overview of customers requiring attention today.
    custom: true

navigation: [dashboard, customers]

jobs:
  sendOverdueReminders:
    schedule: daily
    custom: true
    intent: Email customers whose invoices are more than 14 days overdue.
```

### 2.3 Semantic free text

Free text is an escape hatch, not a notes dump. There is a fixed vocabulary, and it can be attached to any concept:

| Field | Meaning |
|---|---|
| `description` | What the concept *is* |
| `intent` | The outcome or experience it should achieve |
| `rules` | Domain constraints not (yet) expressible in the DSL |
| `examples` | Machine-readable input/expected pairs. They are used as tests, AI context and documentation |

Rules:

- **Scope it.** Attach text to the model, field, action or page that owns it, never to a global blob. This keeps AI context small.
- **Text is not implementation state.** An `intent` does not imply that code exists; the index tracks that.
- **Examples are executable.** Wherever an example has `input`/`expected`, the compiler generates a test.

#### Rule status

A rule does nothing by itself: writing "a session never has more bookings than its capacity" does not make it true. Because non-developers would reasonably assume it does, Smithable tracks and shows the status of every rule:

| Status | Meaning |
|---|---|
| **Enforced** | A structured feature or generated code guarantees it. Typically the rule was promoted into the DSL and removed as text |
| **Implemented and tested** | Custom code implements it, and a passing test covers it |
| **Implemented, untested** | Custom code claims to implement it, but no test covers it |
| **Not implemented** | Nothing implements it yet |
| **Changed** | The rule text was edited after it was implemented. The implementation needs review |

How the status is computed deterministically, without AI:

- A rule starts as a plain string. When something implements it, the operation gives it a stable ID, converting it to the long form: `- { id: capacity, rule: A session never has more confirmed bookings than its capacity. }`. The full ID is qualified by its owner, for example `Booking.capacity`.
- Custom code marks what it implements with a comment (`// implements rule Booking.capacity`), and tests name the rule they cover (`test("rule Booking.capacity: rejects booking a full session", …)`).
- The index (§7) links rule IDs to implementing code and covering tests, and stores a hash of the rule text at implementation time. That hash is what detects **Changed**.
- Passing or failing is taken from the last test run.

In the Builder, unimplemented rules show as "2 rules aren't enforced yet — implement them?". One click hands them to AI, which writes scoped custom code plus tests (§9.1). In Studio, `smithable inspect` and the concept tree show the same status.

### 2.4 Growing the DSL

Add a structured construct only if all of the following are true:

1. it is common across many applications,
2. it can be implemented deterministically,
3. formalizing it reduces AI use or ambiguity,
4. it stays technology-neutral,
5. it is materially better than scoped free text plus custom code.

Otherwise leave it as free text plus custom code. Review recurring `rules` periodically; the ones that keep appearing are candidates for promotion into the DSL.

### 2.5 Mechanics

- A JSON Schema for the manifest is published (at its `$id`, https://docs.smithable.ai/schema/smithable-0.1.json, with the spec reference on docs.smithable.ai, built by `pnpm site`) and used for validation, editor autocomplete and operation validation. Its keys carry `title` (a plain label where the name is technical), `examples` (a form's placeholder) and three keywords of Smithable's own, `x-hidden`, `x-semantic` and `x-docs`, for the forms Studio builds from the schema (studio-v3.md §5); validators ignore them (Ajv in strict mode wants them declared with `addVocabulary`).
- Validation errors carry file, line and column positions.
- Hand edits are first-class: users may edit `smithable.yml` directly, and Smithable validates and recompiles on save. A hand edit whose sole difference is one renamed key under `models`, `pages` or a model's `fields` is applied as `renameModel`, `renamePage` or `renameField` (core's `editAsRename`, 2026-10-17), so the records and the references are kept instead of the table or column being dropped and made anew.
- Programmatic writes preserve comments, ordering and formatting (CST-level YAML editing). Studio shows the files formatted (`formatSpec`: objects as block mappings, never `{ }`; everything else as written) and a save that changes only formatting is no change (studio-v3.md §7).
- Splitting the manifest across several files for large apps is an open question (§15).
- **Why YAML, not a TypeScript config?** The spec must be edited by deterministic operations, read by non-developers and small models, and stay technology-neutral.
- **The in-string grammar stays small and familiar.** It covers:
  - field shorthand: `string!`, `email unique`, `draft | sent | paid`, `Customer!`, `Order[]`,
  - field-path templates: `"{classType.name}"`,
  - **spreadsheet-style formulas** for computed fields and defaults: arithmetic and comparisons, `IF`, `AND`, `OR`, `NOT`, `ROUND`, `MIN`, `MAX`, date and text functions (`TODAY`, `DATEADD`, `CONCAT`, …), and `SUM`/`COUNT`/`SUMIF`/`COUNTIF`/`AVG`/`MIN`/`MAX` over related records.

  Formulas use a fixed function library modelled on spreadsheets, so non-developers and LLMs already know it. There are no user-defined functions, loops or free queries: anything beyond what a spreadsheet cell can do is custom code. The grammar is precisely specified, validated with helpful errors, and always has a long form. Formulas containing commas are written in block style (long form), because commas split values inside `{ … }`.
- **A rule simple enough to be a formula should become one.** It is then enforced, costs no tokens, and its `examples` become tests.
- **Formulas compile to TypeScript** (the TanStack adapter's `<model>.formulas.ts`), working on records as stored (money in cents) with spreadsheet rounding. Server functions add computed values to the records they return, forms recompute them live, and examples become Vitest tests of the same functions. Compiling formulas to SQL as well arrives with filtering and sorting in queries, where the database needs them.
- **Choice fields default to their first value.** `status: draft | sent | paid` defaults to `draft`. Exceptions use the long form: `{ type: beginner | allLevels | advanced, default: allLevels }`, or `default: none` to stay empty until chosen. Operations that reorder values warn when this changes the default, and the plain-language view always states the default explicitly.

## 3. Companion files

`smithable.yml` stays focused on functionality. Four companion files hold concerns that would otherwise clutter it. All of them are validated by JSON Schema, modified through operations, and edited with comment-preserving writes. Only `smithable.context.yml` may mention technology.

### 3.1 `smithable.auth.yml`: users, roles and exposure

This file describes who can sign in, which roles exist, the default access model, and **everything that is exposed publicly**. It always exists: `smithable new` creates it, with `signIn: none` for apps without login. It is technology-neutral.

```yaml
smithableAuth: 0.1
signIn:
  providers: [google, facebook]    # default: [google]; order = button order; "none" = no sign-in
  allowedDomains: [acme.com]       # optional: only this Google Workspace domain
  selfSignUp: true                 # false = only invited email addresses
defaultAccess: private             # shared | private; required when sign-in is enabled
roles:
  admin: all                       # the whole app; always
  member: { description: A regular user., pages: all, create: all }   # beyond the record rule (below)
defaultRole: member
admins: [owner@acme.com]           # bootstrap: these get admin on first sign-in
user:
  fields:                          # extra profile fields, same syntax as models
    displayName: string!

# ⚠ PUBLIC: everything listed here is visible to anyone on the internet, without
# signing in. Never add models that contain personal or business data.
public:
  pages: [home]                    # sign-in pages are always public
  read:
    - Product
    - Post: { where: { status: published } }   # only these records; drafts stay with their roles and owner
  create: [ContactMessage]         # for example a public contact form
```

#### Access defaults

Every model gets an automatic **owner** field, set to the user who created the record. Like a file owner in Linux, the owner is what "own records" refers to. `ownedBy: accountManager` makes another `User` field the owner instead.

`defaultAccess` is an explicit choice, made by the user in `smithable new` or proposed by the Builder's AI from what is being built:

| | `shared` (internal tools, teams) | `private` (SaaS, consumer apps) |
|---|---|---|
| Read | All signed-in users | Only the owner |
| Create | Signed-in users | Signed-in users |
| Edit and delete | The owner | The owner |
| Everything | Admins | Admins |

- **Who may do what is said in this file, in full** ([design/access-in-auth.md](design/access-in-auth.md), 2026-10-09). `defaultAccess` is the record rule for everyone who signs in: with `shared` everyone reads every record, with `private` their own; everyone changes and deletes their own. Nothing else is implied: a role's block, shaped like `public`, lists the pages it opens, the models it adds to (`create`), reads for everyone (`read`, with `private`), changes or deletes for everyone (`write`, `delete`), and the custom actions it runs (`actions`); each is a list or `all`. `admin: all` is written out, and administrators are always `all`. `smithable.yml` names no role: `access` on a model or a page and `allow` on an action are errors that say where it went. The operation `grant <role> <what> <names…|all|none>` sets a grant.
- **Pages** require sign-in by default. Public pages are listed in the `public` section; a role opens the pages its `pages` grant names, and `all` is every page but the administrators' (the users page, a data page), which a role gets by naming them.
- **A reference shows its title, nothing else.** A viewer who may read a record also sees the display title of each record it refers to (an order shows its customer's name), even without read access to that record; no other field of it. A search through a relation matches that title only, among the related records the viewer may read. A stricter per-model rule can come when someone needs it.
- **Standard actions** follow the model's write access: whoever may change the record may run them; a role whose `actions` grant names one runs it too, without `write` on the model (a customer cancels their own booking), as a role opens the pages its `pages` grant names. Custom actions are run by the roles whose `actions` grant names them. `actions: all` is every action.
- **Review** is a grant too: a model's `review` (in smithable.yml) holds its uploads until they are approved, and the roles whose `review` grant names the model, with the admins, approve or reject them on the review page ([design/file-review.md](design/file-review.md)).
- **Without sign-in** (`signIn: none`), only what the `public` section lists is reachable at all.
- **What programs may reach is said here too.** The `api` block, beside `public`, lists the models and standard actions offered to other programs with a key (a list, or `all` with `except`), so everything an app exposes is read in one file. Listing is not granting: a key is made in the running app with a role, and goes through the same access rules as a person with that role. Built in steps ([design/integrations.md](design/integrations.md)): the block, its checks and `setApi` are in core; the routes, the keys and the tools for assistants follow. What an assistant gets of it is described by core too ([design/assistant.md](design/assistant.md) §3, `assistantOffer`): a few tools that are the same for every app (find, measure, read, add, change, run, describe), a summary of the app with one line per kind of record, and what each field can be matched by, all worked out for one caller (a role, or a visitor without a key) so that nothing the caller may not reach is even named. The adapter generates what runs them; a test holds the size of every starter's tools and summary under a budget. Who gets the assistant inside the app is said in the same file: the `assistant` block (`for`: roles, `signed-in` or `anyone`; `may`: `read` or `change`), set by `setAssistant`; visitors are answered by the app's wording rules only, never by a model.
- **A public condition** (`Post: { where: { status: published } }`) is applied where the read scope is decided, in the generated data functions' `readable(viewer)`, so every list, search, reference title, landing card and picture follows it without knowing about it; an owner reads their own records or the public ones, a role that may read the model reads everything. The generated access test proves each condition: a visitor reads a fitting record and not another. The auth companion follows a rename of the field and refuses its removal or the loss of the value.
- **Notes are advice** ([design/advice.md](design/advice.md), 2026-10-14): a third severity for what a valid spec would gain (a model others refer to with no list back, a list with a choice and no filters, a trash on one side of a required reference), each note carrying the operation that does it, so Studio applies it with one click and `smithable validate` prints the command. A note never fails anything and is printed by `validate` alone.
- **Warnings, not hidden behaviour.** The validator warns about risky combinations but never changes the meaning. Examples: `shared` together with `selfSignUp: true` ("anyone who creates an account can read all data"), and public read access to a model with personal-data fields such as `email` or `phone`.
- The Builder's plain-language view shows the **effective** access of every model and page, so nobody has to combine the two files in their head.

#### Enforcement

All access checks go through **one generated access layer** in the app kit. Every generated query and write is filtered by it, including row-level filtering by owner. Custom code receives the same access-checked data functions by default, and bypassing them requires an explicit, reviewable call. Generated tests prove the effective access for every model and role.

Concretely: `src/kit/access.ts` holds the rule type and the checks (`allows`, `readScope`, `guardPage`). Each model gets a server-only `src/generated/<model>.server.ts` with its effective rules (computed by `modelAccess` in core, so validation, generation and tests share one definition) and data functions that take the signed-in user: `list` and `get` filter by owner where needed, `create`, `update` and `remove` check the rule and the record's owner, and references to records the user cannot read are refused. The server functions the pages call are thin wrappers that pass `currentViewer()`. Pages check their rule in `beforeLoad`; menus and buttons hide what the user may not do, but the server is what enforces it. With `private` access, `unique` becomes unique per owner. `src/generated/access.test.ts` exercises every model for every role and for visitors: reading, creating, changing and deleting their own and others' records.

A model's **capacity** (`capacity: { per, max, where? }`, [design/booking.md](design/booking.md)) is enforced in the same place: the generated data function counts and writes in one transaction, so two people cannot both take the last place, and the referenced record's data function refuses lowering its number below what is taken. The generated access test fills a capacity and sees the next record refused.

Teams are not in v0.1, but the design leaves room for them. Records will later get a **group** (team or workspace) next to their owner, and existing apps migrate by putting each user's records into a personal default group. Because access is enforced in one layer, adding groups changes one place.

#### Sign-in

- **A code by email is the default sign-in method** (docs/design/email-sign-in.md, decided 2026-10-03): the person types their address and gets a six-digit code, good for ten minutes and five tries; signing in and signing up are the same form, and who may sign up follows the auth file (anyone else is told the same and gets no mail). It needs no keys, only the app's own mail settings, so a published app can be signed in to without registering anything anywhere. Google and Facebook stay as options in the same `providers` list for those who bring their own keys. Passwords are never offered.
- **It is implemented with a mainstream auth library as an ordinary dependency: Better Auth** (self-hosted, with a Drizzle adapter, SQLite support, social providers and an official TanStack Start integration). Sign-in is the one place where a well-maintained library beats generated code. The generated `src/lib/auth.ts` is its ordinary configuration: Better Auth's email-code plugin (codes stored hashed, mailed through the kit's `sendMail`, limited per address and per network address by the kit's limiter), providers whose keys are in the environment, the Drizzle tables (generated into `src/db/schema.ts` as Better Auth's CLI would), a `role` field, and a sign-up hook for `allowedDomains`, invitations and the `admins` bootstrap. The generated app never calls the provider after sign-in, so the provider's tokens are not stored (a database hook nulls them on every write): nothing in the database, its backups or an export holds a credential except the hashed dev-only password, and session cookies are signed with the app's secret.
- **OAuth client IDs and secrets live in environment variables**, never in YAML. Smithable provides a setup checklist per provider, including the exact redirect URLs.
- **Dev sign-in.** In development and in the Studio preview, a dev-only sign-in lets you act as any role without contacting Google. This keeps offline development and role testing possible. It uses Better Auth's email sign-in for one development user per role, and email sign-in is enabled only when `import.meta.env.DEV` is true, so production builds refuse it; `pnpm test:apps` verifies that against the production build.
- **Invitations and user management** ([design/users.md](design/users.md)): a `users` page pattern (`users: manage`, admin-only by default) lists users and open invitations; its generated `users.server.ts` invites an address with a role (a row in an `invitation` table next to Better Auth's, and a mail through the kit's `mail.ts` with a link to the sign-in page), changes roles, resends, withdraws and removes, refusing changes to your own account and to the last administrator. Acceptance is by verified email address in the same sign-up hook, never by possession of the link: the token only tells the sign-in page whom it is for. `selfSignUp: false` makes that hook refuse everyone but invited addresses, the `admins` and, in development builds, the development users; it requires a users page, so somebody can invite. Apps without a users page generate exactly as before.
- **The data page** ([design/data-page.md](design/data-page.md)): a `data` page pattern (`data: all` or a list of models, admin-only by default) is an administrator's view of the app's records. Each model's routes inside it are the crud page's generators, called with the data page's id (so its access rule guards them) and a `Within` that keeps links inside the page and caps the list at the newest 500; every read and write goes through the models' data functions, so widening the page's access never widens what a role may do with records. Apps without a data page generate exactly as before.
- **Not in v0.1:** extra `user` fields, reported as "not available yet".
- **Build your own.** `signIn: custom` generates a typed session contract plus a stub in `src/custom/auth.ts`. This is never the default.

### 3.2 `smithable.ux.yml`: presentation

This file describes how the app looks and feels, without changing what it does. It is technology-neutral: it contains no CSS or Tailwind classes. It refers to concepts by their manifest IDs.

```yaml
smithableUx: 0.1
theme:
  preset: modern                         # modern | minimal | playful | corporate
  brand: { primary: "#2563eb", font: Inter }
  density: compact
tones:
  Order.status: { shipped: success, cancelled: danger }   # choice values by meaning
pages:
  customers:
    table:
      columns: [name, segment, email]      # order + visibility
    form:
      fieldOrder: [name, email, phone, segment, creditLimit]
      groups:
        - { label: Billing, fields: [creditLimit] }
```

- Visual edits in Builder or Studio (pick a theme, reorder columns, hide a field, change density) write to this file through operations. Themes and page patterns are described in §10.4.
- As built (M10): theme presets, brand colour, density (the preset's own unless the file sets one; corporate is compact), motion (none, subtle or lively, likewise; playful is lively; CSS variables the kit's dialogs, drawer, notices, rows and view transitions use, and for lively only a landing page's scroll-driven section rise and hero settle; all off under "reduce motion"), per-page columns, field order, tones and icons, all generated into `src/theme.css` and the kit from the delivered design system, and checked for contrast by `pnpm test:apps`. Details: [as-built.md](as-built.md#m10-presentation).
- **More choices, never positions** ([design/look.md](design/look.md) §1, built 2026-10-01): how a field is entered (`control`), a form's sections and columns, a list's order and view. Each is a choice the kit renders (`FieldInput`'s controls, `ModelForm`'s groups, `ModelTable`'s cards, `sortRows`), checked against the field it names, followed on renames and set by an operation; the page's route passes them to the kit as props, so the model's description stays the model's.
- **Themes are files** ([design/look.md](design/look.md) §3, built 2026-09-30): a theme is a font, a radius, a shadow and 28 colour tokens per mode; the thirteen presets are themes in core (`BUILT_IN_THEMES`: the four from the design delivery, and since 2026-10-04 nine theme files in `theme-library.ts`, rule-made candidates Johan picked, read by the same parser and checks as a project's) and a project's own are `themes/<name>.yml`, parsed and checked by core (`parseTheme`: at least three colours per mode, the rest derived as a brand colour is, every pair the kit puts together checked for contrast) and read by the host, which passes them to validation, operations and generation. The ux file's `preset` names any of them; `themeCss` writes the resolved theme, so the app never knows where a theme came from. Every theme gets a picture drawn from its tokens (`themeThumbnail`) for Studio's Look tab and `smithable themes`. A theme is added through the operation layer like any change: `addTheme` parses it and hands it to `Editors.themes`, the result's `added` files are written and committed by the host with the five, so `undo` takes the file back. A theme never carries CSS or code.
- Anything beyond its vocabulary is handled by a custom component in `src/custom/`.
- The same growth rule applies as for the DSL (§2.4): add structure only when it is common and deterministic.

### 3.3 `smithable.content.yml`: visible text

`smithable.yml` holds structure; this file holds **every text a visitor sees**. That covers labels, help texts, choice-value names, page and section titles, landing page copy, button labels, confirmations, empty states and email texts. The same rule applies to every page, landing page or not.

```yaml
smithableContent: 0.1
models:
  Customer:
    fields:
      accountManager: { label: Responsible salesperson, help: Gets notified about new orders. }
  ClassType:
    fields:
      level: { values: { allLevels: All levels } }
actions:
  cancelBooking: { label: Cancel booking, confirm: Cancel this booking? }
pages:
  home:
    hero: { title: Find your calm, subtitle: Small classes for every level., button: See the schedule }
```

- **Derived by default.** Labels come from names (`accountManager` becomes "Account manager"), titles from page names, and button labels from action names. The file only contains what differs, so for many apps it stays short.
- **Keyed by concept.** Entries follow the same IDs as the spec, so renaming a concept through an operation also moves its text. Landing page sections have names in the spec (`hero`, `classes`, `faq`), which their texts are keyed by.
- **Semantic free text stays in the spec.** `description`, `intent` and `rules` describe meaning for AI and developers; they are not displayed.
- **Why a separate file:**
  - Copy is irrelevant to almost every AI request, so keeping it out of `smithable.yml` keeps AI context small.
  - Visual text editing in the Builder has one natural target.
  - Translations later become `smithable.content.<locale>.yml` without touching the spec.

### 3.4 `smithable.context.yml`: implementation context

This file describes HOW to implement the app: technology, conventions and guidance.

```yaml
smithableContext: 0.1
adapter: tanstack
database: sqlite
conventions:
  - Prefer existing components before creating new ones.
guidance: >
  Tables should be compact; this is a back-office tool used all day.
plugins: ["@acme/smithable-newsletter", ./smithable/plugins/loyalty]
ai:
  policy: eu-only          # local-only | eu-only | best-available (the default) | custom
```

It is checked against a JSON Schema like the other companions. It has structured fields where possible and one free-text `guidance` field for implementation preferences. It never contains functional requirements. As built (M15), `packages` names libraries for custom code at exact versions (`packages: { chart.js: 4.4.1 }`, or the `setPackage` operation, so hosted projects and the AI coder can add one without a terminal); the generator adds them to `package.json`, and the stack profile's own packages are refused.

## 4. Semantic operations

The **only** way to change application semantics programmatically.

- Each operation (`addModel`, `addField`, `changeField`, `renameField`, `renameModel`, `renamePage`, `removeField`, `addRelation`, `addPage`, `grant`, `addAction`, `addExample`, …) has a JSON Schema for its arguments. A list of operations is applied as one change (`applyOperations` in core; the daemon's `/api/op` with `name: "batch"` and `args.operations`, for the wizard's edited proposal, studio-v3.md §4): each checked in turn, the first refusal failing the whole, one checkpoint. The same schema is used for CLI parsing, Studio forms and constrained AI output.
- An operation is a pure function `manifest → manifest` plus validation. Side effects (regeneration, migration) follow from the changed manifest, not from the operation itself.
- Applied operations are appended to an **operation log** (`.smithable/oplog.jsonl`, committed). Operations also report **effects**, such as a rename, so the migration step can rename a column instead of dropping and re-adding it.
- **Edits preserve formatting.** Operations never re-serialize a file: a source editor splices text at the positions the YAML parser reports, so comments, alignment, flow style and blank lines outside the edited entry stay byte-for-byte identical. After every edit the result is re-parsed, and the operation is refused if the spec or content file would become invalid.
- **A rename follows the name everywhere it is used:** the field's texts, tones, table columns and form order, a page's search, the model's formulas and their examples, aggregates over it from other models (`SUM(lines.amount)`), dashboard tiles and onboarding steps. A removal leaves onboarding steps and lists without the field, and is refused, naming the tile, while a dashboard tile counts on it.
- Each operation is registered by the spec section, companion file or page pattern it belongs to, as part of the internal plugin interface (§5.1). An operation edits only what it is about and reports **effects** (a field renamed, removed or retyped, a page or section removed); every other registrant then **follows** the effect in what it owns (a companion its file, the models section its formulas, each page pattern its pages), or **refuses** it when something it owns still needs what went away, which fails the operation with that message. Adding a place a field can be named therefore never means editing the field operations.
- Batches of operations are atomic: they all apply, or none do.
- **Data operations.** `importRecords <Model> --from file.csv` adds records, not grammar: its `apply` edits nothing and reports an `import-records` effect naming the source (a file path, or the CSV text from MCP and Studio). The host follows it: core's pure `readRecords` matches columns to fields and converts values with the sample reader's rules (`convertValue`), the host looks references up by title in the development database, and the adapter's `insertRecord` gives the statements, run in one transaction inside the operation's checkpoint (the database snapshot `undo` restores). Every row is checked against the spec (required, kinds, choices), the database refuses a taken unique value, and the whole file goes in or none of it, each problem named by its line. No access rule is checked per record and no hook fires: an import is a project-time step for the project's admins, never a route in the generated app. `--dry-run` shows the first rows as they would be stored and every problem. The CSV is kept beside the checkpoint (`data/.smithable/imports/<checkpoint>.csv`) and the operation log names that file, so the log stays small and the change can be replayed.

Clients:

```text
CLI (smithable op …) ─┐
Studio UI ────────────┤
Smithable AI ─────────┼──► operations ──► manifest ──► compiler
External agents (MCP) ┤
Plugins ──────────────┘
```

## 5. Compiler, IR, adapters and plugins

- **Parser/validator** → **semantic model** → **IR**. The IR has defaults applied, references resolved, derived facts computed (for example, a foreign key implied by `belongsTo`) and identifiers normalized. It carries no technology concepts.
- **Adapter**: IR → a set of files, migrations, index entries, and build/run commands.
- v1 has exactly one adapter: **TanStack Start + React + TypeScript + Tailwind + shadcn/ui + Drizzle + SQLite + Zod + Vite**.
- The adapter boundary is kept clean inside the codebase, but the **adapter API is not published** until a second adapter exists. Designing a public API from one example produces the wrong API.
- Generation is **deterministic and idempotent**: the same manifest and the same Smithable version produce byte-identical output. This is tested.
- **Templates are real, checked code.** The app kit and generator templates are real TypeScript that is linted and type-checked, and the sample apps in `examples/` are generated, type-checked and tested on every `pnpm check`.

**Every value once (2026-10-17, [design/words-once.md](design/words-once.md)).** A value the generated app uses in more than one file (a page's title, the app's name, a role's or a choice's label) is exported once from a generated module (`src/generated/app.ts`, `pages.ts`, the model modules) and imported where it is used; a literal is written only where a value is used in one file, and a scaffold file, written once, never copies a value that can change. A text change then touches one file, and Studio's preview updates it in place.

### 5.1 Plugins

Smithable is extensible through **plugins**: npm packages, or folders inside a project (`smithable/plugins/<name>/`). A plugin can contribute:

- **Spec keys** with their own JSON Schema. Validation, autocomplete and the plain-language view work for them like for built-in keys. Every key belongs to exactly one plugin, and a plugin declares where its keys may appear (top level, on models, on pages, …).
- **Operations.** CLI commands, MCP tools and AI-usable actions are all derived from operations, so a plugin's operations appear in all of them automatically.
- **A generator** that writes code into the app. The app-independence rule applies: generated apps must not depend on the plugin at runtime. Ordinary libraries the generated code uses (for example a payment provider's SDK) are fine.
- **Extras:** additional CLI commands and MCP tools, a plain-language description for the Builder, and context for AI.

As built (project plugins, [spec/v0.1.md](spec/v0.1.md)): a plugin declares a top-level key with its schema, `expand`s it into ordinary spec, may `patch` entries the spec already has (a field on a model, a section on a landing page, a page in a menu; additions only, so regenerating with the plugin can never contradict the spec), may define `operations` that join the project's operation list (the CLI, MCP tools, Studio's forms and the AI's proposals ask `operationsFor(plugins)`, and a clashing name is prefixed with the key), and may `summarize` its section for the Builder. A module exports the plugin or a function of a small plugin API, since it imports nothing.

Plugins are declared in `smithable.context.yml`, since they are an implementation choice.

**Built-in features are internal plugins.** Models, fields, pages, access, formulas and jobs each register their schema, operations and generator through the same internal interface from the start (M1). As built: the spec's sections (`SpecSection`: schema, parser, operations, follow), the companion files (`Companion`: file, check, operations, follow) and the page patterns (`PagePattern`: schema, parser, what a page shows, icon, menu default, texted parts, forms, queries, operations, follow) are each one object in one registry, and everything else asks the registry instead of naming kinds; a landing section kind is a row in one table of what it may be given. That keeps the core honest, and makes the eventual public plugin API "publish what we already use" rather than a retrofit.

The companion files register the same way (`COMPANIONS` in core): each owns its file, its check against the spec, its operations, and a `follow` hook that keeps it in step with what an operation did elsewhere. Operations report what they did as effects (a field renamed, removed or retyped, a page or section removed), and `applyOperation` hands each effect to every companion, so a model operation never edits the presentation or text files itself. A follow may refuse the change, or return a **note**: a clause for the confirmation saying what it changed in step (a removed page "is no longer public"). An operation may return notes too, for what it takes away that its request did not name (`setPublic` says what visitors can no longer open or read); `applyOperation` appends them to the description, so the confirmation, the proposal a model makes and the change trace all carry them. Operations about the spec as a whole (rules, access, editing the spec) are listed on their own; none hang off the `app` section.

An operation's schema says what each argument names in the spec (`x-smithable: { ref: model | field | page | role | choiceValue | section }`, a field of the model or page another argument names, and the word Builder asks for it with). Studio's operation form and Builder's plain changes (removing a field, a page or a section) are built from that; Builder keeps its own forms only where the change needs more than choosing names (a field's type, access, a tile).

Page patterns (crud, landing, dashboard, settings, onboarding, users) register twice, once per layer: how the key is written (its schema and parser, in the pages section) and what the IR knows about it (`PAGE_PATTERNS`: the models its pages show, the model a page manages, its default icon, whether it is in the main menu by default, its default access, its parts with texts). Menus, icons, texts and the index ask the registry; wording tables in the index are typed over every pattern, so a new one does not compile until it is described.

**"Teach Smithable".** When the spec contains something Smithable does not understand, it does not guess. The validator reports it and offers: *"Smithable doesn't know `newsletter` — create a handler?"* AI then writes a **project plugin** (schema, operations and generator) **once**, reviewed like any other change. From then on the construct is handled deterministically and costs 0 tokens, like every built-in feature. AI is used to create a generator once, instead of writing code on every request. A useful project plugin can later be published for others.

**Guardrails:**

- **No unexplained constructs.** A key without a plugin is a validation error, never silently ignored.
- **Trust.** Plugins run code. Locally they are trusted like any npm package you install. The hosted product runs only vetted plugins at first. Plugins follow the engine's browser-compatibility rule (§1).
- **Core stays curated.** Plugins may add constructs for one domain freely; promoting a construct into the core DSL still requires the questions in §2.4.
- **No public API before real use.** The plugin API is published only after several built-in features and at least one real project plugin have been built on it, for the same reason as the adapter API.

## 6. The generated application and code ownership

This is the most important contract in the system.

### 6.1 Normal first

A developer who knows the stack but has never heard of Smithable should find the app unsurprising.

- **No Smithable dependencies**, either at runtime or at build time. `pnpm install && pnpm dev` works with Smithable uninstalled.
- **Stack idioms, not Smithable idioms.** The app uses:
  - Drizzle table definitions as the database schema,
  - validation derived with drizzle-zod,
  - TanStack file-based routes and server functions,
  - shadcn/ui components.

  Follow each library's documented conventions, so its docs and Stack Overflow answers apply directly.
- **Small Smithable footprint.** Its additions are limited to one-line generated-file headers, a thin UI-hints file, the app kit, the `src/custom/` convention, and an `AGENTS.md` for coding agents. All of them are explained in a generated README.

"Normal" also serves the AI goals. Local and public models are most reliable on code that looks like their training data, so idiomatic code means fewer errors and fewer retry tokens when AI works on custom code. Keeping the code idiomatic has no downside for low token usage, because most context comes from the manifest, not the code.

### 6.2 Schema: Drizzle is the in-code source

The compiler writes `src/db/schema.ts` as ordinary Drizzle tables, built from models, relations and auth user fields. Everything else derives from it the standard way: Zod validators through drizzle-zod, and TypeScript types through Drizzle inference.

Next to it, each model's module in `src/generated/` describes what the database does not know: labels, semantic kinds (`email`, `phone`, `money`), the fields shown in tables and forms, and computed fields. These field lists are explicit code, so a column added to the Drizzle schema by hand is stored and validated but appears in the UI only once it is added to the model's list, like any other hand-written change. Generated modules reach a model's table through the schema namespace (`import * as schema from "#/db/schema"`, then `schema.rows`), so no local or parameter of generated code can shadow a table, whatever a model is called (a model named Row has the table `rows`, Value the table `values`); the schema file and custom code keep the plain names.

Sample records are data, not grammar: a project's `samples/<Model>.yml` (core's `validateSamples`, checked with positions like the spec) are embedded in the generated `src/db/seed.ts` instead of generated rows, so generation stays byte-identical; models without a file get the adapter's generated rows. The starters' sample texts are such files.

### 6.3 The app kit

The **app kit** is a set of generic, reusable source files that the adapter writes into generated apps, in `src/kit/`. It contains data components (`ModelTable`, `ModelForm` with `FieldInput`, `Combobox` and `SearchBox`), the shell (`AppShell`), the page patterns' sections (`Landing`, `Dashboard`, `Onboarding`, `Users`), sign-in (`SignIn`), access checks, formatting, formulas, search and the theme (§10.4); a record's own page is a `ModelForm` with its related lists, not a component of its own. The pattern is the same as shadcn/ui, where components are copied into your repo instead of installed. The kit lets pages stay short without a Smithable package. `mail.ts` sends mail from hooks and custom code over SMTP settings from the environment (`SMTP_URL`, or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` and `SMTP_PASSWORD`, and `MAIL_FROM`), and without them writes each mail as an `.eml` file to `DATA_DIR/mail/outbox`, so nothing leaves a developer's machine and tests can read what a hook sent; any provider works, and the hosted service will hand apps their settings and a quota as it does the model key.

**Logs** (`docs/design/logging.md`): `trace.server.ts` gives every request one id in the W3C `traceparent` format (a caller's continued, otherwise made), held for the request in an `AsyncLocalStorage`, so log sites ask for it instead of passing it on; `src/start.ts` runs each request inside it through TanStack Start's request middleware, answers with the `traceparent` header and writes the access line to standard output as JSON (time, id, method, path with the query's names but not its values, status, duration, who and role, address, browser, size). Who comes from `currentViewer`, which names the viewer to the trace when it resolves the session. On the access line, the address and browser go to standard output, kept as long as whatever collects it keeps it (the hosted service: 90 days). The audit log below stores them too, with each change; the retention job blanks them there after 90 days and removes the lines after 12 months (docs/design/logging.md §3.3). `log.server.ts` is the app log: `log.info`, `log.warn` and `log.error` write one JSON line each with the time, level, trace id, who, a message and named values (an error with its stack); kit, generated and custom code log through it, and an unexpected database error reaches the page as an apology with the request's reference (`refusal`), which finds its line. The **audit log** is a table in every app's database (`audit_log`, in the generated schema beside the auth tables, so drizzle-kit writes its migration): `audit.server.ts` writes one line in the same transaction as each create, change (with the names of the fields that changed, never their values), delete, action, copy and record an action adds, naming the viewer it was made as (or "visitor", or "the app" outside a request), their role, and the request's id and client. Names are not copied onto lines (docs/design/logging.md §3.3, "Names in the log"): while a record exists it is looked up by id; only the line that deletes a record keeps its title, and only the line that removes a user names them. What touches security (sign-in, invitations, roles, removals) keeps its values, never a secret. Pruning (`pruneAudit`, a minute after the server starts and then daily) blanks the address, browser and kept titles after 90 days (`AUDIT_CLIENT_DAYS`) and removes lines after 12 months (`AUDIT_DAYS`); `forgetInLog`, for administrators, blanks every stored name, title and address about a deleted record or a removed user at once and is itself logged by id. These are the only changes to existing lines, and they only blank or remove. No page, operation or data function writes to it or deletes from it.

**Keys** (`docs/design/integrations.md` §2): an app whose auth file has an `api` block, with sign-in and a users page, gets an `api_key` table and `src/generated/keys.server.ts`. An administrator makes a key on the users page (kit `Keys`) with a name, a role and an optional end date; it is shown once and stored as a SHA-256 hash, can be revoked, and records when it was last used. `keyViewer` turns a request's `Authorization: Bearer smk_…` into a viewer with the key's role and the id `key:<n>`, so nothing a key does is anyone's own. Making and revoking are in the audit log with the key's name, role and end, never the key. A key is a role, not a person (`personOf` in the kit's access module): what it creates has no owner, and it never manages keys or users, whatever its role; removing a user revokes the keys they made. The **API** itself: for each model the `api` block offers, `src/routes/api/v1/<models>/index.ts` (a page of at most 100 the key's role may read; adding one), `…/$id.ts` (get, change the fields given, delete) and `…/$id.actions.$action.ts` (the offered standard actions), all through the model's data functions, so a key may do exactly what its role may in the app. `src/generated/api.server.ts` converts between records and the API's JSON (the spec's field names, amounts as decimal texts, times as ISO texts) and checks values with the model's own schema, and holds the OpenAPI description served at `/api/v1/openapi.json`. The kit's `api.server.ts` frames each call: the key, 60 calls a minute per key, bodies up to 1 MB, refusals as JSON problems in the app's words. With `api.assistants`, `src/routes/mcp.ts` offers the same as tools for AI assistants (the kit's `mcp.server.ts`, a stateless JSON-RPC endpoint in the Model Context Protocol's form; `src/generated/mcp.server.ts` lists the tools, with the spec's intents, rules and field names as descriptions, and calls them through the same data functions and conversions): find, read, add and change per offered model, one tool per offered action, and delete only with `assistants: { delete: true }`. Same keys, limiter and refusals.

**The inspector** (`docs/design/assistant.md` §4, step 5): when the app offers tools to assistants and has a data page, the data page gets `ask`, for administrators. A question is asked as one of the app's roles (a viewer with a key's id, `key:inspector:<id>`, which owns nothing) or as a visitor, and answered by the kit's `assistant.server.ts`: the wording rules (`ask.ts`) first, then the host's model if `ASSISTANT_URL`, `_KEY` and `_MODEL` are set (an OpenAI-style `/chat/completions` with tools; the person in `X-Assistant-Person`), calling the same generated tools as `/mcp` through `callTool` and the same check of what the role is offered (`offered` in the kit's `mcp.server.ts`). The app runs every call and shows the result (kit `Inspector`), marked "From your records" when the rules read it and "AI" when a model chose or worded it, with each call, its result, the tokens and the time under it. A call that would change something is shown, never run. The question's text is not kept. A model's final words are checked against the results without a model (kit `grounded.ts`, `docs/design/ask-checks.md` §3): "none" with no empty result, a change claimed with none proposed, a number no result holds, an answer about records with no call. One that fails is sent back once with why, then once more with `X-Assistant-Ask: ungrounded`, so a host with a better model can give it that one; still failing, it is shown muted with a line that it could not be confirmed, beside the results.

**"Ask"** (`docs/design/assistant.md` §6, step 6): when the auth file has an `assistant` block, every model's data module gets finding and counting (as for the API), and `src/generated/ask.server.ts` holds the same seven tools over everything the person may read (core's offer with `scope: "app"`), offered to the roles the block names (and to visitors with `for: anyone`), and `ask()`, which answers a question as the signed-in person through the kit's `assistant.server.ts`: the wording rules, then the host's model, never a model for a visitor. The root route gives those viewers an Ask button (kit `Ask`), a sheet over the page with the same answer display as the inspector, without the calls. The tools' dispatcher and the record conversions are one generator for `/mcp` and for Ask; the refusals and the tools' types are kit files of their own (`refusal.ts`, `tools.ts`), so an app with Ask and no API keys has them. Ask only reads; changes, confirmed by the person, come with `may: change` in the next step.

Rules that keep the kit "normal":

- **Only what is used.** The adapter copies in only the kit parts the spec actually uses, so a simple app gets a small kit. Each part has a size budget, and growth needs a justification.
- **No magic**, which means three things: no global registries (a page imports the description and components it uses), no runtime code generation, and no string lookups from outside the kit. The kit's components are generic over a model's record type: each model's description (`src/generated/<model>.ts`) is a `RecordUi<Row>` whose fields read a record through typed accessors (`get: (row) => row.customer?.name ?? null`), so a table and the rows given to it are checked against each other at the route. A table's `columns`, `hide` and `below` are keys of that record type, so a column the spec no longer has is a type error, and a referenced record's title is typed as Drizzle gives it. Inside the kit, a form keeps its values by field name; that is the kit's own business, not a lookup anyone else depends on. (Decided 2026-09-29, rather than generating typed components per model: the same checks with far less generated code.)
- **Readable.** Each file opens with a short comment explaining what it does and how to customise it.
- **Copyable.** When a generic component is not enough, copy it into `src/custom/components/` and edit the copy.

Generated pages are short, explicit compositions:

```tsx
<ModelTable ui={customerUi} app={app} rows={rows} onOpen={(row) => open(row.id)} />
```

### 6.4 Ownership zones

| Zone | Examples | Owner | Regeneration |
|---|---|---|---|
| **Generated** | `src/db/schema.ts`, `src/generated/**`, generated routes, nav | Compiler | Overwritten freely. Files carry a one-line header marking them as generated |
| **Kit** | `src/kit/**` | Compiler | Updated when the Smithable version changes |
| **Custom** | `src/custom/**` (actions, queries, pages, hooks, components, auth) | User / AI | **Never overwritten.** The compiler creates a typed stub once, then leaves the file alone |
| **Migrations** | `drizzle/**` | Compiler writes them, then history owns them | Never rewritten after creation |
| **Scaffold** | `pnpm-workspace.yaml`, `.gitignore`, `.dockerignore`, `CLAUDE.md`, `.mcp.json` | Created once, then the project and its tools | Never rewritten; tools like pnpm legitimately edit them |

Custom code is linked to the manifest by convention: `actions.calculateShipping` with `custom: true` corresponds to `src/custom/actions/calculateShipping.ts`, and a page with its own component (`smithable customize page:customers`) to `src/custom/pages/customers.tsx`. A custom page replaces only the page's component: the generated route keeps loading data, search and access checks, and the component reads the route's data through TanStack's `getRouteApi`, so the loader's types are its contract. A page or landing section written in code from the start (`custom: Planner`, `repayment: { custom: RepaymentChart }`) is the same arrangement: a generated route (or the landing page) around `src/custom/pages/Planner.tsx` or `src/custom/sections/RepaymentChart.tsx`, created once as a stub, with its props typed in `src/generated/custom.ts`. The compiler generates the typed input/output contract into `src/generated/`, so if the manifest's signature changes, the custom file fails typechecking. That turns drift into a compile error instead of a silent bug.

Custom files may import anything from `generated/` and `kit/`. Generated code imports custom code only at the declared hook points.

**Hook points.** Behaviour that follows a change ("when an order is placed, send a confirmation") needs no construct in the spec: the generated `src/generated/hooks.ts` types, per model, what may run after a record is created, changed or deleted, plus daily jobs, and calls what `src/custom/hooks.ts` (created once) and a plugin's own hooks file put there. A hook runs on the server in the request that made the change, after it is saved, with the viewer who made it; it may use the data functions, so it keeps the access rules; a hook that throws fails the request. Daily jobs run in production a day after the server started. Jobs and integrations, when they become constructs, generate onto these points.

### 6.5 Drift detection

The compiler records a hash of every file it owns in `.smithable/`. If someone edits a compiler-owned file by hand, Smithable reports drift and offers two choices: **revert**, or **move the change into a custom file or the manifest**. It never silently overwrites a manual edit. For a page's list route, `smithable customize page:<page>` moves the edit: when the edit only touched the component, the edited component becomes the custom page and the route is generated again; when it changed loading or access, it explains why the edit cannot move. `generate` suggests this when it finds such an edit. (In the M7 benchmark, one hand-edited route blocked every later operation.)

Missing custom implementations (a manifest says `custom: true` but the file or export is missing) are also reported as drift.

### 6.6 Migrations

Migrations are written in **drizzle-kit's own format, including its snapshot metadata**, so `drizzle-kit generate` continues seamlessly after a detach. The adapter computes them from the difference between the old and new IR, and uses the operation log to tell a rename from a drop followed by an add. Without Smithable, drizzle-kit's own interactive rename prompts take over. Destructive migrations (removing a column or table) require explicit confirmation.

### 6.7 Conventions of the TanStack adapter

Concrete choices the v1 adapter makes; they are ordinary, documented practice for the stack.

The generator itself is split by concern (`shared`, `schema`, `data`, `actions`, `smoke`, and one module per page pattern under `pages/`). `generateApp` only copies the kit and runs one `SectionGenerator` per part: the app as a whole, sign-in, models, actions, queries, pages and project plugins. A generator declares the kit files only apps using its part need (sign-in's, each page pattern's through `PAGE_GENERATORS`), and a kit file is left out unless the part that owns it is used. Generated code is assembled from parts, never patched afterwards by pattern matching. A refactor of the generator must leave every example's output byte-identical.

- **SQLite through `better-sqlite3` 12.x** on stable Drizzle. It ships prebuilt binaries, so neither developers nor the container build need a compiler; 13.x dropped them and always compiles from source. Switching to Node's built-in `node:sqlite` is planned once Drizzle 1.0 (which supports it) is stable.
- **Money is stored as whole cents** in integer columns, so amounts never suffer floating-point rounding; the kit converts for display and input. Datetimes are millisecond timestamps, dates are `YYYY-MM-DD` text, choices are text columns with an enum.
- **Migrations are created by the app's own `drizzle-kit generate`** after the schema file is written, and **applied at startup**, which suits a single SQLite instance. Data lives under `DATA_DIR` (`data/` in development, `/data` in the container). A server that has migrations to apply first copies the database as it is (`VACUUM INTO db/before-migration.db`, the last copy only); `smithable deploy` and the hosted service put that copy back when the new version then fails to come up, so the previous version never runs on a schema it does not know.
- **Production** serves the plain Vite build with `srvx` (`pnpm start`); no extra server framework is needed.
- **Per-model code is explicit:** each model gets a module with its UI description, Zod schema (`drizzle-zod` plus format refinements) and `createServerFn` functions containing plain Drizzle queries. The kit components are generic; the generated routes connect them.
- **The file record.** `.smithable/files.json` lists every Smithable-owned file with the hash of what was last written. Regeneration deletes files the spec no longer produces and refuses to overwrite files edited by hand (§6.5).
- **Sample data** is generated deterministically from model and field names and loaded with `pnpm db:seed` (done by `smithable new`).
- **One route tree.** The route tree is written by the router's own CLI (`tsr generate`) after each change, and rewritten by TanStack Start's plugin while the dev server runs. The kit's `tsr.config.json` gives the CLI the same footer the plugin adds (Start's `Register` declaration), so both write identical files and a running preview never leaves the tree changed, which would block the next operation.

### 6.8 Leaving Smithable: `smithable detach`

Because the app is already normal, detaching is a cleanup, not a rescue:

- requires a clean Git tree, so the detach is one reviewable (and revertable) change,
- removes the generated-file headers and the kit's "Smithable app kit" prefix,
- moves the `smithable*.yml` files to `docs/smithable/` as documentation,
- removes `smithable.lock`, `.smithable/` and the dev-database snapshots,
- rewrites the README without any mention of Smithable,
- leaves the app kit behind as ordinary project code. `src/custom/` is left untouched.

Re-adopting a project after detaching is not supported initially (see §15). The guarantee is verified by a roadmap test (M4): after detaching, a developer adds a field and a page using only the Drizzle and TanStack docs, `drizzle-kit generate` continues the migrations, and the typecheck, build, tests and server still pass (`pnpm test:apps`).

## 7. Implementation index

The index maps each semantic concept to its code: `concept ↔ files/symbols ↔ routes ↔ DB tables ↔ UI elements ↔ tests`, plus the concept's free text.

- Most of it is **emitted by the compiler as a by-product**, since the compiler knows exactly what it generated: the adapter's `implementationIndex` lists each concept's files, symbols, routes, tables and tests. Custom files are covered by light static analysis: exported symbols, imports of generated symbols ("uses"), `// implements rule` markers and test names. The same analysis gives each rule its status (§2.3).
- It lives in the engine package `@smithable/index` (browser-compatible; the host passes in the files).
- It is disposable and **computed on demand**: building it for the example apps takes milliseconds, so it is never stale. It will be stored (JSON, later SQLite) when size or query needs justify it.
- Query API (used by AI tools, Studio and the CLI): `inspect(concept)`, `findImplementation(concept)`, `findTests(concept)`, `conceptsAt(file)`; `conceptForElement(id)` comes with visual selection (§10.3). `smithable inspect <concept> [--json]` prints a concept.

## 8. Change pipeline and safety

```text
operation(s) → validate → write manifest → compile → migrate (dev DB)
            → typecheck → tests (fast level) → checkpoint → preview reload
```

- A failure at any step rolls back to the previous checkpoint automatically and reports the error.
- **Checkpoints use Git.** An operation requires a clean working tree, so it can be undone on its own. Each applied operation becomes one commit (`smithable: <description>`) containing the spec change, regenerated code and migration. Undo reverts the most recent operation that is not undone yet, as a new commit, so an undo can itself be undone. The diff is always viewable. An earlier change (`smithable undo --change <id>`, Studio's X on any change, 2026-10-17) is reversed as a new change through the same pipeline: its spec files merged back three ways by git (as the change left them, as they were before it, as they are now), only they, and those files validated, regenerated and migrated forward; refused when the merge does not apply (a later change edited the same part) or the spec after it is invalid, which is the dependency check (the validator names what a later change still needs); a column lost with it asks first. No snapshot is restored for an earlier change, since that would lose the records written since.
- **The repository is the app's own.** It starts at the app's folder. An app made inside another repository (the first steps in the README make it inside the clone of Smithable) gets its own at its first change: otherwise its changes and undo would be commits in that repository, and that repository's other edits would stand in their way.
- **Data comes back too.** Before migrating, the dev database is copied with SQLite's `VACUUM INTO` to `data/.smithable/snapshots/` (ignored by Git, like the rest of `data/`), and the commit records which snapshot belongs to it. Undo restores it.
- **Migrations never ask.** Renames become a custom migration with `RENAME COLUMN` (and the schema snapshot is updated to match), so drizzle-kit never has to ask whether a dropped and an added column were a rename. Other changes use drizzle-kit's normal generation. The migration is applied to the dev database immediately.
- **Destructive changes need confirmation** (`--yes` on the CLI) and say what they affect, e.g. "this deletes the phone column; 8 of 8 customers have a value for it". Making a field required is refused while rows have no value for it.

## 9. AI layer

### 9.1 What AI is allowed to produce

1. **Operations.** Structured output constrained to the operation JSON Schemas (grammar or JSON-schema constrained decoding). This is the common case.
2. **Manifest free text.** Proposed `description`, `intent`, `rules` or `examples`.
3. **Custom code.** Edits restricted to the custom files of specific concepts, with the generated contract as the interface. When AI implements a rule, it must also write a test that names the rule, so the rule can reach **Implemented and tested** (§2.3).

A drafted app's pictures (the landing page's hero, its mark, a few sample pictures) come from the Smithable image library by its tags, chosen in `@smithable/ai` from the index the host fetches and caches; offline, the app starts without pictures. They are made with an AI, so each carries `generated: true` (the content file's pictures, the sample files' and the seeded record pictures' JSON), and the kit's `AiMarked` labels a picture so marked where it is shown whole (AI Act art. 50); the flag is data, so a maker's own pictures are labelled only when the maker sets it. The app's owner can switch the labels off (`aiBadge: false` in smithable.ux.yml, presentation): the owner is the deployer who answers for disclosure, and the engine keeps one default, on, wherever the app is hosted.

AI never edits generated or kit files.

### 9.2 Routing

| Tier | Handler | Example |
|---|---|---|
| 0 | Generators: explicit operations (UI controls, CLI) and a phrase grammar over the request (`matchRequest` in `@smithable/index`: a request worded like an everyday change becomes operations when every name in it resolves to exactly one concept, else it goes on to a model) | The "required" toggle; "Customers should have a phone number" |
| 1 | Local model, where available (CLI, self-hosted; possibly in-browser later) → operations | "Customers need a mobile number" |
| 2 | **Smithable model**: a small, cheap model (EU-hosted in the beta) → operations, pattern and theme choices | The same, for hosted users; "make it feel friendlier" |
| 3 | Frontier model (the service's, the user's own API or Claude Code; via an EU region where the policy asks for it) | Custom action logic, new custom components |

For hosted users, who have no local model, tier 2 is the main AI tier. It starts as an off-the-shelf open model on an EU provider's hosted endpoint (for example Mistral, Scaleway or OVH), and is fine-tuned later once curated and consented data exists. Because every tier speaks the same operation schemas, swapping the model behind a tier never changes the product.

The system escalates only when the lower tier is unavailable, fails validation, returns no valid operation, answers that no operation can do it while a stronger tier is allowed (a small model's "cannot" is not the last word), or the task needs custom code. A question from any tier goes to the user as it is: asking is cheap and never a guess.

**Questions about the app** ("who can delete orders?", "is the schedule public?", "what is a customer?", "where is the total used?", "what happens when I delete a customer?") are answered, never applied (`docs/design/studio-v2.md` §4). Tier 0 answers the common shapes from the spec and the access rules (`answerQuestion` in `@smithable/index`, with the same name resolution as the phrase grammar); a question it cannot read goes to the model with the app's context, whose answer kind is `answer` (one to three sentences, constrained by the schema like the others). The proposal kind `answer` carries the text and the concepts it is about; `smithable ask` prints it, Studio shows it under the change box, and nothing is traced, since nothing changed.

### 9.3 Context construction

Before any model runs, simple fuzzy and embedding matching over the manifest shortlists the likely concepts, so even a 1–3B local model only chooses among a few candidates. A **context builder** then assembles the smallest useful slice from the manifest, the index and (only for custom code) the relevant source files: the request, the relevant concepts with their free text, available operations, and the implementation slice needed for that tier. Every tier gets the same semantic slice; escalating a tier never means adding unrelated project data.

The context builder is `buildContext` in `@smithable/index`; `smithable context "<request>"` shows the slice a model would get. Shortlisting is deterministic word matching for now (names weigh most, weak matches are cut); embeddings come with Smithable's own AI (M12). Token counts are estimates (about four characters per token), good enough to compare contexts and budgets; each context and MCP call is logged to `data/.smithable/token-log.jsonl`.

What a model is offered depends on where it runs (`promptFor` in `@smithable/ai`). A hosted model pays per token, so it gets the context and only the operations that can be about the request's concepts (one that changes an existing model, field or page is offered only when the context has one; operations that create something or work on the app as a whole always are). A local model pays no tokens but prefills slowly, so it gets the same system text and the whole operation list every time, a stable prefix its server keeps in its cache, and only the context after it. Either way the answer is constrained to a strict JSON Schema built from the offered operations' own argument schemas, so a constrained model cannot misname an argument or leave a required one out; a server whose JSON Schema support stops short of it gets a simpler schema of operation names, once, and keeps it.

For each AI call, record (locally) the semantic-context tokens, implementation-context tokens, model, tier, operation type and whether escalation happened. Project content is never collected for analytics without explicit permission.

### 9.4 Confirmation over self-reported confidence

Models are poor judges of their own confidence, so Smithable does not rely on self-reported scores. Instead:

- Proposed operations are shown in readable form ("Add field `mobilePhone` (phone) to Customer") before they apply. The user can enable auto-apply for non-destructive operations.
- If the model returns several candidate interpretations, or none validate, Smithable asks the user or escalates.
- Low-certainty inference never mutates the app silently.

### 9.5 Providers and policy

- Provider interface with implementations for: **OpenAI-compatible** (covers Ollama, llama.cpp, vLLM, Mistral and most EU hosts), **Anthropic API**, and **Claude Code CLI** (spawned headless, confined to the project directory; Smithable never reads or copies its credentials).
- **Policy** (`local-only`, `eu-only`, `best-available`, `custom` allowlist) is enforced centrally in the provider layer, not by each caller. An organization can pin the policy. **Where a model may run is a setting** (decided 2026-10-04): with nothing said the policy is `best-available`, the best model configured wherever it runs; `eu-only` keeps a project to local and EU-hosted models and `local-only` to the machine. Until that decision `eu-only` was the default. smithable.eu, when it exists, is the edition where `eu-only` and EU-only infrastructure are always on.
- **Integrations follow the same line.** What Smithable builds in and chooses the provider for (mail, later text messages) uses an EU provider wherever a good one exists, and on smithable.eu always. A connection to a service someone names (their issue tracker, their payment provider) is that service, wherever it runs: nobody wants an EU stand-in for the tool they already use.
- Local models: use an existing small open model with optional download; never bundle weights. The Smithable model (tier 2) is later fine-tuned on (request, semantic context, accepted operation) triples from curated, synthetic or consented data, and may be published as open weights for local use.

- A proposal is dry-run with `applyOperation`, repaired once with the error, then escalated. Every proposal is shown first, in the summary's words, and waits for Apply (Discard, Change it in the forms, or Refine it in a few more words); one that leads to custom code says which file a model writes. Undo takes an applied one back. Every AI commit carries a `Smithable-AI` trailer (tier, model, tokens, cost). Details: [as-built.md](as-built.md#m12-smithables-own-ai).
- Custom code comes from a coder that is not trusted: Smithable checks every file it changed (tracked, untracked and ignored, and the Git hooks) against its area, runs the type check and tests itself, and undoes everything otherwise. Details: [as-built.md](as-built.md#m13-custom-code).
- Project plugins (§5.1) load in the CLI and in Studio's tab; a plugin's generator writes only `src/generated/plugins/<key>/**`. Details: [as-built.md](as-built.md#m13-teach-smithable).

### 9.6 External agents via MCP

Smithable ships a local **MCP server** (`smithable mcp`). MCP (Model Context Protocol) is an open standard that most AI coding tools support: Claude Code, Cursor, VS Code, Codex and many local-model clients.

- **What it is.** A subcommand of the open-source CLI. The user's agent starts it as a local process and talks to it over stdin/stdout. There is no network service, no account and no cost.
- **Tools exposed.** The semantic operations (`smithable_add_field`, …), `smithable_context` (the context builder, §9.3: where agents start), `inspect`, `validate`, `test` and `undo`. Tool schemas are the operation JSON Schemas, so there is one definition for the CLI, Studio, the internal AI and external agents. A destructive operation is refused with its data impact until it is called again with `confirm: true`, which the agent should only do after asking the user. `detach` is deliberately not a tool: leaving Smithable is the user's decision, not an agent's. The server's instructions tell agents to change the app through the tools and never edit generated files; child processes write to stderr, since stdout carries the protocol. Every tool call's input and output size is logged to the token log (§9.3).
- **Why.** Any agent can change the app through operations instead of reading and editing the repository. This delivers the low-token benefit before Studio exists, and it works with whatever model the user already pays for.
- **Agent guidance.** Every generated app includes an `AGENTS.md` (kit zone, updated with Smithable) explaining the ownership zones, where custom code goes, and to prefer Smithable tools over file edits, plus a `CLAUDE.md` pointer and a `.mcp.json` registering `smithable mcp` (both scaffold: the project's once created). `smithable detach` removes them.
- The operation pipeline (§8) applies unchanged: validation, checkpoints, tests and undo.
- The hosted service offers a **remote MCP endpoint** with the same tools, so Claude.ai, ChatGPT and other agents can work on hosted projects. The local server never depends on it.
- **Over HTTP (M15).** `smithable studio` also serves the tools at `/mcp` (the SDK's Streamable HTTP transport, stateless), and a tool call refreshes the open Studio, so an agent's changes appear there as they happen. The hosted endpoint is this, behind the service with a per-project token. On this machine Studio answers only requests addressed to `localhost` or `127.0.0.1`, so a web page cannot reach its API or `/mcp` through DNS rebinding. Its pages may not be framed by another site (`frame-ancestors 'none'`), and applying a described change names the proposal it was shown, so a newer proposal made elsewhere (another tab, another session on a shared workspace) is never applied in its place.

### 9.7 Change trace

Every change records and shows how it was handled:

```text
Added "phone" to Customers      generator        · 0 tokens   · 40 ms
Made the dashboard friendlier   Smithable model  · 820 tokens · €0.0004
Added churn scoring             frontier model   · 6.1k tokens · €0.03
```

- Each entry shows the tier, model, tokens, cost and duration. A running total shows usage against the plan's allowance.
- **Comparison with conventional AI builders is shown only as a labeled estimate** derived from the benchmark measurements (roadmap M7), never invented per change. The M7 baseline ([report](benchmarks/m7-report.md)): a coding agent editing the repository used about 350k–1.4M tokens (median about 400k) and $0.35–1.07 per small change; the same agent calling Smithable's operations about 110k tokens ($0.13); a deterministic operation none.
- The trace is part of the product, not only the demo. It explains bills and builds trust. It is stored with the project's history and contains no project content in analytics unless explicitly permitted.

### 9.8 Starting from a sentence

`smithable new "a booking site for a yoga studio"` (or the Builder's first prompt) uses a model **once** to draft the initial project: models, pages, page patterns, theme and sample data, expressed as a batch of operations. The user confirms the plain-language summary, the operations are applied, and everything after that follows the normal routing. Without a model, `smithable new` offers templates instead.

As built (M15.5, [design/first-build.md](design/first-build.md)): before the draft, one cheap call to the smallest allowed model reads the description, picks the starter that is the best example for it (the neutral `records` starter when none fits), and asks at most three questions when the description leaves the app's shape open; the answers are folded into the description. The draft then comes as a batch of operations from an empty app with the starter's access default, the starter's spec given as the example of shape to reuse (the default; `SMITHABLE_DRAFT=files` keeps the earlier form, whole spec files adapted from the starter with errors back as the exact diagnostics), each answered against its own argument schema so the grammar cannot go wrong: slips in the field shorthand are mended without a model, an operation refused for what it names is sent back with its reason together with the others refused, and extras that still fail (a text, a colour) are dropped rather than the draft. `setApp`, `setDefaultAccess`, `setRoles` and `setPublic` exist so an app's frame can be built from operations at all. Measured in [benchmarks/](benchmarks/) (`draft-modes-*.md`).

**Before any model** (2026-10-05, [design/first-build.md](design/first-build.md) §2.9): each starter has a description of its own, in words a reader without a model knows (`packages/ai/src/starter-descriptions.ts`; a test holds each against its starter). A description that is one of those is that starter, and a small edit of one (a known kind of record added, a page taken out, closed to visitors, by invitation only) is the starter with those operations applied. `smithable clarify` then asks nothing and `smithable new --describe` calls no model. Anything else goes the way above: another subject, a word the reader cannot place, a wish, a choice about what to open, another language. The reader (`read-description.ts`) starts with every decision unknown and never guesses; `scripts/bench-read.mjs` measures it against descriptions with known answers.

Where the questions are asked: the CLI asks them in the terminal (`--answers "a; b; c"` answers them, `--yes` skips them); the hosted service asks `smithable clarify --json` in a one-off container and shows them as a second step of its form, then starts the workspace with the answers. There is no silent fallback: when no draft could be made, the reason is told (the CLI prints it; a hosted workspace writes it to `data/.smithable/notice.txt`, never committed, which Studio shows once at the top of Builder), and the chosen starter is used with the description kept for the change box.

A starter (an example in `examples/`) may carry its own custom code under `src/custom/` with its tests, e.g. the CRM's customer merge, so a demo's custom action works. `smithable new` writes it for the plain starter only; an app drafted from a description gets the generated stubs, since the draft may have changed what that code relies on.

This is the one step that needs a **capable model**: it requires world knowledge (a yoga studio needs classes, teachers and bookings), design judgement and good copy. Small models only classify the request into a template. Three things keep it cheap:

- **A spec is far smaller than code.** The output is a compact spec (roughly 2,000–4,000 tokens) constrained by the spec's JSON Schema. The generators then produce the code.
- **It runs once per project.**
- **It starts from the closest template** (picked by a small model), so the capable model customises instead of designing from nothing.

It uses the strongest model the AI policy allows, typically a mid-size Smithable model or a frontier model. Which one gives the best first builds per euro is measured in M12, not assumed. Everyday changes afterwards use the normal routing (§9.2).

## 10. Product surfaces

### 10.1 One app, two modes

Builder and Studio are two modes of **one web app** (`apps/studio`), working on the same project. A toggle switches between them.

| | Builder (default for new users) | Studio |
|---|---|---|
| Main surface | Chat, preview, click-to-edit | Spec editor, diff, code, logs |
| Spec shown as | A **plain-language summary** ("Customers have a name (required), an email and a phone number…"), rendered deterministically from the spec at no token cost | YAML with schema validation |
| Change descriptions | "Added a phone number to customers" | Operations plus diff |
| Setup tasks (sign-in providers, domains, backups) | Guided wizards | Config files and environment variables |

Both modes show the **change trace** (§9.7) and **rule status** (§2.3), and support undo. In Studio mode (M15) the concept tree works like a properties panel: models open to show their fields, and a selected field, page or model shows its properties, changed with operations (a field's kind, Required and Unique, label, rename and removal; a page's title, subtitle, icon and removal; a model's names), and "Show in smithable.yml" selects its lines in the spec editor. The Operation tab explains each operation: what it does, what each argument means, and the same change on the command line. The **handoff** from a non-developer to a developer is just switching mode, or cloning the repository.

### 10.2 Preview runtimes

The app preview runs behind a small **preview runtime** interface. The UI does not know which one is active:

| Runtime | Where | Used by |
|---|---|---|
| **Local** | The daemon runs the app's Vite dev server in Node | CLI and self-hosted users |
| **Remote VM** | A small VM or container per active project on EU servers; it runs the app's dev server | Hosted Builder/Studio |
| **WebContainer** (not now) | The app's dev server inside the user's browser tab (StackBlitz WebContainers) | Deferred: see below |

In every runtime **the engine runs where the user is**: in the hosted Builder, operations, validation and generation run in the browser tab (15 ms in the M8 spike), and only the changed files go to the preview. **Hosted projects are Git repositories on EU servers**; the browser engine commits each operation as the CLI does, and the preview VM works on a checkout, so undo, history and hand-over are identical to the local product.

**As built for the beta (M15):** the hosted runtime puts the whole host side in the workspace, not only the preview: one container per project runs `smithable studio --host 0.0.0.0 --preview-url <public address>` on the project's own volume, so operations, Git history, undo, database snapshots, migrations and the preview are exactly the local product's (the engine still runs in the tab for summaries and validation). Operations in the tab would need all of that rebuilt for the browser first; they stay the direction once WebContainers or a browser Git and database are good enough. Workspaces run under gVisor with memory and process caps, start on demand and stop when idle. The service gives each project two addresses, `s-<id>` (Studio) and `p-<id>` (preview), each with its own host-only session obtained through a short signed grant from the service's domain, so no cookie is shared with project code. Published apps are on a second registrable domain (`a-<id>.smithable.app`), so an app's code and its visitors' sessions are never same-site with the service or Studio (`smithable.ai`) (decided 2026-09-29). Previews stay on the service's domain: Studio frames them, and a preview on another site would need a third-party cookie, which browsers block; the same-site mitigations (host-only cookies, Origin checks on writes) cover them.

**Publishing and data in the hosted beta (M15):** publishing checks the project's committed state (type check, tests) and builds it in a gVisor sandbox, then assembles the image with a runtime-only Dockerfile of `COPY` lines, so no project code runs outside a sandbox. Apps run under gVisor with memory, CPU and process caps and their own data volume, on `a-<id>.<domain>` or the tester's own domain (proved with a TXT record), sleep when idle and wake on the next request. Backups: a project's directory with its Git history and a `VACUUM INTO` copy of its development database when its workspace stops and nightly while it runs; an app's data when it sleeps and nightly, with the first of each month kept for a year (a project needs no monthly copy: its backup is its Git history); the service's own database hourly; all to a versioned S3 bucket with Object Lock, with a tested restore for each. Between those copies, every published app's database and the service's own are streamed by Litestream, which runs inside the container (gVisor keeps file locks within its sandbox) and writes to a host folder copied to S3 every minute, so a database can be restored to any second of the last thirty days ([design/pitr.md](design/pitr.md)); the service shows the counts since a chosen second and brings back removed records or undoes changes, and a hosted app's data page links there through `HOST_PAGE_URL` (its page in the service), which self-hosted apps never have. Containers never get the host's cloud credentials (metadata hop limit 1 and a firewall rule): the host copies backups to S3, and the model key reaches only the service's AI gateway, which gives each workspace a project token, meters its cost against the owner's monthly allowance and calls the EU-hosted model. Dependencies are prepared by content: projects whose dependency files hash the same share one installed copy, made once in the sandbox and kept as an image layer, and each workspace gets its own copy-on-write view, so nothing is shared writably. A warm pool keeps one workspace per starter ready, created with its final project id; a new app or the demo claims it. An operation runs only the tools its change needs, in Studio's own process where the app's own libraries allow it (drizzle-kit's programmatic API, the app's Drizzle and SQLite driver, its router generator), and Studio reloads the preview only once the dev server's watcher is quiet (`/__smithable/settled`). How these were found and measured: [as-built.md](as-built.md#m15-the-hosted-beta).

**One container per project stays (decided 2026-09-29).** The engine-in-the-tab design waits for WebContainers: re-probed that day (API 1.6.4, Node 22.22.3 inside), `AsyncLocalStorage` is still lost after the first `await`, and the cause is the browser engine, so it is not planned on. What would stop a second host is state in the service's process, so that state lives in its database: grants already used, demo starts per visitor, when each workspace and app was last used, publishes in progress, and domains whose proof has gone missing. Only caches and in-flight work stay in memory. Every five minutes the service records each running workspace's and app's memory and CPU (kept 90 days), so plans can be priced on data.

**Staging and the demo (M15):** a published app has two environments, live and staging, each with its own container, data volume and address; promoting puts the exact image checked on staging live, keeping the live data. The public demo gives a visitor without an account a guest user and a starter project in an ordinary workspace, limited in number, per visitor, in AI allowance and in time; publishing, sharing and agents are refused, and when the time is up the workspace, its volume and every record go, and nothing of it is ever backed up.

The M8 spike ([research/webcontainers.md](research/webcontainers.md)) ran the generated CRM in a WebContainer: installs, the Vite dev server and WebAssembly SQLite work, and an operation reaches the preview in about 3 s. But WebContainers lose `AsyncLocalStorage` across `await` (an open upstream issue), which TanStack Start and Better Auth depend on, so sign-in cannot work there. WebContainers are revisited when that is fixed; they would move preview cost to near zero.

### 10.3 Visual selection

- The app runs in an **iframe** preview.
- **Instrumentation is dev-only, and the app does not depend on it.** Every preview runtime starts the app's Vite dev server with a wrapper config that extends the app's own `vite.config` and adds the Smithable plugin. The plugin tags rendered elements with concept IDs and injects a small editor runtime that talks to the UI via `postMessage`. Production builds use the app's plain config, so they contain nothing from Smithable.
- Selecting an element resolves to a concept (`field:Customer.phone`) and shows the operations that apply to it ("required", "rename", "move", "hide from table"), plus a prompt box scoped to that concept.
- **As built (M11):** the kit's form fields and table columns carry `data-sm-concept` markers only when `import.meta.env.DEV` is true. `smithable studio` starts the preview with a wrapper config in `data/.smithable/` that merges the app's own `vite.config.ts` with the `smithable-editor` plugin (serve only), which injects the runtime from the router module. In select mode the runtime outlines what is under the pointer, reports a click (concept, and for a column its table's columns) to Studio, and turns column headers into drag handles whose drop reports the new order (`setColumns`). Studio's context panel offers required, rename, remove and hide-from-table for a selected field. `pnpm test:apps` checks that production builds contain no markers.
- **Pictures (first step of company websites):** a hero may have `image: { src, alt }` in `smithable.content.yml`; the file lives in the app's `public/images/`, which generation never touches, and `alt` is required. Pictures **on records** (`portrait: picture`, [design/articles.md](design/articles.md)) are data, not code: the browser scales and encodes WebP, the server checks the header, size and dimensions and stores the file under `DATA_DIR/uploads/` (one kit module, `src/kit/uploads.ts`, the only code that touches that directory, so a shared store later replaces it in one place), the record keeps `{ file, alt, width, height }` in a JSON column, and `/files/<model>/<id>/<field>` serves it through the model's data function so a picture is readable exactly when its record is. Replaced and removed pictures lose their file unless another record shows the same one (files are named by content). Starters carry their pictures in `examples/<starter>/public/` (embedded with the starter; every app from it gets them). The Booking and Invoicing heroes use images generated once for Smithable (OpenAI's terms assign them to us; no attribution needed). Landing pages also have a contact section (details, a map link rather than an embedded map, so no third party is called when the page opens, and optionally a model's form visitors send without an account, checked against `public.create`), a gallery (pictures in a grid that open in a lightbox on the browser's own `<dialog>`, with the arrow keys and Escape), and a footer of their own; the kit's code is written for Smithable, informed by the MIT block libraries in the research (no code copied, so no notices needed yet). Next: pictures for feature items, uploading and replacing a picture from the preview, and a searchable library.
- **Texts are changed in place (M15):** the kit marks page titles, subtitles and form labels with their place in `smithable.content.yml` (`data-sm-text`, development only); in select mode, clicking one makes it editable, and Enter (or leaving it) saves it through the `setText` operation, which sets, adds or (with an empty text) removes one text at a path, checked by the content file's own validation. A landing page's sections are marked the same way (a section's title, text or subtitle, and button, under `pages.<page>.<section>`), and so are the texts of their list items by position (`pages.home.faq.items.1.question`, or `…pricing.items.0.features.2` for one of a plan's features). An item's text can be changed but not removed, and `setText` never adds list items: new features, plans or questions are added in the content file.
- **Semantic edits** (fields, pages, access) go through operations on `smithable.yml`. **Presentation edits** (theme, ordering, visibility, density, grouping, sections) go through operations on `smithable.ux.yml`, and **text edits** (click a headline or label and retype it) on `smithable.content.yml`. Anything finer is a custom component.

### 10.4 Design system

Design quality comes from crafted templates, not AI improvisation. AI (even a small model) only *chooses* among them.

- **Themes.** A few carefully tuned presets (for example `modern`, `minimal`, `playful`, `corporate`): palette, typography, spacing, radius, dark mode. **Brand input** (a primary colour, a font, a mood) deterministically derives a custom theme from a preset.
- **Page patterns** beyond data screens: landing pages built from sections (hero, features, pricing, testimonials, FAQ, call to action), dashboards (stat cards, charts), list/detail, kanban, calendar, settings, onboarding, and sign-in pages. They are common across almost all apps, so they pass the DSL growth test (§2.4). Pages declare *which* pattern and sections in `smithable.yml`; `smithable.content.yml` holds their text and `smithable.ux.yml` their presentation.
- **Implemented so far (M10):** landing pages (hero, features, records as cards, pricing, testimonials, FAQ, call to action) and dashboards (counts, sums and averages with `where`, bar charts by month, the latest records). A landing page renders outside the app shell with its own frame; a dashboard's numbers are computed in a server function from `<model>Data.list(viewer)`, so they follow the access rules. Their kit files (`Landing.tsx`, `Dashboard.tsx`, `aggregate.ts`) are copied only into apps that use them. Settings pages edit the viewer's one record of a model (the first they may read), and an onboarding fills it in steps; sign-in opens the onboarding by default, and it redirects to the app once the record exists. A users page (M15.5) manages who has access (§3.1). A data page (M15.5) is the administrators' view of every model's records (§3.1). A calendar page (M15.5) shows a model's records by week or month in the app's time zone, loading only the range shown through the data function; forms read and write date-times in the app's zone (the kit's `zoned.ts`). An articles page (M15.5) shows a model's records as a blog or news, read through the data function, with the site's frame when public. A calculator ([design/calculator.md](design/calculator.md), 2026-09-30) is a page or a landing section of fields with formulas and nothing stored: core parses its fields with the model field reader and checks its formulas as a model's, the field operations work on it at its own place in the spec, and the adapter treats it as a model to the formula module (`src/generated/<name>-calculator.formulas.ts`, with a test per example) and to the kit's `Calculator.tsx`, which computes as you type; `PMT` joined the formula functions for it. A privacy page ([design/legal-page.md](design/legal-page.md), 2026-10-06, `legal: privacy`) is written from the spec, the auth file and the context file by the kit's `LegalPage.tsx` in the app's language, with the operator's details as texts; the sitemap, robots.txt and the consent bar know it. An order page ([design/orders.md](design/orders.md), 2026-10-15, `order: { from, into, ask, hours, lead }`) lets visitors choose records of one model and send them as one record of another with its lines: the browser sends ids and quantities, and the order model's create (given the lines) reads each chosen record as the viewer may, refuses one not available, copies its price into the line and numbers the order (`sequence: true`) in one transaction; opening hours (core's `hours.ts`, the kit's `hours.ts`) are checked on the server too. Custom pages and sections (the calculator design's §4) and kanban are still to come. A hero can be `cover` in `smithable.ux.yml` (the picture across the width under a wash of the theme's primary, so the text keeps the theme's checked contrast) and can have up to four `shortcuts` in the spec, pages drawn as round icons over its lower edge with their titles and navigation icons (2026-10-02, from comparing the booking starter with a company site).
- **Sample data** is generated with every new project, so no screen ever looks empty or broken.
- **Visual checks.** Playwright screenshots every page and checks contrast, overflow and mobile layout. Optionally, a vision model reviews the screenshots once per session.
- A professional designer creates the themes and patterns. This is a deliberate investment, not polish.

## 11. Daemon, CLI and MCP server

- Locally, a Node **daemon** hosts a project session: file watching, compile, the app process, Git, AI calls, and container builds. It exposes HTTP + WebSocket. In the hosted product, the browser tab is the host (§10.2), and the hosted service provides project storage, AI and publishing.
- The **CLI**, **Studio** and **MCP server** (§9.6) are all clients, and all use the same core packages. The CLI can also run core commands in-process without a daemon.
- So far the daemon is `smithable studio [dir]`: it runs the app's dev server as the preview (the Local runtime) and serves the Studio app (`apps/studio`) with a small HTTP API: the project (spec files, concepts from the index, the change trace from Git), operations (a destructive one returns its impact and needs a confirmed second call), undo (which restarts the preview on the restored database), `customize`, the last change's diff, and server-sent events for changes and logs. The Studio tab runs the engine itself for the plain-language summary (`summarize` in `@smithable/index`) and for validating the spec editor as you type: smithable.yml and each companion file (auth, ux, content, context), every one saved whole as one change (`editSpec` with the file as an argument) through the same checks and undo as any operation. Builder's experimental **Every setting** tab ([design/what-it-does.md](design/what-it-does.md)) shows every key of every file as a control chosen by its schema's shape, and writes one key at a time through `editSpec` with a `path` and its `value`, the file still checked as a whole. The same tab says what can be written at the cursor and what a word means (`completeSpec` and `hoverSpec` in core): the keys and fixed values come from the schemas the sections register, and for a companion file from its own JSON Schema (`companion-schemas.ts`, written from the validators and published beside smithable.yml's), so a new section or key is offered without a line in the editor, and the app's own names (its models, their fields, its pages, actions and roles) from the text, read by indentation since a text being typed is seldom valid YAML. Builder words every change as the summary does (`describeChange`, from the operation each commit records in its `Smithable-Op` trailer); Studio mode keeps the operations' own descriptions and the spec's shorthand. The spec editor saves through the `editSpec` operation, so an edit gets the same checks, migration, checkpoint and undo as any operation. The change trace is read from the operations' commits; a change made for the owner when the project is set up (`smithable op --setup`, the hosted service making the person who claimed a workspace its administrator) carries a `Smithable-Setup` trailer, and the trace leaves it out and undo passes over it. Details: [as-built.md](as-built.md#studio-the-summary-and-its-editing).
- **A Studio that waits for its app** (`smithable studio --replaceable`, `docs/design/fast-start.md`). Since every app of a stack profile has the same packages, a hosted workspace can run Studio before anyone has asked for an app, and get the app when it is claimed: `POST /api/project/replace` puts another app's files in place of the project's (a finished project on the workspace's disk, or one made from a description as `smithable new` makes it), keeps what is installed, and applies the person's name for the app and their address as its administrator. A finished project comes in under the running preview: only the files that differ are written, so the dev server keeps what it has compiled of what every app shares and is not started again (a start is 15 s in a hosted workspace). Its history starts anew. Studio allows it once and only when started with the flag; without it the request is refused, since on a person's own project it would destroy it. The host passes the flag only for a workspace nobody has claimed. For an app from a description the request may be answered at once (`wait: false`): the person is let into Studio while the app is made, and Studio tells its pages where the making is (`making` in `GET /api/project`: drafting, building with the draft's files, coming in; `docs/design/while-it-is-made.md`), refusing every other change until the app is in place.
- **The theme lab** (`smithable theme lab`, `apps/theme-lab`, docs/design/theme-lab.md): a second web app on the same pattern. The CLI makes a sheet app (or takes `--app`), runs its preview with the editor runtime, and serves the lab beside it with two calls (`/api/start`, `/api/save`). The lab runs the engine and the adapter's `themeCss` in the tab and posts each change's CSS to its frames (`smithable:theme-css`, accepted only from the frame's parent on this machine), so making a theme regenerates nothing; Save goes through `addTheme` when a project is given.
- CLI surface: `smithable new | starters | validate | generate | run | op <operation> | undo | customize page:<page> | inspect <concept> | context "<request>" | test | security | build | deploy | backup | restore | upgrade | update | detach | mcp | studio | completion`. `--help` after a command gives that command's help, and `op <name> --help` an operation's arguments from its schema; `completion bash|zsh|fish` completes commands, options, operations and, inside a project, the model, field, page and role names its arguments take, all from one command table and the operation schemas.

## 12. Verification, security, deployment

**Tests** generated from the manifest cover: pages render, standard CRUD works, access rules hold, validation rejects bad input, migrations apply, `/health` responds, and every `examples` entry passes. Unit tests use Vitest and smoke tests use Playwright. Custom logic needs custom tests, and the compiler generates the stubs.

**The generated access layer** (hardened after the 2026-09-28 review): every data function works on the records the viewer may read. A list carries no related records it only adds up (an invoice's lines stay out of the invoice list, since some may not be the viewer's), and a generated test checks it. A search by a related record's name looks only among related records the viewer may read (a data module's `titled`); a referenced record's title is shown with the record that refers to it, and nothing else of it (§3.1). Only a role that may change everyone's records may set another owner (`ownedBy`). An action checks that the viewer may read every record its input names, and passes the viewer to its implementation. Records visitors add without an account (a contact form) have a shorter text limit (2,000 characters), at most 10,000 of them are stored, the contact form has a honeypot field, and the production server limits changes per address (a burst of 60, then one a second), believing `X-Forwarded-For` only behind a proxy that declares itself (`TRUST_PROXY=1`, set by the hosted service) and then only its last hop. Sign-in's own limits (Better Auth's, on in every production build) count by the same address: the auth route puts it in a header of its own, overwriting whatever the visitor sent there (`src/kit/address.server.ts`), and Better Auth reads only that header. A database refusal reaches the page only as a code the form words ("taken:<column>", "in-use", or "in-use:" with the facts of what points to the record, docs/design/delete-together.md); anything else is logged. Served over https (`BETTER_AUTH_URL`), its session cookies are `__Host-` cookies (Secure, Path=/, no Domain), so a sibling app under the same domain cannot set them, whether or not that domain is on the Public Suffix List. In production an app with sign-in does not start without `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.

**How often one may write.** The generated server functions count writes per signed-in person (60 a minute) and per visitor address (10 a minute, for public forms), and invitations per administrator (20 an hour), in memory in the one process the app runs as (`src/kit/limit.ts`); beyond that a change is refused with words the form shows. Sign-in attempts are limited by Better Auth itself (3 per 10 seconds in production). Behind a proxy the address is the rightmost forwarded one, which a client behind one proxy cannot choose.

**Error reports** are opt-in and shown in full before anything leaves. A failed operation is kept (`data/.smithable/last-failure.json`: the operation, its arguments with any long text replaced by its size, the error). A report adds the last 50 log lines, the Smithable and Node versions and the spec files (`smithable*.yml`, the project's themes), with the admins' addresses removed. Never sample or app records, uploads, the database or `src/custom/`, and an import's problems (which quote its values) are not kept. `smithable report` prints it and `--send` sends it; Studio offers "Report this" on a failed change. Hosted, it goes to the service (`SMITHABLE_REPORT_URL`); self-hosted, a prefilled GitHub issue opens (the spec files do not fit in a link, so the issue asks for them). "Always" or "never" is the person's choice, kept in their config (`~/.config/smithable/reports.json`), not the project's. Apart from reports, a hosted workspace sends every failure's record without content (`SMITHABLE_FAILURE_URL`, set by the service): the version, the operation's name, the error's class, message and stack lines, and the request's trace id; never the arguments, the spec files or any record (studio-v3.md §6). Self-hosted nothing is sent.

**Security levels** (external tools are detected, not bundled):

| Level | Checks |
|---|---|
| Fast | typecheck, tests |
| Normal | + dependency audit (OSV-Scanner, and the packages' own advisory lists), secrets (Gitleaks), SAST (Semgrep CE) |
| Release | + container scan (Trivy), DAST (OWASP ZAP) |

**Implemented so far (M14):** `smithable security --level fast|normal|release` runs the table above with pinned tool versions (an installed tool, or its image in Docker): OSV-Scanner v2.6.0, Gitleaks v8.30.1, Semgrep 1.178.0 (p/typescript, p/react), Trivy 0.74.0 (high and critical) and ZAP 2.16.1's baseline scan against the image running on a free port. Findings fail the check and are never suppressed (ZAP's note that ZAP itself is out of date is not about the app). The dependency audit also reads each directly named package's own advisory list on GitHub (`packages/cli/src/advisories.ts`, no tool to install), because the databases list a new hole days after its maintainers publish it: every installed version, dependencies of dependencies from the same repositories too, is held against the lists, read with `GITHUB_TOKEN` when set (without one GitHub answers sixty calls an hour) and kept for an hour. A list that cannot be read is not a pass. An advisory that names a pinned version and does not reach a generated app is listed with its reason in the stack profile (`advisories` in `stack.ts`) and shown at every run instead of failing; one with a fixed version is never listed, the pin moves. The same check runs daily in CI on the stack profile's own pins (`scripts/stack-advisories.mjs`, `.github/workflows/stack-advisories.yml`), and names the pins with a newer patch release. Generated apps run on a distroless Node image, and their production server sends security headers and a Content Security Policy with a per-request nonce, and a cache rule: the build's hashed files (`/assets/`) a year and immutable, pages `no-store`; `pnpm test:apps` checks that production pages carry the headers and that the policy blocks nothing a page needs. A server function answers only the app's own pages (`src/start.ts`: the framework's CSRF middleware on `Sec-Fetch-Site`, and for a browser without it the host of `Origin` or `Referer`), so no other site, and no sibling app under the same domain, can act with a visitor's session; the API and `/mcp` take a key and no session, and are not covered by it. The dev server (`vite.config.ts`) denies the app's `data/` folder, which it would otherwise hand to whoever can reach a preview (`?raw`): the database, the uploads and the outbox with its sign-in codes. `pnpm test:apps` checks both. It also keeps the pentest's attacks as named checks ("security: …"), each one the app must refuse. On the booking app: a script in a visitor's message never runs for the admin who reads it, a Markdown link cannot run code, a search shaped like SQL (or `%`, `_`) is only text, the session cookie is HttpOnly and SameSite, sign-in never redirects to another site, guessing a sign-in code stops after five tries, and no file path climbs out of the pictures. On the status app: a key counts only in the `Authorization` header, a malformed body or call is a 400, 422 or refusal and never a crash or a stack trace, a body cannot set the id, owner or dates, no other site gets a CORS grant, and a condition or search shaped like SQL is only a value through the API and `/mcp`. With Incident public only while investigated, a visitor's tools count, add up, split, find, search and read only that part (nothing of the rest, not its largest number or its ids); a new role reaches a person's open session at once, a session cookie kept after signing out signs nobody in, and a removal ends the open session. Every app with a users page also tests that a role the page does not give, and an API key with the administrator's role, is refused every change to who has access, and that a withdrawn invitation lets nobody in. What the first Release run found: [as-built.md](as-built.md#m14-the-first-release-run).

Deploy and backup targets so far: `smithable deploy --target docker|ssh://user@host|compose` (the Release checks first; the image replaces the running container and keeps its `<app>-data` volume; the session secret is made once and kept in the ignored `data/`; provider keys pass through from the environment), and `smithable backup|restore` with a folder or `s3://bucket/prefix` (a built-in Signature V4 client for S3-compatible storage, credentials from `AWS_*` variables). A backup is a consistent `VACUUM INTO` snapshot plus uploads, from the development database or a container; restoring into a container stops it and fills its volume from a one-off container of the same image, then hands the files to the image's non-root user. `pnpm test:deploy` checks the exit criterion against SeaweedFS, which verifies signatures. Point in time, for a self-hosted app: `smithable backup --continuous --to <folder|s3://…> [--data <dir>]` runs Litestream (installed separately, like the security tools) beside the database, keeping every second for 30 days, and `smithable restore --at <time> --from …` shows what is new, changed and removed since, then with `--bring-back`/`--undo-changes <Model,…> --yes` writes those records back in place (the app stopped), with the same statements as the hosted service (core's `dataDiffSql` and `restoreOrder`) and a copy of the database from just before.

Generated smoke tests: `tests/smoke.spec.ts` and a kit `playwright.config.ts` (the app's dev server on port 3100 with its own `data/smoke` database), run by `pnpm test:smoke`: public pages open for a visitor, protected pages redirect to sign-in, and each role signs in through the development sign-in and opens every page its access allows, failing on any browser error.

Upgrades: `smithable.lock` records the stack profile an app was generated with; `generate` and operations refuse another one and point to `smithable upgrade`, which migrates the spec (§14), regenerates with this Smithable's profile, reinstalls, and keeps the result only when the type check and tests pass. When they fail it shows the errors in `src/custom/` (the contract the app's own code relied on) and undoes everything.

**Deployment contract.** Every generated app produces an OCI image that:

- listens on `PORT` and serves `GET /health`,
- takes its configuration from env vars and logs to stdout/stderr,
- keeps all irreplaceable state under `/data`: `/data/db/app.db`, `/data/uploads/`, `/data/backups/`.

**Deploy and backup targets.** Deployment and backups go through two small interfaces, so self-hosted and paid options are equal peers:

| Interface | Built-in (open source) | Later / paid |
|---|---|---|
| Deploy target | Local Docker, Docker Compose export, remote Docker host over SSH | Smithable Cloud; community targets |
| Backup target | Local directory, any S3-compatible bucket (for example streaming SQLite with Litestream) | Smithable managed backups (EU, verified restores, alerts) |

Credentials for targets live in the user's environment or OS keychain, never in the project files. `smithable backup` and `smithable restore` operate on `/data` and work the same for every target.

The initial targets are local Docker and a Docker Compose export. A future scalable mode (PostgreSQL, S3-compatible storage, multiple instances) keeps the same contract. One-click deploy runs Release-level checks first.

## 13. Smithable's own codebase

Everything is written in TypeScript with a pnpm workspace. Engine packages (`core`, `adapter-tanstack`, `index`) are browser-compatible (§1); the host package (`cli`) uses Node. Start with few packages and split only when a boundary proves itself:

```text
smithable/
  packages/
    core/              manifest schema, parser, validator, IR, operations
    adapter-tanstack/  generator, app kit templates, migrations, index emission
    index/             index build + query API, context builder, plain-language summary
    ai/                providers, routing, policy, prompts
    cli/               the host: CLI, Studio server (the daemon), MCP server, Git and
                       processes, the preview editor plugin (dev only)
  apps/
    studio/            Builder + Studio web app: React + Vite + Tailwind + shadcn/ui
  examples/            one spec per starter (crm, …)
  scripts/             embedding, end-to-end tests, benchmarks
  docs/
```

The daemon, the MCP server and the preview editor plugin live in `cli` until one needs its own release cycle or consumers; splitting them is then a move, not a redesign.

Security scanners, Claude Code, Ollama and Docker are all optional external tools. Smithable detects them and never requires them.

The OSS repo contains only code eligible for publication. The hosted service goes in a separate private repo (`smithable-cloud`), which depends on OSS and never the other way round. That covers accounts, project storage, the AI gateway with allowances, publishing and hosting, managed backups, the remote MCP endpoint and billing.

**Hosting of the beta (M15):** AWS Stockholm (`eu-north-1`), described with OpenTofu in `smithable-cloud/infra`, built only from pieces every EU provider has (a VM, S3-compatible storage, DNS), so moving to Hetzner, Scaleway or OVH is a migration, not a rewrite. The data stays in the EU; AWS being a US company (the CLOUD Act) is the known trade-off, revisited if customers ask for sovereignty. One Graviton host runs the service and published apps as containers behind Caddy (TLS), with S3 for projects and backups, within $50 a month.

**Customer data is stored in the EU:** projects, their databases, published apps, backups and the service's own database are stored and processed only in `eu-north-1`. AI calls go to the models the service has configured, which its list of sub-processors names (in the beta so far, an EU-hosted model); a project or an organization that needs it sets the `eu-only` policy, and then its AI calls stay in the EU as well (§9.5). The only thing outside is Route 53's health check, whose alarm lives in `us-east-1` and sees nothing but whether `/health` answers.

**The AWS-specific ops layer** is kept thin and in `smithable-cloud`: OpenTofu in `infra/`, releases and secrets through SSM, alarms through CloudWatch and SNS, the external health check in Route 53, and S3 lifecycle rules. The service itself needs only Docker, a filesystem and an S3-compatible bucket, which is what makes a move to another EU provider a migration of this layer alone.

## 14. Versions and upgrades

Four things change over time, each on its own track:

| What | Example | How it is upgraded |
|---|---|---|
| **Spec format** | `smithable: 0.1` → `0.2` | Automatic, deterministic spec migrations |
| **Smithable** (engine, generator, kit) | 0.4 → 0.5 | Regenerate the generated and kit zones |
| **Stack profile** (the tested set of framework and library versions) | TanStack Start, React, Drizzle, Better Auth versions | Security patches: update freely. Minor and major upgrades: arrive with a Smithable release |
| **Custom code** | `src/custom/**` | Never rewritten automatically. Typecheck, tests and upgrade notes show what needs attention; AI may propose fixes, confined to custom files |

### 14.1 Everything is recorded

- Every spec file carries its format version (`smithable: 0.1`).
- Every app of a stack profile lists **the same packages**, whatever it uses: the sign-in library, the Markdown formatter and the three fonts are in every `package.json`, and what an app does not import is not in its build. A change to the app therefore never changes what must be installed, so regenerating needs no package registry (a hosted workspace cannot reach one). Only the packages the owner adds for custom code (`packages` in `smithable.context.yml`) and a new stack profile change the list.
- A committed, tool-managed **`smithable.lock`** records the Smithable version, adapter version and stack profile that generated the code. Regeneration with a different version is therefore always explicit, never accidental, and generation stays byte-identical for a given lock.
- Generated apps pin exact dependency versions and commit their package lockfile.

### 14.2 Upgrades are ordinary changes

`smithable upgrade` goes through the normal change pipeline (§8), so it is checkpointed, tested and undoable:

```text
migrate spec format → update smithable.lock → regenerate generated + kit zones
  → update dependencies to the new stack profile → migrate DB if needed
  → typecheck → tests → checkpoint (or roll back and report)
```

- **Spec migrations** are small, versioned, deterministic transforms (like codemods). Before 1.0 the format may change, but every change ships with a migration. After 1.0, breaking changes require a major version.
- **Compatibility starts at the public launch (M16).** Until then there are no users to protect: the format changes in place (it stays `0.1`), and examples, drafts and docs are updated directly, without migrations. From the launch on, every format change bumps the version and ships a migration.
- **Branches.** Breaking changes land on `main` with a version bump and a migration, never on a long-lived branch. Development uses short-lived branches once there is CI; release branches (e.g. `release/1.x`) only exist to patch versions users still run.
- **Custom code is protected by contracts.** If a regenerated contract changes, affected custom files fail typecheck and the upgrade report lists them. Nothing in `src/custom/` is edited without the user confirming.
- **Security patches of dependencies** (within the stack profile) need no regeneration. `smithable update --security` applies them, and the usual tests run. Each stack profile's allowed patch ranges come from the Smithable release that defined it.
- **Stack profiles** are released on a steady cadence (for example quarterly). Each is tested against all sample apps before release.

### 14.3 Hosted and detached apps

- **Hosted apps** are rebuilt and redeployed automatically when a security patch or base-image update is available, but only if the tests pass. Otherwise the owner is notified. Smithable upgrades are offered to the owner, never forced. As built (M15): every Sunday the service runs `smithable update --security` on each published project (kept only when the Normal checks pass: the workspace image carries the pinned OSV-Scanner, Gitleaks and Semgrep, so no Docker is needed), and publishes it again, with its tests, when that changed something or the base image has a newer version; a failure leaves the running version alone and is shown on the project's page. A project open in Studio waits for the next run. Notifying owners by email comes with the email sign-in.
- **Self-hosted apps** run `smithable upgrade` or `smithable update --security`, then rebuild the container.
- **Detached apps** are ordinary projects and use normal dependency management (for example Renovate or Dependabot).

## 15. Open questions

| Question | Current leaning |
|---|---|
| **Auth library** | Decided in M5: Better Auth (§3.1). Still to confirm with real Google and Facebook accounts before the hosted beta |
| **Preview in the browser** | Decided in M8: Remote VM for now (§10.2). WebContainers once `AsyncLocalStorage` works across `await` there (stackblitz/webcontainer-core#1169); then ask StackBlitz about production licensing |
| **Database escape hatch.** Where do indexes, constraints or column types the spec cannot express go? | A user-owned `src/custom/db/schema.ts` whose tables and indexes are merged with the generated schema |
| **Translations** | Decided (2026-10-15, [design/languages.md](design/languages.md)): `languages` in the spec and a `smithable.content.<language>.yml` per language. A language's texts are keyed by the main text (gettext's model): core's `translationMap` makes `src/generated/` hold them, the kit's `tx(text)` looks one up in the request's language, and a translated app's labels and titles are `tx` getters, so an app in one language is generated as before. Public pages carry the language in the path (`/sv/…`, taken off and put back by the router's `rewrite`, with hreflang alternates, `<html lang>`, the sitemap per language and a switch at the page foot); signed-in pages take it from the switch's cookie, else the person's own (a `language` on the kit's `user` table, set by the switch and by signing up from a page in a language; a new browser of theirs gets it as its cookie). A request middleware runs each request in its page's language (`AsyncLocalStorage`); a mail to a user is written in theirs (`speaking`), one to an address that is no one's in the page's. Studio's Languages tab shows each text beside its words in a language, the empty ones marked, and saves them with `setText`. A language's empty texts get a first draft from the configured model (`smithable translate <language>`, the tab's button): one request, saved with `setTexts` as one change that undo takes back |
| **Teams and workspaces** | Later. Records get a group next to their owner, enforced in the same access layer (§3.1) |
| **Re-adopting a detached app** | Not supported initially. It would need the deferred project import |
| **`smithable.ux.yml` vocabulary** | Start minimal (density, column order/visibility, field order, groups) and grow only via §2.4 |
| **Manifest size.** One file or many for large apps? | One file until it hurts, then allow `models/*.yml` includes |
| **Existing project import / compatibility levels** | Deferred. Revisit after the public release |
| **License** | Apache-2.0 for engine, tools and spec; 0BSD for app kit and templates |
| **Preview vs production SQLite** | WebAssembly driver in the preview, native SQLite in production. Verify that behaviour matches (M8) |
| **Hosted project storage** | Projects saved server-side as Git repositories, synced from the browser. Decide in M8 |
| **Other kinds of apps** (desktop, iOS, CLI tools, pipelines…), possibly community-made types in a Git repository stating their grammar, meaning, operations, generators and stack | A different platform for the same app is a new adapter with mostly the same spec (§5); a different kind of thing is a bundle of plugins plus an adapter (§5.1). Community types would be pinned by commit and hash, and their generators (pure functions) sandboxed. Web apps stay the one product until the launch; the order is the public plugin API, a second adapter, then types |
| **In-browser local model (WebGPU)** | Possible later for small intent tasks. Model download size is the obstacle |
