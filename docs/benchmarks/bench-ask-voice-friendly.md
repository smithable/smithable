# bench-ask: voice-friendly (2026-10-11), voice friendly

The questions of [bench-ask-questions.mjs](../../scripts/bench-ask-questions.mjs), asked of each starter's assistant tools at `/mcp` with an administrator's key ([bench-ask.mjs](../../scripts/bench-ask.mjs)), by each model: it calls tools until it answers (at most 8 model calls). A read is right when its answer gives the number, names, words or pairs worked out from the records; a change is right when the records afterwards say so. Each change starts from the starter's records.

| Model | Right | Wrong | Of them, a count or sum the model worked out | Gave up or failed | Model calls per question | Reads in one or two calls | Tokens in / out per question | Tool results per question (tokens) | Cost per question | Time |
|---|---|---|---|---|---|---|---|---|---|---|
| mistral-small-latest | 23 / 25 (92 %) | 2 | 0 | 0 | 2.5 | 17 / 20 | 3,949 / 78 | 39 | $0.0006 | 1.9 s |

The tools each starter offers (`tools/list`, about four characters a token):

| Starter | Tools | Their size (tokens) | The app's summary (tokens) |
|---|---|---|---|
| invoicing | 8 | 1,108 | 195 |

## Per starter

| Starter | mistral-small-latest |
|---|---|
| invoicing | 23 / 25 |

## Not right

| Model | Starter | # | Question | Outcome | Expected | Answer |
|---|---|---|---|---|---|---|
| mistral-small-latest | invoicing | 8 | Which client has the most invoices? | wrong | ["Kallio Design","Skerry Software"] | Kallio Design has the most invoices, with 2. |
| mistral-small-latest | invoicing | 10 | Which of our clients are in Finland? | wrong | ["Kallio Design","Skerry Software"] | It looks like none of your clients are currently listed with a Finnish address. If you'd like, I can help you add a new client from Finland! |
