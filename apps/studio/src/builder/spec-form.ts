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
  // The content file's, whose descriptions are sentences for the tooltip (A 168).
  subject: "Subject",
  text: "Text",
  thanks: "After sending",
  address: "Address",
  phone: "Phone",
  email: "Email",
  src: "Picture file",
  generated: "Made by an AI",
  fields: "Fields",
  results: "Results heading",
  sections: "Section headings",
  reserve: "Reservation block",
  hosting: "Where it is hosted",
  about: "What it is for",
};

/** A key's label: its word in LABELS, the first sentence of its description, or its name made readable. */
export function labelOf(key: string, schema: JsonSchema): string {
  // The schema's own title where it gives one (core, Fable 46 (c)): "Currency", "Time zone".
  if (typeof schema.title === "string" && schema.title) return schema.title;
  const known = LABELS[key];
  if (known) return known;
  // Without an example in the file's own syntax ("{ admin: { label: … } }"), which is for the
  // tooltip, never a heading (A 168).
  const description = (typeof schema.description === "string" ? schema.description : "").replace(
    /[\s:,]*\{.*$/s,
    "",
  );
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
 * Alternatives that are one word or a list (a grant: all, or the names): the word and the list's
 * schema, so the form shows one check for the word and the list's chips otherwise.
 */
export function wordOrList(options: JsonSchema[]): { word: string; list: JsonSchema } | undefined {
  const rest = options.filter((o) => !(types(o).length === 1 && types(o)[0] === "null"));
  const list = rest.find((o) => types(o).includes("array"));
  const word = (
    rest.find((o) => Array.isArray(o.enum) && o.enum.length === 1)?.enum as unknown[]
  )?.[0];
  return rest.length === 2 && list && typeof word === "string" ? { word, list } : undefined;
}

/** A new entry of a named map, as the form's Add writes it: an empty map. */
/** The value at a path of a parsed file. */
const at = (whole: unknown, path: (string | number)[]): unknown =>
  path.reduce<unknown>((v, k) => (v as Record<string | number, unknown> | undefined)?.[k], whole);

/** A copy of a group or list with the value at a path inside it set (or taken away). */
function setIn(
  current: unknown,
  path: (string | number)[],
  value: unknown,
): Record<string, unknown> | undefined {
  const [step, ...rest] = path;
  if (step === undefined)
    return value === undefined ? undefined : (value as Record<string, unknown>);
  const copy: Record<string | number, unknown> = Array.isArray(current)
    ? ([...current] as unknown as Record<number, unknown>)
    : { ...((current ?? {}) as Record<string, unknown>) };
  const inner = rest.length ? setIn(copy[step], rest, value) : value;
  if (inner === undefined) {
    if (Array.isArray(copy)) (copy as unknown[]).splice(Number(step), 1);
    else delete copy[step];
  } else copy[step] = inner;
  return copy as Record<string, unknown>;
}

/** A condition on a record's values ({ status: closed }). */
const isCondition = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isNew = (value: unknown) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  !Object.keys(value).length;

/**
 * The specific operation that sets a key, when there is one (what-it-does.md §2): a text of the
 * content file through setText (empty restores the default), the app's name, description,
 * currency, time zone and formats through setApp; the Data keys each through the operation that
 * sets them (a key of a group written whole, from `whole`, the file as it is). Undefined leaves it
 * to editSpec with the key's path.
 */
export function operationFor(
  file: string,
  path: (string | number)[],
  value: unknown,
  whole?: unknown,
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
    ["name", "description", "currency", "timezone", "clock", "date", "week", "numbers"].includes(
      key,
    ) &&
    typeof value === "string"
  )
    return ["setApp", { [key]: value }];
  const [, name, third, field] = path;
  // A field written in the short form: its type and modifiers through changeField, which keeps
  // the data it can; taken away through removeField (a migration's, confirmed first).
  const added = isNew(value);
  // A new kind of record: added with a required name, its fields then added and changed.
  if (
    file === "smithable.yml" &&
    path.length === 2 &&
    first === "models" &&
    typeof key === "string" &&
    added
  )
    return ["addModel", { model: key, fields: { name: "string!" } }];
  if (
    file === "smithable.yml" &&
    path.length === 4 &&
    first === "models" &&
    third === "fields" &&
    typeof name === "string" &&
    typeof field === "string"
  ) {
    // A new field starts as a text; its type is changed after, through changeField.
    if (added) return ["addField", { model: name, field, type: "string" }];
    if (typeof value === "string") return ["changeField", { model: name, field, type: value }];
    if (value === undefined) return ["removeField", { model: name, field }];
  }
  // A page or an action taken away through its own operation, which follows its references.
  if (
    file === "smithable.yml" &&
    path.length === 2 &&
    typeof key === "string" &&
    value === undefined
  ) {
    if (first === "pages") return ["removePage", { page: key }];
    if (first === "actions") return ["removeAction", { action: key }];
  }
  // A page's icon in the menu.
  if (
    file === "smithable.ux.yml" &&
    path.length === 3 &&
    first === "pages" &&
    third === "icon" &&
    typeof name === "string"
  )
    return ["setIcon", { page: name, icon: typeof value === "string" ? value : "auto" }];
  // Access: the default, and what visitors may open, read and add.
  if (
    file === "smithable.auth.yml" &&
    path.length === 1 &&
    first === "defaultAccess" &&
    typeof value === "string"
  )
    return ["setDefaultAccess", { access: value }];
  if (
    file === "smithable.auth.yml" &&
    path.length === 2 &&
    first === "public" &&
    typeof key === "string" &&
    ["pages", "read", "create"].includes(key) &&
    (Array.isArray(value) || value === undefined)
  )
    return ["setPublic", { [key]: value ?? [] }];
  // A role: the whole app, or what it may do beyond the record rule, a grant at a time.
  if (file === "smithable.auth.yml" && first === "roles" && typeof key === "string") {
    if (path.length === 2 && value === "all") return ["grant", { role: key, what: "all" }];
    if (
      path.length === 3 &&
      typeof third === "string" &&
      ["pages", "read", "create", "write", "delete", "actions", "review"].includes(third) &&
      (Array.isArray(value) || value === "all" || value === undefined)
    )
      return [
        "grant",
        {
          role: key,
          what: third,
          names: value === "all" ? ["all"] : value?.length ? value : ["none"],
        },
      ];
  }
  if (file === "smithable.yml") {
    const model = typeof key === "string" ? key : "";
    // What a thing means, for the assistant and developers: the app's intent, a model's or a
    // field's description and intent (setMeaning; empty removes it).
    const meaning = (concept: string, which: string) =>
      (typeof value === "string" || value === undefined) &&
      ["description", "intent"].includes(which)
        ? (["setMeaning", { concept, [which]: value ?? "" }] as [string, Record<string, unknown>])
        : undefined;
    if (path.length === 2 && first === "app" && key === "intent") return meaning("app", "intent");
    // A page's lists, filters and choices, each through its own operation (the lists written whole).
    if (first === "pages" && model) {
      const page = model;
      const own = path[2];
      const op = (name: string, args: Record<string, unknown>) =>
        [name, { page, ...args }] as [string, Record<string, unknown>];
      if (path.length === 3) {
        const list = { search: "setSearch", filters: "setFilters", sortable: "setSortable" }[
          String(own)
        ];
        if (list && (value === undefined || Array.isArray(value)))
          return op(list, { fields: value ?? [] });
        if (own === "export" && (value === undefined || value === false))
          return op("setExport", { offered: value === false ? "off" : "on" });
        if (
          own === "favorites" &&
          (value === undefined || typeof value === "boolean" || value === "only")
        )
          return op("setFavorites", { mode: value === "only" ? "only" : value ? "on" : "off" });
        if (own === "mine" && (value === undefined || typeof value === "boolean"))
          return op("setMine", { mode: value ? "on" : "off" });
        if (own === "period") {
          if (value === undefined) return op("setPeriod", { field: "none" });
          if (typeof value === "string") return op("setPeriod", { field: value });
          if (isCondition(value)) return op("setPeriod", { byModel: value });
        }
        // What the page means; an action of the same name would take setMeaning's concept.
        const actions = (whole as { actions?: Record<string, unknown> } | undefined)?.actions;
        if ((own === "description" || own === "intent") && !actions?.[page])
          return meaning(page, own);
      }
      if (own === "contact" && path.length <= 4) {
        if (path.length === 3 && value === undefined) return op("setContact", {});
        const next = setIn(at(whole, path.slice(0, 3)), path.slice(3), value) as unknown;
        const contact = typeof next === "string" ? { to: next } : (next as Record<string, unknown>);
        if (typeof contact?.to === "string")
          return op("setContact", {
            to: contact.to,
            ...(typeof contact.keep === "string" ? { keep: contact.keep } : {}),
          });
      }
      // A filter's value until the viewer chooses: one filter at a time, "none" taking it away.
      if (own === "defaultFilter" && path.length <= 4) {
        const asText = (v: unknown) =>
          Array.isArray(v) ? v.map(String).join(",") : v === undefined ? "none" : String(v);
        if (path.length === 4)
          return op("setDefaultFilter", { field: path[3], value: asText(value) });
        const before = (at(whole, path) ?? {}) as Record<string, unknown>;
        const after = (isCondition(value) ? value : {}) as Record<string, unknown>;
        const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
          (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
        );
        if (changed.length === 1)
          return op("setDefaultFilter", {
            field: changed[0],
            value: asText(after[changed[0] ?? ""]),
          });
      }
    }
    if (first === "models" && model) {
      const own = path[2];
      if (path.length === 3 && (own === "description" || own === "intent"))
        return meaning(model, own);
      if (
        path.length === 3 &&
        own === "trash" &&
        (typeof value === "boolean" || value === undefined)
      )
        return ["setTrash", { model, trash: value === true }];
      if (
        path.length === 3 &&
        own === "ownedBy" &&
        (typeof value === "string" || value === undefined)
      )
        return ["setOwner", { model, ...(value ? { field: value } : {}) }];
      if (path.length === 3 && own === "namedBy") {
        if (value === undefined || (Array.isArray(value) && !value.length))
          return ["setNamedBy", { model, none: true }];
        if (typeof value === "string") return ["setNamedBy", { model, parts: [value] }];
        if (Array.isArray(value) && value.length) return ["setNamedBy", { model, parts: value }];
      }
      if (path.length === 3 && own === "review") {
        if (value === undefined || (Array.isArray(value) && !value.length))
          return ["setReview", { model, fields: ["none"] }];
        if (value === "all") return ["setReview", { model, fields: ["all"] }];
        if (Array.isArray(value) && value.length) return ["setReview", { model, fields: value }];
      }
      // A field's rules: who fills it, locked, required while a condition holds, unique.
      if (path.length === 5 && own === "fields" && typeof field === "string") {
        const which = path[4];
        if (which === "description" || which === "intent")
          return meaning(`${model}.${field}`, which);
        const rules = (args: Record<string, unknown>) =>
          ["setFieldRules", { model, field, ...args }] as [string, Record<string, unknown>];
        if (which === "by" && (value === "app" || value === undefined))
          return rules({ by: value ?? "" });
        if (
          which === "unique" &&
          (value === undefined ||
            typeof value === "boolean" ||
            value === "owner" ||
            value === "app")
        )
          return rules({ unique: String(value ?? false) });
        if (which === "locked") {
          if (value === true) return rules({ once: true, locked: {} });
          if (value === undefined || value === false) return rules({ once: false, locked: {} });
          if (isCondition(value)) return rules({ once: false, locked: value });
        }
        // Always required is the type's "!" (changeField); a condition is the field's rule.
        if (which === "required" && (value === undefined || isCondition(value)))
          return rules({ required: value ?? {} });
      }
      // A conversation's fields, the whole setting or one of its keys, through setThread.
      if (own === "thread" && path.length >= 3 && path.length <= 4) {
        if (path.length === 3 && value === undefined) return ["setThread", { model, none: true }];
        const next = setIn(at(whole, path.slice(0, 3)), path.slice(3), value);
        // A key taken away is left to editSpec: setThread keeps what it is not given.
        if (next && (path.length === 3 || value !== undefined)) {
          const side = next.side as { field?: unknown; ours?: unknown } | undefined;
          // A side half given (its field without our value) is kept by editSpec until whole.
          const paired = typeof side?.field === "string" && typeof side.ours === "string";
          if (side !== undefined && !paired) return undefined;
          const args = {
            ...(typeof next.body === "string" ? { body: next.body } : {}),
            ...(typeof next.author === "string" ? { author: next.author } : {}),
            ...(paired ? { side: side?.field, ours: side?.ours } : {}),
          };
          if (Object.keys(args).length) return ["setThread", { model, ...args }];
        }
      }
      // A limit per referenced record, written whole by setCapacity.
      if (own === "capacity" && path.length >= 3) {
        if (path.length === 3 && value === undefined)
          return ["setCapacity", { model, per: "none" }];
        const next = setIn(at(whole, path.slice(0, 3)), path.slice(3), value);
        if (next && typeof next.per === "string" && next.max !== undefined)
          return [
            "setCapacity",
            {
              model,
              per: next.per,
              max: String(next.max),
              ...(isCondition(next.where) ? { where: next.where } : {}),
              ...(typeof next.closes === "string" ? { closes: next.closes } : {}),
              ...(typeof next.cancelUntil === "string" ? { cancelUntil: next.cancelUntil } : {}),
            },
          ];
      }
      // When a booked record is free, written whole by setSchedule (its hours, breaks, gap, time away).
      if (own === "schedule" && path.length >= 3) {
        if (path.length === 3 && value === undefined)
          return ["setSchedule", { model, hours: "none" }];
        const next = setIn(at(whole, path.slice(0, 3)), path.slice(3), value);
        if (next && isCondition(next.hours) && Object.keys(next.hours).length)
          return [
            "setSchedule",
            {
              model,
              hours: next.hours,
              ...(next.breaks !== undefined ? { breaks: next.breaks } : {}),
              ...(next.gap !== undefined ? { gap: String(next.gap) } : {}),
              ...(next.away !== undefined ? { away: next.away } : {}),
            },
          ];
      }
      // Whose time a record takes, written whole by setOccupies.
      if (own === "occupies" && path.length >= 3) {
        if (path.length === 3 && value === undefined)
          return ["setOccupies", { model, resource: "none" }];
        const next = setIn(at(whole, path.slice(0, 3)), path.slice(3), value);
        const text = (key: string) => (typeof next?.[key] === "string" ? next[key] : undefined);
        if (next && text("resource") && text("starts") && text("duration"))
          return [
            "setOccupies",
            {
              model,
              resource: text("resource"),
              starts: text("starts"),
              duration: text("duration"),
              ...(isCondition(next.while) ? { while: next.while } : {}),
              ...(text("cancelUntil") ? { cancelUntil: text("cancelUntil") } : {}),
              ...(text("cancelTo") ? { cancelTo: text("cancelTo") } : {}),
            },
          ];
      }
      // Fields unique together: one rule added, taken away or given another scope is one setUnique.
      if (own === "unique" && path.length >= 3) {
        const rules = (list: unknown) =>
          (Array.isArray(list) ? list : []).map((e) =>
            Array.isArray(e)
              ? { fields: e.map(String) }
              : {
                  fields: ((e as { fields?: unknown[] })?.fields ?? []).map(String),
                  scope: (e as { scope?: string })?.scope,
                },
          );
        const before = rules(at(whole, path.slice(0, 3)));
        const after = rules(
          path.length === 3 ? value : setIn(at(whole, path.slice(0, 3)), path.slice(3), value),
        );
        const key = (r: { fields: string[] }) => [...r.fields].sort().join(" ");
        const gone = before.filter((b) => !after.some((a) => key(a) === key(b)));
        const added = after.filter(
          (a) => !before.some((b) => key(a) === key(b) && a.scope === b.scope),
        );
        if (gone.length === 1 && !added.length)
          return ["setUnique", { model, fields: gone[0]?.fields, remove: true }];
        if (added.length === 1 && !gone.length && (added[0]?.fields.length ?? 0) >= 2)
          return [
            "setUnique",
            {
              model,
              fields: added[0]?.fields,
              ...(added[0]?.scope ? { scope: added[0].scope } : {}),
            },
          ];
      }
    }
  }
  return undefined;
}

const GRANT_MODELS = ["read", "create", "write", "delete", "review"];

/**
 * The names a list of names in the auth file offers (its roles' and visitors' grants): the pages,
 * the kinds of record or the custom actions of the app, read from smithable.yml.
 */
export function choicesFor(file: string, path: (string | number)[], spec: unknown): string[] {
  if (file !== "smithable.auth.yml") return [];
  const what =
    path[0] === "roles" && path.length === 3
      ? path[2]
      : path[0] === "public" && path.length === 2
        ? path[1]
        : undefined;
  const keys = (key: string) =>
    Object.keys(((spec ?? {}) as Record<string, Record<string, unknown> | undefined>)[key] ?? {});
  if (what === "pages") return keys("pages");
  if (what === "actions") return keys("actions");
  if (typeof what === "string" && GRANT_MODELS.includes(what)) return keys("models");
  return [];
}

/**
 * The operation that renames an entry of a named map, when there is one: a field, a kind of
 * record or a page through its rename, which keeps its data and follows every reference.
 * Undefined offers no rename (a plain edit would lose it).
 */
export function renameFor(
  file: string,
  path: (string | number)[],
  to: string,
): [string, Record<string, unknown>] | undefined {
  const [first, model, third, from] = path;
  if (
    file === "smithable.yml" &&
    path.length === 4 &&
    first === "models" &&
    third === "fields" &&
    typeof model === "string" &&
    typeof from === "string"
  )
    return ["renameField", { model, from, to }];
  if (file === "smithable.yml" && path.length === 2 && typeof model === "string") {
    if (first === "models") return ["renameModel", { from: model, to }];
    if (first === "pages") return ["renamePage", { from: model, to }];
  }
  return undefined;
}

/** An entry's name as a heading: in words in the content file, whose names are other files' (A 168). */
export const entryHeading = (name: string, inContent: boolean): string =>
  inContent
    ? name
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[-_]/g, " ")
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase())
    : name;
