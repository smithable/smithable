// Shared editor controls remain reachable at small logical viewports and enlarged UI scale.
import assert from "node:assert/strict";
export async function checkLookResponsive(page) {
  const previous = page.viewportSize();
  try {
    for (const width of [320, 390, 720]) {
      await page.setViewportSize({ width, height: 700 });
      await page.getByLabel("Start from theme", { exact: true }).waitFor();
      const geometry = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert(
        geometry.scroll <= width + 1 && geometry.body <= width + 1,
        `Look editor whole-page overflow: ${JSON.stringify(geometry)}`,
      );
      for (const group of ["Page", "Mode", "Width"]) {
        const controls = page.getByRole("group", { name: group, exact: true }).getByRole("button");
        for (const button of await controls.all()) {
          const box = await button.boundingBox();
          assert(
            box && box.x >= 0 && box.x + box.width <= width + 1,
            `${group} control is outside viewport at ${width}`,
          );
        }
      }
      await page.getByRole("button", { name: "Look gallery", exact: true }).click();
      const first = page.getByRole("button", { name: /^Choose / }).first();
      await first.focus();
      await page.keyboard.press("ArrowRight");
      assert(
        await page
          .getByRole("button", { name: /^Choose / })
          .nth(1)
          .evaluate((button) => document.activeElement === button),
      );
      await page.getByRole("button", { name: "Look gallery", exact: true }).click();
    }
    console.log(
      "  ✓ shared look controls: 320/390/720 logical pixels, no whole-page overflow, all page/mode/width controls reachable, gallery keyboard focus",
    );
  } finally {
    if (previous) await page.setViewportSize(previous);
  }
}
