import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { run } from "./cli.js";
import { captureIo } from "./test-io.js";

const examples = new URL("../../../examples/", import.meta.url).pathname;

test("validate accepts a directory and summarises a valid spec", async () => {
  const io = captureIo();
  const path = join(examples, "crm");
  expect(await run(["validate", path], io)).toBe(0);
  expect(io.stdout).toBe(`${join(path, "smithable.yml")} is valid: 2 models, 2 pages.\n`);
});

test("validate reports errors with file, line and column, and exits with 1", async () => {
  const file = join(mkdtempSync(join(tmpdir(), "smithable-")), "smithable.yml");
  writeFileSync(
    file,
    "smithable: 0.1\napp:\n  name: X\nmodels:\n  Customer:\n    fields:\n      name: strng\n",
  );
  const io = captureIo();
  expect(await run(["validate", file], io)).toBe(1);
  expect(io.stderr).toBe(
    `${file}:7:13  error  Field "Customer.name": Unknown field type "strng".\n` +
      `    hint: Did you mean "string"?\n\n1 error in ${file}.\n`,
  );
});

test("validate explains a missing spec", async () => {
  const dir = mkdtempSync(join(tmpdir(), "smithable-"));
  const io = captureIo();
  expect(await run(["validate", dir], io)).toBe(1);
  expect(io.stderr).toBe(`No spec found at ${join(dir, "smithable.yml")}.\n`);
});
