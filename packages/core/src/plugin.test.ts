import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import type { SpecPlugin } from "./plugin.js";
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
  expect(diagnostics).toEqual([]);
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
      text: spec("  subscribers: { crud: Class }\nnewsletter:\n  from: hi@example.com\n").replace(
        "  classes: { crud: Class }\n",
        "  classes: { crud: Class }\n",
      ),
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
