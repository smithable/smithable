# bench-ask: voice-plain (2026-10-11), voice plain

The questions of [bench-ask-questions.mjs](../../scripts/bench-ask-questions.mjs), asked of each starter's assistant tools at `/mcp` with an administrator's key ([bench-ask.mjs](../../scripts/bench-ask.mjs)), by each model: it calls tools until it answers (at most 8 model calls). A read is right when its answer gives the number, names, words or pairs worked out from the records; a change is right when the records afterwards say so. Each change starts from the starter's records.

| Model | Right | Wrong | Of them, a count or sum the model worked out | Gave up or failed | Model calls per question | Reads in one or two calls | Tokens in / out per question | Tool results per question (tokens) | Cost per question | Time |
|---|---|---|---|---|---|---|---|---|---|---|
| mistral-small-latest | 22 / 25 (88 %) | 3 | 0 | 0 | 2.4 | 18 / 20 | 3,870 / 64 | 33 | $0.0006 | 2.6 s |

The tools each starter offers (`tools/list`, about four characters a token):

| Starter | Tools | Their size (tokens) | The app's summary (tokens) |
|---|---|---|---|
| invoicing | 8 | 1,108 | 195 |

## Per starter

| Starter | mistral-small-latest |
|---|---|
| invoicing | 22 / 25 |

## Not right

| Model | Starter | # | Question | Outcome | Expected | Answer |
|---|---|---|---|---|---|---|
| mistral-small-latest | invoicing | 8 | Which client has the most invoices? | wrong | ["Kallio Design","Skerry Software"] | No invoices found. |
| mistral-small-latest | invoicing | 10 | Which of our clients are in Finland? | wrong | ["Kallio Design","Skerry Software"] | No clients in Finland. |
| mistral-small-latest | invoicing | 22 | Mark invoice 2026-006 as sent. | wrong |  | No such invoice. |
