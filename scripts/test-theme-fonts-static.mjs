// Exercise the real exported font assets and frame runtime without any Internet requests.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright";
import { FONT_ASSETS, themeCss } from "../packages/adapter-tanstack/dist/index.js";
import { FRAME_RUNTIME } from "../packages/cli/dist/frame-runtime.js";
import { exportThemeFonts } from "../packages/cli/dist/theme-fonts.js";
import { emptyUx } from "../packages/core/dist/index.js";
import { checkLoadedFont } from "./theme-lab-checks.mjs";

const app = resolve(process.argv[2] ?? "");
if (!process.argv[2] || !existsSync(join(app, "smithable.yml")))
  throw new Error("Pass this session's disposable app fixture.");
const out = join(app, "data", `codex-ui-ux-static-font-check-${Date.now()}`);
if (existsSync(out)) throw new Error(`Refusing to overwrite ${out}`);
let server;
let browser;
let passed = false;
try {
  const fonts = join(out, "frames", "fonts");
  exportThemeFonts(app, fonts);
  // Existing output must not prevent newly missing faces from being repaired.
  const repair = join(fonts, "@fontsource", "zilla-slab", "700-italic.css");
  rmSync(repair);
  exportThemeFonts(app, fonts);
  assert(existsSync(repair));
  let checked = 0;
  for (const asset of FONT_ASSETS) {
    assert(existsSync(join(fonts, asset.package, "LICENSE")));
    for (const variant of asset.variants) {
      const css = readFileSync(join(fonts, asset.package, variant.file), "utf8");
      assert(css.includes("@font-face"), `${asset.font}/${variant.file} contains no faces`);
      for (const [, url] of css.matchAll(/url\(([^)]+)\)/g)) {
        assert(/^\.\/files\/[a-zA-Z0-9-]+\.woff2?$/.test(url), `unexpected font URL ${url}`);
        assert(existsSync(join(fonts, asset.package, url)), `missing ${url}`);
        checked++;
      }
    }
  }
  mkdirSync(join(out, "frames", "fixture"), { recursive: true });
  writeFileSync(join(out, "frames", "frame.js"), FRAME_RUNTIME);
  writeFileSync(
    join(out, "frames", "fixture", "page.html"),
    '<!doctype html><html><body>ÅÄÖ åäö<script src="../frame.js"></script></body></html>',
  );
  writeFileSync(
    join(out, "index.html"),
    '<!doctype html><iframe src="frames/fixture/page.html"></iframe>',
  );
  server = createServer((req, res) => {
    const file = resolve(out, `.${new URL(req.url, "http://localhost").pathname}`);
    if (!file.startsWith(`${out}/`) || !existsSync(file)) {
      res.writeHead(404);
      return res.end();
    }
    res.setHeader(
      "content-type",
      {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".woff2": "font/woff2",
        ".woff": "font/woff",
      }[extname(file)] ?? "application/octet-stream",
    );
    res.end(readFileSync(file));
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  const page = await browser.newPage();
  const failures = [];
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
  page.on("requestfailed", (request) => failures.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(`${origin}/index.html`);
  const frame = page.frames().find((f) => f.url().endsWith("page.html"));
  for (const asset of FONT_ASSETS) {
    const css = themeCss({ ...emptyUx(), theme: { ...emptyUx().theme, font: asset.font } });
    await page.evaluate(
      ({ css, origin }) =>
        document
          .querySelector("iframe")
          .contentWindow.postMessage({ type: "smithable:theme-css", css, mode: "light" }, origin),
      { css, origin },
    );
    await frame.waitForFunction(
      (family) =>
        document.getElementById("sm-theme")?.textContent.includes(`--font-body: "${family}"`),
      asset.family,
    );
    await checkLoadedFont(frame, asset);
  }
  assert.deepEqual(failures, []);
  passed = true;
  console.log(
    `Static export: ${FONT_ASSETS.length} offered families, ${checked} asset references, real normal/italic/weight loads; no external requests.`,
  );
} finally {
  await browser?.close();
  if (server) await new Promise((done) => server.close(done));
  if (passed) rmSync(out, { recursive: true, force: true });
  else console.error(`Static font evidence retained at ${out}`);
}
