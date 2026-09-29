// Project plugins (ARCHITECTURE §5.1): a top-level section Smithable does not know, handled by
// code in the project (smithable/plugins/<key>/plugin.mjs, declared in smithable.context.yml).
// The host loads the module; the engine only calls it, so this stays pure and browser-safe.
import { type Document, isMap, isSeq, type ParsedNode, visit } from "yaml";
import type { Entry, ParseContext } from "./context.js";
import type { SpecIR } from "./ir.js";
import { identifier, kebab } from "./naming.js";
import { type AnyOperation, OperationError, refTo } from "./operation.js";
import type { JsonSchema } from "./section.js";
import { didYouMean } from "./suggest.js";

/**
 * An addition to an entry smithable.yml already has: a field on an existing model, a section
 * on an existing landing page, a page in a menu. Never a change or a removal: what the spec
 * says stays true, which is what makes a plugin safe to regenerate with.
 */
export type Patch =
  | { add: "field"; model: string; field: string; type: unknown }
  | { add: "section"; page: string; section: string; value?: unknown }
  | { add: "menu"; page: string; menu?: string; position?: number };

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
  /** Additions to entries the spec already has (see Patch), applied after `expand`. */
  patch?(value: unknown): Patch[];
  /** Extra files, only under src/generated/plugins/<key>/. Must be deterministic. */
  generate?(value: unknown, ir: SpecIR): { path: string; content: string }[];
  /**
   * Operations on the section, like the built-in ones: they appear in the CLI, the MCP tools,
   * Studio's forms and what the AI may propose. A name a built-in operation already has is
   * prefixed with the plugin's key ("newsletter:addList").
   */
  operations?: AnyOperation[];
  /** The section in plain language for Builder's "Your app", one sentence per item. */
  summarize?(value: unknown): string[];
}

/**
 * What a plugin module may use without importing anything: a plugin is one ES module that also
 * runs in the browser, so it exports either the plugin, or a function of this API returning it.
 */
export interface PluginApi {
  OperationError: typeof OperationError;
  didYouMean: typeof didYouMean;
  identifier: typeof identifier;
  kebab: typeof kebab;
  refTo: typeof refTo;
}

export const PLUGIN_API: PluginApi = { OperationError, didYouMean, identifier, kebab, refTo };

/** What a plugin module exports: the plugin, or a factory given the API. */
export type PluginModule = SpecPlugin | ((api: PluginApi) => SpecPlugin);

/** The plugin a module exported, checked to be one; `where` names the module in the error. */
export function resolvePlugin(exported: unknown, where = "The plugin module"): SpecPlugin {
  const plugin =
    typeof exported === "function"
      ? (exported as (api: PluginApi) => unknown)(PLUGIN_API)
      : exported;
  const p = plugin as Partial<SpecPlugin> | undefined;
  if (!p || typeof p !== "object" || typeof p.key !== "string" || !p.schema)
    throw new Error(
      `${where} must export default { key, description, schema, expand?, patch?, generate?, operations?, summarize? }, or a function of the plugin API returning it.`,
    );
  for (const op of p.operations ?? [])
    if (typeof op.name !== "string" || !op.schema || typeof op.apply !== "function")
      throw new Error(`${where}: each operation needs a name, a schema and apply().`);
  return p as SpecPlugin;
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
    let patches: Patch[] = [];
    try {
      patches = plugin.patch?.(value) ?? [];
    } catch (error) {
      ctx.error(
        entry.keyNode,
        "plugin-failed",
        `The ${plugin.key} plugin failed: ${String(error)}`,
      );
      continue;
    }
    for (const patch of patches) applyPatch(ctx, doc, byKey, plugin.key, entry, patch);
  }
  return extensions;
}

/** Adds what a patch asks for to an entry smithable.yml has; a missing target or a clash is an error at the plugin's section. */
function applyPatch(
  ctx: ParseContext,
  doc: Document.Parsed,
  byKey: Map<string, Entry>,
  key: string,
  entry: Entry,
  patch: Patch,
): undefined {
  const fail = (message: string) => {
    ctx.error(entry.keyNode, "plugin-conflict", `The ${key} plugin ${message}`);
    return undefined;
  };
  // Everything a patch creates is reported at the plugin's section.
  const attribute = (node: unknown) => {
    visit(node as never, {
      Node(_, n) {
        (n as { range?: unknown }).range = entry.keyNode.range;
      },
    });
    return node;
  };
  const mapAt = (
    path: string[],
  ): { has(k: string): boolean; add(pair: unknown): void; get(k: string): unknown } | undefined => {
    let node: unknown = byKey.get(path[0] ?? "")?.value;
    for (const step of path.slice(1)) node = isMap(node) ? node.get(step, true) : undefined;
    return isMap(node) ? (node as never) : undefined;
  };
  if (patch.add === "field") {
    const fields = mapAt(["models", patch.model, "fields"]);
    if (!fields) return fail(`adds a field to ${patch.model}, which smithable.yml does not have.`);
    if (fields.has(patch.field))
      return fail(`adds ${patch.model}.${patch.field}, which smithable.yml already has.`);
    fields.add(attribute(doc.createPair(patch.field, patch.type)));
  } else if (patch.add === "section") {
    const landing = mapAt(["pages", patch.page, "landing"]);
    if (!landing)
      return fail(
        `adds a section to the ${patch.page} page, which is not a landing page in smithable.yml.`,
      );
    if (landing.has(patch.section))
      return fail(`adds the ${patch.section} section to ${patch.page}, which already has one.`);
    landing.add(attribute(doc.createPair(patch.section, patch.value ?? null)));
  } else if (patch.add === "menu") {
    const navigation = byKey.get("navigation")?.value;
    // Without a navigation key every page is in the main menu by default; nothing to add.
    if (!navigation) return undefined;
    const menu = isSeq(navigation)
      ? navigation
      : isMap(navigation)
        ? navigation.get(patch.menu ?? "main", true)
        : undefined;
    if (!isSeq(menu))
      return fail(
        `adds ${patch.page} to the ${patch.menu ?? "main"} menu, which smithable.yml does not have.`,
      );
    if (menu.items.some((i) => (i as { value?: unknown }).value === patch.page)) return undefined;
    const node = attribute(doc.createNode(patch.page));
    const at =
      patch.position === undefined
        ? menu.items.length
        : Math.max(0, Math.min(patch.position, menu.items.length));
    menu.items.splice(at, 0, node as never);
  }
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
      if (object[key] === undefined)
        problems.push(path ? `"${path}" needs "${key}".` : `"${key}" is missing.`);
    for (const [key, item] of Object.entries(object)) {
      const at = path ? `${path}.${key}` : key;
      const property = s.properties?.[key];
      if (property) problems.push(...checkJson(property, item, at));
      else if (s.additionalProperties === false)
        problems.push(path ? `Unknown key "${key}" in "${path}".` : `Unknown key "${key}".`);
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
