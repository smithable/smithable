// Before a gate's checks start (scripts/gate.sh): every port they may listen on is free, or the
// gate does not start (T1317). A Studio and its preview left by a check that crashed held one,
// and the next gate failed on it twenty minutes in. Prints each taken port with the process
// holding it and exits 1; exits 0 when all are free.
// The ports: each example's four (test-apps-parallel's layout, every example, of which a run of
// fewer uses the first), and Studio's check's six (TEST_STUDIO_PORT and the five after it: the
// preview, the fake model, the MCP check, the visual matrix's app and the picture picker).
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_OFFSETS, appBases } from "./ports.mjs";

export const gatePorts = (appsBase, studioBase, examples) => [
  ...appBases(appsBase, examples).flatMap((base) => APP_OFFSETS.map((offset) => base + offset)),
  ...[0, 1, 2, 3, 4, 5].map((i) => studioBase + i),
];

/** The listening TCP ports, each with the pid holding it when `ss -ltnpH` shows one. */
export function listening(ss) {
  const held = new Map();
  for (const line of ss.split("\n")) {
    const local = line.trim().split(/\s+/)[3] ?? "";
    const port = Number(local.slice(local.lastIndexOf(":") + 1));
    if (!Number.isInteger(port) || port <= 0) continue;
    const pid = /pid=(\d+)/.exec(line)?.[1];
    if (!held.get(port)) held.set(port, pid ? Number(pid) : undefined);
  }
  return held;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repo = fileURLToPath(new URL("..", import.meta.url));
  const examples = readdirSync(join(repo, "examples"), { withFileTypes: true }).filter((e) =>
    e.isDirectory(),
  ).length;
  const ports = gatePorts(
    Number(process.env.TEST_APPS_PORT ?? 4400),
    Number(process.env.TEST_STUDIO_PORT ?? 4900),
    examples,
  );
  const held = listening(execFileSync("ss", ["-ltnpH"], { encoding: "utf8" }));
  const taken = ports.filter((port) => held.has(port));
  for (const port of taken) {
    const pid = held.get(port);
    let who = "a process of another user";
    if (pid)
      try {
        const [group, ...command] = execFileSync("ps", ["-o", "pgid=,args=", "-p", String(pid)], {
          encoding: "utf8",
        })
          .trim()
          .split(/\s+/);
        who = `pid ${pid} in process group ${group}: ${command.join(" ").slice(0, 160)}`;
      } catch {
        who = `pid ${pid}`;
      }
    console.error(`gate.sh: port ${port} is taken by ${who}`);
  }
  if (taken.length) {
    console.error(
      "gate.sh: the gate's checks listen on these ports, so it does not start (exit 76). A process left by an earlier check of yours: stop its group (kill -- -GROUP). Anything else: set other ports (TEST_APPS_PORT, TEST_STUDIO_PORT).",
    );
    process.exit(1);
  }
}
