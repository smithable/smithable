import { expect, test } from "vitest";
import reference from "../../../docs/spec/v0.1.md?raw";
import { OPERATIONS } from "./apply.js";

// Every operation is named in the spec reference, in the section it changes (docs review
// 2026-11-11, 3.2): a new operation comes with its sentence there.
test("the spec reference names every operation", () => {
  const unnamed = OPERATIONS.map((o) => o.name).filter(
    (name) => !new RegExp(`\\b${name}\\b`).test(reference),
  );
  expect(unnamed).toEqual([]);
});
