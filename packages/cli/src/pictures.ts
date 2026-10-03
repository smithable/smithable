// Pictures for a drafted app from the Smithable image library (docs.smithable.ai/images): the
// index is fetched and cached for a day, the chosen files are written into the project, and the
// landing page's hero gets its picture. Offline or refused, the app starts without pictures.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { type PictureEntry, pickPictures } from "@smithable/ai";
import { type SpecIR, YamlEditor } from "@smithable/core";
import type { Io } from "./io.js";

const LIBRARY = "https://docs.smithable.ai/images";
/**
 * Where the library is: SMITHABLE_IMAGE_LIBRARY, else docs.smithable.ai/images. A hosted
 * workspace has no internet, so the service serves the library to it at its own address.
 */
export const libraryBase = () =>
  (process.env.SMITHABLE_IMAGE_LIBRARY || LIBRARY).replace(/\/$/, "");
/** A picture's address in the index, at the library's place (the index names docs.smithable.ai). */
export const atLibrary = (url: string) =>
  url.startsWith(`${LIBRARY}/`) ? `${libraryBase()}${url.slice(LIBRARY.length)}` : url;
const DAY = 24 * 60 * 60 * 1000;
const MAX_PICTURE = 2 * 1024 * 1024;
const TIMEOUT = 15_000;

export type Fetch = typeof fetch;

/** Where the index is cached: $XDG_CACHE_HOME/smithable/images, else ~/.cache/smithable/images. */
export const cacheDir = (): string =>
  join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "smithable", "images");

/** The library's index, from the day's cache or fetched; undefined when neither works. */
export async function libraryIndex(
  fetchFn: Fetch = fetch,
  dir = cacheDir(),
): Promise<PictureEntry[] | undefined> {
  const file = join(dir, "index.json");
  try {
    if (existsSync(file) && Date.now() - statSync(file).mtimeMs < DAY)
      return JSON.parse(readFileSync(file, "utf8")) as PictureEntry[];
  } catch {
    // A broken cache is fetched again.
  }
  try {
    const response = await fetchFn(`${libraryBase()}/index.json`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!response.ok) return undefined;
    const text = await response.text();
    const index = JSON.parse(text) as PictureEntry[];
    if (!Array.isArray(index)) return undefined;
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, text);
    return index;
  } catch {
    return undefined;
  }
}

async function bytesOf(url: string, fetchFn: Fetch): Promise<Uint8Array | undefined> {
  try {
    const response = await fetchFn(atLibrary(url), { signal: AbortSignal.timeout(TIMEOUT) });
    if (!response.ok) return undefined;
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_PICTURE) return undefined;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength > MAX_PICTURE ? undefined : bytes;
  } catch {
    return undefined;
  }
}

/**
 * The pictures a drafted app gets: the hero into public/images/hero.webp (and the content file's
 * hero image, when the landing page's hero has none), samples into public/images/samples/<n>.webp.
 * Returns what was written; says one line either way.
 */
export async function addLibraryPictures(options: {
  description: string;
  ir: SpecIR;
  files: Record<string, string>;
  io: Io;
  fetchFn?: Fetch;
  index?: PictureEntry[];
  cacheDir?: string;
}): Promise<{ file: string; alt: string; bytes: Uint8Array }[]> {
  const fetchFn = options.fetchFn ?? fetch;
  const index = options.index ?? (await libraryIndex(fetchFn, options.cacheDir));
  if (!index) {
    options.io.out("No pictures: the Smithable image library could not be reached.\n");
    return [];
  }
  const picked = pickPictures(index, { description: options.description, ir: options.ir });
  const written: { file: string; alt: string; bytes: Uint8Array }[] = [];
  let n = 0;
  for (const sample of picked.samples) {
    const bytes = await bytesOf(sample.url, fetchFn);
    if (!bytes) continue;
    n += 1;
    written.push({ file: `samples/${n}.webp`, alt: sample.alt, bytes });
  }
  const landing = options.ir.pages.find((p) => p.pattern.kind === "landing");
  const hero =
    landing?.pattern.kind === "landing"
      ? landing.pattern.sections.find((s) => s.kind === "hero")
      : undefined;
  if (picked.hero && landing && hero) {
    const bytes = await bytesOf(picked.hero.url, fetchFn);
    if (bytes) {
      written.push({ file: "hero.webp", alt: picked.hero.alt, bytes });
      const editor = new YamlEditor(
        options.files["smithable.content.yml"] ?? "smithableContent: 0.1\n",
      );
      // A landing section's texts are under the page by the section's name (pages.home.hero).
      const at = ["pages", landing.id, hero.name];
      if (!editor.has([...at, "image"])) {
        const image = { src: "images/hero.webp", alt: picked.hero.alt };
        if (editor.has(at)) editor.add(at, "image", image);
        else if (editor.has(["pages", landing.id]))
          editor.add(["pages", landing.id], hero.name, { image });
        else if (editor.has(["pages"]))
          editor.add(["pages"], landing.id, { [hero.name]: { image } });
        else editor.add([], "pages", { [landing.id]: { [hero.name]: { image } } });
        options.files["smithable.content.yml"] = editor.text;
      }
    }
  }
  options.io.out(
    written.length
      ? `Pictures from the Smithable image library: ${written.map((w) => w.file).join(", ")}.\n`
      : "No pictures: none of the library's files could be fetched.\n",
  );
  return written;
}

/** Writes the pictures under the project's public/images/. */
export function writePictures(dir: string, pictures: { file: string; bytes: Uint8Array }[]): void {
  for (const picture of pictures) {
    const path = join(dir, "public", "images", picture.file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, picture.bytes);
  }
}

/**
 * Pictures the content file names that the project does not have are taken out: a drafted
 * app's texts may name images/hero.webp (as its starter's do) when no picture was written,
 * and a reference to a missing file shows a broken picture.
 */
export function dropMissingPictures(dir: string, io: Io): void {
  const file = join(dir, "smithable.content.yml");
  if (!existsSync(file)) return;
  const editor = new YamlEditor(readFileSync(file, "utf8"));
  const missing: string[][] = [];
  const walk = (value: unknown, path: string[]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const [key, v] of Object.entries(value)) {
      const src =
        key === "image" ? (typeof v === "string" ? v : (v as { src?: unknown })?.src) : undefined;
      if (typeof src === "string" && !/^https?:/.test(src) && !existsSync(join(dir, "public", src)))
        missing.push([...path, key]);
      else walk(v, [...path, key]);
    }
  };
  walk(editor.get([]), []);
  // A mapping left empty (a hero with only its picture) goes too: an empty key is not valid.
  for (const path of missing) editor.removeAndPrune(path, 0);
  if (!missing.length) return;
  writeFileSync(file, editor.text);
  io.out(
    `Left out ${missing.length === 1 ? "a picture" : `${missing.length} pictures`} the texts named but the app does not have.\n`,
  );
}
