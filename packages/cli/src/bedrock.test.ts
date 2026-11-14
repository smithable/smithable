import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import { bedrock } from "./bedrock.js";

const sent = vi.hoisted(() => [] as { inferenceConfig: { maxTokens: number } }[]);
const truncated = vi.hoisted(() => ({ value: false }));
vi.mock("node:child_process", () => ({
  spawn: (_command: string, args: string[]) => {
    const file = args[args.indexOf("--cli-input-json") + 1]?.replace(/^file:\/\//, "");
    if (!file) throw new Error("Missing request file");
    sent.push(JSON.parse(readFileSync(file, "utf8")));
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
    });
    queueMicrotask(() => {
      child.stdout.emit(
        "data",
        JSON.stringify({
          stopReason: truncated.value ? "max_tokens" : "tool_use",
          output: { message: { content: [{ toolUse: { input: {} } }] } },
          usage: { inputTokens: 1, outputTokens: 1 },
        }),
      );
      child.emit("close", 0);
    });
    return child;
  },
}));

test("Bedrock keeps the default allowance and forwards a larger draft allowance", async () => {
  const provider = bedrock("eu.anthropic.claude-haiku-5-5-v1:0", "eu-north-1");
  const request = { system: "Return JSON", user: "A draft", schema: {} };
  await provider.complete(request);
  await provider.complete({ ...request, maxOutputTokens: 32000 });
  expect(sent.map((request) => request.inferenceConfig.maxTokens)).toEqual([16000, 32000]);
});

test("Bedrock reports cut-off output with its usage instead of accepting a partial tool answer", async () => {
  truncated.value = true;
  try {
    await expect(
      bedrock("eu.anthropic.claude-haiku-5-5-v1:0", "eu-north-1").complete({
        system: "s",
        user: "u",
        schema: {},
      }),
    ).rejects.toMatchObject({
      message: "The model's answer was cut off.",
      completion: { inputTokens: 1, outputTokens: 1 },
    });
  } finally {
    truncated.value = false;
  }
});
