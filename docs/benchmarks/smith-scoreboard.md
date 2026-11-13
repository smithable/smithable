# Smith's scoreboard

One line per round of [bench-smith](../../scripts/bench-smith.mjs) on [what people say to Smith](smith-requests.json), made by [smith-scoreboard.mjs](../../scripts/smith-scoreboard.mjs); the rows are in [smith-scoreboard.json](smith-scoreboard.json). Right is the share of requests answered as labelled; cost is Smith's own per request, in US dollars at the models' list prices (the judge apart). ▼: under the round before, for the same setup.

## 2026-11-13, 291b18fd (set 1, 275 requests): Mistral (mistral-small-latest, mistral-medium-latest), before Smith read docs parts (#1153); rows record no tier, so 'paid for nothing' reads 0

| | small (models not recorded) | small>better (models not recorded) |
|---|---|---|
| **All** | 139 / 275, asked 27, $0.0043 a request | 155 / 275, asked 34, $0.0185 a request |
| ambiguous | 14 / 25 | 16 / 25 |
| change | 58 / 104 | 62 / 104 |
| custom-code | 6 / 13 | 8 / 13 |
| data | 11 / 23 | 17 / 23 |
| docs-question | 2 / 28 | 3 / 28 |
| off-topic | 8 / 10 | 8 / 10 |
| smalltalk | 17 / 17 | 17 / 17 |
| spec-question | 12 / 38 | 12 / 38 |
| two-things | 11 / 17 | 12 / 17 |
| en | 102 / 204 | 117 / 204 |
| fi | 18 / 27 | 16 / 27 |
| sv | 19 / 44 | 22 / 44 |

Escalation: the rules answered 29, 0 of them wrong; they passed on 33 that the set says need no model. Of 275 requests in both small and small>better: 29 small got wrong where small>better was right (should have gone up), 0 went up where small alone was right (paid for nothing).

