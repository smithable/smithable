import { expect, test } from "vitest";
import { validateContent } from "./content.js";
import { validateSpec } from "./spec.js";

const spec = (app: Record<string, string>) =>
  validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1\napp: ${JSON.stringify(app)}\nmodels:\n  Task:\n    fields:\n      title: string!\n`,
  });
const codes = (r: { diagnostics: { code: string; severity: string }[] }) =>
  r.diagnostics.filter((d) => d.severity === "error").map((d) => d.code);
const char = (code: number) => String.fromCharCode(code);

test("a name, a label or a title is one line; a description may run over several", () => {
  expect(codes(spec({ name: "Tasks\nglobalThis.x = 1; //" }))).toContain("text-line-break");
  expect(codes(spec({ name: "Tasks", description: "What it is.\nAnd for whom." }))).toEqual([]);

  const ir = spec({ name: "Tasks" }).ir;
  if (!ir) throw new Error("the spec is valid");
  const content = (text: string) =>
    validateContent({ path: "smithable.content.yml", text: `smithableContent: 0.1\n${text}` }, ir);
  expect(
    codes(content(`models:\n  Task:\n    pluralLabel: ${JSON.stringify("Tasks\nx")}\n`)),
  ).toContain("text-line-break");
  expect(codes(content("models:\n  Task:\n    pluralLabel: Tasks */ x /*\n"))).toEqual([]);
});

test("the rare line breaks, control characters and bidirectional overrides are refused anywhere", () => {
  for (const code of [0x2028, 0x2029, 0x85, 0x1b, 0x202e, 0x2066])
    expect(
      codes(spec({ name: "Tasks", description: `a${char(code)}b` })),
      code.toString(16),
    ).toContain("text-control-character");
  expect(codes(spec({ name: "Tasks", description: "a\tb" }))).toEqual([]);
});
