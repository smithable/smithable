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

v0.1 covers: `app`, `models` (fields, relations, formulas), `access` exceptions, `actions`, `queries`, `pages`, `navigation`, `jobs`. Integrations and external endpoints come later. Roles, access defaults and everything public are defined in `smithable.auth.yml`. Presentation lives in `smithable.ux.yml` and visible text in `smithable.content.yml` (§3).

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
    access:                                # only exceptions to the defaults (§3.1)
      write: [sales]
      delete: [admin]

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

- A JSON Schema for the manifest is published and used for validation, editor autocomplete and operation validation.
- Validation errors carry file, line and column positions.
- Hand edits are first-class: users may edit `smithable.yml` directly, and Smithable validates and recompiles on save.
- Programmatic writes preserve comments, ordering and formatting (CST-level YAML editing).
- Splitting the manifest across several files for large apps is an open question (§15).
- **Why YAML, not a TypeScript config?** The spec must be edited by deterministic operations, read by non-developers and small models, and stay technology-neutral. See [research/wasp.md](research/wasp.md) for the lessons from a predecessor that went the other way.
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
  admin: { description: Full access, manages users. }
  member: { description: A regular user. }
defaultRole: member
admins: [owner@acme.com]           # bootstrap: these get admin on first sign-in
user:
  fields:                          # extra profile fields, same syntax as models
    displayName: string!

# ⚠ PUBLIC: everything listed here is visible to anyone on the internet, without
# signing in. Never add models that contain personal or business data.
public:
  pages: [home]                    # sign-in pages are always public
  read: [Product]
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

- **Only exceptions are written down.** An `access:` entry in `smithable.yml` on a model, page or action replaces the default for the operations it lists, for example `access: { write: [sales], delete: [admin] }`. Admins can always do everything.
- **Pages** require sign-in by default. Public pages are listed in the `public` section; admin-only pages say `access: [admin]`.
- **Standard actions** follow the model's write access. Custom actions default to signed-in users, and `allow:` narrows that.
- **Without sign-in** (`signIn: none`), only what the `public` section lists is reachable at all.
- **Warnings, not hidden behaviour.** The validator warns about risky combinations but never changes the meaning. Examples: `shared` together with `selfSignUp: true` ("anyone who creates an account can read all data"), and public read access to a model with personal-data fields such as `email` or `phone`.
- The Builder's plain-language view shows the **effective** access of every model and page, so nobody has to combine the two files in their head.

#### Enforcement

All access checks go through **one generated access layer** in the app kit. Every generated query and write is filtered by it, including row-level filtering by owner. Custom code receives the same access-checked data functions by default, and bypassing them requires an explicit, reviewable call. Generated tests prove the effective access for every model and role.

Concretely: `src/kit/access.ts` holds the rule type and the checks (`allows`, `readScope`, `guardPage`). Each model gets a server-only `src/generated/<model>.server.ts` with its effective rules (computed by `modelAccess` in core, so validation, generation and tests share one definition) and data functions that take the signed-in user: `list` and `get` filter by owner where needed, `create`, `update` and `remove` check the rule and the record's owner, and references to records the user cannot read are refused. The server functions the pages call are thin wrappers that pass `currentViewer()`. Pages check their rule in `beforeLoad`; menus and buttons hide what the user may not do, but the server is what enforces it. With `private` access, `unique` becomes unique per owner. `src/generated/access.test.ts` exercises every model for every role and for visitors: reading, creating, changing and deleting their own and others' records.

Teams are not in v0.1, but the design leaves room for them. Records will later get a **group** (team or workspace) next to their owner, and existing apps migrate by putting each user's records into a personal default group. Because access is enforced in one layer, adding groups changes one place.

#### Sign-in

- **Google is the default sign-in method.** Facebook, Microsoft, GitHub and Apple are secondary options in the same `providers` list. Email/password and magic links exist but are never the default.
- **It is implemented with a mainstream auth library as an ordinary dependency: Better Auth** (self-hosted, with a Drizzle adapter, SQLite support, social providers and an official TanStack Start integration). Sign-in is the one place where a well-maintained library beats generated code. The generated `src/lib/auth.ts` is its ordinary configuration: providers whose keys are in the environment, the Drizzle tables (generated into `src/db/schema.ts` as Better Auth's CLI would), a `role` field, and a sign-up hook for `allowedDomains` and the `admins` bootstrap.
- **OAuth client IDs and secrets live in environment variables**, never in YAML. Smithable provides a setup checklist per provider, including the exact redirect URLs.
- **Dev sign-in.** In development and in the Studio preview, a dev-only sign-in lets you act as any role without contacting Google. This keeps offline development and role testing possible. It uses Better Auth's email sign-in for one development user per role, and email sign-in is enabled only when `import.meta.env.DEV` is true, so production builds refuse it; `pnpm test:apps` verifies that against the production build.
- **Not in v0.1:** `selfSignUp: false` (invitations need user management) and extra `user` fields; both are reported as "not available yet". `allowedDomains` covers the common internal-tool case.
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
- **Implemented so far (M10):** `theme` (preset, brand colour and font, density), per page `icon`, `table.columns`, `table.below` (a second field under a column) and `form.fieldOrder`, and `tones` for choice values (success, warning, danger; shown as the badge colour), with `setTheme`, `setColumns`, `setFieldOrder`, `setTone`, `setIcon` and `setBelow` (a page without an icon gets one suggested by its model's name); renaming or removing a field updates it, as it does `smithable.content.yml`. The adapter generates `src/theme.css` from the delivered design system ([design/delivery/](design/delivery/README.md)): each preset's shadcn/ui colour tokens in OKLCH for light and dark (`theme-presets.ts`, copied from its `themes.css`), its font, radius and card shadow, and the density's control height, row height and padding, which the kit uses as Tailwind utilities (`h-control`, `h-row`, `px-cell`, `p-card`; touch screens always get 44 px controls). A brand colour goes through the delivered brand-input rules (`brand.ts`: it replaces primary, ring, accent and chart-1, capped in chroma per preset and moved in lightness until text on it has at least 4.5:1), tested against the design's 24 worked examples. Fonts (Inter, Nunito Sans, Source Sans 3) are self-hosted Fontsource packages (OFL) added to the app's `package.json`; the kit's icons are lucide-react, as in shadcn/ui. The shell is a sidebar from 1024 px and, below that, a header whose menu opens the same navigation in a native modal `<dialog>` (focus trap, Escape and focus return come from the browser); below 768 px tables become record cards (name, contact, status, key amount). A related record is chosen in a searchable combobox (the WAI-ARIA pattern: type to filter, arrow keys, Enter, Escape), and deleting asks in a native modal `<dialog>` that names the record and starts on Cancel. `pnpm test:apps` checks every example's theme for contrast (axe-core, WCAG 2 AA) in light and dark, on desktop and a phone.
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
  policy: eu-only          # local-only | eu-only | best-available | custom
```

It has structured fields where possible and one free-text `guidance` field for implementation preferences. It never contains functional requirements. As built (M15), `packages` names libraries for custom code at exact versions (`packages: { chart.js: 4.4.1 }`, or the `setPackage` operation, so hosted projects and the AI coder can add one without a terminal); the generator adds them to `package.json`, and the stack profile's own packages are refused.

## 4. Semantic operations

The **only** way to change application semantics programmatically.

- Each operation (`addModel`, `addField`, `changeField`, `renameField`, `removeField`, `addRelation`, `addPage`, `setAccess`, `addAction`, `addExample`, …) has a JSON Schema for its arguments. The same schema is used for CLI parsing, Studio forms and constrained AI output.
- An operation is a pure function `manifest → manifest` plus validation. Side effects (regeneration, migration) follow from the changed manifest, not from the operation itself.
- Applied operations are appended to an **operation log** (`.smithable/oplog.jsonl`, committed). Operations also report **effects**, such as a rename, so the migration step can rename a column instead of dropping and re-adding it.
- **Edits preserve formatting.** Operations never re-serialize a file: a source editor splices text at the positions the YAML parser reports, so comments, alignment, flow style and blank lines outside the edited entry stay byte-for-byte identical. After every edit the result is re-parsed, and the operation is refused if the spec or content file would become invalid.
- Each operation is registered by the spec section it belongs to (models, pages, navigation), as part of the internal plugin interface (§5.1).
- Batches of operations are atomic: they all apply, or none do.

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

### 5.1 Plugins

Smithable is extensible through **plugins**: npm packages, or folders inside a project (`smithable/plugins/<name>/`). A plugin can contribute:

- **Spec keys** with their own JSON Schema. Validation, autocomplete and the plain-language view work for them like for built-in keys. Every key belongs to exactly one plugin, and a plugin declares where its keys may appear (top level, on models, on pages, …).
- **Operations.** CLI commands, MCP tools and AI-usable actions are all derived from operations, so a plugin's operations appear in all of them automatically.
- **A generator** that writes code into the app. The app-independence rule applies: generated apps must not depend on the plugin at runtime. Ordinary libraries the generated code uses (for example a payment provider's SDK) are fine.
- **Extras:** additional CLI commands and MCP tools, a plain-language description for the Builder, and context for AI.

Plugins are declared in `smithable.context.yml`, since they are an implementation choice.

**Built-in features are internal plugins.** Models, fields, pages, access, formulas and jobs each register their schema, operations and generator through the same internal interface from the start (M1). That keeps the core honest, and makes the eventual public plugin API "publish what we already use" rather than a retrofit.

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

Next to it, each model's module in `src/generated/` describes what the database does not know: labels, semantic kinds (`email`, `phone`, `money`), the fields shown in tables and forms, and computed fields. These field lists are explicit code, so a column added to the Drizzle schema by hand is stored and validated but appears in the UI only once it is added to the model's list, like any other hand-written change.

### 6.3 The app kit

The **app kit** is a set of generic, reusable source files that the adapter writes into generated apps, in `src/kit/`. It contains data components (`ModelTable`, `ModelForm`, `ModelDetail`), generic CRUD server functions, access checks, page-pattern sections and the theme (§10.4). The pattern is the same as shadcn/ui, where components are copied into your repo instead of installed. The kit lets pages stay short without a Smithable package.

Rules that keep the kit "normal":

- **Only what is used.** The adapter copies in only the kit parts the spec actually uses, so a simple app gets a small kit. Each part has a size budget, and growth needs a justification.
- **No magic.** Typed props only. No string-based lookups, no global registries, no runtime code generation.
- **Readable.** Each file opens with a short comment explaining what it does and how to customise it.
- **Copyable.** When a generic component is not enough, copy it into `src/custom/components/` and edit the copy.

Generated pages are short, explicit compositions:

```tsx
function CustomersPage() {
  return <ModelTable table={customers} ui={ui.Customer} search={["name", "email"]} />
}
```

### 6.4 Ownership zones

| Zone | Examples | Owner | Regeneration |
|---|---|---|---|
| **Generated** | `src/db/schema.ts`, `src/generated/**`, generated routes, nav | Compiler | Overwritten freely. Files carry a one-line header marking them as generated |
| **Kit** | `src/kit/**` | Compiler | Updated when the Smithable version changes |
| **Custom** | `src/custom/**` (actions, queries, pages, jobs, components, auth) | User / AI | **Never overwritten.** The compiler creates a typed stub once, then leaves the file alone |
| **Migrations** | `drizzle/**` | Compiler writes them, then history owns them | Never rewritten after creation |
| **Scaffold** | `pnpm-workspace.yaml`, `.gitignore`, `.dockerignore`, `CLAUDE.md`, `.mcp.json` | Created once, then the project and its tools | Never rewritten; tools like pnpm legitimately edit them |

Custom code is linked to the manifest by convention: `actions.calculateShipping` with `custom: true` corresponds to `src/custom/actions/calculateShipping.ts`, and a page with its own component (`smithable customize page:customers`) to `src/custom/pages/customers.tsx`. A custom page replaces only the page's component: the generated route keeps loading data, search and access checks, and the component reads the route's data through TanStack's `getRouteApi`, so the loader's types are its contract. The compiler generates the typed input/output contract into `src/generated/`, so if the manifest's signature changes, the custom file fails typechecking. That turns drift into a compile error instead of a silent bug.

Custom files may import anything from `generated/` and `kit/`. Generated code imports custom code only at the declared hook points.

### 6.5 Drift detection

The compiler records a hash of every file it owns in `.smithable/`. If someone edits a compiler-owned file by hand, Smithable reports drift and offers two choices: **revert**, or **move the change into a custom file or the manifest**. It never silently overwrites a manual edit. For a page's list route, `smithable customize page:<page>` moves the edit: when the edit only touched the component, the edited component becomes the custom page and the route is generated again; when it changed loading or access, it explains why the edit cannot move. `generate` suggests this when it finds such an edit. (In the M7 benchmark, one hand-edited route blocked every later operation.)

Missing custom implementations (a manifest says `custom: true` but the file or export is missing) are also reported as drift.

### 6.6 Migrations

Migrations are written in **drizzle-kit's own format, including its snapshot metadata**, so `drizzle-kit generate` continues seamlessly after a detach. The adapter computes them from the difference between the old and new IR, and uses the operation log to tell a rename from a drop followed by an add. Without Smithable, drizzle-kit's own interactive rename prompts take over. Destructive migrations (removing a column or table) require explicit confirmation.

### 6.7 Conventions of the TanStack adapter

Concrete choices the v1 adapter makes; they are ordinary, documented practice for the stack.

- **SQLite through `better-sqlite3` 12.x** on stable Drizzle. It ships prebuilt binaries, so neither developers nor the container build need a compiler; 13.x dropped them and always compiles from source. Switching to Node's built-in `node:sqlite` is planned once Drizzle 1.0 (which supports it) is stable.
- **Money is stored as whole cents** in integer columns, so amounts never suffer floating-point rounding; the kit converts for display and input. Datetimes are millisecond timestamps, dates are `YYYY-MM-DD` text, choices are text columns with an enum.
- **Migrations are created by the app's own `drizzle-kit generate`** after the schema file is written, and **applied at startup**, which suits a single SQLite instance. Data lives under `DATA_DIR` (`data/` in development, `/data` in the container).
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
- **Checkpoints use Git.** An operation requires a clean working tree, so it can be undone on its own. Each applied operation becomes one commit (`smithable: <description>`) containing the spec change, regenerated code and migration. Undo reverts the most recent operation that is not undone yet, as a new commit, so an undo can itself be undone. The diff is always viewable.
- **Data comes back too.** Before migrating, the dev database is copied with SQLite's `VACUUM INTO` to `data/.smithable/snapshots/` (ignored by Git, like the rest of `data/`), and the commit records which snapshot belongs to it. Undo restores it.
- **Migrations never ask.** Renames become a custom migration with `RENAME COLUMN` (and the schema snapshot is updated to match), so drizzle-kit never has to ask whether a dropped and an added column were a rename. Other changes use drizzle-kit's normal generation. The migration is applied to the dev database immediately.
- **Destructive changes need confirmation** (`--yes` on the CLI) and say what they affect, e.g. "this deletes the phone column; 8 of 8 customers have a value for it". Making a field required is refused while rows have no value for it.

## 9. AI layer

### 9.1 What AI is allowed to produce

1. **Operations.** Structured output constrained to the operation JSON Schemas (grammar or JSON-schema constrained decoding). This is the common case.
2. **Manifest free text.** Proposed `description`, `intent`, `rules` or `examples`.
3. **Custom code.** Edits restricted to the custom files of specific concepts, with the generated contract as the interface. When AI implements a rule, it must also write a test that names the rule, so the rule can reach **Implemented and tested** (§2.3).

AI never edits generated or kit files.

### 9.2 Routing

| Tier | Handler | Example |
|---|---|---|
| 0 | Generators: explicit operations (UI controls, CLI) and simple pattern rules | The "required" toggle |
| 1 | Local model, where available (CLI, self-hosted; possibly in-browser later) → operations | "Customers need a mobile number" |
| 2 | **Smithable model**: a small open model hosted in the EU → operations, pattern and theme choices | The same, for hosted users; "make it feel friendlier" |
| 3 | Frontier model (via EU providers where possible, or the user's own API or Claude Code) | Custom action logic, new custom components |

For hosted users, who have no local model, tier 2 is the main AI tier. It starts as an off-the-shelf open model on an EU provider's hosted endpoint (for example Mistral, Scaleway or OVH), and is fine-tuned later once curated and consented data exists. Because every tier speaks the same operation schemas, swapping the model behind a tier never changes the product.

The system escalates only when the lower tier is unavailable, fails validation, returns no valid operation, or the task needs custom code.

### 9.3 Context construction

Before any model runs, simple fuzzy and embedding matching over the manifest shortlists the likely concepts, so even a 1–3B local model only chooses among a few candidates. A **context builder** then assembles the smallest useful slice from the manifest, the index and (only for custom code) the relevant source files: the request, the relevant concepts with their free text, available operations, and the implementation slice needed for that tier. Every tier gets the same semantic slice; escalating a tier never means adding unrelated project data.

The context builder is `buildContext` in `@smithable/index`; `smithable context "<request>"` shows the slice a model would get. Shortlisting is deterministic word matching for now (names weigh most, weak matches are cut); embeddings come with Smithable's own AI (M12). Token counts are estimates (about four characters per token), good enough to compare contexts and budgets; each context and MCP call is logged to `data/.smithable/token-log.jsonl`.

For each AI call, record (locally) the semantic-context tokens, implementation-context tokens, model, tier, operation type and whether escalation happened. Project content is never collected for analytics without explicit permission.

### 9.4 Confirmation over self-reported confidence

Models are poor judges of their own confidence, so Smithable does not rely on self-reported scores. Instead:

- Proposed operations are shown in readable form ("Add field `mobilePhone` (phone) to Customer") before they apply. The user can enable auto-apply for non-destructive operations.
- If the model returns several candidate interpretations, or none validate, Smithable asks the user or escalates.
- Low-certainty inference never mutates the app silently.

### 9.5 Providers and policy

- Provider interface with implementations for: **OpenAI-compatible** (covers Ollama, llama.cpp, vLLM, Mistral and most EU hosts), **Anthropic API**, and **Claude Code CLI** (spawned headless, confined to the project directory; Smithable never reads or copies its credentials).
- **Policy** (`local-only`, `eu-only`, `best-available`, `custom` allowlist) is enforced centrally in the provider layer, not by each caller. An organization can pin the policy.
- Local models: use an existing small open model with optional download; never bundle weights. The Smithable model (tier 2) is later fine-tuned on (request, semantic context, accepted operation) triples from curated, synthetic or consented data, and may be published as open weights for local use.

- **Implemented so far (M12):** `@smithable/ai` (an engine package: runs in the browser and Node, I/O only through `fetch`) with the provider interface, an OpenAI-compatible provider, the policy (`route` orders allowed providers cheapest tier first) and `proposeChange`. It sends the semantic slice from `buildContext` plus each operation's argument signature, asks for JSON constrained to an answer schema (operations, a question, or "none"), dry-runs the operations with `applyOperation`, gives the model one repair attempt with the error, then escalates. `smithable ask` shows the proposal and applies it after confirmation through `runOperation`. Studio's Describe tab (and an edit of "Your app") applies a proposal at once when it loses no data, since Undo (or Ctrl+Z) takes it back, and says what it did; a proposal that deletes data is shown first and waits for Apply, and each of its steps whose Manual form can hold all its values can open there, filled in, to be adjusted by hand; each commit carries a `Smithable-AI` trailer (tier, model, tokens, cost) that the change trace reads. Providers come from environment variables ([ai.md](ai.md)); the Claude Code provider (in the CLI, since it starts a process) runs `claude -p` with no tools, no MCP servers and an empty working directory, and reports its cost in dollars (usage carries a currency). Tests use a scripted stand-in model over HTTP (`scripts/fake-model.mjs`). Starting from a sentence (§9.8): `closestStarter` picks the starter by shared words, `draftProject` has the strongest allowed model adapt its spec files (guided by the spec's JSON Schema) and validates them with `checkSpecFiles`, sending errors back once; `smithable new --describe` shows the summary and creates the app after confirmation. Still to do: embeddings for shortlisting.
- **Implemented so far (M13):** custom queries (`queries:` in the spec, a generated result type, a one-time stub in `src/custom/queries/` that returns every readable record, dashboard tiles with `query:`), and a coder for custom code: `smithable code <concept>` or `smithable ask` after a proposal that adds a query. The coder (Claude Code headless, allowed to edit only `src/custom/**` and to run the type check and tests; or any command) is not trusted: Smithable lists every changed file with `git status -uall`, undoes everything if one is outside `src/custom/`, then requires the type check and tests to pass, and commits with the usage trailer. Claude Code runs with `--permission-mode dontAsk` (only pre-approved actions) and path-scoped rules for reading too (`Read(./**)`); in testing, `acceptEdits` let it write outside its area, and plain `Read` let it read the Smithable repository, so the host's own check stays the real guard.
- **Implemented so far (M13, Teach Smithable):** project plugins as in §5.1, in their simplest form: `smithable/plugins/<key>/plugin.mjs` (one ES module, loaded by the CLI with `require`, passed to `validateSpec`, `applyOperation` and `generateApp`), declared in `smithable.context.yml`. `expand` merges ordinary spec into the document before the sections parse (so every built-in generator, migration and access rule applies), and `generate` may write only `src/generated/plugins/<key>/**`. `smithable teach <key>` runs the checked coder with that folder as its area and `smithable validate --plugin <key>` as its one extra command. Studio's engine in the tab loads the same modules: Studio's server lists the declared plugins in the project it sends and serves each one at `/api/plugins/<key>.mjs`, and the tab imports them (keyed by their modification time, so a changed plugin loads again) before it validates anything. Not yet: plugin operations and summaries; long-running processes keep the plugin version they loaded first.

### 9.6 External agents via MCP

Smithable ships a local **MCP server** (`smithable mcp`). MCP (Model Context Protocol) is an open standard that most AI coding tools support: Claude Code, Cursor, VS Code, Codex and many local-model clients.

- **What it is.** A subcommand of the open-source CLI. The user's agent starts it as a local process and talks to it over stdin/stdout. There is no network service, no account and no cost.
- **Tools exposed.** The semantic operations (`smithable_add_field`, …), `smithable_context` (the context builder, §9.3: where agents start), `inspect`, `validate`, `test` and `undo`. Tool schemas are the operation JSON Schemas, so there is one definition for the CLI, Studio, the internal AI and external agents. A destructive operation is refused with its data impact until it is called again with `confirm: true`, which the agent should only do after asking the user. `detach` is deliberately not a tool: leaving Smithable is the user's decision, not an agent's. The server's instructions tell agents to change the app through the tools and never edit generated files; child processes write to stderr, since stdout carries the protocol. Every tool call's input and output size is logged to the token log (§9.3).
- **Why.** Any agent can change the app through operations instead of reading and editing the repository. This delivers the low-token benefit before Studio exists, and it works with whatever model the user already pays for.
- **Agent guidance.** Every generated app includes an `AGENTS.md` (kit zone, updated with Smithable) explaining the ownership zones, where custom code goes, and to prefer Smithable tools over file edits, plus a `CLAUDE.md` pointer and a `.mcp.json` registering `smithable mcp` (both scaffold: the project's once created). `smithable detach` removes them.
- The operation pipeline (§8) applies unchanged: validation, checkpoints, tests and undo.
- The hosted service offers a **remote MCP endpoint** with the same tools, so Claude.ai, ChatGPT and other agents can work on hosted projects. The local server never depends on it.
- **Over HTTP (M15).** `smithable studio` also serves the tools at `/mcp` (the SDK's Streamable HTTP transport, stateless), and a tool call refreshes the open Studio, so an agent's changes appear there as they happen. The hosted endpoint is this, behind the service with a per-project token. On this machine Studio answers only requests addressed to `localhost` or `127.0.0.1`, so a web page cannot reach its API or `/mcp` through DNS rebinding.

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

**As built for the beta (M15):** the hosted runtime puts the whole host side in the workspace, not only the preview: one container per project runs `smithable studio --host 0.0.0.0 --preview-url <public address>` on the project's own volume, so operations, Git history, undo, database snapshots, migrations and the preview are exactly the local product's (the engine still runs in the tab for summaries and validation). Operations in the tab would need all of that rebuilt for the browser first; they stay the direction once WebContainers or a browser Git and database are good enough. Workspaces run under gVisor with memory and process caps, start on demand and stop when idle. The service gives each project two addresses, `s-<id>` (Studio) and `p-<id>` (preview), each with its own host-only session obtained through a short signed grant from the service's domain, so no cookie is shared with project code.

**Publishing and data in the hosted beta (M15):** publishing checks the project's committed state (type check, tests) and builds it in a gVisor sandbox, then assembles the image with a runtime-only Dockerfile of `COPY` lines, so no project code runs outside a sandbox. `node_modules` is the first layer after the base image, so apps with the same dependencies share it. Apps run under gVisor with memory, CPU and process caps and their own data volume, on `a-<id>.<domain>` or the tester's own domain (an A record to the service; the certificate is made on the first visit), sleep when idle and wake on the next request. Backups: a project's directory with its Git history and a `VACUUM INTO` copy of its development database when its workspace stops; an app's data when it sleeps and nightly; the service's own database hourly; all to a versioned S3 bucket, with a tested restore for each. Containers never get the host's cloud credentials (metadata hop limit 1 and a firewall rule): the host copies backups to S3, and the model key reaches only the service's AI gateway, which gives each workspace a project token, meters its cost against the owner's monthly allowance and calls the EU-hosted model. Dependencies are prepared by content: projects whose dependency files hash the same (a few variants per stack profile) share one installed copy, made once in the sandbox as an ordinary project at `/opt/deps` (with pnpm's store and metadata cache, so pnpm's supply-chain check needs no registry) and kept as an image layer; each workspace gets its own copy-on-write view, so nothing is shared writably. A matching project uses `/opt/deps/node_modules/.pnpm` as its virtual store: its own `node_modules` is about 10 MB of links, and a package's usual lookups up the directory tree reach `/opt/deps/node_modules`, which has the same direct dependencies. A project whose dependencies differ gets a normal install. The starters' sets are prepared at each release. On AWS a new project's Studio opens in 13 s instead of about 30, and its preview in 27 s instead of 41. pnpm's global virtual store was tried and dropped: its stricter layout hides packages that TypeScript and some tools find only through hoisting, so a fresh app failed its type check. Smithable also runs the app's tools from `node_modules/.bin` rather than through `pnpm exec`, which costs 1.5 s per call in a sandbox. A warm pool keeps one workspace per starter waiting, created with its final project id (so its addresses, AI token and certificates are right in advance), Studio started and the preview warmed; a new app from a starter, or the public demo, claims it, the owner's name goes into its Git settings, and the pool refills in the background. A new app then opens Studio in 1.3 s and its preview in 1.8 s. Waiting workspaces are never stopped as idle nor backed up, and each release replaces them. The migration for an operation's schema change is made in Smithable's own process with the app's own drizzle-kit through its programmatic API (the same SQL and snapshot as its command line, which a test compares; the same files, so drizzle-kit carries on after detach and finds nothing to migrate), with the command line as the fallback; the operation pipeline is asynchronous for it. An operation runs only the tools its change needs: the install only when packages changed, drizzle-kit and the migration only when the schema changed, and the migration is applied in Studio's own process with the app's own Drizzle and SQLite driver (0.3 s instead of 1.9 s for a separate process). Hosted, a field change then takes about 5 s and an access change 3.7 s (both 6 to 8 s before). The route tree is also written in-process, with the app's own router generator (what `tsr generate` runs), in well under 0.1 s. Why skipping it had broken the preview turned out to be timing: when an operation finished quickly, Studio reloaded the preview while TanStack Start was still rebuilding, and that request hung; the separate processes had hidden the race. Studio now answers the operation at once and reloads the preview a moment later, once the preview editor plugin's `/__smithable/settled` says the dev server's watcher is quiet. The migration imports the app's schema with Node's own type stripping and a fresh query string, so drizzle-orm stays loaded between operations (milliseconds instead of a quarter of a second, seconds in a sandbox), and Studio loads the operation tools in the background as soon as it starts, so a pool workspace has them ready before anyone claims it. Measured on the beta (2026-09-28, a new CRM from the pool): the first field change 2.4 s, an access change 1.3 s, the next field change 1.4 s (9.1, 4.3 and 7.5 s that morning).

**Staging and the demo (M15):** a published app has two environments, live and staging, each with its own container, data volume and address; promoting puts the exact image checked on staging live, keeping the live data. The public demo gives a visitor without an account a guest user and a starter project in an ordinary workspace, limited in number, per visitor, in AI allowance and in time; publishing, sharing and agents are refused, and when the time is up the workspace, its volume and every record go, and nothing of it is ever backed up.

The M8 spike ([research/webcontainers.md](research/webcontainers.md)) ran the generated CRM in a WebContainer: installs, the Vite dev server and WebAssembly SQLite work, and an operation reaches the preview in about 3 s. But WebContainers lose `AsyncLocalStorage` across `await` (an open upstream issue), which TanStack Start and Better Auth depend on, so sign-in cannot work there. WebContainers are revisited when that is fixed; they would move preview cost to near zero.

### 10.3 Visual selection

- The app runs in an **iframe** preview.
- **Instrumentation is dev-only, and the app does not depend on it.** Every preview runtime starts the app's Vite dev server with a wrapper config that extends the app's own `vite.config` and adds the Smithable plugin. The plugin tags rendered elements with concept IDs and injects a small editor runtime that talks to the UI via `postMessage`. Production builds use the app's plain config, so they contain nothing from Smithable.
- Selecting an element resolves to a concept (`field:Customer.phone`) and shows the operations that apply to it ("required", "rename", "move", "hide from table"), plus a prompt box scoped to that concept.
- **As built (M11):** the kit's form fields and table columns carry `data-sm-concept` markers only when `import.meta.env.DEV` is true. `smithable studio` starts the preview with a wrapper config in `data/.smithable/` that merges the app's own `vite.config.ts` with the `smithable-editor` plugin (serve only), which injects the runtime from the router module. In select mode the runtime outlines what is under the pointer, reports a click (concept, and for a column its table's columns) to Studio, and turns column headers into drag handles whose drop reports the new order (`setColumns`). Studio's context panel offers required, rename, remove and hide-from-table for a selected field. `pnpm test:apps` checks that production builds contain no markers.
- **Pictures (first step of company websites):** a hero may have `image: { src, alt }` in `smithable.content.yml`; the file lives in the app's `public/images/`, which generation never touches, and `alt` is required. Starters carry their pictures in `examples/<starter>/public/` (embedded with the starter; every app from it gets them). The Booking and Invoicing heroes use images generated once for Smithable (OpenAI's terms assign them to us; no attribution needed). Landing pages also have a contact section (details, a map link rather than an embedded map, so no third party is called when the page opens, and optionally a model's form visitors send without an account, checked against `public.create`), a gallery (pictures in a grid that open in a lightbox on the browser's own `<dialog>`, with the arrow keys and Escape), and a footer of their own; the kit's code is written for Smithable, informed by the MIT block libraries in the research (no code copied, so no notices needed yet). Next: pictures for feature items, uploading and replacing a picture from the preview, and a searchable library.
- **Texts are changed in place (M15):** the kit marks page titles, subtitles and form labels with their place in `smithable.content.yml` (`data-sm-text`, development only); in select mode, clicking one makes it editable, and Enter (or leaving it) saves it through the `setText` operation, which sets, adds or (with an empty text) removes one text at a path, checked by the content file's own validation. A landing page's sections are marked the same way (a section's title, text or subtitle, and button, under `pages.<page>.<section>`), and so are the texts of their list items by position (`pages.home.faq.items.1.question`, or `…pricing.items.0.features.2` for one of a plan's features). An item's text can be changed but not removed, and `setText` never adds list items: new features, plans or questions are added in the content file.
- **Semantic edits** (fields, pages, access) go through operations on `smithable.yml`. **Presentation edits** (theme, ordering, visibility, density, grouping, sections) go through operations on `smithable.ux.yml`, and **text edits** (click a headline or label and retype it) on `smithable.content.yml`. Anything finer is a custom component.

### 10.4 Design system

Design quality comes from crafted templates, not AI improvisation. AI (even a small model) only *chooses* among them.

- **Themes.** A few carefully tuned presets (for example `modern`, `minimal`, `playful`, `corporate`): palette, typography, spacing, radius, dark mode. **Brand input** (a primary colour, a font, a mood) deterministically derives a custom theme from a preset.
- **Page patterns** beyond data screens: landing pages built from sections (hero, features, pricing, testimonials, FAQ, call to action), dashboards (stat cards, charts), list/detail, kanban, calendar, settings, onboarding, and sign-in pages. They are common across almost all apps, so they pass the DSL growth test (§2.4). Pages declare *which* pattern and sections in `smithable.yml`; `smithable.content.yml` holds their text and `smithable.ux.yml` their presentation.
- **Implemented so far (M10):** landing pages (hero, features, records as cards, pricing, testimonials, FAQ, call to action) and dashboards (counts, sums and averages with `where`, bar charts by month, the latest records). A landing page renders outside the app shell with its own frame; a dashboard's numbers are computed in a server function from `<model>Data.list(viewer)`, so they follow the access rules. Their kit files (`Landing.tsx`, `Dashboard.tsx`, `aggregate.ts`) are copied only into apps that use them. Settings pages edit the viewer's one record of a model (the first they may read), and an onboarding fills it in steps; sign-in opens the onboarding by default, and it redirects to the app once the record exists. Kanban and calendar are still to come.
- **Sample data** is generated with every new project, so no screen ever looks empty or broken.
- **Visual checks.** Playwright screenshots every page and checks contrast, overflow and mobile layout. Optionally, a vision model reviews the screenshots once per session.
- A professional designer creates the themes and patterns. This is a deliberate investment, not polish.

## 11. Daemon, CLI and MCP server

- Locally, a Node **daemon** hosts a project session: file watching, compile, the app process, Git, AI calls, and container builds. It exposes HTTP + WebSocket. In the hosted product, the browser tab is the host (§10.2), and the hosted service provides project storage, AI and publishing.
- The **CLI**, **Studio** and **MCP server** (§9.6) are all clients, and all use the same core packages. The CLI can also run core commands in-process without a daemon.
- So far the daemon is `smithable studio [dir]`: it runs the app's dev server as the preview (the Local runtime) and serves the Studio app (`apps/studio`) with a small HTTP API: the project (spec files, concepts from the index, the change trace from Git), operations (a destructive one returns its impact and needs a confirmed second call), undo (which restarts the preview on the restored database), `customize`, the last change's diff, and server-sent events for changes and logs. The Studio tab runs the engine itself for the plain-language summary (`summarize` in `@smithable/index`) and for validating the spec editor as you type. The summary lists a model's fields one per line under "Customers have:", gives pages and sign-in their own headings, and puts formulas in words (`formulaInWords`: "the quantity times the unit price", "0 if … , otherwise 5"). Builder speaks the summary's language everywhere: the change list, the status line, proposals and the forms' previews word each change with `describeChange` ("Customers: added a website (a web address)", from the operation each commit records in its `Smithable-Op` trailer), and the field panel shows a field as the summary lists it; Studio mode keeps the operations' own descriptions and the spec's shorthand. Each part of the summary ("Your app") can be edited in the same words: `readSummaryEdit` reads a model's list of fields back without AI (a new line such as "- a website (a web address)" adds a field, a missing one removes it, new notes change it), and any other edit goes to the model as that part's before and after text. Either way the result is a proposal first, and the part keeps the user's wording for the session (in the tab's `sessionStorage`) until a change from elsewhere touches it, when the generated sentences come back, marked "updated"; Ctrl+Z (Cmd+Z) outside a text field undoes the last change, in Studio and in the preview (whose editor script passes it on); the spec editor saves through the `editSpec` operation, so an edit gets the same checks, migration, checkpoint and undo as any operation. The change trace is read from the operations' commits (`Smithable-Duration` records how long each took).
- CLI surface: `smithable new | validate | generate | run | op <operation> | undo | customize page:<page> | inspect <concept> | context "<request>" | test | security | build | deploy | backup | restore | upgrade | update | detach | mcp | studio`.

## 12. Verification, security, deployment

**Tests** generated from the manifest cover: pages render, standard CRUD works, access rules hold, validation rejects bad input, migrations apply, `/health` responds, and every `examples` entry passes. Unit tests use Vitest and smoke tests use Playwright. Custom logic needs custom tests, and the compiler generates the stubs.

**The generated access layer** (hardened after the 2026-09-28 review): every data function works on the records the viewer may read. A list carries no related records it only adds up (an invoice's lines stay out of the invoice list, since some may not be the viewer's), and a generated test checks it. A search by a related record's name looks only among related records the viewer may read (a data module's `titled`); a referenced record's title is still shown with the record that refers to it (a decision still open). Only a role that may change everyone's records may set another owner (`ownedBy`). An action checks that the viewer may read every record its input names, and passes the viewer to its implementation. Records visitors add without an account (a contact form) have a shorter text limit (2,000 characters), at most 10,000 of them are stored, the contact form has a honeypot field, and the production server limits changes per address (a burst of 60, then one a second). A database refusal reaches the page only as a code the form words ("taken:<column>", "in-use"); anything else is logged. In production an app with sign-in does not start without `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.

**Security levels** (external tools are detected, not bundled):

| Level | Checks |
|---|---|
| Fast | typecheck, tests |
| Normal | + dependency audit (OSV-Scanner), secrets (Gitleaks), SAST (Semgrep CE) |
| Release | + container scan (Trivy), DAST (OWASP ZAP) |

**Implemented so far (M14):** `smithable security --level fast|normal|release` runs the table above with pinned tool versions (an installed tool, or its image in Docker): OSV-Scanner v2.6.0, Gitleaks v8.30.1, Semgrep 1.178.0 (p/typescript, p/react), Trivy 0.74.0 (high and critical) and ZAP 2.16.1's baseline scan against the image running on a free port. Findings fail the check and are never suppressed (ZAP's note that ZAP itself is out of date is not about the app). `smithable update --security` regenerates with the current stack profile, whose security overrides Smithable keeps in the project's `pnpm-workspace.yaml` (pnpm reads overrides only there; retired ones are removed, the rest of the file is left alone), and keeps the result only when the normal checks pass. What the first Release run found, and the fixes: an old esbuild (an override to 0.28.2), 80+ Debian vulnerabilities in `node:24-slim` (the image now runs on `distroless/nodejs24-debian13:nonroot`), missing security headers (a production `server.mjs` gives every response nosniff, framing, referrer, permissions and cross-origin headers; pages get a Content Security Policy with a per-request nonce, TanStack Start's `ssr.nonce`), and Smithable's own `.smithable/files.json`, whose path-and-hash pairs looked like API keys to Gitleaks (now `{ path, sha256 }` entries). `pnpm test:apps` checks that production pages carry the headers and that the policy blocks nothing a page needs.

Deploy and backup targets so far: `smithable deploy --target docker|ssh://user@host|compose` (the Release checks first; the image replaces the running container and keeps its `<app>-data` volume; the session secret is made once and kept in the ignored `data/`; provider keys pass through from the environment), and `smithable backup|restore` with a folder or `s3://bucket/prefix` (a built-in Signature V4 client for S3-compatible storage, credentials from `AWS_*` variables). A backup is a consistent `VACUUM INTO` snapshot plus uploads, from the development database or a container; restoring into a container stops it and fills its volume from a one-off container of the same image, then hands the files to the image's non-root user. `pnpm test:deploy` checks the exit criterion against SeaweedFS, which verifies signatures.

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

Everything is written in TypeScript with a pnpm workspace. Engine packages (`core`, `adapter-tanstack`, `index`) are browser-compatible (§1); host packages (`daemon`, `cli`) use Node. Start with few packages and split only when a boundary proves itself:

```text
smithable/
  packages/
    core/              manifest schema, parser, validator, IR, operations, oplog
    adapter-tanstack/  generator, app kit templates, migrations, index emission
    index/             index build + query API, context builder
    ai/                providers, routing, policy, prompts
    mcp/               MCP server over operations + index (may start inside cli/)
    daemon/            project session, process mgmt, Git, HTTP/WS API
    cli/
    vite-plugin/       dev-only instrumentation + editor runtime
  apps/
    studio/            Builder + Studio web app: React + Vite + Tailwind + shadcn/ui
  examples/
    crm/
  docs/
```

Security scanners, Claude Code, Ollama and Docker are all optional external tools. Smithable detects them and never requires them.

The OSS repo contains only code eligible for publication. The hosted service goes in a separate private repo (`smithable-cloud`), which depends on OSS and never the other way round. That covers accounts, project storage, the AI gateway with allowances, publishing and hosting, managed backups, the remote MCP endpoint and billing.

**Hosting of the beta (M15):** AWS Stockholm (`eu-north-1`), described with OpenTofu in `smithable-cloud/infra`, built only from pieces every EU provider has (a VM, S3-compatible storage, DNS), so moving to Hetzner, Scaleway or OVH is a migration, not a rewrite. The data stays in the EU; AWS being a US company (the CLOUD Act) is the known trade-off, revisited if customers ask for sovereignty. One Graviton host runs the service and published apps as containers behind Caddy (TLS), with S3 for projects and backups, within $50 a month.

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
| **Translations** | `smithable.content.<locale>.yml` per language, with the default language in `smithable.content.yml`. Later |
| **Teams and workspaces** | Later. Records get a group next to their owner, enforced in the same access layer (§3.1) |
| **Re-adopting a detached app** | Not supported initially. It would need the deferred project import |
| **`smithable.ux.yml` vocabulary** | Start minimal (density, column order/visibility, field order, groups) and grow only via §2.4 |
| **Manifest size.** One file or many for large apps? | One file until it hurts, then allow `models/*.yml` includes |
| **Existing project import / compatibility levels** | Deferred. Revisit after the public release |
| **License** | Apache-2.0 for engine, tools and spec; 0BSD for app kit and templates; EU trademark for the name. Legal review before publication |
| **Preview vs production SQLite** | WebAssembly driver in the preview, native SQLite in production. Verify that behaviour matches (M8) |
| **Hosted project storage** | Projects saved server-side as Git repositories, synced from the browser. Decide in M8 |
| **Other kinds of apps** (desktop, iOS, CLI tools, pipelines…), possibly community-made types in a Git repository stating their grammar, meaning, operations, generators and stack | A different platform for the same app is a new adapter with mostly the same spec (§5); a different kind of thing is a bundle of plugins plus an adapter (§5.1). Community types would be pinned by commit and hash, and their generators (pure functions) sandboxed. Web apps stay the one product until the launch; the order is the public plugin API, a second adapter, then types |
| **In-browser local model (WebGPU)** | Possible later for small intent tasks. Model download size is the obstacle |
