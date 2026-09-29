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

test("an access target is a model's operation, a page or an action", () => {
  const targets = values(namesFor({ ref: "accessTarget" }, {}, ir, []));
  expect(targets).toContain("model:Order.create");
  expect(targets).toContain("page:orders");
  expect(targets).toContain("action:mergeCustomers");
});

test("a record's owner is offered where its target has one to check", () => {
  const roles = (target: string) =>
    values(namesFor({ ref: "role", target: "target" }, { target }, ir, ["admin", "sales"]));
  expect(roles("model:Order.write")).toEqual(["admin", "sales", "owner"]);
  expect(roles("model:Order.create")).toEqual(["admin", "sales"]);
  expect(roles("page:orders")).toEqual(["admin", "sales"]);
});

test("a menu is main or one the spec names; a field follows its model", () => {
  expect(values(namesFor({ ref: "menu" }, {}, ir, []))).toContain("main");
  expect(values(namesFor({ ref: "field", model: "model" }, { model: "Order" }, ir, []))).toContain(
    "total",
  );
});
