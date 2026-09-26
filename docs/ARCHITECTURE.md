# Smithable — Architecture

This document records architectural decisions. When a decision changes, update it here. [VISION.md](VISION.md) explains *why*; [ROADMAP.md](ROADMAP.md) explains *when*.

## 1. Layers

```text
 smithable.yml            WHAT the app does and WHY (structured DSL + scoped free text)
 smithable.auth.yml       WHO the users are: sign-in methods, roles
 smithable.ux.yml         HOW it looks and feels: layout, density, ordering, theme
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
 .smithable/              generated, disposable: implementation index, op log, caches
```

Every change, whether it comes from the CLI, Studio, AI or a plugin, goes through one **semantic operation layer** that mutates the manifest files (`smithable.yml` and its companions). Code is then regenerated from them. Nothing writes application code directly except (a) the compiler, into files it owns, and (b) humans or AI, into custom files (see §6).

## 2. The manifest: `smithable.yml`

### 2.1 Content

The manifest describes application functionality in technology-neutral terms. It never contains React, Drizzle, Tailwind, file paths or CSS.

v0.1 covers: `app`, `models` (fields, relations), `access` rules, `actions`, `queries`, `pages`, `navigation`, `jobs`. Integrations and external endpoints come later. Roles are defined in `smithable.auth.yml`. Presentation lives in `smithable.ux.yml` (§3).

### 2.2 Style: neat by default, explicit when needed

Each construct has a **short form** for the common case and a **long form** when more detail is needed. Operations write the shortest form that preserves meaning. Illustrative syntax only; the exact grammar is designed in milestone M1:

```yaml
smithable: 0.1

app:
  name: CRM
  description: Lightweight CRM for a small B2B sales team.

models:
  Customer:
    description: A company we have a commercial relationship with.
    fields:
      name: string!                  # short form: "!" = required
      email: email unique
      phone: phone
      segment: enum(smb, enterprise, government)
      creditLimit:                   # long form
        type: money
        min: 0
        description: Maximum outstanding balance before orders are held.
    hasMany: orders
    access:                          # roles come from smithable.auth.yml
      read: [sales, admin]
      write: [sales, admin]
      delete: [admin]

  Order:
    fields:
      number: string! unique
      total: money!
      placedAt: datetime!
    belongsTo: customer

actions:
  calculateShipping:
    custom: true                     # implemented in a user-owned file
    input:  { total: money, method: enum(standard, express) }
    output: { cost: money }
    intent: Calculate the shipping cost for an order.
    rules:
      - Orders above 100 EUR have free standard shipping.
    examples:
      - input:    { total: 150, method: standard }
        expected: { cost: 0 }

pages:
  customers:
    intent: Find a customer quickly and keep their details current.
    crud: Customer                   # standard list + detail + form
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
- Splitting the manifest across several files for large apps is an open question (§14).

## 3. Companion files

`smithable.yml` stays focused on functionality. Three companion files hold concerns that would otherwise clutter it. All of them are validated by JSON Schema, modified through operations, and edited with comment-preserving writes. Only `smithable.context.yml` may mention technology.

### 3.1 `smithable.auth.yml`: users and roles

This file describes who can sign in and which roles exist. It is technology-neutral.

```yaml
smithableAuth: 0.1
signIn:
  providers: [google, facebook]    # default: [google]; order = button order
  allowedDomains: [acme.com]       # optional: only this Google Workspace domain
  selfSignUp: true                 # false = only invited email addresses
roles:
  admin: { description: Full access, manages users. }
  sales: { description: Day-to-day customer and order work. }
defaultRole: sales
admins: [owner@acme.com]           # bootstrap: these get admin on first sign-in
user:
  fields:                          # extra profile fields, same syntax as models
    displayName: string!
```

- **Google is the default sign-in method.** Facebook, Microsoft, GitHub and Apple are secondary options in the same `providers` list. Email/password and magic links exist but are never the default.
- **It is implemented with a mainstream auth library as an ordinary dependency.** The leaning is Better Auth: self-hosted, with a Drizzle adapter, SQLite support and social providers. Confirm this in M5. Sign-in is the one place where a well-maintained library beats generated code.
- **OAuth client IDs and secrets live in environment variables**, never in YAML. Smithable provides a setup checklist per provider, including the exact redirect URLs.
- **Dev sign-in.** In development and in the Studio preview, a dev-only sign-in lets you act as any role without contacting Google. This keeps offline development and role testing possible. It is disabled in production builds, and a generated test verifies that.
- **Build your own.** `signIn: custom` generates a typed session contract plus a stub in `src/custom/auth.ts`. This is never the default.
- **Access rules stay in `smithable.yml`,** attached to the model, action or page they protect. They reference roles defined here, and the validator checks those references.

### 3.2 `smithable.ux.yml`: presentation

This file describes how the app looks and feels, without changing what it does. It is technology-neutral: it contains no CSS or Tailwind classes. It refers to concepts by their manifest IDs.

```yaml
smithableUx: 0.1
theme:
  density: compact
  accent: blue
pages:
  customers:
    table:
      columns: [name, segment, email]      # order + visibility
    form:
      fieldOrder: [name, email, phone, segment, creditLimit]
      groups:
        - { label: Billing, fields: [creditLimit] }
```

- Visual edits in Studio (reorder columns, hide a field, change density) write to this file through operations.
- Anything beyond its vocabulary is handled by a custom component in `src/custom/`.
- The same growth rule applies as for the DSL (§2.4): add structure only when it is common and deterministic.

### 3.3 `smithable.context.yml`: implementation context

This file describes HOW to implement the app: technology, conventions and guidance.

```yaml
smithableContext: 0.1
adapter: tanstack
database: sqlite
conventions:
  - Prefer existing components before creating new ones.
guidance: >
  Tables should be compact; this is a back-office tool used all day.
ai:
  policy: eu-only          # local-only | eu-only | best-available | custom
```

It has structured fields where possible and one free-text `guidance` field for implementation preferences. It never contains functional requirements.

## 4. Semantic operations

The **only** way to change application semantics programmatically.

- Each operation (`addModel`, `addField`, `changeField`, `renameField`, `removeField`, `addRelation`, `addPage`, `setAccess`, `addAction`, `addExample`, …) has a JSON Schema for its arguments. The same schema is used for CLI parsing, Studio forms and constrained AI output.
- An operation is a pure function `manifest → manifest` plus validation. Side effects (regeneration, migration) follow from the changed manifest, not from the operation itself.
- Applied operations are appended to an **operation log** (`.smithable/oplog`). Its main use is disambiguating migrations: a rename is not a drop followed by an add.
- Batches of operations are atomic: they all apply, or none do.

Clients:

```text
CLI (smithable op …) ─┐
Studio UI ────────────┤
Smithable AI ─────────┼──► operations ──► manifest ──► compiler
External agents (MCP) ┤
Plugins ──────────────┘
```

## 5. Compiler, IR and adapters

- **Parser/validator** → **semantic model** → **IR**. The IR has defaults applied, references resolved, derived facts computed (for example, a foreign key implied by `belongsTo`) and identifiers normalized. It carries no technology concepts.
- **Adapter**: IR → a set of files, migrations, index entries, and build/run commands.
- v1 has exactly one adapter: **TanStack Start + React + TypeScript + Tailwind + shadcn/ui + Drizzle + SQLite + Zod + Vite**.
- The adapter boundary is kept clean inside the codebase, but the **adapter API is not published** until a second adapter exists. Designing a public API from one example produces the wrong API.
- Generation is **deterministic and idempotent**: the same manifest and the same Smithable version produce byte-identical output. This is tested.

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

The only extra file is `src/generated/ui.ts`. It is a small typed map of what the database does not know: labels, semantic kinds (`email`, `phone`, `money`) and default columns. If a column is later added to the Drizzle schema by hand, the kit still renders it with sensible defaults.

### 6.3 The app kit

The **app kit** is a small set of generic, reusable source files that the adapter writes into every generated app, in `src/kit/`: `ModelTable`, `ModelForm`, `ModelDetail`, generic CRUD server functions and access checks. The pattern is the same as shadcn/ui, where components are copied into your repo instead of installed. The kit lets pages stay short without a Smithable package.

Rules that keep the kit "normal":

- **Small.** A size budget of roughly 1,500 lines in total. Any growth needs a justification.
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

Custom code is linked to the manifest by convention: `actions.calculateShipping` with `custom: true` corresponds to `src/custom/actions/calculateShipping.ts`. The compiler generates the typed input/output contract into `src/generated/`, so if the manifest's signature changes, the custom file fails typechecking. That turns drift into a compile error instead of a silent bug.

Custom files may import anything from `generated/` and `kit/`. Generated code imports custom code only at the declared hook points.

### 6.5 Drift detection

The compiler records a hash of every file it owns in `.smithable/`. If someone edits a compiler-owned file by hand, Smithable reports drift and offers two choices: **revert**, or **move the change into a custom file or the manifest**. It never silently overwrites a manual edit.

Missing custom implementations (a manifest says `custom: true` but the file or export is missing) are also reported as drift.

### 6.6 Migrations

Migrations are written in **drizzle-kit's own format, including its snapshot metadata**, so `drizzle-kit generate` continues seamlessly after a detach. The adapter computes them from the difference between the old and new IR, and uses the operation log to tell a rename from a drop followed by an add. Without Smithable, drizzle-kit's own interactive rename prompts take over. Destructive migrations (removing a column or table) require explicit confirmation.

### 6.7 Leaving Smithable: `smithable detach`

Because the app is already normal, detaching is a cleanup, not a rescue:

- removes the generated-file headers and `.smithable/`,
- keeps or removes the `smithable*.yml` files (keeping them as documentation is an option),
- rewrites the README's project-structure section without any mention of Smithable,
- leaves the app kit behind as ordinary project code.

Re-adopting a project after detaching is not supported initially (see §14). The guarantee is verified by a roadmap test (M4): after detaching, a developer adds a field and a page using only the Drizzle and TanStack docs, and the build and tests still pass.

## 7. Implementation index

The index maps each semantic concept to its code: `concept ↔ files/symbols ↔ routes ↔ DB tables ↔ UI elements ↔ tests`, plus the concept's free text.

- Most of it is **emitted by the compiler as a by-product**, since the compiler knows exactly what it generated. Custom files are covered by light static analysis (TypeScript symbols and imports).
- It is disposable and can always be rebuilt.
- Storage: start with JSON in `.smithable/index/`. Move to SQLite when size or query needs justify it.
- Query API (used by AI tools, Studio and the CLI): `inspect(concept)`, `findImplementation(concept)`, `findTests(concept)`, `conceptAt(file, line)`, `conceptForElement(id)`.

## 8. Change pipeline and safety

```text
operation(s) → validate → write manifest → compile → migrate (dev DB)
            → typecheck → tests (fast level) → checkpoint → preview reload
```

- A failure at any step rolls back to the previous checkpoint automatically and reports the error.
- **Checkpoints use Git.** Each applied change becomes a commit, which Studio labels with the operation(s) that produced it. Undo is a revert. The diff is always viewable.
- The dev database is snapshotted before migrations so undo also restores data.

## 9. AI layer

### 9.1 What AI is allowed to produce

1. **Operations.** Structured output constrained to the operation JSON Schemas (grammar or JSON-schema constrained decoding). This is the common case.
2. **Manifest free text.** Proposed `description`, `intent`, `rules` or `examples`.
3. **Custom code.** Edits restricted to the custom files of specific concepts, with the generated contract as the interface.

AI never edits generated or kit files.

### 9.2 Routing

| Tier | Handler | Example |
|---|---|---|
| 0 | Explicit operations (CLI, Studio controls), simple pattern rules | Studio "required" toggle |
| 1 | Small local model → operations | "Customers need a mobile number" |
| 2 | Managed EU model | Ambiguous, multi-step intent |
| 3 | User-configured stronger model (API or Claude Code headless) | Custom action logic |

The system escalates only when the lower tier fails validation, returns no valid operation, or the task needs custom code.

### 9.3 Context construction

Before any model runs, simple fuzzy and embedding matching over the manifest shortlists the likely concepts, so even a 1–3B local model only chooses among a few candidates. A **context builder** then assembles the smallest useful slice from the manifest, the index and (only for custom code) the relevant source files: the request, the relevant concepts with their free text, available operations, and the implementation slice needed for that tier. Every tier gets the same semantic slice; escalating a tier never means adding unrelated project data.

For each AI call, record (locally) the semantic-context tokens, implementation-context tokens, model, tier, operation type and whether escalation happened. Project content is never collected for analytics without explicit permission.

### 9.4 Confirmation over self-reported confidence

Models are poor judges of their own confidence, so Smithable does not rely on self-reported scores. Instead:

- Proposed operations are shown in readable form ("Add field `mobilePhone` (phone) to Customer") before they apply. The user can enable auto-apply for non-destructive operations.
- If the model returns several candidate interpretations, or none validate, Smithable asks the user or escalates.
- Low-certainty inference never mutates the app silently.

### 9.5 Providers and policy

- Provider interface with implementations for: **OpenAI-compatible** (covers Ollama, llama.cpp, vLLM, Mistral and most EU hosts), **Anthropic API**, and **Claude Code CLI** (spawned headless, confined to the project directory; Smithable never reads or copies its credentials).
- **Policy** (`local-only`, `eu-only`, `best-available`, `custom` allowlist) is enforced centrally in the provider layer, not by each caller. An organization can pin the policy.
- Local models: use an existing small open model with optional download; never bundle weights in the installer. A dedicated Smithable model comes later, trained on (request, semantic context, accepted operation) triples from curated, synthetic or consented data.

### 9.6 External agents via MCP

Smithable ships a local **MCP server** (`smithable mcp`). MCP (Model Context Protocol) is an open standard that most AI coding tools support: Claude Code, Cursor, VS Code, Codex and many local-model clients.

- **What it is.** A subcommand of the open-source CLI. The user's agent starts it as a local process and talks to it over stdin/stdout. There is no network service, no account and no cost.
- **Tools exposed.** The semantic operations (`smithable_add_field`, …), `inspect`, `validate`, `test`, `undo` and `detach`. Tool schemas are the operation JSON Schemas, so there is one definition for the CLI, Studio, the internal AI and external agents.
- **Why.** Any agent can change the app through operations instead of reading and editing the repository. This delivers the low-token benefit before Studio exists, and it works with whatever model the user already pays for.
- **Agent guidance.** Every generated app includes an `AGENTS.md` (plus a `CLAUDE.md` pointer) explaining the ownership zones, where custom code goes, and to prefer Smithable tools over file edits.
- The operation pipeline (§8) applies unchanged: validation, checkpoints, tests and undo.
- A remote (HTTP) MCP endpoint could later be offered by Smithable Cloud. The local server never depends on it.

## 10. Visual editing

- **Studio** is a React SPA served by the daemon and opened in a browser. The Electron wrapper comes later and adds nothing architecturally.
- The app runs in an **iframe** preview.
- **Instrumentation is dev-only, and the app does not depend on it.** The daemon starts the app's Vite dev server with a wrapper config that extends the app's own `vite.config` and adds the Smithable plugin. The plugin tags rendered elements with concept IDs and injects a small editor runtime that talks to Studio via `postMessage`. Production builds use the app's plain config, so they contain nothing from Smithable.
- Selecting an element resolves to a concept (`field:Customer.phone`) and shows the operations that apply to it ("required", "rename", "move", "hide from table"), plus a prompt box scoped to that concept.
- **Semantic edits** (fields, pages, access) go through operations on `smithable.yml`. **Presentation edits** (ordering, visibility, density, grouping) go through operations on `smithable.ux.yml`. Anything finer is a custom component.
- Panels are dockable, resizable and hideable. The prompt/agent panel sits at the bottom by default. Detachable windows come with Electron.

## 11. Daemon, CLI and MCP server

- A Node **daemon** owns a project session: file watching, compile, the app process, Git, AI calls, and container builds. It exposes HTTP + WebSocket.
- The **CLI**, **Studio** and **MCP server** (§9.6) are all clients, and all use the same core packages. The CLI can also run core commands in-process without a daemon.
- CLI surface: `smithable new | validate | generate | run | op <operation> | undo | inspect <concept> | test | security | build | deploy | backup | restore | detach | mcp | studio`.

## 12. Verification, security, deployment

**Tests** generated from the manifest cover: pages render, standard CRUD works, access rules hold, validation rejects bad input, migrations apply, `/health` responds, and every `examples` entry passes. Unit tests use Vitest and smoke tests use Playwright. Custom logic needs custom tests, and the compiler generates the stubs.

**Security levels** (external tools are detected, not bundled):

| Level | Checks |
|---|---|
| Fast | typecheck, tests |
| Normal | + dependency audit (OSV-Scanner), secrets (Gitleaks), SAST (Semgrep CE) |
| Release | + container scan (Trivy), DAST (OWASP ZAP) |

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

Everything is written in TypeScript on Node, with a pnpm workspace. Start with few packages and split only when a boundary proves itself:

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
    studio/            React + Vite + Tailwind + shadcn/ui
  examples/
    crm/
  docs/
```

Security scanners, Claude Code, Ollama and Docker are all optional external tools. Smithable detects them and never requires them.

The OSS repo contains only code eligible for publication. Billing, cloud control plane and operations code go in a separate private repo (`smithable-cloud`), which depends on OSS and never the other way round.

## 14. Open questions

| Question | Current leaning |
|---|---|
| **Auth library** | Better Auth (Drizzle adapter, social providers, self-hosted). Confirm in M5 against Google/Facebook flows and dev sign-in |
| **Re-adopting a detached app** | Not supported initially. It would need the deferred project import |
| **`smithable.ux.yml` vocabulary** | Start minimal (density, column order/visibility, field order, groups) and grow only via §2.4 |
| **Manifest size.** One file or many for large apps? | One file until it hurts, then allow `models/*.yml` includes |
| **Exact DSL grammar** | Designed in M1 against the CRM example and 2–3 other sample apps |
| **Existing project import / compatibility levels** | Deferred. Revisit after the public release |
| **License** | Permissive for the spec, OSI-approved for the tools, legal review before publication |
