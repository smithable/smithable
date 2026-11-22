import assert from "node:assert/strict";
import { openStudioGuide } from "./studio-form-checks.mjs";

export async function checkStudioGuideSpeech(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let notice = false;
  try {
    await page.addInitScript(() => {
      // This check needs a stop after Ask me to observe the tour after the demonstration.
      localStorage.setItem("smithable:changes-beside-smith", "1");
      localStorage.setItem(
        "smithable:speech",
        JSON.stringify({
          sound: true,
          mic: "off",
          rate: 1.5,
          voice: "Google UK English Male",
          told: true,
        }),
      );
      window.guideFixture = { spoken: [], starts: 0 };
      const NativeEvents = window.EventSource;
      window.EventSource = class extends NativeEvents {
        constructor(url) {
          super(url);
          window.guideFixture.events = this;
        }
      };
      window.SpeechRecognition = class {
        start() {
          window.guideFixture.starts++;
        }
        stop() {
          this.onend?.();
        }
        abort() {
          this.onend?.();
        }
      };
      window.webkitSpeechRecognition = undefined;
      const synth = new EventTarget();
      synth.getVoices = () => [
        { name: "Google UK English Male", lang: "en-GB", localService: false },
      ];
      synth.cancel = () => {
        synth.speaking = false;
      };
      synth.pause = () => {};
      synth.resume = () => {};
      synth.speak = (utterance) => {
        window.guideFixture.spoken.push({
          text: utterance.text,
          voice: utterance.voice?.name,
          rate: utterance.rate,
        });
        synth.speaking = true;
        utterance.onstart?.();
        // Kept speaking until a stop or the next guide line replaces it.
      };
      Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
      window.SpeechSynthesisUtterance = class {
        constructor(text) {
          this.text = text;
          this.rate = 1;
        }
      };
    });
    await page.route("**/vad/**", (route) => route.abort());
    await page.route("**/api/project", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.speech = [{ name: "browser" }];
      // The app as made (T1163), so the picker opens on a project earlier checks changed.
      body.asMade = true;
      if (notice) body.notice = "Fixture error while editing.";
      else delete body.notice;
      await route.fulfill({ response, json: body });
    });
    await page.goto(base);
    await page
      .getByRole("dialog", { name: "Choose a look", exact: true })
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    const overlay = page.getByRole("dialog", { name: /^Smith presents / });
    await overlay.getByRole("button", { name: "Skip", exact: true }).click();
    await overlay.waitFor({ state: "detached" });
    const card = (anchor) => page.locator(`[data-guide-card="${anchor}"]:visible`);
    await card("preview").waitFor({ timeout: 30000 });
    await card("preview").getByText("Preview", { exact: true }).waitFor();
    const input = page.getByRole("textbox", { name: "Describe a change, or ask a question" });
    assert.ok(await input.isDisabled());
    assert.ok(await page.getByRole("button", { name: /^Mic:/ }).isDisabled());
    assert.ok(await page.getByRole("button", { name: "Send", exact: true }).isDisabled());
    await page.waitForFunction(() =>
      window.guideFixture.spoken.some((s) => s.text.includes("This is your app, running")),
    );
    const preview = await page.evaluate(() =>
      window.guideFixture.spoken.filter((s) => s.text.includes("This is your app, running")),
    );
    assert.equal(preview.length, 1);
    assert.equal(preview[0].voice, "Google UK English Male");
    assert.equal(preview[0].rate, 1.5);
    await page.keyboard.press("Control+Shift+Space");
    assert.equal(await page.evaluate(() => window.guideFixture.starts), 0);
    await card("preview").getByRole("button", { name: "Next", exact: true }).click();
    await card("behavior").waitFor();
    const step = await card("behavior").locator("p").first().textContent();
    assert.ok(await input.isDisabled());
    // The guide points at Behavior. Using its tab is still an editing action.
    const editor = page
      .locator('[data-window="manual"]')
      .getByRole("tab", { name: "Behavior", exact: true });
    await editor.click();
    await page.locator("[data-guide-card]:visible").waitFor({ state: "detached" });
    assert.equal(await page.locator("[data-guide-lit]").count(), 0);
    assert.ok(await input.isEnabled());
    console.log("  ✓ Guide pauses when editing starts");
    const resume = async () => {
      await openStudioGuide(page);
    };
    await resume();
    await card("behavior").waitFor();
    await card("behavior").getByText(step, { exact: true }).waitFor();
    console.log("  ✓ Guide pauses for errors and resumes the saved stop");
    assert.ok(await input.isDisabled(), "resumed guide left the input enabled");
    notice = true;
    await page.evaluate(() =>
      window.guideFixture.events.dispatchEvent(new MessageEvent("changed", { data: "{}" })),
    );
    const error = page.getByRole("alert").filter({ hasText: "Fixture error while editing." });
    await error.waitFor();
    assert.equal(
      await page.locator("[data-guide-lit]").count(),
      0,
      "guide highlight covers the error",
    );
    assert.equal(await page.locator("[data-guide-card]:visible").count(), 0);
    assert.ok(await input.isEnabled());
    await resume();
    assert.equal(await page.locator("[data-guide-lit]").count(), 0, "Guide reopened over an error");
    notice = false;
    await error.getByRole("button", { name: "Dismiss", exact: true }).click();
    await resume();
    await card("behavior").waitFor();
    await card("behavior").getByText(step, { exact: true }).waitFor();
    const visibleCard = page.locator("[data-guide-card]:visible");
    const reachDemo = async () => {
      for (let i = 0; i < 10; i++) {
        await visibleCard.waitFor();
        const anchor = await visibleCard.getAttribute("data-guide-card");
        await card(anchor).getByRole("button", { name: "Next", exact: true }).click();
        if (anchor === "change") break;
        await page.waitForFunction(
          (before) =>
            [...document.querySelectorAll("[data-guide-card]")].some(
              (el) => el.checkVisibility() && el.getAttribute("data-guide-card") !== before,
            ),
          anchor,
        );
      }
      await visibleCard.getByRole("button", { name: "Yes", exact: true }).click();
      for (const words of [
        "My way: I added a notes field",
        "The same change, by hand",
        "And this is the line it became",
      ]) {
        await visibleCard.getByText(words, { exact: false }).waitFor({ timeout: 60000 });
        console.log(`  ✓ Guide demonstration: ${words}`);
        assert.ok(await input.isDisabled(), "guide-owned change unlocked Smith's input");
        await visibleCard.getByRole("button", { name: "Next", exact: true }).click();
      }
      await visibleCard.getByText("Keep the field, or take it back?", { exact: true }).waitFor();
    };
    const done = card("changes").getByRole("button", { name: "Done", exact: true });
    await reachDemo();
    await visibleCard.getByRole("button", { name: "Undo", exact: true }).click();
    await done.waitFor();
    await page.getByRole("status").filter({ hasText: "Undid:" }).waitFor({ timeout: 60000 });
    assert.ok(await input.isDisabled(), "guide's own Undo paused the remaining tour");
    await done.click();
    await page.locator("[data-guide-card]:visible").waitFor({ state: "detached" });
    assert.ok(await input.isEnabled());
    await resume();
    await reachDemo();
    await visibleCard.getByRole("button", { name: "Keep", exact: true }).click();
    await done.click();
    assert.ok(await input.isEnabled());
    // Keep is a real local operation; restore the fixture after checking that path too.
    const undo = await page.request.post(`${base}/api/undo`, {
      data: {},
      headers: { "X-Smithable": "1" },
    });
    const undone = await undo.json();
    assert.equal(undone.ok, true, JSON.stringify(undone));
    console.log(
      "  ✓ Guide: selected voice, input lock, edit/error pause, same-stop resume, silent dismissal",
    );
  } finally {
    await page.close();
  }
}
