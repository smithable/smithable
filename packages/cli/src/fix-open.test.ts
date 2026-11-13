import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { databasePath } from "./database.js";
import { backFromFix, rememberBeforeFix } from "./fix-open.js";
import { git } from "./git.js";
import { tempDir } from "./test-dir.js";

const commit = (dir: string, message: string) => {
  expect(git(dir, ["add", "-A"]).ok).toBe(true);
  expect(
    git(dir, ["-c", "user.name=T", "-c", "user.email=t@example.com", "commit", "-q", "-m", message])
      .ok,
  ).toBe(true);
};
const tables = (dir: string) => {
  const db = new DatabaseSync(databasePath(dir));
  try {
    return (
      db.prepare("select name from sqlite_master where type = 'table' order by name").all() as {
        name: string;
      }[]
    ).map((r) => r.name);
  } finally {
    db.close();
  }
};

test("a held fix's migrations do not stay on today's dev data once the owner leaves its branch", () => {
  const dir = tempDir("fix-open-");
  writeFileSync(join(dir, ".gitignore"), "data/\n");
  writeFileSync(join(dir, "smithable.yml"), "smithable: 0.1\n");
  expect(git(dir, ["init", "-q", "-b", "main"]).ok).toBe(true);
  commit(dir, "start");
  mkdirSync(join(dir, "data", "db"), { recursive: true });
  const today = new DatabaseSync(databasePath(dir));
  today.exec(
    "create table customers (id integer primary key); insert into customers default values;",
  );
  today.close();
  // Opening the fix: today's data kept, then the held version's code migrates the same database.
  rememberBeforeFix(dir, "fix/stack-1");
  expect(git(dir, ["checkout", "-q", "-b", "fix/stack-1"]).ok).toBe(true);
  const held = new DatabaseSync(databasePath(dir));
  held.exec(
    "create table held_only (id integer primary key); alter table customers add column extra text;",
  );
  held.close();
  // Still on the fix's branch: nothing goes back.
  expect(backFromFix(dir)).toBe(false);
  expect(tables(dir)).toContain("held_only");
  // Back on main: the database as it was before, the held version's tables and columns gone.
  expect(git(dir, ["checkout", "-q", "main"]).ok).toBe(true);
  expect(backFromFix(dir)).toBe(true);
  expect(tables(dir)).toEqual(["customers"]);
  const back = new DatabaseSync(databasePath(dir));
  const columns = (back.prepare("pragma table_info(customers)").all() as { name: string }[]).map(
    (c) => c.name,
  );
  back.close();
  expect(columns).toEqual(["id"]);
  // Once: a later read does nothing.
  expect(backFromFix(dir)).toBe(false);
});
