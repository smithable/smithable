# Smithable's AI: setting up models

`smithable ask "<request>"` (and Smith, the assistant in Studio) turns a request in your own words into Smithable operations. The model only proposes; you see the change in plain language and it is applied when you confirm. Nothing it does bypasses the operation pipeline: each change is checked, migrated, committed, and can be undone like any other.

`smithable new <dir> --describe "a booking site for a yoga studio"` starts a project from a sentence. A starter's own description (the text the start page shows for it), or a small edit of one, needs no model: it is read as the starter with a few operations, and the command says so. First the smallest model the policy allows may ask up to three questions (who uses it, what visitors see, what the records hold) and picks the starter to adapt; `--answers "a; b; c"` answers them in order without asking, and `--yes` asks nothing. Either way the model still picks the starter when `--starter` is not given (skipping the questions is not skipping the choice; without a model the starter is the one whose spec shares the most words with the description). The description may be in any language: the questions are asked in it (for `--from`, whose description is the page's text rather than the person's words, in English, the beta's language; when the site is in another language, a fourth question asks which one the app's texts are in, and unanswered they follow the site), and the draft writes the app's name, its landing texts and the labels of its models, fields, choices, actions and pages in that one language, while the names in the spec stay English identifiers. A draft that leaves one of those texts showing its English name goes back to the model with the list, and the plain-language summary quotes the app's texts as they are (a field “Rubrik”, required) rather than bending them by English rules. The words the generated app brings itself (Save, Search, the sign-in page) are English. `smithable clarify "<description>" --json` gives only that step's result, `{ "starter": …, "questions": [{ "question", "options" }] }`, for a program that asks the questions its own way (the hosted service does); a missing or failing model means no questions, never an error. Then the strongest model the policy allows drafts the app as a batch of operations from an empty app that has the starter's access default, with the starter's spec and its roles and access as the example of shape to reuse (its name and sample texts are never taken over), each operation checked as it is applied (docs/design/first-build.md; `SMITHABLE_DRAFT=files` drafts whole spec files adapted from the starter instead). A draft with shared access that anyone could sign up to is made invite-only, with a team page to invite from (the summary says so; `setSignUp anyone` opens it again). What people come to look at before they join (a tool library's tools, a menu, the classes to book) is drafted as public, and records about people never are. A public landing page's button or shortcut to a list of records visitors may read anyway opens that list to them too. A hero's shortcut to a page that stays closed is taken off (its button may still lead to signing in). A draft that is valid but that a visitor would find broken or too open (a public page whose records they may not read, a contact form they cannot send, a person's details open to anyone) goes back to the model with the validator's warnings, once for each new one; what you get is the best the draft has been, a flaw that exposes someone weighing far more than one that only looks broken, and the summary still shows any warning that is left. A field that looks like a payment card's number or a password is taken out of a draft by Smithable itself, whatever the description said: no app should store one. A landing page's sections get their items (a features section's points, a FAQ's questions and answers, testimonials) with `setItems`; from a page, the page's own items are the material, rewritten rather than copied. A footer is always the last section: one a draft placed earlier is moved last. From a page, the app is named after the site (the logo's alt text, the header's link home, `og:site_name`, else the shortest part of the page's title), never the title's sentence. The draft is validated like a hand-written spec, summarised in plain language, and used after you confirm. Then the cheapest allowed model drafts a few sample records for each model in one more small request (in the app's language, each unique value once), written as `samples/<Model>.yml`; a model it leaves out keeps the starter's own sample records where the draft kept their model and fields (records that no longer fit are left out), else generated rows. `--no-sample-data` or `SMITHABLE_NO_SAMPLES=1` skips the request. Without a model, start from a starter with `--starter` (crm, booking, invoicing, or records for "things and what we know about them").

Models are configured with environment variables, so keys never end up in a project.

An app drafted from a description also gets pictures: the landing page's hero, a mark beside its name (the content file's `logo`, see [the spec reference](spec/v0.1.md)) and a few sample pictures for each model's records, chosen by subject from the Smithable image library (pictures made with an AI for Smithable and CC0 photographs from Wikimedia Commons, served from docs.smithable.ai; the index is fetched once a day and cached under `~/.cache/smithable/images/`). For the hero and the mark, what the description and the app's name say counts most, the names of models and fields little; a model's sample pictures follow its own subject (its name, labels and description: a Dish gets dishes), then the app's, and a model nothing in the library fits gets none rather than an off-topic one (its records name their pictures in their sample file; generated rows share the numbered ones, which must fit each model that has them); among heroes that fit equally well the description and the name choose, so two apps of a kind do not look alike while the same app always gets the same picture; with nothing fitting, a calm abstract one. The mark is chosen the same way among the library's marks (never a starter's monogram, which is that starter's own letter), with a tie-break of its own, and when none fits, one of the abstract marks, so every drafted app has one. `SMITHABLE_IMAGE_LIBRARY` gives the library's address when it is served elsewhere (a hosted workspace has no internet, so the service serves it). Each is marked as the library says: `generated: true` for one an AI made, so the app labels the ones that could pass for photographs as made by an AI (on by default, `smithable op setAiBadge false` turns it off; the EU's AI Act asks for it; the spec reference says where), and `generated: false` for a photograph, which has no badge. `public/images/pictures.json` says the same of each picture placed, for the sample records, and `public/images/CREDITS.md` lists each photograph's author, licence and page (CC0 asks for no credit, so no page of the app shows it). A picture the drafted texts name but the app does not have is left out rather than shown broken. Offline, or with `SMITHABLE_NO_PICTURES=1`, the app starts without them, and `smithable new --from <url> --with-pictures` uses the page's own pictures instead. `smithable read-page --url <address>` prints the same description `new --from` would draft from, fetching the page the same way, or fails when the page shows too little without JavaScript. For a page fetched elsewhere (the hosted service fetches it with its own guards, since a workspace has no internet), `smithable read-page page.html --url <address>` reads the saved page instead; the service then runs `clarify` and `new --describe` with it, and `--name` with the name the person typed, which wins over the draft's own.

## A local model (tier 1)

Any OpenAI-compatible server on your machine works. With [Ollama](https://ollama.com):

```bash
ollama pull qwen2.5:7b
export SMITHABLE_LOCAL_MODEL=qwen2.5:7b
# export SMITHABLE_LOCAL_URL=http://localhost:11434/v1   # the default
```

Measured on a laptop without a GPU (WSL, 8 cores, 16 GB): `qwen2.5:7b` answers a request in one to two minutes and did 6 of the 7 benchmark tasks ([report](benchmarks/m12-report.md)), with nothing leaving the machine. With a GPU, or a smaller model such as `qwen2.5:3b`, it is much faster. To make sure no other model is used, set `SMITHABLE_AI_POLICY=local-only`.

## The Smithable model (tier 2)

An open model on an EU-hosted, OpenAI-compatible endpoint, for example Mistral:

```bash
export SMITHABLE_MODEL=mistral-small-latest
export SMITHABLE_MODEL_URL=https://api.mistral.ai/v1
export SMITHABLE_MODEL_KEY=…
export SMITHABLE_MODEL_PRICE=0.1/0.3        # euros per million input/output tokens, for the change trace
# export SMITHABLE_MODEL_LOCATION=elsewhere  # if the endpoint is not in the EU
```

Without `SMITHABLE_MODEL_PRICE`, a Mistral model Smithable knows (`mistral-small`, `mistral-medium`, `mistral-large`) is counted at Mistral's list price, in dollars; any other model costs nothing in the change trace. The trace shows the tokens in and out and their cost.

For the benchmarks and tests, `SMITHABLE_LLM_CACHE=<folder>` keeps each answer by its request (the model, the instructions, the text and the answer's schema) and answers the same request again from the folder, for nothing. It is never on unless set. A kept answer is not asked again when the model behind a name such as `mistral-medium-latest` changes: empty the folder after a model update.

## A frontier model through Claude Code (tier 3)

If you use [Claude Code](https://claude.com/claude-code), Smithable can use it as its frontier model, with your own subscription: no API key, and Smithable never reads its credentials.

```bash
export SMITHABLE_FRONTIER=claude-code
export SMITHABLE_FRONTIER_MODEL=sonnet     # optional; Claude Code's default otherwise
# With SMITHABLE_AI_POLICY=eu-only Claude is never used: it is not EU-hosted.
```

Smithable runs `claude -p` with no tools, no MCP servers and an empty working directory: it only answers, and cannot read or change the project. Its cost is reported in dollars.

## Claude through Amazon Bedrock (tier 3)

With the `aws` command signed in, Claude runs through Amazon Bedrock with no key in any file. An `eu.` inference profile keeps the request in the EU, so it counts as EU-hosted under `eu-only`:

```bash
export SMITHABLE_FRONTIER=bedrock
export SMITHABLE_FRONTIER_MODEL=eu.anthropic.claude-haiku-5-5   # the newest Haiku: fast and cheap
# export SMITHABLE_FRONTIER_MODEL=eu.anthropic.claude-sonnet-5-5  # stronger, about twenty times the price
# export SMITHABLE_BEDROCK_REGION=eu-north-1                      # or AWS_REGION; eu-north-1 if not set
```

The fixed instructions are cached between calls, and the cost is reported in dollars at Bedrock's EU price. A prompt over 100k tokens is never sent (Haiku 5.5 charges five times as much above it); none of Smithable's requests come near it.

## Claude through Anthropic's API (tier 3)

With an API key from Anthropic, Claude runs through Anthropic's own API. One model, or several cheapest first: a request the first cannot do, or whose answer fails Smithable's checks, goes to the next (a first build starts with the strongest):

```bash
export SMITHABLE_FRONTIER=anthropic
export SMITHABLE_FRONTIER_MODEL=claude-haiku-5-5,claude-sonnet-5-5   # or one of them
export ANTHROPIC_API_KEY=…
# With SMITHABLE_AI_POLICY=eu-only Claude is never used this way: use Bedrock's eu. profiles.
```

The answer's schema is sent as structured output where the API can hold it, the fixed instructions are cached, and the cost is reported in dollars at Anthropic's list price. How the models compare on Smithable's own tasks: [docs/benchmarks/claude-5-5.md](https://github.com/smithable/smithable/blob/main/docs/benchmarks/claude-5-5.md).

## Custom code

Some requests need code, not an operation: ranking customers by churn risk, a custom action's behaviour. A coder writes it, only in `src/custom/`:

```bash
export SMITHABLE_CODER=claude-code         # Claude Code, headless in the project
export SMITHABLE_CODER_MODEL=sonnet        # optional
export SMITHABLE_AI_POLICY=allow:claude-code,smithable  # Claude runs outside the EU: allow it
smithable code query:churnRisk "rank by days since the last order"
```

The coder is subject to the same AI policy as every model call: Claude Code counts as outside the EU, so a project with the `eu-only` policy refuses it. A coder of your own (`SMITHABLE_CODER_COMMAND`) says where it runs with `SMITHABLE_CODER_LOCATION=local` or `eu`; if not set, it counts as outside the EU too.

`smithable ask` runs the coder by itself when its proposal adds a query. `smithable code hooks "email the customer when an order ships"` has it write a hook in `src/custom/hooks.ts`, what happens after a record is created, changed or deleted, or once a day; `ask` points there when a request describes such behaviour. The coder is asked to read only the project, edit only `src/custom/`, and run only the type check (Claude Code runs with `--permission-mode dontAsk` and path-scoped rules). It never runs the tests: they execute the code it wrote, so Smithable runs them itself afterwards. Be clear about the boundary: the coder is a program running with your privileges, and those rules are its tool's settings, not a sandbox. What Smithable guarantees is what gets committed: every changed file, ignored file and Git hook is checked, and so are the installed packages, build output and dev database, before any test runs (except the caches the preview's dev server writes, and Smithable's own snapshots and token log). A change anywhere else undoes everything: Git's undo, the hooks put back, build output removed, packages installed again, and a changed dev database named so it can be restored. A failing type check or test undoes everything too. The result is one commit that `smithable undo` reverts. Measured: "Prioritise customers most likely to churn on the dashboard" became a query, a dashboard tile and tested code for $0.45 with Sonnet.

### Telling from your own code

Code in `src/custom/` can tell someone through the same outbox the spec's `outgoing` entries use, so it gets the signing, the retries for a day, Activity's line and "Send again" without writing them:

```ts
import { tell, tellMail } from "#/kit/tell.server";

await tell("crmFeed", { customer: id, merged: true }); // a target the spec's outgoing names (to: crmFeed)
await tellMail("admin", "Customers merged", `#${keep} kept, #${duplicate} merged into it.`); // a role, or an address
```

The target must be one the spec's `outgoing` section calls (`to: crmFeed`), so where the app may call stays the administrator's; its address and secret are the settings `OUTGOING_CRMFEED_URL` and `OUTGOING_CRMFEED_SECRET`. A visitor's request (no one signed in) mails a role, never an address. For a call that needs its answer at once, use `fetch`. A custom action can also be told about without code: `outgoing: { customersMerged: { when: mergeCustomers, to: crmFeed } }` calls the target after the action returns, with its input and output.

## A language's first draft

`smithable translate sv` (and **Draft them with the model** in Studio's Languages tab) gives the texts still empty in one of the app's other languages to the configured model in one request, and saves what comes back as one change: read them after, since a model's words are a first draft, and `smithable undo` takes them all back. The policy (below) says which model may do it.

## The app's assistant (Ask)

A generated app's **Ask** panel answers questions about its records and makes the changes it is asked for, through the app's own tools and as the person asking: it may do only what their role may. Questions worded the usual way are read by rules in the app itself, with no model and at no cost. For the rest, the app uses the model its host gives it:

```bash
export ASSISTANT_URL=https://api.eu.mistral.ai/v1   # any OpenAI-compatible chat endpoint that can call tools; Mistral's EU one is what a hosted app at Strict or Normal may reach
export ASSISTANT_KEY=…
export ASSISTANT_MODEL=mistral-small-latest      # or claude-haiku-5-5, through a gateway that serves Claude
```

Without them, Ask answers by its rules alone and says when a question needs a model.

On smithable.ai, where a project's AI may run follows its region and, for an EU project, its level. Accounts and projects are **global** unless their owner chooses the EU (the account's page, "Region"); on smithable.eu every account is EU. A global project's Ask uses the best model for the job through Anthropic's own API: Claude Haiku 5.5 for a question, Claude Sonnet 5.5 when an answer's checks fail; Mistral Medium when the service's monthly allowance for Claude is used up. An EU project (every project on smithable.eu, and any project a global account marks EU) is hosted in Sweden, with its data and backups, like every project; its level sets where its AI requests go, set on the app's page under "Where your data and AI may go":

| Level | Ask's model | The app's connections |
|---|---|---|
| **Relaxed** | the global project's models, through Anthropic's API in the US | any service |
| **Normal** (an EU project starts here) | Claude Haiku 5.5 run in the EU where an EU endpoint serves it; Mistral Medium until then | services served from an endpoint in the EU |
| **Strict** | Mistral Small, moving to Mistral Medium when it gets stuck | only services run by EU companies; people sign in with an email code only (no Google or Facebook) |

Strict is about the AI and the services an app uses: it does not make every company behind the service an EU company (the hosting, on AWS, or the mail delivery). At Relaxed, and for a global project, a request to Claude goes through Anthropic's own API and may be processed in the USA, with the question and the records it needs. Projects made before the regions existed are global.

Measured on 134 questions and changes across six starters ([bench-ask](benchmarks/bench-ask-seven-tools.md), [cascade](benchmarks/bench-ask-cascade.md)), with each answer checked against the records:

| Model | Right | Cost per question | Time |
|---|---|---|---|
| Claude Haiku 4.5 | 131 / 134 (98 %) | $0.0061 | 5.9 s |
| Mistral Small | 119 / 134 (89 %) | $0.0006 | 2.9 s |
| Mistral Small, moving to Haiku when stuck (measured before Strict moved to Medium) | 120 / 134 (90 %) | $0.0010 | 3.8 s |
| Claude Sonnet 4.6 | 134 / 134 (100 %) | $0.0179 | 6.3 s |

Almost every wrong answer was stated as fact rather than as doubt, so a cheaper model's misses are not easy to spot: that is why Normal uses Haiku.

## Teaching Smithable a section

For a section of `smithable.yml` Smithable does not know, `smithable teach <section>` has the coder write a project plugin once (see the [spec reference](spec/v0.1.md)). The coder may write only in `smithable/plugins/<section>/`, read only the project, and run only the type check (validating the plugin would run its code). Smithable then declares the plugin, validates it by regenerating, type-checks and tests, or undoes everything. Measured: a `newsletter:` section was taught with Sonnet for about $0.60; regenerating afterwards used no AI.

## Policy

`SMITHABLE_AI_POLICY` decides which models may see the project:

| Policy | Allowed |
|---|---|
| `best-available` (default) | Any configured model, the cheapest capable one first |
| `eu-only` | Local models and EU-hosted ones |
| `local-only` | Only models on this machine |
| `allow:local,smithable` | Only the named providers |

A request worded like an everyday change ("Customers should have a phone number", "Only admins may delete customers", "Show orders first in the menu") becomes operations without any model, in milliseconds and offline; anything that does not resolve to exactly one model, field or page goes to the cheapest allowed tier first. A model gets four chances to repair an answer that does not apply; after that, or when it says no operation can do it while a stronger model is allowed, the request goes to the next tier. An unclear request gets a question back instead of a guess, and a request that needs custom code is said to need it.

A question about the app ("who can delete orders?", "is the schedule public?", "what is a customer?") is answered rather than applied: the common shapes from the spec itself without a model, the rest by the cheapest allowed model in a few sentences.

What each request used (tier, model, tokens, cost) is shown before you confirm, recorded in the change's commit and shown in Studio's change trace. Context sizes and usage are logged locally to `data/.smithable/token-log.jsonl`, never sent anywhere.
