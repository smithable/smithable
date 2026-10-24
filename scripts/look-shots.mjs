// Shoots pages in light and dark, desktop (1440) and phone (390), full page, for side-by-sides.
// node scripts/look-shots.mjs <outDir> <label>=<url> [<label>=<url> …]
// node scripts/look-shots.mjs --pair <outDir> <left.png> <right.png> <out.png>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const browser = await chromium.launch();
if (args[0] === "--pair") {
  const [, , left, right, out] = args;
  const page = await browser.newPage({ viewport: { width: 2000, height: 800 } });
  const src = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
  await page.setContent(
    `<body style="margin:0;background:#888;display:flex;gap:16px;align-items:flex-start;padding:16px;font:600 20px sans-serif">
     <figure style="margin:0;flex:1"><figcaption>Reference</figcaption><img src="${src(left)}" style="width:100%"></figure>
     <figure style="margin:0;flex:1"><figcaption>Smithable</figcaption><img src="${src(right)}" style="width:100%"></figure></body>`,
  );
  await page.waitForTimeout(300);
  writeFileSync(out, await page.screenshot({ fullPage: true }));
  await browser.close();
  process.exit(0);
}
if (args[0] === "--slice") {
  // Cuts a tall shot into pieces of <height> pixels at half size, for reading: <png> <height>
  const [, file, h] = args;
  const height = Number(h);
  const b = readFileSync(file);
  const [w, total] = [b.readUInt32BE(16), b.readUInt32BE(20)];
  const page = await browser.newPage({ viewport: { width: w / 2, height: height / 2 } });
  await page.setContent(
    `<body style="margin:0"><img src="data:image/png;base64,${b.toString("base64")}" style="width:${w / 2}px;display:block"></body>`,
  );
  await page.waitForTimeout(300);
  for (let y = 0, i = 0; y < total; y += height, i++) {
    const out = file.split(".png").join(`-part${i}.png`);
    await page.screenshot({
      path: out,
      clip: { x: 0, y: y / 2, width: w / 2, height: Math.min(height, total - y) / 2 },
      fullPage: true,
    });
    console.log(out);
  }
  await browser.close();
  process.exit(0);
}
const [outDir, ...targets] = args;
mkdirSync(outDir, { recursive: true });
const sizes = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
for (const target of targets) {
  const [label, url] = target.split(/=(.*)/s);
  for (const [size, viewport] of Object.entries(sizes))
    for (const colorScheme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport,
        colorScheme,
        // Entrances that play as a section scrolls in would be caught half way in a full-page shot.
        reducedMotion: "reduce",
        deviceScaleFactor: 1,
        isMobile: size === "mobile",
        hasTouch: size === "mobile",
      });
      const page = await context.newPage();
      // Sites that keep the mode in their own storage (next-themes' "theme") follow the scheme too.
      await page.addInitScript((mode) => {
        try {
          localStorage.setItem("theme", mode);
        } catch {}
      }, colorScheme);
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
      // A site whose dark mode is only a class its own switch sets (next-themes without the
      // system's setting): the class, as the switch would.
      if (colorScheme === "dark")
        await page.evaluate(() => {
          const root = document.documentElement;
          if (!root.classList.contains("dark") && !root.dataset.appearance)
            root.classList.add("dark");
        });
      // Scroll through, so sections that rise in as they are seen have risen.
      const height = await page.evaluate(() => document.body.scrollHeight);
      for (let y = 0; y < height; y += 600) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(120);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(800);
      const file = join(outDir, `${label}-${size}-${colorScheme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
      await context.close();
    }
}
await browser.close();
