import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { walkFiles } from "./walk-record.mjs";

// The push guard (.githooks/pre-push, scripts/mark-verified.sh) in a scratch clone with a bare
// origin. A stand-in docker answers for the scan: FAKE_DOWN makes Docker absent, FAKE_LEAK a finding.
const repoRoot = join(import.meta.dirname, "..");
const ci = `on:
  pull_request:
    paths-ignore:
      # plain docs: begin
      - "docs/design/**/*.md"
      - "*.md"
      # plain docs: end
`;

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), "pre-push-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "docker"),
    `#!/usr/bin/env bash
case "$1" in
  info) [ -z "$FAKE_DOWN" ] ;;
  run) [ -z "$FAKE_LEAK" ] || { echo "leak found" >&2; exit 1; } ;;
esac
`,
  );
  chmodSync(join(bin, "docker"), 0o755);
  const work = join(dir, "work");
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@example.invalid",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@example.invalid",
    FAKE_DOWN: "",
    FAKE_LEAK: "",
  };
  delete env.GIT_DIR;
  delete env.GIT_INDEX_FILE;
  const run = (script, extra = {}) =>
    spawnSync("bash", ["-c", script], { cwd: work, env: { ...env, ...extra }, encoding: "utf8" });
  spawnSync("git", ["init", "-q", "--bare", "-b", "main", join(dir, "origin.git")], { env });
  spawnSync("git", ["init", "-q", "-b", "main", work], { env });
  mkdirSync(join(work, ".github", "workflows"), { recursive: true });
  mkdirSync(join(work, "scripts"));
  writeFileSync(join(work, ".github", "workflows", "ci.yml"), ci);
  writeFileSync(join(work, ".github", "gitleaks.toml"), "[extend]\nuseDefault = true\n");
  cpSync(join(repoRoot, ".githooks"), join(work, ".githooks"), { recursive: true });
  for (const script of ["mark-verified.sh", "walk-record.mjs"])
    cpSync(join(repoRoot, "scripts", script), join(work, "scripts", script));
  writeFileSync(join(work, "code.ts"), "export const a = 1;\n");
  const r = run(`git remote add origin ../origin.git && git add -A && git commit -q -m base &&
    git push -q origin main 2>&1 && git config core.hooksPath .githooks && git switch -q -c c/x`);
  assert.equal(r.status, 0, r.stderr);
  return { work, run };
}

test("a code change is refused until lint is marked; without the test marker it goes with a warning", () => {
  const { run } = scratch();
  run("echo 'export const a = 2;' > code.ts && git commit -qam change");
  let r = run("git push -q origin c/x");
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /lint has not passed on this tree/);
  assert.match(r.stderr, /Run: scripts\/verify\.sh --lint/);
  assert.equal(run("scripts/mark-verified.sh --lint").status, 0);
  r = run("git push -q origin c/x");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /warning: the unit tests have no passing run on this tree; CI runs them/);
});

test("with the test marker the push goes without a warning", () => {
  const { run } = scratch();
  run("echo 'export const a = 9;' > code.ts && git commit -qam change");
  assert.equal(run("scripts/mark-verified.sh").status, 0);
  const r = run("git push -q origin c/x");
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /warning/);
});

test("the marker is for the files as they will be committed, before the commit", () => {
  const { run } = scratch();
  run("echo 'export const a = 3;' > code.ts && echo new > new.ts");
  assert.equal(run("scripts/mark-verified.sh").status, 0);
  run("git add -A && git commit -qm change");
  const r = run("git push -q origin c/x");
  assert.equal(r.status, 0, r.stderr);
});

test("only the gate's marker says a gate passed", () => {
  const { run } = scratch();
  const gated = 'test -e ".git/verified/gate/$(git rev-parse "HEAD^{tree}")"';
  run("echo 'export const a = 10;' > code.ts && git commit -qam change");
  assert.equal(run("scripts/mark-verified.sh").status, 0);
  assert.notEqual(run(gated).status, 0);
  assert.equal(run("scripts/mark-verified.sh --gate").status, 0);
  assert.equal(run(gated).status, 0);
  assert.equal(run("git push -q origin c/x").status, 0);
});

test("a run whose files changed under it writes no marker", () => {
  const { run } = scratch();
  const before = run("scripts/mark-verified.sh --tree").stdout.trim();
  run("echo 'export const a = 4;' > code.ts && git commit -qam change");
  const r = run(`scripts/mark-verified.sh ${before}`);
  assert.notEqual(r.status, 0);
  assert.notEqual(run("git push -q origin c/x").status, 0);
});

test("plain documents alone need no marker; a document beside code does", () => {
  const { run } = scratch();
  run("mkdir -p docs/design && echo note > docs/design/a.md && echo readme > README.md");
  run("git add -A && git commit -qm docs");
  assert.equal(run("git push -q origin c/x").status, 0);
  run("echo 'export const a = 5;' > code.ts && echo more >> README.md && git commit -qam mixed");
  assert.notEqual(run("git push -q origin c/x").status, 0);
});

test("a merge of main into a pushed head needs no new marker; other merges do", () => {
  const { run } = scratch();
  run("echo 'export const a = 6;' > code.ts && git commit -qam change && scripts/mark-verified.sh");
  assert.equal(run("git push -q origin c/x").status, 0);
  run(`git switch -q main && echo other > other.ts && git add -A && git commit -qm main2 &&
    git push -q --no-verify origin main && git switch -q c/x && git merge -q --no-edit main`);
  let r = run("git push -q origin c/x");
  assert.equal(r.status, 0, r.stderr);
  run(`git switch -q -c side main~1 && echo side > side.ts && git add -A && git commit -qm side &&
    git switch -q c/x && git merge -q --no-edit side`);
  r = run("git push -q origin c/x");
  assert.notEqual(r.status, 0);
});

test("the scan refuses on a finding or without Docker, even with a marker", () => {
  const { run } = scratch();
  run("echo 'export const a = 7;' > code.ts && git commit -qam change && scripts/mark-verified.sh");
  let r = run("git push -q origin c/x", { FAKE_LEAK: "1" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /secret scan found something/);
  r = run("git push -q origin c/x", { FAKE_DOWN: "1" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /needs Docker/);
  assert.equal(run("git push -q origin c/x").status, 0);
});

test("a branch is deleted without the checks", () => {
  const { run } = scratch();
  run("echo 'export const a = 8;' > code.ts && git commit -qam change && scripts/mark-verified.sh");
  assert.equal(run("git push -q origin c/x").status, 0);
  assert.equal(run("git push -q origin :c/x", { FAKE_DOWN: "1" }).status, 0);
});

test("prepare turns the hook on only on the maintainers' machine and never in CI", () => {
  const { work, run } = scratch();
  run("git config --unset core.hooksPath");
  const home = mkdtempSync(join(tmpdir(), "home-"));
  const prepare = (extra) =>
    spawnSync("node", [join(repoRoot, "scripts", "git-hooks.mjs")], {
      cwd: work,
      env: { ...process.env, HOME: home, CI: "", ...extra },
      encoding: "utf8",
    });
  assert.equal(prepare().status, 0);
  assert.equal(run("git config --get core.hooksPath").stdout.trim(), "");
  mkdirSync(join(home, "repos", ".session-scripts"), { recursive: true });
  assert.equal(prepare({ CI: "true" }).status, 0);
  assert.equal(run("git config --get core.hooksPath").stdout.trim(), "");
  assert.equal(prepare().status, 0);
  assert.equal(run("git config --get core.hooksPath").stdout.trim(), ".githooks");
});

test("a changed walk needs a passing run of that content, or the trailer with a reason", () => {
  const { run } = scratch();
  run(`printf 'import "./x";\nimport { step } from "./flow.mjs";\n' > scripts/test-apps.mjs &&
    echo 'export const step = 1;' > scripts/flow.mjs && git add -A && git commit -qm walk &&
    scripts/mark-verified.sh`);
  let r = run("git push -q origin c/x");
  assert.notEqual(r.status, 0, "a lint and unit mark does not stand in for a run");
  assert.match(r.stderr, /scripts\/flow\.mjs has changes with no passing run/);
  assert.match(r.stderr, /Run: pnpm test:apps:one/);
  assert.match(r.stderr, /Walk-not-run: <reason>/);

  const passed = (ran) =>
    run(`node -e 'import("./scripts/walk-record.mjs").then((m) =>
      m.walkRecord("scripts/test-apps.mjs", process.cwd())("${ran}"))'`);
  assert.equal(passed("booking").status, 0);
  r = run("git push -q origin c/x");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /scripts\/flow\.mjs: this content passed a run \(booking\)/);

  // A later change to the walk needs its own run; the trailer covers the content it was made with.
  run(
    "echo 'export const step = 2;' > scripts/flow.mjs && git commit -qam two && scripts/mark-verified.sh",
  );
  assert.notEqual(run("git push -q origin c/x").status, 0);
  run("git commit -q --allow-empty -m 'two, not run' -m 'Walk-not-run: no room for it here'");
  r = run("git push -q origin c/x");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /not run, Walk-not-run: no room for it here/);
  run(
    "echo 'export const step = 3;' > scripts/flow.mjs && git commit -qam three && scripts/mark-verified.sh",
  );
  assert.notEqual(run("git push -q origin c/x").status, 0);
});

test("the walks' files are what their entries import, without the support they stand on", () => {
  const files = (entry) =>
    walkFiles(entry, (path) => {
      const file = join(repoRoot, path);
      return existsSync(file) ? readFileSync(file, "utf8") : undefined;
    });
  assert.deepEqual(files("scripts/test-apps.mjs").sort(), [
    "scripts/test-apps-first-load.mjs",
    "scripts/test-apps.mjs",
    "scripts/upgrade-flow.mjs",
  ]);
  const studio = files("scripts/test-studio.mjs");
  for (const file of ["test-studio", "studio-look-checks", "test-public-look", "first-look-checks"])
    assert.ok(studio.includes(`scripts/${file}.mjs`), file);
  assert.ok(!studio.includes("scripts/ports.mjs"));
});
