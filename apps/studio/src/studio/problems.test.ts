import { expect, test } from "vitest";
import { problemRange } from "./problems";

test("a problem is marked from its column to the end of its line", () => {
  const text = "models:\n  Customer:\n    fields:\n      notes: txt\n";
  const at = (line: number, column: number) =>
    problemRange(text, { line, column, severity: "error", message: "" });
  const { from, to } = at(4, 14);
  expect(text.slice(from, to)).toBe("txt");
  // A column past the line, or a line past the text, still marks a place that exists.
  expect(at(4, 99)).toEqual({ from: to, to });
  expect(at(99, 1).from).toBeLessThanOrEqual(text.length);
  expect(at(0, 0)).toEqual({ from: 0, to: "models:".length });
});
