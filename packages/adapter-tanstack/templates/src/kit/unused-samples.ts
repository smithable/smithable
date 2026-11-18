// The built app leaves out the sample pictures nothing in it uses (first-look.md §7). A
// published app's records start empty, and the seed copies its pictures into uploads/ from the
// project's own public/images/samples/, so a sample picture in dist/ is only reached by a page
// or server code that names it. Which files are samples is public/images/pictures.json's say (role "sample"),
// never the folder's: a file it does not list, or whose bytes differ from its record (the owner
// added or changed it), always ships; so do the hero, the mark and whatever a page names.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

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
 * The sample pictures under `<client>/images/` (`samples/<file>`) that no file the build wrote
 * names (the browser's and the server's, `built`: every environment's folder) and whose bytes
 * are still the library's: those the build may leave out.
 */
export function unusedSamples(client: string, built: string[] = [client]): string[] {
  const images = join(client, "images");
  let placed: Record<string, Placed>;
  try {
    placed = JSON.parse(readFileSync(join(images, "pictures.json"), "utf8"));
  } catch {
    return [];
  }
  const named = new Set<string>();
  for (const dir of built) if (existsSync(dir)) namedSamples(dir, images, named);
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

interface Builder {
  config: { root: string };
  environments: Record<
    string,
    { name: string; isBuilt: boolean; config: { build: { outDir: string } } }
  >;
  build(environment: unknown): Promise<unknown>;
}

/**
 * For vite.config.ts: once every environment is built (the app's build, after the framework's
 * own), the unused sample pictures are removed from the browser's folder in dist/.
 */
export function leaveOutUnusedSamples() {
  return {
    name: "leave-out-unused-samples",
    apply: "build" as const,
    buildApp: {
      order: "post" as const,
      async handler(builder: Builder) {
        const environments = Object.values(builder.environments);
        // Nothing built yet: Vite would build them after this hook, so build them here first.
        if (environments.every((environment) => !environment.isBuilt))
          for (const environment of environments) await builder.build(environment);
        const out = (environment: Builder["environments"][string]) =>
          resolve(builder.config.root, environment.config.build.outDir);
        const browser = builder.environments.client;
        if (!browser) return;
        const client = out(browser);
        const built = environments.map(out);
        for (const file of unusedSamples(client, built)) rmSync(join(client, "images", file));
      },
    },
  };
}
