import { expect, test } from "vitest";
import { parse } from "yaml";
import { COMPANION_SCHEMAS } from "./companion-schemas.js";
import { checkJson } from "./plugin.js";

const examples = Object.entries(
  import.meta.glob("../../../examples/*/smithable.*.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
) as [string, string][];

test("every example's companion files fit their schemas", () => {
  expect(examples.length).toBeGreaterThan(10);
  for (const [path, text] of examples) {
    const file = path.slice(path.lastIndexOf("/") + 1);
    const schema = COMPANION_SCHEMAS[file];
    expect(schema, file).toBeDefined();
    expect(checkJson(schema as never, parse(text), ""), path).toEqual([]);
  }
});

test("the schemas say what each key is for", () => {
  const silent: string[] = [];
  const walk = (node: Record<string, unknown> | undefined, path: string) => {
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(
      (node.properties ?? {}) as Record<string, Record<string, unknown>>,
    )) {
      if (
        !child.description &&
        !(child.oneOf as Record<string, unknown>[] | undefined)?.some((b) => b.description) &&
        !/^(src|alt|title|text|name|price|period|button|quote|role|question|answer|image|caption|label|link|help|delete)$/.test(
          key,
        )
      )
        silent.push(`${path}${key}`);
      walk(child, `${path}${key}.`);
    }
    walk(node.additionalProperties as Record<string, unknown>, `${path}*.`);
    walk(node.items as Record<string, unknown>, `${path}-.`);
    for (const branch of (node.oneOf ?? []) as Record<string, unknown>[]) walk(branch, path);
  };
  for (const [file, schema] of Object.entries(COMPANION_SCHEMAS))
    walk(schema as Record<string, unknown>, `${file}:`);
  expect(silent).toEqual([]);
});
