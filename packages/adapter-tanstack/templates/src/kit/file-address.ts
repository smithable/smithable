// Smithable app kit: a stored picture's or document's address with its content's tag (?v=, the
// hash its file is named by). A new file is a new address, so the file routes may let a public
// one be kept for a day (src/kit/uploads.ts, uploadResponse).
export function versioned(address: string, stored: { file?: string } | null | undefined): string {
  const tag = tagOf(stored?.file);
  return tag ? `${address}?v=${tag}` : address;
}

const tagOf = (file: string | undefined) => file?.split("/").pop()?.split(".")[0];

/**
 * A stored picture at each width it is kept at, for an img's srcset: its smaller copies (?w=, each
 * with its own tag) and itself. Undefined for a picture without copies.
 */
export function pictureSet(
  address: string,
  stored:
    | { file?: string; width?: number; smaller?: { file: string; width: number }[] }
    | null
    | undefined,
): string | undefined {
  if (!stored?.smaller?.length || !stored.width) return undefined;
  return [
    ...stored.smaller.map((s) => `${address}?w=${s.width}&v=${tagOf(s.file)} ${s.width}w`),
    `${versioned(address, stored)} ${stored.width}w`,
  ].join(", ");
}
