// The theme lab's public mode (docs/design/theme-lab.md §3, step 5): the pages the lab frames,
// exported once per release as static files into docs/site/theme-lab/, so the lab on
// docs.smithable.ai swaps a theme's CSS on real markup with no server. Makes the sheet app (the
// booking starter with every control, as `smithable theme lab` makes it), serves it (port
// 8404), signs in, and saves each frame's page without its scripts, its CSS as one sheet, its
// pictures, and the Latin subset of the seven hosted fonts (the saving is smithable static's). `pnpm site` builds the lab beside
// them. Rerun it after a change to the kit's pages or the booking starter. Not part of `check`.
// Usage: node scripts/theme-lab-export.mjs
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
const { savePages } = await import(join(repo, "packages/cli/dist/static.js"));
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

// The saving is `smithable static`'s; the lab brings the fonts, so the imported sheets stay out.
const saved = await savePages(
  page,
  base,
  out,
  frames.map((f) => ({ ...f, file: f.label.toLowerCase() })),
  { imports: false },
);
await browser.close();
stop();

const exported = saved.frames.map((f, i) => ({ label: frames[i].label, path: f.path }));
writeFileSync(join(out, "start.json"), `${JSON.stringify({ frames: exported }, null, 2)}\n`);
console.log(`Exported ${exported.length} pages and ${saved.assets} pictures into ${out}.`);
process.exit(0);
