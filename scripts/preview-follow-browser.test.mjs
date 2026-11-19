import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { openPreviewAddress, showWorkspaceControls } from "./studio-form-checks.mjs";

// A real app and preview runtime: navigation reports are observed, never substituted.
test("No code follows real preview navigation without losing edits or opening hidden windows", {
  timeout: 300000,
}, async () => {
  const repo = resolve(import.meta.dirname, "..");
  const root = mkdtempSync(join(tmpdir(), "smithable-preview-follow-"));
  const dir = join(root, "crm"),
    cli = join(repo, "packages/cli/dist/bin.js");
  const port = Number(process.env.FOLLOW_TEST_PORT ?? 5760),
    base = `http://localhost:${port}`;
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (
      /^(SMITHABLE_|ANTHROPIC_|OPENAI_|GOOGLE_|GEMINI_|MISTRAL_|AZURE_|AWS_|SMTP_|MAIL_)/.test(key)
    )
      delete env[key];
  env.XDG_CONFIG_HOME = join(root, "config");
  let server,
    browser,
    page,
    log = "",
    passed = false;
  try {
    execFileSync(
      process.execPath,
      [cli, "new", dir, "--starter", "crm", "--admin", "studio-test@example.invalid"],
      { cwd: repo, env, timeout: 120000, stdio: "pipe" },
    );
    server = spawn(process.execPath, [cli, "studio", dir, "--port", String(port)], {
      cwd: repo,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const stream of [server.stdout, server.stderr])
      stream.on("data", (chunk) => {
        log = (log + chunk).slice(-15000);
      });
    const until = Date.now() + 120000;
    while (true) {
      try {
        if (
          (await fetch(`${base}/api/project`, { signal: AbortSignal.timeout(1000) })).ok &&
          (
            await (
              await fetch(`${base}/api/preview/answers`, { signal: AbortSignal.timeout(5000) })
            ).json()
          ).ok
        )
          break;
      } catch {}
      if (server.exitCode !== null || Date.now() > until)
        throw Error(`Studio did not start: ${log}`);
      await new Promise((r) => setTimeout(r, 200));
    }
    // The CRM starter has merge/custom actions; add a standard action for condition-row drafts.
    const prepared = await (
      await fetch(`${base}/api/op`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-smithable": "1" },
        body: JSON.stringify({
          name: "addAction",
          args: {
            action: "cancelOrder",
            on: "Order",
            when: { status: "draft" },
            set: { status: "canceled" },
          },
        }),
      })
    ).json();
    assert.ok(prepared.ok, prepared.output);
    const project = await (await fetch(`${base}/api/project`)).json();
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1920, height: 1100 } });
    page.setDefaultTimeout(15000);
    await page.addInitScript((name) => {
      for (const key of ["guideDone", "presented", "zoneAsked", "ownerAsked"])
        localStorage.setItem(`${key}:${name}`, "1");
      localStorage.setItem(
        "smithable:windows",
        JSON.stringify({
          layout: "three",
          slots: ["manual", "preview", "smith+changes"],
          manual: "nocode",
        }),
      );
      localStorage.setItem("smithable:smith", "docked");
      window.followReports = [];
      window.addEventListener("message", (event) => {
        if (event.data?.source === "smithable-preview" && event.data.type === "navigated")
          window.followReports.push(event.data);
      });
    }, project.name);
    const operations = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/op") operations.push(request.postDataJSON());
    });
    await page.goto(`${base}?guide=off`);
    const noCode = page.locator("[data-no-code]");
    const following = page.getByRole("button", {
      name: "Link the editors to the preview",
      exact: true,
    });
    await following.waitFor();
    assert.ok((await following.getAttribute("aria-pressed")) === "true");
    const context = () =>
      page.evaluate(
        () => JSON.parse(sessionStorage.getItem("smithable:place") ?? "{}").nocode?.page,
      );
    const followed = (id) =>
      page.waitForFunction(
        (id) => JSON.parse(sessionStorage.getItem("smithable:place") ?? "{}").nocode?.page === id,
        id,
      );
    const settled = () =>
      page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
    const appFrame = async () => {
      const frame = await (
        await page.locator('iframe[title="App preview"]').elementHandle()
      )?.contentFrame();
      assert.ok(frame, "no app frame");
      await frame.waitForURL((url) => url.origin === new URL(project.preview).origin);
      return frame;
    };
    const go = async (path) => {
      const count = await page.evaluate(() => window.followReports.length);
      await openPreviewAddress(page);
      await page.getByLabel("Preview address", { exact: true }).fill(path);
      await page.getByLabel("Preview address", { exact: true }).press("Enter");
      await page.waitForFunction(
        ({ count, path }) =>
          window.followReports.slice(count).some((message) => message.path === path),
        { count, path },
      );
      await settled();
    };
    const navigateInApp = async (path) => {
      const count = await page.evaluate(() => window.followReports.length);
      await (await appFrame()).evaluate((path) => history.pushState(null, "", path), path);
      await page.waitForFunction(
        ({ count, path }) =>
          window.followReports.slice(count).some((message) => message.path === path),
        { count, path },
      );
      await settled();
    };
    const outside = () => page.getByRole("button", { name: "Look", exact: true }).focus();
    const area = async (key) => {
      const form = noCode.getByRole("region", { name: "What the app does", exact: true });
      const section = form.locator(`details[data-key="${key}"]`);
      if (!(await section.isVisible()))
        await form.locator(":scope > div > details").last().locator(":scope > summary").click();
      if (!(await section.evaluate((el) => el.open)))
        await section.locator(":scope > summary").click();
      return section;
    };
    await go("/customers");
    await followed("customers");
    assert.ok(
      await noCode
        .locator('details[data-path=\'["pages","customers"]\']')
        .evaluate((el) => el.open),
    );
    const frame = await appFrame();
    await frame.locator('body[data-hydrated="true"]').waitFor();
    await frame
      .getByRole("button", { name: "Arctic Outdoor Co", exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await frame.waitForURL(/\/customers\/\d+$/);
    await frame.evaluate(() => history.back());
    await frame.waitForURL(/\/customers\/?$/);
    assert.equal(await context(), "customers");
    console.log("PASS real record navigation and Back, page entry opened");

    const timers = await area("timers");
    const name = timers.getByRole("textbox", { name: "Timer name", exact: true });
    await name.focus();
    await navigateInApp("/orders");
    assert.equal(await context(), "customers", "focus alone did not defer following");
    await openPreviewAddress(page);
    await page.getByLabel("Preview address", { exact: true }).focus();
    await settled();
    assert.equal(await context(), "customers", "an open address list did not defer following");
    await outside();
    await followed("orders");
    await (await area("timers"))
      .getByRole("textbox", { name: "Timer name", exact: true })
      .fill("keepMyTimer");
    await go("/customers");
    assert.equal(await context(), "orders", "a dirty timer was left");
    assert.equal(
      await noCode.getByRole("textbox", { name: "Timer name", exact: true }).inputValue(),
      "keepMyTimer",
    );
    await noCode.getByRole("textbox", { name: "Timer name", exact: true }).fill("");
    assert.equal(await context(), "orders", "clearing a draft stole focus");
    await outside();
    await followed("customers");
    console.log("PASS focus and unsaved timer protection; follows after both clear");

    const query = (await area("queries")).getByRole("textbox", { name: "Query name", exact: true });
    await query.fill("keepMyQuery");
    await go("/orders");
    await go("/");
    assert.equal(await context(), "customers", "an unfinished new entry was left");
    await query.fill("");
    await outside();
    await followed("start");
    console.log("PASS new-entry draft and newest deferred navigation");

    const action = (await area("actions")).locator(
      'details[data-path=\'["actions","cancelOrder"]\']',
    );
    if (!(await action.evaluate((el) => el.open))) await action.locator(":scope > summary").click();
    await action.getByRole("button", { name: "Add a condition", exact: true }).click();
    const addedCondition = action.locator("[data-when-row]").last();
    await go("/orders");
    assert.equal(await context(), "start", "an unsaved condition row was left");
    await addedCondition.getByRole("button", { name: /^Remove / }).click();
    await outside();
    await followed("orders");
    console.log("PASS condition rows protect drafts without writing them");

    await noCode.getByRole("tab", { name: "Who can", exact: true }).click();
    await go("/customers");
    await followed("customers");
    assert.ok(await noCode.getByRole("tab", { name: "Who can", selected: true }).count());
    await noCode.getByRole("tab", { name: "Content", exact: true }).click();
    await go("/orders");
    await followed("orders");
    assert.ok(await noCode.getByRole("tab", { name: "Content", selected: true }).count());
    await noCode.getByRole("tab", { name: "Behavior", exact: true }).click();
    await (await area("timers"))
      .getByRole("textbox", { name: "Timer name", exact: true })
      .fill("queued");
    await go("/customers");
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("smithable:open-part", { detail: "page:orders" })),
    );
    await followed("orders");
    await outside();
    await settled();
    assert.equal(await context(), "orders", "a queued follow overrode an explicit Open");
    const preserved = noCode.getByRole("textbox", { name: "Timer name", exact: true });
    assert.equal(await preserved.inputValue(), "queued", "reopening the same entry lost its draft");
    await preserved.fill("");
    await outside();
    await settled();
    assert.equal(await context(), "orders", "clearing a draft revived a cancelled follow");
    await navigateInApp("/customers/1");
    await followed("customers");
    await go("/");
    await followed("start");
    console.log(
      "PASS global tabs retained, explicit editor Open wins, later record navigation follows",
    );

    if ((await following.getAttribute("aria-pressed")) === "true") await following.click();
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("smithable:open-part", { detail: "model:Order" })),
    );
    await noCode.getByRole("tab", { name: "Layout", exact: true }).click();
    await noCode.getByLabel("Page to style", { exact: true }).selectOption("customers");
    await noCode.getByRole("tab", { name: "Behavior", exact: true }).click();
    assert.ok(
      await noCode
        .locator(`details[data-path='${JSON.stringify(["models", "Order"])}']`)
        .evaluate((el) => el.open),
      "following off changed the selected Behavior entry",
    );
    const stoppedAt = await context();
    await go("/orders");
    assert.equal(await context(), stoppedAt);
    await page.reload();
    await following.waitFor();
    assert.equal((await following.getAttribute("aria-pressed")) === "true", false);
    if (!((await following.getAttribute("aria-pressed")) === "true")) await following.click();
    await outside();
    await followed("orders");
    await navigateInApp("/orders/1");
    const authentic = await page.evaluate(() => window.followReports.at(-1));
    await page.evaluate(
      (report) =>
        window.postMessage(
          {
            ...report,
            path: "/customers",
            documentId: "foreign-frame",
            navigationId: report.navigationId + 1,
          },
          location.origin,
        ),
      authentic,
    );
    await (await appFrame()).evaluate(
      (report) =>
        window.parent.postMessage(
          { ...report, path: 42, documentId: "invalid", navigationId: report.navigationId + 1 },
          "*",
        ),
      authentic,
    );
    await settled();
    assert.equal(await context(), "orders");
    console.log("PASS preference reload and wrong-frame/malformed messages ignored");

    await page.getByRole("button", { name: "Look", exact: true }).click();
    await page.getByRole("button", { name: "More look settings", exact: true }).click();
    const look = page.getByRole("dialog", { name: "Look", exact: true });
    await look.waitFor();
    await navigateInApp("/customers");
    assert.equal(await context(), "orders", "following moved the column under the Look dialog");
    await look.getByRole("button", { name: "Close look editor", exact: true }).click();
    await look.waitFor({ state: "detached" });
    await followed("customers");
    console.log("PASS Look dialog defers following until it closes");

    // The saved guide preference prevents an automatic tour; expose the explicit Guide menu.
    await page.goto(base);
    await following.waitFor();
    await page.getByRole("button", { name: "Guide", exact: true }).click();
    await page.getByRole("menuitem", { name: "Tour Studio", exact: true }).click();
    const skip = page.getByRole("button", { name: "Skip guide", exact: true });
    await skip.waitFor();
    await navigateInApp("/orders");
    assert.equal(await context(), "customers", "following moved the column during the guide");
    await skip.click();
    await followed("orders");
    console.log("PASS active guide defers following until dismissal");

    await page.setViewportSize({ width: 720, height: 900 });
    await showWorkspaceControls(page);
    await page.getByRole("radio", { name: "Preview", exact: true }).check({ force: true });
    await navigateInApp("/customers");
    assert.equal(await context(), "orders", "a hidden column followed on screen");
    assert.ok(await page.getByRole("radio", { name: "Preview", exact: true }).isChecked());
    await page.getByRole("radio", { name: "No code", exact: true }).check({ force: true });
    await followed("customers");
    assert.ok(await page.getByRole("radio", { name: "No code", exact: true }).isChecked());
    assert.equal(
      operations.length,
      0,
      `following or drafts wrote operations: ${JSON.stringify(operations)}`,
    );
    console.log("PASS narrow hidden-window protection and zero operations");

    await page.setViewportSize({ width: 1920, height: 1100 });
    await noCode.getByRole("tab", { name: "Behavior", exact: true }).click();
    const addTimer = (await area("timers")).getByRole("form", { name: "Add timer", exact: true });
    await addTimer.getByRole("textbox", { name: "Timer name", exact: true }).fill("dailyCheck");
    await addTimer.getByLabel("When the timer runs", { exact: true }).selectOption("every");
    await addTimer.getByLabel("Time of day", { exact: true }).fill("09:00");
    let resume;
    const held = new Promise((resolve) => {
      resume = resolve;
    });
    await page.route("**/api/op", async (route) => {
      await held;
      await route.continue();
    });
    await addTimer.getByRole("button", { name: "Add timer", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("[data-no-code] fieldset:disabled"));
    await navigateInApp("/orders");
    await outside();
    assert.equal(await context(), "customers", "following left a pending save");
    resume();
    await followed("orders");
    assert.equal(operations.length, 1, "following added an operation beside the explicit save");
    assert.equal(operations[0].name, "addTimer");
    console.log("PASS pending operation protection and following after explicit successful save");

    await page.unroute("**/api/op");
    await noCode.getByRole("tab", { name: "Content", exact: true }).click();
    const language = noCode.getByLabel("Add a language", { exact: true });
    await language.selectOption("sv");
    let releaseLanguage;
    let languageStarted;
    const languageHeld = new Promise((resolve) => {
      releaseLanguage = resolve;
    });
    const languageRequest = new Promise((resolve) => {
      languageStarted = resolve;
    });
    await page.route("**/api/op", async (route) => {
      languageStarted();
      await languageHeld;
      await route.continue();
    });
    await language
      .locator("xpath=ancestor::form")
      .getByRole("button", { name: "Add", exact: true })
      .click();
    await languageRequest;
    await language.selectOption("");
    await navigateInApp("/customers");
    assert.equal(await context(), "orders", "following left a pending language save");
    releaseLanguage();
    await noCode.getByRole("button", { name: "Swedish", exact: true }).waitFor();
    assert.equal(await language.inputValue(), "", "saving replaced a cancelled language choice");
    await outside();
    await followed("customers");
    await page.unroute("**/api/op");
    await noCode.getByRole("button", { name: "Remove Swedish", exact: true }).click();
    await page.getByRole("button", { name: "Apply anyway", exact: true }).click();
    await noCode
      .getByRole("button", { name: "Remove Swedish", exact: true })
      .waitFor({ state: "detached" });

    await page.route("**/api/op", (route) =>
      route.fulfill({
        json: { ok: false, output: "Language addition refused for this test." },
      }),
    );
    await language.selectOption("sv");
    await language
      .locator("xpath=ancestor::form")
      .getByRole("button", { name: "Add", exact: true })
      .click();
    await page.getByText("Language addition refused for this test.", { exact: true }).waitFor();
    assert.equal(await language.inputValue(), "sv", "a refused language choice was cleared");
    await navigateInApp("/orders");
    await outside();
    assert.equal(await context(), "customers", "following left a refused language draft");
    await page.unroute("**/api/op");
    await language
      .locator("xpath=ancestor::form")
      .getByRole("button", { name: "Add", exact: true })
      .click();
    await noCode.getByRole("button", { name: "Swedish", exact: true }).waitFor();
    assert.equal(await language.inputValue(), "", "successful language choice did not settle");
    await outside();
    await followed("orders");
    console.log("PASS language success settles; refused and newer choices stay protected");

    await noCode.getByRole("tab", { name: "Who can", exact: true }).click();
    const domains = noCode.getByLabel("Only these email domains", { exact: true });
    await domains.fill("a.com,b.com");
    await navigateInApp("/customers");
    assert.equal(await context(), "orders");
    await outside();
    await followed("customers");
    const savedDomains = operations.length;
    await domains.fill("A.COM b.com a.com");
    await navigateInApp("/orders");
    await outside();
    await followed("orders");
    assert.equal(operations.length, savedDomains, "equivalent domains caused a write");
    await page.route("**/api/op", (route) =>
      route.fulfill({
        json: { ok: false, output: "Domain change refused for this test." },
      }),
    );
    await domains.fill("refused.example");
    await navigateInApp("/customers");
    await outside();
    await page.getByText("Domain change refused for this test.", { exact: true }).waitFor();
    assert.equal(await domains.inputValue(), "refused.example");
    assert.equal(await context(), "orders", "following left a refused domain draft");
    await domains.fill("a.com, b.com");
    await outside();
    await followed("customers");
    console.log(
      "PASS normalized domains settle without extra writes; refused edits stay protected",
    );
    passed = true;
  } catch (error) {
    if (page)
      console.error(
        "Studio state",
        await page.evaluate(() => ({
          place: sessionStorage.getItem("smithable:place"),
          focused: document.activeElement?.outerHTML.slice(0, 400),
          root: document.querySelector("[data-no-code]")?.getBoundingClientRect().toJSON(),
          transients: [
            ...document.querySelectorAll(
              'dialog[open], [role="dialog"], [role="menu"], [role="listbox"]',
            ),
          ].map((node) => node.outerHTML.slice(0, 200)),
          reports: window.followReports.slice(-4),
        })),
      );
    if (page)
      await page.screenshot({ path: join(root, "failure.png"), fullPage: true }).catch(() => {});
    console.error(`Fixture retained: ${root}\n${log}`);
    throw error;
  } finally {
    await browser?.close();
    if (server?.pid) {
      const exited = new Promise((resolve) => server.once("exit", resolve));
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {}
      if (server.exitCode === null)
        await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {}
    }
    if (passed) rmSync(root, { recursive: true, force: true });
  }
});
