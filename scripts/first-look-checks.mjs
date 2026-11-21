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

/**
 * The first picker and the Look panel change the real app; Cancel undoes their own changes and
 * refuses to undo an intervening writer's work.
 */
export async function checkFirstLook(browser, base) {
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
  try {
    await page.goto(base);
    await picker.waitFor();
    await picker.getByText("Hi, I’m Smith. Let’s give your app a look.", { exact: true }).waitFor();
    await picker.getByRole("heading", { name: "Which look feels right?", exact: true }).waitFor();
    assert.equal(await page.getByRole("dialog", { name: /^Smith presents / }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Pictures", exact: true }).count(), 0);
    const current = await picker.getByRole("button", { pressed: true }).getAttribute("aria-label");
    // Filter buttons themselves (rather than descendants).
    const alternative = picker.locator('button[aria-pressed="false"]').first();
    const alternativeName = await alternative.getAttribute("aria-label");
    await waitChoice(alternative);
    await picker.getByRole("button", { name: "Keep this look", exact: true }).click();
    await picker.waitFor({ state: "detached" });
    const kept = await project();
    await page.getByRole("dialog", { name: /^Smith presents / }).waitFor();
    // Look in the toolbar opens the panel beside the preview, independent of the presentation.
    await page.goto(`${base}/?guide=off`);
    const look = page.getByRole("button", { name: "Look", exact: true });
    await look.click();
    assert.equal(await look.getAttribute("aria-pressed"), "true");
    await panel.getByRole("button", { name: alternativeName, pressed: true }).waitFor();
    const opened = await panel.boundingBox();
    const preview = await page.locator("[data-window='preview']").boundingBox();
    assert.ok(
      opened &&
        preview &&
        (preview.x >= opened.x + opened.width - 1 || preview.x + preview.width <= opened.x + 1),
      "the Look panel covers the preview",
    );
    await waitChoice(panel.getByRole("button", { name: current, exact: true }), ".look-panel");
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
    await waitChoice(panel.getByRole("button", { name: current, exact: true }), ".look-panel");
    const chosen = await project();
    await panel.getByRole("button", { name: "Close Look", exact: true }).click();
    await panel.waitFor({ state: "detached" });
    assert.equal((await project()).files.ux, chosen.files.ux, "Close did not keep the change");
    await look.click();
    await waitChoice(
      panel.getByRole("button", { name: alternativeName, exact: true }),
      ".look-panel",
    );
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
    await page.goto(`${base}/?guide=off`);
    await page.setViewportSize({ width: 390, height: 844 });
    await (await toolbarAction(page, "Look")).click();
    const box = await panel.boundingBox();
    assert.ok(box && box.y > 250 && box.height < 550, "phone Look is not a lower sheet");
    await panel.getByRole("button", { name: "Customise", exact: true }).click();
    await page.getByRole("dialog", { name: "Look", exact: true }).waitFor();
    assert.equal(await page.getByRole("dialog", { name: /^Smith presents / }).count(), 0);
    console.log(
      "  ✓ first look and Look panel: keep before presentation, Cancel exact own changes, Close keeps, refuse intervening change, phone sheet, Customise",
    );
  } finally {
    await context.close();
  }
}
