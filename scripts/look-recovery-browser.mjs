import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..");
const { chromium } = createRequire(resolve(repo, "package.json"))("playwright");
const root = mkdtempSync(join(tmpdir(), "smithable-look-recovery-"));
const dir = join(root, "crm");
const cli = join(repo, "packages/cli/dist/bin.js");
const base = "http://localhost:5780";
const env = { ...process.env, XDG_CONFIG_HOME: join(root, "config") };
for (const key of Object.keys(env))
  if (/^(SMITHABLE_|ANTHROPIC_|OPENAI_|GOOGLE_|GEMINI_|MISTRAL_|AZURE_|AWS_|SMTP_|MAIL_)/.test(key))
    delete env[key];
let server,
  browser,
  page,
  log = "";
async function stopServer() {
  if (!server?.pid) return;
  const gone = new Promise((resolve) => server.once("exit", resolve));
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
  if (server.exitCode === null)
    await Promise.race([gone, new Promise((resolve) => setTimeout(resolve, 5000))]);
  try {
    process.kill(-server.pid, "SIGKILL");
  } catch {}
}
async function startServer() {
  server = spawn(process.execPath, [cli, "studio", dir, "--port", "5780"], {
    cwd: repo,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (data) => {
      log = (log + data).slice(-12000);
    });
  const until = Date.now() + 120000;
  while (Date.now() < until) {
    try {
      const response = await fetch(`${base}/api/project`, { signal: AbortSignal.timeout(1000) });
      const project = response.ok ? await response.json() : undefined;
      if (response.ok && (await (await fetch(`${base}/api/preview/answers`)).json()).ok)
        return project;
    } catch {}
    if (server.exitCode !== null) throw new Error(log);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Studio startup timeout: ${log}`);
}
try {
  execFileSync(
    process.execPath,
    [cli, "new", dir, "--starter", "crm", "--admin", "studio-test@example.invalid"],
    { cwd: repo, env, stdio: "pipe", timeout: 120000 },
  );
  const original = await startServer();
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", (error) => console.error("Page error:", String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") console.error("Browser error:", message.text());
  });
  await page.addInitScript((name) => {
    for (const key of ["guideDone", "presented", "zoneAsked", "ownerAsked"])
      localStorage.setItem(`${key}:${name}`, "1");
  }, original.name);
  const operations = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/op") operations.push(request.postDataJSON());
  });
  await page.goto(`${base}?guide=off`);
  await page.getByRole("button", { name: "Edit look", exact: true }).waitFor();
  let release, arrived;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const started = new Promise((resolve) => {
    arrived = resolve;
  });
  await page.route("**/api/look?*", async (route) => {
    arrived();
    await held;
    await route.continue();
  });
  await page.getByRole("button", { name: "Edit look", exact: true }).click();
  await started;
  await stopServer();
  const restarted = await startServer();
  assert.notEqual(
    restarted.lookProject,
    original.lookProject,
    "restart did not replace project identity",
  );
  release();
  const dialog = page.getByRole("dialog", { name: "Edit look", exact: true });
  await dialog
    .getByText("The project changed. Keep this draft or reopen the current project.", {
      exact: false,
    })
    .waitFor();
  await dialog.getByRole("heading", { name: "Preview unavailable", exact: true }).waitFor();
  await dialog.getByLabel("Name", { exact: true }).fill("kept-draft");
  await dialog.getByLabel("Name", { exact: true }).press("Tab");
  assert.equal(
    await dialog.getByLabel("Name", { exact: true }).inputValue(),
    "kept-draft",
    "draft edit was not accepted",
  );
  await dialog.getByRole("button", { name: "Keep this draft", exact: true }).click();
  assert.equal(await dialog.getByLabel("Name", { exact: true }).inputValue(), "kept-draft");
  await dialog.getByText("This draft is kept.", { exact: false }).waitFor();
  page.once("dialog", (prompt) => prompt.dismiss());
  await dialog.getByRole("button", { name: "Reopen current project", exact: true }).click();
  assert.equal(await dialog.getByLabel("Name", { exact: true }).inputValue(), "kept-draft");
  page.once("dialog", (prompt) => prompt.accept());
  await dialog.getByRole("button", { name: "Reopen current project", exact: true }).click();
  await dialog
    .getByRole("heading", { name: "Preview unavailable", exact: true })
    .waitFor({ state: "detached" });
  await dialog.locator("iframe[data-frame]").first().waitFor();
  await dialog
    .getByRole("status")
    .filter({ hasText: /Draft preview ready|Saved preview ready/ })
    .waitFor({ timeout: 45000 });
  assert.equal(operations.length, 0, "recovery wrote an operation");
  await page.screenshot({
    path: join(root, "recovered-after-workspace-restart.png"),
    fullPage: true,
  });
  console.log(JSON.stringify({ root, frames: await dialog.locator("iframe").count() }));
  console.log(
    "PASS actual restart shows recovery; Keep and cancelled Reopen preserve edited draft; confirmed Reopen loads current project frames.",
  );
} catch (error) {
  if (page)
    await page
      .screenshot({ path: join(root, "reproduction-failure.png"), fullPage: true })
      .catch(() => {});
  console.error(root, log);
  throw error;
} finally {
  await browser?.close();
  await stopServer();
}
