// Themes from the open catalogs (docs/design/look-breadth.md §4): reads a catalog's files and
// writes one candidate theme file per entry, in our theme file's words, through fixed tables
// (token to token, face to the nearest hosted face by class, OKLCH and HSL to hex), so a rerun
// gives the same files. Every candidate is checked like any theme (parseTheme, the contrast
// floor as an error) and the unreadable are listed, not written. Then an overview of the
// survivors' thumbnails, and with --sheets the theme sheet of each (a minute each).
//
//   node scripts/theme-import.mjs hallmark <checkout of Nutlope/hallmark> [--out dir] [--sheets]
//   node scripts/theme-import.mjs tweakcn <path to utils/theme-presets.ts of jnsahaj/tweakcn> [--out dir]
//
// Run after `pnpm build` (or with --core <path to packages/core/dist/index.js> of a build that
// has the fields). The catalogs are MIT (Hallmark) and Apache-2.0 (tweakcn); NOTICE names them.
// Not part of `check`.
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string" },
    core: {
      type: "string",
      default: new URL("../packages/core/dist/index.js", import.meta.url).pathname,
    },
    sheets: { type: "boolean" },
  },
});
const [source, from] = positionals;
if (!source || !from || !["hallmark", "tweakcn"].includes(source)) {
  console.error(
    "usage: node scripts/theme-import.mjs hallmark|tweakcn <checkout or file> [--out dir] [--sheets]",
  );
  process.exit(2);
}
const core = await import(resolve(opts.core));
const {
  parseTheme,
  themeThumbnail,
  gamutMap,
  hexOf,
  FONTS,
  deriveTokens,
  oppositeMode,
  themeNames,
} = core;
/** A candidate named like a built-in theme takes the catalog's name in front (addTheme refuses the clash). */
const BUILT_IN = new Set(themeNames());
const freeName = (name) => (BUILT_IN.has(name) ? `${source}-${name}` : name);
const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
const out = opts.out ?? `/mnt/c/Users/johan/Pictures/claude/themes/${stamp}-import-${source}`;
const dir = join(out, "themes");
mkdirSync(dir, { recursive: true });

// ---- Colours: anything the catalogs write, to our #rrggbb.
const num = (s) => Number.parseFloat(s);
function toHex(value) {
  const v = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(v))
    return `#${[...v.slice(1)].map((c) => c + c).join("")}`.toLowerCase();
  let m = v.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i);
  if (m) {
    const L = m[2] ? num(m[1]) / 100 : num(m[1]) > 1 ? num(m[1]) / 100 : num(m[1]);
    return gamutMap([L, num(m[3]), num(m[4])]);
  }
  m = v.match(/^hsl\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%/i);
  if (m) {
    const h = num(m[1]) / 360;
    const s = num(m[2]) / 100;
    const l = num(m[3]) / 100;
    const f = (n) => {
      const k = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(c * 255)
        .toString(16)
        .padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
  try {
    return hexOf(v);
  } catch {
    return undefined;
  }
}
/** OKLCH lightness and chroma of a hex, for the few decisions that need them. */
function oklch(hex) {
  const [L, C] = core.rgbToOklch(core.hexToRgb(hex));
  return { L, C };
}

// ---- Faces: a hosted one by its own name, else the nearest of its class.
const HOSTED = new Set(FONTS);
const BY_CLASS = {
  "grotesk-sans": "Hanken Grotesk",
  "grotesk-heavy": "Mona Sans",
  "geometric-sans": "Outfit",
  "rounded-sans": "Nunito Sans",
  "roman-serif": "Instrument Serif",
  "high-contrast-serif": "Bodoni Moda",
  "slab-serif": "Zilla Slab",
  "display-condensed": "Oswald",
  "display-heavy": "Big Shoulders Display",
  mono: "JetBrains Mono",
  pixel: "Big Shoulders Display",
  handwritten: "Bricolage Grotesque",
  blackletter: "Bricolage Grotesque",
};
/** Body faces the catalogs name that we do not host, to the nearest we do. */
const BODY_LIKE = {
  "Wix Madefor Text": "Instrument Sans",
  "General Sans": "Hanken Grotesk",
  Switzer: "Instrument Sans",
  Satoshi: "DM Sans",
  Geist: "Inter",
  "Plus Jakarta Sans": "DM Sans",
  Poppins: "Outfit",
  Montserrat: "Outfit",
  "Open Sans": "Source Sans 3",
  Roboto: "Inter",
  Quicksand: "Nunito Sans",
  Lato: "Source Sans 3",
  "Work Sans": "Hanken Grotesk",
  "IBM Plex Sans": "Source Sans 3",
  "Libre Baskerville": "Newsreader",
  Merriweather: "Source Serif 4",
  Lora: "Newsreader",
  "EB Garamond": "Newsreader",
  "Crimson Pro": "Newsreader",
  Literata: "Source Serif 4",
  "Source Code Pro": "JetBrains Mono",
  "Geist Mono": "JetBrains Mono",
  "Courier New": "JetBrains Mono",
  "Space Mono": "JetBrains Mono",
  Oxanium: "Outfit",
  "Architects Daughter": "Nunito Sans",
  Antic: "Hanken Grotesk",
};
const firstFamily = (stack) => stack.split(",")[0].replace(/["']/g, "").trim();
/** The hosted face for a named one, with a note when it is not the same. */
function hosted(name, cls, role) {
  if (HOSTED.has(name)) return { face: name };
  const face =
    BODY_LIKE[name] ??
    (role === "body" && /serif/i.test(cls ?? "") ? "Newsreader" : undefined) ??
    BY_CLASS[cls] ??
    (role === "body" ? "Hanken Grotesk" : "Bricolage Grotesque");
  return { face, note: `${name} → ${face}` };
}
const DISPLAY = new Set([
  "Fraunces",
  "Archivo Narrow",
  "Bricolage Grotesque",
  "Oswald",
  "Big Shoulders Display",
  "Instrument Serif",
  "Young Serif",
  "Bodoni Moda",
]);
/** A display face is no body font: the nearest text face of its kind stands in. */
function bodySafe(face) {
  if (!DISPLAY.has(face)) return face;
  return ["Instrument Serif", "Young Serif", "Bodoni Moda", "Fraunces"].includes(face)
    ? "Newsreader"
    : "Hanken Grotesk";
}

// ---- Shadows, radius, tracking, weight.
function shadowName(css) {
  if (!css || /^none$/i.test(css.trim())) return "none";
  const blurs = [...css.matchAll(/(?:^|,)\s*-?[\d.]+(?:px)?\s+-?[\d.]+(?:px)?\s+([\d.]+)px/g)].map(
    (m) => num(m[1]),
  );
  const blur = Math.max(0, ...blurs);
  return blur === 0 ? "none" : blur <= 4 ? "small" : blur <= 16 ? "soft" : "raised";
}
const radiusOf = (v) => {
  const m = (v ?? "").trim().match(/^([\d.]+)(px|rem)?$/);
  if (!m) return undefined;
  const n = num(m[1]);
  if (m[2] === "rem") return `${Math.round(n * 16)}px`;
  return n > 48 ? "24px" : `${Math.round(n)}px`;
};
const trackingOf = (em) =>
  em === undefined ? undefined : em <= -0.015 ? "tight" : em >= 0.02 ? "wide" : "normal";
const hundreds = (w) => Math.round(w / 100) * 100;

// ---- Writing a theme file from a plain object.
function themeText({
  name,
  comment,
  keywords,
  fonts,
  headings,
  labels,
  surfaces,
  buttons,
  pictures,
  tables,
  radius,
  shadow,
  density,
  motion,
  chroma,
  texture,
  modes,
  light,
  dark,
}) {
  const group = (key, obj) => {
    const entries = Object.entries(obj ?? {}).filter(([, v]) => v !== undefined);
    return entries.length
      ? `${key}: { ${entries.map(([k, v]) => `${k}: ${v}`).join(", ")} }\n`
      : "";
  };
  const block = (key, tokens) =>
    tokens
      ? `${key}:\n${Object.entries(tokens)
          .filter(([, v]) => v)
          .map(([k, v]) => `  ${k}: "${v}"`)
          .join("\n")}\n`
      : "";
  return `${comment
    .split("\n")
    .map((l) => `# ${l}`)
    .join("\n")}
${keywords?.length ? `# keywords: ${keywords.join(", ")}\n` : ""}smithableTheme: 0.1
name: ${name}
${group("fonts", fonts)}${group("headings", headings)}${group("labels", labels)}${group("surfaces", surfaces)}${group("buttons", buttons)}${group("pictures", pictures)}${group("tables", tables)}radius: ${radius}
shadow: ${shadow}
density: ${density ?? "comfortable"}
motion: ${motion ?? "subtle"}
chroma: ${chroma}
${texture && texture !== "none" ? `texture: ${texture}\n` : ""}${modes && modes !== "both" ? `modes: ${modes}\n` : ""}${block("light", light)}${block("dark", dark)}`;
}

// ---- Hallmark: one file per material, a header block and a :root block.
function* hallmark(checkout) {
  const folder = join(checkout, "skills", "hallmark", "references", "themes");
  for (const file of readdirSync(folder)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort()) {
    const text = readFileSync(join(folder, file), "utf8");
    const head = Object.fromEntries(
      [...(text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "").matchAll(/^([a-z]+):\s*(.*)$/gm)].map(
        (m) => [m[1], m[2].trim()],
      ),
    );
    const tokens = Object.fromEntries(
      [
        ...(text.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "").matchAll(
          /--([a-z0-9-]+):\s*([^;]+);/g,
        ),
      ].map((m) => [m[1], m[2].trim()]),
    );
    const slug = head.slug ?? basename(file, ".md");
    const notes = [];
    const color = (key) => (tokens[`color-${key}`] ? toHex(tokens[`color-${key}`]) : undefined);
    const paper = color("paper");
    const ink = color("ink");
    const accent = color("accent");
    if (!paper || !ink || !accent) {
      yield { name: slug, error: "no paper, ink or accent token" };
      continue;
    }
    const { L: paperL } = oklch(paper);
    const mode = paperL < 0.5 ? "dark" : "light";
    // The surfaces and the signal with its own text (a designed pair); the other text colours
    // our parser derives, so they read (the catalog's muted text and second signal are often
    // under the floor on our pairs). A token the material lacks is left out, and derived.
    const tokensOut = {
      background: paper,
      foreground: ink,
      card: mode === "light" ? paper : color("paper-2"),
      muted: color("paper-2"),
      secondary: color("paper-3"),
      border: color("rule"),
      input: color("rule"),
      primary: accent,
      "primary-foreground": color("accent-ink"),
      sidebar: color("paper-2"),
    };
    const [displayClass, ...displayName] = (head.display ?? "").split(" ");
    const heading = hosted(
      displayName.join(" ") || firstFamily(tokens["font-display"] ?? ""),
      displayClass,
      "heading",
    );
    const bodyName = firstFamily(tokens["font-body"] ?? "");
    const body0 = hosted(bodyName, undefined, "body");
    const body = { face: bodySafe(body0.face), note: body0.note };
    if (body.face !== body0.face)
      body.note = `${bodyName} → ${body.face} (a display face is no body font)`;
    for (const n of [heading.note, body.note]) if (n) notes.push(n);
    const typeSection = text.match(/## Type\n([\s\S]*?)\n## /)?.[1] ?? "";
    const controls = text.match(/## Controls\n([\s\S]*?)\n## /)?.[1] ?? "";
    const hint = text.match(/## Build hint\n([\s\S]*)$/)?.[1] ?? "";
    const monoLabels =
      /labels?[^.\n]*\bmono/i.test(typeSection) || /--font-(?:label|mono)/.test(hint);
    const weight0 = tokens["display-weight"] ? hundreds(num(tokens["display-weight"])) : Number.NaN;
    const weight = weight0 >= 300 && weight0 <= 900 ? weight0 : undefined;
    const upper = /text-transform:\s*uppercase/.test(hint) && /h1|h2|display/.test(hint);
    const tracking0 = trackingOf(
      tokens["tracking-display"] ? num(tokens["tracking-display"]) : undefined,
    );
    // Capitals set tight are refused as unreadable: they take normal tracking.
    const tracking = upper && tracking0 === "tight" ? "normal" : tracking0;
    const material = `${head.material ?? ""} ${text.match(/## Surfaces\n([\s\S]*?)\n## /)?.[1] ?? ""}`;
    const photo = (head.photo ?? "natural").split(" ")[0];
    const treatment =
      {
        natural: "natural",
        warm: "warm",
        muted: "muted",
        mono: "mono",
        duotone: "duotone",
        tint: "duotone",
      }[photo] ?? "natural";
    const texture = /\b(?:grain|noise)\b/i.test(material)
      ? "grain"
      : /\b(?:fibre|fiber|newsprint|riso|uncoated|laid paper)\b/i.test(material)
        ? "paper"
        : "none";
    const { C: accentC } = oklch(accent);
    yield {
      name: slug,
      comment: `${head.name ?? slug}, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.\n${head.material ?? ""}${notes.length ? `\nFaces we do not host: ${notes.join("; ")}.` : ""}`,
      keywords: (head.keywords ?? "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      fonts: {
        body: body.face,
        heading: heading.face !== body.face ? heading.face : undefined,
        labels: monoLabels ? "JetBrains Mono" : undefined,
      },
      headings: {
        weight,
        tracking,
        scale: ["display-condensed", "display-heavy", "high-contrast-serif"].includes(displayClass)
          ? "large"
          : undefined,
        case: upper ? "upper" : undefined,
      },
      labels: {
        case: /(?:label|eyebrow|caption)[^}]*text-transform:\s*uppercase/.test(hint)
          ? "upper"
          : undefined,
      },
      surfaces: {
        cards: /\bglass\b/i.test(material)
          ? "glass"
          : tokens["shadow-card"] && shadowName(tokens["shadow-card"]) !== "none"
            ? "raised"
            : "bordered",
        dividers: /hairline|thin rule|light rule/i.test(material)
          ? "light"
          : /two rule weights|heavy rule|thick rule/i.test(material)
            ? "strong"
            : undefined,
      },
      buttons: {
        shape: /\bpill/i.test(controls)
          ? "pill"
          : /\bsquare|no radius|sharp corners/i.test(controls)
            ? "square"
            : "rounded",
        weight: /\bbold\b/i.test(controls) ? "bold" : undefined,
      },
      pictures: { treatment: treatment !== "natural" ? treatment : undefined },
      tables: { numbers: /tabular/i.test(typeSection) ? "tabular" : undefined },
      radius: radiusOf(tokens["radius-card"]) ?? "12px",
      shadow: shadowName(tokens["shadow-card"]),
      chroma: Math.min(0.4, Math.max(0.04, Math.round(accentC * 100) / 100)),
      texture,
      // A material is one palette: the other mode is made from it (oppositeMode), so the
      // candidate has both, as Johan asked (2026-10-31).
      modes: "both",
      [mode]: tokensOut,
      [mode === "light" ? "dark" : "light"]: otherMode(tokensOut, mode),
      weightRange: weight,
      genre: head.genre,
    };
  }
}

/** The other mode's seven given colours, from one mode's given ones. */
function otherMode(given, mode) {
  const made = oppositeMode(deriveTokens(given, mode), mode);
  return Object.fromEntries(
    ["background", "foreground", "card", "primary", "muted", "border", "accent"].map((k) => [
      k,
      hexOf(made[k]),
    ]),
  );
}

// ---- tweakcn: one TypeScript file of presets, read by its shape, never run.
const BRAND_LABELS = new Set([
  "Twitter",
  "Supabase",
  "Vercel",
  "Claude",
  "T3 Chat",
  "Catppuccin",
  "Doom 64",
]);
function* tweakcn(file) {
  const text = readFileSync(file, "utf8");
  const presets = [
    ...text.matchAll(/\n  "?([a-z0-9-]+)"?: \{\n    label: "([^"]+)",([\s\S]*?)\n  \},\n/g),
  ];
  for (const [, key, label, body] of presets) {
    if (BRAND_LABELS.has(label)) continue;
    const mode = (name) => {
      const block = body.match(new RegExp(`${name}: \\{([\\s\\S]*?)\\n      \\}`))?.[1] ?? "";
      return Object.fromEntries(
        [...block.matchAll(/"?([a-z0-9-]+)"?: "([^"]*)"/g)].map((m) => [m[1], m[2]]),
      );
    };
    const light = mode("light");
    const dark = mode("dark");
    if (!light.background || !dark.background) {
      yield { name: key, error: "no light or dark block" };
      continue;
    }
    // The surfaces, the signal and the charts; the text on them our parser derives, so it
    // reads (a preset's white on its blue, or its grey hints, are often under the floor).
    const pick = (m) =>
      Object.fromEntries(
        [
          "background",
          "foreground",
          "card",
          "primary",
          "muted",
          "border",
          "input",
          "sidebar",
          "chart-1",
          "chart-2",
          "chart-3",
          "chart-4",
          "chart-5",
        ]
          .filter((k) => m[k])
          .map((k) => [k, toHex(m[k])]),
      );
    const sansName = firstFamily(light["font-sans"] ?? "Inter, sans-serif");
    const face0 = hosted(sansName, undefined, "body");
    const face = bodySafe(face0.face);
    const notes = face0.note ? [face0.note] : [];
    const blur = light["shadow-blur"] ? num(light["shadow-blur"]) : undefined;
    const opacity = light["shadow-opacity"] ? num(light["shadow-opacity"]) : undefined;
    const shadow =
      blur === undefined || opacity === 0
        ? "none"
        : blur === 0
          ? "none"
          : blur <= 4
            ? "small"
            : blur <= 16
              ? "soft"
              : "raised";
    const { C } = oklch(toHex(light.primary) ?? "#000000");
    const tracking = light["letter-spacing"]
      ? `letter-spacing ${light["letter-spacing"]} is body tracking, which a theme file does not have`
      : undefined;
    yield {
      name: key,
      comment: `${label}, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.${notes.length ? `\nFaces we do not host: ${notes.join("; ")}.` : ""}${tracking ? `\n${tracking}.` : ""}`,
      fonts: { body: face },
      headings: {},
      surfaces: { cards: shadow === "none" ? "bordered" : "raised" },
      radius: radiusOf(light.radius) ?? "8px",
      shadow,
      chroma: Math.min(0.4, Math.max(0.04, Math.round(C * 100) / 100)),
      modes: "both",
      light: pick(light),
      dark: pick(dark),
    };
  }
}

// ---- Check, write, list.
const kept = [];
const dropped = [];
const entries = source === "hallmark" ? [...hallmark(from)] : [...tweakcn(from)];
for (const entry of entries) {
  if (entry.error) {
    dropped.push(`${entry.name}: ${entry.error}`);
    continue;
  }
  entry.name = freeName(entry.name);
  let text = themeText(entry);
  let { theme, diagnostics } = parseTheme(
    { path: `${entry.name}.yml`, text },
    { contrast: "error" },
  );
  // A heading weight the mapped face lacks moves to the nearest it has; said once, by the parser's words.
  const weightProblem = diagnostics.find(
    (d) => /"headings.weight"/.test(d.message) && /goes from/.test(d.message),
  );
  if (weightProblem) {
    const [, low, high] = weightProblem.message.match(/goes from (\d+) to (\d+)/) ?? [];
    const w = Math.min(Math.max(entry.headings.weight ?? 700, Number(low)), Number(high));
    text = themeText({ ...entry, headings: { ...entry.headings, weight: w } });
    ({ theme, diagnostics } = parseTheme(
      { path: `${entry.name}.yml`, text },
      { contrast: "error" },
    ));
  }
  const errors = diagnostics.filter((d) => d.severity === "error");
  if (!theme || errors.length) {
    dropped.push(`${entry.name}: ${errors.map((d) => d.message).join(" ")}`);
    continue;
  }
  writeFileSync(join(dir, `${entry.name}.yml`), text);
  kept.push(theme);
}
console.log(`${source}: ${kept.length} kept, ${dropped.length} dropped`);
for (const d of dropped) console.log(`  ✗ ${d}`);
writeFileSync(
  join(out, "import.md"),
  `# ${source}: ${kept.length} kept, ${dropped.length} dropped (${stamp})\n\nKept: ${kept.map((t) => t.name).join(", ")}\n\nDropped:\n${dropped.map((d) => `- ${d}`).join("\n")}\n`,
);

// The overview: every survivor's thumbnail (light and dark halves), named, on one page.
const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; padding: 16px; background: #777; font: 600 14px system-ui; color: #fff;
         display: grid; grid-template-columns: repeat(4, 340px); gap: 16px; }
  figure { margin: 0; } img { width: 320px; display: block; } figcaption { margin-top: 4px; }
</style>${kept
  .map(
    (t) =>
      `<figure><img src="data:image/svg+xml;utf8,${encodeURIComponent(themeThumbnail(t))}"><figcaption>${t.name} · ${t.font}${t.style.headingFont ? ` / ${t.style.headingFont}` : ""}, ${t.radius}${t.modes !== "both" ? `, ${t.modes} only` : ""}</figcaption></figure>`,
  )
  .join("")}`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
  await page.setContent(html);
  await page.screenshot({ path: join(out, "overview.png"), fullPage: true });
} finally {
  await browser.close();
}
console.log(join(out, "overview.png"));
if (opts.sheets)
  spawnSync(
    "node",
    [
      new URL("theme-sheet.mjs", import.meta.url).pathname,
      ...kept.map((t) => join(dir, `${t.name}.yml`)),
      "--out",
      out,
    ],
    { stdio: "inherit" },
  );
