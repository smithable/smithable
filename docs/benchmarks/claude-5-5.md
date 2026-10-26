# Claude Haiku 5.5 and Sonnet 5.5 beside Mistral (2026-10-26)

Claude through Anthropic's own API (`SMITHABLE_FRONTIER=anthropic`, `docs/ai.md`), run through the same benches as the Mistral models: a change typed into Builder, a first build from a description, and a first draft made as files or as operations. "Haiku>Sonnet" names both models, cheapest first, as the hosted service sends them. Each table's report has every answer.

## Changes typed into Builder

[builder-changes.md](builder-changes.md): twelve requests on fresh starters, through `smithable ask --yes`. Two runs on the same day, both counted right out of twelve:

| Setup | First run | Second run | Cost per request |
|---|---|---|---|
| Haiku 5.5 | 6 | 10 | $0.002 |
| Sonnet 5.5 | 11 | 9 | $0.04 |
| Haiku>Sonnet | 10 | 8 | $0.01 |
| Mistral Small | 10 | 7 (two of them rate limits) | $0.004 |
| Mistral Medium | 8 | 8 | $0.04 |

- Haiku's first run lost answers to a Markdown fence around its JSON. The provider now strips it, and the second run is the one to read.
- Between the runs Sonnet and Mistral Small move by two or three, most of it in how often a model asks a question back instead of making the change. One run of twelve does not rank these models; it separates them from Mistral Medium, which makes wrong changes where the others ask.
- With Haiku>Sonnet, a question back from Haiku is its answer: only a failed check goes to Sonnet. So the pair asks more than Sonnet alone, and in the second run more than Haiku alone.
- "Make each order belong to the salesperson who made it" was wrong for every setup in both runs: each adds the field and the ownership but leaves who may change the order as it was.

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

- Haiku 5.5 is a good first model: as reliable as Mistral Medium on first builds and drafts, right as often as Sonnet on Builder's changes once its fences are stripped, and as often as Mistral Small in Ask with fewer wrong answers stated as fact, at a tenth to a twentieth of Sonnet's cost.
- Sonnet 5.5 earns its cost where Haiku fails a check, which the pair already does: in Ask the pair comes close to Sonnet for little more than Haiku's cost. Behind Haiku, Sonnet never ran in the changes bench's second run.
- A question back is not escalated. Whether a cheap model's question should go to the stronger model before it reaches the person is a choice for the router, not settled here.
