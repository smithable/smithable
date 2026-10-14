import { expect, test } from "vitest";
import { applyOperation, operationsFor } from "./apply.js";
import { checkJson, type PluginApi, resolvePlugin, type SpecPlugin } from "./plugin.js";
import { validateSpec } from "./spec.js";

/** A newsletter section: who it is from, and its lists; it stands for a Subscriber model. */
const newsletter: SpecPlugin = {
  key: "newsletter",
  description: "A newsletter people sign up to, on one or more lists.",
  schema: {
    type: "object",
    required: ["from"],
    additionalProperties: false,
    properties: {
      from: { type: "string" },
      lists: { type: "array", items: { type: "string" } },
    },
  },
  expand: (value) => {
    const { lists = [] } = value as { lists?: string[] };
    // One list needs no choice; several are a choice of list.
    const list = lists.length > 1 ? { list: lists.join(" | ") } : {};
    return {
      models: { Subscriber: { fields: { email: "email! unique", ...list } } },
      pages: { subscribers: { crud: "Subscriber" } },
    };
  },
};

const spec = (newsletterYaml: string) => `smithable: 0.1
app: { name: Studio }
models:
  Class:
    fields: { name: string! }
pages:
  classes: { crud: Class }
${newsletterYaml}`;

test("an unknown section is an error that suggests teaching Smithable", () => {
  const { diagnostics } = validateSpec({
    path: "smithable.yml",
    text: spec("newsletter:\n  from: hi@example.com\n"),
  });
  expect(diagnostics[0]).toMatchObject({
    code: "unknown-key",
    message: `Smithable doesn't know "newsletter".`,
    line: 8,
  });
  expect(diagnostics[0]?.hint).toContain("smithable teach newsletter");
});

test("a plugin's section is checked against its schema and expands into ordinary spec", () => {
  const { ir, diagnostics } = validateSpec(
    {
      path: "smithable.yml",
      text: spec("newsletter:\n  from: hi@example.com\n  lists: [classes, offers]\n"),
    },
    { plugins: [newsletter] },
  );
  expect(diagnostics.filter((d) => d.severity !== "note")).toEqual([]);
  expect(ir?.models.map((m) => m.name)).toEqual(["Class", "Subscriber"]);
  expect(ir?.models[1]?.fields[1]?.type).toEqual({ kind: "choice", values: ["classes", "offers"] });
  expect(ir?.pages.map((p) => p.id)).toEqual(["classes", "subscribers"]);
  expect(ir?.extensions).toEqual({
    newsletter: { from: "hi@example.com", lists: ["classes", "offers"] },
  });

  const invalid = validateSpec(
    { path: "smithable.yml", text: spec("newsletter:\n  form: hi@example.com\n") },
    { plugins: [newsletter] },
  );
  expect(invalid.diagnostics.map((d) => [d.line, d.message])).toEqual([
    [9, `"newsletter" needs "from".`],
    [9, `Unknown key "form" in "newsletter".`],
  ]);
});

test("an expansion that clashes with the spec points at the plugin's section", () => {
  const { diagnostics } = validateSpec(
    {
      path: "smithable.yml",
      text: spec("  subscribers: { crud: Class }\nnewsletter:\n  from: hi@example.com\n"),
    },
    { plugins: [newsletter] },
  );
  expect(diagnostics.map((d) => d.code)).toContain("plugin-conflict");
});

test("operations work on a spec with a plugin section", () => {
  const text = spec("newsletter:\n  from: hi@example.com\n");
  const result = applyOperation({ spec: text, plugins: [newsletter] }, "addField", {
    model: "Class",
    field: "level",
    type: "string",
  });
  expect(result).toMatchObject({ ok: true });
  expect(
    applyOperation({ spec: text }, "addField", { model: "Class", field: "x", type: "string" }),
  ).toMatchObject({ ok: false });
});

test("the schema check covers patterns, minimum items and repeated items", () => {
  expect(
    checkJson(
      {
        type: "array",
        minItems: 1,
        uniqueItems: true,
        items: { type: "string", pattern: "^[a-z]+$" },
      },
      ["news", "news", "Offers"],
      "lists",
    ),
  ).toEqual([`"lists" has the same item twice.`, `"lists[2]" must match ^[a-z]+$.`]);
  expect(checkJson({ type: "array", minItems: 1 }, [], "lists")).toEqual([
    `"lists" needs at least 1 item.`,
  ]);
});

const subscribeSpec = `smithable: 0.1
app: { name: Studio }
models:
  Customer:
    fields: { name: string! }
pages:
  home:
    landing:
      hero:
      footer:
  customers: { crud: Customer }
navigation: [home, customers]
newsletter:
  from: hi@example.com
`;

/** A plugin that also patches what the spec has, has an operation and a summary. */
const newsletterV2: SpecPlugin = {
  ...newsletter,
  patch: () => [
    { add: "field", model: "Customer", field: "subscribed", type: "bool" },
    { add: "section", page: "home", section: "subscribe", value: { records: "Customer" } },
    { add: "menu", page: "subscribers", position: 1 },
  ],
  operations: [
    {
      name: "addList",
      summary: "Add a newsletter list.",
      schema: {
        type: "object",
        required: ["list"],
        additionalProperties: false,
        properties: { list: { type: "string" } },
      },
      positional: ["list"],
      describe: ({ list }) => `Add the ${list} list`,
      destructive: () => false,
      apply({ spec }, { list }) {
        const lists = (
          spec.has(["newsletter", "lists"]) ? spec.get(["newsletter", "lists"]) : []
        ) as string[];
        if (spec.has(["newsletter", "lists"])) spec.set(["newsletter", "lists"], [...lists, list]);
        else spec.add(["newsletter"], "lists", [list]);
        return [];
      },
    },
    {
      name: "addField",
      summary: "clashes with a built-in",
      schema: { type: "object" },
      positional: [],
      describe: () => "",
      destructive: () => false,
      apply: () => [],
    },
  ],
  summarize: (value) => [`The newsletter is sent from ${(value as { from: string }).from}.`],
};

test("a plugin patches what the spec has: a field, a landing section, a menu entry", () => {
  const { ir, diagnostics } = validateSpec(
    { path: "smithable.yml", text: subscribeSpec },
    { plugins: [newsletterV2] },
  );
  expect(diagnostics).toEqual([]);
  expect(ir?.models[0]?.fields.map((f) => f.name)).toEqual(["name", "subscribed"]);
  const home = ir?.pages.find((p) => p.id === "home");
  expect(home?.pattern.kind === "landing" && home.pattern.sections.map((s) => s.name)).toEqual([
    "hero",
    "footer",
    "subscribe",
  ]);
  expect(ir?.navigation[0]?.pages).toEqual(["home", "subscribers", "customers"]);

  // A patch that clashes or misses its target is an error at the plugin's section.
  const clashing: SpecPlugin = {
    ...newsletter,
    patch: () => [
      { add: "field", model: "Customer", field: "name", type: "string" },
      { add: "section", page: "customers", section: "hero" },
    ],
  };
  const { diagnostics: problems } = validateSpec(
    { path: "smithable.yml", text: subscribeSpec },
    { plugins: [clashing] },
  );
  expect(problems.map((d) => d.message)).toEqual([
    "The newsletter plugin adds Customer.name, which smithable.yml already has.",
    "The newsletter plugin adds a section to the customers page, which is not a landing page in smithable.yml.",
  ]);
  expect(problems.every((d) => d.line === 13)).toBe(true);
});

test("a plugin's operations join the project's, prefixed when a name is taken", () => {
  const names = operationsFor([newsletterV2]).map((o) => o.name);
  expect(names).toContain("addList");
  expect(names).toContain("newsletter:addField");
  expect(names.filter((n) => n === "addField")).toHaveLength(1);
  const result = applyOperation({ spec: subscribeSpec, plugins: [newsletterV2] }, "addList", {
    list: "offers",
  });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.description).toBe("Add the offers list");
    expect(result.files.spec).toContain("lists: [offers]");
  }
  expect(applyOperation({ spec: subscribeSpec }, "addList", { list: "offers" }).ok).toBe(false);
});

test("a plugin module is the plugin, or a function of the plugin API returning it", () => {
  expect(resolvePlugin(newsletter).key).toBe("newsletter");
  const made = resolvePlugin((api: PluginApi) => ({
    ...newsletter,
    description: `uses ${api.kebab("didYouMean")}`,
  }));
  expect(made.description).toBe("uses did-you-mean");
  expect(() => resolvePlugin({ description: "no key" }, "x.mjs")).toThrow(
    "x.mjs must export default",
  );
  expect(() => resolvePlugin({ ...newsletter, operations: [{ name: "a" }] } as never)).toThrow(
    "needs a name, a schema and apply()",
  );
});
