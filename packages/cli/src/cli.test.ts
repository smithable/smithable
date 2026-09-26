import { expect, test } from "vitest";
import { run } from "./cli.js";

test("--version prints the Smithable and manifest versions", () => {
  expect(run(["--version"])).toEqual({
    code: 0,
    stdout: "smithable 0.0.0 (manifest 0.1)\n",
    stderr: "",
  });
});

test("no arguments prints help", () => {
  const result = run([]);
  expect(result.code).toBe(0);
  expect(result.stdout).toContain("Usage: smithable");
});

test("unknown commands and options fail with exit code 2", () => {
  expect(run(["frobnicate"])).toMatchObject({
    code: 2,
    stderr: expect.stringContaining("Unknown command: frobnicate"),
  });
  expect(run(["--nope"]).code).toBe(2);
});
