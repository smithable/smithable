// Pictures for a first build, chosen from the Smithable image library's index by its tags: a
// hero for the landing page, a mark for the app (docs/design/app-logo.md §4) and a few sample
// pictures for each model's records. Pure: the host fetches
// the index and the files (docs/design/showcase.md, the image library).
import {
  type ContentIR,
  humanize,
  type ModelIR,
  type SpecIR,
  storesPictures,
} from "@smithable/core";

/** One entry of the library's index.json. */
export interface PictureEntry {
  id: string;
  kind: "hero" | "sample" | "logo" | string;
  url: string;
  alt: string;
  tags: string[];
  width?: number;
  height?: number;
  /** Made by an image model; absent in an index from before photographs (all made by one then). */
  generated?: boolean;
  /** A photograph's source and licence, for the app's public/images/CREDITS.md. */
  credit?: PictureCredit;
}

export interface PictureCredit {
  page: string;
  author: string;
  licence: string;
  licenceUrl?: string;
  fetched: string;
}

export interface PickedPictures {
  hero?: PictureEntry;
  /** Always one when the library has marks: a fitting one, else an abstract one. */
  logo?: PictureEntry;
  /**
   * Sample pictures for each model that stores pictures, chosen by the model's own subject; a
   * model nothing in the library fits has none (no picture is better than a bicycle for a dish).
   */
  models: Record<string, PictureEntry[]>;
}

/** Tags that say little about the subject; they only break ties. */
const GENERIC = new Set([
  "hero",
  "sample",
  "logo",
  "mark",
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
 * The hash's bits stirred (murmur3's finaliser). FNV-1a's low bits hear only the characters'
 * low bits, whatever their order, so a salt alone would make the mark's pick among two the
 * hero's pick among two; stirred, the two are independent. The hero keeps the plain hash, so
 * an app picks the hero it always did.
 */
function stir(h: number): number {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
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

/** A tag that names a subject: not a generic one, nor the starter a picture was made for. */
const subject = (tag: string) => !tag.startsWith("starter-") && !GENERIC.has(tag);

/** A tag and its parts longer than three letters ("second-hand", "living-room"), singular. */
const tagParts = (tag: string) =>
  [tag, ...tag.split("-").filter((p) => p.length > 3)].map(singular);

/**
 * How many of an entry's subject tags a model's own words say: its name, labels and
 * description. Its fields and choices are not its subject (a court type's "kids" is no toy).
 */
function modelFit(entry: PictureEntry, own: Set<string>): number {
  return entry.tags.filter((t) => subject(t) && tagParts(t).some((p) => own.has(p))).length;
}

const modelWords = (model: ModelIR, content?: ContentIR) => {
  const texts = content?.models[model.name];
  return new Set(
    words([humanize(model.name), texts?.label, texts?.pluralLabel, model.description].join(" ")),
  );
};

/**
 * The hero and up to `count` sample pictures for each model with pictures that fit best;
 * deterministic for the same index and words. Among the heroes that are as good a choice as
 * the best one, the description and the app's name choose, so two yoga studios do not get the
 * same picture while the same app always gets the same. Without a fitting hero, a calm abstract
 * one.
 */
export function pickPictures(
  index: readonly PictureEntry[],
  options: { description: string; ir?: SpecIR; content?: ContentIR; count?: number },
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
  const text = `${options.description}\n${options.ir?.app.name ?? ""}`;
  /** Of the entries of a kind that fit as well as the best, the one the text's hash picks. */
  const fitting = (kind: string, n: number, keep = (_: PictureEntry) => true) => {
    const all = index.filter((e) => e.kind === kind && keep(e)).sort(byScore(wordSet));
    const best = all[0];
    const good = best ? all.filter((e) => asGood(e, best, wordSet)) : [];
    return { all, chosen: good[n % (good.length || 1)] };
  };
  const heroes = fitting("hero", hash(text));
  const hero =
    heroes.chosen ??
    // The calm abstract one, whatever its file is called after a remake (hero-abstract-calm-b).
    heroes.all.find((e) => e.id.startsWith("hero-abstract-calm")) ??
    heroes.all[0];
  // The mark's tie-break is salted and stirred, so it does not follow the hero's. No mark fits:
  // an abstract one by the same number, so no app is without one.
  const n = stir(hash(`logo\n${text}`));
  // A starter's monogram is its own name's letter, so another app never gets one.
  const marks = fitting("logo", n, (e) => !e.tags.includes("monogram"));
  const abstract = marks.all
    .filter((e) => e.tags.includes("abstract"))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const logo = marks.chosen ?? abstract[n % (abstract.length || 1)];
  // Each model's samples by its own subject first (a Dish gets dishes, whatever "book a table"
  // in the description says), then what the app says among those. A model whose words no
  // picture shares gets one only by the app's name ("Harbour Café" for its Items) or what the
  // description means without saying it (a marketplace's second-hand things), else none.
  const samples = index.filter((e) => e.kind === "sample");
  const named = new Set(words(options.ir?.app.name ?? ""));
  for (const word of said.keys()) for (const t of SYNONYMS[word] ?? []) named.add(t);
  const models: Record<string, PictureEntry[]> = {};
  for (const model of options.ir?.models ?? []) {
    if (!model.fields.some(storesPictures)) continue;
    const own = modelWords(model, options.content);
    let fitting = samples.filter((e) => modelFit(e, own) > 0);
    if (!fitting.length)
      fitting = samples.filter((e) =>
        e.tags.some((t) => subject(t) && tagParts(t).some((p) => named.has(p))),
      );
    const rank = (e: PictureEntry) => 2 * modelFit(e, own) + 0.5 * score(e, wordSet);
    models[model.name] = fitting
      .sort((a, b) => rank(b) - rank(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, count);
  }
  return { ...(hero ? { hero } : {}), ...(logo ? { logo } : {}), models };
}
