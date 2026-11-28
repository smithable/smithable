import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

test("a walk stops on a format error in its checkout's changed files, wherever it is started", () => {
  const dir = mkdtempSync(join(tmpdir(), "smithable-lint-guard-"));
  try {
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_") && k !== "CI"),
    );
    const repo = join(dir, "repo");
    mkdirSync(join(repo, "node_modules/.bin"), { recursive: true });
    mkdirSync(join(repo, "scripts"));
    symlinkSync(here("../node_modules/.bin/biome"), join(repo, "node_modules/.bin/biome"));
    for (const name of ["lint-guard.mjs", "ports.mjs"])
      copyFileSync(here(`./${name}`), join(repo, "scripts", name));
    writeFileSync(
      join(repo, "scripts/walk.mjs"),
      'import { checkPorts } from "./ports.mjs";\n\ncheckPorts("walk", []);\nconsole.log("walked");\n',
    );
    const git = (...args) =>
      assert.equal(
        spawnSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", ...args], {
          env,
        }).status,
        0,
        args.join(" "),
      );
    const bad = "export const a    =  1\n";
    writeFileSync(join(repo, "biome.json"), "{}\n");
    writeFileSync(join(repo, ".gitignore"), "node_modules\n");
    writeFileSync(join(repo, "old.js"), bad);
    git("init", "-q");
    git("add", "-A");
    git("commit", "-qm", "main");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    // Started from another folder, as a job that did not cd into the checkout.
    const walk = (extra = {}) =>
      spawnSync(process.execPath, [join(repo, "scripts/walk.mjs")], {
        cwd: dir,
        env: { ...env, ...extra },
        encoding: "utf8",
      });
    assert.equal(walk().stdout, "walked\n", "an old error stops nothing");
    writeFileSync(join(repo, "new file.js"), bad);
    for (const commit of [false, true]) {
      if (commit) {
        git("add", "-A");
        git("commit", "-qm", "change");
      }
      const r = walk();
      assert.equal(r.status, 77, r.stderr);
      assert.match(r.stderr, /new file\.js[\s\S]*run pnpm fix/);
      assert.equal(r.stdout, "");
    }
    assert.equal(walk({ CI: "true" }).stdout, "walked\n");
    assert.equal(walk({ GIT_DIR: join(dir, "elsewhere") }).status, 77, "a hook's GIT_DIR");
    rmSync(join(repo, "new file.js"));
    writeFileSync(join(repo, "--write"), "notes\n");
    writeFileSync(join(repo, "other.js"), bad);
    assert.equal(walk().status, 77, "a file named like a flag changes nothing");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
