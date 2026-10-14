# Why Smithable

Smithable is for two kinds of people: those who have never written code and want an app that keeps working, and developers who want to move faster without inheriting a mess. Both get the same thing: an app described in a short file, generated as ordinary code, and changed by operations that are checked, migrated and tested before they apply.

## A supported change is protected

Adding a field, a page, a role or a rule is an operation, not a conversation with a model. Each one is protected in the same ways:

- **Validated.** The change is checked against the whole spec before anything is written. If it does not fit, nothing is applied, and the error says why.
- **Regenerated the same way.** Generation is byte-identical: the same spec always gives the same code, so nothing drifts or is left half-updated.
- **Migrated with the records kept.** The database is migrated so existing records survive. A change that would lose data, such as removing a field, says what it loses and asks first.
- **Tested.** The app's generated tests run before the change is committed as a checkpoint.
- **Reversible, within limits.** `smithable undo` takes the last change back, the development database included, and can be run again to go further back. That undo is for building. A live app's records come back from its backups (`smithable restore`), not from undo.

Your own code is a boundary. Code in `src/custom/` is never overwritten, and when a change no longer fits it, the type check says so; Smithable reports it and does not rewrite it. These protections cover the changes Smithable supports. What you write yourself is yours to keep working, with the type check and tests to tell you when it no longer fits.

## Most changes cost nothing

Routine work never calls a model. In the [M7 benchmark](https://github.com/smithable/smithable/blob/main/docs/benchmarks/m7-report.md), Smithable's operations did six of seven everyday tasks on a CRM in eleven seconds for zero tokens. A coding agent did the same seven tasks for $3.15 and 3.6 million tokens. With Smithable's operations offered to the agent as tools, its cost fell three to seven times on the tasks an operation covers. None of the setups broke a task that had worked before. The agent's code was left out of step with the spec: that is a cost for continued use, since the next change made from the spec cannot see it, not proof that its app was broken. M7 is one small app, one run per setup.

When a request does need interpretation, the cheapest capable model gets a small slice of the spec and answers with operations, never with code. In [M12](https://github.com/smithable/smithable/blob/main/docs/benchmarks/m12-report.md), a small hosted open model made the same seven everyday changes for about €0.002 in all, seven of seven in its latest runs; a 7-billion-parameter model on a laptop's CPU did six, offline. A model varies from run to run, and earlier runs did fewer while the instructions were being fixed. Building a first version from a description is a different task, measured on its own: [M12's first builds](https://github.com/smithable/smithable/blob/main/docs/benchmarks/m12-model-comparison.md). Every change shows what handled it and what it cost.

## The app is yours

A generated app is a normal TanStack Start application with React, Tailwind, shadcn/ui, Drizzle and SQLite, written the way a developer who knows that stack would write it. It has no dependency on Smithable at build time or run time: no SDK, no runtime, no license key. It ships as a container with a `/data` volume, carries its own tests, and runs anywhere a container runs.

When you want to continue without Smithable, `smithable detach` removes what only Smithable used, as one reviewable commit, and leaves an ordinary project behind. The app kit copied into every app is licensed under 0BSD, so a generated app owes nothing to this repository.

## Access rules are code, not hope

Who may read, create, change or delete each kind of record is declared in `smithable.auth.yml`, enforced by the generated server functions, and covered by generated tests. A rule that is not implemented is shown as not implemented, never assumed. Every write is validated against a schema derived from the spec. Production builds send security headers and a Content Security Policy with a per-request nonce, run as a non-root user on a distroless image with pinned dependencies, and `smithable security` runs a dependency audit, a secrets scan, static analysis and a container scan whose findings are reported, never suppressed.

## Runs where you want it

Everything on this site runs on your own machine, with no account: the engine, the CLI, Studio and the MCP server. A local model through Ollama keeps a request from ever leaving your network. The hosted service is built on the open-source product, never the other way round, and where a project's data and model calls may go is a setting of the project, not a plan.

## Designed, not improvised

Looks come from thirteen built-in themes in light and dark, a brand color the palette is derived from with readable contrast, and a library of page patterns: lists, records, forms, dashboards, calendars, articles, calculators, landing pages. Presentation lives in `smithable.ux.yml`, apart from what the app does, so a change of look never touches a rule.

## What it is not

Smithable is not a prompt-to-code tool that edits arbitrary code, not a programming language in YAML, and not a way to import an existing project. It supports one stack, done well. When the spec cannot say something, the answer is a small piece of ordinary code in `src/custom/`, which Smithable never overwrites.
