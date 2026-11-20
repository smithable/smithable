import assert from "node:assert/strict";
import { join } from "node:path";
import { toolbarAction } from "./studio-form-checks.mjs";

export async function checkStudioHistory(page, phone, evidence) {
  const project = () =>
    page.evaluate(async () => {
      const { revision, trace, canRedo } = await (await fetch("/api/project")).json();
      return { revision, trace, canRedo };
    });
  const before = await project();
  const preview = page.frameLocator('iframe[title="App preview"]');
  const liveHeading = preview.getByRole("heading", { name: "Overview", exact: true });
  await (await toolbarAction(page, "Changes")).click();
  const changes = page.getByRole("dialog", { name: "Changes", exact: true });
  const history = changes.getByRole("list", { name: "Version history", exact: true });
  const rows = history.getByRole("listitem");
  await rows.first().getByText("Current version", { exact: true }).waitFor();
  assert.equal(before.canRedo, true);
  assert.equal(before.trace[0].isUndo, true);
  assert.deepEqual(
    await history.locator("time").evaluateAll((times) => times.map((time) => time.dateTime)),
    before.trace.map((entry) => entry.at),
  );
  assert.equal(await rows.first().getByRole("button").count(), 0);
  await rows.nth(1).getByText("Alternate version", { exact: true }).waitFor();
  await page.screenshot({ path: join(evidence, `history-${phone ? "phone" : "wide"}.png`) });

  if (phone) {
    await changes.getByRole("button", { name: "Close", exact: true }).click();
    return;
  }

  // Hosted Studio can list its history but its existing old-version server is local only.
  const hosted = await page.evaluate(async () => (await fetch("/api/project")).json());
  delete hosted.oldVersions;
  await page.route("**/api/project", (route) => route.fulfill({ json: hosted }));
  await page.reload();
  await (await toolbarAction(page, "Changes")).click();
  await rows.nth(1).getByText("Preview unavailable here", { exact: true }).waitFor();
  assert.equal(await history.getByRole("button").count(), 0);

  await page.unrouteAll({ behavior: "wait" });
  await page.reload();
  await (await toolbarAction(page, "Changes")).click();
  const applyDialog = page.getByRole("dialog", { name: "Apply this version", exact: true });
  await rows
    .nth(1)
    .getByRole("button", { name: /^Apply this version: / })
    .click();
  await applyDialog.getByRole("button", { name: "Apply this version", exact: true }).waitFor();
  assert.match(await applyDialog.innerText(), /Your records stay as they are\./);
  await applyDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await applyDialog.waitFor({ state: "detached" });
  const previewRow = rows.nth(1).getByRole("button", { name: /^Preview / });
  const old = page.getByRole("dialog", { name: "An old version", exact: true });
  const oldVersionRoute = "**/api/old-version";
  const { promise: pending, resolve: hold } = Promise.withResolvers();
  await page.route(oldVersionRoute, (route) =>
    route.request().method() === "POST" ? hold(route) : route.continue(),
  );
  const preparingTab = page.context().waitForEvent("page");
  await previewRow.click();
  const opening = await pending;
  const temporaryTab = await preparingTab;
  const cancel = old.getByRole("button", { name: "Cancel preview", exact: true });
  await cancel.press("Escape");
  await opening.fulfill({ status: 409, json: { ok: false, message: "Preview cancelled." } });
  await old.waitFor({ state: "detached" });
  await temporaryTab.close();
  await page.unroute(oldVersionRoute);

  const liveFrame = await page.locator('iframe[title="App preview"]').elementHandle();
  const openTab = page.context().waitForEvent("page");
  await previewRow.click();
  const oldTab = await openTab;
  try {
    await old.waitFor();
    // Opening the historical viewer must not tear down the live iframe.
    assert.equal(await liveFrame.evaluate((frame) => frame.isConnected), true);
    const back = old.getByRole("button", { name: "Back to current", exact: true });
    await back.waitFor({ timeout: 90000 });
    await old.getByRole("heading", { name: "Viewing an old version", exact: true }).waitFor();
    assert.equal(await old.evaluate((dialog) => dialog.matches(":modal")), true);
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+Shift+z");

    await oldTab.waitForURL((url) => url.hostname === "127.0.0.1");
    const heading = oldTab.getByRole("heading", { name: "Edited in Code", exact: true });
    const signIn = oldTab.getByRole("button", { name: "Sign in as admin", exact: true });
    await heading.or(signIn).first().waitFor({ timeout: 60000 });
    await oldTab.waitForLoadState("networkidle");
    // Like the other dev sign-ins, retry a click that arrives before hydration on a cold server.
    for (let attempt = 0; attempt < 3 && (await signIn.isVisible()); attempt++) {
      await signIn.click();
      const leftSignIn = await oldTab
        .waitForURL((url) => url.pathname !== "/sign-in", { timeout: 5000 })
        .then(
          () => true,
          () => false,
        );
      if (leftSignIn) break;
    }
    await heading.waitFor();
    assert.equal(await oldTab.evaluate(() => window.opener), null);

    await page.screenshot({ path: join(evidence, "history-viewing-old.png") });
    await oldTab.screenshot({ path: join(evidence, "history-isolated-app.png") });
    await page.route(oldVersionRoute, (route) =>
      route.request().method() === "DELETE"
        ? route.fulfill({ status: 500, body: "Fixture close failure" })
        : route.continue(),
    );
    await back.click();
    await old
      .getByRole("alert")
      .getByText("Studio could not close the old version. Try again.", { exact: true })
      .waitFor();
    await page.unroute(oldVersionRoute);
    assert.deepEqual(await project(), before);

    // The first review has a stale digest. The real host must return the plan again, and the
    // next click must send the replacement digest, not the one displayed by the prior review.
    const applyRoute = "**/api/apply-version";
    const sent = [];
    await page.route(applyRoute, async (route) => {
      const request = route.request().postDataJSON();
      const response = await route.fetch();
      if (request.confirm) {
        sent.push(request);
        await route.fulfill({ response });
        return;
      }
      const review = await response.json();
      assert.match(review.plan, /^[0-9a-f]{12}$/);
      await route.fulfill({ response, json: { ...review, plan: "000000000000" } });
    });
    await page.bringToFront();
    await old.getByRole("button", { name: "Apply this version", exact: true }).click();
    const apply = applyDialog.getByRole("button", { name: "Apply this version", exact: true });
    try {
      await apply.click();
      await applyDialog.getByRole("alert").waitFor();
      assert.equal(sent[0].revision, before.revision);
      assert.equal(sent[0].plan, "000000000000");
      assert.deepEqual(await project(), before);
      const closed = oldTab.waitForEvent("close");
      await apply.click();
      await applyDialog.waitFor({ state: "detached" });
      await closed;
      assert.equal(sent[1].revision, before.revision);
      assert.match(sent[1].plan, /^[0-9a-f]{12}$/);
      assert.notEqual(sent[1].plan, sent[0].plan);
    } finally {
      await page.unroute(applyRoute);
    }
    await old.waitFor({ state: "detached" });
    assert.ok(oldTab.isClosed());
    await rows.first().getByText("Current version", { exact: true }).waitFor();
    assert.match((await project()).trace[0].description, /Applied the version from/);
    await changes.getByRole("button", { name: "Close", exact: true }).click();
    await preview.getByRole("heading", { name: "Edited in Code", exact: true }).waitFor();
    await page.getByRole("button", { name: "Undo this change", exact: true }).click();
    await liveHeading.waitFor();
    assert.deepEqual(
      await page.evaluate(async () => await (await fetch("/api/old-version")).json()),
      {},
    );
  } catch (error) {
    await oldTab.screenshot({ path: join(evidence, "isolated-app-failure.png") }).catch(() => {});
    throw error;
  } finally {
    await page.unroute(oldVersionRoute);
    if (!oldTab.isClosed()) {
      await page.evaluate(() =>
        fetch("/api/old-version", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", "X-Smithable": "1" },
          body: "{}",
        }),
      );
      await oldTab.close();
    }
  }
}
