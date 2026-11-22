import { execFileSync } from "node:child_process";
import { readdirSync, readlinkSync, realpathSync } from "node:fs";
import { sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

/** Live processes in a test's own temporary project, including detached previews. */
export function fixturePids(directory) {
  const root = realpathSync(directory);
  const inside = (cwd) => cwd === root || cwd.startsWith(root + sep);
  if (process.platform === "linux") {
    return readdirSync("/proc")
      .filter((name) => /^\d+$/.test(name))
      .filter((pid) => {
        try {
          return inside(readlinkSync(`/proc/${pid}/cwd`));
        } catch (error) {
          if (["ENOENT", "ESRCH", "EACCES", "EPERM"].includes(error.code)) return false;
          throw error;
        }
      })
      .map(Number);
  }
  // macOS has no /proc. Ask lsof for the same working-directory evidence.
  const paths = execFileSync("lsof", ["-nP", "-d", "cwd", "-Fpn"], { encoding: "utf8" });
  return paths
    .split(/^p/m)
    .filter((record) => record.split("\n").some((line) => line[0] === "n" && inside(line.slice(1))))
    .map((record) => Number.parseInt(record, 10));
}

async function waitFor(check, milliseconds) {
  const deadline = Date.now() + milliseconds;
  while (!check()) {
    if (Date.now() >= deadline) return false;
    await delay(100);
  }
  return true;
}

/** Stop Studio through its shutdown handler first, then stop and verify its fixture processes. */
export async function stopStudioFixture(studio, directory) {
  const stopped = () => !studio?.pid || studio.exitCode !== null || studio.signalCode !== null;
  if (!stopped()) {
    studio.kill("SIGTERM");
    if (!(await waitFor(stopped, 5000))) studio.kill("SIGKILL");
  }
  await waitFor(stopped, 2000);
  const empty = () => fixturePids(directory).length === 0;
  if (await waitFor(() => stopped() && empty(), 1000)) return;

  // Once Studio is stopped it cannot restart a preview. Signal only processes in this fixture.
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    for (const pid of fixturePids(directory)) {
      if (!fixturePids(directory).includes(pid)) continue;
      try {
        process.kill(pid, signal);
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
    if (await waitFor(() => stopped() && empty(), 2000)) return;
  }
  throw new Error(
    `Studio fixture did not stop: ${directory} (PIDs: ${fixturePids(directory).join(", ")})`,
  );
}
