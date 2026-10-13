# Smithable — Vision

## What Smithable is

Smithable is an app builder for everyone who wants to create web applications: people who have never written code and developers who want to move faster. You describe what you want in plain language or through a visual editor. Smithable turns it into a compact, technology-neutral specification (`smithable.yml`) and generates an ordinary, good-looking full-stack web application from it.

It competes with prompt-to-app builders such as Lovable, with one fundamental difference:

> **Smithable understands the application.** Routine changes are made by deterministic generators, not by an AI rewriting code. So changes don't break your app, most of them cost nothing, and the result stays clean enough for a developer to take over.

It combines:

- **Lovable**: describe an app in words, see it instantly, edit visually, publish in one click.
- **Rails**: convention over configuration, one obvious way to do common things, concise code.
- **Model-driven development**: the application's structure is declared, not rediscovered.
- **Coding agents**: AI for interpretation and for genuinely custom logic, used only where needed.

## Who it is for

One product with two ways in, working on the same project:

| | **Builder** | **Studio** |
|---|---|---|
| For | Non-developers: founders, small businesses, domain experts | Developers, agencies |
| Works through | Chat, preview, click-to-edit, guided setup | Spec editor, diffs, code, CLI, MCP, Git |
| Sees the spec as | A plain-language summary | YAML |
| Publishes by | One click | One click, or their own infrastructure |

The switch is a toggle, not a migration. That enables the **handoff**: a non-developer builds the app, and a developer takes over the same project and finds clean code, a spec and tests.

Developers can also start straight from GitHub: the open-source CLI, local Studio and MCP server work on their own, with any AI agent they already use.

## Where we start: the beachhead

We will not launch as "an app builder for everyone". The first customers are the people for whom Smithable's strengths are exactly what they are missing:

1. **People who hit the wall with prompt-to-code builders.** Their project grew too big, the credits ran away, or every change broke something else. They already feel the pain Smithable solves, so they are the easiest customers to convince.
2. **EU small businesses and agencies building business apps:** booking systems, customer portals, internal tools. They care about GDPR, reliability and handing work over to developers, and the spec model covers these apps well.

Everything early (templates, page patterns, marketing, the benchmark and user interviews) is judged by whether it serves these two groups. We broaden only once they are well served.

Public evidence supports both: in 15 threads and reviews from prompt-to-code users, 12 describe fixes that fail or break what worked, and 10 describe unpredictable costs of changes, including paid repairs. In five EU-facing discussions, four say that where data is hosted blocks client deals, and three that regional hosting is priced beyond small projects.

## Why Smithable instead of prompt-to-code builders

These are the problems users of prompt-to-code builders commonly hit, and each one is a design goal for Smithable:

| Problem | Smithable's answer |
|---|---|
| Credits burned on the AI fixing its own bugs, sometimes in loops | Standard features are generated, not AI-written, so there is nothing to fix. Those changes cost 0 tokens |
| One change breaks something else | Generated tests run on every change. A failing change rolls back automatically |
| The AI loses track as the project grows | The spec is the memory. AI only ever sees a small, relevant slice |
| Security holes, such as data exposed through misconfigured access rules | Access rules are declared in the spec, enforced server-side by generated code, and covered by generated tests |
| Unpredictable costs | Most changes are free or nearly free. Every change shows what handled it and what it cost |
| All generated apps look alike | Designed themes, brand input and a library of page patterns |
| Database changes that lose data or cannot be rolled back | Migrations that keep data; undo includes the database |
| Hard to hand over to developers or to leave the platform | Normal, idiomatic code, a detach command, standard hosting |
| US-hosted, GDPR uncertainty, EU hosting only on expensive plans | EU hosting and EU-only AI as a setting on every plan, including the free one, and fully self-hostable |
| Surprise hosting bills | Spending caps on by default |

The headline: **changes don't break your app, and you don't pay for the AI's mistakes.**

## The core bet

A prompt-to-code builder asked to "add a phone number to customers" has the AI read the code, find the schema, form, API and tests, and edit many files. Smithable runs `addField(Customer, phone, phone)` deterministically, in milliseconds, for 0 tokens.

When a request needs interpretation, the cheapest capable tier handles it, and it gets a narrow slice of the spec rather than the whole codebase:

```text
generators (0 tokens) → local model (if available) → Smithable model (hosted, EU) → frontier model
```

**Transparency is part of the product.** Every change shows what handled it (generator, local model, Smithable model or frontier model), the tokens and cost, and, where measured, an honest estimate of what a conventional AI builder would have used.

The bet can be measured, and we will measure it (roadmap M7).

## Principles

1. **`smithable.yml` is the source of truth for functionality.** It is a neat, compact DSL. Where the DSL cannot express something precisely, scoped natural language inside the spec (`description`, `intent`, `rules`, `examples`) fills the gap. Code is used only where actual programming is required.
2. **Deterministic before AI, and the cheapest capable model first.** If a generator can make the change, no model is called.
3. **You decide where it runs.** Everything can run self-hosted or with local models, so an organization can guarantee that nothing leaves its network. On the hosted service, a project or an organization can require that its data and AI calls stay in the EU; without that, AI calls go to the best model for the job, wherever it runs, and the service says which. smithable.eu, when it exists, is the edition where EU-only infrastructure and AI are always on. (Decided 2026-10-04: until then "EU by default" was the principle. It serves EU organizations and nobody else; the promise that serves everyone is that the choice is theirs.)
4. **Generated applications are ordinary and independent.** The output is a regular, idiomatic web application that a developer who knows the stack would find unsurprising. It has **no runtime or build dependency on Smithable** and keeps working if Smithable disappears.
5. **Beautiful by default.** Design quality comes from carefully crafted themes and page patterns, not from AI improvisation.
6. **Open source stands alone.** The engine, CLI, Studio and MCP server are fully useful without an account or subscription. The hosted service builds on the open-source product, never the reverse.
7. **Concise code.** No routine boilerplate. Each domain definition is written once and derived everywhere else.
8. **Everything can be undone.** Every change can be reviewed and reverted.
9. **Tests and scanners are authoritative.** AI may explain findings; it never silences them.

## Non-goals

- A prompt → LLM → arbitrary-code-edit tool.
- A general-purpose programming language in YAML.
- Supporting many stacks early. One stack, done well.
- Importing and understanding arbitrary existing projects (deferred indefinitely).
- Teams, enterprise SSO and complex account systems before the single-user product is compelling.

## Business shape

Principle: **you can do everything yourself; the subscription does it for you.** Nothing needed to run an app safely in production (including backups) is withheld from open source.

| | Open source (free) | Hosted (free tier and subscription) |
|---|---|---|
| Building | Engine, CLI, Studio, MCP server, run locally | Builder and Studio in the browser, nothing to install |
| AI | Local models, or your own API keys | Smithable model and frontier models with included allowances; EU-only processing as a setting |
| Publish | Build the container; deploy to your own Docker host (SSH + Compose) or any container platform | One click to EU hosting, with domains, TLS, logs and rollback |
| Backups | `smithable backup` to your own S3-compatible bucket; manual restore | Automatic, point-in-time restore, verified restores, alerts |
| Agents | Local MCP server | Remote MCP endpoint, so Claude.ai, ChatGPT and other agents can work on hosted projects |
| Support | Community | Direct support |

Pricing rules:

- **Included allowances, not opaque credits.** Each plan states what it includes: apps, hosting size, backup retention, AI usage. Extra usage is visible and fairly priced.
- **You don't pay for the AI's mistakes.** An AI change that fails its checks is rolled back and does not count against the allowance. Undo is always free.
- **Hosting in the region you need on every plan**, including the free tier (the EU for those who must stay there, as a setting, never a plan upgrade), and **spending caps on by default**.
- **Efficiency is the margin.** Low token usage makes a generous free tier and a no-signup demo affordable, and it lowers the cost of every paid plan.

Paid services plug into open-source extension points (AI provider, preview runtime, deploy target, backup target). Paid code lives in the private `smithable-cloud` repository, which depends on open source and never the reverse.

**Licensing** (leaning, pending legal review):

- Apache-2.0 for the engine, tools and specification.
- 0BSD for the app kit and templates, so generated apps carry no license obligations.
- A registered EU trademark for the name "Smithable".

## What success looks like

A non-developer describes a booking site in one sentence, has a good-looking working app within minutes, and publishes it the same day. Months and dozens of changes later, most of which cost nothing, the app still works, and a developer can take it over without rewriting it.
