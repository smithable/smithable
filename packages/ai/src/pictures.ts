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
function score(entry: PictureEntry, w: Words): number {
  const meant = new Set<string>();
  for (const word of w.said.keys()) for (const t of SYNONYMS[word] ?? []) meant.add(t);
  let total = 0;
  for (const tag of entry.tags) {
    const starter = tag.startsWith("starter-");
    const t = tag.replace(/^starter-/, "");
    const parts = [t, ...t.split("-").filter((p) => p.length > 3)];
    const said = Math.max(0, ...parts.map((p) => w.said.get(p) ?? 0));
    const inSpec = parts.some((p) => w.spec.has(p));
    if (!said && !inSpec && !meant.has(t)) continue;
    if (starter || GENERIC.has(t)) total += 0.1;
    else if (said || meant.has(t)) total += 1 + 0.25 * Math.min(2, Math.max(0, said - 1));
    else total += 0.3;
  }
  return total;
}

const byScore = (w: Words) => (a: PictureEntry, b: PictureEntry) => {
  const d = score(b, w) - score(a, w);
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
