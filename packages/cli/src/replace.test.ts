import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { sync } from "./replace.js";

test("a replacement writes what differs by a rename over the file, and removes the rest", () => {
  const from = mkdtempSync(join(tmpdir(), "smithable-from-"));
  const dir = mkdtempSync(join(tmpdir(), "smithable-dir-"));
  mkdirSync(join(from, "public", "images"), { recursive: true });
  mkdirSync(join(dir, "public", "images"), { recursive: true });
  writeFileSync(join(from, "public", "images", "logo.webp"), "new mark");
  writeFileSync(join(dir, "public", "images", "logo.webp"), "old mark");
  writeFileSync(join(from, "public", "images", "hero.webp"), "same");
  writeFileSync(join(dir, "public", "images", "hero.webp"), "same");
  writeFileSync(join(dir, "public", "images", "gone.webp"), "not in the new app");
  // A folder where the new app has a file.
  mkdirSync(join(dir, "README.md"));
  writeFileSync(join(from, "README.md"), "a file now");
  sync(from, dir);
  expect(readFileSync(join(dir, "public", "images", "logo.webp"), "utf8")).toBe("new mark");
  expect(readFileSync(join(dir, "public", "images", "hero.webp"), "utf8")).toBe("same");
  expect(existsSync(join(dir, "public", "images", "gone.webp"))).toBe(false);
  expect(readFileSync(join(dir, "README.md"), "utf8")).toBe("a file now");
  // Nothing half-written is left beside the files.
  expect(readdirSync(join(dir, "public", "images")).sort()).toEqual(["hero.webp", "logo.webp"]);
});
