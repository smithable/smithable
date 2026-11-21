import { mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, test } from "vitest";
import { childCallsForTests, decode, encode } from "./as-project.js";
import { countValue, databasePath, restoreDatabase, snapshotDatabase } from "./database.js";
import { keepImport } from "./import.js";
import { forgetProjectUserForTests } from "./secrets.js";
import { tempDir } from "./test-dir.js";
import { removeTree, writeTreeFile } from "./tree-files.js";

afterEach(() => {
  delete process.env.SMITHABLE_PROJECT_UID;
  delete process.env.SMITHABLE_PROJECT_GID;
  forgetProjectUserForTests();
});

/** A project user that is this process's own ids: a child may take them without a capability. */
function asOwnUser(): boolean {
  if (process.platform !== "linux" || !process.getuid || !process.getgid) return false;
  process.env.SMITHABLE_PROJECT_UID = String(process.getuid());
  process.env.SMITHABLE_PROJECT_GID = String(process.getgid());
  forgetProjectUserForTests();
  return true;
}

test("a call's arguments and answer keep their Maps and bytes", () => {
  const value = {
    map: new Map([["a", 1]]),
    bytes: new Uint8Array([1, 2, 255]),
    buffer: Buffer.from("hi"),
    gone: undefined,
    list: [1, "two"],
  };
  const back = decode(encode(value)) as Record<string, unknown>;
  expect(back.map).toEqual(new Map([["a", 1]]));
  expect(back.bytes).toEqual(new Uint8Array([1, 2, 255]));
  expect(Buffer.from(back.buffer as Uint8Array).toString()).toBe("hi");
  expect("gone" in back).toBe(false);
  expect(back.list).toEqual([1, "two"]);
});

test("given a project user, the app's database and the tree are worked on by a child, with the same results", () => {
  const dir = tempDir();
  mkdirSync(join(dir, "data", "db"), { recursive: true });
  const db = new DatabaseSync(databasePath(dir));
  db.exec(`CREATE TABLE "item" ("name" text); INSERT INTO "item" VALUES ('a'), ('a'), ('b');`);
  db.close();
  expect(countValue(dir, "item", "name", "a")).toBe(2);
  expect(childCallsForTests()).toBe(0);
  if (!asOwnUser()) return;
  expect(countValue(dir, "item", "name", "a")).toBe(2);
  expect(snapshotDatabase(dir, "one")).toBe(true);
  const after = new DatabaseSync(databasePath(dir));
  after.exec(`DELETE FROM "item"`);
  after.close();
  expect(countValue(dir, "item", "name", "a")).toBe(0);
  expect(restoreDatabase(dir, "one")).toBe(true);
  expect(countValue(dir, "item", "name", "a")).toBe(2);
  // An error in the child is the caller's error, with its message.
  expect(() => keepImport(dir, "../out", "x")).toThrow("Invalid import id");
  // A file in a folder that would not give it the project's group is written by the child.
  writeTreeFile(join(dir, "new", "deep", "file.txt"), "text");
  expect(readFileSync(join(dir, "new", "deep", "file.txt"), "utf8")).toBe("text");
  removeTree(join(dir, "new"));
  expect(statSync(join(dir, "new"), { throwIfNoEntry: false })).toBeUndefined();
  expect(childCallsForTests()).toBe(8);
});

test("the child knows where every function run as the project's user lives", async () => {
  const main = readFileSync(new URL("./as-project-main.ts", import.meta.url), "utf8");
  const src = new URL(".", import.meta.url);
  const { readdirSync } = await import("node:fs");
  for (const file of readdirSync(src).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")))
    for (const [, name] of readFileSync(new URL(file, src), "utf8").matchAll(
      /asProject\(\s*"(\w+)"/g,
    ))
      expect(main, `${name} in ${file}`).toContain(
        `  ${name}: () => import("./${file.replace(/\.ts$/, ".js")}"),`,
      );
});
