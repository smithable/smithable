import { validateAuth, validateContent, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
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
const [first = "", ...rest] = customers.sentences;
const edit = (sentence: string, others = rest) =>
  readSummaryEdit(customers, [sentence, ...others].join("\n"), ir);

test("items added to, removed from or changed in a model's sentence become operations", () => {
  expect(edit(first)).toEqual([]);
  expect(
    edit(
      first.replace(
        " and notes.",
        ", a website (a web address), notes and a VAT number (required, unique).",
      ),
    ),
  ).toEqual([
    { op: "addField", args: { model: "Customer", field: "website", type: "url" } },
    { op: "addField", args: { model: "Customer", field: "vatNumber", type: "string! unique" } },
  ]);
  expect(edit(first.replace("a phone, ", ""))).toEqual([
    { op: "removeField", args: { model: "Customer", field: "phone" } },
  ]);
  // The same item with new notes changes the field.
  expect(edit(first.replace("a phone,", "a phone (required),"))).toEqual([
    { op: "changeField", args: { model: "Customer", field: "phone", type: "phone!" } },
  ]);
});

test("anything else is left to the model", () => {
  expect(
    edit(first.replace(" and notes.", " and a favourite colour (blue or green).")),
  ).toBeUndefined();
  expect(edit(first, ["Customers must be approved."])).toBeUndefined();
  expect(edit(`Clients have ${first.slice("Customers have ".length)}`)).toBeUndefined();
});
