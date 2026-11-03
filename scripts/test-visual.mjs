// Generated-app visual regression fixtures. All setup writes stay in this run's own temporary app.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { chromium } from "playwright";
import { FONT_ASSETS } from "../packages/adapter-tanstack/dist/index.js";
import { pairwise, VISUAL_DIMENSIONS } from "../packages/adapter-tanstack/dist/test-pairwise.js";
import { BUILT_IN_THEMES, YamlEditor } from "../packages/core/dist/index.js";
import { themeText } from "../packages/look-editor/dist/theme-text.js";
import { cli, newApp, run } from "./dev-app.mjs";
import { P } from "./patience.mjs";
import { checkPorts } from "./ports.mjs";
import { checkLoadedFont } from "./theme-lab-checks.mjs";
import {
  assertVisualFixture,
  checkVisualHistory,
  FIXTURE_OWNER,
} from "./visual-history-checks.mjs";
import { checkVisualStates } from "./visual-state-checks.mjs";

// The fixture's app serves on the fifth port of Studio's check (TEST_STUDIO_PORT + 4, which
// scripts/test-studio.mjs reserves; 4904 when neither is set, as that check's 4900), or
// VISUAL_PORT on its own.
const port = Number(process.env.VISUAL_PORT ?? Number(process.env.TEST_STUDIO_PORT ?? 4900) + 4);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error("VISUAL_PORT or TEST_STUDIO_PORT is not a port number.");
  process.exit(1);
}
checkPorts("The visual check (VISUAL_PORT or TEST_STUDIO_PORT + 4)", [port]);
const base = `http://localhost:${port}`;
const owned = !process.env.VISUAL_APP;
const dir = realpathSync(process.env.VISUAL_APP ?? newApp("booking", "visual"));
assertVisualFixture(dir, !owned);
if (owned)
  writeFileSync(
    join(dir, "visual-fixture.json"),
    JSON.stringify({ owner: FIXTURE_OWNER, purpose: "visual-regression" }) + "\n",
  );
const output = resolve(process.env.VISUAL_OUTPUT ?? join(dirname(dir), "visual-evidence"));
mkdirSync(output, { recursive: true });
const original = Object.fromEntries(
  ["spec", "content", "ux"].map((key) => [
    key,
    readFileSync(join(dir, key === "spec" ? "smithable.yml" : `smithable.${key}.yml`), "utf8"),
  ]),
);
const set = (editor, path, value) =>
  editor.has(path) ? editor.set(path, value) : editor.add(path.slice(0, -1), path.at(-1), value);
function setup() {
  const spec = new YamlEditor(original.spec);
  for (const [name, fields] of Object.entries({
    VisualItem: {
      name: "string!",
      notes: "text",
      stage: "draft | done",
      payment: "unpaid | paid",
      estimate: "money",
      actual: "money",
      created: "date",
      due: "datetime",
      shipped: "date",
      photo: "picture",
      lines: "VisualLine[]",
    },
    VisualLine: {
      item: "VisualItem!",
      label: "string!",
      quantity: "int! = 1",
      unitPrice: "money!",
      amount: { type: "money", formula: "quantity * unitPrice" },
    },
    VisualEmpty: { name: "string!" },
  }))
    set(spec, ["models", name], { fields });
  set(spec, ["pages", "visual-editorial"], {
    route: "/visual-editorial",
    landing: {
      hero: { button: "visual-items" },
      story: { mediaText: true },
      pictures: { gallery: true },
    },
  });
  set(spec, ["pages", "visual-queue"], {
    route: "/visual-queue",
    dashboard: {
      total: { count: "VisualItem" },
      queue: { list: "VisualItem", limit: 5 },
      recent: { activity: "changes" },
    },
    sections: { story: { mediaText: true }, pictures: { gallery: true } },
  });
  set(spec, ["pages", "visual-items"], { route: "/visual-items", crud: "VisualItem" });
  set(spec, ["pages", "visual-empty"], { route: "/visual-empty", crud: "VisualEmpty" });
  writeFileSync(join(dir, "smithable.yml"), spec.text);
  const ux = new YamlEditor(original.ux);
  set(ux, ["theme", "preset"], "visual-fixture");
  set(ux, ["pages", "visual-items"], {
    table: { columns: ["name", "payment", "actual"], mark: "picture" },
    record: {
      header: "summary",
      pictures: "aside",
      summary: { status: ["payment"], amount: ["actual"], dates: ["shipped", "due"] },
      lists: { lines: "inline" },
    },
    form: {
      aside: "summary",
      sections: [
        { name: "identity", fields: ["name", "stage", "payment"] },
        { name: "amounts", fields: ["estimate", "actual"] },
        { name: "dates", fields: ["created", "due", "shipped"] },
        { name: "details", fields: ["notes", "photo"] },
      ],
    },
  });
  writeFileSync(join(dir, "smithable.ux.yml"), ux.text);
}
const modern = BUILT_IN_THEMES.find((theme) => theme.name === "modern");
assert(modern);
const risk = {
  viewport: "320",
  appearance: "dark",
  type: "condensed-upper",
  surface: "glass",
  media: "portrait-edge",
  composition: "record-inline-summary",
  motion: "reduced",
  copy: "swedish-long",
  zoom: "200",
};
const cases = pairwise(VISUAL_DIMENSIONS, [risk]);
const selected = process.env.VISUAL_STATES_ONLY
  ? []
  : process.env.VISUAL_LIMIT
    ? cases.slice(0, Number(process.env.VISUAL_LIMIT))
    : cases;
const fixed = Date.UTC(2026, 10, 2, 12);
let fixtureImage;
const long = "Återkommande uppföljningar för skärgårdsbornas gemensamma återvinningssamordning";
function sources(row, index) {
  const theme = {
    ...modern,
    name: "visual-fixture",
    source: "project",
    density: "comfortable",
    motion: "lively",
    ...(row.oneMode ? { modes: "light" } : {}),
    style: {
      ...modern.style,
      ...(row.type === "condensed-upper" ? { headingFont: "Archivo Narrow" } : {}),
      headings: {
        ...modern.style.headings,
        weight: 700,
        scale: row.type === "condensed-upper" ? "huge" : "regular",
        case: row.type === "condensed-upper" ? "upper" : "none",
        tracking: row.type === "condensed-upper" ? "wide" : "normal",
      },
      surfaces: { ...modern.style.surfaces, cards: row.surface },
      ...(row.oneMode ? { pictures: { ...modern.style.pictures, treatment: "duotone" } } : {}),
    },
    defaults: {
      app: { navigation: "topbar" },
      kinds: { landing: { header: { position: index % 2 ? "scrolling" : "sticky" } } },
      sections: {
        mediaText: {
          layout: index % 2 ? "stacked" : "split",
          image: index % 2 ? "right" : "left",
          rhythm: row.composition === "queue" ? "compact" : "airy",
          measure: index % 2 ? "wide" : "reading",
          fit: index % 2 ? "contain" : "cover",
          aspect: row.media === "portrait-edge" ? "portrait" : "landscape",
          focal: "left",
        },
        gallery: { fit: "contain", aspect: "square", focal: "left" },
      },
    },
  };
  mkdirSync(join(dir, "themes"), { recursive: true });
  writeFileSync(join(dir, "themes/visual-fixture.yml"), themeText(theme));
  const content = new YamlEditor(original.content);
  for (const page of ["visual-editorial", "visual-queue"]) {
    set(content, ["pages", page, "title"], row.copy === "swedish-long" ? long : "Visual workflow");
    set(content, ["pages", page, "story"], {
      title: row.copy === "swedish-long" ? long : "A local story",
      text:
        row.copy === "swedish-long"
          ? `${long}. Vi samlar våra erfarenheter och hjälper varandra att fatta genomtänkta beslut.\n\n`.repeat(
              4,
            )
          : "A small team passes useful things and clear notes to the next person.",
      caption:
        row.copy === "swedish-long"
          ? "En tydlig bild hjälper nästa person att förstå hela sammanhanget – även nära bildens kant."
          : "A synthetic edge-positioned figure",
      image: { src: "images/visual-fixture.webp", alt: "Synthetic figure near the left edge" },
    });
    set(content, ["pages", page, "pictures"], {
      title: "Pictures",
      items: [
        {
          image: {
            src: "images/visual-fixture.webp",
            alt: "Full synthetic edge-positioned figure",
          },
          caption: "The full image stays available.",
        },
      ],
    });
    if (page === "visual-editorial")
      set(content, ["pages", page, "hero"], {
        title: row.copy === "swedish-long" ? long : "A clear view",
        subtitle: row.copy === "swedish-long" ? long : "Work and stories in one place",
        image: { src: "images/visual-fixture.webp", alt: "A synthetic figure at the edge" },
      });
  }
  set(
    content,
    ["models", "VisualItem", "fields", "actual", "label"],
    row.copy === "swedish-long" ? "Sammanlagt överenskommet och debiterat belopp" : "Actual amount",
  );
  writeFileSync(join(dir, "smithable.content.yml"), content.text);
  run(["node", cli, "generate"], dir);
}
function seed(name) {
  const db = new DatabaseSync(join(dir, "data/db/app.db"));
  try {
    for (const table of ["visual_lines", "visual_items", "visual_empties"])
      db.exec(`DELETE FROM "${table}"`);
    const insert = (table, values) => {
      const columns = db
        .prepare(`PRAGMA table_info("${table}")`)
        .all()
        .filter(
          (column) =>
            !column.pk &&
            (values[column.name.replaceAll("_", "").toLowerCase()] !== undefined ||
              (column.notnull && column.dflt_value === null)),
        );
      const data = columns.map((column) => {
        const key = column.name.replaceAll("_", "").toLowerCase();
        assert(values[key] !== undefined, `Unhandled fixture column ${table}.${column.name}`);
        return values[key];
      });
      return Number(
        db
          .prepare(
            `INSERT INTO "${table}" (${columns.map((column) => `"${column.name}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
          )
          .run(...data).lastInsertRowid,
      );
    };
    const id = insert("visual_items", {
      name,
      notes: long,
      stage: "draft",
      payment: "paid",
      estimate: 125000,
      actual: 142500,
      created: "2026-10-01",
      due: Date.UTC(2026, 10, 12, 12),
      shipped: "2026-11-01",
      photo: JSON.stringify({
        file: "visual-item/000000000000000000000001.webp",
        alt: "Synthetic figure near the left edge",
        width: 800,
        height: 600,
      }),
      createdat: fixed,
      updatedat: fixed,
    });
    insert("visual_lines", {
      item: id,
      itemid: id,
      label: "A clear handoff",
      quantity: 2,
      unitprice: 2500,
      createdat: fixed,
      updatedat: fixed,
    });
    return id;
  } finally {
    db.close();
  }
}
function domain() {
  const db = new DatabaseSync(join(dir, "data/db/app.db"), { readOnly: true });
  try {
    return JSON.stringify(
      ["visual_items", "visual_lines", "visual_empties"].map((table) =>
        db.prepare(`SELECT * FROM "${table}" ORDER BY id`).all(),
      ),
    );
  } finally {
    db.close();
  }
}
async function serve() {
  const env = Object.fromEntries(
    ["PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "PNPM_HOME"]
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  );
  const server = spawn("pnpm", ["exec", "vite", "dev", "--port", String(port), "--strictPort"], {
    cwd: dir,
    detached: true,
    env: { ...env, PORT: String(port), TZ: "UTC" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  server.stdout.on("data", (data) => (log += data));
  server.stderr.on("data", (data) => (log += data));
  const stop = async () => {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    if (server.exitCode === null) {
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {}
    }
  };
  for (let attempt = 0; attempt < 240 * P; attempt++) {
    try {
      if ((await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) })).ok) return stop;
    } catch {}
    if (server.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await stop();
  throw new Error(`Visual app did not start: ${log.slice(-3000)}`);
}
const browser = await chromium.launch();
let stop,
  context,
  passed = false;
const results = [];
try {
  const canvas = await browser.newPage();
  fixtureImage = Buffer.from(
    await canvas.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#d7e5ec";
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = "#314958";
      ctx.fillRect(350, 0, 450, 600);
      ctx.fillStyle = "#b76545";
      ctx.fillRect(25, 305, 110, 230);
      ctx.fillStyle = "#edb689";
      ctx.beginPath();
      ctx.arc(80, 265, 48, 0, Math.PI * 2);
      ctx.fill();
      return canvas.toDataURL("image/webp", 0.95).split(",")[1];
    }),
    "base64",
  );
  await canvas.close();
  mkdirSync(join(dir, "public/images"), { recursive: true });
  writeFileSync(join(dir, "public/images/visual-fixture.webp"), fixtureImage);
  mkdirSync(join(dir, "data/uploads/visual-item"), { recursive: true });
  writeFileSync(join(dir, "data/uploads/visual-item/000000000000000000000001.webp"), fixtureImage);
  setup();
  for (const [index, row] of selected.entries()) {
    if (index < Number(process.env.VISUAL_FROM ?? 0)) continue;
    sources(row, index);
    const recordName = row.copy === "swedish-long" ? long : "Visual handoff";
    stop = await serve();
    seed(recordName);
    const baseline = domain();
    const zoom = Number(row.zoom) / 100;
    context = await browser.newContext({
      viewport: { width: Number(row.viewport), height: Math.floor(900 / zoom) },
      deviceScaleFactor: zoom,
      colorScheme: row.appearance,
      reducedMotion: row.motion === "reduced" ? "reduce" : "no-preference",
    });
    const page = await context.newPage(),
      errors = [];
    await page.clock.setFixedTime(fixed);
    page.on("pageerror", (error) => errors.push(String(error)));
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
    );
    await page.goto(`${base}/sign-in`, { waitUntil: "domcontentloaded" });
    await page.locator("body[data-hydrated=true]").waitFor({ timeout: 90000 * P });
    await page.getByRole("button", { name: "Sign in as admin", exact: true }).click();
    await page.waitForURL((url) => url.pathname !== "/sign-in", { timeout: 15000 * P });
    let release = () => {};
    const gate = new Promise((resolve) => (release = resolve));
    const isPicture = (url) =>
      url.pathname.endsWith("/visual-fixture.webp") ||
      url.pathname.startsWith("/files/visual-item/");
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort();
      if (isPicture(url) && row.media === "missing")
        return route.fulfill({ status: 404, body: "Controlled missing image" });
      if (isPicture(url) && row.media === "slow") await gate;
      return route.continue();
    });
    const path =
      row.composition === "editorial"
        ? "/visual-editorial"
        : row.composition === "queue"
          ? "/visual-queue"
          : "/visual-items";
    await page.goto(base + path, { waitUntil: "domcontentloaded" });
    await page.locator("body[data-hydrated=true]").waitFor({ timeout: 90000 * P });
    if (row.composition === "record-inline-summary") {
      const link = page
        .locator('button[data-part="record-open"]:visible')
        .filter({ hasText: recordName })
        .first();
      await link.click();
      await page.waitForURL((url) => /^\/visual-items\/\d+$/u.test(url.pathname), {
        waitUntil: "commit",
      });
    }
    await page.evaluate(() => document.fonts.ready);
    if (row.type === "condensed-upper") {
      const heading = page.locator("h1").first();
      const asset = FONT_ASSETS.find((font) => font.font === "Archivo Narrow");
      assert(asset);
      assert(
        (await heading.evaluate((node) => getComputedStyle(node).fontFamily)).includes(
          asset.family,
        ),
      );
      await checkLoadedFont(page, asset);
      if (row.composition === "editorial")
        assert.equal(
          await heading.evaluate((node) => getComputedStyle(node).textTransform),
          "uppercase",
        );
    }
    const media = page.locator('[data-section="story"] img').first();
    let box;
    if (row.media === "slow" && (await media.count())) box = await media.boundingBox();
    release();
    if (row.media !== "missing")
      await page.waitForFunction(
        () =>
          [...document.images]
            .filter((image) => /visual-fixture|\/files\/visual-item/.test(image.currentSrc))
            .every((image) => image.complete && image.naturalWidth > 0),
        {},
        { timeout: 30000 * P },
      );
    if (box) {
      const after = await media.boundingBox();
      assert(
        Math.abs(box.width - after.width) < 1 && Math.abs(box.height - after.height) < 1,
        "slow image changed its reserved box",
      );
    }
    const geometry = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    assert(
      geometry.scroll <= geometry.width + 1 && geometry.body <= geometry.width + 1,
      `Whole-page overflow: ${JSON.stringify(geometry)}`,
    );
    const clippedHeadings = await page
      .locator("h1,h2")
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => node.scrollWidth > node.clientWidth + 1)
          .map((node) => node.textContent),
      );
    assert.deepEqual(clippedHeadings, [], "Heading text escapes its column");
    if (row.composition !== "record-inline-summary") {
      const section = page.locator('[data-section="story"]');
      assert.equal(await section.getAttribute("data-layout"), index % 2 ? "stacked" : "split");
      assert.equal(
        await section.locator("..").getAttribute("data-rhythm"),
        row.composition === "queue" ? "compact" : "airy",
      );
      assert.equal(
        await section.locator("..").getAttribute("data-measure"),
        index % 2 ? "wide" : "reading",
      );
      if (row.media !== "missing") {
        const button = section.locator("button").first();
        await button.click();
        const dialog = page.locator("dialog[open]");
        await dialog.waitFor();
        assert.equal(
          await dialog.locator("img").evaluate((image) => getComputedStyle(image).objectFit),
          "contain",
        );
        await page.keyboard.press("Escape");
        assert(
          await button.evaluate((button) => document.activeElement === button),
          "lightbox did not return focus",
        );
      }
    } else {
      await page.locator('[data-kit="record-summary"]').first().waitFor();
      await page.locator('[data-kit="inline-rows"]').first().waitFor();
    }
    assert.equal(domain(), baseline, "Visual rendering changed fixture domain rows");
    assert.deepEqual(errors, [], "Unexpected browser runtime errors");
    await page.screenshot({
      path: join(output, `${String(index + 1).padStart(2, "0")}-${row.composition}.png`),
      fullPage: true,
      animations: "disabled",
    });
    results.push({ row, geometry, status: "passed" });
    writeFileSync(
      join(output, "matrix.json"),
      JSON.stringify(
        {
          dimensions: VISUAL_DIMENSIONS,
          zoom: "viewport/DPR emulation",
          results,
          complete: results.length === cases.length && !process.env.VISUAL_FROM,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `  ✓ visual case ${index + 1}/${cases.length}: ${row.composition}, ${row.viewport}, ${row.zoom}% emulated zoom, ${row.copy}, ${row.media}`,
    );
    await context.close();
    context = undefined;
    await stop();
    stop = undefined;
  }
  if (!process.env.VISUAL_LIMIT) {
    sources({ ...risk, oneMode: true, surface: "glass" }, 0);
    stop = await serve();
    seed(long);
    const states = await checkVisualStates({
      browser,
      base,
      output,
      fixed,
      baseline: domain(),
      domain,
    });
    writeFileSync(join(output, "mandatory-states.json"), JSON.stringify(states, null, 2) + "\n");
    console.log(
      "  ✓ mandatory empty/validation/header+savebar/one-mode/duotone/dialog/denied states",
    );
    await stop();
    stop = undefined;
    checkVisualHistory(dir);
  }
  passed =
    !process.env.VISUAL_STATES_ONLY && !process.env.VISUAL_FROM && selected.length === cases.length;
  console.log(
    `Visual fixture ${passed ? "complete" : "focused subset only"}: ${dir}; evidence ${output}`,
  );
} catch (error) {
  if (context?.pages()[0])
    await context
      .pages()[0]
      .screenshot({ path: join(output, "failure.png"), fullPage: true })
      .catch(() => {});
  console.error(`Visual fixture retained: ${dir}; evidence ${output}`);
  throw error;
} finally {
  await context?.close();
  await stop?.();
  await browser.close();
}
if (passed && owned && !process.env.KEEP_VISUAL_APP)
  rmSync(dirname(dir), { recursive: true, force: true });
