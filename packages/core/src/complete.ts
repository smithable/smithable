// What can be written at a place in smithable.yml, and what a word there means: for an editor
// (Studio's Code mode). From the schema every section registers (the keys with their
// descriptions, the fixed values) and from the app's own names in the text (its kinds of
// record, their fields, its pages and actions), which no schema knows. The place is read from
// the text's indentation, since a text that is being typed is seldom valid YAML.

import { COMPANION_SCHEMAS } from "./companion-schemas.js";
import { SCALAR_TYPES, USER_MODEL } from "./ir.js";
import { LANDING_SECTIONS } from "./patterns.js";
import { buildJsonSchema } from "./schema.js";
import type { JsonSchema } from "./section.js";

export interface Suggestion {
  label: string;
  /** What it is, in a sentence: a key's description from the schema. */
  detail?: string;
  /** What is put in the text for it, when that is more than the label. */
  insert?: string;
}

export interface Completion {
  /** The stretch of text the suggestions replace: what is written of the word so far. */
  from: number;
  to: number;
  /** They are values of a key; otherwise keys. */
  value: boolean;
  suggestions: Suggestion[];
}

/**
 * What the editor knows that the text may not say: the roles of smithable.auth.yml, and for a
 * companion file the spec's text, whose models, fields and pages it names.
 */
export interface Known {
  roles?: string[];
  spec?: string;
}

/** The files the editor can help with: smithable.yml and its companions. */
export type EditedFile = "smithable.yml" | keyof typeof COMPANION_SCHEMAS;

interface Place {
  /** The keys above the cursor, outermost first; "-" is an item of a list. */
  path: string[];
  /** The key whose value is being written; none when a key is. */
  key?: string;
  /** The value is an item of a [list] written on the line. */
  list: boolean;
  /** What is written of the word so far, and what the line's list already holds. */
  typed: string;
  written: string[];
}

const KEY_LINE = /^( *)(- )?([^\s:#][^:#]*?):(?:\s|$)/;

/** The keys above a line, from the indentation of the lines before it. */
function above(lines: string[], index: number, indent: number): string[] {
  const path: string[] = [];
  let level = indent;
  for (let i = index - 1; i >= 0 && level > 0; i--) {
    const line = lines[i] ?? "";
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const at = /^ */.exec(line)?.[0].length ?? 0;
    if (at >= level) continue;
    const key = KEY_LINE.exec(line);
    // An item of a list ("- key: …"): its keys stand two further in. A line at that depth is
    // another key of the same item; a deeper one is inside the item's key.
    if (key?.[2]) {
      if (level > at + 2) path.unshift(key[3] as string);
      path.unshift("-");
    } else if (key) path.unshift(key[3] as string);
    else if (/^ *- /.test(line)) path.unshift("-");
    level = at;
  }
  return path;
}

/** Where the cursor is: under which keys, and whether a key or a value is being written. */
function placeAt(text: string, offset: number): Place | undefined {
  const start = text.lastIndexOf("\n", offset - 1) + 1;
  const line = text.slice(start, offset);
  const lines = text.slice(0, start).split("\n");
  const indent = /^ */.exec(line)?.[0].length ?? 0;
  const dash = line.slice(indent).startsWith("- ");
  const body = line.slice(indent + (dash ? 2 : 0));
  // A new item of a list stands under the list's key, beside the items before it.
  const path = above(lines, lines.length - 1, indent);
  if (dash) path.push("-");
  // The line itself: a key and its value, and the {maps} and [lists] opened on it.
  const open: { list: boolean; key?: string; written: string[] }[] = [];
  let key: string | undefined;
  let word = "";
  let quote = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i] as string;
    if (quote) {
      if (c === quote) quote = "";
      word += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      word += c;
    } else if (c === "#" && (i === 0 || body[i - 1] === " ")) return undefined;
    else if (c === ":" && (i + 1 === body.length || body[i + 1] === " ")) {
      key = word.trim();
      word = "";
    } else if (c === "{" || c === "[") {
      open.push({ list: c === "[", ...(key ? { key } : {}), written: [] });
      if (c === "{") key = undefined;
      word = "";
    } else if (c === "}" || c === "]") {
      open.pop();
      key = undefined;
      word = "";
    } else if (c === ",") {
      const top = open.at(-1);
      if (top?.list) top.written.push(word.trim());
      else key = undefined;
      word = "";
    } else word += c;
  }
  if (quote) return undefined;
  for (const map of open) if (!map.list && map.key) path.push(map.key);
  const top = open.at(-1);
  const typed = word.trimStart();
  if (top?.list)
    return { path, list: true, typed, written: top.written, ...(top.key ? { key: top.key } : {}) };
  return { path, list: false, typed, written: [], ...(key ? { key } : {}) };
}

type Node = JsonSchema & {
  properties?: Record<string, Node>;
  additionalProperties?: Node | boolean;
  items?: Node;
  oneOf?: Node[];
  anyOf?: Node[];
  enum?: unknown[];
  type?: string | string[];
  description?: string;
};

/**
 * A schema as the plain schemas it may be: itself without its alternatives (a page has its keys
 * beside "exactly one of these patterns"), and each alternative, with the description of the
 * whole where it has none of its own.
 */
function branches(node: Node): Node[] {
  const alternatives = node.oneOf ?? node.anyOf;
  if (!alternatives) return [node];
  const { oneOf: _one, anyOf: _any, ...own } = node;
  return [
    own,
    ...alternatives.flatMap((a) =>
      branches(a.description || !node.description ? a : { ...a, description: node.description }),
    ),
  ];
}

/** The schemas of what stands under a key (or, for "-", of a list's items). */
function under(nodes: Node[], segment: string): Node[] {
  return nodes.flatMap(branches).flatMap((node) => {
    if (segment === "-") return node.items ? [node.items] : [];
    const named = node.properties?.[segment];
    if (named) return [named];
    return typeof node.additionalProperties === "object" ? [node.additionalProperties] : [];
  });
}

// Built once: it is asked at every keystroke.
let schema: Node | undefined;
const rootOf = (file: EditedFile): Node => {
  if (file !== "smithable.yml") return COMPANION_SCHEMAS[file] as Node;
  schema ??= buildJsonSchema() as Node;
  return schema;
};
const schemaAt = (path: string[], file: EditedFile = "smithable.yml"): Node[] =>
  path.reduce((nodes, segment) => under(nodes, segment), [rootOf(file)]);

/** The app's own names, as far as the text's indentation tells them. */
function namesIn(text: string) {
  const models = new Map<string, string[]>();
  const pages = new Map<string, string | undefined>();
  const actions = new Map<string, string | undefined>();
  let section = "";
  let entry = "";
  let inFields = false;
  for (const line of text.split("\n")) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const at = /^ */.exec(line)?.[0].length ?? 0;
    const key = KEY_LINE.exec(line)?.[3];
    if (at === 0) {
      section = key ?? "";
      entry = "";
    } else if (at === 2 && key) {
      entry = key;
      inFields = false;
      if (section === "models") models.set(entry, []);
      if (section === "pages") pages.set(entry, undefined);
      if (section === "actions") actions.set(entry, undefined);
      // Written on one line: "customers: { crud: Customer }", "Tag: { fields: { name: string! } }".
      const inline = line.slice(line.indexOf(":") + 1);
      const of = /\b(?:crud|calendar|articles|on|model):\s*([A-Z][A-Za-z0-9]*)/.exec(inline)?.[1];
      if (section === "pages") pages.set(entry, of);
      if (section === "actions") actions.set(entry, of);
      const fields = /\bfields:\s*\{([^}]*)/.exec(inline)?.[1];
      if (section === "models" && fields)
        models.set(
          entry,
          [...fields.matchAll(/([a-z][A-Za-z0-9]*)\s*:/g)].map((m) => m[1] as string),
        );
    } else if (at === 4 && key && entry) {
      inFields = section === "models" && key === "fields";
      const of = /^\s*(?:crud|calendar|articles|on):\s*([A-Z][A-Za-z0-9]*)/.exec(line)?.[1];
      if (of && section === "pages") pages.set(entry, of);
      if (of && section === "actions") actions.set(entry, of);
    } else if (at === 6 && key && inFields) models.get(entry)?.push(key);
  }
  return { models, pages, actions };
}

/** The app's own names that fit a place: a value's, or (for `keys`) the keys of a map. */
function ownNames(place: Place, text: string, known: Known, keys: boolean): string[] | undefined {
  const { models, pages, actions } = namesIn(text);
  const [section, entry, part] = place.path;
  const depth = place.path.length;
  const fieldsOf = (model: string | undefined) => (model ? (models.get(model) ?? []) : []);
  if (keys) {
    // What an action sets or asks for is said by the fields of its model.
    if (section === "actions" && depth === 3 && ["when", "set", "copy"].includes(part ?? ""))
      return fieldsOf(actions.get(entry ?? ""));
    // A landing page's sections that are what their name says (the others say it inside).
    if (section === "pages" && depth === 3 && part === "landing")
      return Object.keys(LANDING_SECTIONS).filter(
        (kind) => !["records", "calculator", "custom"].includes(kind),
      );
    return undefined;
  }
  const key = place.key;
  const kinds = [...models.keys()];
  if (depth === 0 && key === "navigation") return [...pages.keys()];
  if (section === "models") {
    if (part === "fields" && (depth === 3 || (depth === 4 && key === "type")))
      return [...SCALAR_TYPES, ...kinds, USER_MODEL];
    if (depth === 2 && key === "ownedBy") return fieldsOf(entry);
  }
  if (section === "pages" && depth === 2) {
    if (["crud", "calendar", "articles", "data"].includes(key ?? "")) return kinds;
    if (["search", "filters", "sortable"].includes(key ?? ""))
      return fieldsOf(pages.get(entry ?? ""));
    if (key === "actions") return [...actions.keys()];
  }
  if (section === "pages" && depth === 3 && key === "model") return kinds;
  // A landing page's section, a dashboard's tile.
  if (section === "pages" && depth === 4) {
    if (["records", "form", "count", "list"].includes(key ?? "")) return kinds;
    if (["button", "shortcuts"].includes(key ?? "")) return [...pages.keys()];
  }
  if (section === "actions" && depth === 2) {
    if (key === "on") return kinds;
    if (key === "with") return fieldsOf(actions.get(entry ?? ""));
  }
  return undefined;
}

/**
 * The spec's names where a companion file names them: models and their fields under "models",
 * pages under "pages", and models, pages and roles in the auth file's lists.
 */
function companionNames(
  file: EditedFile,
  place: Place,
  known: Known,
  keys: boolean,
): string[] | undefined {
  const { models, pages, actions } = namesIn(known.spec ?? "");
  const kinds = [...models.keys()];
  const pageIds = [...pages.keys()];
  const [section, entry, part] = place.path;
  const depth = place.path.length;
  if (keys) {
    if (section === "models" && depth === 1) return kinds;
    if (section === "models" && depth === 3 && part === "fields")
      return models.get(entry ?? "") ?? [];
    if (section === "pages" && depth === 1) return pageIds;
    if (file === "smithable.ux.yml" && section === "tones" && depth === 1)
      return kinds.flatMap((m) => (models.get(m) ?? []).map((f) => `${m}.${f}`));
    return undefined;
  }
  const key = place.key;
  if (file === "smithable.auth.yml") {
    if (section === "public" && depth === 1 && key === "pages") return pageIds;
    if (section === "public" && depth === 1 && (key === "read" || key === "create")) return kinds;
    if (section === "api" && depth === 1 && (key === "models" || key === "except")) return kinds;
    if (section === "assistant" && depth === 1 && key === "for") return known.roles ?? [];
    // A role's grants: pages, models and custom actions by name, or all.
    if (section === "roles" && depth === 2) {
      if (key === "pages") return ["all", ...pageIds];
      if (["read", "create", "write", "delete"].includes(key ?? "")) return ["all", ...kinds];
      if (key === "actions") return ["all", ...actions.keys()];
    }
    if (depth === 0 && key === "defaultRole") return known.roles ?? [];
  }
  if (file === "smithable.ux.yml" && section === "pages" && depth === 3) {
    const fields = (() => {
      const spec = known.spec ?? "";
      const model = /^ {4}(?:crud|calendar|articles):\s*([A-Z][A-Za-z0-9]*)/m.exec(
        spec.slice(spec.indexOf(`\n  ${entry}:`)),
      )?.[1];
      return model ? (models.get(model) ?? []) : kinds.flatMap((m) => models.get(m) ?? []);
    })();
    if (part === "table" && ["columns", "sort", "below"].includes(key ?? "")) return fields;
    if (part === "form" && key === "fieldOrder") return fields;
  }
  return undefined;
}

/** The keys already written beside the one being written at `offset`: in its map, or its item of a list. */
function siblings(text: string, offset: number): Set<string> {
  const lines = text.split("\n");
  const index = text.slice(0, offset).split("\n").length - 1;
  const column = (line: string) => /^ *(- )?/.exec(line)?.[0].length ?? 0;
  const indent = column(lines[index] ?? "");
  const found = new Set<string>();
  for (const step of [-1, 1]) {
    // Upwards the item's first line ("- key: …") is the last of it; downwards the next one's ends it.
    let i = index;
    if (step === 1 || !/^ *- /.test(lines[index] ?? ""))
      for (i += step; i >= 0 && i < lines.length; i += step) {
        const line = lines[i] ?? "";
        if (!line.trim() || /^\s*#/.test(line)) continue;
        const first = /^ *- /.test(line);
        if (column(line) < indent || (first && step === 1 && column(line) === indent)) break;
        const key = column(line) === indent ? KEY_LINE.exec(line)?.[3] : undefined;
        if (key) found.add(key);
        if (first && column(line) === indent) break;
      }
  }
  return found;
}

const sentence = (description: string | undefined) =>
  description ? (/^.*?\.(?=\s|$)/.exec(description)?.[0] ?? description) : undefined;

/**
 * What can be written at `offset`: the keys that may stand there and are not there yet, or the
 * values the key takes (its fixed values, yes or no, or the app's own names that fit). Nothing
 * when the place is free text, a comment, or not understood.
 */
export function completeSpec(
  text: string,
  offset: number,
  known: Known = {},
  file: EditedFile = "smithable.yml",
): Completion | undefined {
  const place = placeAt(text, offset);
  if (!place) return undefined;
  const names = (keys: boolean) =>
    file === "smithable.yml"
      ? ownNames(place, text, known, keys)
      : companionNames(file, place, known, keys);
  const fits = (label: string) => label.toLowerCase().startsWith(place.typed.toLowerCase());
  let suggestions: Suggestion[];
  if (place.key === undefined) {
    const there = siblings(text, offset);
    const fromSchema = schemaAt(place.path, file)
      .flatMap(branches)
      .flatMap((node) => Object.entries(node.properties ?? {}))
      .map(([label, node]) => {
        const detail = sentence(branches(node).find((b) => b.description)?.description);
        return { label, insert: `${label}: `, ...(detail ? { detail } : {}) };
      });
    const own = (names(true) ?? []).map((label) => ({
      label,
      insert: `${label}: `,
    }));
    const seen = new Set<string>();
    suggestions = [...fromSchema, ...own].filter(
      (s) => !there.has(s.label) && !seen.has(s.label) && seen.add(s.label) !== undefined,
    );
  } else {
    let nodes = schemaAt([...place.path, place.key], file);
    if (place.list) nodes = under(nodes, "-");
    const fixed = nodes.flatMap(branches).flatMap((node) => {
      if (Array.isArray(node.enum))
        return node.enum.filter((v) => typeof v === "string") as string[];
      const types = Array.isArray(node.type) ? node.type : [node.type];
      return types.includes("boolean") ? ["true", "false"] : [];
    });
    const own = names(false) ?? [];
    suggestions = [...new Set([...own, ...fixed])]
      .filter((label) => !place.written.includes(label))
      .map((label) => ({ label }));
  }
  suggestions = suggestions.filter((s) => fits(s.label) && s.label !== place.typed);
  if (suggestions.length === 0) return undefined;
  return {
    from: offset - place.typed.length,
    to: offset,
    value: place.key !== undefined,
    suggestions,
  };
}

/**
 * What the word at `offset` means: a key's description from the schema, or one of the app's own
 * kinds of record with its fields. Nothing for other words.
 */
export function hoverSpec(
  text: string,
  offset: number,
  file: EditedFile = "smithable.yml",
  known: Known = {},
): { from: number; to: number; text: string } | undefined {
  const start = text.lastIndexOf("\n", offset - 1) + 1;
  const end = text.indexOf("\n", offset) === -1 ? text.length : text.indexOf("\n", offset);
  const line = text.slice(start, end);
  for (const match of line.matchAll(/[A-Za-z][\w-]*/g)) {
    const from = start + (match.index ?? 0);
    const to = from + match[0].length;
    if (offset < from || offset > to) continue;
    const word = match[0];
    // A key the schema names: what it is for.
    if (/^:(\s|$)/.test(text.slice(to, to + 2))) {
      const place = placeAt(text, from);
      const declared =
        place?.key === undefined
          ? schemaAt(place?.path ?? [], file)
              .flatMap(branches)
              .map((node) => node.properties?.[word])
              .find((node) => node !== undefined)
          : undefined;
      const description = declared && branches(declared).find((b) => b.description)?.description;
      if (description) return { from, to, text: description };
    }
    // One of the app's own kinds of record, wherever it is named: what it holds.
    const fields = namesIn(file === "smithable.yml" ? text : (known.spec ?? "")).models.get(word);
    return fields
      ? { from, to, text: `${word}: ${fields.join(", ") || "no fields yet"}` }
      : undefined;
  }
  return undefined;
}
