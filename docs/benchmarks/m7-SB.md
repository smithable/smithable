# M7 benchmark (2026-09-26)

Seven tasks, in order, on the same app: a CRM with customers only (name, email, segment, notes), sample data and the CRM's roles (admin, sales). Each Claude Code task is a fresh headless session (default model, 2.1.283 (Claude Code)), with file edits allowed and the shell limited to pnpm, npx and node; B also has the Smithable MCP server. A's repository has no Smithable guidance (AGENTS.md, CLAUDE.md and .mcp.json removed). Every prompt ends with: "Keep the app working: update whatever is needed (database, forms, tables) and make sure it type-checks."

After every task the same checks run for all: type-check, build and the app's own tests; the task's check (the database, or a real browser signed in with the development sign-in); every earlier task's check again; and whether `smithable generate` still finds the code to be exactly what the spec generates.

## Totals

| Done by | Tasks done | Tokens | Cost (API-equivalent) | Time | Tasks with regressions | Tasks leaving drift |
|---|---|---|---|---|---|---|
| Smithable ops (no model) | 7 / 7 | 0 | $0.00 | 12 s | 0 | 0 |
| Claude Code + MCP | 7 / 7 | 948,442 | $0.92 | 122 s | 0 | 0 |

## Per task

| Task | Done by | Tokens | Cost | Time | How | Files / lines | Type-checks, builds, tests pass | Task done | Regressions | Regenerates cleanly |
|---|---|---|---|---|---|---|---|---|---|---|
| Customers should have a phone number. | Smithable ops (no model) | 0 | $0.00 | 2 s | operations | 6 / 25 | yes | yes | none | yes |
| Customers should have a phone number. | Claude Code + MCP | 108,102 | $0.13 | 17 s | 5 turns, 2 Smithable calls, 0 file tools | 6 / 25 | yes | yes | none | yes |
| The customer email should be required. | Smithable ops (no model) | 0 | $0.00 | 2 s | operations | 4 / 27 | yes | yes | none | yes |
| The customer email should be required. | Claude Code + MCP | 108,272 | $0.12 | 16 s | 5 turns, 2 Smithable calls, 0 file tools | 4 / 27 | yes | yes | none | yes |
| Add orders: each order has a number, belongs to a customer and has a total amount. | Smithable ops (no model) | 0 | $0.00 | 2 s | operations | 9 / 305 | yes | yes | none | yes |
| Add orders: each order has a number, belongs to a customer and has a total amount. | Claude Code + MCP | 181,257 | $0.15 | 22 s | 8 turns, 3 Smithable calls, 0 file tools | 14 / 452 | yes | yes | none | yes |
| Add a page for orders, and show it in the menu. | Smithable ops (no model) | 0 | $0.00 | 2 s | operations | 6 / 145 | yes | yes | none | yes |
| Add a page for orders, and show it in the menu. | Claude Code + MCP | 182,077 | $0.16 | 23 s | 9 turns, 2 Smithable calls, 0 file tools | 0 / 0 | yes | yes | none | yes |
| Only admins may delete customers. | Smithable ops (no model) | 0 | $0.00 | 2 s | operations | 3 / 6 | yes | yes | none | yes |
| Only admins may delete customers. | Claude Code + MCP | 108,164 | $0.11 | 14 s | 5 turns, 2 Smithable calls, 0 file tools | 3 / 6 | yes | yes | none | yes |
| Make it possible to search customers by name on the customers page. | Smithable ops (no model) | 0 | $0.00 | 2 s | operations | 2 / 32 | yes | yes | none | yes |
| Make it possible to search customers by name on the customers page. | Claude Code + MCP | 108,266 | $0.12 | 14 s | 5 turns, 2 Smithable calls, 0 file tools | 2 / 32 | yes | yes | none | yes |
| Show Orders first in the menu. | Smithable ops (no model) | 0 | $0.00 | 2 s | operations | 3 / 14 | yes | yes | none | yes |
| Show Orders first in the menu. | Claude Code + MCP | 152,304 | $0.13 | 16 s | 7 turns, 2 Smithable calls, 0 file tools | 3 / 14 | yes | yes | none | yes |

Files and lines exclude migration snapshots, the route tree, the lockfile and Smithable's records.

## Raw results

```json
{
  "S": [
    {
      "task": "phone",
      "ms": 1812,
      "tokens": 0,
      "costUsd": 0,
      "turns": 0,
      "possible": true,
      "opsOk": true,
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
      "ms": 1692,
      "tokens": 0,
      "costUsd": 0,
      "turns": 0,
      "possible": true,
      "opsOk": true,
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
      "ms": 1665,
      "tokens": 0,
      "costUsd": 0,
      "turns": 0,
      "possible": true,
      "opsOk": true,
      "files": 9,
      "lines": 305,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "orders-page",
      "ms": 1636,
      "tokens": 0,
      "costUsd": 0,
      "turns": 0,
      "possible": true,
      "opsOk": true,
      "files": 6,
      "lines": 145,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "admin-delete",
      "ms": 1623,
      "tokens": 0,
      "costUsd": 0,
      "turns": 0,
      "possible": true,
      "opsOk": true,
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
      "ms": 1579,
      "tokens": 0,
      "costUsd": 0,
      "turns": 0,
      "possible": true,
      "opsOk": true,
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
      "ms": 1574,
      "tokens": 0,
      "costUsd": 0,
      "turns": 0,
      "possible": true,
      "opsOk": true,
      "files": 3,
      "lines": 14,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    }
  ],
  "B": [
    {
      "task": "phone",
      "ms": 17178,
      "tokens": 108102,
      "costUsd": 0.1324838,
      "turns": 5,
      "smithableCalls": 2,
      "fileTools": 0,
      "finalMessage": "Customers now have an optional `phone` field.\n\nI added it with Smithable's `addField` operation rather than editing files by hand. That one operation took care of the database, forms and table:\n\n- **Spec:** `smithable.yml` has the new field, stored with Smithable's `phone` type.\n- **Database:** the schema was updated and a new migration was generated and applied.\n- **Forms and tables:** the Custom",
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
      "ms": 16232,
      "tokens": 108272,
      "costUsd": 0.11959740000000002,
      "turns": 5,
      "smithableCalls": 2,
      "fileTools": 0,
      "finalMessage": "Customer email is now required. I changed it with Smithable's `changeField` operation, from `email unique` to `email! unique`, so it's still unique as well.\n\n- **What changed:** Smithable regenerated two files for the new required rule. It reported no effect on custom code.\n- **Database:** Smithable applies a migration as part of this operation. I didn't check the database directly, so I haven't c",
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
      "ms": 21910,
      "tokens": 181257,
      "costUsd": 0.152507,
      "turns": 8,
      "smithableCalls": 3,
      "fileTools": 0,
      "finalMessage": "I added orders to the app, and `tsc --noEmit` type-checks with no errors.\n\n- **Order model:** each order has three required fields:\n  - `number`: text, and no two orders can share one.\n  - `customer`: which customer the order belongs to.\n  - `total`: an amount of money, in EUR (the app's currency).\n- **Orders page:** at `/orders` you can list, view, create, edit and delete orders. It's in the main",
      "files": 14,
      "lines": 452,
      "typecheck": true,
      "build": true,
      "tests": true,
      "done": true,
      "regressions": [],
      "regenerates": true
    },
    {
      "task": "orders-page",
      "ms": 23427,
      "tokens": 182077,
      "costUsd": 0.15594940000000002,
      "turns": 9,
      "smithableCalls": 2,
      "fileTools": 0,
      "finalMessage": "The orders page and its menu entry were already in place, so I didn't change anything.\n\n- **Already done:** commit `8072d19` (\"smithable: Add page orders for Order\") added the `orders` page at `/orders`. It lets you list, view, create, edit and delete orders (number, customer, total). The same change put the page in the main menu after Customers, and generated the routes, form and table. The Order",
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
      "ms": 13972,
      "tokens": 108164,
      "costUsd": 0.11363100000000001,
      "turns": 5,
      "smithableCalls": 2,
      "fileTools": 0,
      "finalMessage": "Only admins can delete customers now. Smithable set `model:Customer.delete` to the `admin` role, regenerated the two affected files and saved the change as checkpoint `402431d`.\n\n- **Database:** no schema change was needed, since this is only an access rule. Existing customers and orders are untouched.\n- **Forms and tables:** the customers page is generated from the spec, so the delete action now ",
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
      "ms": 13775,
      "tokens": 108266,
      "costUsd": 0.11513520000000001,
      "turns": 5,
      "smithableCalls": 2,
      "fileTools": 0,
      "finalMessage": "The customers page now has a search box that filters the list by customer name, and the project type-checks with no errors.\n\nI made the change with Smithable's `setSearch` operation, which regenerated the list page (one file changed). It needed no database migration, and no custom code was affected. It's saved as checkpoint `1390845`, and `smithable undo` reverts it.",
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
      "ms": 15890,
      "tokens": 152304,
      "costUsd": 0.12782860000000001,
      "turns": 7,
      "smithableCalls": 2,
      "fileTools": 0,
      "finalMessage": "Orders now comes first in the main menu, followed by Customers. I made the change through Smithable, which regenerated the app. Two files changed and it saved a checkpoint.\n\nNothing else needed updating: this change doesn't affect the database, forms, tables or any custom code. `tsc --noEmit` type-checks cleanly.\n\nTo go back to the old order, run `smithable undo`.",
      "files": 3,
      "lines": 14,
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
