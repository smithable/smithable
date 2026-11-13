import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { tempDir } from "./test-dir.js";
import { installing } from "./vite-cache.js";

test("an install that changes the lock leaves no old pre-bundle; one that does not keeps it (T742)", () => {
  const dir = tempDir("vite-cache-");
  const cache = join(dir, "node_modules", ".vite", "deps");
  writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  mkdirSync(cache, { recursive: true });
  // The same lock: Vite's own key still holds, the bundle stays warm.
  expect(installing(dir, () => 0)).toBe(0);
  expect(existsSync(cache)).toBe(true);
  // A new package: the lock changed, the old bundle goes.
  installing(dir, () =>
    writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\nnew: 1\n"),
  );
  expect(existsSync(join(dir, "node_modules", ".vite"))).toBe(false);
  // A first install (no lock before) starts fresh too.
  const fresh = tempDir("vite-cache-");
  mkdirSync(join(fresh, "node_modules", ".vite"), { recursive: true });
  installing(fresh, () => writeFileSync(join(fresh, "pnpm-lock.yaml"), "x\n"));
  expect(existsSync(join(fresh, "node_modules", ".vite"))).toBe(false);
});
