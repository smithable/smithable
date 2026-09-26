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

**Runs vary.** An earlier run the same day (129,913 tokens, $0.14, 14 s) also made the change through `smithable_context` → `smithable_add_field`, but then checked the result with one `Bash` and one `Read` call. That run counts as a failure of the "without opening source files" criterion. The server's instructions say agents rarely need to read the source; a later change can say explicitly that the operation's own checks make verification unnecessary.
