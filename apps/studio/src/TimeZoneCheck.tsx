// The guide's one question about time (A 220): the app's zone beside the browser's, asked once per
// project in this browser and remembered, since a zone written at `new` is only a guess.

/** The app's time zone as its spec says it. */
export function zoneOf(spec: string | undefined): string | undefined {
  const lines = (spec ?? "").split(/\r?\n/);
  const start = lines.findIndex((l) => /^app:\s*(#.*)?$/.test(l));
  if (start < 0) return undefined;
  let indent: number | undefined;
  for (const line of lines.slice(start + 1)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const own = line.length - line.trimStart().length;
    if (own === 0) return undefined;
    indent ??= own;
    const zone = /^\s*timezone:\s*["']?([\w/+-]+)/.exec(line)?.[1];
    if (own === indent && zone) return zone;
  }
  return undefined;
}
