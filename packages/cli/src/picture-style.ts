// An app's library pictures in an image style (docs/design/first-look.md §4.2–4.3): the host's
// side of setPictureStyle's place-pictures effect. One library version is resolved into the
// files to write, each fetched and checked against its hash, and only when every one is there
// are they written, with public/images/pictures.json (the record of what was placed), the
// credits and the hero's words. Files the owner changed, and files with no record, are theirs and
// stay. Core fetches nothing; generation never fetches.
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { PictureCredit, PictureEntry } from "@smithable/ai";
import { YamlEditor } from "@smithable/core";
import { databasePath } from "./database.js";
import { atLibrary, type Fetch, libraryBase } from "./pictures.js";

const TIMEOUT = 20_000;
const MAX_PICTURE = 2_000_000;

/** A style in the library's index: its id, whether an image model makes it, its words. */
export interface LibraryStyle {
  id: string;
  generated: boolean;
  words: Record<string, { name: string; line: string }>;
}

/** An entry of a library version: today's fields, its style and subject, and its file's hash. */
export interface VersionEntry extends PictureEntry {
  style?: string;
  subject?: string;
  sha256: string;
}

/** One published version of the library's index; it never changes once published. */
export interface LibraryVersion {
  version: string;
  styles: LibraryStyle[];
  entries: VersionEntry[];
}

export type PictureRole = "hero" | "sample" | "logo";

/** What public/images/pictures.json says of a placed file (keyed by its path under images/). */
export interface PictureRecord {
  /** Made by an image model; the kit's badge reads it. */
  generated: boolean;
  version?: string;
  entry?: string;
  style?: string;
  sha256?: string;
  role?: PictureRole;
  credit?: PictureCredit;
}

export type PictureRecords = Record<string, PictureRecord>;

export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

const imagesDir = (dir: string) => join(dir, "public", "images");

/** A placed file's role, from where it lies: the hero, the mark, or a sample picture. */
export const roleOf = (file: string): PictureRole | undefined =>
  file === "hero.webp"
    ? "hero"
    : file === "logo.webp"
      ? "logo"
      : /^samples\/[^/]+\.webp$/.test(file)
        ? "sample"
        : undefined;

export function readRecords(dir: string): PictureRecords {
  // Never through a link: the record is read only from a plain file in plain folders.
  if (linkedRecordPath(dir)) return {};
  try {
    const said = JSON.parse(readFileSync(join(imagesDir(dir), "pictures.json"), "utf8"));
    return said && typeof said === "object" && !Array.isArray(said) ? said : {};
  } catch {
    return {};
  }
}

export const recordsText = (records: PictureRecords) =>
  `${JSON.stringify(
    Object.fromEntries(Object.entries(records).sort(([a], [b]) => a.localeCompare(b))),
    null,
    2,
  )}\n`;

/** A plain file or folder, not a link: a link may lead out of the project, so it is never followed. */
const plain = (path: string, kind: "file" | "dir") => {
  try {
    const s = lstatSync(path);
    return kind === "file" ? s.isFile() : s.isDirectory();
  } catch {
    return false;
  }
};

/**
 * The first of public/, public/images/, pictures.json and CREDITS.md that is there but not a plain
 * folder or file (a link, above all); undefined when each is plain or absent. Placing refuses then:
 * writing the record would go through the link, outside the project.
 */
export function linkedRecordPath(dir: string): string | undefined {
  const there = (path: string) => lstatSync(path, { throwIfNoEntry: false });
  for (const [path, kind] of [
    ["public", "dir"],
    ["public/images", "dir"],
    ["public/images/pictures.json", "file"],
    ["public/images/CREDITS.md", "file"],
  ] as const) {
    const s = there(join(dir, path));
    if (s && !(kind === "dir" ? s.isDirectory() : s.isFile())) return path;
  }
  return undefined;
}

/**
 * The files under public/images/ a library picture may lie at: the hero, the mark, samples.
 * Only plain files in plain folders: a link is the owner's business and is never written through.
 */
function placedFiles(dir: string): string[] {
  const images = imagesDir(dir);
  if (!plain(join(dir, "public"), "dir") || !plain(images, "dir")) return [];
  const files = ["hero.webp", "logo.webp"].filter((f) => plain(join(images, f), "file"));
  const samples = join(images, "samples");
  if (plain(samples, "dir"))
    for (const name of readdirSync(samples).sort())
      if (/^[\w.-]+\.webp$/.test(name) && plain(join(samples, name), "file"))
        files.push(`samples/${name}`);
  return files;
}

/** The hash of each placed file as it is now, to see that nothing changed before writing. */
export const currentHashes = (dir: string): Record<string, string> =>
  Object.fromEntries(
    placedFiles(dir).map((f) => [f, sha256(readFileSync(join(imagesDir(dir), f)))]),
  );

const recordOf = (version: LibraryVersion, entry: VersionEntry, role: PictureRole) => ({
  generated: entry.generated ?? true,
  version: version.version,
  entry: entry.id,
  ...(entry.style ? { style: entry.style } : {}),
  sha256: entry.sha256,
  role,
  ...(entry.credit ? { credit: entry.credit } : {}),
});

/**
 * The record with every placed file the library knows, once, for apps made before it: a file
 * whose bytes match an entry's hash in this version gets that entry's record; a file that matches
 * none is the owner's and gets none. By hash only, never by name. An app whose record already
 * names hashes keeps it as it is, so a picture the owner adds later is never adopted.
 */
export function rebuildRecords(
  dir: string,
  version: LibraryVersion,
  /** At creation every file is Smithable's, so each the library knows is recorded. */
  creating = false,
): PictureRecords {
  const records = readRecords(dir);
  if (!creating && Object.values(records).some((r) => r?.sha256)) return records;
  // The first entry with a hash wins: the index lists what apps got first before later styles.
  const byHash = new Map<string, VersionEntry>();
  for (const e of version.entries) if (!byHash.has(e.sha256)) byHash.set(e.sha256, e);
  for (const file of placedFiles(dir)) {
    if (records[file]?.sha256) continue;
    const role = roleOf(file);
    const entry = byHash.get(sha256(readFileSync(join(imagesDir(dir), file))));
    if (role && entry && entry.kind === role) records[file] = recordOf(version, entry, role);
  }
  return records;
}

/** The pictures a style would write, and what stays. */
export interface StylePlan {
  /** Files to write, with their records; empty when the app already has the style. */
  writes: { file: string; entry: VersionEntry; record: PictureRecord }[];
  /** The owner's: changed since placed, or placed without the library. They stay. */
  kept: string[];
  /** Library pictures this style has no picture for, by file; a style with any is not offered. */
  missing: string[];
}

/**
 * Which file becomes which entry of the style: each placed library picture (hero, samples; never
 * the mark) whose bytes still match its record, by its entry's subject. A picture the owner
 * changed, and one with no record, stays.
 */
export function planStyle(dir: string, version: LibraryVersion, style: string): StylePlan {
  const records = rebuildRecords(dir, version);
  const byId = new Map(version.entries.map((e) => [e.id, e]));
  const plan: StylePlan = { writes: [], kept: [], missing: [] };
  for (const file of placedFiles(dir)) {
    const role = roleOf(file);
    if (role === "logo") continue;
    const record = records[file];
    const bytes = readFileSync(join(imagesDir(dir), file));
    if (!record?.sha256 || !record.entry || sha256(bytes) !== record.sha256) {
      plan.kept.push(file);
      continue;
    }
    const subject = byId.get(record.entry)?.subject;
    const entry =
      subject &&
      version.entries.find((e) => e.subject === subject && e.style === style && e.kind === role);
    if (!entry) {
      plan.missing.push(file);
      continue;
    }
    if (entry.sha256 === record.sha256) continue;
    plan.writes.push({ file, entry, record: recordOf(version, entry, role ?? "sample") });
  }
  return plan;
}

/** The styles an app can have: those with a picture for every library picture it holds. */
export function offeredStyles(dir: string, version: LibraryVersion): LibraryStyle[] {
  return version.styles.filter((s) => planStyle(dir, version, s.id).missing.length === 0);
}

async function fetchChecked(entry: VersionEntry, fetchFn: Fetch): Promise<Uint8Array | string> {
  try {
    const response = await fetchFn(atLibrary(entry.url), { signal: AbortSignal.timeout(TIMEOUT) });
    if (!response.ok) return `${entry.id} could not be fetched (${response.status})`;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_PICTURE) return `${entry.id} is larger than the library allows`;
    return sha256(bytes) === entry.sha256
      ? bytes
      : `${entry.id} does not match the library's hash for it`;
  } catch {
    return `${entry.id} could not be fetched`;
  }
}

/** A library version's name, as latest.json says it: no path, no "..". */
const VERSION_NAME = /^[\w-]+(\.[\w-]+)*$/;

/**
 * The library's current version: latest.json says it ({ version, index }), and
 * versions/<version>.json holds it. The index path is never followed as given, only checked.
 */
export async function libraryVersion(fetchFn: Fetch): Promise<LibraryVersion | string> {
  const get = async (path: string) => {
    const response = await fetchFn(`${libraryBase()}/${path}`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  };
  try {
    const pointer = ((await get("latest.json")) ?? {}) as { version?: unknown; index?: unknown };
    const latest = pointer.version;
    if (typeof latest !== "string" || !VERSION_NAME.test(latest))
      return "the image library's index has no versions yet";
    if (pointer.index !== undefined && pointer.index !== `versions/${latest}.json`)
      return "the image library's latest.json names an index that is not its version's";
    const version = (await get(`versions/${latest}.json`)) as LibraryVersion;
    if (version?.version !== latest) return "the image library's index could not be read";
    if (!Array.isArray(version?.entries) || !Array.isArray(version.styles))
      return "the image library's index could not be read";
    return version;
  } catch {
    return "the image library could not be reached";
  }
}

/** What placing a style writes, every file fetched and checked; or why nothing is. */
export interface PlacedStyle {
  files: { path: string; bytes: Uint8Array }[];
  /** Each placed file's hash when it was planned; the host writes only if they are unchanged. */
  planned: Record<string, string>;
  /** public/images/pictures.json, CREDITS.md and smithable.content.yml, as text. */
  texts: { path: string; text: string }[];
  kept: string[];
  /** Each sample picture replaced: its old bytes and new, for the records seeded with it. */
  swaps: { from: Uint8Array; to: Uint8Array; generated: boolean }[];
}

/**
 * The files for a style, each fetched and checked against its hash; a refusal (a message) when
 * the style is not in the library, misses a picture the app holds, or any file fails. Nothing is
 * written here: the operation writes them before its one commit.
 */
export async function placeStyle(
  dir: string,
  style: string,
  fetchFn: Fetch,
  given?: LibraryVersion,
): Promise<PlacedStyle | string> {
  const version = given ?? (await libraryVersion(fetchFn));
  if (typeof version === "string") return `No pictures were changed: ${version}.`;
  if (!version.styles.some((s) => s.id === style))
    return `The image library has no style "${style}"; it has ${version.styles.map((s) => s.id).join(", ")}.`;
  const linked = linkedRecordPath(dir);
  if (linked)
    return `No pictures were changed: ${linked} is a link or not a plain ${/\.\w+$/.test(linked) ? "file" : "folder"}, so the record would be written outside the project.`;
  const planned = currentHashes(dir);
  const plan = planStyle(dir, version, style);
  if (plan.missing.length)
    return `The ${style} style has no picture for ${plan.missing.join(", ")}, so it is not offered for this app.`;
  const files: PlacedStyle["files"] = [];
  const swaps: PlacedStyle["swaps"] = [];
  const failed: string[] = [];
  for (const write of plan.writes) {
    const bytes = await fetchChecked(write.entry, fetchFn);
    if (typeof bytes === "string") failed.push(bytes);
    else {
      files.push({ path: `public/images/${write.file}`, bytes });
      const old = join(dir, "public", "images", write.file);
      if (roleOf(write.file) === "sample" && existsSync(old))
        swaps.push({ from: readFileSync(old), to: bytes, generated: !!write.record.generated });
    }
  }
  if (failed.length) return `No pictures were changed: ${failed.join("; ")}.`;
  const records = rebuildRecords(dir, version);
  for (const write of plan.writes) records[write.file] = write.record;
  // A picture the owner changed or removed is no longer what its record says: the record goes,
  // so it gets no library credit or mark and is never taken for a library picture again.
  // A record from before hashes ({ generated } alone) stays as it is: the kit reads its mark.
  const present = new Set(placedFiles(dir));
  for (const [file, record] of Object.entries(records))
    if ((record?.sha256 && plan.kept.includes(file)) || (roleOf(file) && !present.has(file)))
      delete records[file];
  // An app with no library pictures and no record gets neither file, nor loses its own CREDITS.md.
  const texts: PlacedStyle["texts"] = [];
  if (plan.writes.length || Object.keys(readRecords(dir)).length) {
    texts.push({ path: "public/images/pictures.json", text: recordsText(records) });
    texts.push({ path: "public/images/CREDITS.md", text: creditsText(records) });
  }
  const hero = plan.writes.find((w) => w.file === "hero.webp");
  const content = hero && heroWords(dir, hero.entry);
  if (content) texts.push({ path: "smithable.content.yml", text: content });
  return { files, texts, kept: plan.kept, planned, swaps };
}

/** The width and height of a WebP file, from its header (as the app kit's uploads.ts reads it). */
function webpSize(bytes: Uint8Array): { width: number; height: number } | undefined {
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

const plainFile = (path: string) => {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
};

/**
 * The project's development data follows a style change (look-picker design §4.4): a record whose
 * stored picture is the seeded copy of a sample the change replaced (its name is the old sample's
 * hash and its bytes are the old sample's) gets the new sample, stored beside the old one so undo,
 * which restores the database, finds every file it names. Anything else stays: an uploaded
 * picture, one replaced by hand. Runs inside the operation's database snapshot; returns how many
 * records changed. A deployed app's data is never reached from here.
 */
export function reseedPictures(dir: string, swaps: PlacedStyle["swaps"]): number {
  const path = databasePath(dir);
  if (!swaps.length || !existsSync(path)) return 0;
  const short = (bytes: Uint8Array) => sha256(bytes).slice(0, 24);
  const byOld = new Map(swaps.map((s) => [short(s.from), s]));
  const uploads = join(dir, "data", "uploads");
  const q = (name: unknown) => `"${String(name).replaceAll('"', '""')}"`;
  /** One stored picture, swapped when it is a seeded copy; undefined when it stays. */
  const swapped = (picture: unknown): Record<string, unknown> | undefined => {
    if (!picture || typeof picture !== "object") return undefined;
    const p = picture as Record<string, unknown>;
    const m = typeof p.file === "string" && p.file.match(/^([a-z0-9-]+)\/([a-f0-9]{24})\.webp$/);
    const swap = m && byOld.get(m[2] as string);
    if (!m || !swap) return undefined;
    const folder = join(uploads, m[1] as string);
    const stored = join(folder, `${m[2]}.webp`);
    if (!lstatSync(folder, { throwIfNoEntry: false })?.isDirectory() || !plainFile(stored))
      return undefined;
    if (!Buffer.from(swap.from).equals(readFileSync(stored))) return undefined;
    const file = `${m[1]}/${short(swap.to)}.webp`;
    if (!plainFile(join(uploads, file))) writeFileSync(join(uploads, file), swap.to);
    const { generated: _, ...rest } = p;
    return { ...rest, file, ...webpSize(swap.to), ...(swap.generated ? { generated: true } : {}) };
  };
  mkdirSync(uploads, { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000 });
  let changed = 0;
  try {
    db.exec("BEGIN IMMEDIATE");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all();
    for (const { name: table } of tables)
      for (const { name: column } of db.prepare(`PRAGMA table_info(${q(table)})`).all()) {
        const rows = db
          .prepare(
            `SELECT rowid AS id, ${q(column)} AS value FROM ${q(table)} WHERE typeof(${q(column)}) = 'text' AND ${q(column)} LIKE '%.webp%'`,
          )
          .all();
        for (const row of rows) {
          let value: unknown;
          try {
            value = JSON.parse(String(row.value));
          } catch {
            continue;
          }
          let next: unknown;
          if (Array.isArray(value)) {
            const items = value.map((v) => swapped(v) ?? v);
            if (items.some((v, i) => v !== value[i])) next = items;
          } else next = swapped(value);
          if (next === undefined) continue;
          db.prepare(`UPDATE ${q(table)} SET ${q(column)} = ? WHERE rowid = ?`).run(
            JSON.stringify(next),
            row.id as number,
          );
          changed++;
        }
      }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
  return changed;
}

/** CREDITS.md from the records: a line for each credited photograph; empty when none. */
export function creditsText(records: PictureRecords): string {
  const credited = Object.entries(records).filter(([, r]) => r.credit);
  if (!credited.length) return "";
  return [
    "# Photographs",
    "",
    "The photographs in this folder, from the Smithable image library. Written by Smithable from the library's index.",
    "",
    ...credited.map(([file, { credit: c }]) => {
      const licence = c?.licenceUrl ? `[${c.licence}](${c.licenceUrl})` : c?.licence;
      return `- ${file}: ${c?.author}, ${licence}, from ${c?.page} (fetched ${c?.fetched})`;
    }),
    "",
  ].join("\n");
}

/**
 * The content file with the new hero's words and `generated` (and no `width` or `widths`) wherever an image
 * names images/hero.webp; undefined when nothing names it. Other images are the owner's.
 */
function heroWords(dir: string, entry: VersionEntry): string | undefined {
  const path = join(dir, "smithable.content.yml");
  if (!existsSync(path)) return undefined;
  const editor = new YamlEditor(readFileSync(path, "utf8"));
  const found: string[][] = [];
  const walk = (value: unknown, at: string[]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const [key, v] of Object.entries(value)) {
      if (key === "image" && (v as { src?: unknown })?.src === "images/hero.webp")
        found.push([...at, key]);
      else walk(v, [...at, key]);
    }
  };
  walk(editor.get([]), []);
  if (!found.length) return undefined;
  for (const at of found) {
    editor.set([...at, "alt"], entry.alt);
    editor.set([...at, "generated"], entry.generated ?? true);
    // Its width and copies were the old picture's.
    for (const key of ["width", "widths"])
      if (editor.has([...at, key])) editor.remove([...at, key]);
  }
  return editor.text;
}

/**
 * The content's pictures under public/images/ with their bytes' hash in their address
 * (images/hero.webp?v=…), so a new picture is a new address and the preview shows it without a
 * reload (first-look.md §4.3). By the file as it is, so it is the same on every machine.
 */
export function taggedContent<T>(dir: string, content: T): T {
  const tags = new Map<string, string>();
  const tag = (src: string) => {
    if (!tags.has(src)) {
      const file = join(dir, "public", src);
      tags.set(src, plain(file, "file") ? sha256(readFileSync(file)).slice(0, 16) : "");
    }
    return tags.get(src);
  };
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== "object") return value;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) out[key] = walk(v);
    const src = out.src;
    // Only a plain path under images/ (no "..", no link): generation reads nothing else.
    if (typeof src === "string" && /^images\/(?:[\w-]+\/)*[\w-]+\.[a-z0-9]+$/.test(src)) {
      const t = tag(src);
      if (t) out.src = `${src}?v=${t}`;
    }
    return out;
  };
  return walk(content) as T;
}
