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

`smithable new` also takes `--describe "a site to show my dogs"`: it asks up to three questions, then drafts the app. Or `--from https://example.com`: a page's text, menu and forms describe the app instead, and `--with-pictures` takes its pictures as sample pictures, after asking whether you may use them. Both need a model; see [AI setup](../ai.md).

A project is a folder with `smithable.yml` (what the app does), its companion files (sign-in and roles, visible text, presentation) and the generated app. The [spec reference](../spec/v0.1.md) describes the files.

## Changing it

From inside the project:

```sh
smithable op addField Customer phone phone        # a deterministic change: spec, migration, forms, tables
smithable ask "Customers should have a website"   # in your own words; confirmed before it applies
smithable undo                                    # takes back the last change, database included
```

Every change goes through an operation, which checks it, regenerates the code, migrates the database and commits a checkpoint, so each one can be undone. `smithable op` lists the operations.

## With an AI agent

`smithable mcp` offers the same operations as tools to Claude Code, Cursor and other MCP clients. Every generated app has an `.mcp.json` that registers it, and an `AGENTS.md` that tells an agent how to work on the app.

## In your editor

Start `smithable.yml` with this line for autocomplete and checking (VS Code with the YAML extension, or any editor using yaml-language-server):

```yaml
# yaml-language-server: $schema=https://docs.smithable.ai/schema/smithable-0.1.json
```

## Running it elsewhere

`smithable deploy --target docker` runs the release checks and builds the app's container, which keeps its data in a `/data` volume. `smithable backup` copies the data, and `smithable detach` removes what only Smithable uses, as one commit, when you want to continue without it. These need Docker.
