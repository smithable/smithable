import { buildJsonSchema, COMPANION_SCHEMAS, operationsSetting } from "@smithable/core";
import { expect, test } from "vitest";
import {
  alternativeFor,
  choicesFor,
  controlOf,
  labelOf,
  operationFor,
  renameFor,
  uncovered,
  wordOrList,
} from "./spec-form";

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
  expect(operationFor("smithable.yml", ["models", "Customer", "trash"], true)).toEqual([
    "setTrash",
    { model: "Customer", trash: true },
  ]);
  expect(operationFor("smithable.yml", ["models", "Customer", "unique"], [])).toBeUndefined();
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
  // The form's Add: a new field as a text, a new kind of record with a required name.
  expect(operationFor("smithable.yml", ["models", "Customer", "fields", "website"], {})).toEqual([
    "addField",
    { model: "Customer", field: "website", type: "string" },
  ]);
  expect(operationFor("smithable.yml", ["models", "Supplier"], {})).toEqual([
    "addModel",
    { model: "Supplier", fields: { name: "string!" } },
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

test("a role's grants go through grant", () => {
  const auth = "smithable.auth.yml";
  expect(operationFor(auth, ["roles", "sales", "pages"], ["contacts"])).toEqual([
    "grant",
    { role: "sales", what: "pages", names: ["contacts"] },
  ]);
  expect(operationFor(auth, ["roles", "sales", "write"], "all")).toEqual([
    "grant",
    { role: "sales", what: "write", names: ["all"] },
  ]);
  expect(operationFor(auth, ["roles", "sales", "delete"], undefined)).toEqual([
    "grant",
    { role: "sales", what: "delete", names: ["none"] },
  ]);
  expect(operationFor(auth, ["roles", "sales"], "all")).toEqual([
    "grant",
    { role: "sales", what: "all" },
  ]);
  expect(operationFor(auth, ["roles", "sales", "description"], "Sells")).toBeUndefined();
});

test("a grant is all or a list of names, offering the app's pages, kinds of record or actions", () => {
  const grant = [{ enum: ["all"] }, { type: "array", items: { type: "string" } }];
  expect(wordOrList(grant)).toEqual({ word: "all", list: grant[1] });
  expect(wordOrList([{ type: "string" }, { type: "object" }])).toBeUndefined();
  const spec = { models: { Customer: {} }, pages: { home: {} }, actions: { close: {} } };
  const auth = "smithable.auth.yml";
  expect(choicesFor(auth, ["roles", "sales", "delete"], spec)).toEqual(["Customer"]);
  expect(choicesFor(auth, ["roles", "sales", "pages"], spec)).toEqual(["home"]);
  expect(choicesFor(auth, ["public", "read"], spec)).toEqual(["Customer"]);
  expect(choicesFor(auth, ["roles", "sales", "actions"], spec)).toEqual(["close"]);
  expect(choicesFor("smithable.yml", ["models"], spec)).toEqual([]);
});

test("a field is renamed through renameField; other entries offer no rename", () => {
  expect(renameFor("smithable.yml", ["models", "Customer", "fields", "phone"], "mobile")).toEqual([
    "renameField",
    { model: "Customer", from: "phone", to: "mobile" },
  ]);
  expect(renameFor("smithable.yml", ["models", "Customer"], "Client")).toEqual([
    "renameModel",
    { from: "Customer", to: "Client" },
  ]);
  expect(renameFor("smithable.yml", ["pages", "home"], "start")).toEqual([
    "renamePage",
    { from: "home", to: "start" },
  ]);
  expect(renameFor("smithable.ux.yml", ["pages", "home"], "start")).toBeUndefined();
});

test("a page and an action are taken away through their own operations", () => {
  expect(operationFor("smithable.yml", ["pages", "team"], undefined)).toEqual([
    "removePage",
    { page: "team" },
  ]);
  expect(operationFor("smithable.yml", ["actions", "merge"], undefined)).toEqual([
    "removeAction",
    { action: "merge" },
  ]);
});

test("a key's label is its schema title where core gives one, the first sentence otherwise", () => {
  expect(labelOf("currency", { title: "Currency", description: "ISO 4217 currency code." })).toBe(
    "Currency",
  );
  expect(labelOf("thing", { description: "What it holds. More words." })).toBe("What it holds");
});

test("every operation a control writes through is one core lists for its key", () => {
  const cases: [string, (string | number)[], unknown][] = [
    ["smithable.content.yml", ["pages", "home", "title"], "Hem"],
    ["smithable.yml", ["app", "name"], "Shop"],
    ["smithable.yml", ["models", "Order"], {}],
    ["smithable.yml", ["models", "Order", "fields", "note"], {}],
    ["smithable.yml", ["models", "Order", "fields", "note"], "text"],
    ["smithable.yml", ["models", "Order", "fields", "note"], undefined],
    ["smithable.yml", ["pages", "orders"], undefined],
    ["smithable.yml", ["actions", "ship"], undefined],
    ["smithable.ux.yml", ["pages", "orders", "icon"], "Box"],
    ["smithable.auth.yml", ["defaultAccess"], "private"],
    ["smithable.auth.yml", ["public", "read"], ["Order"]],
    ["smithable.auth.yml", ["roles", "sales"], "all"],
    ["smithable.auth.yml", ["roles", "sales", "write"], ["Order"]],
    ["smithable.yml", ["app", "intent"], "Bookings without phone calls"],
    ["smithable.yml", ["models", "Order", "description"], "One order"],
    ["smithable.yml", ["models", "Order", "intent"], undefined],
    ["smithable.yml", ["models", "Order", "fields", "note", "description"], "What was said"],
    ["smithable.yml", ["models", "Order", "trash"], true],
    ["smithable.yml", ["models", "Order", "ownedBy"], "customer"],
    ["smithable.yml", ["models", "Order", "namedBy"], ["customer", "placedAt"]],
    ["smithable.yml", ["models", "Order", "review"], "all"],
    ["smithable.yml", ["models", "Order", "fields", "note", "by"], "app"],
    ["smithable.yml", ["models", "Order", "fields", "note", "unique"], "owner"],
    ["smithable.yml", ["models", "Order", "fields", "note", "locked"], true],
    ["smithable.yml", ["models", "Order", "fields", "note", "required"], { status: "paid" }],
    ["smithable.yml", ["models", "Order", "thread"], undefined],
    ["smithable.yml", ["models", "Order", "capacity"], undefined],
  ];
  for (const [file, path, value] of cases) {
    const [op] = operationFor(file, path, value) ?? [];
    expect(op, `${file}:${path.join(".")}`).toBeDefined();
    expect(
      operationsSetting(file, path).map((o) => o.name),
      `${file}:${path.join(".")}`,
    ).toContain(op);
  }
});

test("the Data keys go through their operations, a group's key written with the rest of it", () => {
  const spec = {
    models: {
      Booking: {
        fields: { session: "Session!", status: "booked | cancelled" },
        capacity: { per: "session", max: "session.capacity", where: { status: "booked" } },
      },
      Message: { fields: { body: "text", from: "email" }, thread: { body: "body" } },
    },
  };
  const at = ["models", "Booking", "capacity"];
  expect(
    operationFor("smithable.yml", [...at, "closes"], "1 hour before session.startsAt", spec),
  ).toEqual([
    "setCapacity",
    {
      model: "Booking",
      per: "session",
      max: "session.capacity",
      where: { status: "booked" },
      closes: "1 hour before session.startsAt",
    },
  ]);
  expect(operationFor("smithable.yml", [...at, "max"], 12, spec)?.[1]).toMatchObject({ max: "12" });
  expect(operationFor("smithable.yml", at, undefined, spec)).toEqual([
    "setCapacity",
    { model: "Booking", per: "none" },
  ]);
  // A capacity without its limit yet stays with editSpec until it is whole.
  expect(operationFor("smithable.yml", [...at, "max"], undefined, spec)).toBeUndefined();
  const thread = ["models", "Message", "thread"];
  expect(operationFor("smithable.yml", [...thread, "author"], "from", spec)).toEqual([
    "setThread",
    { model: "Message", body: "body", author: "from" },
  ]);
  // A side half given waits for its other half with editSpec.
  expect(
    operationFor("smithable.yml", [...thread, "side"], { field: "from" }, spec),
  ).toBeUndefined();
  expect(operationFor("smithable.yml", ["models", "Message", "review"], [])).toEqual([
    "setReview",
    { model: "Message", fields: ["none"] },
  ]);
  // A key taken away from it: setThread keeps what it is not given, so editSpec takes it away.
  expect(operationFor("smithable.yml", [...thread, "body"], undefined, spec)).toBeUndefined();
  const field = ["models", "Booking", "fields", "status"];
  expect(operationFor("smithable.yml", [...field, "locked"], { status: "cancelled" })).toEqual([
    "setFieldRules",
    { model: "Booking", field: "status", once: false, locked: { status: "cancelled" } },
  ]);
  expect(operationFor("smithable.yml", [...field, "locked"], undefined)?.[1]).toMatchObject({
    once: false,
    locked: {},
  });
  // Always required is the type's "!", through changeField; only a condition is a field rule.
  expect(operationFor("smithable.yml", [...field, "required"], true)).toBeUndefined();
  expect(operationFor("smithable.yml", [...field, "unique"], undefined)?.[1]).toMatchObject({
    unique: "false",
  });
  expect(operationFor("smithable.yml", [...field, "intent"], "")).toEqual([
    "setMeaning",
    { concept: "Booking.status", intent: "" },
  ]);
  expect(operationFor("smithable.yml", ["models", "Booking", "namedBy"], "session")).toEqual([
    "setNamedBy",
    { model: "Booking", parts: ["session"] },
  ]);
  expect(operationFor("smithable.yml", ["models", "Booking", "ownedBy"], undefined)).toEqual([
    "setOwner",
    { model: "Booking" },
  ]);
  expect(operationFor("smithable.yml", ["models", "Booking", "review"], undefined)).toEqual([
    "setReview",
    { model: "Booking", fields: ["none"] },
  ]);
});
