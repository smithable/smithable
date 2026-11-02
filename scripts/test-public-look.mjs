// Public editor + exported frame protocol; serve only this checkout's built static site.
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { checkThemeLab } from "./theme-lab-checks.mjs";

export async function checkPublicLook(browser) {
  const root = resolve("site");
  const server = createServer((req, res) => {
    const path = new URL(req.url, "http://local").pathname;
    const file = resolve(root, `.${path.endsWith("/") ? `${path}index.html` : path}`);
    if (!file.startsWith(`${root}/`) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404);
      return res.end();
    }
    res.setHeader(
      "content-type",
      {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
      }[extname(file)] ?? "application/octet-stream",
    );
    res.end(readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    page.on("pageerror", (error) => console.error("Public editor error:", String(error)));
    let mutations = 0;
    page.on("request", (req) => {
      if (req.method() === "POST" && new URL(req.url()).pathname.startsWith("/api/")) mutations++;
    });
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
    );
    await page.goto(`${base}/theme-lab/?guide=off`);
    await checkThemeLab(page, {});
    await page.getByRole("status").filter({ hasText: "Draft preview ready" }).waitFor();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download", exact: true }).click();
    assert.match((await download).suggestedFilename(), /\.ya?ml$/);
    assert.equal(await page.getByRole("button", { name: "Apply look", exact: true }).count(), 0);
    assert.equal(mutations, 0);
    console.log(
      "  ✓ public static editor uses versioned own-origin frames, loads all fonts offline and only downloads drafts",
    );
  } finally {
    await page.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const browser = await chromium.launch();
  try {
    await checkPublicLook(browser);
  } finally {
    await browser.close();
  }
}
