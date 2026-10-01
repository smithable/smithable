# Smithable documentation

Smithable is an app builder for people who have never written code and for developers who want to move faster. You describe a web application in plain language or through a visual editor. Smithable turns it into a compact, technology-neutral specification, `smithable.yml`, and generates an ordinary full-stack web application from it.

Routine changes are made by deterministic generators, not by an AI rewriting code: adding a phone number to customers is one operation, in milliseconds, for no tokens. The generated app is a normal TanStack Start app with React, Tailwind, shadcn/ui, Drizzle and SQLite. It has no dependency on Smithable at build time or run time, and a developer can take it over at any time.

- **[Getting started](start.md)**: install the CLI, make a first app, open it in Studio.
- **[The spec reference](../spec/v0.1.md)**: everything `smithable.yml` and its companion files can say, with examples.
- **[AI setup](../ai.md)**: the models behind `smithable ask` and drafting an app from a sentence, local first.
- **[JSON Schema](https://docs.smithable.ai/schema/smithable-0.1.json)** for `smithable.yml`, for autocomplete and checking in your editor.

The source is on [GitHub](https://github.com/smithable/smithable), under the Apache-2.0 licence.
