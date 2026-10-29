import { expect, test } from "vitest";
import { namesFor } from "./arguments.js";
import { validateSpec } from "./spec.js";

const spec = Object.values(
  import.meta.glob("../../../examples/crm/smithable.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
)[0] as string;
const ir = validateSpec({ path: "s", text: spec }, { roles: ["admin", "sales"] }).ir;
if (!ir) throw new Error("the CRM spec is invalid");
const values = (names: [string, string][]) => names.map(([v]) => v);

test("a grant's names follow what is granted: pages, models, or custom actions", () => {
  const names = (what: string) =>
    values(namesFor({ ref: "grantNames", what: "what" }, { what }, ir, ["admin", "sales"]));
  expect(names("pages")).toContain("orders");
  expect(names("write")).toEqual(["Customer", "Order", "FollowUp"]);
  expect(names("actions")).toEqual(["mergeCustomers", "scheduleFollowUps"]);
  expect(names("all")).toEqual([]);
  expect(values(namesFor({ ref: "role" }, {}, ir, ["admin", "sales"]))).toEqual(["admin", "sales"]);
});

test("a menu is main or one the spec names; a field follows its model", () => {
  expect(values(namesFor({ ref: "menu" }, {}, ir, []))).toContain("main");
  expect(values(namesFor({ ref: "field", model: "model" }, { model: "Order" }, ir, []))).toContain(
    "total",
  );
});
