import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { run } from "./cli.js";
import { tempDir } from "./test-dir.js";
import { captureIo } from "./test-io.js";

const examples = new URL("../../../examples/", import.meta.url).pathname;

test("validate accepts a directory and summarizes a valid spec", async () => {
  const io = captureIo();
  const path = join(examples, "crm");
  expect(await run(["validate", path], io)).toBe(0);
  // The verdict first; then the notes (advice, with the operation that does it), the starter's one.
  expect(
    io.stdout.startsWith(`${join(path, "smithable.yml")} is valid: 3 models, 5 pages.\n`),
  ).toBe(true);
  expect(io.stdout).toContain("1 note, advice the app is fine without:");
  expect(io.stdout).toContain("do: smithable op setFilters --page customers --fields segment");
});

test("validate reports errors with file, line and column, and exits with 1", async () => {
  const file = join(tempDir("smithable-"), "smithable.yml");
  writeFileSync(
    file,
    "smithable: 0.1\napp:\n  name: X\nmodels:\n  Customer:\n    fields:\n      name: strng\n",
  );
  writeFileSync(
    file.replace("smithable.yml", "smithable.auth.yml"),
    "smithableAuth: 0.1\nsignIn: none\n",
  );
  const io = captureIo();
  expect(await run(["validate", file], io)).toBe(1);
  expect(io.stderr).toBe(
    `${file}:7:13  error  Field "Customer.name": Unknown field type "strng".\n` +
      `    hint: Did you mean "string"?\n\n1 error in ${file}.\n`,
  );
});

test("validate explains a missing spec", async () => {
  const dir = tempDir("smithable-");
  const io = captureIo();
  expect(await run(["validate", dir], io)).toBe(1);
  expect(io.stderr).toBe(`No spec found at ${join(dir, "smithable.yml")}.\n`);
});

test("validate requires smithable.auth.yml and checks it against the spec", async () => {
  const dir = tempDir("smithable-");
  writeFileSync(
    join(dir, "smithable.yml"),
    "smithable: 0.1\napp: { name: X }\nmodels:\n  Note: { fields: { text: string } }\n",
  );
  const missing = captureIo();
  expect(await run(["validate", dir], missing)).toBe(1);
  expect(missing.stderr).toContain("smithable.auth.yml is missing");

  writeFileSync(
    join(dir, "smithable.auth.yml"),
    "smithableAuth: 0.1\nsignIn: none\npublic: { read: [Nte] }\n",
  );
  const io = captureIo();
  expect(await run(["validate", dir], io)).toBe(1);
  expect(io.stderr).toContain('There is no model named "Nte" in smithable.yml.');
});

test("validate --explain says what a hero's buttons open, by rule or as written", async () => {
  const io = captureIo();
  expect(await run(["validate", join(examples, "kiosk"), "--explain"], io)).toBe(0);
  expect(io.stdout).toMatch(
    /where hero: button opens \w+ \(by rule: .*; say it with button\); no second button \(secondButton\)/,
  );
  const invoicing = captureIo();
  expect(await run(["validate", join(examples, "invoicing"), "--explain"], invoicing)).toBe(0);
  expect(invoicing.stdout).toContain("home hero: button opens overview; no second button");
});

test("Explain says which theme defaults apply, which explicit UX masks, and why others skip", async () => {
  const dir = tempDir("smithable-look-defaults-explain-");
  writeFileSync(
    join(dir, "smithable.yml"),
    "smithable: 0.1\napp: {name: Notes}\nmodels: {Note: {fields: {name: string!}}}\npages:\n  home: {route: /, landing: {hero: {}}}\n  notes: {crud: Note}\n",
  );
  writeFileSync(
    join(dir, "smithable.auth.yml"),
    "smithableAuth: 0.1\nsignIn: none\npublic: {pages: [home, notes], read: [Note]}\n",
  );
  writeFileSync(
    join(dir, "smithable.ux.yml"),
    "smithableUx: 0.1\ntheme: {preset: direction}\nnavigation: sidebar\n",
  );
  mkdirSync(join(dir, "themes"));
  writeFileSync(
    join(dir, "themes/direction.yml"),
    'smithableTheme: 0.1\nmodes: light\nlight: {background: "#ffffff", foreground: "#111111", primary: "#2255aa"}\ndefaults: {app: {navigation: topbar}, kinds: {crud: {record: {header: summary}}}, sections: {hero: {layout: cover}}}\n',
  );
  const io = captureIo();
  expect(await run(["validate", dir, "--explain"], io)).toBe(0);
  expect(io.stdout).toContain("pages.home.sections.hero.layout: cover (theme direction default)");
  expect(io.stdout).toContain("navigation: explicit UX masks theme direction default topbar");
  expect(io.stdout).toContain(
    "pages.notes.record.header: theme direction default summary skipped:",
  );
  expect(io.stdout).toContain("no status, amount or date fields");
});
