# Smith's stages before a model

2026-11-14, 326 requests of docs/benchmarks/smith-requests.json, with no model ([smith-stages.mjs](../../scripts/smith-stages.mjs)). Free; run it on any change to the rules, the search or the prompts.

## Retrieval

Docs questions whose labelled part is among the parts found, without the search phrases a model adds: top 3 17 / 34 (50 %), top 5 19 / 34 (56 %).

| Language | Top 3 | Top 5 |
|---|---|---|
| en | 16 / 22 (73 %) | 18 / 22 (82 %) |
| fi | 0 / 2 (0 %) | 0 / 2 (0 %) |
| sv | 1 / 10 (10 %) | 1 / 10 (10 %) |

Not in the top 5: d-publish, d-cost, d-selfhost, d-apps, d-fi-finnish, d-sv-publish, d-sv-data, d-fi-cost, long-mp-docs, d-sv-export, d-sv-selfhost, d-sv-import, d-sv-need-ai, d-sv-sandbox, d-sv-mail-limit.

## What would be sent

The first model call's prompt per kind of request, about four characters a token: the cost before any answer. A request a rule answers sends nothing.

| Kind | Requests | Answered by a rule | Median tokens sent | Most |
|---|---|---|---|---|
| ambiguous | 25 | 0 | 26,700 | 44,351 |
| change | 141 | 14 | 34,462 | 46,156 |
| custom-code | 13 | 0 | 34,222 | 44,465 |
| data | 23 | 0 | 34,402 | 45,885 |
| docs-question | 34 | 0 | 1,519 | 38,831 |
| off-topic | 10 | 0 | 26,075 | 34,386 |
| smalltalk | 17 | 13 | 27,316 | 27,381 |
| spec-question | 46 | 2 | 1,864 | 38,886 |
| two-things | 17 | 0 | 44,132 | 45,486 |

## The oracle

A perfect model in place of the real one: right when the prompt holds everything the labelled answer needs, "cannot tell" when it lacks a need, a wrong route when a rule answered as the wrong kind. Every miss is the handling's, not a model's. Beside it, the prompt's size and what it carries that no need names (parts of the app's summary or spec, docs parts). Docs are searched without a model's search phrases, as above. One line per miss in [smith-oracle-misses.txt](smith-oracle-misses.txt).

| Kind | Requests | Right | Cannot tell | Wrong route | Median tokens sent | Median parts not needed | Median docs parts not needed |
|---|---|---|---|---|---|---|---|
| ambiguous | 25 | 25 | 0 | 0 | 26,700 | 9 | 3 |
| change | 141 | 140 | 1 | 0 | 34,462 | 10 | 3 |
| custom-code | 13 | 13 | 0 | 0 | 34,222 | 11 | 3 |
| data | 23 | 23 | 0 | 0 | 34,402 | 8 | 3 |
| docs-question | 34 | 17 | 17 | 0 | 1,519 | 9 | 2 |
| off-topic | 10 | 10 | 0 | 0 | 26,075 | 11 | 3 |
| smalltalk | 17 | 17 | 0 | 0 | 27,316 | 9 | 2 |
| spec-question | 46 | 39 | 7 | 0 | 1,864 | 8 | 3 |
| two-things | 17 | 17 | 0 | 0 | 44,132 | 7 | 3 |
