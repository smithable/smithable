// Smithable app kit: reading a question without a model (docs/design/assistant.md §5). The
// common shapes ("how many orders are still drafts", "orders per status", "which customers are
// in the government segment", "what is the total of all placed orders") become the same tool
// call a model would have made, for nothing and at once. Every word of the question must be
// accounted for: a question the rules do not fully read is left to the model, never guessed at.
// Pure: the app's words (its kinds of record, their fields and values) come in as `kinds`.

import { w } from "./words";

export type AskFilter =
  | { field: string; by: "value"; values: string[]; labels?: Record<string, string> }
  | { field: string; by: "yesNo" | "number" | "date" | "text" }
  | { field: string; by: "reference"; model: string };

/** One kind of record, in the words people use for it. */
export interface AskKind {
  model: string;
  label: string;
  pluralLabel: string;
  fields: { name: string; label: string }[];
  filters: AskFilter[];
  /** Stored number fields. */
  numbers: string[];
  /** Fields a number can be split by. */
  by: string[];
  /** The list page, where a record is at path/id; none when the kind has no page. */
  path?: string;
}

export type Range = { from?: string | number; to?: string | number; over?: number; under?: number };
export type Where = Record<string, string | boolean | string[] | Range>;

export type ToolCall =
  | { tool: "measure"; kind: string; of?: string; where?: Where; by?: string }
  | {
      tool: "find";
      kind: string;
      where?: Where;
      search?: string;
      fields?: string[];
      sort?: string;
      limit?: number;
    };

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
/** Words that carry no condition. */
const FILLER = new Set(
  "the a an all our my of do does did we have has are is was were there that which who still currently now right in at for with me us any it".split(
    " ",
  ),
);
/** Words for "the records of the app's only kind". */
const ANY_KIND = new Set(["thing", "item", "record", "everything", "anything", "one"]);

const singular = (w: string) =>
  w.length > 3 && w.endsWith("ies")
    ? `${w.slice(0, -3)}y`
    : w.length > 4 && /(s|x|ch|sh)es$/.test(w)
      ? w.slice(0, -2)
      : w.length > 3 && w.endsWith("s") && !w.endsWith("ss")
        ? w.slice(0, -1)
        : w;

/** A text as comparable words: lowercase, no punctuation, singular, "5 000" as one number. */
function words(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/[’`]/g, "'")
      .replace(/\b(what|who|where|when|how|that|there|it)'s\b/g, "$1 is")
      .replace(/(\d)[  ](?=\d{3}\b)/g, "$1")
      .replace(/[€$£]|\beuros?\b|\beur\b/g, " ")
      .replace(/[^a-z0-9'.\-åäöéü ]+/g, " ")
      .replace(/\.(?!\d)/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      // A possessive keeps its mark ("timber's"): it is how a name is told from the field asked for.
      .map((w) => (w.includes("'") ? w : singular(w)))
  );
}

/** camelCase or a label as comparable words. */
const phrase = (text: string) => words(text.replace(/([a-z0-9])([A-Z])/g, "$1 $2"));

/** Where `part` occurs in `all` as a run of words, or -1. */
function at(all: string[], part: string[]): number {
  if (part.length === 0) return -1;
  for (let i = 0; i + part.length <= all.length; i++)
    if (part.every((w, j) => all[i + j] === w)) return i;
  return -1;
}

/** Takes `part` out of `all` when it is there. */
function take(all: string[], part: string[]): boolean {
  const i = at(all, part);
  if (i < 0) return false;
  all.splice(i, part.length);
  return true;
}

interface Read {
  kind: AskKind;
  where: Where;
  by?: string;
  /** Words nothing accounted for. */
  left: string[];
}

/** The kind a phrase is about, its conditions, and whatever words are left over. */
function readRecords(tokens: string[], kinds: AskKind[]): Read | undefined {
  const left = [...tokens];
  // The kind: its plural or singular label, the longest that occurs; an app with one kind needs none.
  const named = kinds
    .flatMap((k) =>
      [phrase(k.pluralLabel), phrase(k.label), phrase(k.model)].map((p) => ({ k, p })),
    )
    .filter(({ p }) => at(left, p) >= 0)
    .sort((a, b) => b.p.length - a.p.length)[0];
  if (named) take(left, named.p);
  const kind = named?.k ?? (kinds.length === 1 ? kinds[0] : undefined);
  if (!kind) return undefined;
  if (!named) {
    const i = left.findIndex((w) => ANY_KIND.has(w));
    if (i >= 0) left.splice(i, 1);
  }
  const where: Where = {};
  const fieldWords = (name: string) => {
    const f = kind.fields.find((x) => x.name === name);
    return [phrase(f?.label ?? name), phrase(name)];
  };

  // "per status", "of each kind": what a number is split by.
  let by: string | undefined;
  for (const lead of [["per"], ["by"], ["of", "each"], ["for", "each"], ["in", "each"]]) {
    const i = at(left, lead);
    if (i < 0) continue;
    const rest = left.slice(i + lead.length);
    const field = kind.by.find((name) => fieldWords(name).some((p) => at(rest, p) === 0));
    if (!field) continue;
    const used = fieldWords(field).find((p) => at(rest, p) === 0) as string[];
    left.splice(i, lead.length + used.length);
    by = field;
    break;
  }

  // "in september 2026": the month of the kind's one date.
  const m = left.findIndex((w, i) => MONTHS.includes(w) && /^\d{4}$/.test(left[i + 1] ?? ""));
  if (m >= 0) {
    const dates = kind.filters.filter((f) => f.by === "date");
    if (dates.length !== 1) return undefined;
    const year = Number(left[m + 1]);
    const month = MONTHS.indexOf(left[m] as string);
    const pad = (n: number) => String(n).padStart(2, "0");
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    where[(dates[0] as AskFilter).field] = {
      from: `${year}-${pad(month + 1)}-01`,
      to: `${year}-${pad(month + 1)}-${pad(last)}`,
    };
    left.splice(m, 2);
    const lead = left[m - 1];
    if (lead === "during" || lead === "from") left.splice(m - 1, 1);
    // "placed in september" is about when (placedAt), not about the status "placed": the
    // date's own words are its, before any value is looked for.
    for (const p of fieldWords((dates[0] as AskFilter).field))
      for (const w of p) if (!FILLER.has(w) && w !== "on" && w !== "date") take(left, [w]);
  }

  // "over 5000", "under 100": the kind's one number.
  const bounds: [string[], "over" | "under"][] = [
    [["more", "than"], "over"],
    [["less", "than"], "under"],
    [["over"], "over"],
    [["above"], "over"],
    [["under"], "under"],
    [["below"], "under"],
  ];
  for (const [lead, side] of bounds) {
    const i = at(left, lead);
    const amount = i >= 0 ? left[i + lead.length] : undefined;
    if (amount === undefined || !/^\d+(\.\d+)?$/.test(amount)) continue;
    if (kind.numbers.length !== 1) return undefined;
    where[kind.numbers[0] as string] = { [side]: Number(amount) };
    left.splice(i, lead.length + 1);
    break;
  }

  // A choice's value by its name or label ("drafts", "like new"), a yes/no field by its label.
  for (;;) {
    const hits: { f: AskFilter; p: string[]; value: string | boolean }[] = [];
    for (const f of kind.filters) {
      if (f.by === "yesNo")
        for (const p of fieldWords(f.field)) if (at(left, p) >= 0) hits.push({ f, p, value: true });
      if (f.by !== "value") continue;
      for (const v of f.values)
        for (const p of [phrase(v), phrase(f.labels?.[v] ?? v)])
          if (at(left, p) >= 0) hits.push({ f, p, value: v });
    }
    const longest = Math.max(0, ...hits.map((h) => h.p.length));
    const best = hits.filter((h) => h.p.length === longest);
    if (best.length === 0) break;
    // The same words in two fields: only the field's own name beside them can settle it.
    const fields = [...new Set(best.map((h) => h.f.field))];
    const chosen =
      fields.length === 1
        ? best[0]
        : best.find((h) => fieldWords(h.f.field).some((p) => at(left, p) >= 0));
    if (!chosen) return undefined;
    take(left, chosen.p);
    for (const p of fieldWords(chosen.f.field)) if (take(left, p)) break;
    const had = where[chosen.f.field];
    where[chosen.f.field] =
      typeof chosen.value === "string" && typeof had === "string" && had !== chosen.value
        ? [had, chosen.value]
        : chosen.value;
  }

  return { kind, where, ...(by ? { by } : {}), left: left.filter((w) => !FILLER.has(w)) };
}

const filled = (where: Where) => (Object.keys(where).length ? { where } : {});

/** The number field a sum or an average is of: the one named in what is left, or the only one. */
function numberOf(read: Read): string | undefined {
  const named = read.kind.numbers.find((name) => {
    const f = read.kind.fields.find((x) => x.name === name);
    return [phrase(f?.label ?? name), phrase(name)].some((p) => take(read.left, p));
  });
  return named ?? (read.kind.numbers.length === 1 ? read.kind.numbers[0] : undefined);
}

/**
 * The tool call a question means, or nothing when the rules do not read all of it.
 * `kinds` are the kinds of record the person asking may read.
 */
export function readQuestion(question: string, kinds: AskKind[]): ToolCall | undefined {
  const all = words(question);
  if (all.length === 0 || kinds.length === 0) return undefined;
  // What turns a question into another one is never skipped over.
  if (all.some((w) => ["not", "no", "never", "without", "except", "and", "or", "but"].includes(w)))
    return undefined;
  const text = all.join(" ");
  const rest = (lead: RegExp) => {
    const found = lead.exec(text);
    return found ? text.slice(found[0].length).split(" ").filter(Boolean) : undefined;
  };
  const done = (read: Read | undefined) => (read && read.left.length === 0 ? read : undefined);

  // "What is Nordic Timber's credit limit?": one field of the record a name finds.
  const whose = /^what is (.+?)'s? (.+)$/.exec(text);
  if (whose && /'s?$/.test(text.slice(0, text.length - (whose[2] as string).length).trim())) {
    // "phone number" and "email address" are the fields people call phone and email.
    const asked = [whose[2] as string, (whose[2] as string).replace(/ (number|address)$/, "")];
    const owners = kinds.flatMap((k) =>
      k.fields
        .filter((f) => [phrase(f.label), phrase(f.name)].some((p) => asked.includes(p.join(" "))))
        .map((f) => ({ k, f })),
    );
    if (owners.length === 1) {
      const { k, f } = owners[0] as (typeof owners)[number];
      return {
        tool: "find",
        kind: k.model,
        search: whose[1] as string,
        fields: [f.name],
        limit: 3,
      };
    }
    return undefined;
  }

  const count = rest(/^how many /);
  if (count) {
    const read = done(readRecords(count, kinds));
    return read
      ? {
          tool: "measure",
          kind: read.kind.model,
          ...filled(read.where),
          ...(read.by ? { by: read.by } : {}),
        }
      : undefined;
  }

  for (const [lead, of] of [
    [/^what is the (?:total|sum) (?:of )?/, "sum"],
    [/^what is the average /, "average"],
  ] as const) {
    const words = rest(lead);
    if (!words) continue;
    const read = readRecords(words, kinds);
    const field = read && numberOf(read);
    return read && field && read.left.length === 0 && !read.by
      ? { tool: "measure", kind: read.kind.model, of: `${of} ${field}`, ...filled(read.where) }
      : undefined;
  }

  const most =
    /^(?:what is|which is|show me|show) (?:the|our) (largest|biggest|highest|most expensive|smallest|lowest|cheapest) /.exec(
      text,
    );
  if (most) {
    const read = done(readRecords(text.slice(most[0].length).split(" "), kinds));
    const field = read?.kind.numbers.length === 1 && !read.by ? read.kind.numbers[0] : undefined;
    if (!read || !field) return undefined;
    const down = ["largest", "biggest", "highest", "most expensive"].includes(most[1] as string);
    return {
      tool: "find",
      kind: read.kind.model,
      ...filled(read.where),
      sort: `${down ? "-" : ""}${field}`,
      limit: 1,
    };
  }

  const list = rest(/^(?:which|show me|show|list|what) /);
  if (list) {
    const read = done(readRecords(list, kinds));
    if (!read || read.by) return undefined;
    return { tool: "find", kind: read.kind.model, ...filled(read.where), limit: 50 };
  }

  // "Orders per status": a number for each value, with nothing else said.
  const per = done(readRecords(all, kinds));
  if (per?.by) return { tool: "measure", kind: per.kind.model, ...filled(per.where), by: per.by };
  return undefined;
}

/** An earlier turn of a conversation with Ask, as the page keeps it (A 152). */
export interface Turn {
  question: string;
  /** What came of it, in short: the words shown, or the calls made. */
  answer: string;
}

/** How many earlier turns go with a question, and how long each may be. */
const TURNS = 6;
const TURN_MAX = 500;

/** The earlier turns a page sent, checked by hand: the last few, each cut short. */
export function turnsOf(value: unknown): Turn[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-TURNS)
    .flatMap((t: { question?: unknown; answer?: unknown } | null) =>
      typeof t?.question === "string" && typeof t.answer === "string"
        ? [{ question: t.question.slice(0, TURN_MAX), answer: t.answer.slice(0, TURN_MAX) }]
        : [],
    );
}

/**
 * Small talk answered by rule (A 152): a greeting, thanks, "what can you do", in the app's
 * language, with no model; nothing for anything else.
 */
export function smallTalk(question: string): string | undefined {
  const said = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const replies: [RegExp, string][] = [
    [w.chatGreeting, w.chatHello],
    [w.chatThanks, w.chatWelcome],
    [w.chatHow, w.chatWell],
    [w.chatWho, w.chatAbout],
    [w.chatBye, w.chatGoodbye],
    [w.chatOk, w.chatNext],
  ];
  return replies.find(([words]) => words.test(said))?.[1];
}

/**
 * Questions to try, from the kinds the person may read (A 152): a count of the first two and a
 * number split by a field, which the rules read, so trying one costs nothing.
 */
export function suggestions(kinds: AskKind[]): string[] {
  const counts = kinds.slice(0, 2).map((k) => w.howManyAre(k.pluralLabel.toLowerCase()));
  const split = kinds.find((k) => k.by.some((b) => k.fields.some((f) => f.name === b)));
  const by = split?.fields.find((f) => split.by.includes(f.name));
  const tries =
    split && by ? [...counts, w.perField(split.pluralLabel, by.label.toLowerCase())] : counts;
  // Only what the rules read: a label they would not read gives no chip.
  return tries.filter((question) => readQuestion(question, kinds));
}
