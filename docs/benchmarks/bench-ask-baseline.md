# bench-ask: baseline (2026-10-04)

The questions of [bench-ask-questions.mjs](../../scripts/bench-ask-questions.mjs), asked of each starter's assistant tools at `/mcp` with an administrator's key ([bench-ask.mjs](../../scripts/bench-ask.mjs)), by each model: it calls tools until it answers (at most 8 model calls). A read is right when its answer gives the number, names, words or pairs worked out from the records; a change is right when the records afterwards say so. Each change starts from the starter's records.

| Model | Right | Wrong | Of them, a count or sum the model worked out | Gave up or failed | Model calls per question | Reads in one or two calls | Tokens in / out per question | Tool results per question (tokens) | Cost per question | Time |
|---|---|---|---|---|---|---|---|---|---|---|
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | 124 / 130 (95 %) | 6 | 3 | 0 | 2.4 | 80 / 99 | 6,149 / 162 | 671 | $0.0077 | 6.9 s |
| mistral-small-latest | 105 / 130 (81 %) | 25 | 9 | 0 | 2.4 | 71 / 99 | 5,263 / 40 | 597 | $0.0008 | 2.4 s |
| eu.anthropic.claude-sonnet-4-6 | 130 / 130 (100 %) | 0 | 0 | 0 | 2.2 | 94 / 99 | 5,769 / 161 | 657 | $0.0217 | 6.0 s |

**Read with this (C, 2026-10-04).** The baseline is today's tools: a find, read, add and change tool per model (and the standard actions), where find takes no filter, so every count, sum or filter is the model reading pages of records and working it out.

- **Sonnet 4.6 is right on all 130.** "How much is still to be paid to us?" is accepted in both readings (sent and overdue: 2,770.50; with the draft: 3,220.50) when the answer says the draft is counted, which Sonnet's and Haiku's do. 94 of 99 reads in one or two model calls; $0.022 a question, 6 s.
- **Haiku 4.5: 124 of 130** (95 %), a third of Sonnet's cost ($0.008). Three misses are a count or sum it worked out itself (an average of 14 prices and of 8 orders, the sum of 16 capacities); the others look in the wrong model (Kallio Design's VAT number among the business profiles), changes an incident in a way the check refuses, and read "billing address" as the postal address.
- **Mistral Small: 105 of 130** (81 %), $0.0008 a question: 9 misses are counts or sums it worked out; it also misses lookups across records (who teaches what, an invoice's client), says "not found" for records that exist, and answers from its own knowledge ("what should I bring to Yin").
- **The tools' size**: 346 to 1,752 tokens per starter, sent with every model call; tool results add about 650 tokens per question (whole pages of records). A question takes about two model calls and 5,300 to 6,200 input tokens.
- What the seven tools should change: counts and sums worked out by the app (the "count or sum the model worked out" column should go to nothing), finds with a filter (smaller results), fewer input tokens.
- Not measured: the four delete questions (no delete tool; `setApi --assistants-delete` comes with #276), and "Which teachers have a portrait?" (pictures are not in the API). One question was reworded after this run: "Fjord Analytics' billing address is now billing@…" (read as the postal address by Haiku) is now "Send Fjord Analytics' invoices to billing@… from now on."
- Rows marked "from the first run's log" were answered before the runner crashed (the app's dev server closed a connection); their outcome, calls, tokens and cost are from its log, their answers were not kept, and answers before the fix kept only 240 characters, so those keep the judgement made on the whole answer. One check was corrected later (2026-10-05): "Post an update … status resolved" wanted exactly one new update, but resolving adds one of its own; Haiku's answer, judged again from its tool trace, is right.

The tools each starter offers (`tools/list`, about four characters a token):

| Starter | Tools | Their size (tokens) | The app's summary (tokens) |
|---|---|---|---|
| crm | 8 | 817 | 0 |
| invoicing | 18 | 1,443 | 0 |
| status | 19 | 1,608 | 0 |
| booking | 24 | 1,752 | 0 |
| marketplace | 4 | 429 | 0 |
| records | 4 | 346 | 0 |

## Per starter

| Starter | eu.anthropic.claude-haiku-4-5-20251001-v1:0 | mistral-small-latest | eu.anthropic.claude-sonnet-4-6 |
|---|---|---|---|
| crm | 23 / 24 | 21 / 24 | 24 / 24 |
| invoicing | 23 / 25 | 17 / 25 | 25 / 25 |
| status | 24 / 25 | 23 / 25 | 25 / 25 |
| booking | 22 / 23 | 16 / 23 | 23 / 23 |
| marketplace | 18 / 19 | 15 / 19 | 19 / 19 |
| records | 14 / 14 | 13 / 14 | 14 / 14 |

## Not right

| Model | Starter | # | Question | Outcome | Expected | Answer |
|---|---|---|---|---|---|---|
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | crm | 25 | Delete the draft order ORD-1006. | skipped (no delete tool) |  |  |
| mistral-small-latest | crm | 25 | Delete the draft order ORD-1006. | skipped (no delete tool) |  |  |
| eu.anthropic.claude-sonnet-4-6 | crm | 25 | Delete the draft order ORD-1006. | skipped (no delete tool) |  |  |
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | booking | 24 | Delete the post "Summer sessions by the sea". | skipped (no delete tool) |  |  |
| mistral-small-latest | booking | 5 | How many sessions does Oskar Berg teach? | wrong | 6 | Oskar Berg teaches **4** sessions. |
| mistral-small-latest | booking | 6 | How many places are there in all the sessions together? | wrong | 196 | There are **206 places** in all the sessions together. |
| mistral-small-latest | booking | 7 | Who teaches the most sessions? | wrong | ["Oskar Berg","Emma Lindqvist"] | Emma Lindqvist teaches the most sessions (4). |
| mistral-small-latest | booking | 9 | What is our newest post? | wrong | ["Morning classes are back"] | Our newest post is titled **"Summer sessions by the sea"**, published on **2026-08-31**. |
| mistral-small-latest | booking | 11 | Which classes does Aino Virtanen teach? | wrong | ["Hatha","Foundations"] | Aino Virtanen teaches **Yin** and **Hatha** classes. |
| mistral-small-latest | booking | 13 | What should I bring to Yin? | wrong | ["socks"] | For Yin yoga, bring comfortable clothing you can move in, a water bottle, and maybe a blanket or bolster for extra support during long holds. A warm layer for savasana is also helpful. |
| mistral-small-latest | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) | [] | Emma Lindqvist, Oskar Berg, Aino Virtanen. |
| mistral-small-latest | booking | 20 | Power flow is called Power vinyasa from now on. | wrong |  | Done. |
| mistral-small-latest | booking | 24 | Delete the post "Summer sessions by the sea". | skipped (no delete tool) |  |  |
| eu.anthropic.claude-sonnet-4-6 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) | [] | None of the instructors — Aino Virtanen, Oskar Berg, or Emma Lindqvist — have a portrait on file. The instructor records only include their name and bio, with no portrait/photo attached to any of them. |
| eu.anthropic.claude-sonnet-4-6 | booking | 24 | Delete the post "Summer sessions by the sea". | skipped (no delete tool) |  |  |
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | marketplace | 13 | What's the average price of everything listed, sold or not? | wrong | 208.21 | The average price of all 14 items listed is **262.50**. Here's the breakdown: - Total: 15 + 110 + 1200 + 70 + 140 + 85 + 290 + 350 + 30 + 180 + 25 + 120 + 60 + 240 = 3,675.00 - Average: 3,675.00 ÷ 14 = 262.50 |
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | marketplace | 19 | Take the balance bike off the site. | skipped (no delete tool) |  |  |
| mistral-small-latest | marketplace | 1 | How many things are for sale? | wrong | 13 | There are 14 things for sale. |
| mistral-small-latest | marketplace | 12 | How many items are in Mariehamn? | wrong | 6 | There are **4 items** in Mariehamn. |
| mistral-small-latest | marketplace | 13 | What's the average price of everything listed, sold or not? | wrong | 208.21 | The average price of all listed items is **211.07**. |
| mistral-small-latest | marketplace | 16 | The turntable is sold. | wrong |  | Could not find the turntable. |
| mistral-small-latest | marketplace | 19 | Take the balance bike off the site. | skipped (no delete tool) |  |  |
| eu.anthropic.claude-sonnet-4-6 | marketplace | 19 | Take the balance bike off the site. | skipped (no delete tool) |  |  |
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | records | 14 | Remove the enamel coffee pot. | skipped (no delete tool) |  |  |
| mistral-small-latest | records | 3 | What did we add last? | wrong | ["Stoneware teapot"] | The last item added was the **Wool blanket** on 2026-07-12. |
| mistral-small-latest | records | 14 | Remove the enamel coffee pot. | skipped (no delete tool) |  |  |
| eu.anthropic.claude-sonnet-4-6 | records | 14 | Remove the enamel coffee pot. | skipped (no delete tool) |  |  |
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | crm | 13 | What is the average order total? | wrong | 4089.25 | Based on the 8 orders in the system, the average order total is **$3,313.69**. Here's the breakdown: - Total of all orders: $32,714.00 - Number of orders: 8 - Average: $32,714.00 ÷ 8 = $3,313.75 |
| mistral-small-latest | crm | 13 | What is the average order total? | wrong | 4089.25 | **Average order total: $4,188.13** |
| mistral-small-latest | crm | 17 | What does shipping cost on order ORD-1007? | wrong | 15 | I can't find that order. |
| mistral-small-latest | crm | 21 | Kallio Design is an enterprise customer now, please change that. | wrong |  | Kallio Design is already an enterprise customer. |
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | invoicing | 23 | Send Fjord Analytics' invoices to billing@fjordanalytics.example from now on. | wrong |  | Done! Fjord Analytics' billing address has been updated to billing@fjordanalytics.example. |
| mistral-small-latest | invoicing | 4 | How much does Solstice Bakery owe us? | wrong | 690 | Solstice Bakery does not owe you anything. |
| mistral-small-latest | invoicing | 8 | Which client has the most invoices? | wrong | ["Kallio Design","Skerry Software"] | Kallio Design (2 invoices). |
| mistral-small-latest | invoicing | 9 | What's Kallio Design's VAT number? | wrong | ["FI87654321"] | Kallio Design's VAT number is not listed in the business profiles. |
| mistral-small-latest | invoicing | 14 | How many hours have we billed at 85 an hour? | wrong | 30 | 18 hours. |
| mistral-small-latest | invoicing | 17 | Which invoices did Skerry Software get? | wrong | ["2026-004","2026-001"] | Skerry Software did not get any invoices. |
| mistral-small-latest | invoicing | 19 | How much is still to be paid to us? | wrong | 2770.5 | **€2,220.50** is still to be paid to you. |
| mistral-small-latest | invoicing | 21 | Invoice 2026-004 has been paid. | wrong |  | I cannot find invoice 2026-004. |
| mistral-small-latest | invoicing | 24 | Add a line to invoice 2026-006: proofreading, two hours at 60. | wrong |  | You are not allowed to edit this invoice. |
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong |  | Done. I've created incident #3 for the mobile app login failure with status "investigating". The incident was detected today at 2026-10-04. |
| mistral-small-latest | status | 18 | Is any incident open on the mobile app? | wrong | [] | Yes, the **Card payments slow at checkout** incident is open on the **Payments** component (status: degraded). |
| mistral-small-latest | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong |  | Incident **#3** logged: *Mobile app login failure* (investigating). |
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | booking | 17 | Which teachers have a portrait? | skipped (pictures are not in the API) |  |  |
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | invoicing | 9 | What's Kallio Design's VAT number? | wrong | ["FI87654321"] | I don't see "Kallio Design" in the business profiles. The system shows 8 business profiles, but none of them are named Kallio Design. Could you check if the name is spelled differently, or would you like me to search the clients list instea |
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | booking | 6 | How many places are there in all the sessions together? | wrong | 196 | There are **16 sessions** in total, with a combined capacity of **188 places**. Here's the breakdown: - 4 sessions with 12 places each = 48 - 2 sessions with 16 places each = 32 - 2 sessions with 14 places each = 28 - 2 sessions with 10 pla |
