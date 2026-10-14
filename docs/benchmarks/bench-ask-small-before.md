# bench-ask: small-before (2026-10-14)

The questions of [bench-ask-questions.mjs](../../scripts/bench-ask-questions.mjs), asked of each starter's assistant tools at `/mcp` with an administrator's key ([bench-ask.mjs](../../scripts/bench-ask.mjs)), by each model: it calls tools until it answers (at most 8 model calls). A read is right when its answer gives the number, names, words or pairs worked out from the records; a change is right when the records afterwards say so. Each change starts from the starter's records.

Correctness is judged on the answer's facts against the records (a count, a name or id found, a record changed), never on the tool calls: a confident answer that is wrong counts as wrong. "Stated as fact" is a wrong answer given as true, such as a total, a name or "there is no such invoice", rather than one saying the model could not tell; it is the kind a person would act on. "Right when every tool call was valid" counts the questions whose tool calls all succeeded, and how many of them were answered right: valid calls are not a right answer.

| Model | Right | Wrong | Of them, stated as fact | Of them, a count or sum the model worked out | Right when every tool call was valid | Gave up or failed | Model calls per question | Reads in one or two calls | Tokens in / out per question | Tool results per question (tokens) | Cost per question | Time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mistral-small-latest | 122 / 134 (91 %) | 11 | 11 | 0 | 106 / 116 | 1 | 2.5 | 87 / 99 | 3,638 / 67 | 44 | $0.0006 | 3.1 s |

The tools each starter offers (`tools/list`, about four characters a token):

| Starter | Tools | Their size (tokens) | The app's summary (tokens) |
|---|---|---|---|
| crm | 8 | 1,111 | 118 |
| invoicing | 8 | 1,108 | 195 |
| status | 8 | 1,117 | 229 |
| booking | 7 | 1,040 | 179 |
| marketplace | 7 | 944 | 83 |
| records | 7 | 944 | 57 |

## Per starter

| Starter | mistral-small-latest |
|---|---|
| crm | 24 / 25 |
| invoicing | 21 / 25 |
| status | 24 / 25 |
| booking | 21 / 24 |
| marketplace | 18 / 20 |
| records | 14 / 15 |

## Not right

| Model | Starter | # | Question | Outcome | Expected | Answer |
|---|---|---|---|---|---|---|
| mistral-small-latest | crm | 14 | Which customers have never ordered anything? | wrong (stated as fact) | [] | All 8 customers have placed at least one order. |
| mistral-small-latest | invoicing | 8 | Which client has the most invoices? | wrong (stated as fact) | ["Kallio Design","Skerry Software"] | Kallio Design. |
| mistral-small-latest | invoicing | 10 | Which of our clients are in Finland? | wrong (stated as fact) | ["Kallio Design","Skerry Software"] | No clients in Finland. |
| mistral-small-latest | invoicing | 14 | How many hours have we billed at 85 an hour? | wrong (stated as fact) | 30 | 3 hours have been billed at 85 an hour. |
| mistral-small-latest | invoicing | 24 | Add a line to invoice 2026-006: proofreading, two hours at 60. | wrong (stated as fact) |  | No invoice with number 2026-006 found. |
| mistral-small-latest | status | 5 | How long was the website down, in minutes? | wrong (stated as fact) | 21 | No record of the website being down. |
| mistral-small-latest | booking | 15 | How many sessions are there of each class? | wrong (stated as fact) | {"Power flow":2,"Yin":4,"Vinyasa":4,"Hatha":4,"Foundations":2} | There are 2 Hatha, 3 Vinyasa, 4 Yin, 1 Foundations, and 5 Power flow sessions. |
| mistral-small-latest | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| mistral-small-latest | booking | 20 | Power flow is called Power vinyasa from now on. | wrong (stated as fact) |  | Done. |
| mistral-small-latest | booking | 25 | Change Oskar Berg's bio to: Oskar teaches Vinyasa and Power flow. | wrong (stated as fact) |  | Done. Oskar Berg's bio has been updated. |
| mistral-small-latest | marketplace | 1 | How many things are for sale? | wrong (stated as fact) | 13 | There are **14** items for sale. |
| mistral-small-latest | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | gave up |  |  |
| mistral-small-latest | records | 6 | Which items have a link? | wrong (stated as fact) | ["Wall clock","Birch bark basket"] | No items have a link. |
