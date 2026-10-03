# Getting started

Everything here runs on your own machine, with no account.

## Install

You need Node 24 and pnpm (the version pinned in the repository's `package.json`). The packages are not on npm yet, so install from the repository:

```sh
git clone https://github.com/smithable/smithable.git
cd smithable
pnpm install
pnpm build
alias smithable="node $PWD/packages/cli/dist/bin.js"
```

`smithable --help` lists every command.

## A first app

```sh
smithable new my-crm      # a CRM from the starter, with sample data
cd my-crm
smithable studio          # Builder and Studio in the browser
```

`--starter <name>` picks another of the [six starters](starters.md).

`smithable new` also takes `--describe "a site to show my dogs"`: it asks up to three questions, then drafts the app. Or `--from https://example.com`: a page's text, menu and forms describe the app instead, and `--with-pictures` takes its pictures as sample pictures, after asking whether you may use them. Both need a model; see [AI setup](../ai.md).

A project is a folder with `smithable.yml` (what the app does), its companion files (sign-in and roles, visible text, presentation) and the generated app. The [spec reference](../spec/v0.1.md) describes the files.

## Sixty seconds from the command line

A marketplace made, changed and deployed. This is a real run, shortened; the times are one laptop's.

```console
$ smithable new torget --starter marketplace                 # 3.7 s
Generated 86 files (86 changed, 0 removed).
[✓] Your SQL migration file ➜ drizzle/0000_striped_proudstar.sql 🚀
Created torget. Start it with:
  cd torget
  smithable run

$ cd torget
$ smithable op addField Item delivery "pickup | shipping"    # 1.8 s
Generated 86 files (4 changed, 0 removed).
Add field delivery (pickup | shipping) to Item. Undo with: smithable undo

$ smithable op setTheme --preset corporate                   # 1.2 s
Generated 86 files (2 changed, 0 removed).
Set the theme: preset corporate. Undo with: smithable undo

$ smithable ask "let visitors filter items by delivery"      # 0.3 s
Generator (filters) · 0 tokens
Proposed change:
  1. Filter catalog by category, price, condition, available, delivery
Run again with --yes to apply it.

$ smithable ask --yes "let visitors filter items by delivery"
Filter catalog by category, price, condition, available, delivery. Undo with: smithable undo

$ smithable deploy --target docker                            # the security scans take a few minutes
Release checks first:
  ✓ Type check (pnpm typecheck)
  ✓ Tests (pnpm test)
  ✓ Dependencies (OSV-Scanner)
  ✓ Secrets (Gitleaks)
  ✓ Code (Semgrep)
  ✓ Smoke tests (pnpm test:smoke)
  ✓ Container image (Trivy)
  ✓ Running app (OWASP ZAP)
All checks passed.
Deployed: http://localhost:3000 (data in the Docker volume torget-data).
```

What each line did:

- **`new`** copied the marketplace starter, with its sample items and photos, generated the app (a TanStack Start project with a Drizzle schema and shadcn/ui components) and made the first database migration. The app depends on nothing from Smithable.
- **`addField`** changed the spec. The new choice field now appears in the form, the list and the record page, and a migration adds the column with its default, so the existing items get `pickup`. Each change is a Git checkpoint that `smithable undo` takes back.
- **`setTheme`** gave the app another look: colors, font, corners and density. Nothing else changed.
- **`ask`** read the sentence without a model (`0 tokens`: a wording rule matched it) and showed the change before applying it. A sentence no rule matches goes to the model you set up; see [AI setup](../ai.md).
- **`deploy`** ran the release checks on the built image and the running app, then started it in Docker with its data in a volume. A failed check stops the deploy, and findings are never suppressed.

## Changing it

From inside the project:

```sh
smithable op addField Customer phone phone        # a deterministic change: spec, migration, forms, tables
smithable ask "Customers should have a website"   # in your own words; confirmed before it applies
smithable undo                                    # takes back the last change, database included
smithable report                                  # after a failure: shows what a report would send
```

Every change goes through an operation, which checks it, regenerates the code, migrates the database and commits a checkpoint, so each one can be undone. `smithable op` lists the operations. [Change an app without writing code](change.md) walks through five of them on the status starter.

## With an AI agent

`smithable mcp` offers the same operations as tools to Claude Code, Cursor and other MCP clients. Every generated app has an `.mcp.json` that registers it, and an `AGENTS.md` that tells an agent how to work on the app.

## In your editor

Start `smithable.yml` with this line for autocomplete and checking (VS Code with the YAML extension, or any editor using yaml-language-server):

```yaml
# yaml-language-server: $schema=https://docs.smithable.ai/schema/smithable-0.1.json
```

## Running it elsewhere

`smithable deploy --target docker` runs the release checks and builds the app's container, which keeps its data in a `/data` volume. `smithable backup` copies the data, and `smithable detach` removes what only Smithable uses, as one commit, when you want to continue without it. These need Docker. [Run an app on your own machine](self-host.md) walks through deploying, backing up, restoring and updating.
