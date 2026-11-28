import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const rule = fileURLToPath(new URL("./fix-file-rule.mjs", import.meta.url));
const {
  CI: _ci,
  BASE: _base,
  PR_HEAD: _head,
  PR: _pr,
  PR_BODY: _body,
  NO_FIX_FILE: _label,
  ...quiet
} = process.env;
const env = { ...quiet, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };

test("--local: a kit change fails without its declaration, passes with it, and is CI's in CI", (t) => {
  const repo = mkdtempSync(join(tmpdir(), "smithable-fix-file-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: repo, env });
  const run = (extra = {}) =>
    spawnSync("node", [rule, "--local"], {
      cwd: repo,
      env: { ...env, ...extra },
      encoding: "utf8",
    });
  const kit = join(repo, "packages/adapter-tanstack/templates/src/kit");
  mkdirSync(kit, { recursive: true });
  writeFileSync(join(kit, "a.ts"), "export const a = 1;\n");
  git("init", "-q", "-b", "main");
  git("add", ".");
  git("commit", "-q", "-m", "base");
  assert.equal(run().status, 0, "no origin/main yet");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  assert.equal(run().status, 0, "nothing changed");

  writeFileSync(join(kit, "a.ts"), "// A comment only.\nexport const a = 1;\n");
  git("commit", "-qam", "a comment");
  assert.equal(run().status, 0, "only a comment changed");

  writeFileSync(join(kit, "a.ts"), "export const a = 2;\n");
  git("commit", "-qam", "a change");
  const failed = run();
  assert.equal(failed.status, 1, "a kit change without a declaration");
  assert.match(failed.stderr, /templates\/src\/kit\/a\.ts/);
  assert.equal(run({ CI: "true" }).status, 0, "CI runs the rule on the pull request instead");
  assert.equal(run({ NO_FIX_FILE: "true" }).status, 0, "the label, said by hand");
  git(
    "update-ref",
    "refs/remotes/origin/main",
    git("commit-tree", "-m", "other", git("write-tree").toString().trim()).toString().trim(),
  );
  assert.equal(run().status, 0, "no common history with origin/main");
  git("update-ref", "refs/remotes/origin/main", "HEAD~2");

  git(
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "say so\n\nFix file: none, because no app is built from this test repository.",
  );
  assert.equal(run().status, 0, "the commit message declares it");
});

test("in CI, main's commits after the event's base are not the pull request's", (t) => {
  const repo = mkdtempSync(join(tmpdir(), "smithable-fix-file-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
      cwd: repo,
      env,
      encoding: "utf8",
    }).trim();
  const kit = "packages/adapter-tanstack/templates/src/kit";
  const commit = (path, text) => {
    writeFileSync(join(repo, path), text);
    git("add", ".");
    git("commit", "-q", "-m", path);
    return git("rev-parse", "HEAD");
  };
  mkdirSync(join(repo, kit), { recursive: true });
  git("init", "-q", "-b", "main");
  const base = commit(`${kit}/a.ts`, "export const a = 1;\n");
  // The checkout CI makes: a pull request merged into a main that has moved past `base`.
  const checkOut = (path) => {
    git("checkout", "-q", "--detach", base);
    const head = commit(path, "export const mine = 1;\n");
    git("checkout", "-q", "--detach", "main");
    git("merge", "-q", "--no-ff", "-m", "merge", head);
    return head;
  };
  commit(`${kit}/theirs.ts`, "export const theirs = 1;\n");
  const run = (head) =>
    spawnSync("node", [rule], {
      cwd: repo,
      env: { ...env, BASE: base, PR_HEAD: head },
      encoding: "utf8",
    });

  const quietHead = checkOut("notes.txt");
  const passed = run(quietHead);
  assert.equal(passed.status, 0, passed.stderr);

  const failed = run(checkOut(`${kit}/mine.ts`));
  assert.equal(failed.status, 1, "the pull request's own kit change still needs a declaration");
  assert.match(failed.stderr, /kit\/mine\.ts/);
  assert.doesNotMatch(failed.stderr, /theirs\.ts/);
  const wrong = run(base);
  assert.equal(wrong.status, 1, "a checkout that is not this pull request's merge");
  assert.match(wrong.stderr, /not .* merged into main/);
});
