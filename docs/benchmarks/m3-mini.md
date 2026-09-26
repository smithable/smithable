# M3 mini-benchmark (2026-09-26)

The same tasks on identical copies of the generated CRM (with sample data), done by Smithable operations and by Claude Code in headless mode (default model, file edits allowed, shell limited to pnpm, npx and node). Both results are checked the same way; the production server applies migrations at startup before the database is inspected.

Claude Code was given the task plus: "Keep the app working: update whatever is needed (database, forms, tables) and make sure it type-checks."

| Task | Done by | Tokens | Cost (API-equivalent) | Time | Files / lines changed | Type-checks and builds | Database changed | Existing rows kept | Visible in the app | Spec updated | Regenerates cleanly |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Add a website field to customers | Smithable op | 0 | $0.00 | 1.8 s | 5 / 21 | yes | yes | yes | yes | yes | yes |
| Add a website field to customers | Claude Code | 743,933 | $0.58 | 71.1 s | 5 / 23 | yes | yes | yes | yes | yes | **no** |
| Make the customer email required | Smithable op | 0 | $0.00 | 1.6 s | 4 / 26 | yes | yes | yes | yes | yes | yes |
| Make the customer email required | Claude Code | 761,569 | $0.58 | 70.2 s | 4 / 26 | yes | yes | yes | yes | yes | **no** |
| Add products with a required name and a required price, with a page for them in the menu | Smithable op | 0 | $0.00 | 3.2 s | 9 / 192 | yes | yes | yes | yes | yes | yes |
| Add products with a required name and a required price, with a page for them in the menu | Claude Code | 579,541 | $0.54 | 66.0 s | 9 / 194 | yes | yes | yes | yes | yes | **no** |

Files and lines exclude generated migration snapshots, the route tree and Smithable's records. "Spec updated" means smithable.yml describes the change. "Regenerates cleanly" means the code is exactly what the spec generates; otherwise `smithable generate` finds hand-edited generated files and the next change through Smithable runs into a conflict. (That column was computed after the run on the same result directories, without rerunning Claude Code.)

## What it shows

- **Both succeed.** A strong agent handles these small, well-defined changes correctly: it type-checks, migrates, keeps the data and even updates smithable.yml. The core bet is therefore not "agents fail", but cost, speed and consistency.
- **Cost and speed.** Claude Code used 580,000–760,000 tokens (about $0.55 API-equivalent) and 66–71 seconds per task, mostly re-reading the project. Smithable used no model, no tokens and 2–3 seconds.
- **Consistency.** Claude Code edited the generated files by hand. They work, but they are not what the spec generates, so the project drifts: the next Smithable change or regeneration stops at hand-edited files. Smithable's results are, by construction, exactly what the spec generates.
- **Caveats.** Three tiny tasks on a tiny app. Claude Code did not know about Smithable (no `AGENTS.md` or MCP server yet, M6), which is precisely what M7 will compare: an agent that changes the app through Smithable's operations.

Raw results:

```json
[
  {
    "task": "website",
    "smithable": {
      "ok": true,
      "ms": 1762,
      "tokens": 0,
      "costUsd": 0,
      "filesTouched": 5,
      "linesChanged": 21,
      "typecheck": true,
      "build": true,
      "visible": true,
      "database": true,
      "rowsKept": true,
      "specInSync": true,
      "regeneratesCleanly": true
    },
    "claude": {
      "ok": true,
      "ms": 71106,
      "turns": 25,
      "tokens": 743933,
      "outputTokens": 7246,
      "costUsd": 0.5809317999999997,
      "filesTouched": 5,
      "linesChanged": 23,
      "typecheck": true,
      "build": true,
      "visible": true,
      "database": true,
      "rowsKept": true,
      "specInSync": true,
      "regeneratesCleanly": false
    }
  },
  {
    "task": "email-required",
    "smithable": {
      "ok": true,
      "ms": 1614,
      "tokens": 0,
      "costUsd": 0,
      "filesTouched": 4,
      "linesChanged": 26,
      "typecheck": true,
      "build": true,
      "visible": true,
      "database": true,
      "rowsKept": true,
      "specInSync": true,
      "regeneratesCleanly": true
    },
    "claude": {
      "ok": true,
      "ms": 70150,
      "turns": 25,
      "tokens": 761569,
      "outputTokens": 6336,
      "costUsd": 0.5814404000000001,
      "filesTouched": 4,
      "linesChanged": 26,
      "typecheck": true,
      "build": true,
      "visible": true,
      "database": true,
      "rowsKept": true,
      "specInSync": true,
      "regeneratesCleanly": false
    }
  },
  {
    "task": "products",
    "smithable": {
      "ok": true,
      "ms": 3162,
      "tokens": 0,
      "costUsd": 0,
      "filesTouched": 9,
      "linesChanged": 192,
      "typecheck": true,
      "build": true,
      "visible": true,
      "database": true,
      "rowsKept": true,
      "specInSync": true,
      "regeneratesCleanly": true
    },
    "claude": {
      "ok": true,
      "ms": 65960,
      "turns": 23,
      "tokens": 579541,
      "outputTokens": 6985,
      "costUsd": 0.541732,
      "filesTouched": 9,
      "linesChanged": 194,
      "typecheck": true,
      "build": true,
      "visible": true,
      "database": true,
      "rowsKept": true,
      "specInSync": true,
      "regeneratesCleanly": false
    }
  }
]
```
