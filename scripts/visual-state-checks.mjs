// Mandatory visual risks outside the pairwise happy-path matrix. Uses the caller's owned fixture.
import assert from "node:assert/strict";
import { join } from "node:path";

export async function checkVisualStates({ browser, base, output, fixed, baseline, domain }) {
  const results = [];
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 700 },
      colorScheme: "dark",
      reducedMotion: "reduce",
    });
    try {
      await context.route("**/*", (route) =>
        new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
      );
      const page = await context.newPage();
      await page.clock.setFixedTime(fixed);
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      const open = async (path) => {
        await page.goto(base + path, { waitUntil: "domcontentloaded" });
        await page.locator("body[data-hydrated=true]").waitFor({ timeout: 90000 });
        await page.evaluate(() => document.fonts.ready);
      };
      const geometry = async () => {
        const size = await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
        }));
        assert(
          size.scroll <= size.width + 1 && size.body <= size.width + 1,
          `Mandatory state overflow: ${JSON.stringify(size)}`,
        );
      };
      await open("/sign-in");
      await page.getByRole("button", { name: "Sign in as admin", exact: true }).click();
      await page.waitForURL((url) => url.pathname !== "/sign-in");
      await open("/visual-empty");
      await page
        .getByRole("link", { name: /New visual empty/i })
        .first()
        .waitFor();
      assert.equal(await page.locator('[data-kit="model-table"] tbody tr').count(), 0);
      await geometry();
      await page.screenshot({
        path: join(output, `state-empty-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
      await open("/visual-items/new");
      const form = page.locator('[data-kit="model-form"]');
      const save = form.locator('[data-part="actions"] button[type=submit]');
      await save.click();
      const summary = form.locator('[data-part="error-summary"]');
      await summary.waitFor();
      await summary.getByRole("link", { name: "Name", exact: true }).click();
      assert(
        await form
          .locator('[data-field="name"] input')
          .first()
          .evaluate((node) => document.activeElement === node),
        "Error link did not focus required input",
      );
      await form.locator('[data-field="name"] input').first().fill("Unsaved visual fixture");
      await save.scrollIntoViewIfNeeded();
      const bar = await form.locator('[data-part="actions"]').boundingBox();
      const header = await page.locator("header").first().boundingBox();
      assert(
        bar && bar.y >= 0 && bar.y + bar.height <= 701,
        "Sticky save actions are outside viewport",
      );
      if (header && header.y >= 0)
        assert(header.y + header.height <= bar.y, "Header hides sticky actions");
      for (const action of await form.locator('[data-part="actions"] button').all()) {
        assert(
          await action.evaluate((button) => {
            const rect = button.getBoundingClientRect();
            return [4, rect.width / 2, rect.width - 4].every((x) => {
              const top = document.elementFromPoint(rect.x + x, rect.y + rect.height / 2);
              return top === button || button.contains(top);
            });
          }),
          "Sticky form action is covered by another control",
        );
      }
      await geometry();
      // Controlled synthetic backdrop exercises the real kit glass card without authoring app CSS.
      const parentStyle = await form.evaluate((node) => {
        const parent = node.parentElement;
        const before = parent.getAttribute("style");
        parent.style.backgroundImage = 'url("/images/visual-fixture.webp")';
        parent.style.backgroundSize = "cover";
        return before;
      });
      assert.match(await form.evaluate((node) => getComputedStyle(node).backdropFilter), /blur/);
      await page.screenshot({
        path: join(output, `state-header-savebar-glass-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
      await form.evaluate((node, before) => {
        if (before === null) node.parentElement.removeAttribute("style");
        else node.parentElement.setAttribute("style", before);
      }, parentStyle);
      await open("/visual-editorial");
      assert.equal(
        await page.locator("html").getAttribute("data-appearance"),
        "light",
        "One-mode theme followed disabled dark preference",
      );
      const picture = page.locator('[data-section="story"] button').first();
      await picture.focus();
      await page.keyboard.press("Enter");
      const dialog = page.locator("dialog[open]");
      await dialog.waitFor();
      assert.equal(
        await dialog.locator("img").evaluate((img) => getComputedStyle(img).objectFit),
        "contain",
      );
      await page.keyboard.press("Tab");
      assert(
        await dialog.evaluate(
          (node) =>
            document.activeElement === document.body || node.contains(document.activeElement),
        ),
        "Native picture dialog lost keyboard focus",
      );
      await page.screenshot({
        path: join(output, `state-one-mode-duotone-dialog-${width}.png`),
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      assert(await picture.evaluate((node) => document.activeElement === node));
      await geometry();
      assert.equal(domain(), baseline, "Empty/validation/dialog checks changed domain data");
      assert.deepEqual(errors, []);
      results.push({
        width,
        empty: true,
        validationErrorFocus: true,
        stickyHeaderSavebar: true,
        controlledGlassOverSyntheticImage: true,
        oneModeDuotoneDialog: true,
      });
    } finally {
      await context.close();
    }
  }
  const denied = await browser.newContext({ viewport: { width: 320, height: 700 } });
  try {
    const page = await denied.newPage();
    await page.goto(base + "/sign-in");
    await page.locator("body[data-hydrated=true]").waitFor({ timeout: 90000 });
    await page.getByRole("button", { name: "Sign in as member", exact: true }).click();
    await page.waitForURL((url) => url.pathname !== "/sign-in");
    await page.goto(base + "/visual-items");
    await page
      .getByText(/permission|access|not allowed/i)
      .first()
      .waitFor();
    assert.equal(await page.locator('[data-kit="record-summary"]').count(), 0);
    await page.screenshot({ path: join(output, "state-denied-320.png"), fullPage: true });
    assert.equal(domain(), baseline);
    results.push({ deniedRole: "member", width: 320 });
  } finally {
    await denied.close();
  }
  return results;
}
