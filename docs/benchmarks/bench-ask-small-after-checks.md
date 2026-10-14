# bench-ask: small-after-checks (2026-10-14)

The questions of [bench-ask-questions.mjs](../../scripts/bench-ask-questions.mjs), asked of each starter's assistant tools at `/mcp` with an administrator's key ([bench-ask.mjs](../../scripts/bench-ask.mjs)), by each model: it calls tools until it answers (at most 8 model calls). A read is right when its answer gives the number, names, words or pairs worked out from the records; a change is right when the records afterwards say so. Each change starts from the starter's records.

Correctness is judged on the answer's facts against the records (a count, a name or id found, a record changed), never on the tool calls: a confident answer that is wrong counts as wrong. "Stated as fact" is a wrong answer given as true, such as a total, a name or "there is no such invoice", rather than one saying the model could not tell; it is the kind a person would act on. "Right when every tool call was valid" counts the questions whose tool calls all succeeded, and how many of them were answered right: valid calls are not a right answer.

| Model | Right | Wrong | Of them, stated as fact | Of them, a count or sum the model worked out | Right when every tool call was valid | Gave up or failed | Model calls per question | Reads in one or two calls | Tokens in / out per question | Tool results per question (tokens) | Cost per question | Time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mistral-small-latest | 120 / 134 (90 %) | 12 | 12 | 0 | 102 / 110 | 2 | 2.6 | 80 / 99 | 3,956 / 60 | 47 | $0.0006 | 2.9 s |

**mistral-small-latest**, the app's answer check (ask-checks.md §3): 3 of 134 answers went back to the model; 3 of them came back grounded (1 right). 0 were shown as not confirmed: 0 wrong and 0 right. A wrong answer shown as not confirmed is not counted as stated as fact.

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

| Starter | mistral-small-latest |
|---|---|
| crm | 24 / 25 |
| invoicing | 21 / 25 |
| status | 22 / 25 |
| booking | 21 / 24 |
| marketplace | 18 / 20 |
| records | 14 / 15 |

## Not right

| Model | Starter | # | Question | Outcome | Expected | Answer |
|---|---|---|---|---|---|---|
| mistral-small-latest | crm | 14 | Which customers have never ordered anything? | wrong (stated as fact) | [] | All customers have placed at least one order. |
| mistral-small-latest | invoicing | 8 | Which client has the most invoices? | wrong (stated as fact) | ["Kallio Design","Skerry Software"] | Fjord Analytics |
| mistral-small-latest | invoicing | 10 | Which of our clients are in Finland? | wrong (stated as fact) | ["Kallio Design","Skerry Software"] | none |
| mistral-small-latest | invoicing | 19 | How much is still to be paid to us? | wrong (stated as fact) | 2770.5 | none |
| mistral-small-latest | invoicing | 24 | Add a line to invoice 2026-006: proofreading, two hours at 60. | wrong (stated as fact) |  | No such invoice. |
| mistral-small-latest | status | 5 | How long was the website down, in minutes? | gave up | 21 |  |
| mistral-small-latest | status | 21 | Post an update on the card payments incident: "Fully recovered, no payments were lost.", status resolved. | wrong (stated as fact) |  | Resolved. |
| mistral-small-latest | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | Mobile app login failure: investigating. |
| mistral-small-latest | booking | 16 | What is the biggest class we run, by places? | wrong (stated as fact) | 16 | 13 |
| mistral-small-latest | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| mistral-small-latest | booking | 20 | Power flow is called Power vinyasa from now on. | wrong (stated as fact) |  | Power vinyasa |
| mistral-small-latest | booking | 25 | Change Oskar Berg's bio to: Oskar teaches Vinyasa and Power flow. | wrong (stated as fact) |  | Emma Lindqvist |
| mistral-small-latest | marketplace | 1 | How many things are for sale? | wrong (stated as fact) | 13 | 14 |
| mistral-small-latest | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | gave up |  |  |
| mistral-small-latest | records | 6 | Which items have a link? | wrong (stated as fact) | ["Wall clock","Birch bark basket"] | none |
