import assert from "node:assert/strict";

export async function checkStudioQuestions(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const project = await (await page.request.get(`${base}/api/project`)).json();
  let asks = 0;
  const admins = [];
  try {
    await page.addInitScript(
      ({ name }) => {
        localStorage.setItem(`guideDone:${name}`, "1");
        localStorage.setItem(`presented:${name}`, "1");
        localStorage.removeItem(`zoneAsked:${name}`);
        localStorage.removeItem(`ownerAsked:${name}`);
        localStorage.setItem("smithable:smith", "floating");
        localStorage.setItem(
          "smithable:speech",
          JSON.stringify({
            sound: true,
            mic: "press",
            voice: "Google UK English Male",
            rate: 1.5,
            told: true,
          }),
        );
        window.questionFixture = { spoken: [] };
        window.SpeechRecognition = class {
          start() {
            window.questionFixture.rec = this;
            this.onstart?.();
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
        synth.speak = (u) => {
          window.questionFixture.spoken.push({ text: u.text, voice: u.voice?.name, rate: u.rate });
          u.onstart?.();
          queueMicrotask(() => u.onend?.());
        };
        Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
        window.SpeechSynthesisUtterance = class {
          constructor(text) {
            this.text = text;
            this.rate = 1;
          }
        };
      },
      { name: project.name },
    );
    await page.route("**/api/project", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.speech = [{ name: "browser" }];
      await route.fulfill({ response, json: body });
    });
    await page.route("**/api/ask", async (route) => {
      asks++;
      await route.fulfill({
        json: {
          kind: "answer",
          id: `optional-fixture-${asks}`,
          text: "Unrelated request completed.",
          concepts: [],
          usage: "",
        },
      });
    });
    await page.route("**/api/op", async (route) => {
      const body = route.request().postDataJSON();
      if (body.name !== "setAdmins") return route.continue();
      admins.push(body.args.admins);
      await route.fulfill({ json: { ok: true, output: "Administrator updated." } });
    });
    await page.goto(base);
    const card = page.locator("[data-studio-question]");
    const zone = page.locator('[data-part="time-zone-check"]');
    await zone.waitFor();
    assert.equal(await card.count(), 1);
    assert.ok(
      await zone.evaluate((el) => Boolean(el.closest("[data-smith-layer], [data-window]"))),
    );
    assert.notEqual(await zone.evaluate((el) => getComputedStyle(el).position), "fixed");
    await page.waitForFunction(() =>
      window.questionFixture.spoken.some((s) =>
        /Times in this app|This app has no time zone/.test(s.text),
      ),
    );
    const spokenZones = () =>
      page.evaluate(() =>
        window.questionFixture.spoken.filter((s) =>
          /Times in this app|This app has no time zone/.test(s.text),
        ),
      );
    const spoken = await spokenZones();
    assert.equal(spoken.length, 1);
    assert.equal(spoken[0].voice, "Google UK English Male");
    assert.equal(spoken[0].rate, 1.5);
    await page.getByRole("button", { name: "Close Smith", exact: true }).click();
    await page.locator("[data-question-waiting]").waitFor();
    await page.getByRole("button", { name: "Smith, a question is waiting", exact: true }).click();
    await zone.waitFor();
    await page.waitForTimeout(100);
    assert.equal((await spokenZones()).length, 1, "reopening repeated the optional question");
    const input = page.getByRole("textbox", { name: "Describe a change, or ask a question" });
    await input.fill("Please add a birthday field to customers.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.getByText("Unrelated request completed.", { exact: true }).waitFor();
    await zone.waitFor();
    assert.equal(asks, 1, "an optional card held the request");
    const keep = await zone.getByRole("button", { name: /^(Keep |Not now$)/ }).textContent();
    const dictate = async (text) => {
      await page.getByRole("button", { name: /^Mic:/ }).click();
      await page.waitForFunction(() => Boolean(window.questionFixture.rec));
      await page.evaluate((text) => {
        const rec = window.questionFixture.rec;
        const result = Object.assign([{ transcript: text }], { isFinal: true });
        rec.onresult?.({ resultIndex: 0, results: [result] });
        rec.onend?.();
      }, text);
      await page.waitForFunction(
        (text) =>
          document.querySelector('textarea[aria-label="Describe a change, or ask a question"]')
            ?.value === text,
        text,
      );
      await page.getByRole("button", { name: "Send", exact: true }).click();
    };
    await dictate(keep.trim());
    const owner = page.locator('[data-part="owner-check"]');
    await owner.waitFor();
    assert.equal(asks, 1, "a recognized optional answer called a model");
    assert.equal(await card.count(), 1);
    await owner.getByRole("button", { name: "Someone else", exact: true }).click();
    const email = owner.getByLabel("The owner's email address", { exact: true });
    await email.fill("not-an-email");
    assert.ok(
      await owner
        .getByRole("button", { name: "Make them the administrator", exact: true })
        .isDisabled(),
    );
    await email.fill("next@example.invalid");
    await owner.getByRole("checkbox", { name: "I help run it too", exact: true }).uncheck();
    await page.getByRole("button", { name: "Close Smith", exact: true }).click();
    await page.getByRole("button", { name: "Smith, a question is waiting", exact: true }).click();
    assert.equal(await email.inputValue(), "next@example.invalid");
    assert.equal(
      await owner.getByRole("checkbox", { name: "I help run it too", exact: true }).isChecked(),
      false,
    );
    await dictate("Make them the administrator");
    await card.waitFor({ state: "detached" });
    assert.deepEqual(admins, [["next@example.invalid"]]);
    assert.equal(asks, 1);
    await page.evaluate((name) => localStorage.removeItem(`zoneAsked:${name}`), project.name);
    await page.reload();
    await zone.waitFor();
    await zone.getByRole("button", { name: "Close question", exact: true }).click();
    await card.waitFor({ state: "detached" });
    await page.reload();
    await page.getByRole("textbox", { name: "Describe a change, or ask a question" }).waitFor();
    assert.equal(await card.count(), 0, "dismissed questions returned after reload");
    const after = await (await page.request.get(`${base}/api/project`)).json();
    assert.equal(after.files.spec, project.files.spec);
    assert.equal(after.files.auth, project.files.auth, "closing a question changed its assumption");
    console.log(
      "  ✓ Optional Studio cards: voice, waiting badge, no repeated speech, unrelated requests, dictated choices, owner draft and silent X",
    );
  } finally {
    await page.close();
  }
}
