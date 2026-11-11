# Smithable — Roadmap

Planned for one developer working with AI coding agents. Milestones are small and ordered so that each one produces something runnable. Each has **exit criteria**, and a milestone is done only when all of them hold. The running example throughout is the CRM in `examples/crm`.

**Done:** M0, M1, M2, M3, M4, M6, M7, M7.5, M8, M11, M13, M14. **In progress:** M5 (everything but the sign-in with a real Google account), M9 (usability tests), M10 (approval of the built apps), M12 (needs real models), M16 (the repository is public; the hosted beta is by invitation).

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

- `smithable.auth.yml` v0.1: sign-in methods, `defaultAccess` (shared or private), roles, and the `public` section. Implemented with Better Auth ([ARCHITECTURE.md §3.1](ARCHITECTURE.md#31-smithableauthyml-users-roles-and-exposure)). Extra user fields move to a later milestone; `selfSignUp: false` with invitations came in M15.5.
- Google sign-in by default, Facebook as a secondary provider, via the chosen auth library. Includes admin bootstrap, domain restriction, a dev-only sign-in-as-role, and a provider setup checklist.
- Automatic owner field on every model, `ownedBy`, and `access` exceptions on models, actions and pages, validated against the defined roles.
- One generated access layer in the kit that filters every query and write, including row-level filtering by owner. Generated tests prove the effective access per model and role.
- Validator warnings for risky combinations (shared access with open sign-up; public read of personal-data fields).
- `grant` operation (`setAccess` until 2026-10-09, when who may do what moved to the auth file).

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

**Done (2026-09-27)**; the interviews move to M9 as usability tests. Results and decisions: [benchmarks/m7-report.md](benchmarks/m7-report.md). The prompt-to-code builder setup has a [manual protocol](benchmarks/m7-prompt-to-code.md) and has not been run.

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

**Done (2026-09-27), with the fallback:** the CRM ran in a WebContainer in Chromium, and an operation applied by the engine in the page reached the preview in 2.9–3.5 s, but sign-in cannot work there (WebContainers lose `AsyncLocalStorage` across `await`, an open upstream issue). Licensing needs a sales conversation. Decision: a Remote VM runs the hosted preview, the engine stays in the browser, and hosted projects are Git repositories on EU servers ([research/webcontainers.md](research/webcontainers.md)).

## M9 — Builder and Studio app (no AI)

- `apps/studio`: one web app with Builder and Studio modes ([ARCHITECTURE.md §10](ARCHITECTURE.md#10-product-surfaces)).
- Preview runtime interface with the Local (daemon) and Remote VM runtimes; the engine runs in the browser tab (M8).
- Concept tree, plain-language spec summary, spec editor, diff, undo, logs, and forms for the most common operations.
- Change trace, with generator entries only for now.
- Usability tests with 5–8 people from the beachhead groups, each building their own small app idea in the Builder (they replace M7's interviews).

**Exit:** the M3–M5 flows work in both modes, both locally (daemon) and in the browser with a Remote VM preview.

**Status (2026-09-27):** `smithable studio` and `apps/studio` are built, and `pnpm test:studio` makes the M3–M5 changes in both modes against the local daemon, in a real browser. The browser-with-Remote-VM variant needs the hosted backend (EU preview VMs, project repositories), so it moves to M15 (M8 replaced WebContainers, which needed no backend). Still to do: the usability tests, which need people from the beachhead groups.

## M10 — Design system

- A professional designer creates four theme presets, brand-input rules and the page patterns: landing sections, dashboard, list/detail, settings, sign-in and onboarding.
- `smithable.ux.yml` theme and section support. Generated sample data for every pattern.
- Playwright visual checks: contrast, overflow and mobile layout.

**Exit:** three sample apps (the CRM, a booking site, and a SaaS landing page with a dashboard) are approved by the designer, and the visual checks pass on desktop and mobile.

**Status (2026-09-27):** the design proposal is delivered ([design/delivery/](design/delivery/README.md)); implementation review pending. Implemented: its four presets in light and dark, the brand-input rules (tested against its 24 examples), fonts and densities; the shell (sidebar, phone drawer), buttons, fields, tables, record cards and forms. The visual checks (axe-core, WCAG 2 AA and no sideways scrolling, light and dark, desktop and phone) run on every example in `pnpm test:apps`. Since then: status tones and navigation icons in `smithable.ux.yml`, and the landing and dashboard page patterns (Invoicely has both, Stillwater a landing page). Then page subtitles, a second field under a column (phone under email), searchable related-record fields, a delete dialog, and the settings and onboarding patterns. Still to do: the designer's approval of the three apps.

## M11 — Visual selection and WYSIWYG

- Vite plugin injected via a wrapper config in every preview runtime (dev only), element → concept mapping, hover and select.
- Context panel showing the operations applicable to the selected concept.
- Presentation controls: theme, column visibility/order, field order, groups, density, section order.

**Exit:**
- Click the email field in the preview → toggle "required" → the spec, validation and form all update.
- Dragging a table column updates `smithable.ux.yml` and leaves `smithable.yml` untouched.
- The production build contains no instrumentation.

**Done (2026-09-27):** all three are checked by `pnpm test:studio` and `pnpm test:apps`. Presentation controls so far: theme and density (Builder form), column order (drag) and visibility (hide), field order (`setFieldOrder`, not yet in the panel); groups and section order wait for the design system's page patterns (M10).

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

**Status (2026-09-27):** in progress. Built and tested with a stand-in model: providers, policy, proposals constrained to the operation schemas with dry-run, repair and escalation, questions for unclear requests, confirmation in `smithable ask` and Studio's Describe tab, tokens and cost in the change trace, and `smithable new --describe` (a model adapts the closest starter; you confirm the summary) ([ai.md](ai.md)). First measurements with an EU-hosted model (Mistral Small): the seven M7 tasks through `smithable ask` in 6–7 of 7 per run for about €0.002, and first builds from ten descriptions valid in 2 / 10 (Medium: 4 / 10) ([report](benchmarks/m12-report.md)). Local model: `qwen2.5:7b` through Ollama did 6 / 7 tasks offline (`local-only`); Mistral Small now 7 / 7 in two runs; first builds with Mistral Medium 7 / 10. Frontier model through Claude Code: first builds 10 / 10 with Sonnet ($0.94 for ten), which makes it the default when the policy allows it, and Mistral Medium otherwise. Since then (M15.5): first builds as a batch of operations, with questions first. Still to do: people reviewing the first builds' quality.

## M13 — Escalation and AI-written custom code

- Frontier providers (EU-hosted where possible, Anthropic API, Claude Code headless confined to the project).
- Escalation between tiers using the same semantic slice.
- AI writes custom code only in `src/custom/` for a named concept, then typecheck and tests run.
- **Teach Smithable:** for a construct no plugin handles, AI writes a project plugin (schema, operations, generator) once, and it is reviewed like any other change.

**Exit:**
- "Prioritise customers most likely to churn on the dashboard" produces a spec change plus a custom query, with tests passing, and no generated files touched.
- A `newsletter:` section in a spec gets a project plugin written by AI. Regenerating afterwards uses no AI at all.

**Done (2026-09-27):** both exit checks pass with Claude Sonnet through Claude Code. "Prioritise customers most likely to churn on the dashboard" became a query, a dashboard tile and tested code in `src/custom/`, with no generated files touched ($0.45). A `newsletter:` section got a project plugin written by AI (a subscriber model with a yes/no per list, an admin page), and regenerating afterwards used no AI ($0.60). Both are also in `pnpm test:apps` with a stand-in model and coder, including a coder that writes outside its folder, which is undone. Studio's in-browser engine loads project plugins too (2026-09-28).

## M14 — Verification, security, deploy and backup targets

- Playwright smoke tests generated from pages.
- Security levels (Fast / Normal / Release) with detected external scanners. Findings are shown and never auto-suppressed.
- `smithable upgrade` and `smithable update --security` through the normal change pipeline.
- Deploy-target and backup-target interfaces, with built-in targets: local Docker, Compose export, remote Docker host over SSH, local-directory and S3-compatible backups. `smithable backup` / `smithable restore`.

**Exit:**
- A self-hosted deploy passes Release checks.
- A backup to an S3-compatible bucket can be restored into a fresh container with no data lost.
- A sample app with custom code upgrades across a stack profile change with tests passing, and a deliberately broken contract is reported, not silently fixed.

**Done (2026-09-27):** all three exit checks pass. `pnpm test:deploy` deploys the CRM after the Release checks (type check, tests, generated smoke tests, OSV-Scanner, Gitleaks, Semgrep, Trivy on the image, ZAP against it running), and a customer survives a backup to an S3-compatible bucket (SeaweedFS), destroying the container and its volume, a fresh deploy and a restore. `pnpm test:apps` upgrades the CRM, with its custom action, from a simulated older stack profile: custom code that no longer fits is reported with its file and name and nothing changes, and after it is updated the upgrade passes its tests as one commit. Getting a fresh app through the Release checks took real fixes: a distroless nonroot image, security headers with a nonce-based CSP, patched esbuild, and a file record that no longer looks like API keys. The SSH deploy target is tested too (2026-09-28): `pnpm test:deploy` deploys over SSH to Docker in a container running sshd.

## M15 — Hosted beta (`smithable-cloud`)

- Accounts with Google sign-in, project storage, and an AI gateway with plan allowances.
- The hosted Builder: Studio in the browser with the engine in the tab, projects in Git repositories on EU servers, and previews in Remote VMs (M8, moved here from M9's exit).
- One-click publish to EU hosting with domains and TLS, on every plan, with spending caps on by default. Managed backups.
- For agencies: a staging environment per app, and transferring a project to the client's own account.
- Automatic rebuild and redeploy for security patches, gated by tests.
- Remote MCP endpoint.
- A public demo that needs no sign-up, showing the change trace, with a limited number of sandboxes.

**Progress:** step 1 (2026-09-27): the infrastructure, in `smithable-cloud` with OpenTofu on AWS Stockholm: one host with Docker and Caddy serving HTTPS, an S3 bucket, daily snapshots. Until a domain is registered it runs at an sslip.io name.

Step 2 (2026-09-27): the service in `smithable-cloud`: invite sign-in, a project list, one gVisor-sandboxed workspace per project running `smithable studio` (which gained `--host` and `--preview-url`), and a proxy with per-address sessions. On AWS an invited tester goes from the invite to a new CRM's Studio in about 30 s and its preview in about 40 s, signs in to the preview and applies an operation. Known rough edge: the first preview load of a new project can hit Vite's one-time dependency reload.

Steps 3, 5 and 6 (2026-09-28): backups of projects (Git history and database), published apps and the service's own data to S3, each with a tested restore (a deleted project came back with its history, spec change and records); the AI gateway (per-project tokens, a monthly allowance per tester, Mistral Medium for apps from a sentence and Small for changes); and publishing: a new CRM was checked, built and live in 75 s, with its security headers, then on a stand-in for the tester's own domain with a certificate made on the first visit. Still open for the exit: a real domain (the service's and a tester's), Google sign-in, and handing a project to a developer through Git. First builds from a sentence still fall back to the chosen starter when the model's draft is invalid (M12's quality).

Then: hand-over (a Git bundle with the whole history that a developer cloned and continued with the CLI, and one-time transfer links that moved an app to a new account), weekly security rebuilds gated by the Normal checks and the tests, a "Publish and share" link from Studio (`studio --home`), and a deterministic repair for drafts whose texts contain ": ".

Then (2026-09-28): the remote MCP endpoint (a per-project token from the project's page; Studio serves MCP over HTTP at `/mcp`, and an agent's change appears in the open Studio), staging per app (publish to `st-<id>`, with its own data, then put exactly that build live), and the public demo (a sandbox from the front page without signing up, with the change trace; three at a time, three per visitor per hour, €0.05 of AI, no publishing, deleted after two hours with everything in it). The route tree no longer changes under a running preview (which blocked the next operation), and local Studio answers only `localhost`.

**Status:** everything in M15 is built and tested on the hosted beta, which runs at https://smithable.ai (2026-09-28) with Google sign-in for invited testers next to invite links. New apps from a starter open in under 2 s (a warm pool of waiting workspaces). What remains of the exit is the exit test itself: an invited tester publishing on their own domain and handing the project to a developer (each part was verified with a stand-in domain).

**Exit:** an invited tester with nothing installed goes from one sentence to a published app on their own domain, and can hand the project to a developer, who continues in Studio or via Git.

## M15.5 — Hardening and pluggability

Between the beta and the launch: what the 2026-09-28 review found, fixed, and the core made pluggable before more features pile onto it (the review's D5: before M16).

- **Review fixes.** Security first (sessions, isolation, cookies, the Docker guard, the AI gateway, limits), then the open-source product (Studio's API, the generated access layer, the coder's confinement, deploy details), then structure, tests and operations (CI, reproducible releases and rollback, backups of running workspaces, alarms, Session Manager logging, S3 Object Lock). Only the Spot host (with per-workspace disk quotas and a host-rebuild drill) is left for later.
- **Pluggability** ([design/plugin-interface.md](design/plugin-interface.md)): companion files, page patterns and landing sections register once; the generator is split behind one `SectionGenerator` with a byte-identity guard; forms come from annotated schemas; plugins get operations, summaries and patches; hook points for plugins' behaviour.
- **AI routing:** tier 0 (everyday wording becomes operations without a model), a model is offered only the operations that can be about its concepts, answers are constrained to each operation's schema, and a cheaper tier's "none" escalates. Every proposal and its outcome are logged, the start of a training set for the Smithable model.

**Progress (2026-09-29):**
- The review's A, B and C sections are fixed, released and verified on the beta. So are its decisions: D1 (published apps on smithable.app; previews stay on smithable.ai), D2 (the service's state in its database, usage sampled), D3 (the typed kit), D4 (referenced titles) and D5 (companions, pattern registries, C7, C8).
- Fable's re-review fixes are done.
- AI routing phases 1–5 are merged.
- Plugins v2 is merged (PR #5), with hook points, mail and invitations (users pages).
- The data page (an admin view of every model's records) is built.
- The calendar page pattern is built, and date-times are in the app's time zone everywhere.
- Booking a place: a capacity on a model, checked where records are written, and the Book and Cancel block. The booking starter takes bookings.
- Articles: Markdown and picture fields, a public read with `where`, and the articles page pattern. The booking starter has a studio blog.
- Hook points, the mail kit, and invitations with a users page (`users: manage`, `selfSignUp: false`; [design/users.md](design/users.md)) are built (2026-09-29).

**Progress (2026-10-01):**
- First builds v2 ([design/first-build.md](design/first-build.md)): one cheap call picks the starter and asks up to three questions; the draft is a batch of operations from an empty app, each checked against its schema; the CLI and the hosted form ask the questions.
- Pictures on records (a `picture` field, uploads named by content, `PictureInput`), rate limits on writes and invitations, and questions about the app answered from the index without a model.
- Themes as files ([design/look.md](design/look.md) §3): `themes/<name>.yml` parsed, derived and contrast-checked in core, a thumbnail per theme, the Look tab's theme cards, `smithable themes`, and `addTheme` through the operation layer.
- Presentation choices, never positions (look.md §1): how a field is entered, form sections and columns, a list's view and order, each landing section's look and a landing page's own theme, with the Look tab's controls for all of them.
- Calculators ([design/calculator.md](design/calculator.md)): a calculator page or landing section with fields, formulas and `PMT`; custom pages and sections (§4) as generated routes around a component in `src/custom/`.
- Third-party notices in every generated app (`LICENSES/`), the legal drafts for the hosted beta (`smithable-cloud/docs/legal/`), the code of conduct and issue and pull-request templates.
- Point-in-time recovery ([design/pitr.md](design/pitr.md)): built in the service (preview, bring back, undo, a Look at an earlier time, restore everything), in core (`dataDiffSql`, `restoreOrder`) and in the CLI (`backup --continuous`, `restore --at`).

**Exit:** a new page pattern or landing section kind touches one module in core and one in the adapter; a project plugin can add operations and a summary; `smithable ask` answers everyday changes without a model and says so; nothing from the review is open except the Spot host.

## M16 — Public launch

- Open-source preparation: license decision with legal review, trademark registration, documentation, published spec and JSON Schema, contributor guide (DCO), security policy, public CI, release process.
- Before the public beta: the look fixes (a cover hero with shortcuts, pictures on cards, a header menu and a footer, scale and rhythm, public pages in the site frame), the marketplace constructs ([design/marketplace.md](design/marketplace.md): several pictures, filters and sort, favourites, contact the owner, the catalogue as the start page) and the live example sites with demo sign-in ([design/showcase.md](design/showcase.md)).
- A status page as the sixth starter (decided 2026-10-02): components with a status, incidents with a flow (investigating, identified, monitoring, resolved), timestamps and a timeline of updates, planned maintenance, and the public page from records sections; past incidents stay readable. Almost all existing constructs; what it exposes is already listed (a timestamp set on a status change, subscribing by email, a filtered records section, a formula over related records). Uptime monitoring is out of scope: a probing fleet and a time series are not what Smithable generates; inbound webhooks (the integrations item) are the bridge, so a monitor's "down" opens an incident draft and a heartbeat keeps a component green.
- Pricing and plans with included allowances, and the hosting provider (EU-owned or AWS), one stack. Pricing is undecided: no prices or plans are set yet.
- The open-source repository went public on 2026-10-10, ahead of the hosted beta, which stays by invitation (#674). From that day npm packages are published with provenance (#493); `smithable` 0.1.0 is on npm (#505), and 0.1.1, with the security fixes, since 2026-10-13 (#565, #586).

**Progress (2026-10-01):** the licences are settled (engine Apache-2.0, app kit and templates 0BSD, DCO), with `LICENSE`, `NOTICE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, the templates and public CI in place, and notices generated into apps.

**Progress (2026-10-02):**
- The five look fixes are built: a `cover` hero with shortcuts (#79), pictures on cards with a placeholder (#81), the site's header menu and footer columns (#83), scale and rhythm with each preset's own shape (#85), and public pages in the site's frame (#86).
- The marketplace core is merged: the `pictures` type, filters and sort, a searchable records section and the catalogue as the start page (#88), then favourites and contacting the owner (#103). Of the adapter steps, several pictures on a record (2.1, #99) and list filters with a server-side sort (2.2, #100) are merged; favourites, contact and the start page come next.
- Demo sign-in for the showcase sites (`DEMO_SIGN_IN=1`, showcase.md §3) is in the engine (#104).
- Sample data: `samples/<Model>.yml` is seeded instead of generated rows, and all four starters have real texts (#90, #91). Sample keys follow renames and removals (#98).
- docs.smithable.ai is up, with the spec reference, the JSON Schema, getting started, AI setup, Why Smithable and the FAQ (#73–#75).
- First builds from a page: `smithable new --from <url> [--with-pictures]` (§2.8, #87 and #96).
- A status page is decided as the sixth starter (#80).
- CI runs the full check for engine changes, once per pull request (#93, #94). `main` is protected, and sessions merge through `scripts/merge-green.sh`, which brings a pull request up to date first (#89, #101).
- The image library is ready for Johan's go: the script, the manifest and the pilot's 48 pictures in `smithable-images`. The theme tools are merged: the theme sheet, a theme from a site and rule-made candidates (#92, #95, #97).

**Progress (2026-10-03):**
- The status page is the sixth starter (#139): components with their state, incidents with updates and the identified, monitoring and resolve actions (starter code that sets the status, its update, the end time and the component), planned maintenance, the public page at `/` with what is going on now apart from what was resolved, and the incident history as articles.
- Every `where` takes a list of choice values, and a landing records section takes `where` (#135); the status page's "going on now" uses both.
- The marketplace is complete on main: favourites, contact the owner, the catalogue as the start page, `mine` pages and the Torget starter with its photographs (#106, #109, #112, #114, #121).
- An owner's background color in the Look tab (`theme.brand.background`, #134): a wash of its hue in both modes, everything on it checked for contrast.
- Existing data in: `importRecords` from a CSV file, with a dry run, one transaction and undo, in the CLI, MCP and Studio (#130).
- Opt-in error reports: `smithable report` and Studio's "Report this" show exactly what would be sent (never records, uploads or custom code), sent to the service hosted or as a GitHub issue (#133, the service's endpoint cloud #43).
- US spelling for the product and every generated text; the crud key is `favorites` (#128).
- npm publishing is ready behind a manual trigger: `smithable`, `create-smithable` and `@smithable/*` with their licences and provenance, a dry run by default; the `NPM_TOKEN` secret is Johan's to set (#137).
- Generated apps pre-bundle their common libraries, and the smoke tests allow 60 s per page, after flakes under load (#136).


**Progress (2026-10-04 to 2026-10-10, with what was merged later on 2026-10-03):**
- Standard actions ([design/actions.md](design/actions.md)): `on`, `when` and `set` on a button, asking for a value, adding a related record, copy with its lists, `ME()`, chosen rows and delete (#184, #190, #194, #196); `setAction` and `removeAction`, and Builder's forms for them (#285, #292). The status starter needs no custom code any more (#190).
- Email sign-in: a code by mail, the starters on email, and the maker as the first administrator (#177, #182); `setAdmins` and `setProviders` (#177, #184).
- Logs ([design/logging.md](design/logging.md)): one trace id per request and an access line, the app log with an error page that quotes its reference, the audit log written in the change's own transaction, with a line kept 12 months and the client's address and browser blanked after 90 days, Activity on the data page and a record's history for administrators (#214, #216, #218, #221, #222, #223, #224). Error reports carry the trace id of the request that failed (#450).
- Talking to other systems ([design/integrations.md](design/integrations.md)): keys made by an administrator on the users page (#225), `/api/v1` for the offered models and actions with an OpenAPI description (#230), the same as tools for AI assistants at `/mcp` (#235), and a call without a key read as the visitor (#260, #271). The tools became seven general ones (find, measure, read, add, change, run, describe) with filters, search, sort and sums (#280), after a bench showed a fifth to a third fewer tokens per question with as many right answers or nearly (#295). An app that is only an API, and the api starter (#248, #282).
- Ask, the assistant in an app ([design/assistant.md](design/assistant.md)): the `assistant` block in the auth file (#275), the administrator's inspector that asks the app as a role (#303), Ask for the people who use the app (#309), changes it proposes made only when the person confirms (#316), a visitor's Ask that only reads (#318), and answers read aloud by the browser's own speech (#308).
- Outgoing, first steps: who is told when something happens to a record, mail first (#400, #401), signed calls to named targets (#404), and warnings where a mail would meet the access rules (#407). A hosted app calls only the addresses its owner named, on ports 80 and 443 (#286, #289).
- The security review of 2026-10-04 (see [as-built.md](as-built.md)): the stack's pins and checks (#284), advisories read at their source (#288, #425), who owns a record told only to those who may know (#294), a 1 MB request body (#296), sign-in limits by the visitor's real address (#300), `__Host-` cookies over https (#321), the remaining attacks as named gate checks (#293, #307), and warnings on fields that look like card data, secrets, identity numbers or health data (#278). More fixes in generated apps followed (#461).
- New constructs: attachments as `file` and `files` fields (#394), paging (#384), trash with restore (#413, #414, #423), deleting a record others point to as a group (#448), a CSV export of a list as filtered (#408), analytics as a setting with a consent bar (#396), a privacy page written from the app (#412), page titles, descriptions and `sitemap.xml` (#409), and who may do what in `smithable.auth.yml` (#456).
- Files reviewed before others see them ([design/file-review.md](design/file-review.md)): `review` on a model, the Review page and the `review` grant (#466, #468); the marketplace's items wait for their photos (#469).
- The app's language: every English word of the app kit and the generator moved into words files (#383, #388, #390), with `pnpm lint` failing on new ones (#392), `language` in the content file, Swedish as the first other language, and a Swedish description drafting a Swedish app (#385, #395, #398).
- Studio: the findings of a first-time owner's walkthrough (#324), among them Redo, access in the person's words and renaming a kind of record (#338, #339, #344); Studio at once while a described app is made (#368, #372); Code mode's spec editor with colours, problems in the text, suggestions and every companion file (#375, #376, #378, #387); the Studio guide (#410, #418); Studio on a phone (#417); the Outbox of what the preview keeps instead of sending (#449); the system's dark setting (#459).
- Looks: nine more built-in themes, thirteen in all (#229); `motion` as a theme value (#245); a mark for every app (#474); pictures an AI made carry a badge the owner can switch off (#483).
- First builds: where a model may run is a setting, not the default (#227); a starter's own description, or a small edit of it, builds with no model (#323, #329); asked to, Studio reads a description itself and asks only what it leaves open (#369).
- CI and releases: the full check on the self-hosted runner (#415), one gate at a time on the machine with turns going round (#161, #336, #337), every action pinned by commit (#460), and a `CHANGELOG.md` with 0.1.0 and the compatibility rule (#495).

**Progress (2026-10-11 to 2026-10-17):**
- Ask on by default for everyone who signs in, with its texts and manner in the spec and its place in the Who can tab (#522, #525, #529). Ask answers only what a tool said ([design/ask-checks.md](design/ask-checks.md)): tools that leave no room (#620, #630), and an answer checked against the tools, sent back with the reason and else shown as unconfirmed (#621, #625).
- Outgoing calls connect only to an address the guard checked (#555), carry an idempotency key and understand the egress proxy's answers (#568); an administrator sees a target's deliveries in Activity (#569). The how-to "Mail and calls out" (#570).
- Into the app: incoming calls at an address other services call (#541), and a mail that becomes a record, `incoming mail: true` (#543, docs #575).
- Uploads: a record takes a new file only with its upload's receipt (#559); uploads never saved are swept away and an app's storage can be bounded (#563). Bounded memory for the change limit and Studio's request bodies (#556). Property-based tests, and the status app's API and `/mcp` fuzzed with random bodies (#550, #551). Code scanning's first findings fixed (#506, #546), and a security check that cannot run to its end fails as not checked (#554).
- Who can: permissions in Builder, and `setDomains` (#515). Every proposal is shown before it applies, and custom code is announced (#520).
- Studio's changes in one tab, with edits that save themselves (#518, #521). Then Studio v3 ([design/studio-v3.md](design/studio-v3.md)): five windows, Smith, Changes and Troubleshoot (#698), Code that saves when it is left (#699), a creation wizard with Ask Smith (#700), any change undone by its X (#701, on `smithable undo --change`, #691), Smith's ready prompts answered from the docs (#705), and a phone's swipes (#709). Formatting is never a change (#694).
- What it does from the spec ([design/what-it-does.md](design/what-it-does.md)): every setting as a control that writes through its own operation (#653, #657, #658, #661–#667), with `renameModel` and `renamePage` keeping the rows (#675, #679). Notes: advice on a valid spec, each with the operation that does it, applied from Studio (#602, #619).
- Languages ([design/languages.md](design/languages.md)): an app in several languages with the language in the path (#633, #634, #636), each person's own language kept for their pages and mail (#647), Studio's Languages tab (#648), a first draft of a language by the model (`smithable translate`, #652), and a first build in two languages (#655).
- Rules on a record: locked and required while a condition holds, `ME()` as a default, `LAST` and `FIRST` of a list (#613, #614, #616). A record's conversation with a reply box and unread marks (#617, #622), mail threads where a reply joins its request (#623), and the support starter (#626).
- Orders ([design/orders.md](design/orders.md)): a number counting up, `sequence: true` (#649), the order page where visitors choose and send one order (#650), and the kiosk starter (#651).
- The theme lab ([design/theme-lab.md](design/theme-lab.md)): a theme's style fields, four fonts and three styles (#577, #578), the preview taking a theme without a regeneration (#580), `smithable theme lab` (#587), and its public mode on docs.smithable.ai (#645).
- The hosted level reaches the engine (`SMITHABLE_HOSTED_LEVEL`): `validate` warns on sign-in providers a Strict app may not use, and the release checks name the level and the app's connections (#642).
- Every value written once in a generated app (#704, #711), with `scripts/measure-duplicates.mjs` (#708).
- The docs site: search on every page (#682), keys in the spec reference that link to their sections (#639), a description and preview tags on every page (#646), and a front page for the repository (#509).

**Progress (2026-10-18 to 2026-10-24):**
- Timers ([design/timed-actions.md](design/timed-actions.md)): what the app does on a clock, in the spec (#766); the generated app's minute tick, each run taken once, `smithable timers` and `timers run`, and the booking and invoicing starters' reminders, overdue marks and publishing (#770); runs taken back after a failure or a stopped process (#774), and fixes to calendar days, cron steps and stale tries (#779, #782).
- A record's name from its parts (`namedBy` with a reference, a path or a list), in core and in the app, searchable by its words (#768, #772, #783), and in Ask (#784). What the engine infers it reads from the spec's shape, never from names (#732).
- Pages as a list of sections, and a page's frame, in core, the app and Studio (#765, #773).
- Where a value is unique, and fields unique together (#725, #787, #793); sequence numbers from a counter, never given twice (#723).
- Appointments, one person's time booked without two at once (#731), and the barbers starter (#743). The booking starter's sessions page for staff, who may book for a member (#742, #746); a capacity and cancelling that close before the session (#754).
- Why a role or a visitor may or may not do something, explained by core (#747); Studio's app map: Who can's Why?, a data map, a navigation view with Copy as Mermaid, the behaviour view, and Visualize over the whole window (#756, #789, #790, #797, #800).
- `validate --explain` and `validate --write` (#728, #735); an action sets a field the form cannot (#737); an action's `when` on a reference (#778).
- Generated apps: sign-in, keys and request handling tightened (#727), and more hardening after a second reviewer's read (#805). Studio's token compared hashed and stripped from the preview's requests (#710, #733, #738).
- Looks: three more presets (#741), Appearance (System, Light or Dark) chosen by the visitor from the first paint (#748), corner radii in steps (#751), a third density (#763), and the theme lab showing any starter (#745).
- Filters: relative dates, a default filter per page and which filters show first (#762, #770).
- Mail: an outgoing mail reaches every record of a list (#759), and a change that mails people asks first (#792).
- `smithable static`: an app's pages as static files (#740).
- Smith and Ask keep the conversation and answer small talk (#798, #804).
- The gate runs what a change needs (`--plan`, #767) and waits longer under load (#720); CI's full check is off for pull requests, and the local gate is the one full check per change (#764).

**Progress (2026-10-25 to 2026-10-31):**
- Sample users who act ([design/sample-users.md](design/sample-users.md)): the moves a sample user may make, read from the spec, a seeded walk, and `samples/people.yml` with its operations (#882, #897); the development door the host acts through (#888, #901); the runner and panel in Studio's preview, Follow, and `smithable preview --live` (#896, #898, #900); sensible and try-everything runs (#904, #907, #910).
- Named intents ([design/intents.md](design/intents.md)): the merge kind, the person picking the record that stays or combining into a new one (#909, #918, #919), split (#911), aggregations (#912), and a custom action's contract, touches and examples (#913, #917), through the API, Ask and the sample users (#915), with Studio's pickers and a picture drawn from the contract (#920, #922, #935).
- Custom actions on the rows picked: from a list's selection bar, and for programs and assistants through the API, OpenAPI, MCP and Ask (#849, #859, #860, #870).
- Outgoing templates: placeholders in a mail's words, with Studio's fields and preview (#863, #866, #867, #869); outgoing after a custom action, and `tell` and `tellMail` for custom code (#850).
- Smith first ([design/smith-first.md](design/smith-first.md)): Smith and the preview by default (#853), Smith's presentation of an app in five parts, read from its files by rule (#851), the draft saying what it assumed (#852), the guide as Smith's lines (#856, #929), and the presentation on an overlay for a new project (#928).
- Ask learns the app's words: `setMeaning`, the fields a question may read two ways, and `samples/ask.yml` for the Ask check's questions (#881, #884, #899); the time now and the app's time zone in its prompt (#876, #891).
- Looks ([design/look-gap.md](design/look-gap.md), [design/look-breadth.md](design/look-breadth.md)): bands, a photo hero, columns and centered headings (#811, #821, #827); twelve more hosted fonts and a wider style layer (#945, #950); the other mode made from one (#947); candidate themes from two open catalogs (#946); the menu across the top, filters as chips, a start page with what is due, coloured calendar blocks, stage and inset heroes, a ledger section, and in-place list editing (#952, #953, #959, #960, #966, #967, #978); the starters' own looks (#949, #973).
- A demo gives each visitor a copy of the data of their own (#839).
- Incoming calls: a service's own signing, form bodies and a setup check (#905), with integration recipes in the docs (#906).
- Generated apps: indexes on references and owners (#807); a landing page sends each section only the rows it shows (#813); sign-in redirects that cannot leave the app (#892, #893); a page a role may not open answers 403 (#957). A filter on a reference with many records is a search (#942).
- Pictures: the library's photographs carry no AI badge and are credited (#826); the marketplace starter has real photographs (#828).
- The CLI: a command reference on the docs site generated from its own help (#962); NOTICE, SECURITY and CONTRIBUTING brought up to date (#930).

**Progress (2026-11-01 to 2026-11-07):**
- Times and formats: how times are written and a new app's time zone, confirmed once (#1014, #1016), a person's own time zone and clock (#1022, #1024), and date order, the first day of the week and numbers written by the kit (#1043).
- Reports ([design/reports.md](design/reports.md)): a list mail on a clock timer, and the booking starter's morning mail (#1028, #1031); a dashboard's period (#1026); exports named by their page and day, with `export: false` (#1023).
- From a website: a first build as a durable job, and a reader that turns a bounded site into facts, never its prose, with checked copy and reviewed pictures (#1034, #1035); personal details on the site replaced with sample values before any model (#1040, #1046).
- The kit's usability: a round of UI and UX fixes (#1008), page checks for unique ids and titles, touch sizes on phones and React warnings (#1015, #1042), field edges at 3:1 (#1001), convention gaps closed (no orphan page, a way back, search and sort, a footer; #1004).
- Security fixes in generated apps (#1033); incoming deliveries taken once and their attachments stored (#1009).
- Looks: a calendar's agenda and day views and filters (#988, #990), a records section as a week (#991), a record's pictures large (#993), how the menu marks the open page (#994), a hero's height and a tiles hero (#985, #995), and a record page that leads with its thread (#996).
- The support portal's path through the spec (#1012), with an owner that is an address or one reference away (#1018).
- The result of a change, verified ([design/change-verified.md](design/change-verified.md)): what a change will do and what was checked, in the CLI and through MCP (#1057, #1059).
- The app card ([design/app-card.md](design/app-card.md)) in the CLI and Studio's Map (#1056, #1061); Smith tells the history and undoes, and every change has a number (#1065); milestones and one-line summaries in Changes (#1052).
- Designs for what comes next: speech for Smith (#1053, #1060), notifications that reach staff (#1064), and an assistant on the site from its own words (#1062).
- The development door's secret can be given, so a tester outside Studio can start the preview and act as sample users (#1005).
- CI: a fork's engine pull request is not green without the full check (#1021); `AGENTS.md` points every coding agent at `CLAUDE.md` (#1010).

**Progress (2026-11-08 to 2026-11-10):**
- Payments ([design/payments.md](design/payments.md)): the `payments` section, the Payment model and its states (#1081); pay to create, with a fake provider for development and tests (#1103); paying for an existing record, refunds and the Payments page (#1105); Stripe and Mollie behind one interface (#1106); a staging copy that previews the flow with the fake (#1108); disputes and chargebacks noted on the Payment (#1109).
- Notifications ([design/notifications.md](design/notifications.md)): `push` and `sms` as channels beside mail (#1080), live notices with sound for whoever has the app open (#1082), browser push (#1093), and texts through the owner's SMS provider (#1096); the kiosk's staff are told which order came in (#1101). Outboxes write each mail and text whole (#1107).
- Speech for Smith ([design/smith-speech.md](design/smith-speech.md)): Smith hears and speaks, where the AI policy allows, saying first where the voice goes (#1073); automatic listening with a voice detector and a speech test mode (#1078).
- Ask Smith on the docs site: a panel that answers from the site's own words (#1090).
- Fixes that reach built apps: fix files, `smithable affected`, and the rule that a change to what apps get carries one (#1070, #1088, #1102); Studio opens a held fix (#1095, #1097).
- Studio shows what a change verified (#1069); the app card in the app, for administrators (#1071); a project has a history from the moment it is made (#1074); Leave feedback, from the header and from Smith (#1075).
- Import records from a file in the app, the API and the CLI, with undo (#1083, #1084, #1086).
- Random tests: a weekly long run, the undo round trip as a property, and the type check after random changes (#1087, #1091, #1094). An upgrade says what a destructive migration loses (#1092).
- The stack: the sign-in library's security fixes (#1098), and TanStack Start and Vite bumps (#1099).

---

## Later (not before M16)

- **Candidate milestone: company websites** (proposal, 2026-09-28). A company site (e.g. el.ax) as an app that is mostly content: fixed pages built from sections, plus small content models staff edit (news, notices, prices, contacts, jobs) and forms, all with Smithable's access rules, validation and backups: a site, its CMS and its app in one, owned and EU-hosted. Curated, professional sections rather than free-form design. In order: images and media (upload, replace, crop, alt text, responsive sizes); more section types (text with image, gallery, contact form, map, team, news list, logos, footer) and rich text as Markdown; click-to-edit texts and images in the preview; menu and layout variants in `smithable.ux.yml`; and site essentials (SEO and sitemap, social images, cookie consent, languages as one content file per language, prerendered static pages). Each new construct passes ARCHITECTURE §2.4 first. After the beta has shown the app side works.
- **Smithing as the product's voice** (idea, 2026-09-27): names for the tiers in the change trace ("hammer" for operations without AI, "small anvil" for a local model, "big anvil" for hosted and frontier models, always with the plain name beside them), and a small animated smith at the anvil while a change is being made, drawn as SVG/CSS (a still image with reduced motion, and the status as text for screen readers). Designed with the design system, for Studio's polish.

- **Apps in other languages** (decided 2026-10-03: not for the beta, which is English). The principle when it comes: language is data, never code and never database fields. Names in the spec, columns and routes stay as they are; everything a person reads is a label looked up in a language file: the app's own texts (already in `smithable.content.yml`) and the words the generated app brings itself (Save, Search, the sign-in page, validation messages), which move out of the kit's code into such files, one per language, with dates and numbers formatted by the language. Translations are generated once by the configured model and kept as files that can be read and corrected. Until then a first build writes its labels and texts in the description's language, and the built-in words are English.
- A desktop app (Electron) for local-first non-developers with one-click local model download.
- Teams and collaboration.
- In-browser local model (WebGPU) for small intent tasks.
- A fine-tuned Smithable model, possibly with open weights.
- A public plugin API, based on the internal plugins and real project plugins.
- A second adapter, and a public adapter API based on two real implementations.
- Scalable deployment mode (PostgreSQL, S3, multiple instances).
- Integrations, external endpoints (OpenAPI), events (AsyncAPI).
- Importing existing projects.
