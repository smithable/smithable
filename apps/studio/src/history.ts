// The history in Smith's words and Changes' (docs/design/ask-flows.md §8, A 234): the lines the
// Changes window shows, with their numbers, and the requests about them Smith reads by rule, no
// model: what have I changed, undo, what did #12 do, milestones. Nothing new is stored: the
// lines are the trace's entries, a request's several changes as one.
import type { TraceEntry } from "./api";

export type Words = (op: string, args: Record<string, unknown>) => string | undefined;

/** Consecutive changes made for one request to a model, which the list shows as one line. */
export function grouped(entries: TraceEntry[]): TraceEntry[][] {
  const groups: TraceEntry[][] = [];
  for (const e of entries) {
    const last = groups.at(-1);
    if (e.request && last?.[0]?.request === e.request && !e.isUndo && !last[0].isUndo) last.push(e);
    else groups.push([e]);
  }
  return groups;
}

/** One change in the Builder's words where it has them, else its own. */
export function entryText(e: TraceEntry, words?: Words): string {
  const plain = e.operation && words?.(e.operation.op, e.operation.args);
  return plain ? (e.isUndo ? `Undid: ${plain}` : plain) : e.description;
}

/** A request's changes in one line from what they did, oldest first (A 232). */
export function summary(group: TraceEntry[], words?: Words): string {
  const parts = [...group].reverse().map((e) => entryText(e, words));
  return parts.length <= 3
    ? parts.join("; ")
    : `${parts.slice(0, 2).join("; ")}; and ${parts.length - 2} more`;
}

/** A line's numbers: "#12", "#12 to #14", or listed when another change came between. */
export function numbers(group: TraceEntry[]): string {
  const ns = group.flatMap((e) => (e.number ? [e.number] : [])).sort((a, b) => a - b);
  const [first, ...rest] = ns;
  if (first === undefined) return "";
  const last = rest.at(-1);
  if (last === undefined) return `#${first}`;
  return last - first === ns.length - 1
    ? `#${first} to #${last}`
    : ns.map((n) => `#${n}`).join(", ");
}

/** A line as Smith and Changes say it: its numbers, what it did, and who undid it. */
export function line(group: TraceEntry[], words?: Words): string {
  const label = numbers(group);
  const text = group.length > 1 ? summary(group, words) : entryText(group[0] as TraceEntry, words);
  const by = [...new Set(group.flatMap((e) => (e.undoneBy ? [`#${e.undoneBy}`] : [])))];
  const undone = group.filter((e) => e.undone);
  const after =
    undone.length === 0
      ? ""
      : undone.length === group.length
        ? by.length
          ? `, undone by ${by.join(", ")}`
          : ", undone"
        : `; undone: ${undone.map((e) => (e.number ? `#${e.number}` : entryText(e, words))).join(", ")}`;
  return `${label ? `${label} ` : ""}${text}${after}`;
}

/** The newest change in place that is not an undo: the one whose undo puts the records back. */
const newestInPlace = (entries: TraceEntry[]) => entries.find((e) => !e.isUndo && !e.undone);

/** What undoing it puts back, in the Changes window's words (A 232). */
export function restores(e: TraceEntry, entries: TraceEntry[]): string {
  return e.snapshot && e.id === newestInPlace(entries)?.id
    ? "Undoing it puts back the app's files, and the records as they were before it."
    : "Undoing it puts back the app's files; the records stay as they are now.";
}

export type Scope =
  | { all: true }
  | { today: true }
  | { since: number }
  | { milestone: string; quoted?: boolean };

/** What a request about the history asks, or undefined: then it is not one (§8 Reading). */
export type HistoryRequest =
  | { kind: "list"; scope: Scope }
  | { kind: "undo"; last: true }
  | { kind: "undo"; from: number; to: number }
  | { kind: "undo"; words: string }
  | { kind: "redo" }
  | { kind: "what"; number: number }
  | { kind: "name"; number?: number; name: string }
  | { kind: "rename"; from: string; to: string }
  | { kind: "unname"; name: string };

const NUMBER = String.raw`(?:#|change\s+)?(\d+)`;

/** Undo and redo in a word or two, in English, Swedish and Finnish (T731). */
const UNDO_WORDS = [
  "undo",
  "revert",
  "undo please",
  "ångra",
  "ångra det",
  "ångra det där",
  "ångra senaste",
  "ångra senaste ändringen",
  "kumoa",
  "kumoa se",
  "kumoa viimeisin",
  "kumoa viimeisin muutos",
];
const REDO_WORDS = ["redo", "gör om", "gör om det", "tee uudelleen"];

/** One letter more, less or different: a slip, counted only for words of five letters or more. */
function slip(a: string, b: string): boolean {
  if (b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  const rest = (x: string, n: number) => x.slice(i + n);
  return rest(a, 1) === rest(b, 1) || rest(a, 1) === rest(b, 0) || rest(a, 0) === rest(b, 1);
}
const said = (text: string, words: string[]) =>
  words.some((w) => text === w || (!w.includes(" ") && slip(text, w)));
const unquote = (text: string) => {
  const t = text.trim().replace(/[.!?]+$/, "");
  const quoted = /^["'“‘](.*)["'”’]$/.exec(t);
  return { text: (quoted?.[1] ?? t).trim(), quoted: Boolean(quoted) };
};

/** Reads a request about the history, by rule. Free text only after "undo the change that" and a name. */
export function readHistory(request: string): HistoryRequest | undefined {
  const text = request.trim().replace(/\s+/g, " ");
  const lower = text.toLowerCase().replace(/[.!?]+$/, "");
  let m: RegExpExecArray | null;
  // What have I changed, and its scopes.
  m =
    /^(?:what (?:have i|did i|i have) (?:changed|done|made)|what did i do|show (?:me )?(?:all )?my changes|my changes|what changes have i made)(?:\s+(.*))?$/.exec(
      lower,
    );
  if (m) {
    const rest = (m[1] ?? "").trim();
    const plain = text.replace(/[.!?]+$/, "");
    const raw = plain.slice(plain.length - rest.length);
    if (!rest || /^(?:so far|in all|all|everything|ever)$/.test(rest))
      return { kind: "list", scope: { all: true } };
    if (/^today$/.test(rest)) return { kind: "list", scope: { today: true } };
    const since = new RegExp(`^(?:since|after) ${NUMBER}$`).exec(rest);
    if (since) return { kind: "list", scope: { since: Number(since[1]) } };
    const named = /^(?:since|after) (.+)$/i.exec(raw);
    if (named) {
      const { text: name, quoted } = unquote(named[1] ?? "");
      return { kind: "list", scope: { milestone: name, ...(quoted ? { quoted } : {}) } };
    }
    return undefined;
  }
  if (/^(?:show )?(?:all my changes|everything i changed)$/.test(lower))
    return { kind: "list", scope: { all: true } };
  // What did #12 do.
  m = new RegExp(`^what did ${NUMBER} do$`).exec(lower);
  if (m) return { kind: "what", number: Number(m[1]) };
  // Undo and redo in a word or two (T731).
  if (said(lower, UNDO_WORDS)) return { kind: "undo", last: true };
  if (said(lower, REDO_WORDS)) return { kind: "redo" };
  // Undo.
  if (/^(?:undo|take back) (?:the last change|that|it|the last one)$|^take that back$/.test(lower))
    return { kind: "undo", last: true };
  m = new RegExp(`^undo ${NUMBER}(?:\\s*(?:to|-|\\.\\.)\\s*${NUMBER})?$`).exec(lower);
  if (m) {
    const from = Number(m[1]);
    const to = Number(m[2] ?? m[1]);
    return { kind: "undo", from: Math.min(from, to), to: Math.max(from, to) };
  }
  m = /^undo (?:the change that )?(.+)$/i.exec(text);
  if (m) return { kind: "undo", words: unquote(m[1] ?? "").text };
  // Milestones.
  m = /^rename the milestone (.+?) to (.+)$/i.exec(text);
  if (m) return { kind: "rename", from: unquote(m[1] ?? "").text, to: unquote(m[2] ?? "").text };
  m = /^remove the milestone (.+)$/i.exec(text);
  if (m) return { kind: "unname", name: unquote(m[1] ?? "").text };
  m = new RegExp(`^name ${NUMBER} (?:a |as a )?milestone (.+)$`, "i").exec(text);
  if (m) return { kind: "name", number: Number(m[1]), name: unquote(m[2] ?? "").text };
  m = /^(?:name this (?:a |as a )?milestone|call (?:it|this|the last change)) (.+)$/i.exec(text);
  if (m) return { kind: "name", name: unquote(m[1] ?? "").text };
  return undefined;
}

/**
 * A request about the history before another ("undo that and add a notes field"): the history
 * part and the rest, split at the clause boundary, or undefined when it is not so made. The free
 * text of "undo the change that …" and of a milestone's name runs to the end, so is never split.
 */
export function splitHistory(request: string): { first: HistoryRequest; rest: string } | undefined {
  const m = /^(.+?)(?:,\s*|\s+)(?:and then|then|and)\s+(.+)$/i.exec(request.trim());
  if (!m) return undefined;
  const first = readHistory(m[1] ?? "");
  // A milestone's name and an undo's words are free text to the end: never split.
  if (
    !first ||
    (first.kind === "undo" && "words" in first) ||
    ["name", "rename", "unname"].includes(first.kind) ||
    (first.kind === "list" && "milestone" in first.scope)
  )
    return;
  return { first, rest: (m[2] ?? "").trim() };
}

/** §4's tolerance: the same word with at most one letter wrong in five. */
function near(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 5) return false;
  const d: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0] as number;
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const was = d[j] as number;
      d[j] = Math.min(was + 1, (d[j - 1] as number) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = was;
    }
  }
  return (d[b.length] as number) <= Math.floor(Math.max(a.length, b.length) / 5);
}

/** The milestone a name means, by §4's tolerance, among the history's names. */
export function milestoneNamed(entries: TraceEntry[], name: string): TraceEntry | undefined {
  const want = name.toLowerCase();
  const named = entries.filter((e) => e.milestone && !e.undone);
  return (
    named.find((e) => e.milestone?.toLowerCase() === want) ??
    named.find((e) => near(e.milestone?.toLowerCase() ?? "", want))
  );
}

/** The listing's lines for a scope, newest first, at most five, and whether more were left. */
export function listing(
  entries: TraceEntry[],
  scope: Scope,
  words?: Words,
  now = new Date(),
): { lines: { text: string; group: TraceEntry[] }[]; more: boolean } | { unknown: string } {
  let shown = entries;
  if ("today" in scope) {
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    shown = entries.filter((e) => new Date(e.at) >= midnight);
  } else if ("since" in scope) {
    const at = entries.findIndex((e) => e.number === scope.since);
    if (at < 0) return { unknown: `#${scope.since}` };
    shown = entries.slice(0, at);
  } else if ("milestone" in scope) {
    const named = milestoneNamed(entries, scope.milestone);
    if (!named) return { unknown: scope.milestone };
    shown = entries.slice(0, entries.indexOf(named));
  }
  const groups = grouped(shown);
  return {
    lines: groups.slice(0, 5).map((group) => ({ text: lineWithMilestone(group, words), group })),
    more: groups.length > 5,
  };
}

/** A line with its milestone as Changes shows it ("Before the shop, #12"). */
export function lineWithMilestone(group: TraceEntry[], words?: Words): string {
  const tagged = group.find((g) => g.milestone && !g.undone);
  return `${line(group, words)}${tagged ? ` (milestone: ${tagged.milestone}${tagged.number ? `, #${tagged.number}` : ""})` : ""}`;
}

/** The newest line still in place that is not an undo: "undo the last change". */
export function lastLine(entries: TraceEntry[]): TraceEntry[] | undefined {
  return grouped(entries).find((g) => !g[0]?.isUndo && g.some((e) => !e.undone));
}

const STOP = new Set(
  "a an the to of in on for and or my i me it its that this change changes added add adding new".split(
    " ",
  ),
);
const tokens = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9åäöéü]+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => w.replace(/(?:ing|ed|es|s)$/, ""));

/**
 * The line "undo the change that <words>" means (§8): scored against the lines and their
 * milestone names as §3 scores a question, a margin over the second best and a floor.
 */
export function lineByWords(
  entries: TraceEntry[],
  said: string,
  words?: Words,
): { group: TraceEntry[] } | { two: [TraceEntry[], TraceEntry[]] } | undefined {
  const want = tokens(said);
  if (want.length === 0) return undefined;
  const scored = grouped(entries)
    .filter((g) => !g[0]?.isUndo)
    .map((group) => {
      const have = tokens(
        `${summary(group, words)} ${group.map((e) => e.milestone ?? "").join(" ")}`,
      );
      const hits = want.filter((w) => have.some((h) => near(h, w))).length;
      return { group, score: hits / want.length };
    })
    .sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (!best || best.score < 0.5) return undefined;
  if (second && best.score - second.score < 0.25) return { two: [best.group, second.group] };
  return { group: best.group };
}
