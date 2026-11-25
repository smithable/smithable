// The hosted workspace's cache of its project's stored pictures (docs/design/media-storage.md §4):
// `public/media/<asset>/<variant>`, fetched from the service and never committed. Studio holds
// the source (the service's address and the workspace's token, which the project's user cannot
// read); the files are written as the project's user (as-project.ts), so a link the project put
// in its tree leads nowhere this process could not already write. Locally there is no source and
// nothing is fetched.
import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ASSET_ID, type Diagnostic, mediaInUse } from "@smithable/core";
import { asProject } from "./as-project.js";
import type { Io } from "./io.js";
import { treeText } from "./secrets.js";

/** The rendition names a stored file has (§4 and §7); no other name is fetched or written. */
export const VARIANT = /^(w[1-9][0-9]{1,3}\.webp|(720|1080)\.mp4|poster\.webp)$/;
const HEX64 = /^[0-9a-f]{64}$/;
/** The largest rendition taken: a 2400-wide WebP is far below it, a 1080p film below too. */
const MAX_BYTES = 64 * 1024 * 1024;

/** Where a project's stored files come from: the hosted service, for a running workspace. */
export interface MediaSource {
  /**
   * The record's hash of each rendition, by name; undefined when the service refuses the file
   * (gone, or not this project's). Throws when it cannot answer just now.
   */
  record(asset: string): Promise<Record<string, string> | undefined>;
  /** One rendition's bytes and the hash sent beside them; undefined when refused. */
  fetch(asset: string, variant: string): Promise<{ bytes: Uint8Array; sha256: string } | undefined>;
  /**
   * A stored picture's sizes from its record, for setSectionPicture's rendition (§2): undefined
   * when refused, not a picture, or not processed yet.
   */
  sizes?(asset: string): Promise<{ width: number; widths: number[] } | undefined>;
}

// The content file's own range (100 to 4000 pixels), so a picture placed with them reads back.
const isWidth = (w: unknown): w is number =>
  Number.isInteger(w) && (w as number) >= 100 && (w as number) <= 4000;

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/**
 * The service's source, where the workspace was started with one (SMITHABLE_MEDIA_URL). The token
 * is read from its file at each fetch, so one the service renews is used at once and none is kept
 * in this process's environment.
 */
export function hostedMediaSource(
  env: NodeJS.ProcessEnv = process.env,
  tokenFile = join(homedir(), ".smithable", "media-token"),
): MediaSource | undefined {
  const base = env.SMITHABLE_MEDIA_URL;
  if (!base) return undefined;
  const ask = async (path: string) => {
    const token = readFileSync(tokenFile, "utf8").trim();
    const answer = await fetch(new URL(path, base), {
      headers: { "x-smithable-media-token": token },
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (answer.status === 404) return undefined;
    if (!answer.ok) throw new Error(`The service answered ${answer.status} for ${path}.`);
    return answer;
  };
  return {
    async sizes(asset) {
      if (!ASSET_ID.test(asset)) return undefined;
      const answer = await ask(`/media/${asset}`);
      if (!answer) return undefined;
      const body: unknown = await answer.json().catch(() => undefined);
      if (!body || typeof body !== "object") return undefined;
      const { kind, width, widths } = body as Record<string, unknown>;
      if (kind !== "image" || !isWidth(width)) return undefined;
      const others = Array.isArray(widths) ? widths.filter(isWidth) : [];
      return {
        width,
        widths: [...new Set(others)].filter((w) => w !== width).sort((a, b) => a - b),
      };
    },
    async record(asset) {
      if (!ASSET_ID.test(asset)) return undefined;
      const answer = await ask(`/media/${asset}`);
      if (!answer) return undefined;
      const { variants } = (await answer.json()) as { variants?: unknown };
      if (!variants || typeof variants !== "object") throw new Error(`No record for ${asset}.`);
      return Object.fromEntries(
        Object.entries(variants).filter(
          ([name, hash]) => VARIANT.test(name) && typeof hash === "string" && HEX64.test(hash),
        ),
      ) as Record<string, string>;
    },
    async fetch(asset, variant) {
      if (!ASSET_ID.test(asset) || !VARIANT.test(variant)) return undefined;
      const answer = await ask(`/media/${asset}/${variant}`);
      if (!answer) return undefined;
      const tooLarge = () => new Error(`${asset}/${variant} is larger than a rendition can be.`);
      if (Number(answer.headers.get("content-length") ?? 0) > MAX_BYTES) throw tooLarge();
      // Counted as it comes, so an answer without a length is cut off at the limit.
      const parts: Uint8Array[] = [];
      let size = 0;
      const reader = answer.body?.getReader();
      for (let part = await reader?.read(); part && !part.done; part = await reader?.read()) {
        size += part.value.length;
        if (size > MAX_BYTES) {
          await reader?.cancel();
          throw tooLarge();
        }
        parts.push(part.value);
      }
      const bytes = new Uint8Array(size);
      let at = 0;
      for (const p of parts) {
        bytes.set(p, at);
        at += p.length;
      }
      return { bytes, sha256: answer.headers.get("x-media-sha256") ?? "" };
    },
  };
}

/** A folder of the tree, made when absent; never a link (a link there is the project's own). */
function folder(path: string): void {
  if (!existsSync(path) && !isLink(path)) return void mkdirSync(path);
  if (!lstatSync(path).isDirectory()) throw new Error(`${path} is not a folder.`);
}
const isLink = (path: string) => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};

/** `public/media` when it and `public` are folders of the tree, not links; else none. */
function mediaFolder(dir: string): string | undefined {
  const media = join(dir, "public", "media");
  for (const path of [join(dir, "public"), media])
    if (!existsSync(path) || !lstatSync(path).isDirectory()) return undefined;
  return media;
}

/**
 * The cached renditions, by valid id; a link or a stray name is not counted. With `hashes`, each
 * file's hash (a recheck), else "".
 */
function cachedMediaHere(dir: string, hashes = false): Record<string, Record<string, string>> {
  const media = mediaFolder(dir);
  if (!media) return {};
  const found: Record<string, Record<string, string>> = {};
  for (const asset of readdirSync(media)) {
    if (!ASSET_ID.test(asset) || !lstatSync(join(media, asset)).isDirectory()) continue;
    found[asset] = {};
    for (const name of readdirSync(join(media, asset))) {
      const path = join(media, asset, name);
      if (!VARIANT.test(name) || !lstatSync(path).isFile()) continue;
      // A file larger than a rendition can be is no rendition: "" never matches a record.
      found[asset][name] =
        hashes && statSync(path).size <= MAX_BYTES ? sha256(readFileSync(path)) : "";
    }
  }
  return found;
}

/**
 * Puts one rendition in place: only a valid id and rendition name, under `public/media/` only,
 * through no link, and only bytes whose hash is the record's. Written beside it first and moved in.
 */
function placeMediaHere(
  dir: string,
  asset: string,
  variant: string,
  bytes: Uint8Array,
  hash: string,
): void {
  if (!ASSET_ID.test(asset) || !VARIANT.test(variant)) throw new Error("Not a media name.");
  if (sha256(bytes) !== hash) throw new Error(`${asset}/${variant} is not the recorded file.`);
  const media = join(dir, "public", "media");
  for (const path of [join(dir, "public"), media, join(media, asset)]) folder(path);
  const temporary = join(media, asset, `.${variant}.${randomBytes(6).toString("hex")}`);
  writeFileSync(temporary, bytes, { flag: "wx", mode: 0o644 });
  renameSync(temporary, join(media, asset, variant));
}

/** Takes one stored file's renditions, or one rendition, out of the cache, through no link. */
function dropMediaHere(dir: string, asset: string, variant?: string): void {
  if (!ASSET_ID.test(asset) || (variant !== undefined && !VARIANT.test(variant)))
    throw new Error("Not a media name.");
  const media = mediaFolder(dir);
  if (!media) return;
  const folder = join(media, asset);
  if (!existsSync(folder) || !lstatSync(folder).isDirectory()) return;
  if (variant === undefined) rmSync(folder, { recursive: true, force: true });
  else if (existsSync(join(folder, variant))) unlinkSync(join(folder, variant));
}

export const cachedMedia = asProject("cachedMedia", cachedMediaHere);
export const placeMedia = asProject("placeMedia", placeMediaHere);
export const dropMedia = asProject("dropMedia", dropMediaHere);

/** The project's content file's text, or none. */
const contentOf = (dir: string) => {
  const path = join(dir, "smithable.content.yml");
  return existsSync(path) ? treeText(path) : undefined;
};

export interface MediaSync {
  /** Renditions written. */
  written: string[];
  /** Cached files the service refused, taken out. */
  removed: string[];
  /** Renditions in use the service did not give, which show the reserved frame. */
  missing: string[];
  /** Renditions that came wrong or could not be placed, with why; counted missing too. */
  faults: string[];
}

/**
 * Brings the cache to what the content file uses: each rendition in use and not cached is
 * fetched, checked against the record and written. With `recheck` (workspace start) each cached
 * file is asked for again, and one the service refuses is taken out, so the preview never shows
 * what a publish could not. Cached files no longer in use stay: an id's files never change.
 */
export async function syncMedia(
  dir: string,
  source: MediaSource,
  { recheck = false }: { recheck?: boolean } = {},
): Promise<MediaSync> {
  const done: MediaSync = { written: [], removed: [], missing: [], faults: [] };
  const cached = cachedMedia(dir, recheck);
  const records = new Map<string, Promise<Record<string, string> | undefined>>();
  const record = (asset: string) => {
    if (!records.has(asset)) records.set(asset, source.record(asset));
    return records.get(asset) as Promise<Record<string, string> | undefined>;
  };
  if (recheck)
    for (const [asset, files] of Object.entries(cached)) {
      const hashes = ASSET_ID.test(asset) ? await record(asset) : undefined;
      if (!hashes) {
        dropMedia(dir, asset);
        delete cached[asset];
        done.removed.push(asset);
        continue;
      }
      // A rendition the record no longer lists, or whose file is not the recorded one, goes too.
      for (const [variant, hash] of Object.entries(files))
        if (hashes[variant] !== hash) {
          dropMedia(dir, asset, variant);
          delete files[variant];
          done.removed.push(`${asset}/${variant}`);
        }
    }
  for (const { asset, variants } of mediaInUse({ content: contentOf(dir) })) {
    const have = new Set(Object.keys(cached[asset] ?? {}));
    const wanted = variants.filter((v) => !have.has(v));
    if (!wanted.length) continue;
    const hashes = await record(asset);
    for (const variant of wanted) {
      const hash = hashes?.[variant];
      const got = hash ? await source.fetch(asset, variant) : undefined;
      if (!hash || !got) {
        done.missing.push(`${asset}/${variant}`);
        continue;
      }
      // One rendition that is wrong stops only itself; a service that cannot answer (a throw from
      // the source) still ends the sync, so it costs one timeout and not one per picture.
      try {
        if (got.sha256 !== hash || sha256(got.bytes) !== hash)
          throw new Error("it came with another hash than its record's");
        placeMedia(dir, asset, variant, got.bytes, hash);
        done.written.push(`${asset}/${variant}`);
      } catch (error) {
        done.missing.push(`${asset}/${variant}`);
        done.faults.push(`${asset}/${variant}: ${(error as Error).message}`);
      }
    }
  }
  return done;
}

/**
 * Studio's runner: one sync at a time, the next asked for while one runs done once after it.
 * A failure is said and the preview goes on; the files are asked for again at the next change.
 */
export function mediaSyncer(dir: string, source: MediaSource, say: (line: string) => void) {
  let tail: Promise<void> = Promise.resolve();
  let queued: { recheck: boolean; done: Promise<void> } | undefined;
  // A recheck that failed is owed: the next sync is one, whatever it was asked as.
  let owed = false;
  const run = async (asked: boolean): Promise<void> => {
    const recheck = asked || owed;
    try {
      const { missing, faults } = await syncMedia(dir, source, { recheck });
      for (const fault of faults) say(`A stored picture was not placed: ${fault}.\n`);
      owed = false;
      if (missing.length) say(`Stored pictures not available: ${missing.join(", ")}.\n`);
    } catch (error) {
      owed = recheck;
      say(`Stored pictures could not be fetched: ${(error as Error).message}\n`);
    }
  };
  // A change asked for while one is waiting joins it, so each caller's promise ends after a sync
  // that started after its change.
  const sync = (recheck = false): Promise<void> => {
    if (queued) {
      queued.recheck ||= recheck;
      return queued.done;
    }
    const next: { recheck: boolean; done: Promise<void> } = { recheck, done: tail };
    next.done = tail.then(() => {
      queued = undefined;
      return run(next.recheck);
    });
    queued = next;
    tail = next.done;
    return next.done;
  };
  return { sync };
}

/**
 * `smithable media in-use --json`: the stored files the project's content file uses, as core's
 * `mediaInUse` gives them, and nothing else on standard output. For the service's download and
 * publish staging, which run it on a checkout of the revision: no network, no writes, no model.
 */
export function mediaInUseCommand(dir: string, io: Io): number {
  // The folder's content file only: the service runs it on that one file taken from a revision.
  let list: ReturnType<typeof mediaInUse>;
  try {
    list = mediaInUse({ content: contentOf(dir) });
  } catch (error) {
    io.err(
      `${join(dir, "smithable.content.yml")} could not be read: ${(error as Error).message}\n`,
    );
    return 1;
  }
  io.out(`${JSON.stringify(list)}\n`);
  return 0;
}

/** Each rendition in use whose file is not in the cache, as a warning (§3): it shows its frame. */
export function mediaFindings(dir: string): Diagnostic[] {
  const content = contentOf(dir);
  return mediaInUse({ content }).flatMap(({ asset, variants }) => {
    const absent = variants.filter((v) => !existsSync(join(dir, "public", "media", asset, v)));
    return absent.length
      ? [
          {
            severity: "warning" as const,
            code: "media-absent",
            message: `The stored picture ${asset} has no ${absent.join(", ")} in public/media/${asset}/: the app shows its reserved frame there.`,
            hint: "A hosted workspace fetches the files itself, and a download carries them; a clone without them builds as it is.",
            file: join(dir, "smithable.content.yml"),
            line: 1,
            column: 1,
          },
        ]
      : [];
  });
}
