// Opening hours as the spec writes them (docs/design/orders.md §3, appointments.md §2): a map
// of a weekday or a range of them to one span or a list, `{ mon-thu: "11:00-20:00",
// sat: ["10:00-14:00", "17:00-22:00"] }`, in the app's time zone. A day not named is closed.

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Minutes after midnight: [opens, closes), closes after opens on the same day. */
export type Span = [number, number];

/** Each open day's spans, in order. */
export type Hours = Partial<Record<Weekday, Span[]>>;

const SPAN = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-4]):([0-5]\d)$/;

/** The days a key names: one ("sat") or a range ("mon-fri", "fri-sun"); undefined if neither. */
export function daysOf(key: string): Weekday[] | undefined {
  const [from, to, ...rest] = key.split("-");
  const at = (d: string | undefined) => WEEKDAYS.indexOf(d as Weekday);
  if (rest.length || at(from) < 0 || (to !== undefined && at(to) < 0)) return undefined;
  const start = at(from);
  const end = to === undefined ? start : at(to);
  return end >= start ? WEEKDAYS.slice(start, end + 1) : undefined;
}

/** A span written "11:00-20:00", or a reason it is not one. */
export function readSpan(text: string): Span | string {
  const m = SPAN.exec(text.trim());
  if (!m) return `"${text}" is not a span of time: write it as "11:00-20:00".`;
  const opens = Number(m[1]) * 60 + Number(m[2]);
  const closes = Number(m[3]) * 60 + Number(m[4]);
  if (closes > 24 * 60) return `"${text}" ends after midnight.`;
  if (closes <= opens) return `"${text}" closes before it opens.`;
  return [opens, closes];
}

/**
 * Reads the hours from their keys and values (a span or a list of spans), each problem with
 * the key it is about. A day named twice, or spans of one day that overlap, are problems too.
 */
export function readHours(entries: [string, string | string[]][]): {
  hours: Hours;
  problems: { key: string; message: string }[];
} {
  const hours: Hours = {};
  const problems: { key: string; message: string }[] = [];
  for (const [key, value] of entries) {
    const days = daysOf(key);
    if (!days) {
      problems.push({
        key,
        message: `"${key}" is not a day: write mon, tue, wed, thu, fri, sat or sun, or a range like mon-fri.`,
      });
      continue;
    }
    const spans: Span[] = [];
    for (const text of [value].flat()) {
      const span = readSpan(text);
      if (typeof span === "string") problems.push({ key, message: span });
      else spans.push(span);
    }
    spans.sort((a, b) => a[0] - b[0]);
    if (spans.some((s, i) => i > 0 && s[0] < (spans[i - 1] as Span)[1]))
      problems.push({ key, message: `The spans of "${key}" overlap.` });
    for (const day of days) {
      if (hours[day]) problems.push({ key, message: `${day} is named twice in the hours.` });
      hours[day] = spans;
    }
  }
  return { hours, problems };
}

const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** The hours in words for the summary: "Mon–Thu 11:00–20:00, Fri–Sat 11:00–22:00". */
export function hoursText(hours: Hours): string {
  const said = (day: Weekday) =>
    (hours[day] ?? []).map(([a, b]) => `${clock(a)}–${clock(b)}`).join(", ");
  const name = (d: Weekday) => d.charAt(0).toUpperCase() + d.slice(1);
  const runs: string[] = [];
  let at = 0;
  while (at < WEEKDAYS.length) {
    const day = WEEKDAYS[at] as Weekday;
    const text = said(day);
    let end = at;
    while (end + 1 < WEEKDAYS.length && said(WEEKDAYS[end + 1] as Weekday) === text) end++;
    if (text)
      runs.push(`${name(day)}${end > at ? `–${name(WEEKDAYS[end] as Weekday)}` : ""} ${text}`);
    at = end + 1;
  }
  return runs.join(", ");
}
