import { applyOperation, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { parse } from "yaml";
import { referenceEventModel, referenceMailRecipients } from "./reference-options";
import {
  referenceAt,
  referenceComplete,
  referenceControl,
  referenceGroup,
  referenceKeys,
  referenceReady,
  referenceWith,
} from "./reference-paths";
import { operationFor } from "./spec-form";

const spec = `smithable: 0.1
app: { name: Reference paths, timezone: UTC, currency: EUR }
models:
  Customer:
    ownedBy: email
    fields: { name: string!, email: email, fee: money, joined: date }
  Invoice:
    fields:
      title: string!
      customer: Customer!
      total: money
      day: date
      starts: datetime
      ends: datetime
      status: draft | sent
      accepted: bool
      count: int
      photo: picture
      amountAgain: { type: money, formula: total }
  Message:
    fields: { body: markdown, sender: email, invoice: Invoice!, direction: in | out }
  Article:
    fields: { title: string!, body: markdown, picture: picture, date: date, summary: text }
pages:
  invoices: { crud: Invoice, filters: [status, day] }
  customers: { crud: Customer }
  calendar: { calendar: { model: Invoice, starts: starts } }
  articles: { articles: Article }
  dashboard: { dashboard: { invoices: { count: Invoice }, customers: { count: Customer } } }
navigation: [invoices, customers]
actions:
  send: { on: Invoice, set: { status: sent } }
  invite: { on: Customer, set: { name: invited } }
timers:
  daily: { every: day, at: "09:00" }
payments:
  pay: { on: Invoice, amount: total, when: created }
outgoing:
  receipt: { when: Invoice created, to: mail, recipient: customer.email }
incoming:
  signup: { create: Customer, set: { name: "{name}" } }
queries:
  recent: { custom: true, returns: "Invoice[]" }
`;

function fixture() {
  const checked = validateSpec({ path: "smithable.yml", text: spec });
  expect(checked.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
  if (!checked.ir) throw Error("Invalid path fixture");
  const document: unknown = parse(spec);
  const auth = validateAuth(
    { path: "smithable.auth.yml", text: "smithableAuth: 0.1\n" },
    checked.ir,
  ).auth;
  return { ir: checked.ir, document, auth };
}
function control(path: (string | number)[], document = fixture().document) {
  const { ir, auth } = fixture();
  return referenceControl(path, referenceAt(document, path), document, ir, auth);
}
const values = (path: (string | number)[], document?: unknown) =>
  control(path, document)?.options.map((option) => option.value);

test("the exact manifest path determines a reference; similarly named prose stays text", () => {
  expect(values(["queries", "recent", "returns"])).toContain("Invoice[]");
  expect(values(["models", "Invoice", "namedBy"])).toContain("customer.name");
  expect(control(["models", "Invoice", "description"])).toBeUndefined();
  expect(control(["pages", "articles", "custom"])).toBeUndefined();
  expect(control(["incoming", "signup", "set", "name"])).toBeUndefined();
  expect(control(["navigation"])?.multiple).toBe(true);
  expect(values(["navigation"])).toEqual([
    "invoices",
    "customers",
    "calendar",
    "articles",
    "dashboard",
  ]);
});

test("typed dependent candidates recompute from local raw values, not the last saved IR", () => {
  const { document } = fixture();
  expect(values(["payments", "pay", "amount"], document)).toEqual(["total"]);
  const draft = referenceWith(document, ["payments", "pay", "on"], "Customer");
  expect(values(["payments", "pay", "amount"], draft)).toEqual(["fee"]);
  expect(referenceAt(document, ["payments", "pay", "on"])).toBe("Invoice");
  expect(referenceAt(draft, ["payments", "pay", "amount"])).toBe("total");
  expect(values(["pages", "invoices", "actions"])).toEqual(["send"]);
  expect(values(["pages", "calendar", "actions"])).toEqual([]);
});

test("parent and dependent changes use one existing validated writer operation", () => {
  const { document } = fixture();
  const intermediate = applyOperation({ spec }, "setPayment", { name: "pay", on: "Customer" });
  expect(intermediate.ok).toBe(false);
  let draft = referenceWith(document, ["payments", "pay", "on"], "Customer");
  draft = referenceWith(draft, ["payments", "pay", "amount"], "fee");
  const path = ["payments", "pay"];
  const value = referenceAt(draft, path);
  const existing = operationFor("smithable.yml", path, value, document);
  const result = existing
    ? applyOperation({ spec }, ...existing)
    : applyOperation({ spec }, "editSpec", { file: "smithable.yml", path, value });
  expect(result.ok).toBe(true);
  expect(referenceGroup(path)).toBe(true);
  expect(referenceAt(document, ["payments", "pay", "amount"])).toBe("total");
});

test("calendar filters and matching ends use their own validator restrictions", () => {
  expect(values(["pages", "calendar", "filters"])).toEqual([
    "customer",
    "status",
    "accepted",
    "owner",
  ]);
  expect(values(["pages", "calendar", "calendar", "ends"])).toEqual(["starts", "ends"]);
  const { document } = fixture();
  const duration = referenceWith(document, ["pages", "calendar", "calendar", "duration"], "count");
  expect(values(["pages", "calendar", "calendar", "ends"], duration)).toEqual([]);
  expect(values(["pages", "calendar", "calendar", "title"])).toContain("amountAgain");
});

test("each offered page search/filter/sort reference passes the actual operation", () => {
  for (const [key, op] of [
    ["search", "setSearch"],
    ["filters", "setFilters"],
    ["sortable", "setSortable"],
  ]) {
    for (const field of values(["pages", "invoices", key]) ?? []) {
      const result = applyOperation({ spec }, op, { page: "invoices", fields: [field] });
      expect(result.ok, `${op}: ${field}`).toBe(true);
    }
  }
});

test("incoming field keys and page filter keys are closed and keep template values separate", () => {
  const { ir, document } = fixture();
  const incoming = referenceKeys(["incoming", "signup", "set"], document, ir)?.map(
    (option) => option.value,
  );
  expect(incoming).toEqual(["name", "email", "fee", "joined"]);
  expect(
    referenceKeys(["pages", "invoices", "defaultFilter"], document, ir)?.map(
      (option) => option.value,
    ),
  ).toEqual(["status", "day"]);
  expect(referenceKeys(["models", "Invoice", "fields"], document, ir)).toBeUndefined();
});

test("dashboard measures include computed numbers accepted by core, never non-numbers", () => {
  const measures = values(["pages", "dashboard", "dashboard", "invoices", "sum"]);
  expect(measures).toContain("Invoice.amountAgain");
  expect(measures).not.toContain("Invoice.title");
  for (const field of measures ?? []) {
    const result = applyOperation({ spec }, "editSpec", {
      file: "smithable.yml",
      path: ["pages", "dashboard", "dashboard", "invoices"],
      value: { sum: field },
    });
    expect(result.ok, field).toBe(true);
  }
});

test("mail recipients follow draft event model and channel changes", () => {
  expect(values(["outgoing", "receipt", "recipient"])).toContain("customer.email");
  const { document } = fixture();
  const sms = referenceWith(document, ["outgoing", "receipt", "to"], "sms");
  expect(values(["outgoing", "receipt", "recipient"], sms)).not.toContain("customer.email");
  const event = referenceWith(document, ["outgoing", "receipt", "when"], "pay");
  expect(values(["outgoing", "receipt", "recipient"], event)).toContain("customer.email");
});

test("short pattern model choices pass inference; detailed choices retain models needing explicit fields", () => {
  const shortCalendar = referenceWith(
    fixture().document,
    ["pages", "calendar", "calendar"],
    "Invoice",
  );
  expect(values(["pages", "calendar", "calendar"], shortCalendar)).not.toContain("Invoice");
  const short = values(["pages", "articles", "articles"]);
  expect(short).toEqual(["Article"]);
  for (const model of short ?? []) {
    expect(
      applyOperation({ spec }, "editSpec", {
        file: "smithable.yml",
        path: ["pages", "articles", "articles"],
        value: model,
      }).ok,
    ).toBe(true);
  }
  expect(values(["pages", "calendar", "calendar", "model"])).toContain("Invoice");
});

test("required pairs and minimum multi-select sizes keep an atomic Save incomplete", () => {
  const pair = {
    type: "object",
    required: ["field", "ours"],
    properties: { field: { type: "string" }, ours: { type: "string" } },
  };
  expect(referenceComplete(pair, { field: "direction" })).toBe(false);
  expect(referenceComplete(pair, { field: "direction", ours: "in" })).toBe(true);
  const rules = {
    type: "array",
    items: {
      oneOf: [
        { type: "array", minItems: 2, items: { type: "string" } },
        {
          type: "object",
          required: ["fields"],
          properties: { fields: { type: "array", minItems: 2, items: { type: "string" } } },
        },
      ],
    },
  };
  expect(referenceComplete(rules, [["customer"]])).toBe(false);
  expect(referenceComplete(rules, [{ fields: ["customer"] }])).toBe(false);
  expect(referenceComplete(rules, [["customer", "title"]])).toBe(true);
  const page = {
    type: "object",
    properties: { crud: { type: "string" } },
    oneOf: [{ required: ["crud"] }, { required: ["calendar"] }],
  };
  expect(referenceComplete(page, {})).toBe(false);
  expect(referenceComplete(page, { crud: "Invoice" })).toBe(true);
});

test("removing an optional reference from a complete draft does not restore it through a merging setter", () => {
  const prepared = applyOperation({ spec }, "setThread", {
    model: "Message",
    body: "body",
    author: "sender",
  });
  expect(prepared.ok).toBe(true);
  if (!prepared.ok) throw Error(prepared.message);
  const document: unknown = parse(prepared.files.spec);
  const path = ["models", "Message", "thread"];
  const value = { body: "body" };
  expect(operationFor("smithable.yml", path, value, document)).toBeUndefined();
  const removed = applyOperation(prepared.files, "editSpec", {
    file: "smithable.yml",
    path,
    value,
  });
  expect(removed.ok).toBe(true);
  if (!removed.ok) throw Error(removed.message);
  expect(referenceAt(parse(removed.files.spec), [...path, "author"])).toBeUndefined();
});

test("payment creation events keep record recipients and unusable auth keeps the existing admin fallback", () => {
  const { ir, auth } = fixture();
  expect(auth).toBeUndefined(); // The minimal auth text is not a usable sign-in configuration.
  expect(referenceEventModel("pay", ir)).toBe("Invoice");
  const recipients = referenceMailRecipients("pay", ir, auth).map((option) => option.value);
  expect(recipients).toContain("owner");
  expect(recipients).toContain("customer.email");
  expect(referenceMailRecipients("daily", ir, auth).map((option) => option.value)).toEqual([
    "admin",
  ]);
});

test("complete non-model entry removals already use replacement rather than merging setters", () => {
  const { document } = fixture();
  for (const [area, name] of [
    ["pages", "invoices"],
    ["payments", "pay"],
    ["outgoing", "receipt"],
    ["incoming", "signup"],
  ]) {
    const before = referenceAt(document, [area, name]) as Record<string, unknown>;
    const [removed] = Object.keys(before);
    const next = { ...before };
    delete next[removed];
    expect(operationFor("smithable.yml", [area, name], next, document), area).toBeUndefined();
  }
});

test("a changed parent cannot submit until its old field is replaced in the new context", () => {
  const { document, ir, auth } = fixture();
  const path = ["payments", "pay"];
  let draft = referenceWith(document, [...path, "on"], "Customer");
  const schema = {
    type: "object",
    required: ["on", "amount", "when"],
    properties: { on: { type: "string" }, amount: { type: "string" }, when: { type: "string" } },
  };
  expect(referenceReady(schema, referenceAt(draft, path), path, draft, ir, auth)).toBe(false);
  draft = referenceWith(draft, [...path, "amount"], "fee");
  expect(referenceReady(schema, referenceAt(draft, path), path, draft, ir, auth)).toBe(true);
});

test("a new outgoing target name is a definition rather than a closed existing-reference choice", () => {
  const { document, ir, auth } = fixture();
  let draft = referenceWith(document, ["outgoing", "receipt", "to"], "notifyTarget");
  draft = referenceWith(draft, ["outgoing", "receipt", "recipient"], undefined);
  const path = ["outgoing", "receipt"];
  expect(referenceControl([...path, "to"], "notifyTarget", draft, ir, auth)).toBeUndefined();
  expect(
    referenceReady(
      { type: "object", required: ["when", "to"] },
      referenceAt(draft, path),
      path,
      draft,
      ir,
      auth,
    ),
  ).toBe(true);
  const result = applyOperation({ spec }, "editSpec", {
    file: "smithable.yml",
    path,
    value: referenceAt(draft, path),
  });
  expect(result.ok).toBe(true);
});
