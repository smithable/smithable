import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test, vi } from "vitest";
import { backup } from "./backup.js";
import { captureProgram } from "./backup-capture.js";
import { tempDir } from "./test-dir.js";

function fixture(blocked = false) {
  const root = tempDir("capture-worker-");
  mkdirSync(join(root, "data", "db"), { recursive: true });
  mkdirSync(join(root, "node_modules", "better-sqlite3"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "capture-worker" }));
  writeFileSync(
    join(root, "node_modules", "better-sqlite3", "package.json"),
    JSON.stringify({ type: "commonjs", main: "index.cjs" }),
  );
  writeFileSync(
    join(root, "node_modules", "better-sqlite3", "index.cjs"),
    `const {DatabaseSync}=require('node:sqlite');
module.exports=class extends DatabaseSync {
  constructor(path,options={}){super(path,{readOnly:Boolean(options.readonly)});}
  exec(sql){const result=super.exec(sql);${blocked ? "if(sql==='BEGIN IMMEDIATE'){require('node:fs').writeFileSync('held','yes');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5000)}" : ""}return result;}
};`,
  );
  const database = join(root, "data", "db", "app.db");
  const db = new DatabaseSync(database);
  db.exec(
    "CREATE TABLE records(id INTEGER PRIMARY KEY,value TEXT);INSERT INTO records VALUES(1,'original')",
  );
  db.close();
  return { root, database };
}

test("a blocked capture reaches its deadline and releases its SQLite writer hold", () => {
  const { root, database } = fixture(true);
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      captureProgram({
        from: database,
        to: join(root, "snapshot.db"),
        uploads: join(root, "data", "uploads"),
        toUploads: join(root, "snapshot-uploads"),
        timeoutMs: 1000,
      }),
    ],
    { cwd: root, encoding: "utf8", timeout: 4000 },
  );
  expect(existsSync(join(root, "held"))).toBe(true);
  expect(result.status, result.stderr).toBeNull();
  expect(result.signal).toBe("SIGKILL");
  expect(result.stderr).toContain("write-pause deadline");
  const writer = new DatabaseSync(database);
  try {
    writer.exec("PRAGMA busy_timeout=0;UPDATE records SET value='after deadline'");
  } finally {
    writer.close();
  }
});

test("capture supports a legacy rollback-journal database with no uploads", () => {
  const { root, database } = fixture();
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      captureProgram({
        from: database,
        to: join(root, "snapshot.db"),
        uploads: join(root, "absent"),
        toUploads: join(root, "snapshot-uploads"),
      }),
    ],
    { cwd: root, encoding: "utf8" },
  );
  expect(result.status, result.stderr).toBe(0);
  const restored = new DatabaseSync(join(root, "snapshot.db"), { readOnly: true });
  try {
    expect(restored.prepare("SELECT value FROM records").get()?.value).toBe("original");
  } finally {
    restored.close();
  }
});

test("a partial content-addressed orphan fails capture before publication", async () => {
  const { root, database } = fixture();
  mkdirSync(join(root, "data", "uploads", "Document"), { recursive: true });
  const name = `${createHash("sha256").update("complete upload").digest("hex").slice(0, 24)}.txt`;
  const path = join(root, "data", "uploads", "Document", name);
  writeFileSync(path, "partial");
  const io = { out: vi.fn(), err: vi.fn() };
  expect(await backup(root, io, { to: join(root, "store") })).toBe(1);
  expect(io.out).not.toHaveBeenCalled();
  expect(io.err.mock.calls.flat().join("")).toContain("Upload content changed during capture");
  expect(existsSync(join(root, "store"))).toBe(false);
  expect(readFileSync(path, "utf8")).toBe("partial");
  const db = new DatabaseSync(database);
  try {
    db.exec("PRAGMA busy_timeout=0;BEGIN IMMEDIATE;ROLLBACK");
  } finally {
    db.close();
  }
});
