// Bounded deterministic coverage selection for browser fixtures.
export type MatrixCase = Record<string, string>;
export function pairwise(
  dimensions: Record<string, readonly string[]>,
  mandatory: MatrixCase[] = [],
): MatrixCase[] {
  const keys = Object.keys(dimensions);
  const size = keys.reduce((size, key) => size * (dimensions[key]?.length ?? 0), 1);
  if (size > 65536 || !size)
    throw new Error("Pairwise candidate space must contain 1–65536 cases.");
  const pairs = (row: MatrixCase) =>
    keys.flatMap((key, index) =>
      keys.slice(index + 1).map((other) => JSON.stringify([key, row[key], other, row[other]])),
    );
  let candidates: MatrixCase[] = [{}];
  for (const key of keys)
    candidates = candidates.flatMap((row) =>
      (dimensions[key] ?? []).map((value) => ({ ...row, [key]: value })),
    );
  // Each pair gets a number once, and each candidate its pairs' numbers: scoring strings anew
  // each round was nearly all of the time.
  const ids = new Map<string, number>();
  const idsOf = (row: MatrixCase) =>
    Int32Array.from(pairs(row), (pair) => {
      const known = ids.get(pair);
      if (known !== undefined) return known;
      ids.set(pair, ids.size);
      return ids.size - 1;
    });
  let scored = candidates.map((row) => ({ row, ids: idsOf(row) }));
  const uncovered = new Uint8Array(ids.size).fill(1);
  let left = ids.size;
  const cover = (row: Int32Array) => {
    for (const id of row)
      if (uncovered[id]) {
        uncovered[id] = 0;
        left--;
      }
  };
  const selected: MatrixCase[] = [];
  for (const row of mandatory) {
    if (
      keys.some((key) => !dimensions[key]?.includes(row[key] ?? "")) ||
      Object.keys(row).length !== keys.length
    )
      throw new Error("Mandatory case is outside the matrix.");
    selected.push({ ...row });
    cover(idsOf(row));
  }
  while (left) {
    let best: (typeof scored)[number] | undefined,
      bestScore = 0;
    for (const candidate of scored) {
      let score = 0;
      for (const id of candidate.ids) score += uncovered[id] ?? 0;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (!best) throw new Error("Uncovered pair has no candidate.");
    selected.push(best.row);
    cover(best.ids);
    scored = scored.filter((candidate) => candidate !== best);
  }
  return selected;
}
export const VISUAL_DIMENSIONS = {
  viewport: ["320", "390", "1440"],
  appearance: ["light", "dark"],
  type: ["regular", "condensed-upper"],
  surface: ["bordered", "glass"],
  media: ["portrait-edge", "slow", "missing"],
  composition: ["editorial", "queue", "record-inline-summary"],
  motion: ["normal", "reduced"],
  copy: ["short", "swedish-long"],
  zoom: ["100", "200"],
};
