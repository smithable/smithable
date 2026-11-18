// Read-only cards for the app's own library subjects. Applying still uses setPictureStyle.
import {
  currentHashes,
  type LibraryVersion,
  linkedRecordPath,
  offeredStyles,
  planStyle,
  readRecords,
  rebuildRecords,
  roleOf,
  sha256,
} from "./picture-style.js";
import { libraryBase, libraryBytes } from "./pictures.js";

export interface PictureStyleCard {
  id: string;
  name: string;
  line: string;
  kept: number;
  total: number;
  generated: number;
  previews: { src: string; alt: string }[];
}

export const pictureHashes = (dir: string) =>
  JSON.stringify({ files: currentHashes(dir), records: readRecords(dir) });

/**
 * A style the app does not have yet shows its previews through Studio itself (T951): a hosted
 * workspace reaches the library only by the service's inner address, which the owner's browser
 * cannot, and locally the browser is not sent to another site.
 */
export const previewSrc = (offer: string, entry: { id: string; sha256: string }) =>
  `/api/picture-styles/preview?${new URLSearchParams({ offer, entry: entry.id, v: entry.sha256 })}`;

export function pictureStyleCards(
  dir: string,
  version: LibraryVersion,
  language = "en",
  offer = "",
) {
  const linked = linkedRecordPath(dir);
  if (linked) return { styles: [], error: "The app's pictures cannot be read safely." };
  const records = rebuildRecords(dir, version);
  const hashes = currentHashes(dir);
  const byId = new Map(version.entries.map((entry) => [entry.id, entry]));
  const owned = Object.entries(hashes).filter(
    ([file, hash]) =>
      roleOf(file) !== "logo" && records[file]?.sha256 === hash && records[file]?.entry,
  );
  const currentStyles = new Set(
    owned
      .map(([file]) => records[file]?.style ?? byId.get(records[file]?.entry ?? "")?.style)
      .filter(Boolean),
  );
  const current = currentStyles.size === 1 ? [...currentStyles][0] : undefined;
  const styles: PictureStyleCard[] = [];
  if (!owned.length) return { styles, current };
  for (const style of offeredStyles(dir, version)) {
    if (typeof style.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(style.id)) continue;
    const entries = owned.flatMap(([file]) => {
      const original = byId.get(records[file]?.entry ?? "");
      const entry =
        original?.subject &&
        version.entries.find(
          (candidate) =>
            candidate.subject === original.subject &&
            candidate.style === style.id &&
            candidate.kind === roleOf(file),
        );
      return entry ? [entry] : [];
    });
    if (entries.length !== owned.length) continue;
    const words = style.words?.[language] ?? style.words?.en;
    const plan = planStyle(dir, version, style.id);
    const previews = entries.slice(0, 3).flatMap((entry, index) => {
      if (style.id === current) {
        const file = owned[index]?.[0] as string;
        return [{ src: `/api/images/${file}?v=${hashes[file]}`, alt: entry.alt }];
      }
      return [{ src: previewSrc(offer, entry), alt: entry.alt }];
    });
    if (!previews.length) continue;
    styles.push({
      id: style.id,
      name: words?.name ?? style.id,
      line: words?.line ?? "",
      kept: plan.kept.length,
      total: entries.length,
      generated:
        style.id === current
          ? owned.filter(([file]) => records[file]?.generated !== false).length
          : entries.filter((entry) => entry.generated !== false).length,
      previews,
    });
  }
  return { styles, current };
}

/** Serve the exact index that made the cards, even if latest.json advances before Keep. */
export function pinnedPictureVersion(
  version: LibraryVersion,
  fetchFn: typeof fetch = fetch,
): typeof fetch {
  const base = libraryBase();
  return (async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === `${base}/latest.json`)
      return Response.json({ version: version.version, index: `versions/${version.version}.json` });
    if (url === `${base}/versions/${version.version}.json`) return Response.json(version);
    return fetchFn(input, init);
  }) as typeof fetch;
}

/**
 * One preview of an offer: only an entry of the offer's pinned version, fetched by the host
 * through the library (size-capped), and sent only when its bytes match the entry's sha256 and
 * are a WebP picture. Nothing else is fetched through it.
 */
export async function stylePreview(
  version: LibraryVersion,
  entryId: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ bytes: Uint8Array; sha256: string } | { status: number; error: string }> {
  const entry = version.entries.find((candidate) => candidate.id === entryId);
  if (!entry || typeof entry.url !== "string" || typeof entry.sha256 !== "string")
    return { status: 404, error: "No such picture in this offer." };
  const bytes = await libraryBytes(entry.url, fetchFn);
  if (!bytes) return { status: 502, error: "The picture could not be read from the library." };
  const webp =
    bytes.length > 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  if (sha256(bytes) !== entry.sha256 || !webp)
    return { status: 502, error: "The library sent a different picture." };
  return { bytes, sha256: entry.sha256 };
}
