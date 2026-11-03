import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";

// A dashboard's period (docs/design/reports.md §2.4).
const spec = (page: string) => `smithable: 0.1
app:
  name: Shop
models:
  Invoice:
    fields:
      total: money!
      issuedOn: date!
      note: string
  Payment:
    fields:
      amount: money!
      paidOn: datetime!
pages:
  overview:
${page}`;
const TILES = `    dashboard:
      invoiced: { sum: Invoice.total }
      latest: { list: Invoice, limit: 5 }
`;
const BOTH = `${TILES}      paid: { sum: Payment.amount }
`;
const errors = (page: string) =>
  validateSpec({ path: "smithable.yml", text: spec(page) }, { roles: ["admin"] })
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => d.message)
    .join("\n");

test("a dashboard names its clock: one field for all, or one per model", () => {
  const one = validateSpec(
    { path: "smithable.yml", text: spec(`    period: issuedOn\n${TILES}`) },
    { roles: ["admin"] },
  );
  expect(one.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(one.ir?.pages[0]?.period).toEqual({ Invoice: "issuedOn" });
  const two = validateSpec(
    {
      path: "smithable.yml",
      text: spec(`    period: { Invoice: issuedOn, Payment: paidOn }\n${BOTH}`),
    },
    { roles: ["admin"] },
  );
  expect(two.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(two.ir?.pages[0]?.period).toEqual({ Invoice: "issuedOn", Payment: "paidOn" });
});

test("what a period refuses", () => {
  expect(errors(`    period: note\n${TILES}`)).toMatch(/no date field named "note"/);
  expect(errors(`    period: issuedOn\n${BOTH}`)).toMatch(/Payment has no date field/);
  expect(errors(`    period: { Invoice: issuedOn }\n${BOTH}`)).toMatch(/no date field for Payment/);
  expect(errors(`    period: { Nothing: issuedOn }\n${TILES}`)).toMatch(/not a model/);
  expect(errors("    crud: Invoice\n    period: issuedOn\n")).toMatch(/belongs to a dashboard/);
});

test("what is due does not need a clock", () => {
  expect(
    errors(`    period: { Invoice: issuedOn }
${TILES}      soon: { list: Payment, when: paidOn }
`),
  ).toBe("");
});

test("setPeriod writes and takes away; a rename follows; a removal is refused", () => {
  const files = { spec: spec(TILES) };
  const set = applyOperation(files, "setPeriod", { page: "overview", field: "issuedOn" });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.spec).toContain("period: issuedOn");
  const renamed = applyOperation(set.files, "renameField", {
    model: "Invoice",
    from: "issuedOn",
    to: "sentOn",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.spec).toContain("period: sentOn");
  const removed = applyOperation(renamed.files, "removeField", {
    model: "Invoice",
    field: "sentOn",
  });
  expect(removed.ok).toBe(false);
  const none = applyOperation(renamed.files, "setPeriod", { page: "overview", field: "none" });
  if (!none.ok) throw new Error(none.message);
  expect(none.files.spec).not.toContain("period:");
  expect(applyOperation(files, "setPeriod", { page: "overview", field: "note" }).ok).toBe(false);
});
