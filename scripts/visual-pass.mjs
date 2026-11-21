// A visual pass over the starters (T975): each made fresh with its pictures, served, and every
// page a visitor and a signed-in person meet opened wide and on a phone, light and dark, in the
// starter's own theme and one of the picked set. Every view is checked for what is plainly broken
// (the page scrolling sideways, a control off screen, text cut off in its box, a stretched
// picture, text too faint to read); a few views are photographed for a person to look at.
// Run after `pnpm build`: `node scripts/visual-pass.mjs [starter…] [--out dir] [--theme name]`.
// Heavy (a dev server and a browser per starter): one at a time on the machine. Not part of `check`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { validateSpec } from "../packages/core/dist/index.js";
import { newApp, op, open, serveDev, signIn } from "./dev-app.mjs";

const STARTERS = [
  "crm",
  "booking",
  "invoicing",
  "marketplace",
  "records",
  "status",
  "support",
  "kiosk",
  "barbers",
  "builder",
  "api",
];
const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string" },
    theme: { type: "string", default: "halftone" },
    port: { type: "string", default: process.env.VISUAL_PASS_PORT ?? "8410" },
  },
});
if (!opts.out) throw new Error("--out <dir> is required");
const starters = positionals.length ? positionals : STARTERS;
const port = Number(opts.port);
const base = `http://localhost:${port}`;
const VIEWPORTS = { wide: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };

/** Runs in the page: what looks broken, each with a short description of the element. */
function checks() {
  const found = [];
  const label = (el) => {
    const text = (el.getAttribute("aria-label") || el.textContent || "")
      .trim()
      .replace(/\s+/g, " ");
    const kit = el.closest("[data-kit]")?.getAttribute("data-kit");
    return `${el.tagName.toLowerCase()}${kit ? ` in ${kit}` : ""} "${text.slice(0, 50)}"`;
  };
  // Seen by a person: laid out, not in a closed details (its box is still measured), not
  // hidden from everyone (a spam trap), not text for screen readers only.
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (r.width <= 2 || r.height <= 2 || s.visibility === "hidden" || s.display === "none")
      return false;
    const closed = el.closest("details:not([open])");
    if (closed && !el.closest("summary")) return false;
    if (el.closest("[aria-hidden=true], [inert]")) return false;
    return !/rect\(0/.test(s.clip) && s.clipPath !== "inset(50%)";
  };
  // Inside something that scrolls sideways on purpose (a wide table), sideways is fine.
  const inScroller = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return true;
    }
    return false;
  };
  const width = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > width + 1)
    found.push({
      kind: "page-overflow",
      detail: `the page is ${document.documentElement.scrollWidth}px wide in ${width}px`,
    });
  for (const el of document.querySelectorAll("a, button, input, select, textarea, [role=button]")) {
    if (!visible(el) || inScroller(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > width + 1 || r.left < -1)
      found.push({ kind: "control-off-screen", detail: label(el) });
  }
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el) || !el.childNodes.length) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const s = getComputedStyle(el);
    if (
      s.overflowX === "hidden" &&
      s.textOverflow !== "ellipsis" &&
      el.scrollWidth > el.clientWidth + 2 &&
      !inScroller(el)
    )
      found.push({ kind: "text-clipped", detail: label(el) });
  }
  for (const img of document.querySelectorAll("img")) {
    if (!visible(img) || !img.naturalWidth) continue;
    const r = img.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) continue;
    const fit = getComputedStyle(img).objectFit;
    if (fit !== "fill" && fit !== "") continue;
    const natural = img.naturalWidth / img.naturalHeight;
    const shown = r.width / r.height;
    if (Math.abs(natural - shown) / natural > 0.06)
      found.push({
        kind: "picture-stretched",
        detail: `${label(img)} ${img.naturalWidth}x${img.naturalHeight} shown ${Math.round(r.width)}x${Math.round(r.height)}`,
      });
  }
  // Contrast: text against the first solid background behind it (pictures behind are skipped).
  // Any CSS colour (oklch included) as the sRGB pixel a canvas paints, with its alpha.
  const paint = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const rgb = (c) => {
    paint.clearRect(0, 0, 1, 1);
    paint.fillStyle = "#000";
    paint.fillStyle = c;
    paint.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const behind = (el) => {
    for (let p = el; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.backgroundImage !== "none") return undefined;
      const c = rgb(s.backgroundColor);
      if (c.length >= 3 && (c.length < 4 || c[3] > 0.95)) return c;
    }
    return [255, 255, 255];
  };
  let faint = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (faint >= 8) break;
    if (!visible(el)) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) continue;
    const s = getComputedStyle(el);
    if (Number(s.opacity) < 1 || el.closest("[disabled], [aria-disabled=true]")) continue;
    const fg = rgb(s.color);
    if (fg.length >= 4 && fg[3] < 0.95) continue;
    const bg = behind(el);
    if (!bg) continue;
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    const ratio = (a + 0.05) / (b + 0.05);
    const size = Number.parseFloat(s.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) {
      faint++;
      found.push({ kind: "faint-text", detail: `${label(el)} ${ratio.toFixed(2)}:1` });
    }
  }
  return found;
}

/** The views a starter's pages give: each page's own address, and a list's first record and its form. */
function views(ir) {
  const out = [{ name: "sign-in", path: "/sign-in", who: ["visitor"] }];
  for (const page of ir.pages) {
    if (page.route.includes("$") || page.route.includes(":")) continue;
    out.push({ name: page.id, path: page.route, who: ["visitor", "signed-in"] });
    if (page.pattern.kind === "crud") {
      const root = page.route.replace(/\/$/, "");
      out.push({ name: `${page.id}-record`, path: `${root}/1`, who: ["signed-in"] });
      out.push({ name: `${page.id}-new`, path: `${root}/new`, who: ["signed-in"] });
    }
  }
  return out;
}

mkdirSync(opts.out, { recursive: true });
const findings = [];
const browser = await chromium.launch();
try {
  for (const starter of starters) {
    const dir = newApp(starter, `visual-${starter}`);
    const { ir } = validateSpec({
      path: "smithable.yml",
      text: readFileSync(join(dir, "smithable.yml"), "utf8"),
    });
    let roles;
    console.log(`${starter}: ${dir}`);
    for (const theme of ["own", opts.theme]) {
      if (theme !== "own") op(dir, "setTheme", "--preset", theme);
      const stop = await serveDev(dir, port);
      try {
        // Who signs in: the development sign-in's administrator, else its first role.
        if (!roles) {
          const probe = await browser.newPage();
          await open(probe, `${base}/sign-in`);
          const names = (
            await probe.getByRole("button", { name: /^Sign in as / }).allTextContents()
          ).map((t) => t.replace(/^Sign in as /, "").trim());
          await probe.close();
          roles = names.includes("admin") ? ["admin"] : names.slice(0, 1);
        }
        for (const who of ["visitor", ...roles]) {
          for (const [vp, size] of Object.entries(VIEWPORTS)) {
            for (const mode of ["light", "dark"]) {
              const context = await browser.newContext({ viewport: size, colorScheme: mode });
              const page = await context.newPage();
              try {
                if (who !== "visitor") await signIn(page, base, who);
                for (const view of views(ir)) {
                  if (!view.who.includes(who === "visitor" ? "visitor" : "signed-in")) continue;
                  try {
                    await open(page, `${base}${view.path}`);
                  } catch (error) {
                    findings.push({
                      starter,
                      view: view.name,
                      who,
                      vp,
                      mode,
                      theme,
                      kind: "page-error",
                      detail: String(error).slice(0, 120),
                    });
                    continue;
                  }
                  await page.waitForTimeout(300);
                  // A page that needs signing in sends a visitor away: not a view of its own.
                  if (
                    who === "visitor" &&
                    view.path !== "/sign-in" &&
                    new URL(page.url()).pathname === "/sign-in"
                  )
                    continue;
                  for (const f of await page.evaluate(checks))
                    findings.push({ starter, view: view.name, who, vp, mode, theme, ...f });
                  const shoot =
                    (vp === "wide" && mode === "light" && theme === "own") ||
                    (vp === "phone" && mode === "dark" && theme !== "own");
                  if (shoot)
                    await page.screenshot({
                      path: join(
                        opts.out,
                        `${starter}-${view.name}-${who}-${vp}-${mode}-${theme}.png`,
                      ),
                      fullPage: true,
                      animations: "disabled",
                    });
                }
                // The menu on a phone.
                if (vp === "phone") {
                  await open(page, `${base}/`);
                  const menu = page.getByRole("button", { name: /menu/i }).first();
                  if (await menu.count()) {
                    await menu.click().catch(() => {});
                    await page.waitForTimeout(300);
                    for (const f of await page.evaluate(checks))
                      findings.push({ starter, view: "menu", who, vp, mode, theme, ...f });
                    if (mode === "dark" && theme !== "own")
                      await page.screenshot({
                        path: join(opts.out, `${starter}-menu-${who}-${vp}-${mode}-${theme}.png`),
                      });
                  }
                }
              } finally {
                await context.close();
              }
            }
          }
        }
      } finally {
        stop();
      }
    }
    writeFileSync(join(opts.out, "findings.json"), JSON.stringify(findings, null, 1));
  }
} finally {
  await browser.close();
  writeFileSync(join(opts.out, "findings.json"), JSON.stringify(findings, null, 1));
}
const counts = {};
for (const f of findings) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
console.log(JSON.stringify(counts));
