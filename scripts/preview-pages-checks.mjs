import assert from "node:assert/strict";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { projectRevision } from "../packages/cli/dist/project-revision.js";
import { P } from "./patience.mjs";

/** Uses only the test's existing authorized rows; never creates a preview record. */
export async function checkPreviewPages(page, dir) {
  const start = await page.evaluate(() => fetch("/api/start").then((r) => r.json()));
  assert(start.frames.length >= start.look.ir.pages.length);
  assert(start.frames.every((f) => f.id && (f.page || f.kind === "sign-in")));
  const initial = start.frames[0];
  const record = start.frames.find((f) => f.page === "customers" && f.kind === "record");
  const list = start.frames.find((f) => f.page === "customers" && f.kind === "page");
  if (!record || !list) throw new Error("Discovery check needs the CRM fixture");
  const source = projectRevision(dir);
  const db = new DatabaseSync(join(dir, "data/db/app.db"), { readOnly: true });
  const rows = () =>
    JSON.stringify([
      db.prepare("SELECT * FROM customers ORDER BY id").all(),
      db.prepare("SELECT * FROM orders ORDER BY id").all(),
    ]);
  const before = rows();
  const tabs = page.getByRole("group", { name: "Page", exact: true });
  try {
    await tabs.getByRole("button", { name: list.label, exact: true }).click();
    const listFrame = page.frameLocator(`iframe[data-frame="${list.label}-light"]`);
    await listFrame.locator("body[data-hydrated=true]").waitFor({ timeout: 60000 * P });
    const id = await listFrame
      .locator('[data-part="record-open"]')
      .first()
      .getAttribute("data-record-id");
    assert(id);
    await tabs.getByRole("button", { name: record.label, exact: true }).click();
    const shown = page.locator(`iframe[data-frame="${record.label}-light"]`);
    await shown.waitFor({ timeout: 60000 * P });
    assert.equal(
      new URL(await shown.getAttribute("src")).pathname,
      `${record.discoverFrom}/${encodeURIComponent(id)}`,
    );
    await page
      .frameLocator(`iframe[data-frame="${record.label}-light"]`)
      .locator("body[data-hydrated=true]")
      .waitFor({ timeout: 60000 * P });
    assert.equal(projectRevision(dir), source, "discovery wrote source");
    assert.equal(rows(), before, "discovery wrote domain data");
    if (process.env.CHECK_DISCOVERY === "1") {
      assert.notEqual(id, "1", "controlled fixture still contains record 1");
      const empty = start.frames.find((f) => f.page === "orders" && f.kind === "record");
      await tabs.getByRole("button", { name: empty.label, exact: true }).click();
      await page
        .getByRole("status")
        .filter({ hasText: "No readable record is shown" })
        .waitFor({ timeout: 30000 * P });
      assert.equal(rows(), before, "empty discovery populated data");
      assert.equal(await page.locator(`iframe[data-frame="${empty.label}-light"]`).count(), 0);
    }
    console.log(
      "  ✓ full page inventory; authorized existing record discovery; no source/domain-data write",
    );
  } finally {
    db.close();
    await tabs.getByRole("button", { name: initial.label, exact: true }).click();
  }
}

export async function checkPreviewTimeout(page) {
  const start = await page.evaluate(() => fetch("/api/start").then((r) => r.json()));
  const unready = await page.context().newPage();
  try {
    await unready.route(`${start.preview}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>Sign-in unavailable</body></html>",
      }),
    );
    await unready.goto(page.url());
    // An unrelated window on the allowed origin cannot acknowledge this owned iframe.
    await unready.evaluate(
      (origin) =>
        window.dispatchEvent(
          new MessageEvent("message", {
            origin,
            source: window,
            data: { source: "smithable-preview", type: "signed-in", path: "/" },
          }),
        ),
      new URL(start.preview).origin,
    );
    await unready
      .getByRole("alert")
      .filter({ hasText: "Preview sign-in has not completed" })
      .waitFor({ timeout: 30000 * P });
    assert.equal(
      await unready.locator("iframe[data-frame]").count(),
      0,
      "elapsed time was treated as authenticated success",
    );
    await unready.getByRole("button", { name: "Retry", exact: true }).click();
    await unready
      .getByRole("alert")
      .filter({ hasText: "Preview sign-in has not completed" })
      .waitFor({ state: "hidden" });
    console.log(
      "  ✓ auth deadline shows failure/Retry; wrong-frame reply cannot mark sign-in successful",
    );
  } finally {
    await unready.close();
  }
}
