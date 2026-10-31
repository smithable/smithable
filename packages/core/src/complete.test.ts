import { expect, test } from "vitest";
import { completeSpec, hoverSpec } from "./complete.js";
import { buildJsonSchema } from "./schema.js";

const booking = Object.values(
  import.meta.glob("../../../examples/booking/smithable.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
)[0] as string;

const crm = Object.values(
  import.meta.glob("../../../examples/crm/smithable.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
)[0] as string;

/** The suggestions at the "‸" in a text (the spec itself has "|" in it, in its choices). */
const at = (marked: string, roles?: string[]) => {
  const offset = marked.indexOf("‸");
  const text = marked.replace("‸", "");
  const found = completeSpec(text, offset, roles ? { roles } : {});
  return {
    labels: found?.suggestions.map((s) => s.label) ?? [],
    replaced: found ? text.slice(found.from, found.to) : undefined,
    value: found?.value,
    of: (label: string) => found?.suggestions.find((s) => s.label === label),
  };
};
/** The CRM with a line put in after the one that starts with `after`. */
const withLine = (after: string, line: string) => {
  const lines = crm.split("\n");
  const index = lines.findIndex((l) => l.startsWith(after));
  if (index < 0) throw new Error(`no line ${after}`);
  lines.splice(index + 1, 0, line);
  return lines.join("\n");
};

test("the keys that may stand at a place, with what they are for, without the ones already there", () => {
  const top = at(`${crm}\n‸`);
  expect(top.labels).toContain("queries");
  expect(top.labels).not.toContain("models");
  expect(top.labels).not.toContain("pages");
  // Under a page: its keys, each with the schema's description, put in with its colon.
  const page = at(withLine("  customers:", "    s‸"));
  expect(page.labels).toContain("sortable");
  expect(page.labels).not.toContain("search");
  expect(page.labels).not.toContain("crud");
  expect(page.replaced).toBe("s");
  expect(page.of("sortable")).toMatchObject({
    insert: "sortable: ",
    detail: expect.stringContaining("sorted"),
  });
  // Under a kind of record: what it does not say yet.
  const order = at(withLine("  Order:", "    ‸"));
  expect(order.labels).toEqual(expect.arrayContaining(["ownedBy", "capacity", "intent"]));
  expect(order.labels).not.toContain("fields");
  expect(order.labels).not.toContain("access");
});

test("a value's fixed choices, and the app's own names where they fit", () => {
  // A field's type: the types, and the app's kinds of record to refer to.
  const type = at(withLine("      name: string!", "      region: ‸"));
  expect(type.labels).toEqual(
    expect.arrayContaining(["string", "money", "Customer", "Order", "User"]),
  );
  expect(at(withLine("      name: string!", "      region: Cu‸")).labels).toEqual(["Customer"]);
  // What a page lists, and what it may be searched by: the fields of its kind of record.
  expect(
    at(
      "smithable: 0.1\nmodels:\n  Tag:\n    fields:\n      name: string!\npages:\n  tags:\n    crud: ‸",
    ).labels,
  ).toEqual(["Tag"]);
  const search = at(withLine("  customers:", "    sortable: [name, ‸"));
  expect(search.labels).toContain("email");
  expect(search.labels).toContain("segment");
  expect(search.labels).not.toContain("name");
  // Written on one line, as the starters do.
  expect(
    at(
      "smithable: 0.1\nmodels:\n  Tag: { fields: { name: string!, color: string } }\npages:\n  tags: { crud: Tag, search: [na‸",
    ).labels,
  ).toEqual(["name"]);
  expect(
    at("smithable: 0.1\nmodels:\n  Tag: { fields: { name: string! } }\npages:\n  tags: { cr‸")
      .labels,
  ).toEqual(["crud"]);
  // A role's grants in the auth file name the spec's pages, models and custom actions, or all.
  const grant = (line: string) => {
    const text = `smithableAuth: 0.1\nroles:\n  sales:\n    ${line}`;
    return completeSpec(
      text.replace("‸", ""),
      text.indexOf("‸"),
      { spec: crm },
      "smithable.auth.yml",
    )?.suggestions.map((s) => s.label);
  };
  expect(grant("pages: [‸")).toEqual(["all", "customers", "orders", "followUps", "team", "start"]);
  expect(grant("write: [Cu‸")).toEqual(["Customer"]);
  expect(grant("actions: [‸")).toEqual(["all", "mergeCustomers", "scheduleFollowUps"]);
  expect(at(withLine("  customers:", "    mine: ‸")).labels).toEqual(["true", "false"]);
  expect(at(crm.replace(/^navigation:.*$/m, "navigation: [customers, ‸")).labels).toEqual(
    expect.arrayContaining(["orders", "team"]),
  );
  // What an action sets is said by the fields of its kind of record.
  const action =
    "smithable: 0.1\nmodels:\n  Task:\n    fields:\n      title: string!\n      status: todo | done\nactions:\n  complete:\n    on: Task\n";
  expect(at(`${action}    set:\n      ‸`).labels).toEqual(["title", "status"]);
  expect(at(`${action}    set: { st‸`).labels).toEqual(["status"]);
});

test("an item of a list has its own keys, and a landing page its sections", () => {
  // A second example: its keys, not the ones the item before it wrote.
  const example = at(withLine("            expected: 0", "          - ‸"));
  expect(example.labels).toEqual(["input", "expected"]);
  expect(at(withLine("          - input: { total: 80", "            ‸")).labels).toEqual([]);
  const landing =
    "smithable: 0.1\nmodels:\n  Post:\n    fields:\n      title: string!\npages:\n  home:\n    landing:\n      hero: { button: blog }\n";
  const sections = at(`${landing}      ‸\n  blog:\n    crud: Post\n`);
  expect(sections.labels).toEqual(expect.arrayContaining(["features", "faq", "footer"]));
  expect(sections.labels).not.toContain("hero");
  expect(sections.value).toBe(false);
  // What a section shows and where its button leads.
  expect(at(`${landing}      news: { records: ‸\n  blog:\n    crud: Post\n`).labels).toEqual([
    "Post",
  ]);
  const button = at(`${landing}      callToAction: { button: ‸\n  blog:\n    crud: Post\n`);
  expect(button.labels).toEqual(["home", "blog"]);
  expect(button.value).toBe(true);
});

test("nothing where the place is free text, a comment or a name of one's own", () => {
  expect(at(withLine("  customers:", "    intent: Find a cu‸")).labels).toEqual([]);
  expect(at(withLine("  customers:", "    # se‸")).labels).toEqual([]);
  expect(at("smithable: 0.1\nmodels:\n  Cu‸").labels).toEqual([]);
});

test("a key says what it is for, and a kind of record what it holds", () => {
  const over = (word: string, nth = 1) => {
    let index = -1;
    for (let i = 0; i < nth; i++) index = crm.indexOf(word, index + 1);
    return hoverSpec(crm, index + 1);
  };
  expect(over("crud:")?.text).toContain("list, view, create, edit and delete");
  expect(over("pages:")?.text).toBeTruthy();
  const kind = hoverSpec(crm, crm.indexOf("crud: Customer") + 8);
  expect(kind?.text).toMatch(/^Customer: name, email/);
  expect(crm.slice(kind?.from, kind?.to)).toBe("Customer");
  expect(hoverSpec(crm, crm.indexOf("Acme") + 1)).toBeUndefined();
});

test("every key the schema declares says what it is for", () => {
  const silent: string[] = [];
  const walk = (node: Record<string, unknown> | undefined, path: string) => {
    if (!node || typeof node !== "object") return;
    const alternatives = (node.oneOf ?? node.anyOf ?? []) as Record<string, unknown>[];
    for (const [key, child] of Object.entries((node.properties ?? {}) as typeof node)) {
      const of = child as Record<string, unknown>;
      const said =
        of.description ??
        ((of.oneOf ?? of.anyOf ?? []) as Record<string, unknown>[]).find((b) => b.description);
      if (!said) silent.push(`${path}${key}`);
      walk(of, `${path}${key}.`);
    }
    walk(node.additionalProperties as typeof node, `${path}*.`);
    walk(node.items as typeof node, `${path}-.`);
    for (const branch of alternatives) walk(branch, path);
  };
  walk(buildJsonSchema() as Record<string, unknown>, "");
  expect(silent).toEqual([]);
});

test("a companion file is helped from its own schema, with the spec's names", () => {
  const spec = crm;
  const auth = (marked: string) => {
    const offset = marked.indexOf("‸");
    const found = completeSpec(
      marked.replace("‸", ""),
      offset,
      { roles: ["admin", "sales"], spec },
      "smithable.auth.yml",
    );
    return found?.suggestions.map((s) => s.label) ?? [];
  };
  expect(auth("smithableAuth: 0.1\n‸")).toEqual(
    expect.arrayContaining(["signIn", "defaultAccess", "roles", "public", "api", "assistant"]),
  );
  expect(auth("smithableAuth: 0.1\npublic:\n  pages: [‸")).toEqual([
    "customers",
    "orders",
    "followUps",
    "team",
    "start",
  ]);
  expect(auth("smithableAuth: 0.1\npublic:\n  read: [‸")).toEqual([
    "Customer",
    "Order",
    "FollowUp",
  ]);
  expect(auth("smithableAuth: 0.1\ndefaultAccess: ‸")).toEqual(["shared", "private"]);
  expect(auth("smithableAuth: 0.1\nassistant:\n  for: [‸")).toEqual(["admin", "sales"]);
  // The ux file: a page's table takes its model's fields.
  const ux = (marked: string) => {
    const offset = marked.indexOf("‸");
    const found = completeSpec(marked.replace("‸", ""), offset, { spec }, "smithable.ux.yml");
    return found?.suggestions.map((s) => s.label) ?? [];
  };
  expect(ux("smithableUx: 0.1\npages:\n  ‸")).toEqual([
    "customers",
    "orders",
    "followUps",
    "team",
    "start",
  ]);
  expect(ux("smithableUx: 0.1\npages:\n  orders:\n    table:\n      columns: [‸")).toEqual(
    expect.arrayContaining(["number", "customer", "status", "total"]),
  );
  expect(ux("smithableUx: 0.1\ntheme:\n  density: ‸")).toEqual([
    "comfortable",
    "standard",
    "compact",
  ]);
  // The preset: the built-in themes and the project's own; a landing page's own theme too.
  const own = (marked: string) => {
    const offset = marked.indexOf("‸");
    const found = completeSpec(
      marked.replace("‸", ""),
      offset,
      { spec: crm, themes: ["acme"] },
      "smithable.ux.yml",
    );
    return found?.suggestions.map((s) => s.label) ?? [];
  };
  expect(own("smithableUx: 0.1\ntheme:\n  preset: ‸")).toEqual(
    expect.arrayContaining(["modern", "corporate", "nordic", "acme"]),
  );
  expect(own("smithableUx: 0.1\npages:\n  customers:\n    theme:\n      preset: n‸")).toEqual([
    "navy",
    "nordic",
  ]);
  // A form's controls by field, and a form section's fields.
  expect(ux("smithableUx: 0.1\npages:\n  orders:\n    form:\n      control:\n        ‸")).toEqual(
    expect.arrayContaining(["number", "status", "total"]),
  );
  expect(
    ux(
      "smithableUx: 0.1\npages:\n  orders:\n    form:\n      sections:\n        - { name: main, fields: [‸",
    ),
  ).toEqual(expect.arrayContaining(["number", "status"]));
  // A tone names a choice field, and under it the field's values.
  expect(ux("smithableUx: 0.1\ntones:\n  ‸")).toEqual(
    expect.arrayContaining(["Customer.segment", "Order.status", "Order.shippingMethod"]),
  );
  expect(ux("smithableUx: 0.1\ntones:\n  Order.status:\n    ‸")).toEqual([
    "draft",
    "placed",
    "shipped",
    "canceled",
  ]);
  // A landing page's sections by name (those with a look), and each one's looks.
  const home = (marked: string) => {
    const offset = marked.indexOf("‸");
    const found = completeSpec(
      marked.replace("‸", ""),
      offset,
      { spec: booking },
      "smithable.ux.yml",
    );
    return found?.suggestions.map((s) => s.label) ?? [];
  };
  expect(home("smithableUx: 0.1\npages:\n  home:\n    sections:\n      ‸")).toEqual([
    "hero",
    "classes",
    "estimate",
    "gallery",
    "faq",
    "callToAction",
    "news",
  ]);
  expect(home("smithableUx: 0.1\npages:\n  home:\n    sections:\n      hero:\n        ‸")).toEqual(
    expect.arrayContaining(["layout", "image"]),
  );
  expect(
    home("smithableUx: 0.1\npages:\n  home:\n    sections:\n      classes:\n        layout: ‸"),
  ).toEqual(["cards", "list", "grid"]);
  expect(
    home("smithableUx: 0.1\npages:\n  home:\n    sections:\n      faq:\n        layout: ‸"),
  ).toEqual(["accordion", "list"]);
  // The content file: models and their fields as keys.
  const content = (marked: string) => {
    const offset = marked.indexOf("‸");
    const found = completeSpec(marked.replace("‸", ""), offset, { spec }, "smithable.content.yml");
    return found?.suggestions.map((s) => s.label) ?? [];
  };
  expect(content("smithableContent: 0.1\nmodels:\n  Customer:\n    fields:\n      ‸")).toEqual(
    expect.arrayContaining(["name", "email", "segment"]),
  );
  expect(content("smithableContent: 0.1\nlanguage: ‸")).toEqual(["en", "sv"]);
  // Hover explains a companion's key from its schema.
  const text = "smithableAuth: 0.1\ndefaultAccess: shared\n";
  expect(hoverSpec(text, text.indexOf("defaultAccess") + 2, "smithable.auth.yml")?.text).toContain(
    "default access",
  );
});

test("the app's currency is offered from the ISO 4217 codes", () => {
  const found = at("smithable: 0.1\napp:\n  name: Shop\n  currency: SE‸");
  expect(found.labels).toEqual(expect.arrayContaining(["SEK"]));
  expect(found.labels).not.toContain("EUR");
});

test("the app's time zone is offered from the IANA names", () => {
  const found = at("smithable: 0.1\napp:\n  name: Shop\n  timezone: Europe/Mari‸");
  expect(found.labels).toEqual(["Europe/Mariehamn"]);
});

test("a field line with a long run of spaces is read quickly (CodeQL #49)", () => {
  const long = `smithable: 0.1\napp: { name: Shop }\nmodels:\n  Order:\n    fields:\n      status: "${" ".repeat(100_000)}x\n      note: text\npages:\n  ‸`;
  const started = Date.now();
  at(long);
  expect(Date.now() - started).toBeLessThan(100);
});

test("under a map of the app's own names a template entry is offered, with its required keys", () => {
  const found = completeSpec(
    "smithable: 0.1\nmodels:\n  Task:\n    fields:\n      title: string!\nactions:\n  ‸",
    "smithable: 0.1\nmodels:\n  Task:\n    fields:\n      title: string!\nactions:\n  ".length,
  );
  const template = found?.suggestions.find((s) => s.snippet);
  expect(template?.label).toBe("myEntry");
  expect(template?.snippet).toMatch(/^\$\{myEntry\}:\n {4}/);
  // A model's name is PascalCase, a page's kebab-case.
  const model = completeSpec("smithable: 0.1\nmodels:\n  ‸", "smithable: 0.1\nmodels:\n  ".length);
  expect(model?.suggestions.find((s) => s.snippet)?.label).toBe("MyRecord");
  expect(model?.suggestions.find((s) => s.snippet)?.snippet).toContain("fields: ${{}}");
  const page = completeSpec(
    "smithable: 0.1\nmodels:\n  Task:\n    fields:\n      title: string!\npages:\n  ‸",
    "smithable: 0.1\nmodels:\n  Task:\n    fields:\n      title: string!\npages:\n  ".length,
  );
  expect(page?.suggestions.find((s) => s.snippet)?.label).toBe("my-page");
  // Where there are own names to offer (the fields of a model under an action's set), no template.
  const set = completeSpec(
    "smithable: 0.1\nmodels:\n  Task:\n    fields:\n      title: string!\nactions:\n  done:\n    on: Task\n    set:\n      ‸",
    "smithable: 0.1\nmodels:\n  Task:\n    fields:\n      title: string!\nactions:\n  done:\n    on: Task\n    set:\n      "
      .length,
  );
  expect(set?.suggestions.some((s) => s.snippet)).toBe(false);
});
