import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  ensureRepository,
  git,
  ownRepository,
  trailer,
  uncommitted,
  uncommittedRefusal,
} from "./git.js";

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

// The README's first steps make the app inside the clone of Smithable.
test("an app made inside another repository gets its own, and leaves that one alone", () => {
  const outer = mkdtempSync(join(tmpdir(), "smithable-git-"));
  try {
    const run = (dir: string, ...args: string[]) =>
      spawnSync("git", ["-c", "user.name=T", "-c", "user.email=t@example.com", ...args], {
        cwd: dir,
        encoding: "utf8",
      });
    run(outer, "init", "-q");
    writeFileSync(join(outer, "theirs.txt"), "theirs\n");
    run(outer, "add", "-A");
    run(outer, "commit", "-q", "-m", "theirs");
    // Their own edit in progress must not stand in the way of the app's changes.
    writeFileSync(join(outer, "theirs.txt"), "edited\n");
    const app = join(outer, "my-crm");
    mkdirSync(app);
    writeFileSync(join(app, "smithable.yml"), "smithable: 0.1\n");
    expect(ownRepository(outer)).toBe(true);
    expect(ownRepository(app)).toBe(false);

    process.env.GIT_AUTHOR_NAME = process.env.GIT_COMMITTER_NAME = "T";
    process.env.GIT_AUTHOR_EMAIL = process.env.GIT_COMMITTER_EMAIL = "t@example.com";
    ensureRepository(app);
    expect(ownRepository(app)).toBe(true);
    expect(uncommitted(app)).toEqual([]);
    expect(git(app, ["log", "--format=%s"]).out).toBe("smithable: start of history");
    expect(git(outer, ["log", "--format=%s"]).out).toBe("theirs");
    // Asked again, nothing more happens.
    ensureRepository(app);
    expect(git(app, ["rev-list", "--count", "HEAD"]).out).toBe("1");
  } finally {
    rmSync(outer, { recursive: true, force: true });
  }
});
