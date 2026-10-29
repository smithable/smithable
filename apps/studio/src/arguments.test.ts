import { OPERATIONS, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { argumentProblem, argumentsOf, choicesFor } from "./arguments";

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
    "FollowUp",
  ]);
  expect(
    choicesFor(ref("removeField", "field"), { model: "Order" }, spec).map(([v]) => v),
  ).toContain("shippingMethod");
  expect(
    choicesFor(ref("setSearch", "fields"), { page: "customers" }, spec).map(([v]) => v),
  ).toContain("email");
  expect(
    choicesFor(ref("setTone", "value"), { model: "Order", field: "status" }, spec).map(([v]) => v),
  ).toEqual(["draft", "placed", "shipped", "canceled"]);
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

test("an annotated argument renders as a choice of the spec's names, a list as checkboxes", async () => {
  const { renderToString } = await import("react-dom/server");
  const { createElement } = await import("react");
  const { ArgumentField } = await import("./arguments");
  const render = (op: string, arg: string, values = {}) =>
    renderToString(
      createElement(ArgumentField, {
        name: arg,
        schema: (schema(op).properties as Record<string, object>)[arg],
        required: true,
        values,
        effective: argumentsOf(schema(op), values, spec),
        setValue: () => {},
        spec,
        label: arg,
      } as Parameters<typeof ArgumentField>[0]),
    );
  expect(render("removeField", "model")).toMatch(/<select[^>]*>.*<option value="Customer"/);
  expect(render("setSearch", "fields", { page: "customers" })).toMatch(/type="checkbox".*Email/);
  expect(render("setTone", "tone")).toMatch(/<option value="success"/);
});

test("a name typed in Code mode is checked against its rule while it is typed", () => {
  const text = { type: "string" };
  expect(argumentProblem("addPage", "page", text, "Hello")).toMatch(
    /^Page name "Hello" must start with a lowercase letter/,
  );
  expect(argumentProblem("addPage", "page", text, "hello")).toBeUndefined();
  expect(argumentProblem("renameField", "to", text, "Web page")).toMatch(/^Field name/);
  // A reference is chosen, not typed; an empty value is not yet a name.
  expect(
    argumentProblem("addPage", "model", { ...text, "x-smithable": { ref: "model" } }, "x y"),
  ).toBeUndefined();
  expect(argumentProblem("addPage", "page", text, "")).toBeUndefined();
});
