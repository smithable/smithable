import { expect, test } from "vitest";
import type { TraceEntry } from "./api";
import { receipt, usageReceipt } from "./receipt";

const entry = (over: Partial<TraceEntry>): TraceEntry =>
  ({
    id: "a",
    description: "",
    at: "",
    engine: "generator",
    tokens: 0,
    undone: false,
    isUndo: false,
    files: [],
    rewritten: [],
    snapshot: false,
    ...over,
  }) as TraceEntry;

test("a change by rule costs nothing", () => {
  expect(receipt([entry({})])).toBe("Done by rule, no AI, cost 0");
  expect(receipt([entry({ isUndo: true })])).toBe("Undone by rule, no AI, cost 0");
});

test("a request's changes name the model and sum the cost", () => {
  const first = entry({
    engine: "frontier model",
    model: "claude-opus-5-5",
    cost: 0.0123,
    currency: "USD",
  });
  const rest = entry({
    engine: "frontier model",
    model: "claude-opus-5-5",
    cost: 0,
    currency: "USD",
  });
  expect(receipt([first, rest])).toBe("Done by claude-opus-5-5, cost $0.0123");
  expect(
    receipt([entry({ engine: "Smithable model", model: "small", cost: 0.5, currency: "EUR" })]),
  ).toBe("Done by small, cost €0.50");
  expect(
    receipt([entry({ engine: "local model", model: "llama", cost: 0, currency: "EUR" })]),
  ).toBe("Done by llama, cost 0");
});

test("the receipt of a request reads the engine's usage line", () => {
  const line = "Frontier model (claude-opus-5-5) · 1,200 tokens (1,000 in, 200 out) · €0.0042";
  expect(usageReceipt(line, "done")).toBe("Done by claude-opus-5-5, cost €0.0042");
  expect(usageReceipt(line, "proposed")).toBe("Proposed by claude-opus-5-5, cost €0.0042");
  expect(usageReceipt(line, "nothing")).toBe(
    "Nothing changed; claude-opus-5-5 was asked, cost €0.0042",
  );
  expect(usageReceipt("Generator (wording rules) · 0 tokens", "done")).toBe(
    "Done by rule, no AI, cost 0",
  );
  expect(usageReceipt("No model was used", "nothing")).toBe("Nothing changed, cost 0");
  expect(usageReceipt("", "nothing")).toBe("Nothing changed, cost 0");
});
