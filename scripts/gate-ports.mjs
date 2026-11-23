// Before a gate's checks start (scripts/gate.sh): every port they may listen on is free, or the
// gate does not start (T1317). A Studio and its preview left by a check that crashed held one,
// and the next gate failed on it twenty minutes in. Prints each taken port with the process
// holding it (its name, pid, group and folder; not its arguments, which may hold a secret) and
// exits 1;
// exits 0 when all are free, and 2 when the sockets cannot be read (no `ss`).
// The ports: each example's four (test-apps-parallel's layout, every example, of which a run of
// fewer uses the first), and Studio's check's six (TEST_STUDIO_PORT and the five after it: the
// preview, the fake model, the MCP check, the visual matrix's app and the picture picker).
import { execFileSync } from "node:child_process";
import { readdirSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_OFFSETS, appBases } from "./ports.mjs";

export const gatePorts = (appsBase, studioBase, examples) => [
  ...appBases(appsBase, examples).flatMap((base) => APP_OFFSETS.map((offset) => base + offset)),
  ...[0, 1, 2, 3, 4, 5].map((i) => studioBase + i),
];

/** The listening TCP ports, each with the process holding it (name, pid) when `ss -ltnpH` shows one. */
export function listening(ss) {
  const held = new Map();
  for (const line of ss.split("\n")) {
    const local = line.trim().split(/\s+/)[3] ?? "";
    const port = Number(local.slice(local.lastIndexOf(":") + 1));
    if (!Number.isInteger(port) || port <= 0) continue;
    const owner = /\(\("([^"]*)",pid=(\d+)/.exec(line);
    if (!held.get(port))
      held.set(port, owner ? { name: owner[1], pid: Number(owner[2]) } : undefined);
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
  let held;
  try {
    held = listening(execFileSync("ss", ["-ltnpH"], { encoding: "utf8" }));
  } catch (error) {
    console.error(`gate.sh: the listening ports could not be read (${error.message}).`);
    process.exit(2);
  }
  const taken = ports.filter((port) => held.has(port));
  for (const port of taken) {
    const owner = held.get(port);
    let who = "a process of another user";
    if (owner)
      try {
        const group = execFileSync("ps", ["-o", "pgid=", "-p", String(owner.pid)], {
          encoding: "utf8",
        }).trim();
        let folder = "";
        try {
          folder = `, in ${readlinkSync(`/proc/${owner.pid}/cwd`)}`;
        } catch {}
        who = `${owner.name} (pid ${owner.pid}, process group ${group}${folder})`;
      } catch {
        who = `${owner.name} (pid ${owner.pid})`;
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
