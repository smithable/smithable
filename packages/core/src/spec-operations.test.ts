import { expect, test } from "vitest";
import reference from "../../../docs/spec/v0.1.md?raw";
import { OPERATIONS } from "./apply.js";

// Every operation is named in the spec reference as code, in the section it changes (docs review
// 2026-11-11, 3.2): a new operation comes with its sentence there.
test("the spec reference names every operation", () => {
  // The inline code spans, paired from the start of each line, and the code blocks' lines.
  const code = [
    ...reference.split("\n").flatMap((line) => [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1])),
    ...[...reference.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map((m) => m[1]),
  ].join("\n");
  const unnamed = OPERATIONS.map((o) => o.name).filter(
    (name) => !new RegExp(`\\b${name}\\b`).test(code),
  );
  expect(unnamed).toEqual([]);
});
