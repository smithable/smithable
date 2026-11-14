import assert from "node:assert/strict";

export async function checkStudioSpeech(browser, base) {
  for (const localOnly of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    try {
      await page.addInitScript(() => {
        window.speechFixture = { starts: 0, rates: [], behavior: "denied" };
        class Recognition {
          static available() {
            return Promise.resolve("unavailable");
          }
          start() {
            window.speechFixture.starts++;
            if (window.speechFixture.behavior === "throw") throw new Error("fixture refused");
            queueMicrotask(() => {
              this.onerror?.({ error: "not-allowed" });
              this.onend?.();
            });
          }
          stop() {
            this.onend?.();
          }
          abort() {
            this.onend?.();
          }
        }
        Object.defineProperty(window, "SpeechRecognition", {
          value: Recognition,
          configurable: true,
        });
        const synth = new EventTarget();
        synth.getVoices = () => [{ name: "Fixture voice", lang: "en-US", localService: true }];
        synth.cancel = () => {};
        synth.speak = (utterance) => {
          window.speechFixture.rates.push(utterance.rate);
          utterance.onstart?.();
          queueMicrotask(() => utterance.onend?.());
        };
        Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
        Object.defineProperty(window, "SpeechSynthesisUtterance", {
          value: class {
            constructor(text) {
              this.text = text;
              this.rate = 1;
            }
          },
          configurable: true,
        });
      });
      await page.route("**/api/project", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        body.speech = [{ name: "browser", ...(localOnly ? { onDeviceOnly: true } : {}) }];
        await route.fulfill({ response, json: body });
      });
      await page.goto(base);
      const overlay = page.getByRole("dialog", { name: /^Smith presents / });
      const app = overlay.locator('[data-part="app"]');
      await app.waitFor({ timeout: 30000 });
      const count = await overlay.locator("[data-part]").count();
      await app.dblclick({ position: { x: 15, y: 15 } });
      assert.equal(
        await overlay.locator("[data-part]").count(),
        count,
        "reading inside advanced the presentation",
      );
      assert.ok(await overlay.isVisible(), "reading inside closed the presentation");
      await page
        .getByRole("button", { name: "Close presentation", exact: true })
        .click({ position: { x: 8, y: 8 } });
      await overlay.waitFor({ state: "detached" });
      await page.goto(`${base}/?guide=off`);
      const sound = page.getByRole("button", { name: "Sound: on", exact: true });
      await sound.click();
      await page
        .getByRole("button", { name: "Sound: off", exact: true })
        .getByText("Sound off")
        .waitFor();
      await page.getByLabel("Speaking speed", { exact: true }).selectOption("1.2");
      await page.reload();
      const off = page.getByRole("button", { name: "Sound: off", exact: true });
      await off.waitFor();
      assert.equal(await page.getByLabel("Speaking speed", { exact: true }).inputValue(), "1.2");
      await off.click();
      await page
        .getByRole("button", { name: "Sound: on", exact: true })
        .getByText("Sound on")
        .waitFor();
      if (localOnly) {
        await page
          .getByText(
            "This project requires speech recognition on this computer. Check browser support before using the microphone.",
            { exact: true },
          )
          .waitFor();
        await page
          .getByRole("button", { name: "Check on-device speech support", exact: true })
          .click();
        await page
          .getByText(/This browser cannot provide it, so the microphone is unavailable/)
          .waitFor();
        assert.ok(await page.getByRole("button", { name: /^Mic:/ }).isDisabled());
        assert.equal(
          await page.evaluate(() => window.speechFixture.starts),
          0,
          "policy denied recognition still started",
        );
      } else {
        await page.getByRole("button", { name: /^Mic:/ }).click();
        await page.getByText(/Microphone access was refused/).waitFor();
        await page.evaluate(() => {
          window.speechFixture.behavior = "throw";
        });
        await page.getByRole("button", { name: /^Mic:/ }).click();
        await page.getByText(/The browser could not start speech recognition/).waitFor();
        // A fresh spoken reply uses the saved speed; this request is answered locally by rule.
        await page
          .getByRole("textbox", { name: "Describe a change, or ask a question" })
          .fill("Hi");
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await page.waitForFunction(() => window.speechFixture.rates.includes(1.2));
      }
      console.log(
        `  ✓ Smith speech ${localOnly ? "on-device policy" : "browser refusal"}: visible failure, saved sound/speed, introduction stays while reading`,
      );
    } finally {
      await page.close();
    }
  }
}
