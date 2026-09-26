// Container test (needs Docker): the CRM builds into an image, serves /health, and data
// written through the UI survives replacing the container, because it lives in /data.
// Run after `pnpm build`: `pnpm test:container`.
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

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

const startContainer = () =>
  run("docker", ["run", "-d", "--name", name, "-p", `${port}:3000`, "-v", `${name}:/data`, name]);

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

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${base}/customers/new`);
    await page.getByRole("textbox", { name: "Name *" }).fill("Container Test AB");
    await page.getByRole("button", { name: "Create customer" }).click();
    await page.waitForURL(`${base}/customers`);
    await page.getByRole("cell", { name: "Container Test AB" }).waitFor();
    console.log("✓ a customer is created through the UI");

    run("docker", ["rm", "-f", name]);
    startContainer();
    await waitForHealth();
    await page.goto(`${base}/customers`);
    await page.getByRole("cell", { name: "Container Test AB" }).waitFor({ timeout: 5000 });
    console.log("✓ the customer survives replacing the container");
  } finally {
    await browser.close();
  }
} catch (error) {
  failed = true;
  console.log(`✗ ${error.message}`);
} finally {
  spawnSync("docker", ["rm", "-f", name]);
  spawnSync("docker", ["volume", "rm", name]);
  spawnSync("docker", ["image", "rm", name]);
}
process.exit(failed ? 1 : 0);
