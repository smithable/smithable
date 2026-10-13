# M7 report: benchmark results and product decisions (2026-09-27)

Measurements: [m7.md](m7.md) (seven tasks, in order, on a CRM with customers only). The prompt-to-code builder setup ([protocol](m7-prompt-to-code.md)) has not been run yet.

## Results

| | Tasks done | Tokens | Cost | Time | Left the code out of step with the spec |
|---|---|---|---|---|---|
| Smithable operations, no model (S) | 6 / 7 | 0 | $0.00 | 11 s | 0 tasks |
| Claude Code, plain (A) | 7 / 7 | 3.58 M | $3.15 | 7.4 min | 7 tasks |
| Claude Code + Smithable MCP (B) | 6 / 7 | 1.77 M | $1.53 | 4.0 min | 2 tasks |

No setup caused a regression: every earlier task still worked after every later one.

## What it shows

1. **Where an operation fits, MCP makes the agent 3–7× cheaper and faster, and keeps the project clean.** On the five tasks an operation covers, B used 85k–207k tokens ($0.10–0.17, 11–29 s) against A's 351k–1.43M ($0.35–1.07, 40–171 s). Adding orders, the largest change, cost A $1.07 and 171 s over 49 turns; B needed 9 turns, $0.17 and 29 s, with zero file reads.
2. **A strong agent gets every task right, but the project drifts.** Plain Claude Code completed all seven tasks with correct results, and even updated smithable.yml, but its code was never what the spec generates. The next Smithable change runs into hand-edited files. Its own summary said: "I couldn't find the Smithable tool in this project, so I wrote the generated files by hand."
3. **One uncovered task costs more with MCP, and blocks later operations.** Search has no operation. B tried the tools, then edited the generated customers route by hand ($0.58, 29 turns, more than A's $0.40). The next task, reordering the menu, then failed: regeneration refused to overwrite the hand-edited route. B stopped and explained why, which is correct but unhelpful. **The missing piece is not search itself but a supported place for custom page code**, so an agent (or a developer) can go beyond the spec without touching generated files.
4. **Smithable alone (no model) does six of seven tasks in 2 seconds each**, at no cost. The gap is the same: search.

## Product decisions

1. **Next: escape hatches before new surfaces (new milestone M7.5).** Before the browser engine and the Builder, generated apps get:
   - **Custom page components:** `src/custom/pages/<page>.tsx`, created on request by an operation (`customizePage`), replaces the generated page component while the generated route keeps its loader, access checks and data functions. Regeneration never touches it; the contract (loader data types) is generated, so spec changes surface as type errors, as with custom actions.
   - **Moving drift into custom code:** when a generated file was edited by hand, `smithable generate` offers to move the edit into the matching custom file, instead of only refusing (ARCHITECTURE §6.5 promised this; it is not built yet).
   - **The MCP server tells agents** that when no operation fits, the change goes in `src/custom/` through `customizePage` or a custom action, never in generated files.
2. **Search on list pages becomes part of the spec** (page `search: [name, email]`, through the five questions of ARCHITECTURE §2.4). It is common in business apps and was the one task Smithable could not do.
3. **The change trace's comparison estimate uses these numbers** (ARCHITECTURE §9.7): a conventional agent editing the repository used about 350k–1.4M tokens (median about 400k) and $0.35–1.07 per task on this app, against 0 for a deterministic operation and about 110k tokens ($0.13) for an agent calling operations.
4. **Interviews move to M9**, as usability tests with the Builder, where people try Smithable on their own idea. Until then, the desk research stands in; its findings update VISION.md when it arrives.

## After M7.5 (2026-09-27)

With search in the spec (`setSearch`), custom pages and the MCP guidance to use them, the same seven tasks ([m7-SB.md](m7-SB.md)):

| | Tasks done | Tokens | Cost | Time | Left drift |
|---|---|---|---|---|---|
| Smithable operations, no model | **7 / 7** | 0 | $0.00 | 12 s | 0 |
| Claude Code + MCP | **7 / 7** | 0.95 M | **$0.92** | 2.0 min | **0** |
| Claude Code, plain (M7 run) | 7 / 7 | 3.58 M | $3.15 | 7.4 min | 7 |

Every task took Claude Code 5–9 turns, two or three Smithable calls and no file reads; search cost $0.12 instead of $0.58, and the menu reorder after it works. Against plain Claude Code: 3.4× cheaper, 3.6× faster, and the project stays exactly what the spec generates.

## Caveats

One run per setup, on a small app, with one agent (Claude Code, default model). Each task was a fresh session; a long-running session would reuse context and cost less. The token counts include Claude Code's own system prompt, read from cache, which is most of B's cost. Each setup built on its own previous results, so a failure could carry over to later tasks (it did once, for B).
