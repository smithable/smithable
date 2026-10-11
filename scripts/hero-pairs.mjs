// The landing page's spec-to-app hero (smithable.ai): for each starter a few real lines of its
// smithable.yml ("Code") or of its plain-language summary ("No code"), and the app they make,
// photographed at the hero's size at 2×. Writes docs/site/brand/hero/pairs.json (starter, tag,
// lines, caption, picture) and docs/site/brand/hero/<starter>.webp, with a copy in --copy.
// Run after `pnpm build`: `node scripts/hero-pairs.mjs [starter…] [--copy <dir>]`. Not part of `check`.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { validateAuth, validateContent, validateSpec } from "../packages/core/dist/index.js";
import { summarize } from "../packages/index/dist/index.js";
import { newApp, open, repo, serveDev, signIn } from "./dev-app.mjs";

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    copy: { type: "string", default: "/mnt/c/Users/johan/Pictures/claude/hero" },
    port: { type: "string", default: process.env.STARTER_SHOTS_PORT ?? "8403" },
  },
});

// The pairs in the loop's order, "Code" and "No code" in turn. A "Code" pair names the model and
// the fields to show, then the page and its keys, each line as the starter has it (comments
// dropped); a "No code" pair names the summary's sections and the sentences it leaves out. The
// picture: [page id, "list" or a path under the page, who looks].
const PAIRS = [
  {
    starter: "booking",
    code: { model: "Session", fields: ["classType", "instructor", "startsAt", "capacity"] },
    page: { id: "schedule", keys: ["calendar"] },
    shot: ["schedule", "list", "visitor"],
    caption: "Stillwater Yoga: the week's classes",
  },
  {
    starter: "invoicing",
    words: [["model:Invoice", /^Rule: Invoice numbers/]],
    shot: ["invoices", "list", "admin"],
    caption: "Invoicely: a freelancer's invoices",
  },
  {
    starter: "status",
    code: { model: "Component", fields: ["name", "status", "description"] },
    page: { id: "home", keys: ["landing", "services"] },
    shot: ["home", "list", "visitor"],
    caption: "Northwind Status: is it working?",
  },
  {
    starter: "crm",
    words: [["model:Customer", /owns the customer|trash/]],
    shot: ["customers", "list", "admin"],
    caption: "Acme CRM: customers and their orders",
  },
  {
    starter: "marketplace",
    code: { model: "Item", fields: ["title", "photos", "price", "category"] },
    page: { id: "catalog", keys: ["crud"] },
    shot: ["catalog", "list", "visitor"],
    caption: "Torget: second-hand things nearby",
  },
  {
    starter: "api",
    words: [["model:Task"], ["auth", /^(?!- assistant)/]],
    shot: ["admin", "tasks", "admin"],
    caption: "Team Tasks: what an assistant keeps for a team",
  },
  {
    starter: "records",
    code: { model: "Item", fields: ["name", "kind", "addedOn"] },
    page: { id: "items", keys: ["crud", "search"] },
    shot: ["items", "list", "visitor"],
    caption: "Our Collection: a collection, shown",
  },
];
const MAX_LINES = 10;

/** A key's block at an indent: its own line, then its deeper lines. */
function block(lines, indent, key) {
  const start = lines.findIndex((l) => l.startsWith(`${" ".repeat(indent)}${key}:`));
  if (start < 0) throw new Error(`no ${key} at indent ${indent}`);
  let end = start + 1;
  while (end < lines.length && (lines[end].trim() === "" || lines[end].search(/\S/) > indent))
    end++;
  return lines.slice(start, end).filter((l) => l.trim() !== "");
}

function codeLines(text, { code, page }) {
  const lines = text.split("\n").map((l) => l.replace(/\s+#\s.*$/, "").trimEnd());
  const model = block(block(lines, 0, "models"), 2, code.model);
  const fields = block(model, 4, "fields");
  const pageLines = block(block(lines, 0, "pages"), 2, page.id);
  // A key one level down (landing: services:) follows its parent's line.
  const keyLines = page.keys.map((k) =>
    pageLines.some((l) => l.startsWith(`    ${k}:`))
      ? block(pageLines, 4, k)[0]
      : block(pageLines, 6, k)[0],
  );
  return [
    "models:",
    model[0],
    fields[0],
    ...code.fields.map((f) => block(fields, 6, f)[0]),
    "pages:",
    pageLines[0],
    ...keyLines,
  ];
}

function wordLines(dir, words) {
  const read = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : "");
  const { ir } = validateSpec({ path: "smithable.yml", text: read("smithable.yml") });
  const auth = validateAuth({ path: "smithable.auth.yml", text: read("smithable.auth.yml") }).auth;
  const text = read("smithable.content.yml");
  const content = text
    ? validateContent({ path: "smithable.content.yml", text }, ir).content
    : undefined;
  const sections = summarize(ir, auth, content);
  return words.flatMap(([concept, leaveOut]) => {
    const section = sections.find((s) => s.concept === concept);
    if (!section) throw new Error(`no summary section ${concept}`);
    return section.sentences.filter((s) => !leaveOut?.test(s));
  });
}

/** The browser's own WebP encoder (as in starter-shots.mjs). */
async function webp(browser, png) {
  const page = await browser.newPage();
  const data = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = Object.assign(document.createElement("canvas"), {
      width: img.width,
      height: img.height,
    });
    canvas.getContext("2d").drawImage(img, 0, 0);
    return canvas.toDataURL("image/webp", 0.8).split(",")[1];
  }, png.toString("base64"));
  await page.close();
  return Buffer.from(data, "base64");
}

const chosen = positionals.length ? PAIRS.filter((p) => positionals.includes(p.starter)) : PAIRS;
const port = Number(opts.port);
const base = `http://localhost:${port}`;
const out = join(repo, "docs/site/brand/hero");
mkdirSync(out, { recursive: true });
mkdirSync(opts.copy, { recursive: true });
const jsonFile = join(out, "pairs.json");
const written = existsSync(jsonFile) ? JSON.parse(readFileSync(jsonFile, "utf8")) : [];

const browser = await chromium.launch();
try {
  for (const pair of chosen) {
    const dir = newApp(pair.starter, `hero-${pair.starter}`);
    const text = readFileSync(join(dir, "smithable.yml"), "utf8");
    const lines = pair.code ? codeLines(text, pair) : wordLines(dir, pair.words);
    if (lines.length > MAX_LINES)
      throw new Error(`${pair.starter}: ${lines.length} lines, at most ${MAX_LINES}`);
    const { ir } = validateSpec({ path: "smithable.yml", text });
    const [pageId, which, who] = pair.shot;
    const spec = ir.pages.find((p) => p.id === pageId);
    if (!spec) throw new Error(`${pair.starter} has no page ${pageId}`);
    const path = which === "list" ? spec.route : `${spec.route.replace(/\/$/, "")}/${which}`;
    const stop = await serveDev(dir, port);
    try {
      // The hero shows the picture about 800 pixels wide: a desktop's page in 1600 by 1040 pixels.
      const context = await browser.newContext({
        viewport: { width: 1280, height: 832 },
        deviceScaleFactor: 1.25,
        colorScheme: "light",
      });
      const page = await context.newPage();
      if (who !== "visitor") await signIn(page, base, who);
      await open(page, `${base}${path}`);
      await page.waitForTimeout(500); // pictures and fonts settle
      const file = join(out, `${pair.starter}.webp`);
      writeFileSync(file, await webp(browser, await page.screenshot({ animations: "disabled" })));
      copyFileSync(file, join(opts.copy, `${pair.starter}.webp`));
      console.log(`${file}  (${path} as ${who}, ${lines.length} lines)`);
      await context.close();
    } finally {
      stop();
    }
    const entry = {
      starter: pair.starter,
      tag: pair.code ? "Code" : "No code",
      lines,
      caption: pair.caption,
      picture: `${pair.starter}.webp`,
    };
    const at = written.findIndex((w) => w.starter === pair.starter);
    if (at >= 0) written[at] = entry;
    else written.push(entry);
  }
} finally {
  await browser.close();
}
const order = (w) => PAIRS.findIndex((p) => p.starter === w.starter);
written.sort((a, b) => order(a) - order(b));
writeFileSync(jsonFile, `${JSON.stringify(written, null, 2)}\n`);
copyFileSync(jsonFile, join(opts.copy, "pairs.json"));
