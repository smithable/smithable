import assert from "node:assert/strict";
import { join } from "node:path";

// Use CSS pixels: desktop display scaling reduces the available layout size.
export async function checkStudioLayout(browser, base, pictures) {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 960, height: 540 },
    { width: 1600, height: 900 },
  ]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
    try {
      await page.goto(base);
      const overlay = page.getByRole("dialog", { name: /^Smith presents / });
      await overlay.getByRole("button", { name: "Skip", exact: true }).click();
      await overlay.waitFor({ state: "detached" });
      await page.locator('[data-guide-card="preview"]:visible').waitFor({ timeout: 30000 });
      assert.equal(await page.locator("[data-guide-card]:visible").count(), 1, "one visible guide");
      assert.equal(
        await page.locator("[data-guide-beside]:visible").count(),
        0,
        "no duplicate floating guide",
      );
      if (pictures)
        await page.screenshot({ path: join(pictures, `after-${viewport.width}-guide.png`) });
      if (viewport.width < 1024)
        await page.getByRole("radio", { name: "Smith", exact: true }).check({ force: true });
      const input = page
        .getByRole("textbox", { name: "Describe a change, or ask a question" })
        .locator("visible=true");
      await input.waitFor();
      // After a row slides, read its settled geometry rather than its transition frame.
      await page.waitForTimeout(400);
      const geometry = await input.evaluate((input) => {
        const box = (el) => el.getBoundingClientRect();
        const intersects = (a, b) =>
          a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const visible = (el) =>
          el.checkVisibility() && box(el).right > 0 && box(el).left < innerWidth;
        const composer = input.closest("form");
        const smith = composer.parentElement;
        const scrollers = [...smith.querySelectorAll("*")].filter(
          (el) => el.tagName !== "TEXTAREA" && /auto|scroll/.test(getComputedStyle(el).overflowY),
        );
        const ancestors = [];
        for (let el = smith.parentElement; el; el = el.parentElement) {
          if (
            /auto|scroll/.test(getComputedStyle(el).overflowY) &&
            el.scrollHeight > el.clientHeight + 1
          )
            ancestors.push(el.tagName);
        }
        const guide = [...document.querySelectorAll("[data-guide-card]")].filter(visible);
        const controls = [
          ...document.querySelectorAll(
            "[data-studio-header] button, [data-studio-header] a, [data-studio-header] label",
          ),
        ].filter(visible);
        const headerInside = controls.every((el) => {
          const r = box(el);
          return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight;
        });
        const r = box(input);
        const floating = document.querySelector('[data-smith-layer="panel"]');
        const preview = document.querySelector('[data-guide="preview"]');
        return {
          guideCount: guide.length,
          overlaps: guide.some((el) => intersects(box(el), box(composer))),
          scrollRegions: scrollers.length,
          scrollingAncestors: ancestors,
          inputInside:
            r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
          headerInside,
          pageOverflow:
            document.documentElement.scrollWidth > innerWidth + 1 ||
            document.documentElement.scrollHeight > innerHeight + 1,
          floating: !!floating && visible(floating),
          coversPreviewControls:
            !!floating && visible(floating) && !!preview && box(floating).top < box(preview).top,
        };
      });
      assert.equal(geometry.guideCount, 1, JSON.stringify(geometry));
      assert.equal(geometry.overlaps, false, "guide covers Smith's composer");
      assert.equal(geometry.scrollRegions, 1, "Smith has more than one scrolling region");
      assert.deepEqual(geometry.scrollingAncestors, [], "Smith has a scrolling parent");
      assert.ok(
        geometry.inputInside && geometry.headerInside && !geometry.pageOverflow,
        JSON.stringify(geometry),
      );
      if (viewport.width < 1440)
        assert.equal(geometry.floating, false, "compact Smith floats over preview");
      assert.equal(geometry.coversPreviewControls, false, "Smith covers preview controls");
      if (pictures)
        await page.screenshot({ path: join(pictures, `after-${viewport.width}-smith.png`) });
      // Escape belongs to focused controls; leave the phone's window radio before ending the tour.
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press("Escape");
      await page.locator("[data-guide-card]:visible").waitFor({ state: "detached" });
      if (viewport.width === 1600) {
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.getByRole("heading", { name: "Ask Smith", exact: true }).waitFor();
        await page
          .getByRole("textbox", { name: "Describe a change, or ask a question" })
          .locator("visible=true")
          .waitFor();
        await page.setViewportSize({ width: 1600, height: 900 });
        await page.getByRole("complementary", { name: "Smith" }).waitFor();
        await page.locator('[data-window="changes"]').waitFor({ state: "detached" });
        await page
          .locator("[data-studio-header]")
          .getByRole("button", { name: "Guide", exact: true })
          .click();
        await page.getByRole("menuitem", { name: "Tour Studio", exact: true }).click();
        const card = page.locator("[data-guide-card]:visible");
        await card.waitFor();
        const stops = [];
        for (let i = 0; i < 10; i++) {
          assert.equal(await card.count(), 1, "tour must have exactly one visible guide");
          const anchor = await card.getAttribute("data-guide-card");
          stops.push(anchor);
          const done = card.getByRole("button", { name: "Done", exact: true });
          if (await done.count()) {
            await done.click();
            break;
          }
          await card.getByRole("button", { name: "Next", exact: true }).click();
          if (anchor === "change") {
            await card.getByRole("button", { name: "Yes", exact: true }).waitFor();
            await card.getByRole("button", { name: "Skip", exact: true }).click();
          }
          await page.waitForFunction(
            (before) =>
              [...document.querySelectorAll("[data-guide-card]")].some(
                (el) => el.checkVisibility() && el.getAttribute("data-guide-card") !== before,
              ),
            anchor,
          );
        }
        await card.waitFor({ state: "detached" });
        assert.ok(stops.includes("publish"), `tour did not reach publishing: ${stops.join()}`);
      }
      console.log(
        `  ✓ Studio ${viewport.width}×${viewport.height} at 2×: one guide, one scroll region, reachable input and controls`,
      );
    } catch (error) {
      if (pictures)
        await page
          .screenshot({ path: join(pictures, `failure-${viewport.width}-layout.png`) })
          .catch(() => {});
      throw error;
    } finally {
      await page.close();
    }
  }
}

export async function checkCompactLook(browser, base, pictures) {
  const page = await browser.newPage({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  try {
    await page.goto(`${base}/?guide=off`);
    await page.getByRole("button", { name: "Edit look", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Edit look", exact: true });
    await dialog
      .getByRole("status")
      .filter({ hasText: "Draft preview ready" })
      .waitFor({ timeout: 60000 });
    assert.equal(
      await dialog.getByRole("button", { name: "Light", exact: true }).getAttribute("aria-pressed"),
      "true",
    );
    const iframe = dialog.locator("iframe[data-frame]").first();
    const frame = await (await iframe.elementHandle()).contentFrame();
    assert.ok(await frame.locator("#sm-theme").count(), "connected preview has no draft style");
    assert.equal(
      await frame.locator("html").getAttribute("data-appearance"),
      "light",
      "Light choice was not applied to the dark-system preview",
    );
    await dialog.getByRole("button", { name: "Dark", exact: true }).click();
    await frame.waitForFunction(() => document.documentElement.dataset.appearance === "dark");
    await dialog.getByRole("button", { name: "Light", exact: true }).click();
    await frame.waitForFunction(() => document.documentElement.dataset.appearance === "light");
    const layout = await dialog.evaluate((dialog) => {
      const main = dialog.querySelector("main");
      const row = dialog.querySelector("aside dl > div");
      const label = row.querySelector("dt").getBoundingClientRect();
      const value = row.querySelector("dd").getBoundingClientRect();
      const controls = [
        ...dialog.querySelectorAll("header button, header input, header select"),
      ].filter((el) => el.checkVisibility());
      return {
        columns: value.left >= label.right,
        mainInside: main.getBoundingClientRect().right <= innerWidth,
        noHorizontalScroll: main.scrollWidth <= main.clientWidth + 1,
        controlsInside: controls.every((el) => {
          const r = el.getBoundingClientRect();
          return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
        }),
      };
    });
    assert.ok(Object.values(layout).every(Boolean), JSON.stringify(layout));
    if (pictures) await page.screenshot({ path: join(pictures, "after-960-edit-look.png") });
    console.log("  ✓ compact Edit look: connected draft, two-column details, reachable controls");
    await dialog.getByRole("button", { name: "Close look editor", exact: true }).click();
  } catch (error) {
    if (pictures)
      await page.screenshot({ path: join(pictures, "failure-edit-look.png") }).catch(() => {});
    throw error;
  } finally {
    await page.close();
  }
}
