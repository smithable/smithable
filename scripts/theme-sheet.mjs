// The theme sheet: every theme on the same pages of a real app, so themes are judged side by
// side (by a person or a vision model) on what the kit draws, not on a thumbnail. Makes a booking
// app once, adds the field types the starter lacks so the form shows every control, then for each
// theme applies it through the operation layer and screenshots the landing page, a list, a form
// and a dialog in light and dark, laid out on one page per theme.
// Run after `pnpm build`: `node scripts/theme-sheet.mjs [preset | themes/<name>.yml …] [--out <dir>]`.
// Without themes it shoots the four presets. Not part of `check`.
import { mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { newApp, op, open as openUrl, serveDev, signIn } from "./dev-app.mjs";

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", default: "/mnt/c/Users/johan/Pictures/claude/themes" },
    port: { type: "string", default: process.env.THEME_SHEET_PORT ?? "8402" },
  },
});
const themes = positionals.length ? positionals : ["modern", "minimal", "playful", "corporate"];
const port = Number(opts.port);
const base = `http://localhost:${port}`;

const dir = newApp("booking", "theme-sheet");
console.log(`made the sheet app in ${dir}`);
// The controls the booking starter has no field for.
op(dir, "addField", "ClassType", "price", "money");
op(dir, "addField", "ClassType", "dropIn", "bool");
op(dir, "addField", "ClassType", "website", "url");
op(dir, "addField", "ClassType", "contact", "email");

/**
 * The dev server is started anew for each theme: a running server keeps serving the stylesheet
 * and font it loaded first.
 */
const serve = () => serveDev(dir, port);
const open = (page, path) => openUrl(page, `${base}${path}`);

// The shots on a sheet: [label, path, what to do before the picture, full page]. A dialog shot
// waits for its dialog; a hover shot shows the element in its own hue, a step lighter or darker.
const SHOTS = [
  ["Landing page", "/", null, true],
  // The sessions: a table (the class types are cards since look-gap step 1).
  ["List", "/sessions", null, false],
  [
    "Hover, the new button",
    "/sessions",
    (page) => page.getByRole("link", { name: /^New/ }).first().hover(),
    false,
  ],
  ["Hover, a row", "/sessions", (page) => page.getByRole("row").nth(1).hover(), false],
  ["Form", "/class-types/new", null, true],
  [
    "Dialog",
    "/class-types/1",
    (page) =>
      page
        .getByRole("button", { name: /^Delete/ })
        .first()
        .click(),
    false,
  ],
];

mkdirSync(opts.out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const theme of themes) {
    const name = theme.endsWith(".yml") ? basename(theme, ".yml") : theme;
    if (theme.endsWith(".yml")) op(dir, "addTheme", name, "--text", `@${resolve(theme)}`, "--use");
    else op(dir, "setTheme", "--preset", name);
    const stop = await serve();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    // Signed in as an admin, so the list, form and dialog are open to the camera.
    await signIn(page, base, "admin");
    const shots = [];
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      for (const [label, path, act, fullPage] of SHOTS) {
        await open(page, path);
        // A click before a freshly started dev server's page is ready does nothing: try again.
        if (act && !label.startsWith("Dialog")) {
          await act(page);
          await page.waitForTimeout(300);
        }
        for (let attempt = 1; act && label.startsWith("Dialog"); attempt++) {
          await act(page);
          try {
            await page
              .getByRole("alertdialog")
              .or(page.getByRole("dialog"))
              .first()
              .waitFor({ timeout: 5000 });
            await page.waitForTimeout(300);
            break;
          } catch (error) {
            if (attempt === 3) throw error;
            await open(page, path);
          }
        }
        const png = await page.screenshot({ fullPage, animations: "disabled" });
        shots.push({
          label: `${label}, ${colorScheme}`,
          src: `data:image/png;base64,${png.toString("base64")}`,
        });
      }
    }
    // One page per theme: light on the left, dark on the right, the four shots down each.
    const html = `<!doctype html><meta charset="utf-8"><style>
      body { margin: 0; padding: 24px; background: #888; font: 600 20px system-ui, sans-serif; color: #111; }
      h1 { margin: 0 0 16px; font-size: 32px; }
      main { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
      figure { margin: 0 0 24px; } figcaption { margin-bottom: 6px; }
      img { width: 100%; display: block; box-shadow: 0 2px 8px #0005; }
    </style><h1>${name}</h1><main>${[0, 1]
      .map(
        (half) =>
          `<div>${shots
            .slice(half * SHOTS.length, (half + 1) * SHOTS.length)
            .map((s) => `<figure><figcaption>${s.label}</figcaption><img src="${s.src}"></figure>`)
            .join("")}</div>`,
      )
      .join("")}</main>`;
    const sheet = await browser.newPage({ viewport: { width: 2600, height: 1200 } });
    await sheet.setContent(html);
    const file = join(opts.out, `${name}.png`);
    await sheet.screenshot({ path: file, fullPage: true });
    await sheet.close();
    await context.close();
    stop();
    console.log(file);
  }
} finally {
  await browser.close();
}
// The app stays for a look: `pnpm exec vite dev` in it shows the last theme.
