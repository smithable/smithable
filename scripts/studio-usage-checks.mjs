import assert from "node:assert/strict";

import { openSmith } from "./studio-form-checks.mjs";

export async function checkStudioUsage(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    const local = await page.request.get(`${base}/api/model-usage`);
    assert.equal(local.headers()["cache-control"], "no-store");
    assert.deepEqual(await local.json(), {}, "a local Studio invented account figures");
    const project = await (await page.request.get(`${base}/api/project`)).json();
    await page.addInitScript(
      ({ name }) => {
        for (const key of ["guideDone", "presented", "zoneAsked", "ownerAsked"])
          localStorage.setItem(`${key}:${name}`, "1");
        localStorage.setItem("smithable:smith", "floating");
      },
      { name: project.name },
    );
    let payload = {};
    let reads = 0;
    const direct = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/v1/usage") direct.push(request.url());
    });
    await page.route("**/api/model-usage", (route) => {
      reads++;
      return route.fulfill({ json: payload });
    });
    await page.route("**/api/ask", (route) =>
      route.fulfill({
        json: {
          kind: "question",
          id: "usage-fixture",
          question: "Which synthetic option?",
          options: ["Keep it", "Cancel"],
          usage: "Smithable model (private-fixture-model) · €0.0021",
        },
      }),
    );
    await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === "/api/model-usage"),
      page.goto(base),
    ]);
    await openSmith(page);
    const input = page.getByRole("textbox", { name: "Describe a change, or ask a question" });
    await input.waitFor();
    const bar = page.getByRole("region", { name: "AI help usage" });
    assert.equal(await bar.count(), 0, "no account data must mean no bar");
    payload = {
      window: {
        used: 0.2,
        allowed: 0.5,
        remaining: 0.3,
        resetsAt: "2026-11-16T10:00:00.000Z",
        currency: "EUR",
      },
      paused: { is: true, reason: "shared" },
      recent: [
        { at: "2026-11-15T10:00:00.000Z", kind: "change", cost: 0.0021 },
        { at: "2026-11-15T09:00:00.000Z", kind: "assistant", cost: 0.1234 },
      ],
    };
    await page.reload();
    await openSmith(page);
    await bar.waitFor();
    const toggle = bar.getByRole("button");
    assert.ok((await toggle.textContent()).includes("€0.20 of €0.50 used"));
    assert.equal(await bar.getByRole("progressbar").getAttribute("value"), "0.2");
    assert.equal(await bar.getByRole("progressbar").getAttribute("max"), "0.5");
    await bar.getByText(/AI help is paused for the service/).waitFor();
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    await toggle.click();
    const rows = bar.getByRole("list", { name: "Recent AI charges" }).getByRole("listitem");
    assert.equal(await rows.count(), 2);
    assert.match(await rows.nth(0).textContent(), /Change.*€0\.0021/);
    assert.match(await rows.nth(1).textContent(), /App assistant.*€0\.1234/);
    const before = reads;
    await input.fill("Please explain this synthetic request.");
    const refreshed = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/model-usage",
    );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page
      .locator("[data-receipt]")
      .filter({ hasText: /Nothing changed; AI was asked/ })
      .waitFor();
    await refreshed;
    assert.equal(await page.getByText(/private-fixture-model/).count(), 0);
    await page.waitForFunction(
      () =>
        document.querySelector('textarea[aria-label="Describe a change, or ask a question"]')
          ?.disabled === false,
    );
    assert.ok(reads > before, "the allowance did not refresh after the request");
    assert.deepEqual(direct, [], "the browser called the gateway directly");
    console.log(
      "  ✓ Smith usage: no local bar, personal window, newest charges with small costs, shared pause, refresh and anonymous receipt",
    );
  } finally {
    await page.close();
  }
}
