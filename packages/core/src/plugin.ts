// Project plugins (ARCHITECTURE §5.1): a top-level section Smithable does not know, handled by
// code in the project (smithable/plugins/<key>/plugin.mjs, declared in smithable.context.yml).
// The host loads the module; the engine only calls it, so this stays pure and browser-safe.
import { type Document, isMap, type ParsedNode, visit } from "yaml";
import type { Entry, ParseContext } from "./context.js";
import type { SpecIR } from "./ir.js";
import type { JsonSchema } from "./section.js";

export interface SpecPlugin {
  /** The top-level key of smithable.yml it handles, e.g. "newsletter". */
  key: string;
  /** What the section means, for people and for AI. */
  description: string;
  /** JSON Schema of the section's value; checked before anything else. */
  schema: JsonSchema;
  /**
   * The ordinary spec the section stands for (models, pages, queries, actions), merged in as
   * if written by hand, so the built-in generators build it.
   */
  expand?(value: unknown): Record<string, Record<string, unknown>>;
  /** Extra files, only under src/generated/plugins/<key>/. Must be deterministic. */
  generate?(value: unknown, ir: SpecIR): { path: string; content: string }[];
}

/** The sections a plugin may add to: the ones with named entries. */
const EXPANDABLE = ["models", "actions", "queries", "pages"];

/**
 * Checks each plugin section against its schema and merges its expansion into the document's
 * sections. Returns the sections' values, by key, for the IR's `extensions`.
 */
export function applyPlugins(
  ctx: ParseContext,
  doc: Document.Parsed,
  byKey: Map<string, Entry>,
  plugins: SpecPlugin[],
): Record<string, unknown> {
  const extensions: Record<string, unknown> = {};
  for (const plugin of plugins) {
    const entry = byKey.get(plugin.key);
    if (!entry) continue;
    const value = entry.value?.toJSON();
    const problems = checkJson(plugin.schema, value, plugin.key);
    for (const problem of problems)
      ctx.error(entry.value ?? entry.keyNode, "invalid-plugin-value", problem);
    if (problems.length) continue;
    extensions[plugin.key] = value;
    let expansion: Record<string, Record<string, unknown>> = {};
    try {
      expansion = plugin.expand?.(value) ?? {};
    } catch (error) {
      ctx.error(
        entry.keyNode,
        "plugin-failed",
        `The ${plugin.key} plugin failed: ${String(error)}`,
      );
      continue;
    }
    for (const [section, items] of Object.entries(expansion)) {
      if (!EXPANDABLE.includes(section)) {
        ctx.error(
          entry.keyNode,
          "plugin-failed",
          `The ${plugin.key} plugin may not add to "${section}".`,
        );
        continue;
      }
      let target = byKey.get(section)?.value;
      if (!isMap(target)) {
        target = doc.createNode({}) as ParsedNode;
        byKey.set(section, { key: section, keyNode: entry.keyNode, value: target });
      }
      const map = target as unknown as { has(k: string): boolean; add(pair: unknown): void };
      for (const [name, item] of Object.entries(items)) {
        if (map.has(name)) {
          ctx.error(
            entry.keyNode,
            "plugin-conflict",
            `The ${plugin.key} plugin adds ${section} "${name}", which smithable.yml already has.`,
          );
          continue;
        }
        const pair = doc.createPair(name, item);
        // Problems inside the expansion point at the plugin's section.
        visit(pair as never, {
          Node(_, node) {
            (node as { range?: unknown }).range = entry.keyNode.range;
          },
        });
        (pair.key as { range?: unknown }).range = entry.keyNode.range;
        map.add(pair);
      }
    }
  }
  return extensions;
}

/**
 * A small JSON Schema check (type, properties, required, additionalProperties, items, enum,
 * pattern, minItems, uniqueItems), enough for plugin sections, with messages that name the
 * path. Other keywords are not checked.
 */
const TYPE_WORDS: Record<string, string> = {
  array: "a list",
  integer: "a whole number",
  number: "a number",
  string: "a string",
  boolean: "true or false",
  object: "an object",
  null: "null",
};

/** Checks a value against a JSON Schema's common keywords; `path` names it in the problems. */
export function checkJson(schema: JsonSchema, value: unknown, path: string): string[] {
  const s = schema as {
    type?: string | string[];
    enum?: unknown[];
    properties?: Record<string, JsonSchema>;
    required?: string[];
    additionalProperties?: boolean | JsonSchema;
    items?: JsonSchema;
    pattern?: string;
    minItems?: number;
    uniqueItems?: boolean;
  };
  const kind = Array.isArray(value)
    ? "array"
    : value === null
      ? "null"
      : Number.isInteger(value)
        ? "integer"
        : typeof value;
  const types = s.type === undefined ? undefined : Array.isArray(s.type) ? s.type : [s.type];
  if (types && !types.some((t) => t === kind || (t === "number" && kind === "integer")))
    return [`"${path}" must be ${types.map((t) => TYPE_WORDS[t] ?? t).join(" or ")}.`];
  if (s.enum && !s.enum.includes(value))
    return [`"${path}" must be one of ${s.enum.map((v) => JSON.stringify(v)).join(", ")}.`];
  if (s.pattern && typeof value === "string" && !new RegExp(s.pattern).test(value))
    return [`"${path}" must match ${s.pattern}.`];
  const problems: string[] = [];
  if (kind === "object") {
    const object = value as Record<string, unknown>;
    for (const key of s.required ?? [])
      if (object[key] === undefined) problems.push(`"${path}" needs "${key}".`);
    for (const [key, item] of Object.entries(object)) {
      const at = path ? `${path}.${key}` : key;
      const property = s.properties?.[key];
      if (property) problems.push(...checkJson(property, item, at));
      else if (s.additionalProperties === false)
        problems.push(`Unknown key "${key}" in "${path}".`);
      else if (typeof s.additionalProperties === "object")
        problems.push(...checkJson(s.additionalProperties, item, at));
    }
  }
  if (kind === "array") {
    const items = value as unknown[];
    if (s.minItems !== undefined && items.length < s.minItems)
      problems.push(`"${path}" needs at least ${s.minItems} item${s.minItems === 1 ? "" : "s"}.`);
    if (s.uniqueItems && new Set(items.map((i) => JSON.stringify(i))).size < items.length)
      problems.push(`"${path}" has the same item twice.`);
    if (s.items)
      items.forEach((item, i) => {
        problems.push(...checkJson(s.items as JsonSchema, item, `${path}[${i}]`));
      });
  }
  return problems;
}
