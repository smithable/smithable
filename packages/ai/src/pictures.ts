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

/** A word without its plural "s". Words and tags both go through it, or "status" never meets "status". */
const singular = (w: string) => (w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w);

/** The words of a text, lowercased, without accents, singular-ish ("cafés" matches "cafe"). */
export function words(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2)
    .map(singular);
}

/** Words that mean a tag without saying it: a marketplace sells second-hand things. */
const SYNONYMS: Record<string, string[]> = {
  sell: ["second-hand", "marketplace"],
  sale: ["second-hand", "marketplace"],
  buy: ["second-hand", "marketplace"],
  marketplace: ["second-hand"],
  used: ["second-hand"],
};

/** What the picker reads: what the person wrote, and what the app's spec names. */
interface Words {
  /** The description and the app's name, with how often each word comes. */
  said: Map<string, number>;
  /** Model, field and choice names: they say less (every app with a Booking is not a yoga studio). */
  spec: Set<string>;
}

/**
 * How well an entry's tags fit. A subject tag the description says counts 1, and a little more
 * when it says it twice ("a tool library … lend each other tools" is about tools); one only the
 * spec names counts 0.3; a generic tag, or a `starter-…` tag (which names the starter a picture
 * was made for, not a subject), a tenth.
 */
function weights(entry: PictureEntry, w: Words): number[] {
  const meant = new Set<string>();
  for (const word of w.said.keys()) for (const t of SYNONYMS[word] ?? []) meant.add(t);
  const all: number[] = [];
  for (const tag of entry.tags) {
    const starter = tag.startsWith("starter-");
    const t = tag.replace(/^starter-/, "");
    const parts = [t, ...t.split("-").filter((p) => p.length > 3)].map(singular);
    const said = Math.max(0, ...parts.map((p) => w.said.get(p) ?? 0));
    const inSpec = parts.some((p) => w.spec.has(p));
    if (!said && !inSpec && !meant.has(t)) continue;
    if (starter || GENERIC.has(t)) all.push(0.1);
    else if (said || meant.has(t)) all.push(1 + 0.25 * Math.min(2, Math.max(0, said - 1)));
    else all.push(0.3);
  }
  return all;
}
const score = (entry: PictureEntry, w: Words) => weights(entry, w).reduce((a, b) => a + b, 0);

const byScore = (w: Words) => (a: PictureEntry, b: PictureEntry) => {
  const d = score(b, w) - score(a, w);
  return d !== 0 ? d : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/** A small stable hash (FNV-1a) of a text: the same text gives the same number everywhere. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * Whether a hero is as good a choice as the best one: it fits (a score of 1), comes close to the
 * best's score, and its strongest tag is as strong as the best's, so a picture of books (which
 * "library" says once) is not as good as one of tools for "a tool library … tools".
 */
function asGood(entry: PictureEntry, best: PictureEntry, w: Words): boolean {
  const top = score(best, w);
  return (
    score(entry, w) >= Math.max(1, top * 0.6) &&
    Math.max(0, ...weights(entry, w)) >= Math.max(0, ...weights(best, w))
  );
}

/**
 * The hero and up to `count` sample pictures that fit a description and its models best;
 * deterministic for the same index and words. Among the heroes that are as good a choice as
 * the best one, the description and the app's name choose, so two yoga studios do not get the
 * same picture while the same app always gets the same. Without a fitting hero, a calm abstract
 * one.
 */
export function pickPictures(
  index: readonly PictureEntry[],
  options: { description: string; ir?: SpecIR; count?: number },
): PickedPictures {
  const count = options.count ?? 6;
  const said = new Map<string, number>();
  for (const word of words(
    [options.description, options.ir?.app.name ?? "", options.ir?.app.description ?? ""].join(" "),
  ))
    said.set(word, (said.get(word) ?? 0) + 1);
  const spec = new Set(
    words(
      (
        options.ir?.models.flatMap((m) => [
          m.name,
          ...m.fields.flatMap((f) => [f.name, ...(f.type.kind === "choice" ? f.type.values : [])]),
        ]) ?? []
      ).join(" "),
    ),
  );
  const wordSet: Words = { said, spec };
  const heroes = index.filter((e) => e.kind === "hero").sort(byScore(wordSet));
  const best = heroes[0];
  const fitting = best ? heroes.filter((e) => asGood(e, best, wordSet)) : [];
  const hero =
    fitting[
      hash(`${options.description}\n${options.ir?.app.name ?? ""}`) % (fitting.length || 1)
    ] ??
    // The calm abstract one, whatever its file is called after a remake (hero-abstract-calm-b).
    heroes.find((e) => e.id.startsWith("hero-abstract-calm")) ??
    heroes[0];
  const samples = index
    .filter((e) => e.kind === "sample")
    .sort(byScore(wordSet))
    .filter((e, i, all) => score(e, wordSet) >= 1 || i < Math.min(count, all.length))
    .slice(0, count);
  return { ...(hero ? { hero } : {}), samples };
}
