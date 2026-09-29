import { OPERATIONS, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { argumentsOf, choicesFor } from "./arguments";

const read = (name: string) =>
  Object.entries(
    import.meta.glob("../../../examples/crm/*.yml", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  ).find(([k]) => k.endsWith(`/${name}`))?.[1] as string;
const auth = validateAuth({ path: "a", text: read("smithable.auth.yml") }).auth;
const spec = {
  ir: validateSpec(
    { path: "s", text: read("smithable.yml") },
    { roles: auth?.roles.map((r) => r.name) },
  ).ir,
  auth,
};
const schema = (name: string) => OPERATIONS.find((o) => o.name === name)?.schema ?? {};
const ref = (op: string, arg: string) =>
  (schema(op).properties as Record<string, { "x-smithable": never }>)[arg]["x-smithable"];

test("an annotated argument offers the names in the spec, following the argument it depends on", () => {
  expect(choicesFor(ref("removeField", "model"), {}, spec).map(([v]) => v)).toEqual([
    "Customer",
    "Order",
  ]);
  expect(
    choicesFor(ref("removeField", "field"), { model: "Order" }, spec).map(([v]) => v),
  ).toContain("shippingMethod");
  expect(
    choicesFor(ref("setSearch", "fields"), { page: "customers" }, spec).map(([v]) => v),
  ).toContain("email");
  expect(
    choicesFor(ref("setTone", "value"), { model: "Order", field: "status" }, spec).map(([v]) => v),
  ).toEqual(["draft", "placed", "shipped", "cancelled"]);
});

test("required choices default to the first name, and follow a changed model", () => {
  expect(argumentsOf(schema("removeField"), {}, spec)).toEqual({
    model: "Customer",
    field: "name",
  });
  // "email" is not a field of Order: the field falls back to Order's first.
  expect(argumentsOf(schema("removeField"), { model: "Order", field: "email" }, spec)).toEqual({
    model: "Order",
    field: "number",
  });
});
