import assert from "node:assert/strict";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { projectRevision } from "../packages/cli/dist/project-revision.js";
import { P } from "./patience.mjs";

export async function checkStudioLook(page, dir) {
  const baseline = projectRevision(dir);
  const db = new DatabaseSync(join(dir, "data/db/app.db"), { readOnly: true });
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map((r) => r.name);
  const rows = () =>
    JSON.stringify(
      tables.map((name) => [
        name,
        db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all(),
      ]),
    );
  const before = rows();
  let writes = 0;
  const requested = (request) => {
    if (new URL(request.url()).pathname === "/api/op" && request.method() === "POST") writes++;
  };
  page.on("request", requested);
  const launch = page.getByRole("button", { name: "Edit look", exact: true });
  try {
    const savedPath = await page.getByLabel("Preview address", { exact: true }).inputValue();
    await launch.click();
    const dialog = page.getByRole("dialog", { name: "Edit look", exact: true });
    await dialog.getByLabel("radius", { exact: true }).waitFor();
    await page.waitForFunction(
      () => !document.querySelector('dialog[aria-label="Edit look"] header')?.inert,
    );
    const context = await page.evaluate(
      (path) => fetch(`/api/look?path=${encodeURIComponent(path)}`).then((r) => r.json()),
      savedPath,
    );
    assert(
      context.open,
      `No selected page for ${JSON.stringify(savedPath)}: ${JSON.stringify(context)}`,
    );
    const selected = dialog
      .getByRole("group", { name: "Page", exact: true })
      .getByRole("button", { pressed: true });
    assert.equal(
      await selected.innerText(),
      context.frames.find((f) => f.id === context.open).label,
    );
    const iframe = dialog.locator("iframe[data-frame]").first();
    await iframe.waitFor({ timeout: 90000 * P });
    assert.equal(new URL(await iframe.getAttribute("src")).origin, new URL(context.preview).origin);
    const frame = await (await iframe.elementHandle()).contentFrame();
    await frame.waitForSelector("body[data-hydrated=true]", { timeout: 90000 * P });
    await dialog.getByLabel("radius", { exact: true }).fill("21px");
    await frame.waitForFunction(() =>
      document.getElementById("sm-theme")?.textContent.includes("--radius: 21px"),
    );
    const css = await frame.locator("#sm-theme").textContent();
    await dialog.locator("textarea").fill("smithableTheme: [");
    await dialog.getByText("Not applied yet:", { exact: false }).waitFor();
    assert.equal(
      await frame.locator("#sm-theme").textContent(),
      css,
      "invalid source replaced the last valid preview",
    );
    await dialog.getByRole("button", { name: "Undo draft", exact: true }).click();
    assert.match(await dialog.locator("textarea").inputValue(), /radius: 21px/);
    const draft = await dialog.locator("textarea").inputValue();
    await frame.locator("body").click({ position: { x: 3, y: 3 } });
    await frame.locator("body").press("Control+z");
    await page.waitForFunction(
      (draft) => document.querySelector('dialog[aria-label="Edit look"] textarea')?.value !== draft,
      draft,
    );
    await frame.locator("body").press("Control+Shift+z");
    await page.waitForFunction(
      (draft) => document.querySelector('dialog[aria-label="Edit look"] textarea')?.value === draft,
      draft,
    );
    assert.equal(projectRevision(dir), baseline, "open/edit wrote project source");
    assert.equal(rows(), before, "open/edit wrote the database");
    assert.equal(writes, 0, "draft editing called the mutation endpoint");
    page.once("dialog", (question) => question.dismiss());
    await dialog.getByRole("button", { name: "Close look editor", exact: true }).click();
    assert(await dialog.isVisible(), "dismissed discard confirmation lost the draft");
    page.once("dialog", (question) => question.accept());
    await dialog.getByRole("button", { name: "Close look editor", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    await launch.evaluate((button) => {
      if (document.activeElement !== button) throw new Error("Focus did not return to Edit look");
    });
    assert.equal(projectRevision(dir), baseline, "discard wrote project source");
    assert.equal(rows(), before, "discard wrote the database");
    assert.equal(
      await page.frameLocator('iframe[title="App preview"]').locator("#sm-theme").count(),
      0,
      "draft style leaked into the main preview",
    );
    console.log(
      "  ✓ Studio opens the current look in its existing preview; draft/invalid source/Undo/discard write nothing and return focus",
    );
  } finally {
    page.off("request", requested);
    db.close();
  }
}

export async function checkStudioLookApply(page, dir) {
  await page.getByRole("button", { name: "Edit look", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit look", exact: true });
  const ready = () =>
    dialog
      .getByRole("status")
      .filter({ hasText: "Draft preview ready" })
      .waitFor({ timeout: 45000 * P });
  await ready();
  await dialog
    .getByLabel("Name", { exact: true })
    .fill(`studio-browser-${crypto.randomUUID().slice(0, 8)}`);
  for (const value of ["13px", "18px", "23px"])
    await dialog.getByLabel("radius", { exact: true }).fill(value);
  await ready();
  const iframe = dialog.locator("iframe[data-frame]").first();
  let frame = await (await iframe.elementHandle()).contentFrame();
  await frame.waitForFunction(
    () => getComputedStyle(document.body).getPropertyValue("--radius").trim() === "23px",
  );
  const values = () => {
    const css = document.getElementById("sm-theme")?.textContent ?? "";
    const keys = [...new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))];
    const style = getComputedStyle(document.querySelector("[data-page]") ?? document.body);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    return Object.fromEntries(
      keys.map((key) => {
        const value = style.getPropertyValue(key).trim().replace(/\s+/g, " ");
        if (!CSS.supports("color", value)) return [key, value];
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = value;
        ctx.fillRect(0, 0, 1, 1);
        return [key, [...ctx.getImageData(0, 0, 1, 1).data]];
      }),
    );
  };
  const before = await frame.evaluate(values);
  await dialog.getByRole("button", { name: "Reconnect preview", exact: true }).click();
  await ready();
  frame = await (await iframe.elementHandle()).contentFrame();
  assert.deepEqual(await frame.evaluate(values), before, "reconnect lost the latest draft");
  const revision = projectRevision(dir);
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/op" && r.request().postDataJSON()?.name === "applyTheme",
  );
  await dialog.getByRole("button", { name: "Apply look", exact: true }).click();
  const result = await (await response).json();
  assert(result.ok, result.output);
  await dialog
    .getByRole("status")
    .filter({ hasText: /^Applied:/ })
    .waitFor({ timeout: 45000 * P });
  assert.notEqual(projectRevision(dir), revision);
  frame = await (await iframe.elementHandle()).contentFrame();
  assert.equal(
    await frame.locator("#sm-theme").count(),
    0,
    "Apply kept transient styling instead of matching the saved generation",
  );
  const saved = await frame.evaluate((keys) => {
    const style = getComputedStyle(document.querySelector("[data-page]") ?? document.body);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    return Object.fromEntries(
      keys.map((key) => {
        const value = style.getPropertyValue(key).trim().replace(/\s+/g, " ");
        if (!CSS.supports("color", value)) return [key, value];
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = value;
        ctx.fillRect(0, 0, 1, 1);
        return [key, [...ctx.getImageData(0, 0, 1, 1).data]];
      }),
    );
  }, Object.keys(before));
  assert.deepEqual(saved, before, "saved generation differs from final draft");
  await dialog.getByRole("button", { name: "Close look editor", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  console.log(
    "  ✓ Studio rapid edits/reconnect retain the latest draft; Apply waits for matching compiled CSS, removes transient style and preserves every rendered value",
  );
}

export async function checkStudioViewer(page, dir) {
  const revision = projectRevision(dir);
  const db = new DatabaseSync(join(dir, "data/db/app.db"), { readOnly: true });
  const domain = () =>
    JSON.stringify(
      ["customers", "orders", "follow_ups"].map((name) => [
        name,
        db.prepare(`SELECT * FROM ${name} ORDER BY id`).all(),
      ]),
    );
  const before = domain();
  await page.getByRole("button", { name: "Edit look", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit look", exact: true });
  const pages = dialog.getByRole("group", { name: "Page", exact: true });
  const openSignIn = async () => {
    await pages.getByRole("button", { name: "Sign in / viewer", exact: true }).click();
    const frame = await (
      await dialog.locator("iframe[data-frame]").first().elementHandle()
    ).contentFrame();
    await frame.locator('body[data-hydrated="true"]').waitFor({ timeout: 45000 * P });
    await frame.locator('[data-dev-role="sales"]').waitFor({ timeout: 45000 * P });
    return frame;
  };
  try {
    let frame = await openSignIn();
    await frame.locator('[data-dev-role="sales"]').click();
    await page.waitForFunction(
      () =>
        !document
          .querySelector('dialog[aria-label="Edit look"] iframe[data-frame]')
          ?.src.includes("/sign-in"),
    );
    await pages.getByRole("button", { name: "Team", exact: true }).click();
    frame = await (
      await dialog.locator("iframe[data-frame]").first().elementHandle()
    ).contentFrame();
    await frame.locator('[data-kit="denied"]').waitFor({ timeout: 45000 * P });
    await dialog
      .getByRole("status")
      .filter({ hasText: "unavailable to the current viewer" })
      .waitFor();
    assert.equal(projectRevision(dir), revision);
    assert.equal(domain(), before, "choosing a preview viewer populated domain records");
    frame = await openSignIn();
    await frame.locator('[data-dev-role="admin"]').click();
    await page.waitForFunction(
      () =>
        !document
          .querySelector('dialog[aria-label="Edit look"] iframe[data-frame]')
          ?.src.includes("/sign-in"),
    );
    await dialog.getByRole("button", { name: "Close look editor", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    console.log(
      "  ✓ explicit native viewer choice respects sales denial on Team, never changes source or domain records, and restores admin only after an explicit choice",
    );
  } finally {
    db.close();
  }
}

export async function checkStudioLookTimeout(page, dir) {
  const baseline = projectRevision(dir);
  let releaseSource = () => {};
  let heldSource = false;
  const sourceGate = new Promise((resolve) => (releaseSource = resolve));
  const block = async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname === "/api/look" && !heldSource) {
      heldSource = true;
      await sourceGate;
      return route.continue();
    }
    if (request.isNavigationRequest() && url.searchParams.has("__sm_look"))
      return route.fulfill({
        status: 200,
        contentType: "text/html",
        body: '<!doctype html><html><body data-hydrated="true">Controlled fixture: preview runtime unavailable</body></html>',
      });
    return route.continue();
  };
  await page.route("**/*", block);
  const dialog = page.getByRole("dialog", { name: "Edit look", exact: true });
  try {
    const loading = page.waitForRequest(
      (request) => new URL(request.url()).pathname === "/api/look",
    );
    await page.getByRole("button", { name: "Edit look", exact: true }).click();
    await loading;
    await dialog.locator("textarea").waitFor();
    assert(
      await dialog.locator("textarea").isDisabled(),
      "source was editable before the saved context loaded",
    );
    releaseSource();
    await page.waitForFunction(
      () => !document.querySelector('dialog[aria-label="Edit look"] header')?.inert,
    );
    await dialog.getByLabel("radius", { exact: true }).fill("17px");
    await page.waitForFunction(() =>
      document
        .querySelector('dialog[aria-label="Edit look"] textarea')
        ?.value.includes("radius: 17px"),
    );
    const draft = await dialog.locator("textarea").inputValue();
    await dialog
      .getByRole("status")
      .filter({ hasText: "The preview did not connect" })
      .waitFor({ timeout: 30000 * P });
    assert.equal(
      await dialog.locator("textarea").inputValue(),
      draft,
      "connection deadline discarded the draft",
    );
    assert.equal(projectRevision(dir), baseline, "connection deadline wrote source");
    await page.unroute("**/*", block);
    await dialog.getByRole("button", { name: "Reconnect preview", exact: true }).click();
    await dialog
      .getByRole("status")
      .filter({ hasText: "Draft preview ready" })
      .waitFor({ timeout: 45000 * P });
    const frame = await (
      await dialog.locator("iframe[data-frame]").first().elementHandle()
    ).contentFrame();
    await frame.waitForFunction(() =>
      document.getElementById("sm-theme")?.textContent.includes("--radius: 17px"),
    );
    assert.equal(
      await dialog.locator("textarea").inputValue(),
      draft,
      "reconnect lost the pending draft",
    );
    page.once("dialog", (question) => question.accept());
    await dialog.getByRole("button", { name: "Close look editor", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(projectRevision(dir), baseline);
    console.log(
      "  ✓ a Studio frame with no runtime reaches a connection deadline, keeps its draft and recovers only after explicit reconnect",
    );
  } finally {
    releaseSource();
    await page.unroute("**/*", block);
  }
}

export async function checkStudioLookGallery(page, dir) {
  const baseline = projectRevision(dir);
  const db = new DatabaseSync(join(dir, "data/db/app.db"), { readOnly: true });
  const rows = () =>
    JSON.stringify(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .all()
        .map(({ name }) => [
          name,
          db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all(),
        ]),
    );
  const before = rows();
  let writes = 0;
  const requested = (request) => {
    if (
      request.method() === "POST" &&
      ["/api/op", "/api/apply"].includes(new URL(request.url()).pathname)
    )
      writes++;
  };
  page.on("request", requested);
  try {
    const cold = Date.now();
    await page.getByRole("button", { name: "Edit look", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Edit look", exact: true });
    const textarea = dialog.locator("textarea");
    await page.waitForFunction(
      () => document.querySelector('dialog[aria-label="Edit look"] textarea')?.disabled === false,
    );
    const iframe = dialog.locator("iframe[data-frame]").first();
    await iframe.waitFor();
    const frame = await (await iframe.elementHandle()).contentFrame();
    await frame.waitForSelector("#sm-theme", { state: "attached", timeout: 90000 * P });
    const coldMs = Date.now() - cold;
    await dialog.getByRole("button", { name: "Look gallery", exact: true }).click();
    assert.equal(
      await dialog.locator("iframe[data-frame]").count(),
      1,
      "gallery spawned additional app frames",
    );
    await dialog.getByRole("button", { name: "Choose minimal", exact: true }).click();
    const selected = await textarea.inputValue();
    assert.match(selected, /name: minimal/);
    await dialog.getByRole("button", { name: "Choose corporate", exact: true }).click();
    assert.match(await textarea.inputValue(), /name: corporate/);
    await dialog.getByRole("button", { name: "Undo draft", exact: true }).click();
    assert.equal(
      await textarea.inputValue(),
      selected,
      "gallery skip/Undo lost the prior selection",
    );
    await dialog.getByRole("button", { name: "Choose minimal", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    assert.match(
      await page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
      /^Choose /,
    );
    await page.keyboard.press("Space");
    assert.notEqual(
      await textarea.inputValue(),
      selected,
      "keyboard selection did not change the draft",
    );
    await dialog.getByRole("button", { name: "Undo draft", exact: true }).click();
    assert.equal(await textarea.inputValue(), selected);
    await textarea.fill(
      selected + "\ndefaults:\n  kinds:\n    crud:\n      table: {actions: menu}\n",
    );
    await dialog.getByText("Structural preview unavailable.", { exact: true }).waitFor();
    assert.equal(
      await iframe.evaluate((element) => getComputedStyle(element).visibility),
      "hidden",
      "structural draft was presented as a CSS preview",
    );
    await dialog.getByRole("button", { name: "Undo draft", exact: true }).click();
    await dialog
      .getByText("Structural preview unavailable.", { exact: true })
      .waitFor({ state: "hidden" });
    const steady = Date.now();
    await dialog.getByLabel("radius", { exact: true }).fill("44px");
    await frame.waitForFunction(() =>
      document.getElementById("sm-theme")?.textContent.includes("--radius: 44px"),
    );
    const steadyMs = Date.now() - steady;
    assert.equal(projectRevision(dir), baseline, "gallery wrote source");
    assert.equal(rows(), before, "gallery wrote database rows");
    assert.equal(writes, 0, "gallery invoked project mutation");
    page.once("dialog", (question) => question.accept());
    await dialog.getByRole("button", { name: "Close look editor", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    console.log(
      `  ✓ shared gallery keyboard/skip/Undo, one current-app frame, explicit unavailable structural draft, no writes; cold ${coldMs} ms, steady token ${steadyMs} ms`,
    );
  } finally {
    page.off("request", requested);
    db.close();
  }
}

export async function checkStudioDefaultsApply(page, dir) {
  const baseline = projectRevision(dir, false);
  await page.getByRole("button", { name: "Edit look", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit look", exact: true });
  await dialog
    .getByRole("status")
    .filter({ hasText: "Draft preview ready" })
    .waitFor({ timeout: 45000 * P });
  await dialog
    .getByLabel("Name", { exact: true })
    .fill(`default-browser-${crypto.randomUUID().slice(0, 8)}`);
  const textarea = dialog.locator("textarea");
  await textarea.fill((await textarea.inputValue()) + "\ndefaults:\n  app: {navigation: topbar}\n");
  await dialog.getByText("Structural preview unavailable.", { exact: true }).waitFor();
  assert.equal(projectRevision(dir, false), baseline, "structural draft wrote source before Apply");
  const reply = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/op" &&
      response.request().postDataJSON()?.name === "applyTheme",
  );
  await dialog.getByRole("button", { name: "Apply look", exact: true }).click();
  const applied = await (await reply).json();
  assert(applied.ok, applied.output);
  await dialog
    .getByRole("status")
    .filter({ hasText: /^Applied:/ })
    .waitFor({ timeout: 60000 * P });
  await dialog
    .getByText("Structural preview unavailable.", { exact: true })
    .waitFor({ state: "hidden" });
  const frame = await (
    await dialog.locator("iframe[data-frame]").first().elementHandle()
  ).contentFrame();
  await frame.locator('[data-navigation="topbar"]').waitFor({ timeout: 45000 * P });
  assert.equal(await frame.locator("#sm-theme").count(), 0);
  const committed = projectRevision(dir, false);
  assert.notEqual(committed, baseline);
  await dialog.getByRole("button", { name: "Close look editor", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  await page.getByRole("checkbox", { name: "No code", exact: true }).check({ force: true });
  await page.getByRole("tab", { name: "Look", exact: true }).click();
  const menu = page.getByLabel("Menu layout", { exact: true });
  assert.equal(
    await menu.inputValue(),
    "__inherited",
    "effective theme default was mislabeled as authored UX",
  );
  assert.match(await menu.locator('option[value="__inherited"]').innerText(), /Topbar/);
  await page.getByRole("checkbox", { name: "Preview", exact: true }).check({ force: true });
  const history = async (action, expected) => {
    const response = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/${action.toLowerCase()}` &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: action, exact: true }).click();
    const result = await (await response).json();
    assert(result.ok, result.output);
    assert.equal(
      projectRevision(dir, false),
      expected,
      `${action} did not restore the theme/source together`,
    );
  };
  await history("Undo", baseline);
  await page
    .frameLocator('iframe[title="App preview"]')
    .locator('[data-navigation="sidebar"]')
    .waitFor({ state: "attached", timeout: 45000 * P });
  await history("Redo", committed);
  await page
    .frameLocator('iframe[title="App preview"]')
    .locator('[data-navigation="topbar"]')
    .waitFor({ timeout: 45000 * P });
  await history("Undo", baseline);
  console.log(
    "  ✓ structural defaults are unavailable before Apply; atomic Apply generates actual top navigation, clears transient CSS, and one-step Undo/Redo restores source and markup",
  );
}
