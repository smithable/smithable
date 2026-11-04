# bench-ask: normal-level (2026-11-04)

The questions of [bench-ask-questions.mjs](../../scripts/bench-ask-questions.mjs), asked of each starter's assistant tools at `/mcp` with an administrator's key ([bench-ask.mjs](../../scripts/bench-ask.mjs)), by each model: it calls tools until it answers (at most 8 model calls). A read is right when its answer gives the number, names, words or pairs worked out from the records; a change is right when the records afterwards say so. Each change starts from the starter's records.

Correctness is judged on the answer's facts against the records (a count, a name or id found, a record changed), never on the tool calls: a confident answer that is wrong counts as wrong. "Stated as fact" is a wrong answer given as true, such as a total, a name or "there is no such invoice", rather than one saying the model could not tell; it is the kind a person would act on. "Right when every tool call was valid" counts the questions whose tool calls all succeeded, and how many of them were answered right: valid calls are not a right answer.

| Model | Right | Wrong | Of them, stated as fact | Of them, a count or sum the model worked out | Right when every tool call was valid | Gave up or failed | Model calls per question | Reads in one or two calls | Tokens in / out per question | Tool results per question (tokens) | Cost per question | Time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | 69 / 70 (99 %) | 1 | 0 | 0 | 65 / 66 | 0 | 2.5 | 40 / 52 | 5,739 / 177 | 77 | $0.0073 | 3.7 s |
| mistral-medium-latest | 64 / 70 (91 %) | 4 | 4 | 0 | 55 / 59 | 2 | 2.7 | 39 / 52 | 4,591 / 62 | 70 | $0.0074 | 2.3 s |

**eu.anthropic.claude-haiku-4-5-20251001-v1:0**, the app's answer check (ask-checks.md §3): 3 of 70 answers went back to the model; 2 of them came back grounded (1 right). 1 were shown as not confirmed: 0 wrong and 1 right. A wrong answer shown as not confirmed is not counted as stated as fact.

**mistral-medium-latest**, the app's answer check (ask-checks.md §3): 1 of 70 answers went back to the model; 1 of them came back grounded (0 right). 0 were shown as not confirmed: 0 wrong and 0 right. A wrong answer shown as not confirmed is not counted as stated as fact.

The tools each starter offers (`tools/list`, about four characters a token):

| Starter | Tools | Their size (tokens) | The app's summary (tokens) |
|---|---|---|---|
| crm | 8 | 1,290 | 183 |
| status | 8 | 1,127 | 255 |
| marketplace | 7 | 955 | 109 |

## Per starter

| Starter | eu.anthropic.claude-haiku-4-5-20251001-v1:0 | mistral-medium-latest |
|---|---|---|
| crm | 25 / 25 | 23 / 25 |
| status | 24 / 25 | 21 / 25 |
| marketplace | 20 / 20 | 20 / 20 |

## Not right

| Model | Starter | # | Question | Outcome | Expected | Answer |
|---|---|---|---|---|---|---|
| mistral-medium-latest | crm | 14 | Which customers have never ordered anything? | gave up | ["Umeå Regional Services"] |  |
| mistral-medium-latest | crm | 15 | How many orders were placed in September 2026? | wrong (stated as fact) | 9 | 4 |
| eu.anthropic.claude-haiku-4-5-20251001-v1:0 | status | 18 | Is any incident open on the mobile app? | wrong (said unsure) | [] | You're right. The nearest titles to "mobile app" are: - Mobile app could not load order history - Website unreachable for twenty minutes - Order confirmation emails delayed |
| mistral-medium-latest | status | 5 | How long was the website down, in minutes? | gave up | 21 |  |
| mistral-medium-latest | status | 7 | What was our last update on the card payments problem? | wrong (stated as fact) | ["Payments confirm in seconds again"] | We are looking into slow card payments at checkout. |
| mistral-medium-latest | status | 8 | What maintenance is planned? | wrong (stated as fact) | ["Sign-in system update","Move of the app's notification service","Database upgrade"] | None. |
| mistral-medium-latest | status | 22 | Report a new incident: logging in to the mobile app fails, we're investigating. | wrong (stated as fact) |  | Incident 6 |
