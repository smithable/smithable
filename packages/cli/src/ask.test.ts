import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { proposalOutcome, usageLine } from "./ask.js";
import { tempDir } from "./test-dir.js";

test("a change a wording rule read says so, not that no model was used", () => {
  expect(usageLine([], "required-field")).toBe("Generator (required-field) · 0 tokens");
  expect(usageLine([])).toBe("No model was used");
});

test("what a request used: tokens in and out, the cost, and the calls the cache answered", () => {
  const call = {
    provider: "smithable",
    model: "m",
    tier: "smithable" as const,
    currency: "USD" as const,
  };
  expect(
    usageLine([
      { ...call, inputTokens: 1000, outputTokens: 200, cost: 0.003 },
      { ...call, inputTokens: 0, outputTokens: 0, cost: 0, cached: true },
    ]),
  ).toBe(
    "Smithable model (m) · 1,200 tokens (1,000 in, 200 out) · $0.0030 · 1 of 2 calls from the cache",
  );
});

test("a proposal's outcome is logged under its id, for training data", () => {
  const dir = tempDir("smithable-ask-");
  proposalOutcome(dir, "p1", "declined");
  const log = readFileSync(join(dir, "data/.smithable/token-log.jsonl"), "utf8");
  expect(JSON.parse(log.trim())).toMatchObject({
    source: "ask-outcome",
    id: "p1",
    outcome: "declined",
  });
});

test("Smith's AI notice names where the policy's models run, and nothing without a model (legal-1.0 U6)", async () => {
  const { aiDestinations } = await import("./ask.js");
  expect(aiDestinations({})).toEqual([]);
  expect(
    aiDestinations({
      SMITHABLE_MODEL: "mistral-medium-latest",
      SMITHABLE_MODEL_URL: "https://api.mistral.ai/v1",
      SMITHABLE_FRONTIER: "bedrock",
      SMITHABLE_FRONTIER_MODEL: "eu.anthropic.claude-sonnet-5-5",
    }),
  ).toEqual(["the Smithable model, in the EU", "Anthropic's Claude on Amazon Bedrock, in the EU"]);
  expect(
    aiDestinations({
      SMITHABLE_MODEL: "m",
      SMITHABLE_MODEL_URL: "https://x",
      SMITHABLE_AI_POLICY: "local-only",
    }),
  ).toEqual([]);
});
