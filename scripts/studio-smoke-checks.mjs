import assert from "node:assert/strict";
import { join } from "node:path";
import { stubPictureCatalogue } from "./first-look-checks.mjs";
import {
  checkAppOwnsPhoneSwipe,
  openFormEntry,
  openPreviewAddress,
  openSettings,
  openStudioGuide,
  toolbarAction,
} from "./studio-form-checks.mjs";
import { checkStudioHistory } from "./studio-history-checks.mjs";

async function checkBuilder(page, phone) {
  const tab = (name) => page.getByRole("tab", { name, exact: true });
  const hint = (name) => page.getByRole("button", { name, exact: true });
  const look = page.getByRole("complementary", { name: "Look", exact: true });
  await (await toolbarAction(page, "Look")).click();
  await look.getByRole("button", { name: "Close Look", exact: true }).click();
  await look.waitFor({ state: "detached" });

  const showPreview = async () => {
    if (phone) {
      const edge = page.getByRole("button", { name: "Show the app", exact: true });
      if (await edge.isVisible()) await edge.click();
    }
  };
  const showEditor = () => openSettings(page);
  const preview = async (name) => {
    await showPreview();
    await page
      .frameLocator('iframe[title="App preview"]')
      .getByRole("heading", { name, level: 1, exact: true })
      .waitFor({ timeout: 30000 });
  };
  const undo = async () => (await toolbarAction(page, "Undo")).click();

  await preview("Overview");
  await page.locator("[data-review-launch]").click();
  const review = page.getByRole("dialog", { name: "Review", exact: true });
  await review.getByRole("tab", { name: "Summary", exact: true }).click();
  await review.getByRole("region", { name: "Summary", exact: true }).waitFor();
  await review.getByRole("button", { name: "Close Review", exact: true }).click();
  await review.waitFor({ state: "detached" });

  await showEditor();
  const settingsHint = hint("No code changes the app. Code shows its files.");
  await settingsHint.click();
  await settingsHint.waitFor({ state: "detached" });
  await tab("No code").click();
  await tab("Content").click();
  const pages = page
    .getByRole("region", { name: "The texts" })
    .locator('details[data-key="pages"]')
    .first();
  if (!(await pages.evaluate((details) => details.open)))
    await pages.locator("summary").first().click();
  const start = await openFormEntry(page, pages, "Start");
  const title = start.getByRole("textbox", { name: "title", exact: true });
  await title.fill("Edited in No code");
  await title.press("Tab");
  await preview("Edited in No code");
  const undoHint = hint("Undo in the top bar puts the app back.");
  await undoHint.click();
  await undo();
  await preview("Overview");

  await showEditor();
  await tab("Code").click();
  const file = "smithable.content.yml";
  await page.getByLabel("File", { exact: true }).selectOption(file);
  const editor = page.getByLabel(file, { exact: true });
  const original = await editor.evaluate((element) => element.value);
  const edited = original.replace("title: Overview", "title: Edited in Code");
  assert.notEqual(edited, original, "Could not find the Overview title in the Code editor");
  await editor.evaluate((element, value) => {
    element.value = value;
  }, edited);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await preview("Edited in Code");
  assert.equal(await undoHint.count(), 0);
  await undo();
  await preview("Overview");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const publishHint = page.getByRole("dialog").getByRole("button", {
    name: "Check what has changed before you publish.",
    exact: true,
  });
  await publishHint.click();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
}

async function checkPreviewRange(page) {
  const address = await openPreviewAddress(page);
  await address.fill("/customers");
  await address.press("Enter");
  const iframe = page.locator('iframe[title="App preview"]');
  const preview = iframe.contentFrame();
  const rows = preview.locator('tbody input[data-part="select"]').filter({ visible: true });
  await preview.locator("body[data-hydrated=true]").waitFor({ timeout: 60000 });
  await rows.nth(2).waitFor({ timeout: 60000 });
  await rows.nth(0).click();
  const label = rows.nth(2).locator("xpath=..");
  // Target the label itself, just as a pointer landing on its padding would. Chromium still
  // performs the label's native checkbox activation, regardless of the current table layout.
  await label.dispatchEvent("click", { shiftKey: true });
  assert.ok(await rows.nth(1).isChecked(), "Shift+click on label padding selected the middle row");
  assert.ok(await rows.nth(2).isChecked(), "Shift+click on label padding selected the last row");
  assert.equal(await preview.locator("[data-sm-selected]").count(), 0);
  const passedArrow = await preview.locator("body").evaluate((body) =>
    body.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.ok(passedArrow, "Shift+Arrow is available to the app outside explicit Select mode");
}

export async function checkStudioSmoke(browser, base, evidence, asMade) {
  for (const [phone, choice] of [
    [false, "Keep this look"],
    [true, "Cancel"],
  ]) {
    // The wide run's Keep changed the app, so the phone run needs it as made again.
    if (phone) asMade();
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    });
    await stubPictureCatalogue(context);
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const look = page.getByRole("dialog", { name: "Choose a look", exact: true });
    const presentation = page.getByRole("dialog", { name: /^Smith presents / });
    const layout = phone ? "phone" : "wide";
    try {
      console.log(`  ${layout}: fresh browser, ${choice}`);
      await page.goto(base);
      await look.waitFor();
      const readUx = () =>
        page.evaluate(async () => (await (await fetch("/api/project")).json()).files.ux);
      const openingUx = await readUx();
      const alternative = look.getByRole("button", { pressed: false }).first();
      const theme = await alternative.getAttribute("aria-label");
      assert.ok(theme, "The alternate theme needs an accessible name");
      await alternative.click();
      await look.getByRole("button", { name: theme, exact: true, pressed: true }).waitFor();
      // A tried theme is only in the preview (T1164): Keep saves it, Cancel leaves the app as it was.
      assert.equal(await readUx(), openingUx, "A tried theme reached the project");
      await look.getByRole("button", { name: choice, exact: true }).click();
      await look.waitFor({ state: "detached" });
      const savedUx = await readUx();
      if (choice === "Cancel") assert.equal(savedUx, openingUx, "Cancel saved a theme");
      else assert.notEqual(savedUx, openingUx, "Keep did not save the chosen theme");
      await presentation.getByRole("button", { name: "Skip", exact: true }).click();
      await presentation.waitFor({ state: "detached" });
      const lookHint = page.getByRole("button", {
        name: "Look opens this again when you want another theme.",
        exact: true,
      });
      // On a cold runner the guide waits for the preview or its own 20-second fallback.
      await page.locator("[data-guide-card]").waitFor({ timeout: 45000 });
      await page.getByRole("button", { name: "Skip guide", exact: true }).click();
      await page.locator("[data-guide-card]").waitFor({ state: "detached" });
      if (choice === "Keep this look") await lookHint.click();
      else assert.equal(await lookHint.count(), 0);
      // Skipping the guide after its fallback can still precede a cold preview's startup.
      await page.locator('iframe[title="App preview"]').waitFor({ timeout: 60000 });

      console.log(`  ${layout}: returning browser, Look, Summary, No code, Code and preview`);
      await page.reload();
      // The top-bar click in checkBuilder must succeed without another picker or presentation.
      await checkBuilder(page, phone);
      assert.equal(await look.count(), 0);
      assert.equal(await presentation.count(), 0);
      await checkStudioHistory(page, phone, evidence);
      if (phone) await checkAppOwnsPhoneSwipe(page);
      else {
        await openSettings(page);
        await page.getByRole("tab", { name: "Code", exact: true }).click();
        await page.getByRole("region", { name: "Code", exact: true }).waitFor();
        await openStudioGuide(page);
        const guide = page.locator('[data-guide-card="files"]');
        await guide.waitFor();
        await page.evaluate(() => document.activeElement?.blur());
        await page.keyboard.press("Escape");
        await guide.waitFor({ state: "detached" });
        // Range selection lives in the preview's table layout, which needs the full width.
        for (const side of ["left", "right"]) {
          const hide = page.getByRole("button", {
            name: `Hide the window on the ${side}`,
            exact: true,
          });
          if (await hide.isVisible()) await hide.click();
        }
        await checkPreviewRange(page);
      }
    } catch (error) {
      await page
        .screenshot({ path: join(evidence, `${layout}.png`), timeout: 3000 })
        .catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }
  console.log("  ✓ Studio smoke: first run and returning, wide and phone, with preview and undo");
}
