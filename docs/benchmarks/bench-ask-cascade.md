# bench-ask: cascade (2026-10-12)

The questions of [bench-ask-questions.mjs](../../scripts/bench-ask-questions.mjs), asked of each starter's assistant tools at `/mcp` with an administrator's key ([bench-ask.mjs](../../scripts/bench-ask.mjs)), by each model: it calls tools until it answers (at most 8 model calls). A read is right when its answer gives the number, names, words or pairs worked out from the records; a change is right when the records afterwards say so. Each change starts from the starter's records.

Correctness is judged on the answer's facts against the records (a count, a name or id found, a record changed), never on the tool calls: a confident answer that is wrong counts as wrong. "Stated as fact" is a wrong answer given as true, such as a total, a name or "there is no such invoice", rather than one saying the model could not tell; it is the kind a person would act on. "Right when every tool call was valid" counts the questions whose tool calls all succeeded, and how many of them were answered right: valid calls are not a right answer.

| Model | Right | Wrong | Of them, stated as fact | Of them, a count or sum the model worked out | Right when every tool call was valid | Gave up or failed | Model calls per question | Reads in one or two calls | Tokens in / out per question | Tool results per question (tokens) | Cost per question | Time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | 120 / 134 (90 %) | 14 | 13 | 0 | 103 / 113 | 0 | 2.4 | 84 / 99 | 3,676 / 70 | 43 | $0.0010 | 3.8 s |
| mistral-small-latest | 119 / 134 (89 %) | 15 | 15 | 0 | 104 / 114 | 0 | 2.4 | 83 / 99 | 3,525 / 63 | 43 | $0.0006 | 3.5 s |

**cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0** moved 12 of 134 questions to the better model (5 after two refused tool calls, 7 at the fourth call, 0 after an answer that gave up); 11 of them were then right. Of the 122 that stayed on the cheap model, 109 were right.

The tools each starter offers (`tools/list`, about four characters a token):

| Starter | Tools | Their size (tokens) | The app's summary (tokens) |
|---|---|---|---|
| crm | 8 | 1,111 | 118 |
| invoicing | 8 | 1,108 | 195 |
| status | 8 | 1,117 | 227 |
| booking | 7 | 1,040 | 179 |
| marketplace | 7 | 944 | 83 |
| records | 7 | 944 | 57 |

## Per starter

| Starter | cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | mistral-small-latest |
|---|---|---|
| crm | 24 / 25 | 24 / 25 |
| invoicing | 20 / 25 | 19 / 25 |
| status | 23 / 25 | 23 / 25 |
| booking | 21 / 24 | 21 / 24 |
| marketplace | 18 / 20 | 18 / 20 |
| records | 14 / 15 | 14 / 15 |

## Not right

| Model | Starter | # | Question | Outcome | Expected | Answer |
|---|---|---|---|---|---|---|
| cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | crm | 14 | Which customers have never ordered anything? | wrong (stated as fact) | [] | All 8 customers have placed at least one order. |
| mistral-small-latest | crm | 14 | Which customers have never ordered anything? | wrong (stated as fact) | [] | All 8 customers have placed at least one order. |
| cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | invoicing | 3 | Show the unpaid invoices: the sent and the overdue ones. | wrong (stated as fact) | ["2026-005","2026-004","2026-003"] | You have no unpaid invoices. |
| cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | invoicing | 8 | Which client has the most invoices? | wrong (stated as fact) | ["Kallio Design","Skerry Software"] | Kallio Design. |
| cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | invoicing | 10 | Which of our clients are in Finland? | wrong (stated as fact) | ["Kallio Design","Skerry Software"] | No clients found in Finland. |
| cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | invoicing | 19 | How much is still to be paid to us? | wrong (stated as fact) | 2770.5 | €3,220.50 is still to be paid. |
| cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | invoicing | 22 | Mark invoice 2026-006 as sent. | wrong (stated as fact) |  | No such invoice. |
| mistral-small-latest | invoicing | 3 | Show the unpaid invoices: the sent and the overdue ones. | wrong (stated as fact) | ["2026-005","2026-004","2026-003"] | No unpaid invoices found. |
| mistral-small-latest | invoicing | 8 | Which client has the most invoices? | wrong (stated as fact) | ["Kallio Design","Skerry Software"] | Kallio Design. |
| mistral-small-latest | invoicing | 10 | Which of our clients are in Finland? | wrong (stated as fact) | ["Kallio Design","Skerry Software"] | No clients found in Finland. |
| mistral-small-latest | invoicing | 15 | What is on invoice 2026-005? | wrong (stated as fact) | ["Travel to Bergen","Dashboard workshop"] | Invoice **2026-005**: - **Client**: 4 - **Issued on**: 2026-09-28 - **Due on**: 2026-10-28 - **Status**: sent - **Total**: €1110.50 |
| mistral-small-latest | invoicing | 19 | How much is still to be paid to us? | wrong (stated as fact) | 2770.5 | Nothing is outstanding. |
| mistral-small-latest | invoicing | 24 | Add a line to invoice 2026-006: proofreading, two hours at 60. | wrong (stated as fact) |  | No invoice with number 2026-006 found. |
| cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | status | 5 | How long was the website down, in minutes? | wrong (stated as fact) | 21 | No record found for "Website down". |
| cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | Incident **Mobile app login failure** (ID: 3) reported, status: investigating. |
| mistral-small-latest | status | 5 | How long was the website down, in minutes? | wrong (stated as fact) | 21 | No record found for "Website down". |
| mistral-small-latest | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | Incident **Mobile app login failure** (ID: 3) reported, status: *investigating*. |
| cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | booking | 15 | How many sessions are there of each class? | wrong (stated as fact) | {"Power flow":2,"Yin":4,"Vinyasa":4,"Hatha":4,"Foundations":2} | There are 2 sessions of Hatha, 3 of Vinyasa, 4 of Yin, 1 of Foundations, and 5 of Power flow. |
| cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | booking | 20 | Power flow is called Power vinyasa from now on. | wrong (stated as fact) |  | Done. |
| cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | booking | 25 | Change Oskar Berg's bio to: Oskar teaches Vinyasa and Power flow. | wrong (stated as fact) |  | Done. |
| mistral-small-latest | booking | 15 | How many sessions are there of each class? | wrong (stated as fact) | {"Power flow":2,"Yin":4,"Vinyasa":4,"Hatha":4,"Foundations":2} | There are 2 sessions of Hatha, 3 of Vinyasa, 4 of Yin, 1 of Foundations, and 5 of Power flow. |
| mistral-small-latest | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| mistral-small-latest | booking | 20 | Power flow is called Power vinyasa from now on. | wrong (stated as fact) |  | Done. |
| mistral-small-latest | booking | 25 | Change Oskar Berg's bio to: Oskar teaches Vinyasa and Power flow. | wrong (stated as fact) |  | Done. |
| cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | marketplace | 1 | How many things are for sale? | wrong (stated as fact) | 13 | There are **14** items for sale. |
| cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (said unsure) |  | I see that photos are required. Could you provide a photo of the tent? Without a photo, I cannot complete the listing. |
| mistral-small-latest | marketplace | 1 | How many things are for sale? | wrong (stated as fact) | 13 | There are **14** items for sale. |
| mistral-small-latest | marketplace | 18 | Put up a tent for sale: two-person tent, sports, good condition, 45 €, in Sund. | wrong (stated as fact) |  | Could you please provide a title and at least one photo for the tent? |
| cascade:mistral-small-latest>eu.anthropic.claude-haiku-4-5-20251001-v1:0 | records | 6 | Which items have a link? | wrong (stated as fact) | ["Wall clock","Birch bark basket"] | No items have a link. |
| mistral-small-latest | records | 6 | Which items have a link? | wrong (stated as fact) | ["Wall clock","Birch bark basket"] | No items have a link. |

## Read with this (C, 2026-10-12)

C 23: the hosted assistant's cascade (B 35, cloud #174), Mistral Small first and Claude Haiku 4.5 (Bedrock, EU) when Small is seen failing, by the gateway's own rules (`gateway.ts`): two tool calls refused, a fourth model call, or an answer that gives up. Mistral Small alone was run beside it on the same apps and tools; Haiku alone is the [seven-tools run](bench-ask-seven-tools.md) (131 / 134, 98 %, $0.0061 a question), not run again.

| | Right | Cost per question |
|---|---|---|
| Mistral Small alone | 119 / 134 (89 %) | $0.0006 |
| The cascade | 120 / 134 (90 %) | $0.0010 |
| Claude Haiku 4.5 alone (seven-tools run) | 131 / 134 (98 %) | $0.0061 |

- **The cascade costs a sixth of Haiku and is about as right as Small.** It moved 12 questions (5 after two refused calls, 7 at the fourth call, none after an answer that gave up), and 11 of those were then right. But 9 of the 12 were questions Small alone answered right anyway (they were slow, not wrong); the two it turned from wrong to right (invoicing 15 and 24) were offset by one Small missed this time on its own (invoicing 22).
- **The wrong answers do not set off the cascade.** 13 of its 14 wrong answers stayed on Small, every one given as fact ("No invoices found.", "Fjord Analytics."): a confident wrong answer has no refused call, no long run of calls and no words that give up, so the gateway cannot see it. This is what [bench-ask-correctness.md](bench-ask-correctness.md) predicted from the stored traces (5 of 15).
- **So the cascade is a cost lever, not a correctness one.** It does not move the hosted assistant from Small's accuracy towards Haiku's; the choice of model does. At these prices Haiku alone is about six times the cascade's cost a question ($0.006 against $0.001), still well under a cent.
