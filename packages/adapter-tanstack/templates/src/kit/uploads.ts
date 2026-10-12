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
  if (bytes.length > PICTURE_MAX_BYTES) throw new BadPicture(w.pictureTooLarge);
  const size = webpSize(bytes);
  if (!size || size.width < 1 || size.height < 1) throw new BadPicture(w.pictureKinds);
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
 * picture, copied into uploads/; null when the app has no sample pictures. The numbered ones are
 * the image library's (an AI made them); a sample file says so of its own with `generated: true`.
 */
export function samplePicture(
  model: string,
  n: number | string,
  alt: string,
  generated = typeof n === "number",
): Picture | null {
  // A starter's numbered pictures (0.webp, 1.webp, …), or a sample file's own by name.
  const source = join("public", "images", "samples", typeof n === "number" ? `${n}.webp` : n);
  if (!existsSync(source)) return null;
  const bytes = readFileSync(source);
  const picture = savePicture(model, bytes, alt);
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
  docx: { type: `${OOXML}wordprocessingml.document`, is: (_, t) => zip(t, "[Content_Types].xml") },
  xlsx: { type: `${OOXML}spreadsheetml.sheet`, is: (_, t) => zip(t, "[Content_Types].xml") },
  pptx: {
    type: `${OOXML}presentationml.presentation`,
    is: (_, t) => zip(t, "[Content_Types].xml"),
  },
  odt: { type: `${ODF}text`, is: (_, t) => zip(t, `${ODF}text`) },
  ods: { type: `${ODF}spreadsheet`, is: (_, t) => zip(t, `${ODF}spreadsheet`) },
  odp: { type: `${ODF}presentation`, is: (_, t) => zip(t, `${ODF}presentation`) },
  txt: { type: "text/plain; charset=utf-8", is: (b) => plainText(b) },
  csv: { type: "text/csv; charset=utf-8", is: (b) => plainText(b) },
  png: { type: "image/png", is: (_, t) => t.startsWith("\x89PNG\r\n\x1a\n") },
  jpg: { type: "image/jpeg", is: (_, t) => t.startsWith("\xff\xd8\xff") },
  gif: { type: "image/gif", is: (_, t) => t.startsWith("GIF8") },
  webp: { type: "image/webp", is: (b) => webpSize(b) !== undefined },
};

/** A ZIP archive (an Office or OpenDocument file) that names `entry` inside it. */
const zip = (text: string, entry: string) => text.startsWith("PK\x03\x04") && text.includes(entry);

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
let counted: { bytes: number; at: number } | undefined;
function storedBytes(): number {
  if (counted && Date.now() - counted.at < 60_000) return counted.bytes;
  let bytes = 0;
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true }))
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else bytes += statSync(join(dir, entry.name)).size;
  };
  walk(uploadsDir());
  counted = { bytes, at: Date.now() };
  return bytes;
}

/**
 * Whether `bytes` more fit the app's storage: UPLOADS_MAX_BYTES, when set (the hosted service sets
 * it by plan), is the most all stored files together may take; unset, there is no limit. Counted
 * before anything is stored.
 */
export function roomFor(bytes: number): boolean {
  const max = Number(process.env.UPLOADS_MAX_BYTES ?? "");
  if (!max) return true;
  if (storedBytes() + bytes > max) return false;
  if (counted) counted.bytes += bytes;
  return true;
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
  }).catch(() => undefined);
  if (!answer?.ok) throw new BadFile(w.virusRefused);
}

/** The bytes of a stored document, or undefined when it is gone. */
export function readFile(stored: StoredFile): Buffer | undefined {
  if (!/^[a-z0-9-]+\/[a-f0-9]{24}\.[a-z0-9]{2,4}$/.test(stored.file)) return undefined;
  const path = join(uploadsDir(), stored.file);
  return existsSync(path) ? readFileSync(path) : undefined;
}

/** Removes a document's file, unless `stillUsed` says another record keeps it. */
export function deleteFile(stored: StoredFile | null | undefined, stillUsed: boolean): void {
  if (!stored || stillUsed || !readFile(stored)) return;
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
