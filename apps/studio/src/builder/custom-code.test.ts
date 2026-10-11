import { expect, test } from "vitest";
import { customFile } from "./custom-code";

test("a query and an action without on need custom code; a standard action does not", () => {
  expect(customFile("addQuery", { query: "atRisk", returns: "Customer" })).toEqual([
    "src/custom/queries/at-risk.ts",
  ]);
  expect(customFile("addAction", { action: "mergeCustomers" })).toEqual([
    "src/custom/actions/merge-customers.ts",
  ]);
  expect(customFile("addAction", { action: "cancelOrder", on: "Order" })).toEqual([]);
  expect(customFile("addField", { model: "Customer", field: "phone" })).toEqual([]);
});
