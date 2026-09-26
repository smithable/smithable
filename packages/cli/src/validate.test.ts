import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { run } from "./cli.js";

const examples = new URL("../../../examples/", import.meta.url).pathname;

test("validate accepts a directory and summarises a valid spec", () => {
  const path = join(examples, "crm");
  expect(run(["validate", path])).toEqual({
    code: 0,
    stdout: `${join(path, "smithable.yml")} is valid: 2 models, 2 pages.\n`,
    stderr: "",
  });
});

test("validate reports errors with file, line and column, and exits with 1", () => {
  const dir = mkdtempSync(join(tmpdir(), "smithable-"));
  const file = join(dir, "smithable.yml");
  writeFileSync(
    file,
    "smithable: 0.1\napp:\n  name: X\nmodels:\n  Customer:\n    fields:\n      name: strng\n",
  );
  const result = run(["validate", file]);
  expect(result.code).toBe(1);
  expect(result.stderr).toBe(
    `${file}:7:13  error  Field "Customer.name": Unknown field type "strng".\n` +
      `    hint: Did you mean "string"?\n\n1 error in ${file}.\n`,
  );
});

test("validate explains a missing spec", () => {
  const dir = mkdtempSync(join(tmpdir(), "smithable-"));
  expect(run(["validate", dir])).toEqual({
    code: 1,
    stdout: "",
    stderr: `No spec found at ${join(dir, "smithable.yml")}.\n`,
  });
});
