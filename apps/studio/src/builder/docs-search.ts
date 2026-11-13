// Smith's answers from the docs (studio-v3.md §2): docs.smithable.ai's own search index, read in
// the person's browser on first use (a hosted workspace has no internet, the browser has), kept
// for the tab, and searched by the same ranking the bench measures (@smithable/index, T755).
import { DOCS_SITE, type DocsIndex, searchDocsWith } from "@smithable/index";

export type { DocsIndex };

export const DOCS = DOCS_SITE;

export interface DocsHit {
  title: string;
  url: string;
  line: string;
  /** The part's words, for Smith to answer from (A 152). */
  text: string;
}

let loading: Promise<DocsIndex> | undefined;

/** The index, fetched once for the tab; a failure is tried again on the next question. */
export function docsIndex(): Promise<DocsIndex> {
  // A plain GET (no preflight, which the docs' host does not answer), given up after ten
  // seconds so a stalled connection does not hold the tab's promise for good.
  loading ??= fetch(`${DOCS}/search.json`, { signal: AbortSignal.timeout(10_000) }).then((r) => {
    if (!r.ok) throw new Error(`The docs answered ${r.status}.`);
    return r.json() as Promise<DocsIndex>;
  });
  loading.catch(() => {
    loading = undefined;
  });
  return loading;
}

/** Whether a request reads as a question, for showing the docs' parts beside the answer. */
export const asksTheDocs = (text: string) =>
  /\?\s*$/.test(text) ||
  /^(how|where|what|why|can i|is there|hur|var|vad|varför|kan jag|finns det)\b/i.test(text.trim());

/** The parts that answer a request best, with its search phrases beside it, at most `count`. */
export function searchDocs(
  index: DocsIndex,
  request: string,
  phrases: readonly string[] = [],
  count = 3,
): DocsHit[] {
  return searchDocsWith(index, request, phrases, count).map((h) => ({
    ...h,
    line: h.text.length > 180 ? `${h.text.slice(0, 180)}…` : h.text,
  }));
}
