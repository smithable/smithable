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
    ["smithable.yml", ["models", "Order", "schedule"], undefined],
    ["smithable.yml", ["models", "Order", "occupies"], undefined],
    ["smithable.yml", ["models", "Order", "unique"], [["customer", "number"]]],
    ["smithable.yml", ["pages", "orders", "search"], ["name"]],
    ["smithable.yml", ["pages", "orders", "filters"], ["status"]],
    ["smithable.yml", ["pages", "orders", "export"], false],
    ["smithable.yml", ["pages", "orders", "favorites"], true],
    ["smithable.yml", ["pages", "orders", "mine"], true],
    ["smithable.yml", ["pages", "orders", "period"], "placedAt"],
    ["smithable.yml", ["pages", "orders", "contact"], "owner"],
    ["smithable.yml", ["pages", "orders", "defaultFilter", "status"], "open"],
    ["smithable.yml", ["pages", "orders", "description"], "Every order"],
    ["smithable.yml", ["timers", "reminder"], undefined],
    ["smithable.yml", ["timers", "reminder", "cron"], "0 8 * * *"],
    ["smithable.yml", ["outgoing", "receipt"], undefined],
    ["smithable.yml", ["outgoing", "receipt", "to"], "owner"],
    ["smithable.yml", ["payments", "deposit"], undefined],
    ["smithable.yml", ["payments", "deposit", "amount"], "total"],
    ["smithable.yml", ["payments", "deposit", "paid", "set"], { paid: true }],
    ["smithable.yml", ["incoming", "mail"], undefined],
    ["smithable.yml", ["actions", "ship", "description"], "Sends the order"],
    ["smithable.ux.yml", ["pages", "orders", "table", "columns"], ["total"]],
    ["smithable.ux.yml", ["pages", "orders", "table", "totals"], ["total"]],
    ["smithable.ux.yml", ["pages", "orders", "table", "view"], "cards"],
    ["smithable.ux.yml", ["pages", "orders", "table", "sort"], "-total"],
    ["smithable.ux.yml", ["pages", "orders", "table", "actions"], "menu"],
    ["smithable.ux.yml", ["pages", "orders", "filters", "shown"], ["status"]],
    ["smithable.ux.yml", ["pages", "orders", "filters", "look"], "chips"],
    ["smithable.ux.yml", ["pages", "orders", "calendar", "colorBy"], "status"],
    ["smithable.ux.yml", ["pages", "orders", "calendar", "view"], "agenda"],
    ["smithable.ux.yml", ["pages", "orders", "calendar", "filters"], ["timeOfDay"]],
    ["smithable.ux.yml", ["pages", "orders", "frame"], "site"],
    ["smithable.ux.yml", ["pages", "orders", "width"], "wide"],
    ["smithable.ux.yml", ["pages", "orders", "record", "pictures"], "top"],
    ["smithable.ux.yml", ["pages", "orders", "record", "first"], "thread"],
    ["smithable.ux.yml", ["pages", "orders", "form", "fieldOrder"], ["total"]],
    ["smithable.ux.yml", ["pages", "orders", "form", "columns"], 2],
    ["smithable.yml", ["pages", "home", "landing", "faq"], undefined],
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

test("a schedule, what a booking occupies and fields unique together, each through its operation", () => {
  const spec = {
    models: {
      Barber: {
        fields: { name: "string!" },
        schedule: { hours: { "mon-fri": "09:00-17:00" }, gap: 10 },
      },
      Visit: {
        fields: {
          barber: "Barber!",
          startsAt: "datetime!",
          minutes: "int!",
          customer: "string!",
          day: "date!",
        },
        occupies: {
          resource: "barber",
          starts: "startsAt",
          duration: "minutes",
          cancelUntil: "12h",
        },
        unique: [["barber", "startsAt"]],
      },
    },
  };
  const schedule = ["models", "Barber", "schedule"];
  expect(operationFor("smithable.yml", [...schedule, "hours", "sat"], "10:00-14:00", spec)).toEqual(
    [
      "setSchedule",
      { model: "Barber", hours: { "mon-fri": "09:00-17:00", sat: "10:00-14:00" }, gap: "10" },
    ],
  );
  // setSchedule writes it whole, so a key taken away goes with it.
  expect(operationFor("smithable.yml", [...schedule, "gap"], undefined, spec)).toEqual([
    "setSchedule",
    { model: "Barber", hours: { "mon-fri": "09:00-17:00" } },
  ]);
  expect(operationFor("smithable.yml", schedule, undefined, spec)).toEqual([
    "setSchedule",
    { model: "Barber", hours: "none" },
  ]);
  const occupies = ["models", "Visit", "occupies"];
  expect(operationFor("smithable.yml", [...occupies, "cancelUntil"], undefined, spec)).toEqual([
    "setOccupies",
    { model: "Visit", resource: "barber", starts: "startsAt", duration: "minutes" },
  ]);
  expect(operationFor("smithable.yml", [...occupies, "starts"], undefined, spec)).toBeUndefined();
  const unique = ["models", "Visit", "unique"];
  expect(
    operationFor(
      "smithable.yml",
      unique,
      [
        ["barber", "startsAt"],
        ["customer", "day"],
      ],
      spec,
    ),
  ).toEqual(["setUnique", { model: "Visit", fields: ["customer", "day"] }]);
  expect(operationFor("smithable.yml", unique, undefined, spec)).toEqual([
    "setUnique",
    { model: "Visit", fields: ["barber", "startsAt"], remove: true },
  ]);
  expect(
    operationFor(
      "smithable.yml",
      [...unique, 0],
      { fields: ["barber", "startsAt"], scope: "app" },
      spec,
    ),
  ).toEqual(["setUnique", { model: "Visit", fields: ["barber", "startsAt"], scope: "app" }]);
  // Two rules changed at once are more than one operation: editSpec writes them.
  expect(operationFor("smithable.yml", unique, [["customer", "day"]], spec)).toBeUndefined();
});

test("a page's lists, filters and choices each go through their own operation", () => {
  const spec = {
    pages: {
      orders: {
        crud: "Order",
        filters: ["status", "placedAt"],
        defaultFilter: { placedAt: "upcoming" },
        contact: { to: "owner", keep: "Note" },
      },
    },
    actions: { report: { on: "Order" } },
  };
  const page = (...rest: (string | number)[]) => ["pages", "orders", ...rest];
  expect(operationFor("smithable.yml", page("search"), ["name", "email"])).toEqual([
    "setSearch",
    { page: "orders", fields: ["name", "email"] },
  ]);
  expect(operationFor("smithable.yml", page("filters"), undefined)).toEqual([
    "setFilters",
    { page: "orders", fields: [] },
  ]);
  expect(operationFor("smithable.yml", page("sortable"), ["total"])?.[0]).toBe("setSortable");
  expect(operationFor("smithable.yml", page("export"), false)).toEqual([
    "setExport",
    { page: "orders", offered: "off" },
  ]);
  expect(operationFor("smithable.yml", page("favorites"), "only")?.[1]).toEqual({
    page: "orders",
    mode: "only",
  });
  expect(operationFor("smithable.yml", page("mine"), undefined)?.[1]).toEqual({
    page: "orders",
    mode: "off",
  });
  expect(operationFor("smithable.yml", page("period"), { Invoice: "issuedOn" })).toEqual([
    "setPeriod",
    { page: "orders", byModel: { Invoice: "issuedOn" } },
  ]);
  expect(operationFor("smithable.yml", page("contact", "keep"), undefined, spec)).toEqual([
    "setContact",
    { page: "orders", to: "owner" },
  ]);
  expect(operationFor("smithable.yml", page("contact"), undefined, spec)).toEqual([
    "setContact",
    { page: "orders" },
  ]);
  // One filter's value at a time; a list of values is written as setDefaultFilter reads it.
  expect(
    operationFor(
      "smithable.yml",
      page("defaultFilter"),
      { placedAt: "upcoming", status: ["open", "paid"] },
      spec,
    ),
  ).toEqual(["setDefaultFilter", { page: "orders", field: "status", value: "open,paid" }]);
  expect(operationFor("smithable.yml", page("defaultFilter", "placedAt"), undefined, spec)).toEqual(
    ["setDefaultFilter", { page: "orders", field: "placedAt", value: "none" }],
  );
  expect(operationFor("smithable.yml", page("intent"), "Find an order fast", spec)).toEqual([
    "setMeaning",
    { concept: "orders", intent: "Find an order fast" },
  ]);
  // A page named like an action: setMeaning would explain the action, so editSpec writes it.
  expect(
    operationFor("smithable.yml", ["pages", "report", "intent"], "Monthly figures", spec),
  ).toBeUndefined();
});

test("a default filter value with a comma of its own stays with editSpec", () => {
  expect(
    operationFor(
      "smithable.yml",
      ["pages", "orders", "defaultFilter", "status"],
      ["on hold, waiting"],
    ),
  ).toBeUndefined();
});

test("a section taken away, and which records one shows, through their operations", () => {
  const home = (...rest: string[]) => ["pages", "home", "landing", ...rest];
  expect(operationFor("smithable.yml", home("faq"), undefined)).toEqual([
    "removeSection",
    { page: "home", section: "faq" },
  ]);
  expect(operationFor("smithable.yml", home("items", "where"), { featured: "true" })).toEqual([
    "setSectionWhere",
    { page: "home", section: "items", where: { featured: "true" } },
  ]);
  expect(
    operationFor("smithable.yml", ["pages", "about", "sections", "team", "where"], undefined),
  ).toEqual(["setSectionWhere", { page: "about", section: "team", where: {} }]);
  // The hero's buttons are any section's key in the schema: editSpec writes them.
  expect(operationFor("smithable.yml", home("hero", "button"), "items")).toBeUndefined();
});

test("a page's look, one key to one operation, and each taken away as that operation says", () => {
  const ux = (...rest: string[]) => ["pages", "orders", ...rest];
  expect(operationFor("smithable.ux.yml", ux("table", "columns"), ["customer", "total"])).toEqual([
    "setColumns",
    { page: "orders", columns: ["customer", "total"] },
  ]);
  expect(operationFor("smithable.ux.yml", ux("table", "columns"), undefined)).toEqual([
    "setColumns",
    { page: "orders" },
  ]);
  expect(operationFor("smithable.ux.yml", ux("table", "sort"), undefined)).toEqual([
    "setSort",
    { page: "orders", field: "none" },
  ]);
  expect(operationFor("smithable.ux.yml", ux("table", "view"), "cards")?.[1]).toEqual({
    page: "orders",
    view: "cards",
  });
  expect(operationFor("smithable.ux.yml", ux("calendar", "view"), undefined)?.[1]).toEqual({
    page: "orders",
    view: "inherit",
  });
  expect(operationFor("smithable.ux.yml", ux("frame"), undefined)?.[1]).toEqual({
    page: "orders",
    frame: "default",
  });
  expect(operationFor("smithable.ux.yml", ux("form", "columns"), 2)?.[1]).toEqual({
    page: "orders",
    columns: 2,
  });
  expect(operationFor("smithable.ux.yml", ux("filters", "shown"), undefined)?.[1]).toEqual({
    page: "orders",
    fields: [],
  });
  // A list where a word is expected (or the other way round) is left to editSpec's checks.
  expect(operationFor("smithable.ux.yml", ux("table", "sort"), ["total"])).toBeUndefined();
  expect(operationFor("smithable.ux.yml", ux("table", "header"), "x")).toBeUndefined();
});

test("timers, outgoing mail, payments, incoming calls and an action's meaning through their operations", () => {
  const y = "smithable.yml";
  expect(operationFor(y, ["timers", "reminder"], undefined)).toEqual([
    "removeTimer",
    { name: "reminder" },
  ]);
  expect(operationFor(y, ["outgoing", "receipt"], undefined)).toEqual([
    "removeOutgoing",
    { outgoing: "receipt" },
  ]);
  expect(operationFor(y, ["payments", "deposit"], undefined)).toEqual([
    "removePayment",
    { name: "deposit" },
  ]);
  expect(operationFor(y, ["incoming", "mail"], undefined)).toEqual([
    "removeIncoming",
    { name: "mail" },
  ]);
  expect(operationFor(y, ["timers", "reminder", "every"], "1 day")).toEqual([
    "setTimer",
    { name: "reminder", every: "1 day" },
  ]);
  expect(operationFor(y, ["timers", "reminder", "at"], undefined)?.[1]).toEqual({
    name: "reminder",
    at: "none",
  });
  expect(operationFor(y, ["timers", "reminder", "where"], { status: "open" })?.[1]).toEqual({
    name: "reminder",
    where: { status: "open" },
  });
  expect(operationFor(y, ["outgoing", "receipt", "to"], "customer.email")).toEqual([
    "setOutgoingTo",
    { outgoing: "receipt", to: "customer.email" },
  ]);
  expect(operationFor(y, ["payments", "deposit", "description"], undefined)?.[1]).toEqual({
    name: "deposit",
    description: "none",
  });
  expect(operationFor(y, ["payments", "deposit", "paid", "set"], { paid: true })?.[1]).toEqual({
    name: "deposit",
    paidSet: { paid: true },
  });
  expect(operationFor(y, ["payments", "deposit", "refund", "by"], ["staff"])?.[1]).toEqual({
    name: "deposit",
    refundBy: ["staff"],
  });
  expect(operationFor(y, ["actions", "merge", "intent"], "One customer, not two")).toEqual([
    "setMeaning",
    { concept: "merge", intent: "One customer, not two" },
  ]);
  expect(operationFor(y, ["payments", "deposit", "refund", "by"], undefined)?.[1]).toEqual({
    name: "deposit",
    refundBy: ["none"],
  });
  // A payment's amount taken away has no "none": editSpec writes it, and the checks say why not.
  expect(operationFor(y, ["payments", "deposit", "amount"], undefined)).toBeUndefined();
});

test("the whole app's look goes through its operations", () => {
  const u = "smithable.ux.yml";
  expect(operationFor(u, ["aiBadge"], false)).toEqual(["setAiBadge", { shown: "false" }]);
  expect(operationFor(u, ["aiBadge"], undefined)).toEqual(["setAiBadge", { shown: "true" }]);
  expect(operationFor(u, ["chrome"], undefined)).toEqual(["setChrome", { chrome: "inherit" }]);
  expect(operationFor(u, ["navigation"], "topbar")).toEqual([
    "setMenuLayout",
    { navigation: "topbar" },
  ]);
  expect(operationFor(u, ["menuActive"], "subtle")).toEqual([
    "setMenuActive",
    { active: "subtle" },
  ]);
  expect(operationFor(u, ["assistant", "voice"], "formal")).toEqual([
    "setAssistantVoice",
    { voice: "formal" },
  ]);
  expect(operationFor(u, ["theme", "preset"], "minimal")).toEqual([
    "setTheme",
    { preset: "minimal" },
  ]);
  expect(operationFor(u, ["theme", "brand", "primary"], undefined)).toEqual([
    "setTheme",
    { primary: "none" },
  ]);
  expect(operationFor(u, ["theme", "density"], "compact")).toEqual([
    "setTheme",
    { density: "compact" },
  ]);
  // Motion's "none" is no motion at all, so taking the key away stays with editSpec.
  expect(operationFor(u, ["theme", "motion"], undefined)).toBeUndefined();
});
