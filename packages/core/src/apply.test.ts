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
    expect(result.files.spec).toContain("navigation: [customers, orders, products]");
  });

  test("setNavigation reorders, and a named menu turns the list into menus", () => {
    expect(ok("setNavigation", ["main", "orders", "customers"]).files.spec).toContain(
      "navigation: [orders, customers]",
    );
    // A page leaving the menu is named, so it is not missed when confirming.
    expect(ok("setNavigation", ["main", "orders"]).description).toBe(
      "Set the main menu to orders (no longer in it: customers)",
    );
    const admin = ok("setNavigation", ["admin", "orders"]);
    expect(admin.files.spec).toContain(
      "navigation:\n  main: [customers, orders]\n  admin: [orders]\n",
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
