import assert from "node:assert/strict";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { projectRevision } from "../packages/cli/dist/project-revision.js";

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
    await iframe.waitFor({ timeout: 90000 });
    assert.equal(new URL(await iframe.getAttribute("src")).origin, new URL(context.preview).origin);
    const frame = await (await iframe.elementHandle()).contentFrame();
    await frame.waitForSelector("body[data-hydrated=true]", { timeout: 90000 });
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
      .waitFor({ timeout: 45000 });
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
    .waitFor({ timeout: 45000 });
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
    await frame.locator('body[data-hydrated="true"]').waitFor({ timeout: 45000 });
    await frame.locator('[data-dev-role="sales"]').waitFor({ timeout: 45000 });
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
    await frame.locator('[data-kit="denied"]').waitFor({ timeout: 45000 });
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
      .waitFor({ timeout: 30000 });
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
      .waitFor({ timeout: 45000 });
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
