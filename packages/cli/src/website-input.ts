// Host-installed website input. References contain digests, never filesystem paths or authority.
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseSiteImageContexts, type SiteImageContext } from "./image-context.js";
import type { Io } from "./io.js";
import { parseSiteFacts, type SiteFacts } from "./site-facts.js";
import {
  parseSitePersonalMap,
  projectSitePersonal,
  type SiteContentMode,
  type SiteModelProjection,
  type SitePersonalMap,
} from "./site-personal.js";

export const MAX_WEBSITE_INPUT = 64 * 1024 * 1024;
export const digest = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
export interface WebsiteInputRef {
  version: 1;
  sha256: string;
}
export type WebsiteContentMode = SiteContentMode;
export interface WebsiteGenerationOptions {
  input: WebsiteInputRef;
  interpretText?: boolean;
  ownerDescription?: boolean;
  contentMode?: WebsiteContentMode;
}
export interface SourceCorpus {
  version: 1;
  pages: { id: string; text: string; sha256: string }[];
}
export type OriginalType = "image/jpeg" | "image/png" | "image/webp";
export interface OriginalAsset {
  id: string;
  mediaType: OriginalType;
  sha256: string;
  base64: string;
  authorizationId: string;
}
export interface WebsiteGenerationInput {
  version: 1;
  options?: { contentMode: WebsiteContentMode };
  model?: SiteModelProjection;
  personalMap?: SitePersonalMap;
  facts: SiteFacts;
  sourceCorpus: SourceCorpus;
  images: SiteImageContext[];
  originals: OriginalAsset[];
  authorization: { id: string; site: string; images: boolean };
}
const hash = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const identifier = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value);
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new Error("The website input has an invalid object.");
  return value as Record<string, unknown>;
}
function safeTree(value: unknown, depth = 0, budget = { nodes: 0 }): void {
  if (++budget.nodes > 100_000 || depth > 40) throw new Error("The website input is too complex.");
  if (value && typeof value === "object")
    for (const [key, child] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key))
        throw new Error("The website input contains a forbidden key.");
      safeTree(child, depth + 1, budget);
    }
}
function web(value: unknown): URL {
  if (typeof value !== "string" || value.length > 4096)
    throw new Error("The website address is invalid.");
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw new Error("The website address is invalid.");
  return url;
}
export function rasterType(bytes: Uint8Array): OriginalType | undefined {
  const b = Buffer.from(bytes);
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
  return undefined;
}
export function parseWebsiteGenerationOptions(value: unknown): WebsiteGenerationOptions {
  const options = object(value, ["input", "interpretText", "ownerDescription", "contentMode"]);
  const input = object(options.input, ["version", "sha256"]);
  if (
    input.version !== 1 ||
    !hash(input.sha256) ||
    (options.interpretText !== undefined && typeof options.interpretText !== "boolean") ||
    (options.ownerDescription !== undefined && typeof options.ownerDescription !== "boolean") ||
    (options.contentMode !== undefined &&
      !["sample", "full"].includes(options.contentMode as string))
  )
    throw new Error("The website input reference is invalid.");
  return {
    input: { version: 1, sha256: input.sha256 },
    ...(options.contentMode === undefined
      ? {}
      : { contentMode: options.contentMode as WebsiteContentMode }),
    ...(options.ownerDescription === undefined
      ? {}
      : { ownerDescription: options.ownerDescription }),
    ...(options.interpretText === undefined ? {} : { interpretText: options.interpretText }),
  };
}
export function parseWebsiteInput(value: unknown): WebsiteGenerationInput {
  safeTree(value);
  const v = object(value, [
    "version",
    "facts",
    "sourceCorpus",
    "images",
    "originals",
    "authorization",
    "options",
    "model",
    "personalMap",
  ]);
  if (v.version !== 1) throw new Error("The website input version is unsupported.");
  const modeOptions = v.options === undefined ? {} : object(v.options, ["contentMode"]);
  const contentMode = modeOptions.contentMode ?? "sample";
  if (contentMode !== "sample" && contentMode !== "full")
    throw new Error("The website content mode is invalid.");
  const personalMap = v.personalMap === undefined ? undefined : parseSitePersonalMap(v.personalMap);
  const facts = parseSiteFacts(v.facts),
    images = parseSiteImageContexts(v.images);
  if (Buffer.byteLength(JSON.stringify(facts)) > 1024 * 1024 || images.length > 60)
    throw new Error("The website facts exceed their limit.");
  const source = object(v.sourceCorpus, ["version", "pages"]);
  if (source.version !== 1 || !Array.isArray(source.pages) || source.pages.length > 12)
    throw new Error("The source corpus is invalid.");
  let size = 0;
  const ids = new Set<string>();
  const pages = source.pages.map((value) => {
    const page = object(value, ["id", "text", "sha256"]);
    if (
      !identifier(page.id) ||
      ids.has(page.id) ||
      typeof page.text !== "string" ||
      !hash(page.sha256) ||
      digest(page.text) !== page.sha256
    )
      throw new Error("The source corpus page is invalid.");
    ids.add(page.id);
    size += Buffer.byteLength(page.text);
    if (size > 8 * 1024 * 1024) throw new Error("The source corpus exceeds 8 MB.");
    return { id: page.id, text: page.text, sha256: page.sha256 };
  });
  const authorization = object(v.authorization, ["id", "site", "images"]);
  if (!identifier(authorization.id) || typeof authorization.images !== "boolean")
    throw new Error("The image authorization is invalid.");
  const site = web(authorization.site);
  if (web(facts.url).hostname.replace(/^www\./, "") !== site.hostname.replace(/^www\./, ""))
    throw new Error("The image authorization belongs to another site.");
  if (
    !Array.isArray(v.originals) ||
    v.originals.length > 20 ||
    (!authorization.images && v.originals.length)
  )
    throw new Error("Original images are not authorized or exceed their limit.");
  const originalIds = new Set<string>();
  const originals = v.originals.map((value) => {
    const a = object(value, ["id", "mediaType", "sha256", "base64", "authorizationId"]);
    if (
      !identifier(a.id) ||
      originalIds.has(a.id) ||
      !["image/jpeg", "image/png", "image/webp"].includes(a.mediaType as string) ||
      !hash(a.sha256) ||
      typeof a.base64 !== "string" ||
      a.base64.length > 1_400_000 ||
      a.authorizationId !== authorization.id
    )
      throw new Error("The original image is invalid.");
    const context = images.find((image) => image.id === a.id);
    if (
      !context ||
      web(context.src).hostname.replace(/^www\./, "") !== site.hostname.replace(/^www\./, "")
    )
      throw new Error("The original image has no authorized source context.");
    const bytes = Buffer.from(a.base64, "base64");
    if (
      !bytes.length ||
      bytes.length > 1024 * 1024 ||
      bytes.toString("base64") !== a.base64 ||
      digest(bytes) !== a.sha256 ||
      rasterType(bytes) !== a.mediaType
    )
      throw new Error("The original image bytes are invalid.");
    originalIds.add(a.id);
    return {
      id: a.id,
      mediaType: a.mediaType as OriginalType,
      sha256: a.sha256,
      base64: a.base64,
      authorizationId: authorization.id as string,
    };
  });
  const projection = projectSitePersonal(
    { facts, images, sourceCorpus: { version: 1, pages } },
    { contentMode, ...(personalMap ? { personalMap } : {}) },
  );
  if (
    v.model !== undefined &&
    (!personalMap || JSON.stringify(v.model) !== JSON.stringify(projection.model))
  )
    throw new Error("The website model projection does not match its private source and mapping.");
  return {
    version: 1,
    options: { contentMode },
    model: projection.model,
    personalMap: projection.personalMap,
    facts,
    images,
    sourceCorpus: { version: 1, pages },
    originals,
    authorization: { id: authorization.id, site: site.href, images: authorization.images },
  };
}
function directory(dir: string, generation: string, create: boolean): string {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(generation)) throw new Error("The generation id is invalid.");
  const parent = realpathSync(dirname(resolve(dir)));
  let at = parent;
  for (const part of [".smithable-site-inputs", digest(resolve(dir)), generation]) {
    at = join(at, part);
    if (!lstatSync(at, { throwIfNoEntry: false }) && create) mkdirSync(at, { mode: 0o700 });
    const info = lstatSync(at);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      (process.getuid && info.uid !== process.getuid()) ||
      info.mode & 0o077
    )
      throw new Error("The website input directory is not private.");
  }
  return at;
}
function privateJson(bytes: Uint8Array, message: string): unknown {
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw new Error(message);
  }
}
// This receipt is a host-installation boundary, not a cryptographic capability against a
// same-UID workspace operator. The host must keep these control files out of generated mounts.
function privateFile(path: string): Buffer {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = fstatSync(fd);
    if (
      !info.isFile() ||
      info.size > MAX_WEBSITE_INPUT ||
      info.mode & 0o077 ||
      (process.getuid && info.uid !== process.getuid())
    )
      throw new Error("The website authority file is invalid.");
    return readFileSync(fd);
  } finally {
    closeSync(fd);
  }
}
export function consumeWebsiteInput(
  dir: string,
  generation: string,
  ref: WebsiteInputRef,
  requestedMode: WebsiteContentMode = "sample",
  diagnostic?: (message: string) => void,
): WebsiteGenerationInput {
  parseWebsiteGenerationOptions({ input: ref });
  const path = join(directory(dir, generation, false), `${ref.sha256}.json`);
  if (!lstatSync(path).isFile()) throw new Error("The website input is not a regular file.");
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = fstatSync(fd);
    if (
      !info.isFile() ||
      info.size > MAX_WEBSITE_INPUT ||
      info.mode & 0o077 ||
      (process.getuid && info.uid !== process.getuid())
    )
      throw new Error("The website input file is invalid.");
    const bytes = readFileSync(fd);
    if (digest(bytes) !== ref.sha256) throw new Error("The website input digest changed.");
    const rawInput = privateJson(bytes, "The website input is not valid JSON.");
    const input = parseWebsiteInput(rawInput);
    if (
      (input.options?.contentMode ?? "sample") === "sample" &&
      !(rawInput as Record<string, unknown>).personalMap
    )
      diagnostic?.(
        "This older website input was sanitized from its facts and corpus without the full HTML detection context. Some personal details may be missed.",
      );
    const mode = input.options?.contentMode ?? "sample";
    if (mode !== requestedMode)
      throw new Error("The website content mode does not match the generation request.");
    const permitPath = `${path}.permit`;
    if (lstatSync(permitPath, { throwIfNoEntry: false })) {
      const permit = object(
        privateJson(privateFile(permitPath), "The installed website authority is not valid JSON."),
        ["version", "sha256", "project", "generation", "contentMode"],
      );
      if (
        permit.version !== 1 ||
        permit.sha256 !== ref.sha256 ||
        permit.project !== digest(resolve(dir)) ||
        permit.generation !== generation ||
        permit.contentMode !== mode
      )
        throw new Error("The installed website content authority does not match.");
    } else if (mode !== "sample")
      throw new Error("Full website content has no trusted installer authority.");
    const now = lstatSync(path);
    if (now.ino !== info.ino || now.dev !== info.dev || now.isSymbolicLink())
      throw new Error("The website input changed while being read.");
    unlinkSync(path);
    if (lstatSync(permitPath, { throwIfNoEntry: false })) unlinkSync(permitPath);
    return input;
  } finally {
    closeSync(fd);
  }
}
export async function installWebsiteInputCommand(
  dir: string,
  generation: string | undefined,
  sha256: string | undefined,
  io: Io,
  input: AsyncIterable<Uint8Array | string> = process.stdin,
  // Internal host expectation, never parsed from the payload or ordinary generation request.
  expected: { contentMode: WebsiteContentMode } = { contentMode: "sample" },
): Promise<number> {
  let temporary: string | undefined;
  try {
    if (!generation || !hash(sha256))
      throw new Error("A generation id and SHA-256 digest are required.");
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of input) {
      const bytes = Buffer.from(chunk);
      size += bytes.length;
      if (size > MAX_WEBSITE_INPUT) throw new Error("The website input exceeds 64 MB.");
      chunks.push(bytes);
    }
    const bytes = Buffer.concat(chunks);
    if (digest(bytes) !== sha256) throw new Error("The website input digest does not match.");
    const parsed = parseWebsiteInput(privateJson(bytes, "The website input is not valid JSON."));
    if ((parsed.options?.contentMode ?? "sample") !== expected.contentMode)
      throw new Error("The website content mode does not match the trusted installer expectation.");
    const root = directory(dir, generation, true);
    temporary = join(root, `${sha256}.${randomUUID()}.incoming`);
    writeFileSync(temporary, bytes, { mode: 0o600, flag: "wx" });
    renameSync(temporary, join(root, `${sha256}.json`));
    temporary = undefined;
    const permit = JSON.stringify({
      version: 1,
      sha256,
      project: digest(resolve(dir)),
      generation,
      contentMode: expected.contentMode,
    });
    temporary = join(root, `${sha256}.${randomUUID()}.permit.incoming`);
    writeFileSync(temporary, permit, { mode: 0o600, flag: "wx" });
    renameSync(temporary, join(root, `${sha256}.json.permit`));
    temporary = undefined;
    io.out(
      `${JSON.stringify({ version: 1, sha256, pages: parsed.sourceCorpus.pages.length, originals: parsed.originals.length })}\n`,
    );
    return 0;
  } catch (error) {
    io.err(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  } finally {
    if (temporary) {
      try {
        unlinkSync(temporary);
      } catch {}
    }
  }
}
