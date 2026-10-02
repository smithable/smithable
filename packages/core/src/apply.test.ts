import { describe, expect, test } from "vitest";
import {
  applyOperation,
  findOperation,
  OPERATIONS,
  type ProjectFiles,
  parseOperationArgs,
} from "./apply.js";

const files = {
  spec: Object.values(
    import.meta.glob("../../../examples/crm/smithable.yml", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  )[0] as string,
  content: Object.values(
    import.meta.glob("../../../examples/crm/smithable.content.yml", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  )[0] as string,
  auth: Object.values(
    import.meta.glob("../../../examples/crm/smithable.auth.yml", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  )[0] as string,
};

function apply(name: string, positional: string[]) {
  const op = findOperation(name);
  if (!op) throw new Error(name);
  return applyOperation(files, name, parseOperationArgs(op, positional));
}

function ok(name: string, positional: string[]) {
  const result = apply(name, positional);
  if (!result.ok) throw new Error(`${result.message} ${JSON.stringify(result.diagnostics)}`);
  return result;
}

/** Lines added and removed between two texts, counting repeated lines correctly. */
function changed(before: string, after: string) {
  const count = (lines: string[]) => {
    const m = new Map<string, number>();
    for (const l of lines) m.set(l, (m.get(l) ?? 0) + 1);
    return m;
  };
  const a = count(before.split("\n"));
  const b = count(after.split("\n"));
  const minus = (x: Map<string, number>, y: Map<string, number>) =>
    [...x].flatMap(([l, n]) => Array<string>(Math.max(0, n - (y.get(l) ?? 0))).fill(l));
  return { added: minus(b, a), removed: minus(a, b) };
}

describe("operations", () => {
  test("addField Customer phone2 phone adds exactly one line", () => {
    const result = ok("addField", ["Customer", "website", "url"]);
    expect(changed(files.spec, result.files.spec)).toEqual({
      added: ["      website: url"],
      removed: [],
    });
    expect(result.description).toBe("Add field website (url) to Customer");
    expect(result.destructive).toBe(false);
    expect(result.files.content).toBe(files.content);
  });

  test("the rest of the arguments form the type", () => {
    const result = ok("addField", ["Order", "reference", "string!", "unique"]);
    expect(result.files.spec).toContain("      reference: string! unique\n");
  });

  test("addField rejects duplicates and bad types with a clear reason", () => {
    expect(apply("addField", ["Customer", "email", "email"])).toMatchObject({
      ok: false,
      message: 'Customer already has a field named "email".',
    });
    expect(apply("addField", ["Customer", "fax", "phne"])).toMatchObject({
      ok: false,
      message: 'Unknown field type "phne". Did you mean "phone"?',
    });
    expect(apply("addField", ["Custmer", "fax", "phone"])).toMatchObject({
      ok: false,
      message: 'There is no model named "Custmer".',
    });
  });

  test("changeField on a shorthand field replaces it; a type change is destructive", () => {
    const required = ok("changeField", ["Customer", "email", "email!", "unique"]);
    expect(changed(files.spec, required.files.spec)).toEqual({
      added: ["      email: email! unique"],
      removed: ["      email: email unique"],
    });
    expect(required.destructive).toBe(false);
    expect(ok("changeField", ["Customer", "notes", "string"]).destructive).toBe(true);
  });

  test("changeField on a long-form field changes only its type", () => {
    const result = ok("changeField", ["Customer", "creditLimit", "money!"]);
    expect(changed(files.spec, result.files.spec)).toEqual({
      added: ["        type: money!"],
      removed: ["        type: money"],
    });
  });

  test("renameField renames in the spec and the content file, and reports the rename", () => {
    const result = ok("renameField", ["Customer", "creditLimit", "maxCredit"]);
    expect(result.files.spec).toContain("      maxCredit:\n        type: money");
    expect(result.files.content).toContain("      maxCredit:\n        help:");
    expect(result.effects).toEqual([
      {
        kind: "rename-field",
        model: "Customer",
        from: "creditLimit",
        to: "maxCredit",
        storage: "value",
      },
    ]);
  });

  test("removeField is destructive and removes its content texts too", () => {
    const result = ok("removeField", ["Order", "placedAt"]);
    expect(result.destructive).toBe(true);
    expect(result.files.spec).not.toContain("placedAt");
    expect(result.files.content).not.toContain("placedAt");
    expect(result.files.content).not.toContain("  Order:");
    expect(result.files.content).toContain("  Customer:");
  });

  test("addModel takes fields as name=type pairs", () => {
    const result = ok("addModel", ["Product", "name=string!", "price=money!"]);
    expect(changed(files.spec, result.files.spec).added.sort()).toEqual(
      ["  Product:", "    fields:", "      name: string!", "      price: money!"].sort(),
    );
    expect(result.files.spec).toContain(
      "  Product:\n    fields:\n      name: string!\n      price: money!\n",
    );
  });

  test("addPage adds the page and appends it to the main menu", () => {
    const withModel = ok("addModel", ["Product", "name=string!"]).files;
    const result = applyOperation(withModel, "addPage", { page: "products", model: "Product" });
    if (!result.ok) throw new Error(result.message);
    expect(result.files.spec).toContain("  products:\n    crud: Product\n");
    expect(result.files.spec).toContain("navigation: [customers, orders, team, products]");
  });

  test("setNavigation reorders, and a named menu turns the list into menus", () => {
    expect(ok("setNavigation", ["main", "orders", "customers"]).files.spec).toContain(
      "navigation: [orders, customers]",
    );
    // A page leaving the menu is named, so it is not missed when confirming.
    expect(ok("setNavigation", ["main", "orders"]).description).toBe(
      "Set the main menu to orders (no longer in it: customers, team)",
    );
    const admin = ok("setNavigation", ["admin", "orders"]);
    expect(admin.files.spec).toContain(
      "navigation:\n  main: [customers, orders, team]\n  admin: [orders]\n",
    );
  });

  test("an operation that would make the spec invalid is refused with its diagnostics", () => {
    const result = applyOperation(files, "addPage", {
      page: "status",
      model: "Order",
      route: "/health",
    });
    expect(result).toMatchObject({
      ok: false,
      message: "addPage would make smithable.yml invalid.",
    });
    if (!result.ok) expect(result.diagnostics.map((d) => d.code)).toEqual(["reserved-route"]);
  });

  test("arguments are checked against the operation's schema", () => {
    expect(applyOperation(files, "addField", { model: "Customer", field: "x" })).toMatchObject({
      message: 'addField: "type" is missing.',
    });
    expect(
      applyOperation(files, "addField", {
        model: "Customer",
        field: "x",
        type: "url",
        color: "red",
      }),
    ).toMatchObject({
      message: 'addField: Unknown argument "color".',
    });
    // Types come from the shared JSON Schema check, in words.
    expect(
      applyOperation(files, "addField", { model: "Customer", field: 3, type: "url" }),
    ).toMatchObject({ message: 'addField: "field" must be a string.' });
    expect(applyOperation(files, "addFeild", {})).toMatchObject({
      message: 'Unknown operation "addFeild". Did you mean "addField"?',
    });
  });

  test("setRuleId turns a plain rule into { id, rule } and reports the qualified id", () => {
    const result = ok("setRuleId", ["action:mergeCustomers", "1", "move-orders"]);
    expect(result.files.spec).toContain(
      "      - { id: move-orders, rule: All orders of the duplicate move to the kept customer. }\n",
    );
    expect(result.effects).toEqual([
      {
        kind: "rule-identified",
        rule: "mergeCustomers.move-orders",
        text: "All orders of the duplicate move to the kept customer.",
      },
    ]);
    expect(apply("setRuleId", ["action:mergeCustomer", "1", "x"])).toMatchObject({
      ok: false,
      message: 'There is no concept "action:mergeCustomer". Did you mean "action:mergeCustomers"?',
    });
    expect(apply("setRuleId", ["action:mergeCustomers", "9", "x"])).toMatchObject({
      message: "action:mergeCustomers has 3 rule(s), not 9.",
    });
  });

  test("every operation's positional arguments exist in its schema", () => {
    for (const op of OPERATIONS) {
      const properties = Object.keys((op.schema.properties ?? {}) as object);
      for (const p of op.positional)
        expect(properties, op.name).toContain(p.replace(/^\.\.\./, ""));
    }
  });
});

describe("setAccess", () => {
  test("changes, adds and removes access exceptions, one line at a time", () => {
    expect(
      changed(files.spec, ok("setAccess", ["model:Customer.delete", "admin", "sales"]).files.spec),
    ).toEqual({
      added: ["      delete: [admin, sales]"],
      removed: ["      delete: [admin]"],
    });
    expect(
      changed(files.spec, ok("setAccess", ["model:Customer.read", "admin"]).files.spec),
    ).toEqual({
      added: ["      read: [admin]"],
      removed: [],
    });
    expect(changed(files.spec, ok("setAccess", ["page:orders", "admin"]).files.spec)).toEqual({
      added: ["    access: [admin]"],
      removed: [],
    });
    expect(changed(files.spec, ok("setAccess", ["action:mergeCustomers"]).files.spec)).toEqual({
      added: [],
      removed: ["    allow: [admin]"],
    });
  });

  test("returning every operation to the default removes the model's access", () => {
    const once = ok("setAccess", ["model:Order.write"]).files;
    const twice = applyOperation({ ...files, spec: once.spec }, "setAccess", {
      target: "model:Order.delete",
    });
    if (!twice.ok) throw new Error(twice.message);
    expect(changed(files.spec, twice.files.spec).removed.sort()).toEqual([
      "      delete: [admin]",
      "      write: [sales]",
      "    access:",
    ]);
  });

  test("unknown targets and roles are refused", () => {
    expect(apply("setAccess", ["model:Customer.remove", "admin"])).toMatchObject({
      ok: false,
      message: expect.stringContaining("model:Customer.delete"),
    });
    expect(apply("setAccess", ["page:custmers", "admin"])).toMatchObject({
      ok: false,
      message: 'There is no page named "custmers". Did you mean "customers"?',
    });
    const unknownRole = apply("setAccess", ["model:Customer.delete", "sale"]);
    expect(unknownRole.ok).toBe(false);
    if (!unknownRole.ok)
      expect(unknownRole.diagnostics.map((d) => [d.code, d.hint])).toEqual([
        ["unknown-role", 'Did you mean "sales"?'],
      ]);
  });
});

test("setSearch adds, changes and removes a page's search", () => {
  // Orders are searched by number and by their customer's name.
  const removed = ok("setSearch", ["orders"]);
  expect(changed(files.spec, removed.files.spec)).toEqual({
    added: [],
    removed: ["    search: [number, customer]"],
  });
  const added = applyOperation({ ...files, spec: removed.files.spec }, "setSearch", {
    page: "orders",
    fields: ["number"],
  });
  if (!added.ok) throw new Error(added.message);
  expect(changed(removed.files.spec, added.files.spec)).toEqual({
    added: ["    search: [number]"],
    removed: [],
  });
  const set = ok("setSearch", ["customers", "name"]);
  expect(changed(files.spec, set.files.spec)).toEqual({
    added: ["    search: [name]"],
    removed: ["    search: [name, email]"],
  });
  expect(changed(files.spec, ok("setSearch", ["customers"]).files.spec)).toEqual({
    added: [],
    removed: ["    search: [name, email]"],
  });
  expect(apply("setSearch", ["customers", "creditLimit"])).toMatchObject({ ok: false });
});

test("editSpec replaces the spec; removing a stored field is destructive; broken YAML is refused", () => {
  const added = applyOperation(files, "editSpec", {
    text: files.spec.replace("      notes: text\n", "      notes: text\n      website: url\n"),
  });
  expect(added).toMatchObject({ ok: true, destructive: false, effects: [] });
  const removed = applyOperation(files, "editSpec", {
    text: files.spec.replace("      phone: phone\n", ""),
  });
  expect(removed).toMatchObject({
    ok: true,
    destructive: true,
    effects: [{ kind: "remove-field", model: "Customer", field: "phone", storage: "value" }],
  });
  expect(applyOperation(files, "editSpec", { text: "models: [" })).toMatchObject({ ok: false });
  expect(
    applyOperation(files, "editSpec", { text: files.spec.replace("string!", "strng!") }),
  ).toMatchObject({
    ok: false,
    message: "editSpec would make smithable.yml invalid.",
  });
});

test("addQuery and addTile put a custom query on a new dashboard", () => {
  const query = ok("addQuery", ["churnRisk", "Customer"]);
  expect(query.files.spec).toContain(
    "queries:\n  churnRisk:\n    custom: true\n    returns: Customer[]\n",
  );
  const tile = applyOperation({ ...files, spec: query.files.spec }, "addTile", {
    page: "overview",
    tile: "atRisk",
    measure: "query",
    of: "churnRisk",
    limit: 5,
  });
  if (!tile.ok) throw new Error(tile.message);
  expect(tile.files.spec).toContain(
    "  overview:\n    dashboard:\n      atRisk:\n        query: churnRisk\n        limit: 5\n",
  );
  expect(tile.description).toBe("Add tile atRisk (query of churnRisk) to the overview dashboard");
  // A second tile joins the same dashboard; a crud page cannot take one.
  const second = applyOperation({ ...files, spec: tile.files.spec }, "addTile", {
    page: "overview",
    tile: "customers",
    measure: "count",
    of: "Customer",
  });
  expect(second).toMatchObject({ ok: true });
  expect(apply("addTile", ["customers", "x", "count", "Customer"])).toMatchObject({ ok: false });
  expect(apply("addQuery", ["churnRisk", "Client"])).toMatchObject({ ok: false });
});

test("setText changes, adds and restores visible texts; the content file decides which exist", () => {
  const set = (path: string[], text: string, from: ProjectFiles = files) =>
    applyOperation(from, "setText", { path, text });
  const changed = set(["pages", "customers", "subtitle"], "All our customers.");
  expect(changed.ok && changed.files.content).toContain("subtitle: All our customers.");
  const added = set(["models", "Customer", "fields", "email", "label"], "E-mail");
  expect(added.ok && added.files.content).toMatch(/email:\n\s+label: E-mail/);
  const restored = set(["pages", "orders", "subtitle"], "");
  expect(restored.ok && restored.files.content).not.toContain("Every order and where it stands.");
  expect(set(["pages", "nowhere", "title"], "Hi").ok).toBe(false);
  // Without a content file, one is made only when a text is set.
  const bare = { spec: files.spec, auth: files.auth };
  const first = set(["pages", "customers", "title"], "Clients", bare);
  expect(first.ok && first.files.content).toContain("title: Clients");
  const other = applyOperation(bare, "setIcon", { page: "customers", icon: "users" });
  expect(other.ok && other.files.content).toBeUndefined();
});

test("setText changes a landing section's list texts in place, by their position", () => {
  const raw = import.meta.glob("../../../examples/invoicing/smithable*.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const [spec, auth, content] = ["", ".auth", ".content"].map(
    (s) => raw[`../../../examples/invoicing/smithable${s}.yml`] as string,
  );
  const invoicing = { spec: spec as string, auth: auth as string, content };
  const set = (path: string, text: string) =>
    applyOperation(invoicing, "setText", { path: path.split("."), text });
  const question = set("pages.home.faq.items.1.question", "Who sees my invoices?");
  expect(question.ok && question.files.content).toContain("- question: Who sees my invoices?");
  const feature = set("pages.home.pricing.items.1.features.0", "Any number of clients");
  expect(feature.ok && feature.files.content).toContain("Any number of clients");
  expect(feature.ok && feature.files.content).toContain("Reminders for overdue invoices");
  expect(set("pages.home.faq.items.9.question", "Hi").ok).toBe(false);
});

test("removePage takes a page out of the spec, the menus and its texts", () => {
  const result = applyOperation(files, "removePage", { page: "orders" });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.files.spec).not.toMatch(/^ {2}orders:/m);
  expect(result.files.spec).toContain("navigation: [customers, team]");
  expect(result.files.content).not.toContain("Every order and where it stands.");
  expect(applyOperation(files, "removePage", { page: "nowhere" }).ok).toBe(false);
});

test("setPackage adds a library at an exact version to smithable.context.yml, and removes it", () => {
  const added = applyOperation(files, "setPackage", { name: "chart.js", version: "4.4.1" });
  expect(added.ok && added.files.context).toContain("chart.js: 4.4.1");
  if (!added.ok) return;
  const removed = applyOperation({ ...files, context: added.files.context }, "setPackage", {
    name: "chart.js",
    version: "none",
  });
  expect(removed.ok && removed.files.context).not.toContain("chart.js");
  expect(applyOperation(files, "setPackage", { name: "chart.js", version: "^4" }).ok).toBe(false);
  expect(applyOperation(files, "setPackage", { name: "Not A Name", version: "1.0.0" }).ok).toBe(
    false,
  );
});

test("addSection and removeSection change a landing page's sections, with their texts", () => {
  const raw = import.meta.glob("../../../examples/invoicing/smithable*.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const file = (s: string) => raw[`../../../examples/invoicing/smithable${s}.yml`] as string;
  const invoicing = { spec: file(""), auth: file(".auth"), content: file(".content") };
  const gallery = applyOperation(invoicing, "addSection", { page: "home", section: "gallery" });
  expect(gallery.ok && gallery.files.spec).toMatch(
    /callToAction: \{ button: overview \}\n\s+gallery:\n/,
  );
  expect(applyOperation(invoicing, "addSection", { page: "home", section: "faq" }).ok).toBe(false);
  expect(applyOperation(invoicing, "addSection", { page: "home", section: "news" }).ok).toBe(false);
  expect(applyOperation(invoicing, "addSection", { page: "overview", section: "faq" }).ok).toBe(
    false,
  );
  const removed = applyOperation(invoicing, "removeSection", { page: "home", section: "faq" });
  expect(removed.ok && removed.files.spec).not.toMatch(/^\s+faq:/m);
  expect(removed.ok && removed.files.content).not.toContain("Can I use my own invoice numbers?");
});

test("setShortcuts gives a hero up to four shortcuts to pages, and takes them away", () => {
  const raw = import.meta.glob("../../../examples/invoicing/smithable*.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const file = (s: string) => raw[`../../../examples/invoicing/smithable${s}.yml`] as string;
  const invoicing = { spec: file(""), auth: file(".auth"), content: file(".content") };
  const set = applyOperation(invoicing, "setShortcuts", {
    page: "home",
    pages: ["invoices", "clients"],
  });
  expect(set.ok && set.files.spec).toContain(
    "hero: { button: overview, shortcuts: [invoices, clients] }",
  );
  if (!set.ok) throw new Error(set.message);
  const removed = applyOperation({ ...invoicing, ...set.files }, "setShortcuts", { page: "home" });
  expect(removed.ok && removed.files.spec).not.toContain("shortcuts");
  // A hero with no options yet gets them.
  const landing = applyOperation(files, "addLandingPage", { page: "home" });
  if (!landing.ok) throw new Error(landing.message);
  const bare = applyOperation({ ...files, ...landing.files }, "setShortcuts", {
    page: "home",
    pages: ["customers"],
  });
  expect(bare.ok && bare.files.spec).toContain("shortcuts: [customers]");
  const five = ["overview", "invoices", "clients", "settings", "welcome"];
  expect(applyOperation(invoicing, "setShortcuts", { page: "home", pages: five }).ok).toBe(false);
  expect(applyOperation(invoicing, "setShortcuts", { page: "home", pages: ["nowhere"] }).ok).toBe(
    false,
  );
  expect(
    applyOperation(invoicing, "setShortcuts", { page: "invoices", pages: ["clients"] }).ok,
  ).toBe(false);
});

test("addLandingPage makes a public landing page with a hero and a footer", () => {
  const result = applyOperation(files, "addLandingPage", { page: "home" });
  expect(result).toMatchObject({ ok: true });
  if (!result.ok) return;
  expect(result.files.spec).toMatch(/home:\n\s+route: \/\n\s+landing:\n\s+hero:\n\s+footer:/);
  expect(result.files.auth).toMatch(/pages: \[.*home\]|pages:\n(\s+- .*\n)*\s+- home/);
  const again = applyOperation({ ...files, ...result.files }, "addLandingPage", { page: "about" });
  expect(again.ok && again.files.spec).toContain("route: /about");
  const closed = applyOperation(files, "addLandingPage", { page: "intro", public: false });
  expect(closed.ok && closed.files.auth).not.toContain("intro");
});

test("addUsersPage adds one users page to the menu; setSignUp closes and reopens sign-up", () => {
  // The CRM already has its team page and closed sign-up: start from one without them.
  const open = applyOperation(files, "setSignUp", { who: "anyone" });
  expect(open.ok && open.files.auth).not.toContain("selfSignUp");
  const plain = applyOperation({ ...files, ...(open.ok ? open.files : {}) }, "removePage", {
    page: "team",
  });
  if (!plain.ok) throw new Error(plain.message);
  const without = { ...files, ...plain.files };
  expect(applyOperation(without, "addUsersPage", { page: "people" }).ok && "").toBe("");
  const result = applyOperation(without, "addUsersPage", {});
  expect(result).toMatchObject({ ok: true });
  if (!result.ok) return;
  expect(result.files.spec).toContain("team:\n    users: manage");
  expect(result.files.spec).toContain("navigation: [customers, orders, team]");
  const again = applyOperation({ ...without, ...result.files }, "addUsersPage", { page: "people" });
  expect(again).toMatchObject({ ok: false, message: expect.stringContaining("team page") });
  const closed = applyOperation({ ...without, ...result.files }, "setSignUp", { who: "invited" });
  expect(closed.ok && closed.files.auth).toMatch(
    /signIn:\n {2}providers: \[google\]\n {2}allowedDomains: .*\n {2}selfSignUp: false\n/,
  );
  // Closing sign-up without a users page is refused by the auth file's check.
  expect(applyOperation(without, "setSignUp", { who: "invited" })).toMatchObject({ ok: false });
});

test("an edit the files cannot take fails the operation instead of throwing", () => {
  // "models:" with nothing under it: a label cannot be added below it.
  const content = "smithableContent: 0.1\nmodels:\n";
  const result = applyOperation({ ...files, content }, "setText", {
    path: ["models", "Customer", "fields", "email", "label"],
    text: "E-mail",
  });
  expect(result.ok).toBe(false);
});

test("an edited spec with a plugin's section still asks before it drops a field", () => {
  const greeting = {
    key: "greeting",
    description: "A greeting.",
    schema: { type: "string" },
    expand: () => ({}),
  };
  const spec = `${files.spec}\ngreeting: Hello\n`;
  const edited = spec.replace(/^ {6}phone: .*\n/m, "");
  expect(edited).not.toBe(spec);
  const result = applyOperation({ ...files, spec, plugins: [greeting] }, "editSpec", {
    text: edited,
  });
  expect(result).toMatchObject({ ok: true, destructive: true });
});

const specs = import.meta.glob("../../../examples/*/smithable.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const example = (name: string) => ({
  spec: specs[`../../../examples/${name}/smithable.yml`] as string,
});

test("a rename follows into formulas, their examples, dashboard tiles and onboarding steps", () => {
  const crm = applyOperation(example("crm"), "renameField", {
    model: "Order",
    from: "shippingMethod",
    to: "shipping",
  });
  if (!crm.ok) throw new Error(crm.message);
  expect(crm.files.spec).toContain('formula: IF(AND(shipping = "standard", total > 100), 0,');
  expect(crm.files.spec).toContain("- input: { total: 150, shipping: standard }");
  expect(crm.files.spec).not.toContain("shippingMethod");

  const invoicing = example("invoicing");
  const lines = applyOperation(invoicing, "renameField", {
    model: "InvoiceLine",
    from: "amount",
    to: "lineTotal",
  });
  if (!lines.ok) throw new Error(lines.message);
  expect(lines.files.spec).toContain("formula: SUM(lines.lineTotal)");
  const total = applyOperation(invoicing, "renameField", {
    model: "Invoice",
    from: "total",
    to: "amount",
  });
  if (!total.ok) throw new Error(total.message);
  expect(total.files.spec).toContain(
    "outstanding: { sum: Invoice.amount, where: { status: sent } }",
  );
  const vat = applyOperation(invoicing, "renameField", {
    model: "BusinessProfile",
    from: "vatNumber",
    to: "vat",
  });
  if (!vat.ok) throw new Error(vat.message);
  expect(vat.files.spec).toContain("business: [businessName, vat]");
});

test("a removal leaves onboarding steps without the field, and is refused while a tile uses it", () => {
  const invoicing = example("invoicing");
  const iban = applyOperation(invoicing, "removeField", {
    model: "BusinessProfile",
    field: "iban",
  });
  if (!iban.ok) throw new Error(iban.message);
  expect(iban.files.spec).toContain("payment: [paymentTermDays]");
  expect(
    applyOperation(invoicing, "removeField", { model: "Invoice", field: "status" }),
  ).toMatchObject({
    ok: false,
    message:
      'The "outstanding" tile of the overview page uses Invoice.status; change or remove the tile first.',
  });
});

test("setApp, setRoles and setPublic build an app's frame from nothing", () => {
  const blank = {
    spec: "smithable: 0.1\napp:\n  name: App\n",
    auth: "smithableAuth: 0.1\nsignIn:\n  providers: [google]\ndefaultAccess: private\n",
  };
  const app = applyOperation(blank, "setApp", {
    name: "Stillwater Yoga",
    description: "Classes and booking.",
    currency: "EUR",
    timezone: "Europe/Mariehamn",
  });
  if (!app.ok) throw new Error(app.message);
  expect(app.files.spec).toContain(
    "  name: Stillwater Yoga\n  description: Classes and booking.\n  currency: EUR\n  timezone: Europe/Mariehamn\n",
  );
  expect(applyOperation(blank, "setApp", { timezone: "Mars/Olympus" })).toMatchObject({
    ok: false,
  });
  const lines = applyOperation(blank, "setApp", {
    description: "Tickets:\n  priorities and owners",
  });
  expect(lines.ok && lines.files.spec).toContain('description: "Tickets: priorities and owners"');
  const roles = applyOperation({ ...blank, ...app.files }, "setRoles", {
    roles: { admin: "Studio staff.", member: "A student." },
  });
  if (!roles.ok) throw new Error(roles.message);
  expect(roles.files.auth).toContain(
    "roles:\n  admin:\n    description: Studio staff.\n  member:\n    description: A student.\ndefaultRole: member\n",
  );
  expect(
    applyOperation({ ...blank, ...app.files }, "setRoles", { roles: { owner: "x" } }),
  ).toMatchObject({ ok: false });
  const withModel = applyOperation({ ...blank, ...roles.files }, "addModel", {
    model: "ClassType",
    fields: { name: "string!" },
  });
  if (!withModel.ok) throw new Error(withModel.message);
  const page = applyOperation({ ...blank, ...withModel.files }, "addPage", {
    page: "classes",
    model: "ClassType",
  });
  if (!page.ok) throw new Error(page.message);
  const pub = applyOperation({ ...blank, ...page.files }, "setPublic", {
    pages: ["classes"],
    read: ["ClassType"],
  });
  if (!pub.ok) throw new Error(pub.message);
  expect(pub.files.auth).toContain("public:\n  pages: [classes]\n  read: [ClassType]\n");
  const closed = applyOperation({ ...blank, ...pub.files }, "setPublic", { read: [] });
  expect(closed.ok && closed.files.auth).not.toContain("read:");
  expect(
    applyOperation({ ...blank, ...page.files }, "setPublic", { pages: ["nowhere"] }),
  ).toMatchObject({ ok: false });
});

test("a boolean argument is a bare flag on the command line", () => {
  const op = findOperation("addTheme");
  if (!op) throw new Error("no addTheme");
  expect(parseOperationArgs(op, ["forest", "--text", "x", "--use"])).toEqual({
    name: "forest",
    text: "x",
    use: true,
  });
  expect(parseOperationArgs(op, ["forest", "--use", "--text", "x"])).toEqual({
    name: "forest",
    text: "x",
    use: true,
  });
  expect(parseOperationArgs(op, ["forest", "--use", "false"])).toEqual({
    name: "forest",
    use: false,
  });
});
