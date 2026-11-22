import assert from "node:assert/strict";
import { openSmith, toolbarAction } from "./studio-form-checks.mjs";

export async function checkStudioOverlays(browser, base) {
  const page = await browser.newPage({
    viewport: { width: 1536, height: 900 },
    reducedMotion: "reduce",
  });
  try {
    await page.goto(`${base}/?guide=off`);
    const header = page.locator("[data-studio-header]");
    const changes = page.getByRole("dialog", { name: "Changes", exact: true });
    const changeButton = () => toolbarAction(page, "Changes");
    const panelPosition = async (dialog, title, choice) => {
      const move = dialog.getByRole("button", { name: `Move ${title}`, exact: true });
      await move.press("Enter");
      await dialog.getByRole("button", { name: choice, exact: true }).press("Enter");
      assert.equal(await move.evaluate((button) => document.activeElement === button), true);
    };
    await (await changeButton()).press("Enter");
    await changes.waitFor();
    await panelPosition(changes, "Changes", "Top left");
    assert.ok((await changes.boundingBox()).x <= 16);
    const handle = await changes
      .getByRole("button", { name: "Move Changes", exact: true })
      .boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + 150, handle.y + 120, { steps: 8 });
    await page.mouse.up();
    const dragged = await changes.boundingBox();
    assert.ok(dragged.x > 100 && dragged.y > 100, "drag did not move the panel");
    await changes.getByRole("button", { name: "Close", exact: true }).press("Enter");
    await changes.waitFor({ state: "detached" });
    assert.equal(
      await (await changeButton()).evaluate((button) => document.activeElement === button),
      true,
    );
    await page.reload();
    await (await changeButton()).press("Enter");
    await changes.waitFor();
    const reopened = await changes.boundingBox();
    assert.ok(Math.abs(reopened.x - dragged.x) < 3 && Math.abs(reopened.y - dragged.y) < 3);
    await panelPosition(changes, "Changes", "Bottom right");
    const cornerMenu = changes.getByRole("group", { name: "Changes position", exact: true });
    const changesHandle = changes.getByRole("button", { name: "Move Changes", exact: true });
    await changesHandle.press("Enter");
    await cornerMenu.waitFor();
    const menuBounds = await cornerMenu.boundingBox();
    assert.ok(menuBounds.y >= 0 && menuBounds.y + menuBounds.height <= 900);
    await changesHandle.press("Escape");
    await cornerMenu.waitFor({ state: "detached" });
    await page.setViewportSize({ width: 1120, height: 600 });
    await page.waitForFunction(() => {
      const bounds = document
        .querySelector('[data-studio-overlay="changes"]')
        ?.getBoundingClientRect();
      return bounds && bounds.right <= innerWidth - 10 && bounds.bottom <= innerHeight - 10;
    });
    await panelPosition(changes, "Changes", "Reset position");
    assert.ok((await changes.boundingBox()).y < 110);
    await changes.press("Escape");
    await changes.waitFor({ state: "detached" });

    await page.setViewportSize({ width: 1536, height: 900 });
    const face = await openSmith(page);
    await page.getByRole("button", { name: "Undock Smith", exact: true }).click();
    const smith = page.getByRole("complementary", { name: "Smith", exact: true });
    await panelPosition(smith, "Smith", "Top left");
    assert.ok((await smith.boundingBox()).x <= 16);
    await face.click();
    await face.click();
    assert.ok((await smith.boundingBox()).x <= 16);
    await panelPosition(smith, "Smith", "Reset position");
    assert.ok((await smith.boundingBox()).x > 300);
    await face.click();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/?guide=off`);
    const preview = page.locator('iframe[title="App preview"]');
    await preview.waitFor();
    const phoneFace = await openSmith(page);
    const smithSheet = page.locator('[data-phone-sheet="smith"]');
    await smithSheet.waitFor();
    const sheet = await smithSheet.boundingBox();
    assert.ok(sheet.y > 150 && sheet.y + sheet.height <= 844);
    assert.ok(Math.abs((await preview.boundingBox()).x) < 2);
    await smithSheet.getByRole("button", { name: "Close Smith", exact: true }).click();
    await smithSheet.waitFor({ state: "detached" });
    assert.equal(await phoneFace.getAttribute("aria-pressed"), "false");
    await (await changeButton()).click();
    await changes.waitFor();
    assert.ok((await changes.boundingBox()).y > 150);
    assert.equal(
      await changes.getByRole("button", { name: "Move Changes", exact: true }).count(),
      0,
    );
    assert.ok(Math.abs((await preview.boundingBox()).x) < 2);
    await changes.getByRole("button", { name: "Close", exact: true }).click();

    const help = page.getByRole("dialog", { name: "Help", exact: true });
    const browse = help.getByRole("button", { name: "Quick hints", exact: true });
    await (await toolbarAction(page, "Help")).click();
    await browse.click();
    await help
      .getByRole("button", { name: "Dismiss hint: Open a page by address", exact: true })
      .click();
    await help.getByRole("heading", { name: "Keep the preview in view", exact: true }).waitFor();
    await help.getByRole("button", { name: "Close", exact: true }).click();
    const more = header.getByRole("button", { name: "More", exact: true });
    assert.equal(await more.evaluate((button) => document.activeElement === button), true);
    await (await toolbarAction(page, "Help")).click();
    await browse.click();
    assert.equal(
      await help.getByRole("heading", { name: "Open a page by address", exact: true }).count(),
      0,
    );
    await help.getByRole("button", { name: "Show dismissed hints", exact: true }).click();
    await help.getByRole("heading", { name: "Open a page by address", exact: true }).waitFor();
    console.log(
      "  ✓ Studio overlays: drag, keyboard corners/reset, kept position, resize, phone preview, hints and focus",
    );
  } finally {
    await page.close();
  }
}
