import { expect, test } from "vitest";
import { safeRelative } from "./backup.js";
import { tempDir } from "./test-dir.js";

test("a restored file stays inside the restore folder", () => {
  expect(safeRelative("db/app.db")).toBe("db/app.db");
  for (const key of ["../../etc/passwd", "/etc/passwd", "db/../../x", "a//b", "..\\x"])
    expect(() => safeRelative(key)).toThrow(/unsafe file name/);
});

test("restore takes the newest backup, not a stray folder that sorts after the times", async () => {
  const { mkdirSync, readFileSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { restore } = await import("./backup.js");
  const root = tempDir("restore-");
  const project = join(root, "project");
  mkdirSync(project);
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "acme-crm" }));
  for (const [folder, content] of [
    ["20261001-120000", "old"],
    ["20261002-120000", "new"],
  ] as const) {
    mkdirSync(join(root, "store", "acme-crm", folder), { recursive: true });
    writeFileSync(join(root, "store", "acme-crm", folder, "app.db"), content);
  }
  // An earlier `--to <folder>/acme-crm` nests a folder of the app's name: not a backup.
  mkdirSync(join(root, "store", "acme-crm", "acme-crm", "20261003-120000"), { recursive: true });
  const io = { out: () => {}, err: () => {} };
  expect(await restore(project, io, { from: join(root, "store") })).toBe(0);
  expect(readFileSync(join(project, "data", "db", "app.db"), "utf8")).toBe("new");
});
