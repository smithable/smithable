# Smithable's AI: setting up models

`smithable ask "<request>"` (and the Builder's **Describe** tab in Studio) turns a request in your own words into Smithable operations. The model only proposes; you see the change in plain language and it is applied when you confirm. Nothing it does bypasses the operation pipeline: each change is checked, migrated, committed and undoable like any other.

`smithable new <dir> --describe "a booking site for a yoga studio"` starts a project from a sentence. The closest starter is picked without a model; then the strongest model the policy allows adapts its spec files to the description, once. The draft is validated like a hand-written spec (a draft with errors goes back once with the exact messages), summarised in plain language, and used after you confirm. Without a model, start from a starter with `--starter`.

Models are configured with environment variables, so keys never end up in a project.

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

`smithable ask` runs the coder by itself when its proposal adds a query. The coder is asked to read only the project, edit only `src/custom/`, and run only the type check (Claude Code runs with `--permission-mode dontAsk` and path-scoped rules). It never runs the tests: they execute the code it wrote, so Smithable runs them itself afterwards. Be clear about the boundary: the coder is a program running with your privileges, and those rules are its tool's settings, not a sandbox. What Smithable guarantees is what gets committed: every changed file, ignored file and Git hook is checked, a change anywhere else undoes everything, and so does a failing type check or test. The result is one commit that `smithable undo` reverts. Measured: "Prioritise customers most likely to churn on the dashboard" became a query, a dashboard tile and tested code for $0.45 with Sonnet.

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

Requests go to the cheapest allowed tier first. A model gets one chance to repair an answer that does not apply; after that the request goes to the next tier. An unclear request gets a question back instead of a guess, and a request that needs custom code is said to need it.

What each request used (tier, model, tokens, cost) is shown before you confirm, recorded in the change's commit and shown in Studio's change trace. Context sizes and usage are logged locally to `data/.smithable/token-log.jsonl`, never sent anywhere.
