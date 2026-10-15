// "What it does" from the spec's schema (docs/design/what-it-does.md §2): each key's control by
// the shape of its schema, and the walk that finds a key without one.
import type { JsonSchema } from "@smithable/core";

/**
 * The controls a key can have: a fixed set of values, yes or no, a number, a text, one value
 * the key always has, a list, a group of named keys, a named map of entries (the models, the
 * fields of a model, the pages), or alternatives (a field's short or long form).
 */
export type Control =
  | { kind: "choice"; values: string[] }
  | { kind: "check" }
  | { kind: "number"; min?: number; max?: number }
  | { kind: "text"; pattern?: string }
  | { kind: "fixed"; value: unknown }
  | { kind: "list"; items: JsonSchema }
  | { kind: "nothing" }
  | { kind: "group"; keys: [string, JsonSchema][]; kinds?: string[] }
  | { kind: "entries"; entry: JsonSchema }
  | { kind: "alternatives"; options: JsonSchema[] };

const types = (schema: JsonSchema): string[] =>
  Array.isArray(schema.type)
    ? (schema.type as string[])
    : typeof schema.type === "string"
      ? [schema.type]
      : [];

/** A key's control, by its schema's shape; undefined for a shape the form has no control for. */
export function controlOf(schema: JsonSchema): Control | undefined {
  const alternatives = (schema.oneOf ?? schema.anyOf) as JsonSchema[] | undefined;
  // Options that only say which key must be there are kinds of one group (a page is a list, a
  // landing page, a dashboard…): the kind is chosen first, then the group's keys.
  const kinds = alternatives?.every((o) =>
    Object.keys(o).every((k) => k === "required" || k === "not"),
  )
    ? alternatives.flatMap((o) => (o.required as string[] | undefined) ?? [])
    : undefined;
  if (alternatives?.length && !kinds) return { kind: "alternatives", options: alternatives };
  if (kinds && schema.properties)
    return {
      kind: "group",
      keys: Object.entries(schema.properties as Record<string, JsonSchema>),
      kinds,
    };
  if ("const" in schema) return { kind: "fixed", value: schema.const };
  if (Array.isArray(schema.enum)) return { kind: "choice", values: schema.enum.map(String) };
  const t = types(schema);
  // Written with nothing after it (a role with no settings of its own).
  if (t.length === 1 && t[0] === "null") return { kind: "nothing" };
  // Any value (a formula example's result): written as it would be in the file.
  if (!t.length && !schema.properties) return { kind: "text" };
  if (t.includes("object")) {
    const keys = Object.entries((schema.properties ?? {}) as Record<string, JsonSchema>);
    const entry = schema.additionalProperties;
    if (!keys.length && entry && typeof entry === "object")
      return { kind: "entries", entry: entry as JsonSchema };
    // A group may also take entries of its own beside its named keys (none of the spec's do).
    return { kind: "group", keys };
  }
  if (t.includes("array"))
    return { kind: "list", items: (schema.items ?? { type: "string" }) as JsonSchema };
  if (t.includes("boolean") && t.length === 1) return { kind: "check" };
  if (t.includes("integer") || t.includes("number")) {
    if (t.includes("string")) return { kind: "text" };
    return {
      kind: "number",
      ...(typeof schema.minimum === "number" ? { min: schema.minimum } : {}),
      ...(typeof schema.maximum === "number" ? { max: schema.maximum } : {}),
    };
  }
  if (t.includes("string") || t.includes("boolean"))
    return {
      kind: "text",
      ...(typeof schema.pattern === "string" ? { pattern: schema.pattern } : {}),
    };
  return undefined;
}

/**
 * Every key of a schema whose shape has no control, by its path ("models.*.fields.*"), walking
 * groups, entries, lists and alternatives. The design's test: none may be left.
 */
export function uncovered(schema: JsonSchema, path = ""): string[] {
  const control = controlOf(schema);
  if (!control) return [path || "(the file)"];
  const at = (key: string) => (path ? `${path}.${key}` : key);
  switch (control.kind) {
    case "group":
      return control.keys.flatMap(([key, s]) => uncovered(s, at(key)));
    case "entries":
      return uncovered(control.entry, at("*"));
    case "list":
      return uncovered(control.items, at("[]"));
    case "alternatives":
      return control.options.flatMap((s, i) => uncovered(s, `${path}|${i}`));
    default:
      return [];
  }
}

/** Words for keys whose description reads as a sentence, not a label (Fable, A 117 step 2). */
const LABELS: Record<string, string> = {
  description: "Description",
  type: "Type",
  trash: "Trash can",
  min: "Smallest allowed",
  max: "Largest allowed",
  default: "Default",
  required: "Required",
  unique: "Unique",
  label: "Label",
  title: "Title",
  subtitle: "Subtitle",
  name: "Name",
  intent: "What it is for",
  route: "Address",
  formula: "Formula",
};

/** A key's label: its word in LABELS, the first sentence of its description, or its name made readable. */
export function labelOf(key: string, schema: JsonSchema): string {
  const known = LABELS[key];
  if (known) return known;
  const description = typeof schema.description === "string" ? schema.description : "";
  // The first sentence: up to a stop before a capital, so "e.g." and "i.e." stay inside it.
  const first = description
    .split(/(?<!\be\.g\.|\bi\.e\.)(?<=[.:;])\s+(?=[A-Z"])/)[0]
    ?.replace(/[.:;]$/, "");
  if (first && first.length <= 80) return first;
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

/**
 * The alternative a value is written in (a field's "string!" or its long form): the first whose
 * shape fits the value, else the long form (an object) for a value not given yet.
 */
export function alternativeFor(options: JsonSchema[], value: unknown): JsonSchema | undefined {
  const fits = (s: JsonSchema) => {
    const t = types(s);
    if ("const" in s) return s.const === value;
    if (Array.isArray(s.enum)) return s.enum.includes(value);
    if (value === undefined) return t.includes("object");
    if (Array.isArray(value)) return t.includes("array");
    if (value !== null && typeof value === "object") return t.includes("object");
    return t.includes(typeof value) || (typeof value === "number" && t.includes("integer"));
  };
  return options.find(fits);
}

/**
 * The specific operation that sets a key, when there is one (what-it-does.md §2): a text of the
 * content file through setText (empty restores the default), the app's name, description,
 * currency and time zone through setApp. Undefined leaves it to editSpec with the key's path.
 */
export function operationFor(
  file: string,
  path: (string | number)[],
  value: unknown,
): [string, Record<string, unknown>] | undefined {
  if (
    file === "smithable.content.yml" &&
    path.length >= 2 &&
    path.every((p) => typeof p === "string") &&
    (typeof value === "string" || value === undefined)
  )
    return ["setText", { path, text: value ?? "" }];
  const [first, key] = path;
  if (
    file === "smithable.yml" &&
    path.length === 2 &&
    first === "app" &&
    typeof key === "string" &&
    ["name", "description", "currency", "timezone"].includes(key) &&
    typeof value === "string"
  )
    return ["setApp", { [key]: value }];
  return undefined;
}
