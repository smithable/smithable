# Getting started on your own machine

Everything here runs on your own machine, with no account. To start in the browser instead, with nothing to install, see [Getting started on smithable.ai](start-hosted.md).

## Install

You need Node 24. Then install the command line from npm:

```sh
npm install -g smithable
smithable --version       # smithable 0.1.0 (spec 0.1)
```

Or run any command once without installing, as `npx smithable@latest new my-crm`. `smithable --help` lists every command.

## A first app

```sh
smithable new my-crm      # a CRM from the starter, with sample data
cd my-crm
smithable studio          # the app and its editor in the browser
```

`--starter <name>` picks another of the [ten starters](starters.md).

`smithable studio` opens the editor in the browser: Smith, its assistant, beside a preview of the app. The first time you open an app, Smith presents it part by part, asks about anything a drafted app had to assume, and then shows you round; **Guide** in the top bar shows the tour again. Tell him what to change: he shows the change in plain words and makes it when you confirm; a request no wording rule reads needs a model ([AI setup](../ai.md)). Or change the app by hand: **No code** in the top bar opens a window with it in plain words and forms (**Behavior**, **Look**, **Who can**, **Content**), and a **Code** tab beside **No code** with the spec files themselves, with suggestions as you type. Smith stays beside you either way. Every change is an operation, so Undo (Ctrl+Z) takes it back.

`smithable new` also takes `--describe "a site to show my dogs"`: it asks up to three questions, then drafts the app. Or `--from https://example.com`: the app is drafted from that page's text, menu and forms instead, and `--with-pictures` takes its pictures as sample pictures, after asking whether you may use them. Both need a model; see [AI setup](../ai.md).

A project is a folder with `smithable.yml` (what the app does), its companion files (sign-in and roles, visible text, presentation) and the generated app. The [spec reference](../spec/v0.1.md) describes the files.

## Signing in

New apps sign people in with a code by email: they type their address and get a six-digit code, good for ten minutes. There are no passwords and no keys to register. You are the app's first administrator: `smithable new` uses your Git address (`git config user.email`), or the one you give with `--admin you@your-domain`. `smithable op setAdmins` changes the list later. Who else may sign in follows `smithable.auth.yml`, the sign-in and roles file. `smithable op setSignUp invited` lets in only invited people and the administrators. To offer Google as well, see [Sign in with Google](google-sign-in.md).

In development nothing is mailed. The sign-in page lets you sign in as any role with one click, and codes land in `data/mail/outbox`. A published app needs mail settings to send codes: `SMTP_URL` (like `smtp://user:password@smtp.example.eu:587`) and `MAIL_FROM` (the sender). Without them its sign-in page says it cannot send mail, and `smithable deploy` warns before publishing. The app's README has the details, under "Signing in" and "Mail".

## Sixty seconds from the command line

A marketplace made, changed and deployed. This is a real run, shortened; the times are one laptop's.

```console
$ smithable new torget --starter marketplace                 # 3.1 s
Generated 139 files (139 changed, 0 removed).
Created torget. Open it in Studio, to see it and change it:
  cd torget
  smithable studio
or only run the app with smithable run.

$ cd torget
$ smithable op addField Item delivery "pickup | shipping"    # 1.8 s
Generated 139 files (7 changed, 0 removed).
Add field delivery (pickup | shipping) to Item. Undo with: smithable undo

$ smithable op setTheme --preset corporate                   # 1.1 s
Generated 139 files (1 changed, 0 removed).
Use the Corporate theme. Undo with: smithable undo

$ smithable ask "let visitors filter items by delivery"      # 0.5 s
Generator (filters) · 0 tokens
Proposed change:
  1. Filter catalog by category, price, condition, available, delivery
Run again with --yes to apply it.

$ smithable ask --yes "let visitors filter items by delivery"
Generated 139 files (1 changed, 0 removed).
Filter catalog by category, price, condition, available, delivery. Undo with: smithable undo

$ smithable deploy --target docker                            # the security scans take a few minutes
Release checks first:
  ✓ Type check (pnpm typecheck)
  ✓ Tests (pnpm test)
  ✓ Dependencies (OSV-Scanner)
  ✓ Dependencies, at their source (the packages' advisory lists)
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
smithable op addField Customer taxId string        # a deterministic change: spec, migration, forms, tables
smithable ask "Customers should have a website"   # in your own words; confirmed before it applies
smithable undo                                    # takes back the last change, database included
smithable report                                  # after a failure: shows what a report would send
```

Every change goes through an operation, which checks it, regenerates the code, migrates the database and commits a checkpoint, so each one can be undone. `smithable op` lists the operations. [Change an app without writing code](change.md) walks through four of them and an undo on the status starter.

## With an AI agent

`smithable mcp` offers the same operations as tools to Claude Code, Cursor and other MCP clients. Every generated app has an `.mcp.json` that registers it, and an `AGENTS.md` that tells an agent how to work on the app.

## In your editor

Start `smithable.yml` with this line for autocomplete and checking (VS Code with the YAML extension, or any editor using yaml-language-server):

```yaml
# yaml-language-server: $schema=https://docs.smithable.ai/schema/smithable-0.1.json
```

## Running it elsewhere

`smithable deploy --target docker` runs the release checks and builds the app's container, which keeps its data in a `/data` volume. `smithable backup` copies the data, and `smithable detach` removes what only Smithable uses, leaving the changes for you to review and commit as one, when you want to continue without it. `deploy` needs Docker. [Run an app on your own machine](self-host.md) walks through deploying, backing up, restoring and updating.
