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
      await page.keyboard.press("Escape");
      await page.locator("[data-guide-card]:visible").waitFor({ state: "detached" });
      if (viewport.width === 1600) {
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.getByRole("heading", { name: "Ask Smith", exact: true }).waitFor();
        await page
          .getByRole("textbox", { name: "Describe a change, or ask a question" })
          .locator("visible=true")
          .waitFor();
      }
      console.log(
        `  ✓ Studio ${viewport.width}×${viewport.height} at 2×: one guide, one scroll region, reachable input and controls`,
      );
    } finally {
      await page.close();
    }
  }
}
