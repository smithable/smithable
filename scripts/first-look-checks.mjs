import assert from "node:assert/strict";
import { toolbarAction } from "./studio-form-checks.mjs";

export function stubPictureCatalogue(context) {
  // This check exercises the theme-only/offline path; picture sets have their own real-library fixture.
  return context.route("**/api/picture-styles?*", (route) =>
    route.fulfill({
      json: { project: new URL(route.request().url()).searchParams.get("project"), styles: [] },
    }),
  );
}

/** The operations a page sends, by name. */
function operations(page) {
  const sent = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/op" && request.method() === "POST")
      sent.push(JSON.parse(request.postData() ?? "{}").name);
  });
  return sent;
}

/**
 * The app as made, whatever ran on it before (T1163): Studio reads it from the project, so the
 * picker opens as for a new app. For checks on a project that earlier checks have changed.
 */
export async function asNewApp(target) {
  await target.route("**/api/project", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), asMade: true } });
  });
}

/**
 * While the picker is open only the preview and the picker show; closing brings back the rest.
 * A theme card is only tried on in the preview (T1164): no operation, and Cancel takes it off.
 */
async function checkPickerAlone(browser, base) {
  // Docked Smith, and No code as a third window.
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await stubPictureCatalogue(context);
  await asNewApp(context);
  await context.addInitScript(() =>
    localStorage.setItem(
      "smithable:windows",
      JSON.stringify({ layout: "three", slots: ["smith", "preview", "manual"], manual: "nocode" }),
    ),
  );
  const page = await context.newPage();
  const windows = () =>
    page.locator("[data-window]:visible").evaluateAll((all) => all.map((w) => w.dataset.window));
  try {
    await page.goto(base);
    const picker = page.getByRole("dialog", { name: "Choose a look", exact: true });
    await picker.waitFor();
    // The preview is its own box, not a [data-window]: beside the picker it is all that shows.
    await page.locator("[data-guide-view]").waitFor();
    assert.deepEqual(await windows(), [], "windows beside the open picker");
    const sent = operations(page);
    const tried = page.frameLocator('iframe[title="App preview"]').locator("#sm-theme");
    // By its name: a locator on aria-pressed="false" would move to another card after the click.
    const name = await picker
      .locator('button[aria-pressed="false"]')
      .first()
      .getAttribute("aria-label");
    assert.ok(name, "a theme card needs an accessible name");
    const other = picker.getByRole("button", { name, exact: true });
    await other.click();
    assert.equal(await other.getAttribute("aria-pressed"), "true", "the card shows chosen at once");
    await tried.waitFor({ state: "attached" });
    await page.keyboard.press("Escape");
    await picker.waitFor({ state: "detached" });
    await tried.waitFor({ state: "detached" });
    assert.deepEqual(sent, [], "a tried or cancelled theme wrote something");
    await page.locator("[data-window='manual']").waitFor();
    assert.deepEqual((await windows()).sort(), ["manual", "smith"], "windows after the picker");
  } finally {
    await context.close();
  }
}

export async function checkFirstLook(browser, base) {
  await checkPickerAlone(browser, base);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await stubPictureCatalogue(context);
  const project = () =>
    page.evaluate(() => fetch("/api/project").then((response) => response.json()));
  const write = (name, args) =>
    page.evaluate(
      async ({ name, args }) => {
        const response = await fetch("/api/op", {
          method: "POST",
          headers: { "content-type": "application/json", "x-smithable": "1" },
          body: JSON.stringify({ name, args }),
        });
        return response.json();
      },
      { name, args },
    );
  const picker = page.getByRole("dialog", { name: "Choose a look", exact: true });
  const panel = page.getByRole("complementary", { name: "Look", exact: true });
  const waitChoice = async (button, settled = ".first-look") => {
    const response = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/op" && response.request().method() === "POST",
    );
    await button.click();
    const result = await (await response).json();
    assert.ok(result.ok, result.output);
    assert.match(result.change, /^[a-f0-9]{40}$/);
    assert.match(result.revision, /^[a-f0-9]{64}$/);
    await button.waitFor();
    await page.waitForFunction(
      (settled) => document.querySelector(`${settled}[aria-busy="false"]`),
      settled,
    );
    return result;
  };
  const tried = page.frameLocator('iframe[title="App preview"]').locator("#sm-theme");
  // A Look card only tries its theme on in the preview; Apply makes the one setTheme.
  const applyCard = async (name) => {
    const before = (await project()).files.ux;
    await panel.getByRole("button", { name, exact: true }).click();
    await panel.getByRole("button", { name, pressed: true }).waitFor();
    await tried.waitFor({ state: "attached" });
    assert.equal((await project()).files.ux, before, "a tried Look card wrote something");
    // The tried card says so; "In use" stays with the app's theme until Apply.
    await panel.getByText("· Trying on", { exact: true }).waitFor();
    assert.equal(await panel.getByText("· In use", { exact: true }).count(), 1);
    // Its Apply comes up in the panel's foot, right of Customize (T1195), on a phone's sheet too.
    const apply = panel.getByRole("button", { name: "Apply", exact: true });
    const [applyAt, customizeAt] = await Promise.all([
      apply.boundingBox(),
      panel.getByRole("button", { name: "Customize", exact: true }).boundingBox(),
    ]);
    assert.ok(
      applyAt && customizeAt && applyAt.x > customizeAt.x && applyAt.y >= customizeAt.y - 1,
      "Apply is not right of Customize in the panel's foot",
    );
    return waitChoice(apply, ".look-panel");
  };
  try {
    await page.goto(base);
    if (!(await project()).asMade) {
      // An app changed since it was made opens without the picker (T1163); as made, it opens.
      await page.getByRole("button", { name: "Look", exact: true }).waitFor();
      await page.waitForTimeout(1000);
      assert.equal(await picker.count(), 0, "the picker opened on a changed app");
      await asNewApp(context);
      await page.goto(base);
    }
    await picker.waitFor();
    await picker.getByText("Hi, I’m Smith. Let’s give your app a look.", { exact: true }).waitFor();
    await picker.getByRole("heading", { name: "Which look feels right?", exact: true }).waitFor();
    assert.equal(await page.getByRole("dialog", { name: /^Smith presents / }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Pictures", exact: true }).count(), 0);
    const current = await picker.getByRole("button", { pressed: true }).getAttribute("aria-label");
    // Filter buttons themselves (rather than descendants).
    const alternative = picker.locator('button[aria-pressed="false"]').first();
    const alternativeName = await alternative.getAttribute("aria-label");
    // Trying two themes on writes nothing; Keep makes the one change.
    const sent = operations(page);
    await picker.locator('button[aria-pressed="false"]').last().click();
    await alternative.click();
    await picker.getByRole("button", { name: alternativeName, pressed: true }).waitFor();
    assert.deepEqual(sent, [], "a tried theme wrote something");
    await picker.getByRole("button", { name: "Keep this look", exact: true }).click();
    await picker.waitFor({ state: "detached" });
    assert.deepEqual(sent, ["setTheme"], "Keep made other changes than one setTheme");
    const kept = await project();
    await page.getByRole("dialog", { name: /^Smith presents / }).waitFor();
    // Look in the toolbar opens the panel beside the preview, independent of the presentation.
    await page.goto(`${base}/?guide=off`);
    const look = page.getByRole("button", { name: "Look", exact: true });
    await look.click();
    assert.equal(await look.getAttribute("aria-pressed"), "true");
    await panel.getByRole("button", { name: alternativeName, pressed: true }).waitFor();
    // The theme in use leads the list; the rest are a scroll away, and the list says so.
    const cards = panel.getByRole("list", { name: "Themes", exact: true }).getByRole("button");
    assert.equal(await cards.first().getAttribute("aria-label"), alternativeName);
    assert.ok((await cards.count()) > 8, "Look lists only a few themes");
    await panel.locator("[data-more-themes]").waitFor();
    const opened = await panel.boundingBox();
    const preview = await page.locator("[data-guide-view]").boundingBox();
    assert.ok(
      opened &&
        preview &&
        (preview.x >= opened.x + opened.width - 1 || preview.x + preview.width <= opened.x + 1),
      "the Look panel covers the preview",
    );
    await applyCard(current);
    await panel.getByLabel("Density", { exact: true }).selectOption("compact");
    await page.waitForFunction(() => document.querySelector('.look-panel[aria-busy="false"]'));
    assert.match((await project()).files.ux, /density: compact/);
    // Cancel undoes both, newest first, back to the exact opening bytes.
    await panel.getByRole("button", { name: "Cancel", exact: true }).click();
    await panel.waitFor({ state: "detached" });
    assert.equal(
      (await project()).files.ux,
      kept.files.ux,
      "Cancel did not restore the opening bytes",
    );
    // The X closes and keeps.
    await look.click();
    await applyCard(current);
    const chosen = await project();
    await panel.getByRole("button", { name: "Close Look", exact: true }).click();
    await panel.waitFor({ state: "detached" });
    assert.equal((await project()).files.ux, chosen.files.ux, "Close did not keep the change");
    // A theme only tried on is applied by Close, one setTheme (one Undo away), and comes off.
    await look.click();
    await panel.getByRole("button", { name: alternativeName, exact: true }).click();
    await tried.waitFor({ state: "attached" });
    const closing = operations(page);
    await panel.getByRole("button", { name: "Close Look", exact: true }).click();
    await panel.waitFor({ state: "detached" });
    await tried.waitFor({ state: "detached" });
    assert.deepEqual(closing, ["setTheme"], "Close made other changes than one setTheme");
    const closedWith = await project();
    assert.notEqual(closedWith.files.ux, chosen.files.ux, "Close did not apply the tried theme");
    // Cancel takes a theme only tried on off, and writes nothing.
    await look.click();
    await panel.getByRole("button", { name: current, exact: true }).click();
    await tried.waitFor({ state: "attached" });
    await panel.getByRole("button", { name: "Cancel", exact: true }).click();
    await panel.waitFor({ state: "detached" });
    await tried.waitFor({ state: "detached" });
    assert.equal((await project()).files.ux, closedWith.files.ux, "Cancel kept a tried theme");
    await look.click();
    await applyCard(current);
    // A second writer's operation runs through the daemon, as another browser or CLI would.
    const other = await write("setTheme", { density: "compact" });
    assert.ok(other.ok, other.output);
    const external = await project();
    await panel.getByRole("button", { name: "Cancel", exact: true }).click();
    await panel.waitFor({ state: "detached" });
    assert.equal(
      (await project()).files.ux,
      external.files.ux,
      "Cancel changed the intervening writer's bytes",
    );
    await page.getByText(/Cancel could not restore the opening look/).waitFor();
    await page.goto(base);
    await page.getByRole("button", { name: "Look", exact: true }).waitFor();
    assert.equal(await picker.count(), 0, "seen picker returned after reload");
    assert.equal(
      await page.getByRole("complementary", { name: "Smith", exact: true }).isVisible(),
      false,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/?guide=off`);
    await (await toolbarAction(page, "Look")).click();
    const sheet = page.locator('[data-look-panel="sheet"]');
    await sheet.waitFor();
    const box = await sheet.boundingBox();
    assert.ok(box && box.y > 250 && box.height < 550, "phone Look is not a lower sheet");
    // Customize starts the lab from the tried theme; Cancel there undoes Look's changes too.
    const beforeCustomize = await project();
    await panel.getByLabel("Density", { exact: true }).selectOption("comfortable");
    await page.waitForFunction(() => document.querySelector('.look-panel[aria-busy="false"]'));
    assert.notEqual((await project()).files.ux, beforeCustomize.files.ux);
    await panel
      .getByRole("list", { name: "Themes", exact: true })
      .locator('button[aria-pressed="false"]')
      .first()
      .click();
    await tried.waitFor({ state: "attached" });
    await panel.getByRole("button", { name: "Apply", exact: true }).waitFor();
    await panel.getByRole("button", { name: "Customize", exact: true }).click();
    const lab = page.getByRole("dialog", { name: "Look", exact: true });
    await lab.getByRole("tab", { name: "Customize", exact: true, selected: true }).waitFor();
    assert.equal(await page.getByRole("dialog", { name: /^Smith presents / }).count(), 0);
    await lab.getByRole("button", { name: "Cancel", exact: true }).click();
    await lab.waitFor({ state: "detached" });
    assert.equal(
      (await project()).files.ux,
      beforeCustomize.files.ux,
      "the lab's Cancel did not undo Look's changes",
    );
    console.log(
      "  ✓ first look and Look panel: a tried theme writes nothing (picker and Look cards), Apply at the foot one setTheme, in-use first and more by scrolling, Close applies a tried one, Cancel takes it off, Keep one setTheme before presentation, Cancel exact own changes, Close keeps, refuse intervening change, phone sheet, Customize from the tried theme and its Cancel undoes all",
    );
  } finally {
    await context.close();
  }
}
