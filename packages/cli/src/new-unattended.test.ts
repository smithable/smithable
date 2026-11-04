import type { Assumption, Provider } from "@smithable/ai";
import { expect, test, vi } from "vitest";
import { create } from "./new.js";
import { tempDir } from "./test-dir.js";

const calls = vi.hoisted(() => ({ complete: vi.fn() }));
vi.mock("./ask.js", async (original) => ({
  ...(await original<typeof import("./ask.js")>()),
  providersFor: (): Provider[] => [
    {
      name: "fixture",
      tier: "local",
      location: "local",
      price: { input: 0, output: 0 },
      complete: calls.complete,
    },
  ],
}));

test("unattended create records clarification defaults without stdin and keeps a paid completion over the between-call budget", async () => {
  calls.complete.mockResolvedValue({
    text: JSON.stringify({
      starter: "booking",
      questions: [{ question: "Who manages appointments?", options: ["The team", "Members"] }],
    }),
    model: "fixture",
    inputTokens: 20_001,
    outputTokens: 10,
  });
  const assumptions: Assumption[] = [];
  const output: string[] = [];
  const code = await create(
    tempDir("smithable-unattended-"),
    { out: (text) => output.push(text), err: (text) => output.push(text) },
    "booking",
    {
      describe: "An app based on the observed facts about a service business",
      unattended: true,
      maxTokens: 20_000,
      onAssumptions: (values) => assumptions.push(...values),
    },
  );
  expect(code).toBe(1);
  expect(calls.complete).toHaveBeenCalledTimes(1);
  expect(assumptions).toHaveLength(1);
  expect(assumptions[0]?.question).toBe("Who manages appointments?");
  expect(assumptions[0]?.chosen).toContain("unconfirmed");
  expect(output.join("")).toContain("model token limit");
});
