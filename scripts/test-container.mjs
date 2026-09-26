// Container test (needs Docker): the CRM builds into an image, serves /health, requires
// sign-in, and its data survives replacing the container, because it lives in /data.
// Run after `pnpm build`: `pnpm test:container`.
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const name = `smithable-test-crm-${process.pid}`;
const port = 4500;
const base = `http://localhost:${port}`;

function run(command, args, cwd = repo) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

async function waitForHealth() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${base}/health`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("The container did not become healthy.");
}

// Production needs a secret for sessions and the app's public address.
const startContainer = () =>
  run("docker", [
    "run",
    "-d",
    "--name",
    name,
    "-p",
    `${port}:3000`,
    "-v",
    `${name}:/data`,
    "-e",
    "BETTER_AUTH_SECRET=container-test-secret-0123456789abcdef",
    "-e",
    `BETTER_AUTH_URL=${base}`,
    name,
  ]);

let failed = false;
const dir = join(mkdtempSync(join(tmpdir(), "smithable-container-")), "crm");
try {
  run("node", [cli, "new", dir, "--starter", "crm"]);
  console.log("✓ smithable new");
  run("docker", ["build", "-t", name, "."], dir);
  console.log("✓ image builds");
  startContainer();
  await waitForHealth();
  console.log("✓ container serves /health");

  // Production has no development sign-in, so data is written inside the container.
  const sqlite = (sql) =>
    run("docker", [
      "exec",
      name,
      "node",
      "-e",
      `const D=require("better-sqlite3");const r=new D("/data/db/app.db").prepare(${JSON.stringify(sql)});console.log(JSON.stringify(r.reader?r.all():r.run()))`,
    ]);
  sqlite(
    "insert into customers (name, segment, created_at, updated_at) values ('Container Test AB', 'smb', 0, 0)",
  );
  const redirect = await fetch(`${base}/customers`, { redirect: "manual" });
  if (redirect.status !== 307)
    throw new Error(`/customers answered ${redirect.status} without sign-in`);
  console.log("✓ pages need sign-in in the container");

  run("docker", ["rm", "-f", name]);
  startContainer();
  await waitForHealth();
  const found = JSON.parse(sqlite("select name from customers where name = 'Container Test AB'"));
  if (found.length !== 1) throw new Error("the customer is gone");
  console.log("✓ data survives replacing the container");
} catch (error) {
  failed = true;
  console.log(`✗ ${error.message}`);
} finally {
  spawnSync("docker", ["rm", "-f", name]);
  spawnSync("docker", ["volume", "rm", name]);
  spawnSync("docker", ["image", "rm", name]);
}
process.exit(failed ? 1 : 0);
