import assert from "node:assert/strict";

import { openSmith } from "./studio-form-checks.mjs";

export async function checkStudioDraft(browser, base) {
  for (const kind of [
    "answer",
    "question",
    "same text",
    "follow-up",
    "apply",
    "proposal draft",
    "people",
  ]) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    let release = () => {};
    try {
      const project = await (await page.request.get(`${base}/api/project`)).json();
      await page.addInitScript((name) => {
        for (const key of ["guideDone", "presented", "zoneAsked", "ownerAsked"])
          localStorage.setItem(`${key}:${name}`, "1");
        localStorage.setItem("smithable:smith", "docked");
      }, project.name);
      let arrived;
      const pending = new Promise((resolve) => {
        arrived = resolve;
      });
      const held = new Promise((resolve) => {
        release = resolve;
      });
      const requests = [];
      let asks = 0;
      await page.route("**/api/ask", async (route) => {
        requests.push(route.request().postDataJSON().request);
        asks++;
        if (kind !== "apply" && !(kind === "follow-up" && asks === 1)) {
          arrived();
          await held;
        }
        const reply =
          kind === "question"
            ? {
                kind: "question",
                question: "When should the reminder run?",
                options: ["Morning", "Evening"],
              }
            : kind === "apply" || kind === "proposal draft"
              ? {
                  kind: "change",
                  operations: [{ op: "setApp", args: {}, description: "Update the app" }],
                }
              : { kind: "answer", text: `Draft fixture answer ${asks}.`, concepts: [] };
        await route.fulfill({ json: { id: `draft-${kind}-${asks}`, usage: "", ...reply } });
      });
      await page.route("**/api/ask/apply", async (route) => {
        arrived();
        await held;
        await route.fulfill({ json: { ok: true, output: "Done." } });
      });
      await page.route("**/api/people", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        arrived();
        await held;
        await route.fulfill({ json: { running: false, stopped: "Sample users paused." } });
      });
      await page.goto(`${base}?guide=off`);
      await openSmith(page);
      const input = page.getByRole("textbox", { name: "Describe a change, or ask a question" });
      const send = page.getByRole("button", { name: "Send", exact: true });
      await input.waitFor();
      await input.fill(kind === "people" ? "pause the sample users" : "Add an invoice reminder");
      await send.click();
      if (kind === "follow-up") {
        await page
          .getByRole("button", { name: "Working…", exact: true })
          .waitFor({ state: "hidden" });
        assert.equal(await input.inputValue(), "", "an untouched submitted draft was not cleared");
        await input.fill("also tomorrow");
        await send.click();
      }
      if (kind === "apply") await page.getByRole("button", { name: "Apply", exact: true }).click();
      await pending;
      assert.ok(await input.isEnabled(), "typing another draft was disabled while busy");
      const draft = kind === "same text" ? "Add an invoice reminder" : "Keep this newer draft";
      if (kind !== "follow-up") {
        await input.fill("");
        await input.fill(draft);
      }
      const path =
        kind === "people" ? "/api/people" : kind === "apply" ? "/api/ask/apply" : "/api/ask";
      const responded = page.waitForResponse(
        (response) => new URL(response.url()).pathname === path,
      );
      release();
      await responded;
      if (kind === "proposal draft") {
        assert.equal(await input.inputValue(), draft, "proposal creation lost the newer draft");
        await page.getByRole("button", { name: "Apply", exact: true }).click();
      }
      await send.waitFor();
      if (kind === "apply" || kind === "proposal draft")
        await page
          .getByRole("region", { name: "Proposal", exact: true })
          .waitFor({ state: "detached" });
      else
        await page
          .getByRole("button", { name: "Working…", exact: true })
          .waitFor({ state: "hidden" });
      const expected = kind === "follow-up" ? "" : draft;
      assert.equal(await input.inputValue(), expected, `${kind} completion lost the newer draft`);
      assert.equal(
        await input.evaluate(() => sessionStorage.getItem("smithable:ask-draft")),
        expected || null,
      );
      if (kind === "follow-up")
        assert.equal(
          requests[1],
          "Add an invoice reminder (also tomorrow)",
          "follow-up context was lost",
        );
      else assert.ok(await send.isEnabled(), `${kind} left the retained draft unsendable`);
      console.log(`  ✓ Smith draft: ${kind}`);
    } finally {
      release();
      await page.close();
    }
  }
}
