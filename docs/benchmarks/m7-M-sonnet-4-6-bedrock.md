# M7 benchmark (2026-10-04)

Seven tasks, in order, on the same app: a CRM with customers only (name, email, segment, notes) and a team page, sample data and the CRM's roles (admin, sales). Each Claude Code task is a fresh headless session (default model, 2.1.289 (Claude Code)), with file edits allowed and the shell limited to pnpm, npx and node; B also has the Smithable MCP server. A's repository has no Smithable guidance (AGENTS.md, CLAUDE.md and .mcp.json removed). Every prompt ends with: "Keep the app working: update whatever is needed (database, forms, tables) and make sure it type-checks."

After every task the same checks run for all: type-check, build and the app's own tests; the task's check (the database, or a real browser signed in with the development sign-in); every earlier task's check again; and whether `smithable generate` still finds the code to be exactly what the spec generates.

**Read this first (2026-10-04):** every one of the seven tasks was read by a wording rule (the generator, tier 0), so no model was called and Sonnet 4.6 was never asked; the run measures the rules, not the model. The rules have grown since the Mistral Small run (2026-09-27, 22,959 tokens) to cover all seven M7 prompts. To compare models in Builder, the tasks would need wordings the rules do not read. The starting app now has a team page, which the CRM's invite-only sign-in requires since then; that is also why the menu task's answer ends with team.

## Totals

| Done by | Tasks done | Tokens | Cost (API-equivalent) | Time | Tasks with regressions | Tasks leaving drift |
|---|---|---|---|---|---|---|
| smithable ask (eu.anthropic.claude-sonnet-4-6 through Amazon Bedrock) | 7 / 7 | 0 | €0.0000 | 15 s | 0 | 0 |

## Per task

| Task | Done by | Tokens | Cost | Time | How | Files / lines | Type-checks, builds, tests pass | Task done | Regressions | Regenerates cleanly |
|---|---|---|---|---|---|---|---|---|---|---|
| Customers should have a phone number. | generator (add field), no model | 0 | $0.0000 | 2 s | Proposed change:   1. Add field phone (phone) to Customer Generated 80 files (4 changed, 0 removed). | 6 / 31 | yes | yes | none | yes |
| The customer email should be required. | generator (field flag), no model | 0 | $0.0000 | 3 s | Proposed change:   1. Change Customer.email to email! unique Generated 80 files (2 changed, 0 removed). | 4 / 29 | yes | yes | none | yes |
| Add orders: each order has a number, belongs to a customer and has a total amount. | generator (add model), no model | 0 | $0.0000 | 2 s | Proposed change:   1. Add model Order with number, customer, total Generated 82 files (8 changed, 0 removed). | 10 / 421 | yes | yes | none | yes |
| Add a page for orders, and show it in the menu. | generator (add page), no model | 0 | $0.0000 | 1 s | Proposed change:   1. Add page orders for Order Generated 85 files (6 changed, 0 removed). | 7 / 221 | yes | yes | none | yes |
| Only admins may delete customers. | generator (access), no model | 0 | $0.0000 | 1 s | Proposed change:   1. Only admin may delete customers Generated 85 files (3 changed, 0 removed). | 4 / 8 | yes | yes | none | yes |
| Make it possible to search customers by name on the customers page. | generator (search), no model | 0 | $0.0000 | 2 s | Proposed change:   1. Search customers by name Generated 85 files (1 changed, 0 removed). | 2 / 34 | yes | yes | none | yes |
| Show Orders first in the menu. | generator (menu order), no model | 0 | $0.0000 | 4 s | Proposed change:   1. Set the main menu to orders, customers, team Generated 85 files (2 changed, 0 removed). | 3 / 16 | yes | yes | none | yes |

Files and lines exclude migration snapshots, the route tree, the lockfile and Smithable's records.

## Raw results

```json
{
  "M": [
    {
      "task": "phone",
      "ms": 1962,
      "model": "add field",
      "generator": true,
      "tokens": 0,
      "costEur": 0,
      "costUsd": 0,
      "outcome": "Proposed change:   1. Add field phone (phone) to Customer Generated 80 files (4 changed, 0 removed).",
      "files": 6,
      "lines": 31,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "email-required",
      "ms": 2914,
      "model": "field flag",
      "generator": true,
      "tokens": 0,
      "costEur": 0,
      "costUsd": 0,
      "outcome": "Proposed change:   1. Change Customer.email to email! unique Generated 80 files (2 changed, 0 removed).",
      "files": 4,
      "lines": 29,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "orders",
      "ms": 1602,
      "model": "add model",
      "generator": true,
      "tokens": 0,
      "costEur": 0,
      "costUsd": 0,
      "outcome": "Proposed change:   1. Add model Order with number, customer, total Generated 82 files (8 changed, 0 removed).",
      "files": 10,
      "lines": 421,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "orders-page",
      "ms": 1083,
      "model": "add page",
      "generator": true,
      "tokens": 0,
      "costEur": 0,
      "costUsd": 0,
      "outcome": "Proposed change:   1. Add page orders for Order Generated 85 files (6 changed, 0 removed).",
      "files": 7,
      "lines": 221,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "admin-delete",
      "ms": 1031,
      "model": "access",
      "generator": true,
      "tokens": 0,
      "costEur": 0,
      "costUsd": 0,
      "outcome": "Proposed change:   1. Only admin may delete customers Generated 85 files (3 changed, 0 removed).",
      "files": 4,
      "lines": 8,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "search",
      "ms": 2327,
      "model": "search",
      "generator": true,
      "tokens": 0,
      "costEur": 0,
      "costUsd": 0,
      "outcome": "Proposed change:   1. Search customers by name Generated 85 files (1 changed, 0 removed).",
      "files": 2,
      "lines": 34,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "menu-order",
      "ms": 3923,
      "model": "menu order",
      "generator": true,
      "tokens": 0,
      "costEur": 0,
      "costUsd": 0,
      "outcome": "Proposed change:   1. Set the main menu to orders, customers, team Generated 85 files (2 changed, 0 removed).",
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
