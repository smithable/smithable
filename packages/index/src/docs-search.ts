// What Smith reads before answering (T755 step 1): the parts of docs.smithable.ai and of the app's
// own summary that share the most words with a request, ranked by BM25 with no model. Studio
// searches the docs in the person's browser (a hosted workspace has no internet), the host
// searches the app; the bench uses both, so the numbers measured are what Smith gets.
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
}

export const DOCS_SITE = "https://docs.smithable.ai";

/** Characters of a part sent to the model. */
const TEXT = 1200;

/** Words that say nothing of a request's subject, in English and Swedish. */
const PLAIN = new Set(
  `a an and are as at be by can could do does for from has have how i if in into is it its me my
  no not of on or our should so that the their them then there this to us was we what when where
  which who why will with would you your och att av de den det du en ett för har hur i jag kan med
  min mina på som till vad var vi är`.split(/\s+/),
);

/** A request's or a text's words: lower case, letters and digits, a plural's s dropped. */
export function searchWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !PLAIN.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

/**
 * BM25 over documents given as word lists (k1 1.2, b 0.75): each document's score for the
 * query, 0 where it shares no word. A word in a heading is counted as three.
 */
function bm25(docs: string[][], query: string[]): number[] {
  const n = docs.length;
  if (!n) return [];
  const average = docs.reduce((sum, d) => sum + d.length, 0) / n || 1;
  const holding = new Map<string, number>();
  for (const d of docs) for (const w of new Set(d)) holding.set(w, (holding.get(w) ?? 0) + 1);
  const wanted = [...new Set(query)];
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

const weighted = (heading: string, text: string) => {
  const head = searchWords(heading);
  return [...head, ...head, ...head, ...searchWords(text)];
};

/** The docs' parts that answer a request best, at most `count`, best first. */
export function searchDocs(index: DocsIndex, request: string, count = 5): DocsHit[] {
  const query = searchWords(request);
  if (!query.length) return [];
  const scores = bm25(
    index.parts.map(([page, heading, , text]) =>
      weighted(`${index.pages[page]?.[1] ?? ""} ${heading}`, text),
    ),
    query,
  );
  return index.parts
    .map((part, i) => ({ part, score: scores[i] ?? 0 }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ part: [page, heading, id, text] }) => {
      const [url = "", title = ""] = index.pages[page] ?? [];
      return {
        title: title === heading || !heading ? title : `${title} › ${heading}`,
        url: `${DOCS_SITE}/${url}${id ? `#${id}` : ""}`,
        text: text.slice(0, TEXT),
      };
    });
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
  if (found.length) return found.map(({ s }) => sectionText(s)).join("\n\n");
  const whole = sections.map(sectionText).join("\n\n");
  return whole.length > SUMMARY ? `${whole.slice(0, SUMMARY)}…` : whole;
}
