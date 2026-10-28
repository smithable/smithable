# Haiku 5.5 wrapped (2026-10-27/28)

How much of Sonnet 5.5's quality does a cheap loop around Haiku 5.5 buy, and at what cost? Six setups, on two
benches: first builds (M12's second set, 24 descriptions, `scripts/bench-m12.mjs --set wide --no-cache`) and the
assistant's answers (`scripts/bench-ask.mjs`, 134 questions on the starters, run three times). The checks are
always ours (the validator, the type-check, the bench's judge), never the model's own confidence.

| Setup | First builds | Ask |
|---|---|---|
| (a) Haiku alone | one call, no repair rounds (`--harness alone`) | `wrap:alone:`, no answer check |
| (b) Haiku as today | the repair rounds (errors go back up to four times) | the app's answer check |
| (c) Haiku, critique | a second Haiku call mends the draft against the validator's warnings (`--harness critique`) | `wrap:critique:`, a second call mends the answer against the tool results |
| (d) Haiku, three votes | three drafts, the one whose operations overlap the other two most (`--harness vote3`) | `wrap:vote3:`, the majority of three answers |
| (e) Sonnet | as (b) with Sonnet | as (b) with Sonnet |
| (f) The pair | Haiku asks the questions, Sonnet drafts (`claude-haiku-5-5>claude-sonnet-5-5`) | `cascade:`, Haiku first, Sonnet when the checks send it on |

## First builds (one run each)

| Setup | Created | Type-check | Not created | Cost per build |
|---|---|---|---|---|
| (a) Haiku alone | 11 / 24 | 11 | 13 | $0.0031 |
| (b) Haiku as today | 23 / 24 | 22 (not #17) | #22 | $0.0042 |
| (c) Haiku, critique | 20 / 24 | 19 (not #15) | #3, #13, #17, #18 | $0.0038 |
| (d) Haiku, three votes | 21 / 24 | 21 | #9, #17, #18 | $0.0069 |
| (e) Sonnet | 24 / 24 | 24 | none | $0.042 |
| (f) The pair | 24 / 24 | 24 | none | $0.048 |

Reports: [alone](m12-first-builds-claude-haiku-5-5-alone-wide.md), [as today](m12-first-builds-claude-haiku-5-5-wide.md),
[critique](m12-first-builds-claude-haiku-5-5-critique-wide.md), [three votes](m12-first-builds-claude-haiku-5-5-vote3-wide.md),
[Sonnet](m12-first-builds-claude-sonnet-5-5-wide.md), [the pair](m12-first-builds-claude-haiku-5-5-claude-sonnet-5-5-wide.md).
No failure was a network error: each is a draft the validator refused to the end (a choice value with a space, a
field that does not exist, a long form misused, JSON cut short).

- **The repair rounds are what make Haiku work**: from 11 to 23 of 24 for a third more per build. Without them
  half the drafts fail on one rule each.
- **Critique and votes add nothing on top of them.** Both replace part of the repair loop's feedback with the
  model's own judgment and lose two or three builds, among them both Swedish descriptions (#17 salon booking, #18
  a builder's quotes and invoices); votes cost two thirds more than (b). One run of 24 each, so a gap of two or
  three builds may be chance; it is not a gain in any case.
- **Sonnet and the pair build everything**, at ten times (b)'s cost per build. The pair is not cheaper than Sonnet
  alone here: the questions are a small part of a build, and the draft, Sonnet's either way, is most of it.
- No setup leaves a public flaw in a created draft except one in (c); the rest of the scorecard (models, pages and
  actions kept, access) is in each report.

## Ask (three runs)

| Setup | Right, run 1 / 2 / 3 | Stated as fact (wrong), 1 / 2 / 3 | Cost per question |
|---|---|---|---|
| (a) Haiku alone | 96 / 94 / 95 % | 1 / 4 / 3 | $0.0002–0.0003 |
| (b) Haiku as today | 93 / 95 / 95 % | 5 / 2 / 2 | $0.0003 |
| (c) Haiku, critique | 96 / 96 / 96 % | 2 / 1 / 2 | $0.0006 |
| (d) Haiku, three votes | 95 / 96 / 95 % | 3 / 2 / 3 | $0.0005 |
| (e) Sonnet | 96 / 97 / 96 % | 1 / 1 / 1 | $0.0054–0.0058 |
| (f) The pair | 94 / 96 / 94 % | 5 / 3 / 4 | $0.0007–0.0011 |

Reports: [run 1](bench-ask-haiku-wrapped.md), [run 2](bench-ask-haiku-wrapped-2.md), [run 3](bench-ask-haiku-wrapped-3.md).

- **Every setup lies between 93 and 97 % (125 to 130 of 134)**, and the runs move a setup by up to three questions. On these
  questions Haiku is about as right as Sonnet for a twentieth of the cost.
- **Critique is the steadiest Haiku** (96 % in all three runs) at twice (b)'s cost; still a tenth of Sonnet.
- **Sonnet's lead, if any, is in what it states as fact**: one confidently wrong answer in every run, where the
  Haiku setups have one to five; counts this small overlap between runs.
- **The same four changes on the marketplace starter are wrong for every setup in every run** (the dinghy's price,
  the tent, the balance bike, the roof box's place). The questions were stale, not the models: the starter's real
  photographs had replaced three of those items, and a new item needs its photos, which the tools cannot add, so
  every model rightly said it could not find them or post the tent. About 3 % of each score, the same for every
  setup; the questions are on today's items since #873.
- **The status starter's "Is anything down right now?"** counts every component that is not operational, but
  "down" is one of the starter's values and no component has it, so "No" was a fair literal reading, and most of
  the Haiku setups' wrong answers to it are counted as stated as fact. The question asks "not working normally"
  since #877; the counts above stay as they were run.

## The answer

For first builds, the loop we already have (Haiku with the validator's errors fed back) buys almost all of Sonnet's
result (23 of 24 created and 22 type-checking, against 24 and 24) at a tenth of the cost; wrapping it further with
critique or votes did not help in this run. The two it misses are descriptions not in English (#22 German, not
created; #17 Swedish, created but not type-checking), where Sonnet or the pair still earns its cost. For the
assistant's answers no wrapper is needed: Haiku as today (b) answers within a few questions of Sonnet at a
twentieth of the cost, and none of the wrappers moves it beyond the runs' own spread.
