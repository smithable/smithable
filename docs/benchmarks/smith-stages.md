# Smith's stages before a model

2026-11-14, 306 requests of docs/benchmarks/smith-requests.json, with no model ([smith-stages.mjs](../../scripts/smith-stages.mjs)). Free; run it on any change to the rules, the search or the prompts.

## Retrieval

Docs questions whose labelled part is among the parts found, without the search phrases a model adds: top 3 17 / 28 (61 %), top 5 19 / 28 (68 %).

| Language | Top 3 | Top 5 |
|---|---|---|
| en | 16 / 22 (73 %) | 18 / 22 (82 %) |
| fi | 0 / 2 (0 %) | 0 / 2 (0 %) |
| sv | 1 / 4 (25 %) | 1 / 4 (25 %) |

Not in the top 5: d-publish, d-cost, d-selfhost, d-apps, d-fi-finnish, d-sv-publish, d-sv-data, d-fi-cost, long-mp-docs.

## What would be sent

The first model call's prompt per kind of request, about four characters a token: the cost before any answer. A request a rule answers sends nothing.

| Kind | Requests | Answered by a rule | Median tokens sent | Most |
|---|---|---|---|---|
| ambiguous | 25 | 0 | 26,654 | 44,272 |
| change | 135 | 14 | 34,640 | 46,072 |
| custom-code | 13 | 0 | 34,210 | 44,465 |
| data | 23 | 0 | 34,385 | 45,868 |
| docs-question | 28 | 0 | 1,448 | 38,831 |
| off-topic | 10 | 0 | 26,075 | 34,368 |
| smalltalk | 17 | 13 | 27,316 | 27,362 |
| spec-question | 38 | 2 | 1,964 | 38,841 |
| two-things | 17 | 0 | 44,132 | 45,440 |

## The oracle

A perfect model in place of the real one: right when the prompt holds everything the labelled answer needs, "cannot tell" when it lacks a need, a wrong route when a rule answered as the wrong kind. Every miss is the handling's, not a model's. Beside it, the prompt's size and what it carries that no need names (parts of the app's summary or spec, docs parts). Docs are searched without a model's search phrases, as above. One line per miss in [smith-oracle-misses.txt](smith-oracle-misses.txt).

| Kind | Requests | Right | Cannot tell | Wrong route | Median tokens sent | Median parts not needed | Median docs parts not needed |
|---|---|---|---|---|---|---|---|
| ambiguous | 25 | 25 | 0 | 0 | 26,654 | 4 | 3 |
| change | 135 | 135 | 0 | 0 | 34,640 | 5 | 3 |
| custom-code | 13 | 13 | 0 | 0 | 34,210 | 6 | 3 |
| data | 23 | 23 | 0 | 0 | 34,385 | 5 | 3 |
| docs-question | 28 | 17 | 11 | 0 | 1,448 | 8 | 2 |
| off-topic | 10 | 10 | 0 | 0 | 26,075 | 8 | 3 |
| smalltalk | 17 | 17 | 0 | 0 | 27,316 | 8 | 2 |
| spec-question | 38 | 30 | 8 | 0 | 1,964 | 5 | 3 |
| two-things | 17 | 17 | 0 | 0 | 44,132 | 3 | 3 |
