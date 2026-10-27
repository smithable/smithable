# Smithable documentation

*Soft to change. Hard as steel.*

Smithable is an app builder for people who have never written code and for developers who want to move faster. You describe a web application in plain language or through a visual editor. Smithable turns it into a compact, technology-neutral specification, `smithable.yml`, and generates an ordinary full-stack web application from it.

Routine changes are made by deterministic generators, not by an AI rewriting code: adding a phone number to customers is one operation, in a second or two, with no AI model and no tokens. The generated app is a normal TanStack Start app with React, Tailwind, shadcn/ui, Drizzle and SQLite. It has no dependency on Smithable at build time or run time, and a developer can take it over at any time.

- **[Getting started](start.md)**: in the browser [on smithable.ai](start-hosted.md), with nothing to install, or [on your own machine](start-local.md) with the command line and Studio, the visual editor.
- **[Starters](starters.md)**: the ten apps to begin from, with pictures: a CRM, a booking site, invoicing, a marketplace, records, a status page, tasks and notes an AI assistant keeps, a support desk fed by mail, a food truck people order ahead from, and a barbershop booked by its barbers' time.
- **[Why Smithable](why.md)**: what is different about changes, cost, ownership, security and where things run, with the measurements.
- **[Questions and answers](faq.md)**: how it compares, what it can build today, hosting, data, contributing.
- **How-tos:**
  - [Change an app without writing code](change.md): four changes and an undo through operations on the status starter.
  - [Buttons that change a record](actions.md): standard actions, from setting a field to copying a record with its lines.
  - [Let other programs use your app](api.md): keys, the API's calls and its refusals, on the status starter.
  - [An app for programs and assistants](assistants.md): the api starter, a key for an AI assistant, and Claude Code connected to it.
  - [Book a person's time](appointments.md): a barber's hours and days off, appointments that never overlap, on the barbers starter.
  - [An app in another language](language.md): Swedish for the booking starter, and what stays English on purpose.
  - [Make a theme](theme.md): a theme of your own as a file, checked for readable colors, and in the [theme lab](https://docs.smithable.ai/theme-lab/index.html) beside a real app.
  - [Where the pictures come from](pictures.md): the image library, pictures made with an AI and real photographs, each with its source.
  - [Mail and calls out](outgoing.md) and [in](incoming.md): an app that mails people and calls other systems when something happens, and turns mail and calls into records.
  - [Sign in with Google](google-sign-in.md): offering Google beside the default sign-in, a code sent by email.
  - [Run an app on your own machine](self-host.md): deploying, backing up, restoring and updating.
- **[The spec reference](../spec/v0.1.md)**: everything `smithable.yml` and its companion files can say, with examples.
- **[AI setup](../ai.md)**: the models behind `smithable ask` and drafting an app from a sentence, local first.
- **[JSON Schema](https://docs.smithable.ai/schema/smithable-0.1.json)** for `smithable.yml`, for autocomplete and checking in your editor, and one for each companion file: [auth](https://docs.smithable.ai/schema/smithable-auth-0.1.json), [ux](https://docs.smithable.ai/schema/smithable-ux-0.1.json), [content](https://docs.smithable.ai/schema/smithable-content-0.1.json), [context](https://docs.smithable.ai/schema/smithable-context-0.1.json).

The source is on [GitHub](https://github.com/smithable/smithable), under the Apache-2.0 licence.
