import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { sync } from "./replace.js";
import { tempDir } from "./test-dir.js";

test("a replacement writes what differs by a rename over the file, and removes the rest", () => {
  const from = tempDir("smithable-from-");
  const dir = tempDir("smithable-dir-");
  mkdirSync(join(from, "public", "images"), { recursive: true });
  mkdirSync(join(dir, "public", "images"), { recursive: true });
  writeFileSync(join(from, "public", "images", "logo.webp"), "new mark");
  writeFileSync(join(dir, "public", "images", "logo.webp"), "old mark");
  writeFileSync(join(from, "public", "images", "hero.webp"), "same");
  writeFileSync(join(dir, "public", "images", "hero.webp"), "same");
  writeFileSync(join(dir, "public", "images", "gone.webp"), "not in the new app");
  // A folder where the new app has a file, and a file where the new app has a folder.
  mkdirSync(join(dir, "README.md"));
  writeFileSync(join(from, "README.md"), "a file now");
  writeFileSync(join(dir, "src"), "a file before");
  mkdirSync(join(from, "src", "custom"), { recursive: true });
  writeFileSync(join(from, "src", "custom", "x.ts"), "export {};");
  sync(from, dir);
  expect(readFileSync(join(dir, "public", "images", "logo.webp"), "utf8")).toBe("new mark");
  expect(readFileSync(join(dir, "public", "images", "hero.webp"), "utf8")).toBe("same");
  expect(existsSync(join(dir, "public", "images", "gone.webp"))).toBe(false);
  expect(readFileSync(join(dir, "README.md"), "utf8")).toBe("a file now");
  expect(readFileSync(join(dir, "src", "custom", "x.ts"), "utf8")).toBe("export {};");
  // Nothing half-written is left beside the files.
  expect(readdirSync(join(dir, "public", "images")).sort()).toEqual(["hero.webp", "logo.webp"]);
});
