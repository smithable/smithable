// Focused shared-editor browser runner. Own fixture, fake model, ports and child process group.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { cli, newApp } from "./dev-app.mjs";
import { startFakeModel } from "./fake-model.mjs";
import { checkPorts } from "./ports.mjs";
import {
  checkStudioLook,
  checkStudioLookApply,
  checkStudioLookTimeout,
  checkStudioViewer,
} from "./studio-look-checks.mjs";

const port = Number(process.env.STUDIO_LOOK_PORT ?? 18510);
checkPorts("Studio look", [port, port + 1]);
const owned = !process.env.STUDIO_LOOK_APP;
const dir = process.env.STUDIO_LOOK_APP ?? newApp("crm", "codex-ui-ux-studio-look");
const model = await startFakeModel();
const server = spawn("node", [cli, "studio", dir, "--port", String(port)], {
  cwd: dir,
  detached: true,
  env: {
    ...process.env,
    SMITHABLE_NO_OPEN: "1",
    SMITHABLE_LOCAL_MODEL: "fake-model",
    SMITHABLE_LOCAL_URL: model.url,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));
let browser,
  page,
  passed = false;
const base = `http://localhost:${port}`;
const previewChildren = () =>
  execFileSync("ps", ["--ppid", String(server.pid), "-o", "pid=,args="], { encoding: "utf8" })
    .split("\n")
    .filter((line) => /vite.*dev|theme.*lab/.test(line))
    .map((line) => line.trim().split(/\s+/)[0]);
try {
  let project;
  for (let i = 0; ; i++) {
    try {
      const response = await fetch(`${base}/api/project`);
      if (response.ok) {
        project = await response.json();
        break;
      }
    } catch {}
    if (i > 240 || server.exitCode !== null) throw new Error(`Studio did not start: ${log}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1000 } });
  page = await context.newPage();
  page.on("response", async (response) => {
    if (response.url().includes("/api/look-ticket") && !response.ok())
      console.error(
        "Ticket refusal:",
        response.status(),
        await response.text(),
        response.request().postData(),
      );
  });
  page.on("pageerror", (error) => console.error("Page error:", String(error)));
  if (process.env.DEBUG_LOOK)
    await page.addInitScript(() => {
      window.__lookTrace = [];
      window.addEventListener("message", (event) => {
        const m = event.data;
        if (m?.version === 1)
          window.__lookTrace.push({
            type: m.type,
            document: m.document,
            challenge: m.challenge,
            navigation: m.navigation,
            page: m.page,
            generation: m.generation,
            origin: event.origin,
            status: m.status,
          });
      });
    });
  await page.addInitScript((name) => {
    localStorage.setItem(`presented:${name}`, "1");
    localStorage.setItem(`guideDone:${name}`, "1");
    sessionStorage.setItem("smithable:preview-page", "/orders");
  }, project.name);
  await page.goto(`${base}/?guide=off`);
  await page
    .frameLocator('iframe[title="App preview"]')
    .locator("body[data-hydrated=true]")
    .waitFor({ timeout: 90000 });
  await page.waitForFunction(
    () => document.querySelector('[aria-label="Preview address"]')?.value === "/orders",
  );
  const before = previewChildren();
  assert.equal(before.length, 1, "expected the one existing Vite preview");
  await checkStudioLook(page, dir);
  if (process.env.STUDIO_LOOK_TIMEOUT === "1") await checkStudioLookTimeout(page, dir);
  if (process.env.STUDIO_LOOK_APPLY === "1") {
    await checkStudioLookApply(page, dir);
    await checkStudioViewer(page, dir);
  }
  assert.deepEqual(
    previewChildren(),
    before,
    "opening a look editor spawned another preview process",
  );
  passed = true;
} catch (error) {
  await page
    ?.screenshot({ path: join(dirname(dir), "studio-look-failure.png"), fullPage: true })
    .catch(() => {});
  if (process.env.DEBUG_LOOK)
    for (const frame of page?.frames() ?? [])
      console.error(
        "Frame trace:",
        frame.url(),
        await frame
          .evaluate(() => ({
            trace: window.__lookTrace,
            marker: getComputedStyle(document.documentElement).getPropertyValue(
              "--sm-look-generation",
            ),
          }))
          .catch(() => "unavailable"),
      );
  console.error(`Fixture retained: ${dir}\n${log.slice(-2000)}`);
  throw error;
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
  await model.close();
  if (server.exitCode === null) {
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    if (server.exitCode === null) {
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {}
    }
  }
}
if (passed && owned) rmSync(dirname(dir), { recursive: true, force: true });
