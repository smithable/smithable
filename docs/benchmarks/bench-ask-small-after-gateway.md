# bench-ask: small-after-gateway (2026-10-14)

The questions of [bench-ask-questions.mjs](../../scripts/bench-ask-questions.mjs), asked of each starter's assistant tools at `/mcp` with an administrator's key ([bench-ask.mjs](../../scripts/bench-ask.mjs)), by each model: it calls tools until it answers (at most 8 model calls). A read is right when its answer gives the number, names, words or pairs worked out from the records; a change is right when the records afterwards say so. Each change starts from the starter's records.

Correctness is judged on the answer's facts against the records (a count, a name or id found, a record changed), never on the tool calls: a confident answer that is wrong counts as wrong. "Stated as fact" is a wrong answer given as true, such as a total, a name or "there is no such invoice", rather than one saying the model could not tell; it is the kind a person would act on. "Right when every tool call was valid" counts the questions whose tool calls all succeeded, and how many of them were answered right: valid calls are not a right answer.

| Model | Right | Wrong | Of them, stated as fact | Of them, a count or sum the model worked out | Right when every tool call was valid | Gave up or failed | Model calls per question | Reads in one or two calls | Tokens in / out per question | Tool results per question (tokens) | Cost per question | Time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cascade:mistral-small-latest>mistral-medium-latest | 122 / 134 (91 %) | 11 | 11 | 0 | 101 / 109 | 1 | 2.6 | 79 / 99 | 4,023 / 61 | 53 | $0.0016 | 3.4 s |

**cascade:mistral-small-latest>mistral-medium-latest** moved 19 of 134 questions to the better model (5 after two refused tool calls, 14 at the fourth call, 0 after an answer that gave up, 0 after an answer the check sent back twice); 17 of them were then right. Of the 115 that stayed on the cheap model, 105 were right.

**cascade:mistral-small-latest>mistral-medium-latest**, the app's answer check (ask-checks.md §3): 2 of 134 answers went back to the model; 1 of them came back grounded (0 right). 1 were shown as not confirmed: 0 wrong and 1 right. A wrong answer shown as not confirmed is not counted as stated as fact.

The tools each starter offers (`tools/list`, about four characters a token):

| Starter | Tools | Their size (tokens) | The app's summary (tokens) |
|---|---|---|---|
| crm | 8 | 1,111 | 145 |
| invoicing | 8 | 1,108 | 222 |
| status | 8 | 1,117 | 255 |
| booking | 7 | 1,040 | 206 |
| marketplace | 7 | 944 | 109 |
| records | 7 | 944 | 84 |

## Per starter

| Starter | cascade:mistral-small-latest>mistral-medium-latest |
|---|---|
| crm | 25 / 25 |
| invoicing | 21 / 25 |
| status | 23 / 25 |
| booking | 22 / 24 |
| marketplace | 17 / 20 |
| records | 14 / 15 |

## Not right

| Model | Starter | # | Question | Outcome | Expected | Answer |
|---|---|---|---|---|---|---|
| cascade:mistral-small-latest>mistral-medium-latest | invoicing | 2 | Which invoices are overdue? | wrong (stated as fact) | ["2026-003"] | 3 |
| cascade:mistral-small-latest>mistral-medium-latest | invoicing | 8 | Which client has the most invoices? | wrong (stated as fact) | ["Kallio Design","Skerry Software"] | Kallio Design |
| cascade:mistral-small-latest>mistral-medium-latest | invoicing | 10 | Which of our clients are in Finland? | wrong (stated as fact) | ["Kallio Design","Skerry Software"] | none |
| cascade:mistral-small-latest>mistral-medium-latest | invoicing | 12 | What is the biggest single line we have invoiced? | wrong (stated as fact) | ["Brand guidelines"] | 1400 |
| cascade:mistral-small-latest>mistral-medium-latest | status | 5 | How long was the website down, in minutes? | wrong (stated as fact) | 21 | 1 |
| cascade:mistral-small-latest>mistral-medium-latest | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | Mobile app login failure: investigating. |
| cascade:mistral-small-latest>mistral-medium-latest | booking | 16 | What is the biggest class we run, by places? | wrong (stated as fact) | 16 | 13 |
| cascade:mistral-small-latest>mistral-medium-latest | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| cascade:mistral-small-latest>mistral-medium-latest | booking | 25 | Change Oskar Berg's bio to: Oskar teaches Vinyasa and Power flow. | wrong (stated as fact) |  | Oskar teaches Vinyasa and Power flow. |
| cascade:mistral-small-latest>mistral-medium-latest | marketplace | 1 | How many things are for sale? | wrong (stated as fact) | 13 | 14 |
| cascade:mistral-small-latest>mistral-medium-latest | marketplace | 7 | How many items per category? | wrong (stated as fact) | {"kids":2,"other":1,"sports":2,"electronics":3,"bikes":2,"furniture":4} | 4, 3, 2, 2, 2, 1 |
| cascade:mistral-small-latest>mistral-medium-latest | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | gave up |  |  |
| cascade:mistral-small-latest>mistral-medium-latest | records | 6 | Which items have a link? | wrong (stated as fact) | ["Wall clock","Birch bark basket"] | none |
