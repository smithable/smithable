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

const clocks = new Map<string, boolean>();
/**
 * Whether two zones keep the same time all this year and next (Europe/Mariehamn and
 * Europe/Helsinki): two names for one clock are not a question worth asking.
 */
export function sameClock(a: string, b: string, from = new Date()): boolean {
  if (a === b) return true;
  const key = `${a}|${b}|${from.getUTCFullYear()}`;
  const known = clocks.get(key);
  if (known !== undefined) return known;
  let same = false;
  try {
    const clock = (zone: string) => {
      const format = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "longOffset" });
      return (at: number) => format.formatToParts(at).find((p) => p.type === "timeZoneName")?.value;
    };
    const [x, y] = [clock(a), clock(b)];
    const start = Date.UTC(from.getUTCFullYear(), 0, 1);
    const half = 432e5;
    same = x(start) === y(start);
    // Twice a day for two years; where either zone's offset moved between two samples, every
    // quarter hour between them, since two zones may change on the same day hours apart.
    for (let at = start + half; same && at < start + 730 * 864e5; at += half) {
      const moved = x(at) !== x(at - half) || y(at) !== y(at - half);
      for (let t = moved ? at - half + 9e5 : at; same && t <= at; t += 9e5) same = x(t) === y(t);
    }
  } catch {
    // A name the browser does not know is not the same clock as one it does.
  }
  clocks.set(key, same);
  return same;
}
