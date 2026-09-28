import { validateAuth, validateContent, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { describeChange } from "./change-words.js";
import { summarize } from "./summary.js";
import { readSummaryEdit } from "./summary-edit.js";

const crm = import.meta.glob("../../../examples/crm/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const file = (name: string) => crm[`../../../examples/crm/${name}`] as string;
const ir = validateSpec({ path: "smithable.yml", text: file("smithable.yml") }).ir;
if (!ir) throw new Error("invalid spec");
const auth = validateAuth({ path: "smithable.auth.yml", text: file("smithable.auth.yml") }).auth;
const content = validateContent(
  { path: "smithable.content.yml", text: file("smithable.content.yml") },
  ir,
).content;
const customers = summarize(ir, auth, content).find((s) => s.concept === "model:Customer");
if (!customers) throw new Error("no customers");
const lines = customers.sentences;
const edit = (change: (lines: string[]) => string[]) =>
  readSummaryEdit(customers, change([...lines]).join("\n"), ir);
const after =
  (item: string, ...added: string[]) =>
  (l: string[]) => {
    l.splice(l.indexOf(item) + 1, 0, ...added);
    return l;
  };

test("lines added to, removed from or changed in a model's list of fields become operations", () => {
  expect(edit((l) => l)).toEqual([]);
  expect(
    edit(after("- notes", "- a website (a web address)", "- a VAT number (required, unique)")),
  ).toEqual([
    { op: "addField", args: { model: "Customer", field: "website", type: "url" } },
    { op: "addField", args: { model: "Customer", field: "vatNumber", type: "string! unique" } },
  ]);
  expect(edit((l) => l.filter((x) => x !== "- a phone"))).toEqual([
    { op: "removeField", args: { model: "Customer", field: "phone" } },
  ]);
  // The same field with new notes changes it.
  expect(edit((l) => l.map((x) => (x === "- a phone" ? "- a phone (required)" : x)))).toEqual([
    { op: "changeField", args: { model: "Customer", field: "phone", type: "phone!" } },
  ]);
});

test("anything else is left to the model", () => {
  expect(edit(after("- notes", "- a favourite colour (blue or green)"))).toBeUndefined();
  expect(edit((l) => [...l, "Customers must be approved."])).toBeUndefined();
  expect(edit((l) => ["Clients have:", ...l.slice(1)])).toBeUndefined();
});

test("changes are worded like the summary", () => {
  const words = (op: string, args: Record<string, unknown>) =>
    describeChange(op, args, ir, content);
  expect(words("addField", { model: "Customer", field: "website", type: "url" })).toBe(
    "Customers: added a website (a web address)",
  );
  expect(words("addField", { model: "Customer", field: "vatNumber", type: "string! unique" })).toBe(
    "Customers: added a vat number (required, unique)",
  );
  expect(words("changeField", { model: "Customer", field: "phone", type: "phone!" })).toBe(
    "Customers: now a phone (required)",
  );
  expect(words("removeField", { model: "Customer", field: "phone" })).toBe(
    "Customers: removed the phone",
  );
  expect(words("setAccess", { target: "model:Order.create", roles: ["admin"] })).toBe(
    "Only admins can add orders",
  );
  expect(words("setIcon", { page: "customers", icon: "users" })).toBeUndefined();
});
