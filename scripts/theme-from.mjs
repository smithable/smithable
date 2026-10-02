// A theme from a site: opens the page in a browser, reads its colours, type and shape from the
// computed styles, maps them onto a theme file (the other tokens derived as core derives them),
// checks it like any theme and writes themes/<name>.yml. Deterministic, no model. A theme has no
// layout, so this copies how a site looks, never how it is built.
// Run after `pnpm build`: `node scripts/theme-from.mjs <url> [--name x] [--out dir] [--sheet]`.
// --sheet runs scripts/theme-sheet.mjs on the result. Not part of `check`.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import {
  contrast,
  gamutMap,
  hexOf,
  hexToRgb,
  parseTheme,
  rgbToOklch,
} from "../packages/core/dist/index.js";

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: "string" },
    out: { type: "string", default: "themes" },
    sheet: { type: "boolean" },
  },
});
const url = new URL(positionals[0] ?? "");
const name =
  opts.name ??
  url.hostname
    .replace(/^www\./, "")
    .replace(/\.[a-z]+$/, "")
    .replace(/[^a-z0-9]+/g, "-");
const AGENT = "Mozilla/5.0 (compatible; SmithableTheme/0.1; +https://smithable.ai)";

// robots.txt: the groups for our agent, or for every agent; a matching Disallow stops us.
async function allowed() {
  let text = "";
  try {
    const res = await fetch(new URL("/robots.txt", url), {
      headers: { "user-agent": AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return true;
    text = await res.text();
  } catch {
    return true;
  }
  const rules = { ours: [], all: [] };
  let agents = [];
  let inRules = false;
  for (const line of text.split("\n")) {
    const [key, ...rest] = line.replace(/#.*/, "").split(":");
    const value = rest.join(":").trim();
    const k = key.trim().toLowerCase();
    if (k === "user-agent") {
      if (inRules) agents = [];
      inRules = false;
      agents.push(value.toLowerCase());
    } else if (k === "disallow" || k === "allow") {
      inRules = true;
      for (const a of agents) {
        const into = a === "*" ? rules.all : a.includes("smithable") ? rules.ours : null;
        into?.push({ allow: k === "allow", path: value });
      }
    }
  }
  const group = rules.ours.length ? rules.ours : rules.all;
  const path = url.pathname + url.search;
  // The longest matching rule wins, as robots.txt reads.
  const match = group
    .filter((r) => r.path && path.startsWith(r.path.replace(/\*$/, "")))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return !match || match.allow;
}

/** Runs in the page: what the site looks like, as computed styles. */
function sample() {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    return a < 0.5 ? null : [r, g, b];
  };
  const hex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const backgroundOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c) return c;
    }
    return [255, 255, 255];
  };
  const tally = (items) => {
    const counts = new Map();
    for (const [key, weight] of items) counts.set(key, (counts.get(key) ?? 0) + weight);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  };
  const W = innerWidth;
  const H = innerHeight;
  // The page's background: what lies behind the most points of the first screen and below.
  const points = [];
  for (let x = 0.1; x < 1; x += 0.2)
    for (let y = 0.15; y < 3; y += 0.35) points.push([x * W, y * H]);
  const backgrounds = tally(
    points.flatMap(([x, y]) => {
      scrollTo(0, Math.max(0, y - H / 2));
      const el = document.elementFromPoint(x, y - scrollY);
      return el ? [[hex(backgroundOf(el)), 1]] : [];
    }),
  );
  scrollTo(0, 0);
  const background = backgrounds[0] ?? "#ffffff";
  // The text colour: weighted by how much text each colour sets, in paragraphs and lists.
  const texts = [...document.querySelectorAll("p, li, td, dd, blockquote")].filter(visible);
  const foreground =
    tally(
      texts.flatMap((el) => {
        const c = parse(getComputedStyle(el).color);
        return c ? [[hex(c), el.textContent.trim().length]] : [];
      }),
    )[0] ?? null;
  // The primary: the most colourful filled button-like element, larger ones first among equals.
  const chroma = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);
  const buttons = [
    ...document.querySelectorAll(
      'button, [role="button"], input[type="submit"], a[class*="btn"], a[class*="button"], a[class*="cta"]',
    ),
  ]
    .filter(visible)
    .flatMap((el) => {
      const s = getComputedStyle(el);
      const c = parse(s.backgroundColor);
      if (!c || hex(c) === background) return [];
      const r = el.getBoundingClientRect();
      return [
        {
          color: hex(c),
          chroma: chroma(c),
          area: r.width * r.height,
          radius: s.borderTopLeftRadius,
        },
      ];
    })
    .sort((a, b) => b.chroma - a.chroma || b.area - a.area);
  const links = [...document.querySelectorAll("main a, article a, p a, nav a, a")]
    .filter(visible)
    .flatMap((el) => {
      const c = parse(getComputedStyle(el).color);
      return c && chroma(c) > 40 ? [[hex(c), 1]] : [];
    });
  const link = tally(links)[0] ?? null;
  // Cards: boxes with a border or a shadow and a fill of their own.
  const cards = [...document.querySelectorAll("div, article, section, li, aside")]
    .filter(visible)
    .flatMap((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width < 160 || r.height < 80 || r.width > W * 0.9) return [];
      const border = parseFloat(s.borderTopWidth) > 0 && parse(s.borderTopColor);
      const shadow = s.boxShadow !== "none";
      if (!border && !shadow) return [];
      return [
        {
          fill: hex(backgroundOf(el)),
          border: border ? hex(border) : null,
          shadow: shadow ? s.boxShadow : null,
          radius: s.borderTopLeftRadius,
        },
      ];
    });
  const inputs = [...document.querySelectorAll("input:not([type=hidden]), select, textarea")]
    .filter(visible)
    .map((el) => getComputedStyle(el).borderTopLeftRadius);
  const radii = tally(
    [...buttons.map((b) => b.radius), ...cards.map((c) => c.radius), ...inputs]
      .map((r) => parseFloat(r))
      .filter((r) => r > 0 && r < 40)
      .map((r) => [Math.round(r), 1]),
  );
  const firstFamily = (el) =>
    el ? getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim() : null;
  const body = getComputedStyle(document.body);
  return {
    background,
    foreground,
    primary: buttons[0]?.color ?? null,
    link,
    card: tally(cards.map((c) => [c.fill, 1]))[0] ?? null,
    border: tally(cards.flatMap((c) => (c.border ? [[c.border, 1]] : [])))[0] ?? null,
    shadowShare: cards.length ? cards.filter((c) => c.shadow).length / cards.length : 0,
    radius: radii[0] ?? (buttons.length || cards.length ? 0 : null),
    bodyFont: firstFamily(document.body),
    headingFont: firstFamily(document.querySelector("h1, h2")),
    fontSize: body.fontSize,
    lineHeight: body.lineHeight,
  };
}

// The fonts a theme may name, and which families each stands in for.
const FONT_MATCHES = [
  [
    "Nunito Sans",
    /nunito|quicksand|varela|comfortaa|poppins|rubik|mulish|manrope|dm sans|lexend|rounded/i,
  ],
  [
    "Source Sans 3",
    /source sans|open sans|lato|segoe|fira|pt sans|noto sans|roboto|helvetica|arial|work sans/i,
  ],
  ["Inter", /inter|ui-sans-serif|system-ui|-apple-system|sf pro|geist|ibm plex|montserrat/i],
];
const notes = [];
function fontFor(family) {
  if (!family) return "Inter";
  for (const [font, pattern] of FONT_MATCHES) if (pattern.test(family)) return font;
  notes.push(`The site's font "${family}" has no near match among the hosted fonts; using Inter.`);
  return "Inter";
}

const L = (hex) => rgbToOklch(hexToRgb(hex));
/** Lightness moved until the colour reaches the ratio against another, hue and chroma kept. */
function untilReadable(hex, on, ratio) {
  let [l, c, h] = L(hex);
  const step = L(on)[0] > 0.5 ? -0.02 : 0.02;
  for (let i = 0; i < 50 && contrast(hexOf(gamutMap([l, c, h])), on) < ratio; i++) l += step;
  return hexOf(gamutMap([l, c, h]));
}

/** A dark mode from the light one when the site has none: the primary's hue on a near-black. */
function darkFrom(light) {
  const [, c, h] = L(light.primary);
  const background = hexOf(gamutMap([0.18, Math.min(c, 0.02), h]));
  return {
    background,
    foreground: hexOf(gamutMap([0.94, Math.min(c, 0.01), h])),
    primary: untilReadable(hexOf(gamutMap([0.72, Math.min(c, 0.16), h])), background, 4.5),
  };
}

if (!(await allowed())) {
  console.error(`${url.origin}/robots.txt asks robots not to read ${url.pathname}; stopping.`);
  process.exit(1);
}
const browser = await chromium.launch();
let light;
let dark;
try {
  const context = await browser.newContext({
    userAgent: AGENT,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const read = async (colorScheme) => {
    await page.emulateMedia({ colorScheme });
    await page.goto(url.href, { timeout: 15000, waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    if ((await page.evaluate(() => document.body.innerText.trim().length)) < 40)
      throw new Error(
        "the page shows almost no text without JavaScript running longer; nothing to read",
      );
    return page.evaluate(sample);
  };
  light = await read("light");
  dark = await read("dark");
} finally {
  await browser.close();
}

// Light mode: as read, the gaps filled and the unreadable made readable.
const isDark = (hex) => L(hex)[0] < 0.5;
let base = light;
if (isDark(light.background)) {
  notes.push(
    "The site is dark by default; its colours are the dark mode, the light mode is derived.",
  );
  [base, dark] = [null, light];
}
const primarySource = base?.primary ?? base?.link ?? dark.primary ?? dark.link;
if (!primarySource) notes.push("No coloured button or link found; the primary is a neutral blue.");
const lightTokens = base
  ? {
      background: base.background,
      foreground: base.foreground ?? (isDark(base.background) ? "#f5f5f5" : "#1a1a1a"),
      primary: primarySource ?? "#2563eb",
    }
  : null;
const darkRead = dark && isDark(dark.background) && dark.background !== base?.background;
let darkTokens = darkRead
  ? {
      background: dark.background,
      foreground: dark.foreground ?? "#f0f0f0",
      primary: dark.primary ?? dark.link ?? primarySource ?? "#8ab4f8",
    }
  : null;
const lightFinal =
  lightTokens ??
  (() => {
    const [, c, h] = L(darkTokens.primary);
    return {
      background: hexOf(gamutMap([0.985, Math.min(c, 0.01), h])),
      foreground: hexOf(gamutMap([0.2, Math.min(c, 0.02), h])),
      primary: darkTokens.primary,
    };
  })();
if (!darkTokens) {
  darkTokens = darkFrom(lightFinal);
  if (base) notes.push("The site has no dark mode; it is derived from the light colours.");
}
// The primary is the focus ring as well, so it must stand out from the page (3:1), and text on it reads.
for (const mode of [lightFinal, darkTokens]) {
  mode.foreground = untilReadable(mode.foreground, mode.background, 4.5);
  mode.primary = untilReadable(mode.primary, mode.background, 3);
}
if (base?.card && base.card !== base.background) lightFinal.card = base.card;
if (base?.border) lightFinal.border = base.border;

const source = base ?? dark;
const radius = source.radius ?? 8;
if (source.radius == null) notes.push("No buttons, cards or fields to read corners from; 8px.");
const shadow = source.shadowShare > 0.5 ? "soft" : "none";
const font = fontFor(source.bodyFont);

const yaml = `# From ${url.href}, read ${new Date().toISOString().slice(0, 10)} by scripts/theme-from.mjs.
smithableTheme: 0.1
name: ${name}
font: ${font}                  # the site's: ${source.bodyFont ?? "unknown"}${source.headingFont && source.headingFont !== source.bodyFont ? `, headings ${source.headingFont}` : ""}
radius: ${radius}px
shadow: ${shadow}
light:
${Object.entries(lightFinal)
  .map(([k, v]) => `  ${k}: "${v}"`)
  .join("\n")}
dark:
${Object.entries(darkTokens)
  .map(([k, v]) => `  ${k}: "${v}"`)
  .join("\n")}
`;
const { diagnostics } = parseTheme({ path: `${name}.yml`, text: yaml });
mkdirSync(opts.out, { recursive: true });
const file = join(opts.out, `${name}.yml`);
writeFileSync(file, yaml);
console.log(yaml);
for (const note of notes) console.log(`note: ${note}`);
for (const d of diagnostics) console.log(`${d.severity}: ${d.message}`);
console.log(
  `wrote ${file}${diagnostics.some((d) => d.severity === "error") ? " (with errors: it does not read; fix the colours above)" : ""}`,
);
if (opts.sheet)
  spawnSync("node", [new URL("theme-sheet.mjs", import.meta.url).pathname, file], {
    stdio: "inherit",
  });
