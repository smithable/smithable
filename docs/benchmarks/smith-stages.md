# Smith's stages before a model

2026-11-14, 326 requests of docs/benchmarks/smith-requests.json, with no model ([smith-stages.mjs](../../scripts/smith-stages.mjs)). Free; run it on any change to the rules, the search or the prompts.

## Retrieval

Docs questions whose labelled part is among the parts found, without the search phrases a model adds: top 3 25 / 34 (74 %), top 5 30 / 34 (88 %).

| Language | Top 3 | Top 5 |
|---|---|---|
| en | 19 / 22 (86 %) | 22 / 22 (100 %) |
| fi | 0 / 2 (0 %) | 0 / 2 (0 %) |
| sv | 6 / 10 (60 %) | 8 / 10 (80 %) |

Not in the top 5: d-apps, d-fi-finnish, d-fi-cost, d-sv-selfhost.

## What would be sent

The first model call's prompt per kind of request, about four characters a token: the cost before any answer. A request a rule answers sends nothing.

| Kind | Requests | Answered by a rule | Median tokens sent | Most |
|---|---|---|---|---|
| ambiguous | 25 | 0 | 2,422 | 43,538 |
| change | 141 | 14 | 33,419 | 44,416 |
| custom-code | 13 | 0 | 33,524 | 43,696 |
| data | 23 | 0 | 33,590 | 44,207 |
| docs-question | 34 | 0 | 2,198 | 37,744 |
| off-topic | 10 | 0 | 2,029 | 33,021 |
| smalltalk | 17 | 13 | 2,428 | 2,493 |
| spec-question | 46 | 2 | 2,479 | 3,935 |
| two-things | 17 | 0 | 43,675 | 44,127 |

## The oracle

A perfect model in place of the real one: right when the prompt holds everything the labelled answer needs, "cannot tell" when it lacks a need, a wrong route when a rule answered as the wrong kind. Every miss is the handling's, not a model's. Beside it, the prompt's size and what it carries that no need names (parts of the app's summary or spec, docs parts). Docs are searched without a model's search phrases, as above. One line per miss in [smith-oracle-misses.txt](smith-oracle-misses.txt).

| Kind | Requests | Right | Cannot tell | Wrong route | Median tokens sent | Median parts not needed | Median docs parts not needed |
|---|---|---|---|---|---|---|---|
| ambiguous | 25 | 25 | 0 | 0 | 2,422 | 9 | 0 |
| change | 141 | 141 | 0 | 0 | 33,419 | 10 | 0 |
| custom-code | 13 | 13 | 0 | 0 | 33,524 | 11 | 0 |
| data | 23 | 23 | 0 | 0 | 33,590 | 8 | 0 |
| docs-question | 34 | 29 | 5 | 0 | 2,198 | 9 | 4 |
| off-topic | 10 | 10 | 0 | 0 | 2,029 | 11 | 3 |
| smalltalk | 17 | 17 | 0 | 0 | 2,428 | 9 | 2 |
| spec-question | 46 | 46 | 0 | 0 | 2,479 | 8 | 5 |
| two-things | 17 | 17 | 0 | 0 | 43,675 | 7 | 0 |
