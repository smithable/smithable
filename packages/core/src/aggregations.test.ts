import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import type { DashboardItem } from "./ir.js";
import { validateSpec } from "./spec.js";
import { validateUx } from "./ux.js";

// Aggregations (docs/design/intents.md §5): a table's totals row, a chart by a choice, a period.
const spec = (dashboard: string) => `smithable: 0.1
app: { name: Billing }
models:
  Customer:
    fields: { name: string!, segment: retail | wholesale, invoices: "Invoice[]" }
  Invoice:
    fields:
      number: int!
      customer: Customer!
      status: sent | paid
      issuedOn: date
      total: money
      due: { type: money, formula: "total" }
      dueOn: { type: date, formula: "issuedOn" }
      note: text
pages:
  invoices:
    crud: Invoice
  overview:
    dashboard:
${dashboard}
`;
const read = (dashboard: string) => validateSpec({ path: "smithable.yml", text: spec(dashboard) });
const tiles = (dashboard: string) => {
  const { ir, diagnostics } = read(dashboard);
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const page = ir?.pages.find((p) => p.id === "overview");
  return page?.pattern.kind === "dashboard" ? page.pattern.items : ([] as DashboardItem[]);
};
const errors = (dashboard: string) =>
  read(dashboard)
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => d.message);

test("a chart by a date takes a period; by a choice, or a reference's choice, it has a bar per value", () => {
  const [monthly, weekly, byStatus, bySegment] =
    tiles(`      monthly: { sum: Invoice.total, by: issuedOn }
      weekly: { count: Invoice, by: issuedOn, period: week }
      byStatus: { count: Invoice, by: status }
      bySegment: { sum: Invoice.total, by: customer.segment }
`);
  expect(monthly).toMatchObject({ kind: "chart", by: "issuedOn" });
  expect(monthly?.period).toBeUndefined();
  expect(monthly?.choice).toBeUndefined();
  expect(weekly).toMatchObject({ kind: "chart", by: "issuedOn", period: "week" });
  expect(byStatus).toMatchObject({
    kind: "chart",
    by: "status",
    choice: { model: "Invoice", field: "status" },
  });
  expect(bySegment).toMatchObject({
    kind: "chart",
    by: "customer.segment",
    choice: { model: "Customer", field: "segment", reference: "customer" },
  });
});

test("by a reference, a text, a far field that is no choice, two hops, or a period without a date are refused", () => {
  expect(errors("      x: { count: Invoice, by: customer }\n")).toEqual([
    expect.stringContaining("customer is a reference, whose values are unbounded"),
  ]);
  expect(errors("      x: { count: Invoice, by: note }\n")).toEqual([
    expect.stringContaining(
      '"by" needs a date field (a bar per period) or a choice (a bar per value): note is neither.',
    ),
  ]);
  expect(errors("      x: { count: Invoice, by: customer.name }\n")).toEqual([
    expect.stringContaining("customer.name is not one"),
  ]);
  expect(errors("      x: { count: Invoice, by: customer.segmnt }\n")).toEqual([
    expect.stringContaining('Customer has no field named "segmnt"'),
  ]);
  expect(errors("      x: { count: Invoice, by: customer.segment.more }\n")).toEqual([
    expect.stringContaining('"by" goes one reference away at most'),
  ]);
  expect(errors("      x: { count: Invoice, by: status.more }\n")).toEqual([
    expect.stringContaining("status is not a reference"),
  ]);
  expect(errors("      x: { count: Invoice, by: dueOn }\n")).toEqual([
    expect.stringContaining('"by" needs a stored field: dueOn is computed per record.'),
  ]);
  // A refused "by" is one error, not two.
  expect(errors("      x: { count: Invoice, by: note, period: week }\n")).toEqual([
    expect.stringContaining("note is neither"),
  ]);
  expect(errors("      x: { count: Invoice, by: status, period: month }\n")).toEqual([
    expect.stringContaining('"period" goes with "by" a date field'),
  ]);
  expect(errors("      x: { count: Invoice, period: week }\n")).toEqual([
    expect.stringContaining('"period" goes with "by" a date field'),
  ]);
  expect(errors("      x: { count: Invoice, by: issuedOn, period: fortnight }\n")).toEqual([
    expect.stringContaining('"period" is week, month, quarter or year.'),
  ]);
});

test("addTile takes --by and --period; renames follow a far choice and its reference; a removal is refused", () => {
  const files = { spec: spec("      open: { count: Invoice, where: { status: sent } }") };
  const added = applyOperation(files, "addTile", {
    page: "overview",
    tile: "bySegment",
    measure: "sum",
    of: "Invoice.total",
    by: "customer.segment",
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toMatch(
    /bySegment:\n {8}sum: Invoice\.total\n {8}by: customer\.segment\n/,
  );
  const weekly = applyOperation(files, "addTile", {
    page: "overview",
    tile: "weekly",
    measure: "count",
    of: "Invoice",
    by: "issuedOn",
    period: "week",
  });
  expect(weekly.ok && weekly.files.spec).toMatch(/by: issuedOn\n {8}period: week\n/);
  expect(
    applyOperation(files, "addTile", {
      page: "overview",
      tile: "x",
      measure: "count",
      of: "Invoice",
      period: "week",
    }),
  ).toMatchObject({ ok: false });
  const withIt = { ...files, ...added.files };
  const farRenamed = applyOperation(withIt, "renameField", {
    model: "Customer",
    from: "segment",
    to: "tier",
  });
  expect(farRenamed.ok && farRenamed.files.spec).toContain("by: customer.tier");
  const referenceRenamed = applyOperation(withIt, "renameField", {
    model: "Invoice",
    from: "customer",
    to: "client",
  });
  expect(referenceRenamed.ok && referenceRenamed.files.spec).toContain("by: client.segment");
  expect(
    applyOperation(withIt, "removeField", { model: "Customer", field: "segment" }),
  ).toMatchObject({
    ok: false,
    message: expect.stringContaining(
      'The "bySegment" tile of the overview page uses Customer.segment',
    ),
  });
});

test("a table's totals name number and amount fields; setTotals writes them", () => {
  const { ir } = read("      open: { count: Invoice }");
  if (!ir) throw new Error("no ir");
  const ux = (pages: string) =>
    validateUx({ path: "smithable.ux.yml", text: `smithableUx: 0.1\npages:\n${pages}` }, ir);
  const good = ux("  invoices:\n    table: { totals: [total, number, total] }\n");
  expect(good.diagnostics).toEqual([]);
  expect(good.ux?.pages.invoices?.totals).toEqual(["total", "number"]);
  expect(
    ux("  invoices:\n    table: { totals: [note, totl, due] }\n").diagnostics.map((d) => d.message),
  ).toEqual([
    '"note" is not a number or an amount, so it has no total.',
    expect.stringContaining('Invoice has no field named "totl" to total.'),
    '"due" is computed per record, so the list has no total of it.',
  ]);
  const files = { spec: spec("      open: { count: Invoice }"), ux: "smithableUx: 0.1\n" };
  const set = applyOperation(files, "setTotals", { page: "invoices", totals: ["total", "number"] });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.ux).toMatch(/invoices:\n {4}table:\n {6}totals: \[total, number\]/);
  expect(set.description).toBe("Total total, number under the invoices table");
  expect(applyOperation(files, "setTotals", { page: "invoices", totals: ["note"] })).toMatchObject({
    ok: false,
    message: expect.stringContaining("not a number or an amount"),
  });
  const none = applyOperation({ ...files, ...set.files }, "setTotals", { page: "invoices" });
  expect(none.ok && none.files.ux).not.toContain("totals");
});

test("a table's totals follow a renamed field and drop a removed one", () => {
  const files = { spec: spec("      open: { count: Invoice }"), ux: "smithableUx: 0.1\n" };
  const set = applyOperation(files, "setTotals", { page: "invoices", totals: ["total", "number"] });
  if (!set.ok) throw new Error(set.message);
  const withIt = { ...files, ...set.files };
  const renamed = applyOperation(withIt, "renameField", {
    model: "Invoice",
    from: "total",
    to: "amount",
  });
  expect(renamed.ok && renamed.files.ux).toContain("totals: [amount, number]");
  const removed = applyOperation(withIt, "removeField", { model: "Invoice", field: "number" });
  expect(removed.ok && removed.files.ux).toContain("totals: [total]");
  const both = applyOperation(
    removed.ok ? { ...withIt, ...removed.files } : withIt,
    "removeField",
    { model: "Invoice", field: "total" },
  );
  expect(both.ok && both.files.ux).not.toContain("totals");
});
