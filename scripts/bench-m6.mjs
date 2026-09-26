// M6 exit check: Claude Code with the Smithable MCP server registered completes "Customers
// should have a website" through smithable_add_field, without opening source files. Records
// every tool call and the token use. Uses the user's Claude usage: ask before running.
// Run after `pnpm build`: `node scripts/bench-m6.mjs`. Writes docs/benchmarks/m6-mcp.md.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const root = mkdtempSync(join(tmpdir(), "smithable-bench-m6-"));
const dir = join(root, "crm");
const PROMPT = "Customers should have a website.";

const sh = (command, args, cwd) =>
  spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 1 << 26 });

if (sh("node", [cli, "new", dir, "--starter", "crm"], repo).status !== 0)
  throw new Error("smithable new failed");
const config = join(root, "mcp.json");
writeFileSync(
  config,
  JSON.stringify({
    mcpServers: { smithable: { command: "node", args: [cli, "mcp", "--dir", dir] } },
  }),
);

const started = Date.now();
const run = sh(
  "claude",
  [
    "-p",
    PROMPT,
    "--output-format",
    "stream-json",
    "--verbose",
    "--no-session-persistence",
    "--mcp-config",
    config,
    "--strict-mcp-config",
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    "mcp__smithable",
  ],
  dir,
);
const events = run.stdout
  .split("\n")
  .filter(Boolean)
  .flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
const calls = events.flatMap((e) =>
  e.type === "assistant"
    ? (e.message?.content ?? [])
        .filter((c) => c.type === "tool_use")
        .map((c) => ({ name: c.name, input: c.input }))
    : [],
);
const result = events.find((e) => e.type === "result") ?? {};
const u = result.usage ?? {};
const tokens =
  (u.input_tokens ?? 0) +
  (u.output_tokens ?? 0) +
  (u.cache_creation_input_tokens ?? 0) +
  (u.cache_read_input_tokens ?? 0);

const spec = readFileSync(join(dir, "smithable.yml"), "utf8");
const viaOperation = calls.some((c) => c.name === "mcp__smithable__smithable_add_field");
const openedFiles = calls.filter((c) => !c.name.startsWith("mcp__smithable__"));
const typechecks = sh("pnpm", ["typecheck"], dir).status === 0;
const added = /\n {6}website: url\b/.test(spec);
const ok = viaOperation && added && openedFiles.length === 0 && typechecks;
let tokenLog = [];
try {
  tokenLog = readFileSync(join(dir, "data/.smithable/token-log.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
} catch {
  // No Smithable tool was called.
}
const mcpTokens = tokenLog.reduce(
  (sum, e) => sum + (e.tokens?.input ?? 0) + (e.tokens?.output ?? 0),
  0,
);

const report = `# M6: Claude Code through the Smithable MCP server

Prompt: "${PROMPT}" on a new CRM, with only the Smithable MCP server registered (\`--strict-mcp-config\`) and its tools allowed. Claude Code ${sh("claude", ["--version"], repo).stdout.trim()}, default model, ${new Date().toISOString().slice(0, 10)}.

| | |
|---|---|
| Result | ${ok ? "**Passed**" : "**Failed**"} |
| Field added to smithable.yml through \`smithable_add_field\` | ${added && viaOperation ? "yes" : "no"} |
| Other tools used (file reads, edits, shell) | ${openedFiles.length ? openedFiles.map((c) => c.name).join(", ") : "none"} |
| App type-checks afterwards | ${typechecks ? "yes" : "no"} |
| Tool calls | ${calls.map((c) => `\`${c.name.replace("mcp__smithable__", "")}\``).join(" → ")} |
| Turns | ${result.num_turns ?? "?"} |
| Time | ${((result.duration_ms ?? Date.now() - started) / 1000).toFixed(0)} s |
| Tokens (Claude, including cache reads) | ${tokens.toLocaleString("en")} (${(u.output_tokens ?? 0).toLocaleString("en")} output) |
| Cost | $${(result.total_cost_usd ?? 0).toFixed(2)} |
| Of which Smithable tool results and arguments (estimated) | ${mcpTokens.toLocaleString("en")} |

For comparison, the same task without MCP (Claude Code editing the repository) is in [m3-mini.md](m3-mini.md).
`;
writeFileSync(join(repo, "docs/benchmarks/m6-mcp.md"), report);
console.log(report);
if (ok) rmSync(root, { recursive: true, force: true });
else console.log(`Kept for inspection: ${root}`);
process.exit(ok ? 0 : 1);
