# bench-ask: right answers apart from valid tool calls (2026-10-11)

How often is an assistant's answer right, and how often is a wrong one given as if it were true? The
stored bench-ask runs judged again by the same rules ([bench-ask.mjs](../../scripts/bench-ask.mjs);
no model was asked again). bench-ask judges the answer's facts against the records (a count, a name
or id found, a record changed), never the tool calls, so a confident answer that is wrong already
counted as wrong. What is new is the split of the wrong ones, and the questions whose tool calls all
succeeded, set apart:

- **Stated as fact:** a wrong answer given as true ("Kallio Design has the most invoices, with 2",
  "There is no invoice 2026-006"), rather than one saying the model could not find or tell ("I can't
  find that order"). It is the answer a person would act on.
- **Right when every tool call was valid:** the questions where the model called tools and none was
  refused, and how many of those it answered right. Valid calls are not a right answer.

Future runs print both columns in their report.

| Run | Model | Right | Wrong | Of them, stated as fact | Right when every tool call was valid |
|---|---|---|---|---|---|
| [seven tools](bench-ask-seven-tools.md) | Claude Sonnet 4.6 | 134 / 134 | 0 | 0 | 128 / 128 |
| | Claude Haiku 4.5 | 131 / 134 | 3 | 3 | 127 / 130 |
| | Mistral Small | 119 / 134 | 15 | 15 | 99 / 109 |
| [baseline](bench-ask-baseline.md) | Claude Sonnet 4.6 | 130 / 130 | 0 | 0 | 60 / 60 |
| | Claude Haiku 4.5 | 124 / 130 | 6 | 6 | 40 / 46 |
| | Mistral Small | 105 / 130 | 25 | 22 | 46 / 66 |
| [voices](bench-ask-voices.md), invoicing | Mistral Small, plain | 22 / 25 | 3 | 3 | 18 / 20 |
| | Mistral Small, friendly | 23 / 25 | 2 | 2 | 20 / 21 |
| | Mistral Small, formal | 20 / 25 | 5 | 5 | 20 / 23 |

The baseline's last column counts only the questions with a stored tool trace (the rows taken over
from its first run's log have none).

## What it shows

1. **A wrong answer is almost always given as fact.** Of the 59 wrong answers here, 56 state
   something untrue as true; three (all Mistral Small, in the baseline) said it could not find the
   record. A model rarely says it is unsure, so a person cannot tell a wrong answer from a right one
   by its tone.
2. **Valid tool calls are not correctness.** With the seven tools, Mistral Small's calls all
   succeeded on 109 questions and it still answered 10 of them wrong (9 %); Haiku 3 of 130, Sonnet
   none. Taking valid calls for right answers would count those 10 of 134 as right.
3. **So a cascade is a cost lever, not a correctness one.** B 35 moves a question from Small to
   Haiku after two refused tool calls, a fourth call without an answer, or an answer that gives up.
   Read against these runs (an estimate: a fourth call is taken as four model calls or more, and
   "gives up" as the unsure answers above, of which the seven-tools run has none), it would have
   moved up 5 of Small's 15 wrong answers in the seven-tools run, and 16 of its 119 right ones. Ten
   wrong answers would still have reached the person, stated as fact. Which model answers is decided
   by measuring it here, not by the cascade's signals; the cascade run itself (C 23) will say how it
   does in practice.

Mistral Small only for anything new; nothing here was run on Bedrock.
