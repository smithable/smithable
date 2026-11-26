import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

// A hosted Studio is in the project's group, not the file's owner: setting times is refused.
vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return {
    ...fs,
    utimesSync: vi.fn(() => {
      throw Object.assign(new Error("EPERM: operation not permitted, utime"), { code: "EPERM" });
    }),
  };
});

const { reopenDatabase } = await import("./replace.js");
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

it("marks the database module changed by a copy renamed over it when its times are the owner's", async () => {
  const dir = mkdtempSync(join(tmpdir(), "reopen-"));
  dirs.push(dir);
  mkdirSync(join(dir, "src", "db"), { recursive: true });
  const module = join(dir, "src", "db", "index.ts");
  writeFileSync(module, "export const db = 1;\n");
  chmodSync(module, 0o644);
  const before = statSync(module).mtimeMs;
  await new Promise((done) => setTimeout(done, 20));
  reopenDatabase(dir);
  const after = statSync(module);
  expect(after.mtimeMs).toBeGreaterThan(before);
  expect(after.mode & 0o777).toBe(0o664);
  expect(readFileSync(module, "utf8")).toBe("export const db = 1;\n");
  expect(readdirSync(join(dir, "src", "db"))).toEqual(["index.ts"]);
});

it("does nothing without a database module", () => {
  const dir = mkdtempSync(join(tmpdir(), "reopen-"));
  dirs.push(dir);
  expect(() => reopenDatabase(dir)).not.toThrow();
});
