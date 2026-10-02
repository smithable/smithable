# Smithable

Local-first, manifest-driven app builder. Read `docs/VISION.md` for the why, `docs/ARCHITECTURE.md` for decisions, and `docs/ROADMAP.md` for the current milestone. Architecture changes must update `docs/ARCHITECTURE.md` in the same change.

## Development

- Node 24 (`.node-version`, managed with fnm) and pnpm (version pinned in `package.json`).
- `pnpm install`, then:
  - `pnpm build`: `tsc -b` over the project references in `tsconfig.json`.
  - `pnpm test`: Vitest, tests live next to the code as `src/**/*.test.ts`.
  - `pnpm lint`: Biome lint and format check. `pnpm fix` applies fixes.
  - `pnpm test:apps`: generates every example in `examples/` into a temporary directory, then type-checks, builds, serves and regenerates it, one process per example in parallel. `pnpm test:apps:one <example>` runs one.
  - `pnpm test:studio`: runs `smithable studio` on a new CRM and makes the M3–M5 changes in both modes in a real browser.
  - `pnpm test:container` (needs Docker): builds the CRM image and checks that data survives replacing the container. Not part of `check`.
  - `pnpm test:deploy` (needs Docker): deploys the CRM after the Release checks, backs it up to an S3-compatible bucket (SeaweedFS), destroys it and restores it into a fresh container; also the Compose export and a folder backup. Not part of `check`.
  - `node scripts/bench-m3.mjs`: the M3 mini-benchmark (Smithable operations vs Claude Code headless on the same tasks). Uses the user's Claude usage; ask before running. Writes `docs/benchmarks/m3-mini.md`.
  - `node scripts/bench-m7.mjs [S] [A] [B] [M]`: the M7 benchmark (seven tasks by Smithable operations, plain Claude Code, Claude Code with MCP, and `smithable ask` with the configured model). S is free; A and B use the user's Claude usage and M the configured model's, so ask before running them. Writes `docs/benchmarks/m7.md` (or `m7-<setups>.md`).
  - `node scripts/bench-m12.mjs`: M12 first builds: ten descriptions through `smithable new --describe` with the configured model (see `docs/ai.md`). Ask before running with a paid model. Writes `docs/benchmarks/m12-first-builds-<model>.md`.
  - `node scripts/bench-m6.mjs`: the M6 exit check (Claude Code headless with only the Smithable MCP server). Uses the user's Claude usage; ask before running. Writes `docs/benchmarks/m6-mcp.md`.
  - `pnpm site`: builds docs.smithable.ai into `site/` (the pages in `docs/site/`, the spec reference and the JSON Schema), failing on a dead link. smithable-cloud's Docs workflow publishes it.
  - `pnpm check`: lint + build + test + site + test:apps + test:studio. This is the gate: it must pass locally before every commit that touches `packages/`, `apps/` or the scripts `check` runs; for a change to docs only, or to tooling scripts `check` does not run, CI's run of it on the pull request is the gate (it runs on every push and pull request), so several sessions can work at once without queuing on one machine's gate.
  - `scripts/merge-green.sh <pr>`: merges a pull request only after every check has passed (waits for pending ones, refuses on a failure or when none ran). Sessions merge with this and nothing else, since the repository has no branch protection yet.
  - `pnpm schema`: regenerate `packages/core/schema/smithable.schema.json` after changing a section's schema. A test fails if it is stale.
- App templates live in `packages/adapter-tanstack/templates/` as real files; `pnpm build` embeds them (and the example specs used as starters) via `scripts/embed.mjs`. Generated `*.gen.ts` files are never edited by hand.
- The spec reference is `docs/spec/v0.1.md`. Update it together with any change to the spec grammar.
- The Studio web app (Builder and Studio modes) is `apps/studio` (React + Vite); `pnpm build` builds it, and `smithable studio` serves it.
- New packages go in `packages/<name>` with a `tsconfig.json` extending `tsconfig.base.json`. Add them to the root `tsconfig.json` references.

## Rules when working on Smithable

1. `smithable.yml` is authoritative for functionality. Companions: `smithable.auth.yml` (sign-in, roles), `smithable.ux.yml` (presentation), `smithable.content.yml` (visible text), `smithable.context.yml` (implementation policy; the only one that may name technologies). Never mix their concerns.
2. All semantic changes go through the operation layer. No client writes the manifest files or app code any other way.
3. Deterministic before AI, then the cheapest capable model: local (if available) → Smithable model (EU-hosted) → frontier. EU-hosted by default.
4. **Generated apps must never depend on Smithable packages**, either at runtime or at build time. Generated code follows each library's documented idioms (Drizzle schema, TanStack routes, shadcn/ui). Shared behavior goes in the small, no-magic in-repo app kit.
5. Respect the ownership zones: the compiler never overwrites `src/custom/**` or existing migrations, and neither AI nor humans are expected to edit generated or kit files.
6. Generation must be deterministic and idempotent: identical input produces byte-identical output.
7. Framework knowledge lives in the adapter; the manifest, IR and operations stay framework-neutral.
8. Engine packages (`core`, `adapter-tanstack`, `index`) must run in the browser as well as Node: no Node built-in imports, I/O only through the host interface. Only host packages (`cli`, `daemon`) touch disk, Git or processes.
9. Do not add DSL constructs without passing the five questions in ARCHITECTURE §2.4. Built-in features are internal plugins (ARCHITECTURE §5.1): each spec section registers its schema, operations and generator through the plugin interface.
10. Keep code (Smithable's and generated) concise. No abstraction before a concrete second use.
11. Every change must be undoable. Never suppress test or security findings.
12. Build incrementally; each roadmap milestone's exit criteria must be verified by tests.

## Git

- Never add `Co-Authored-By: Claude` (or any other AI attribution) to commit messages or PR descriptions.
