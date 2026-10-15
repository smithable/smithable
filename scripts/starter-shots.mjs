// The starters' pictures for docs.smithable.ai (docs/site/starters.md): each starter made fresh,
// served, and photographed at desktop width in light mode, two pictures each, as WebP (encoded by
// the browser, so no image library is needed) in docs/site/starters/<starter>-<n>.webp, and a copy
// of the set in --copy for review.
// Run after `pnpm build`: `node scripts/starter-shots.mjs [starter…] [--copy <dir>]`. Not part of `check`.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { validateSpec } from "../packages/core/dist/index.js";
import { newApp, open, repo, serveDev, signIn } from "./dev-app.mjs";

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    copy: { type: "string", default: "/mnt/c/Users/johan/Pictures/claude/starters" },
    port: { type: "string", default: process.env.STARTER_SHOTS_PORT ?? "8403" },
  },
});

// Per starter, its two pictures: [page id, "list", "new" or a record's number, who looks, the whole
// page, what to do on the page before the picture].
// A visitor sees what the public sees; a role signs in through the development sign-in.
const SHOTS = {
  crm: [
    ["customers", "list", "admin"],
    ["customers", 1, "admin"],
  ],
  booking: [
    ["home", "list", "visitor"],
    ["schedule", "list", "visitor", true],
  ],
  invoicing: [
    ["home", "list", "visitor"],
    ["invoices", 1, "admin"],
  ],
  marketplace: [
    ["catalog", "list", "visitor"],
    ["catalog", 1, "visitor"],
  ],
  records: [
    ["home", "list", "visitor"],
    ["items", 1, "admin"],
  ],
  status: [
    ["home", "list", "visitor"],
    ["incidents", 1, "admin"],
  ],
  // The cases with their unread counts, and a case's conversation with the reply box.
  support: [
    ["cases", "list", "admin"],
    ["cases", 2, "admin", true],
  ],
  // The menu a visitor orders from, and the orders as staff see them.
  kiosk: [
    ["menu", "list", "visitor", true],
    ["orders", "list", "admin"],
  ],
  api: [
    ["admin", "tasks", "admin"],
    // A key just made: the card with the call to copy and an assistant's lines.
    [
      "team",
      "list",
      "admin",
      true,
      async (page) => {
        const keys = page.locator('[data-kit="keys"]');
        await keys.getByLabel("What it is for").fill("Assistant");
        await keys.getByRole("button", { name: "Make a key" }).click();
        await keys.locator('[data-part="key"]').waitFor({ timeout: 10000 });
      },
    ],
  ],
};
const starters = positionals.length ? positionals : Object.keys(SHOTS);
const port = Number(opts.port);
const base = `http://localhost:${port}`;
const out = join(repo, "docs/site/starters");
mkdirSync(out, { recursive: true });
mkdirSync(opts.copy, { recursive: true });

/** The browser's own WebP encoder, at a quality that keeps a desktop screenshot near 100 KB. */
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

const browser = await chromium.launch();
try {
  for (const starter of starters) {
    if (!SHOTS[starter]) throw new Error(`no shots for ${starter}; add them to SHOTS`);
    const dir = newApp(starter, `shots-${starter}`);
    const { ir } = validateSpec({
      path: "smithable.yml",
      text: readFileSync(join(dir, "smithable.yml"), "utf8"),
    });
    const stop = await serveDev(dir, port);
    try {
      for (const [n, [pageId, which, who, fullPage = false, before]] of SHOTS[starter].entries()) {
        const spec = ir.pages.find((p) => p.id === pageId);
        if (!spec) throw new Error(`${starter} has no page ${pageId}`);
        const path = which === "list" ? spec.route : `${spec.route.replace(/\/$/, "")}/${which}`;
        const context = await browser.newContext({
          viewport: { width: 1280, height: 800 },
          colorScheme: "light",
        });
        const page = await context.newPage();
        if (who !== "visitor") await signIn(page, base, who);
        await open(page, `${base}${path}`);
        if (before) await before(page);
        await page.waitForTimeout(500); // pictures and fonts settle
        const file = join(out, `${starter}-${n + 1}.webp`);
        writeFileSync(
          file,
          await webp(browser, await page.screenshot({ fullPage, animations: "disabled" })),
        );
        copyFileSync(file, join(opts.copy, `${starter}-${n + 1}.webp`));
        console.log(`${file}  (${path} as ${who})`);
        await context.close();
      }
    } finally {
      stop();
    }
  }
} finally {
  await browser.close();
}
