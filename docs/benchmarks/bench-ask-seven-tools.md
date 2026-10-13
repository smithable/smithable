# bench-ask: seven-tools (2026-10-04)

The questions of [bench-ask-questions.mjs](../../scripts/bench-ask-questions.mjs), asked of each starter's assistant tools at `/mcp` with an administrator's key ([bench-ask.mjs](../../scripts/bench-ask.mjs)), by each model: it calls tools until it answers (at most 8 model calls). A read is right when its answer gives the number, names, words or pairs worked out from the records; a change is right when the records afterwards say so. Each change starts from the starter's records.

| Model | Right | Wrong | Of them, a count or sum the model worked out | Gave up or failed | Model calls per question | Reads in one or two calls | Tokens in / out per question | Tool results per question (tokens) | Cost per question | Time |
|---|---|---|---|---|---|---|---|---|---|---|
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | 131 / 134 (98 %) | 3 | 0 | 0 | 2.4 | 77 / 99 | 4,667 / 173 | 53 | $0.0061 | 5.9 s |
| mistral-small-latest | 119 / 134 (89 %) | 15 | 0 | 0 | 2.6 | 77 / 99 | 3,536 / 71 | 48 | $0.0006 | 2.9 s |
| eu.anthropic.claude-sonnet-4-6 | 134 / 134 (100 %) | 0 | 0 | 0 | 2.4 | 82 / 99 | 4,503 / 182 | 52 | $0.0179 | 6.3 s |

**Against the baseline (C, 2026-10-05).** The same questions on #280's seven tools (find, measure, read, add, change, run, describe, plus delete where the app allows it) and the app's summary as the server's instructions, after A's fixes from the first run on these tools (a text condition matches a part of the value regardless of case; search needs every word; an empty search says where it looked; measure adds up computed fields; read, change, run and delete take a title or number). The [baseline](bench-ask-baseline.md) is today's tool per model and verb.

| Model | Right, baseline | Right, seven tools | Tokens in per question | Tool results per question | Cost per question |
|---|---|---|---|---|---|
| Sonnet 4.6 | 130 / 130 | 134 / 134 (100 %) | 5,769 → 4,503 (−22 %) | 657 → 52 | $0.0217 → $0.0179 |
| Haiku 4.5 | 124 / 130 (95 %) | 131 / 134 (98 %) | 6,149 → 4,667 (−24 %) | 671 → 53 | $0.0077 → $0.0061 |
| Mistral Small | 105 / 130 (81 %) | 119 / 134 (89 %) | 5,263 → 3,536 (−33 %) | 597 → 48 | $0.0008 → $0.0006 |

The seven tools add the four delete questions (134, not 130). No answer is wrong any more because the model counted or added up rows itself (baseline: Haiku 3, Mistral Small 9). The tools are 845 to 1,018 tokens per starter (booking was 1,752 as a tool per model and verb), plus a summary of 57 to 227 tokens. Model calls per question rose a little (Sonnet 2.2 → 2.4): a lookup now often takes a find and then a measure or read, where before one find returned everything.

Sonnet's two misses in that run were tool gaps, and #280 closed them (690a510): a min or max of measure names the record that holds it, and a split by a reference gives each group's title, largest first. Those two questions were then asked again of the three models (2026-10-05): the biggest invoice line is right for all three, by its name; "Which client have we invoiced the most?" is right for Sonnet and Haiku, who answered by number of invoices (a tie of Skerry Software and Kallio Design, 2 each), which names the right client but is not the amount reading (Skerry Software 2,670 against Kallio Design 1,850): the question is open to both readings, and the check asks only that Skerry Software is named, which both answers do. Mistral Small named Fjord Analytics. The first run on these tools, before A's fixes, had Sonnet 131, Haiku 125 and Mistral Small 108 (all of 134); its misses were the five fixed above.

One check was corrected after both runs: "Post an update on the card payments incident … status resolved" wanted exactly one new update, but the status starter's resolve adds one of its own, so a model that posted the update and then resolved was marked wrong. It now wants at least this update; the rows were judged again from their tool traces (Sonnet's in both seven-tools runs, Haiku's in the baseline, became right).


The tools each starter offers (`tools/list`, about four characters a token):

| Starter | Tools | Their size (tokens) | The app's summary (tokens) |
|---|---|---|---|
| crm | 7 | 866 | 118 |
| invoicing | 8 | 1,009 | 190 |
| status | 8 | 1,018 | 227 |
| booking | 7 | 942 | 179 |
| marketplace | 7 | 845 | 82 |
| records | 7 | 845 | 57 |

## Per starter

| Starter | eu.anthropic.claude-haiku-4-5-20251001-v1:0 | mistral-small-latest | eu.anthropic.claude-sonnet-4-6 |
|---|---|---|---|
| invoicing | 25 / 25 | 19 / 25 | 25 / 25 |

## Not right

| Model | Starter | # | Question | Outcome | Expected | Answer |
|---|---|---|---|---|---|---|
| mistral-small-latest | crm | 14 | Which customers have never ordered anything? | wrong | [] | All 8 customers have placed at least one order. |
| mistral-small-latest | invoicing | 8 | Which client has the most invoices? | wrong | ["Kallio Design","Skerry Software"] | The client with the most invoices is **Kallio Design**. |
| mistral-small-latest | invoicing | 10 | Which of our clients are in Finland? | wrong | ["Kallio Design","Skerry Software"] | No clients found in Finland. |
| mistral-small-latest | invoicing | 19 | How much is still to be paid to us? | wrong | 2770.5 | Nothing is outstanding. |
| mistral-small-latest | invoicing | 22 | Mark invoice 2026-006 as sent. | wrong |  | No such invoice. |
| mistral-small-latest | invoicing | 24 | Add a line to invoice 2026-006: proofreading, two hours at 60. | wrong |  | No invoice with number 2026-006 found. |
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | status | 1 | Is anything down right now? | wrong | ["Payments"] | No, nothing is down right now. All components are operational, degraded, or in maintenance. |
| mistral-small-latest | status | 5 | How long was the website down, in minutes? | wrong | 21 | No record of the website being down. |
| mistral-small-latest | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong |  | Incident **Mobile app login failure** (ID: 3) reported. Status: investigating. |
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| mistral-small-latest | booking | 7 | Who teaches the most sessions? | wrong | ["Oskar Berg","Emma Lindqvist"] | Alexandra Reed and Jamie Lawson each teach 6 sessions. |
| mistral-small-latest | booking | 15 | How many sessions are there of each class? | wrong | {"Power flow":2,"Yin":4,"Vinyasa":4,"Hatha":4,"Foundations":2} | There are 2 sessions of the first class, 4 of the second, 4 of the third, 2 of the fourth, and 2 of the fifth. |
| mistral-small-latest | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| mistral-small-latest | booking | 20 | Power flow is called Power vinyasa from now on. | wrong |  | Done. |
| eu.anthropic.claude-sonnet-4-6 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | marketplace | 1 | How many things are for sale? | wrong | 13 | There are 14 things for sale. |
| mistral-small-latest | marketplace | 6 | What is the most expensive item? | wrong | ["Sailing dinghy with trailer"] | The most expensive item is 1200. |
| mistral-small-latest | marketplace | 13 | What's the average price of everything listed, sold or not? | wrong | 208.21 | The average price of all listed items is **257.50**. |
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | records | 3 | What did we add last? | wrong | ["Stoneware teapot"] | The last item added was a **Wool blanket**. |
| mistral-small-latest | records | 6 | Which items have a link? | wrong | ["Wall clock","Birch bark basket"] | No items have a link. |
| mistral-small-latest | invoicing | 20 | Which client have we invoiced the most? | wrong | ["Skerry Software"] | Fjord Analytics. |
