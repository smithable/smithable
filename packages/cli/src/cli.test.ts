import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { run } from "./cli.js";
import { administered } from "./new.js";
import { captureIo } from "./test-io.js";

test("--version prints the Smithable and spec versions", async () => {
  const io = captureIo();
  expect(await run(["--version"], io)).toBe(0);
  expect(io.stdout).toBe("smithable 0.0.0 (spec 0.1)\n");
});

test("no arguments prints help", async () => {
  const io = captureIo();
  expect(await run([], io)).toBe(0);
  expect(io.stdout).toContain("Usage: smithable");
});

test("unknown commands and options fail with exit code 2", async () => {
  const io = captureIo();
  expect(await run(["frobnicate"], io)).toBe(2);
  expect(io.stderr).toContain("Unknown command: frobnicate");
  expect(await run(["--nope"], captureIo())).toBe(2);
});

test("new requires a directory and a known starter", async () => {
  const io = captureIo();
  expect(await run(["new"], io)).toBe(2);
  expect(await run(["new", "x", "--starter", "nope"], io)).toBe(2);
  expect(io.stderr).toContain(
    'Unknown starter "nope". Available: booking, crm, invoicing, marketplace, records, status.',
  );
});

test("a command's own help, an operation's help from its schema, and the completion script", async () => {
  const io = captureIo();
  expect(await run(["deploy", "--help"], io)).toBe(0);
  expect(io.stdout).toContain("Usage: smithable deploy [dir]");
  expect(io.stdout).toContain("--target, --port, --url");
  const op = captureIo();
  expect(await run(["op", "addField", "--help"], op)).toBe(0);
  expect(op.stdout).toContain("Usage: smithable op addField <model> <field> <type>");
  expect(op.stdout).toContain("a model's name");
  // An operation with only options lists them.
  const theme = captureIo();
  expect(await run(["op", "setTheme", "--help"], theme)).toBe(0);
  expect(theme.stdout).toContain("Usage: smithable op setTheme [--preset …]");
  expect(theme.stdout).toContain("Options:\n  --preset (text, optional): A built-in theme");
  expect(theme.stdout).toContain("--density (comfortable or compact, optional)");
  expect(theme.stdout).not.toContain("Arguments:");
  const shell = captureIo();
  expect(await run(["completion", "bash"], shell)).toBe(0);
  expect(shell.stdout).toContain("complete -F _smithable smithable");
  expect(await run(["completion", "tcsh"], captureIo())).toBe(2);
  expect(await run(["nonsense", "--help"], captureIo())).toBe(2);
});

test("__complete offers commands, options and operations", async () => {
  const io = captureIo();
  expect(await run(["__complete", "--", "--", "gen"], io)).toBe(0);
  expect(io.stdout.trim().split("\n")).toEqual(["generate"]);
  const options = captureIo();
  await run(["__complete", "--", "deploy", "--", "--t"], options);
  expect(options.stdout.trim().split("\n")).toEqual(["--target"]);
  const ops = captureIo();
  await run(["__complete", "--", "op", "--", "add"], ops);
  expect(ops.stdout).toContain("addField\n");
  expect(ops.stdout).not.toContain("setAccess");
});

test("a new project's administrator is the one given, never the starter's sample", () => {
  const files = {
    "smithable.auth.yml":
      "smithableAuth: 0.1\nsignIn:\n  providers: [google]\ndefaultAccess: shared\nadmins: [owner@acme.com]   # sample\n",
  };
  expect(administered(files, "Johan@Mine.ax")["smithable.auth.yml"]).toContain(
    "admins: [johan@mine.ax]",
  );
  expect(administered(files, "nobody")["smithable.auth.yml"]).toContain("owner@acme.com");
  const none = { "smithable.auth.yml": "smithableAuth: 0.1\nsignIn: none\n" };
  expect(administered(none, "johan@mine.ax")).toBe(none);
  const without = { "smithable.auth.yml": "smithableAuth: 0.1\nsignIn:\n  providers: [email]\n" };
  expect(administered(without, "johan@mine.ax")["smithable.auth.yml"]).toContain(
    "admins: [johan@mine.ax]",
  );
});

test("validate --json gives every finding with its code, for programs", async () => {
  const dir = mkdtempSync(join(tmpdir(), "smithable-validate-"));
  writeFileSync(
    join(dir, "smithable.yml"),
    "smithable: 0.1\napp: { name: Demo }\nmodels:\n  Member:\n    fields:\n      name: string!\n      cardNumber: string\npages:\n  members: { crud: Member }\n",
  );
  writeFileSync(
    join(dir, "smithable.auth.yml"),
    "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\n",
  );
  const io = captureIo();
  expect(await run(["validate", dir, "--json"], io)).toBe(0);
  expect(io.stderr).toBe("");
  const result = JSON.parse(io.stdout) as {
    valid: boolean;
    diagnostics: { code: string; severity: string; line: number; file: string }[];
  };
  expect(result.valid).toBe(true);
  expect(result.diagnostics.map((d) => `${d.severity} ${d.code} ${d.line}`)).toContain(
    "warning card-data 7",
  );
  expect(result.diagnostics.find((d) => d.code === "card-data")?.file).toBe(
    join(dir, "smithable.yml"),
  );
  // An invalid project: the errors, exit code 1, still one JSON document.
  writeFileSync(
    join(dir, "smithable.yml"),
    "smithable: 0.1\napp: { name: Demo }\nmodels:\n  member: {}\n",
  );
  const bad = captureIo();
  expect(await run(["validate", dir, "--json"], bad)).toBe(1);
  const refused = JSON.parse(bad.stdout) as { valid: boolean; diagnostics: { code: string }[] };
  expect(refused.valid).toBe(false);
  expect(refused.diagnostics.map((d) => d.code)).toContain("invalid-name");
});
