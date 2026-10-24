// `smithable theme --from <url>`: a theme from a site (from session C's scripts/theme-from.mjs).
// A browser opens the page, its computed styles give the background, text, primary (the most
// colorful filled button), cards, corners and font in light and dark; they become a theme file,
// the other tokens derived as core derives them, made readable where they are not, and added
// through the addTheme operation. Deterministic, no model. A theme has no layout: it copies how
// a site looks, never how it is built.
import { contrast, gamutMap, hexOf, hexToRgb, parseTheme, rgbToOklch } from "@smithable/core";
import { allowedByRobots } from "./from-page.js";
import type { Io } from "./io.js";
import { runOperation } from "./op.js";
import { VERSION } from "./version.js";

/** What a page looks like in one color scheme, as its computed styles say. */
export interface Look {
  background: string;
  foreground: string | null;
  primary: string | null;
  link: string | null;
  card: string | null;
  border: string | null;
  /** The share of the page's cards that have a shadow. */
  shadowShare: number;
  radius: number | null;
  bodyFont: string | null;
  headingFont: string | null;
}

/** Runs in the page (as text: the CLI has no DOM types): the look of what is on screen. */
const SAMPLE = `(() => {
  // Any CSS color (rgb, oklch from Tailwind 4, color-mix, …) through a one-pixel canvas.
  const pixel = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const parse = (c) => {
    if (!c || c === "transparent") return null;
    pixel.clearRect(0, 0, 1, 1);
    pixel.fillStyle = "#000";
    pixel.fillStyle = c;
    pixel.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data;
    return a < 128 ? null : [r, g, b];
  };
  const hex = (rgb) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
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
  const points = [];
  for (let x = 0.1; x < 1; x += 0.2) for (let y = 0.15; y < 3; y += 0.35) points.push([x * W, y * H]);
  const backgrounds = tally(points.flatMap(([x, y]) => {
    scrollTo(0, Math.max(0, y - H / 2));
    const el = document.elementFromPoint(x, y - scrollY);
    return el ? [[hex(backgroundOf(el)), 1]] : [];
  }));
  scrollTo(0, 0);
  // The page's own background when it says one; bands and pictures over it are sections.
  const own = parse(getComputedStyle(document.body).backgroundColor) ?? parse(getComputedStyle(document.documentElement).backgroundColor);
  const background = own ? hex(own) : backgrounds[0] ?? "#ffffff";
  const texts = [...document.querySelectorAll("p, li, td, dd, blockquote")].filter(visible);
  const foreground = tally(texts.flatMap((el) => {
    const c = parse(getComputedStyle(el).color);
    return c ? [[hex(c), el.textContent.trim().length]] : [];
  }))[0] ?? null;
  const chroma = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);
  const buttons = [...document.querySelectorAll('button, [role="button"], input[type="submit"], a')]
    .filter(visible)
    .flatMap((el) => {
      const s = getComputedStyle(el);
      const c = parse(s.backgroundColor);
      if (!c || hex(c) === background) return [];
      const r = el.getBoundingClientRect();
      return [{ color: hex(c), chroma: chroma(c), area: r.width * r.height, radius: s.borderTopLeftRadius }];
    })
    .sort((a, b) => b.chroma - a.chroma || b.area - a.area);
  const link = tally([...document.querySelectorAll("a")].filter(visible).flatMap((el) => {
    const c = parse(getComputedStyle(el).color);
    return c && chroma(c) > 40 ? [[hex(c), 1]] : [];
  }))[0] ?? null;
  const cards = [...document.querySelectorAll("div, article, section, li, aside")].filter(visible).flatMap((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 160 || r.height < 80 || r.width > W * 0.9) return [];
    const border = parseFloat(s.borderTopWidth) > 0 && parse(s.borderTopColor);
    const shadow = s.boxShadow !== "none";
    if (!border && !shadow) return [];
    return [{ fill: hex(backgroundOf(el)), border: border ? hex(border) : null, shadow, radius: s.borderTopLeftRadius }];
  });
  const inputs = [...document.querySelectorAll("input:not([type=hidden]), select, textarea")].filter(visible).map((el) => getComputedStyle(el).borderTopLeftRadius);
  const radii = tally([...buttons.map((b) => b.radius), ...cards.map((c) => c.radius), ...inputs]
    .map((r) => parseFloat(r)).filter((r) => r > 0 && r < 40).map((r) => [Math.round(r), 1]));
  const family = (el) => (el ? getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim() : null);
  return {
    background,
    foreground,
    primary: buttons[0]?.color ?? null,
    link,
    card: tally(cards.map((c) => [c.fill, 1]))[0] ?? null,
    border: tally(cards.flatMap((c) => (c.border ? [[c.border, 1]] : [])))[0] ?? null,
    shadowShare: cards.length ? cards.filter((c) => c.shadow).length / cards.length : 0,
    radius: radii[0] ?? (buttons.length || cards.length ? 0 : null),
    bodyFont: family(document.body),
    headingFont: family(document.querySelector("h1, h2")),
  };
})()`;

/** The fonts a theme may name, and which families each stands in for. */
const FONT_MATCHES: [string, RegExp][] = [
  // A hosted font by its own name first, so a site in DM Sans keeps DM Sans.
  ["DM Sans", /^dm sans/i],
  ["Outfit", /outfit|urbanist|plus jakarta|jost|sora/i],
  ["Fraunces", /^fraunces/i],
  ["Source Serif 4", /^source serif/i],
  ["Archivo Narrow", /^archivo narrow/i],
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

const L = (hex: string) => rgbToOklch(hexToRgb(hex));
const isDark = (hex: string) => L(hex)[0] < 0.5;

/** Lightness moved until the color reaches `ratio` against `on`, its hue and chroma kept. */
function untilReadable(hex: string, on: string, ratio: number): string {
  let [l, c, h] = L(hex);
  const step = L(on)[0] > 0.5 ? -0.02 : 0.02;
  for (let i = 0; i < 50 && contrast(hexOf(gamutMap([l, c, h])), on) < ratio; i++) l += step;
  return hexOf(gamutMap([l, c, h]));
}

type Mode = {
  background: string;
  foreground: string;
  primary: string;
  card?: string;
  border?: string;
};

/**
 * A theme file from a site's look in light and dark: the gaps filled (a dark mode derived when
 * the site has none, a light one when it is dark by default), the unreadable made readable, the
 * font matched to the nearest hosted one. Pure, so it is tested without a browser.
 */
export function themeFromLook(
  url: string,
  name: string,
  light: Look,
  dark: Look | undefined,
  today: string,
): { text: string; notes: string[] } {
  const notes: string[] = [];
  let base: Look | undefined = light;
  let other = dark;
  if (isDark(light.background)) {
    notes.push(
      "The site is dark by default; its colors are the dark mode, the light mode is derived.",
    );
    [base, other] = [undefined, light];
  }
  const primary = base?.primary ?? base?.link ?? other?.primary ?? other?.link;
  if (!primary) notes.push("No colored button or link found; the primary is a neutral blue.");
  const darkRead =
    other && isDark(other.background) && other.background !== base?.background ? other : undefined;
  let darkMode: Mode | undefined = darkRead
    ? {
        background: darkRead.background,
        foreground: darkRead.foreground ?? "#f0f0f0",
        primary: darkRead.primary ?? darkRead.link ?? primary ?? "#8ab4f8",
      }
    : undefined;
  let lightMode: Mode;
  if (base) {
    lightMode = {
      background: base.background,
      foreground: base.foreground ?? "#1a1a1a",
      primary: primary ?? "#2563eb",
    };
  } else {
    const [, c, h] = L((darkMode as Mode).primary);
    lightMode = {
      background: hexOf(gamutMap([0.985, Math.min(c, 0.01), h])),
      foreground: hexOf(gamutMap([0.2, Math.min(c, 0.02), h])),
      primary: (darkMode as Mode).primary,
    };
  }
  if (!darkMode) {
    const [, c, h] = L(lightMode.primary);
    const background = hexOf(gamutMap([0.18, Math.min(c, 0.02), h]));
    darkMode = {
      background,
      foreground: hexOf(gamutMap([0.94, Math.min(c, 0.01), h])),
      primary: untilReadable(hexOf(gamutMap([0.72, Math.min(c, 0.16), h])), background, 4.5),
    };
    if (base) notes.push("The site has no dark mode; it is derived from the light colors.");
  }
  // The primary is also the focus ring: it stands out from the page (3:1), and text reads (4.5:1).
  for (const mode of [lightMode, darkMode])
    mode.primary = untilReadable(mode.primary, mode.background, 3);
  const read = { light: lightMode.foreground, dark: darkMode.foreground };
  if (base?.card && base.card !== base.background) lightMode.card = base.card;
  if (base?.border) lightMode.border = base.border;
  const source = base ?? (other as Look);
  if (source.radius == null) notes.push("No buttons, cards or fields to read corners from; 8px.");
  const family = source.bodyFont;
  const font = FONT_MATCHES.find(([, pattern]) => family && pattern.test(family))?.[0];
  if (!font && family)
    notes.push(
      `The site's font "${family}" has no near match among the hosted fonts; using Inter.`,
    );
  const colors = (mode: Mode) =>
    Object.entries(mode)
      .map(([k, v]) => `  ${k}: "${v}"`)
      .join("\n");
  // The text as read where it is readable enough, and more contrast where the tokens derived
  // from it (muted, secondary) would not read otherwise.
  let text = "";
  for (const ratio of [4.5, 6, 7.5, 10, 13]) {
    lightMode.foreground = untilReadable(read.light, lightMode.background, ratio);
    darkMode.foreground = untilReadable(read.dark, darkMode.background, ratio);
    text = file();
    if (parseTheme({ path: `themes/${name}.yml`, text }).theme) break;
  }
  return { text, notes };

  function file() {
    return `# From ${url}, read ${today} by smithable theme --from.
smithableTheme: 0.1
name: ${name}
font: ${font ?? "Inter"}                  # the site's: ${family ?? "unknown"}${source.headingFont && source.headingFont !== family ? `, headings ${source.headingFont}` : ""}
radius: ${source.radius ?? 8}px
shadow: ${source.shadowShare > 0.5 ? "soft" : "none"}
light:
${colors(lightMode)}
dark:
${colors(darkMode as Mode)}
`;
  }
}

/** `smithable theme --from <url> [--name x] [--use]`: reads the site and adds its theme. */
export async function themeFrom(
  dir: string,
  io: Io,
  address: string,
  options: { name?: string; use?: boolean },
): Promise<number> {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    io.err(`"${address}" is not a web address; it starts with https://.\n`);
    return 2;
  }
  const name =
    options.name ??
    url.hostname
      .replace(/^www\./, "")
      .replace(/\.[a-z]+$/, "")
      .replace(/[^a-z0-9]+/g, "-");
  const agent = `Mozilla/5.0 (compatible; Smithable/${VERSION}; +https://smithable.ai)`;
  try {
    const robots = await fetch(new URL("/robots.txt", url), {
      headers: { "user-agent": agent },
      signal: AbortSignal.timeout(5000),
    });
    if (robots.ok && !allowedByRobots(await robots.text(), url.pathname)) {
      io.err(`${url.hostname}'s robots.txt asks not to read ${url.pathname}.\n`);
      return 1;
    }
  } catch {}
  // A browser is needed to see the page as it looks: Playwright, when it is installed.
  let chromium: { launch(): Promise<Browser> };
  try {
    ({ chromium } = (await import("playwright")) as unknown as { chromium: typeof chromium });
  } catch {
    io.err(
      "Reading a site's look needs Playwright: npm install -g playwright && npx playwright install chromium\n",
    );
    return 1;
  }
  const browser = await chromium.launch();
  let light: Look;
  let dark: Look;
  try {
    const context = await browser.newContext({
      userAgent: agent,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    const read = async (colorScheme: "light" | "dark") => {
      await page.emulateMedia({ colorScheme });
      await page.goto(url.href, { timeout: 15000, waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      return (await page.evaluate(SAMPLE)) as Look;
    };
    light = await read("light");
    dark = await read("dark");
  } catch (error) {
    io.err(`${url.href} could not be read (${(error as Error).message.split("\n")[0]}).\n`);
    return 1;
  } finally {
    await browser.close();
  }
  const { text, notes } = themeFromLook(
    url.href,
    name,
    light,
    dark,
    new Date().toISOString().slice(0, 10),
  );
  for (const note of notes) io.out(`${note}\n`);
  const checked = parseTheme({ path: `themes/${name}.yml`, text });
  if (!checked.theme) {
    io.err(`${text}\nThe theme read from the site does not pass the checks.\n`);
    return 1;
  }
  return runOperation(
    dir,
    io,
    "addTheme",
    { name, text, ...(options.use ? { use: true } : {}) },
    { yes: false },
  );
}

/** What themeFrom needs of a Playwright browser. */
interface Browser {
  newContext(options: object): Promise<{
    newPage(): Promise<{
      emulateMedia(options: object): Promise<void>;
      goto(url: string, options: object): Promise<unknown>;
      waitForLoadState(state: string, options: object): Promise<void>;
      evaluate(script: string): Promise<unknown>;
    }>;
  }>;
  close(): Promise<void>;
}
