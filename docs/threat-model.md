# Threat model

Written for Anthropic's OSS Scanner, which audits open-source projects with a large user base. The image it builds Smithable with lived in `.oss-scanner/` and is in this repository's history (commit 3d0996c4, removed 2026-10-29); when Smithable has that user base, bring it back and point `projects/smithable` in github.com/anthropics/oss-scanner at it. The threat model itself stands on its own and is kept current here.

Smithable is a local-first app builder: a short spec (`smithable.yml` and its companions) is compiled into an ordinary TanStack + Drizzle + SQLite application. People change the spec through operations, from the command line, Studio (a local web app) or an AI model that only proposes; the model's proposal goes through the same operation layer and validator as a typed change. The generated app depends on no Smithable package: what runs in the world is the generated code plus the small app kit copied into it (`src/kit/`). The hosted service (smithable.ai) is a separate, private repository and is out of scope here; its guards around this engine are described at docs.smithable.ai.

## Where untrusted input enters

- **The spec files**, parsed by `packages/core` (YAML, our own schemas and validators). A project cloned from a stranger is untrusted input to the parser, the validator and the generator: a spec must never make the generator write outside the project, run anything, or produce code that escapes the app's own access rules.
- **Web pages**, with `smithable new --from <url>` and `smithable read-page`: HTML fetched from the internet and read by `packages/cli/src/from-page.ts` (size and time limits, redirects, private addresses). The hosted service fetches with its own guards and hands the engine a saved page.
- **Model output**: drafts and proposed operations (`packages/ai`), including from a local model anyone can point Smithable at. Everything a model proposes is validated like typed input and shown before it is applied; a draft may not add a field that stores a card number or a password.
- **The generated app's users and visitors**: sign-in by email code and OAuth, roles and access rules, forms, uploads (pictures and files, with review), API keys (`/api/v1`), the assistant's tools, outgoing mail. All of it is in the app kit (`packages/adapter-tanstack/templates/src/kit/`) and the generated server code (`packages/adapter-tanstack/src/`).
- **Agents** through the MCP server (`packages/cli/src/mcp.ts`): a local agent with the user's own rights; the tools are the operations.

Trusted: the person at the keyboard and their machine. The CLI, the daemon and Studio run locally with the user's rights; a local attacker is not in scope.

## What matters most, and least

- Most: the **app kit and generated server code**, since every deployed app runs them: access rules (shared and private, roles, `public`), ownership, API keys and their roles, uploads, sign-in, mail, and anything that could be XSS or injection in the generated pages and queries. Then **core's parser and validator** against a hostile spec, and **from-page** against a hostile page.
- In scope but less: Studio (`apps/studio`, served on localhost to the user), the AI drafting prompts.
- Out of scope: the third-party libraries themselves (TanStack, Drizzle, shadcn/ui, Vite), `docs/`, `scripts/` (benchmarks and tooling), `examples/` (sample specs).

## How to exercise it

- Engine: `pnpm test` (Vitest, `src/**/*.test.ts`). The CLI is `node packages/cli/dist/bin.js`; `smithable validate`, `smithable op <operation> …`, `smithable generate` on any project. `examples/` holds the starters' specs; generation is deterministic (the same spec gives byte-identical output).
- A generated app with its packages installed is at `/app` (the CRM starter): `pnpm dev` serves it on port 3000 with sample data and a sign-in by email code printed to the console; `pnpm test` runs its own tests. `smithable.auth.yml` there shows the roles and access rules to test against.
- `docs/ARCHITECTURE.md` §12 describes verification and security; `docs/spec/v0.1.md` the spec; `.github/SECURITY.md` how we handle reports.

## How we rate severity

- Critical: a spec or a page that makes the engine write outside the project, execute code, or reach the network beyond the fetch asked for; a generated app that lets a visitor or a signed-in user read, change or delete records the access rules deny, or act with another role (including through an API key or the assistant).
- High: stored or reflected XSS in generated pages; an upload that escapes its review or its folder; sign-in codes or OAuth state that can be guessed, replayed or bound to another account; secrets written into a project.
- Medium: denial of service of one app from unauthenticated input; information leaks about records the viewer may not read (counts, search, mail).
- Low: anything needing the user's own machine or an already signed-in administrator.

## Anything to leave alone

- The hosted service and its infrastructure (not in this repository; report by mail to security@smithable.ai).
- Findings that are only in the third-party libraries, unless Smithable uses them wrongly.
- The AI benchmarks and screenshot scripts under `scripts/`, and the `docs/benchmarks` data.
