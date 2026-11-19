import assert from "node:assert/strict";
import { join } from "node:path";
import { stubPictureCatalogue } from "./first-look-checks.mjs";
import { openFormEntry, showWorkspaceControls, toolbarAction } from "./studio-form-checks.mjs";

async function checkBuilder(page, phone) {
  const tab = (name) => page.getByRole("tab", { name, exact: true });
  const look = page.getByRole("dialog", { name: "Choose a look", exact: true });
  await (await toolbarAction(page, "Look")).click();
  await look.getByRole("button", { name: "Keep this look", exact: true }).click();
  await look.waitFor({ state: "detached" });

  const showPreview = async () => {
    if (phone) {
      await showWorkspaceControls(page);
      await page.getByRole("radio", { name: "Preview", exact: true }).check({ force: true });
    }
  };
  const showEditor = async () => {
    if (phone) {
      await showWorkspaceControls(page);
      await page.getByRole("radio", { name: /^(No code|Code)$/ }).check({ force: true });
    } else {
      const open = page.getByRole("button", { name: "Show the window on the right" });
      if (await open.isVisible()) await open.click();
    }
  };
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
  await review.getByRole("button", { name: "Close", exact: true }).click();
  await review.waitFor({ state: "detached" });

  await showEditor();
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
  await undo();
  await preview("Overview");
}

export async function checkStudioSmoke(browser, base, evidence) {
  for (const [phone, choice] of [
    [false, "Keep this look"],
    [true, "Skip"],
  ]) {
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
      const chosenUx = await readUx();
      assert.notEqual(chosenUx, openingUx, "The selected theme did not reach the project");
      await look.getByRole("button", { name: choice, exact: true }).click();
      await look.waitFor({ state: "detached" });
      assert.equal(
        await readUx(),
        choice === "Skip" ? openingUx : chosenUx,
        `${choice} left the wrong theme saved`,
      );
      await presentation.getByRole("button", { name: "Skip", exact: true }).click();
      await presentation.waitFor({ state: "detached" });
      // On a cold runner the guide waits for the preview or its own 20-second fallback.
      await page.locator("[data-guide-card]").waitFor({ timeout: 45000 });
      await page.getByRole("button", { name: "Skip guide", exact: true }).click();
      await page.locator("[data-guide-card]").waitFor({ state: "detached" });
      await page.locator('iframe[title="App preview"]').waitFor();

      console.log(`  ${layout}: returning browser, Look, Summary, No code, Code and preview`);
      await page.reload();
      // The top-bar click in checkBuilder must succeed without another picker or presentation.
      await checkBuilder(page, phone);
      assert.equal(await look.count(), 0);
      assert.equal(await presentation.count(), 0);
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
