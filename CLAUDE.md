# Smithable

Local-first, manifest-driven app builder. Read `docs/VISION.md` for the why, `docs/ARCHITECTURE.md` for decisions, and `docs/ROADMAP.md` for the current milestone. Architecture changes must update `docs/ARCHITECTURE.md` in the same change.

## Development

- Node 24 (`.node-version`, managed with fnm) and pnpm (version pinned in `package.json`).
- `pnpm install`, then:
  - `pnpm build`: `tsc -b` over the project references in `tsconfig.json`.
  - `pnpm test`: Vitest, tests live next to the code as `src/**/*.test.ts`.
  - `pnpm lint`: Biome lint and format check. `pnpm fix` applies fixes.
  - `pnpm check`: lint + build + test. This is the CI gate and must pass before every commit.
- New packages go in `packages/<name>` with a `tsconfig.json` extending `tsconfig.base.json`. Add them to the root `tsconfig.json` references.

## Rules when working on Smithable

1. `smithable.yml` is authoritative for functionality. Companions: `smithable.auth.yml` (sign-in, roles), `smithable.ux.yml` (presentation), `smithable.context.yml` (implementation policy; the only one that may name technologies). Never mix their concerns.
2. All semantic changes go through the operation layer. No client writes the manifest files or app code any other way.
3. Deterministic before AI; local AI before remote; EU-hosted before other remote.
4. **Generated apps must never depend on Smithable packages**, either at runtime or at build time. Generated code follows each library's documented idioms (Drizzle schema, TanStack routes, shadcn/ui). Shared behavior goes in the small, no-magic in-repo app kit.
5. Respect the ownership zones: the compiler never overwrites `src/custom/**` or existing migrations, and neither AI nor humans are expected to edit generated or kit files.
6. Generation must be deterministic and idempotent: identical input produces byte-identical output.
7. Framework knowledge lives in the adapter; the manifest, IR and operations stay framework-neutral.
8. Do not add DSL constructs without passing the five questions in ARCHITECTURE §2.4.
9. Keep code (Smithable's and generated) concise. No abstraction before a concrete second use.
10. Every change must be undoable. Never suppress test or security findings.
11. Build incrementally; each roadmap milestone's exit criteria must be verified by tests.

## Git

- Never add `Co-Authored-By: Claude` (or any other AI attribution) to commit messages or PR descriptions.
