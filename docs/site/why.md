# Why Smithable

Smithable is for two kinds of people: those who have never written code and want an app that keeps working, and developers who want to move faster without inheriting a mess. Both get the same thing: an app described in a short file, generated as ordinary code, and changed by operations that are checked, migrated and tested before they apply. Who builds it: [About Smithable](https://smithable.ai/about).

## A supported change is protected

Adding a field, a page, a role or a rule is an operation, not a conversation with a model. Each one is protected in the same ways:

- **Validated.** The change is checked against the whole spec before anything is written. If it does not fit, nothing is applied, and the error says why.
- **Regenerated the same way.** The same spec always gives exactly the same code, so nothing drifts or is left half-updated.
- **Migrated with the records kept.** The database is migrated so existing records survive. A change that would lose data, such as removing a field, says what it loses and asks first.
- **Tested.** The app's generated tests run before the change is committed as a checkpoint.
- **Reversible, within limits.** `smithable undo` takes the last change back, the development database included, and can be run again to go further back. That undo is for building. A live app's records come back from its backups (`smithable restore`), not from undo.

Your own code is a boundary. Code in `src/custom/` is never overwritten, and when a change no longer fits it, the type check says so; Smithable reports the mismatch and leaves your code as it is. These protections cover the changes Smithable supports. What you write yourself is yours to keep working, with the type check and tests to tell you when it no longer fits.

## Most changes cost nothing

Routine work never calls a model. In the [M7 benchmark](https://github.com/smithable/smithable/blob/main/docs/benchmarks/m7-report.md), Smithable's operations did six of seven everyday tasks on a CRM in eleven seconds for zero tokens (the seventh, a search, has no operation yet). A coding agent did all seven for $3.15 and 3.6 million tokens. With Smithable's operations offered to the agent as tools, its cost fell to between a third and a seventh on the tasks an operation covers. None of the setups broke a task that had worked before. The agent edited the code directly, so the spec no longer matched its app: its app still worked, but the next change made from the spec cannot see those edits. M7 is one small app, one run per setup.

When a request does need interpretation, the cheapest capable model gets a small slice of the spec and answers with operations, never with code. In [M12](https://github.com/smithable/smithable/blob/main/docs/benchmarks/m12-report.md), a small hosted open model made the same seven everyday changes for about €0.002 in all, seven of seven in its latest runs; a 7-billion-parameter model on a laptop's CPU did six, offline. A model varies from run to run, and earlier runs did fewer while the instructions were being fixed. Building a first version from a description is a different task, measured on its own: [M12's first builds](https://github.com/smithable/smithable/blob/main/docs/benchmarks/m12-model-comparison.md). Every change shows what handled it and what it cost.

## The app is yours

A generated app is a normal TanStack Start application with React, Tailwind, shadcn/ui, Drizzle and SQLite, written the way a developer who knows that stack would write it. It has no dependency on Smithable at build time or run time: no SDK, no runtime, no license key. It ships as a container with a `/data` volume, carries its own tests, and runs anywhere a container runs.

When you want to continue without Smithable, `smithable detach` removes what only Smithable used, as changes to review and commit as one, and leaves an ordinary project behind. The app kit copied into every app is licensed under 0BSD, so a generated app owes nothing to this repository.

## Access rules are code, not hope

Who may read, create, change or delete each kind of record is declared in `smithable.auth.yml`, enforced by the generated server functions, and covered by generated tests. A rule that is not implemented is shown as not implemented, never assumed. Every write is validated against a schema derived from the spec. Production builds send security headers and a Content Security Policy with a per-request nonce, run as a non-root user on a distroless image with pinned dependencies, and `smithable security` runs a dependency audit, a secrets scan, static analysis and a container scan whose findings are reported, never suppressed.

## Runs where you want it

Everything in the open-source product runs on your own machine, with no account: the engine, the CLI, Studio and the MCP server (tools for AI agents such as Claude Code). A local model through Ollama keeps a request from ever leaving your network. The hosted service is built on the open-source product, never the other way round, and where an app's data and model calls may go is a setting (the AI policy on your machine, the account's region on the hosted service), not a plan.

## Designed, not improvised

Looks come from the [built-in themes](theme.md) in light and dark, a brand color the palette is derived from with readable contrast, and a library of page patterns: lists, records, forms, dashboards, calendars, articles, calculators, landing pages. Presentation lives in `smithable.ux.yml`, apart from what the app does, so a change of look never touches a rule.

## What it is not

Smithable is not a prompt-to-code tool that edits arbitrary code, not a programming language in YAML, and not a way to import an existing project. It supports one stack, done well. When the spec cannot say something, the answer is a small piece of ordinary code in `src/custom/`, which Smithable never overwrites.

## Questions and answers

Checked against the code on 2026-10-11. Where something is not built yet, this part says so.

### How is this different from Lovable, Bolt, v0 or Replit?

Those tools have a model write and rewrite the application's code from your prompts. Smithable keeps a short description of the application, `smithable.yml`, and generates the code from it. Routine changes are operations that need no model and are checked, migrated, tested and can be undone; a model is used only to turn a request in your own words into operations, and it proposes, you confirm. The result is an ordinary application a developer can read, and changes that are cheap, tested and can be undone. The reasoning and the measurements are on [Why Smithable](why.md).

### Does my app depend on Smithable?

No. A generated app has no Smithable package at build time or run time; a test in this repository fails if one appears. It is a TanStack Start app with React, Tailwind, shadcn/ui, Drizzle and SQLite. `smithable detach` turns the project into an ordinary one when you want to stop using Smithable, and the app kit copied into it is licensed under 0BSD.

### Do I need an AI model?

No. Everything in [Getting started on your own machine](start-local.md) works without one: starters, Studio, every operation, deploy, backup. A model adds three things: `smithable ask "<request>"`, which turns your words into operations, `smithable new --describe`, which drafts an app from a sentence, and `smithable new --from <url>`, which drafts one from a web page. You can run a local model with Ollama, a hosted model with your own key, or none. See [AI setup](../ai.md).

### What does it cost to run?

The software is free and open source under Apache-2.0. Operations cost nothing. A model call costs what your provider charges: in the benchmarks, seven everyday changes to a CRM with a small hosted model cost about €0.002 in all, and a local model costs nothing but time. Those are one small app's measurements, and a model's results vary from run to run; a first build from a description is measured apart ([Why Smithable](why.md#most-changes-cost-nothing)). Every change in Studio and the CLI shows what handled it and what it cost.

### Can I host it myself?

Yes. `smithable deploy --target docker` runs the release checks and builds a container that keeps its data in a `/data` volume; `--target compose` writes a `compose.yaml`, and `--target ssh://user@host` deploys to a remote Docker host. `smithable backup` copies the database and the uploaded files to a folder or an S3-compatible bucket, and `smithable restore` brings them back, to a point in time when continuous backup is on.

### Is there a hosted version?

Yes, and what you build stays yours: a private beta at [smithable.ai](https://smithable.ai), by invitation, with a free two-hour sandbox that needs no sign-up; [ask for an invite](https://smithable.ai/invite-request) if you want to keep what you build. Invited testers keep their apps, publish them on their own domain, and can download everything (code, history and data) or hand an app to a developer or another account at any time. Pricing and plans are not set; the beta is free.

### Where does my data live?

On your machine, when you run Smithable yourself. On the hosted service, in Sweden (AWS Stockholm), with backups in the same region. Model calls go to the models the service lists as its [sub-processors](https://smithable.ai/legal/sub-processors). An account is global unless its owner makes it an EU account (**Region** on the account page, [getting started](start-hosted.md)); every app is hosted in Sweden either way, and an EU app's AI requests stay in the EU unless its level is Relaxed, while a Relaxed or a global app's may go to the USA ([the levels](../ai.md#the-apps-assistant-ask)). The hosted service's privacy notice and terms are drafts until the public beta; they will say what is kept and for how long.

### What can it build today?

Business applications with records, relations, formulas, status workflows, roles and access rules, custom actions, dashboards, calendars, bookings with capacity, articles with pictures and Markdown, calculators, landing pages, invitations and user management; and marketplaces, with several pictures per record, filters and sorting on lists, favorites, "my" pages that show only your own records, and contacting a record's owner. Ten [starters](starters.md) show the range: a CRM, a booking site, an invoicing app, a marketplace (Torget), a plain records app, a status page, an app for programs and assistants, a support desk fed by mail, a food truck's orders and a barbershop's appointments. Not yet: payments, which need a few lines of custom code for now. An app already mails people and calls other systems when something happens ([mail and calls out](outgoing.md)) and takes mail and calls in ([mail and calls in](incoming.md)).

### Will search engines find my public pages?

Yes, but only your public pages. A public app also gets a privacy page written from itself (`legal: privacy`): who runs it, what it stores and why, cookies, mail, logs, your rights, in the app's language and kept true as the app changes; you fill in who you are. Every app answers `/robots.txt` from the `public` block of `smithable.auth.yml`: the public pages and their pictures are allowed, everything behind sign-in is refused, and with no public pages, everything is. With public pages the app also serves `/sitemap.xml`, listing them and a public blog's published posts with their dates, and robots.txt names it. Each page's tab says its name and the app's; a `description` under the page in `smithable.content.yml` is what a search engine shows under the link. Article pages carry Open Graph tags for links shared elsewhere.

### What happens when the spec cannot say what I need?

You write ordinary code in `src/custom/`, which Smithable never overwrites: a custom action's implementation, a page with its own component, a section, a stylesheet. The generated data functions apply the access rules for you. `smithable teach` lets a project add a construct of its own, and a construct that many projects need becomes part of the spec through a design note and the five questions in [ARCHITECTURE §2.4](../ARCHITECTURE.md#24-growing-the-dsl).

### Is it production-ready?

It is a beta. The engine is tested on every change against every example: generated, type-checked, built, served and regenerated, and Studio driven in a real browser. Until 1.0, only the latest release is supported, the spec is version 0.1 and may change with a migration path ([CHANGELOG.md](../../CHANGELOG.md) names every breaking change and the contract it breaks), and releases are on npm since 0.1.0. Treat it the way you would treat any 0.x tool: good for real internal tools and small sites, with your own backups.

### Why YAML, and why one stack?

YAML because non-developers can read it and a model can write it reliably, and because a spec with positions, comments and a JSON Schema fits editors as they are. One stack because an ordinary, idiomatic application for one stack is worth more than a mediocre one for five; a second adapter comes when the first is proven, and the spec is kept neutral so that it can.

### How do I contribute or report a problem?

Issues and pull requests on [GitHub](https://github.com/smithable/smithable); [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) says what to read first and how changes are checked. Vulnerabilities go to security@smithable.ai, as [SECURITY.md](../../.github/SECURITY.md) explains, not to a public issue.
