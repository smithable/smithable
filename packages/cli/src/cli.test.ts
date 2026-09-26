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
  expect(io.stderr).toContain('Unknown starter "nope". Available: booking, crm, invoicing.');
});
