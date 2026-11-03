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
  const uncovered = new Set(candidates.flatMap(pairs));
  const selected: MatrixCase[] = [];
  for (const row of mandatory) {
    if (
      keys.some((key) => !dimensions[key]?.includes(row[key] ?? "")) ||
      Object.keys(row).length !== keys.length
    )
      throw new Error("Mandatory case is outside the matrix.");
    selected.push({ ...row });
    for (const pair of pairs(row)) uncovered.delete(pair);
  }
  while (uncovered.size) {
    let best: MatrixCase | undefined,
      bestScore = 0;
    for (const row of candidates) {
      const score = pairs(row).reduce((score, pair) => score + Number(uncovered.has(pair)), 0);
      if (score > bestScore) {
        bestScore = score;
        best = row;
      }
    }
    if (!best) throw new Error("Uncovered pair has no candidate.");
    selected.push(best);
    for (const pair of pairs(best)) uncovered.delete(pair);
    candidates = candidates.filter((row) => row !== best);
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
