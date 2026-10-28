# The ten-changes benchmark: Smithable's side (2026-10-28)

Ten plain-language requests, in order, on a CRM made from one description (`smithable new --describe`), with eight customers typed through the form; each request through Smith as the Builder's path (`smithable ask --yes`), under the rules every side follows: a failed acceptance check sends one repair prompt in a fixed form ("That didn't work: <the acceptance line>"), three at most, fifteen minutes at most; a question back is answered from the request only ("Use your judgement."). After each request, the acceptance check in a real browser, every earlier check again (regressions), and the eight customers read back (data kept). Type-check, build, the app's own tests and "regenerates cleanly" are Smithable's own checks and have their own columns.

Model: mistral-small-latest. Engine: df1e23ab. Runs: 1.

## Summary

| Side | Runs | Done (median of 10) | Right first time | Regressions (any run) | Cost per request (median) | Builder time per request (median) |
|---|---|---|---|---|---|---|
| Smithable (Smith with mistral-small-latest, engine df1e23ab) | 1 | 8 of 10 | 8 of 10 | none | $0.0043 | 4 s |

## Per run

### Run 1

Start: the start check passed after 1 prompt; 8 of 8 customers typed through the form; 0 tokens · €0.

| # | Request | Done | Right first time | Prompts | Builder time | Total time | Tokens · cost | Regressions | Data kept | Model | Type-checks, builds, tests | Regenerates cleanly | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Customers should have a phone number. | yes | yes | 1 | 1 s | 41 s | 0 · €0 | none | yes | generator (add field), no model | yes | yes |  |
| 2 | The customer email should be required, and no two customers may share one. | yes | yes | 1 | 4 s | 81 s | 35,116 · $0.0053 | none | yes | mistral-small-latest | yes | yes |  |
| 3 | Add a segment "partner", and let me filter the customer list by segment. | no | – | 4 | 10 s | 358 s | 70,246 · $0.0108 | none | yes | mistral-small-latest | yes | yes |  |
| 4 | Add orders: each order has a number, belongs to a customer and has a total amount. Show them on their own page in the menu. | yes | yes | 1 | 7 s | 98 s | 52,908 · $0.0080 | none | yes | mistral-small-latest | yes | yes |  |
| 5 | Sales people may only see their own customers. Admins see everyone's. | yes | yes | 1 | 4 s | 131 s | 17,508 · $0.0027 | none | yes | mistral-small-latest | yes | yes |  |
| 6 | Each order has a status: draft, placed or shipped. Add a "Mark shipped" button that only shows for placed orders. | yes | yes | 1 | 3 s | 140 s | 17,574 · $0.0027 | none | yes | mistral-small-latest | yes | yes |  |
| 7 | On a customer's page, show how many orders they have and the total amount ordered. | no | – | 4 | 15 s | 602 s | 140,652 · $0.0214 | none | yes | mistral-small-latest | yes | yes |  |
| 8 | Send the customer an email when their order is marked shipped. | yes | yes | 1 | 3 s | 159 s | 17,561 · $0.0027 | none | yes | mistral-small-latest | yes | yes |  |
| 9 | Rename "segment" to "market" everywhere. | yes | yes | 1 | 4 s | 192 s | 28,588 · $0.0043 | none | yes | mistral-small-latest | yes | yes |  |
| 10 | Give the app a blue look with rounded corners. | yes | yes | 1 | 2 s | 202 s | 15,164 · $0.0023 | none | yes | mistral-small-latest | yes | yes |  |

Final pass: acceptance checks failing: **3, 7**; data kept yes; core flows: sign in yes, list yes, add yes, edit yes. The run took 2337 s. The app is in `/tmp/smithable-bench-ten-GmxXxn/run-1`.

## Raw results

```json
[
  {
    "start": {
      "prompts": 1,
      "builderMs": 13771,
      "tokens": 0,
      "costEur": 0,
      "costUsd": 0,
      "missing": [],
      "typed": 8
    },
    "rows": [
      {
        "id": 1,
        "prompts": 1,
        "builderMs": 1028,
        "totalMs": 41030,
        "tokens": 0,
        "costEur": 0,
        "costUsd": 0,
        "model": "generator (add field), no model",
        "firstTime": true,
        "done": "yes",
        "regressions": [],
        "kept": true,
        "notes": [],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      },
      {
        "id": 2,
        "prompts": 1,
        "builderMs": 4486,
        "totalMs": 80917,
        "tokens": 35116,
        "costEur": 0,
        "costUsd": 0.0053,
        "model": "mistral-small-latest",
        "firstTime": true,
        "done": "yes",
        "regressions": [],
        "kept": true,
        "notes": [],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      },
      {
        "id": 3,
        "prompts": 4,
        "builderMs": 10277,
        "totalMs": 357766,
        "tokens": 70246,
        "costEur": 0,
        "costUsd": 0.0108,
        "model": "mistral-small-latest",
        "firstTime": false,
        "done": "no",
        "regressions": [],
        "kept": true,
        "notes": [],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      },
      {
        "id": 4,
        "prompts": 1,
        "builderMs": 6693,
        "totalMs": 97937,
        "tokens": 52908,
        "costEur": 0,
        "costUsd": 0.008,
        "model": "mistral-small-latest",
        "firstTime": true,
        "done": "yes",
        "regressions": [],
        "kept": true,
        "notes": [],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      },
      {
        "id": 5,
        "prompts": 1,
        "builderMs": 3677,
        "totalMs": 130858,
        "tokens": 17508,
        "costEur": 0,
        "costUsd": 0.0027,
        "model": "mistral-small-latest",
        "firstTime": true,
        "done": "yes",
        "regressions": [],
        "kept": true,
        "notes": [],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      },
      {
        "id": 6,
        "prompts": 1,
        "builderMs": 3338,
        "totalMs": 139597,
        "tokens": 17574,
        "costEur": 0,
        "costUsd": 0.0027,
        "model": "mistral-small-latest",
        "firstTime": true,
        "done": "yes",
        "regressions": [],
        "kept": true,
        "notes": [],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      },
      {
        "id": 7,
        "prompts": 4,
        "builderMs": 14817,
        "totalMs": 602190,
        "tokens": 140652,
        "costEur": 0,
        "costUsd": 0.021400000000000002,
        "model": "mistral-small-latest",
        "firstTime": false,
        "done": "no",
        "regressions": [],
        "kept": true,
        "notes": [],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      },
      {
        "id": 8,
        "prompts": 1,
        "builderMs": 3160,
        "totalMs": 159089,
        "tokens": 17561,
        "costEur": 0,
        "costUsd": 0.0027,
        "model": "mistral-small-latest",
        "firstTime": true,
        "done": "yes",
        "regressions": [],
        "kept": true,
        "notes": [],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      },
      {
        "id": 9,
        "prompts": 1,
        "builderMs": 4492,
        "totalMs": 191804,
        "tokens": 28588,
        "costEur": 0,
        "costUsd": 0.0043,
        "model": "mistral-small-latest",
        "firstTime": true,
        "done": "yes",
        "regressions": [],
        "kept": true,
        "notes": [],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      },
      {
        "id": 10,
        "prompts": 1,
        "builderMs": 2456,
        "totalMs": 201949,
        "tokens": 15164,
        "costEur": 0,
        "costUsd": 0.0023,
        "model": "mistral-small-latest",
        "firstTime": true,
        "done": "yes",
        "regressions": [],
        "kept": true,
        "notes": [],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      }
    ],
    "extras": [],
    "finalChecks": {
      "1": true,
      "2": true,
      "3": false,
      "4": true,
      "5": true,
      "6": true,
      "7": false,
      "8": true,
      "9": true,
      "10": true,
      "kept": true
    },
    "flows": {
      "signedIn": true,
      "listed": true,
      "added": true,
      "edited": true
    },
    "totalMs": 2337332
  }
]
```
