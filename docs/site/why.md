# Why Smithable

Smithable is for two kinds of people: those who have never written code and want an app that keeps working, and developers who want to move faster without inheriting a mess. Both get the same thing: an app described in a short file, generated as ordinary code, and changed by operations that cannot break it.

## Changes don't break your app

Adding a field, a page, a role or a rule is an operation, not a conversation with a model. The operation checks the change against the spec, regenerates the code, migrates the database so existing records survive, runs the generated tests and commits a checkpoint. If anything fails, nothing is applied. If you change your mind, `smithable undo` takes the change back, database included.

Generation is byte-identical: the same spec always gives the same code. Nothing drifts, nothing is half-updated, and a change to one part never leaves another part behind.

## Most changes cost nothing

Routine work never calls a model. In the [M7 benchmark](https://github.com/smithable/smithable/blob/main/docs/benchmarks/m7-report.md), Smithable's operations did six of seven everyday tasks on a CRM in eleven seconds for zero tokens, with no regression. A coding agent did the same seven tasks for $3.15 and 3.6 million tokens, and left every file out of step with the spec. With Smithable's operations offered to the agent as tools, its cost fell three to seven times on the tasks an operation covers.

When a request does need interpretation, the cheapest capable model gets a small slice of the spec and answers with operations, never with code. A small EU-hosted model did [seven of seven tasks for about €0.002](https://github.com/smithable/smithable/blob/main/docs/benchmarks/m12-report.md); a 7-billion-parameter model on a laptop's CPU did six, offline. Every change shows what handled it and what it cost.

## The app is yours

A generated app is a normal TanStack Start application with React, Tailwind, shadcn/ui, Drizzle and SQLite, written the way a developer who knows that stack would write it. It has no dependency on Smithable at build time or run time: no SDK, no runtime, no license key. It ships as a container with a `/data` volume, carries its own tests, and runs anywhere a container runs.

When you want to continue without Smithable, `smithable detach` removes what only Smithable used, as one reviewable commit, and leaves an ordinary project behind. The app kit copied into every app is licensed under 0BSD, so a generated app owes nothing to this repository.

## Access rules are code, not hope

Who may read, create, change or delete each kind of record is declared in `smithable.auth.yml`, enforced by the generated server functions, and covered by generated tests. A rule that is not implemented is shown as not implemented, never assumed. Every write is validated against a schema derived from the spec. Production builds send security headers and a Content Security Policy with a per-request nonce, run as a non-root user on a distroless image with pinned dependencies, and `smithable security` runs a dependency audit, a secrets scan, static analysis and a container scan whose findings are reported, never suppressed.

## EU by default, local when you want it

Everything on this site runs on your own machine, with no account: the engine, the CLI, Studio and the MCP server. A local model through Ollama keeps a request from ever leaving your network. The hosted service and the model behind `smithable ask` run in the EU (AWS Stockholm and an EU-hosted open model), and the hosted service is built on the open-source product, never the other way round.

## Designed, not improvised

Looks come from four designed themes in light and dark, a brand color the palette is derived from with readable contrast, and a library of page patterns: lists, records, forms, dashboards, calendars, articles, calculators, landing pages. Presentation lives in `smithable.ux.yml`, apart from what the app does, so a change of look never touches a rule.

## What it is not

Smithable is not a prompt-to-code tool that edits arbitrary code, not a programming language in YAML, and not a way to import an existing project. It supports one stack, done well. When the spec cannot say something, the answer is a small piece of ordinary code in `src/custom/`, which Smithable never overwrites.
