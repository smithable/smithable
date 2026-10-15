# Smithable's AI: setting up models

`smithable ask "<request>"` (and the Builder's **Describe** tab in Studio) turns a request in your own words into Smithable operations. The model only proposes; you see the change in plain language and it is applied when you confirm. Nothing it does bypasses the operation pipeline: each change is checked, migrated, committed, and can be undone like any other.

`smithable new <dir> --describe "a booking site for a yoga studio"` starts a project from a sentence. A starter's own description (the text the start page shows for it), or a small edit of one, needs no model: it is read as the starter with a few operations, and the command says so. First the smallest model the policy allows may ask up to three questions (who uses it, what visitors see, what the records hold) and picks the starter to adapt; `--answers "a; b; c"` answers them in order without asking, and `--yes` asks nothing. Either way the model still picks the starter when `--starter` is not given (skipping the questions is not skipping the choice; without a model the starter is the one whose spec shares the most words with the description). The description may be in any language: the questions are asked in it (for `--from`, whose description is the page's text rather than the person's words, in English, the beta's language; when the site is in another language, a fourth question asks which one the app's texts are in, and unanswered they follow the site), and the draft writes the app's name, its landing texts and the labels of its models, fields, choices, actions and pages in that one language, while the names in the spec stay English identifiers. A draft that leaves one of those texts showing its English name goes back to the model with the list, and the plain-language summary quotes the app's texts as they are (a field “Rubrik”, required) rather than bending them by English rules. The words the generated app brings itself (Save, Search, the sign-in page) are English. `smithable clarify "<description>" --json` gives only that step's result, `{ "starter": …, "questions": [{ "question", "options" }] }`, for a program that asks the questions its own way (the hosted service does); a missing or failing model means no questions, never an error. Then the strongest model the policy allows drafts the app as a batch of operations from an empty app that has the starter's access default, with the starter's spec and its roles and access as the example of shape to reuse (its name and sample texts are never taken over), each operation checked as it is applied (docs/design/first-build.md; `SMITHABLE_DRAFT=files` drafts whole spec files adapted from the starter instead). A draft with shared access that anyone could sign up to is made invite-only, with a team page to invite from (the summary says so; `setSignUp anyone` opens it again). What people come to look at before they join (a tool library's tools, a menu, the classes to book) is drafted as public, and records about people never are. A public landing page's button or shortcut to a list of records visitors may read anyway opens that list to them too. A hero's shortcut to a page that stays closed is taken off (its button may still lead to signing in). A draft that is valid but that a visitor would find broken or too open (a public page whose records they may not read, a contact form they cannot send, a person's details open to anyone) goes back to the model with the validator's warnings, once for each new one; what you get is the best the draft has been, a flaw that exposes someone weighing far more than one that only looks broken, and the summary still shows any warning that is left. A field that looks like a payment card's number or a password is taken out of a draft by Smithable itself, whatever the description said: no app should store one. The draft is validated like a hand-written spec, summarised in plain language, and used after you confirm. Its first preview shows the starter's own sample records for every model and field the draft kept (records that no longer fit are left out); other models get generated rows. Without a model, start from a starter with `--starter` (crm, booking, invoicing, or records for "things and what we know about them").

Models are configured with environment variables, so keys never end up in a project.

An app drafted from a description also gets pictures: the landing page's hero, a mark beside its name (the content file's `logo`, see [the spec reference](spec/v0.1.md)) and a few sample pictures for its records, chosen by subject from the Smithable image library (pictures made with an AI for Smithable, CC0, served from docs.smithable.ai; the index is fetched once a day and cached under `~/.cache/smithable/images/`). What the description and the app's name say counts most, the names of models and fields little; among heroes that fit equally well the description and the name choose, so two apps of a kind do not look alike while the same app always gets the same picture; with nothing fitting, a calm abstract one. The mark is chosen the same way among the library's marks (never a starter's monogram, which is that starter's own letter), with a tie-break of its own, and when none fits, one of the abstract marks, so every drafted app has one. `SMITHABLE_IMAGE_LIBRARY` gives the library's address when it is served elsewhere (a hosted workspace has no internet, so the service serves it). Each is marked `generated: true`, so the app labels the ones that could pass for photographs as made by an AI (the EU's AI Act asks it; the spec reference says where). A picture the drafted texts name but the app does not have is left out rather than shown broken. Offline, or with `SMITHABLE_NO_PICTURES=1`, the app starts without them, and `smithable new --from <url> --with-pictures` uses the page's own pictures instead. `smithable read-page --url <address>` prints the same description `new --from` would draft from, fetching the page the same way, or fails when the page shows too little without JavaScript. For a page fetched elsewhere (the hosted service fetches it with its own guards, since a workspace has no internet), `smithable read-page page.html --url <address>` reads the saved page instead; the service then runs `clarify` and `new --describe` with it, and `--name` with the name the person typed, which wins over the draft's own.

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

## Custom code

Some requests need code, not an operation: ranking customers by churn risk, a custom action's behaviour. A coder writes it, only in `src/custom/`:

```bash
export SMITHABLE_CODER=claude-code         # Claude Code, headless in the project
export SMITHABLE_CODER_MODEL=sonnet        # optional
export SMITHABLE_AI_POLICY=allow:claude-code,smithable  # Claude runs outside the EU: allow it
smithable code query:churnRisk "rank by days since the last order"
```

The coder is subject to the same AI policy as every model call: Claude Code counts as outside the EU, so a project with the `eu-only` policy refuses it. A coder of your own (`SMITHABLE_CODER_COMMAND`) says where it runs with `SMITHABLE_CODER_LOCATION=local` or `eu`; unsaid, it counts as outside the EU too.

`smithable ask` runs the coder by itself when its proposal adds a query. `smithable code hooks "email the customer when an order ships"` has it write a hook in `src/custom/hooks.ts`, what happens after a record is created, changed or deleted, or once a day; `ask` points there when a request describes such behaviour. The coder is asked to read only the project, edit only `src/custom/`, and run only the type check (Claude Code runs with `--permission-mode dontAsk` and path-scoped rules). It never runs the tests: they execute the code it wrote, so Smithable runs them itself afterwards. Be clear about the boundary: the coder is a program running with your privileges, and those rules are its tool's settings, not a sandbox. What Smithable guarantees is what gets committed: every changed file, ignored file and Git hook is checked, and so are the installed packages, build output and dev database, before any test runs (except the caches the preview's dev server writes, and Smithable's own snapshots and token log). A change anywhere else undoes everything: Git's undo, the hooks put back, build output removed, packages installed again, and a changed dev database named so it can be restored. A failing type check or test undoes everything too. The result is one commit that `smithable undo` reverts. Measured: "Prioritise customers most likely to churn on the dashboard" became a query, a dashboard tile and tested code for $0.45 with Sonnet.

## A language's first draft

`smithable translate sv` (and **Draft them with the model** in Studio's Languages tab) gives the texts still empty in one of the app's other languages to the configured model in one request, and saves what comes back as one change: read them after, since a model's words are a first draft, and `smithable undo` takes them all back. The policy (below) says which model may do it.

## The app's assistant (Ask)

A generated app's **Ask** panel answers questions about its records and makes the changes it is asked for, through the app's own tools and as the person asking: it may do only what their role may. Questions worded the usual way are read by rules in the app itself, with no model and at no cost. For the rest, the app uses the model its host gives it:

```bash
export ASSISTANT_URL=https://api.mistral.ai/v1   # any OpenAI-compatible chat endpoint that can call tools
export ASSISTANT_KEY=…
export ASSISTANT_MODEL=mistral-small-latest      # or claude-haiku-4-5, through a gateway that serves Claude
```

Without them, Ask answers by its rules alone and says when a question needs a model.

On smithable.ai, which model answers depends on the project's level, which its owner sets on the app's page under "Where your data and AI may go". At every level the data is stored and hosted in the EU.

| Level | Ask's model | The app's connections |
|---|---|---|
| **Normal** (a new project starts here) | Claude Haiku 4.5, run in the EU; Mistral Medium when Haiku is unavailable | services served from an endpoint in the EU |
| **Strict** | Mistral Small, moving to Mistral Medium when it gets stuck | only services run by EU companies; people sign in with an email code only (no Google or Facebook) |

Relaxed, for organizations outside the EU, comes later. Projects made before the levels existed stay on Mistral until their owner picks a level.

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

A request worded like an everyday change ("Customers should have a phone number", "Only admins may delete customers", "Show orders first in the menu") becomes operations without any model, in milliseconds and offline; anything that does not resolve to exactly one model, field or page goes to the cheapest allowed tier first. A model gets two chances to repair an answer that does not apply; after that, or when it says no operation can do it while a stronger model is allowed, the request goes to the next tier. An unclear request gets a question back instead of a guess, and a request that needs custom code is said to need it.

A question about the app ("who can delete orders?", "is the schedule public?", "what is a customer?") is answered rather than applied: the common shapes from the spec itself without a model, the rest by the cheapest allowed model in a few sentences.

What each request used (tier, model, tokens, cost) is shown before you confirm, recorded in the change's commit and shown in Studio's change trace. Context sizes and usage are logged locally to `data/.smithable/token-log.jsonl`, never sent anywhere.
