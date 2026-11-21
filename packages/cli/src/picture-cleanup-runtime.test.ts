import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
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
import { expect, test, vi } from "vitest";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Studio }
models:
  Instructor:
    fields:
      name: string!
      portrait: picture
pages:
  instructors: { crud: Instructor }
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\npublic: { read: [Instructor] }\n",
  },
  ir,
).auth as AuthIR;
const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";

test("generated post-commit picture cleanup is fenced and rechecks current references", async () => {
  vi.useFakeTimers();
  const root = mkdtempSync(join(tmpdir(), "picture-cleanup-"));
  const path = join(root, "app.db");
  const raw = new DatabaseSync(path),
    other = new DatabaseSync(path);
  raw.exec("PRAGMA journal_mode=WAL;PRAGMA busy_timeout=0;CREATE TABLE records(file TEXT)");
  const source = file("src/generated/instructor.server.ts");
  const at = source.indexOf("if (row.portrait && row.portrait.file !== changed.portrait?.file)");
  const end = "    });";
  const cleanup = source.slice(
    source.lastIndexOf("    cleanUploads", at),
    source.indexOf(end, at) + end.length,
  );
  let present = true;
  let receiptActive = false;
  const db = {
    transaction(fn: () => void, options: { behavior: string }) {
      try {
        raw.exec(options.behavior === "immediate" ? "BEGIN IMMEDIATE" : "BEGIN");
      } catch (error) {
        throw Object.assign(error as Error, { code: "SQLITE_BUSY" });
      }
      try {
        fn();
        raw.exec("COMMIT");
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
    select: () => ({
      from: () => ({
        where: () => ({
          get: () => raw.prepare("SELECT 1 FROM records WHERE file='old.webp'").get(),
        }),
      }),
    }),
  };
  const kit = stripTypeScriptTypes(
    readFileSync(
      new URL("../../adapter-tanstack/templates/src/kit/receipts.server.ts", import.meta.url),
      "utf8",
    )
      .replace(/^import[\s\S]*?;\n/gm, "")
      .replace(/\bexport /g, "")
      .replace(/import\.meta\.env\.SSR/g, "false"),
  );
  const logger = { error: vi.fn() };
  const cleanUploads = new Function("db", "log", `${kit}; return cleanUploads;`)(db, logger);
  const run = new Function(
    "db",
    "row",
    "changed",
    "deletePicture",
    "dropCopies",
    "schema",
    "sql",
    "keepsUpload",
    "cleanUploads",
    cleanup,
  );
  const drop = () =>
    run(
      db,
      { portrait: { file: "old.webp" } },
      { portrait: null },
      (_file: unknown, used: boolean) => {
        expect(() => other.exec("BEGIN IMMEDIATE")).toThrow(/locked/);
        if (!used) present = false;
      },
      // The picture is removed, not kept with fewer copies: nothing for dropCopies.
      () => {},
      { instructors: { id: "id", portrait: "portrait" } },
      () => "condition",
      () => receiptActive,
      cleanUploads,
    );
  try {
    other.exec("BEGIN IMMEDIATE");
    expect(drop).not.toThrow();
    expect(vi.getTimerCount()).toBe(1);
    expect(present).toBe(true);
    other.exec("ROLLBACK;INSERT INTO records VALUES('old.webp')");
    await vi.advanceTimersByTimeAsync(1000);
    drop();
    expect(present).toBe(true);
    other.exec("DELETE FROM records");
    receiptActive = true;
    drop();
    expect(present).toBe(true);
    receiptActive = false;
    drop();
    expect(present).toBe(false);
    expect(logger.error).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
    if (other.isTransaction) other.exec("ROLLBACK");
    other.close();
    raw.close();
    rmSync(root, { recursive: true, force: true });
  }
});

/** A WebP file with an extended header of the given size, `extra` bytes of body after it. */
function webp(width: number, height: number, extra = 0, fill = 0): Uint8Array {
  const three = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];
  const payload = [0, 0, 0, 0, ...three(width - 1), ...three(height - 1)];
  payload.push(...new Array(extra).fill(fill));
  const size = (n: number) => [...three(n), (n >> 24) & 255];
  const chars = (t: string) => [...t].map((c) => c.charCodeAt(0));
  return new Uint8Array([
    ...chars("RIFF"),
    ...size(4 + 8 + payload.length),
    ...chars("WEBP"),
    ...chars("VP8X"),
    ...size(payload.length),
    ...payload,
  ]);
}

test("a smaller copy two records share stays while one still lists it, and goes after the other drops it (T1077)", async () => {
  const root = mkdtempSync(join(tmpdir(), "picture-copies-"));
  process.env.DATA_DIR = root;
  const uploadsPath: string = "../../adapter-tanstack/templates/src/kit/uploads.ts";
  type Stored = { file: string; width: number; height: number; smaller?: { file: string }[] };
  const kit = (await import(uploadsPath)) as {
    savePicture(model: string, bytes: Uint8Array, alt: string): Stored;
    saveSmaller(model: string, bytes: Uint8Array, main: object): { file: string };
    deletePicture(picture: Stored, stillUsed: boolean, used?: (file: string) => boolean): void;
    dropCopies(before: Stored | null, after: Stored | null, used: (file: string) => boolean): void;
  };
  const raw = new DatabaseSync(":memory:");
  raw.exec("CREATE TABLE instructors(id INTEGER PRIMARY KEY, portrait TEXT)");
  // The generated update's cleanup, run with the real kit against this table: sql`` becomes
  // SQLite text with each column named and each value a parameter.
  const source = file("src/generated/instructor.server.ts");
  const at = source.indexOf("dropCopies(row.portrait, changed.portrait,");
  const cleanup = source.slice(
    source.lastIndexOf("    cleanUploads", at),
    source.indexOf("    });", at) + 7,
  );
  const column = (name: string) => ({ column: name });
  const sql = (parts: TemplateStringsArray, ...values: unknown[]) => ({
    text: parts.reduce((all, part, i) => {
      const value = values[i];
      const named = typeof value === "object" && value ? (value as { column: string }).column : "?";
      return all + part + (i < values.length ? named : "");
    }, ""),
    params: values.filter((v) => typeof v !== "object") as string[],
  });
  const db = {
    select: () => ({
      from: () => ({
        where: (where: { text: string; params: string[] }) => ({
          get: () =>
            raw.prepare(`SELECT id FROM instructors WHERE ${where.text}`).get(...where.params),
        }),
      }),
    }),
  };
  const run = new Function(
    "db",
    "row",
    "changed",
    "deletePicture",
    "dropCopies",
    "schema",
    "sql",
    "keepsUpload",
    "cleanUploads",
    cleanup,
  );
  const mainBytes = webp(1200, 800, 400);
  const main = kit.savePicture("instructor", mainBytes, "");
  const copy = kit.saveSmaller("instructor", webp(480, 320, 30, 9), {
    width: 1200,
    height: 800,
    bytes: mainBytes.length,
  });
  const copyPath = join(root, "uploads", copy.file);
  const withCopy = { ...main, smaller: [copy] };
  const without = { ...main, smaller: [] };
  raw.exec(
    `INSERT INTO instructors VALUES (1, '${JSON.stringify(withCopy)}'), (2, '${JSON.stringify(withCopy)}')`,
  );
  // An update of one record: the table holds its new value, the cleanup runs on before and after.
  const update = (id: number) => {
    raw
      .prepare("UPDATE instructors SET portrait = ? WHERE id = ?")
      .run(JSON.stringify(without), id);
    run(
      db,
      { portrait: withCopy },
      { portrait: without },
      kit.deletePicture,
      kit.dropCopies,
      { instructors: { id: column("id"), portrait: column("portrait") } },
      sql,
      () => false,
      (clean: () => void) => clean(),
    );
  };
  try {
    update(1);
    expect(existsSync(copyPath)).toBe(true);
    update(2);
    expect(existsSync(copyPath)).toBe(false);
    expect(existsSync(join(root, "uploads", main.file))).toBe(true);
  } finally {
    raw.close();
    rmSync(root, { recursive: true, force: true });
  }
});
