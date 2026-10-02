// Pictures for a first build, chosen from the Smithable image library's index by its tags: a
// hero for the landing page and a few sample pictures for the records. Pure: the host fetches
// the index and the files (docs/design/showcase.md, the image library).
import type { SpecIR } from "@smithable/core";

/** One entry of the library's index.json. */
export interface PictureEntry {
  id: string;
  kind: "hero" | "sample" | "logo" | string;
  url: string;
  alt: string;
  tags: string[];
  width?: number;
  height?: number;
}

export interface PickedPictures {
  hero?: PictureEntry;
  samples: PictureEntry[];
}

/** Tags that say little about the subject; they only break ties. */
const GENERIC = new Set([
  "hero",
  "sample",
  "indoor",
  "outdoor",
  "calm",
  "warm",
  "light",
  "dark",
  "people",
  "nature",
]);

/** The words of a text, lowercased, without accents, singular-ish ("cafés" matches "cafe"). */
export function words(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2)
    .map((w) => (w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w));
}

/** Words that mean a tag without saying it: a marketplace sells second-hand things. */
const SYNONYMS: Record<string, string[]> = {
  sell: ["second-hand", "marketplace"],
  sale: ["second-hand", "marketplace"],
  buy: ["second-hand", "marketplace"],
  marketplace: ["second-hand"],
  used: ["second-hand"],
};

/** How well an entry's tags fit the words: a subject tag counts 1, a generic one a tenth. */
function score(entry: PictureEntry, wordSet: Set<string>): number {
  const meant = new Set<string>();
  for (const w of wordSet) for (const t of SYNONYMS[w] ?? []) meant.add(t);
  let total = 0;
  for (const tag of entry.tags) {
    const t = tag.replace(/^starter-/, "");
    const parts = t.split("-");
    const hit =
      wordSet.has(t) ||
      meant.has(t) ||
      parts.some((p) => p.length > 3 && wordSet.has(p)) ||
      [...wordSet].some((w) => w.length > 3 && t.startsWith(w));
    if (hit) total += GENERIC.has(t) ? 0.1 : 1;
  }
  return total;
}

const byScore = (wordSet: Set<string>) => (a: PictureEntry, b: PictureEntry) => {
  const d = score(b, wordSet) - score(a, wordSet);
  return d !== 0 ? d : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/**
 * The hero and up to `count` sample pictures that fit a description and its models best;
 * deterministic for the same index and words. Without a fitting hero, a calm abstract one.
 */
export function pickPictures(
  index: readonly PictureEntry[],
  options: { description: string; ir?: SpecIR; count?: number },
): PickedPictures {
  const count = options.count ?? 6;
  const text = [
    options.description,
    options.ir?.app.name ?? "",
    options.ir?.app.description ?? "",
    ...(options.ir?.models.flatMap((m) => [
      m.name,
      ...m.fields.flatMap((f) => [f.name, ...(f.type.kind === "choice" ? f.type.values : [])]),
    ]) ?? []),
  ].join(" ");
  const wordSet = new Set(words(text));
  const heroes = index.filter((e) => e.kind === "hero").sort(byScore(wordSet));
  const best = heroes[0];
  const hero =
    best && score(best, wordSet) >= 1
      ? best
      : (heroes.find((e) => e.id === "hero-abstract-calm") ?? heroes[0]);
  const samples = index
    .filter((e) => e.kind === "sample")
    .sort(byScore(wordSet))
    .filter((e, i, all) => score(e, wordSet) >= 1 || i < Math.min(count, all.length))
    .slice(0, count);
  return { ...(hero ? { hero } : {}), samples };
}
