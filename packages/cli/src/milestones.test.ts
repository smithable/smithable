import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { git } from "./git.js";
import { milestoneSlug, milestones, nameMilestone } from "./milestones.js";
import { trace } from "./studio.js";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A project with two changes, the second keeping a database snapshot; their commits. */
function project(): { dir: string; first: string; second: string } {
  const dir = mkdtempSync(join(tmpdir(), "smithable-milestones-"));
  dirs.push(dir);
  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  const commit = (text: string, message: string) => {
    writeFileSync(join(dir, "smithable.yml"), text);
    git(dir, ["add", "-A"]);
    git(dir, ["commit", "-q", "-m", message]);
    return git(dir, ["rev-parse", "HEAD"]).out;
  };
  commit("a\n", "smithable: start of history");
  const first = commit("b\n", "smithable: Added a field\n\nSmithable-Snapshot: none\n");
  const second = commit("c\n", "smithable: Removed a field\n\nSmithable-Snapshot: abc123\n");
  return { dir, first, second };
}

test("a change is named as a milestone, renamed, found in the trace and unnamed", () => {
  const { dir, first, second } = project();
  expect(nameMilestone(dir, first.slice(0, 8), "First bookings")).toEqual({
    ok: true,
    output: 'Named the milestone "First bookings".',
  });
  expect(git(dir, ["tag", "-l", "milestone/*"]).out).toBe("milestone/first-bookings");
  expect(milestones(dir)).toEqual(new Map([[first, "First bookings"]]));
  // The trace says it, and what each change's undo puts back.
  const entries = trace(dir);
  expect(entries.map((e) => [e.description, e.milestone, e.snapshot])).toEqual([
    ["Removed a field", undefined, true],
    ["Added a field", "First bookings", false],
  ]);
  // Another change cannot take the same name; the first is renamed in place.
  expect(nameMilestone(dir, second, "first bookings").ok).toBe(false);
  expect(nameMilestone(dir, first, "Opening day").ok).toBe(true);
  expect(milestones(dir)).toEqual(new Map([[first, "Opening day"]]));
  expect(trace(dir)[1]?.milestone).toBe("Opening day");
  // An empty name takes it away.
  expect(nameMilestone(dir, first, "  ")).toEqual({
    ok: true,
    output: '"Opening day" is no longer a milestone.',
  });
  expect(milestones(dir).size).toBe(0);
});

test("a milestone needs a change in the history and a name with a letter or a digit", () => {
  const { dir, first } = project();
  expect(nameMilestone(dir, "deadbeef", "x").ok).toBe(false);
  expect(nameMilestone(dir, "HEAD; rm", "x").ok).toBe(false);
  expect(nameMilestone(dir, first, "!!!").ok).toBe(false);
  expect(milestoneSlug("Åland launch — v2")).toBe("aland-launch-v2");
});

test("renaming to the same name in other letters keeps one milestone", () => {
  const { dir, first } = project();
  expect(nameMilestone(dir, first, "first look").ok).toBe(true);
  expect(nameMilestone(dir, first, "First Look").ok).toBe(true);
  expect(git(dir, ["tag", "-l", "milestone/*"]).out).toBe("milestone/first-look");
  expect(milestones(dir)).toEqual(new Map([[first, "First Look"]]));
  expect(milestoneSlug(`${"a".repeat(59)} b`)).toBe("a".repeat(59));
});
