# Making the repository public (checklist)

Status: 2026-09-30, Fable. The mechanical part of M16's "open-source preparation" is in the same pull request as this document; what remains is listed with who does it. The repository goes public together with the hosted beta (ROADMAP M16), but nothing here depends on the beta's exit test, so it can be done first.

## Done in this pull request

- **Licences as the README stated them:** `LICENSE` (Apache-2.0, the canonical text), `packages/adapter-tanstack/KIT-LICENSE` (0BSD for the app kit and templates, so generated apps carry no obligations), `NOTICE`, and a Licence section in the README. Legal review may still change the choice; the files are then the only thing to replace.
- **`SECURITY.md`**: where to report (security@smithable.ai), what is in scope (this repository, generated apps, the hosted beta), what generated apps do for safety, supported versions.
- **`CONTRIBUTING.md`**: read the vision, the architecture and CLAUDE.md first; design note before spec or pattern changes; `pnpm check` as the gate; DCO sign-off (`git commit -s`).
- **Secrets in the history:** Gitleaks v8.30.1 over every commit found three matches, all placeholder values in test scripts (`test-secret-…`, `bench-secret-…`, the SeaweedFS key in `test-deploy.mjs`); no real secret has ever been committed. `.gitleaks.toml` allowlists those patterns, and CI now runs the scan over the full history on every push and pull request.
- **CI on pull requests from forks** is safe as it is: the workflow uses no secrets.

## State on 2026-10-06 (Fable's review, on Johan's ask)

What is left before the repository goes public, and before the public beta, by who acts. Everything else in the lists below is done or no longer applies (the npm token: trusted publishing replaced it).

| Before the flip | State | Who |
|---|---|---|
| Licences, copyright holder, DCO, trademark | Decided: Apache-2.0 and 0BSD, Åland IT AB, DCO; reconfirmed 2026-10-06 | done |
| security@ and conduct@ reach a real mailbox | Forwarded to Gmail; a real mailbox is action `2026-10-03-real-mailbox.md` | Johan |
| GitHub settings at the flip: merge queue, issues, security policy, Dependabot or Renovate, `FULL_CI` on | Branch protection is on; the rest is a half hour at the flip; `FULL_CI` turns CI's full check on for engine pull requests (about forty billed minutes each) | Johan at the flip |
| npm: the four `@smithable/*` placeholders, then the first staged release | `smithable` and `create-smithable` exist with the trusted publisher; the four scoped ones wait (`2026-10-04-npm-scoped-placeholders.md`); the Publish workflow stages, Johan approves | Johan, then C |
| The README's "Try it" says `npm install -g smithable` once published | one line after the first release | C |
| Public Suffix List entry for smithable.app | Prepared (`docs/public-suffix.md` in the cloud repository); waits for the domain's renewal past 2028-10 and Johan's yes to submit; apps are one site to browsers until then | Johan |
| The repository's history | Nothing secret in it (Gitleaks on every plain-document merge, the scan of 2026-10-01) | done |

| Before the public beta (the service) | State | Who |
|---|---|---|
| Leaving with everything in one download | Done: the project page's download is a zip with the bundle, the live and staging data and a README | done |
| Live example sites | Done: the showcase apps with demo sign-in and hourly resets, linked from the docs | done |
| The legal texts' `[verify]` marks | `smithable-cloud/docs/legal/README.md`, "What the code still must do" | B, with Johan |
| A real mailbox (above) | | Johan |
| Pricing and levels | A proposal: [pricing.md](pricing.md) | Johan |
| The provider layer for EU-only apps | Step 1 in work; the Scaleway stack at the hosting launch ([provider-layer.md](../../../smithable-cloud/docs/design/provider-layer.md) in the cloud repository) | B |
| The outside security test before the public release | Johan's yes of 2026-10-04; the brief waits for his decision on how | Johan |

What would make the flip itself a small day: the mailbox, the four placeholders, and the GitHub settings. Nothing in the engine blocks it.

## For the user

1. **Legal review of the licences** (Apache-2.0 and 0BSD), the copyright holder, DCO or CLA, and the trademark ("Smithable", the anvil). The decisions and what each implies: [legal-decisions.md](legal-decisions.md).
2. **Create the mailbox** security@smithable.ai (a forward is enough) before the flip; `SECURITY.md` names it.
3. ~~**Decide what leaves the repository before the flip**~~ — done 2026-10-01: the initial master plan (`docs/archive/`), the interview guide, the brief to the designer, the full-vision spec drafts (they no longer validated; the one used as a test fixture moved next to its test) and the WebContainer spike are removed; the history keeps them, since none holds a secret. Design documents keep what was decided and how it was built, not their plans. What stays and why: `docs/research/` holds the evidence behind decisions (the desk research, Wasp, the WebContainer findings), `docs/benchmarks/` the measurements (they name model prices on the day), `docs/as-built.md` the history behind ARCHITECTURE's decisions. Read `docs/research/app-builders/report.md` once as a stranger would: it quotes other builders' users from their public posts.
4. **GitHub settings** at the flip: ~~branch protection on `main`~~ (done 2026-10-02: the `check` job required, up to date with `main`, no force-push or deletion; sessions merge through `scripts/merge-green.sh`); at the flip, turn on GitHub's merge queue for the engine repository (on the Team plan it is for public repositories only), which tests and merges pull requests in order and replaces the script's lock there (the private cloud repository keeps the lock), issues on, discussions if wanted, a `SECURITY.md`-aware security policy in the repository settings, Dependabot or Renovate for the monorepo's dependencies.
5. **The npm names**: the scope and the unscoped `smithable` and `create-smithable` are reserved. ~~The release process~~ — done 2026-10-03 (#137): the packages are public-ready with their licences, and the Publish workflow (by hand only, a dry run by default, provenance) stamps a version and publishes; see [releasing.md](../releasing.md). Left: the release account owning the names (the npm handover) and its `NPM_TOKEN` secret, then the first real release and deprecating the placeholders. `pnpm dlx smithable new` should work on day one of the launch, not necessarily of the flip.

## Still to do in the repository before the flip

- ~~A `LICENSES/shadcn-ui.txt` in every generated app~~ — done 2026-10-01: the notice (with `LICENSES/README.md`) is in every app, copied into the container image, and named in the app's README; a test keeps it so and checks that no app file imports a Smithable package.
- ~~A `CODE_OF_CONDUCT.md`~~ — done 2026-10-01: Contributor Covenant 2.1, reports to conduct@smithable.ai (a mailbox to create with the others).
- ~~Issue and pull-request templates~~ — done 2026-10-01: `.github/ISSUE_TEMPLATE/` (a bug asks for the version and the spec that shows it; a change asks for the need and points at the five questions; security goes to SECURITY.md) and `.github/pull_request_template.md` (`pnpm check`, the docs, the two invariants, the sign-off).
- ~~A pass over the README as a stranger~~ — done 2026-10-01: status line, the `smithable` alias while the packages are not on npm, Docker named, contributing and conduct linked. When the packages are published, "Try it" should say `npm install -g smithable`. The same pass found `data/.smithable/test-results.json` committed from a CLI run in the repository root (absolute paths with the machine's user name); removed, and `data/` is ignored. `SECURITY.md` now names the advisories page.
- `CLAUDE.md` stays: it is the best short description of how the repository is worked, for people and agents alike.

## Before the public beta (the service, not the flip)

The hosted service is a separate, private repository, so none of this blocks the flip. It must exist before people are admitted under terms that promise it:

- **Leaving with everything, in one download:** the project page's "Download with history" gives the Git bundle only. The download becomes one file with the bundle, the live app's database (the consistent copy the backup already makes), its uploads and a short README (`git clone`, `pnpm install`, `smithable studio`, `smithable detach`); the staging copy when it exists; always available, including after unpublishing and during the notice period before removal. The beta terms' `[verify: the export path]` then names it. (`smithable-cloud/docs/legal/operations.md`, Export.)
- The rest of `smithable-cloud/docs/legal/README.md`, "What the code still must do".
- **Live example sites** ([showcase.md](showcase.md)): the published starters (~~the status page as the sixth~~, done 2026-10-03, #139) with demo sign-in and hourly resets, linked from the docs and the README, with real texts and photographs; and the sixty-second CLI example on the getting-started page. Without them the release has nothing to show a non-developer.

## At the launch (M16), beyond the flip

Pricing and plans, ~~the published spec and JSON Schema as a page~~ (done 2026-10-01: docs.smithable.ai), ~~the release process~~ (done 2026-10-03: the Publish workflow, #137; the token is still to set), and the announcement. None of it blocks the repository being public.
