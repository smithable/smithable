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
