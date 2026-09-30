import { expect, test } from "vitest";
import { run } from "./cli.js";
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
    'Unknown starter "nope". Available: booking, crm, invoicing, records.',
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
