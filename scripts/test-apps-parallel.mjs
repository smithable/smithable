// Runs `pnpm test:apps` for every example at the same time, one process each with its own
// ports, and prints each example's output as a whole when it is done. Same checks as
// scripts/test-apps.mjs, which this runs; about as long as the slowest example.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const repo = new URL("..", import.meta.url).pathname;
const examples = readdirSync(join(repo, "examples"), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const results = await Promise.all(
  examples.map(
    (example, i) =>
      new Promise((resolve) => {
        const child = spawn("node", [join(repo, "scripts/test-apps.mjs"), example], {
          cwd: repo,
          env: { ...process.env, TEST_APPS_PORT: String(4400 + i * 10) },
        });
        let output = "";
        child.stdout.on("data", (d) => (output += d));
        child.stderr.on("data", (d) => (output += d));
        child.on("close", (code) => {
          process.stdout.write(output);
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
