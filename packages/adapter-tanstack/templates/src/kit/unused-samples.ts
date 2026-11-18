// The built app leaves out the sample pictures nothing in it uses (first-look.md §7). A
// published app's records start empty, and the seed copies its pictures into uploads/ from the
// project's own public/images/samples/, so a sample picture in dist/ is only reached by a page
// that names it. Which files are samples is public/images/pictures.json's say (role "sample"),
// never the folder's: a file it does not list, or whose bytes differ from its record (the owner
// added or changed it), always ships; so do the hero, the mark and whatever a page names.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

interface Placed {
  role?: string;
  sha256?: string;
}

/**
 * What the files the build wrote outside images/ name under images/samples/: each name, as written
 * up to a quote, space, query or bracket. A name built at run time (`images/samples/${x}`) shows as
 * one that is no file, and then every sample ships.
 */
function namedSamples(dir: string, skip: string, names = new Set<string>()): Set<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (path === skip) continue;
    if (statSync(path).isDirectory()) namedSamples(path, skip, names);
    else if (/\.(m?js|css|html|json|txt|xml|webmanifest)$/.test(name))
      for (const [, file] of readFileSync(path, "utf8").matchAll(
        /images\/samples\/([^"'`?#\s)]*)/g,
      ))
        names.add(file ?? "");
  }
  return names;
}

/**
 * The sample pictures under `<client>/images/` (`samples/<file>`) that no built file names and
 * whose bytes are still the library's: those the build may leave out.
 */
export function unusedSamples(client: string): string[] {
  const images = join(client, "images");
  let placed: Record<string, Placed>;
  try {
    placed = JSON.parse(readFileSync(join(images, "pictures.json"), "utf8"));
  } catch {
    return [];
  }
  const named = namedSamples(client, images);
  for (const file of named) if (!file || !existsSync(join(images, "samples", file))) return [];
  return Object.entries(placed)
    .filter(([file, record]) => {
      const path = join(images, file);
      if (record.role !== "sample" || !record.sha256 || !existsSync(path)) return false;
      if (named.has(file.slice("samples/".length))) return false;
      return createHash("sha256").update(readFileSync(path)).digest("hex") === record.sha256;
    })
    .map(([file]) => file);
}

/** For vite.config.ts: after the browser's build, its unused sample pictures are removed from dist/. */
export function leaveOutUnusedSamples() {
  return {
    name: "leave-out-unused-samples",
    apply: "build" as const,
    applyToEnvironment: (environment: { name: string }) => environment.name === "client",
    closeBundle(this: { environment?: { config: { build: { outDir: string } } } }) {
      const client = this.environment?.config.build.outDir;
      if (!client) return;
      for (const file of unusedSamples(client)) rmSync(join(client, "images", file));
    },
  };
}
