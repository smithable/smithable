// Smithable app kit: pictures on records are files under DATA_DIR/uploads (data, not code:
// backed up with the database). Saving, reading and deleting them lives here and nowhere
// else, so a shared file store later replaces this one module. Nothing from the browser is
// trusted: a picture is WebP by its header, its size is read from the file, and it is at most
// PICTURE_MAX_BYTES; the file name is made here from the content.
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

/** What a picture field stores: the file under uploads/, its description, and its size. */
export interface Picture {
  file: string;
  alt: string;
  width: number;
  height: number;
}

export const PICTURE_MAX_BYTES = 1_000_000;
/** The longest side a browser scales a picture to before sending it. */
export const PICTURE_MAX_SIDE = 1600;

const uploadsDir = () => join(process.env.DATA_DIR ?? "data", "uploads");

/** Refused pictures say why in words the form shows. */
export class BadPicture extends Error {}

/** The width and height of a WebP file, from its header; undefined when it is not one. */
export function webpSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  const text = (at: number, n: number) => String.fromCharCode(...bytes.subarray(at, at + n));
  if (bytes.length < 30 || text(0, 4) !== "RIFF" || text(8, 4) !== "WEBP") return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunk = text(12, 4);
  if (chunk === "VP8 ")
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = view.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X")
    return {
      width: (view.getUint16(24, true) | ((bytes[26] as number) << 16)) + 1,
      height: (view.getUint16(27, true) | ((bytes[29] as number) << 16)) + 1,
    };
  return undefined;
}

/** Stores a picture sent by a browser under `model/`, and returns what the record keeps of it. */
export function savePicture(model: string, bytes: Uint8Array, alt: string): Picture {
  if (bytes.length > PICTURE_MAX_BYTES)
    throw new BadPicture("The picture is too large (at most 1 MB).");
  const size = webpSize(bytes);
  if (!size || size.width < 1 || size.height < 1)
    throw new BadPicture("Choose a picture (JPEG, PNG, WebP or HEIC).");
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 24);
  const file = `${model}/${hash}.webp`;
  mkdirSync(join(uploadsDir(), model), { recursive: true });
  const path = join(uploadsDir(), file);
  if (!existsSync(path)) writeFileSync(path, bytes);
  return { file, alt, ...size };
}

/** The file of a stored picture, or undefined when it is gone. */
export function readPicture(picture: Picture): Buffer | undefined {
  if (!/^[a-z0-9-]+\/[a-f0-9]{24}\.webp$/.test(picture.file)) return undefined;
  const path = join(uploadsDir(), picture.file);
  return existsSync(path) ? readFileSync(path) : undefined;
}

/** Removes a picture's file, unless `stillUsed` says another record keeps it. */
export function deletePicture(picture: Picture | null | undefined, stillUsed: boolean): void {
  if (!picture || stillUsed || !readPicture(picture)) return;
  unlinkSync(join(uploadsDir(), picture.file));
}

/** The ETag of a stored picture: its file name carries the content's hash. */
export const pictureTag = (picture: Picture) => `"${picture.file.slice(-29, -5)}"`;

/**
 * For `pnpm db:seed`: the n-th sample picture (public/images/samples/<n>.webp) as a record's
 * picture, copied into uploads/; null when the app has no sample pictures.
 */
export function samplePicture(model: string, n: number, alt: string): Picture | null {
  const source = join("public", "images", "samples", `${n}.webp`);
  if (!existsSync(source)) return null;
  const bytes = readFileSync(source);
  const picture = savePicture(model, bytes, alt);
  const path = join(uploadsDir(), picture.file);
  if (!existsSync(path)) copyFileSync(source, path);
  return picture;
}
