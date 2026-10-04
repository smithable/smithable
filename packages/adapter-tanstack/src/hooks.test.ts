import { emptyContent, type SpecIR, type SpecPlugin, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { hooksModule, hooksStub, pluginsWithHooks } from "./hooks.js";
import { texts } from "./shared.js";

const spec = `smithable: 0.1
app: { name: Shop }
models:
  Customer:
    fields: { name: string! }
  Order:
    fields: { number: string!, customer: Customer! }
pages:
  customers: { crud: Customer }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const t = texts(emptyContent());

test("the hooks module types a hook per model over its stored row and reads the custom hooks", () => {
  const source = hooksModule(ir, t);
  expect(source).toContain('import type * as schema from "#/db/schema";');
  expect(source).toContain("Customer: typeof schema.customers.$inferSelect;");
  expect(source).toContain("Order: typeof schema.orders.$inferSelect;");
  expect(source).toContain('import * as custom from "#/custom/hooks";');
  expect(source).toContain("const sources = (): Hooks[] => [custom.hooks];");
  expect(hooksStub()).toContain('import type { Hooks } from "#/generated/hooks";');
});

test("a plugin that emits a hooks file in its folder is read too", () => {
  const plugin: SpecPlugin = {
    key: "newsletter",
    description: "d",
    schema: { type: "object" },
    generate: () => [
      { path: "src/generated/plugins/newsletter/hooks.ts", content: "export const hooks = {};\n" },
    ],
  };
  const withSection = { ...ir, extensions: { newsletter: { from: "x" } } };
  expect(pluginsWithHooks(withSection, [plugin]).map((p) => p.key)).toEqual(["newsletter"]);
  expect(pluginsWithHooks(ir, [plugin])).toEqual([]);
  const source = hooksModule(withSection, t, [plugin]);
  expect(source).toContain('import * as newsletter from "./plugins/newsletter/hooks";');
  expect(source).toContain("[custom.hooks, newsletter.hooks]");
});
