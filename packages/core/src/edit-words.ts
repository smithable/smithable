// What an edit of a file's text did, read as operations where it can be (docs/design/studio-v3.md
// §3, Fable 46 (d)): the Changes window words an edit made in Code like a change made in No code
// ("Customers: added a website", "Removed the Suppliers page") instead of "Edit smithable.yml".
// The reading is of the YAML as written, before and after; what it cannot read as an operation
// is named as a part ("the app", "the menu", "the Customer records' settings").
import { parse } from "yaml";
import { renamedKey } from "./edit-rename.js";

export interface EditOperation {
  op: string;
  args: Record<string, unknown>;
}

export interface EditReading {
  /** The operations the edit amounts to, in the file's order. */
  operations: EditOperation[];
  /** The parts changed otherwise, as named for a person ("the app", "the Orders page"). */
  other: string[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const obj = (v: unknown): Obj => (isObj(v) ? v : {});

const PARTS: Record<string, string> = {
  app: "the app",
  navigation: "the menu",
  actions: "the actions",
  queries: "the queries",
  outgoing: "the outgoing mails and calls",
  incoming: "the incoming addresses",
};

/** A field's shorthand as the operations take it, from its value in the YAML. */
const shorthand = (value: unknown): string =>
  typeof value === "string"
    ? value
    : isObj(value) && typeof value.type === "string"
      ? value.type
      : "text";

/** The changes to one model's fields: a field renamed, added, removed or changed. */
function fieldChanges(model: string, before: Obj, after: Obj): EditOperation[] {
  const renamed = renamedKey(before, after);
  if (renamed) return [{ op: "renameField", args: { model, ...renamed } }];
  const ops: EditOperation[] = [];
  for (const field of Object.keys(before))
    if (!(field in after)) ops.push({ op: "removeField", args: { model, field } });
  for (const field of Object.keys(after)) {
    if (!(field in before))
      ops.push({ op: "addField", args: { model, field, type: shorthand(after[field]) } });
    else if (!same(before[field], after[field]))
      ops.push({ op: "changeField", args: { model, field, type: shorthand(after[field]) } });
  }
  return ops;
}

function specChanges(before: Obj, after: Obj): EditReading {
  const operations: EditOperation[] = [];
  const other: string[] = [];
  const models = { was: obj(before.models), is: obj(after.models) };
  const renamedModel = renamedKey(models.was, models.is);
  if (renamedModel) operations.push({ op: "renameModel", args: renamedModel });
  else {
    for (const name of Object.keys(models.was))
      if (!(name in models.is)) other.push(`removed the ${name} records`);
    for (const name of Object.keys(models.is)) {
      if (!(name in models.was)) {
        operations.push({ op: "addModel", args: { model: name } });
        continue;
      }
      const was = obj(models.was[name]);
      const is = obj(models.is[name]);
      if (same(was, is)) continue;
      operations.push(...fieldChanges(name, obj(was.fields), obj(is.fields)));
      const rest = (m: Obj) =>
        Object.fromEntries(Object.entries(m).filter(([k]) => k !== "fields"));
      if (!same(rest(was), rest(is))) other.push(`the ${name} records' settings`);
    }
  }
  const pages = { was: obj(before.pages), is: obj(after.pages) };
  const renamedPage = renamedKey(pages.was, pages.is);
  if (renamedPage) operations.push({ op: "renamePage", args: renamedPage });
  else {
    for (const page of Object.keys(pages.was))
      if (!(page in pages.is)) operations.push({ op: "removePage", args: { page } });
    for (const page of Object.keys(pages.is)) {
      const is = obj(pages.is[page]);
      if (!(page in pages.was))
        operations.push(
          "landing" in is
            ? { op: "addLandingPage", args: { page } }
            : { op: "addPage", args: { page, ...(is.crud ? { model: is.crud } : {}) } },
        );
      else if (!same(pages.was[page], is)) other.push(`the ${page} page`);
    }
  }
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)]))
    if (key !== "models" && key !== "pages" && !same(before[key], after[key]))
      other.push(PARTS[key] ?? key);
  return { operations, other };
}

/** Every text that differs, as setText of its path: the content file's leaves. */
function textChanges(before: unknown, after: unknown, path: string[], ops: EditOperation[]): void {
  if (isObj(before) || isObj(after)) {
    const b = obj(before);
    const a = obj(after);
    for (const key of new Set([...Object.keys(b), ...Object.keys(a)]))
      textChanges(b[key], a[key], [...path, key], ops);
    return;
  }
  if (same(before, after)) return;
  ops.push({
    op: "setText",
    args: after === undefined ? { path } : { path, text: String(after) },
  });
}

/**
 * The edit of a file from one text to another, as operations and the parts changed otherwise;
 * undefined when either text is not YAML or nothing changed.
 */
export function editAsOperations(
  before: string,
  after: string,
  file = "smithable.yml",
): EditReading | undefined {
  let b: unknown;
  let a: unknown;
  try {
    b = parse(before);
    a = parse(after);
  } catch {
    return undefined;
  }
  if (!isObj(b) || !isObj(a) || same(b, a)) return undefined;
  if (file === "smithable.yml") return specChanges(b, a);
  if (file === "smithable.content.yml") {
    const operations: EditOperation[] = [];
    textChanges(b, a, [], operations);
    // The version line and the logo are no texts.
    return {
      operations: operations.filter(
        (o) => !/^(smithableContent|logo)$/.test(String((o.args.path as string[])[0])),
      ),
      other: operations.some((o) => (o.args.path as string[])[0] === "logo") ? ["the logo"] : [],
    };
  }
  return {
    operations: [],
    other: [...new Set([...Object.keys(b), ...Object.keys(a)])]
      .filter((key) => !same(b[key], a[key]) && !/^smithable[A-Z]/.test(key))
      .map((key) => `${key} in ${file}`),
  };
}
