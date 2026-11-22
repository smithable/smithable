import assert from "node:assert/strict";
import { openSmith } from "./studio-form-checks.mjs";

export async function checkStudioSelection(browser, base) {
  const open = async (phone = false) => {
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      hasTouch: phone,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    await page.goto(`${base}/?guide=off`);
    const frame = page.frameLocator('iframe[title="App preview"]');
    await frame.locator("body[data-hydrated=true]").waitFor({ timeout: 60000 });
    const hero = frame.locator("[data-hero]");
    const link = hero.getByRole("link", { name: "See the schedule", exact: true });
    const select = page
      .locator("[data-studio-header]")
      .getByRole("button", { name: "Select", exact: true });
    const smith = page.locator("[data-studio-header]").getByRole("button", {
      name: "Smith",
      exact: true,
    });
    const form = page.getByRole("form", { name: "See the schedule", exact: true });
    return { context, page, frame, hero, link, select, smith, form };
  };
  const wide = await open();
  try {
    const { page, frame, hero, link, select, smith, form } = wide;
    const originalHref = await link.getAttribute("href");
    assert.equal(originalHref, "/schedule");
    if ((await smith.getAttribute("aria-pressed")) === "true") await smith.click();
    await select.click();
    await frame.locator("html[data-sm-selecting]").waitFor();
    await link.click();
    await form.waitFor();
    assert.equal(await form.evaluate((element) => element.closest("[data-guide=change]")), null);
    await hero.locator("a[data-sm-selected]").waitFor();
    const overlay = page.locator('[data-studio-overlay="selection"]');
    const move = form.getByRole("button", { name: "Move selection", exact: true });
    await move.press("Enter");
    await form.getByRole("button", { name: "Top left", exact: true }).press("Enter");
    assert.ok((await overlay.boundingBox()).x <= 16);
    await form.getByRole("button", { name: "Close selection", exact: true }).click();
    await form.waitFor({ state: "hidden" });
    await select.click();
    await link.click();
    await form.waitFor();
    await page.waitForFunction(() => {
      const bounds = document
        .querySelector('[data-studio-overlay="selection"]')
        ?.getBoundingClientRect();
      return bounds && bounds.x <= 16;
    });
    await move.press("Enter");
    await form.getByRole("button", { name: "Reset position", exact: true }).press("Enter");
    const text = form.getByRole("tab", { name: "Text", exact: true });
    const look = form.getByRole("tab", { name: "Look", exact: true });
    const behavior = form.getByRole("tab", { name: "What it does", exact: true });
    const cancel = form.getByRole("button", { name: "Cancel", exact: true });
    const apply = form.getByRole("button", { name: "Apply", exact: true });
    const applyOperation = async (name) => {
      const operation = page.waitForResponse(
        (response) =>
          response.url() === `${base}/api/op` &&
          response.request().method() === "POST" &&
          response.request().postDataJSON()?.name === name,
      );
      await apply.click();
      assert.equal((await (await operation).json()).ok, true);
      await form.waitFor({ state: "hidden" });
    };
    await text.click();
    const buttonText = form.getByRole("textbox", { name: "Button text", exact: true });
    await buttonText.fill("Abandoned draft");
    await openSmith(page);
    await page
      .locator("[data-guide=change]")
      .getByRole("form", { name: "See the schedule", exact: true })
      .waitFor();
    assert.equal(await buttonText.inputValue(), "Abandoned draft");
    await cancel.click();
    await form.waitFor({ state: "hidden" });
    assert.equal(await link.getAttribute("href"), originalHref);
    await hero.locator("[data-sm-selected]").waitFor({ state: "hidden" });

    await page.locator('iframe[title="App preview"]').focus();
    await page.keyboard.down("Shift");
    await link.click({ modifiers: ["Shift"], position: { x: 2, y: 2 } });
    await page.keyboard.up("Shift");
    await form.waitFor();
    assert.ok(await form.evaluate((element) => Boolean(element.closest("[data-guide=change]"))));
    await hero.locator("a[data-sm-selected]").waitFor();
    await frame.locator("html[data-sm-selecting]").waitFor({ state: "hidden" });
    await look.click();
    await form.getByRole("combobox", { name: "Hero layout", exact: true }).selectOption("plain");
    await applyOperation("setSectionLook");
    await frame.locator('[data-hero][data-layout="plain"]').waitFor();

    await select.click();
    await link.click();
    await behavior.click();
    await form.getByRole("combobox", { name: "Opens", exact: true }).selectOption("blog");
    await applyOperation("setHeroButtons");
    await hero
      .getByRole("link", { name: "See the schedule", exact: true })
      .and(hero.locator('a[href="/blog"]'))
      .waitFor();

    await select.click();
    await link.click();
    await text.click();
    await form.getByRole("textbox", { name: "Button text", exact: true }).fill("Browse classes");
    await applyOperation("setText");
    const renamed = hero.getByRole("link", { name: "Browse classes", exact: true });
    await renamed.waitFor();
    assert.equal(await renamed.getAttribute("href"), "/blog");

    // A whole section, picked where none of its parts is marked (T1145): its box inside its own
    // edges, so all four sides show; its form beside it on the screen; a choice is one setSectionLook.
    await select.click();
    await hero.click({ position: { x: 4, y: 4 } });
    const sectionForm = page.getByRole("dialog").and(overlay);
    await sectionForm.waitFor();
    await frame.locator("[data-hero][data-sm-selected]").waitFor();
    const outline = await frame
      .locator("[data-hero][data-sm-selected]")
      .evaluate((element) => getComputedStyle(element).outlineOffset);
    assert.equal(outline, "-2px", "a section's selection box is drawn outside its edges");
    const formBox = await sectionForm.boundingBox();
    const viewport = page.viewportSize();
    assert.ok(
      formBox.x >= 0 && formBox.y >= 56 && formBox.x + formBox.width <= viewport.width,
      `a section's form is off the screen: ${JSON.stringify(formBox)}`,
    );
    const choose = async (name) => {
      const operation = page.waitForResponse(
        (response) =>
          response.url() === `${base}/api/op` &&
          response.request().method() === "POST" &&
          response.request().postDataJSON()?.name === "setSectionLook",
      );
      await sectionForm.getByRole("button", { name, exact: true }).click();
      assert.equal((await (await operation).json()).ok, true);
    };
    await choose("Full width photo");
    await frame.locator('[data-hero][data-layout="photo"]').waitFor();
    await sectionForm
      .getByRole("button", { name: "Full width photo", exact: true })
      .and(sectionForm.locator('[aria-pressed="true"]'))
      .waitFor();
    await sectionForm.getByRole("button", { name: "Ask Smith", exact: true }).click();
    await page.locator("[data-guide=change]").first().waitFor();
    await sectionForm.getByRole("button", { name: "Close selection", exact: true }).click();
    await sectionForm.waitFor({ state: "hidden" });
    await frame.locator("[data-sm-selected]").waitFor({ state: "hidden" });
    await renamed.click();
    await hero.waitFor({ state: "hidden" });
  } finally {
    await wide.context.close();
  }
  const phone = await open(true);
  try {
    const { page, hero, select, form } = phone;
    const renamed = hero.getByRole("link", { name: "Browse classes", exact: true });
    const sheet = page.getByRole("form", { name: "Browse classes", exact: true });
    assert.equal(await form.count(), 0);
    await select.tap();
    await renamed.tap();
    await sheet.waitFor();
    const panel = await sheet.boundingBox();
    assert.ok(panel && panel.y >= 200 && panel.x < 12);
    const iframe = page.locator('iframe[title="App preview"]');
    const framePosition = await iframe.boundingBox();
    const preview = await (await iframe.elementHandle()).contentFrame();
    await preview.waitForFunction((bottom) => {
      const selected = document.querySelector("[data-sm-selected]");
      return selected && selected.getBoundingClientRect().bottom <= bottom;
    }, panel.y - framePosition.y);
    assert.equal(
      await sheet.getByRole("button", { name: "Move selection", exact: true }).count(),
      0,
    );
    await sheet.getByRole("button", { name: "Close selection", exact: true }).tap();
    await sheet.waitFor({ state: "hidden" });
    await renamed.waitFor();
  } finally {
    await phone.context.close();
  }
  console.log(
    "  ✓ Studio selection: click, Shift and tap, both form positions, cancel and apply; a section beside its form",
  );
}
