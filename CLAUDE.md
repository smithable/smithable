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
  - `node scripts/theme-sheet.mjs [preset | themes/<name>.yml …] [--out <dir>]`: the theme sheet. Makes a booking app with every form control, applies each theme through the operation layer, and screenshots the landing page, a list, a form and a dialog in light and dark into one PNG per theme (default `/mnt/c/Users/johan/Pictures/claude/themes/`, port 5402). Without themes it shoots the four presets. Not part of `check`.
  - A theme from a site, for the sheet: `smithable theme --from <url> --name <x>` in a project adds `themes/<x>.yml`, then `node scripts/theme-sheet.mjs <project>/themes/<x>.yml`.
  - `node scripts/theme-candidates.mjs [family…] [--out dir] [--sheets]`: theme candidates by rule (ten families: primary hues, OKLCH lightness ladders for both modes, an accent from a harmony, font, radius, shadow, density). Each is checked like any theme and the unreadable are dropped. Writes the theme files and a thumbnail overview, and with `--sheets` the theme sheet of each survivor. No model, not part of `check`.
  - `pnpm site`: builds docs.smithable.ai into `site/` (the pages in `docs/site/`, the spec reference and the JSON Schema), failing on a dead link. smithable-cloud's Docs workflow publishes it, with `SITE_PRERELEASE=1` (every page `noindex`) until the public release.
  - `pnpm check`: lint + build + test + site + test:apps + test:studio. This is the gate. CI runs the full check for engine changes (`packages/`, `apps/`, `examples/`, the scripts `check` runs, the dependencies, the workflow) and lint, build, units and site for the rest, once per pull request and on pushes to main; the local run stays required before an engine commit. For a change to docs or to tooling scripts `check` does not run, CI's run on the pull request is the gate, so several sessions can work at once without queuing on one machine's gate.
  - `scripts/merge-green.sh <pr>`: merges a pull request only after every check has passed: brings one that is behind main up to date, then arms GitHub's auto-merge so it merges the moment its checks pass (and goes round again if another merge put it behind), refuses on a failure, conflicts, or when none ran. Sessions merge with this and nothing else, since an administrator's merge passes branch protection by.
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
