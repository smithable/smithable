import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { git } from "./git.js";
import { captureIo } from "./test-io.js";
import { undoableChanges, undoChange } from "./undo.js";

/** A project's history of spec texts (or files by name), each committed as a change, oldest first. */
function history(specs: (string | Record<string, string>)[]): { dir: string; shas: string[] } {
  const dir = mkdtempSync(join(tmpdir(), "smithable-undo-"));
  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  const write = (state: string | Record<string, string>) => {
    const files = typeof state === "string" ? { "smithable.yml": state } : state;
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  };
  write(specs[0] ?? "");
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "smithable: start of history"]);
  const shas: string[] = [];
  specs.slice(1).forEach((state, i) => {
    write(state);
    git(dir, ["add", "-A"]);
    git(dir, [
      "commit",
      "-q",
      "-m",
      `smithable: Change ${i + 1}\n\nSmithable-Op: {"op":"editSpec","args":{}}\nSmithable-Snapshot: none\n`,
    ]);
    shas.push(git(dir, ["rev-parse", "HEAD"]).out);
  });
  return { dir, shas };
}

// Changes to parts far enough apart that git's revert applies cleanly (adjacent lines clash).
const base = `smithable: 0.1
app:
  name: Shop
  description: A shop.
models:
  Customer:
    description: Who buys.
    fields:
      name: string!
      email: email
      notes: text
  Product:
    description: What is sold.
    fields:
      title: string!
      price: money
      stock: int
pages:
  customers: { crud: Customer }
  products: { crud: Product }
`;
const withOrder = `${base}  Order:\n    fields: { total: money }\n`.replace(
  "pages:\n  customers: { crud: Customer }\n  products: { crud: Product }\n  Order:\n    fields: { total: money }\n",
  "  Order:\n    fields: { total: money }\npages:\n  customers: { crud: Customer }\n  products: { crud: Product }\n",
);
const withOrderPage = `${withOrder}  orders: { crud: Order }\n`;
const withPhone = base.replace(
  "      name: string!\n",
  "      name: string!\n      phone: string\n",
);

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("the changes that can be undone, newest first, without the start of history", () => {
  const { dir, shas } = history([base, withOrder, withOrderPage]);
  dirs.push(dir);
  expect(undoableChanges(dir).map((c) => c.sha)).toEqual([...shas].reverse());
});

test("an earlier change a later one depends on is refused with the validator's words", async () => {
  const { dir, shas } = history([base, withOrder, withOrderPage]);
  dirs.push(dir);
  const io = captureIo();
  expect(await undoChange(dir, io, shas[0] ?? "", { check: true })).toBe(1);
  expect(io.stderr).toContain('Cannot undo "Change 1": later changes depend on it.');
  expect(io.stderr).toMatch(/Order/);
});

test("an earlier change nothing depends on is safe; one that drops a column says so", async () => {
  const { dir, shas } = history([
    base,
    withPhone,
    withPhone.replace("pages:", "  Order:\n    fields: { total: money }\npages:"),
  ]);
  dirs.push(dir);
  const io = captureIo();
  expect(await undoChange(dir, io, shas[0]?.slice(0, 8) ?? "", { check: true })).toBe(0);
  expect(io.stdout).toContain('Safe to undo "Change 1". It deletes the Customer.phone column');
});

test("a change a later one edited the same part of cannot be reverted, and nothing is changed", async () => {
  const { dir, shas } = history([
    base,
    base.replace("Shop", "Store"),
    base.replace("Shop", "Market"),
  ]);
  dirs.push(dir);
  const io = captureIo();
  expect(await undoChange(dir, io, shas[0] ?? "", { check: true })).toBe(1);
  expect(io.stderr).toContain("a later change edited the same part");
  expect(git(dir, ["status", "--porcelain"]).out.trim()).toBe("");
});

test("an id that is not a change is refused; the newest change is the plain undo's", async () => {
  const { dir, shas } = history([base, withOrder]);
  dirs.push(dir);
  const io = captureIo();
  expect(await undoChange(dir, io, "abcdef0", { check: true })).toBe(1);
  expect(io.stderr).toContain("No change abcdef0");
  const newest = captureIo();
  expect(await undoChange(dir, newest, shas[0] ?? "", { check: true })).toBe(0);
  expect(newest.stdout).toContain("it is the newest change");
});

test("a change to a companion file alone is undone too, and checked against the spec as it is", async () => {
  const auth = (sells: string, pages: string) => `smithableAuth: 0.1
roles:
  admin: all
  sales:
    description: ${sells}
    pages: [customers]
  support:
    description: Helps.
    pages: [products]
public:
  pages: [${pages}]
`;
  const { dir, shas } = history([
    { "smithable.yml": base, "smithable.auth.yml": auth("Sells.", "") },
    { "smithable.auth.yml": auth("Sells things.", "") },
    { "smithable.auth.yml": auth("Sells things.", "customers") },
  ]);
  dirs.push(dir);
  const io = captureIo();
  const code = await undoChange(dir, io, shas[0] ?? "", { check: true });
  expect(io.stderr).toBe("");
  expect(code).toBe(0);
  expect(io.stdout).toContain('Safe to undo "Change 1".');
});
