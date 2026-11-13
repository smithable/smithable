// Smithable app kit: a stored picture's or document's address with its content's tag (?v=, the
// hash its file is named by). A new file is a new address, so the file routes may let a public
// one be kept for a day (src/kit/uploads.ts, uploadResponse).
export function versioned(address: string, stored: { file?: string } | null | undefined): string {
  const tag = stored?.file?.split("/").pop()?.split(".")[0];
  return tag ? `${address}?v=${tag}` : address;
}
