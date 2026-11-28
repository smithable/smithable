import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const gate = fileURLToPath(new URL("./gate.sh", import.meta.url));
const idle = (home) =>
  spawnSync("bash", [gate, "--idle"], { env: { ...process.env, GATE_HOME: home } }).status;

test("--idle: 0 on an empty queue, 1 while a gate holds the lock or a live one waits", async (t) => {
  const home = mkdtempSync(join(tmpdir(), "smithable-gate-idle-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  assert.equal(idle(home), 0, "nothing runs or waits");

  // One process takes the lock, says so, and holds it until its stdin closes.
  const holder = spawn("bash", [
    "-c",
    'exec 9>>"$0"; flock 9; echo locked; read -r _',
    join(home, ".gate-lock"),
  ]);
  t.after(() => holder.kill());
  await new Promise((done) => holder.stdout.once("data", done));
  assert.equal(idle(home), 1, "a gate holds the lock");
  const exited = new Promise((done) => holder.on("exit", done));
  holder.stdin.end();
  await exited;
  assert.equal(idle(home), 0, "the lock is free again");

  writeFileSync(join(home, ".gate-queue", `1.${process.pid}`), "a\t/tmp/wt\n");
  assert.equal(idle(home), 1, "a live gate waits");
  rmSync(join(home, ".gate-queue", `1.${process.pid}`));
  writeFileSync(join(home, ".gate-queue", "2.999999999"), "b\t/tmp/wt\n");
  assert.equal(idle(home), 0, "a ticket whose process is gone is dropped, not counted");
});

test("an argument it does not know exits 2 and queues no gate", () => {
  const home = mkdtempSync(join(tmpdir(), "smithable-gate-args-"));
  try {
    for (const args of [["--idel"], ["--idle", "now"], ["check"]]) {
      const r = spawnSync("bash", [gate, ...args], {
        env: { ...process.env, GATE_HOME: home, SESSION: "t" },
        encoding: "utf8",
      });
      assert.equal(r.status, 2, args.join(" "));
      assert.match(r.stderr, /no gate started/);
    }
    assert.equal(idle(home), 0, "no ticket was left in the queue");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("while its checks run, the log gets the load and the busiest processes", () => {
  const home = mkdtempSync(join(tmpdir(), "smithable-gate-load-"));
  try {
    const r = spawnSync("bash", [gate], {
      env: {
        ...process.env,
        GATE_HOME: home,
        SESSION: "t",
        GATE_RUN: "sleep 3.5",
        GATE_LOAD_EVERY: "1",
      },
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /gate\.sh: \d\d:\d\d load [\d.]+ [\d.]+ [\d.]+; busiest:\n/);
    // Under heavy load top may not finish before the gate ends, or a process may exit between top and
    // ps, so rows are optional (T1553); each row that is there has its pid, its share and a folder.
    for (const row of r.stdout.split("\n").filter((l) => l.startsWith("  "))) {
      assert.match(row, /^ {2}\d+ [\d.]+% .* in /);
    }
    assert.doesNotMatch(r.stdout, / in \//, "no full path");
    assert.equal(idle(home), 0, "the lock is free again");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("the gate's own status comes back, and the sampler ends with it at once", () => {
  const home = mkdtempSync(join(tmpdir(), "smithable-gate-status-"));
  try {
    const started = Date.now();
    const r = spawnSync("bash", [gate], {
      env: {
        ...process.env,
        GATE_HOME: home,
        SESSION: "t",
        GATE_RUN: "exit 37",
        GATE_LOAD_EVERY: "60",
      },
      encoding: "utf8",
      timeout: 30000,
    });
    assert.equal(r.status, 37, r.stderr);
    assert.ok(Date.now() - started < 20000, "no sampler kept the output open");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// The change is GATE_CHANGED alone: HEAD against HEAD, so no output differs and nothing is stale.
const plan = (changed, env = {}) =>
  spawnSync("bash", [gate, "--plan"], {
    env: {
      ...process.env,
      SESSION: "t",
      GATE_BASICS_DONE: "",
      GATE_CHANGED: changed,
      GATE_BASE: "HEAD",
      GATE_HEAD: "HEAD",
      GATE_ALL_APPS: "",
      GATE_BRANCH: "no-such-branch",
      ...env,
    },
    encoding: "utf8",
  }).stdout;

test("a change to the example apps' check alone runs no Studio check", () => {
  assert.match(
    plan("scripts/test-apps.mjs\nscripts/test-apps-parallel.mjs"),
    /^apps=all studio=no /,
  );
  assert.match(plan("scripts/test-apps.mjs\npackages/core/src/a.ts"), /^apps=all studio=yes /);
});

test("only CI's gate skips lint and the units, and only when told", () => {
  const changed = "packages/core/src/a.ts";
  assert.match(plan(changed, { SESSION: "ci", GATE_BASICS_DONE: "1" }), /units are skipped/);
  assert.doesNotMatch(plan(changed, { GATE_BASICS_DONE: "1" }), /skipped/);
  assert.doesNotMatch(plan(changed, { SESSION: "ci" }), /skipped/);
});

test("a format error in a changed file stops a heavy run before it queues (T1780)", () => {
  const dir = mkdtempSync(join(tmpdir(), "smithable-gate-lint-"));
  try {
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")),
    );
    const repo = join(dir, "repo");
    const home = join(dir, "home");
    mkdirSync(join(repo, "node_modules/.bin"), { recursive: true });
    symlinkSync(
      fileURLToPath(new URL("../node_modules/.bin/biome", import.meta.url)),
      join(repo, "node_modules/.bin/biome"),
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
    const run = (session = "t") =>
      spawnSync("bash", [gate], {
        cwd: repo,
        env: { ...env, GATE_HOME: home, SESSION: session, GATE_RUN: "echo ran-the-job" },
        encoding: "utf8",
      });
    writeFileSync(join(repo, "notes.md"), "notes\n");
    assert.match(run().stdout, /^ran-the-job$/m, "an old error and a file biome does not read");
    writeFileSync(join(repo, "new file.js"), bad);
    for (const commit of [false, true]) {
      if (commit) {
        git("add", "-A");
        git("commit", "-qm", "change");
      }
      const r = run();
      assert.equal(r.status, 77, r.stderr);
      assert.match(r.stderr, /new file\.js[\s\S]*run pnpm fix/);
      assert.doesNotMatch(r.stdout, /ran-the-job/);
    }
    assert.equal(idle(home), 0, "no ticket was left in the queue");
    assert.match(run("ci").stdout, /^ran-the-job$/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
