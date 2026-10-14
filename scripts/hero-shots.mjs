// The hero deck's pictures (docs/design/hero-deck.md): for each starter one change made three ways
// in Studio (the prompt, the change form, the line in smithable.yml) and the record's form before
// and after it. Takes the changes from scripts/hero-shots.json; writes
// docs/site/brand/hero/<starter>/{prompt,nocode,code,before,after}.webp and deck.json, with a copy
// in --copy for review. The sentences are read by the wording rules, so no model runs and the
// pictures are the same on every run; a sentence they do not read stops the script.
// Run after `pnpm build`: `node scripts/hero-shots.mjs [starter…] [--copy <dir>]`. Not part of `check`.
import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { cli, newApp, repo } from "./dev-app.mjs";

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    copy: { type: "string", default: "/mnt/c/Users/johan/Pictures/claude/hero" },
    port: { type: "string", default: process.env.HERO_SHOTS_PORT ?? "8404" },
  },
});
const CHANGES = JSON.parse(readFileSync(join(repo, "scripts/hero-shots.json"), "utf8"));
const starters = positionals.length ? positionals : Object.keys(CHANGES);
const port = Number(opts.port);
const out = join(repo, "docs/site/brand/hero");
const deckFile = join(out, "deck.json");
const deck = (() => {
  try {
    return JSON.parse(readFileSync(deckFile, "utf8"));
  } catch {
    return {};
  }
})();

/** The browser's own WebP encoder, as starter-shots.mjs does it. */
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
    return canvas.toDataURL("image/webp", 0.85).split(",")[1];
  }, png.toString("base64"));
  await page.close();
  return Buffer.from(data, "base64");
}

/** The spec with a line added at the end of a model's fields, where addField puts it. */
function withLine(text, model, line) {
  const lines = text.split("\n");
  const start = lines.indexOf(`  ${model}:`);
  const fields = lines.findIndex((l, i) => i > start && l === "    fields:");
  if (start < 0 || fields < 0) throw new Error(`no fields of ${model} in smithable.yml`);
  let end = fields + 1;
  while (end < lines.length && /^( {6}\S| {8})/.test(lines[end])) end++;
  lines.splice(end, 0, `      ${line}`);
  return lines.join("\n");
}

/** Studio on the project, with no model set up: a sentence the rules miss fails visibly. */
async function startStudio(dir) {
  const server = spawn("node", [cli, "studio", dir, "--port", String(port)], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), "hero-config-")) },
  });
  const stop = () => {
    try {
      process.kill(-server.pid);
    } catch {}
  };
  process.on("exit", stop);
  for (let i = 0; i < 240; i++) {
    try {
      if ((await fetch(`http://localhost:${port + 1}/health`)).ok) return stop;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  stop();
  throw new Error("Studio did not start");
}

async function shoot(browser, starter, change) {
  const files = join(out, starter);
  mkdirSync(files, { recursive: true });
  const save = async (name, png) => {
    const file = join(files, `${name}.webp`);
    writeFileSync(file, await webp(browser, png));
    copyFileSync(file, join(opts.copy, `${starter}-${name}.webp`));
    console.log(file);
  };
  const dir = newApp(starter, `hero-${starter}`);
  const stop = await startStudio(dir);
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
      colorScheme: "light",
    });
    await page.goto(`http://localhost:${port}/?guide=off`);
    const frame = page.locator('iframe[title="App preview"]');
    // Whole elements with a margin, and more above them for the card's badge, down to what is
    // above them (`over`), so no word is cut at an edge.
    const clip = async (locators, over, pad = 12, top = 40) => {
      const boxes = [];
      for (const l of locators) boxes.push(await l.boundingBox());
      const floor = over ? await over.boundingBox().then((b) => b.y + b.height + 4) : 0;
      const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
      const y = Math.max(floor, Math.min(...boxes.map((b) => b.y)) - top);
      const r = Math.max(...boxes.map((b) => b.x + b.width)) + pad;
      const b = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
      return page.screenshot({ clip: { x, y, width: r - x, height: b - y } });
    };
    // The record's form, whole and from the page's top, in a preview wide enough to show it as the
    // app does: before and after line up, and after is taller by what the change added.
    const result = async () => {
      await page.setViewportSize({ width: 1600, height: 1800 });
      await page
        .locator('section[aria-busy="true"]', {
          has: page.getByRole("heading", { name: "Preview" }),
        })
        .waitFor({ state: "detached", timeout: 90000 });
      await page.getByLabel("Preview address").fill(change.route);
      await page.getByRole("button", { name: "Go", exact: true }).click();
      await page.waitForTimeout(6000);
      const bottom = await frame
        .contentFrame()
        .locator("body")
        .evaluate(() => {
          window.scrollTo(0, 0);
          const forms = [...document.querySelectorAll("main form")];
          if (!forms.length) return document.documentElement.scrollHeight;
          return Math.ceil(Math.max(...forms.map((f) => f.getBoundingClientRect().bottom)) + 40);
        });
      await page.waitForTimeout(500);
      const fb = await frame.boundingBox();
      if (bottom > fb.height) throw new Error(`${starter}: the form is taller than the preview`);
      const png = await page.screenshot({
        clip: { x: fb.x, y: fb.y, width: fb.width, height: bottom },
        animations: "disabled",
      });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(1000);
      return png;
    };
    await save("before", await result());

    // Edit by prompt: the sentence and the rules' proposal, before Apply.
    await page.getByRole("tab", { name: "Changes" }).click();
    const ask = page.getByLabel("Describe a change");
    await ask.fill(change.sentence);
    await page.getByRole("button", { name: "Make the change" }).click();
    const proposal = page.getByRole("region", { name: "Proposal" });
    await proposal.waitFor({ timeout: 60000 });
    const said = await proposal.innerText();
    if (!/No AI needed/.test(said))
      throw new Error(`${starter}: the rules did not read "${change.sentence}":\n${said}`);
    await page.waitForTimeout(500);
    await save(
      "prompt",
      await clip(
        [page.locator('form[data-guide="change"]'), proposal],
        page.getByRole("tab", { name: "Changes" }),
      ),
    );
    const discard = proposal.getByRole("button", { name: /Discard/ });
    if (await discard.isVisible().catch(() => false)) await discard.click();

    // Edit without code: the field form, filled in, before its button, in a window tall enough
    // for the whole form.
    await page.setViewportSize({ width: 1280, height: 1100 });
    const forms = page.locator("details", { hasText: "Change by form" });
    if ((await forms.getAttribute("open")) === null) await forms.locator("summary").click();
    await page.getByLabel("What do you want to change?").selectOption({ label: "Add a field" });
    await page.getByLabel("Kind of record").selectOption(change.model);
    await page.getByLabel("Name", { exact: true }).fill(change.name);
    await page.getByLabel("Holds").selectOption({ label: change.holds });
    if (change.values) await page.getByLabel("Values").fill(change.values);
    await page.waitForTimeout(500);
    await save("nocode", await clip([forms], undefined, 8, 8));

    // Edit by code: the line in smithable.yml, saved by itself (this applies the change, once).
    await page.getByRole("radio", { name: "Code", exact: true }).check({ force: true });
    const editor = page.getByLabel("smithable.yml");
    await editor.waitFor({ timeout: 30000 });
    const text = await editor.evaluate((e) => e.value);
    await editor.evaluate(
      (e, v) => {
        e.value = v;
      },
      withLine(text, change.model, change.line),
    );
    await page.getByText("Saved", { exact: true }).waitFor({ timeout: 90000 });
    // Under 1024 pixels Studio gives the editor the window's width, so the spec's long lines fit.
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.waitForTimeout(1000);
    const yml = page.locator(".cm-editor", { has: page.getByLabel("smithable.yml") });
    const line = yml.locator(".cm-line", { hasText: change.line }).first();
    await line.scrollIntoViewIfNeeded();
    await line.click();
    await page.keyboard.press("Home");
    await yml
      .locator(".cm-scroller")
      .first()
      .evaluate((e) => {
        e.scrollLeft = 0;
      });
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(500);
    // Whole lines down to the new one, as wide as the longest of them: no word cut at an edge.
    const eb = await yml.boundingBox();
    const rows = await yml.locator(".cm-line").evaluateAll((ls) =>
      ls.map((l) => {
        const r = document.createRange();
        r.selectNodeContents(l);
        const b = l.getBoundingClientRect();
        return {
          text: l.textContent,
          top: b.top,
          bottom: b.bottom,
          right: r.getBoundingClientRect().right,
        };
      }),
    );
    const here = rows.findIndex((r) => r.text.trim() === change.line);
    const shown = rows
      .slice(Math.max(0, here - 8), here + 1)
      .filter((r) => r.top >= eb.y && r.bottom <= eb.y + eb.height);
    const right = Math.max(...shown.map((r) => r.right)) + 24;
    if (right > eb.x + eb.width) throw new Error(`${starter}: a line is wider than the editor`);
    const top = shown[0].top;
    await save(
      "code",
      await page.screenshot({
        clip: {
          x: eb.x,
          y: top,
          width: Math.max(480, right - eb.x),
          height: shown.at(-1).bottom - top,
        },
      }),
    );

    // The result after: the same page.
    await page.getByRole("radio", { name: "No code", exact: true }).check({ force: true });
    await page.waitForTimeout(4000);
    await save("after", await result());
    await page.close();
  } finally {
    stop();
  }
  const at = (name) => `${starter}/${name}.webp`;
  deck[starter] = {
    sentence: change.sentence,
    form: { "Kind of record": change.model, Name: change.name, Holds: change.holds },
    lines: [change.line],
    route: change.route,
    files: {
      prompt: at("prompt"),
      nocode: at("nocode"),
      code: at("code"),
      before: at("before"),
      after: at("after"),
    },
    alt: {
      prompt: `Studio's prompt box with "${change.sentence}" and the change it proposes`,
      nocode: `Studio's form for adding a field, filled in: ${change.name}, ${change.holds}`,
      code: `smithable.yml in Studio's editor with the new line "${change.line}"`,
      before: `The app's ${change.route} page before the change`,
      after: `The app's ${change.route} page after the change: ${change.result}`,
    },
  };
  if (change.values) deck[starter].form.Values = change.values;
}

mkdirSync(opts.copy, { recursive: true });
const browser = await chromium.launch();
try {
  for (const starter of starters) {
    if (!CHANGES[starter]) throw new Error(`no change for ${starter}; add it to hero-shots.json`);
    await shoot(browser, starter, CHANGES[starter]);
    const ordered = Object.fromEntries(
      Object.keys(CHANGES)
        .filter((s) => deck[s])
        .map((s) => [s, deck[s]]),
    );
    // One short line in an array stays on one line, as the formatter writes it.
    const json = JSON.stringify(ordered, null, 2).replace(/\[\n\s+("[^"\n]*")\n\s+\]/g, "[$1]");
    writeFileSync(deckFile, `${json}\n`);
  }
} finally {
  await browser.close();
}
