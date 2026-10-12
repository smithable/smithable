# Changelog

One section per release of the `smithable` packages. Each section has a **Breaking** heading. It names which of the three contracts a change hits (see [CONTRIBUTING.md](CONTRIBUTING.md#compatibility)):

- **the spec**: `smithable.yml` and its companions, versioned by the file's `smithable:` line;
- **the engine**: operations, CLI flags and the MCP tools, versioned by the packages' semver;
- **the app's API**: `/api/v1` in each generated app.

The entries are filled in from the merged pull requests at each release.

## Unreleased

### Breaking

None.

### The engine

- New apps get Ask on for everyone who signs in: the starters and the blank a first draft starts from have `assistant: { for: signed-in }` in `smithable.auth.yml`. An app without the block is unchanged.

### Security

- A record's links to related records show their titles only to people who may read those records (#553).
- A record takes a new picture or document only with the receipt its upload gave to the same person for that field (#559).
- `smithable security`: a check that cannot run to its end now fails as "could not check" instead of passing (#554).
- Outgoing calls to other services (the targets under `outgoing`) connect only to an address that was checked (#555).
- Request limits: the app's limit on changes per address keeps a bounded number of addresses, and Studio refuses request bodies over 20 MB (#556).

Apps you host yourself get these only when regenerated with this version; apps on smithable.ai get them with the next release.

### The packages

- Each package has a README, so its page on npm says what it is and links to smithable.ai, the documentation and the repository. The READMEs appear on npm with this release; 0.1.0's pages stay empty until then.

## 0.1.0 (2026-10-11)

The first public release. Spec version `0.1`, API `v1`.

### Breaking

None. This is the first release.

### What is in it

- **The spec and operations.** One technology-neutral `smithable.yml` with companion files for sign-in and roles, presentation, visible text and implementation policy, plus JSON Schemas for each. Every change is an operation with a check, a migration and a commit, and every one can be undone and redone. Plugins can add sections, operations and generators.
- **Generated apps.** An ordinary TanStack Start app with React, Tailwind, shadcn/ui, Drizzle and SQLite, with no dependency on Smithable. The output is byte-identical for the same input. Each app ships its own tests, a container with a `/data` volume, `robots.txt`, a sitemap and a privacy page.
- **Page patterns.** Lists with search, filters, sort and paging; record pages with related lists and "Add <child>"; dashboards; a calendar; booking with capacity; articles; calculators; a catalog with pictures and favorites; pages that show only the viewer's own records; a trash with restore; CSV import and export.
- **Access.** Roles and grants in `smithable.auth.yml`. Sign-in by email code or by an outside provider you bring keys for. Invitations and a users page. Public pages limited by a condition. Rate limits. Audit, access and app logs with one trace id per request, Activity, and each record's history.
- **Programs and assistants.** Keys, `/api/v1` with an OpenAPI description, and seven tools at `/mcp` for AI assistants. "Ask" in the app, and an administrator's inspector that answers as a chosen role.
- **Seven starters.** CRM, booking, invoicing, marketplace, records, status page and an API app, each with sample records and its own mark. Each starter's own description builds it with no model.
- **Studio.** Builder (no code) and Code mode on one live preview: a Look tab with thirteen preset themes and project themes, a spec editor with completion and problems shown in the text, Undo and Redo, a guide, the preview's outbox, and phone layouts.
- **AI, only where it is needed.** Routine changes need no model. `smithable new --describe`, `ask`, `code` and `teach` use the cheapest capable model you configure. Where a model may run is a setting (local only, EU only, best available).
- **Running and keeping it.** `build`, `security` (fast, normal, release), `deploy` (Docker, SSH, Compose), `backup` and `restore` to a folder or an S3 bucket (including point in time), `upgrade`, `update --security` and `detach`.
- **Languages.** The app kit's words are in language files: English and Swedish.
