import { describe, expect, test } from "vitest";
import {
  applyOperation,
  applyOperations,
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
    expect(result.files.spec).toContain(
      "navigation: [start, customers, orders, followUps, team, products]",
    );
  });

  test("setNavigation reorders, and a named menu turns the list into menus", () => {
    expect(ok("setNavigation", ["main", "orders", "customers"]).files.spec).toContain(
      "navigation: [orders, customers]",
    );
    // A page leaving the menu is named, so it is not missed when confirming.
    expect(ok("setNavigation", ["main", "orders"]).description).toBe(
      "Set the main menu to orders (no longer in it: start, customers, followUps, team)",
    );
    const admin = ok("setNavigation", ["admin", "orders"]);
    expect(admin.files.spec).toContain(
      "navigation:\n  main: [start, customers, orders, followUps, team]\n  admin: [orders]\n",
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
    const result = ok("setRuleId", ["action:scheduleFollowUps", "1", "first-today"]);
    expect(result.files.spec).toContain(
      "      - { id: first-today, rule: The first note is due today; each next one everyDays later. }\n",
    );
    expect(result.effects).toEqual([
      {
        kind: "rule-identified",
        rule: "scheduleFollowUps.first-today",
        text: "The first note is due today; each next one everyDays later.",
      },
    ]);
    expect(apply("setRuleId", ["action:scheduleFollowUp", "1", "x"])).toMatchObject({
      ok: false,
      message:
        'There is no concept "action:scheduleFollowUp". Did you mean "action:scheduleFollowUps"?',
    });
    expect(apply("setRuleId", ["action:scheduleFollowUps", "9", "x"])).toMatchObject({
      message: "action:scheduleFollowUps has 1 rule(s), not 9.",
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

describe("setOwner", () => {
  test("a record belongs to the user in one of its User fields, or to its creator again", () => {
    // The CRM's customers belong to their account manager.
    const creator = ok("setOwner", ["Customer"]);
    expect(creator.description).toBe("Customers belong to whoever created them");
    expect(changed(files.spec, creator.files.spec).removed.join("\n")).toContain(
      "ownedBy: accountManager",
    );
    const back = applyOperation({ ...files, spec: creator.files.spec }, "setOwner", {
      model: "Customer",
      field: "accountManager",
    });
    if (!back.ok) throw new Error(back.message);
    expect(back.description).toBe("Customers belong to their account manager");
    expect(back.files.spec).toContain("    ownedBy: accountManager\n");
  });

  test("the owner is a field that refers to a user; the refusal names them, or how to add one", () => {
    const wrong = applyOperation(files, "setOwner", { model: "Customer", field: "name" });
    expect(wrong).toMatchObject({ ok: false });
    if (!wrong.ok) expect(wrong.message).toContain("accountManager");
    const none = applyOperation(files, "setOwner", { model: "Order", field: "number" });
    expect(none).toMatchObject({ ok: false });
    if (!none.ok) expect(none.message).toContain("addField Order handledBy User");
  });
});

describe("grant", () => {
  const authText = files.auth as string;
  test("sets what a role may do in the auth file, one grant at a time", () => {
    expect(
      changed(authText, ok("grant", ["sales", "delete", "Customer", "Order"]).files.auth as string),
    ).toEqual({
      added: ["    delete: [Customer, Order]"],
      removed: [],
    });
    expect(ok("grant", ["sales", "write", "Customer"]).files.auth).toContain(
      "    write: [Customer]",
    );
    expect(changed(authText, ok("grant", ["sales", "create"]).files.auth as string)).toEqual({
      added: [],
      removed: ["    create: all"],
    });
    expect(
      changed(authText, ok("grant", ["sales", "actions", "all"]).files.auth as string),
    ).toEqual({
      added: ["    actions: all"],
      removed: [],
    });
    expect(ok("grant", ["sales", "actions", "mergeCustomers"]).description).toBe(
      "sales may run merge customers",
    );
  });

  test("a role as a whole: all, none, and a grant that takes it out of all", () => {
    const all = ok("grant", ["sales", "all"]).files.auth;
    expect(all).toContain("  sales: all\n");
    const less = applyOperation({ ...files, auth: all }, "grant", {
      role: "sales",
      what: "delete",
      names: ["Order"],
    });
    if (!less.ok) throw new Error(less.message);
    expect(less.files.auth).toContain(
      "  sales:\n    pages: all\n    read: all\n    create: all\n    write: all\n    actions: all\n    review: all\n    delete: [Order]\n",
    );
    expect(ok("grant", ["sales", "none"]).files.auth).toContain(
      "  sales:\n    description: Works with customers and orders.\n",
    );
  });

  test("unknown roles, grants and names are refused; administrators are not granted", () => {
    expect(apply("grant", ["sale", "write", "Customer"])).toMatchObject({
      ok: false,
      message: 'There is no role named "sale": setRoles adds one.',
    });
    expect(apply("grant", ["sales", "edit", "Customer"])).toMatchObject({
      ok: false,
      message: expect.stringContaining('"pages", "read", "create", "write", "delete", "actions"'),
    });
    expect(apply("grant", ["sales", "pages", "custmers"])).toMatchObject({
      ok: false,
      message: 'There is no page named "custmers". Did you mean "customers"?',
    });
    expect(apply("grant", ["admin", "write", "Customer"])).toMatchObject({ ok: false });
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
    removed: ["    sortable: [name, createdAt]"],
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

test("editSpec with a path adds a key the part lacks under its parent, keeping the comment; a missing parent is refused", () => {
  const added = applyOperation(files, "editSpec", {
    path: ["actions", "mergeCustomers", "fields"],
    value: { notes: "append" },
  });
  expect(added).toMatchObject({ ok: true, destructive: false });
  const spec = (r: ReturnType<typeof applyOperation>) => (r.ok ? r.files.spec : "");
  expect(spec(added)).toContain("# two customers become one");
  expect(spec(added)).toMatch(/\n {4}fields:\n {6}notes: append\n/);
  const again = applyOperation(added.ok ? added.files : files, "editSpec", {
    path: ["actions", "mergeCustomers", "fields"],
    value: { notes: "keep" },
  });
  expect(again).toMatchObject({ ok: true });
  expect(spec(again)).toContain("notes: keep");
  expect(spec(again)).not.toContain("notes: append");
  expect(
    applyOperation(files, "editSpec", { path: ["actions", "nobody", "fields"], value: {} }),
  ).toMatchObject({
    ok: false,
    message: "actions.nobody is not in smithable.yml.",
  });
  // The first missing part is named, however deep the path goes.
  expect(
    applyOperation(files, "editSpec", {
      path: ["actions", "nobody", "fields", "notes"],
      value: "keep",
    }),
  ).toMatchObject({ ok: false, message: "actions.nobody is not in smithable.yml." });
  // A scalar takes no key, a list no item by path.
  expect(
    applyOperation(files, "editSpec", {
      path: ["actions", "mergeCustomers", "merge", "x"],
      value: 1,
    }),
  ).toMatchObject({
    ok: false,
    message: "actions.mergeCustomers.merge is a value, not a part with keys.",
  });
  expect(
    applyOperation(files, "editSpec", {
      path: ["actions", "scheduleFollowUps", "rules", 7],
      value: "x",
    }),
  ).toMatchObject({
    ok: false,
    message: "actions.scheduleFollowUps.rules is a list; a path adds no item to it.",
  });
  // A key among siblings keeps them and their comments; a top-level key goes under the root.
  const touched = applyOperation(files, "editSpec", {
    path: ["actions", "scheduleFollowUps", "touches"],
    value: { reads: ["Customer"] },
  });
  expect(touched).toMatchObject({ ok: true });
  expect(spec(touched)).toContain("The first note is due today");
  expect(spec(touched)).toContain("intent: Plan a series of follow-up notes");
  expect(spec(touched)).toMatch(
    /touches:\n {6}reads: \[Customer\]|touches: \{ reads: \[Customer\] \}|touches:\n {6}reads:\n {8}- Customer/,
  );
  // A top-level key goes under the root: the add happens, and what refuses here is validation
  // of the value (an empty timers mapping is none), not "timers is not in smithable.yml".
  const top = applyOperation(files, "editSpec", { path: ["timers"], value: {} });
  expect(top).toMatchObject({
    ok: false,
    message: "editSpec would make smithable.yml invalid.",
    diagnostics: [{ message: '"timers" must be a mapping of keys to values.' }],
  });
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

test("editSpec takes a companion file too, checked as a whole and against the spec", () => {
  // A role added in the auth file.
  const auth = files.auth
    .replace("  sales:", "  support: { description: Answers questions. }\n  sales:")
    .replace("admins:", "defaultRole: sales\nadmins:");
  const added = applyOperation(files, "editSpec", { file: "smithable.auth.yml", text: auth });
  expect(added).toMatchObject({
    ok: true,
    destructive: false,
    description: "Edit smithable.auth.yml",
  });
  expect(added.ok && added.files.auth).toContain("support:");
  expect(added.ok && added.files.spec).toBe(files.spec);
  // A grant that names nothing in the spec: the file is checked against the spec as edited.
  const gone = applyOperation(files, "editSpec", {
    file: "smithable.auth.yml",
    text: files.auth.replace("write: all", "write: [Custmer]"),
  });
  expect(gone).toMatchObject({
    ok: false,
    message: "editSpec would make smithable.auth.yml invalid.",
  });
  // The file's own checks, and its YAML.
  expect(
    applyOperation(files, "editSpec", {
      file: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nroles: [",
    }),
  ).toMatchObject({ ok: false });
  expect(
    applyOperation(files, "editSpec", {
      file: "smithable.auth.yml",
      text: "smithableAuth: 0.1\ndefaultAccess: everyone\n",
    }),
  ).toMatchObject({ ok: false, message: "editSpec would make smithable.auth.yml invalid." });
  // A content file written for the first time.
  const content = applyOperation(files, "editSpec", {
    file: "smithable.content.yml",
    text: "smithableContent: 0.1\nmodels:\n  Customer:\n    fields:\n      notes: { label: Remarks }\n",
  });
  expect(content).toMatchObject({ ok: true, description: "Edit smithable.content.yml" });
  expect(content.ok && content.files.content).toContain("Remarks");
  // Without an auth file there is nothing to edit.
  expect(
    applyOperation({ spec: files.spec }, "editSpec", {
      file: "smithable.auth.yml",
      text: files.auth,
    }),
  ).toMatchObject({ ok: false, message: expect.stringContaining("has no smithable.auth.yml") });
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
  // The library's hero is marked as made by an AI; another file is not known to be.
  expect(invoicing.content).toMatch(/hero\.webp\n.*\n\s*generated: true/);
  const hero = set("pages.home.hero.image.src", "images/mine.webp");
  expect(hero.ok && hero.files.content).toContain("src: images/mine.webp");
  expect(hero.ok && hero.files.content).not.toMatch(/mine\.webp\n.*\n\s*generated/);
});

test("removePage takes a page out of the spec, the menus and its texts", () => {
  const result = applyOperation(files, "removePage", { page: "orders" });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.files.spec).not.toMatch(/^ {2}orders:/m);
  expect(result.files.spec).toContain("navigation: [start, customers, followUps, team]");
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

test("moveSection reorders a landing page's sections", () => {
  const raw = import.meta.glob("../../../examples/invoicing/smithable*.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const file = (s: string) => raw[`../../../examples/invoicing/smithable${s}.yml`] as string;
  const invoicing = { spec: file(""), auth: file(".auth"), content: file(".content") };
  const order = (spec: string) =>
    [...spec.matchAll(/^ {6}(hero|features|pricing|faq|callToAction):/gm)].map((m) => m[1]);
  expect(order(invoicing.spec)).toEqual(["hero", "features", "pricing", "faq", "callToAction"]);
  const up = applyOperation(invoicing, "moveSection", {
    page: "home",
    section: "faq",
    before: "features",
  });
  expect(up.ok && order(up.files.spec)).toEqual([
    "hero",
    "faq",
    "features",
    "pricing",
    "callToAction",
  ]);
  const down = applyOperation(invoicing, "moveSection", {
    page: "home",
    section: "hero",
    after: "callToAction",
  });
  expect(down.ok && order(down.files.spec)).toEqual([
    "features",
    "pricing",
    "faq",
    "callToAction",
    "hero",
  ]);
  expect(applyOperation(invoicing, "moveSection", { page: "home", section: "faq" }).ok).toBe(false);
  expect(
    applyOperation(invoicing, "moveSection", { page: "home", section: "faq", before: "x" }).ok,
  ).toBe(false);
  expect(
    applyOperation(invoicing, "moveSection", { page: "home", section: "faq", before: "faq" }).ok,
  ).toBe(false);
  expect(
    applyOperation(invoicing, "moveSection", { page: "overview", section: "faq", before: "hero" })
      .ok,
  ).toBe(false);
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
    /callToAction: \{ button: overview \}\n\s+gallery:\n\s+footer:/,
  );
  expect(applyOperation(invoicing, "addSection", { page: "home", section: "faq" }).ok).toBe(false);
  expect(applyOperation(invoicing, "addSection", { page: "home", section: "news" }).ok).toBe(false);
  // Any page takes sections beside its kind's own (page-sections.md); its texts go with them.
  const beside = applyOperation(invoicing, "addSection", { page: "overview", section: "faq" });
  expect(beside.ok && beside.files.spec).toMatch(/overview:\n(?:.*\n)*?\s+sections:\n\s+faq:\n/);
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
  // The CRM's start page holds "/": here it moves aside, so the first landing page takes "/".
  const unrooted = {
    ...files,
    spec: files.spec.replace("    route: /\n    dashboard:", "    dashboard:"),
  };
  const result = applyOperation(unrooted, "addLandingPage", { page: "home" });
  expect(result).toMatchObject({ ok: true });
  if (!result.ok) return;
  expect(result.files.spec).toMatch(/home:\n\s+route: \/\n\s+landing:\n\s+hero:\n\s+footer:/);
  expect(result.files.auth).toMatch(/pages: \[.*home\]|pages:\n(\s+- .*\n)*\s+- home/);
  const again = applyOperation({ ...unrooted, ...result.files }, "addLandingPage", {
    page: "about",
  });
  expect(again.ok && again.files.spec).toContain("route: /about");
  const closed = applyOperation(unrooted, "addLandingPage", { page: "intro", public: false });
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
  expect(result.files.spec).toContain("navigation: [start, customers, orders, followUps, team]");
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
      // The timer that runs markOverdue, and the outgoing mail on markSent, go with the actions.
      .replace(/\n# What the app does on a clock[\s\S]*?\n\n/, "\n")
      .replace(/\noutgoing:\n[\s\S]*?\n\n/, "\n")
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
  // Opening says nothing more; closing says what visitors lose, in the confirmation.
  expect(pub.description).toBe("Set what is public: pages classes; read ClassType");
  const closed = applyOperation({ ...blank, ...pub.files }, "setPublic", { read: [] });
  expect(closed.ok && closed.files.auth).not.toContain("read:");
  expect(closed.ok && closed.description).toBe(
    "Set what is public: read nothing; visitors can no longer read class types",
  );
  const both = applyOperation({ ...blank, ...pub.files }, "setPublic", { pages: [], read: [] });
  expect(both.ok && both.description).toBe(
    "Set what is public: pages nothing; read nothing; visitors can no longer open the classes page or read class types",
  );
  // The same lists again close nothing.
  const same = applyOperation({ ...blank, ...pub.files }, "setPublic", { pages: ["classes"] });
  expect(same.ok && same.description).toBe("Set what is public: pages classes");
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

test("an object argument takes JSON on the command line, pairs otherwise; bad JSON is refused", () => {
  const op = findOperation("addExample");
  if (!op) throw new Error("no addExample");
  expect(
    parseOperationArgs(op, [
      "x",
      "--given",
      '{"Customer":[{"id":1,"name":"Arctic"}]}',
      "--input",
      "keep=1",
      "--output",
      "refused",
    ]),
  ).toEqual({
    action: "x",
    given: { Customer: [{ id: 1, name: "Arctic" }] },
    input: { keep: "1" },
    output: "refused",
  });
  expect(parseOperationArgs(op, ["x", "--given", "{}", "--output", '{"created":2}'])).toEqual({
    action: "x",
    given: {},
    output: { created: 2 },
  });
  expect(() => parseOperationArgs(op, ["x", "--given", '{"Customer":'])).toThrow(
    "--given is not JSON",
  );
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
      / {2}orders:\n {4}crud: Order\n {4}search: \[number, customer\]\n {4}filters: \[status\]\n {4}sortable: \[placedAt, total, number\]\n {4}actions: \[cancelOrder\]/,
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

test("setAssistantTexts sets Ask's texts, clears one with an empty text, and wants one", () => {
  const set = applyOperation(files, "setAssistantTexts", { name: "Nova", greeting: "Hej." });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.content).toMatch(/assistant:\n {2}name: Nova\n {2}greeting: Hej\./);
  expect(set.description).toBe('Ask\'s texts: name "Nova", greeting "Hej."');
  const cleared = applyOperation({ ...files, ...set.files }, "setAssistantTexts", { name: "" });
  if (!cleared.ok) throw new Error(cleared.message);
  expect(cleared.files.content).not.toContain("Nova");
  expect(cleared.files.content).toContain("greeting: Hej.");
  expect(applyOperation(files, "setAssistantTexts", {})).toMatchObject({ ok: false });
});

test("setDomains sets and lifts the email domains, and refuses an address or a bad domain", () => {
  const set = applyOperation(files, "setDomains", { domains: ["Acme.example", "north.example"] });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.auth).toContain("allowedDomains: [acme.example, north.example]");
  expect(set.description).toBe("Only acme.example or north.example addresses may sign in");
  const lifted = applyOperation(files, "setDomains", { domains: ["none"] });
  if (!lifted.ok) throw new Error(lifted.message);
  expect(lifted.files.auth).not.toContain("allowedDomains");
  expect(lifted.description).toBe("Any email domain may sign in");
  const again = applyOperation({ ...files, ...lifted.files }, "setDomains", {
    domains: ["acme.example"],
  });
  expect(again.ok && again.files.auth).toMatch(
    /signIn:\n(.*\n)*\s+allowedDomains: \[acme\.example\]/,
  );
  expect(applyOperation(files, "setDomains", { domains: ["anna@acme.example"] })).toMatchObject({
    ok: false,
    message: expect.stringContaining('give its domain, like "acme.example"'),
  });
  expect(applyOperation(files, "setDomains", { domains: ["acme"] })).toMatchObject({
    ok: false,
    message: '"acme" is not a domain like "acme.com".',
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
  // A number within bounds: the long form, the default as its own key; addField the same.
  const bounded = applyOperation(files, "addModel", {
    model: "Ticket",
    fields: { title: "string!", priority: { type: "int!", min: 1, max: 5, default: 3 } },
  });
  if (!bounded.ok) throw new Error(bounded.message);
  expect(bounded.files.spec).toContain(
    "      priority:\n        type: int!\n        min: 1\n        max: 5\n        default: 3\n",
  );
  const withMax = applyOperation(bounded.files, "addField", {
    model: "Ticket",
    field: "note",
    type: "string",
    max: 80,
  });
  if (!withMax.ok) throw new Error(withMax.message);
  expect(withMax.files.spec).toContain("      note:\n        type: string\n        max: 80\n");
  // The long form without a formula or bounds, and bounds on a computed field, are refused.
  expect(
    applyOperation(files, "addModel", { model: "Ticket", fields: { n: { type: "int!" } } }).ok,
  ).toBe(false);
  expect(
    applyOperation(files, "addModel", {
      model: "Ticket",
      fields: { n: "int", d: { type: "int", formula: "n * 2", max: 9 } },
    }).ok,
  ).toBe(false);
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

test("removePage takes a public page out of public.pages too, and says so", () => {
  const site = {
    spec: "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Item: { fields: { name: string! } }\npages:\n  items: { crud: Item }\n  catalog: { crud: Item, route: /catalog }\n",
    auth: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n\n# Visitors.\npublic:\n  pages: [items, catalog]\n  read: [Item]\n",
  };
  const removed = applyOperation(site, "removePage", { page: "catalog" });
  if (!removed.ok) throw new Error(removed.message);
  expect(removed.description).toBe("Remove page catalog; it is no longer public");
  expect(removed.files.auth).toContain("pages: [items]");
  const plain = applyOperation(
    { ...site, auth: site.auth.replace("pages: [items, catalog]", "pages: [items]") },
    "removePage",
    { page: "catalog" },
  );
  expect(plain).toMatchObject({ ok: true, description: "Remove page catalog" });
});

test("removePage takes the page off a landing hero too, and says so", () => {
  const raw = import.meta.glob("../../../examples/booking/smithable*.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const at = (name: string) => raw[`../../../examples/booking/${name}`] as string;
  // With round links under the hero, as the booking starter had until 2026-10-31.
  const spec = at("smithable.yml")
    .split("hero: { button: schedule, secondButton: blog }")
    .join("hero: { button: schedule, secondButton: blog, shortcuts: [schedule, blog] }");
  const removed = applyOperation(
    {
      spec,
      auth: at("smithable.auth.yml"),
      content: at("smithable.content.yml"),
    },
    "removePage",
    { page: "blog" },
  );
  if (!removed.ok) throw new Error(`${removed.message} ${JSON.stringify(removed.diagnostics)}`);
  expect(removed.description).toBe(
    "Remove page blog; the home page's hero no longer links to it; it is no longer public",
  );
  expect(removed.files.spec).toContain("hero: { button: schedule, shortcuts: [schedule] }");
});

test("removePage takes the page off a hero's button, in either style, and keeps the hero", () => {
  const files = (landing: string) => ({
    spec: `smithable: 0.1\napp: { name: Shop }\nmodels:\n  Item: { fields: { name: string! } }\npages:\n  home:\n    route: /\n    landing:\n${landing}  items: { crud: Item }\n  catalog: { crud: Item, route: /catalog }\n  sale:\n    route: /sale\n    landing:\n      callToAction: { button: catalog }\n`,
  });
  for (const landing of [
    "      hero: { button: catalog }\n",
    "      hero:\n        button: catalog\n",
  ]) {
    const removed = applyOperation(files(landing), "removePage", { page: "catalog" });
    if (!removed.ok) throw new Error(removed.message);
    expect(removed.description).toBe(
      "Remove page catalog; the home page's hero no longer links to it; the sale page's callToAction no longer links to it",
    );
    expect(removed.files.spec).not.toContain("catalog");
    expect(removed.files.spec).toMatch(/landing:\n {6}hero:/);
  }
});

test("a word no argument takes is refused with what to write, and a list given twice adds up", () => {
  const setPublic = findOperation("setPublic");
  if (!setPublic) throw new Error("no setPublic");
  expect(() => parseOperationArgs(setPublic, ["--pages", "home", "items"])).toThrow(
    '"items" is left over: a list is written with commas, e.g. --pages home,items.',
  );
  expect(parseOperationArgs(setPublic, ["--pages", "home", "--pages", "items"])).toEqual({
    pages: ["home", "items"],
  });
  expect(parseOperationArgs(setPublic, ["--pages", "home,items"])).toEqual({
    pages: ["home", "items"],
  });
  const renameField = findOperation("renameField");
  if (!renameField) throw new Error("no renameField");
  expect(() => parseOperationArgs(renameField, ["Customer", "phone", "mobile", "extra"])).toThrow(
    '"extra" is more than renameField takes: renameField <model> <from> <to>.',
  );
  expect(() =>
    parseOperationArgs(renameField, ["Customer", "phone", "mobile", "--colour", "red"]),
  ).toThrow("renameField has no option --colour.");
  expect(() => parseOperationArgs(setPublic, ["--pages"])).toThrow("--pages needs a value.");
});

test("changeField says what records holding a choice value that goes get instead", () => {
  const result = applyOperation(files, "changeField", {
    model: "Order",
    field: "status",
    type: "draft | placed | onItsWay | canceled",
    renames: ["shipped=onItsWay"],
  });
  if (!result.ok) throw new Error(result.message);
  expect(result.effects).toContainEqual(
    expect.objectContaining({ kind: "change-field", renamed: { shipped: "onItsWay" } }),
  );
  expect(result.description).toContain("shipped becoming onItsWay");
  expect(
    applyOperation(files, "changeField", {
      model: "Order",
      field: "status",
      type: "draft | placed | canceled",
      renames: ["lost=placed"],
    }),
  ).toMatchObject({ ok: false, message: expect.stringContaining('has no value "lost"') });
  expect(
    applyOperation(files, "changeField", {
      model: "Order",
      field: "status",
      type: "draft | placed | canceled",
      renames: ["shipped=gone"],
    }),
  ).toMatchObject({
    ok: false,
    message: expect.stringContaining('"gone" is not one of the new values'),
  });
});

test("changeField refuses renames that cannot be done as written", () => {
  const change = (type: string, renames: string[]) =>
    applyOperation(files, "changeField", { model: "Order", field: "status", type, renames });
  // A field that must have a value: its records cannot be left empty.
  expect(change("draft | placed | canceled", ["shipped="])).toMatchObject({
    ok: false,
    message: expect.stringContaining("must have a value"),
  });
  // No "=": not read as leaving them empty.
  expect(change("draft | placed | canceled", ["shipped"])).toMatchObject({
    ok: false,
    message: expect.stringContaining("write it as old=new"),
  });
  // A value that stays keeps its records.
  expect(change("draft | placed | shipped | canceled", ["draft=placed"])).toMatchObject({
    ok: false,
    message: expect.stringContaining("stays one of"),
  });
});

test("nameRecords renames a kind of record where it shows, in one change", () => {
  const result = applyOperation(files, "nameRecords", { model: "Order", one: "Job" });
  if (!result.ok) throw new Error(result.message);
  const content = result.files.content ?? "";
  expect(content).toMatch(/ {4}label: Job\n {4}pluralLabel: Jobs\n/);
  // The orders page was called Orders: now Jobs, and so is its menu entry.
  expect(content).toContain("orders: { subtitle: Every order and where it stands., title: Jobs }");
  expect(result.description).toBe('Call Order records "Job" and "Jobs"');
  // The fields that point at it and carried its name follow: Customer.orders "Orders" (a list),
  // Order.customer "Customer" (one).
  expect(content).toMatch(/ {6}orders:\n {8}label: Jobs\n/);
  const clients = applyOperation(files, "nameRecords", { model: "Customer", one: "Client" });
  if (!clients.ok) throw new Error(clients.message);
  expect(clients.files.content).toMatch(/ {6}customer:\n {8}label: Client\n/);
  expect(applyOperation(files, "nameRecords", { model: "Order", one: " " })).toMatchObject({
    ok: false,
    message: "Give the name for one.",
  });
});

test("addField shows the new field in its list in the same change", () => {
  const result = applyOperation(files, "addField", {
    model: "Customer",
    field: "website",
    type: "url",
    list: true,
  });
  if (!result.ok) throw new Error(result.message);
  // The CRM's customers page names its columns: the new field is added to them.
  expect(result.files.ux).toContain("website");
  expect(result.description).toContain("shown in its list");
});

test("addField ignores list for a list of related records, which is never a column", () => {
  // A draft asks for every field in its list; a list of related records cannot be shown there
  // (the ux file would be invalid), so the field is added and the column is left out.
  const added = applyOperation(files, "addModel", {
    model: "Note",
    fields: { body: "text!", customer: "Customer!" },
  });
  if (!added.ok) throw new Error(added.message);
  const result = applyOperation({ ...files, spec: added.files.spec }, "addField", {
    model: "Customer",
    field: "memos",
    type: "Note[]",
    list: true,
  });
  if (!result.ok) throw new Error(result.message);
  expect(result.files.spec).toContain("memos: Note[]");
  expect(result.files.ux ?? "").not.toContain("memos");
  expect(result.description).not.toContain("shown in its list");
});

test("addField shows a field the default columns leave out, and refuses a model with no list", () => {
  // Orders' page names no columns, and the app never picks a long text: they are written out.
  const notes = applyOperation(files, "addField", {
    model: "Order",
    field: "remarks",
    type: "text",
    list: true,
  });
  if (!notes.ok) throw new Error(notes.message);
  expect(notes.files.ux).toMatch(/orders:[\s\S]*columns: \[[^\]]*remarks\]/);
  const added = applyOperation(files, "addModel", { model: "Tag", fields: { name: "string!" } });
  if (!added.ok) throw new Error(added.message);
  expect(
    applyOperation({ ...files, spec: added.files.spec }, "addField", {
      model: "Tag",
      field: "color",
      type: "string",
      list: true,
    }),
  ).toMatchObject({ ok: false, message: "Tag has no list page to show it in." });
});

test("setLanguage sets the content file's language; the kit's languages only", () => {
  expect(applyOperation(files, "setLanguage", { language: "fi" })).toMatchObject({ ok: false });
  const swedish = applyOperation(files, "setLanguage", { language: "sv" });
  expect(swedish).toMatchObject({ ok: true, description: "Set the app's language to sv" });
  expect(swedish.ok && swedish.files.content).toContain("language: sv");
  const same = applyOperation(files, "setLanguage", { language: "en" });
  expect(same).toMatchObject({ ok: true, description: "Set the app's language to en" });
  expect(same.ok && same.files.content).not.toContain("language:");
});

test("setLogo sets the app's mark, keeps its alt on a new file, and an empty src removes it", () => {
  // From an app without one (the CRM starter has its own).
  const bare = { ...files, content: files.content.replace(/^logo: .*\n/m, "") };
  expect(applyOperation(bare, "setLogo", { src: "logo.webp" })).toMatchObject({ ok: false });
  expect(applyOperation(bare, "setLogo", { src: "" })).toMatchObject({ ok: false });
  const set = applyOperation(bare, "setLogo", { src: "images/logo.webp", alt: "A lotus" });
  expect(set).toMatchObject({ ok: true, description: "Use images/logo.webp as the app's logo" });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.content).toContain("logo:");
  const replaced = applyOperation({ ...bare, ...set.files }, "setLogo", {
    src: "images/mine.svg",
  });
  if (!replaced.ok) throw new Error(replaced.message);
  expect(replaced.files.content).toMatch(/src: images\/mine\.svg[\s\S]*alt: A lotus/);
  const removed = applyOperation({ ...bare, ...replaced.files }, "setLogo", { src: "" });
  expect(removed).toMatchObject({ ok: true, description: "Remove the app's logo" });
  expect(removed.ok && removed.files.content).toBe(bare.content);
});

test("editSpec with a path sets one part of a file, checked as a whole; null takes it away", () => {
  const set = applyOperation(files, "editSpec", {
    path: ["app", "timezone"],
    value: "Europe/Stockholm",
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.spec).toContain("timezone: Europe/Stockholm");
  expect(set.destructive).toBe(false);
  // A value the spec refuses is refused, in the validator's words.
  expect(
    applyOperation(files, "editSpec", { path: ["app", "currency"], value: "EURO" }),
  ).toMatchObject({
    ok: false,
  });
  // Taking a part away: a field is destructive; something not there is refused.
  const gone = applyOperation(files, "editSpec", {
    path: ["models", "Customer", "fields", "phone"],
    value: null,
  });
  expect(gone).toMatchObject({ ok: true, destructive: true });
  expect(
    applyOperation(files, "editSpec", { path: ["app", "nothing"], value: null }),
  ).toMatchObject({
    ok: false,
  });
  // Setting a model's fields anew loses the ones left out: destructive, with the migration's effects.
  const reset = applyOperation(files, "editSpec", {
    path: ["models", "Customer", "fields"],
    value: { name: "string!", email: "email! unique", accountManager: "User" },
  });
  expect(reset).toMatchObject({ ok: true, destructive: true });
  expect(
    reset.ok && reset.effects.some((e) => e.kind === "remove-field" && e.field === "phone"),
  ).toBe(true);
  // A path without a value deletes nothing: it is refused.
  expect(applyOperation(files, "editSpec", { path: ["app", "timezone"] })).toMatchObject({
    ok: false,
  });
  // A companion file's part.
  const content = applyOperation(files, "editSpec", {
    file: "smithable.content.yml",
    path: ["pages", "customers", "subtitle"],
    value: "Everyone we sell to.",
  });
  if (!content.ok) throw new Error(content.message);
  expect(content.files.content).toContain("subtitle: Everyone we sell to.");
});

test("applyOperations makes one change of several operations, or refuses as a whole", () => {
  const spec = `smithable: 0.1
app: { name: Shop }
models:
  Customer: { fields: { name: string! } }
pages:
  customers: { crud: Customer }
`;
  const result = applyOperations({ spec }, [
    { op: "addModel", args: { model: "Supplier", fields: { name: "string!" } } },
    { op: "addPage", args: { page: "suppliers", model: "Supplier" } },
  ]);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.description).toBe("Add model Supplier with name; Add page suppliers for Supplier");
  expect(result.files.spec).toContain("Supplier");
  expect(result.files.spec).toContain("suppliers");
  expect(result.destructive).toBe(false);
  const refused = applyOperations({ spec }, [
    { op: "addModel", args: { model: "Supplier", fields: { name: "string!" } } },
    { op: "addPage", args: { page: "customers", model: "Supplier" } },
  ]);
  expect(refused.ok).toBe(false);
  expect(applyOperations({ spec }, []).ok).toBe(false);
});

test("setHeroButtons sets the pages a hero's buttons open, a second one beside the first; none takes one away", () => {
  const raw = import.meta.glob("../../../examples/invoicing/smithable*.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const file = (s: string) => raw[`../../../examples/invoicing/smithable${s}.yml`] as string;
  const invoicing = { spec: file(""), auth: file(".auth"), content: file(".content") };
  const set = applyOperation(invoicing, "setHeroButtons", {
    page: "home",
    secondButton: "clients",
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.description).toBe("The home hero's second button opens clients");
  expect(set.files.spec).toContain("hero: { button: overview, secondButton: clients }");
  // Its words: the content file's secondButton, through setText.
  const words = applyOperation({ ...invoicing, ...set.files }, "setText", {
    text: "Our clients",
    path: ["pages", "home", "hero", "secondButton"],
  });
  if (!words.ok) throw new Error(words.message);
  expect(words.files.content).toContain("secondButton: Our clients");
  const none = applyOperation({ ...invoicing, ...set.files }, "setHeroButtons", {
    page: "home",
    secondButton: "none",
  });
  expect(none.ok && none.files.spec).toContain("hero: { button: overview }");
  // A renamed page is followed; a removed one takes the button with it.
  const renamed = applyOperation({ ...invoicing, ...set.files }, "renamePage", {
    from: "clients",
    to: "customers",
  });
  expect(renamed.ok && renamed.files.spec).toContain("secondButton: customers");
  const gone = applyOperation({ ...invoicing, ...set.files }, "removePage", { page: "clients" });
  expect(gone.ok && gone.files.spec).not.toContain("secondButton");
  expect(applyOperation(invoicing, "setHeroButtons", { page: "home", button: "nowhere" }).ok).toBe(
    false,
  );
  expect(applyOperation(invoicing, "setHeroButtons", { page: "home" }).ok).toBe(false);
  // Only a hero has a second button.
  const spec = validateSpec({
    path: "smithable.yml",
    text: file("").split("      faq:\n").join("      faq: { secondButton: clients }\n"),
  });
  expect(spec.diagnostics.map((d) => d.message)).toContain(
    "Only a hero section has a second button.",
  );
});
