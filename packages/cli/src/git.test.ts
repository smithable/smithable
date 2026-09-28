import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { git, trailer, uncommittedRefusal } from "./git.js";

test("a change is refused over uncommitted edits, which it lists", () => {
  const dir = mkdtempSync(join(tmpdir(), "smithable-git-"));
  git(dir, ["init", "-q"]);
  expect(uncommittedRefusal(dir)).toBeUndefined();
  writeFileSync(join(dir, "notes.txt"), "x");
  expect(uncommittedRefusal(dir, "so the upgrade can be undone on its own")).toBe(
    "Commit or discard these changes first, so the upgrade can be undone on its own:\n  ?? notes.txt\n",
  );
});

test("a trailer is read from a commit body", () => {
  const body = 'Smithable-Op: {"op":"addField"}\nSmithable-Duration: 812 ms\n';
  expect(trailer(body, "Smithable-Op")).toBe('{"op":"addField"}');
  expect(trailer(body, "Smithable-Duration")).toBe("812 ms");
  expect(trailer(body, "Smithable-AI")).toBeUndefined();
});
