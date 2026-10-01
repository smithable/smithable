import { expect, test } from "vitest";
import { dataDiffSql, restoreOrder } from "./data-diff.js";
import { validateSpec } from "./spec.js";

test("records are written back after the records they refer to", () => {
  const { ir } = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Line:\n    fields: { order: Order!, qty: int }\n  Order:\n    fields: { customer: Customer! }\n  Customer:\n    fields: { name: string! }\npages:\n  orders: { crud: Order }\n",
  });
  expect(restoreOrder(ir ?? { models: [] }).map((m) => m.name)).toEqual([
    "Customer",
    "Order",
    "Line",
  ]);
});

test("names are quoted, so a table or column cannot end the statement", () => {
  expect(dataDiffSql({ table: 'x"; DROP', title: "name" }).removed).toContain('"x""; DROP"');
});
