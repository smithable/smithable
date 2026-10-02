// The theme sheet: every theme on the same pages of a real app, so themes are judged side by
// side (by a person or a vision model) on what the kit draws, not on a thumbnail. Makes a booking
// app once, adds the field types the starter lacks so the form shows every control, then for each
// theme applies it through the operation layer and screenshots the landing page, a list, a form
// and a dialog in light and dark, laid out on one page per theme.
// Run after `pnpm build`: `node scripts/theme-sheet.mjs [preset | themes/<name>.yml …] [--out <dir>]`.
// Without themes it shoots the four presets. Not part of `check`.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", default: "/mnt/c/Users/johan/Pictures/claude/themes" },
    port: { type: "string", default: process.env.THEME_SHEET_PORT ?? "5402" },
  },
});
const themes = positionals.length ? positionals : ["modern", "minimal", "playful", "corporate"];
const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const port = Number(opts.port);
const base = `http://localhost:${port}`;

function run(args, cwd = repo) {
  const result = spawnSync(args[0], args.slice(1), { cwd, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(`${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
/** Kills the dev server and everything it started (pnpm, node, Vite), children first. */
function killTree(pid) {
  const children = spawnSync("ps", ["-o", "pid=", "--ppid", String(pid)], { encoding: "utf8" })
    .stdout.split("\n")
    .map((s) => Number(s.trim()))
    .filter(Boolean);
  for (const child of children) killTree(child);
  try {
    process.kill(pid);
  } catch {}
}
const op = (dir, ...args) => run(["node", cli, "op", ...args, "--dir", dir, "--yes"]);

const dir = join(mkdtempSync(join(tmpdir(), "smithable-theme-sheet-")), "app");
console.log(`making the sheet app in ${dir}`);
run(["node", cli, "new", dir, "--starter", "booking"]);
// The controls the booking starter has no field for.
op(dir, "addField", "ClassType", "price", "money");
op(dir, "addField", "ClassType", "dropIn", "bool");
op(dir, "addField", "ClassType", "website", "url");
op(dir, "addField", "ClassType", "contact", "email");

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(130));

/**
 * Starts the dev server and waits for it. Started anew for each theme: a running server keeps
 * serving the stylesheet and font it loaded first.
 */
async function serve() {
  const server = spawn("pnpm", ["exec", "vite", "dev", "--port", String(port), "--strictPort"], {
    cwd: dir,
    env: { ...process.env, PORT: String(port) },
  });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  const stop = () => killTree(server.pid);
  process.on("exit", stop);
  for (let i = 0; i < 240; i++) {
    try {
      if ((await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) })).ok) return stop;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  stop();
  throw new Error(`the app did not start:\n${log.slice(-2000)}`);
}

async function open(page, path) {
  await page.goto(`${base}${path}`);
  await page.waitForLoadState("networkidle");
}

// The shots on a sheet: [label, path, what to do before the picture, full page].
const SHOTS = [
  ["Landing page", "/", null, true],
  ["List", "/class-types", null, false],
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
    for (let attempt = 1; ; attempt++) {
      await open(page, "/sign-in");
      await page.getByRole("button", { name: "Sign in as admin" }).click();
      try {
        await page.waitForURL((url) => url.pathname !== "/sign-in", { timeout: 5000 });
        break;
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }
    const shots = [];
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      for (const [label, path, act, fullPage] of SHOTS) {
        await open(page, path);
        // A click before a freshly started dev server's page is ready does nothing: try again.
        for (let attempt = 1; act; attempt++) {
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
