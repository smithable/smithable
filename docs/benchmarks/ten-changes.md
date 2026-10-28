# The ten-changes benchmark: Smithable's side (2026-10-28)

Ten plain-language requests, in order, on a CRM made from one description (`smithable new --describe`), with eight customers typed through the form; each request through Smith as the Builder's path (`smithable ask --yes`), under the rules every side follows: a failed acceptance check sends one repair prompt in a fixed form ("That didn't work: <the acceptance line>"), three at most, fifteen minutes at most; a question back is answered from the request only ("Use your judgement."). After each request, the acceptance check in a real browser, every earlier check again (regressions), and the eight customers read back (data kept). Type-check, build, the app's own tests and "regenerates cleanly" are Smithable's own checks and have their own columns.

Model: mistral-small-latest. Engine: fbd76651. Runs: 1.

## Summary

| Side | Runs | Done (median of 10) | Right first time | Regressions (any run) | Cost per request (median) | Builder time per request (median) |
|---|---|---|---|---|---|---|
| Smithable (Smith with mistral-small-latest, engine fbd76651) | 1 | 0 of 10 | 0 of 7 | none | €0 | 17 s |

## Per run

### Run 1

Start: the start check passed after 1 prompt; 0 of 8 customers typed through the form; 0 tokens · €0.

| # | Request | Done | Right first time | Prompts | Builder time | Total time | Tokens · cost | Regressions | Data kept | Model | Type-checks, builds, tests | Regenerates cleanly | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Customers should have a phone number. | no | – | 4 | 12 s | 62 s | 105,568 · €0 | none | **no** | mistral-small-latest | yes | yes |  |
| 2 | The customer email should be required, and no two customers may share one. | no | – | 4 | 17 s | 115 s | 105,379 · €0 | none | **no** | mistral-small-latest | yes | yes |  |
| 3 | Add a segment "partner", and let me filter the customer list by segment. | no | – | 4 | 17 s | 152 s | 70,290 · €0 | none | **no** | mistral-small-latest | yes | yes |  |
| 4 | Add orders: each order has a number, belongs to a customer and has a total amount. Show them on their own page in the menu. | no | – | 4 | 22 s | 187 s | 123,462 · €0 | none | **no** | mistral-small-latest | yes | yes |  |
| 5 | Sales people may only see their own customers. Admins see everyone's. | no | – | 6 | 26 s | 205 s | 105,547 · €0 | none | **no** | mistral-small-latest | yes | yes | asked: Smithable model (mistral-small-latest) · 17,602 tokens (17,497 in, 105 out) · $0.0027 What exactly do you want to change so that a sales person sees all customers, including customer 1, and can edit c; asked: Smithable model (mistral-small-latest) · 17,569 tokens (17,497 in, 72 out) · $0.0027 What should the sales person see on the customers page? Should they see all customers, only their own, or only cust |
| 6 | Each order has a status: draft, placed or shipped. Add a "Mark shipped" button that only shows for placed orders. | blocked by #4 | – | 0 | 0 s | 0 s | 0 · €0 | none | yes |  | – | – |  |
| 7 | On a customer's page, show how many orders they have and the total amount ordered. | blocked by #4 | – | 0 | 0 s | 0 s | 0 · €0 | none | yes |  | – | – |  |
| 8 | Send the customer an email when their order is marked shipped. | blocked by #4 | – | 0 | 0 s | 0 s | 0 · €0 | none | yes |  | – | – |  |
| 9 | Rename "segment" to "market" everywhere. | no | – | 4 | 27 s | 205 s | 191,130 · €0 | none | **no** | mistral-small-latest | yes | yes |  |
| 10 | Give the app a blue look with rounded corners. | no | – | 4 | 11 s | 188 s | 64,202 · €0 | none | **no** | mistral-small-latest | yes | yes |  |

Final pass: acceptance checks failing: **1, 2, 3, 4, 5, 6, 7, 8, 9, 10**; data kept **no**; core flows: sign in **no**, list **no**, add **no**, edit **no**. The run took 1348 s. The app is in `/tmp/smithable-bench-ten-eNpwSO/run-1`.

## Raw results

```json
[
  {
    "start": {
      "prompts": 1,
      "builderMs": 14480,
      "tokens": 0,
      "costEur": 0,
      "costUsd": 0,
      "missing": [],
      "typed": 0
    },
    "rows": [
      {
        "id": 1,
        "prompts": 4,
        "builderMs": 12483,
        "totalMs": 62068,
        "tokens": 105568,
        "costEur": 0,
        "costUsd": 0,
        "model": "mistral-small-latest",
        "firstTime": false,
        "done": "no",
        "regressions": [],
        "kept": false,
        "notes": [],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      },
      {
        "id": 2,
        "prompts": 4,
        "builderMs": 17470,
        "totalMs": 115310,
        "tokens": 105379,
        "costEur": 0,
        "costUsd": 0,
        "model": "mistral-small-latest",
        "firstTime": false,
        "done": "no",
        "regressions": [],
        "kept": false,
        "notes": [],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      },
      {
        "id": 3,
        "prompts": 4,
        "builderMs": 16884,
        "totalMs": 152492,
        "tokens": 70290,
        "costEur": 0,
        "costUsd": 0,
        "model": "mistral-small-latest",
        "firstTime": false,
        "done": "no",
        "regressions": [],
        "kept": false,
        "notes": [],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      },
      {
        "id": 4,
        "prompts": 4,
        "builderMs": 22465,
        "totalMs": 187228,
        "tokens": 123462,
        "costEur": 0,
        "costUsd": 0,
        "model": "mistral-small-latest",
        "firstTime": false,
        "done": "no",
        "regressions": [],
        "kept": false,
        "notes": [],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      },
      {
        "id": 5,
        "prompts": 6,
        "builderMs": 25785,
        "totalMs": 205045,
        "tokens": 105547,
        "costEur": 0,
        "costUsd": 0,
        "model": "mistral-small-latest",
        "firstTime": false,
        "done": "no",
        "regressions": [],
        "kept": false,
        "notes": [
          "asked: Smithable model (mistral-small-latest) · 17,602 tokens (17,497 in, 105 out) · $0.0027 What exactly do you want to change so that a sales person sees all customers, including customer 1, and can edit c",
          "asked: Smithable model (mistral-small-latest) · 17,569 tokens (17,497 in, 72 out) · $0.0027 What should the sales person see on the customers page? Should they see all customers, only their own, or only cust"
        ],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      },
      {
        "id": 6,
        "prompts": 0,
        "builderMs": 0,
        "totalMs": 0,
        "tokens": 0,
        "costEur": 0,
        "costUsd": 0,
        "model": "",
        "firstTime": false,
        "done": "blocked by #4",
        "regressions": [],
        "kept": true,
        "notes": []
      },
      {
        "id": 7,
        "prompts": 0,
        "builderMs": 0,
        "totalMs": 0,
        "tokens": 0,
        "costEur": 0,
        "costUsd": 0,
        "model": "",
        "firstTime": false,
        "done": "blocked by #4",
        "regressions": [],
        "kept": true,
        "notes": []
      },
      {
        "id": 8,
        "prompts": 0,
        "builderMs": 0,
        "totalMs": 0,
        "tokens": 0,
        "costEur": 0,
        "costUsd": 0,
        "model": "",
        "firstTime": false,
        "done": "blocked by #4",
        "regressions": [],
        "kept": true,
        "notes": []
      },
      {
        "id": 9,
        "prompts": 4,
        "builderMs": 27145,
        "totalMs": 204639,
        "tokens": 191130,
        "costEur": 0,
        "costUsd": 0,
        "model": "mistral-small-latest",
        "firstTime": false,
        "done": "no",
        "regressions": [],
        "kept": false,
        "notes": [],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      },
      {
        "id": 10,
        "prompts": 4,
        "builderMs": 11394,
        "totalMs": 188264,
        "tokens": 64202,
        "costEur": 0,
        "costUsd": 0,
        "model": "mistral-small-latest",
        "firstTime": false,
        "done": "no",
        "regressions": [],
        "kept": false,
        "notes": [],
        "typecheck": true,
        "build": true,
        "tests": true,
        "regenerates": true
      }
    ],
    "extras": [],
    "finalChecks": {
      "1": false,
      "2": false,
      "3": false,
      "4": false,
      "5": false,
      "6": false,
      "7": false,
      "8": false,
      "9": false,
      "10": false,
      "kept": false
    },
    "flows": {
      "signedIn": false,
      "listed": false,
      "added": false,
      "edited": false
    },
    "totalMs": 1348137
  }
]
```
