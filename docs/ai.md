# Smithable's AI: setting up models

`smithable ask "<request>"` (and the Builder's **Describe** tab in Studio) turns a request in your own words into Smithable operations. The model only proposes; you see the change in plain language and it is applied when you confirm. Nothing it does bypasses the operation pipeline: each change is checked, migrated, committed and undoable like any other.

Models are configured with environment variables, so keys never end up in a project.

## A local model (tier 1)

Any OpenAI-compatible server on your machine works. With [Ollama](https://ollama.com):

```bash
ollama pull qwen2.5:7b
export SMITHABLE_LOCAL_MODEL=qwen2.5:7b
# export SMITHABLE_LOCAL_URL=http://localhost:11434/v1   # the default
```

## The Smithable model (tier 2)

An open model on an EU-hosted, OpenAI-compatible endpoint, for example Mistral:

```bash
export SMITHABLE_MODEL=mistral-small-latest
export SMITHABLE_MODEL_URL=https://api.mistral.ai/v1
export SMITHABLE_MODEL_KEY=…
export SMITHABLE_MODEL_PRICE=0.1/0.3        # euros per million input/output tokens, for the change trace
# export SMITHABLE_MODEL_LOCATION=elsewhere  # if the endpoint is not in the EU
```

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
