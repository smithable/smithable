import assert from "node:assert/strict";

export async function checkStudioValidation(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  let plain = true;
  let refused;
  try {
    await page.addInitScript(() => {
      localStorage.setItem(
        "smithable:windows",
        JSON.stringify({
          layout: "three",
          slots: ["smith", "preview", "manual"],
          manual: "nocode",
        }),
      );
      localStorage.setItem("smithable:smith", "docked");
    });
    await page.route("**/api/op", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      if (!body.ok && body.diagnostics?.some((d) => d.code === "invalid-timer")) {
        refused = body;
        // Exercise both the additive engine contract and an older diagnostic without it.
        body.diagnostics = body.diagnostics.map((d) => ({
          ...d,
          plain:
            plain && d.code === "invalid-timer"
              ? {
                  message: "The timer markOverdue needs one way to say when it runs.",
                  path: ["timers", "markOverdue"],
                }
              : undefined,
        }));
      }
      await route.fulfill({ response, json: body });
    });
    await page.goto(`${base}?guide=off`);
    const form = page.getByRole("region", { name: "What the app does", exact: true });
    await form.waitFor();
    const timers = form.locator('details[data-key="timers"]');
    if (!(await timers.isVisible()))
      await form
        .locator(":scope > div > details")
        .filter({ has: page.locator("summary") })
        .last()
        .locator("summary")
        .first()
        .click();
    await timers.locator(":scope > summary").click();
    const name = timers.locator('input[placeholder="Name…"]');
    await name.fill("markOverdue");
    await timers.getByRole("button", { name: "Add", exact: true }).click();
    const notice = page.locator("[data-validation-notice]");
    const timerError = notice.locator('[data-validation-code="invalid-timer"]');
    await timerError
      .getByText("The timer markOverdue needs one way to say when it runs.", { exact: true })
      .waitFor();
    assert.ok(refused?.diagnostics?.length, "real operation response lost validator diagnostics");
    console.log("  ✓ Real refusal preserves structured diagnostics and plain text");
    assert.equal(
      await timerError.getByText(/one of the three/).isVisible(),
      false,
      "grammar leaked into No code",
    );
    assert.equal(await page.locator("[data-guide-lit]").count(), 0);
    // Close the section first: the target button must bring it back into view.
    await timers.locator(":scope > summary").click();
    await notice.getByRole("button", { name: "Open timer", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('details[data-key="timers"]')?.open);
    console.log("  ✓ Validation target opens timer settings");
    await timerError.getByText("Code details", { exact: true }).click();
    await timerError.getByText(/one of the three/).waitFor();
    await page
      .locator('[data-guide="manual"]')
      .getByRole("tab", { name: "Code", exact: true })
      .click();
    await timerError.getByText(/one of the three/).waitFor();
    assert.equal(await timerError.getByText("Code details", { exact: true }).count(), 0);
    await page
      .locator('[data-guide="manual"]')
      .getByRole("tab", { name: "No code", exact: true })
      .click();
    await notice.getByRole("button", { name: "Dismiss", exact: true }).click();
    await notice.waitFor({ state: "detached" });
    plain = false;
    if (!(await timers.isVisible()))
      await form.locator(":scope > div > details").last().locator(":scope > summary").click();
    if (!(await timers.evaluate((el) => el.open))) await timers.locator(":scope > summary").click();
    await name.fill("markOverdue");
    await timers.getByRole("button", { name: "Add", exact: true }).click();
    const fallback = page
      .getByRole("alert")
      .filter({ hasText: "A setting in this app needs attention" });
    await fallback.waitFor();
    assert.equal(await timerError.getByText(/one of the three/).isVisible(), false);
    await timerError.getByText("Code details", { exact: true }).click();
    await timerError.getByText(/one of the three/).waitFor();
    await fallback.getByRole("button", { name: "Dismiss", exact: true }).click();
    console.log(
      "  ✓ Validation: real refusal diagnostics, plain banner, timer target, Code grammar, older-engine fallback",
    );
  } finally {
    await page.close();
  }
}
