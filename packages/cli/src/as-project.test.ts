import { mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, test } from "vitest";
import { childCallsForTests, decode, encode } from "./as-project.js";
import {
  countValue,
  databasePath,
  pruneSnapshots,
  restoreDatabase,
  snapshotDatabase,
} from "./database.js";
import { keepImport } from "./import.js";
import { forgetProjectUserForTests } from "./secrets.js";
import { tempDir } from "./test-dir.js";
import { changeTree, removeTree, writeTreeFile } from "./tree-files.js";

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
    set: new Set(["x"]),
    args: [1, undefined, "three"],
    bytes: new Uint8Array([1, 2, 255]),
    buffer: Buffer.from("hi"),
    gone: undefined,
    list: [1, "two"],
  };
  const back = decode(encode(value)) as Record<string, unknown>;
  expect(back.map).toEqual(new Map([["a", 1]]));
  expect(back.set).toEqual(new Set(["x"]));
  const args = back.args as unknown[];
  expect([args.length, args[1], args[2]]).toEqual([3, undefined, "three"]);
  expect(back.bytes).toEqual(new Uint8Array([1, 2, 255]));
  expect(Buffer.from(back.buffer as Uint8Array).toString()).toBe("hi");
  expect("gone" in back).toBe(false);
  expect(back.list).toEqual([1, "two"]);
});

test("an undefined in a list is a value, not a hole, and data shaped like a tag comes back as it went (T1082)", () => {
  const args = decode(encode([1, undefined])) as unknown[];
  expect(1 in args).toBe(true);
  expect(args.map((v) => v ?? "none")).toEqual([1, "none"]);
  const value = {
    set: { $set: [1] },
    map: { $map: [] },
    bytes: { $bytes: "AQ==" },
    undef: { $undefined: true },
    object: { $object: [["a", 1]] },
    nested: { $set: { $map: new Map([["k", new Set([2])]]) } },
    two: { $set: [1], other: 2 },
  };
  expect(decode(encode(value))).toEqual(value);
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
  // A Set arrives as a Set: the kept snapshot stays.
  expect(snapshotDatabase(dir, "two")).toBe(true);
  expect(pruneSnapshots(dir, new Set(["two"]))).toBe(1);
  expect(restoreDatabase(dir, "two")).toBe(true);
  // The tree's changes, in order, in one child: writes with their folders, an append, a removal.
  const file = join(dir, "new", "deep", "file.txt");
  changeTree([
    { path: file, data: "one" },
    { path: file, data: " two", append: true },
    { path: join(dir, "gone.txt"), data: "x" },
    { path: join(dir, "gone.txt"), data: null },
    { path: join(dir, "moved.txt"), data: "m" },
    { path: join(dir, "here.txt"), from: join(dir, "moved.txt") },
  ]);
  expect(readFileSync(join(dir, "here.txt"), "utf8")).toBe("m");
  expect(statSync(join(dir, "moved.txt"), { throwIfNoEntry: false })).toBeUndefined();
  expect(readFileSync(file, "utf8")).toBe("one two");
  expect(statSync(file).gid).toBe(process.getgid?.());
  expect(statSync(join(dir, "gone.txt"), { throwIfNoEntry: false })).toBeUndefined();
  // An error keeps its code.
  expect(() => writeTreeFile(join(dir, "new"), "x")).toThrow(
    expect.objectContaining({ code: "EISDIR" }),
  );
  removeTree(join(dir, "new"));
  expect(statSync(join(dir, "new"), { throwIfNoEntry: false })).toBeUndefined();
  expect(childCallsForTests()).toBe(12);
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
