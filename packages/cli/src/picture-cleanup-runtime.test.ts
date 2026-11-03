import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
