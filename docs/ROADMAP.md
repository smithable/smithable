# Smithable — Roadmap

Planned for one developer working with AI coding agents. Milestones are small and ordered so that each one produces something runnable. Each has **exit criteria**, and a milestone is done only when all of them hold. The running example throughout is the CRM in `examples/crm`.

Strategy: prove the core loop (**manifest → operation → regenerated app → undo**) from the CLI first. Then open it to existing coding agents through MCP and benchmark it. After that come Studio and Smithable's own AI. Building AI on top of an unproven deterministic core would hide its weaknesses.

---

## M0 — Foundations

- pnpm workspace, TypeScript project references, lint/format, Vitest, CI script runnable locally.
- Skeleton packages per [ARCHITECTURE.md §13](ARCHITECTURE.md#13-smithables-own-codebase).

**Exit:** `pnpm build && pnpm test` passes on a clean clone.

## M1 — Manifest core

- DSL v0.1 grammar for `app`, `models` (scalar fields only), `pages` (`crud`), `navigation`, and the free-text fields. Short and long forms.
- JSON Schema, parser with line/column errors, validator, IR.
- Draft the DSL against the CRM plus two other sample apps (for example a todo app and a booking app) before freezing v0.1.
- `smithable validate`.

**Exit:** all sample manifests validate. Every invalid-manifest fixture gives an error that points at the correct line. The IR snapshot tests pass.

## M2 — Walking skeleton

- TanStack adapter: idiomatic Drizzle schema (`src/db/schema.ts`), drizzle-kit-format migrations, `src/generated/ui.ts`, app kit (`ModelTable`, `ModelForm`, generic CRUD), pages and routes, navigation, `/health`, Dockerfile, generated README.
- Ownership zones and generated-file headers.
- `smithable new`, `smithable generate`, `smithable run`, `smithable build` (OCI image).

**Exit:**
- `Customer(name, email)` CRM runs, and customers can be created and edited.
- The generated `package.json` has no Smithable dependency, and the app runs with Smithable uninstalled.
- Regenerating produces byte-identical output.
- The container runs with a `/data` volume and data survives a restart.

## M3 — Operations, migrations, undo

- Operation layer with schemas: `addModel`, `addField`, `changeField`, `renameField`, `removeField`, `addPage`, `setNavigation`.
- Comment-preserving YAML writes, operation log, migration generation (rename-aware, with confirmation for destructive changes).
- Git checkpoint per change, `smithable undo` including dev-database restore.
- Drift detection for compiler-owned files.
- `smithable op addField Customer phone phone`.

**Exit:**
- Adding `phone` from the CLI updates the manifest, migration, form and table, and existing rows survive.
- Undo restores both code and data.
- A hand edit to a generated file is reported as drift, not overwritten.
- **Mini-benchmark:** run the first three benchmark tasks (see M10) via CLI operations against Claude Code to sanity-check the core bet early.

## M4 — Relations, custom code, examples

- `hasMany` / `belongsTo`, `Order` model, relation-aware kit components (select a customer on an order, list orders on a customer).
- Custom actions, queries, pages and jobs: generated typed contracts plus one-time stubs in `src/custom/`. Missing-implementation drift.
- `examples` compiled into Vitest tests.
- `smithable detach`.

**Exit:** the CRM has Orders and a custom `calculateShipping` action whose manifest examples run as passing tests. Changing the action's manifest signature makes the custom file fail typecheck.
**Detach test:** after `smithable detach`, a field and a page are added using only the Drizzle and TanStack docs (no Smithable knowledge), and the build and tests pass. `drizzle-kit generate` continues from the existing migrations.

## M5 — Auth and access

- `smithable.auth.yml` v0.1 (sign-in methods, roles, user fields). Decide the implementation approach ([ARCHITECTURE.md §14](ARCHITECTURE.md#14-open-questions)).
- Google sign-in by default, Facebook as a secondary provider, via the chosen auth library. Includes admin bootstrap, domain restriction, a dev-only sign-in-as-role, and a provider setup checklist.
- `access` rules on models, actions and pages, validated against the defined roles, enforced server-side by the kit, with generated tests.
- `setAccess` operation.

**Exit:** sign in with a real Google account works locally. Dev sign-in works offline and is absent from production builds. A `sales` user cannot delete customers and an `admin` can. Generated tests prove all of this.

## M6 — Index, context builder and MCP server

- Index emitted by the compiler, plus static analysis of custom files.
- `smithable inspect <concept>` and the query API.
- Context builder producing semantic slices, with token counting.
- `smithable mcp`: a local MCP server exposing operations, `inspect`, `validate`, `test` and `undo` as tools ([ARCHITECTURE.md §9.6](ARCHITECTURE.md#96-external-agents-via-mcp)).
- A generated `AGENTS.md` in the app (plus a `CLAUDE.md` pointer to it) explaining the ownership zones and the Smithable tools.

**Exit:**
- `inspect action:calculateShipping` returns its semantics, free text, files, symbols and tests.
- In Claude Code with the Smithable MCP server registered, "Customers should have a phone number" is completed through `smithable_add_field`, without Claude opening source files.
- Token use is recorded.

## M7 — Benchmark

Run the same tasks with (A) plain Claude Code against the generated repo and (B) Claude Code plus the Smithable MCP server:

add phone to Customer · make email required · add Order relationship · add Orders page · restrict delete to admins · add Customer search · reorder navigation

Measure: cloud tokens, wall time, files touched, test success, regressions, human intervention.

**Exit:** a written report, and product decisions updated from the results. The results decide how much to invest in Studio versus agent integration. The local-model column is added in M10.

## M8 — Daemon and lean Studio (no AI)

- Daemon with HTTP/WS API; the CLI and MCP server can use it.
- Studio, kept deliberately lean: concept tree (models, pages, actions), preview iframe, logs, diff view, undo, manifest editor with schema validation, and forms for the most common operations.

**Exit:** the core flow from M3–M5 can be done in Studio, with the preview reloading after each change.

## M9 — Visual selection and deterministic WYSIWYG

- Vite plugin injected via a wrapper config (dev only), element → concept mapping, hover and select.
- Context panel showing the operations applicable to the selected concept.
- `smithable.ux.yml` v0.1 and first presentation controls (column visibility/order, field order, groups, density).

**Exit:** click the email field in the preview → toggle "required" → the manifest, validation and form all update. Dragging a table column updates `smithable.ux.yml` and leaves `smithable.yml` untouched. The production build contains no instrumentation.

## M10 — Local AI

- Provider interface and an OpenAI-compatible provider, tested with Ollama.
- Concept shortlisting (fuzzy and embedding matching over the manifest) before the model runs.
- Tier 0/1 routing, constrained output against the operation schemas, confirmation UI, scoped prompts from a selected element.
- AI policy setting and local token metrics.

**Exit:**
- Offline, "Customers should have a phone number" → a proposed `addField` → the user confirms → it is applied.
- Ambiguous requests ask a question instead of guessing.
- The M7 benchmark tasks are re-run with the local model and added to the report.

## M11 — Escalation and AI-written custom code

- Managed/EU and Anthropic providers, and a Claude Code headless provider confined to the project.
- Escalation from tier 1 to tiers 2 and 3 using the same semantic slice.
- AI writes custom code only in `src/custom/` for a named concept, then typecheck and tests run.

**Exit:** "prioritise customers most likely to churn on the dashboard" produces a manifest change plus a custom query, with tests passing, and no generated files touched.

## M12 — Verification, security, one-click deploy

- Playwright smoke tests generated from pages.
- Security levels (Fast / Normal / Release) with detected external scanners. Findings are shown and never auto-suppressed.
- Docker Compose export. One-click "build & run container" in Studio, gated by Release checks.
- Deploy-target and backup-target interfaces, with built-in targets: local Docker, remote Docker host over SSH, local-directory and S3-compatible backups. `smithable backup` / `smithable restore`.

**Exit:** all 21 steps of the original vertical slice work end to end in Studio. A backup to an S3-compatible bucket can be restored into a fresh container, with no data lost.

## M13 — Desktop packaging

- Electron wrapper around Studio and the daemon, with a bundled Node runtime.
- Windows and macOS installers, detection of optional tools (Git, Docker, Ollama, Claude Code), and optional model download.
- Detachable panels.

**Exit:** a clean machine goes from installer to a running CRM without installing Node manually.

## M14 — Open-source preparation

Documentation, published manifest spec and JSON Schema, license decision with legal review, contributor guide, security policy, public CI, release process.

---

## Later (explicitly not before M14)

- Subscription: managed EU AI allowance (Mistral), support, managed backups (possibly first, as a stand-alone add-on), then Smithable Cloud hosting (one-click deploy, TLS/domains, rollback, logs, teams).
- A second adapter, and a public adapter API based on two real implementations.
- Scalable deployment mode (PostgreSQL, S3, multiple instances).
- Integrations, external endpoints (OpenAPI), events (AsyncAPI).
- A fine-tuned Smithable Mini model.
- Importing existing projects.
- Non-developer-oriented UX.
