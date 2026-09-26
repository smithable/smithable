# Smithable — Vision

## What Smithable is

Smithable is an open-source, local-first application builder for developers. You describe an application in a compact, technology-neutral manifest (`smithable.yml`). Smithable generates an ordinary full-stack web application from that manifest, keeps the two in sync, and lets you change the application through a CLI, a visual Studio, or natural language.

It combines:

- **Rails**: convention over configuration, one obvious way to do common things, concise code.
- **Lovable**: visual editing, prompt-driven changes, instant preview.
- **Model-driven development**: the application's structure is declared, not rediscovered.
- **Coding agents**: optional AI for interpretation and for genuinely custom logic.

## The core bet

> Smithable understands the application, so AI does not have to rediscover it on every request, and most routine changes need no AI at all.

A conventional coding agent asked to "add a phone number to Customer" reads the repository, finds the schema, form, API and tests, and edits many files. Smithable runs `addField(Customer, phone, phone)` deterministically and spends 0 AI tokens.

If the request is phrased loosely ("customers need somewhere to enter their mobile number"), a small local model translates it into the same operation. Larger models are used only when real reasoning or custom code is required, and even then they get a narrow, structured slice of context rather than the repository.

The bet can be measured, and we will measure it (see the roadmap's benchmark milestone).

## Primary user (v1)

**Developers.** They are comfortable reading code, use the CLI and Studio, and want to move faster without losing control. The visual editor accelerates their work; it does not replace understanding the code. Non-developer users come later, once the semantic core is proven.

## Non-negotiable principles

1. **`smithable.yml` is the source of truth for functionality.** It is a neat, compact DSL. Where the DSL cannot express something precisely, scoped natural language inside the manifest (`description`, `intent`, `rules`, `examples`) fills the gap. Code is used only where actual programming is required.
2. **Deterministic before AI.** If Smithable can perform a change with a rule or generator, it never calls a model.
3. **Local before remote, EU before elsewhere.** Execution priority: deterministic → local model → EU-hosted managed model → user-selected external model. A company must be able to guarantee that no source code leaves its network.
4. **Generated applications are ordinary and independent.** The output is a regular, idiomatic web application and backend that a developer who knows the stack would find unsurprising. It has **no runtime or build dependency on Smithable** and keeps working if Smithable disappears.
5. **Open source stands alone.** The local product is fully useful without an account, subscription, Smithable Cloud or Smithable-managed inference. Smithable Cloud depends on the open-source product, never the reverse.
6. **Concise code.** No routine boilerplate (Controller/Service/Repository/DTO/Mapper per model). Each domain definition is written once and derived everywhere else.
7. **Everything is undoable.** Every change is a reviewable diff and can be reverted.
8. **Scanner and test output are authoritative.** AI may explain findings; it never silences them.

## Non-goals

- A prompt → LLM → arbitrary-code-edit tool.
- A general-purpose programming language in YAML.
- Supporting many stacks early. One stack, done well.
- Importing and understanding arbitrary existing projects (deferred indefinitely).
- Cloud hosting, billing, teams, or SSO before the local product is compelling.

## Business shape (later, not now)

Principle: **open source can do everything yourself; the subscription does it for you.** Nothing needed to run an app safely in production (including backups) is withheld from open source. The subscription sells convenience, operations and peace of mind.

| | Open source (free) | Subscription |
|---|---|---|
| Building | Everything: deterministic tooling, Studio, MCP server | Same |
| AI | Local models, or your own API keys and providers | Included allowance of EU-hosted AI (Mistral), no setup |
| Deploy | Build the container yourself; deploy to your own Docker host (SSH + Compose) or any container platform | One-click deploy to Smithable-hosted EU infrastructure, with domains, TLS, logs and rollback |
| Backups | `smithable backup` to local disk or your own S3-compatible bucket; manual restore | Automatic backups with point-in-time restore, automatic restore verification, and alerts |
| Support | Community | Direct support |

Pricing rules:

- **Included allowances, not opaque credits.** Each plan states concretely what it includes: number of apps, hosting size, backup retention and monthly AI tokens. Extra usage is visible and fairly priced. Hosting and AI costs scale with usage, and a pure flat fee would let heavy users erase the margin.
- **Efficiency is the margin.** Smithable's low token usage directly lowers the cost of the included AI allowance. Benchmark results are a sales argument and a cost model at the same time.
- **A possible first paid product:** managed backups for self-deployed apps. It is far less work than full hosting, easy to explain, and useful from day one.

All paid services plug into open-source extension points (AI provider, deploy target, backup target). Paid code lives in the private `smithable-cloud` repository, which depends on open source and never the reverse.

Licensing is undecided. The direction: a permissive license for the specification and schemas, so they can be implemented independently; an OSI-approved license for the tooling (possibly AGPL); and no license obligations on generated applications. Get legal advice before publishing. The repository stays private until the architecture is stable.

## What success looks like

A developer can go from `smithable new crm` to a running, containerised CRM, then evolve it over dozens of changes (most applied with zero cloud tokens) and still end up with a codebase they would be happy to maintain by hand.
