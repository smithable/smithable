// Smithable app kit: the numbers a dashboard shows, worked out from records the viewer may read.

/** The sum of a number over records; empty values count as nothing. */
export function sum<R>(rows: R[], value: (row: R) => unknown): number {
  return rows.reduce((total, row) => total + (Number(value(row)) || 0), 0);
}

/** The average of a number over records that have one, or null when none do. */
export function average<R>(rows: R[], value: (row: R) => unknown): number | null {
  const numbers = rows.map(value).filter((v) => v !== null && v !== undefined) as number[];
  return numbers.length ? sum(numbers, Number) / numbers.length : null;
}

/**
 * One total per month, for the last `months` months up to the latest record's month, with
 * empty months as 0. Months are "2026-09", from a date or a date and time (in UTC).
 */
export function byMonth<R>(
  rows: R[],
  date: (row: R) => unknown,
  value: (row: R) => number,
  months = 6,
): { month: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const d = date(row);
    if (d === null || d === undefined) continue;
    const month = (d instanceof Date ? d.toISOString() : String(d)).slice(0, 7);
    totals.set(month, (totals.get(month) ?? 0) + value(row));
  }
  const last = [...totals.keys()].sort().at(-1);
  if (!last) return [];
  const [year, month] = last.split("-").map(Number) as [number, number];
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(year, month - months + i, 1));
    const key = d.toISOString().slice(0, 7);
    return { month: key, value: totals.get(key) ?? 0 };
  });
}

/** The newest records first: the highest ids. */
export function latest<R extends { id: number }>(rows: R[], limit: number): R[] {
  return [...rows].sort((a, b) => b.id - a.id).slice(0, limit);
}
