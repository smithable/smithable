import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
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
import { tempDir } from "./test-dir.js";

// As on a machine where Git was just installed: no name or address, and none to be guessed.
for (const name of [
  "GIT_AUTHOR_NAME",
  "GIT_AUTHOR_EMAIL",
  "GIT_COMMITTER_NAME",
  "GIT_COMMITTER_EMAIL",
  "EMAIL",
])
  delete process.env[name];
Object.assign(process.env, {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "user.useConfigOnly",
  GIT_CONFIG_VALUE_0: "true",
});

test("without a Git name and address a commit is Smithable's own, and a configured one is kept", () => {
  const dir = tempDir("smithable-git-");
  try {
    writeFileSync(join(dir, "smithable.yml"), "smithable: 0.1\n");
    ensureRepository(dir);
    expect(uncommitted(dir)).toEqual([]);
    expect(git(dir, ["log", "--format=%an <%ae>"]).out).toBe(
      "Smithable <studio@smithable.invalid>",
    );
    git(dir, ["config", "user.name", "Ada"]);
    git(dir, ["config", "user.email", "ada@example.com"]);
    writeFileSync(join(dir, "notes.txt"), "x");
    git(dir, ["add", "-A"]);
    expect(git(dir, ["commit", "-q", "-m", "smithable: a change"]).ok).toBe(true);
    expect(git(dir, ["log", "-1", "--format=%an <%ae>"]).out).toBe("Ada <ada@example.com>");
    // Undo makes a commit too.
    git(dir, ["config", "--unset", "user.name"]);
    git(dir, ["config", "--unset", "user.email"]);
    expect(git(dir, ["revert", "--no-edit", "HEAD"]).ok).toBe(true);
    expect(git(dir, ["log", "-1", "--format=%an"]).out).toBe("Smithable");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a change is refused over uncommitted edits, which it lists", () => {
  const dir = tempDir("smithable-git-");
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
  const outer = tempDir("smithable-git-");
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
