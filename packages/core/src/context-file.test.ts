import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateContext } from "./context-file.js";

const check = (text: string) =>
  validateContext({ path: "smithable.context.yml", text }).map((d) => [d.line, d.message]);

test("smithable.context.yml is checked against its schema, each problem on its key", () => {
  expect(
    check("smithableContext: 0.1\nplugins: [newsletter]\npackages: { chart.js: 4.4.1 }\n"),
  ).toEqual([]);
  expect(check("smithableContext: 0.1\nplugins: newsletter\nstack: next\n")).toEqual([
    [2, 'smithable.context.yml: "plugins" must be a list.'],
    [3, 'smithable.context.yml: Unknown key "stack".'],
  ]);
  expect(check("adapter: tanstack\n")).toEqual([
    [1, 'smithable.context.yml: "smithableContext" is missing.'],
  ]);
});

test("an operation cannot leave smithable.context.yml invalid", () => {
  const spec = Object.values(
    import.meta.glob("../../../examples/crm/smithable.yml", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  )[0] as string;
  const context = "smithableContext: 0.1\nstack: next\n";
  const result = applyOperation({ spec, context }, "setPackage", {
    name: "dayjs",
    version: "1.11.13",
  });
  expect(result).toMatchObject({
    ok: false,
    message: "setPackage would make smithable.context.yml invalid.",
  });
});
