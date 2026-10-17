// Smith's answers from the docs (studio-v3.md §2): docs.smithable.ai's own search index, read in
// the person's browser on first use (a hosted workspace has no internet, the browser has), kept
// for the tab. The parts whose heading and words hold the question's words, those with them in
// the heading first, as the site's search box finds them; no model.

export const DOCS = "https://docs.smithable.ai";

/** The index as the site builds it (scripts/build-docs.mjs): pages, and their parts. */
export interface DocsIndex {
  pages: [url: string, title: string][];
  parts: [page: number, heading: string, id: string, text: string][];
}

export interface DocsHit {
  title: string;
  url: string;
  line: string;
}

let loading: Promise<DocsIndex> | undefined;

/** The index, fetched once for the tab; a failure is tried again on the next question. */
export function docsIndex(): Promise<DocsIndex> {
  loading ??= fetch(`${DOCS}/search.json`).then((r) => {
    if (!r.ok) throw new Error(`The docs answered ${r.status}.`);
    return r.json() as Promise<DocsIndex>;
  });
  loading.catch(() => {
    loading = undefined;
  });
  return loading;
}

/** Words a question holds that say nothing of its subject. */
const PLAIN = new Set(
  "a an and are can could do does for from how i in into is it me my of on or should the to what when where which why with you your".split(
    " ",
  ),
);

/** Whether a request reads as a question about how something is done, for the docs. */
export const asksTheDocs = (text: string) =>
  /\?\s*$/.test(text) || /^(how|where|what|why|can i|is there)\b/i.test(text.trim());

/** The parts that answer a question best, at most `count`. */
export function searchDocs(index: DocsIndex, question: string, count = 3): DocsHit[] {
  const words = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !PLAIN.has(w));
  if (!words.length) return [];
  const hits = index.parts
    .map(([page, heading, id, text]) => {
      const head = heading.toLowerCase();
      const body = text.toLowerCase();
      const found = words.filter((w) => head.includes(w) || body.includes(w));
      return {
        page,
        heading,
        id,
        text,
        // Each word found counts, one in the heading more.
        score: found.length * 2 + words.filter((w) => head.includes(w)).length * 3,
      };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
  return hits.map((h) => {
    const [url = "", page = ""] = index.pages[h.page] ?? [];
    return {
      title: page === h.heading ? page : `${page} › ${h.heading}`,
      url: `${DOCS}/${url}${h.id ? `#${h.id}` : ""}`,
      line: h.text.length > 180 ? `${h.text.slice(0, 180)}…` : h.text,
    };
  });
}
