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
  for (const operation of [
    { name: "addLandingPage", args: { page: "welcome", route: "/welcome" } },
    { name: "setTheme", args: { page: "welcome", preset: "modern" } },
  ]) {
    const response = await fetch(`${base}/api/op`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-smithable": "1" },
      body: JSON.stringify(operation),
    });
    const result = await response.json();
    assert.ok(result.ok, result.output);
  }
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
  await page.getByRole("button", { name: "Look", exact: true }).waitFor();
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
  await page.getByRole("button", { name: "Look", exact: true }).click();
  await page.getByRole("button", { name: "More look settings", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Look", exact: true })
    .getByLabel("Theme selection target", { exact: true })
    .selectOption("welcome");
  await page
    .getByRole("dialog", { name: "Look", exact: true })
    .getByRole("tab", { name: "Customise", exact: true })
    .click();
  await started;
  await stopServer();
  const restarted = await startServer();
  assert.notEqual(
    restarted.lookProject,
    original.lookProject,
    "restart did not replace project identity",
  );
  release();
  const dialog = page.getByRole("dialog", { name: "Look", exact: true });
  await dialog
    .getByText("The project changed. Keep this draft or reopen the current project.", {
      exact: false,
    })
    .waitFor();
  await dialog.getByRole("heading", { name: "Preview unavailable", exact: true }).waitFor();
  assert.ok(await dialog.getByRole("button", { name: "Save theme", exact: true }).isDisabled());
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
  let releaseReopen, arrivedReopen;
  const reopenGate = new Promise((resolve) => {
    releaseReopen = resolve;
  });
  const reopenStarted = new Promise((resolve) => {
    arrivedReopen = resolve;
  });
  await page.route("**/api/project", async (route) => {
    arrivedReopen();
    await reopenGate;
    await route.continue();
  });
  page.once("dialog", (prompt) => prompt.accept());
  await dialog.getByRole("button", { name: "Reopen current project", exact: true }).click();
  await reopenStarted;
  assert.ok(
    await dialog.getByRole("tab", { name: "Theme and settings", exact: true }).isDisabled(),
    "Reopen allowed switching to settings while its request was pending",
  );
  assert.ok(
    await dialog.getByRole("button", { name: "Close look editor", exact: true }).isDisabled(),
    "Reopen allowed closing during its request",
  );
  releaseReopen();
  await dialog
    .getByRole("heading", { name: "Preview unavailable", exact: true })
    .waitFor({ state: "detached" });
  await dialog.locator("iframe[data-frame]").first().waitFor();
  await dialog
    .getByRole("status")
    .filter({ hasText: /Draft preview ready|Saved preview ready/ })
    .waitFor({ timeout: 45000 });
  assert.equal(
    await dialog.getByLabel("Apply theme to", { exact: true }).inputValue(),
    "welcome",
    "reopen silently broadened the draft target",
  );
  await page.unroute("**/api/project");
  assert.equal(operations.length, 0, "recovery wrote an operation");
  await page.screenshot({
    path: join(root, "recovered-after-workspace-restart.png"),
    fullPage: true,
  });
  console.log(JSON.stringify({ root, frames: await dialog.locator("iframe").count() }));
  console.log(
    "PASS actual restart shows recovery; Keep and cancelled Reopen preserve edited draft; confirmed Reopen loads current project frames.",
  );
  await dialog.getByRole("button", { name: "Close look editor", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  await page.unroute("**/api/look?*");
  await page.reload();
  await page.getByLabel("Preview address", { exact: true }).fill("/welcome");
  await page.getByRole("button", { name: "Go", exact: true }).click();
  await page.route("**/api/look?*", (route) =>
    route.fulfill({ status: 503, json: { error: "The connection is temporarily unavailable." } }),
  );
  await page.getByRole("button", { name: "Look", exact: true }).click();
  await page.getByRole("button", { name: "More look settings", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Look", exact: true })
    .getByLabel("Theme selection target", { exact: true })
    .selectOption("welcome");
  await page
    .getByRole("dialog", { name: "Look", exact: true })
    .getByRole("tab", { name: "Customise", exact: true })
    .click();
  await dialog.getByRole("heading", { name: "Preview unavailable", exact: true }).waitFor();
  await dialog.getByLabel("Name", { exact: true }).fill("offline-retry");
  await dialog.getByLabel("Name", { exact: true }).press("Tab");
  assert.equal(await dialog.getByLabel("Name", { exact: true }).inputValue(), "offline-retry");
  await page.unroute("**/api/look?*");
  await dialog.getByRole("button", { name: "Retry opening project", exact: true }).click();
  await dialog
    .getByRole("status")
    .filter({ hasText: /Draft preview ready|Saved preview ready/ })
    .waitFor({ timeout: 45000 });
  assert.equal(
    await dialog.getByLabel("Name", { exact: true }).inputValue(),
    "offline-retry",
    "retry overwrote offline edits",
  );
  assert.equal(operations.length, 0, "retry wrote an operation");
  assert.equal(
    await dialog.getByLabel("Apply theme to", { exact: true }).inputValue(),
    "welcome",
    "retry used a placeholder Apply target",
  );
  assert.ok(
    await dialog.getByRole("button", { name: "Save as new theme", exact: true }).isEnabled(),
  );
  console.log(
    "PASS transient-error Retry connects without replacing offline edits or writing operations.",
  );
  page.once("dialog", (prompt) => prompt.accept());
  await dialog.getByRole("button", { name: "Close look editor", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  await page.route("**/api/look?*", (route) =>
    route.fulfill({ status: 503, json: { error: "The connection is temporarily unavailable." } }),
  );
  await page.getByRole("button", { name: "Look", exact: true }).click();
  await page.getByRole("button", { name: "More look settings", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Look", exact: true })
    .getByLabel("Theme selection target", { exact: true })
    .selectOption("welcome");
  await page
    .getByRole("dialog", { name: "Look", exact: true })
    .getByRole("tab", { name: "Customise", exact: true })
    .click();
  await dialog.getByRole("heading", { name: "Preview unavailable", exact: true }).waitFor();
  await page.unroute("**/api/look?*");
  await dialog.getByRole("button", { name: "Retry opening project", exact: true }).click();
  await dialog
    .getByRole("status")
    .filter({ hasText: /Draft preview ready|Saved preview ready/ })
    .waitFor({ timeout: 45000 });
  assert.equal(await dialog.getByLabel("Name", { exact: true }).inputValue(), "modern");
  assert.equal(await dialog.getByLabel("Apply theme to", { exact: true }).inputValue(), "welcome");
  assert.ok(await dialog.getByRole("button", { name: "Apply look", exact: true }).isDisabled());
  assert.equal(operations.length, 0);
  console.log("PASS unedited Retry opens the saved page look and its target with no dirty draft.");
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
