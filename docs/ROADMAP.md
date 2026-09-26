# Smithable — Roadmap

Planned for one developer working with AI coding agents. Milestones are small and ordered so that each one produces something runnable. Each has **exit criteria**, and a milestone is done only when all of them hold. The running example throughout is the CRM in `examples/crm`.

**Done:** M0, M1, M2, M3, M4, M6, M7, M7.5. **In progress:** M5 (everything but the sign-in with a real Google account).

Strategy: prove the core loop (**spec → operation → regenerated app → undo**) from the CLI first. Then open it to existing coding agents through MCP and benchmark it (M7). After that, de-risk the browser, then build the Builder/Studio app, the design system and Smithable's own AI, and finally the hosted beta. Building AI or UI on top of an unproven deterministic core would hide its weaknesses, and the developer core is a useful product on its own if the rest takes longer.

---

## M0 — Foundations

- pnpm workspace, TypeScript project references, lint/format, Vitest, CI script runnable locally.
- Skeleton packages for the next milestones: `core`, `adapter-tanstack`, `cli`. The rest of [ARCHITECTURE.md §13](ARCHITECTURE.md#13-smithables-own-codebase) is created when its milestone starts.

**Exit:** `pnpm build && pnpm test` passes on a clean clone.

## M1 — Manifest core

- DSL v0.1 grammar for `app`, `models` (scalar fields only), `pages` (`crud`), `navigation`, and the free-text fields. Short and long forms.
- JSON Schema, parser with line/column errors, validator, IR.
- Internal plugin interface: each spec section (app, models, pages, navigation) registers its schema, validation and IR contribution through it ([ARCHITECTURE.md §5.1](ARCHITECTURE.md#51-plugins)). Unknown keys are validation errors.
- Every spec file carries its format version. A minimal spec-migration mechanism with one test migration, so the path exists before it is needed ([ARCHITECTURE.md §14](ARCHITECTURE.md#14-versions-and-upgrades)).
- Study Wasp's spec design first (including why they moved from their own DSL to a TypeScript config), and write down what to adopt and avoid.
- Draft the DSL against the CRM plus two other sample apps (a booking site and a SaaS with a landing page) before freezing v0.1.
- Lint rule: engine packages (`core`, `adapter-tanstack`) must not import Node built-ins ([ARCHITECTURE.md §1](ARCHITECTURE.md#1-layers)).
- `smithable validate`.

**Exit:** all sample manifests validate, and the engine packages pass the no-Node-built-ins lint rule. Every invalid-manifest fixture gives an error that points at the correct line. The IR snapshot tests pass.

## M2 — Walking skeleton

- TanStack adapter: idiomatic Drizzle schema (`src/db/schema.ts`), drizzle-kit-format migrations, `src/generated/ui.ts`, app kit (`ModelTable`, `ModelForm`, generic CRUD), pages and routes, navigation, `/health`, Dockerfile, generated README.
- Ownership zones and generated-file headers.
- `smithable.content.yml`: derived default texts, with overrides for labels and titles.
- `smithable.lock`, a first stack profile, exact dependency versions and a committed package lockfile in generated apps.
- `smithable new`, `smithable generate`, `smithable run`, `smithable build` (OCI image).
- **First five minutes:** `smithable new` produces a running app with sample data and one polished default theme, and opens the preview automatically.

**Exit:**
- `Customer(name, email)` CRM runs, and customers can be created and edited.
- The generated `package.json` has no Smithable dependency, and the app runs with Smithable uninstalled.
- Regenerating produces byte-identical output.
- The container runs with a `/data` volume and data survives a restart.
- From `smithable new` to a good-looking running app in the browser takes under a minute, excluding the dependency install.

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
- **Mini-benchmark:** run the first three benchmark tasks (see M7) via CLI operations against Claude Code to sanity-check the core bet early.

## M4 — Relations, custom code, examples

- `hasMany` / `belongsTo`, `Order` model, relation-aware kit components (select a customer on an order, list orders on a customer).
- Custom actions: generated typed contracts plus one-time stubs in `src/custom/`, offered on pages. (Custom queries, pages and jobs move to later milestones: none is needed for this milestone's exit, and jobs need a scheduler in the generated app.)
- Spreadsheet-style formulas for computed fields and defaults, compiled to TypeScript (SQL follows with queries and filters, which need it).
- `examples` compiled into Vitest tests.
- Rule IDs, implementation and test markers, and rule status in `smithable inspect`.
- `smithable detach`.

**Exit:** the CRM has Orders with a `shippingCost` formula whose manifest examples run as passing tests, and a custom `mergeCustomers` action. Changing the action's manifest signature makes the custom file fail typecheck. The rule "All orders of the duplicate move to the kept customer" moves from **Not implemented** to **Implemented and tested** once custom code and a named test exist, and editing the rule text marks it **Changed**.
**Detach test:** after `smithable detach`, a field and a page are added using only the Drizzle and TanStack docs (no Smithable knowledge), and the build and tests pass. `drizzle-kit generate` continues from the existing migrations.

## M5 — Auth and access

- `smithable.auth.yml` v0.1: sign-in methods, `defaultAccess` (shared or private), roles, and the `public` section. Implemented with Better Auth ([ARCHITECTURE.md §3.1](ARCHITECTURE.md#31-smithableauthyml-users-roles-and-exposure)). Extra user fields and `selfSignUp: false` (which needs invitations) move to a later milestone; `allowedDomains` covers internal tools until then.
- Google sign-in by default, Facebook as a secondary provider, via the chosen auth library. Includes admin bootstrap, domain restriction, a dev-only sign-in-as-role, and a provider setup checklist.
- Automatic owner field on every model, `ownedBy`, and `access` exceptions on models, actions and pages, validated against the defined roles.
- One generated access layer in the kit that filters every query and write, including row-level filtering by owner. Generated tests prove the effective access per model and role.
- Validator warnings for risky combinations (shared access with open sign-up; public read of personal-data fields).
- `setAccess` operation.

**Exit:** sign in with a real Google account works locally. Dev sign-in works offline and is absent from production builds. A `sales` user cannot delete customers and an `admin` can. In the invoicing app, one user cannot see another user's invoices, even by guessing URLs or IDs. In the booking app, the public schedule works without signing in. Generated tests prove all of this.

## M6 — Index, context builder and MCP server

- Index emitted by the compiler, plus static analysis of custom files.
- `smithable inspect <concept>` and the query API.
- Context builder producing semantic slices, with token counting.
- `smithable mcp`: a local MCP server exposing operations, `inspect`, `validate`, `test` and `undo` as tools ([ARCHITECTURE.md §9.6](ARCHITECTURE.md#96-external-agents-via-mcp)).
- A generated `AGENTS.md` in the app (plus a `CLAUDE.md` pointer to it) explaining the ownership zones and the Smithable tools.

**Exit:**
- `inspect action:mergeCustomers` returns its semantics, free text, files, symbols and tests (`pnpm test:apps`).
- In Claude Code with the Smithable MCP server registered, "Customers should have a website" is completed through `smithable_add_field`, without Claude opening source files (`node scripts/bench-m6.mjs`; the CRM already has a phone number).
- Token use is recorded: Smithable logs every context and MCP call to `data/.smithable/token-log.jsonl`, and the M6 check records Claude's own usage.

## M7 — Benchmark and user interviews

Run the same tasks with:
- **(A)** plain Claude Code against the generated repo,
- **(B)** Claude Code plus the Smithable MCP server,
- **(C)** a prompt-to-code builder such as Lovable, rebuilding the same app, where feasible.

The tasks: add phone to Customer · make email required · add Order relationship · add Orders page · restrict delete to admins · add Customer search · reorder navigation

Measure: tokens or credits, wall time, files touched, test success, regressions, human intervention.

Before this milestone, interview 10–15 target users (non-developers who have used prompt-to-code builders, and developers or agencies), so the benchmark measures what they care about.

**Done (2026-09-27)** ; the interviews move to M9 as usability tests. Results and decisions: [benchmarks/m7-report.md](benchmarks/m7-report.md). The prompt-to-code builder setup has a [manual protocol](benchmarks/m7-prompt-to-code.md) and has not been run.

**Exit:**
- A written report, and product decisions updated from the results.
- The measurements become the documented baseline for the change trace's comparison estimate ([ARCHITECTURE.md §9.7](ARCHITECTURE.md#97-change-trace)).
- The local-model and Smithable-model columns are added in M12.

## M7.5 — Escape hatches and search

From the M7 benchmark: where no operation fits, agents edit generated files, and that drift blocks every later operation. Fix that before building new surfaces.

- `customizePage`: `src/custom/pages/<page>.tsx` replaces a page's generated component, with a generated, typed contract (loader data, data functions) and the generated route keeping loading and access checks. Never overwritten.
- Drift that can be moved: `smithable generate` offers to move a hand edit of a generated page into its custom page (ARCHITECTURE §6.5).
- The MCP server's instructions and tool results point agents to `customizePage` and custom actions when no operation fits.
- Search on list pages in the spec (`search: [name, email]`), after the five questions of ARCHITECTURE §2.4.

**Exit:** in the M7 benchmark, Claude Code + MCP completes all seven tasks with no drift, including search (through the spec) and the menu reorder after it; a custom page survives regeneration and fails type-checking when its contract changes.

**Done (2026-09-27):** 7 of 7 tasks, $0.92, no drift ([m7-SB.md](benchmarks/m7-SB.md)); the custom page checks are in `pnpm test:apps`. Only list pages can be customized so far; detail and form pages follow when needed.

## M8 — Browser engine spike

Removes the biggest technical risk of the browser-first product before building on it.

- Run the engine and the generated CRM's dev server inside a WebContainer, with a WebAssembly SQLite driver in the preview.
- Verify that the preview and native SQLite behave the same for the generated queries and migrations.

- Decide how hosted projects are stored (server-side Git repositories synced from the browser is the leaning).

**Exit:**
- In Chrome, the CRM preview runs in a WebContainer, and an operation applied in the browser updates the preview within about 2 seconds.
- The licensing path is known. If it isn't viable, the Remote VM runtime is chosen instead.

## M9 — Builder and Studio app (no AI)

- `apps/studio`: one web app with Builder and Studio modes ([ARCHITECTURE.md §10](ARCHITECTURE.md#10-product-surfaces)).
- Preview runtime interface with the Local (daemon) and WebContainer runtimes.
- Concept tree, plain-language spec summary, spec editor, diff, undo, logs, and forms for the most common operations.
- Change trace, with generator entries only for now.
- Usability tests with 5–8 people from the beachhead groups, each building their own small app idea in the Builder (they replace M7's interviews; guide in [research/interviews.md](research/interviews.md)).

**Exit:** the M3–M5 flows work in both modes, both locally (daemon) and browser-only (WebContainer).

## M10 — Design system

- A professional designer creates four theme presets, brand-input rules and the page patterns: landing sections, dashboard, list/detail, settings, sign-in and onboarding.
- `smithable.ux.yml` theme and section support. Generated sample data for every pattern.
- Playwright visual checks: contrast, overflow and mobile layout.

**Exit:** three sample apps (the CRM, a booking site, and a SaaS landing page with a dashboard) are approved by the designer, and the visual checks pass on desktop and mobile.

## M11 — Visual selection and WYSIWYG

- Vite plugin injected via a wrapper config in every preview runtime (dev only), element → concept mapping, hover and select.
- Context panel showing the operations applicable to the selected concept.
- Presentation controls: theme, column visibility/order, field order, groups, density, section order.

**Exit:**
- Click the email field in the preview → toggle "required" → the spec, validation and form all update.
- Dragging a table column updates `smithable.ux.yml` and leaves `smithable.yml` untouched.
- The production build contains no instrumentation.

## M12 — AI: Smithable model and local model

- Provider interface and an OpenAI-compatible provider. It covers both the Smithable model (an off-the-shelf open model on an EU-hosted endpoint) and local models (Ollama).
- Concept shortlisting, constrained output against the operation schemas, and a confirmation UI with plain-language descriptions.
- Starting from a sentence ([ARCHITECTURE.md §9.8](ARCHITECTURE.md#98-starting-from-a-sentence)), theme and pattern choice, and scoped prompts from a selected element.
- AI policy setting. The change trace gains tokens, cost, and the benchmark-based comparison estimate.

**Exit:**
- "A booking site for a yoga studio" → the user confirms the summary → a good-looking app with sample data.
- "Customers should have a phone number" works with the Smithable model, and offline with a local model.
- Ambiguous requests ask a question instead of guessing.
- The M7 benchmark is re-run with both models and added to the report.
- First builds from the same 10 app descriptions are compared across a mid-size Smithable model and a frontier model, for quality (designer and user review) and cost. The default model for first builds is chosen from the result.

## M13 — Escalation and AI-written custom code

- Frontier providers (EU-hosted where possible, Anthropic API, Claude Code headless confined to the project).
- Escalation between tiers using the same semantic slice.
- AI writes custom code only in `src/custom/` for a named concept, then typecheck and tests run.
- **Teach Smithable:** for a construct no plugin handles, AI writes a project plugin (schema, operations, generator) once, and it is reviewed like any other change.

**Exit:**
- "Prioritise customers most likely to churn on the dashboard" produces a spec change plus a custom query, with tests passing, and no generated files touched.
- A `newsletter:` section in a spec gets a project plugin written by AI. Regenerating afterwards uses no AI at all.

## M14 — Verification, security, deploy and backup targets

- Playwright smoke tests generated from pages.
- Security levels (Fast / Normal / Release) with detected external scanners. Findings are shown and never auto-suppressed.
- `smithable upgrade` and `smithable update --security` through the normal change pipeline.
- Deploy-target and backup-target interfaces, with built-in targets: local Docker, Compose export, remote Docker host over SSH, local-directory and S3-compatible backups. `smithable backup` / `smithable restore`.

**Exit:**
- A self-hosted deploy passes Release checks.
- A backup to an S3-compatible bucket can be restored into a fresh container with no data lost.
- A sample app with custom code upgrades across a stack profile change with tests passing, and a deliberately broken contract is reported, not silently fixed.

## M15 — Hosted beta (`smithable-cloud`)

- Accounts with Google sign-in, project storage, and an AI gateway with plan allowances.
- One-click publish to EU hosting with domains and TLS, on every plan, with spending caps on by default. Managed backups.
- For agencies: a staging environment per app, and transferring a project to the client's own account.
- Automatic rebuild and redeploy for security patches, gated by tests.
- Remote MCP endpoint.
- A public demo that needs no sign-up, showing the change trace, with a limited number of sandboxes.

**Exit:** an invited tester with nothing installed goes from one sentence to a published app on their own domain, and can hand the project to a developer, who continues in Studio or via Git.

## M16 — Public launch

- Open-source preparation: license decision with legal review, trademark registration, documentation, published spec and JSON Schema, contributor guide (DCO), security policy, public CI, release process.
- Pricing and plans with included allowances.
- The open-source repository goes public together with the hosted beta.

---

## Later (not before M16)

- A desktop app (Electron) for local-first non-developers with one-click local model download.
- Teams and collaboration.
- In-browser local model (WebGPU) for small intent tasks.
- A fine-tuned Smithable model, possibly with open weights.
- A public plugin API, based on the internal plugins and real project plugins.
- A second adapter, and a public adapter API based on two real implementations.
- Scalable deployment mode (PostgreSQL, S3, multiple instances).
- Integrations, external endpoints (OpenAPI), events (AsyncAPI).
- Importing existing projects.
