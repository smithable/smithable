// The starters' pictures for docs.smithable.ai (docs/site/starters.md): each starter made fresh,
// served, and photographed at desktop width in light mode, two pictures each, as WebP (encoded by
// the browser, so no image library is needed) in docs/site/starters/<starter>-<n>.webp, and a copy
// of the set in --copy for review.
// Run after `pnpm build`: `node scripts/starter-shots.mjs [starter…] [--copy <dir>]`. Not part of `check`.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
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
  // Where the truck is this week, under its evening photo, and the orders as staff see them.
  kiosk: [
    ["where", "list", "visitor", true],
    ["orders", "list", "admin"],
  ],
  // The free times a customer chooses from, and the shop's day with a column per barber (the
  // starter has no appointments: today's few are written first).
  barbers: [
    [
      "appointments",
      "new",
      "member",
      false,
      async (page) => {
        const service = page.getByLabel(/^Service/);
        if ((await service.evaluate((e) => e.tagName)) === "SELECT")
          await service.selectOption({ label: "Haircut" });
        else {
          await service.fill("Hairc");
          await page.getByRole("option", { name: "Haircut", exact: true }).click();
        }
        await page.locator('[data-kit="slots"] [data-part="time"]').first().waitFor();
      },
    ],
    [
      "day",
      "list",
      "admin",
      false,
      async (page, dir) => {
        const db = new (createRequire(join(dir, "package.json"))("better-sqlite3"))(
          join(dir, "data/db/app.db"),
        );
        const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Mariehamn" }).format(
          new Date(),
        );
        // The shop's clock: Mariehamn's offset from UTC today (summer time or not).
        const noon = new Date(`${today}T12:00:00Z`);
        const offset =
          Number(
            new Intl.DateTimeFormat("en-GB", {
              timeZone: "Europe/Mariehamn",
              hour: "2-digit",
              hourCycle: "h23",
            }).format(noon),
          ) - 12;
        const at = (clock) => Date.parse(`${today}T${clock}:00Z`) - offset * 3_600_000;
        const add = db.prepare(
          "insert into appointments (service_id, barber_id, starts_at, name, status, created_at, updated_at) values (?, ?, ?, ?, ?, 0, 0)",
        );
        for (const [service, barber, clock, name, status] of [
          [1, 1, "09:00", "Mikael Lind", "confirmed"],
          [3, 1, "10:00", "Anders Holm", "confirmed"],
          [2, 1, "13:30", "Jonas Eklund", "requested"],
          [4, 2, "09:30", "Ella Nyström", "confirmed"],
          [1, 2, "11:00", "Karin Berg", "requested"],
          [3, 2, "14:00", "Leo Sundqvist", "confirmed"],
        ])
          add.run(service, barber, at(clock), name, status);
        db.close();
        await open(page, `${base}/day?day=${today}`);
      },
    ],
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
        if (before) await before(page, dir);
        // A whole page reads as it scrolls: the form's Save row in its place, not stuck mid-form.
        if (fullPage)
          await page.addStyleTag({
            content:
              '[data-kit="model-form"] [data-part="actions"] { position: static !important }',
          });
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
