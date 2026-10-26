# Builder changes over 5 runs (2026-10-26)

The twelve requests of [builder-changes.md](builder-changes.md), run 5 times on each setup ([scripts/bench-changes-runs.mjs](../../scripts/bench-changes-runs.mjs) reads the runs' rows in [builder-changes-runs/](builder-changes-runs/)). *Right* out of twelve per run: the mean, the lowest and highest, and the standard deviation. *Failed* counts requests the provider never answered (a rate limit), left out of the other columns.

| Setup | Right (mean) | Range | SD | Wrong (mean) | No change (mean) | Failed | Cost per request |
|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | 9.8 | 9–11 | 0.7 | 1.0 | 1.2 | 0 | $0.0025 |
| claude-sonnet-5-5 | 9.2 | 9–10 | 0.4 | 1.0 | 1.8 | 0 | $0.0428 |
| claude-haiku-5-5>claude-sonnet-5-5 | 9.0 | 7–10 | 1.1 | 1.0 | 2.0 | 0 | $0.0105 |
| claude-opus-5-5 | 9.8 | 9–10 | 0.4 | 1.0 | 1.2 | 0 | $0.0860 |
| mistral-small-latest | 7.0 | 6–9 | 1.1 | 3.0 | 1.6 | 2 | $0.0036 |

## Each request

Right out of 5, and how often the model asked back instead.

| Request | claude-haiku-5-5 | claude-sonnet-5-5 | claude-haiku-5-5>claude-sonnet-5-5 | claude-opus-5-5 | mistral-small-latest |
|---|---|---|---|---|---|
| vat-in-list | 5/5 | 2/5 (3 asked) | 5/5 | 5/5 | 5/5 |
| first-last-name | 1/5 (4 asked) | 0/5 (5 asked) | 0/5 (5 asked) | 0/5 (5 asked) | 5/5 |
| owner-of-order | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |
| orders-first-as-sales | 5/5 | 5/5 | 2/5 (3 asked) | 4/5 (1 asked) | 4/5 |
| big-orders-admins-only | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| vat-amount | 4/5 (1 asked) | 5/5 | 5/5 | 5/5 | 1/5 (4 asked) |
| client-phone-search | 5/5 | 5/5 | 4/5 (1 asked) | 5/5 | 0/5 |
| no-delete-sent | 5/5 | 5/5 | 5/5 | 5/5 | 1/5 |
| staff-posts | 5/5 | 5/5 | 5/5 | 5/5 | 3/5 |
| home-says-what | 4/5 (1 asked) | 5/5 | 4/5 (1 asked) | 5/5 | 5/5 |
| room-choice | 5/5 | 4/5 (1 asked) | 5/5 | 5/5 | 2/5 (3 asked) |
| teachers-not-instructors | 5/5 | 5/5 | 5/5 | 5/5 | 4/5 (1 asked) |

## A pair's questions back

- **claude-haiku-5-5>claude-sonnet-5-5**: 11 of 60 requests went on to claude-sonnet-5-5. 10 ended in a question back from the cheap model; for the same request in the same run, claude-sonnet-5-5 alone made the right change 5 times and asked back 5 times.
