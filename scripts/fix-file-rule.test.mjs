import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const rule = fileURLToPath(new URL("./fix-file-rule.mjs", import.meta.url));
const { CI: _ci, BASE: _base, ...quiet } = process.env;
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

  git(
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "say so\n\nFix file: none, because no app is built from this test repository.",
  );
  assert.equal(run().status, 0, "the commit message declares it");
});
