# Making the repository public (checklist)

Status: 2026-09-30, Fable. The mechanical part of M16's "open-source preparation" is in the same pull request as this document; what remains is listed with who does it. The repository goes public together with the hosted beta (ROADMAP M16), but nothing here depends on the beta's exit test, so it can be done first.

## Done in this pull request

- **Licences as the README stated them:** `LICENSE` (Apache-2.0, the canonical text), `packages/adapter-tanstack/KIT-LICENSE` (0BSD for the app kit and templates, so generated apps carry no obligations), `NOTICE`, and a Licence section in the README. Legal review may still change the choice; the files are then the only thing to replace.
- **`SECURITY.md`**: where to report (security@smithable.ai), what is in scope (this repository, generated apps, the hosted beta), what generated apps do for safety, supported versions.
- **`CONTRIBUTING.md`**: read the vision, the architecture and CLAUDE.md first; design note before spec or pattern changes; `pnpm check` as the gate; DCO sign-off (`git commit -s`).
- **Secrets in the history:** Gitleaks v8.30.1 over every commit found three matches, all placeholder values in test scripts (`test-secret-…`, `bench-secret-…`, the SeaweedFS key in `test-deploy.mjs`); no real secret has ever been committed. `.gitleaks.toml` allowlists those patterns, and CI now runs the scan over the full history on every push and pull request.
- **CI on pull requests from forks** is safe as it is: the workflow uses no secrets.

## For the user

1. **Legal review of the licences** (Apache-2.0 and 0BSD), the copyright holder, DCO or CLA, and the trademark ("Smithable", the anvil). The decisions and what each implies: [legal-decisions.md](legal-decisions.md).
2. **Create the mailbox** security@smithable.ai (a forward is enough) before the flip; `SECURITY.md` names it.
3. ~~**Decide what leaves the repository before the flip**~~ — done 2026-10-01: the initial master plan (`docs/archive/`), the interview guide, the brief to the designer, the full-vision spec drafts (they no longer validated; the one used as a test fixture moved next to its test) and the WebContainer spike are removed; the history keeps them, since none holds a secret. Design documents keep what was decided and how it was built, not their plans. What stays and why: `docs/research/` holds the evidence behind decisions (the desk research, Wasp, the WebContainer findings), `docs/benchmarks/` the measurements (they name model prices on the day), `docs/as-built.md` the history behind ARCHITECTURE's decisions. Read `docs/research/app-builders/report.md` once as a stranger would: it quotes other builders' users from their public posts.
4. **GitHub settings** at the flip: branch protection on `main` (CI required, no force-push), issues on, discussions if wanted, a `SECURITY.md`-aware security policy in the repository settings, Dependabot or Renovate for the monorepo's dependencies.
5. **The npm names**: `@smithable/*` are `private: true` at version 0.0.0. Reserve the scope on npm before the flip; publishing (a release process with changesets or a tag-driven workflow) is its own small piece of work after it, and `pnpm dlx smithable new` should work on day one of the launch, not necessarily of the flip.

## Still to do in the repository before the flip

- ~~A `LICENSES/shadcn-ui.txt` in every generated app~~ — done 2026-10-01: the notice (with `LICENSES/README.md`) is in every app, copied into the container image, and named in the app's README; a test keeps it so and checks that no app file imports a Smithable package.
- ~~A `CODE_OF_CONDUCT.md`~~ — done 2026-10-01: Contributor Covenant 2.1, reports to conduct@smithable.ai (a mailbox to create with the others).
- ~~Issue and pull-request templates~~ — done 2026-10-01: `.github/ISSUE_TEMPLATE/` (a bug asks for the version and the spec that shows it; a change asks for the need and points at the five questions; security goes to SECURITY.md) and `.github/pull_request_template.md` (`pnpm check`, the docs, the two invariants, the sign-off).
- A pass over the README as a stranger: it is good; the one gap is that "Try it" builds from source, which is right until the packages are published, and should then say `npm install -g smithable`.
- `CLAUDE.md` stays: it is the best short description of how the repository is worked, for people and agents alike.

## Before the public beta (the service, not the flip)

The hosted service is a separate, private repository, so none of this blocks the flip. It must exist before people are admitted under terms that promise it:

- **Leaving with everything, in one download:** the project page's "Download with history" gives the Git bundle only. The download becomes one file with the bundle, the live app's database (the consistent copy the backup already makes), its uploads and a short README (`git clone`, `pnpm install`, `smithable studio`, `smithable detach`); the staging copy when it exists; always available, including after unpublishing and during the notice period before removal. The beta terms' `[verify: the export path]` then names it. (`smithable-cloud/docs/legal/operations.md`, Export.)
- The rest of `smithable-cloud/docs/legal/README.md`, "What the code still must do".

## At the launch (M16), beyond the flip

Pricing and plans, the published spec and JSON Schema as a page, the release process, and the announcement. None of it blocks the repository being public.
