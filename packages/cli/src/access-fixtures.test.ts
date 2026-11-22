import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { generateApp } from "@smithable/adapter-tanstack";
import { validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";

const spec = `smithable: 0.1
app: { name: Hours }
models:
  ServiceHour:
    unique: [[weekday, service]]
    fields:
      weekday: { type: monday | tuesday, required: true }
      service: { type: lunch | dinner, required: true }
pages:
  hours: { crud: ServiceHour }
`;

function source(text = spec) {
  const parsed = validateSpec({ path: "smithable.yml", text });
  if (!parsed.ir) throw new Error(JSON.stringify(parsed.diagnostics));
  const { auth } = validateAuth(
    { path: "smithable.auth.yml", text: "smithableAuth: 0.1\nsignIn: none\n" },
    parsed.ir,
  );
  if (!auth) throw new Error("Invalid test auth");
  const generated = generateApp(parsed.ir, { smithableVersion: "0.0.0", auth }).find(
    (file) => file.path === "src/generated/access.test.ts",
  );
  if (!generated) throw new Error("Missing generated access tests");
  return generated.content;
}

test("the second and later fixtures use an unused pair of choice values", () => {
  const generated = source();
  expect(generated).toContain(
    'existing, [["weekday", "service"]], { weekday: ["monday", "tuesday"], service: ["lunch", "dinner"] }',
  );
  const start = generated.indexOf("function distinctFixture");
  const end = generated.indexOf("\n}", start);
  expect(end).toBeGreaterThan(start);
  const definition = generated.slice(start, end + 2);
  type Row = { weekday: string; service: string };
  const choose = runInNewContext(`${stripTypeScriptTypes(definition)}\ndistinctFixture;`) as (
    row: Row,
    fixed: Partial<Row>,
    existing: Row[],
    groups: string[][],
    alternatives: Record<string, string[]>,
  ) => Row | undefined;
  const row = { weekday: "monday", service: "lunch" };
  const groups = [["weekday", "service"]];
  const alternatives = { weekday: ["monday", "tuesday"], service: ["lunch", "dinner"] };
  const existing: Row[] = [];
  for (let i = 0; i < 4; i++) {
    const next = choose(row, {}, existing, groups, alternatives);
    if (!next) throw new Error("All four pairs must be available");
    existing.push(next);
  }
  expect(existing).toEqual([
    { weekday: "monday", service: "lunch" },
    { weekday: "monday", service: "dinner" },
    { weekday: "tuesday", service: "lunch" },
    { weekday: "tuesday", service: "dinner" },
  ]);
  expect(choose(row, {}, existing, groups, alternatives)).toBeUndefined();
  expect(
    choose(row, { weekday: "monday" }, existing.slice(0, 2), groups, alternatives),
  ).toBeUndefined();
});

test("access checks use separate fixtures when the only compound value fits just one row", () => {
  const fixed = spec
    .replace("type: monday | tuesday, required: true", "type: int!, min: 1, max: 1")
    .replace("type: lunch | dinner, required: true", "type: int!, min: 2, max: 2")
    .replace("    unique:", "    trash: true\n    unique:")
    .concat("actions:\n  mergeHours: { merge: ServiceHour }\n");
  const generated = source(fixed);
  expect(generated).toContain("{ weekday: [1], service: [2] }");
  expect(generated).toContain("const others = await isolatedFixture(async () => {");
  expect(generated).toContain(
    "create: await isolatedFixture(() => can(() => serviceHourData.create(",
  );
  expect(generated).toContain("const two = tryInsertServiceHour(");
  expect(generated).toContain("runMergeHours(viewer, [one.id]");
});
