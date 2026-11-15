import assert from "node:assert/strict";

export async function checkStudioSpeech(browser, base) {
  for (const support of ["browser", "unavailable", "available", "missing"]) {
    const localOnly = support !== "browser";
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    try {
      await page.addInitScript((support) => {
        window.speechFixture = {
          starts: 0,
          checks: 0,
          local: false,
          rates: [],
          utterances: [],
          hold: false,
          pauses: 0,
          resumes: 0,
          behavior: "denied",
        };
        class Recognition {
          processLocally = false;
          static available() {
            window.speechFixture.checks++;
            return Promise.resolve(support);
          }
          start() {
            window.speechFixture.starts++;
            window.speechFixture.local = this.processLocally;
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
          value: support === "missing" ? undefined : Recognition,
          configurable: true,
        });
        Object.defineProperty(window, "webkitSpeechRecognition", {
          value: undefined,
          configurable: true,
        });
        const synth = new EventTarget();
        synth.getVoices = () => [
          { name: "Fixture voice", lang: "en-US", localService: true },
          { name: "Google UK English Female", lang: "en-GB", localService: false },
          { name: "Google UK English Male", lang: "en-GB", localService: false },
        ];
        synth.cancel = () => {
          synth.speaking = false;
        };
        synth.pause = () => {
          window.speechFixture.pauses++;
        };
        synth.resume = () => {
          window.speechFixture.resumes++;
        };
        synth.speak = (utterance) => {
          window.speechFixture.rates.push(utterance.rate);
          window.speechFixture.utterances.push(utterance);
          synth.speaking = true;
          utterance.onstart?.();
          if (!window.speechFixture.hold)
            queueMicrotask(() => {
              synth.speaking = false;
              utterance.onend?.();
            });
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
      }, support);
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
      const voice = page.getByLabel("Voice", { exact: true });
      if (support === "browser") {
        assert.equal(await voice.inputValue(), "Google UK English Male");
        assert.equal(
          await voice.locator("option").filter({ hasText: "Google UK English Female" }).count(),
          0,
        );
        const old = await page.evaluate(() => window.speechFixture.utterances.length);
        await voice.selectOption("Fixture voice");
        await page.waitForFunction(
          (before) => window.speechFixture.utterances.length > before,
          old,
        );
        assert.ok(
          await page.evaluate(() =>
            window.speechFixture.utterances.some((u) => u.text.includes("This is my voice")),
          ),
        );
      }
      await sound.click();
      await page
        .getByRole("button", { name: "Sound: off", exact: true })
        .getByText("Sound off")
        .waitFor();
      await page.getByLabel("Speaking speed", { exact: true }).selectOption("1.5");
      await page.reload();
      const off = page.getByRole("button", { name: "Sound: off", exact: true });
      await off.waitFor();
      assert.equal(await page.getByLabel("Speaking speed", { exact: true }).inputValue(), "1.5");
      await off.click();
      await page
        .getByRole("button", { name: "Sound: on", exact: true })
        .getByText("Sound on")
        .waitFor();
      assert.equal(
        await page.evaluate(() => window.speechFixture.checks),
        0,
        "local capability was probed without a gesture",
      );
      if (support === "missing") {
        await page.getByText("This browser cannot write out speech.", { exact: true }).waitFor();
        assert.ok(await page.getByRole("button", { name: /^Mic:/ }).isDisabled());
        assert.equal(
          await page
            .getByRole("button", { name: "Check on-device speech support", exact: true })
            .count(),
          0,
        );
      } else if (localOnly) {
        await page
          .getByText(
            "This project requires speech recognition on this computer. Check browser support before using the microphone.",
            { exact: true },
          )
          .waitFor();
        const check = page.getByRole("button", {
          name: "Check on-device speech support",
          exact: true,
        });
        await check.focus();
        await page.keyboard.press("Space");
        if (support === "available") {
          await page.getByRole("button", { name: "Automatic", exact: true }).waitFor();
          const mic = page.getByRole("button", { name: /^Mic:/ });
          await mic.focus();
          await page.keyboard.press("Space");
          await page.getByText(/Microphone access was refused/).waitFor();
          assert.equal(await page.evaluate(() => window.speechFixture.local), true);
        } else {
          await page
            .getByText(/This browser cannot provide it, so the microphone is unavailable/)
            .waitFor();
          assert.ok(await page.getByRole("button", { name: /^Mic:/ }).isDisabled());
          assert.equal(
            await page.evaluate(() => window.speechFixture.starts),
            0,
            "policy denied recognition still started",
          );
        }
        assert.equal(await page.evaluate(() => window.speechFixture.checks), 1);
      } else {
        await page.getByRole("button", { name: /^Mic:/ }).click();
        await page.getByText(/Microphone access was refused/).waitFor();
        await page.evaluate(() => {
          window.speechFixture.behavior = "throw";
        });
        await page.getByRole("button", { name: /^Mic:/ }).click();
        await page.getByText(/The browser could not start speech recognition/).waitFor();
        await page.evaluate(() => {
          window.speechFixture.hold = true;
        });
        // A fresh spoken reply uses the saved speed; this request is answered locally by rule.
        await page
          .getByRole("textbox", { name: "Describe a change, or ask a question" })
          .fill("Hi");
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await page.waitForFunction(() => window.speechFixture.rates.includes(1.5));
        const before = await page.evaluate(() => window.speechFixture.utterances.length);
        await page.getByRole("button", { name: "Sound: on", exact: true }).click();
        await page.getByRole("button", { name: "Sound: off", exact: true }).click();
        assert.equal(await page.evaluate(() => window.speechFixture.pauses), 1);
        assert.ok(await page.evaluate(() => window.speechFixture.resumes > 0));
        assert.equal(
          await page.evaluate(() => window.speechFixture.utterances.length),
          before,
          "resuming queued the current sentence again",
        );
        // Let the saved thread replace the optimistic timestamp, then change unrelated UI state.
        await page.waitForTimeout(700);
        await page.getByLabel("Speaking speed", { exact: true }).selectOption("1");
        assert.equal(
          await page.evaluate(() => window.speechFixture.utterances.length),
          before,
          "a server echo or render queued the reply again",
        );
        const completed = await page.evaluate((first) => {
          const texts = [];
          for (
            let i = first - 1;
            i < window.speechFixture.utterances.length && texts.length < 30;
            i++
          ) {
            const utterance = window.speechFixture.utterances[i];
            texts.push(utterance.text);
            utterance.onend?.();
          }
          return texts;
        }, before);
        assert.ok(completed.length < 30, "speech queue did not finish");
        assert.equal(
          new Set(completed).size,
          completed.length,
          "server echo duplicated queued speech",
        );
      }
      console.log(
        `  ✓ Smith speech ${support}: visible failure, saved sound/speed, introduction stays while reading`,
      );
    } finally {
      await page.close();
    }
  }
}
