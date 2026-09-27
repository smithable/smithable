# M7 benchmark (2026-09-27)

Seven tasks, in order, on the same app: a CRM with customers only (name, email, segment, notes), sample data and the CRM's roles (admin, sales). Each Claude Code task is a fresh headless session (default model, 2.1.283 (Claude Code)), with file edits allowed and the shell limited to pnpm, npx and node; B also has the Smithable MCP server. A's repository has no Smithable guidance (AGENTS.md, CLAUDE.md and .mcp.json removed). Every prompt ends with: "Keep the app working: update whatever is needed (database, forms, tables) and make sure it type-checks."

After every task the same checks run for all: type-check, build and the app's own tests; the task's check (the database, or a real browser signed in with the development sign-in); every earlier task's check again; and whether `smithable generate` still finds the code to be exactly what the spec generates.

## Totals

| Done by | Tasks done | Tokens | Cost (API-equivalent) | Time | Tasks with regressions | Tasks leaving drift |
|---|---|---|---|---|---|---|
| smithable ask (mistral-small-latest) | 7 / 7 | 22,959 | €0.0024 | 21 s | 0 | 0 |

## Per task

| Task | Done by | Tokens | Cost | Time | How | Files / lines | Type-checks, builds, tests pass | Task done | Regressions | Regenerates cleanly |
|---|---|---|---|---|---|---|---|---|---|---|
| Customers should have a phone number. | smithable ask (mistral-small-latest) | 5,782 | €0.0006 | 4 s | Proposed change:   1. Add field phone (phone) to Customer   2. Search customers by name, email, phone | 7 / 57 | yes | yes | none | yes |
| The customer email should be required. | smithable ask (mistral-small-latest) | 1,868 | €0.0002 | 2 s | Proposed change:   1. Change Customer.email to email! unique Generated 55 files (2 changed, 0 removed). | 4 / 27 | yes | yes | none | yes |
| Add orders: each order has a number, belongs to a customer and has a total amount. | smithable ask (mistral-small-latest) | 3,984 | €0.0004 | 6 s | Proposed change:   1. Add model Order with number, customer, total   2. Add page orders for Order | 14 / 456 | yes | yes | none | yes |
| Add a page for orders, and show it in the menu. | smithable ask (mistral-small-latest) | 5,704 | €0.0006 | 2 s | No operation can do this: Already done: The page 'orders' already exists and is shown in the main menu.  | 0 / 0 | yes | yes | none | yes |
| Only admins may delete customers. | smithable ask (mistral-small-latest) | 1,887 | €0.0002 | 2 s | Proposed change:   1. Only admin may delete customers Generated 60 files (2 changed, 0 removed). | 3 / 6 | yes | yes | none | yes |
| Make it possible to search customers by name on the customers page. | smithable ask (mistral-small-latest) | 1,908 | €0.0002 | 2 s | Proposed change:   1. Search customers by name Generated 60 files (1 changed, 0 removed). | 2 / 6 | yes | yes | none | yes |
| Show Orders first in the menu. | smithable ask (mistral-small-latest) | 1,826 | €0.0002 | 2 s | Proposed change:   1. Set the main menu to orders, customers Generated 60 files (2 changed, 0 removed). | 3 / 16 | yes | yes | none | yes |

Files and lines exclude migration snapshots, the route tree, the lockfile and Smithable's records.

## Raw results

```json
{
  "M": [
    {
      "task": "phone",
      "ms": 4444,
      "model": "mistral-small-latest",
      "tokens": 5782,
      "costUsd": 0,
      "costEur": 0.0006,
      "outcome": "Proposed change:   1. Add field phone (phone) to Customer   2. Search customers by name, email, phone",
      "files": 7,
      "lines": 57,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "email-required",
      "ms": 2075,
      "model": "mistral-small-latest",
      "tokens": 1868,
      "costUsd": 0,
      "costEur": 0.0002,
      "outcome": "Proposed change:   1. Change Customer.email to email! unique Generated 55 files (2 changed, 0 removed).",
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
      "ms": 5876,
      "model": "mistral-small-latest",
      "tokens": 3984,
      "costUsd": 0,
      "costEur": 0.0004,
      "outcome": "Proposed change:   1. Add model Order with number, customer, total   2. Add page orders for Order",
      "files": 14,
      "lines": 456,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "orders-page",
      "ms": 2169,
      "model": "mistral-small-latest",
      "tokens": 5704,
      "costUsd": 0,
      "costEur": 0.0006,
      "outcome": "No operation can do this: Already done: The page 'orders' already exists and is shown in the main menu. ",
      "files": 0,
      "lines": 0,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "admin-delete",
      "ms": 2013,
      "model": "mistral-small-latest",
      "tokens": 1887,
      "costUsd": 0,
      "costEur": 0.0002,
      "outcome": "Proposed change:   1. Only admin may delete customers Generated 60 files (2 changed, 0 removed).",
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
      "ms": 2077,
      "model": "mistral-small-latest",
      "tokens": 1908,
      "costUsd": 0,
      "costEur": 0.0002,
      "outcome": "Proposed change:   1. Search customers by name Generated 60 files (1 changed, 0 removed).",
      "files": 2,
      "lines": 6,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "menu-order",
      "ms": 2051,
      "model": "mistral-small-latest",
      "tokens": 1826,
      "costUsd": 0,
      "costEur": 0.0002,
      "outcome": "Proposed change:   1. Set the main menu to orders, customers Generated 60 files (2 changed, 0 removed).",
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
