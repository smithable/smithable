import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";

// The kit's unused-samples.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../../adapter-tanstack/templates/src/kit/unused-samples.ts";
const { unusedSamples, leaveOutUnusedSamples } = (await import(path)) as {
  unusedSamples(client: string): string[];
  leaveOutUnusedSamples(): {
    closeBundle(this: { environment: { config: { build: { outDir: string } } } }): void;
  };
};

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A built browser folder (dist/client) with a page's chunk and the pictures the starter placed. */
function built(chunk: string) {
  const client = mkdtempSync(join(tmpdir(), "unused-samples-"));
  dirs.push(client);
  mkdirSync(join(client, "images", "samples"), { recursive: true });
  mkdirSync(join(client, "assets"));
  writeFileSync(join(client, "assets", "where-1a2b.js"), chunk);
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

test("a built app leaves out the sample pictures no page names; the hero, the mark and a named one ship", () => {
  const client = built(`image:{src:"/images/samples/food-soup-b.webp?v=8bda35e1"}`);
  expect(unusedSamples(client).sort()).toEqual([
    "samples/drink-tea-b.webp",
    "samples/food-cake-b.webp",
  ]);
  leaveOutUnusedSamples().closeBundle.call({
    environment: { config: { build: { outDir: client } } },
  });
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

test("without pictures.json nothing is left out (an app from before roles)", () => {
  const client = built("");
  rmSync(join(client, "images", "pictures.json"));
  expect(unusedSamples(client)).toEqual([]);
});
