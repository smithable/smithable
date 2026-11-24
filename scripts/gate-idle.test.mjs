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

  // One process takes the lock and becomes sleep, so killing it frees the lock.
  const holder = spawn("bash", [
    "-c",
    'exec 9>>"$0"; flock 9; exec sleep 30',
    join(home, ".gate-lock"),
  ]);
  t.after(() => holder.kill());
  await new Promise((done) => setTimeout(done, 300));
  assert.equal(idle(home), 1, "a gate holds the lock");
  holder.kill();
  await new Promise((done) => holder.on("exit", done));
  assert.equal(idle(home), 0, "the lock is free again");

  writeFileSync(join(home, ".gate-queue", `1.${process.pid}`), "a\t/tmp/wt\n");
  assert.equal(idle(home), 1, "a live gate waits");
  rmSync(join(home, ".gate-queue", `1.${process.pid}`));
  writeFileSync(join(home, ".gate-queue", "2.999999999"), "b\t/tmp/wt\n");
  assert.equal(idle(home), 0, "a ticket whose process is gone is dropped, not counted");
});
