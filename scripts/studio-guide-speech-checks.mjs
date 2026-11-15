import assert from "node:assert/strict";

export async function checkStudioGuideSpeech(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let notice = false;
  try {
    await page.addInitScript(() => {
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
      if (notice) body.notice = "Fixture error while editing.";
      else delete body.notice;
      await route.fulfill({ response, json: body });
    });
    await page.goto(base);
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
    await card("manual").waitFor();
    const step = await card("manual").locator("p").first().textContent();
    assert.ok(await input.isDisabled());
    const editor = page.locator('[data-guide="manual"] input:visible').first();
    await editor.click();
    await page.locator("[data-guide-card]:visible").waitFor({ state: "detached" });
    assert.equal(await page.locator("[data-guide-lit]").count(), 0);
    assert.ok(await input.isEnabled());
    const resume = async () => {
      await page.getByRole("button", { name: "Guide", exact: true }).click();
      await page.getByRole("menuitem", { name: "Tour Studio", exact: true }).click();
    };
    await resume();
    await card("manual").waitFor();
    await card("manual").getByText(step, { exact: true }).waitFor();
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
    await card("manual").waitFor();
    await card("manual").getByText(step, { exact: true }).waitFor();
    await card("manual").getByRole("button", { name: "Skip guide", exact: true }).click();
    await page.locator("[data-guide-card]:visible").waitFor({ state: "detached" });
    assert.ok(await input.isEnabled());
    console.log(
      "  ✓ Guide: selected voice, input lock, edit/error pause, same-stop resume, silent dismissal",
    );
  } finally {
    await page.close();
  }
}
