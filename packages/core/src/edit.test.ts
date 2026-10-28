import { describe, expect, test } from "vitest";
import { YamlEditor } from "./edit.js";

const spec = `# CRM
smithable: 0.1

models:
  Customer:
    fields:
      name: string!          # the company name
      notes: text            # free text
      email: email unique
    rules:
      - Be nice.

pages: { customers: { crud: Customer } }
navigation: [customers]
`;

/** Lines added and removed between two texts, counting repeated lines correctly. */
function diff(before: string, after: string) {
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

describe("YamlEditor changes only what it targets", () => {
  test("add a field to a block mapping", () => {
    const e = new YamlEditor(spec);
    e.add(["models", "Customer", "fields"], "website", "url");
    expect(diff(spec, e.text)).toEqual({ added: ["      website: url"], removed: [] });
    expect(e.text).toContain("      email: email unique\n      website: url\n    rules:");
  });

  test("add a model with a block of fields", () => {
    const e = new YamlEditor(spec);
    e.add(["models"], "Invoice", { fields: { number: "string! unique", total: "money!" } });
    expect(diff(spec, e.text).added.sort()).toEqual(
      ["  Invoice:", "    fields:", "      number: string! unique", "      total: money!"].sort(),
    );
    expect(e.text).toContain(
      "      - Be nice.\n  Invoice:\n    fields:\n      number: string! unique\n      total: money!\n\npages:",
    );
  });

  test("add to a flow mapping keeps it on one line", () => {
    const e = new YamlEditor(spec);
    e.add(["pages"], "orders", { crud: "Order" });
    expect(e.text).toContain("pages: { customers: { crud: Customer }, orders: { crud: Order } }");
  });

  test("add creates missing mappings", () => {
    const e = new YamlEditor("smithable: 0.1\napp:\n  name: X\n");
    e.add(["models", "Customer", "fields"], "name", "string!");
    expect(e.text).toBe(
      "smithable: 0.1\napp:\n  name: X\nmodels:\n  Customer:\n    fields:\n      name: string!\n",
    );
  });

  test("rename a key keeps its value and comment", () => {
    const e = new YamlEditor(spec);
    e.renameKey(["models", "Customer", "fields", "notes"], "remarks");
    expect(diff(spec, e.text)).toEqual({
      added: ["      remarks: text            # free text"],
      removed: ["      notes: text            # free text"],
    });
  });

  test("replace a scalar keeps the comment and its alignment", () => {
    const e = new YamlEditor(spec);
    e.set(["models", "Customer", "fields", "name"], "string! unique");
    expect(e.text).toContain("      name: string! unique          # the company name");
    expect(diff(spec, e.text).removed).toEqual(["      name: string!          # the company name"]);
  });

  test("replace a scalar with a block mapping and back", () => {
    const e = new YamlEditor(spec);
    e.set(["models", "Customer", "fields", "email"], { type: "email!", unique: true });
    expect(e.text).toContain(
      "      email:\n        type: email!\n        unique: true\n    rules:",
    );
    e.set(["models", "Customer", "fields", "email"], "email unique");
    expect(e.text).toBe(spec);
  });

  test("replace a flow list", () => {
    const e = new YamlEditor(spec);
    e.set(["navigation"], ["customers", "orders"]);
    expect(diff(spec, e.text)).toEqual({
      added: ["navigation: [customers, orders]"],
      removed: ["navigation: [customers]"],
    });
  });

  test("remove an entry removes its whole lines", () => {
    const e = new YamlEditor(spec);
    e.remove(["models", "Customer", "fields", "notes"]);
    expect(diff(spec, e.text)).toEqual({
      added: [],
      removed: ["      notes: text            # free text"],
    });
    e.remove(["models", "Customer", "rules"]);
    expect(e.text).toContain("      email: email unique\n\npages:");
  });

  test("remove takes the comment right above an entry with it, not one set apart", () => {
    const text =
      "a: 1\n\n# About b,\n# on two lines.\nb:\n  # About x.\n  x: 1\n  y: 2\n# About c.\n\nc: 3\n";
    const e = new YamlEditor(text);
    e.remove(["b", "x"]);
    expect(e.text).toBe("a: 1\n\n# About b,\n# on two lines.\nb:\n  y: 2\n# About c.\n\nc: 3\n");
    e.remove(["b"]);
    expect(e.text).toBe("a: 1\n\n# About c.\n\nc: 3\n");
    e.remove(["c"]);
    expect(e.text).toBe("a: 1\n\n# About c.\n\n");
  });

  test("remove from a flow mapping", () => {
    const e = new YamlEditor("a: { x: 1, y: 2, z: 3 }\n");
    e.remove(["a", "y"]);
    expect(e.text).toBe("a: { x: 1, z: 3 }\n");
    e.remove(["a", "z"]);
    expect(e.text).toBe("a: { x: 1 }\n");
  });

  test("values that need quoting are quoted", () => {
    const e = new YamlEditor("a: 1\n");
    e.add([], "b", "yes: no");
    e.add([], "c", "#tag");
    expect(e.text).toBe(`a: 1\nb: "yes: no"\nc: "#tag"\n`);
  });

  test("the booking draft keeps every untouched line", () => {
    const text = Object.values(
      import.meta.glob("./edit.fixture.yml", {
        query: "?raw",
        import: "default",
        eager: true,
      }),
    )[0] as string;
    const e = new YamlEditor(text);
    e.add(["models", "Instructor", "fields"], "email", "email");
    expect(diff(text, e.text)).toEqual({ added: ["      email: email"], removed: [] });
  });
});

test("setItem replaces one list item on its line", () => {
  const e = new YamlEditor("rules:\n  - First rule.   # note\n  - Second rule.\n");
  e.setItem(["rules"], 0, { id: "first", rule: "First rule." });
  expect(e.text).toBe("rules:\n  - { id: first, rule: First rule. }   # note\n  - Second rule.\n");
});

test("keys that YAML cannot write plainly are quoted, others are not", () => {
  const editor = new YamlEditor("allowBuilds:\n  esbuild: true\n");
  editor.add([], "overrides", { "@esbuild-kit/core-utils>esbuild": "0.25.12" });
  editor.add(["allowBuilds"], "better-sqlite3", true);
  expect(editor.text).toBe(
    'allowBuilds:\n  esbuild: true\n  better-sqlite3: true\noverrides:\n  "@esbuild-kit/core-utils>esbuild": 0.25.12\n',
  );
  expect(editor.get(["overrides", "@esbuild-kit/core-utils>esbuild"])).toBe("0.25.12");
});

test("setItem replaces an item written as a key with options, keeping its comment and the next item", () => {
  const editor = new YamlEditor(`public:
  read:
    - Component
    # every state is public today
    - Incident: { where: { status: [a, b] } }   # the states
    - IncidentUpdate
    - Last: { where: { ok: true } }
other: 1
`);
  editor.setItem(["public", "read"], 1, { Incident: { where: { status: ["b"] } } });
  editor.setItem(["public", "read"], 3, "Last");
  expect(editor.text).toBe(`public:
  read:
    - Component
    # every state is public today
    - { Incident: { where: { status: [b] } } }   # the states
    - IncidentUpdate
    - Last
other: 1
`);
});

test("a long text stays on its line, plain or quoted, and reads back the same", () => {
  // Found by bench-m12: setApp with a model's long description made invalid YAML.
  const plain =
    "Simple invoicing for freelancers. Each user manages their own clients, their invoices and the payments that come in.";
  const quoted = `${plain.replace("Simple", "Simple: ")} And more.`;
  const editor = new YamlEditor("app:\n  name: Invoicely\n  description: Short.\n");
  editor.set(["app", "description"], plain);
  editor.add(["app"], "tagline", quoted);
  expect(editor.text.split("\n")).toHaveLength(5);
  expect(editor.get(["app", "description"])).toBe(plain);
  expect(editor.get(["app", "tagline"])).toBe(quoted);
});

test("a text with line breaks stays on its line through set, add and setItem, and reads back the same", () => {
  const two = "First paragraph.\n\nSecond: with a colon, and a comma.";
  const editor = new YamlEditor(
    "app:\n  name: Shop\n  description: Short.\nrules:\n  - First rule.\n",
  );
  editor.set(["app", "description"], two);
  editor.add(["app"], "tagline", two);
  editor.setItem(["rules"], 0, { rule: two });
  expect(editor.text.split("\n")).toHaveLength(7);
  expect(editor.get(["app", "description"])).toBe(two);
  expect(editor.get(["app", "tagline"])).toBe(two);
  expect((editor.get(["rules"]) as { rule: string }[])[0]?.rule).toBe(two);
});

describe("YamlEditor moves an entry", () => {
  test("a block entry moves with its comment line, nothing else changes", () => {
    const e = new YamlEditor(spec);
    e.move(["models", "Customer", "fields"], "email", { before: "name" });
    expect(e.text).toContain(
      "    fields:\n      email: email unique\n      name: string!          # the company name\n      notes: text",
    );
    const back = new YamlEditor(e.text);
    back.move(["models", "Customer", "fields"], "email", { after: "notes" });
    expect(back.text).toBe(spec);
  });

  test("a flow entry moves by rewriting the mapping", () => {
    const e = new YamlEditor("pages: { a: { crud: A }, b: { crud: B }, c: { crud: C } }\n");
    e.move(["pages"], "c", { before: "a" });
    expect(Object.keys(e.get(["pages"]) as object)).toEqual(["c", "a", "b"]);
  });

  test("refuses what is not there, and both or neither direction", () => {
    const e = new YamlEditor(spec);
    expect(() => e.move(["models", "Customer", "fields"], "nope", { before: "name" })).toThrow();
    expect(() => e.move(["models", "Customer", "fields"], "name", { before: "nope" })).toThrow();
    expect(() => e.move(["models", "Customer", "fields"], "name", {})).toThrow();
    expect(() =>
      e.move(["models", "Customer", "fields"], "name", { before: "notes", after: "notes" }),
    ).toThrow();
    expect(e.text).toBe(spec);
  });
});

test("appendItem adds a block list item at the end, from an empty document or a flow list too", () => {
  const list = new YamlEditor("- name: Maja\n  role: customer\n# a comment after\n");
  list.appendItem([], { name: "Tomas", role: "visitor", pace: 5 });
  expect(list.text).toBe(
    "- name: Maja\n  role: customer\n- name: Tomas\n  role: visitor\n  pace: 5\n# a comment after\n",
  );
  const empty = new YamlEditor("");
  empty.appendItem([], { name: "Maja", persona: "Books: a lot, often" });
  expect(empty.text).toBe('- name: Maja\n  persona: "Books: a lot, often"\n');
  const comments = new YamlEditor("# people\n");
  comments.appendItem([], { name: "Maja" });
  expect(comments.text).toBe("# people\n- name: Maja\n");
  const flow = new YamlEditor("# tags\ntags: [a, b] # two\n");
  flow.appendItem(["tags"], "c");
  expect(flow.text).toBe("# tags\ntags:\n  - a\n  - b\n  - c # two\n");
  const root = new YamlEditor("# all\n[a, b]\n");
  root.appendItem([], "c");
  expect(root.text).toBe("# all\n- a\n- b\n- c\n");
  const nested = new YamlEditor("- name: Maja\n  tags:\n    - x\n# after\n");
  nested.appendItem([], { name: "Tomas" });
  expect(nested.text).toBe("- name: Maja\n  tags:\n    - x\n- name: Tomas\n# after\n");
  expect(() => new YamlEditor("name: x\n").appendItem([], "y")).toThrow("not a list");
});

test("removeItem takes a block list item with its lines, or an item of a flow list", () => {
  const list = new YamlEditor("- name: Maja\n  role: customer\n- name: Tomas\n  role: visitor\n");
  list.removeItem([], 0);
  expect(list.text).toBe("- name: Tomas\n  role: visitor\n");
  const dashed = new YamlEditor("-\n  name: Maja\n-\n  name: Tomas\n");
  dashed.removeItem([], 1);
  expect(dashed.text).toBe("-\n  name: Maja\n");
  const flow = new YamlEditor("tags: [a, b, c]\n");
  flow.removeItem(["tags"], 1);
  expect(flow.text).toBe("tags: [a, c]\n");
  expect(() => list.removeItem([], 4)).toThrow("has no item 5");
});
