import { describe, expect, test } from "vitest";
import { validateSpec } from "./spec.js";

const valid = {
  ...import.meta.glob("./__fixtures__/valid/*.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  ...import.meta.glob("../../../examples/*/smithable.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
};
const invalid = import.meta.glob("./__fixtures__/invalid/*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("valid specs", () => {
  test.each(Object.entries(valid))("%s", (path, text) => {
    const result = validateSpec({ path, text });
    expect(result.diagnostics).toEqual([]);
    expect(result.ir).toMatchSnapshot();
  });
});

describe("invalid specs report each error on the line marked '# expect: <code>'", () => {
  test.each(Object.entries(invalid))("%s", (path, text) => {
    const result = validateSpec({ path, text });
    expect(result.ir).toBeUndefined();
    const actual = result.diagnostics.map((d) => `line ${d.line}: ${d.code}`).sort();
    expect(actual).toEqual(expectedDiagnostics(text));
  });
});

test("diagnostics carry a message, a column and the file path", () => {
  const [diagnostic] = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp:\n  name: X\nmodels:\n  Customer:\n    fields:\n      name: strng\n",
  }).diagnostics;
  expect(diagnostic).toEqual({
    severity: "error",
    code: "unknown-type",
    message: 'Field "Customer.name": Unknown field type "strng".',
    hint: 'Did you mean "string"?',
    file: "smithable.yml",
    line: 7,
    column: 13,
  });
});

test("navigation defaults to every page in declaration order", () => {
  const { ir } = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: X }\nmodels:\n  A: { fields: { n: string } }\npages:\n  b: { crud: A }\n  a: { crud: A }\n",
  });
  expect(ir?.navigation).toEqual([{ name: "main", pages: ["b", "a"] }]);
  expect(ir?.pages.map((p) => p.route)).toEqual(["/b", "/a"]);
});

function expectedDiagnostics(text: string): string[] {
  return text
    .split("\n")
    .flatMap((line, i) => {
      const codes = /# expect: (.+)$/.exec(line)?.[1];
      return codes ? codes.split(",").map((code) => `line ${i + 1}: ${code.trim()}`) : [];
    })
    .sort();
}
