import assert from "node:assert/strict";

export async function checkStudioSpeech(
  browser,
  base,
  supports = ["browser", "unavailable", "available", "missing"],
) {
  for (const support of supports) {
    const localOnly = support !== "browser";
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    try {
      await page.addInitScript((support) => {
        window.speechFixture = {
          starts: 0,
          captures: 0,
          released: 0,
          cancelledSpeech: 0,
          micPermission: "allow",
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
            window.speechFixture.noticeBeforeStart = document.body.textContent.includes(
              "Your voice is sent to Google to be written out",
            );
            if (window.speechFixture.behavior === "automatic") return;
            window.speechFixture.local = this.processLocally;
            if (window.speechFixture.behavior === "manual") return;
            if (window.speechFixture.behavior === "throw") throw new Error("fixture refused");
            if (window.speechFixture.behavior === "transcript") {
              queueMicrotask(() => {
                this.onresult?.({
                  resultIndex: 0,
                  results: [
                    Object.assign([{ transcript: window.speechFixture.transcript ?? "Hi" }], {
                      isFinal: true,
                    }),
                  ],
                });
                this.onend?.();
              });
              return;
            }
            queueMicrotask(() => {
              this.onerror?.({ error: "not-allowed" });
              this.onend?.();
            });
          }
          stop() {
            if (window.speechFixture.behavior === "automatic") {
              this.onresult?.({
                resultIndex: 0,
                results: [
                  Object.assign([{ transcript: window.speechFixture.transcript ?? "Hi" }], {
                    isFinal: true,
                  }),
                ],
              });
            }
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
        const track = {
          stop() {
            window.speechFixture.released++;
          },
          getSettings: () => ({}),
        };
        Object.defineProperty(navigator, "mediaDevices", {
          configurable: true,
          value: {
            async getUserMedia() {
              const fixture = window.speechFixture;
              fixture.captures++;
              if (fixture.micPermission === "deny")
                throw new DOMException("Fixture permission refused", "NotAllowedError");
              if (fixture.micPermission === "hold")
                await new Promise((resolve) => {
                  fixture.releasePermission = resolve;
                });
              return { getTracks: () => [track], getAudioTracks: () => [track] };
            },
          },
        });
        const connect = {
          connect(target) {
            return target;
          },
        };
        Object.defineProperty(window, "AudioContext", {
          configurable: true,
          value: class {
            destination = {};
            sampleRate = 16000;
            audioWorklet = { async addModule() {} };
            async resume() {}
            async close() {}
            createGain() {
              return { ...connect, gain: { value: 1 } };
            }
            createMediaStreamSource() {
              return connect;
            }
          },
        });
        Object.defineProperty(window, "AudioWorkletNode", {
          configurable: true,
          value: class {
            constructor() {
              window.speechFixture.worklet = this;
            }
            port = {};
            connect(target) {
              return target;
            }
          },
        });
        const synth = new EventTarget();
        synth.getVoices = () => [
          { name: "Fixture voice", lang: "en-US", localService: true },
          { name: "Google UK English Female", lang: "en-GB", localService: false },
          { name: "Google UK English Male", lang: "en-GB", localService: false },
        ];
        synth.cancel = () => {
          window.speechFixture.cancelledSpeech++;
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
      await page.route("**/vad/**", (route) => route.abort());
      await page.route("**/api/project", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        body.speech = [{ name: "browser", ...(localOnly ? { onDeviceOnly: true } : {}) }];
        await route.fulfill({ response, json: body });
      });
      if (support === "browser") {
        const project = await (await fetch(`${base}/api/project`)).json();
        await page.addInitScript((app) => {
          sessionStorage.setItem(
            "smithable:assumptions",
            JSON.stringify({
              app,
              assumptions: [
                {
                  part: "app",
                  question: "Who can use this app?",
                  chosen: "Invited people",
                  options: ["Invited people", "Anyone with the link"],
                },
              ],
            }),
          );
        }, project.name);
      }
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
      if (support === "browser") {
        await overlay.locator('[data-assumption="app"]').waitFor();
        await page.waitForFunction(
          (before) =>
            document
              .querySelector('[role="dialog"][aria-label^="Smith presents "]')
              ?.querySelectorAll("[data-part]").length > before,
          count,
          { timeout: 8000 },
        );
        assert.equal(
          await overlay.locator('[data-assumption="app"][data-answered]').count(),
          0,
          "an optional assumption was answered instead of being left open",
        );
      }
      await page
        .getByRole("button", { name: "Close presentation", exact: true })
        .click({ position: { x: 8, y: 8 } });
      await overlay.waitFor({ state: "detached" });
      await page.goto(`${base}/?guide=off`);
      const sound = page.getByRole("button", { name: "Turn Smith's voice off", exact: true });
      const settings = page.getByRole("button", { name: "Voice settings", exact: true });
      const voice = page.getByRole("combobox", { name: "Voice", exact: true });
      const speed = page.getByRole("combobox", { name: "Speed", exact: true });
      assert.equal(await voice.isVisible(), false);
      await sound.focus();
      await page.keyboard.press("Tab");
      await settings.getByRole("tooltip", { name: "Voice settings", exact: true }).waitFor();
      await page.keyboard.press("Enter");
      await voice.waitFor();
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
      await speed.selectOption("1.5");
      await speed.press("Escape");
      assert.equal(await settings.evaluate((element) => element === document.activeElement), true);
      await voice.waitFor({ state: "hidden" });
      await sound.click();
      const off = page.getByRole("button", { name: "Turn Smith's voice on", exact: true });
      await off.waitFor();
      await page.reload();
      await off.waitFor();
      await settings.click();
      assert.equal(await speed.inputValue(), "1.5");
      if (support === "browser") assert.equal(await voice.inputValue(), "Fixture voice");
      await off.click();
      await sound.waitFor();
      await voice.waitFor({ state: "hidden" });
      assert.equal(
        await page.evaluate(() => window.speechFixture.checks),
        0,
        "local capability was probed without a gesture",
      );
      if (support === "missing") {
        await page
          .getByRole("status")
          .filter({ hasText: /^This browser cannot write out speech\.$/ })
          .waitFor();
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
          await page.getByRole("button", { name: "Start call", exact: true }).waitFor();
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
        await page.keyboard.press("Control+Shift+Space");
        await page.getByText(/Microphone access was refused/).waitFor();
        assert.equal(
          await page.evaluate(() => window.speechFixture.noticeBeforeStart),
          true,
          "the keyboard-first provider notice was not rendered before recognition started",
        );
        await page.evaluate(() => {
          window.speechFixture.behavior = "throw";
        });
        await page.getByRole("button", { name: /^Mic:/ }).click();
        await page.getByText(/The browser could not start speech recognition/).waitFor();
        await page.evaluate(() => {
          window.speechFixture.behavior = "manual";
        });
        const mic = page.getByRole("button", { name: /^Mic:/ });
        await mic.click();
        await page.getByRole("button", { name: "Mic: on", pressed: true }).waitFor();
        await mic.click();
        await page.getByRole("button", { name: "Mic: off", pressed: false }).waitFor();
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
        const pauses = await page.evaluate(() => window.speechFixture.pauses);
        await page.getByRole("button", { name: "Turn Smith's voice off", exact: true }).click();
        await page.getByRole("button", { name: "Turn Smith's voice on", exact: true }).click();
        assert.equal(await page.evaluate(() => window.speechFixture.pauses), pauses + 1);
        assert.ok(await page.evaluate(() => window.speechFixture.resumes > 0));
        assert.equal(
          await page.evaluate(() => window.speechFixture.utterances.length),
          before,
          "resuming queued the current sentence again",
        );
        // Let the saved thread replace the optimistic timestamp, then change unrelated UI state.
        await page.waitForTimeout(700);
        await settings.click();
        await speed.selectOption("1");
        await speed.press("Escape");
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
        const input = page.getByRole("textbox", { name: "Describe a change, or ask a question" });
        await page.evaluate(() => {
          window.speechFixture.behavior = "transcript";
        });
        await page.keyboard.press("Control+Shift+Space");
        await input.waitFor();
        await page.waitForFunction(
          () =>
            document.querySelector('textarea[aria-label="Describe a change, or ask a question"]')
              ?.value === "Hi",
        );
        await page.waitForTimeout(1700);
        assert.equal(await input.inputValue(), "Hi", "manual dictation sent without a call");
        await page.getByText(/Your voice is sent to Google to be written out/).waitFor();
        assert.equal(
          await page.getByText(/Your voice is sent to Google to be written out/).count(),
          1,
        );
        await input.fill("");
        const startCall = page.getByRole("button", { name: "Start call", exact: true });
        const endCall = page.getByRole("button", { name: "End call", exact: true });
        assert.equal(await page.getByRole("button", { name: /^Auto / }).count(), 0);
        await page.evaluate(() => {
          window.speechFixture.behavior = "automatic";
          window.speechFixture.hold = false;
        });
        await startCall.click();
        await callGreetingFinished(page, 1);
        await utterWhileSilent(page);
        await page.waitForFunction(
          () =>
            document.querySelector('textarea[aria-label="Describe a change, or ask a question"]')
              ?.value === "Hi",
        );
        await endCall.click();
        await startCall.click();
        await callGreetingFinished(page, 2);
        await page.waitForTimeout(1700);
        assert.equal(await input.inputValue(), "Hi", "an old send timer survived ending a call");
        await input.fill("");
        await utterWhileSilent(page);
        await page.waitForFunction(
          () =>
            document.querySelector('textarea[aria-label="Describe a change, or ask a question"]')
              ?.value === "Hi",
        );
        await page.waitForFunction(
          () =>
            document.querySelector('textarea[aria-label="Describe a change, or ask a question"]')
              ?.value === "",
        );
        assert.equal(await page.evaluate(() => window.speechFixture.captures), 2);
        await endCall.click();
        await page.reload();
        await page.getByRole("button", { name: "Start call", exact: true }).waitFor();
        assert.equal(
          await page.getByText(/Your voice is sent to Google to be written out/).count(),
          0,
          "the first-use notice was repeated on reload",
        );
        await checkSmithQuestions(page);
        await checkSmithCall(page);
      }
      console.log(
        `  ✓ Smith speech ${support}: visible failure, saved sound/speed, introduction stays while reading`,
      );
    } finally {
      await page.close();
    }
  }
}

async function callGreetingFinished(page, calls) {
  await page.waitForFunction(
    (count) =>
      window.speechFixture.utterances.filter((u) => u.text === "I’m listening.").length === count &&
      !window.speechSynthesis.speaking,
    calls,
  );
}

export async function feedSpeechFrames(page, fixture, voiced) {
  await page.evaluate(
    ({ fixture, voiced }) => {
      const port = window[fixture].worklet.port;
      for (let frame = 0; frame < (voiced ? 12 : 26); frame++) {
        const data = voiced
          ? Float32Array.from({ length: 512 }, (_, i) => 0.3 * Math.sin(i * 0.3))
          : new Float32Array(512);
        port.onmessage({ data });
      }
    },
    { fixture, voiced },
  );
}

async function utterWhileSilent(page) {
  await feedSpeechFrames(page, "speechFixture", true);
  await feedSpeechFrames(page, "speechFixture", false);
}

async function checkSmithCall(page) {
  // A phone keeps the preview visible when the call is hidden. Its audio state avoids animation.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL("?guide=off", page.url()).href);
  const header = page.locator("[data-studio-header]");
  const face = header.getByRole("button", { name: "Smith", exact: true });
  const start = page.getByRole("button", { name: "Start call", exact: true });
  const endHidden = header.getByRole("button", { name: "End call", exact: true });
  const speaking = header.getByRole("status").filter({ hasText: /^Smith is speaking$/ });
  const hint = header.getByRole("button", { name: "Click Smith to bring him back.", exact: true });
  await face.click();
  const buttons = [
    page.getByRole("button", { name: "Mic: off", exact: true }),
    start,
    page.getByRole("button", { name: /^Turn Smith's voice (on|off)$/ }),
    page.getByRole("button", { name: "Voice settings", exact: true }),
  ];
  const boxes = await Promise.all(buttons.map((button) => button.boundingBox()));
  assert.ok(boxes.every((box) => box && box.width >= 24 && box.height >= 24));
  assert.equal(new Set(boxes.map((box) => box.y)).size, 1);
  const ownerSound = page.getByRole("button", { name: "Turn Smith's voice off", exact: true });
  if (await ownerSound.isVisible()) await ownerSound.click();
  await page.evaluate(() => {
    window.speechFixture.hold = true;
  });
  await start.click();
  const end = page.locator("[data-speech]").getByRole("button", { name: "End call", exact: true });
  assert.equal(await end.locator("svg").getAttribute("fill"), "currentColor");
  await page.waitForFunction(() =>
    window.speechFixture.utterances.some((u) => u.text === "Hi, it’s Smith."),
  );
  assert.equal(await page.evaluate(() => window.speechFixture.captures), 1);
  await face.click();
  await speaking.waitFor();
  await hint.waitFor();
  assert.equal(await face.getAttribute("aria-describedby"), "smith-hidden-audio");
  assert.equal(await speaking.evaluate((node) => getComputedStyle(node).animationName), "none");
  assert.equal(await page.evaluate(() => window.speechFixture.released), 0);
  await page.evaluate(() => window.speechFixture.utterances.at(-1).onend?.());
  await page.waitForFunction(() =>
    window.speechFixture.utterances.some((u) => u.text === "I’m listening."),
  );
  await page.evaluate(() => {
    window.speechFixture.utterances.at(-1).onend?.();
    window.speechFixture.behavior = "automatic";
    window.speechFixture.transcript = "Hi Smith";
  });
  await header
    .getByRole("status")
    .filter({ hasText: /^Listening$/ })
    .waitFor();
  let heard;
  await page.route("**/api/ask", (route) => {
    heard = route.request().postDataJSON().request;
    return route.fulfill({
      json: {
        kind: "answer",
        id: "hidden-call-fixture",
        text: "I heard you with Smith hidden.",
        usage: "",
      },
    });
  });
  await utterWhileSilent(page);
  await page.waitForFunction(() =>
    window.speechFixture.utterances.some((u) => u.text === "I heard you with Smith hidden."),
  );
  assert.equal(heard, "Hi Smith");
  await speaking.waitFor();
  await endHidden.click();
  await endHidden.waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => window.speechFixture.released), 1);
  assert.equal(await page.evaluate(() => window.speechSynthesis.speaking), false);
  assert.equal(await face.evaluate((button) => document.activeElement === button), true);

  // Permission can be denied after pressing Start call, and the same controls can retry.
  await face.click();
  await page.getByRole("button", { name: "Turn Smith's voice on", exact: true }).waitFor();
  await page.evaluate(() => {
    window.speechFixture.micPermission = "deny";
  });
  await start.click();
  await page.getByText(/Microphone access was refused.*You can type instead/).waitFor();
  assert.equal(await start.isEnabled(), true);
  assert.equal(
    await page
      .getByRole("textbox", { name: "Describe a change, or ask a question", exact: true })
      .isEnabled(),
    true,
  );

  // End call is also reachable while the permission prompt is outstanding.
  await page.evaluate(() => {
    window.speechFixture.micPermission = "hold";
  });
  await start.click();
  await page.waitForFunction(() => Boolean(window.speechFixture.releasePermission));
  await face.click();
  await endHidden.waitFor();
  assert.equal(await hint.isVisible(), false, "the first-hide hint was repeated");
  await endHidden.click();
  await page.evaluate(() => window.speechFixture.releasePermission());
  await page.waitForFunction(() => window.speechFixture.released === 2);
  await endHidden.waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => window.speechSynthesis.speaking), false);

  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(new URL("?guide=off", page.url()).href);
  await face.click();
  await page.getByRole("button", { name: "Dock", exact: true }).click();
  const dock = page.getByRole("heading", { name: "Ask Smith", exact: true });
  await dock.waitFor();
  await page.evaluate(() => {
    window.speechFixture.behavior = "manual";
  });
  const mic = page.getByRole("button", { name: "Mic: off", exact: true });
  await mic.click();
  await page.getByRole("button", { name: "Mic: on", exact: true }).waitFor();
  await page.getByRole("button", { name: "Close Smith", exact: true }).click();
  await dock.waitFor({ state: "hidden" });
  await header.getByRole("button", { name: "Stop listening", exact: true }).click();
  await face.click();
  await dock.waitFor();
  await mic.waitFor();

  await page.getByRole("button", { name: "Turn Smith's voice on", exact: true }).click();
  await start.click();
  await page.waitForFunction(() =>
    window.speechFixture.utterances.some((u) => u.text === "Hi, it’s Smith."),
  );
  await page.getByRole("button", { name: "Close Smith", exact: true }).click();
  await endHidden.click();
  assert.equal(await page.evaluate(() => window.speechFixture.released), 1);
  await face.click();
  await page.getByRole("button", { name: "Turn Smith's voice off", exact: true }).waitFor();
  console.log(
    "  ✓ Smith call: one press, hidden conversation and End call, mic-only stop, denied and cancelled capture, reduced motion",
  );
}

// T872 D: a needed answer holds the change, shares typed/voice context, and can be aborted silently.
async function checkSmithQuestions(page) {
  const asks = [];
  let applied = 0;
  await page.route("**/api/ask", async (route) => {
    asks.push(route.request().postDataJSON().request);
    await route.fulfill({
      json: {
        id: `question-${asks.length}`,
        usage: "",
        ...(asks.length % 2 === 0
          ? {
              kind: "change",
              operations: [
                { op: "addTimer", args: {}, description: "Add the reminder", destructive: false },
              ],
            }
          : {
              kind: "question",
              question: "When should the reminder run?",
              options: [
                "Weekdays only, after the morning meeting",
                "Every day, including weekends",
              ],
            }),
      },
    });
  });
  await page.route("**/api/ask/apply", async (route) => {
    applied++;
    await route.fulfill({ json: { ok: true, output: "done" } });
  });
  const input = page.getByRole("textbox", { name: "Describe a change, or ask a question" });
  const send = page.getByRole("button", { name: "Send", exact: true });
  await input.fill("Add a reminder");
  await send.click();
  const card = page.getByRole("region", { name: "Proposal", exact: true });
  await card.getByText("When should the reminder run?", { exact: true }).waitFor();
  assert.equal(await input.inputValue(), "", "the original request polluted the dictated answer");
  const choice = card.getByRole("button", {
    name: "Weekdays only, after the morning meeting",
    exact: true,
  });
  const geometry = await choice.evaluate((button) => ({
    height: button.getBoundingClientRect().height,
    width: button.getBoundingClientRect().width,
    available: button.parentElement.getBoundingClientRect().width,
    align: getComputedStyle(button).textAlign,
  }));
  assert.ok(geometry.height >= 48 && Math.abs(geometry.width - geometry.available) < 2);
  assert.equal(geometry.align, "left");
  await page.waitForTimeout(1800);
  assert.equal(asks.length, 1, "Smith went on without the required answer");
  assert.equal(applied, 0);
  // Beyond the generic follow-up window: a required answer still belongs to its question.
  await page.evaluate(() => {
    const now = Date.now.bind(Date);
    Date.now = () => now() + 6 * 60_000;
    window.speechFixture.transcript = "Weekdays only, after the morning meeting";
    window.speechFixture.behavior = "transcript";
  });
  await page.keyboard.press("Control+Shift+Space");
  await page.waitForFunction(
    () =>
      document.querySelector('textarea[aria-label="Describe a change, or ask a question"]')
        ?.value === "Weekdays only, after the morning meeting",
  );
  await send.click();
  await card.getByText("Proposed change", { exact: true }).waitFor();
  assert.equal(asks[1], "Add a reminder (Weekdays only, after the morning meeting)");
  assert.equal(applied, 0, "answering applied a change without confirmation");
  await card.getByRole("button", { name: "Discard", exact: true }).click();
  for (const mode of ["typed", "button"]) {
    const original = `Add a ${mode} reminder`;
    await input.fill(original);
    await send.click();
    await card.getByText("When should the reminder run?", { exact: true }).waitFor();
    if (mode === "typed") {
      await input.fill("Every day, including weekends");
      await send.click();
    } else
      await card
        .getByRole("button", { name: "Every day, including weekends", exact: true })
        .click();
    await card.getByText("Proposed change", { exact: true }).waitFor();
    assert.equal(asks.at(-1), `${original} (Every day, including weekends)`);
    assert.equal(applied, 0);
    await card.getByRole("button", { name: "Discard", exact: true }).click();
  }
  await input.fill("Add another reminder");
  await send.click();
  await card.getByRole("button", { name: "Cancel this change", exact: true }).waitFor();
  // Let the question finish, then snapshot BEFORE X to catch synchronous speech too.
  await page.waitForTimeout(100);
  const spoken = await page.evaluate(() => window.speechFixture.utterances.map((u) => u.text));
  await card.getByRole("button", { name: "Cancel this change", exact: true }).click();
  await card.waitFor({ state: "detached" });
  assert.equal(await input.inputValue(), "");
  await page.waitForTimeout(1800);
  assert.equal(asks.length, 7);
  assert.equal(applied, 0);
  assert.deepEqual(
    await page.evaluate(() => window.speechFixture.utterances.map((u) => u.text)),
    spoken,
    "closing the question spoke a reply",
  );
  console.log(
    "  ✓ Smith questions: roomy choices, required wait, dictated answer retains context, silent abort",
  );
}
