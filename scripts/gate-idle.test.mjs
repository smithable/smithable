import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
