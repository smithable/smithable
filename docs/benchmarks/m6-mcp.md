# M6: Claude Code through the Smithable MCP server

Prompt: "Customers should have a website." on a new CRM, with only the Smithable MCP server registered (`--strict-mcp-config`) and its tools allowed. Claude Code 2.1.283 (Claude Code), default model, 2026-09-26.

| | |
|---|---|
| Result | **Passed** |
| Field added to smithable.yml through `smithable_add_field` | yes |
| Other tools used (file reads, edits, shell) | none |
| App type-checks afterwards | yes |
| Tool calls | `ToolSearch` → `smithable_context` → `smithable_add_field` |
| Turns | 4 |
| Time | 9 s |
| Tokens (Claude, including cache reads) | 84,653 (448 output) |
| Cost | $0.12 |
| Of which Smithable tool results and arguments (estimated) | 595 |

For comparison, the same task without MCP (Claude Code editing the repository) is in [m3-mini.md](m3-mini.md).

Without MCP, Claude Code needed 743,933 tokens, $0.58 and 71 s for the same field, and left the generated files drifted from the spec. Through MCP: about 85,000 tokens (mostly Claude Code's own system prompt, read from cache), $0.12 and 9 s, and the change is an ordinary, undoable Smithable operation.

## All runs

| Run | Server instructions | Tool calls after `smithable_add_field` | Result | Tokens | Cost |
|---|---|---|---|---|---|
| 1 | Original | `Bash`, `Read` (checking the result) | Failed | 129,913 | $0.14 |
| 2 | Original | none | Passed | 84,653 | $0.12 |
| 3 | + "do not verify; run smithable_test only if custom code uses what changed" | `Bash`, `Read` of the custom action | Failed | 130,303 | $0.14 |
| 4 | same | `Bash`, `Read` of the custom action | Failed | 130,329 | $0.14 |
| 5 | same | none | Passed | 84,965 | $0.12 |
| 6 | Operation results say whether custom code is affected | none | Passed | 84,841 | $0.12 |
| 7 | same | none | Passed | 84,931 | $0.12 |
| 8 | same | none | Passed | 84,881 | $0.12 |

Telling the agent to check custom code "only if" it used the change made it go and look. What works is answering the question in the tool result: renaming, removing or changing a field names the custom files that use it; other operations say that no custom code is affected. The table above the list is from run 2; runs 6 to 8 are the current behaviour.
