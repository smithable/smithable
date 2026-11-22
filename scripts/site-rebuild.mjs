// How near the app `smithable new <dir> --from <url>` made comes to the site it read, and how near
// the kit's other looks and kinds would come. Step 1: the public page is read once as a visitor
// (robots.txt first) and its blocks listed top to bottom; the app's landing sections are paired
// with them in order (same kind first). Step 2: each block and its section measured at desk and
// phone width (height, background, columns, words, and where its headings, pictures and buttons
// sit) and scored 0-100. Step 3: per section, every other value of its kind's looks and its
// nearest kinds (texts carried over), each made through operations, measured and undone; the best
// is kept when it gains 3 points, for at most three rounds. Step 4: one sheet per pair. Step 5:
// report.md lists what new --from got wrong or left out (candidate changes to it, not made here)
// and what no candidate reached (the kit's gaps), with the tries and the run's model and spend.
// Run after `pnpm build`: `node scripts/site-rebuild.mjs <url> --app <dir> --out <dir>
// [--new-log <file>] [--copy <dir>] [--port 8405]`. The script names no site; the app, which keeps
// the tries that gained, and the results stay where the arguments say, outside the public
// repository. Not part of `check`.

import { lookup } from "node:dns/promises";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { allowedByRobots, get, isPrivate } from "../packages/cli/dist/from-page.js";
import { SECTION_LOOKS } from "../packages/core/dist/section-looks.js";
import { cli, op, run, serveDev } from "./dev-app.mjs";

const YAML = createRequire(new URL("../packages/core/package.json", import.meta.url))("yaml");

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string" },
    copy: { type: "string" },
    app: { type: "string" },
    "new-log": { type: "string" },
    "measure-only": { type: "boolean", default: false },
    port: { type: "string", default: process.env.SITE_REBUILD_PORT ?? "8405" },
  },
});
const address = positionals[0];
if (!address || !opts.out || !opts.app) {
  console.error(
    "Usage: node scripts/site-rebuild.mjs <url> --app <dir> --out <dir> [--new-log f] [--copy d] [--measure-only]",
  );
  process.exit(2);
}
const url = new URL(address);
mkdirSync(opts.out, { recursive: true });
const DESK = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const AGENT = "Mozilla/5.0 (compatible; Smithable site-rebuild; +https://smithable.ai)";

// ---- Read politely: a public address, and what robots.txt allows.
const addrs = await lookup(url.hostname, { all: true, verbatim: true });
if (addrs.length === 0 || addrs.some((a) => isPrivate(a.address)))
  throw new Error(`${url.hostname} is a private or unreachable address`);
try {
  const { response } = await get(new URL("/robots.txt", url), AbortSignal.timeout(5000), AGENT);
  if (response.ok) {
    const chunks = [];
    for await (const c of response.stream) chunks.push(Buffer.from(c));
    if (!allowedByRobots(Buffer.concat(chunks).toString("utf8"), url.pathname)) {
      console.error(`robots.txt asks not to read ${url.pathname}`);
      process.exit(1);
    }
  } else response.stream.resume();
} catch {}

/** Scrolls a page to its end and back, slowly enough for blocks that appear on scroll. */
async function scrollThrough(page) {
  for (let y = 0, i = 0; i < 80; i++) {
    const end = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    if (y >= end) break;
    y = Math.min(end, y + 500);
    await page.evaluate((to) => scrollTo(0, to), y);
    await page.waitForTimeout(180);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(400);
}

// In the page: the blocks stacked top to bottom, each tagged data-rebuild=<n>, and what each holds.
const BLOCKS = () => {
  const vw = innerWidth;
  const vh = innerHeight;
  const rect = (el) => el.getBoundingClientRect();
  const shown = (el) => {
    const s = getComputedStyle(el);
    const r = rect(el);
    return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
  };
  const wide = (el) => shown(el) && rect(el).height >= 48 && rect(el).width >= vw * 0.5;
  let root = document.body;
  for (;;) {
    const kids = [...root.children].filter(wide);
    if (kids.length === 1 && !kids[0].matches("header,footer,nav")) root = kids[0];
    else break;
  }
  const out = [];
  const take = (el, depth) => {
    for (const k of [...el.children].filter(wide)) {
      // A wrapper with one wide child (main > div > div > sections) is followed down to the
      // element whose children are the sections.
      let inner = k;
      for (let one = [...inner.children].filter(wide); one.length === 1; ) {
        inner = one[0];
        one = [...inner.children].filter(wide);
      }
      const parts = [...inner.children].filter(wide);
      const wrapper =
        k.tagName === "MAIN" ||
        (rect(k).height > vh * 1.6 && !k.matches("header,footer,nav,section"));
      if (depth < 4 && parts.length >= 2 && wrapper) take(inner, depth + 1);
      else out.push(k);
    }
  };
  take(root, 0);
  const top = (el) => rect(el).top + scrollY;
  out.sort((a, b) => top(a) - top(b));
  const blocks = [];
  let bottom = -1;
  for (const el of out) {
    if (top(el) + rect(el).height <= bottom + 4) continue; // inside or behind a block already taken
    blocks.push(el);
    bottom = Math.max(bottom, top(el) + rect(el).height);
  }
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && c !== "transparent" && !/rgba\(.*, 0\)$/.test(c)) return c;
    }
    return "rgb(255, 255, 255)";
  };
  const fonts = new Set();
  const facts = blocks.map((el, i) => {
    el.setAttribute("data-rebuild", String(i));
    const r = rect(el);
    const area = r.width * r.height;
    const pictures = [...el.querySelectorAll("img,picture,svg,video,[style*='background-image']")]
      .filter(shown)
      .filter((p) => !p.closest("picture") || p.tagName === "PICTURE")
      .map(rect)
      .filter((p) => p.width * p.height > area * 0.03 && p.width > 80);
    const bgImage = [el, ...el.querySelectorAll("*")]
      .slice(0, 400)
      .some(
        (e) => getComputedStyle(e).backgroundImage.startsWith("url(") && rect(e).width > vw * 0.5,
      );
    let columns = 1;
    for (const e of [el, ...el.querySelectorAll("*")].slice(0, 1500)) {
      const row = [...e.children].filter(
        (c) => shown(c) && rect(c).width >= 100 && rect(c).height >= 60,
      );
      if (row.length < 2) continue;
      const t = rect(row[0]).top;
      const side = row.filter((c) => Math.abs(rect(c).top - t) < 12).length;
      columns = Math.max(columns, Math.min(side, 6));
    }
    const heading = el.querySelector("h1,h2,h3");
    for (const h of el.querySelectorAll("h1,h2,h3,p"))
      fonts.add(getComputedStyle(h).fontFamily.split(",")[0].replace(/["']/g, "").trim());
    const text = el.innerText.replace(/\s+/g, " ").trim();
    const position = [el, el.firstElementChild]
      .filter(Boolean)
      .map((e) => getComputedStyle(e).position);
    const overlap = pictures.some((a, j) =>
      pictures.some(
        (b, k) =>
          k > j &&
          a.left < b.right - 20 &&
          b.left < a.right - 20 &&
          a.top < b.bottom - 20 &&
          b.top < a.bottom - 20,
      ),
    );
    // Both are page coordinates: the side is against the block's own middle, its left offset included.
    const middle = r.left + r.width / 2;
    const center = pictures.length ? pictures[0].left + pictures[0].width / 2 : middle;
    return {
      n: i,
      tag: el.tagName.toLowerCase(),
      top: Math.round(top(el)),
      height: Math.round(r.height),
      background: bgOf(el),
      backgroundImage: bgImage,
      heading: heading ? heading.tagName.toLowerCase() : null,
      headings: el.querySelectorAll("h2,h3,h4").length,
      pictures: pictures.length,
      pictureShare: Math.min(1, pictures.reduce((s, p) => s + p.width * p.height, 0) / area),
      pictureSide:
        pictures.length && pictures[0].width < r.width * 0.7
          ? center < middle
            ? "left"
            : "right"
          : null,
      video: !!el.querySelector("video,iframe[src*='youtube'],iframe[src*='vimeo']"),
      columns,
      words: text ? text.split(" ").length : 0,
      buttons: [...el.querySelectorAll("a,button")].filter((b) => {
        const c = getComputedStyle(b).backgroundColor;
        return shown(b) && c !== "transparent" && !/rgba\(.*, 0\)$/.test(c);
      }).length,
      nav: !!el.querySelector("nav") || el.tagName === "NAV",
      form: el.querySelectorAll("input,textarea,select").length,
      questions: el.querySelectorAll("details,[aria-expanded]").length,
      quotes: el.querySelectorAll("blockquote,q,[class*='testimonial'],[class*='review']").length,
      prices: (text.match(/[€$£]\s?\d|\d[\d\s.,]*\s?(€|kr|EUR|SEK)\b/g) ?? []).length,
      fixed: position.some((p) => p === "fixed" || p === "sticky"),
      overlap,
      booking: !!el.querySelector("input[type='date'],[class*='booking']"),
    };
  });
  const pageBg = getComputedStyle(document.body).backgroundColor;
  const width = Math.max(
    ...[...document.querySelectorAll("h1,h2,p")]
      .filter(shown)
      .slice(0, 60)
      .map((e) => {
        let w = 0;
        for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (s.maxWidth !== "none") return parseFloat(s.maxWidth) || 0;
          w = rect(p).width;
        }
        return w;
      }),
  );
  return { blocks: facts, fonts: [...fonts], pageBackground: pageBg, contentWidth: width };
};

const rgb = (c) => (c.match(/[\d.]+/g) ?? [255, 255, 255]).slice(0, 3).map(Number);
const luminance = (c) => {
  const [r, g, b] = rgb(c).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const chroma = (c) => Math.max(...rgb(c)) - Math.min(...rgb(c));
const distance = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i])) / 441.7;

/** The band a block's background asks for, against the page's own. */
function band(block, pageBackground) {
  if (distance(block.background, pageBackground) < 0.04) return "none";
  if (chroma(block.background) > 60) return "primary";
  if (Math.abs(luminance(block.background) - luminance(pageBackground)) > 0.5) return "inverse";
  return "muted";
}

/** Each block's nearest section, its looks, and what it has that the section cannot show. */
function plan(read) {
  const { blocks, pageBackground } = read;
  const used = new Set();
  const name = (kind) => {
    let n = kind;
    for (let i = 2; used.has(n); i++) n = `${kind}${i}`;
    used.add(n);
    return n;
  };
  let hero = false;
  return blocks.map((b, i) => {
    const gaps = [];
    if (b.video) gaps.push("video");
    if (b.overlap) gaps.push("overlapping pictures");
    if (b.booking) gaps.push("booking bar");
    const looks = {};
    const last = i === blocks.length - 1;
    let kind;
    if (i === 0 && b.height < 220 && (b.nav || b.words < 40)) kind = "header";
    else if (b.tag === "footer" || (last && !b.heading)) kind = "footer";
    else if (!hero && (b.heading === "h1" || b.pictureShare > 0.5 || b.video)) {
      kind = "hero";
      hero = true;
      const full = b.backgroundImage || b.video || (b.pictureShare > 0.6 && !b.pictureSide);
      looks.layout = full
        ? b.height >= 0.7 * DESK.height
          ? "photo"
          : "cover"
        : b.pictures
          ? "split"
          : "plain";
      if (looks.layout === "split") looks.image = b.pictureSide ?? "right";
      if (b.form) gaps.push("a form in the hero");
    } else if (b.questions >= 2) kind = "faq";
    else if (b.form >= 2) kind = "contact";
    else if (b.prices >= 2) kind = "pricing";
    else if (b.quotes >= 1) kind = "testimonials";
    else if (b.pictures >= 3 && b.columns >= 2 && b.words < 25 * b.pictures) {
      kind = "records";
      looks.layout = "grid";
      looks.columns = String(Math.max(2, b.columns));
    } else if (b.columns >= 2 && b.headings >= 2) {
      kind = "features";
      looks.columns = String(Math.max(2, b.columns));
    } else if (b.pictures >= 1 && b.pictureSide) {
      kind = "mediaText";
      looks.image = b.pictureSide;
    } else if (b.words < 40 && b.buttons >= 1) kind = "callToAction";
    else if (b.pictures >= 3) kind = "gallery";
    else kind = "text";
    if (kind !== "header" && kind !== "footer" && kind !== "hero") {
      const bd = band(b, pageBackground);
      if (bd !== "none") looks.band = bd;
      if (b.backgroundImage) gaps.push("picture behind the section");
    }
    if (b.fixed && kind !== "header") gaps.push("fixed or sticky block");
    const section =
      kind === "header"
        ? "header"
        : kind === "footer"
          ? "footer"
          : kind === "hero"
            ? "hero"
            : name(kind);
    return {
      block: b.n,
      kind,
      section,
      looks,
      gaps,
      items: Math.max(b.columns, Math.min(b.headings, 6)),
      pictures: b.pictures,
    };
  });
}

// ---- Step 1: read the source; read the app `new --from` made (its home page's landing sections).
const browser = await chromium.launch();
const context = await browser.newContext({ userAgent: AGENT, viewport: DESK });
const source = await context.newPage();
await source.goto(url.href, { timeout: 30000, waitUntil: "domcontentloaded" });
await source.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
await scrollThrough(source);
const read = await source.evaluate(BLOCKS);
const mapped = plan(read);
const site = mapped.filter((m) => m.kind !== "header");
const header = mapped.find((m) => m.kind === "header");

const dir = opts.app;
const yml = (file) => {
  const path = join(dir, file);
  return existsSync(path) ? (YAML.parse(readFileSync(path, "utf8")) ?? {}) : {};
};
/** The landing page's sections in order, each with its kind, looks and texts. */
function ourSections() {
  const spec = yml("smithable.yml");
  const ux = yml("smithable.ux.yml");
  const content = yml("smithable.content.yml");
  const pages = Object.entries(spec.pages ?? {}).filter(([, p]) => p?.landing);
  const [page, body] = pages.find(([n, p]) => n === "home" || p.route === "/") ??
    pages[0] ?? [null, null];
  if (!page) return { page: null, list: [] };
  const list = Object.entries(body.landing).map(([name, value]) => {
    const base = name.replace(/\d+$/, "");
    const kind = value?.records
      ? "records"
      : value?.text === true
        ? "text"
        : value?.kind
          ? value.kind
          : value && Object.keys(value).find((k) => SECTION_LOOKS[k])
            ? Object.keys(value).find((k) => SECTION_LOOKS[k])
            : value?.custom
              ? "custom"
              : base === "footer" || base === "hero" || SECTION_LOOKS[base]
                ? base
                : "custom";
    const looks = ux.pages?.[page]?.sections?.[name] ?? {};
    const texts = content.pages?.[page]?.[name] ?? {};
    return { name, kind, looks, texts, records: value?.records };
  });
  return { page, list };
}
const before = ourSections();
if (!before.page) throw new Error(`${dir} has no landing page`);
const page = before.page;

/** Site blocks paired with our sections in order: same kind first; hero and footer only to their own. */
function pair(a, b) {
  const fixed = (k) => k === "hero" || k === "footer";
  const w = (x, y) =>
    x.kind === y.kind ? 3 : fixed(x.kind) || fixed(y.kind) ? Number.NEGATIVE_INFINITY : 1;
  const t = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      t[i][j] = Math.max(t[i + 1][j], t[i][j + 1], w(a[i], b[j]) + t[i + 1][j + 1]);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (t[i][j] === w(a[i], b[j]) + t[i + 1][j + 1]) out.push([i++, j++]);
    else if (t[i][j] === t[i + 1][j]) i++;
    else j++;
  }
  return out;
}
const pairs = pair(site, before.list).map(([i, j]) => ({
  site: site[i],
  ours: before.list[j],
  made: before.list[j],
}));
const sel = (s) => (s.kind === "footer" ? '[data-part="footer"]' : `[data-section="${s.name}"]`);

// ---- Step 2: measure. In the page: an element's boxes (headings, pictures, filled buttons) by
// their cell in a 3 x 3 grid over it, its columns, words, height and background.
const MEASURE = (selector) => {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = (e) => e.getBoundingClientRect();
  const r = rect(el);
  if (r.height < 8) return null;
  const shown = (e) => {
    const s = getComputedStyle(e);
    const b = rect(e);
    return s.display !== "none" && s.visibility !== "hidden" && b.width > 0 && b.height > 0;
  };
  let bg = "rgb(255, 255, 255)";
  for (let e = el; e; e = e.parentElement) {
    const c = getComputedStyle(e).backgroundColor;
    if (c && c !== "transparent" && !/rgba\(.*, 0\)$/.test(c)) {
      bg = c;
      break;
    }
  }
  const area = r.width * r.height;
  const pictures = [...el.querySelectorAll("img,picture,svg,video,[style*='background-image']")]
    .filter(shown)
    .filter((p) => !p.closest("picture") || p.tagName === "PICTURE")
    .map(rect)
    .filter((p) => p.width * p.height > area * 0.03 && p.width > 80);
  const headings = [...el.querySelectorAll("h1,h2,h3,h4")].filter(shown).map(rect);
  const buttons = [...el.querySelectorAll("a,button")]
    .filter((b) => {
      const c = getComputedStyle(b).backgroundColor;
      return shown(b) && c !== "transparent" && !/rgba\(.*, 0\)$/.test(c);
    })
    .map(rect);
  let columns = 1;
  for (const e of [el, ...el.querySelectorAll("*")].slice(0, 1500)) {
    const row = [...e.children].filter(
      (c) => shown(c) && rect(c).width >= 100 && rect(c).height >= 60,
    );
    if (row.length < 2) continue;
    const t = rect(row[0]).top;
    columns = Math.max(
      columns,
      Math.min(row.filter((c) => Math.abs(rect(c).top - t) < 12).length, 6),
    );
  }
  const cell = (b) =>
    `${Math.min(2, Math.max(0, Math.floor((3 * (b.left + b.width / 2 - r.left)) / r.width)))}${Math.min(2, Math.max(0, Math.floor((3 * (b.top + b.height / 2 - r.top)) / r.height)))}`;
  const text = el.innerText.replace(/\s+/g, " ").trim();
  return {
    height: Math.round(r.height),
    bg,
    words: text ? text.split(" ").length : 0,
    columns,
    pics: pictures.length,
    boxes: {
      h: headings.slice(0, 8).map(cell),
      p: pictures.slice(0, 8).map(cell),
      b: buttons.slice(0, 6).map(cell),
    },
  };
};
async function measure(pg, selector, viewport) {
  if (pg.viewportSize().width !== viewport.width) await pg.setViewportSize(viewport);
  const loc = pg.locator(selector).first();
  await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  await pg.waitForTimeout(250);
  return pg.evaluate(MEASURE, selector);
}

const ratio = (a, b) => (a === 0 && b === 0 ? 1 : Math.min(a, b) / Math.max(a, b));
/** How alike two lists of cells are: as many boxes, in the same cells. */
function boxesLike(a, b) {
  if (!a.length && !b.length) return 1;
  const count = (xs) => xs.reduce((m, c) => m.set(c, (m.get(c) ?? 0) + 1), new Map());
  const ca = count(a);
  const cb = count(b);
  let same = 0;
  for (const [c, n] of ca) same += Math.min(n, cb.get(c) ?? 0);
  return 0.5 * ratio(a.length, b.length) + (0.5 * same) / Math.max(a.length, b.length);
}
const WEIGHTS = {
  height: 0.15,
  colour: 0.15,
  pictures: 0.1,
  columns: 0.1,
  words: 0.1,
  headings: 0.15,
  pictureBoxes: 0.15,
  buttons: 0.1,
};
/** A likeness, 0–100, of one width's measures. */
function like(a, b) {
  if (!a || !b) return 0;
  const parts = {
    height: ratio(a.height, b.height),
    colour: 1 - Math.min(1, distance(a.bg, b.bg) * 2),
    pictures: ratio(Math.min(a.pics, 8), Math.min(b.pics, 8)),
    columns: ratio(a.columns, b.columns),
    words: ratio(Math.min(a.words, 400), Math.min(b.words, 400)),
    headings: boxesLike(a.boxes.h, b.boxes.h),
    pictureBoxes: boxesLike(a.boxes.p, b.boxes.p),
    buttons: boxesLike(a.boxes.b, b.boxes.b),
  };
  return 100 * Object.entries(WEIGHTS).reduce((s, [k, w]) => s + w * parts[k], 0);
}
/** The score: desk counts 60, phone 40. */
const score = (src, ours) =>
  Math.round(0.6 * like(src.desk, ours.desk) + 0.4 * like(src.phone, ours.phone));

const sourceMeasure = {};
for (const [name, viewport] of [
  ["desk", DESK],
  ["phone", PHONE],
]) {
  await source.setViewportSize(viewport);
  await scrollThrough(source);
  for (const p of pairs) {
    sourceMeasure[p.site.block] ??= {};
    sourceMeasure[p.site.block][name] = await measure(
      source,
      `[data-rebuild="${p.site.block}"]`,
      viewport,
    );
  }
}

const stop = await serveDev(dir, Number(opts.port));
const ours = await context.newPage();
const base = `http://localhost:${opts.port}/`;
async function reload() {
  await ours.setViewportSize(DESK);
  await ours.goto(base);
  await ours.waitForLoadState("networkidle").catch(() => {});
}
async function measureOurs(s) {
  return {
    desk: await measure(ours, sel(s), DESK),
    phone: await measure(ours, sel(s), PHONE),
  };
}
await reload();
await scrollThrough(ours);
for (const p of pairs) {
  p.first = await measureOurs(p.ours);
  p.before = score(sourceMeasure[p.site.block], p.first);
  p.best = p.before;
  p.kept = [];
}

// ---- Step 3: the loop. For each paired section, every other value of its kind's looks
// (layout, columns, band, picture side, hero height) and its two or three nearest kinds (texts
// carried over), each through operations, measured, then undone; the best kept when it gains 3.
const LOOK_KEYS = ["layout", "columns", "band", "image", "height"];
const NEAR = {
  text: ["mediaText", "callToAction"],
  mediaText: ["text", "features"],
  callToAction: ["text", "mediaText"],
  features: ["text", "mediaText", "gallery"],
  gallery: ["features", "mediaText"],
  testimonials: ["features"],
  faq: ["text"],
  pricing: ["features"],
  contact: ["callToAction"],
};
const CARRY = new Set([
  "text",
  "mediaText",
  "callToAction",
  "features",
  "gallery",
  "faq",
  "pricing",
  "testimonials",
  "contact",
]);
const opLog = [];
const tries = [];
function runOp(args) {
  try {
    op(dir, ...args);
    opLog.push(`ok   ${args.join(" ")}`);
    return true;
  } catch (error) {
    opLog.push(
      `no   ${args.join(" ")}: ${String(error.message).split("\n").filter(Boolean).slice(1, 3).join(" ")}`,
    );
    return false;
  }
}
function undo(n) {
  for (let i = 0; i < n; i++) run(["node", cli, "undo", "--yes", "--dir", dir], dir);
}
/** The candidates for a section: each a label, its operations and the section's name after. */
function candidates(s) {
  const out = [];
  const table = SECTION_LOOKS[s.kind] ?? {};
  for (const key of LOOK_KEYS) {
    const values = table[key];
    if (!Array.isArray(values)) continue;
    const now = String(s.looks[key] ?? values[0]);
    for (const v of values)
      if (String(v) !== now)
        out.push({
          label: `${key} ${v}`,
          ops: [["setSectionLook", page, s.name, key, String(v)]],
          name: s.name,
          kind: s.kind,
        });
  }
  if (CARRY.has(s.kind))
    for (const k of NEAR[s.kind] ?? []) {
      const names = new Set(ourSections().list.map((x) => x.name));
      let name = k;
      for (let i = 2; names.has(name); i++) name = `${k}${i}`;
      const add = ["addSection", page, name];
      if (k === "text") add.push("--text", "true");
      else if (name !== k) add.push("--kind", k);
      const ops = [add];
      for (const field of ["title", "text", "eyebrow"])
        if (typeof s.texts[field] === "string" && s.texts[field])
          ops.push(["setText", s.texts[field], "pages", page, name, field]);
      ops.push(["moveSection", page, name, "--before", s.name], ["removeSection", page, s.name]);
      out.push({ label: `kind ${k}`, ops, name, kind: k });
    }
  return out;
}
// --measure-only scores and photographs the app as it is (after hand work through MCP), with no tries.
const MAX_ROUNDS = opts["measure-only"] ? 0 : 3;
let open = pairs.filter((p) => p.ours.kind !== "footer" && p.ours.kind !== "custom");
for (let round = 1; round <= MAX_ROUNDS && open.length; round++) {
  const gained = [];
  for (const p of open) {
    const current = ourSections().list.find((x) => x.name === p.ours.name);
    if (!current) continue;
    let best = null;
    for (const c of candidates(current)) {
      if (existsSync(join(homedir(), "repos/stop"))) throw new Error("stop file: halting the loop");
      let done = 0;
      let ok = true;
      for (const args of c.ops) {
        if (!runOp(args)) {
          ok = false;
          break;
        }
        done++;
      }
      let s = null;
      if (ok) {
        await ours.waitForTimeout(600);
        await reload();
        s = score(sourceMeasure[p.site.block], await measureOurs({ name: c.name, kind: c.kind }));
      }
      undo(done);
      tries.push({
        round,
        section: p.ours.name,
        try: c.label,
        score: ok ? s : "refused",
        from: p.best,
      });
      if (ok && s >= p.best + 3 && (!best || s > best.score)) best = { ...c, score: s };
    }
    if (best) {
      for (const args of best.ops)
        if (!runOp(args))
          throw new Error(`could not make the kept change again: ${args.join(" ")}`);
      tries.push({
        round,
        section: p.ours.name,
        try: best.label,
        score: best.score,
        from: p.best,
        kept: true,
      });
      p.kept.push(best.label);
      p.best = best.score;
      p.ours = { ...p.ours, name: best.name, kind: best.kind };
      gained.push(p);
    }
  }
  open = gained;
}
await reload();
await scrollThrough(ours);
for (const p of pairs) {
  p.ours = { ...p.ours, ...ourSections().list.find((x) => x.name === p.ours.name) };
  p.last = await measureOurs(p.ours);
  p.after = score(sourceMeasure[p.site.block], p.last);
}

// ---- Step 4: the sheets. Per pair: the site, what new --from made, and after the tries.
async function shot(pg, selector, viewport) {
  await pg.setViewportSize(viewport);
  const box = await pg
    .locator(selector)
    .first()
    .boundingBox()
    .catch(() => null);
  if (!box || box.height < 8) return null;
  const y = box.y + (await pg.evaluate(() => scrollY));
  return pg.screenshot({
    fullPage: true,
    clip: { x: 0, y, width: viewport.width, height: Math.min(box.height, 2400) },
  });
}
const shots = { site: {}, after: {} };
for (const [w, viewport] of [
  ["desk", DESK],
  ["phone", PHONE],
]) {
  await source.setViewportSize(viewport);
  await scrollThrough(source);
  await ours.setViewportSize(viewport);
  await scrollThrough(ours);
  for (const p of pairs) {
    shots.site[w] ??= [];
    shots.after[w] ??= [];
    shots.site[w].push(await shot(source, `[data-rebuild="${p.site.block}"]`, viewport));
    shots.after[w].push(await shot(ours, sel(p.ours), viewport));
  }
  // A site block with no section of ours: its crop goes beside the sheets, for the kit-gap list.
  if (w === "desk")
    for (const m of site)
      if (!pairs.some((p) => p.site.block === m.block)) {
        const png = await shot(source, `[data-rebuild="${m.block}"]`, viewport);
        if (png) writeFileSync(join(opts.out, `unmatched-block-${m.block}.png`), png);
      }
}
stop();

const sheet = await context.newPage();
await sheet.setViewportSize({ width: 1600, height: 900 });
const img = (png) =>
  png
    ? `<img src="data:image/png;base64,${png.toString("base64")}">`
    : `<div class="none">not shown</div>`;
const rows = [];
for (const [i, p] of pairs.entries()) {
  const file = `${String(i + 1).padStart(2, "0")}-${p.ours.name}.jpg`;
  rows.push({
    n: i + 1,
    block: p.site.block,
    siteKind: p.site.kind,
    section: p.made.name === p.ours.name ? p.ours.name : `${p.made.name} → ${p.ours.name}`,
    kind: p.ours.kind,
    before: p.before,
    after: p.after,
    kept: p.kept,
    file,
  });
  await sheet.setContent(`<!doctype html><style>
    body{margin:0;padding:24px;font:15px system-ui;background:#f4f4f5;color:#18181b}
    h1{font-size:20px;margin:0 0 4px} p{margin:0 0 16px;color:#52525b}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;margin-bottom:16px}
    .phone{display:grid;grid-template-columns:390px 390px;gap:16px;justify-content:start}
    h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px;color:#71717a}
    img{width:100%;display:block;border:1px solid #d4d4d8} .phone img{width:390px}
    .none{padding:40px;border:1px dashed #a1a1aa;color:#71717a;text-align:center}
  </style>
  <h1>${i + 1}. site block ${p.site.block} (${p.site.kind}) · our ${p.ours.name} (${p.ours.kind}) · score ${p.before} → ${p.after}</h1>
  <p>${p.kept.length ? `kept: ${p.kept.join(", ")}` : "no try gained 3 points"}</p>
  <div class="row"><div><h2>Site, desk</h2>${img(shots.site.desk[i])}</div><div><h2>Rebuilt, desk</h2>${img(shots.after.desk[i])}</div></div>
  <div class="phone"><div><h2>Site, phone</h2>${img(shots.site.phone[i])}</div><div><h2>Rebuilt, phone</h2>${img(shots.after.phone[i])}</div></div>`);
  await sheet.waitForLoadState("load");
  await sheet.screenshot({ path: join(opts.out, file), fullPage: true, type: "jpeg", quality: 82 });
}
await browser.close();

// ---- Step 5: the report. (a) what new --from got wrong or left out; (b) what no try reached.
const paired = new Set(pairs.map((p) => p.site.block));
const pairedOurs = new Set(pairs.map((p) => p.made.name));
const fromList = [];
for (const m of site)
  if (!paired.has(m.block))
    fromList.push(
      `site block ${m.block} (${m.kind}, ${read.blocks[m.block].height} px high${m.pictures ? `, ${m.pictures} picture(s)` : ""}) has no section`,
    );
for (const s of before.list)
  if (!pairedOurs.has(s.name))
    fromList.push(`our ${s.name} (${s.kind}) has no block on the site's home page`);
for (const p of pairs) {
  const made = p.made;
  if (p.site.kind !== made.kind && p.site.kind !== "text")
    fromList.push(
      `site block ${p.site.block} reads as ${p.site.kind}; new --from made ${made.name} a ${made.kind}`,
    );
  for (const [k, v] of Object.entries(p.site.looks)) {
    const now = made.looks?.[k];
    if (p.site.kind === made.kind && String(now ?? "") !== String(v))
      fromList.push(`${made.name}: the site's look is ${k} ${v}; new --from set ${now ?? "none"}`);
  }
  if (!p.first.desk)
    fromList.push(
      `${made.name}: not on our page${made.kind === "records" ? " (a records section with no records is hidden; new --from seeded none)" : ""}`,
    );
  const sp = sourceMeasure[p.site.block].desk?.pics ?? 0;
  const op0 = p.first.desk?.pics ?? 0;
  if (sp >= 1 && op0 === 0)
    fromList.push(`${made.name}: the site shows ${sp} picture(s) here; ours none`);
  if (sp === 0 && op0 >= 1)
    fromList.push(`${made.name}: ours shows ${op0} picture(s); the site none`);
  if (p.kept.length)
    fromList.push(
      `${made.name}: the tries found ${p.kept.join(", ")} nearer (${p.before} → ${p.after})`,
    );
}
const gapList = [];
for (const m of site)
  if (!paired.has(m.block))
    gapList.push(
      `site block ${m.block} (${m.kind}) has no section of ours: crop unmatched-block-${m.block}.png`,
    );
for (const p of pairs) {
  for (const g of p.site.gaps) gapList.push(`${p.ours.name}: ${g}`);
  if (p.after < 70) gapList.push(`${p.ours.name}: best ${p.after}/100 after the tries`);
}
const extraFonts = read.fonts.filter((f, i, all) => all.indexOf(f) === i).slice(1);
if (extraFonts.length)
  gapList.push(`page: ${extraFonts.length} more font face(s) than the theme's one`);
if (header?.gaps.length) gapList.push(...header.gaps.map((g) => `header: ${g}`));
const runLog =
  opts["new-log"] && existsSync(opts["new-log"]) ? readFileSync(opts["new-log"], "utf8") : "";
const spend = runLog
  .split("\n")
  .filter((l) => /tokens|^model:|elapsed|Read \d+ pages|Starting from/.test(l));
const report = {
  url: url.href,
  app: dir,
  run: spend,
  blocks: read.blocks,
  pairs: rows,
  tries,
  fromList,
  gapList,
};
writeFileSync(join(opts.out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(opts.out, "operations.log"), `${opLog.join("\n")}\n`);
const mean = (k) => Math.round(rows.reduce((s, r) => s + r[k], 0) / Math.max(rows.length, 1));
const md = [
  "# Site rebuild from new --from",
  "",
  `The new --from run: ${spend.join(" · ") || "no log given"}.`,
  "",
  `Mean score ${mean("before")} as made, ${mean("after")} after the tries (${tries.filter((t) => !t.kept).length} tries).`,
  "",
  "| # | Site block | Our section | Score made | After | Kept |",
  "| - | - | - | - | - | - |",
  ...rows.map(
    (r) =>
      `| ${r.n} | ${r.block} ${r.siteKind} | ${r.section} ${r.kind} | ${r.before} | ${r.after} | ${r.kept.join(", ")} |`,
  ),
  "",
  "## (a) What new --from got wrong or left out (candidate changes, not patched here)",
  "",
  ...(fromList.length ? fromList.map((l) => `- ${l}`) : ["- nothing found"]),
  "",
  "## (b) What no candidate in the kit reached",
  "",
  ...(gapList.length ? gapList.map((l) => `- ${l}`) : ["- nothing"]),
  "",
  "## Tries",
  "",
  "| Round | Section | Try | Score | From | Kept |",
  "| - | - | - | - | - | - |",
  ...tries.map(
    (t) =>
      `| ${t.round} | ${t.section} | ${t.try} | ${t.score} | ${t.from} | ${t.kept ? "yes" : ""} |`,
  ),
  "",
];
writeFileSync(join(opts.out, "report.md"), md.join("\n"));
const captions = rows.map(
  (r) =>
    `${r.file}: ${r.n}. site block ${r.block} (${r.siteKind}) beside our ${r.section} (${r.kind}), score ${r.before} as made, ${r.after} after${r.kept.length ? ` (${r.kept.join(", ")})` : ""}`,
);
writeFileSync(join(opts.out, "captions.txt"), `${captions.join("\n")}\n`);
if (opts.copy) {
  mkdirSync(opts.copy, { recursive: true });
  const crops = site
    .filter((m) => !paired.has(m.block))
    .map((m) => `unmatched-block-${m.block}.png`);
  for (const f of [...rows.map((r) => r.file), ...crops, "captions.txt"])
    if (existsSync(join(opts.out, f))) copyFileSync(join(opts.out, f), join(opts.copy, f));
}
console.log(md.slice(0, 12 + rows.length).join("\n"));
console.log(`Sheets and report in ${opts.out}; the app (with the kept tries) is ${dir}.`);
