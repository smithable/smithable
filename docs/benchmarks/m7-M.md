# M7 benchmark (2026-09-29)

Seven tasks, in order, on the same app: a CRM with customers only (name, email, segment, notes), sample data and the CRM's roles (admin, sales). Each Claude Code task is a fresh headless session (default model, 2.1.284 (Claude Code)), with file edits allowed and the shell limited to pnpm, npx and node; B also has the Smithable MCP server. A's repository has no Smithable guidance (AGENTS.md, CLAUDE.md and .mcp.json removed). Every prompt ends with: "Keep the app working: update whatever is needed (database, forms, tables) and make sure it type-checks."

After every task the same checks run for all: type-check, build and the app's own tests; the task's check (the database, or a real browser signed in with the development sign-in); every earlier task's check again; and whether `smithable generate` still finds the code to be exactly what the spec generates.

## Totals

| Done by | Tasks done | Tokens | Cost (API-equivalent) | Time | Tasks with regressions | Tasks leaving drift |
|---|---|---|---|---|---|---|
| smithable ask (mistral-small-latest) | 7 / 7 | 0 | €0.0000 | 5 s | 0 | 0 |

## Per task

| Task | Done by | Tokens | Cost | Time | How | Files / lines | Type-checks, builds, tests pass | Task done | Regressions | Regenerates cleanly |
|---|---|---|---|---|---|---|---|---|---|---|
| Customers should have a phone number. | smithable ask (mistral-small-latest) | 0 | $0.0000 | 1 s | Proposed change:   1. Add field phone (phone) to Customer Generated 60 files (4 changed, 0 removed). | 6 / 25 | yes | yes | none | yes |
| The customer email should be required. | smithable ask (mistral-small-latest) | 0 | $0.0000 | 1 s | Proposed change:   1. Change Customer.email to email! unique Generated 60 files (2 changed, 0 removed). | 4 / 27 | yes | yes | none | yes |
| Add orders: each order has a number, belongs to a customer and has a total amount. | smithable ask (mistral-small-latest) | 0 | $0.0000 | 1 s | Proposed change:   1. Add model Order with number, customer, total Generated 62 files (7 changed, 0 removed). | 9 / 332 | yes | yes | none | yes |
| Add a page for orders, and show it in the menu. | smithable ask (mistral-small-latest) | 0 | $0.0000 | 1 s | Proposed change:   1. Add page orders for Order Generated 65 files (6 changed, 0 removed). | 7 / 160 | yes | yes | none | yes |
| Only admins may delete customers. | smithable ask (mistral-small-latest) | 0 | $0.0000 | 1 s | Proposed change:   1. Only admin may delete customers Generated 65 files (2 changed, 0 removed). | 3 / 6 | yes | yes | none | yes |
| Make it possible to search customers by name on the customers page. | smithable ask (mistral-small-latest) | 0 | $0.0000 | 1 s | Proposed change:   1. Search customers by name Generated 65 files (1 changed, 0 removed). | 2 / 32 | yes | yes | none | yes |
| Show Orders first in the menu. | smithable ask (mistral-small-latest) | 0 | $0.0000 | 1 s | Proposed change:   1. Set the main menu to orders, customers Generated 65 files (2 changed, 0 removed). | 3 / 16 | yes | yes | none | yes |

Files and lines exclude migration snapshots, the route tree, the lockfile and Smithable's records.

## Raw results

```json
{
  "M": [
    {
      "task": "phone",
      "ms": 927,
      "model": "none",
      "tokens": 0,
      "costEur": 0,
      "costUsd": 0,
      "outcome": "Proposed change:   1. Add field phone (phone) to Customer Generated 60 files (4 changed, 0 removed).",
      "files": 6,
      "lines": 25,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "email-required",
      "ms": 924,
      "model": "none",
      "tokens": 0,
      "costEur": 0,
      "costUsd": 0,
      "outcome": "Proposed change:   1. Change Customer.email to email! unique Generated 60 files (2 changed, 0 removed).",
      "files": 4,
      "lines": 27,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "orders",
      "ms": 922,
      "model": "none",
      "tokens": 0,
      "costEur": 0,
      "costUsd": 0,
      "outcome": "Proposed change:   1. Add model Order with number, customer, total Generated 62 files (7 changed, 0 removed).",
      "files": 9,
      "lines": 332,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "orders-page",
      "ms": 531,
      "model": "none",
      "tokens": 0,
      "costEur": 0,
      "costUsd": 0,
      "outcome": "Proposed change:   1. Add page orders for Order Generated 65 files (6 changed, 0 removed).",
      "files": 7,
      "lines": 160,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "admin-delete",
      "ms": 539,
      "model": "none",
      "tokens": 0,
      "costEur": 0,
      "costUsd": 0,
      "outcome": "Proposed change:   1. Only admin may delete customers Generated 65 files (2 changed, 0 removed).",
      "files": 3,
      "lines": 6,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "search",
      "ms": 506,
      "model": "none",
      "tokens": 0,
      "costEur": 0,
      "costUsd": 0,
      "outcome": "Proposed change:   1. Search customers by name Generated 65 files (1 changed, 0 removed).",
      "files": 2,
      "lines": 32,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "menu-order",
      "ms": 521,
      "model": "none",
      "tokens": 0,
      "costEur": 0,
      "costUsd": 0,
      "outcome": "Proposed change:   1. Set the main menu to orders, customers Generated 65 files (2 changed, 0 removed).",
      "files": 3,
      "lines": 16,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    }
  ]
}
```
