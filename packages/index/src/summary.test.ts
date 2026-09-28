import { validateAuth, validateContent, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { summarize } from "./summary.js";

const crm = import.meta.glob("../../../examples/crm/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const file = (name: string) => crm[`../../../examples/crm/${name}`] as string;

test("the CRM in plain language, with labels from the content file", () => {
  const ir = validateSpec({ path: "smithable.yml", text: file("smithable.yml") }).ir;
  if (!ir) throw new Error("invalid spec");
  const auth = validateAuth({ path: "smithable.auth.yml", text: file("smithable.auth.yml") }).auth;
  const content = validateContent(
    { path: "smithable.content.yml", text: file("smithable.content.yml") },
    ir,
  ).content;
  const sections = summarize(ir, auth, content);
  expect(sections.map((s) => s.concept)).toEqual([
    "app",
    "model:Customer",
    "model:Order",
    "pages",
    "action:mergeCustomers",
    "auth",
  ]);
  expect(sections[1]?.sentences).toEqual([
    "Customers have:",
    "- a name (required)",
    "- an email (unique)",
    "- a phone",
    "- a segment (small business, enterprise or government, small business by default)",
    "- a credit limit (an amount)",
    "- notes",
    "Each customer can have an account manager (a user).",
    "Each customer lists its orders.",
    "The account manager owns the customer.",
    "Only sales users and admins can change customers.",
    "Only admins can delete customers.",
  ]);
  expect(sections[3]?.sentences).toEqual([
    "- Customers (lists customers; search by name or email; “Merge customers”)",
    "- Orders (lists orders; search by number or customer)",
  ]);
});
