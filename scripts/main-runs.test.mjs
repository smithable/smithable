import assert from "node:assert/strict";
import test from "node:test";
import { report } from "./main-runs.mjs";

const run = (day, full) => ({ createdAt: `2026-01-0${day}T12:00:00Z`, url: `u${day}`, full });
const since = Date.parse("2026-01-03T00:00:00Z");

test("a skipped or running full job is not a completed run", () => {
  const out = report([run(4, "in_progress"), run(3, "skipped"), run(2, "success")], since);
  assert.equal(out.ok, false);
  assert.match(out.lines.join("\n"), /last completed full run: success, 2026-01-02/);
  assert.match(out.lines.at(-1), /gh workflow run/);
});

test("the last completed run in the time decides", () => {
  assert.equal(report([run(4, "success"), run(3, "failure")], since).ok, true);
  assert.equal(report([run(4, "failure"), run(3, "success")], since).ok, false);
  assert.equal(report([], since).ok, false);
});
