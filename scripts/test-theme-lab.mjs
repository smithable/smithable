// Focused live browser check; uses only its own generated fixture and process group.
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { chromium } from "playwright";
import { cli, newApp, run } from "./dev-app.mjs";
import { checkPorts } from "./ports.mjs";
import { checkPreviewPages, checkPreviewTimeout } from "./preview-pages-checks.mjs";
import { checkProjectLookApply } from "./project-look-checks.mjs";
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
if (process.env.CHECK_DISCOVERY === "1") {
  if (!owned) throw new Error("Controlled discovery requires this runner's fresh owned fixture");
  const db = new DatabaseSync(join(dir, "data/db/app.db"));
  db.exec(
    "PRAGMA foreign_keys=OFF; BEGIN; UPDATE customers SET id=id+10000; UPDATE orders SET customer_id=customer_id+10000; UPDATE follow_ups SET customer_id=customer_id+10000; DELETE FROM orders; COMMIT;",
  );
  db.close();
}
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
let applied;
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/api/start`)).ok) break;
    } catch {}
    if (i > 240 || child.exitCode !== null) throw new Error(`lab startup failed: ${log}`);
    await new Promise((done) => setTimeout(done, 250));
  }
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  page = await context.newPage();
  page.on("pageerror", (error) => console.error("Lab page error:", String(error)));
  await page.goto(`http://localhost:${port}/?guide=off`);
  await checkPreviewPages(page, dir);
  if (process.env.CHECK_DISCOVERY === "1") await checkPreviewTimeout(page);
  await checkThemeLab(page);
  if (process.env.CHECK_SAVE_FIRST === "1") {
    await page.getByLabel("Name", { exact: true }).fill(`saved-before-apply-${Date.now()}`);
    await page.getByRole("button", { name: /^Save/ }).click();
    await page
      .getByRole("status")
      .filter({ hasText: /^Saved:/ })
      .waitFor();
  }
  if (process.env.CHECK_PROJECT_APPLY === "1") applied = await checkProjectLookApply(page, dir);
  passed = true;
} catch (error) {
  await page
    ?.screenshot({ path: join(dirname(dir), "look-failure.png"), fullPage: true })
    .catch(() => {});
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
  if (!passed) console.error(`Fixture retained: ${dir}\n${log.slice(-3000)}`);
}

if (applied) {
  try {
    run(["node", cli, "undo", "--dir", dir]);
    run(["node", cli, "redo", "--dir", dir]);
    const lookModule = new URL("../packages/cli/dist/project-look.js", import.meta.url).href;
    const coreModule = new URL("../packages/core/dist/index.js", import.meta.url).href;
    const selected = run([
      "node",
      "--input-type=module",
      "-e",
      `import {projectLook} from ${JSON.stringify(lookModule)}; import {validateUx,resolveLook} from ${JSON.stringify(coreModule)}; const p=projectLook(${JSON.stringify(dir)}); const ux=validateUx({path:'smithable.ux.yml',text:p.uxText},p.ir,p.themes,p.auth).ux; console.log(resolveLook(ux,p.themes,p.page).theme.name);`,
    ]);
    if (selected.trim() !== applied.name)
      throw new Error(`Fresh process reopened ${selected}, expected ${applied.name}`);
    console.log("  ✓ real generation Undo/Redo and fresh-process reopen preserve the applied look");
  } catch (error) {
    console.error(`Fixture retained: ${dir}`);
    throw error;
  }
}
if (passed && owned) rmSync(dirname(dir), { recursive: true, force: true });
