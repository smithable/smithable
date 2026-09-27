# M7 benchmark (2026-09-27)

Seven tasks, in order, on the same app: a CRM with customers only (name, email, segment, notes), sample data and the CRM's roles (admin, sales). Each Claude Code task is a fresh headless session (default model, 2.1.283 (Claude Code)), with file edits allowed and the shell limited to pnpm, npx and node; B also has the Smithable MCP server. A's repository has no Smithable guidance (AGENTS.md, CLAUDE.md and .mcp.json removed). Every prompt ends with: "Keep the app working: update whatever is needed (database, forms, tables) and make sure it type-checks."

After every task the same checks run for all: type-check, build and the app's own tests; the task's check (the database, or a real browser signed in with the development sign-in); every earlier task's check again; and whether `smithable generate` still finds the code to be exactly what the spec generates.

## Totals

| Done by | Tasks done | Tokens | Cost (API-equivalent) | Time | Tasks with regressions | Tasks leaving drift |
|---|---|---|---|---|---|---|
| smithable ask (qwen2.5:7b) | 6 / 7 | 21,507 | €0.0000 | 663 s | 0 | 0 |

## Per task

| Task | Done by | Tokens | Cost | Time | How | Files / lines | Type-checks, builds, tests pass | Task done | Regressions | Regenerates cleanly |
|---|---|---|---|---|---|---|---|---|---|---|
| Customers should have a phone number. | smithable ask (qwen2.5:7b) | 5,381 | €0.0000 | 129 s | No model found a change that applies. There are already 8 customers, and a new required field needs a value for each. Add phone as optional first (without "!"), fill it in, then make it required, or g | 0 / 0 | yes | **no** | none | yes |
| The customer email should be required. | smithable ask (qwen2.5:7b) | 1,770 | €0.0000 | 70 s | Proposed change:   1. Change Customer.email to email! unique Generated 55 files (2 changed, 0 removed). | 4 / 26 | yes | yes | none | yes |
| Add orders: each order has a number, belongs to a customer and has a total amount. | smithable ask (qwen2.5:7b) | 1,800 | €0.0000 | 103 s | Proposed change:   1. Add model Order with number, customer, total   2. Add page orders for Order | 14 / 456 | yes | yes | none | yes |
| Add a page for orders, and show it in the menu. | smithable ask (qwen2.5:7b) | 5,342 | €0.0000 | 123 s | No model found a change that applies. addPage: Page "orders" already exists.  | 0 / 0 | yes | yes | none | yes |
| Only admins may delete customers. | smithable ask (qwen2.5:7b) | 1,790 | €0.0000 | 70 s | Proposed change:   1. Only admin may delete customers Generated 60 files (2 changed, 0 removed). | 3 / 6 | yes | yes | none | yes |
| Make it possible to search customers by name on the customers page. | smithable ask (qwen2.5:7b) | 3,688 | €0.0000 | 97 s | Proposed change:   1. Search customers by name Generated 60 files (1 changed, 0 removed). | 2 / 32 | yes | yes | none | yes |
| Show Orders first in the menu. | smithable ask (qwen2.5:7b) | 1,736 | €0.0000 | 70 s | Proposed change:   1. Set the main menu to orders, customers Generated 60 files (2 changed, 0 removed). | 3 / 16 | yes | yes | none | yes |

Files and lines exclude migration snapshots, the route tree, the lockfile and Smithable's records.

## Raw results

```json
{
  "M": [
    {
      "task": "phone",
      "ms": 129422,
      "model": "qwen2.5:7b",
      "tokens": 5381,
      "costUsd": 0,
      "costEur": 0,
      "outcome": "No model found a change that applies. There are already 8 customers, and a new required field needs a value for each. Add phone as optional first (without \"!\"), fill it in, then make it required, or g",
      "files": 0,
      "lines": 0,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": false,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "email-required",
      "ms": 70436,
      "model": "qwen2.5:7b",
      "tokens": 1770,
      "costUsd": 0,
      "costEur": 0,
      "outcome": "Proposed change:   1. Change Customer.email to email! unique Generated 55 files (2 changed, 0 removed).",
      "files": 4,
      "lines": 26,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "orders",
      "ms": 102921,
      "model": "qwen2.5:7b",
      "tokens": 1800,
      "costUsd": 0,
      "costEur": 0,
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
      "ms": 122767,
      "model": "qwen2.5:7b",
      "tokens": 5342,
      "costUsd": 0,
      "costEur": 0,
      "outcome": "No model found a change that applies. addPage: Page \"orders\" already exists. ",
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
      "ms": 70371,
      "model": "qwen2.5:7b",
      "tokens": 1790,
      "costUsd": 0,
      "costEur": 0,
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
      "ms": 97433,
      "model": "qwen2.5:7b",
      "tokens": 3688,
      "costUsd": 0,
      "costEur": 0,
      "outcome": "Proposed change:   1. Search customers by name Generated 60 files (1 changed, 0 removed).",
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
      "ms": 69913,
      "model": "qwen2.5:7b",
      "tokens": 1736,
      "costUsd": 0,
      "costEur": 0,
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
