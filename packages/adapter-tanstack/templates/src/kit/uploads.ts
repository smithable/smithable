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
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { dataDir, ownDataDir } from "./visitor";
import { w } from "./words";

/** What a picture field stores: the file under uploads/, its description, and its size. */
export interface Picture {
  file: string;
  alt: string;
  width: number;
  height: number;
  /** Made by an AI: the image library's sample pictures; a person's own only when they say so. */
  generated?: true;
}

export const PICTURE_MAX_BYTES = 1_000_000;
/** The longest side a browser scales a picture to before sending it. */
export const PICTURE_MAX_SIDE = 1600;

/** Where files are written: the app's uploads, or in a demo the visitor's own (src/kit/visitor.ts). */
const uploadsDir = () => join(ownDataDir(), "uploads");
/** Where a stored file is: the visitor's own in a demo, else the app's (the seed's pictures). */
const storedPath = (file: string) => {
  const own = join(uploadsDir(), file);
  return existsSync(own) ? own : join(dataDir, "uploads", file);
};

/** A stored picture's and document's name under uploads/: nothing that leads out of it. */
const PICTURE_FILE = /^[a-z0-9-]+\/[a-f0-9]{24}\.webp$/;
const STORED_FILE = /^[a-z0-9-]+\/[a-f0-9]{24}\.[a-z0-9]{2,4}$/;

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

/**
 * Stores a picture sent by a browser under `model/`, and returns what the record keeps of it. The
 * browser scales a picture to PICTURE_MAX_SIDE before sending; the server holds what is sent to the
 * same on either side (a small file can still decode to a huge image). The app's own
 * sample pictures (`ours`) are not sent by anyone.
 */
export function savePicture(model: string, bytes: Uint8Array, alt: string, ours = false): Picture {
  if (bytes.length > PICTURE_MAX_BYTES) throw new BadPicture(w.pictureTooLarge);
  const size = webpSize(bytes);
  if (!size || size.width < 1 || size.height < 1) throw new BadPicture(w.pictureKinds);
  if (!ours && (size.width > PICTURE_MAX_SIDE || size.height > PICTURE_MAX_SIDE))
    throw new BadPicture(w.pictureTooWide(PICTURE_MAX_SIDE));
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 24);
  const file = `${model}/${hash}.webp`;
  mkdirSync(join(uploadsDir(), model), { recursive: true });
  const path = join(uploadsDir(), file);
  if (!existsSync(path)) writeFileSync(path, bytes);
  return { file, alt, ...size };
}

/** The file of a stored picture, or undefined when it is gone. */
export function readPicture(picture: Picture): Buffer | undefined {
  if (!PICTURE_FILE.test(picture.file)) return undefined;
  const path = storedPath(picture.file);
  return existsSync(path) ? readFileSync(path) : undefined;
}

/** Removes a picture's file, unless `stillUsed` says another record keeps it. */
export function deletePicture(picture: Picture | null | undefined, stillUsed: boolean): void {
  // Only a file of the app's (or the visitor's) own: a demo never deletes the seed's.
  if (!picture || stillUsed || !PICTURE_FILE.test(picture.file)) return;
  if (!existsSync(join(uploadsDir(), picture.file))) return;
  unlinkSync(join(uploadsDir(), picture.file));
}

/** The ETag of a stored picture: its file name carries the content's hash. */
export const pictureTag = (picture: Picture) => `"${picture.file.slice(-29, -5)}"`;

/**
 * What the image library said of each picture Smithable placed (public/images/pictures.json):
 * whether an image model made it. Absent in an app from before photographs.
 */
let placed: Record<string, { generated?: boolean }> | undefined;
function placedPictures(): Record<string, { generated?: boolean }> {
  // Read once a seed: every sample picture asks.
  if (!placed)
    try {
      placed = JSON.parse(readFileSync(join("public", "images", "pictures.json"), "utf8"));
    } catch {
      placed = {};
    }
  return placed ?? {};
}

/**
 * For `pnpm db:seed`: the n-th sample picture (public/images/samples/<n>.webp) as a record's
 * picture, copied into uploads/; null when the app has no sample pictures. A numbered one is
 * badged as public/images/pictures.json says (a photograph is not), and without that list as the
 * image library's were (an AI made them); a sample file says so of its own with `generated: true`.
 */
export function samplePicture(
  model: string,
  n: number | string,
  alt: string,
  generated?: boolean,
): Picture | null {
  // A starter's numbered pictures (0.webp, 1.webp, …), or a sample file's own by name.
  const name = typeof n === "number" ? `${n}.webp` : n;
  generated ??= placedPictures()[`samples/${name}`]?.generated ?? typeof n === "number";
  const source = join("public", "images", "samples", name);
  if (!existsSync(source)) return null;
  const bytes = readFileSync(source);
  const picture = savePicture(model, bytes, alt, true);
  const path = join(uploadsDir(), picture.file);
  if (!existsSync(path)) copyFileSync(source, path);
  return generated ? { ...picture, generated: true } : picture;
}

/** What a document field stores: the file under uploads/, the name it was sent with, its kind and size. */
export interface StoredFile {
  file: string;
  name: string;
  type: string;
  size: number;
}

export const FILE_MAX_BYTES = 10_000_000;

/** Refused documents say why in words the form shows. */
export class BadFile extends Error {}

const OOXML = "application/vnd.openxmlformats-officedocument.";
const ODF = "application/vnd.oasis.opendocument.";
/** The kinds a document may be, by extension: what the file must start with, and its type. */
const KINDS: Record<string, { type: string; is: (bytes: Uint8Array, text: string) => boolean }> = {
  pdf: { type: "application/pdf", is: (_, t) => t.startsWith("%PDF-") },
  docx: { type: `${OOXML}wordprocessingml.document`, is: (b, t) => office(b, t) },
  xlsx: { type: `${OOXML}spreadsheetml.sheet`, is: (b, t) => office(b, t) },
  pptx: { type: `${OOXML}presentationml.presentation`, is: (b, t) => office(b, t) },
  odt: { type: `${ODF}text`, is: (b, t) => openDocument(b, t, `${ODF}text`) },
  ods: { type: `${ODF}spreadsheet`, is: (b, t) => openDocument(b, t, `${ODF}spreadsheet`) },
  odp: { type: `${ODF}presentation`, is: (b, t) => openDocument(b, t, `${ODF}presentation`) },
  txt: { type: "text/plain; charset=utf-8", is: (b) => plainText(b) },
  csv: { type: "text/csv; charset=utf-8", is: (b) => plainText(b) },
  png: { type: "image/png", is: (_, t) => t.startsWith("\x89PNG\r\n\x1a\n") },
  jpg: { type: "image/jpeg", is: (_, t) => t.startsWith("\xff\xd8\xff") },
  gif: { type: "image/gif", is: (_, t) => t.startsWith("GIF8") },
  webp: { type: "image/webp", is: (b) => webpSize(b) !== undefined },
};

const u16 = (b: Uint8Array, at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8);
const u32 = (b: Uint8Array, at: number) => (u16(b, at) | (u16(b, at + 2) << 16)) >>> 0;

/**
 * A ZIP archive's entry names, from its central directory at the end (which every entry is in,
 * whatever its local header says); none when it is no archive.
 */
function zipEntries(bytes: Uint8Array, text: string): string[] {
  if (!text.startsWith("PK\x03\x04")) return [];
  // The end record: 22 bytes, after it at most a 64 KB comment.
  const end = text.lastIndexOf("PK\x05\x06", bytes.length - 22);
  if (end < 0 || end < bytes.length - 22 - 65_535) return [];
  const names: string[] = [];
  let at = u32(bytes, end + 16);
  for (let i = u16(bytes, end + 10); i > 0 && at < end && text.startsWith("PK\x01\x02", at); i--) {
    const name = u16(bytes, at + 28);
    names.push(text.slice(at + 46, at + 46 + name));
    at += 46 + name + u16(bytes, at + 30) + u16(bytes, at + 32);
  }
  return names;
}

/** An Office file: an archive with the [Content_Types].xml entry the format requires. */
const office = (bytes: Uint8Array, text: string) =>
  zipEntries(bytes, text).includes("[Content_Types].xml");

/** An OpenDocument file: its first entry is "mimetype", stored, holding the document's type. */
function openDocument(bytes: Uint8Array, text: string, type: string): boolean {
  if (!text.startsWith("PK\x03\x04") || text.slice(30, 38) !== "mimetype") return false;
  if (u16(bytes, 26) !== 8 || u16(bytes, 8) !== 0) return false;
  const start = 30 + 8 + u16(bytes, 28);
  return text.slice(start, start + type.length) === type && zipEntries(bytes, text).length > 0;
}

/** Text a person can read: UTF-8 without the NUL bytes of a binary file. */
function plainText(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/** A document's kind: its name's extension, if its own first bytes are that kind. */
export function fileKind(
  bytes: Uint8Array,
  name: string,
): { ext: string; type: string } | undefined {
  const raw = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const ext = raw === "jpeg" ? "jpg" : raw;
  const kind = ext ? KINDS[ext] : undefined;
  const text = Buffer.from(bytes).toString("latin1");
  return ext && kind?.is(bytes, text) ? { ext, type: kind.type } : undefined;
}

/** All stored pictures and documents together, in bytes: counted at most once a minute. */
const counted = new Map<string, { bytes: number; at: number }>();
function storedBytes(): number {
  const kept = counted.get(uploadsDir());
  if (kept && Date.now() - kept.at < 60_000) return kept.bytes;
  let bytes = 0;
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true }))
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else bytes += statSync(join(dir, entry.name)).size;
  };
  walk(uploadsDir());
  counted.set(uploadsDir(), { bytes, at: Date.now() });
  return bytes;
}

/**
 * Whether `bytes` more fit the app's storage: UPLOADS_MAX_BYTES, when set (the hosted service sets
 * it by plan), is the most all stored files together may take; unset, there is no limit. Counted
 * before anything is stored, and held for the upload, so two at once cannot both take the last
 * room; an upload refused or failed gives it back (release).
 */
export function roomFor(bytes: number): boolean {
  const max = Number(process.env.UPLOADS_MAX_BYTES ?? "");
  if (!max) return true;
  if (storedBytes() + bytes > max) return false;
  const kept = counted.get(uploadsDir());
  if (kept) kept.bytes += bytes;
  return true;
}

/** Gives back what roomFor held for an upload that was refused or failed. */
export function release(bytes: number): void {
  const kept = counted.get(uploadsDir());
  if (kept) kept.bytes = Math.max(0, kept.bytes - bytes);
}

/** Stores a document sent by a browser under `model/`, and returns what the record keeps of it. */
export function saveFile(model: string, bytes: Uint8Array, name: string): StoredFile {
  if (bytes.length > FILE_MAX_BYTES) throw new BadFile(w.fileTooLarge);
  const kind = fileKind(bytes, name);
  if (!kind || bytes.length === 0) throw new BadFile(w.fileKinds);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 24);
  const file = `${model}/${hash}.${kind.ext}`;
  mkdirSync(join(uploadsDir(), model), { recursive: true });
  const path = join(uploadsDir(), file);
  if (!existsSync(path)) writeFileSync(path, bytes);
  // The name as the person knew it, without a path, at most 200 characters.
  const shown = (name.split(/[\\/]/).at(-1) ?? "").slice(-200) || `document.${kind.ext}`;
  return { file, name: shown, type: kind.type, size: bytes.length };
}

/**
 * The virus check (docs/design/file-review.md §5): with SCAN_URL set, a file's bytes are sent
 * there before anything is stored, and any answer but OK refuses it, as does no answer at all
 * (a check that cannot run lets nothing through). Without SCAN_URL nothing is scanned.
 */
export async function scanned(bytes: Uint8Array): Promise<void> {
  const url = process.env.SCAN_URL;
  if (!url) return;
  const answer = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: new Uint8Array(bytes),
    // A check that never answers refuses the file after half a minute, not never.
    signal: AbortSignal.timeout(30_000),
  }).catch(() => undefined);
  if (!answer?.ok) throw new BadFile(w.virusRefused);
}

/** The bytes of a stored document, or undefined when it is gone. */
export function readFile(stored: StoredFile): Buffer | undefined {
  if (!STORED_FILE.test(stored.file)) return undefined;
  const path = storedPath(stored.file);
  return existsSync(path) ? readFileSync(path) : undefined;
}

/** Removes a document's file, unless `stillUsed` says another record keeps it. */
export function deleteFile(stored: StoredFile | null | undefined, stillUsed: boolean): void {
  if (!stored || stillUsed || !STORED_FILE.test(stored.file)) return;
  if (!existsSync(join(uploadsDir(), stored.file))) return;
  unlinkSync(join(uploadsDir(), stored.file));
}

/** The ETag of a stored document: its file name carries the content's hash. */
export const fileTag = (stored: StoredFile) => `"${stored.file.split("/")[1]?.split(".")[0]}"`;

/**
 * The type a stored document is sent with: its extension's, which saveFile checked against its
 * first bytes. The type a record keeps is only shown: it came with the record from a browser.
 */
export function fileType(stored: StoredFile): string {
  return KINDS[stored.file.split(".").at(-1) ?? ""]?.type ?? "application/octet-stream";
}

/**
 * The headers a document is sent with: its own type, never sniffed, and as a download, except a
 * PDF or a picture, which the browser shows itself; sandboxed, so nothing in it can run here.
 */
export function fileHeaders(stored: StoredFile): Record<string, string> {
  const type = fileType(stored);
  const shown = type === "application/pdf" || type.startsWith("image/");
  return {
    "Content-Type": type,
    "Content-Disposition": `${shown ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(stored.name)}`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox",
  };
}

/**
 * A record's stored picture or document as the file routes send it, or "Not found": cached by
 * browsers for a day when anyone may read the model (the address changes with the content),
 * privately otherwise.
 */
export function uploadResponse(
  request: Request,
  kind: "picture" | "file",
  stored: unknown,
  everyone: boolean,
): Response {
  const found = stored as (Picture & StoredFile) | null | undefined;
  const bytes = found && (kind === "picture" ? readPicture(found) : readFile(found));
  if (!found || !bytes) return new Response("Not found", { status: 404 });
  const tag = kind === "picture" ? pictureTag(found) : fileTag(found);
  const headers = {
    ...(kind === "picture"
      ? { "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff" }
      : fileHeaders(found)),
    "Cache-Control": everyone ? "public, max-age=86400" : "private, max-age=3600",
    ETag: tag,
  };
  if (request.headers.get("if-none-match") === tag)
    return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(bytes), { headers });
}
