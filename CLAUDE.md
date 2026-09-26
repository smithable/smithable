# Smithable

Local-first, manifest-driven app builder. Read `docs/VISION.md` for the why, `docs/ARCHITECTURE.md` for decisions, and `docs/ROADMAP.md` for the current milestone. Architecture changes must update `docs/ARCHITECTURE.md` in the same change.

## Development

- Node 24 (`.node-version`, managed with fnm) and pnpm (version pinned in `package.json`).
- `pnpm install`, then:
  - `pnpm build`: `tsc -b` over the project references in `tsconfig.json`.
  - `pnpm test`: Vitest, tests live next to the code as `src/**/*.test.ts`.
  - `pnpm lint`: Biome lint and format check. `pnpm fix` applies fixes.
  - `pnpm test:apps`: generates every example in `examples/` into a temporary directory, then type-checks, builds, serves and regenerates it.
  - `pnpm check`: lint + build + test + test:apps. This is the CI gate and must pass before every commit.
  - `pnpm schema`: regenerate `packages/core/schema/smithable.schema.json` after changing a section's schema. A test fails if it is stale.
- App templates live in `packages/adapter-tanstack/templates/` as real files; `pnpm build` embeds them (and the example specs used as starters) via `scripts/embed.mjs`. Generated `*.gen.ts` files are never edited by hand.
- The spec reference is `docs/spec/v0.1.md`. Update it together with any change to the spec grammar.
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
