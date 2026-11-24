// A business's stored pictures in a content file (docs/design/media-storage.md): which files a
// revision uses, and which places lose one. Pure: the host fetches and writes (rule 8).
import { ASSET_ID } from "./content.js";
import { YamlEditor } from "./edit.js";

/** A place in the content file that holds a stored file: its path and the file's id. */
export interface MediaSlot {
  at: string[];
  asset: string;
}

/** A stored file a revision uses, with the names of the renditions its values need (§4). */
export interface MediaUse {
  asset: string;
  variants: string[];
}

/** Every stored file in a parsed content file, where it is (a picture's map with an asset). */
export function mediaSlots(
  value: unknown,
  at: string[] = [],
  found: MediaSlot[] = [],
): MediaSlot[] {
  if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) mediaSlots(v, [...at, String(i)], found);
  } else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.asset === "string") found.push({ at, asset: o.asset });
    else for (const [key, v] of Object.entries(o)) mediaSlots(v, [...at, key], found);
  }
  return found;
}

/**
 * The places that held a stored file before a change and hold another file or none after it
 * (§2), so the person confirms every slot an operation would empty. A file counts by its places:
 * one that only moved (a gallery item before it taken out, items reordered, a page renamed) keeps
 * as many places as it had, and loses none; one in fewer places loses the difference, whether or
 * not the same file is still used elsewhere.
 */
export function lostMedia(before: unknown, after: unknown): MediaSlot[] {
  const key = (s: MediaSlot) => s.at.join("\u0000");
  const now = mediaSlots(after);
  const there = new Map(now.map((s) => [key(s), s.asset]));
  const stays = (s: MediaSlot) => there.get(key(s)) === s.asset;
  const had = mediaSlots(before);
  // Places left for a moved file: its places after, less those it kept where it was.
  const free = new Map<string, number>();
  for (const s of now) free.set(s.asset, (free.get(s.asset) ?? 0) + 1);
  for (const s of had) if (stays(s)) free.set(s.asset, (free.get(s.asset) ?? 0) - 1);
  return had.filter((s) => {
    if (stays(s)) return false;
    const left = free.get(s.asset) ?? 0;
    free.set(s.asset, left - 1);
    return left <= 0;
  });
}

/**
 * A stored file the change brings in that the files did not name before (media-storage.md §2):
 * what a model's change may never do, by whichever operation, since only a person picks one.
 */
export function broughtMedia(before: { content?: string }, after: { content?: string }) {
  const had = new Set(mediaInUse(before).map((u) => u.asset));
  return mediaInUse(after).find((u) => !had.has(u.asset))?.asset;
}

/** A slot in words: "the picture of hero on home", "picture 2 of gallery on home". */
export function slotName({ at }: MediaSlot): string {
  const [top, page, section, ...rest] = at;
  if (top !== "pages" || !page || !section) return `the picture at ${at.join(".")}`;
  const where = `${section} on ${page}`;
  if (rest[0] === "items" && rest[1] !== undefined)
    return `picture ${Number(rest[1]) + 1} of ${where}`;
  if (rest[0] === "tiles" && rest[1] !== undefined)
    return `the ${rest[1]} tile's picture of ${where}`;
  return `the picture of ${where}`;
}

/**
 * Each stored file a revision's content file names, by id, with the renditions its values need:
 * `w<n>.webp` for `width` and each of `widths`. The same function serves the workspace's fetch and
 * the service's publish, so the two never disagree on what is in use. Sorted, so the list is the
 * same for the same file.
 */
export function mediaInUse(files: { content?: string }): MediaUse[] {
  if (!files.content) return [];
  const variants = new Map<string, Set<string>>();
  const walk = (value: unknown) => {
    if (Array.isArray(value)) for (const v of value) walk(v);
    else if (value && typeof value === "object") {
      const o = value as Record<string, unknown>;
      if (typeof o.asset === "string") {
        if (!ASSET_ID.test(o.asset)) return;
        const names = variants.get(o.asset) ?? new Set<string>();
        const widths = [o.width, ...(Array.isArray(o.widths) ? o.widths : [])];
        for (const w of widths)
          if (Number.isInteger(w) && (w as number) > 0) names.add(`w${w}.webp`);
        variants.set(o.asset, names);
      } else for (const v of Object.values(o)) walk(v);
    }
  };
  walk(new YamlEditor(files.content).get([]));
  const byWidth = (a: string, b: string) => Number(a.slice(1, -5)) - Number(b.slice(1, -5));
  return [...variants.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([asset, names]) => ({ asset, variants: [...names].sort(byWidth) }));
}
