import assert from "node:assert/strict";
import { join } from "node:path";
import { openPreviewAddress, openStudioGuide, toolbarAction } from "./studio-form-checks.mjs";

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
      if (viewport.width < 1024) {
        const arrow = page.getByRole("button", { name: "Show Smith", exact: true });
        if (await arrow.isVisible()) await arrow.click();
      }
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
        await page.getByRole("button", { name: "Undock Smith", exact: true }).click();
        const smith = page.getByRole("complementary", { name: "Smith", exact: true });
        await smith.waitFor();
        await smith.getByRole("button", { name: "Dock", exact: true }).click();
        await page.setViewportSize({ width: 1600, height: 900 });
        await openStudioGuide(page);
        const card = page.locator("[data-guide-card]:visible");
        await card.waitFor();
        const stops = [];
        for (let i = 0; i < 10; i++) {
          assert.equal(await card.count(), 1, "tour must have exactly one visible guide");
          const anchor = await card.getAttribute("data-guide-card");
          stops.push(anchor);
          const done = card.getByRole("button", { name: "Done", exact: true });
          const last = (await done.count()) > 0;
          await (last ? done : card.getByRole("button", { name: "Next", exact: true })).click();
          if (anchor === "change") {
            // With Changes closed, Done on Ask me still offers the demonstration.
            await card.getByRole("button", { name: "Yes", exact: true }).waitFor();
            await card.getByRole("button", { name: "Skip", exact: true }).click();
          }
          if (last) break;
          await page.waitForFunction(
            (before) =>
              [...document.querySelectorAll("[data-guide-card]")].some(
                (el) => el.checkVisibility() && el.getAttribute("data-guide-card") !== before,
              ),
            anchor,
          );
        }
        await card.waitFor({ state: "detached" });
        assert.deepEqual(stops, ["preview", "behavior", "change"]);
        // Docked Smith keeps its width whether All settings is shown or hidden (T1237).
        const smithWidth = async () => {
          await page.waitForTimeout(300);
          return page
            .locator('[data-window="smith"], [data-window="smith+changes"]')
            .locator("visible=true")
            .first()
            .evaluate((el) => el.getBoundingClientRect().width);
        };
        const settings = await toolbarAction(page, "All settings");
        if ((await settings.getAttribute("aria-pressed")) !== "true") await settings.click();
        const beside = await smithWidth();
        await (await toolbarAction(page, "All settings")).click();
        assert.equal(
          await (await toolbarAction(page, "All settings")).getAttribute("aria-pressed"),
          "false",
        );
        const alone = await smithWidth();
        assert.ok(
          Math.abs(alone - beside) <= 1 && alone <= 420,
          `docked Smith is ${beside}px beside All settings and ${alone}px without`,
        );
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
    await (await toolbarAction(page, "Look")).click();
    await page.getByRole("button", { name: "Customize", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Look", exact: true });
    await dialog.getByRole("tab", { name: "Customize", exact: true }).click();
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
    console.log("  ✓ compact Look: connected draft, two-column details, reachable controls");
    await dialog.getByRole("button", { name: "Close look editor", exact: true }).click();
  } catch (error) {
    if (pictures)
      await page.screenshot({ path: join(pictures, "failure-edit-look.png") }).catch(() => {});
    throw error;
  } finally {
    await page.close();
  }
}

// The Select button shows Shift held for selection, in Studio or in the page, and goes off when it
// is let go or the window loses the focus (T1238). The page picker lists every page when opened,
// whatever page is shown, and filters by the start of the address once typed (T1240).
export async function checkSelectAndPages(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  try {
    await page.goto(`${base}/?guide=off`);
    const select = await toolbarAction(page, "Select");
    const pressed = () => select.getAttribute("aria-pressed");
    const waitPressed = async (value) => {
      for (let i = 0; i < 30 && (await pressed()) !== value; i++) await page.waitForTimeout(100);
      assert.equal(await pressed(), value, `Select pressed ${value}`);
    };
    assert.equal(await pressed(), "false");
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.down("Shift");
    await waitPressed("true");
    await page.keyboard.up("Shift");
    await waitPressed("false");
    await page.keyboard.down("Shift");
    await waitPressed("true");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await waitPressed("false");
    await page.keyboard.up("Shift");
    // Held in the page itself.
    // Held in the page itself: the page's own handler selects, and Studio's button shows it.
    const frame = page.frameLocator('iframe[title="App preview"]');
    const html = frame.locator("html");
    await frame.locator("a[href], button").first().focus();
    await page.keyboard.down("Shift");
    await waitPressed("true");
    assert.equal(await html.getAttribute("data-sm-selecting"), "");
    await page.keyboard.up("Shift");
    await waitPressed("false");
    assert.equal(await html.getAttribute("data-sm-selecting"), null);

    await openPreviewAddress(page);
    const list = page.getByRole("listbox", { name: "Pages", exact: true });
    await list.waitFor();
    const routes = await list.getByRole("option").allInnerTexts();
    assert.ok(routes.length > 1, `pages listed at home: ${routes.join(" | ")}`);
    // Another page, then the picker again: still every page.
    await list.getByRole("option").nth(1).click();
    await page.waitForTimeout(300);
    const again = await openPreviewAddress(page);
    await list.waitFor();
    assert.notEqual(await again.inputValue(), "/");
    assert.equal(
      await list.getByRole("option").count(),
      routes.length,
      "every page away from home",
    );
    // Typing filters by the start of the address.
    const path = (text) => text.split(/\s+/).find((word) => word.startsWith("/"));
    const target = path(routes[1]);
    const prefix = target.slice(0, 2);
    await again.fill(prefix);
    const shown = await list.getByRole("option").allInnerTexts();
    assert.ok(
      shown.length > 0 && shown.every((text) => path(text)?.startsWith(prefix)),
      `typed ${prefix}: ${shown.join(" | ")}`,
    );
    await again.fill("");
    assert.equal(
      await list.getByRole("option").count(),
      routes.length,
      "a cleared field lists all",
    );
    console.log(
      "  ✓ Select shows Shift held and lets go on blur; the page picker lists all until typed",
    );
  } finally {
    await page.close();
  }
}
