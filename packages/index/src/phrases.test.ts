import { applyOperation, validateSpec } from "@smithable/core";
import { describe, expect, test } from "vitest";
import { matchRequest, type PhraseOperation, refusalOf } from "./phrases.js";

// The M7 benchmark's starting point: the CRM without phone numbers and orders.
const SPEC = `smithable: 0.1
app:
  name: CRM
models:
  Customer:
    fields:
      name: string!
      email: email unique
      segment: smb | enterprise | government
      creditLimit: money
      notes: text
      accountManager: User
  Product:
    fields:
      name: string!
      price: money!
pages:
  customers:
    crud: Customer
  products:
    crud: Product
  dashboard:
    dashboard:
      customers: { count: Customer }
navigation: [dashboard, customers, products]
`;
const ROLES = ["admin", "sales"];
const ir = () => {
  const result = validateSpec({ path: "smithable.yml", text: SPEC }, { roles: ROLES });
  if (!result.ir) throw new Error(result.diagnostics.map((d) => d.message).join("\n"));
  return result.ir;
};

const ops = (request: string) => matchRequest(ir(), request, ROLES)?.operations;

/** Every proposal must also apply: the grammar is only useful when its operations are valid. */
function applies(operations: PhraseOperation[]) {
  let files = { spec: SPEC };
  for (const { op, args } of operations) {
    const result = applyOperation(files, op, args);
    if (!result.ok) throw new Error(`${op}: ${result.message}`);
    files = result.files;
  }
  return files.spec;
}

describe("the seven benchmark tasks", () => {
  test("Customers should have a phone number", () => {
    const o = ops("Customers should have a phone number.");
    expect(o).toEqual([
      { op: "addField", args: { model: "Customer", field: "phone", type: "phone" } },
    ]);
    applies(o as PhraseOperation[]);
  });
  test("The customer email should be required", () => {
    const o = ops("The customer email should be required.");
    expect(o).toEqual([
      { op: "changeField", args: { model: "Customer", field: "email", type: "email! unique" } },
    ]);
    applies(o as PhraseOperation[]);
  });
  test("Add orders: each order has a number, belongs to a customer and has a total amount", () => {
    const o = ops(
      "Add orders: each order has a number, belongs to a customer and has a total amount.",
    );
    expect(o).toEqual([
      {
        op: "addModel",
        args: {
          model: "Order",
          fields: { number: "string!", customer: "Customer!", total: "money!" },
        },
      },
    ]);
    applies(o as PhraseOperation[]);
  });
  test("Add a page for orders, and show it in the menu", () => {
    const withOrders = applies(
      ops("Add orders: each order has a number and a total amount.") as PhraseOperation[],
    );
    const spec = validateSpec({ path: "smithable.yml", text: withOrders }, { roles: ROLES }).ir;
    if (!spec) throw new Error("invalid");
    expect(
      matchRequest(spec, "Add a page for orders, and show it in the menu.", ROLES)?.operations,
    ).toEqual([{ op: "addPage", args: { page: "orders", model: "Order" } }]);
  });
  test("Add a calendar for a model", () => {
    const calendar = [{ op: "addCalendarPage", args: { page: "calendar", model: "Customer" } }];
    expect(ops("Add a calendar for customers")).toEqual(calendar);
    expect(ops("Show customers in a calendar")).toEqual(calendar);
  });

  test("Add a blog or news page for a model", () => {
    const blog = [{ op: "addArticlesPage", args: { page: "blog", model: "Customer" } }];
    expect(ops("Add a blog for customers")).toEqual(blog);
    expect(ops("Show customers as articles")).toEqual(blog);
    expect(ops("Add a news page for customers")).toEqual([
      { op: "addArticlesPage", args: { page: "news", model: "Customer" } },
    ]);
  });

  test("Add a custom action by what it is for", () => {
    expect(ops("Add an action to archive customers")).toEqual([
      { op: "addAction", args: { action: "archiveCustomers", intent: "Archive customers." } },
    ]);
  });

  test("Add an admin page, for every model or some", () => {
    expect(ops("Add an admin page")).toEqual([{ op: "addDataPage", args: {} }]);
    expect(ops("Add a page to manage all data")).toEqual([{ op: "addDataPage", args: {} }]);
    expect(ops("Add a data page for products and customers")).toEqual([
      { op: "addDataPage", args: { models: ["Product", "Customer"] } },
    ]);
    // A name that is not a model is for a model to read.
    expect(ops("Add a data page for invoices")).toBeUndefined();
  });

  test("Add a users page; only invited people may sign in", () => {
    expect(ops("Add a page to invite colleagues.")).toEqual([{ op: "addUsersPage", args: {} }]);
    expect(ops("Add a team page")).toEqual([{ op: "addUsersPage", args: {} }]);
    const auth = { signIn: { providers: ["google"], selfSignUp: true } } as unknown as Parameters<
      typeof matchRequest
    >[3];
    expect(matchRequest(ir(), "Only invited people may sign in.", ROLES, auth)?.operations).toEqual(
      [{ op: "setSignUp", args: { who: "invited" } }],
    );
    // Already so: nothing to propose, and without the auth file nothing is guessed.
    expect(matchRequest(ir(), "Anyone can sign up", ROLES, auth)).toBeUndefined();
    expect(matchRequest(ir(), "Only invited people may sign in", ROLES)).toBeUndefined();
  });
  test("Only admins may delete customers", () => {
    const o = ops("Only admins may delete customers.");
    expect(o).toEqual([
      { op: "setAccess", args: { target: "model:Customer.delete", roles: ["admin"] } },
    ]);
    applies(o as PhraseOperation[]);
  });
  test("Make it possible to search customers by name on the customers page", () => {
    const o = ops("Make it possible to search customers by name on the customers page.");
    expect(o).toEqual([{ op: "setSearch", args: { page: "customers", fields: ["name"] } }]);
    const searched = applies(o as PhraseOperation[]);
    const spec = validateSpec({ path: "smithable.yml", text: searched }, { roles: ROLES }).ir;
    if (!spec) throw new Error("invalid");
    // A field already searched adds nothing, so a model says "already done"; a new one joins the list.
    expect(matchRequest(spec, "Search customers by name", ROLES)).toBeUndefined();
    expect(
      matchRequest(spec, "Customers should be searchable by name and email", ROLES)?.operations,
    ).toEqual([{ op: "setSearch", args: { page: "customers", fields: ["name", "email"] } }]);
  });
  test("Let people filter customers by segment and credit limit on the customers page", () => {
    const o = ops("Let people filter customers by segment and credit limit on the customers page.");
    expect(o).toEqual([
      { op: "setFilters", args: { page: "customers", fields: ["segment", "creditLimit"] } },
    ]);
    const filtered = applies(o as PhraseOperation[]);
    const spec = validateSpec({ path: "smithable.yml", text: filtered }, { roles: ROLES }).ir;
    if (!spec) throw new Error("invalid");
    // Already filtered by segment: "already done"; notes are text, which is searched, not filtered.
    expect(matchRequest(spec, "Customers can be filtered by segment", ROLES)).toBeUndefined();
    expect(matchRequest(spec, "Let people filter customers by notes", ROLES)).toBeUndefined();
    expect(
      matchRequest(spec, "Customers should be sortable by name and credit limit", ROLES)
        ?.operations,
    ).toEqual([
      { op: "setSortable", args: { page: "customers", fields: ["name", "creditLimit"] } },
    ]);
  });
  test("Let people save customers as favorites; let visitors contact the account manager of a customer", () => {
    expect(ops("Let people save customers as favorites.")).toEqual([
      { op: "setFavorites", args: { page: "customers", mode: "on" } },
    ]);
    expect(ops("Let visitors contact the account manager of a customer.")).toEqual([
      { op: "setContact", args: { page: "customers", to: "accountManager" } },
    ]);
    expect(ops("Let visitors contact the owner of a customer.")).toEqual([
      { op: "setContact", args: { page: "customers", to: "owner" } },
    ]);
  });
  test("Let people see only their own customers on the customers page", () => {
    expect(ops("Let people see only their own customers on the customers page.")).toEqual([
      { op: "setMine", args: { page: "customers", mode: "on" } },
    ]);
  });
  test("Show products first in the menu", () => {
    const o = ops("Show Products first in the menu.");
    expect(o).toEqual([
      {
        op: "setNavigation",
        args: { menu: "main", pages: ["products", "dashboard", "customers"] },
      },
    ]);
    applies(o as PhraseOperation[]);
  });
});

describe("other wordings", () => {
  test.each([
    ["Add a website to customers", { model: "Customer", field: "website", type: "url" }],
    [
      "Give each product a delivery date",
      { model: "Product", field: "deliveryDate", type: "date" },
    ],
    ["Customers need a VAT number", { model: "Customer", field: "vatNumber", type: "string" }],
    [
      "Add a VAT number field to customers.",
      { model: "Customer", field: "vatNumber", type: "string" },
    ],
    [
      "Add a nickname column to customers",
      { model: "Customer", field: "nickname", type: "string" },
    ],
    ["Products must have a description", { model: "Product", field: "description", type: "text!" }],
    [
      "Customers should have a required phone number",
      { model: "Customer", field: "phone", type: "phone!" },
    ],
    [
      "Please add a nickname to customers",
      { model: "Customer", field: "nickname", type: "string" },
    ],
    [
      "Track the number of employees for customers",
      { model: "Customer", field: "employeesCount", type: "int" },
    ],
  ])("%s", (request, args) => {
    const o = ops(request);
    expect(o).toEqual([{ op: "addField", args }]);
    applies(o as PhraseOperation[]);
  });

  test.each([
    ["Make the customer email optional", "email unique"],
    ["Make email required", "email! unique"],
    ["The customers' credit limit must be required", undefined],
  ])("%s", (request, type) => {
    const o = ops(request);
    if (type === undefined) {
      // "credit limit" resolves; the change is fine: money!
      expect(o).toEqual([
        { op: "changeField", args: { model: "Customer", field: "creditLimit", type: "money!" } },
      ]);
    } else
      expect(o).toEqual([{ op: "changeField", args: { model: "Customer", field: "email", type } }]);
  });

  test("a choice's required flag is a model's question (its default already makes it required)", () => {
    expect(ops("The customer segment should be required")).toBeUndefined();
  });

  test("rename and remove", () => {
    expect(ops("Rename the customer's notes to remarks")).toEqual([
      { op: "renameField", args: { model: "Customer", from: "notes", to: "remarks" } },
    ]);
    expect(ops("Remove the credit limit from customers")).toEqual([
      { op: "removeField", args: { model: "Customer", field: "creditLimit" } },
    ]);
    expect(ops("Customers no longer need notes")).toEqual([
      { op: "removeField", args: { model: "Customer", field: "notes" } },
    ]);
  });

  test("access wordings", () => {
    expect(ops("Only admins and sales may change products")).toEqual([
      { op: "setAccess", args: { target: "model:Product.write", roles: ["admin", "sales"] } },
    ]);
    expect(ops("Deleting products is only for admins")).toEqual([
      { op: "setAccess", args: { target: "model:Product.delete", roles: ["admin"] } },
    ]);
    expect(ops("Only the owner may edit customers")).toEqual([
      { op: "setAccess", args: { target: "model:Customer.write", roles: ["owner"] } },
    ]);
    expect(ops("Only admins may open the dashboard")).toEqual([
      { op: "setAccess", args: { target: "page:dashboard", roles: ["admin"] } },
    ]);
  });

  test("menu wordings", () => {
    expect(ops("Move customers before dashboard")).toEqual([
      {
        op: "setNavigation",
        args: { menu: "main", pages: ["customers", "dashboard", "products"] },
      },
    ]);
    expect(ops("Put the dashboard last in the menu")).toEqual([
      {
        op: "setNavigation",
        args: { menu: "main", pages: ["customers", "products", "dashboard"] },
      },
    ]);
    expect(ops("The menu should be: products, customers, dashboard")).toEqual([
      {
        op: "setNavigation",
        args: { menu: "main", pages: ["products", "customers", "dashboard"] },
      },
    ]);
  });
});

describe("what it leaves to a model", () => {
  test.each([
    "Make the app feel friendlier",
    "Only managers may delete customers", // no such role
    "Search customers by account manager", // a relation is not searchable
    "Customers should have a segment", // exists already
    "Rename phone to mobile", // no such field
    "Add a page for customers", // the page exists
    "Show invoices first in the menu", // no such page
    "Send an email when an order is placed",
    "Add orders: each order has a thing that we cannot name well, really",
    "Products should have a name", // exists
    "Delete the customers page",
  ])("%s", (request) => {
    expect(ops(request)).toBeUndefined();
  });
});

test("several lists of a model: the one at / takes a plain request, never My items or Saved", () => {
  const spec = validateSpec(
    {
      path: "smithable.yml",
      text: `smithable: 0.1
app: { name: Torget }
models:
  Item:
    fields: { title: string!, price: money, delivery: pickup | shipping }
pages:
  catalog: { crud: Item, route: / }
  myItems: { crud: Item, mine: true }
  saved: { crud: Item, favorites: only }
`,
    },
    { roles: ROLES },
  ).ir;
  if (!spec) throw new Error("invalid");
  expect(matchRequest(spec, "let visitors sort items by price", ROLES)?.operations).toEqual([
    { op: "setSortable", args: { page: "catalog", fields: ["price"] } },
  ]);
  expect(matchRequest(spec, "let visitors filter items by delivery", ROLES)?.operations).toEqual([
    { op: "setFilters", args: { page: "catalog", fields: ["delivery"] } },
  ]);
});

describe("the words box, as a first-time owner types into it (studio-review-2026-10-05, finding 1)", () => {
  const ops = (request: string) => matchRequest(ir(), request, ROLES)?.operations;

  test("its own printed example and its everyday variants add the field asked for", () => {
    const phone = [{ op: "addField", args: { model: "Customer", field: "mobile", type: "phone" } }];
    expect(ops("customers should have a mobile number")).toEqual(phone);
    expect(ops("Add a mobile number to customers.")).toEqual(phone);
    expect(ops("let me add a mobile number to customers")).toEqual(phone);
    // "A field called region" is a field named region.
    expect(ops("add a field called region to customers")).toEqual([
      { op: "addField", args: { model: "Customer", field: "region", type: "string" } },
    ]);
    expect(ops("make email required for customers")).toEqual([
      { op: "changeField", args: { model: "Customer", field: "email", type: "email! unique" } },
    ]);
  });

  test("a request that was read and cannot be made says why, in words to act on", () => {
    // Not for a model: it would meet the same.
    expect(ops("add a notes field to customers")).toBeUndefined();
    expect(refusalOf(ir(), "add a notes field to customers", ROLES)).toEqual({
      refusal: 'Customers already have a field called "notes".',
      rule: "add field",
    });
    // A request the rules do not read at all has no reason to give: a model reads it.
    expect(refusalOf(ir(), "send an email when a customer is created", ROLES)).toBeUndefined();
    expect(ops("send an email when a customer is created")).toBeUndefined();
  });

  test("renaming a kind of record renames it everywhere a person sees it, as texts", () => {
    const renamed = ops("rename products to articles");
    expect(renamed).toEqual([
      { op: "setText", args: { path: ["models", "Product", "label"], text: "Article" } },
      { op: "setText", args: { path: ["models", "Product", "pluralLabel"], text: "Articles" } },
      { op: "setText", args: { path: ["pages", "products", "title"], text: "Articles" } },
    ]);
    // Each is a change the app takes.
    let files = { spec: SPEC, content: "smithableContent: 0.1\n" };
    for (const step of renamed ?? []) {
      const result = applyOperation(files, step.op, step.args);
      if (!result.ok) throw new Error(`${step.op}: ${result.message}`);
      files = { spec: result.files.spec, content: result.files.content ?? "" };
    }
    expect(files.content).toContain("pluralLabel: Articles");
    // A field is still renamed as a field.
    expect(ops("rename the customer's notes to remarks")).toEqual([
      { op: "renameField", args: { model: "Customer", from: "notes", to: "remarks" } },
    ]);
  });
});
