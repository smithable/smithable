import { describe, expect, test } from "vitest";
import {
  applyOperation,
  findOperation,
  OPERATIONS,
  type ProjectFiles,
  parseOperationArgs,
} from "./apply.js";
import { validateSpec } from "./spec.js";

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

test("setFilters and setSortable add, change and remove a list's filters and sort choice", () => {
  const filtered = ok("setFilters", ["customers", "segment", "creditLimit"]);
  expect(changed(files.spec, filtered.files.spec)).toEqual({
    added: ["    filters: [segment, creditLimit]"],
    removed: [],
  });
  const sorted = applyOperation({ ...files, spec: filtered.files.spec }, "setSortable", {
    page: "customers",
    fields: ["name", "creditLimit"],
  });
  if (!sorted.ok) throw new Error(sorted.message);
  expect(changed(filtered.files.spec, sorted.files.spec)).toEqual({
    added: ["    sortable: [name, creditLimit]"],
    removed: [],
  });
  const gone = applyOperation({ ...files, spec: sorted.files.spec }, "setFilters", {
    page: "customers",
  });
  if (!gone.ok) throw new Error(gone.message);
  expect(changed(sorted.files.spec, gone.files.spec)).toEqual({
    added: [],
    removed: ["    filters: [segment, creditLimit]"],
  });
  // Text is searched, not filtered; a picture has no order; a page must exist.
  expect(apply("setFilters", ["customers", "notes"])).toMatchObject({ ok: false });
  expect(apply("setSortable", ["customers", "notes"])).toMatchObject({ ok: false });
  expect(apply("setFilters", ["nowhere", "segment"])).toMatchObject({ ok: false });
});

test("setFavorites and setContact add, change and remove a page's favorites and contact block", () => {
  const saved = ok("setFavorites", ["customers"]);
  expect(changed(files.spec, saved.files.spec)).toEqual({
    added: ["    favorites: true"],
    removed: [],
  });
  const only = applyOperation({ ...files, spec: saved.files.spec }, "setFavorites", {
    page: "customers",
    mode: "only",
  });
  if (!only.ok) throw new Error(only.message);
  expect(changed(saved.files.spec, only.files.spec)).toEqual({
    added: ["    favorites: only"],
    removed: ["    favorites: true"],
  });
  const off = applyOperation({ ...files, spec: only.files.spec }, "setFavorites", {
    page: "customers",
    mode: "off",
  });
  if (!off.ok) throw new Error(off.message);
  expect(changed(only.files.spec, off.files.spec)).toEqual({
    added: [],
    removed: ["    favorites: only"],
  });
  // The CRM's customers have an account manager, a user: the contact block may mail them.
  const owner = ok("setContact", ["customers", "owner"]);
  expect(changed(files.spec, owner.files.spec)).toEqual({
    added: ["    contact: owner"],
    removed: [],
  });
  const manager = applyOperation({ ...files, spec: owner.files.spec }, "setContact", {
    page: "customers",
    to: "accountManager",
  });
  if (!manager.ok) throw new Error(manager.message);
  expect(changed(owner.files.spec, manager.files.spec)).toEqual({
    added: ["    contact: accountManager"],
    removed: ["    contact: owner"],
  });
  const gone = applyOperation({ ...files, spec: manager.files.spec }, "setContact", {
    page: "customers",
  });
  if (!gone.ok) throw new Error(gone.message);
  expect(changed(manager.files.spec, gone.files.spec)).toEqual({
    added: [],
    removed: ["    contact: accountManager"],
  });
  // Not a user field; no such page.
  expect(apply("setContact", ["customers", "name"])).toMatchObject({ ok: false });
  expect(apply("setFavorites", ["nowhere"])).toMatchObject({ ok: false });
});

test("setMine makes a page list only the viewer's own records, and back", () => {
  const mine = ok("setMine", ["customers"]);
  expect(changed(files.spec, mine.files.spec)).toEqual({ added: ["    mine: true"], removed: [] });
  const off = applyOperation({ ...files, spec: mine.files.spec }, "setMine", {
    page: "customers",
    mode: "off",
  });
  if (!off.ok) throw new Error(off.message);
  expect(changed(mine.files.spec, off.files.spec)).toEqual({
    added: [],
    removed: ["    mine: true"],
  });
  expect(apply("setMine", ["nowhere"])).toMatchObject({ ok: false });
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
  // A tile's name is a name in the generated code too: camelCase, in the operation and the file.
  expect(apply("addTile", ["overview", "total-count", "count", "Customer"])).toMatchObject({
    ok: false,
  });
  const kebab = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\nmodels:\n  Customer: { fields: { name: text } }\npages:\n  board:\n    dashboard:\n      total-count: { count: Customer }\n",
  });
  expect(kebab.diagnostics.map((d) => d.code)).toContain("invalid-name");
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
    /signIn:\n {2}providers: \[email\]\n {2}allowedDomains: .*\n {2}selfSignUp: false\n/,
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
  // The status is used by the starter's standard actions first, and by a tile without them.
  expect(
    applyOperation(invoicing, "removeField", { model: "Invoice", field: "status" }),
  ).toMatchObject({
    ok: false,
    message: 'The action "markSent" uses Invoice.status; change or remove the action first.',
  });
  const withoutActions = {
    ...invoicing,
    spec: invoicing.spec
      .replace(/\nactions:\n[\s\S]*?\n\n/, "\n")
      .replace("    actions: [markSent, markPaid]\n", ""),
  };
  expect(
    applyOperation(withoutActions, "removeField", { model: "Invoice", field: "status" }),
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

test("an operation whose name is not text is refused, not thrown", () => {
  expect(applyOperation(files, 42 as unknown as string, {})).toMatchObject({
    ok: false,
    message: expect.stringContaining("must be text"),
  });
});

describe("standard actions", () => {
  const cancel = () =>
    applyOperation(files, "addAction", {
      action: "cancelOrder",
      on: "Order",
      when: { status: "placed | shipped" },
      set: { status: "canceled", total: "0" },
    });

  test("addAction with on and set adds a standard action and puts it on the model's crud page", () => {
    const result = cancel();
    if (!result.ok) throw new Error(result.message);
    expect(result.description).toBe("Add the standard action cancelOrder");
    expect(result.files.spec).toContain(
      "  cancelOrder:\n    on: Order\n    when:\n      status: [placed, shipped]\n    set:\n      status: canceled\n      total: 0\n",
    );
    expect(result.files.spec).toMatch(
      / {2}orders:\n {4}crud: Order\n {4}search: \[number, customer\]\n {4}actions: \[cancelOrder\]/,
    );
  });

  test("the options parse from the command line", () => {
    const op = findOperation("addAction");
    if (!op) throw new Error("addAction");
    expect(
      parseOperationArgs(op, ["archive", "--on", "Order", "--set", "status=canceled"]),
    ).toMatchObject({ action: "archive", on: "Order", set: { status: "canceled" } });
    // Repeated pairs add up, and a formula's commas stay in the formula.
    expect(
      parseOperationArgs(op, [
        "remind",
        "--on",
        "Order",
        "--set",
        "status=placed",
        "--set",
        'due=DATEADD(TODAY(), 14, "day"),note=a',
      ]).set,
    ).toEqual({ status: "placed", due: 'DATEADD(TODAY(), 14, "day")', note: "a" });
  });

  test("a standard action takes no input, and needs a model that exists", () => {
    expect(
      applyOperation(files, "addAction", {
        action: "x",
        on: "Order",
        set: { status: "canceled" },
        input: { why: "text" },
      }),
    ).toMatchObject({ ok: false, message: expect.stringContaining("no input") });
    expect(
      applyOperation(files, "addAction", { action: "x", on: "Ordr", set: { status: "canceled" } }),
    ).toMatchObject({ ok: false, message: 'There is no model named "Ordr".' });
    expect(
      applyOperation(files, "addAction", { action: "x", on: "Order", set: { status: "lost" } }),
    ).toMatchObject({ ok: false });
  });

  test("a renamed field is renamed in when, set and the formulas there", () => {
    const first = cancel();
    if (!first.ok) throw new Error(first.message);
    const withFormula = applyOperation({ ...files, spec: first.files.spec }, "addAction", {
      action: "discount",
      on: "Order",
      set: { total: "(total * 0.5)" },
    });
    if (!withFormula.ok) throw new Error(withFormula.message);
    const renamed = applyOperation({ ...files, spec: withFormula.files.spec }, "renameField", {
      model: "Order",
      from: "total",
      to: "amount",
    });
    if (!renamed.ok) throw new Error(renamed.message);
    expect(renamed.files.spec).toContain("    set:\n      status: canceled\n      amount: 0\n");
    expect(renamed.files.spec).toContain("      amount: (amount * 0.5)\n");
  });

  test("a field or choice value an action uses cannot be removed", () => {
    const first = cancel();
    if (!first.ok) throw new Error(first.message);
    const project = { ...files, spec: first.files.spec };
    expect(
      applyOperation(project, "removeField", { model: "Order", field: "total" }),
    ).toMatchObject({ ok: false, message: expect.stringContaining('The action "cancelOrder"') });
    expect(
      applyOperation(project, "changeField", {
        model: "Order",
        field: "status",
        type: "draft | placed | canceled",
      }),
    ).toMatchObject({ ok: false, message: expect.stringContaining('The action "cancelOrder"') });
  });
});

test("setProviders chooses the sign-in methods in button order, and refuses none or an unknown one", () => {
  const result = applyOperation(files, "setProviders", { providers: ["email", "google", "email"] });
  if (!result.ok) throw new Error(result.message);
  expect(result.files.auth).toMatch(/signIn:\n {2}providers: \[email, google\]\n/);
  expect(result.description).toBe("Sign in with a code by email or Google");
  expect(applyOperation(files, "setProviders", { providers: [] })).toMatchObject({
    ok: false,
    message: "An app with sign-in needs at least one way to sign in.",
  });
  expect(applyOperation(files, "setProviders", { providers: ["gogle"] })).toMatchObject({
    ok: false,
    message: expect.stringContaining('must be one of "email", "google", "facebook"'),
  });
});

describe("standard actions that ask and add", () => {
  const status = example("status");

  test("addAction writes an asked value as nothing and groups --add pairs by model", () => {
    const result = applyOperation(status, "addAction", {
      action: "note",
      on: "Incident",
      set: { summary: "" },
      add: {
        "IncidentUpdate.at": "NOW()",
        "IncidentUpdate.status": "monitoring",
        "IncidentUpdate.message": "",
      },
    });
    if (!result.ok) throw new Error(result.message);
    expect(result.files.spec).toContain(
      "  note:\n    on: Incident\n    set:\n      summary:\n    add:\n      IncidentUpdate:\n        at: NOW()\n        status: monitoring\n        message:\n",
    );
  });

  test("a field of an added record follows a rename, and cannot be removed while added", () => {
    const first = applyOperation(status, "addAction", {
      action: "note",
      on: "Incident",
      add: {
        "IncidentUpdate.at": "NOW()",
        "IncidentUpdate.status": "monitoring",
        "IncidentUpdate.message": "",
      },
    });
    if (!first.ok) throw new Error(first.message);
    const project = { ...status, spec: first.files.spec };
    const renamed = applyOperation(project, "renameField", {
      model: "IncidentUpdate",
      from: "message",
      to: "text",
    });
    if (!renamed.ok) throw new Error(renamed.message);
    expect(renamed.files.spec).toContain("        text:\n");
    expect(
      applyOperation(project, "removeField", { model: "IncidentUpdate", field: "incident" }),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining("uses IncidentUpdate.incident"),
    });
  });
});

describe("standard actions that copy, and ME()", () => {
  const invoicing = example("invoicing");

  test("addAction --copy and --with write a copy action; a bare --copy copies as is", () => {
    const op = findOperation("addAction");
    if (!op) throw new Error("addAction");
    expect(
      parseOperationArgs(op, ["dup", "--on", "Invoice", "--copy", "--with", "lines"]),
    ).toMatchObject({
      copy: {},
      with: ["lines"],
    });
    const result = applyOperation(invoicing, "addAction", {
      action: "duplicate",
      on: "Invoice",
      copy: { status: "draft", number: "" },
      with: ["lines"],
    });
    if (!result.ok) throw new Error(result.message);
    expect(result.files.spec).toContain(
      "  duplicate:\n    on: Invoice\n    copy:\n      status: draft\n      number:\n    with: [lines]\n",
    );
  });

  test("a copy needs its own unique number; a renamed list follows into with", () => {
    expect(
      applyOperation(invoicing, "addAction", { action: "dup", on: "Invoice", copy: {} }),
    ).toMatchObject({ ok: false });
    const first = applyOperation(invoicing, "addAction", {
      action: "duplicate",
      on: "Invoice",
      copy: { number: "" },
      with: ["lines"],
    });
    if (!first.ok) throw new Error(first.message);
    const renamed = applyOperation({ ...invoicing, spec: first.files.spec }, "renameField", {
      model: "Invoice",
      from: "lines",
      to: "items",
    });
    if (!renamed.ok) throw new Error(renamed.message);
    expect(renamed.files.spec).toContain("    with: [items]\n");
  });
});

test("addAction takes what a model writes: add by model, JSON values and a list in when", () => {
  const status = example("status");
  const spec = status.spec
    .replace(/\nactions:[\s\S]*?\n\npages:/, "\n\npages:")
    .replace("    actions: [identified, monitoring, resolve]\n", "");
  const result = applyOperation({ ...status, spec }, "addAction", {
    action: "resolve",
    on: "Incident",
    when: { status: ["investigating", "identified"] },
    set: { status: "resolved", summary: null },
    add: { IncidentUpdate: { at: "NOW()", status: "resolved", message: "Done." } },
  });
  if (!result.ok) throw new Error(result.message);
  expect(result.files.spec).toContain(
    "    when:\n      status: [investigating, identified]\n    set:\n      status: resolved\n      summary:\n    add:\n      IncidentUpdate:\n",
  );
});

test("addField --formula and addModel's long form add computed fields; a shorthand default that reads like a formula says how", () => {
  const added = ok("addField", [
    "Order",
    "withShipping",
    "money",
    "--formula",
    "total + shippingCost",
  ]);
  expect(added.files.spec).toContain(
    "      withShipping:\n        type: money\n        formula: total + shippingCost\n",
  );
  const model = applyOperation(files, "addModel", {
    model: "Line",
    fields: {
      quantity: "int!",
      unitPrice: "money!",
      amount: { type: "money", formula: "quantity * unitPrice" },
    },
  });
  if (!model.ok) throw new Error(model.message);
  expect(model.files.spec).toContain(
    "      amount:\n        type: money\n        formula: quantity * unitPrice\n",
  );
  // A computed field is never entered: the parser's own refusal for one that is required.
  expect(
    applyOperation(files, "addModel", {
      model: "Line",
      fields: { quantity: "int!", amount: { type: "money!", formula: "quantity * 2" } },
    }).ok,
  ).toBe(false);
  // A calculator's result, the same way.
  const calculator = applyOperation(files, "addCalculatorPage", {
    page: "split",
    fields: {
      bill: "money = 100",
      people: "int = 2",
      each: { type: "money", formula: "bill / people" },
    },
  });
  if (!calculator.ok) throw new Error(calculator.message);
  expect(calculator.files.spec).toContain("formula: bill / people");
  // Written as a default, it is refused with the way out.
  const slip = applyOperation(files, "addModel", {
    model: "Line",
    fields: { quantity: "int!", unitPrice: "money!", amount: "money = quantity * unitPrice" },
  });
  if (slip.ok) throw new Error("a default that is an expression was accepted");
  expect(slip.diagnostics.map((d) => d.hint).join(" ")).toContain(
    'A computed field is written with a formula: `addField Line amount money --formula "quantity * unitPrice"`.',
  );
});
