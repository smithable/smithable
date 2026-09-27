import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Provider } from "@smithable/ai";

/**
 * A frontier model through the user's own Claude Code (ARCHITECTURE §9.5): `claude -p`
 * headless, with no tools, no MCP servers and an empty working directory, so it only answers.
 * Smithable never reads or copies its credentials. Outside the EU: only a policy that allows
 * it (best-available, or an allowlist naming "claude-code") uses it.
 */
export function claudeCode(model?: string): Provider {
  return {
    name: "claude-code",
    tier: "frontier",
    location: "elsewhere",
    price: { input: 0, output: 0 },
    async complete({ system, user, schema }) {
      const dir = mkdtempSync(join(tmpdir(), "smithable-claude-"));
      try {
        const args = [
          "-p",
          user,
          "--system-prompt",
          system,
          "--json-schema",
          JSON.stringify(schema),
          "--output-format",
          "json",
          "--tools",
          "",
          "--strict-mcp-config",
          "--no-session-persistence",
          ...(model ? ["--model", model] : []),
        ];
        const out = await new Promise<string>((resolve, reject) => {
          const child = spawn("claude", args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
          let stdout = "";
          let stderr = "";
          child.stdout.on("data", (d) => (stdout += d));
          child.stderr.on("data", (d) => (stderr += d));
          child.on("error", reject);
          child.on("close", (code) =>
            code === 0
              ? resolve(stdout)
              : reject(new Error(`claude exited with ${code}: ${stderr || stdout}`)),
          );
        });
        const result = JSON.parse(out) as {
          result?: string;
          structured_output?: unknown;
          total_cost_usd?: number;
          usage?: Record<string, number>;
          modelUsage?: Record<string, unknown>;
        };
        const u = result.usage ?? {};
        return {
          text:
            result.structured_output !== undefined
              ? JSON.stringify(result.structured_output)
              : (result.result ?? ""),
          model: Object.keys(result.modelUsage ?? {})[0] ?? model ?? "claude",
          inputTokens:
            (u.input_tokens ?? 0) +
            (u.cache_creation_input_tokens ?? 0) +
            (u.cache_read_input_tokens ?? 0),
          outputTokens: u.output_tokens ?? 0,
          cost: { amount: result.total_cost_usd ?? 0, currency: "USD" },
        };
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}
