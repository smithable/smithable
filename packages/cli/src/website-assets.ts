import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";
import { YamlEditor } from "@smithable/core";
import type { Io } from "./io.js";
import { digest } from "./website-input.js";

// A deterministic neutral raster placeholder; the content grammar permits raster images only.
export const WEBSITE_PLACEHOLDER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAYCAIAAAAUMWhjAAAAbElEQVR4nO3NsQ3AIAxEUfZfLTUDUEQpsgQFCERigy/hOksuff+F87qpF+jAERMdoBoV4BkdIBkDsJcpNQHYYrSUDPwxHh0V+GCIkRkAMdp8DSyN+dYEaIZlaAXehnEFAI2B/mEAPQcccCCmDI3PwnyZ/hJKAAAAAElFTkSuQmCC",
  "base64",
);
export const WEBSITE_ASSETS = "smithable.assets.json";
export interface WebsiteAsset {
  path: string;
  sha256: string;
  source: {
    kind: "original" | "library" | "placeholder";
    url?: string;
    authorizationId?: string;
    licence?: string;
    author?: string;
    licenceUrl?: string;
  };
  role: string;
  concept: boolean;
  factualPhotoReview: boolean;
}
export interface WebsiteAssetManifest {
  version: 1;
  assets: WebsiteAsset[];
}
const APPROVAL = "data/.smithable/release-review/assets.json";
const isHash = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function safeFile(root: string, relative: string, max: number): Buffer {
  if (
    !relative ||
    relative.includes("\\") ||
    relative.split("/").some((part) => ["", ".", ".."].includes(part))
  )
    throw new Error("The asset path is invalid.");
  const base = resolve(root);
  let path = base;
  for (const part of relative.split("/")) {
    path = join(path, part);
    const info = lstatSync(path);
    if (info.isSymbolicLink()) throw new Error("An asset path is a symbolic link.");
  }
  if (!path.startsWith(`${base}${sep}`)) throw new Error("An asset path escaped the project.");
  if (!lstatSync(path).isFile()) throw new Error("An asset is not a regular file.");
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = fstatSync(fd);
    if (!info.isFile() || info.size > max)
      throw new Error("An asset file is invalid or too large.");
    return readFileSync(fd);
  } finally {
    closeSync(fd);
  }
}
export function parseAssetManifest(value: unknown): WebsiteAssetManifest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The asset manifest is invalid.");
  const v = value as Record<string, unknown>;
  if (
    v.version !== 1 ||
    !Array.isArray(v.assets) ||
    v.assets.length > 60 ||
    Object.keys(v).some((key) => !["version", "assets"].includes(key))
  )
    throw new Error("The asset manifest is invalid.");
  const paths = new Set<string>();
  const assets = v.assets.map((value): WebsiteAsset => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("The asset entry is invalid.");
    const a = value as Record<string, unknown>,
      source = a.source as WebsiteAsset["source"];
    if (
      Object.keys(a).some(
        (key) =>
          !["path", "sha256", "source", "role", "concept", "factualPhotoReview"].includes(key),
      ) ||
      typeof a.path !== "string" ||
      !/^images\/(?:originals|library)\/[a-f0-9]{64}\.(?:jpg|png|webp|svg)$/.test(a.path) ||
      paths.has(a.path) ||
      !isHash(a.sha256) ||
      typeof a.role !== "string" ||
      a.role.length > 30 ||
      typeof a.concept !== "boolean" ||
      typeof a.factualPhotoReview !== "boolean" ||
      !source ||
      typeof source !== "object" ||
      !["original", "library", "placeholder"].includes(source.kind)
    )
      throw new Error("The asset entry is invalid.");
    if (
      Object.keys(source).some(
        (key) =>
          !["kind", "url", "authorizationId", "licence", "author", "licenceUrl"].includes(key),
      ) ||
      Object.values(source).some((value) => typeof value !== "string" || value.length > 4096)
    )
      throw new Error("The asset source is invalid.");
    if (
      source.kind === "original" &&
      (!source.authorizationId || !source.url || !a.path.startsWith("images/originals/"))
    )
      throw new Error("The original asset has no authorization provenance.");
    if (source.kind !== "original" && !a.path.startsWith("images/library/"))
      throw new Error("The asset strategy path is invalid.");
    const photographic = source.kind !== "placeholder";
    if (
      a.factualPhotoReview !== photographic ||
      (source.kind === "placeholder" &&
        (!a.path.endsWith(".png") || a.concept || a.sha256 !== digest(WEBSITE_PLACEHOLDER))) ||
      (source.kind === "original" && a.path.endsWith(".svg")) ||
      !a.path.includes(`/${a.sha256}.`)
    )
      throw new Error("The asset review classification is invalid.");
    paths.add(a.path);
    return {
      path: a.path,
      sha256: a.sha256,
      source: { ...source },
      role: a.role,
      concept: a.concept,
      factualPhotoReview: a.factualPhotoReview,
    };
  });
  return { version: 1, assets: assets.sort((a, b) => a.path.localeCompare(b.path)) };
}
export function writeAssetManifest(dir: string, assets: WebsiteAsset[]): void {
  const manifest = parseAssetManifest({ version: 1, assets });
  writeFileSync(join(dir, WEBSITE_ASSETS), `${JSON.stringify(manifest, null, 2)}\n`);
}
export function assetReview(dir: string) {
  const diagnostics: string[] = [];
  let manifest: WebsiteAssetManifest = { version: 1, assets: [] };
  try {
    if (lstatSync(join(dir, WEBSITE_ASSETS), { throwIfNoEntry: false }))
      manifest = parseAssetManifest(
        JSON.parse(safeFile(dir, WEBSITE_ASSETS, 1024 * 1024).toString("utf8")),
      );
  } catch {
    diagnostics.push("The asset provenance manifest could not be validated.");
  }
  for (const group of ["originals", "library"]) {
    const dirPath = join(dir, "public", "images", group);
    const info = lstatSync(dirPath, { throwIfNoEntry: false });
    if (!info) continue;
    if (!info.isDirectory() || info.isSymbolicLink()) {
      diagnostics.push(`The managed image directory is unsafe: ${group}.`);
      continue;
    }
    for (const file of readdirSync(dirPath))
      if (!manifest.assets.some((asset) => asset.path === `images/${group}/${file}`))
        diagnostics.push(`An image has no provenance: images/${group}/${file}.`);
  }
  const presentation: [string, string][] = [];
  for (const file of readdirSync(dir)
    .filter(
      (file) =>
        file === "smithable.yml" || /^smithable\.content(?:\.[a-zA-Z0-9-]+)?\.ya?ml$/.test(file),
    )
    .sort()) {
    try {
      presentation.push([file, digest(safeFile(dir, file, 2 * 1024 * 1024))]);
    } catch {
      diagnostics.push(`The asset presentation could not be checked: ${file}.`);
    }
  }
  if (lstatSync(join(dir, WEBSITE_ASSETS), { throwIfNoEntry: false })) {
    for (const [file] of presentation) {
      if (!file.startsWith("smithable.content")) continue;
      try {
        const value = new YamlEditor(safeFile(dir, file, 2 * 1024 * 1024).toString("utf8")).get([]);
        let nodes = 0;
        const inspect = (value: unknown, depth = 0): void => {
          if (++nodes > 100000 || depth > 40) throw new Error("complex content");
          if (!value || typeof value !== "object") return;
          for (const [key, child] of Object.entries(value)) {
            if (["image", "logo"].includes(key) && child) {
              const src =
                typeof child === "string"
                  ? child
                  : typeof child === "object"
                    ? (child as { src?: unknown }).src
                    : undefined;
              if (typeof src !== "string" || !manifest.assets.some((asset) => asset.path === src))
                diagnostics.push(`An image reference has no reviewed provenance in ${file}.`);
            }
            inspect(child, depth + 1);
          }
        };
        inspect(value);
      } catch {
        diagnostics.push(`Image references could not be checked in ${file}.`);
      }
    }
  }
  const presentationDigest = digest(JSON.stringify(presentation));
  const assets = manifest.assets.map((asset) => {
    try {
      const actualSha256 = digest(safeFile(dir, `public/${asset.path}`, 2 * 1024 * 1024));
      if (actualSha256 !== asset.sha256) diagnostics.push(`The asset changed: ${asset.path}.`);
      return { ...asset, actualSha256 };
    } catch {
      diagnostics.push(`The asset is missing or unsafe: ${asset.path}.`);
      return { ...asset, actualSha256: null };
    }
  });
  const manifestDigest = digest(JSON.stringify({ version: 1, assets, presentationDigest }));
  let approved = false;
  try {
    const record = JSON.parse(safeFile(dir, APPROVAL, 4096).toString("utf8"));
    approved =
      record.version === 1 &&
      record.manifestDigest === manifestDigest &&
      typeof record.at === "string" &&
      Number.isFinite(Date.parse(record.at));
  } catch {}
  const pending = assets
    .filter((asset) => asset.factualPhotoReview)
    .map((asset) => ({
      path: asset.path,
      sha256: asset.sha256,
      role: asset.role,
      reason: asset.concept
        ? "Confirm this illustration does not imply real business features."
        : "Review this business photograph before publishing.",
    }));
  return {
    version: 1 as const,
    manifestDigest,
    presentationDigest,
    assets,
    pending,
    approved: diagnostics.length === 0 && (!pending.length || approved),
    diagnostics,
  };
}
export function approveAssetReviewCommand(dir: string, expected: string, io: Io): number {
  const review = assetReview(dir);
  if (!isHash(expected) || expected !== review.manifestDigest || review.diagnostics.length) {
    io.err("The assets changed or could not be checked. Review them again.\n");
    return 1;
  }
  const target = join(dir, APPROVAL);
  // Every existing ancestor must be a real directory; local approval is never read as hosted authority.
  let at = resolve(dir);
  for (const part of APPROVAL.split("/").slice(0, -1)) {
    at = join(at, part);
    if (!lstatSync(at, { throwIfNoEntry: false })) mkdirSync(at);
    const info = lstatSync(at);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      io.err("The review directory is unsafe.\n");
      return 1;
    }
  }
  const temporary = `${target}.incoming`;
  if (lstatSync(temporary, { throwIfNoEntry: false })) {
    io.err("An asset review write is already present.\n");
    return 1;
  }
  writeFileSync(
    temporary,
    JSON.stringify({ version: 1, manifestDigest: expected, at: new Date().toISOString() }),
    { flag: "wx", mode: 0o600 },
  );
  renameSync(temporary, target);
  io.out("Asset review recorded for this version.\n");
  return 0;
}
export function readWebsiteAssetReviewCommand(dir: string, io: Io): number {
  const review = assetReview(dir);
  io.out(`${JSON.stringify(review)}\n`);
  return review.diagnostics.length ? 1 : 0;
}
