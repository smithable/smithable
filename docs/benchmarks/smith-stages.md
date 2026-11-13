# Smith's stages before a model

2026-11-13, 285 requests of docs/benchmarks/smith-requests.json, with no model ([smith-stages.mjs](../../scripts/smith-stages.mjs)). Free; run it on any change to the rules, the search or the prompts.

## Retrieval

Docs questions whose labelled part is among the parts found, without the search phrases a model adds: top 3 17 / 28 (61 %), top 5 20 / 28 (71 %).

| Language | Top 3 | Top 5 |
|---|---|---|
| en | 16 / 22 (73 %) | 19 / 22 (86 %) |
| fi | 0 / 2 (0 %) | 0 / 2 (0 %) |
| sv | 1 / 4 (25 %) | 1 / 4 (25 %) |

Not in the top 5: d-publish, d-cost, d-selfhost, d-apps, d-fi-finnish, d-sv-publish, d-sv-data, d-fi-cost.

## What would be sent

The first model call's prompt per kind of request, about four characters a token: the cost before any answer. A request a rule answers sends nothing.

| Kind | Requests | Answered by a rule | Median tokens sent | Most |
|---|---|---|---|---|
| ambiguous | 25 | 0 | 26,623 | 44,272 |
| change | 114 | 14 | 34,212 | 46,072 |
| custom-code | 13 | 0 | 34,210 | 44,465 |
| data | 23 | 0 | 34,385 | 45,868 |
| docs-question | 28 | 0 | 1,448 | 38,627 |
| off-topic | 10 | 0 | 26,075 | 34,368 |
| smalltalk | 17 | 13 | 27,316 | 27,362 |
| spec-question | 38 | 2 | 1,964 | 38,841 |
| two-things | 17 | 0 | 44,132 | 45,440 |
