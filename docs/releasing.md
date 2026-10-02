# Releasing to npm

The engine is published as `smithable` (the CLI), `create-smithable` (`npm create smithable`) and the packages under `@smithable/` (`core`, `adapter-tanstack`, `index`, `ai`). Nothing is published until a release is run by hand.

- **How:** Actions → Publish → Run workflow, with the version (like `0.1.0`). The box "dry run" is ticked by default: the packages are built, tested and packed, and nothing is uploaded. Untick it to publish.
- **What happens:** `scripts/set-version.mjs` stamps the version into every package and the CLI's `VERSION` (not committed: the repository stays at 0.0.0, which generated apps record until the first release), then build, units, and `pnpm publish` for every package with provenance. Before packing, `scripts/prepack.mjs` copies LICENSE and NOTICE into each package and the built Studio app into the CLI (`studio/`, which it serves when installed).
- **Licences:** Apache-2.0 for the engine; `@smithable/adapter-tanstack` is `Apache-2.0 AND 0BSD`, its app kit and templates being 0BSD (KIT-LICENSE).
- **Needs:** the `NPM_TOKEN` secret, an automation token of the release account that owns `smithable`, `create-smithable` and the `@smithable` org (not a personal account). Provenance needs nothing more: the workflow has `id-token: write`.
- **After the first real release:** deprecate the placeholders, `npm deprecate smithable@"<0.1.0" "Placeholder, use 0.1.0 or later"` and the same for `create-smithable`. Never unpublish every version of either: that frees the name.
