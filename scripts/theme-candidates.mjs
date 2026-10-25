// Theme candidates by rule, not by a model: for each of ten families, a few primary hues, with
// OKLCH lightness ladders for background, card, muted, border and accent in both modes (the
// ladders the delivered presets use), an accent from a color harmony, a font, a radius, a shadow
// and a density. Every candidate is checked like any theme (parseTheme: contrast included) and
// the unreadable are dropped. Writes themes/<name>.yml and an overview of the thumbnails;
// --sheets also runs the theme sheet on every survivor (a minute each), for judging by eye.
// Run after `pnpm build`: `node scripts/theme-candidates.mjs [family…] [--out dir] [--sheets]`.
// Not part of `check`.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { parseTheme, themeThumbnail } from "../packages/core/dist/index.js";

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", default: "/mnt/c/Users/johan/Pictures/claude/themes/candidates" },
    sheets: { type: "boolean" },
  },
});

// Each family: primary hues to try, the primary's chroma and lightness (light mode), how much of
// the hue the surfaces carry, and the shape. `harmony` turns the primary's hue into the accent's.
const FAMILIES = {
  "nordic-light": {
    hues: [230, 205, 250],
    chroma: 0.12,
    l: 0.5,
    tint: 0.008,
    font: "Inter",
    radius: "8px",
    shadow: "soft",
    harmony: 30,
  },
  editorial: {
    hues: [25, 15, 350],
    chroma: 0.14,
    l: 0.42,
    tint: 0.012,
    surfaceHue: 85,
    font: "Source Sans 3",
    radius: "2px",
    shadow: "none",
    harmony: 180,
  },
  "warm-craft": {
    hues: [45, 30, 60],
    chroma: 0.13,
    l: 0.5,
    tint: 0.015,
    surfaceHue: 75,
    font: "Nunito Sans",
    radius: "12px",
    shadow: "soft",
    harmony: 150,
  },
  "tech-dark": {
    hues: [195, 165, 280],
    chroma: 0.15,
    l: 0.5,
    tint: 0.01,
    surfaceHue: 260,
    font: "Inter",
    radius: "6px",
    shadow: "none",
    harmony: 180,
    cool: true,
  },
  pastel: {
    hues: [330, 290, 160],
    chroma: 0.1,
    l: 0.55,
    tint: 0.02,
    font: "Nunito Sans",
    radius: "16px",
    shadow: "raised",
    harmony: 60,
  },
  "high-contrast": {
    hues: [260, 25, 145],
    chroma: 0.2,
    l: 0.42,
    tint: 0,
    font: "Inter",
    radius: "4px",
    shadow: "none",
    harmony: 180,
    contrast: true,
  },
  mono: {
    hues: [0],
    chroma: 0,
    l: 0.25,
    tint: 0,
    font: "Inter",
    radius: "6px",
    shadow: "none",
    harmony: 0,
  },
  forest: {
    hues: [145, 160, 125],
    chroma: 0.11,
    l: 0.45,
    tint: 0.012,
    font: "Source Sans 3",
    radius: "10px",
    shadow: "soft",
    harmony: -120,
  },
  coastal: {
    hues: [215, 190, 235],
    chroma: 0.12,
    l: 0.5,
    tint: 0.012,
    surfaceHue: 90,
    darkFollowsPrimary: true, // sand by day, sea by night
    font: "Nunito Sans",
    radius: "12px",
    shadow: "soft",
    harmony: 150,
  },
  "corporate-blue": {
    hues: [255, 245, 265],
    chroma: 0.17,
    l: 0.45,
    tint: 0.006,
    font: "Source Sans 3",
    radius: "4px",
    shadow: "none",
    harmony: 30,
    density: "compact",
  },
};

const ok = (l, c, h) =>
  `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${(((h % 360) + 360) % 360).toFixed(1)})`;

/** One candidate's colors in both modes, from a family and a primary hue. */
function colors(f, hue) {
  const sh = f.surfaceHue ?? hue; // the surfaces' hue: the primary's, or a paper or slate tone
  const dh = f.darkFollowsPrimary ? hue : sh;
  const accentHue = hue + f.harmony;
  const fgL = f.contrast ? 0.15 : 0.24;
  const light = {
    background: ok(f.contrast ? 1 : f.cool ? 0.97 : 0.978, f.tint, sh),
    foreground: ok(fgL, Math.min(f.chroma, 0.03), sh),
    card: ok(1, 0, sh),
    primary: ok(f.l, f.chroma, hue),
    muted: ok(0.95, f.tint * 1.5, sh),
    border: ok(f.contrast ? 0.45 : 0.62, f.tint * 3 + 0.01 * Math.sign(f.chroma), sh),
    accent: ok(0.94, Math.min(f.chroma, 0.04), accentHue),
  };
  const dark = {
    background: ok(f.contrast ? 0.12 : 0.19, f.tint * 2.5, dh),
    foreground: ok(f.contrast ? 0.99 : 0.96, f.tint, dh),
    card: ok(f.contrast ? 0.16 : 0.245, f.tint * 3, dh),
    primary: ok(0.78, Math.min(f.chroma, 0.12), hue),
    muted: ok(0.31, f.tint * 3, dh),
    border: ok(0.6, f.tint * 3, dh),
    accent: ok(0.35, Math.min(f.chroma, 0.06), accentHue),
  };
  return { light, dark };
}

const wanted = positionals.length ? positionals : Object.keys(FAMILIES);
const dir = join(opts.out, "themes");
mkdirSync(dir, { recursive: true });
const kept = [];
const dropped = [];
for (const family of wanted) {
  const f = FAMILIES[family];
  if (!f) throw new Error(`no family ${family}; there are ${Object.keys(FAMILIES).join(", ")}`);
  for (const [i, hue] of f.hues.entries()) {
    const name = f.hues.length > 1 ? `${family}-${i + 1}` : family;
    const { light, dark } = colors(f, hue);
    const block = (tokens) =>
      Object.entries(tokens)
        .map(([k, v]) => `  ${k}: "${v}"`)
        .join("\n");
    const text = `# A ${family} candidate (primary hue ${hue}), from scripts/theme-candidates.mjs.
smithableTheme: 0.1
name: ${name}
font: ${f.font}
radius: ${f.radius}
shadow: ${f.shadow}
${f.density ? `density: ${f.density}\n` : ""}light:
${block(light)}
dark:
${block(dark)}
`;
    const { theme, diagnostics } = parseTheme({ path: `${name}.yml`, text }, { contrast: "error" });
    const errors = diagnostics.filter((d) => d.severity === "error");
    if (!theme || errors.length) {
      dropped.push(`${name}: ${errors.map((d) => d.message).join(" ")}`);
      continue;
    }
    writeFileSync(join(dir, `${name}.yml`), text);
    kept.push(theme);
  }
}
console.log(`${kept.length} kept, ${dropped.length} dropped as unreadable`);
for (const d of dropped) console.log(`  ✗ ${d}`);

// The overview: every survivor's thumbnail (light and dark halves), named, on one page.
const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; padding: 16px; background: #777; font: 600 14px system-ui; color: #fff;
         display: grid; grid-template-columns: repeat(4, 340px); gap: 16px; }
  figure { margin: 0; } img { width: 320px; display: block; } figcaption { margin-top: 4px; }
</style>${kept
  .map(
    (t) =>
      `<figure><img src="data:image/svg+xml;utf8,${encodeURIComponent(themeThumbnail(t))}"><figcaption>${t.name} · ${t.font}, ${t.radius}</figcaption></figure>`,
  )
  .join("")}`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
  await page.setContent(html);
  await page.screenshot({ path: join(opts.out, "overview.png"), fullPage: true });
} finally {
  await browser.close();
}
console.log(join(opts.out, "overview.png"));
if (opts.sheets)
  spawnSync(
    "node",
    [
      new URL("theme-sheet.mjs", import.meta.url).pathname,
      ...kept.map((t) => join(dir, `${t.name}.yml`)),
      "--out",
      opts.out,
    ],
    { stdio: "inherit" },
  );
