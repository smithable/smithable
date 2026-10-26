# Claude Haiku 5.5 and Sonnet 5.5 beside Mistral (2026-10-26)

Claude through Anthropic's own API (`SMITHABLE_FRONTIER=anthropic`, `docs/ai.md`), run through the same benches as the Mistral models: a change typed into Builder, a first build from a description, and a first draft made as files or as operations. "Haiku>Sonnet" names both models, cheapest first, as the hosted service sends them. Each table's report has every answer.

## Changes typed into Builder

[builder-changes.md](builder-changes.md): twelve requests on fresh starters, through `smithable ask --yes`. One run of twelve moved Sonnet and Mistral Small by two or three, so the requests ran five times more on each setup, with Opus 5.5 beside them ([builder-changes-runs.md](builder-changes-runs.md) has every request). Right out of twelve:

| Setup | Mean | Range over five runs | Cost per request |
|---|---|---|---|
| Haiku 5.5 | 9.8 | 9–11 | $0.0025 |
| Opus 5.5 | 9.8 | 9–10 | $0.086 |
| Sonnet 5.5 | 9.2 | 9–10 | $0.043 |
| Haiku>Sonnet | 9.0 | 7–10 | $0.011 |
| Mistral Small | 7.0 | 6–9 (two rate limits) | $0.0036 |

- The Claude models are level: Haiku is right as often as Opus at a thirtieth of its cost, and Sonnet a little less, by asking back more ("show the VAT number in the list": three of five times it asked where). Mistral Small is two to three behind, mostly with wrong changes rather than questions.
- Every setup asks back on "split the name into first and last" (except Mistral Small, which makes the change), and every setup is wrong on "make each order belong to the salesperson who made it": each adds the field and the ownership but leaves who may change the order as it was. The first is arguably a fair question; the second is the operation layer's to make easier, not a model's.
- Haiku>Sonnet escalates only when Haiku says the spec cannot express a request (11 of 60, all then right, as Sonnet's own answers are). A question back from Haiku is final: 10 of 60 ended so. For the same request in the same run Sonnet alone made the right change 5 times (three of them "put orders first and call them Sales") and asked back too 5 times (all "first and last name"). So the pair is worse than Haiku alone, because Haiku asked on requests it answers itself in other runs.
- What the router could do: send a cheap model's question to the stronger model before the person sees it. On these runs that turns 5 of the pair's 10 questions into right changes (the pair to about 10 of 12) at Sonnet's price for those requests only, and the 5 others stay questions Sonnet asks as well. Undecided; a question that a stronger model answers by guessing is not always better than the question.

## First builds (M12)

The twelve M12 descriptions through `smithable new --describe` ([Haiku](m12-first-builds-claude-haiku-5-5.md), [Sonnet](m12-first-builds-claude-sonnet-5-5.md), [the pair](m12-first-builds-claude-haiku-5-5-claude-sonnet-5-5.md)): every setup created all twelve apps and every one type-checks, as Mistral Medium does. A first build tries the strongest model first, so the pair is Sonnet with Haiku behind it, and its run matches Sonnet's.

| Setup | Created and type-checks | Cost per build |
|---|---|---|
| Haiku 5.5 | 12 / 12 | $0.004 |
| Sonnet 5.5 | 12 / 12 | $0.04 |
| Mistral Medium | 12 / 12 | $0.03 |

Haiku sent more calls than Sonnet (about 490k tokens in against 360k) and is still a tenth of Sonnet's cost.

## First drafts, files against operations

Eleven descriptions, each drafted as whole files from the closest starter and as a batch of operations from an empty app ([Haiku](draft-modes-claude-haiku-5-5.md), [Sonnet](draft-modes-claude-sonnet-5-5.md)):

| Model | Files valid | Operations valid |
|---|---|---|
| Haiku 5.5 | 11 / 11 | 11 / 11 |
| Sonnet 5.5 | 11 / 11 | 10 / 11 |
| Mistral Medium | 11 / 11 | 11 / 11 |
| Mistral Small | 5 / 11 | 10 / 11 |

Both Claude models draft whole files reliably, where Mistral Small fails half; operations are valid for every model. Sonnet's drafts have more fields per model than Haiku's.

## Ask

[bench-ask-claude.md](bench-ask-claude.md): the 134 questions of bench-ask put to each starter's assistant tools, judged on the answer's facts against the records. Mistral Small is from its latest run ([bench-ask-small-after-zeros.md](bench-ask-small-after-zeros.md), 2026-10-14).

| Setup | Right | Wrong | Of them, stated as fact | Cost per question |
|---|---|---|---|---|
| Haiku 5.5 | 125 / 134 (93 %) | 9 | 3 | $0.0007 |
| Sonnet 5.5 | 129 / 134 (96 %) | 5 | 0 | $0.015 |
| Haiku>Sonnet | 127 / 134 (95 %) | 7 | 3 | $0.002 |
| Mistral Small | 124 / 134 (93 %) | 8 | 8 | $0.0006 |

This run priced cached input at the full input price, so the Claude costs here are upper bounds (the bench now prices a cache read at a tenth, as the CLI's provider does).

- Haiku is right as often as Mistral Small at about the same cost, and states fewer wrong answers as fact: the app's answer check shows most of its wrong answers as not confirmed.
- Sonnet states no wrong answer as fact, at twenty times Haiku's cost per question.
- The pair moved 11 questions to Sonnet (7 at the fourth tool call, 3 after the check sent an answer back twice, 1 after two refused calls); 7 of them were then right. It is within two questions of Sonnet at about a seventh of its cost.

## What it says

- Haiku 5.5 is a good first model: as reliable as Mistral Medium on first builds and drafts, right as often as Opus on Builder's changes over five runs, and as often as Mistral Small in Ask with fewer wrong answers stated as fact, at a tenth to a twentieth of Sonnet's cost.
- Sonnet 5.5 earns its cost where Haiku fails a check, which the pair already does: in Ask the pair comes close to Sonnet for little more than Haiku's cost. In Builder's changes it is reached only when Haiku says the spec cannot do it.
- A question back is not escalated. Sending it to the stronger model first would have turned half of the pair's questions into right changes in Builder's runs; whether to is a choice for the router, not settled here.
