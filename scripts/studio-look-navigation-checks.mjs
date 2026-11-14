import assert from "node:assert/strict";
import { join } from "node:path";

/** A fresh app session redirects a protected preview before returning through the client router. */
export async function checkStudioLookNavigation(browser, base, label = "Customers", pictures) {
  const context = await browser.newContext({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await context.newPage();
  try {
    await page.goto(`${base}/?guide=off`);
    await page.getByRole("button", { name: "Edit look", exact: true }).waitFor();
    // Finish the ordinary preview's initial load, then exercise a new app session in the editor.
    const main = await page.locator('iframe[title="App preview"]').elementHandle();
    const mainFrame = await main.contentFrame();
    await mainFrame.locator('body[data-hydrated="true"]').waitFor();
    await context.clearCookies();
    let redirected = false;
    page.on("framenavigated", (frame) => {
      if (
        new URL(frame.url()).pathname === "/sign-in" &&
        frame !== page.mainFrame() &&
        frame !== mainFrame
      )
        redirected = true;
    });
    await page.getByRole("button", { name: "Edit look", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Edit look", exact: true });
    await dialog.getByRole("button", { name: label, exact: true }).click();
    const element = await dialog.locator("iframe[data-frame]").first().elementHandle();
    const frame = await element.contentFrame();
    await frame.locator("#sm-theme").waitFor({ state: "attached", timeout: 60000 });
    await frame.waitForFunction(() => document.documentElement.dataset.appearance === "light");
    await dialog.getByRole("status").filter({ hasText: "Draft preview ready" }).waitFor();
    assert.ok(redirected, "the test did not exercise the sign-in redirect");
    assert.ok(new URL(frame.url()).searchParams.has("__sm_look"));
    await dialog.getByRole("button", { name: "Dark", exact: true }).click();
    await frame.waitForFunction(() => document.documentElement.dataset.appearance === "dark");
    await dialog.getByRole("button", { name: "Light", exact: true }).click();
    await frame.waitForFunction(() => document.documentElement.dataset.appearance === "light");
    if (pictures) await page.screenshot({ path: join(pictures, "look-after-sign-in.png") });
    console.log("  ✓ Edit look connects after a sign-in return and follows Light/Dark");
  } catch (error) {
    if (pictures)
      await page
        .screenshot({ path: join(pictures, "look-navigation-failure.png") })
        .catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}
