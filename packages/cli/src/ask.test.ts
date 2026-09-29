import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { proposalOutcome, usageLine } from "./ask.js";

test("a change a wording rule read says so, not that no model was used", () => {
  expect(usageLine([], "required-field")).toBe("Generator (required-field) · 0 tokens");
  expect(usageLine([])).toBe("No model was used");
});

test("a proposal's outcome is logged under its id, for training data", () => {
  const dir = mkdtempSync(join(tmpdir(), "smithable-ask-"));
  proposalOutcome(dir, "p1", "declined");
  const log = readFileSync(join(dir, "data/.smithable/token-log.jsonl"), "utf8");
  expect(JSON.parse(log.trim())).toMatchObject({
    source: "ask-outcome",
    id: "p1",
    outcome: "declined",
  });
});
