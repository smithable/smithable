import assert from "node:assert/strict";

const timerMessage =
  "The timer markOverdue needs one way to choose when it runs: a time of day, a schedule, or a date from its records.";

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
        // Keep the real engine metadata; only the older-engine case removes the optional field.
        if (!plain) body.diagnostics = body.diagnostics.map((d) => ({ ...d, plain: undefined }));
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
    await timerError.getByText(timerMessage, { exact: true }).waitFor();
    assert.ok(refused?.diagnostics?.length, "real operation response lost validator diagnostics");
    assert.deepEqual(refused.diagnostics.find((d) => d.code === "invalid-timer")?.plain, {
      message: timerMessage,
      path: ["timers", "markOverdue"],
    });
    console.log("  ✓ Real refusal preserves structured diagnostics and plain text");
    assert.equal(
      await timerError.getByText(/one of the three/).isVisible(),
      false,
      "grammar leaked into No code",
    );
    assert.equal(await page.locator("[data-guide-lit]").count(), 0);
    await page.getByRole("button", { name: "Guide", exact: true }).click();
    await page.getByRole("menuitem", { name: "Tour Studio", exact: true }).click();
    assert.equal(
      await page.locator("[data-guide-lit]").count(),
      0,
      "Guide reopened over a refusal",
    );
    assert.equal(await page.locator("[data-guide-card]:visible").count(), 0);
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
    // The target must wait for No code to mount, including after a narrow-screen window change.
    await page.setViewportSize({ width: 720, height: 900 });
    await notice.getByRole("button", { name: "Open timer", exact: true }).click();
    await form.waitFor();
    await page.waitForFunction(() => document.querySelector('details[data-key="timers"]')?.open);
    await page.setViewportSize({ width: 1600, height: 1000 });
    console.log("  ✓ Validation target opens No code from Code on a narrow screen");
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
    const broken = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    try {
      const text = "The fixture description needs another try.";
      let notice = true;
      await broken.route("**/api/project", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        if (notice) body.notice = text;
        else delete body.notice;
        notice = false;
        body.files.spec = "smithable: 0.1\napp: { name: Demo }\ntimers:\n  broken: {}\n";
        await route.fulfill({ response, json: body });
      });
      await broken.goto(`${base}?guide=off`);
      const error = broken.getByRole("alert").filter({ hasText: text });
      await error.waitFor();
      await broken.locator("[data-validation-notice]").waitFor();
      await error.getByRole("button", { name: "Dismiss", exact: true }).click();
      await error.waitFor({ state: "detached" });
      assert.ok(await broken.locator("[data-validation-notice]").isVisible());
      console.log("  ✓ A daemon notice stays readable and dismissible alongside spec errors");
    } finally {
      await broken.close();
    }
  } finally {
    await page.close();
  }
}
