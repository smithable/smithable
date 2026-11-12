# Changelog

One section per release of the `smithable` packages. Each section has a **Breaking** heading. It names which of the three contracts a change hits (see [CONTRIBUTING.md](.github/CONTRIBUTING.md#compatibility)):

- **the spec**: `smithable.yml` and its companions, versioned by the file's `smithable:` line;
- **the engine**: operations, CLI flags and the MCP tools, versioned by the packages' semver;
- **the app's API**: `/api/v1` in each generated app.

The entries are filled in from the merged pull requests at each release. A fix that changes what built apps do names its fix file (`fixes/<id>.yml`, [fixes/README.md](fixes/README.md)).

## Unreleased

### Breaking

- **The engine**: `smithable report --always` and Studio's Always send are gone: every error report is shown in full and sent by hand. Someone who chose always before is asked again.

- **The spec**: a name, a label, a title or a subject is one line, in every spec file; the longer texts (descriptions, intents, rules, a section's text, help, answers, quotes) may still run over several. Control characters, the line breaks U+2028, U+2029 and U+0085, and the characters that reverse text's direction are refused anywhere.

- Backup capture now briefly holds SQLite writes and requires source write access. A 30-second deadline bounds capture; staged uploads receive content-address checks.

- Backup data containing symbolic links is refused. New CLI backups use a versioned file inventory and completion marker; restores verify file hashes before changing data and prefer complete versioned backups. Legacy backups remain explicitly selectable with a verification warning. These checks detect accidental corruption, not a malicious storage provider.

### Fixes

- Generated apps: adding or changing a record whose reference names a record that does not exist is refused as bad input that names the field, in the API, Ask and the forms, instead of as a record still in use (`fixes/missing-reference.yml`).
- Generated apps: the page of one article finds it and the ones just newer and older in the query, a row each (`fixes/article-neighbours.yml`).
- Generated apps read less: a settings or onboarding page reads the one record it shows, a page of articles reads that page in the query, and a list's conversation counts are counted in the query (`fixes/bounded-reads.yml`).
- Operations: replacing a list written one item per line (`setPublic --read` on the booking starter) wrote a file that did not parse and was refused; it is now written as `[a, b]` on the key's line. A list's comment on its line goes with the old items, and a list set to what it already is stays as it was.
- Generated apps: Ask counts the questions the host's model answers per person (30 a quarter of an hour); a private picture or document is asked for again each time instead of kept an hour; an API key's last use is written at most once a minute; the users page counts in SQL (`fixes/kit-hardening.yml`). A field named like a built-in property of objects (`constructor`, `toString`) is read as a name everywhere; Studio's preview takes select mode and highlighting only from Studio.

- On a generated app's users page, only an administrator makes or removes an administrator, and a role that manages users gives only the roles within its own rights (`fixes/users-page-roles.yml`).

- A mail that a generated app finds a thread for only by the `[app #id]` tag in its subject joins it only from the record's own address or one already in its thread; from anyone else it starts a new one (`fixes/mail-tag-sender.yml`).

- The generated apps count an IPv6 address by its /64 in their limits, and keep signed-in people's counts apart from strangers', where a flood of new keys pushes out keys counted once instead of refusing everyone new (`fixes/limits-by-network.yml`).

- Text from the spec is written into the generated apps' code as text wherever it goes: comments, strings, template literals, the page's markup and the README's commands (`fixes/spec-text-in-code.yml`).

- The generated apps' sign-in library, better-auth, moves from 1.7.15 to 1.7.18 for its published security fixes (`fixes/better-auth-1-7-18.yml`), with tailwind 4.3.5.

### The engine

- Studio's "What it does" writes a kind of record's keys through their own operations: what it and its fields mean (setMeaning), the trash, the owner, what names a record, review, a field's rules, a conversation's fields, a capacity, a schedule, whose time a booking takes and fields unique together, each with that operation's checks and words in the history; setMeaning, setTrash, setOwner, setNamedBy, setReview, setFieldRules, setThread, setCapacity, setSchedule, setOccupies and setUnique list the keys they set. A page's search, filters, sort choice, default filter, export, favorites, own records only, contact block, period and meaning go the same way, through setSearch, setFilters, setSortable, setDefaultFilter, setExport, setFavorites, setMine, setContact, setPeriod and setMeaning. A section taken away and which records it shows go through removeSection and setSectionWhere, and a page's look keys (its table's columns, totals, view, sort and row actions, which filters show and how, a calendar's colour, view and filters, the frame, the width, a record's pictures and what it shows first, a form's field order and columns) through their own operations.

### The app's API

- User references accept the string identifiers returned by reads, including updates through the API and assistant conversions. Ordinary model references retain integer identifiers; generated OpenAPI descriptions distinguish the two.

## 0.1.1 (2026-10-13)

### Breaking

None.

### The engine

- New apps get Ask on for everyone who signs in: the starters and the blank a first draft starts from have `assistant: { for: signed-in }` in `smithable.auth.yml`. An app without the block is unchanged.
- Outgoing calls to other services carry an `Idempotency-Key` header, the same on every try, so a receiver can tell a repeat. Behind the hosted service's egress proxy, a call to an address not yet connected says to connect it on the project's Connections page, and its retries go on (#568).
- Activity can be filtered to one outgoing target ("Sent to"): its deliveries under "Calls to <target>", with Send again for a call given up (#569).
- A new docs page, "Tell people and other systems", on outgoing mail and signed calls to other services (#570).
- Mail and calls into an app: a new `incoming` section in `smithable.yml` gives an app addresses (`/incoming/<name>`) that other services call, each adding a record from the call's JSON as a chosen role, or handing it to the app's own code; the caller's secret is the setting `INCOMING_<NAME>_SECRET`, and a repeat (by `Idempotency-Key`) is not acted on twice (#541). With `mail: true`, each mail passed on becomes a record, its attachments kept and reviewed as uploads are (#543). The section is new, so existing apps are unchanged. The docs page "Mail and calls into your app" says how.

### Security

- A record's links to related records show their titles only to people who may read those records (#553; fix `related-titles-access`).
- A record takes a new picture or document only with the receipt its upload gave to the same person for that field (#559; fix `upload-receipts`).
- `smithable security`: a check that cannot run to its end now fails as "could not check" instead of passing (#554).
- Outgoing calls to other services (the targets under `outgoing`) connect only to an address that was checked; behind an egress proxy (as on smithable.ai), calls go through it (#555; fix `outgoing-checked-address`).
- Request limits: the app's limit on changes per address keeps a bounded number of addresses, and Studio refuses request bodies over 20 MB (#556; fix `request-limit-memory`).
- Files uploaded but never saved on a record are removed a day later, and an app's stored files can be capped with the `UPLOADS_MAX_BYTES` setting (#563; fix `unsaved-uploads`).

Apps you host yourself get these only when regenerated with this version; apps on smithable.ai get them with the next release.

### The packages

- Each package has a README, so its page on npm says what it is and links to smithable.ai, the documentation and the repository. The READMEs appear on npm from this release on.

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
