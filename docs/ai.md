# Smithable's AI: setting up models

`smithable ask "<request>"` (and the Builder's **Describe** tab in Studio) turns a request in your own words into Smithable operations. The model only proposes; you see the change in plain language and it is applied when you confirm. Nothing it does bypasses the operation pipeline: each change is checked, migrated, committed and undoable like any other.

`smithable new <dir> --describe "a booking site for a yoga studio"` starts a project from a sentence. First the smallest model the policy allows may ask up to three questions (who uses it, what visitors see, what the records hold) and picks the starter to adapt; `--answers "a; b; c"` answers them in order without asking, and `--yes` asks nothing. Either way the model still picks the starter when `--starter` is not given (skipping the questions is not skipping the choice; without a model the starter is the one whose spec shares the most words with the description). The description may be in any language: the questions are asked in it, and the draft writes the app's name, its landing texts and the labels of its models, fields, choices and pages in it, while the names in the spec stay English identifiers. The words the generated app brings itself (Save, Search, the sign-in page) are English. `smithable clarify "<description>" --json` gives only that step's result, `{ "starter": …, "questions": [{ "question", "options" }] }`, for a program that asks the questions its own way (the hosted service does); a missing or failing model means no questions, never an error. Then the strongest model the policy allows drafts the app as a batch of operations from an empty app that has the starter's access default, with the starter's spec and its roles and access as the example of shape to reuse (its name and sample texts are never taken over), each operation checked as it is applied (docs/design/first-build.md; `SMITHABLE_DRAFT=files` drafts whole spec files adapted from the starter instead). A draft with shared access that anyone could sign up to is made invite-only, with a team page to invite from (the summary says so; `setSignUp anyone` opens it again). The draft is validated like a hand-written spec, summarised in plain language, and used after you confirm. Its first preview shows the starter's own sample records for every model and field the draft kept (records that no longer fit are left out); other models get generated rows. Without a model, start from a starter with `--starter` (crm, booking, invoicing, or records for "things and what we know about them").

Models are configured with environment variables, so keys never end up in a project.

An app drafted from a description also gets pictures: the landing page's hero and a few sample pictures for its records, chosen by subject from the Smithable image library (photographs made for Smithable, CC0, served from docs.smithable.ai; the index is fetched once a day and cached under `~/.cache/smithable/images/`). `SMITHABLE_IMAGE_LIBRARY` gives the library's address when it is served elsewhere (a hosted workspace has no internet, so the service serves it). A picture the drafted texts name but the app does not have is left out rather than shown broken. Offline, or with `SMITHABLE_NO_PICTURES=1`, the app starts without them, and `smithable new --from <url> --with-pictures` uses the page's own pictures instead. For a page fetched elsewhere (the hosted service fetches it with its own guards, since a workspace has no internet), `smithable read-page page.html --url <address>` prints the same description `new --from` would draft from, or fails when the page shows too little without JavaScript; the service then runs `clarify` and `new --describe` with it, and `--name` with the name the person typed, which wins over the draft's own.

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
export SMITHABLE_AI_POLICY=best-available  # Claude is not EU-hosted, so eu-only never uses it
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

The coder is subject to the same AI policy as every model call: Claude Code counts as outside the EU, so the default `eu-only` refuses it until the policy allows it. A coder of your own (`SMITHABLE_CODER_COMMAND`) says where it runs with `SMITHABLE_CODER_LOCATION=local` or `eu`; unsaid, it counts as outside the EU too.

`smithable ask` runs the coder by itself when its proposal adds a query. `smithable code hooks "email the customer when an order ships"` has it write a hook in `src/custom/hooks.ts`, what happens after a record is created, changed or deleted, or once a day; `ask` points there when a request describes such behaviour. The coder is asked to read only the project, edit only `src/custom/`, and run only the type check (Claude Code runs with `--permission-mode dontAsk` and path-scoped rules). It never runs the tests: they execute the code it wrote, so Smithable runs them itself afterwards. Be clear about the boundary: the coder is a program running with your privileges, and those rules are its tool's settings, not a sandbox. What Smithable guarantees is what gets committed: every changed file, ignored file and Git hook is checked, and so are the installed packages, build output and dev database, before any test runs (except the caches the preview's dev server writes, and Smithable's own snapshots and token log). A change anywhere else undoes everything: Git's undo, the hooks put back, build output removed, packages installed again, and a changed dev database named so it can be restored. A failing type check or test undoes everything too. The result is one commit that `smithable undo` reverts. Measured: "Prioritise customers most likely to churn on the dashboard" became a query, a dashboard tile and tested code for $0.45 with Sonnet.

## Teaching Smithable a section

For a section of `smithable.yml` Smithable does not know, `smithable teach <section>` has the coder write a project plugin once (see the [spec reference](spec/v0.1.md)). The coder may write only in `smithable/plugins/<section>/`, read only the project, and run only the type check (validating the plugin would run its code). Smithable then declares the plugin, validates it by regenerating, type-checks and tests, or undoes everything. Measured: a `newsletter:` section was taught with Sonnet for about $0.60; regenerating afterwards used no AI.

## Policy

`SMITHABLE_AI_POLICY` decides which models may see the project:

| Policy | Allowed |
|---|---|
| `eu-only` (default) | Local models and EU-hosted ones |
| `local-only` | Only models on this machine |
| `best-available` | Any configured model |
| `allow:local,smithable` | Only the named providers |

A request worded like an everyday change ("Customers should have a phone number", "Only admins may delete customers", "Show orders first in the menu") becomes operations without any model, in milliseconds and offline; anything that does not resolve to exactly one model, field or page goes to the cheapest allowed tier first. A model gets two chances to repair an answer that does not apply; after that, or when it says no operation can do it while a stronger model is allowed, the request goes to the next tier. An unclear request gets a question back instead of a guess, and a request that needs custom code is said to need it.

A question about the app ("who can delete orders?", "is the schedule public?", "what is a customer?") is answered rather than applied: the common shapes from the spec itself without a model, the rest by the cheapest allowed model in a few sentences.

What each request used (tier, model, tokens, cost) is shown before you confirm, recorded in the change's commit and shown in Studio's change trace. Context sizes and usage are logged locally to `data/.smithable/token-log.jsonl`, never sent anywhere.
