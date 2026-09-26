/** Returns the closest candidate within a small edit distance, for "did you mean" hints. */
export function closest(input: string, candidates: Iterable<string>): string | undefined {
  const needle = input.toLowerCase();
  let best: string | undefined;
  let bestDistance = Math.max(2, Math.floor(input.length / 3)) + 1;
  for (const candidate of candidates) {
    const distance = editDistance(needle, candidate.toLowerCase());
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

export function didYouMean(input: string, candidates: Iterable<string>): string | undefined {
  const match = closest(input, candidates);
  return match === undefined ? undefined : `Did you mean "${match}"?`;
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}
