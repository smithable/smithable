import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

for (const fork of [false, true])
  for (const result of ["success", "failure", "cancelled", "skipped", ""]) {
    test(`required full coverage fork=${fork} result=${result}`, () => {
      const output = spawnSync("bash", ["scripts/ci-result.sh"], {
        env: {
          ...process.env,
          SCOPE_RESULT: "success",
          BASICS_REQUIRED: "true",
          BASICS_RESULT: "success",
          FULL_REQUIRED: "true",
          IS_FORK: String(fork),
          FULL_RESULT: fork ? "skipped" : result,
          FORK_FULL_RESULT: fork ? result : "skipped",
        },
      });
      assert.equal(output.status === 0, result === "success");
    });
  }
