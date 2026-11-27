import { expect, test } from "vitest";
import { operationsOf } from "./answer-operations.js";

test("a model's operations are read as a list or a JSON string of one, and nothing else is guessed (T1718)", () => {
  const step = { op: "setApp", args: { name: "Tasks" } };
  expect(operationsOf({ operations: [step] })).toEqual({ operations: [step] });
  expect(operationsOf({ operations: JSON.stringify([step]) })).toEqual({ operations: [step] });
  expect(operationsOf({ operations: [] })).toEqual({ operations: [] });
  // An entry that is not an object never reaches an operation.
  expect(operationsOf({ operations: [null, "setApp", [step], step] })).toEqual({
    operations: [step],
  });
  // The rest is named by its shape: keys and types, never the content.
  expect(operationsOf({ result: { operations: [step] }, note: "secret words" })).toEqual({
    problem: "no operations key; keys: result, note",
  });
  expect(operationsOf({})).toEqual({ problem: "no operations key; keys: none" });
  expect(operationsOf({ operations: "setApp Tasks" })).toEqual({
    problem: "operations was a string that is not JSON",
  });
  expect(operationsOf({ operations: JSON.stringify({ step }) })).toEqual({
    problem: "operations was a string holding an object",
  });
  expect(operationsOf({ operations: { 0: step } })).toEqual({
    problem: "operations was an object, not a list",
  });
  expect(operationsOf({ operations: null })).toEqual({
    problem: "operations was null, not a list",
  });
  expect(operationsOf([step])).toEqual({ problem: "the answer was a list, not an object" });
  expect(operationsOf("text")).toEqual({ problem: "the answer was a string, not an object" });
});
