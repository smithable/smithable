// Opens the spike page in headless Chromium and prints its log. Run from the repo root:
// node spikes/webcontainer/drive.mjs [timeout seconds]
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const dir = new URL(".", import.meta.url).pathname;
const server = spawn("pnpm", ["exec", "vite"], { cwd: dir, detached: true });
const url = "http://localhost:4800/";
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(url)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 250));
}
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => console.log(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
try {
  await page.goto(url);
  console.log("crossOriginIsolated:", await page.evaluate(() => window.crossOriginIsolated));
  await page.waitForFunction(() => window.done === true, null, {
    timeout: Number(process.argv[2] ?? 60) * 1000,
  });
  if (await page.evaluate(() => window.previewUrl)) {
    const started = Date.now();
    const frame = page.frameLocator("#preview");
    await frame.locator("h1").first().waitFor({ timeout: 180000 });
    console.log(`preview rendered after ${((Date.now() - started) / 1000).toFixed(1)} s more:`);
    console.log((await frame.locator("body").innerText()).slice(0, 400));
    const src = await page.evaluate(() => window.previewUrl);
    await page.evaluate(
      (u) => (document.getElementById("preview").src = `${u}/customers/new`),
      src,
    );
    await frame.getByLabel(/^Name/).waitFor({ timeout: 120000 });
    console.log("form without website:", (await frame.getByLabel(/^Website/).count()) === 0);
    const t = Date.now();
    console.log(
      await page.evaluate(() =>
        window.applyOperation("addField", { model: "Customer", field: "website", type: "url" }),
      ),
    );
    await frame.getByLabel(/^Website/).waitFor({ timeout: 60000 });
    console.log(
      `preview shows the new field ${((Date.now() - t) / 1000).toFixed(1)} s after the operation`,
    );
  }
} catch (error) {
  console.log(`driver: ${error.message.split("\n")[0]}`);
} finally {
  await browser.close();
  process.kill(-server.pid);
}
