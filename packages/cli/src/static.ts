// `smithable static <app> [--out <dir>] [--as <role>] [--states]`: an app's pages as static files,
// for a look at them with nothing running (a folder for testers, pictures in seconds, the theme
// lab's frames). Every page is saved as HTML without its scripts, with the kit's CSS as one sheet,
// its pictures and fonts beside it, signed in as a role (admin unless said; `visitor` for the
// public pages); a list's form and its first record too, and with --states a few more: a list
// with nothing found, a form with its errors, a record's delete dialog open. An index page shows
// them in light and in dark and at common widths. Nothing is interactive: the look only.
// Needs Playwright: the app's own (its smoke test has it), else one installed globally.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { FRAME_RUNTIME } from "./frame-runtime.js";
import { type Io, tool } from "./io.js";
import { loadSpec } from "./validate.js";

/** A page to save: where it is, what it is called, the file it goes to, and a state to put it in. */
export interface Frame {
  label: string;
  path: string;
  file: string;
  state?: "empty" | "errors" | "dialog";
}

/** A search no record matches, for the list with nothing found. */
const NOTHING = "smithable-static-nothing";

/** The pages saved: each page at its route; a list's form and first record; with states, more. */
export function staticFrames(
  pages: { id: string; route: string; pattern: { kind: string } }[],
  states = false,
): Frame[] {
  const frames: Frame[] = [];
  for (const page of pages) {
    const route = page.route.replace(/\/$/, "");
    frames.push({ label: page.id, path: page.route, file: page.id });
    if (page.pattern.kind !== "crud") continue;
    frames.push({ label: `${page.id}: form`, path: `${route}/new`, file: `${page.id}-form` });
    frames.push({ label: `${page.id}: record`, path: `${route}/1`, file: `${page.id}-record` });
    if (!states) continue;
    frames.push(
      {
        label: `${page.id}: nothing found`,
        path: `${route}?q=${NOTHING}`,
        file: `${page.id}-empty`,
        state: "empty",
      },
      {
        label: `${page.id}: form with errors`,
        path: `${route}/new`,
        file: `${page.id}-errors`,
        state: "errors",
      },
      {
        label: `${page.id}: delete dialog`,
        path: `${route}/1`,
        file: `${page.id}-dialog`,
        state: "dialog",
      },
    );
  }
  return frames;
}

/** What the saving needs of a Playwright page. */
export interface StaticPage {
  goto(url: string, options?: object): Promise<{ status(): number } | null>;
  url(): string;
  locator(selector: string): StaticLocator;
  getByRole(role: "button", options: { name: string; exact?: boolean }): StaticLocator;
  /** An expression's value (the CLI has no DOM types, so the script is text). */
  evaluate(script: string): Promise<unknown>;
  request: {
    get(url: string): Promise<{ body(): Promise<Buffer>; headers(): Record<string, string> }>;
  };
}
export interface StaticLocator {
  first(): StaticLocator;
  count(): Promise<number>;
  click(options?: object): Promise<void>;
  waitFor(options?: object): Promise<void>;
}

/** What a page's saving found: the frames saved (for start.json), the ones left out, and why. */
export interface Saved {
  frames: { label: string; path: string }[];
  skipped: { label: string; reason: string }[];
  assets: number;
}

/**
 * Saves each frame's page under `out/frames/`: the page without its scripts, its CSS as one
 * sheet (shared when alike), the pictures and fonts it uses under `assets/` by their content,
 * and `frame.js`, the saved pages' runtime. With `imports`, the sheets a stylesheet imports (the
 * fonts) are part of the sheet; the theme lab leaves them out, since a theme brings its own.
 */
export async function savePages(
  page: StaticPage,
  base: string,
  out: string,
  frames: Frame[],
  options: { imports: boolean; patience?: number },
): Promise<Saved> {
  const patience = options.patience ?? 1;
  mkdirSync(join(out, "frames", "assets"), { recursive: true });
  const assets = new Map<string, string>();
  /** A file the page uses, saved once under assets/ by its content. */
  const asset = async (url: string) => {
    const known = assets.get(url);
    if (known) return known;
    const response = await page.request.get(url);
    const body = await response.body();
    // An uploaded file (a post's cover at /files/…) has no extension: its type names it.
    const ext = (
      /\.(\w+)$/.exec(new URL(url).pathname)?.[1] ??
      /^(?:image|font)\/(\w+)/.exec(response.headers()["content-type"] ?? "")?.[1] ??
      "bin"
    ).toLowerCase();
    const name = `${createHash("sha256").update(body).digest("hex").slice(0, 12)}.${ext}`;
    writeFileSync(join(out, "frames", "assets", name), body);
    assets.set(url, `assets/${name}`);
    return `assets/${name}`;
  };
  /** Replaces each same-origin URL in a text (src, href, url()) with its saved copy. */
  const localize = async (text: string, pattern: RegExp) => {
    let result = "";
    let last = 0;
    for (const match of text.matchAll(pattern)) {
      const url = new URL(match[1] as string, base);
      if (url.origin !== new URL(base).origin || /\.(css|js|ts|tsx)$/.test(url.pathname)) continue;
      result +=
        text.slice(last, match.index) + match[0].replace(match[1] as string, await asset(url.href));
      last = match.index + match[0].length;
    }
    return result + text.slice(last);
  };

  const sheets = new Map<string, string>();
  const saved: Saved = { frames: [], skipped: [], assets: 0 };
  for (const frame of frames) {
    try {
      await save(frame);
    } catch (error) {
      // A state that could not be reached (no form to submit, a slow page) leaves its frame out.
      const reason = String(error instanceof Error ? error.message : error).split("\n")[0] ?? "";
      saved.skipped.push({ label: frame.label, reason: reason.replace(/\.$/, "") });
    }
  }
  writeFileSync(join(out, "frames", "frame.js"), FRAME_RUNTIME);
  saved.assets = assets.size;
  return saved;

  async function save(frame: Frame) {
    const response = await page.goto(base + frame.path, { waitUntil: "commit" });
    if (response && response.status() >= 400) {
      saved.skipped.push({ label: frame.label, reason: `answered ${response.status()}` });
      return;
    }
    await page.locator("body[data-hydrated=true]").waitFor({ timeout: 60000 * patience });
    if (new URL(page.url()).pathname === "/sign-in") {
      saved.skipped.push({ label: frame.label, reason: "asks to sign in" });
      return;
    }
    if (frame.state === "errors") {
      // Saving an empty form: the messages appear.
      await page.locator("[data-kit=model-form] button[type=submit]").first().click();
      await page
        .locator('[aria-invalid="true"], [role="alert"]')
        .first()
        .waitFor({ timeout: 10000 * patience });
    } else if (frame.state === "dialog") {
      // Delete asks first; Move to trash does not, so a trash's record is left as it is.
      const remove = page.getByRole("button", { name: "Delete", exact: true });
      if ((await remove.count()) === 0) {
        saved.skipped.push({ label: frame.label, reason: "has no Delete to ask" });
        return;
      }
      await remove.first().click();
      await page
        .locator("dialog[open]")
        .first()
        .waitFor({ timeout: 10000 * patience });
    }
    const { html, css, title } = (await page.evaluate(`(() => {
      // Every rule the page has; the imported sheets' (the fonts') when asked.
      const imports = ${options.imports};
      const rules = [];
      const walk = (sheet) => {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSImportRule) {
            if (imports && rule.styleSheet) walk(rule.styleSheet);
          } else rules.push(rule.cssText);
        }
      };
      for (const sheet of document.styleSheets) {
        try {
          walk(sheet);
        } catch {}
      }
      const root = document.documentElement.cloneNode(true);
      for (const node of root.querySelectorAll(
        "script, style, link[rel=stylesheet], link[rel=modulepreload], link[rel=preload]",
      ))
        node.remove();
      return { html: "<!doctype html>\\n" + root.outerHTML, css: rules.join("\\n"), title: document.title };
    })()`)) as { html: string; css: string; title: string };
    const sheet = await localize(css, /url\("?([^")]+)"?\)/g);
    const hash = createHash("sha256").update(sheet).digest("hex").slice(0, 12);
    if (!sheets.has(hash)) {
      sheets.set(hash, `app-${hash}.css`);
      writeFileSync(join(out, "frames", `app-${hash}.css`), sheet);
    }
    const file = `${frame.file}.html`;
    const body = (
      await localize(
        html,
        /(?:src|href)="(\/files\/[^"]+|[^"]+\.(?:webp|png|jpe?g|svg|avif|gif|ico))"/g,
      )
    )
      .replace(/\ssrcset="[^"]*"/g, "")
      .replace(
        "</head>",
        `<link rel="stylesheet" href="${sheets.get(hash)}"><script src="frame.js" defer></script></head>`,
      );
    writeFileSync(join(out, "frames", file), body);
    // The page's own title names the frame; a state is said after it.
    const state = frame.label.includes(": ") ? frame.label.slice(frame.label.indexOf(": ")) : "";
    saved.frames.push({
      label: `${title.split(/\s[·–|-]\s/)[0] || frame.label}${state}`,
      path: `/frames/${file}`,
    });
  }
}

/** The index page: the saved pages listed, one shown at a time, light or dark, at a chosen width. */
export function indexPage(name: string, frames: { label: string; path: string }[]): string {
  const widths = [
    ["Desktop", 1280],
    ["Laptop", 1024],
    ["Tablet", 768],
    ["Phone", 390],
  ];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(name)}: the pages</title>
<style>
  :root { color-scheme: light dark; font: 14px/1.4 system-ui, sans-serif; }
  body { margin: 0; display: grid; grid-template-columns: 16rem 1fr; height: 100vh; }
  nav { overflow: auto; border-right: 1px solid color-mix(in srgb, currentColor 20%, transparent); padding: 1rem 0; }
  nav h1 { font-size: 1rem; margin: 0 1rem .75rem; }
  nav a { display: block; padding: .3rem 1rem; color: inherit; text-decoration: none; }
  nav a[aria-current] { background: color-mix(in srgb, currentColor 12%, transparent); }
  main { display: grid; grid-template-rows: auto 1fr; min-width: 0; }
  .bar { display: flex; flex-wrap: wrap; gap: .5rem; padding: .5rem 1rem; border-bottom: 1px solid color-mix(in srgb, currentColor 20%, transparent); }
  .bar button { font: inherit; padding: .25rem .75rem; border: 1px solid color-mix(in srgb, currentColor 30%, transparent); border-radius: .375rem; background: transparent; color: inherit; cursor: pointer; }
  .bar button[aria-pressed=true] { background: color-mix(in srgb, currentColor 15%, transparent); }
  .bar .open { margin-left: auto; }
  .stage { overflow: auto; background: color-mix(in srgb, currentColor 6%, transparent); display: flex; justify-content: center; }
  iframe { border: 0; height: 100%; width: 100%; max-width: var(--width, 100%); background: white; }
</style>
</head>
<body>
<nav><h1>${escapeHtml(name)}</h1>${frames.map((f) => `<a href="${escapeHtml(f.path.slice(1))}">${escapeHtml(f.label)}</a>`).join("")}</nav>
<main>
  <div class="bar" role="toolbar">
    <button type="button" data-mode="light" aria-pressed="true">Light</button>
    <button type="button" data-mode="dark">Dark</button>
    ${widths.map(([label, w]) => `<button type="button" data-width="${w}">${label}</button>`).join("\n    ")}
    <a class="open" target="_blank" rel="noopener">Open the page alone ↗</a>
  </div>
  <div class="stage"><iframe title="The page"></iframe></div>
</main>
<script>
  const frame = document.querySelector("iframe");
  const links = [...document.querySelectorAll("nav a")];
  const alone = document.querySelector(".open");
  let mode = "light";
  const origin = location.origin === "null" ? "*" : location.origin;
  const tell = () =>
    frame.contentWindow?.postMessage({ type: "smithable:theme-css", css: "", mode }, origin);
  window.addEventListener("message", (event) => {
    if (event.source === frame.contentWindow && event.data?.type === "ready") tell();
  });
  const show = (link) => {
    for (const l of links) l.toggleAttribute("aria-current", l === link);
    frame.src = link.getAttribute("href");
    alone.href = link.getAttribute("href");
    history.replaceState(null, "", "#" + link.getAttribute("href"));
  };
  for (const link of links)
    link.addEventListener("click", (event) => {
      event.preventDefault();
      show(link);
    });
  for (const button of document.querySelectorAll("[data-mode]"))
    button.addEventListener("click", () => {
      mode = button.dataset.mode;
      for (const b of document.querySelectorAll("[data-mode]"))
        b.setAttribute("aria-pressed", String(b === button));
      tell();
    });
  for (const button of document.querySelectorAll("[data-width]"))
    button.addEventListener("click", () => {
      const same = button.getAttribute("aria-pressed") === "true";
      for (const b of document.querySelectorAll("[data-width]"))
        b.setAttribute("aria-pressed", String(b === button && !same));
      frame.style.setProperty("--width", same ? "100%" : button.dataset.width + "px");
    });
  show(links.find((l) => "#" + l.getAttribute("href") === location.hash) ?? links[0]);
</script>
</body>
</html>
`;
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );

/** A port nobody listens on. */
const freePort = () =>
  new Promise<number>((done, fail) => {
    const server = createServer();
    server.once("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => done(port));
    });
  });

/** The app's Playwright (its smoke test's), else one installed globally. */
async function browserOf(app: string): Promise<{ launch(): Promise<StaticBrowser> } | undefined> {
  for (const path of [
    join(app, "node_modules", "@playwright", "test", "index.mjs"),
    "playwright",
  ]) {
    try {
      const { chromium } = (await import(path)) as {
        chromium: { launch(): Promise<StaticBrowser> };
      };
      if (chromium) return chromium;
    } catch {}
  }
  return undefined;
}
interface StaticBrowser {
  newPage(options: object): Promise<StaticPage>;
  close(): Promise<void>;
}

export async function staticPages(
  dir: string,
  io: Io,
  options: { out?: string; as?: string; states?: boolean } = {},
): Promise<number> {
  const app = resolve(dir);
  const { ir, auth } = loadSpec(app, io);
  if (!ir || !auth) return 1;
  if (!existsSync(join(app, "node_modules"))) {
    io.err(`${app} has no node_modules: run the app once first (smithable run).\n`);
    return 1;
  }
  const role = options.as ?? "admin";
  if (role !== "visitor" && !auth.roles.some((r) => r.name === role)) {
    io.err(
      `The app has no role ${role}. Its roles: ${auth.roles.map((r) => r.name).join(", ")}; or visitor.\n`,
    );
    return 1;
  }
  const chromium = await browserOf(app);
  if (!chromium) {
    io.err(
      "Saving the pages needs Playwright: npm install -g playwright && npx playwright install chromium\n",
    );
    return 1;
  }
  const out = resolve(options.out ?? join(app, "data", "static"));
  const port = await freePort();
  const base = `http://localhost:${port}`;
  io.out(`Starting the app at ${base}…\n`);
  const child = spawn(...tool(app, "vite", ["dev", "--port", String(port), "--strictPort"]), {
    cwd: app,
    env: { ...process.env, BETTER_AUTH_URL: base, NO_COLOR: "1" },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let said = "";
  child.stderr?.on("data", (d) => {
    said += String(d);
  });
  const stop = () => child.kill();
  process.on("exit", stop);
  try {
    for (let waited = 0; ; waited += 500) {
      const status = await fetch(`${base}/sign-in`).then(
        (r) => r.status,
        () => 0,
      );
      if (status > 0 && status < 500) break;
      if (waited > 120000 || child.exitCode !== null) {
        io.err(`The app did not start at ${base}.\n${said}`);
        return 1;
      }
      await new Promise((done) => setTimeout(done, 500));
    }
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
      if (role !== "visitor" && auth.signIn !== "none") {
        await page.goto(`${base}/sign-in`);
        await page.locator("body[data-hydrated=true]").waitFor({ timeout: 60000 });
        await page
          .getByRole("button", { name: `Sign in as ${role}` })
          .first()
          .click();
        for (let waited = 0; new URL(page.url()).pathname === "/sign-in"; waited += 200) {
          if (waited > 30000) {
            io.err(`Signing in as ${role} did not go through.\n`);
            return 1;
          }
          await new Promise((done) => setTimeout(done, 200));
        }
      }
      rmSync(out, { recursive: true, force: true });
      const saved = await savePages(page, base, out, staticFrames(ir.pages, options.states), {
        imports: true,
      });
      writeFileSync(
        join(out, "start.json"),
        `${JSON.stringify({ frames: saved.frames }, null, 2)}\n`,
      );
      writeFileSync(join(out, "index.html"), indexPage(ir.app.name, saved.frames));
      io.out(
        `Saved ${saved.frames.length} pages and ${saved.assets} files into ${out} (as ${role}). Open ${join(out, "index.html")}.\n`,
      );
      for (const { label, reason } of saved.skipped) io.out(`Left out ${label}: ${reason}.\n`);
      return 0;
    } finally {
      await browser.close();
    }
  } finally {
    stop();
    process.off("exit", stop);
  }
}
