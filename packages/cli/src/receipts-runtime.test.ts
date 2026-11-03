import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { tempDir } from "./test-dir.js";

test("expired upload cleanup cannot unlink while another connection holds the writer lock", async () => {
  const root = tempDir("receipt-cleanup-");
  const path = join(root, "app.db");
  const blob = join(root, "upload.txt");
  writeFileSync(blob, "original");
  const raw = new DatabaseSync(path);
  const blocker = new DatabaseSync(path);
  raw.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=0; CREATE TABLE uploads(id INTEGER PRIMARY KEY, file TEXT, model TEXT, at INTEGER); INSERT INTO uploads VALUES(1,'upload.txt','Document',0)",
  );
  type Condition = { sql: string; args: (string | number)[] };
  const compare =
    (op: string) =>
    (column: string, value: string | number | Date): Condition => ({
      sql: `${column} ${op} ?`,
      args: [value instanceof Date ? value.getTime() : value],
    });
  const and = (...conditions: Condition[]): Condition => ({
    sql: conditions.map((c) => `(${c.sql})`).join(" AND "),
    args: conditions.flatMap((c) => c.args),
  });
  const db = {
    select: () => ({
      from: () => ({
        where: (c: Condition) => ({
          all: () => raw.prepare(`SELECT * FROM uploads WHERE ${c.sql}`).all(...c.args),
          get: () => raw.prepare(`SELECT * FROM uploads WHERE ${c.sql}`).get(...c.args),
        }),
      }),
    }),
    delete: () => ({
      where: (c: Condition) => ({
        run: () => raw.prepare(`DELETE FROM uploads WHERE ${c.sql}`).run(...c.args),
      }),
    }),
    transaction: (fn: (tx: unknown) => unknown, options?: { behavior: string }) => {
      raw.exec(options?.behavior === "immediate" ? "BEGIN IMMEDIATE" : "BEGIN");
      try {
        const result = fn(db);
        raw.exec("COMMIT");
        return result;
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const source = stripTypeScriptTypes(
    readFileSync(
      new URL("../../adapter-tanstack/templates/src/kit/receipts.server.ts", import.meta.url),
      "utf8",
    )
      .replace(/^import[\s\S]*?;\n/gm, "")
      .replace(/\bexport /g, "")
      .replace('await import("#/generated/uploads")', "{UPLOADS: injectedUploads}")
      .replace(/import\.meta\.env\.SSR/g, "false"),
  );
  const sweep = new Function(
    "db",
    "uploads",
    "eq",
    "gt",
    "lte",
    "and",
    "deleteFile",
    "injectedUploads",
    `${source}; return sweepUploads;`,
  )(
    db,
    { id: "id", file: "file", at: "at" },
    compare("="),
    compare(">"),
    compare("<="),
    and,
    () => unlinkSync(blob),
    {
      Document: {
        file: {
          data: {
            uses: () => {
              expect(() => blocker.exec("BEGIN IMMEDIATE")).toThrow(/locked/);
              return false;
            },
          },
        },
      },
    },
  ) as (now: number) => Promise<number>;
  try {
    blocker.exec("BEGIN IMMEDIATE");
    await expect(sweep(2 * 86400000)).rejects.toThrow(/locked/);
    expect(existsSync(blob)).toBe(true);
    expect(raw.prepare("SELECT count(*) AS n FROM uploads").get()?.n).toBe(1);
    blocker.exec("ROLLBACK");
    expect(await sweep(2 * 86400000)).toBe(1);
    expect(existsSync(blob)).toBe(false);
    expect(raw.prepare("SELECT count(*) AS n FROM uploads").get()?.n).toBe(0);
  } finally {
    if (blocker.isTransaction) blocker.exec("ROLLBACK");
    blocker.close();
    raw.close();
  }
});

test("receipt creation fences cleanup and rejects a deduplicated file lost before registration", () => {
  const root = tempDir("receipt-registration-");
  const path = join(root, "app.db"),
    blob = join(root, "blob.txt");
  const raw = new DatabaseSync(path),
    other = new DatabaseSync(path);
  raw.exec("PRAGMA journal_mode=WAL;CREATE TABLE receipts(value TEXT)");
  const db = {
    transaction(fn: () => void, options: { behavior: string }) {
      raw.exec(options.behavior === "immediate" ? "BEGIN IMMEDIATE" : "BEGIN");
      try {
        fn();
        raw.exec("COMMIT");
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
    insert: () => ({
      values: (value: { file: string }) => ({
        run: () => raw.prepare("INSERT INTO receipts VALUES(?)").run(value.file),
      }),
    }),
  };
  const source = stripTypeScriptTypes(
    readFileSync(
      new URL("../../adapter-tanstack/templates/src/kit/receipts.server.ts", import.meta.url),
      "utf8",
    )
      .replace(/^import[\s\S]*?;\n/gm, "")
      .replace(/\bexport /g, "")
      .replace(/import\.meta\.env\.SSR/g, "false"),
  );
  const receipt = new Function(
    "db",
    "uploads",
    "hasUpload",
    "BadInput",
    "w",
    "randomBytes",
    `${source};return receiptFor;`,
  )(
    db,
    {},
    () => {
      expect(() => other.exec("BEGIN IMMEDIATE")).toThrow(/locked/);
      return existsSync(blob);
    },
    Error,
    { fileNotUploaded: "missing upload" },
    () => ({ toString: () => "receipt" }),
  ) as (...args: unknown[]) => string;
  try {
    expect(() => receipt("alice", "Document", "file", "blob.txt")).toThrow("missing upload");
    expect(raw.prepare("SELECT count(*) AS n FROM receipts").get()?.n).toBe(0);
    writeFileSync(blob, "saved bytes");
    expect(receipt("alice", "Document", "file", "blob.txt")).toBe("receipt");
    expect(raw.prepare("SELECT count(*) AS n FROM receipts").get()?.n).toBe(1);
  } finally {
    other.close();
    raw.close();
  }
});
