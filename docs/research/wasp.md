# Research: Wasp's spec design (September 2026)

Wasp (wasp.sh) is the closest predecessor to Smithable: a declarative spec that generates a React/Node app. This note summarises what they learned and what Smithable takes from it. The sources were gathered by desk research; the claims are theirs.

## What happened

- **Custom DSL (`main.wasp`, 2020–2026).** A statically typed language inspired by JSON/HCL, with declarations like `page`, `route`, `query`, `action`, `job`, `entity`, and imports of user code (`fn: import { getTasks } from "@src/queries"`). [docs](https://wasp.sh/docs/0.15/general/language)
- **Models moved out (0.14).** Entities moved from `.wasp` files into a standard `schema.prisma`, because "users couldn't use some advanced Prisma features". [migration guide](https://wasp.sh/docs/0.14/migration-guide)
- **TypeScript spec (preview 0.15 in 2024, default 0.24 in June 2026).** The DSL was retired. [spec docs](https://wasp.sh/docs/0.24/general/spec), [blog](https://wasp.sh/blog/2026/06/15/wasp-typescript-spec)
- **Postmortem (May 2026): "Inventing a new programming language for web development was a mistake".** [blog](https://wasp.sh/blog/2026/05/13/new-language-for-web-dev-was-a-mistake)
  - They built their own language server and editor support and reached only about 80% of the expected IDE experience.
  - A new language raised the learning curve and ecosystem worries.
  - LLMs generated their DSL worse than TypeScript.
  - What they kept: the value is "a high-level understanding of your entire app at compile time", not the syntax.
- **Eject dropped.** Human-readable generated code was meant to avoid lock-in, but "almost nobody ejected". Wasp moved to runtime libraries, largely because its templates had no linting, type-checking or refactoring support. [blog](https://wasp.sh/blog/2025/07/18/faster-wasp-dev)
- **Upgrades.** Each 0.x release had manual migration guides, and 0.24 added LLM prompts to automate conversion. Caret dependency ranges caused unexpected upgrades. [migration guide](https://wasp.sh/docs/0.24/migration-guide), [issue #2965](https://github.com/wasp-lang/wasp/issues/2965)

## What Smithable takes from it

1. **No new language.** The spec is YAML with a published JSON Schema: editor support and validation for free, and LLMs are fluent in it.
2. **Keep in-string shorthand tiny.** Field shorthand (`string!`, `email unique`, `a | b = a`, `Customer!`, `Order[]`), field-path templates (`"{classType.name}"`) and simple computed values (`quantity * unitPrice`, `sum(lines.amount)`) are the entire in-string grammar. It is precisely specified, validated with helpful errors, and always has a long form. It must never grow conditionals, functions or loops. That is what custom code is for.
3. **Why not a TypeScript spec like Wasp?** Smithable's spec must be edited by deterministic operations (comment-preserving YAML edits), readable by non-developers and small models, and technology-neutral. A TypeScript config fails all three. Wasp's reasons for TypeScript (variables, loops, npm imports) are needs Smithable meets with custom code instead.
4. **A database escape hatch is needed.** Developers will need database features the spec does not cover (special indexes, constraints, custom column types). They need a user-owned extension point (see ARCHITECTURE §15).
5. **Templates must be real, checked code.** Generator templates and the app kit are real TypeScript that is linted and type-checked. The sample apps are generated, type-checked and tested on every `pnpm check`. This removes the maintenance problem that pushed Wasp to runtime libraries.
6. **Independence is still worth it.** Wasp users rarely ejected. Smithable's reason for dependency-free apps is the handoff from non-developers to developers and trust, not eject. Keep it, but measure whether it matters to users (M7 interviews).
7. **Pin exact versions and automate migrations.** This is already the plan (ARCHITECTURE §14).
