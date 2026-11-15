import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..");
const { chromium } = createRequire(resolve(repo, "package.json"))("playwright");
const root = mkdtempSync(join(tmpdir(), "smithable-look-placement-"));
const dir = join(root, "crm");
const cli = join(repo, "packages/cli/dist/bin.js");
const base = "http://localhost:5800";
const env = { ...process.env, XDG_CONFIG_HOME: join(root, "config") };
for (const key of Object.keys(env))
  if (/^(SMITHABLE_|ANTHROPIC_|OPENAI_|GOOGLE_|GEMINI_|MISTRAL_|AZURE_|AWS_|SMTP_|MAIL_)/.test(key))
    delete env[key];
let server,
  browser,
  page,
  log = "";
async function stopServer() {
  if (!server?.pid) return;
  const gone = new Promise((resolve) => server.once("exit", resolve));
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
  if (server.exitCode === null)
    await Promise.race([gone, new Promise((resolve) => setTimeout(resolve, 5000))]);
  try {
    process.kill(-server.pid, "SIGKILL");
  } catch {}
}
async function startServer() {
  server = spawn(process.execPath, [cli, "studio", dir, "--port", "5800"], {
    cwd: repo,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (data) => {
      log = (log + data).slice(-12000);
    });
  const until = Date.now() + 120000;
  while (Date.now() < until) {
    try {
      const response = await fetch(`${base}/api/project`, { signal: AbortSignal.timeout(1000) });
      const project = response.ok ? await response.json() : undefined;
      if (response.ok && (await (await fetch(`${base}/api/preview/answers`)).json()).ok)
        return project;
    } catch {}
    if (server.exitCode !== null) throw new Error(log);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Studio startup timeout: ${log}`);
}
try {
  execFileSync(
    process.execPath,
    [cli, "new", dir, "--starter", "crm", "--admin", "studio-test@example.invalid"],
    { cwd: repo, env, stdio: "pipe", timeout: 120000 },
  );
  const project = await startServer();
  const candidate = project.themes.find((theme) => theme.name !== "modern").name;
  for (const operation of [
    { name: "addLandingPage", args: { page: "welcome", route: "/welcome" } },
    { name: "addLandingPage", args: { page: "offer", route: "/offer" } },
    { name: "setTheme", args: { page: "welcome", preset: "modern" } },
    { name: "setTheme", args: { page: "offer", preset: candidate } },
    { name: "setTheme", args: { density: "compact" } },
  ]) {
    const result = await (
      await fetch(`${base}/api/op`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-smithable": "1" },
        body: JSON.stringify(operation),
      })
    ).json();
    assert.ok(result.ok, result.output);
  }
  const { parse } = createRequire(resolve(repo, "packages/core/package.json"))("yaml");
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => console.error("Page error:", String(error)));
  await page.addInitScript((name) => {
    for (const key of ["guideDone", "presented", "zoneAsked", "ownerAsked"])
      localStorage.setItem(`${key}:${name}`, "1");
    localStorage.setItem(
      "smithable:windows",
      JSON.stringify({
        layout: "three",
        slots: ["manual", "preview", "smith+changes"],
        manual: "nocode",
      }),
    );
    localStorage.setItem("smithable:smith", "docked");
  }, project.name);
  const operations = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/op") operations.push(request.postDataJSON());
  });
  const current = async () => (await fetch(`${base}/api/project`)).json();
  const changed = async (name, action, ok = true) => {
    const response = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/op" &&
        response.request().postDataJSON()?.name === name,
    );
    await action();
    const value = await (await response).json();
    assert.equal(value.ok, ok, value.output);
    return value;
  };
  const open = (path) =>
    page.evaluate(
      (path) =>
        window.dispatchEvent(
          new CustomEvent("smithable:open-part", { detail: { file: "smithable.yml", path } }),
        ),
      path,
    );
  await page.goto(`${base}?guide=off`);
  const noCode = page.locator("[data-no-code]");
  await noCode.getByRole("tab", { name: "Layout", exact: true }).waitFor();
  assert.equal(await noCode.getByRole("tab", { name: "Look", exact: true }).count(), 0);
  await noCode.getByRole("tab", { name: "Layout", exact: true }).click();
  await noCode.getByLabel("Page to style", { exact: true }).selectOption("customers");
  await noCode.getByRole("button", { name: "Page behavior", exact: true }).click();
  assert.ok(
    (await noCode
      .getByRole("tab", { name: "Behavior", exact: true })
      .getAttribute("aria-selected")) === "true",
  );
  await noCode
    .locator('details[data-path=\'["pages","customers"]\']')
    .getByRole("button", { name: "Page layout", exact: true })
    .click();
  assert.equal(await noCode.getByLabel("Page to style", { exact: true }).inputValue(), "customers");
  console.log("PASS Behavior/Layout cross-links retain the selected page; old Look tab removed");

  await noCode.getByRole("tab", { name: "Content", exact: true }).click();
  const identity = noCode.getByRole("region", { name: "App identity", exact: true });
  assert.equal(await identity.count(), 1);
  await changed("setLogo", () =>
    identity.locator("input[type=file]").setInputFiles({
      name: "mark.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#2563eb"/></svg>',
      ),
    }),
  );
  await identity.locator("img").waitFor();
  await changed("setLanguage", () =>
    noCode.getByLabel("The app's language", { exact: true }).selectOption("sv"),
  );
  await changed("setLanguage", () =>
    noCode.getByLabel("The app's language", { exact: true }).selectOption("en"),
  );
  await open(["models", "Order", "fields", "status"]);
  const field = noCode.locator('details[data-path=\'["models","Order","fields","status"]\']');
  await changed("setTone", () =>
    field.getByLabel("Color of Draft", { exact: true }).selectOption("warning"),
  );
  assert.equal(operations.at(-1).args.model, "Order");
  assert.equal(operations.at(-1).args.field, "status");
  console.log(
    "PASS Content owns logo/language; Behavior field owns choice colors through existing operations",
  );

  await page.getByRole("button", { name: "Look", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Look", exact: true });
  await dialog.getByRole("tab", { name: "Theme and settings", exact: true }).waitFor();
  assert.equal(await dialog.getByRole("list", { name: "Themes", exact: true }).count(), 1);
  assert.equal(await dialog.getByRole("button", { name: "Look gallery", exact: true }).count(), 0);
  await dialog.getByLabel("Theme selection target", { exact: true }).selectOption("welcome");
  const motion = dialog.getByRole("group", { name: "Motion", exact: true });
  await changed("setTheme", () =>
    motion.getByRole("button", { name: "None", exact: true }).click(),
  );
  assert.equal(
    operations.at(-1).args.page,
    undefined,
    "app-wide motion retargeted to the selected page",
  );
  await changed("resetThemeOverride", () =>
    motion.getByRole("button", { name: "Use the theme's own", exact: true }).click(),
  );
  assert.equal(operations.at(-1).args.page, undefined);
  assert.equal(operations.at(-1).args.key, "motion");
  const ux = parse((await current()).files.ux);
  assert.equal(ux.theme.motion, undefined);
  assert.equal(ux.theme.density, "compact");
  console.log(
    "PASS app-wide controls retain scope and explicit inheritance reset under page theme selection",
  );

  const beforeDraft = operations.length;
  await dialog.getByRole("button", { name: "Customise Modern", exact: true }).click();
  const ready = () =>
    dialog
      .getByRole("status")
      .filter({ hasText: /Draft preview ready|Saved preview ready/ })
      .waitFor({ timeout: 45000 });
  await ready();
  assert.equal(await dialog.getByLabel("Apply theme to", { exact: true }).inputValue(), "welcome");
  assert.equal(await dialog.getByRole("button", { name: "Look gallery", exact: true }).count(), 0);
  await dialog.getByLabel("Name", { exact: true }).fill("pinned-draft");
  await dialog.getByLabel("radius", { exact: true }).fill("21px");
  await dialog.getByLabel("Name", { exact: true }).press("Tab");
  await dialog.getByRole("tab", { name: "Theme and settings", exact: true }).click();
  await dialog.getByLabel("Theme selection target", { exact: true }).selectOption("offer");
  assert.equal(operations.length, beforeDraft, "drafting or changing a view wrote an operation");
  await changed("setTheme", () =>
    dialog.getByRole("button", { name: "Use Modern theme", exact: true }).click(),
  );
  assert.equal(operations.at(-1).args.page, "offer");
  await dialog.getByRole("tab", { name: "Customise", exact: true }).click();
  assert.equal(await dialog.getByLabel("Name", { exact: true }).inputValue(), "pinned-draft");
  assert.equal(await dialog.getByLabel("radius", { exact: true }).inputValue(), "21px");
  assert.equal(
    await dialog.getByLabel("Apply theme to", { exact: true }).inputValue(),
    "welcome",
    "live selection silently retargeted a draft",
  );
  const refused = await changed(
    "applyTheme",
    () => dialog.getByRole("button", { name: "Apply look", exact: true }).click(),
    false,
  );
  assert.match(refused.output, /project source changed/i);
  assert.equal(await dialog.getByLabel("Name", { exact: true }).inputValue(), "pinned-draft");
  await dialog
    .getByRole("button", { name: "Discard draft and open this page’s saved look", exact: true })
    .click();
  await ready();
  await dialog.getByLabel("Name", { exact: true }).fill("pinned-draft");
  await dialog.getByLabel("radius", { exact: true }).fill("21px");
  await dialog.getByLabel("Name", { exact: true }).press("Tab");
  await changed("applyTheme", () =>
    dialog.getByRole("button", { name: "Apply look", exact: true }).click(),
  );
  await ready();
  const written = parse((await current()).files.ux);
  assert.equal(written.pages.welcome.theme.preset, "pinned-draft");
  assert.equal(written.pages.offer.theme.preset, "modern");
  assert.equal(written.theme.density, "compact", "Apply discarded an existing app override");
  await dialog.getByRole("tab", { name: "Theme and settings", exact: true }).click();
  assert.equal(
    await dialog.getByLabel("Theme selection target", { exact: true }).inputValue(),
    "offer",
  );
  await page.screenshot({ path: join(root, "look-placement.png"), fullPage: true });
  console.log(
    "PASS single gallery, draft/tab retention, independent pinned Apply target, stale-source refusal and explicit successful Apply",
  );
} catch (error) {
  if (page)
    await page
      .screenshot({ path: join(root, "reproduction-failure.png"), fullPage: true })
      .catch(() => {});
  console.error(root, log);
  throw error;
} finally {
  await browser?.close();
  await stopServer();
}
