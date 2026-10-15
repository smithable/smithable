// The theme lab's public mode (docs/design/theme-lab.md §3, step 5): the pages the lab frames,
// exported once per release as static files into docs/site/theme-lab/, so the lab on
// docs.smithable.ai swaps a theme's CSS on real markup with no server. Makes the sheet app (the
// booking starter with every control, as `smithable theme lab` makes it), serves it (port
// 8404), signs in, and saves each frame's page without its scripts, its CSS as one sheet, its
// pictures, and the Latin subset of the seven hosted fonts. `pnpm site` builds the lab beside
// them. Rerun it after a change to the kit's pages or the booking starter. Not part of `check`.
// Usage: node scripts/theme-lab-export.mjs
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { newApp, op, open, repo, serveDev, signIn } from "./dev-app.mjs";

const out = join(repo, "docs/site/theme-lab");
const port = 8404;
const base = `http://localhost:${port}`;

const dir = newApp("booking", "theme-lab");
op(dir, "addField", "ClassType", "price", "money");
op(dir, "addField", "ClassType", "dropIn", "bool");
op(dir, "addField", "ClassType", "website", "url");
op(dir, "addField", "ClassType", "contact", "email");

const { loadSpec } = await import(join(repo, "packages/cli/dist/validate.js"));
const { labFrames } = await import(join(repo, "packages/cli/dist/theme-lab.js"));
const { ir } = loadSpec(dir, { out: () => {}, err: (text) => process.stderr.write(text) });
const frames = labFrames(ir.pages);

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "frames", "assets"), { recursive: true });

// The fonts a theme can name: each package's Latin faces and its licence.
for (const name of readdirSync(join(dir, "node_modules/@fontsource-variable"))) {
  const from = join(dir, "node_modules/@fontsource-variable", name);
  const to = join(out, "fonts", name);
  mkdirSync(join(to, "files"), { recursive: true });
  const faces = readFileSync(join(from, "index.css"), "utf8")
    .split(/(?=\/\* )/)
    .filter((face) => /^\/\* [a-z0-9-]+-latin-wght-normal \*\//.test(face));
  for (const face of faces)
    for (const [, file] of face.matchAll(/url\(\.\/files\/([^)]+)\)/g))
      cpSync(join(from, "files", file), join(to, "files", file));
  writeFileSync(join(to, "index.css"), faces.join(""));
  cpSync(join(from, "LICENSE"), join(to, "LICENSE"));
}

const stop = await serveDev(dir, port);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
await signIn(page, base, "admin");

/** A picture the page uses, saved once under assets/ by its content. */
const assets = new Map();
async function asset(url) {
  if (assets.has(url)) return assets.get(url);
  const response = await page.request.get(url);
  const body = await response.body();
  // An uploaded file (a post's cover at /files/…) has no extension: its type names it.
  const ext = (
    /\.(\w+)$/.exec(new URL(url).pathname)?.[1] ??
    /^image\/(\w+)/.exec(response.headers()["content-type"] ?? "")?.[1] ??
    "bin"
  ).toLowerCase();
  const name = `${createHash("sha256").update(body).digest("hex").slice(0, 12)}.${ext}`;
  writeFileSync(join(out, "frames", "assets", name), body);
  assets.set(url, `assets/${name}`);
  return `assets/${name}`;
}

/** Replaces each same-origin URL in a text (src, srcset, url()) with its saved copy. */
async function localize(text, pattern) {
  let result = "";
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const url = new URL(match[1], base);
    if (url.origin !== base || /\.(css|js|ts|tsx)$/.test(url.pathname)) continue;
    result += text.slice(last, match.index) + match[0].replace(match[1], await asset(url.href));
    last = match.index + match[0].length;
  }
  return result + text.slice(last);
}

const sheets = new Map();
const exported = [];
for (const frame of frames) {
  await open(page, base + frame.path);
  await page.locator("body[data-hydrated=true]").waitFor();
  const { html, css } = await page.evaluate(() => {
    // Every rule the page has, but the fonts' (the lab's theme brings its own).
    const rules = [];
    const walk = (sheet) => {
      for (const rule of sheet.cssRules)
        if (!(rule instanceof CSSImportRule)) rules.push(rule.cssText);
    };
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet);
      } catch {}
    }
    const root = document.documentElement.cloneNode(true);
    for (const node of root.querySelectorAll(
      "script, style, link[rel=stylesheet], link[rel=modulepreload], link[rel=preload]",
    ))
      node.remove();
    return { html: `<!doctype html>\n${root.outerHTML}`, css: rules.join("\n") };
  });
  const sheet = await localize(css, /url\("?([^")]+)"?\)/g);
  const hash = createHash("sha256").update(sheet).digest("hex").slice(0, 12);
  if (!sheets.has(hash)) {
    sheets.set(hash, `app-${hash}.css`);
    writeFileSync(join(out, "frames", `app-${hash}.css`), sheet);
  }
  const file = `${frame.label.toLowerCase()}.html`;
  const body = (
    await localize(html, /(?:src|href)="(\/files\/[^"]+|[^"]+\.(?:webp|png|jpe?g|svg|avif|gif))"/g)
  )
    .replace(/\ssrcset="[^"]*"/g, "")
    .replace(
      "</head>",
      `<link rel="stylesheet" href="${sheets.get(hash)}"><script src="frame.js" defer></script></head>`,
    );
  writeFileSync(join(out, "frames", file), body);
  exported.push({ label: frame.label, path: `/frames/${file}` });
}
await browser.close();
stop();

cpSync(join(repo, "scripts/theme-lab-frame.js"), join(out, "frames", "frame.js"));
writeFileSync(join(out, "start.json"), `${JSON.stringify({ frames: exported }, null, 2)}\n`);
console.log(`Exported ${exported.length} pages and ${assets.size} pictures into ${out}.`);
process.exit(0);
