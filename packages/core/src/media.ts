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
 * (§2): each one, whether or not the same file is still used elsewhere, so the person confirms
 * every slot an operation would empty.
 */
export function lostMedia(before: unknown, after: unknown): MediaSlot[] {
  const now = new Map(mediaSlots(after).map((s) => [s.at.join("\u0000"), s.asset]));
  return mediaSlots(before).filter((s) => now.get(s.at.join("\u0000")) !== s.asset);
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
