// The theme lab's public mode (docs/design/theme-lab.md §3, step 5): the pages the lab frames,
// exported once per release as static files into docs/site/theme-lab/, so the lab on
// docs.smithable.ai swaps a theme's CSS on real markup with no server. For each starter (booking
// first, with every control, as `smithable theme lab` makes it) makes its app, serves it (port
// 8404), signs in, and saves each frame's page without its scripts, its CSS as one sheet and its
// pictures into frames/<starter>/ (the saving is smithable static's); the offered font variants
// and their language subsets and licenses go into frames/fonts/. `pnpm site` builds the lab beside them. Rerun it
// after a change to the kit's pages or a starter. Not part of `check`.
// Usage: node scripts/theme-lab-export.mjs [starter…]

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { newApp, op, repo, serveDev, signIn } from "./dev-app.mjs";

const out = join(repo, "docs/site/theme-lab");
const port = Number(process.env.THEME_LAB_PORT ?? 8404);
const base = `http://localhost:${port}`;

const { loadSpec } = await import(join(repo, "packages/cli/dist/validate.js"));
const { labFrames } = await import(join(repo, "packages/cli/dist/theme-lab.js"));
const { savePages } = await import(join(repo, "packages/cli/dist/static.js"));
const { FRAME_RUNTIME } = await import(join(repo, "packages/cli/dist/frame-runtime.js"));
const { exportThemeFonts } = await import(join(repo, "packages/cli/dist/theme-fonts.js"));
const { FONT_ASSETS, FONT_ASSET_VERSION, STACK_PROFILE } = await import(
  join(repo, "packages/adapter-tanstack/dist/index.js")
);
const identity = {
  format: 1,
  runtime: createHash("sha256").update(FRAME_RUNTIME).digest("hex"),
  engineBuild: createHash("sha256")
    .update(readFileSync(join(repo, "packages/adapter-tanstack/dist/themes.js")))
    .update(readFileSync(join(repo, "packages/core/dist/theme.js")))
    .update(readFileSync(join(repo, "packages/cli/dist/frame-runtime.js")))
    .digest("hex"),
  engine: JSON.parse(readFileSync(join(repo, "packages/cli/package.json"), "utf8")).version,
  kit: createHash("sha256")
    .update(readFileSync(join(repo, "packages/adapter-tanstack/src/templates.gen.ts")))
    .digest("hex"),
  fonts: createHash("sha256")
    .update(
      JSON.stringify({
        version: FONT_ASSET_VERSION,
        assets: FONT_ASSETS,
        pins: STACK_PROFILE.fonts,
      }),
    )
    .digest("hex"),
};
const { STARTERS } = await import(join(repo, "packages/cli/dist/starters.gen.js"));
const all = ["booking", ...Object.keys(STARTERS).filter((s) => s !== "booking")];
const chosen = process.argv.slice(2);
for (const name of chosen)
  if (!all.includes(name)) throw new Error(`no starter ${name}: ${all.join(", ")}`);

// The lab's app of a starter: booking with a field for each control it has none for.
const labApp = (starter) => {
  const dir = newApp(starter, `theme-lab-${starter}`);
  if (starter === "booking") {
    op(dir, "addField", "ClassType", "price", "money");
    op(dir, "addField", "ClassType", "dropIn", "bool");
    op(dir, "addField", "ClassType", "website", "url");
    op(dir, "addField", "ClassType", "contact", "email");
  }
  return dir;
};

// A run for some starters keeps the others' pages; a full run starts over.
const listed = (() => {
  try {
    return JSON.parse(readFileSync(join(out, "start.json"), "utf8")).starters ?? [];
  } catch {
    return [];
  }
})();
if (!chosen.length) rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "frames"), { recursive: true });

const sets = [];
for (const starter of chosen.length ? chosen : all) {
  const dir = labApp(starter);
  let stop;
  let browser;
  try {
    const { ir } = loadSpec(dir, { out: () => {}, err: (text) => process.stderr.write(text) });
    const frames = labFrames(ir.pages);

    // Refresh offered normal/italic assets on partial runs too.
    exportThemeFonts(dir, join(out, "frames", "fonts"));

    stop = await serveDev(dir, port);
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await signIn(page, base, "admin");
    // The saving is `smithable static`'s, into frames/ of a folder of its own, moved to
    // frames/<starter>/: the frame runtime's ../fonts/ is then frames/fonts/. The lab brings the
    // fonts, so the imported sheets stay out.
    // Saved beside its place, so the move stays on one filesystem (/tmp may be another).
    const saving = mkdtempSync(join(out, "frames", ".saving-"));
    const saved = await savePages(
      page,
      base,
      saving,
      frames.map((f) => ({ ...f, file: f.label.toLowerCase() })),
      { imports: false },
    );
    await browser.close();
    browser = undefined;
    process.removeListener("exit", stop);
    stop();
    stop = undefined;
    rmSync(join(out, "frames", starter), { recursive: true, force: true });
    renameSync(join(saving, "frames"), join(out, "frames", starter));
    rmSync(saving, { recursive: true, force: true });

    // The lab's own labels, for the frames that were saved (a skipped one is not listed).
    const exported = frames
      .map((f) => ({ label: f.label, path: `/frames/${starter}/${f.label.toLowerCase()}.html` }))
      .filter((f) => saved.frames.some((s) => s.path === `/frames/${f.label.toLowerCase()}.html`));
    for (const { label, reason } of saved.skipped)
      console.error(`${starter}: left out ${label}: ${reason}.`);
    sets.push({ name: starter, frames: exported, identity });
    console.log(`${starter}: ${exported.length} pages and ${saved.assets} pictures.`);
  } finally {
    await browser?.close();
    if (stop) {
      process.removeListener("exit", stop);
      stop();
    }
    rmSync(dirname(dir), { recursive: true, force: true });
  }
}

// Booking first, the rest in the starters' order; a starter not made now keeps its pages.
const starters = all
  .map((name) => sets.find((s) => s.name === name) ?? listed.find((s) => s.name === name))
  .filter(Boolean);
writeFileSync(join(out, "start.json"), `${JSON.stringify({ identity, starters }, null, 2)}\n`);
console.log(`Exported ${starters.length} starters into ${out}.`);
process.exit(0);
