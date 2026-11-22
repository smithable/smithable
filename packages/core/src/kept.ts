import type { YamlEditor } from "./edit.js";

type Found = { at: string[]; src: string; kept: boolean; generated: boolean };

/** Every picture in a content file (a map with a src): where, its file, whether it is kept. */
function pictures(value: unknown, at: string[] = [], found: Found[] = []): Found[] {
  if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) pictures(v, [...at, String(i)], found);
  } else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.src === "string")
      found.push({ at, src: o.src, kept: o.kept === true, generated: o.generated === true });
    else for (const [key, v] of Object.entries(o)) pictures(v, [...at, key], found);
  }
  return found;
}

const place = (p: Found) => p.at.join("\u0000");
/** A list's place with the item's number left out, and the file: the same gallery, any place. */
const inList = (p: Found) =>
  `${p.at.map((k) => (/^\d+$/.test(k) ? "#" : k)).join("\u0000")}\u0001${p.src}`;

/**
 * Takes `kept` off every picture that is not one the owner kept (picture-kinds.md §6). A picture
 * stays kept where the same file was before (a keep just made, new words). Elsewhere it stays kept only as a kept
 * picture that moved within its list (an item that moved up a gallery): each kept picture that
 * left its place may be found once again in the same list, never twice, and never in another
 * place. Any other file in its place, from whatever operation, asks again, and a picture no longer
 * marked as made by an AI is never kept. The one place this is done: applyOperation calls it after
 * every operation.
 */
export function forgetKept(before: unknown, content: YamlEditor): void {
  const was = pictures(before);
  const now = pictures(content.get([]));
  const fileAt = new Map(was.map((p) => [place(p), p.src]));
  const stays = (p: Found) => p.generated && fileAt.get(place(p)) === p.src;
  // The kept pictures that left their place, by list and file: how many may be found moved.
  const moved = new Map<string, number>();
  for (const p of was)
    if (p.kept && !now.some((q) => place(q) === place(p) && q.src === p.src))
      moved.set(inList(p), (moved.get(inList(p)) ?? 0) + 1);
  for (const p of now) {
    if (!p.kept || stays(p)) continue;
    const left = p.generated ? (moved.get(inList(p)) ?? 0) : 0;
    if (left > 0) moved.set(inList(p), left - 1);
    else content.remove([...p.at, "kept"]);
  }
}
