// Which operation sets which key (docs/design/what-it-does.md §4): a form's control for a key
// writes through the operation whose `sets` names it, else through editSpec of its part. The keys
// left to editSpec are a reviewed list (the snapshot): a new key in a schema shows up here, to be
// given an operation or accepted as editSpec's; it shrinks as more operations say what they set
// (what-it-does.md §5 step 3). Every `sets` pattern names a key that exists.
import { expect, test } from "vitest";
import { OPERATIONS, operationsSetting, setsKey } from "./apply.js";
import { COMPANION_SCHEMAS } from "./companion-schemas.js";
import { buildJsonSchema } from "./schema.js";
import type { JsonSchema } from "./section.js";

const SCHEMAS: Record<string, JsonSchema> = {
  "smithable.yml": buildJsonSchema(),
  "smithable.auth.yml": COMPANION_SCHEMAS["smithable.auth.yml"] as JsonSchema,
  "smithable.content.yml": COMPANION_SCHEMAS["smithable.content.yml"] as JsonSchema,
  "smithable.ux.yml": COMPANION_SCHEMAS["smithable.ux.yml"] as JsonSchema,
};

/** Every key path a schema takes, "*" for a name in a named map, without the format version. */
function keyPaths(file: string): string[][] {
  const schema = SCHEMAS[file] as JsonSchema;
  const resolve = (node: JsonSchema | undefined): JsonSchema | undefined => {
    let n = node;
    for (let i = 0; n && typeof n.$ref === "string" && i < 20; i++)
      n = n.$ref
        .replace(/^#\//, "")
        .split("/")
        .reduce<JsonSchema | undefined>((a, k) => a?.[k] as JsonSchema | undefined, schema);
    return n;
  };
  const out = new Map<string, string[]>();
  const walk = (raw: JsonSchema | undefined, path: string[], seen: Set<unknown>) => {
    const n = resolve(raw);
    if (!n || seen.has(n) || path.length > 8) return;
    const next = new Set(seen).add(n);
    if (path.length) out.set(path.join("."), path);
    for (const [k, v] of Object.entries((n.properties as Record<string, JsonSchema>) ?? {}))
      walk(v, [...path, k], next);
    if (n.additionalProperties && typeof n.additionalProperties === "object")
      walk(n.additionalProperties as JsonSchema, [...path, "*"], next);
    for (const v of Object.values((n.patternProperties as Record<string, JsonSchema>) ?? {}))
      walk(v, [...path, "*"], next);
    // A list's items: their keys under the list's ("rules.*.rule"), an index being a name too.
    if (n.items && typeof n.items === "object" && !Array.isArray(n.items))
      walk(n.items as JsonSchema, [...path, "*"], next);
    for (const k of ["oneOf", "anyOf", "allOf"])
      for (const v of (n[k] as JsonSchema[]) ?? []) walk(v, path, next);
  };
  walk(schema, [], new Set());
  return [...out.values()].filter((p) => !/^smithable/.test(p[0] ?? ""));
}

const ALL = Object.keys(SCHEMAS).flatMap((file) => keyPaths(file).map((path) => ({ file, path })));

test("the keys left to editSpec, as reviewed: every other key has its operation", () => {
  const left = ALL.filter(({ file, path }) => !operationsSetting(file, path).length).map(
    ({ file, path }) => `${file}:${path.join(".")}`,
  );
  expect(left.sort()).toMatchSnapshot();
});

test("every operation's sets names keys the schemas have, with ** only at the end", () => {
  for (const op of OPERATIONS)
    for (const pattern of op.sets ?? []) {
      expect(pattern.split(".").slice(0, -1), `${op.name}: ${pattern}`).not.toContain("**");
      expect(
        ALL.some(({ file, path }) => setsKey(pattern, file, path)),
        `${op.name}: ${pattern}`,
      ).toBe(true);
    }
});

test("a key's operation, by its path", () => {
  const names = (file: string, path: string[]) => operationsSetting(file, path).map((o) => o.name);
  expect(names("smithable.yml", ["app", "name"])).toEqual(["setApp"]);
  expect(names("smithable.content.yml", ["models", "Note", "label"])).toEqual(["setText"]);
  expect(names("smithable.auth.yml", ["roles", "sales", "write"])).toEqual(["grant"]);
  expect(names("smithable.yml", ["models", "Note", "fields", "title"])).toEqual([
    "addField",
    "changeField",
    "removeField",
  ]);
  expect(names("smithable.yml", ["models", "Note", "fields", "title", "unique"])).toEqual([
    "setFieldRules",
  ]);
  expect(names("smithable.yml", ["models", "Note", "capacity", "max"])).toEqual(["setCapacity"]);
  expect(names("smithable.yml", ["models", "Note", "fields", "title", "sequence"])).toEqual([]);
});
