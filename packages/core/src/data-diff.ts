// The data at an earlier time next to the data now (docs/design/pitr.md §3.4–3.5), as SQL over
// one connection with the current database as `main` and the earlier one attached as `past`.
// Records are matched by id and compared by their last change, so three indexed queries per
// table give what is new, changed and removed since then. The hosted service and the CLI's
// `restore --at` run the same statements; the table and column names are the adapter's.
import type { ModelIR, SpecIR } from "./ir.js";

export interface DiffTable {
  /** The model's table, e.g. "customers". */
  table: string;
  /** The column that names a record, e.g. "name". */
  title: string;
  /** The id and last-change columns (the generated apps' "id" and "updated_at"). */
  id?: string;
  updated?: string;
}

/** A SQL identifier, quoted. */
const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** The statements comparing one table now (`main`) with then (`past`). */
export function dataDiffSql({ table, title, id = "id", updated = "updated_at" }: DiffTable) {
  const t = q(table);
  const [i, u] = [q(id), q(updated)];
  const removedWhere = `FROM past.${t} o WHERE NOT EXISTS (SELECT 1 FROM main.${t} b WHERE b.${i} = o.${i})`;
  return {
    /** In the table now, not then. */
    added: `SELECT count(*) AS n FROM main.${t} b WHERE NOT EXISTS (SELECT 1 FROM past.${t} o WHERE o.${i} = b.${i})`,
    /** In both, changed since. */
    changed: `SELECT count(*) AS n FROM main.${t} b JOIN past.${t} o ON o.${i} = b.${i} WHERE b.${u} <> o.${u}`,
    /** Then, not now. */
    removed: `SELECT count(*) AS n ${removedWhere}`,
    /** The removed records' names, oldest first, at most `limit`. */
    removedNames: (limit = 20) =>
      `SELECT o.${q(title)} AS name ${removedWhere} ORDER BY o.${i} LIMIT ${Math.floor(limit)}`,
    /** The ids to bring back, and of the records changed since. */
    removedIds: `SELECT o.${i} AS id ${removedWhere}`,
    changedIds: `SELECT b.${i} AS id FROM main.${t} b JOIN past.${t} o ON o.${i} = b.${i} WHERE b.${u} <> o.${u}`,
  };
}

/**
 * The models in the order their records can be written back: each after the models its
 * references point to, so a record never arrives before the one it refers to.
 */
export function restoreOrder(ir: Pick<SpecIR, "models">): ModelIR[] {
  const byName = new Map(ir.models.map((m) => [m.name, m]));
  const order: ModelIR[] = [];
  const visit = (model: ModelIR, seen: Set<ModelIR>) => {
    if (order.includes(model) || seen.has(model)) return;
    seen.add(model);
    for (const f of model.fields)
      if (f.type.kind === "relation" && !f.type.many) {
        const target = byName.get(f.type.model);
        if (target) visit(target, seen);
      }
    order.push(model);
  };
  for (const model of ir.models) visit(model, new Set());
  return order;
}
