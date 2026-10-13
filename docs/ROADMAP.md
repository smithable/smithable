# Smithable — Roadmap

Planned for one developer working with AI coding agents. Milestones are small and ordered so that each one produces something runnable. Each has **exit criteria**, and a milestone is done only when all of them hold. The running example throughout is the CRM in `examples/crm`.

**Done:** M0, M1, M2, M3, M4, M6, M7, M7.5, M8, M11, M13, M14. **In progress:** M9 (usability tests), M10 (approval of the built apps), M12 (needs real models). **In progress:** M5 (everything but the sign-in with a real Google account).

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
- The open-source repository goes public together with the hosted beta.

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
