// A short recording for the site: in Studio, instructors with phone numbers on screen; a change
// removes the phone field (Studio warns that three values go with it), the numbers are gone; one
// Undo, and the same numbers are back. Scripted, so it can be
// made again after a change to Studio's look: a new booking app (sample data only), Studio on a
// fixed port, a fixed viewport, Playwright's own video. Writes the video (WebM) and a JSON of when
// each moment starts with its caption, for the editing tool, to --out. The checks read the
// database and the spec at each step, so a take where undo did not work stops.
// Run after `pnpm build`: `node scripts/record-undo.mjs [--out <dir>] [--port 8412]`. Not part of `check`.
import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { cli, newApp, op } from "./dev-app.mjs";

const { values: opts } = parseArgs({
  options: {
    out: { type: "string", default: join(process.cwd(), "recordings/undo") },
    port: { type: "string", default: process.env.RECORD_PORT ?? "8412" },
  },
});
const port = Number(opts.port);
const base = `http://localhost:${port}`;
const size = { width: 1280, height: 720 }; // drawn at twice that, so text reads in a small player
mkdirSync(opts.out, { recursive: true });

const dir = newApp("booking", "record-undo");
// Before the take, as the owner's set-up (undo passes over it): instructors have a phone number,
// shown in their list as a table with each one's picture.
op(dir, "addField", "Instructor", "phone", "phone", "--setup");
op(dir, "setView", "instructors", "table", "--setup");
op(dir, "setColumns", "instructors", "name", "phone", "--setup");
op(dir, "setTableMark", "instructors", "picture", "--setup");
const database = (write) => new DatabaseSync(join(dir, "data/db/app.db"), { readOnly: !write });
const phones = {
  "Emma Lindqvist": "+358 18 520 11",
  "Oskar Berg": "+358 18 520 22",
  "Aino Virtanen": "+358 18 520 33",
};
// The starter gives only Emma a picture; the other two get the blog's sample pictures.
const portraits = {
  "Oskar Berg": "A runner on a path by the sea at sunset",
  "Aino Virtanen": "A rolled-up yoga mat and a water bottle on a wooden floor by a window",
};
{
  const db = database(true);
  try {
    for (const [name, phone] of Object.entries(phones))
      db.prepare("update instructors set phone = ? where name = ?").run(phone, name);
    for (const [name, alt] of Object.entries(portraits)) {
      const cover = db.prepare("select cover from posts where cover like ?").get(`%${alt}%`)?.cover;
      if (!cover) throw new Error(`no sample picture "${alt}"`);
      const picture = JSON.parse(cover);
      const file = picture.file.replace(/^post\//, "instructor/");
      copyFileSync(join(dir, "data/uploads", picture.file), join(dir, "data/uploads", file));
      db.prepare("update instructors set portrait = ? where name = ?").run(
        JSON.stringify({ ...picture, file }),
        name,
      );
    }
  } finally {
    db.close();
  }
}
const studio = spawn("node", [cli, "studio", dir, "--port", String(port)], { detached: true });
const stop = () => {
  try {
    process.kill(-studio.pid);
  } catch {}
};
process.on("exit", stop);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(130));

async function up(url) {
  for (let i = 0; i < 240; i++) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} did not answer`);
}
await up(`${base}/api/project`);
await up(`http://localhost:${port + 1}/health`);

// Each instructor's phone number as the preview's database holds it, read beside the running app
// (none when the column is gone).
const numbers = () => {
  const db = database(false);
  try {
    const rows = db.prepare("select * from instructors").all();
    return JSON.stringify(Object.fromEntries(rows.map((r) => [r.name, r.phone ?? null])));
  } finally {
    db.close();
  }
};
const expect = (what, got, want) => {
  if (got !== want) throw new Error(`${what}: ${got}, expected ${want}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: size,
  deviceScaleFactor: 2,
  // The video at the viewport size: at twice it, Playwright put most frames at the viewport size in
  // the top-left corner of a grey canvas and only some at full size (2026-11-13).
  recordVideo: { dir: opts.out, size },
  colorScheme: "light",
  timezoneId: "Europe/Mariehamn",
});
// The preview with No code beside it (Studio's three windows, Smith's own floating and closed).
await context.addInitScript(() => {
  try {
    localStorage.setItem(
      "smithable:windows",
      JSON.stringify({ layout: "three", slots: ["smith", "preview", "manual"], manual: "nocode" }),
    );
  } catch {}
});
const page = await context.newPage();
const started = Date.now();
const moments = [];
const moment = (name, caption) =>
  moments.push({ at: (Date.now() - started) / 1000, name, caption });
const hold = (ms) => page.waitForTimeout(ms);
// A still of each moment beside the video, for a look without playing it.
let shots = 0;
const shot = (name) =>
  page.screenshot({ path: join(opts.out, `${String(++shots).padStart(2, "0")}-${name}.png`) });
const preview = page.frameLocator('iframe[title="App preview"]');
const status = page.getByRole("status");

const go = async (path) => {
  await page
    .locator('section[aria-busy="true"]', { has: page.getByRole("heading", { name: "Preview" }) })
    .waitFor({ state: "detached", timeout: 60000 });
  await page.getByLabel("Preview address").fill(path);
  await page.getByRole("button", { name: "Go", exact: true }).click();
};

try {
  await page.goto(`${base}/?guide=off`);
  await preview.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);
  const close = page.getByRole("button", { name: "Close Smith" });
  if (await close.isVisible().catch(() => false)) await close.click();
  const dismiss = page.getByRole("button", { name: "Dismiss" }).first();
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  // The app's own question about the time zone, answered once.
  const keep = preview.getByRole("button", { name: /^Keep / });
  if (await keep.isVisible().catch(() => false)) await keep.click();

  // 1. The app as it is: three instructors, each with a phone number on screen.
  const before = JSON.stringify(phones);
  expect("numbers before", numbers(), before);
  await go("/sign-in");
  await preview.getByRole("button", { name: "Sign in as admin" }).click();
  await go("/instructors");
  for (const phone of Object.values(phones))
    await preview.getByRole("cell", { name: phone }).waitFor({ timeout: 60000 });
  moment("the app as it is", "Three instructors, each with a phone number");
  await shot("before");
  await hold(3000);

  // 2. A change removes the phone field, in No code; Studio says what goes with it.
  const area = page
    .getByRole("region", { name: "What the app does" })
    .locator('details[data-key="models"]')
    .first();
  if (!(await area.evaluate((d) => d.open))) await area.locator("summary").first().click();
  const instructor = area
    .locator("details", { has: page.locator('summary:text-is("Instructor")') })
    .first();
  if (!(await instructor.evaluate((d) => d.open)))
    await instructor.locator('summary:text-is("Instructor")').first().click();
  const field = instructor
    .locator("details", { has: page.locator('summary:text-is("phone")') })
    .first();
  await field.locator("summary").first().click();
  await hold(800);
  moment("a change removes the field", "A change removes the phone field");
  await field.getByRole("button", { name: "Remove phone" }).click();
  const apply = page.getByRole("button", { name: "Apply anyway" });
  await apply.waitFor({ timeout: 30000 });
  moment("the warning", "Studio says three numbers go with it");
  await shot("warning");
  await hold(3000);
  await apply.click();
  await status
    .getByText(/[Rr]emove/)
    .first()
    .waitFor({ timeout: 90000 });
  await go("/instructors");
  // The table again, without its phone column.
  await preview.locator("td", { hasText: "Emma Lindqvist" }).waitFor({ timeout: 60000 });
  await preview
    .locator('td[data-field="phone"]')
    .first()
    .waitFor({ state: "detached", timeout: 60000 });
  expect(
    "numbers after the change",
    numbers(),
    JSON.stringify({ "Emma Lindqvist": null, "Oskar Berg": null, "Aino Virtanen": null }),
  );
  moment("the numbers are gone", "The field and its numbers are gone");
  await shot("field-removed");
  await hold(3000);

  // 3. One Undo: the field and the same numbers are back.
  moment("one Undo", "One Undo");
  await page.locator("header").getByRole("button", { name: "Undo", exact: true }).click();
  await status
    .getByText(/^Undid/)
    .first()
    .waitFor({ timeout: 90000 });
  await go("/instructors");
  for (const phone of Object.values(phones))
    await preview.getByRole("cell", { name: phone }).waitFor({ timeout: 60000 });
  expect("numbers after undo", numbers(), before);
  if (!/phone: phone/.test(readFileSync(join(dir, "smithable.yml"), "utf8")))
    throw new Error("the field is not back in smithable.yml");
  moment("back as before", "The same numbers are back");
  await shot("after-undo");
  await hold(3500);
  moment("end");
} catch (error) {
  await page.screenshot({ path: join(opts.out, "failed.png") }).catch(() => {});
  throw error;
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  stop();
  if (video) renameSync(await video.path(), join(opts.out, "undo.webm"));
  writeFileSync(join(opts.out, "undo.json"), `${JSON.stringify({ size, moments }, null, 2)}\n`);
}
console.log(`Recorded ${join(opts.out, "undo.webm")} (${moments.at(-1)?.at ?? 0} s)`);
