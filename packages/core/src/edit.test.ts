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
      import.meta.glob("../../../docs/spec/drafts/booking/smithable.yml", {
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
