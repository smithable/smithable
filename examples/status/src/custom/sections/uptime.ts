// How long a service was down, day by day: the incidents' times (detected to resolved, or to now
// while open), overlaps counted once. Days are UTC days.
const DAY = 86_400_000;

export interface Outage {
  from: number;
  /** Still open when null. */
  to: number | null;
}

/** The last `days` days, oldest first, each with its minutes down, and the share of them up. */
export function uptime(outages: Outage[], now: number, days = 90) {
  const start = Math.floor(now / DAY) * DAY - (days - 1) * DAY;
  // Clipped to the period and merged, so two incidents at once count once.
  const spans = outages
    .map((o) => [Math.max(o.from, start), Math.min(o.to ?? now, now)] as const)
    .filter(([from, to]) => to > from)
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [from, to] of spans) {
    const last = merged.at(-1);
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }
  const minutes = Array.from({ length: days }, () => 0);
  let down = 0;
  for (const [from, to] of merged) {
    down += to - from;
    for (let t = from; t < to; ) {
      const day = Math.floor((t - start) / DAY);
      const end = Math.min(to, start + (day + 1) * DAY);
      minutes[day] = (minutes[day] ?? 0) + (end - t) / 60_000;
      t = end;
    }
  }
  return {
    days: minutes.map((m, i) => ({
      date: new Date(start + i * DAY).toISOString().slice(0, 10),
      // Up: a day with any time down shows it, even under a minute.
      minutes: Math.ceil(m),
    })),
    up: 1 - down / (now - start),
  };
}
