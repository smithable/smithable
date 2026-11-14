import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { aiProviders, proposalOutcome, speechProviders, usageLine } from "./ask.js";
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
  // An inference profile's prefix decides, whatever the region the calls start from.
  expect(
    aiDestinations({
      SMITHABLE_FRONTIER: "bedrock",
      SMITHABLE_FRONTIER_MODEL: "global.anthropic.claude-sonnet-5-5",
      AWS_REGION: "eu-north-1",
    }),
  ).toEqual(["Anthropic's Claude on Amazon Bedrock, outside the EU"]);
});

test("Smith hears and speaks where the AI policy lets his requests go (smith-speech.md §3)", () => {
  expect(speechProviders({})).toEqual([{ name: "browser" }]);
  expect(speechProviders({ SMITHABLE_AI_POLICY: "eu-only" })).toEqual([
    { name: "browser", onDeviceOnly: true },
  ]);
  expect(speechProviders({ SMITHABLE_AI_POLICY: "local-only" })).toEqual([]);
  expect(speechProviders({ SMITHABLE_AI_POLICY: "allow:anthropic" })).toEqual([]);
  expect(
    speechProviders({
      SMITHABLE_AI_POLICY: "eu-only",
      SMITHABLE_SPEECH_SERVICE: "/_smithable/speech",
    }),
  ).toEqual([{ name: "browser", onDeviceOnly: true }, { name: "service" }]);
});

test("a replay answers from the recording only, and a fixture keeps what it read from it", async () => {
  const fixture = tempDir("replay-fixture-");
  const recording = tempDir("replay-recording-");
  const env = {
    SMITHABLE_FRONTIER: "anthropic",
    SMITHABLE_FRONTIER_MODEL: "claude-haiku-5-5",
    ANTHROPIC_API_KEY: "replay-asks-no-model",
    SMITHABLE_LLM_CACHE: fixture,
    SMITHABLE_LLM_REPLAY: "1",
    SMITHABLE_LLM_CACHE_FROM: recording,
  };
  const request = { system: "s", user: "u", schema: { type: "object" } };
  const [model] = aiProviders(env);
  if (!model) throw new Error("No provider made from the replay environment");
  // Not recorded: the model is not asked.
  await expect(model.complete(request)).rejects.toThrow("Not in the recording");
  // Record the request's answer under its key by a fresh cache pointed at the recording.
  const key = await crypto.subtle
    .digest(
      "SHA-256",
      new TextEncoder().encode(
        JSON.stringify(["anthropic", "claude-haiku-5-5", "s", "u", { type: "object" }, null]),
      ),
    )
    .then((d) => [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join(""));
  mkdirSync(join(recording, key.slice(0, 2)), { recursive: true });
  writeFileSync(
    join(recording, key.slice(0, 2), `${key}.json`),
    JSON.stringify({ text: "{}", model: "claude-haiku-5-5", inputTokens: 1, outputTokens: 1 }),
  );
  expect(await model.complete(request)).toMatchObject({ text: "{}", cached: true });
  expect(existsSync(join(fixture, key.slice(0, 2), `${key}.json`))).toBe(true);
});
