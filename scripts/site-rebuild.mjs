// A site rebuilt as a landing page, to see how near the landing sections come to a real site
// (no model). Step 1: the public page is read once as a visitor (robots.txt first), its theme
// taken with `smithable theme --from`, its blocks listed top to bottom (size, background,
// heading, pictures or video, columns), and each block mapped to the nearest landing section and
// look through operations on a fresh starter, with stand-in text and the starter's own library
// pictures: nothing is copied from the site. Step 2: both pages scrolled through (a site that
// reveals on scroll shows its blocks), each block and its section shot at desk and phone width,
// paired in one sheet per section with a rough score (boxes and colour), and what could not be
// mapped listed per section.
// Run after `pnpm build`: `node scripts/site-rebuild.mjs <url> --out <dir> [--copy <dir>]
// [--starter booking] [--port 8405]`. The script names no site; the results (sheets, report.md,
// report.json) go where --out says, outside the public repository. Not part of `check`.

import { lookup } from "node:dns/promises";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { allowedByRobots, get, isPrivate } from "../packages/cli/dist/from-page.js";
import { cli, newApp, op, run, serveDev } from "./dev-app.mjs";

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string" },
    copy: { type: "string" },
    starter: { type: "string", default: "booking" },
    port: { type: "string", default: process.env.SITE_REBUILD_PORT ?? "8405" },
  },
});
const address = positionals[0];
if (!address || !opts.out) {
  console.error(
    "Usage: node scripts/site-rebuild.mjs <url> --out <dir> [--copy <dir>] [--starter x]",
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
      const parts = [...k.children].filter(wide);
      const wrapper =
        k.tagName === "MAIN" ||
        (rect(k).height > vh * 1.6 && !k.matches("header,footer,nav,section"));
      if (depth < 4 && parts.length >= 2 && wrapper) take(k, depth + 1);
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
    const center = pictures.length ? pictures[0].left + pictures[0].width / 2 : r.width / 2;
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
          ? center < r.width / 2
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

// ---- Step 1: read the source, then build its nearest landing page.
const browser = await chromium.launch();
const context = await browser.newContext({ userAgent: AGENT, viewport: DESK });
const source = await context.newPage();
await source.goto(url.href, { timeout: 30000, waitUntil: "domcontentloaded" });
await source.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
await scrollThrough(source);
const read = await source.evaluate(BLOCKS);
const mapped = plan(read);
const sections = mapped.filter((m) => m.kind !== "header");
const header = mapped.find((m) => m.kind === "header");
const headerOver =
  header &&
  read.blocks[header.block].fixed &&
  read.blocks[1] &&
  read.blocks[1].top < read.blocks[0].height;

const dir = newApp(opts.starter, "rebuild");
const log = [];
const tryOp = (...args) => {
  try {
    op(dir, ...args);
    log.push(`ok   ${args.join(" ")}`);
    return true;
  } catch (error) {
    log.push(
      `no   ${args.join(" ")}: ${String(error.message).split("\n").filter(Boolean).slice(1, 3).join(" ")}`,
    );
    return false;
  }
};
try {
  run(["node", cli, "theme", "--from", url.href, "--name", "source", "--use", "--yes"], dir);
  log.push("ok   theme --from (used)");
} catch (error) {
  log.push(`no   theme --from: ${String(error.message).split("\n").slice(1, 3).join(" ")}`);
}
const spec = readFileSync(join(dir, "smithable.yml"), "utf8");
// The home page's landing sections: the lines one level under its "landing:", up to the next key.
const lines = spec
  .slice(spec.indexOf("\n    landing:") + 1)
  .split("\n")
  .slice(1);
const existing = [];
for (const line of lines) {
  if (/^ {0,5}\S/.test(line)) break;
  const key = line.match(/^ {6}([A-Za-z]\w*):/);
  if (key) existing.push(key[1]);
}
const recordsModel = (spec.match(/records: (\w+)/) ?? [])[1];
const recordsSections = existing.filter((s) =>
  new RegExp(`^ {6}${s}: \\{ ?records:`, "m").test(spec),
);
// A planned section takes the starter's own of its kind when there is one (its pictures and items
// kept), first come first served; the starter's others go.
const claimed = new Set();
for (const m of sections) {
  if (m.kind === "hero" || m.kind === "footer") continue;
  const own =
    m.kind === "records"
      ? recordsSections.find((s) => !claimed.has(s))
      : existing.find((s) => s === m.kind && !claimed.has(s));
  if (own) {
    claimed.add(own);
    m.section = own;
    m.reused = true;
  }
}
for (const s of existing)
  if (s !== "hero" && s !== "footer" && !claimed.has(s)) tryOp("removeSection", "home", s);
const width = read.contentWidth >= 1500 ? "full" : read.contentWidth > 1216 ? "wide" : "contained";
tryOp("setLandingWidth", "home", width);
if (header)
  tryOp(
    "setSectionLook",
    "home",
    "header",
    "position",
    read.blocks[header.block].fixed ? "sticky" : "scrolling",
  );
// Library pictures for the hero and the sections with one: the starter's, else a library style's.
const images = join(dir, "public/images");
const listPictures = () => {
  try {
    return readdirSync(images, { recursive: true })
      .filter((f) => /\.(webp|jpe?g|png)$/.test(f) && !/logo/.test(f))
      .sort();
  } catch {
    return [];
  }
};
if (listPictures().length === 0) tryOp("setPictureStyle", "photographs");
const pictures = listPictures();
const STAND_IN = {
  title: "A heading of about this length",
  text: "A sentence or two of stand-in text where the site says what this part is about.",
};
const ITEM = {
  features: (i) => ({ title: `Point ${i + 1}`, text: "A short line of stand-in text." }),
  faq: (i) => ({
    question: `A question a visitor asks, number ${i + 1}?`,
    answer: "A plain answer in a sentence.",
  }),
  testimonials: (i) => ({
    quote: "A sentence a client said, in stand-in words.",
    name: `Client ${i + 1}`,
    role: "Homeowner",
  }),
  pricing: (i) => ({
    name: `Plan ${i + 1}`,
    price: `${(i + 1) * 100}`,
    period: "job",
    text: "What is included.",
    button: "Ask",
  }),
};
for (const m of sections) {
  if (m.kind === "hero") {
    for (const [k, v] of Object.entries(m.looks)) tryOp("setSectionLook", "home", "hero", k, v);
    tryOp("setText", STAND_IN.title, "pages", "home", "hero", "title");
    tryOp("setText", STAND_IN.text, "pages", "home", "hero", "subtitle");
    continue;
  }
  if (m.kind === "footer") continue;
  let added = m.reused;
  if (added) log.push(`ok   kept the starter's ${m.section} as ${m.kind}`);
  else if (m.kind === "records")
    added = recordsModel && tryOp("addSection", "home", m.section, "--records", recordsModel);
  else if (m.kind === "text") added = tryOp("addSection", "home", m.section, "--text", "true");
  else if (m.section === m.kind) added = tryOp("addSection", "home", m.section);
  else added = tryOp("addSection", "home", m.section, "--kind", m.kind);
  if (!added) {
    m.gaps.push(`no ${m.kind} section could be added`);
    continue;
  }
  m.added = true;
  for (const [k, v] of Object.entries(m.looks))
    if (!tryOp("setSectionLook", "home", m.section, k, v)) m.gaps.push(`look ${k} ${v} refused`);
  if (ITEM[m.kind] && !m.reused)
    tryOp(
      "setItems",
      "home",
      m.section,
      "--items",
      JSON.stringify(
        Array.from({ length: Math.min(Math.max(m.items, 2), 6) }, (_, i) => ITEM[m.kind](i)),
      ),
    );
  // A records block with pictures on the site: its model gets a pictures field (cards and the grid
  // show the first as the cover), and a kept section loses the starter's own title and text.
  if (m.kind === "records") {
    const model =
      (spec.match(new RegExp(`^ {6}${m.section}: \\{ ?records: (\\w+)`, "m")) ?? [])[1] ??
      recordsModel;
    const block = spec.match(new RegExp(`^  ${model}:\\n((?: {4,}.*\\n)*)`, "m"))?.[1] ?? "";
    if (m.pictures >= 2 && model && !/: (picture|pictures)\b/.test(block))
      if (!tryOp("addField", model, "photos", "pictures"))
        m.gaps.push("no pictures field could be added");
    if (m.reused) {
      tryOp("setText", STAND_IN.title, "pages", "home", m.section, "title");
      tryOp("setText", STAND_IN.text, "pages", "home", m.section, "text");
    }
  }
  if (m.kind !== "records" && !m.reused) {
    tryOp("setText", STAND_IN.title, "pages", "home", m.section, "title");
    tryOp("setText", STAND_IN.text, "pages", "home", m.section, "text");
  }
  if (m.kind === "mediaText" && pictures.length) {
    const picture = pictures[sections.indexOf(m) % pictures.length];
    tryOp("setText", `images/${picture}`, "pages", "home", m.section, "image", "src");
    tryOp("setText", "A stand-in picture", "pages", "home", m.section, "image", "alt");
  }
}
// In the site's order: each section in turn moved to just above the footer.
for (const m of sections)
  if (m.added && m.kind !== "hero" && m.kind !== "footer")
    tryOp("moveSection", "home", m.section, "--before", "footer");
if (headerOver) {
  const hero = sections.find((m) => m.kind === "hero");
  if (
    !["cover", "photo"].includes(hero?.looks.layout) ||
    !tryOp("setSectionLook", "home", "header", "over", "hero")
  )
    header.gaps.push("header over the hero");
}
const extraFonts = read.fonts.filter((f, i, all) => all.indexOf(f) === i).slice(1);
writeFileSync(join(opts.out, "operations.log"), `${log.join("\n")}\n`);

// ---- Step 2: both pages through, each block beside its section at desk and phone width.
const stop = await serveDev(dir, Number(opts.port));
const ours = await context.newPage();
await ours.goto(`http://localhost:${opts.port}/`);
await ours.waitForLoadState("networkidle");
await scrollThrough(ours);
if (process.env.REBUILD_DEBUG)
  console.log(
    "our sections:",
    await ours.evaluate(() =>
      [...document.querySelectorAll("[data-section]")]
        .map((e) => `${e.tagName}:${e.getAttribute("data-section")}`)
        .join(" "),
    ),
  );

/** Shoots each block of a page at the current width; ours by section name. */
async function shots(page, selectors, viewport) {
  await page.setViewportSize(viewport);
  await scrollThrough(page);
  const result = [];
  for (const sel of selectors) {
    const box =
      sel &&
      (await page
        .locator(sel)
        .first()
        .boundingBox()
        .catch(() => null));
    if (!box || box.height < 8) {
      result.push(null);
      continue;
    }
    const y = box.y + (await page.evaluate(() => scrollY));
    const clip = { x: 0, y, width: viewport.width, height: Math.min(box.height, 2400) };
    const look = await page.evaluate(
      ({ sel }) => {
        const el = document.querySelector(sel);
        let bg = "rgb(255, 255, 255)";
        for (let e = el; e; e = e.parentElement) {
          const c = getComputedStyle(e).backgroundColor;
          if (c && c !== "transparent" && !/rgba\(.*, 0\)$/.test(c)) {
            bg = c;
            break;
          }
        }
        const pics = [...el.querySelectorAll("img,picture,video")].filter(
          (p) => p.getBoundingClientRect().width > 80,
        ).length;
        return { bg, pics };
      },
      { sel },
    );
    const png = await page.screenshot({ fullPage: true, clip });
    result.push({ png, height: box.height, ...look });
  }
  return result;
}
const sourceSel = sections.map((m) => `[data-rebuild="${m.block}"]`);
const ourSel = sections.map((m) =>
  m.kind === "footer"
    ? '[data-part="footer"]'
    : m.kind === "hero" || m.added
      ? `[data-section="${m.section}"]`
      : null,
);
const pairs = {
  desk: [await shots(source, sourceSel, DESK), await shots(ours, ourSel, DESK)],
  phone: [await shots(source, sourceSel, PHONE), await shots(ours, ourSel, PHONE)],
};

/** A rough likeness, 0–100: height, pictures and background colour at desk width. */
function score(a, b, m) {
  if (!a || !b) return 0;
  const height = Math.min(a.height, b.height) / Math.max(a.height, b.height);
  const pics = Math.min(a.pics, b.pics, 6) / Math.max(Math.min(Math.max(a.pics, b.pics), 6), 1);
  const colour = 1 - Math.min(1, distance(a.bg, b.bg) * 2);
  const missing = m.gaps.length ? 0.9 : 1;
  return Math.round(
    100 * missing * (0.35 * height + 0.25 * (a.pics || b.pics ? pics : 1) + 0.4 * colour),
  );
}
const sheet = await context.newPage();
await sheet.setViewportSize({ width: 1600, height: 900 });
const img = (shot) =>
  shot
    ? `<img src="data:image/png;base64,${shot.png.toString("base64")}">`
    : `<div class="none">not shown</div>`;
const rows = [];
for (const [i, m] of sections.entries()) {
  const [sd, od] = [pairs.desk[0][i], pairs.desk[1][i]];
  const [sp, ph] = [pairs.phone[0][i], pairs.phone[1][i]];
  const s = score(sd, od, m);
  const file = `${String(i + 1).padStart(2, "0")}-${m.section}.jpg`;
  rows.push({
    n: i + 1,
    section: m.section,
    kind: m.kind,
    looks: m.looks,
    gaps: m.gaps,
    score: s,
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
  <h1>${i + 1}. ${m.section} (${m.kind}) · score ${s}</h1>
  <p>${
    Object.entries(m.looks)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ") || "no look set"
  }${m.gaps.length ? ` · not mapped: ${m.gaps.join(", ")}` : ""}</p>
  <div class="row"><div><h2>Site, desk</h2>${img(sd)}</div><div><h2>Rebuilt, desk</h2>${img(od)}</div></div>
  <div class="phone"><div><h2>Site, phone</h2>${img(sp)}</div><div><h2>Rebuilt, phone</h2>${img(ph)}</div></div>`);
  await sheet.waitForLoadState("load");
  await sheet.screenshot({ path: join(opts.out, file), fullPage: true, type: "jpeg", quality: 82 });
}
stop();
await browser.close();

// ---- The report: per section its score and what could not be mapped; the page-wide gaps.
const pageGaps = [];
if (extraFonts.length) pageGaps.push(`${extraFonts.length} more font face(s) than the theme's one`);
if (header?.gaps.length) pageGaps.push(...header.gaps);
const report = {
  url: url.href,
  app: dir,
  width,
  contentWidth: read.contentWidth,
  fonts: read.fonts,
  blocks: read.blocks,
  sections: rows,
  pageGaps,
};
writeFileSync(join(opts.out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
const md = [
  "# Site rebuild: sections",
  "",
  `Width ${width} (content about ${Math.round(read.contentWidth)} px). Page-wide: ${pageGaps.join("; ") || "nothing unmapped"}.`,
  "",
  "| # | Section | Kind | Looks | Score | Not mapped |",
  "| - | - | - | - | - | - |",
  ...rows.map(
    (r) =>
      `| ${r.n} | ${r.section} | ${r.kind} | ${Object.entries(r.looks)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ")} | ${r.score} | ${r.gaps.join(", ")} |`,
  ),
  "",
];
writeFileSync(join(opts.out, "report.md"), md.join("\n"));
const captions = rows.map(
  (r) =>
    `${r.file}: ${r.n}. ${r.section} (${r.kind}), score ${r.score}${r.gaps.length ? `; not mapped: ${r.gaps.join(", ")}` : ""}`,
);
writeFileSync(join(opts.out, "captions.txt"), `${captions.join("\n")}\n`);
if (opts.copy) {
  mkdirSync(opts.copy, { recursive: true });
  for (const f of [...rows.map((r) => r.file), "captions.txt"])
    copyFileSync(join(opts.out, f), join(opts.copy, f));
}
console.log(md.join("\n"));
console.log(`Sheets and report in ${opts.out}; the app is in ${dir}.`);
