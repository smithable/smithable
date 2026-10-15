import { buildJsonSchema, COMPANION_SCHEMAS } from "@smithable/core";
import { expect, test } from "vitest";
import { alternativeFor, controlOf, labelOf, operationFor, uncovered } from "./spec-form";

test("every key of the spec and its companion files has a control (what-it-does.md §2)", () => {
  const files = { "smithable.yml": buildJsonSchema(), ...COMPANION_SCHEMAS };
  const missing = Object.entries(files).flatMap(([file, schema]) =>
    uncovered(schema).map((path) => `${file}: ${path}`),
  );
  expect(missing).toEqual([]);
});

test("a key's control follows its schema's shape", () => {
  expect(controlOf({ type: "string", enum: ["a", "b"] })).toEqual({
    kind: "choice",
    values: ["a", "b"],
  });
  expect(controlOf({ type: "boolean" })).toEqual({ kind: "check" });
  expect(controlOf({ type: "integer", minimum: 1 })).toEqual({ kind: "number", min: 1 });
  expect(controlOf({ type: "object", additionalProperties: { type: "string" } })?.kind).toBe(
    "entries",
  );
  expect(controlOf({ type: "array", items: { type: "string" } })?.kind).toBe("list");
  expect(controlOf({ oneOf: [{ type: "string" }, { type: "object" }] })?.kind).toBe("alternatives");
});

test("a value is shown in the form it is written in; a new one in the long form", () => {
  const options = [{ type: "string" }, { type: "object", properties: {} }];
  expect(alternativeFor(options, "string!")).toBe(options[0]);
  expect(alternativeFor(options, { type: "string" })).toBe(options[1]);
  expect(alternativeFor(options, undefined)).toBe(options[1]);
});

test("a label is the description's first sentence, or the key made readable", () => {
  expect(labelOf("x", { description: "Who may sign up. Defaults to anyone." })).toBe(
    "Who may sign up",
  );
  expect(
    labelOf("currency", { description: "ISO 4217 currency code, e.g. EUR. Used for money." }),
  ).toBe("ISO 4217 currency code, e.g. EUR");
  expect(labelOf("defaultRole", {})).toBe("Default Role");
});

test("a key with an operation of its own goes through it; the rest through editSpec", () => {
  expect(operationFor("smithable.content.yml", ["pages", "home", "title"], "Hem")).toEqual([
    "setText",
    { path: ["pages", "home", "title"], text: "Hem" },
  ]);
  expect(operationFor("smithable.content.yml", ["pages", "home", "title"], undefined)).toEqual([
    "setText",
    { path: ["pages", "home", "title"], text: "" },
  ]);
  expect(operationFor("smithable.yml", ["app", "timezone"], "Europe/Stockholm")).toEqual([
    "setApp",
    { timezone: "Europe/Stockholm" },
  ]);
  expect(operationFor("smithable.yml", ["models", "Customer", "trash"], true)).toBeUndefined();
  expect(
    operationFor("smithable.yml", ["models", "Customer", "fields", "phone"], "phone!"),
  ).toEqual(["changeField", { model: "Customer", field: "phone", type: "phone!" }]);
  expect(
    operationFor("smithable.yml", ["models", "Customer", "fields", "phone"], undefined),
  ).toEqual(["removeField", { model: "Customer", field: "phone" }]);
  expect(operationFor("smithable.ux.yml", ["pages", "customers", "icon"], "star")).toEqual([
    "setIcon",
    { page: "customers", icon: "star" },
  ]);
  expect(operationFor("smithable.auth.yml", ["defaultAccess"], "private")).toEqual([
    "setDefaultAccess",
    { access: "private" },
  ]);
  expect(operationFor("smithable.auth.yml", ["public", "read"], ["Customer"])).toEqual([
    "setPublic",
    { read: ["Customer"] },
  ]);
});
