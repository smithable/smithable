// A short recording for the site: in Studio, a change adds a field, a record is added in the
// preview, and one Undo takes the app and its data back to how they were. Scripted, so it can be
// made again after a change to Studio's look: a new booking app (sample data only), Studio on a
// fixed port, a fixed viewport, Playwright's own video. Writes the video (WebM) and a JSON of when
// each moment starts, for the editing tool, to --out.
// Run after `pnpm build`: `node scripts/record-undo.mjs [--out <dir>] [--port 8412]`. Not part of `check`.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { cli, newApp } from "./dev-app.mjs";

const { values: opts } = parseArgs({
  options: {
    out: { type: "string", default: join(process.cwd(), "recordings/undo") },
    port: { type: "string", default: process.env.RECORD_PORT ?? "8412" },
  },
});
const port = Number(opts.port);
const base = `http://localhost:${port}`;
const size = { width: 1920, height: 1080 };
mkdirSync(opts.out, { recursive: true });

const dir = newApp("booking", "record-undo");
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

// How many instructors the preview's database holds, read beside the running app.
const instructors = () => {
  const db = new DatabaseSync(join(dir, "data/db/app.db"), { readOnly: true });
  try {
    return String(db.prepare("select count(*) as n from instructors").get().n);
  } finally {
    db.close();
  }
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: size,
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
const moment = (name) => moments.push({ at: (Date.now() - started) / 1000, name });
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

  // 1. The app as it is: three instructors.
  moment("the app as it is");
  await go("/sign-in");
  await preview.getByRole("button", { name: "Sign in as admin" }).click();
  await go("/instructors");
  await preview.getByRole("heading", { name: "Instructors" }).waitFor({ timeout: 60000 });
  await shot("before");
  await hold(3000);

  // 2. A change: instructors get a phone number, in No code.
  moment("a change adds a field");
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
  const field = instructor.getByLabel("New entry in fields");
  await field.pressSequentially("phone", { delay: 120 });
  await hold(500);
  await field.locator("..").getByRole("button", { name: "Add" }).click();
  await status
    .getByText(/added a phone/)
    .first()
    .waitFor({ timeout: 90000 });
  await shot("field-added");
  await hold(2000);

  // 3. A record that uses it, added in the preview.
  moment("a record added in the preview");
  await go("/instructors/new");
  await preview.getByLabel("Phone").waitFor({ timeout: 90000 });
  await preview
    .getByRole("textbox", { name: /^Name/ })
    .pressSequentially("Sample Teacher", { delay: 80 });
  await preview.getByLabel("Phone").pressSequentially("+358 18 000 000", { delay: 80 });
  await hold(800);
  await preview
    .getByRole("button", { name: /^(Save|Create|Add)/ })
    .first()
    .click();
  await preview.getByText("Sample Teacher").first().waitFor({ timeout: 60000 });
  if (instructors() !== "4") throw new Error(`instructors after adding: ${instructors()}`);
  await go("/instructors");
  await preview.getByText("Sample Teacher").first().waitFor({ timeout: 60000 });
  await shot("record-added");
  await hold(3000);

  // 4. Undo: the field and the record are gone, the three instructors are as they were.
  moment("one Undo");
  await page.locator("header").getByRole("button", { name: "Undo", exact: true }).click();
  await status
    .getByText(/^Undid/)
    .first()
    .waitFor({ timeout: 90000 });
  await go("/instructors");
  await preview.getByRole("heading", { name: "Instructors" }).waitFor({ timeout: 60000 });
  await preview.getByText("Sample Teacher").waitFor({ state: "detached", timeout: 60000 });
  moment("back as before");
  await shot("after-undo");
  await hold(3000);
  if (instructors() !== "3") throw new Error(`instructors after undo: ${instructors()}`);
  if (/phone:/.test(readFileSync(join(dir, "smithable.yml"), "utf8")))
    throw new Error("the field is still in smithable.yml");
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
