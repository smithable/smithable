// A whole-file edit that only renames a key (docs/design/studio-v3.md §5, Fable 46 (e)): typing
// a new name for a kind of record, a page or a field in Code's editor. As an editSpec that would
// drop the table or column and make it anew, losing the records; as the rename operation it
// keeps them and follows every reference. So an edit whose sole difference is one renamed key
// under models, pages or a model's fields is applied as renameModel, renamePage or renameField.
import { parse } from "yaml";

export type EditRename =
  | { op: "renameModel" | "renamePage"; args: { from: string; to: string } }
  | { op: "renameField"; args: { model: string; from: string; to: string } };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The one key renamed between two mappings with the same values otherwise, or undefined: the
 * key sets differ by one name each way, that entry's value is the same, and so is everything
 * else, in the same order.
 */
export function renamedKey(before: Obj, after: Obj): { from: string; to: string } | undefined {
  const b = Object.keys(before);
  const a = Object.keys(after);
  if (b.length !== a.length) return undefined;
  const gone = b.filter((k) => !(k in after));
  const came = a.filter((k) => !(k in before));
  if (gone.length !== 1 || came.length !== 1) return undefined;
  const [from] = gone as [string];
  const [to] = came as [string];
  if (b.indexOf(from) !== a.indexOf(to)) return undefined;
  if (!same(before[from], after[to])) return undefined;
  for (const k of b) if (k !== from && !same(before[k], after[k])) return undefined;
  return { from, to };
}

/** Whether every key but `except` is the same in both mappings, with the same keys in order. */
function sameBut(before: Obj, after: Obj, except: string): boolean {
  const b = Object.keys(before);
  const a = Object.keys(after);
  return (
    b.length === a.length &&
    b.every((k, i) => k === a[i]) &&
    b.every((k) => k === except || same(before[k], after[k]))
  );
}

/** The rename operation an edit of smithable.yml's text is, when it is one and nothing else. */
export function editAsRename(before: string, after: string): EditRename | undefined {
  let b: unknown;
  let a: unknown;
  try {
    b = parse(before);
    a = parse(after);
  } catch {
    return undefined;
  }
  if (!isObj(b) || !isObj(a) || same(b, a)) return undefined;
  for (const section of ["models", "pages"] as const) {
    if (!sameBut(b, a, section) || !isObj(b[section]) || !isObj(a[section])) continue;
    const renamed = renamedKey(b[section] as Obj, a[section] as Obj);
    if (renamed) return { op: section === "models" ? "renameModel" : "renamePage", args: renamed };
    if (section !== "models") continue;
    // One model's one field renamed, the model otherwise the same.
    const models = b[section] as Obj;
    const next = a[section] as Obj;
    const differing = Object.keys(models).filter((m) => !same(models[m], next[m]));
    if (differing.length !== 1 || !sameBut(models, next, differing[0] as string)) continue;
    const model = differing[0] as string;
    const was = models[model];
    const is = next[model];
    if (!isObj(was) || !isObj(is) || !sameBut(was, is, "fields")) continue;
    if (!isObj(was.fields) || !isObj(is.fields)) continue;
    const field = renamedKey(was.fields as Obj, is.fields as Obj);
    if (field) return { op: "renameField", args: { model, ...field } };
  }
  return undefined;
}
