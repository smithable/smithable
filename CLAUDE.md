# Smithable

Local-first, manifest-driven app builder. Read `docs/VISION.md` for the why, `docs/ARCHITECTURE.md` for decisions, and `docs/ROADMAP.md` for the current milestone. Architecture changes must update `docs/ARCHITECTURE.md` in the same change.

## Development

- Node 24 (`.node-version`, managed with fnm) and pnpm (version pinned in `package.json`).
- `pnpm install`, then `pnpm build` (`tsc -b`), `pnpm test` (Vitest, tests beside the code as `src/**/*.test.ts`), `pnpm lint` (Biome and `scripts/kit-words.mjs`; `pnpm fix` applies Biome's fixes), `pnpm schema` after changing a section's schema.
- Every other command (the example apps, Studio, containers, benchmarks, the site, the picture and theme scripts): [docs/development.md](docs/development.md).
- `pnpm check` is the gate. For an engine change (`packages/`, `apps/`, `examples/`, the scripts
  `check` runs, the dependencies, the workflow), `scripts/gate.sh` exiting 0 is required before the
  commit, or CI's full check when the gate queue is too long. The site's pages, the spec reference
  and tooling scripts `check` does not run are gated by CI on the pull request. Plain documents
  (the list is in `ci.yml`) start no CI run; merge-green merges a pull request of those alone itself.
- A push to main starts no run; main gets the full check on its own schedule, which is where two
  changes that only clash together show, since a pull request is not run again for being behind main.
- Merge only with `scripts/merge-green.sh <pr>`, one at a time on the machine; it is the only
  administrator's merge a session makes (Johan, 2026-10-05).
- How the gate queues, its exit codes, ports and night cap, and how merge-green handles plain
  documents and generated-file conflicts: `docs/development.md`.
- App templates live in `packages/adapter-tanstack/templates/` as real files; `pnpm build` embeds them (and the example specs used as starters) via `scripts/embed.mjs`. Generated `*.gen.ts` files are never edited by hand.
- The spec reference is `docs/spec/v0.1.md`. Update it together with any change to the spec grammar.
- The Studio web app (Builder and Studio modes) is `apps/studio` (React + Vite); `pnpm build` builds it, and `smithable studio` serves it.
- New packages go in `packages/<name>` with a `tsconfig.json` extending `tsconfig.base.json`. Add them to the root `tsconfig.json` references.

## Rules when working on Smithable

1. `smithable.yml` is authoritative for functionality. Companions: `smithable.auth.yml` (sign-in, roles), `smithable.ux.yml` (presentation), `smithable.content.yml` (visible text), `smithable.context.yml` (implementation policy; the only one that may name technologies). Never mix their concerns.
2. All semantic changes go through the operation layer. No client writes the manifest files or app code any other way.
3. Deterministic before AI, then the cheapest capable model: local (if available) → Smithable model → frontier. Where a model may run is a setting, the AI policy (`local-only`, `eu-only`, `best-available`; nothing said means the best model configured; the hosted service's levels map onto them, Strict and Normal to `eu-only`, Relaxed and global to `best-available`). Global is the default (smithable.ai; the best model for the job, through Anthropic's own API), and the EU is a region an account or a project chooses: the default on smithable.eu, with a level per EU app (Strict, Normal, Relaxed), the most relaxed of which allows Anthropic in the US (Johan, 2026-10-25).
4. **Generated apps must never depend on Smithable packages**, either at runtime or at build time. Generated code follows each library's documented idioms (Drizzle schema, TanStack routes, shadcn/ui). Shared behavior goes in the small, no-magic in-repo app kit.
5. Respect the ownership zones: the compiler never overwrites `src/custom/**` or existing migrations, and neither AI nor humans are expected to edit generated or kit files.
6. Generation must be deterministic and idempotent: identical input produces byte-identical output.
7. Framework knowledge lives in the adapter; the manifest, IR and operations stay framework-neutral.
8. Engine packages (`core`, `adapter-tanstack`, `index`) must run in the browser as well as Node: no Node built-in imports, I/O only through the host interface. Only host packages (`cli`, `daemon`) touch disk, Git or processes.
9. Do not add DSL constructs without passing the five questions in ARCHITECTURE §2.4. Built-in features are internal plugins (ARCHITECTURE §5.1): each spec section registers its schema, operations and generator through the plugin interface.
10. Keep code (Smithable's and generated) concise. No abstraction before a concrete second use.
11. Every change must be possible to undo. Never suppress test or security findings.
12. Build incrementally; each roadmap milestone's exit criteria must be verified by tests.

## Git

- Every commit ends with two trailers in its last paragraph: `Signed-off-by: Johan Ekenlycka <johan@smithable.ai>` (the Developer Certificate of Origin, .github/CONTRIBUTING.md) and `Co-Authored-By: Claude <model> <noreply@anthropic.com>`. Commits made by scripts carry them too. GitHub's merge commits and bots' commits are the only exceptions (Johan, 2026-10-13).
