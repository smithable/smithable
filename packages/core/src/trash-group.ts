import type { SpecIR } from "./ir.js";

/**
 * A model whose records go to the trash with a root record's (docs/design/delete-together.md):
 * it points to `from` with the required reference `via`, `depth` references away from the root.
 */
export interface GroupEdge {
  model: string;
  via: string;
  from: string;
  depth: number;
}

/** A model whose records point to `model` with a required reference: its name and the field. */
export interface Referrer {
  model: string;
  via: string;
}

/**
 * The models whose records cannot exist without a record of `model`: those that point to it with
 * a required reference (not a list), those that point to them, and so on, each edge once, by
 * depth. A cycle of required references ends where an edge comes round again.
 */
export function trashGroup(ir: SpecIR, model: string): GroupEdge[] {
  const edges: GroupEdge[] = [];
  const seen = new Set<string>();
  let level = [model];
  for (let depth = 1; level.length; depth++) {
    const next: string[] = [];
    for (const from of level)
      for (const { model: m, via } of referrers(ir, from, true)) {
        if (seen.has(`${m}.${via}`)) continue;
        seen.add(`${m}.${via}`);
        edges.push({ model: m, via, from, depth });
        next.push(m);
      }
    level = next;
  }
  return edges;
}

/** The models that point to `model` with an optional reference: they stay, and show no record. */
export function looseReferrers(ir: SpecIR, model: string): Referrer[] {
  return referrers(ir, model, false);
}

function referrers(ir: SpecIR, model: string, required: boolean): Referrer[] {
  return ir.models.flatMap((m) =>
    m.fields
      .filter(
        (f) =>
          f.type.kind === "relation" &&
          !f.type.many &&
          f.type.model === model &&
          f.required === required,
      )
      .map((f) => ({ model: m.name, via: f.name })),
  );
}
