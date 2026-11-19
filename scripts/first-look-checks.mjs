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

/** The picker changes the real app, and refuses to undo an intervening writer's work. */
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
  const waitChoice = async (button) => {
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
    await page.waitForFunction(() => document.querySelector('.first-look[aria-busy="false"]'));
    return result;
  };
  try {
    await page.goto(base);
    await picker.waitFor();
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
    // Reopening Look is independent of the presentation/guide, including on a fresh reload.
    await page.goto(`${base}/?guide=off`);
    await page.getByRole("button", { name: "Look", exact: true }).click();
    await picker.getByRole("button", { name: alternativeName, pressed: true }).waitFor();
    await waitChoice(picker.getByRole("button", { name: current, exact: true }));
    await picker.getByRole("button", { name: "Skip", exact: true }).click();
    await picker.waitFor({ state: "detached" });
    assert.equal(
      (await project()).files.ux,
      kept.files.ux,
      "Skip did not restore the opening bytes",
    );
    await page.getByRole("button", { name: "Look", exact: true }).click();
    await waitChoice(picker.getByRole("button", { name: current, exact: true }));
    // A second writer's operation runs through the daemon, as another browser or CLI would.
    const other = await write("setTheme", { density: "compact" });
    assert.ok(other.ok, other.output);
    const external = await project();
    await picker.getByRole("button", { name: "Skip", exact: true }).click();
    await picker.waitFor({ state: "detached" });
    assert.equal(
      (await project()).files.ux,
      external.files.ux,
      "Skip changed the intervening writer's bytes",
    );
    await page.getByText(/Skip could not restore the opening look/).waitFor();
    await page.goto(base);
    await page.getByRole("button", { name: "Look", exact: true }).waitFor();
    assert.equal(await picker.count(), 0, "seen picker returned after reload");
    await page.goto(`${base}/?guide=off`);
    await page.setViewportSize({ width: 390, height: 844 });
    await (await toolbarAction(page, "Look")).click();
    const box = await picker.boundingBox();
    assert.ok(box && box.y > 250 && box.height < 550, "phone picker is not a lower sheet");
    await picker.getByRole("button", { name: "More look settings", exact: true }).click();
    await page.getByRole("dialog", { name: "Look", exact: true }).waitFor();
    assert.equal(await page.getByRole("dialog", { name: /^Smith presents / }).count(), 0);
    console.log(
      "  ✓ first look: keep before presentation, skip exact own change, refuse intervening change, reopen and phone sheet",
    );
  } finally {
    await context.close();
  }
}
