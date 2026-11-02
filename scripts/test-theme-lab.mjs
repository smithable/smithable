// Focused live browser check; uses only its own generated fixture and process group.
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { createServer } from "node:net";
import { dirname } from "node:path";
import { chromium } from "playwright";
import { cli, newApp } from "./dev-app.mjs";
import { checkPorts } from "./ports.mjs";
import { checkThemeLab } from "./theme-lab-checks.mjs";

const port = Number(process.env.THEME_LAB_PORT ?? 18500);
checkPorts("theme fidelity", [port, port + 1]);
for (const candidate of [port, port + 1]) {
  const check = createServer();
  await new Promise((done, fail) => check.once("error", fail).listen(candidate, "127.0.0.1", done));
  await new Promise((done) => check.close(done));
}
const owned = !process.env.THEME_LAB_APP;
const dir = process.env.THEME_LAB_APP ?? newApp("crm", "codex-ui-ux-fidelity");
const child = spawn("node", [cli, "theme", "lab", "--app", dir, "--port", String(port)], {
  cwd: dir,
  env: { ...process.env, SMITHABLE_NO_OPEN: "1" },
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
child.stdout.on("data", (d) => (log += d));
child.stderr.on("data", (d) => (log += d));
let browser;
let page;
let passed = false;
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/api/start`)).ok) break;
    } catch {}
    if (i > 240 || child.exitCode !== null) throw new Error(`lab startup failed: ${log}`);
    await new Promise((done) => setTimeout(done, 250));
  }
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(`http://localhost:${port}/?guide=off`);
  await checkThemeLab(page);
  passed = true;
} catch (error) {
  console.error(
    "Lab draft:",
    await page
      ?.locator("textarea")
      .inputValue()
      .catch(() => "unavailable"),
  );
  console.error(
    "Lab diagnostics:",
    await page
      ?.locator(".notes")
      .innerText()
      .catch(() => "unavailable"),
  );
  throw error;
} finally {
  await browser?.close();
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
  await new Promise((done) => (child.exitCode === null ? child.once("exit", done) : done()));
  if (passed && owned) rmSync(dirname(dir), { recursive: true, force: true });
  else if (!passed) console.error(`Fixture retained: ${dir}\n${log.slice(-3000)}`);
}
