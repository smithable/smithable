// What Smith reads before answering (T755 step 1): the parts of docs.smithable.ai and of the app's
// own summary that share the most words with a request, ranked by BM25 with no model. Studio
// searches the docs in the person's browser (a hosted workspace has no internet), the host
// searches the app; the bench uses both, so the numbers measured are what Smith gets.
import { standsFor } from "./search-words.js";
import type { SummarySection } from "./summary.js";

/** The docs' search index as the site builds it (scripts/build-docs.mjs): pages and their parts. */
export interface DocsIndex {
  pages: [url: string, title: string][];
  parts: [page: number, heading: string, id: string, text: string][];
}

export interface DocsHit {
  /** "Page › Heading", or the page's title for its first part. */
  title: string;
  /** The page's address on the docs site, with the part's anchor. */
  url: string;
  /** The part's words, cut to `TEXT` characters. */
  text: string;
  /** How well it matched (BM25): small when only a common word was shared. */
  score?: number;
}

export const DOCS_SITE = "https://docs.smithable.ai";

/** Characters of a part sent to the model: the whole part, as a rule (three in full beat five cut short, T755). */
const TEXT = 3000;

/** Words that say nothing of a request's subject, in English and Swedish. */
const PLAIN = new Set(
  `a an and are as at be by can could do does for from has have how i if in into is it its me my
  no not of on or our should so that the their them then there this to us was we what when where
  which who why will with would you your och att av de den det du en ett för har hur i jag kan med
  min mina på som till vad var vi är`.split(/\s+/),
);

/** A request's or a text's words: lower case, letters and digits, a plural's s dropped. */
export function searchWords(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !PLAIN.has(w))
      // A word of another language also as the words it stands for (search-words.ts).
      .flatMap((w) => [w, ...standsFor(w)])
      .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
  );
}

/**
 * BM25 over documents given as word lists (k1 1.2, b 0.75): each document's score for the
 * query, 0 where it shares no word. A word in a heading is counted as three.
 */
function bm25(docs: string[][], query: string[], typos = false): number[] {
  const n = docs.length;
  if (!n) return [];
  const average = docs.reduce((sum, d) => sum + d.length, 0) / n || 1;
  const holding = new Map<string, number>();
  for (const d of docs) for (const w of new Set(d)) holding.set(w, (holding.get(w) ?? 0) + 1);
  // A word of five letters or more found nowhere is also each word one edit from it (T844 D):
  // "publsh" finds publish.
  const near = (w: string) =>
    typos && w.length >= 5 && !holding.has(w)
      ? [...holding.keys()].filter((v) => v.length >= 5 && oneEdit(w, v))
      : [];
  const wanted = [...new Set(query.flatMap((w) => [w, ...near(w)]))];
  return docs.map((d) => {
    const counts = new Map<string, number>();
    for (const w of d) counts.set(w, (counts.get(w) ?? 0) + 1);
    let score = 0;
    for (const w of wanted) {
      const tf = counts.get(w);
      if (!tf) continue;
      const df = holding.get(w) ?? 0;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      score += (idf * tf * 2.2) / (tf + 1.2 * (0.25 + (0.75 * d.length) / average));
    }
    return score;
  });
}

/** Whether two words differ by one letter added, left out, changed or two swapped. */
function oneEdit(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length)
    return (
      a.slice(i + 1) === b.slice(i + 1) ||
      (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
    );
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

const weighted = (heading: string, text: string) => {
  const head = searchWords(heading);
  return [...head, ...head, ...head, ...searchWords(text)];
};

/** The docs' parts that answer a request best, at most `count`, best first. */
export function searchDocs(index: DocsIndex, request: string, count = 3): DocsHit[] {
  const query = searchWords(request);
  if (!query.length) return [];
  const scores = bm25(
    index.parts.map(([page, heading, , text]) =>
      weighted(`${index.pages[page]?.[1] ?? ""} ${heading}`, text),
    ),
    query,
    true,
  );
  return index.parts
    .map((part, i) => ({ part, score: scores[i] ?? 0 }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ part: [page, heading, id, text], score }) => {
      const [url = "", title = ""] = index.pages[page] ?? [];
      return {
        title: title === heading || !heading ? title : `${title} › ${heading}`,
        url: `${DOCS_SITE}/${url}${id ? `#${id}` : ""}`,
        text: text.slice(0, TEXT),
        score,
      };
    });
}

/**
 * The docs' parts for a request and the search phrases written for it (T755 step 2): the request's
 * own best first, then each phrase's best in turn, at most `count`, none twice.
 */
export function searchDocsWith(
  index: DocsIndex,
  request: string,
  phrases: readonly string[],
  count = 3,
): DocsHit[] {
  const lists = [request, ...phrases].map((text) => searchDocs(index, text, count));
  const out: DocsHit[] = [];
  for (let i = 0; out.length < count && i < count; i++)
    for (const list of lists) {
      const hit = list[i];
      if (hit && out.length < count && !out.some((h) => h.url === hit.url)) out.push(hit);
    }
  return out;
}

/** Characters of the whole summary given when no part of it matches a request. */
const SUMMARY = 3000;

const sectionText = (s: SummarySection) =>
  [
    `${s.title}: ${s.sentences.join(" ")}`,
    ...(s.fields ?? []).map((f) => `- ${f.label}: ${f.text}`),
  ].join("\n");

/**
 * The parts of the app's plain-language summary (in the app's own words and language) that share
 * the most words with a request, at most `count`; without any, the whole summary, cut.
 */
/**
 * The words of a question about who may do what (T844 C), by language: the asking words, the
 * verbs of the grants (read, create, write, delete, run, see) and the persons who ask for
 * themselves, whose "can I" is a request, not a question about rights. Data, not rules.
 */
const RIGHTS = {
  en: {
    who: [
      "who",
      "whom",
      "which role",
      "which roles",
      "which people",
      "which users",
      "anyone",
      "everyone",
    ],
    ask: ["can", "may", "let", "allowed to"],
    verbs: [
      "see",
      "read",
      "view",
      "open",
      "create",
      "add",
      "write",
      "edit",
      "change",
      "delete",
      "remove",
      "run",
      "use",
      "close",
    ],
    self: ["you", "i", "we"],
  },
  sv: {
    who: ["vem", "vilka", "vem som helst", "alla"],
    ask: ["kan", "får", "låt"],
    verbs: [
      "se",
      "läsa",
      "öppna",
      "skapa",
      "lägga till",
      "skriva",
      "ändra",
      "redigera",
      "ta bort",
      "radera",
      "köra",
      "använda",
      "stänga",
    ],
    self: ["du", "ni", "jag", "vi"],
  },
};
const alt = (words: readonly string[]) => words.map((w) => w.replace(/ /g, "\\s+")).join("|");
const RIGHTS_SHAPES = Object.values(RIGHTS).flatMap((l) => [
  // "who can close cases", "vem får se …"
  new RegExp(
    `(^|[^\\p{L}])(${alt(l.who)})([^\\p{L}].*)?[^\\p{L}](${alt(l.ask)})([^\\p{L}]|$)`,
    "u",
  ),
  // "can customers see …", "får frisörerna ta bort …", "låt personalen ta bort …"; not "can you add"
  new RegExp(
    `(^|[^\\p{L}])(${alt(l.ask)})\\s+(?!(${alt(l.self)})[^\\p{L}])(\\p{L}+\\s+){1,3}(${alt(l.verbs)})([^\\p{L}]|$)`,
    "u",
  ),
]);

/** Whether a request asks who may do what, or about the API (keys read by their role). */
export function asksRights(request: string): boolean {
  const text = request.toLowerCase();
  return (
    /(^|[^\p{L}])api([^\p{L}]|$)/u.test(text) || RIGHTS_SHAPES.some((shape) => shape.test(text))
  );
}

export function appParts(sections: SummarySection[], request: string, count = 4): string {
  const query = searchWords(request);
  const scores = bm25(
    sections.map((s) =>
      weighted(
        `${s.title} ${s.concept.split(":")[1] ?? ""}`,
        `${s.sentences.join(" ")} ${(s.fields ?? []).map((f) => `${f.field} ${f.label} ${f.text}`).join(" ")}`,
      ),
    ),
    query,
  );
  const found = sections
    .map((s, i) => ({ s, score: scores[i] ?? 0 }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
  // A question about who may do what brings who may (the auth part), whatever its words matched.
  const auth = asksRights(request) && sections.find((s) => s.concept === "auth");
  if (auth && !found.some((h) => h.s === auth)) found.push({ s: auth, score: 0 });
  // What the app does by itself that the search may miss (T844 B): every action, outgoing call
  // and timer the parts found leave out, by one line each, a few tokens, in any language asked.
  const also = sections
    .filter((s) => /^(action|outgoing|timer):/.test(s.concept) && !found.some((h) => h.s === s))
    .map((s) => `- ${s.concept}: ${s.title}`);
  if (found.length)
    return [
      ...found.map(({ s }) => sectionText(s)),
      ...(also.length ? [`Also in the app:\n${also.join("\n")}`] : []),
    ].join("\n\n");
  const whole = sections.map(sectionText).join("\n\n");
  if (whole.length <= SUMMARY) return whole;
  // Cut, the ones past the cut by their line.
  const cut = whole.slice(0, SUMMARY);
  const past = sections
    .filter((s) => /^(action|outgoing|timer):/.test(s.concept) && !cut.includes(sectionText(s)))
    .map((s) => `- ${s.concept}: ${s.title}`);
  return `${cut}…${past.length ? `\n\nAlso in the app:\n${past.join("\n")}` : ""}`;
}

/** The spec's sections whose entries a question may name (T755): what the summary leaves out. */
const SPEC_SECTIONS = ["models", "pages", "timers", "outgoing", "incoming", "actions"];

/**
 * The entries of smithable.yml a request names, as written: each kind of record, page, timer,
 * outgoing or incoming call or action whose name and lines share the most words with it, at most
 * `count`, cut at `max` characters in all. Beside the summary, they carry the rules it leaves
 * out (until when, who is told, how often).
 */
export function specLines(spec: string, request: string, count = 3, max = 2500): string {
  const blocks: { section: string; key: string; text: string }[] = [];
  let section: string | undefined;
  let current: { section: string; key: string; lines: string[] } | undefined;
  const close = () => {
    if (current)
      blocks.push({ section: current.section, key: current.key, text: current.lines.join("\n") });
    current = undefined;
  };
  for (const line of spec.split("\n")) {
    const top = /^([A-Za-z]+):/.exec(line);
    if (top) {
      close();
      section = SPEC_SECTIONS.includes(top[1] as string) ? top[1] : undefined;
      continue;
    }
    if (!section) continue;
    const entry = /^ {2}([A-Za-z0-9_-]+):/.exec(line);
    if (entry) {
      close();
      current = { section, key: entry[1] as string, lines: [line] };
    } else if (current && (line.startsWith("   ") || !line.trim())) current.lines.push(line);
  }
  close();
  const query = searchWords(request);
  if (!query.length || !blocks.length) return "";
  const scores = bm25(
    blocks.map((b) => weighted(b.key.replace(/([a-z])([A-Z])/g, "$1 $2"), b.text)),
    query,
  );
  const chosen = blocks
    .map((b, i) => ({ b, score: scores[i] ?? 0 }))
    .filter((h) => h.score > 0)
    .sort((a, z) => z.score - a.score)
    .slice(0, count)
    .map(({ b }) => `${b.section}:\n${b.text.trimEnd()}`)
    .join("\n\n");
  return chosen.length > max ? `${chosen.slice(0, max)}…` : chosen;
}
