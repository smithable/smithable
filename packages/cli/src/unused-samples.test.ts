import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";

// The kit's unused-samples.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../../adapter-tanstack/templates/src/kit/unused-samples.ts";
const { unusedSamples, leaveOutUnusedSamples } = (await import(path)) as {
  unusedSamples(client: string): string[];
  leaveOutUnusedSamples(): { buildApp: { handler(builder: unknown): Promise<void> } };
};

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A built browser folder (dist/client) with a page's chunk and the pictures the starter placed. */
function built(chunk: string, server = "") {
  const root = mkdtempSync(join(tmpdir(), "unused-samples-"));
  dirs.push(root);
  const client = join(root, "client");
  mkdirSync(join(client, "images", "samples"), { recursive: true });
  mkdirSync(join(client, "assets"));
  writeFileSync(join(client, "assets", "where-1a2b.js"), chunk);
  mkdirSync(join(client, "..", "server"), { recursive: true });
  writeFileSync(join(client, "..", "server", "server.js"), server);
  const files: Record<string, string> = {
    "hero.webp": "hero",
    "logo.webp": "logo",
    "samples/food-soup-b.webp": "soup",
    "samples/food-cake-b.webp": "cake",
    "samples/drink-tea-b.webp": "tea",
  };
  const placed: Record<string, unknown> = {};
  for (const [file, bytes] of Object.entries(files)) {
    writeFileSync(join(client, "images", file), bytes);
    const role = file.startsWith("samples/") ? "sample" : file.slice(0, -5);
    placed[file] = { role, sha256: sha(bytes), generated: true };
  }
  writeFileSync(join(client, "images", "pictures.json"), JSON.stringify(placed));
  return client;
}

/** Vite's builder after the browser's and the server's builds, as the plugin's hook gets it. */
const builder = (client: string, isBuilt = true) => {
  const env = (name: string) => ({
    name,
    isBuilt,
    config: { build: { outDir: name === "client" ? "client" : "server" } },
  });
  const environments = { client: env("client"), ssr: env("ssr") };
  return {
    config: { root: join(client, "..") },
    environments,
    built: [] as string[],
    async build(environment: { name: string; isBuilt: boolean }) {
      this.built.push(environment.name);
      environment.isBuilt = true;
    },
  };
};

test("a built app leaves out the sample pictures no page names; the hero, the mark and a named one ship", async () => {
  const client = built(`image:{src:"/images/samples/food-soup-b.webp?v=8bda35e1"}`);
  expect(unusedSamples(client).sort()).toEqual([
    "samples/drink-tea-b.webp",
    "samples/food-cake-b.webp",
  ]);
  await leaveOutUnusedSamples().buildApp.handler(builder(client));
  const left = ["hero.webp", "logo.webp", "pictures.json", "samples/food-soup-b.webp"];
  for (const file of left) expect(existsSync(join(client, "images", file))).toBe(true);
  expect(existsSync(join(client, "images", "samples", "food-cake-b.webp"))).toBe(false);
  expect(existsSync(join(client, "images", "samples", "drink-tea-b.webp"))).toBe(false);
});

test("an owner's picture in samples/ always ships: one with no record, and one whose bytes changed", () => {
  const client = built("");
  writeFileSync(join(client, "images", "samples", "my-shop.webp"), "the owner's own");
  writeFileSync(join(client, "images", "samples", "food-cake-b.webp"), "the owner's cake");
  expect(unusedSamples(client).sort()).toEqual([
    "samples/drink-tea-b.webp",
    "samples/food-soup-b.webp",
  ]);
});

test("a sample picture named at run time (custom code building the path) keeps them all", () => {
  expect(unusedSamples(built("src:`/images/samples/${dish.photo}`"))).toEqual([]);
  expect(unusedSamples(built('src:"/images/samples/"+n'))).toEqual([]);
});

test("a sample named only by the server's code ships (a head, a mail, a server route)", async () => {
  const client = built("", 'og:image","/images/samples/food-cake-b.webp"');
  const app = builder(client);
  await leaveOutUnusedSamples().buildApp.handler(app);
  expect(existsSync(join(client, "images", "samples", "food-cake-b.webp"))).toBe(true);
  expect(existsSync(join(client, "images", "samples", "drink-tea-b.webp"))).toBe(false);
  expect(app.built).toEqual([]);
});

test("when nothing is built yet, the hook builds every environment before it looks", async () => {
  const client = built("");
  const app = builder(client, false);
  await leaveOutUnusedSamples().buildApp.handler(app);
  expect(app.built).toEqual(["client", "ssr"]);
});

test("without pictures.json nothing is left out (an app from before roles)", () => {
  const client = built("");
  rmSync(join(client, "images", "pictures.json"));
  expect(unusedSamples(client)).toEqual([]);
});
