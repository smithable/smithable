import { type AuthIR, applyOperation, validateAuth, validateSpec } from "@smithable/core";
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

// Sales may do everything a role can be granted, so an "only …" request takes something away.
const AUTH = `smithableAuth: 0.1
signIn: { providers: [google] }
defaultAccess: shared
roles:
  admin: all
  sales: { pages: all, create: all, write: all, delete: all }
defaultRole: sales
`;
const authOf = (text: string) =>
  validateAuth({ path: "smithable.auth.yml", text }, ir()).auth as AuthIR;
const ops = (request: string, auth = authOf(AUTH)) =>
  matchRequest(ir(), request, ROLES, auth)?.operations;

/** Every proposal must also apply: the grammar is only useful when its operations are valid. */
function applies(operations: PhraseOperation[]) {
  let files: { spec: string; auth?: string } = { spec: SPEC, auth: AUTH };
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
      { op: "addField", args: { model: "Customer", field: "phone", type: "phone", list: true } },
    ]);
    applies(o as PhraseOperation[]);
  });
  test("a grade is a choice, and a status says its values or asks for them (the stranger walk)", () => {
    expect(ops("Products should have a severity.")).toEqual([
      {
        op: "addField",
        args: { model: "Product", field: "severity", type: "low | medium | high", list: true },
      },
    ]);
    expect(ops("Products should have a priority.")?.[0]?.args.type).toBe("low | normal | high");
    expect(ops("Products should have a status: draft, on sale or sold out.")).toEqual([
      {
        op: "addField",
        args: { model: "Product", field: "status", type: "draft | onSale | soldOut", list: true },
      },
    ]);
    expect(refusalOf(ir(), "Products should have a status.", ROLES)?.refusal).toContain(
      "needs its values",
    );
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
    // Sales keep deleting products (and, as everyone, their own customers).
    const o = ops("Only admins may delete customers.");
    expect(o).toEqual([
      { op: "grant", args: { role: "sales", what: "delete", names: ["Product"] } },
    ]);
    applies(o as PhraseOperation[]);
    // Without the auth file, who may what is not guessed.
    expect(matchRequest(ir(), "Only admins may delete customers.", ROLES)).toBeUndefined();
  });
  test("a grant keeps whoever may already: sales should be able to delete customers (the stranger walk)", () => {
    const auth = authOf(
      "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\nroles: { admin: all, sales: { pages: all, delete: [Product] } }\ndefaultRole: sales\n",
    );
    // Sales keep deleting products; customers come beside them, which is every kind there is.
    expect(
      matchRequest(ir(), "Sales should be able to delete customers.", ROLES, auth)?.operations,
    ).toEqual([{ op: "grant", args: { role: "sales", what: "delete", names: ["all"] } }]);
    expect(matchRequest(ir(), "Let sales delete customers.", ROLES, auth)?.operations).toEqual([
      { op: "grant", args: { role: "sales", what: "delete", names: ["all"] } },
    ]);
    // Already allowed: said so, nothing proposed.
    expect(
      refusalOf(ir(), "Sales should be able to see customers.", ROLES, auth)?.refusal,
    ).toContain("shared access");
    // Not a role: another rule's sentence, not a refusal.
    expect(ops("Let people filter customers by segment on the customers page")?.[0]?.op).toBe(
      "setFilters",
    );
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
    expect(o).toEqual([{ op: "addField", args: { ...args, list: true } }]);
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
    // A kind of record named alone is the model (or its records), not the field that points to
    // it (A 105, found by the property tests); saying "field" makes it the field.
    const withOrders = applies(
      ops(
        "Add orders: each order has a number, belongs to a customer and has a total amount.",
      ) as PhraseOperation[],
    );
    const spec = validateSpec({ path: "smithable.yml", text: withOrders }, { roles: ROLES }).ir;
    if (!spec) throw new Error("invalid");
    for (const request of ["Delete Customer", "Remove the customers", "remove orders"])
      expect(matchRequest(spec, request, ROLES), request).toBeUndefined();
    expect(matchRequest(spec, "Remove the customer field from orders", ROLES)?.operations).toEqual([
      { op: "removeField", args: { model: "Order", field: "customer" } },
    ]);
  });

  test("access wordings", () => {
    const plain = authOf(
      "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\nroles: { admin: all, sales: { pages: all, create: all } }\ndefaultRole: sales\n",
    );
    expect(ops("Only admins and sales may change products", plain)).toEqual([
      { op: "grant", args: { role: "sales", what: "write", names: ["Product"] } },
    ]);
    expect(ops("Deleting products is only for admins")).toEqual([
      { op: "grant", args: { role: "sales", what: "delete", names: ["Customer"] } },
    ]);
    expect(ops("Only the owner may edit customers")).toEqual([
      { op: "grant", args: { role: "sales", what: "write", names: ["Product"] } },
    ]);
    expect(ops("Only admins may open the dashboard")).toEqual([
      { op: "grant", args: { role: "sales", what: "pages", names: ["customers", "products"] } },
    ]);
    // As asked already, or not a grant's to say: said so, nothing proposed.
    expect(refusalOf(ir(), "Only admins may read customers", ROLES, plain)?.refusal).toContain(
      "shared access",
    );
    expect(refusalOf(ir(), "Deleting products is only for admins", ROLES, plain)?.refusal).toBe(
      "Only admins and each one for their own can delete products already.",
    );
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
    const phone = [
      { op: "addField", args: { model: "Customer", field: "mobile", type: "phone", list: true } },
    ];
    expect(ops("customers should have a mobile number")).toEqual(phone);
    expect(ops("Add a mobile number to customers.")).toEqual(phone);
    expect(ops("let me add a mobile number to customers")).toEqual(phone);
    // "A field called region" is a field named region.
    expect(ops("add a field called region to customers")).toEqual([
      { op: "addField", args: { model: "Customer", field: "region", type: "string", list: true } },
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

  test("renaming a kind of record is the one change that renames it everywhere a person sees it", () => {
    const renamed = ops("rename products to articles");
    expect(renamed).toEqual([
      { op: "nameRecords", args: { model: "Product", one: "Article", several: "Articles" } },
    ]);
    // The change the app takes: the names for one and several, and the list page's title.
    const step = renamed?.[0];
    const result = applyOperation(
      { spec: SPEC, content: "smithableContent: 0.1\n" },
      step?.op ?? "",
      step?.args ?? {},
    );
    if (!result.ok) throw new Error(result.message);
    expect(result.files.content).toContain("label: Article");
    expect(result.files.content).toContain("pluralLabel: Articles");
    expect(result.files.content).toMatch(/products: \{ title: Articles \}|title: Articles/);
    expect(result.description).toBe('Call Product records "Article" and "Articles"');
    // A field is still renamed as a field.
    expect(ops("rename the customer's notes to remarks")).toEqual([
      { op: "renameField", args: { model: "Customer", from: "notes", to: "remarks" } },
    ]);
  });
});

test("Review a model's photos before others see them, with a review page when none lists it", () => {
  const market = `smithable: 0.1
app: { name: Market }
models:
  Listing:
    fields: { title: string!, photo: picture!, price: money }
pages:
  listings: { crud: Listing }
`;
  const listing = validateSpec({ path: "smithable.yml", text: market }).ir;
  if (!listing) throw new Error("invalid");
  const auth = authOf(AUTH);
  const asked = (request: string) => matchRequest(listing, request, ROLES, auth)?.operations;
  const wanted = [
    { op: "setReview", args: { model: "Listing", fields: ["photo"] } },
    { op: "addReviewPage", args: {} },
  ];
  expect(asked("Review photos before they are shown")).toEqual(wanted);
  expect(asked("Moderate listing photos before others see them")).toEqual(wanted);
  expect(asked("Check the photos of listings before anyone sees them")).toEqual(wanted);
  // A field that is no picture or file is for a model to read.
  expect(asked("Review prices before they are shown")).toBeUndefined();
  let files: { spec: string; auth?: string } = { spec: market, auth: AUTH };
  for (const { op, args } of wanted) {
    const result = applyOperation(files, op, args);
    if (!result.ok) throw new Error(`${op}: ${result.message}`);
    files = result.files;
  }
  expect(files.spec).toContain("review: [photo]");
});

describe("one person's time (appointments.md §2)", () => {
  const BARBERS = `smithable: 0.1
app: { name: Barbers, timezone: Europe/Mariehamn }
models:
  Service:
    fields: { name: string!, minutes: int! }
  Barber:
    fields: { name: string! }
  Appointment:
    fields: { service: Service!, barber: Barber!, startsAt: datetime!, name: string! }
`;
  const read = (text: string) =>
    validateSpec({ path: "smithable.yml", text }).ir as NonNullable<
      ReturnType<typeof validateSpec>["ir"]
    >;
  const apply = (text: string, ops: PhraseOperation[]) => {
    let files = { spec: text };
    for (const o of ops) {
      const done = applyOperation(files, o.op, o.args);
      if (!done.ok) throw new Error(done.message);
      files = { ...files, ...done.files };
    }
    return files.spec;
  };

  test("barbers have opening hours, day by day, keeping the rest of the schedule", () => {
    const first = matchRequest(read(BARBERS), "Barbers have opening hours 9 to 17 on weekdays.");
    expect(first?.rule).toBe("schedule hours");
    const once = apply(BARBERS, first?.operations ?? []);
    expect(read(once).models[1]?.schedule?.hours).toMatchObject({
      mon: [[540, 1020]],
      fri: [[540, 1020]],
    });
    // A second day keeps the first, and the breaks and the gap written since.
    const withBreak = once.replace(
      "        mon-fri: 09:00-17:00\n",
      "        mon-fri: 09:00-17:00\n      breaks: 12:00-12:30\n      gap: 10\n",
    );
    const second = matchRequest(read(withBreak), "the barbers are open 10-14 on saturdays");
    const twice = read(apply(withBreak, second?.operations ?? [])).models[1]?.schedule;
    expect(twice?.hours.mon).toEqual([[540, 1020]]);
    expect(twice?.hours.sat).toEqual([[600, 840]]);
    expect(twice?.breaks).toEqual([[720, 750]]);
    expect(twice?.gap).toBe(10);
    expect(
      refusalOf(read(BARBERS), "barbers have opening hours 17 to 9 on weekdays"),
    ).toBeDefined();
    // A clock's minutes run to 59: "9:99" is no time the rules read.
    expect(
      matchRequest(read(BARBERS), "barbers have opening hours 9:99 to 17 on weekdays"),
    ).toBeUndefined();
    // A day the rules do not know is a model's to read; a day is its name, not a word starting so.
    expect(
      matchRequest(read(BARBERS), "barbers have opening hours 9 to 17 on fortnights"),
    ).toBeUndefined();
    expect(matchRequest(read(BARBERS), "barbers have opening hours 9 to 17 on mondays")?.rule).toBe(
      "schedule hours",
    );
    expect(
      matchRequest(read(BARBERS), "barbers have opening hours 9 to 17 on monthly"),
    ).toBeUndefined();
    // Time away written in full (its own pair of times) stays as written, not the model alone.
    const away = `${BARBERS.replace(
      "    fields: { name: string! }\n",
      "    fields: { name: string! }\n    schedule:\n      hours: { mon-fri: 09:00-17:00 }\n      away: { model: TimeOff, from: startsAt, until: endsAt }\n",
    )}  TimeOff:
    fields: { barber: Barber!, notedAt: datetime!, startsAt: datetime!, endsAt: datetime! }
`;
    const kept = read(
      apply(
        away,
        matchRequest(read(away), "barbers are open 10-14 on saturdays")?.operations ?? [],
      ),
    ).models[1]?.schedule?.away;
    expect(kept).toMatchObject({ model: "TimeOff", from: "startsAt", until: "endsAt" });
  });

  test("an appointment takes its barber's time, its start and length found by shape", () => {
    const scheduled = apply(
      BARBERS,
      matchRequest(read(BARBERS), "barbers have opening hours 9 to 17 on weekdays")?.operations ??
        [],
    );
    const found = matchRequest(read(scheduled), "An appointment takes its barber's time");
    expect(found?.operations).toEqual([
      {
        op: "setOccupies",
        args: {
          model: "Appointment",
          resource: "barber",
          starts: "startsAt",
          duration: "service.minutes",
        },
      },
    ]);
    expect(read(apply(scheduled, found?.operations ?? [])).models[2]?.occupies?.duration).toBe(
      "service.minutes",
    );
    // Without a schedule there is no time to take; with two lengths to choose from, a model reads it.
    expect(matchRequest(read(BARBERS), "an appointment takes its barber's time")).toBeUndefined();
    const two = scheduled.replace("startsAt: datetime!,", "startsAt: datetime!, extra: int,");
    expect(matchRequest(read(two), "an appointment takes its barber's time")).toBeUndefined();
  });
});
