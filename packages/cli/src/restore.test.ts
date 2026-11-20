// Apply this version (docs/design/apply-old-version.md §8): a history made through the
// operation layer, a version applied as a new change, and each refusal leaving the project as it
// was. Generation is the adapter's property; here it is stubbed, so the database is made by hand.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, test, vi } from "vitest";
import { databasePath } from "./database.js";
import { ensureRepository, git } from "./git.js";
import { managedOnDisk } from "./managed.js";
import { runOperation } from "./op.js";
import { redo } from "./redo.js";
import { keepAccessKeys, restore, restorePlan, versions } from "./restore.js";
import { captureIo } from "./test-io.js";
import { undoChange, undoLatest } from "./undo.js";

vi.mock("./generate.js", () => ({ generate: vi.fn(async () => 0) }));

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const SPEC =
  "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Customer:\n    fields:\n      name: string!\n      email: email\n      notes: text\npages:\n  customers: { crud: Customer }\n";

const auth = (extra = "") => `smithableAuth: 0.1
admins: [owner@example.com]
signIn:
  providers: [email]
defaultAccess: shared
defaultRole: sales
roles:
  admin: all
  sales:
    pages: [customers]
${extra}`;

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), "smithable-restore-"));
  roots.push(dir);
  writeFileSync(join(dir, ".gitignore"), "data/\n");
  writeFileSync(join(dir, "smithable.yml"), SPEC);
  writeFileSync(join(dir, "smithable.auth.yml"), auth());
  mkdirSync(join(dir, ".smithable"), { recursive: true });
  writeFileSync(join(dir, ".smithable/files.json"), '{"files":{}}\n');
  ensureRepository(dir);
  return dir;
}

async function op(dir: string, name: string, args: Record<string, unknown>): Promise<string> {
  const io = captureIo();
  const code = await runOperation(dir, io, name, args as never, { yes: true });
  expect(io.stderr, name).toBe("");
  expect(code).toBe(0);
  return head(dir);
}

/** Applies a version and expects it to go through, its words shown when it does not. */
async function applied(dir: string, change: string, flags: { yes?: boolean } = {}): Promise<void> {
  const io = captureIo();
  const code = await restore(dir, io, change, flags);
  expect(io.stderr).toBe("");
  expect(code).toBe(0);
}

const head = (dir: string) => git(dir, ["rev-parse", "HEAD"]).out;
const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");

/** A commit of a hand edit, as a change (Studio's editor commits one so). */
function commitEdit(dir: string, file: string, text: string): string {
  mkdirSync(join(dir, file, ".."), { recursive: true });
  writeFileSync(join(dir, file), text);
  git(dir, ["add", "-A"]);
  git(dir, [
    "commit",
    "-q",
    "-m",
    `smithable: Edited ${file}\n\nSmithable-Op: {"op":"editSpec","args":{}}\nSmithable-Snapshot: none\n`,
  ]);
  return head(dir);
}

/** The development database with the tables the tests count in. */
function database(dir: string, sql: string): void {
  mkdirSync(join(dir, "data", "db"), { recursive: true });
  const db = new DatabaseSync(databasePath(dir));
  db.exec(sql);
  db.close();
}

/** The database's tables and rows, which a copy of it keeps (its bytes it need not). */
function dump(dir: string): string {
  const db = new DatabaseSync(databasePath(dir), { readOnly: true });
  try {
    const tables = db
      .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string; sql: string }[];
    return JSON.stringify(
      tables.map((t) => [t.sql, db.prepare(`SELECT * FROM "${t.name}" ORDER BY 1`).all()]),
    );
  } finally {
    db.close();
  }
}

/** Everything a refusal must leave as it was: the head, the folder's state and the files. */
function state(dir: string) {
  return {
    head: head(dir),
    status: git(dir, ["status", "--porcelain"]).out,
    files: managedOnDisk(dir),
    branch: git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]).out,
  };
}

test("§8.1 A → B → undo B → C → apply B: B's files, and B's and C's changes stay in the history", async () => {
  const dir = project();
  const b = await op(dir, "addField", { model: "Customer", field: "phone", type: "string" });
  const bFiles = managedOnDisk(dir);
  expect(await undoLatest(dir, captureIo())).toBe(0);
  const c = await op(dir, "addField", { model: "Customer", field: "level", type: "low | high" });
  // The undone version is listed too.
  expect(versions(dir).find((v) => v.sha === b)?.undone).toBe(true);
  const io = captureIo();
  expect(await restore(dir, io, b.slice(0, 9))).toBe(0);
  expect(io.stderr).toBe("");
  expect(managedOnDisk(dir)).toEqual(bFiles);
  const log = git(dir, ["log", "--format=%H"]).out.split("\n");
  expect(log).toContain(b);
  expect(log).toContain(c);
  const subject = git(dir, ["log", "-1", "--format=%s"]).out;
  expect(subject).toMatch(/^smithable: Applied the version from \d+ \w+, \d\d:\d\d \(after "/);
  const recorded = JSON.parse(
    /^Smithable-Op: (.+)$/m.exec(git(dir, ["log", "-1", "--format=%b"]).out)?.[1] ?? "{}",
  );
  expect(recorded).toMatchObject({ op: "restoreVersion", args: { version: b } });
  // Reopened, the project reads the same files from disk.
  expect(git(dir, ["status", "--porcelain"]).out).toBe("");
  // Applying it again changes nothing, and says so.
  const again = captureIo();
  expect(await restore(dir, again, b)).toBe(1);
  expect(again.stderr).toContain("changes nothing");
});

test("§8.2 a field renamed since the version is renamed back, its values kept", async () => {
  const dir = project();
  const b = await op(dir, "addField", { model: "Customer", field: "phone", type: "string" });
  await op(dir, "renameField", { model: "Customer", from: "phone", to: "mobile" });
  await op(dir, "addField", { model: "Customer", field: "level", type: "int" });
  const plan = restorePlan(dir, b);
  if (typeof plan === "string") throw new Error(plan);
  expect(plan.effects).toContainEqual({
    kind: "rename-field",
    model: "Customer",
    from: "mobile",
    to: "phone",
    storage: "value",
  });
  expect(plan.goes).toEqual(["Customer · level"]);
  expect(plan.comesBack).toEqual([]);
  expect(plan.lost).toEqual([]);
});

test("§8.2 a rename from before the version, undone since, is renamed back the other way", async () => {
  const dir = project();
  await op(dir, "addField", { model: "Customer", field: "phone", type: "string" });
  const b = await op(dir, "renameField", { model: "Customer", from: "phone", to: "mobile" });
  expect(await undoLatest(dir, captureIo())).toBe(0);
  const plan = restorePlan(dir, b);
  if (typeof plan === "string") throw new Error(plan);
  expect(plan.effects).toContainEqual({
    kind: "rename-field",
    model: "Customer",
    from: "phone",
    to: "mobile",
    storage: "value",
  });
  expect(plan.goes).toEqual([]);
  expect(plan.comesBack).toEqual([]);
});

test("§8.3 admins, allowed domains and the API stay as today; a rule that widens is in the access block", async () => {
  const dir = project();
  const wide = auth("public:\n  read: [Customer]\n").replace(
    "admins: [owner@example.com]",
    "admins: [owner@example.com, gone@example.com]",
  );
  const b = commitEdit(
    dir,
    "smithable.auth.yml",
    wide.replace(
      "providers: [email]",
      "providers: [email]\n  allowedDomains: [example.com, old.example]",
    ),
  );
  const today = auth().replace(
    "providers: [email]",
    "providers: [email]\n  allowedDomains: [example.com]",
  );
  commitEdit(dir, "smithable.auth.yml", today);
  const plan = restorePlan(dir, b);
  if (typeof plan === "string") throw new Error(plan);
  const text = plan.files["smithable.auth.yml"] ?? "";
  expect(text).toContain("admins: [owner@example.com]\n");
  expect(text).not.toContain("gone@example.com");
  expect(text).not.toContain("old.example");
  expect(text).toContain("read: [Customer]");
  expect(plan.access).toEqual(["Anyone can read Customer again."]);
  // Access that widens asks first, as a loss does.
  const asked = captureIo();
  expect(await restore(dir, asked, b)).toBe(1);
  expect(asked.stderr).toContain("This version lets more in:\n  Anyone can read Customer again.");
  expect(asked.stderr).toContain("--yes");
  expect(await restore(dir, captureIo(), b, { yes: true })).toBe(0);
  expect(read(dir, "smithable.auth.yml")).toContain("read: [Customer]");
  // A key today lacks is taken out of the version's file.
  expect(
    keepAccessKeys(
      "smithableAuth: 0.1\napi: { offer: [Customer] }\nroles: {}\n",
      "smithableAuth: 0.1\nroles: {}\n",
    ),
  ).not.toContain("api");
});

test("§8.4 undo right after the apply gives the files and database of before; redo asks again", async () => {
  const dir = project();
  // As the migrations leave it (generate is mocked here): level is there, empty.
  database(
    dir,
    "CREATE TABLE customers (id integer primary key, name text, email text, notes text, level integer);",
  );
  const b = await op(dir, "addField", { model: "Customer", field: "phone", type: "string" });
  await op(dir, "removeField", { model: "Customer", field: "phone" });
  await op(dir, "addField", { model: "Customer", field: "level", type: "int" });
  const before = managedOnDisk(dir);
  const dbBefore = dump(dir);
  await applied(dir, b);
  expect(await undoLatest(dir, captureIo())).toBe(0);
  expect(managedOnDisk(dir)).toEqual(before);
  expect(dump(dir)).toEqual(dbBefore);
  // Now a value in level would be lost: Redo plans again and asks.
  database(dir, "INSERT INTO customers (name, level) VALUES ('Ann', 3);");
  const asked = captureIo();
  expect(await redo(dir, asked)).toBe(1);
  expect(asked.stderr).toContain("This version has no place for: Customer · level (1 value).");
  expect(asked.stderr).toContain("--yes");
  expect(await redo(dir, captureIo(), { yes: true })).toBe(0);
  expect(read(dir, "smithable.yml")).toContain("phone");
});

test("§6 undo of an apply whose database copy is gone goes forward, and says the values stay lost", async () => {
  const dir = project();
  database(
    dir,
    "CREATE TABLE customers (id integer primary key, name text, email text, notes text, level integer); INSERT INTO customers (name, level) VALUES ('Ann', 3);",
  );
  const b = await op(dir, "addField", { model: "Customer", field: "phone", type: "string" });
  await op(dir, "removeField", { model: "Customer", field: "phone" });
  await op(dir, "addField", { model: "Customer", field: "level", type: "int" });
  const before = read(dir, "smithable.yml");
  await applied(dir, b, { yes: true });
  const snapshot = /^Smithable-Snapshot: (.+)$/m.exec(
    git(dir, ["log", "-1", "--format=%b"]).out,
  )?.[1];
  expect(snapshot).toBeTruthy();
  rmSync(join(dir, "data", ".smithable", "snapshots", `${snapshot}.db`));
  const io = captureIo();
  expect(await undoLatest(dir, io, { yes: true })).toBe(0);
  expect(io.stdout).toContain("do not come back");
  expect(git(dir, ["log", "-1", "--format=%s"]).out).toMatch(
    /^Revert "smithable: Applied the version/,
  );
  expect(read(dir, "smithable.yml")).toBe(before);
});

test("§8.5 undo of the apply after a later change takes its sample files back too", async () => {
  const dir = project();
  const b = commitEdit(dir, "samples/Customer.yml", "- name: Ann\n");
  rmSync(join(dir, "samples"), { recursive: true });
  git(dir, ["add", "-A"]);
  git(dir, [
    "commit",
    "-q",
    "-m",
    'smithable: Removed the samples\n\nSmithable-Op: {"op":"editSpec","args":{}}\nSmithable-Snapshot: none\n',
  ]);
  await applied(dir, b);
  const apply = head(dir);
  expect(read(dir, "samples/Customer.yml")).toBe("- name: Ann\n");
  await op(dir, "addField", { model: "Customer", field: "level", type: "int" });
  const io = captureIo();
  expect(await undoChange(dir, io, apply)).toBe(0);
  expect(io.stderr).toBe("");
  expect(managedOnDisk(dir)["samples/Customer.yml"]).toBeUndefined();
  expect(read(dir, "smithable.yml")).toContain("level");
});

test("§8.6 each refusal leaves the folder, the database and the history as they were", async () => {
  const dir = project();
  database(
    dir,
    `CREATE TABLE customers (id integer primary key, name text, email text, notes text, level integer);
    INSERT INTO customers (name, level) VALUES ('Ann', 3);
    CREATE TABLE "user" (id text primary key, role text); INSERT INTO "user" VALUES ('u1', 'support'), ('u2', 'support');`,
  );
  const b = await op(dir, "addField", { model: "Customer", field: "phone", type: "string" });
  await op(dir, "addField", { model: "Customer", field: "level", type: "int" });
  commitEdit(dir, "smithable.auth.yml", auth("  support:\n    pages: [customers]\n"));
  const dbBefore = dump(dir);
  const refused = async (
    why: string,
    change: string,
    flags: Parameters<typeof restore>[3] = {},
  ) => {
    const was = state(dir);
    const io = captureIo();
    expect(await restore(dir, io, change, flags)).toBe(1);
    expect(io.stderr).toContain(why);
    expect(state(dir)).toEqual(was);
    expect(dump(dir)).toEqual(dbBefore);
  };
  // A loss and a role people hold ask first.
  const io = captureIo();
  expect(await restore(dir, io, b)).toBe(1);
  expect(io.stderr).toContain("This version has no place for: Customer · level (1 value).");
  expect(io.stderr).toContain("The role support is not in this version; 2 people have it.");
  await refused("no place", b);
  // No such version.
  await refused("No version #999", "#999");
  // Uncommitted work.
  writeFileSync(join(dir, "smithable.ux.yml"), "smithableUx: 0.1\n");
  const dirty = captureIo();
  expect(await restore(dir, dirty, b)).toBe(1);
  expect(dirty.stderr).toContain("Commit or discard these changes first");
  rmSync(join(dir, "smithable.ux.yml"));
  // A version that does not validate with today's files.
  const broken = commitEdit(dir, "smithable.yml", `${SPEC}  ghosts: { crud: Ghost }\n`);
  git(dir, ["revert", "--no-edit", broken]);
  await refused("does not fit the app as it is today", broken.slice(0, 8));
  // Without today's sign-in settings there is nothing to keep them from.
  const noAuth = captureIo();
  rmSync(join(dir, "smithable.auth.yml"));
  git(dir, ["commit", "-qam", "no auth"]);
  expect(await restore(dir, noAuth, b, { yes: true })).toBe(1);
  expect(noAuth.stderr).toContain("has no smithable.auth.yml");
  git(dir, ["revert", "--no-edit", "HEAD"]);
  // A stale revision.
  await refused("The app changed while you were looking", b, {
    yes: true,
    expectedRevision: "0".repeat(40),
  });
  // A failure forced at a later step (the generator) rolls the change back whole.
  const { generate } = await import("./generate.js");
  vi.mocked(generate).mockResolvedValueOnce(1);
  await refused("", b, { yes: true });
  // Records that cannot be counted are never taken as none to lose.
  database(dir, "ALTER TABLE customers RENAME TO customers_away;");
  const unread = captureIo();
  expect(await restore(dir, unread, b, { yes: true })).toBe(1);
  expect(unread.stderr).toContain("could not be read");
});

test("§8.8 a fix branch is refused; two requests at once make one change", async () => {
  const dir = project();
  const b = await op(dir, "addField", { model: "Customer", field: "phone", type: "string" });
  await op(dir, "addField", { model: "Customer", field: "level", type: "int" });
  git(dir, ["checkout", "-q", "-b", "fix/broken"]);
  const io = captureIo();
  expect(await restore(dir, io, b, { yes: true })).toBe(1);
  expect(io.stderr).toContain("fix broken");
  git(dir, ["checkout", "-q", "-"]);
  const count = () => git(dir, ["rev-list", "--count", "HEAD"]).out;
  const was = Number(count());
  const results = await Promise.all([
    restore(dir, captureIo(), b, { yes: true }),
    restore(dir, captureIo(), b, { yes: true }),
  ]);
  expect(results.filter((r) => r === 0)).toHaveLength(1);
  expect(Number(count())).toBe(was + 1);
});
