// Runs `pnpm test:apps` for every example at the same time, one process each with its own
// ports, and prints each example's lines as they come, prefixed with its name, so a run that
// stops shows where. Same checks as scripts/test-apps.mjs, which this runs; about as long as
// the slowest example. Stopping this stops them, and they stop their servers.
// TEST_APPS_CONCURRENCY limits how many run at once (default: half the cores, at least two): all
// ten at once on eight cores put the load at nine to twelve, and a server's health or a page's
// hydration waited past its time (2026-10-18); the self-hosted CI runner runs three, since it
// shares the machine with the sessions' own work.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { cpus } from "node:os";
import { join } from "node:path";
import { refused } from "./ports.mjs";

const repo = new URL("..", import.meta.url).pathname;
// The examples named on the command line, or every example (scripts/gate.sh names the ones a
// change needs).
const examples = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(join(repo, "examples"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

// Ten ports per example from the base (TEST_APPS_PORT, default 4400), so two checkouts testing
// at the same time can keep apart. An example whose ports (test-apps.mjs adds 0, 100, 200 and
// 300) would include one Node's fetch refuses takes the next ten instead.
const OFFSETS = [0, 100, 200, 300];
let next = Number(process.env.TEST_APPS_PORT ?? 4400);
const ports = examples.map(() => {
  while (OFFSETS.some((offset) => refused(next + offset))) next += 10;
  next += 10;
  return next - 10;
});

const children = new Set();
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
  process.on(signal, () => {
    for (const child of children) child.kill(signal);
    process.exit(130);
  });
const width = Math.max(...examples.map((e) => e.length));
const atOnce = Math.max(
  1,
  Number(process.env.TEST_APPS_CONCURRENCY) || Math.max(2, Math.floor(cpus().length / 2)),
);
/** Runs `tasks` with at most `atOnce` in flight, keeping their order in the results. */
async function limited(tasks) {
  const results = new Array(tasks.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(atOnce, tasks.length) }, async () => {
      while (i < tasks.length) {
        const at = i++;
        results[at] = await tasks[at]();
      }
    }),
  );
  return results;
}
const results = await limited(
  examples.map(
    (example, i) => () =>
      new Promise((resolve) => {
        const child = spawn("node", [join(repo, "scripts/test-apps.mjs"), example], {
          cwd: repo,
          env: { ...process.env, TEST_APPS_PORT: String(ports[i]) },
        });
        children.add(child);
        // Each line as it comes, so a stuck run shows which step it is in.
        const prefix = `${example.padEnd(width)} | `;
        let pending = "";
        const write = (chunk) => {
          pending += chunk;
          const lines = pending.split("\n");
          pending = lines.pop() ?? "";
          for (const line of lines) process.stdout.write(`${prefix}${line}\n`);
        };
        child.stdout.on("data", write);
        child.stderr.on("data", write);
        child.on("close", (code) => {
          if (pending) process.stdout.write(`${prefix}${pending}\n`);
          children.delete(child);
          resolve({ example, code });
        });
      }),
  ),
);
const failed = results.filter((r) => r.code !== 0).map((r) => r.example);
console.log(
  failed.length
    ? `\nFailed: ${failed.join(", ")}`
    : `\nAll ${examples.length} example apps passed.`,
);
process.exit(failed.length ? 1 : 0);
