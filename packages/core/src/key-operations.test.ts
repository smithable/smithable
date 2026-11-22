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
  "smithable.context.yml": COMPANION_SCHEMAS["smithable.context.yml"] as JsonSchema,
};

/** A list's items ("rules.*"), by file:path. */
const ITEMS = new Set<string>();
/** The keys that hold entries or items ("models") in some form, by file:path. */
const HOLDING = new Set<string>();
/** The named keys an object has in any of its forms ("app": name, description, …), by file:path. */
const NAMED = new Map<string, Set<string>>();

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
    const key = `${file}:${path.join(".")}`;
    const named = Object.keys((n.properties as Record<string, JsonSchema>) ?? {}).length > 0;
    const entries =
      (n.additionalProperties && typeof n.additionalProperties === "object") ||
      Object.keys((n.patternProperties as Record<string, JsonSchema>) ?? {}).length > 0;
    const list = !!n.items && typeof n.items === "object" && !Array.isArray(n.items);
    if (list) ITEMS.add(`${key}.*`);
    if (path.length && (entries || list)) HOLDING.add(key);
    if (path.length && named)
      for (const k of Object.keys(n.properties as Record<string, JsonSchema>))
        NAMED.set(key, (NAMED.get(key) ?? new Set()).add(k));
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

/**
 * Keys no operation sets on purpose (T1242), each with its reason; their children go with them.
 * They are a person's to write in the file, never an agent's through MCP.
 */
const EXCEPTIONS: Record<string, string> = {
  "smithable.context.yml:ai":
    "Where a model may run is a person's choice: an agent does not loosen the limit set on itself.",
  "smithable.context.yml:adapter":
    "The framework the app is generated for is chosen when the project starts, not changed by an operation.",
  "smithable.context.yml:database":
    "The database is chosen when the project starts; moving the data is a person's step.",
  "smithable.context.yml:conventions":
    "The team's own rules for code, written by its people for the models that write code.",
  "smithable.context.yml:guidance":
    "The team's own words for the models that write code, written by its people.",
  "smithable.context.yml:plugins":
    "A project plugin is declared when smithable teach writes it; its code is the team's.",
};

/** The exception a key falls under, itself or a key above it. */
const exception = (file: string, path: string[]) =>
  path.map((_, i) => `${file}:${path.slice(0, i + 1).join(".")}`).find((k) => k in EXCEPTIONS);

/**
 * Whether an operation reaches a key (T1242: MCP has no editSpec, so a key no operation reaches
 * is one an agent cannot set): one names it in its sets; or it is a list's item, set with its
 * list; or it holds entries or items, set by adding and removing them; or it is an object of
 * named keys, every one of them reached. A key taking both forms needs both.
 */
function reached(file: string, path: string[], way?: "up" | "down"): boolean {
  if (operationsSetting(file, path).length) return true;
  const key = `${file}:${path.join(".")}`;
  if (way !== "down" && ITEMS.has(key) && reached(file, path.slice(0, -1), "up")) return true;
  if (way === "up") return false;
  // A key with both forms (named keys in one, entries in another) needs both reached.
  const named = NAMED.get(key);
  const holds = HOLDING.has(key);
  if (!named && !holds) return false;
  return (
    (!holds || reached(file, [...path, "*"], "down")) &&
    (!named || [...named].every((k) => reached(file, [...path, k], "down")))
  );
}

test("the keys left to editSpec, as reviewed: every other key has its operation", () => {
  const left = ALL.filter(({ file, path }) => !reached(file, path) && !exception(file, path)).map(
    ({ file, path }) => `${file}:${path.join(".")}`,
  );
  expect(left.sort()).toMatchSnapshot();
});

test("no operation takes an argument named confirm: an MCP tool adds its own, for a change that loses data", () => {
  expect(
    OPERATIONS.filter((op) => Object.hasOwn(op.schema.properties ?? {}, "confirm")).map(
      (op) => op.name,
    ),
  ).toEqual([]);
});

test("an exception is a key the schemas have that no operation reaches", () => {
  for (const key of Object.keys(EXCEPTIONS)) {
    const [file = "", dotted = ""] = key.split(":");
    const path = dotted.split(".");
    expect(
      ALL.some((k) => k.file === file && k.path.join(".") === dotted),
      key,
    ).toBe(true);
    expect(reached(file, path), key).toBe(false);
  }
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
  expect(names("smithable.yml", ["models", "Note", "fields", "title", "sequence"])).toEqual([
    "setFieldRules",
  ]);
});
