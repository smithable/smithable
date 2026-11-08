import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { run } from "./cli.js";
import { affects, allFixes, type Fix, migrationKind, readFix } from "./fixes.js";
import { tempDir } from "./test-dir.js";
import { captureIo } from "./test-io.js";

const examples = new URL("../../../examples/", import.meta.url).pathname;
const project = (name: string) => {
  const dir = tempDir(`smithable-fix-${name}-`);
  cpSync(join(examples, name), dir, { recursive: true });
  return dir;
};
const fix = (affects: Fix["affects"]): Fix => ({
  id: "x",
  title: "X.",
  severity: "fix",
  exposure: "none",
  introduced: "unknown",
  affects,
  migration: "none",
});

test("every fix file this engine carries is valid, and a broken one says what is wrong", () => {
  expect(allFixes().length).toBeGreaterThan(0);
  const read = readFix(
    "bad.yml",
    "id: other\nseverity: high\nmigration: some\nintroduced: yesterday\naffects:\n  features: [field:colour]\n  kit: [../server.mjs]\nextra: 1\n",
  );
  expect("errors" in read && read.errors).toEqual(
    expect.arrayContaining([
      'bad.yml: unknown key "extra"',
      'bad.yml: "title" is missing',
      'bad.yml: its id is "other"; the file must be fixes/other.yml',
      'bad.yml: "severity" is urgent, security, fix',
      'bad.yml: "migration" is none, additive, destructive',
      'bad.yml: "introduced" is an engine commit or "unknown"',
      'bad.yml: unknown feature "field:colour"',
      'bad.yml: a kit path is the app\'s, like src/kit/Upload.tsx: "../server.mjs"',
    ]),
  );
  expect(
    readFix(
      "none.yml",
      "id: none\ntitle: T.\nseverity: fix\nexposure: none\nintroduced: unknown\nmigration: none\n",
    ),
  ).toEqual({
    errors: ["none.yml: affects names no kit file, feature or package"],
  });
});

test("a fix affects an app by its kit files, packages or features, read from the spec alone", () => {
  const barbers = project("barbers");
  const crm = project("crm");
  expect(affects(barbers, fix({ features: ["section:outgoing"] }))).toMatchObject({
    answer: "yes",
  });
  expect(affects(crm, fix({ features: ["section:outgoing"] }))).toMatchObject({ answer: "no" });
  expect(affects(crm, fix({ features: ["any"] }))).toMatchObject({ answer: "yes" });
  expect(affects(crm, fix({ features: ["field:reference"] }))).toMatchObject({ answer: "yes" });
  expect(affects(crm, fix({ features: ["page:crud"] }))).toMatchObject({ answer: "yes" });
  mkdirSync(join(crm, "src", "kit"), { recursive: true });
  writeFileSync(join(crm, "src", "kit", "Upload.tsx"), "");
  expect(affects(crm, fix({ kit: ["src/kit/Upload.tsx"] }))).toEqual({
    answer: "yes",
    reason: "The app has src/kit/Upload.tsx.",
  });
  // No package.json to read: may be affected.
  expect(affects(crm, fix({ stack: ["better-auth"] }))).toMatchObject({ answer: "unknown" });
  writeFileSync(join(crm, "smithable.yml"), "app: [\n");
  expect(affects(crm, fix({ features: ["page:crud"] }))).toMatchObject({ answer: "unknown" });
});

test("smithable affected and fixes answer as JSON", async () => {
  const io = captureIo();
  expect(await run(["affected", "upload-receipts", "--json", "--dir", project("crm")], io)).toBe(0);
  expect(JSON.parse(io.stdout)).toMatchObject({ fix: "upload-receipts", answer: "no" });
  const list = captureIo();
  expect(await run(["fixes", "--json"], list)).toBe(0);
  expect(JSON.parse(list.stdout).fixes.map((f: Fix) => f.id)).toContain("upload-receipts");
  expect(await run(["affected", "nope"], captureIo())).toBe(2);
});

test("a migration only adds, or the build before it may not run on it", () => {
  expect(migrationKind([])).toBe("none");
  expect(
    migrationKind([
      "CREATE TABLE `note` (\n\t`id` integer PRIMARY KEY NOT NULL\n);\n--> statement-breakpoint\nALTER TABLE `customer` ADD `mobile` text;--> statement-breakpoint\nALTER TABLE `customer` ADD `level` integer DEFAULT 0 NOT NULL;--> statement-breakpoint\nCREATE INDEX `note_by` ON `note` (`id`);",
    ]),
  ).toBe("additive");
  expect(migrationKind(["ALTER TABLE `customer` ADD `code` text NOT NULL;"])).toBe("destructive");
  expect(migrationKind(["CREATE UNIQUE INDEX `u` ON `customer` (`email`);"])).toBe("destructive");
  expect(migrationKind(["ALTER TABLE `customer` ADD `age` integer CHECK (`age` > 0);"])).toBe(
    "destructive",
  );
  expect(migrationKind(["ALTER TABLE `customer` DROP COLUMN `notes`;"])).toBe("destructive");
  expect(migrationKind(["CREATE TABLE `a` (`id` integer); -- new\nDROP TABLE `b`;"])).toBe(
    "destructive",
  );
  expect(migrationKind(["ALTER TABLE `t` ADD COLUMN `a` text, DROP COLUMN `b`;"])).toBe(
    "destructive",
  );
  expect(
    migrationKind([
      "PRAGMA foreign_keys=OFF;--> statement-breakpoint\nCREATE TABLE `__new_customer` (`id` integer);",
    ]),
  ).toBe("destructive");
});
