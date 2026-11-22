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

/**
 * Takes `kept` off every picture that is not the one the owner kept (picture-kinds.md §6): a picture
 * stays kept where the same file was there before, or where the same file was kept before (an item
 * that moved up a gallery). Any other file in its place, from whatever operation, asks again, and a
 * picture no longer marked as made by an AI is never kept.
 * The one place this is done: applyOperation calls it after every operation.
 */
export function forgetKept(before: unknown, content: YamlEditor): void {
  const was = pictures(before);
  const keptFiles = new Set(was.filter((p) => p.kept).map((p) => p.src));
  const at = new Map(was.map((p) => [p.at.join("\u0000"), p.src]));
  for (const p of pictures(content.get([])))
    if (
      p.kept &&
      (!p.generated || (at.get(p.at.join("\u0000")) !== p.src && !keptFiles.has(p.src)))
    )
      content.remove([...p.at, "kept"]);
}
