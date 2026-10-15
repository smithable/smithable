import { spawn } from "node:child_process";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Provider } from "@smithable/ai";

/**
 * Prices per million tokens of Claude through Amazon Bedrock's EU inference profiles (eu-north-1,
 * AWS Price List, 2026-10-04; Haiku 5.5 from Anthropic's list price plus the EU profiles' tenth,
 * 2026-10-16, for prompts under 100k tokens, which every call of ours is), in dollars: input,
 * output, a cache write, a cache read.
 */
const PRICES: [RegExp, { input: number; output: number; write: number; read: number }][] = [
  [/claude-haiku-5-5/, { input: 0.11, output: 0.55, write: 0.1375, read: 0.011 }],
  [/claude-sonnet-5-5/, { input: 2.2, output: 11, write: 2.75, read: 0.22 }],
  [/claude-sonnet-4-6/, { input: 3.3, output: 16.5, write: 4.125, read: 0.33 }],
  [/claude-haiku-4-5/, { input: 1.1, output: 5.5, write: 1.375, read: 0.11 }],
];

/**
 * Claude through Amazon Bedrock (SMITHABLE_FRONTIER=bedrock, SMITHABLE_FRONTIER_MODEL=<inference
 * profile id>, AWS_REGION or SMITHABLE_BEDROCK_REGION), with the `aws` command already signed in:
 * no key in any file. The answer's schema is the one tool the model must call, so the output is
 * structured; the system text is marked for prompt caching, since it is the same in every call.
 * An `eu.` profile keeps the request in the EU.
 */
export function bedrock(model: string, region: string, usageLog?: string): Provider {
  const price = PRICES.find(([name]) => name.test(model))?.[1];
  return {
    name: "bedrock",
    tier: "frontier",
    location: model.startsWith("eu.") ? "eu" : "elsewhere",
    model,
    price: price ? { input: price.input, output: price.output } : { input: 0, output: 0 },
    currency: "USD",
    async complete({ system, user, schema }) {
      const dir = mkdtempSync(join(tmpdir(), "smithable-bedrock-"));
      try {
        const input = join(dir, "input.json");
        writeFileSync(
          input,
          JSON.stringify({
            modelId: model,
            system: [{ text: system }, { cachePoint: { type: "default" } }],
            messages: [{ role: "user", content: [{ text: user }] }],
            toolConfig: {
              tools: [
                {
                  toolSpec: {
                    name: "answer",
                    description: "The answer.",
                    inputSchema: { json: schema },
                  },
                },
              ],
              toolChoice: { tool: { name: "answer" } },
            },
            inferenceConfig: { maxTokens: 16000, temperature: 0 },
          }),
        );
        const out = await new Promise<string>((resolve, reject) => {
          const child = spawn(
            "aws",
            [
              "bedrock-runtime",
              "converse",
              "--region",
              region,
              "--cli-input-json",
              `file://${input}`,
              "--output",
              "json",
            ],
            { stdio: ["ignore", "pipe", "pipe"] },
          );
          let stdout = "";
          let stderr = "";
          child.stdout.on("data", (d) => (stdout += d));
          child.stderr.on("data", (d) => (stderr += d));
          child.on("error", reject);
          child.on("close", (code) =>
            code === 0
              ? resolve(stdout)
              : reject(new Error(`aws exited with ${code}: ${stderr || stdout}`)),
          );
        });
        const result = JSON.parse(out) as {
          output?: { message?: { content?: { toolUse?: { input?: unknown }; text?: string }[] } };
          usage?: {
            inputTokens?: number;
            outputTokens?: number;
            cacheReadInputTokens?: number;
            cacheWriteInputTokens?: number;
          };
        };
        const content = result.output?.message?.content ?? [];
        const answer = content.find((c) => c.toolUse)?.toolUse?.input;
        const u = result.usage ?? {};
        const fresh = u.inputTokens ?? 0;
        const read = u.cacheReadInputTokens ?? 0;
        const write = u.cacheWriteInputTokens ?? 0;
        const output = u.outputTokens ?? 0;
        // The bench's record of each call's tokens by kind (SMITHABLE_USAGE_LOG=<file>).
        if (usageLog)
          appendFileSync(usageLog, `${JSON.stringify({ model, fresh, read, write, output })}\n`);
        return {
          text:
            answer !== undefined
              ? JSON.stringify(answer)
              : content.map((c) => c.text ?? "").join(""),
          model,
          inputTokens: fresh + read + write,
          outputTokens: output,
          ...(price
            ? {
                cost: {
                  amount:
                    (fresh * price.input +
                      write * price.write +
                      read * price.read +
                      output * price.output) /
                    1_000_000,
                  currency: "USD" as const,
                },
              }
            : {}),
        };
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}
