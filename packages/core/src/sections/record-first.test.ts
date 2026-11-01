import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";
import { validateUx } from "../ux.js";

const files = import.meta.glob("../../../../examples/support/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const file = (name: string) =>
  Object.entries(files).find(([path]) => path.endsWith(`/${name}`))?.[1] as string;
const spec = file("smithable.yml");
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
if (!ir) throw new Error("the support starter does not read");
const read = (record: string) =>
  validateUx(
    {
      path: "smithable.ux.yml",
      text: `smithableUx: 0.1\npages:\n  cases:\n    record: ${record}\n`,
    },
    ir,
    [],
  );

test("a record page leads with its thread or its form (A 215)", () => {
  const said = read("{ lists: { messages: thread }, first: thread }");
  expect(said.diagnostics).toEqual([]);
  expect(said.ux?.pages.cases?.recordFirst).toBe("thread");
  expect(read("{ first: form }").ux?.pages.cases?.recordFirst).toBeUndefined();
  expect(read("{ first: thread }").diagnostics[0]?.message).toBe(
    'The record of page "cases" shows no list as a thread to put before the form.',
  );
  expect(read("{ first: lists }").diagnostics[0]?.message).toBe(
    '"first" of a record is form or thread.',
  );
  const ux = "smithableUx: 0.1\npages:\n  cases:\n    record:\n      lists: { messages: thread }\n";
  expect(applyOperation({ spec }, "setRecordFirst", { page: "cases", first: "thread" }).ok).toBe(
    false,
  );
  const set = applyOperation({ spec, ux }, "setRecordFirst", { page: "cases", first: "thread" });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.ux).toBe(`${ux}      first: thread\n`);
  expect(
    applyOperation({ spec, ux: set.files.ux as string }, "setRecordFirst", {
      page: "cases",
      first: "form",
    }),
  ).toMatchObject({ ok: true, files: { ux } });
});
