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
3. **Decide what leaves the repository before the flip**, each a `git rm` in one commit (the history keeps them, which is fine, since none holds a secret):
   - `spikes/webcontainer`: an experiment that is not part of the product (the README says so); keep or remove.
   - `docs/research/app-builders/report.md`: desk research quoting other builders' users by their public posts; publishable, but read it once as a stranger would.
   - `docs/benchmarks/`: fine to publish; they name model prices on the day.
   - `docs/archive/initial_master_plan*.md`: history; fine either way.
4. **GitHub settings** at the flip: branch protection on `main` (CI required, no force-push), issues on, discussions if wanted, a `SECURITY.md`-aware security policy in the repository settings, Dependabot or Renovate for the monorepo's dependencies.
5. **The npm names**: `@smithable/*` are `private: true` at version 0.0.0. Reserve the scope on npm before the flip; publishing (a release process with changesets or a tag-driven workflow) is its own small piece of work after it, and `pnpm dlx smithable new` should work on day one of the launch, not necessarily of the flip.

## Still to do in the repository before the flip

- A `LICENSES/shadcn-ui.txt` in every generated app: the `src/components/ui/*` files are shadcn/ui's (MIT), and MIT asks that its notice travel with copies ([legal-decisions.md](legal-decisions.md) §2).
- A `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1 is the usual choice; a decision, then a copy).
- Issue and pull-request templates (a bug needs the spec that shows it and the Smithable version; a change needs `pnpm check`).
- A pass over the README as a stranger: it is good; the one gap is that "Try it" builds from source, which is right until the packages are published, and should then say `npm install -g smithable`.
- `CLAUDE.md` stays: it is the best short description of how the repository is worked, for people and agents alike.

## At the launch (M16), beyond the flip

Pricing and plans, the published spec and JSON Schema as a page, the release process, and the announcement. None of it blocks the repository being public.
