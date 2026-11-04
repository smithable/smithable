import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { generateApp } from "@smithable/adapter-tanstack";
import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { tempDir } from "./test-dir.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Mail fixture }
models:
  Request:
    fields: { title: string!, email: email!, body: text, attachments: files }
pages:
  requests: { crud: Request }
incoming:
  support:
    mail: true
    create: Request
    fields: { from: email, subject: title, body: body, attachments: attachments }
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: all }\n",
  },
  ir,
).auth as AuthIR;
const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
const file = (path: string) => files.find((file) => file.path === path);
test("mail attachment admission failure cleans earlier stored attachments", async () => {
  const route = file("src/routes/incoming/support.ts")?.content ?? "";
  const source = /async function saved\([\s\S]*?^}/m.exec(route)?.[0];
  expect(source).toBeTruthy();
  const removed: string[] = [];
  const released: unknown[] = [];
  let admissions = 0;
  const failure = new Error("quota scan failed");
  const saved = new Function(
    "Buffer",
    "text",
    "reserveUpload",
    "FILE_MAX_BYTES",
    "ATTACHMENTS_MAX",
    "discardUploads",
    "storeUpload",
    "caller",
    "answer",
    "scanned",
    "saveFile",
    "BadFile",
    "release",
    `${stripTypeScriptTypes(source ?? "")}; return saved;`,
  )(
    Buffer,
    (v: unknown) => String(v ?? ""),
    async () => {
      if (++admissions === 2) throw failure;
      return { active: true };
    },
    100,
    10,
    (files: { file: string }[]) => {
      for (const file of files) removed.push(file.file);
    },
    (_u: string, _m: string, _f: string, _uses: unknown, store: () => unknown) => ({
      ...(store() as object),
      receipt: "receipt",
    }),
    { id: "incoming" },
    (status: number, body: unknown) => ({ status, body }),
    async () => {},
    () => ({ file: "record/stored.txt" }),
    class BadFile extends Error {},
    (held: unknown) => released.push(held),
  ) as (mail: unknown, model: string, field: string, uses: () => boolean) => Promise<unknown>;
  await expect(
    saved(
      { attachments: [{ data: "eA==" }, { data: "eQ==" }] },
      "record",
      "attachments",
      () => false,
    ),
  ).rejects.toBe(failure);
  expect(removed).toEqual(["record/stored.txt"]);
  expect(released).toHaveLength(2);
});

test("failed incoming mail releases only its own claim while another deduplicated attachment is pending", async () => {
  const root = tempDir("mail-claims-"),
    blob = join(root, "shared.txt");
  const raw = new DatabaseSync(join(root, "app.db"));
  let beforeExistCheck: (() => void) | undefined;
  raw.exec(
    "PRAGMA journal_mode=WAL;PRAGMA busy_timeout=0;CREATE TABLE uploads(id INTEGER PRIMARY KEY, receipt TEXT, file TEXT, model TEXT, field TEXT, uploader TEXT, at INTEGER, attached INTEGER NOT NULL DEFAULT 0); CREATE TABLE records(file TEXT)",
  );
  type Condition = { sql: string; args: unknown[] };
  const compare =
    (op: string) =>
    (column: string, value: unknown): Condition => ({
      sql: `${column} ${op} ?`,
      args: [
        value instanceof Date
          ? value.getTime()
          : typeof value === "boolean"
            ? Number(value)
            : value,
      ],
    });
  const and = (...parts: Condition[]): Condition => ({
    sql: parts.map((p) => `(${p.sql})`).join(" AND "),
    args: parts.flatMap((p) => p.args),
  });
  const db = {
    select: () => ({
      from: () => ({
        where: (c: Condition) => ({
          get: () =>
            raw.prepare(`SELECT * FROM uploads WHERE ${c.sql}`).get(...(c.args as never[])),
          all: () =>
            raw.prepare(`SELECT * FROM uploads WHERE ${c.sql}`).all(...(c.args as never[])),
        }),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        run: () => {
          const row = { ...values, at: Date.now() };
          const keys = Object.keys(row);
          raw
            .prepare(
              `INSERT INTO uploads(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
            )
            .run(...(Object.values(row) as never[]));
        },
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: (c: Condition) => ({
          run: () =>
            raw
              .prepare(
                `UPDATE uploads SET ${Object.keys(values)
                  .map((key) => `${key}=?`)
                  .join(",")} WHERE ${c.sql}`,
              )
              .run(
                ...([
                  ...Object.values(values).map((value) =>
                    typeof value === "boolean" ? Number(value) : value,
                  ),
                  ...c.args,
                ] as never[]),
              ),
        }),
      }),
    }),
    delete: () => ({
      where: (c: Condition) => ({
        run: () => raw.prepare(`DELETE FROM uploads WHERE ${c.sql}`).run(...(c.args as never[])),
      }),
    }),
    transaction: <T>(fn: () => T, options?: { behavior?: string }): T => {
      raw.exec(options?.behavior === "immediate" ? "BEGIN IMMEDIATE" : "BEGIN");
      try {
        const result = fn();
        raw.exec("COMMIT");
        return result;
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const receiptSource = stripTypeScriptTypes(
    readFileSync(
      new URL("../../adapter-tanstack/templates/src/kit/receipts.server.ts", import.meta.url),
      "utf8",
    )
      .replace(/^import[\s\S]*?;\n/gm, "")
      .replace(/\bexport /g, "")
      .replace("import.meta.env.SSR", "false"),
  );
  const kit = new Function(
    "db",
    "uploads",
    "and",
    "eq",
    "gt",
    "lte",
    "randomBytes",
    "hasUpload",
    "deleteFile",
    "BadInput",
    "w",
    "log",
    `${receiptSource}; return {storeUpload,discardUploads,keepsUpload,acceptFiles};`,
  )(
    db,
    {
      id: "id",
      receipt: "receipt",
      file: "file",
      model: "model",
      field: "field",
      uploader: "uploader",
      at: "at",
      attached: "attached",
    },
    and,
    compare("="),
    compare(">"),
    compare("<="),
    randomBytes,
    () => {
      const exists = existsSync(blob);
      const interleave = beforeExistCheck;
      beforeExistCheck = undefined;
      interleave?.();
      return exists;
    },
    (_: unknown, used: boolean) => {
      if (!used && existsSync(blob)) unlinkSync(blob);
    },
    Error,
    { fileNotUploaded: "missing receipt" },
    {
      error: (_: string, detail: unknown) => {
        throw new Error(JSON.stringify(detail));
      },
    },
  );
  const route = file("src/routes/incoming/support.ts")?.content ?? "";
  const savedSource = /async function saved\([\s\S]*?^}/m.exec(route)?.[0];
  expect(savedSource).toBeTruthy();
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  const waiting = new Promise<void>((done) => {
    entered = done;
  });
  let admissions = 0;
  const saved = new Function(
    "Buffer",
    "text",
    "reserveUpload",
    "FILE_MAX_BYTES",
    "ATTACHMENTS_MAX",
    "discardUploads",
    "storeUpload",
    "caller",
    "answer",
    "scanned",
    "saveFile",
    "BadFile",
    "release",
    `${stripTypeScriptTypes(savedSource ?? "")}; return saved;`,
  )(
    Buffer,
    (v: unknown) => String(v ?? ""),
    async () => {
      if (++admissions === 2) {
        entered();
        await gate;
        throw new Error("first mail failed");
      }
      return {};
    },
    100,
    10,
    kit.discardUploads,
    kit.storeUpload,
    { id: "key:incoming-support" },
    (status: number, body: unknown) => Response.json(body, { status }),
    async () => {},
    () => {
      if (!existsSync(blob)) writeFileSync(blob, "literal shared attachment");
      return { file: "request/shared.txt", name: "shared.txt", type: "text/plain", size: 25 };
    },
    class BadFile extends Error {},
    () => {},
  );
  const uses = (name: string) =>
    kit.keepsUpload(name) || !!raw.prepare("SELECT 1 FROM records WHERE file=?").get(name);
  try {
    const first = saved(
      { attachments: [{ data: "eA==" }, { data: "eQ==" }] },
      "request",
      "attachments",
      uses,
    );
    const rejected = expect(first).rejects.toThrow("first mail failed");
    await waiting;
    const second = await saved({ attachments: [{ data: "eA==" }] }, "request", "attachments", uses);
    expect(raw.prepare("SELECT count(*) AS n FROM uploads").get()?.n).toBe(2);
    release();
    await rejected;
    expect(raw.prepare("SELECT count(*) AS n FROM uploads").get()?.n).toBe(1);
    expect(readFileSync(blob, "utf8")).toBe("literal shared attachment");
    // A rejected record transaction must keep the receipt for a retry.
    raw.exec("BEGIN IMMEDIATE");
    kit.acceptFiles({ id: "key:incoming-support" }, "request", "attachments", second);
    expect(raw.prepare("SELECT attached FROM uploads").get()?.attached).toBe(1);
    raw.exec("ROLLBACK");
    expect(raw.prepare("SELECT attached FROM uploads").get()?.attached).toBe(0);
    const accepted = db.transaction(() => {
      const accepted = kit.acceptFiles(
        { id: "key:incoming-support" },
        "request",
        "attachments",
        second,
      );
      raw.prepare("INSERT INTO records VALUES(?)").run(accepted[0].file);
      return accepted;
    });
    expect(raw.prepare("SELECT attached FROM uploads").get()?.attached).toBe(1);
    expect(kit.keepsUpload(accepted[0].file)).toBe(false);
    expect(accepted[0].receipt).toBeUndefined();
    expect(() =>
      kit.acceptFiles({ id: "key:incoming-support" }, "request", "attachments", second),
    ).not.toThrow();
    expect(() => kit.acceptFiles({ id: "another" }, "request", "attachments", second)).toThrow(
      "missing receipt",
    );
    kit.discardUploads(second, uses);
    expect(existsSync(blob)).toBe(true);
    raw.exec("DELETE FROM records");
    kit.discardUploads(second, uses);
    expect(existsSync(blob)).toBe(false);
    // A reusable attached claim is not a pending hold. If another writer removes the
    // last record after a deferred reader validates bytes, the stale reader must fail
    // its writer upgrade rather than commit a reference to the removed file.
    const reused = kit.storeUpload("key:incoming-support", "request", "attachments", uses, () => {
      writeFileSync(blob, "literal shared attachment");
      return { file: "request/shared.txt" };
    });
    raw.exec("UPDATE uploads SET attached=1;INSERT INTO records VALUES('request/shared.txt')");
    const cleaner = new DatabaseSync(join(root, "app.db"));
    try {
      beforeExistCheck = () => {
        cleaner.exec("BEGIN IMMEDIATE;DELETE FROM records");
        expect(cleaner.prepare("SELECT count(*) AS n FROM uploads WHERE attached=0").get()?.n).toBe(
          0,
        );
        unlinkSync(blob);
        cleaner.exec("COMMIT");
      };
      expect(() =>
        db.transaction(() => {
          const sent = kit.acceptFiles({ id: "key:incoming-support" }, "request", "attachments", [
            reused,
          ]);
          raw.prepare("INSERT INTO records VALUES(?)").run(sent[0].file);
        }),
      ).toThrow(/locked/i);
      expect(raw.prepare("SELECT count(*) AS n FROM records").get()?.n).toBe(0);
      expect(existsSync(blob)).toBe(false);
    } finally {
      cleaner.close();
    }
  } finally {
    release();
    raw.close();
  }
});
