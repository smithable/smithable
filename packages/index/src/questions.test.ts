import { type AuthIR, type SpecIR, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { answerQuestion, looksLikeQuestion } from "./questions.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: CRM }
models:
  Customer:
    description: A company we sell to.
    fields:
      name: string!
      email: email!
      creditLimit: money
      orders: Order[]
    access: { delete: [admin] }
  Order:
    fields:
      number: string!
      customer: Customer!
      total: money
      status: draft | shipped
      vat: { type: money, formula: total * 0.24 }
      salesperson: User
pages:
  customers: { crud: Customer }
  orders: { crud: Order }
  home: { route: /, landing: { hero: {}, footer: {} } }
  stats: { dashboard: { open: { count: Order, where: { status: draft } } } }
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: `smithableAuth: 0.1
signIn: { providers: [google], allowedDomains: [acme.com] }
defaultAccess: shared
roles: { admin: {}, sales: {} }
defaultRole: sales
public: { pages: [home], read: [{ Order: { where: { status: shipped } } }] }
`,
  },
  ir,
).auth as AuthIR;
const ask = (q: string) => answerQuestion(ir, q, auth)?.text;

test("a question is told from a change by its wording", () => {
  expect(looksLikeQuestion("who can delete orders?")).toBe(true);
  expect(looksLikeQuestion("Is the schedule public")).toBe(true);
  expect(looksLikeQuestion("customers should have a phone number")).toBe(false);
});

test("who can do what, from the access rules", () => {
  expect(ask("who can delete customers?")).toBe("Admins can delete customers.");
  expect(ask("Who may change orders?")).toBe("The owner and admins can change orders.");
  expect(ask("who can see customers")).toBe("Sales users and admins can see customers.");
  expect(ask("who can open the customers page?")).toBe(
    "Sales users and admins can open the customers page.",
  );
  expect(ask("who can see orders?")).toContain(
    "Anyone, without signing in, for records where status is shipped",
  );
  expect(answerQuestion(ir, "who can delete invoices?", auth)).toBeUndefined();
});

test("whether something is public", () => {
  expect(ask("is the home page public?")).toBe("Yes: the home page opens without signing in.");
  expect(ask("are customers public?")).toBe(
    "No: customers need sign-in; sales users and admins can see them.",
  );
  expect(ask("can visitors see orders?")).toBe(
    "Yes: anyone can see orders where status is shipped without signing in.",
  );
});

test("what a model, a page or a field is", () => {
  expect(ask("what is a customer?")).toBe(
    "A company we sell to. Customers have a name (required), an email (required) and a credit limit (an amount).",
  );
  expect(ask("what is the orders page?")).toBe(
    "The orders page (/orders) lists orders, with a form to add, change and delete them.",
  );
  expect(ask("what is the order's vat?")).toBe(
    "The VAT of an order is an amount, calculated as the total times 0.24.",
  );
});

test("where a model or a field is used, and what a deletion does", () => {
  expect(ask("where are customers used?")).toBe(
    "Customers are shown on the customers page, and used by orders, which refer to a customer.",
  );
  expect(ask("where is the total used?")).toBe(
    "The total is used in the order form and list and in the VAT formula.",
  );
  expect(ask("what happens when I delete a customer?")).toBe(
    "When a customer is deleted, it cannot be deleted while orders still refer to it.",
  );
  expect(ask("what happens if an order is removed?")).toBe(
    "An order can be deleted; nothing else refers to it.",
  );
});
