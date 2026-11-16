import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const { parse } = createRequire(new URL("../apps/studio/package.json", import.meta.url))("yaml");

// A real app and preview runtime: navigation reports are observed, never substituted.
test("date controls respect each grammar and preserve atomic drafts, follow and Undo", {
  timeout: 300000,
}, async () => {
  const repo = resolve(import.meta.dirname, "..");
  const root = mkdtempSync(join(tmpdir(), "smithable-date-expressions-"));
  const dir = join(root, "crm"),
    cli = join(repo, "packages/cli/dist/bin.js");
  const port = Number(process.env.DATE_EXPRESSION_TEST_PORT ?? 5900),
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
    const prepare = async (name, args) => {
      const response = await fetch(`${base}/api/op`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-smithable": "1" },
        body: JSON.stringify({ name, args }),
      });
      const result = await response.json();
      assert.ok(result.ok, result.output);
    };
    for (const [model, field, type] of [
      ["Customer", "dateStarts", "datetime"],
      ["Customer", "dateDay", "date"],
      ["Order", "ownDate", "date"],
    ])
      await prepare("addField", { model, field, type });
    await prepare("editSpec", {
      file: "smithable.yml",
      path: ["models", "Customer", "fields", "copiedStart"],
      value: { type: "datetime", formula: "dateStarts" },
    });
    await prepare("setCapacity", { model: "Order", per: "customer", max: "3" });
    await prepare("addTimer", {
      name: "dateReminder",
      on: "Order",
      at: "1 day before customer.dateStarts",
    });
    await prepare("addTimer", { name: "dateDaily", every: "day", at: "09:00" });
    await prepare("addOutgoing", {
      outgoing: "dateDigest",
      when: "dateDaily",
      to: "mail",
      recipient: "admin",
      list: "Order",
      date: "ownDate",
      within: "7 days",
      columns: ["number"],
    });
    const readyUntil = Date.now() + 120000;
    while (!(await (await fetch(`${base}/api/preview/answers`)).json()).ok) {
      if (Date.now() > readyUntil) throw Error("Preview did not recover after fixture operations");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
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
    const following = noCode.getByRole("checkbox", { name: "Follows preview", exact: true });
    await following.waitFor();
    assert.ok(await following.isChecked());
    const followed = (id) =>
      page.waitForFunction(
        (id) => JSON.parse(sessionStorage.getItem("smithable:place") ?? "{}").nocode?.page === id,
        id,
      );
    const settled = () =>
      page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
    const go = async (path) => {
      const count = await page.evaluate(() => window.followReports.length);
      await page.getByLabel("Preview address", { exact: true }).fill(path);
      await page.getByRole("button", { name: "Go", exact: true }).click();
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
    const reveal = async (locator) => {
      const parents = locator.locator("xpath=ancestor::details");
      for (let index = 0; index < (await parents.count()); index++) {
        const detail = parents.nth(index);
        if (!(await detail.evaluate((element) => element.open)))
          await detail.locator(":scope > summary").click();
      }
      await locator.waitFor({ state: "visible" });
    };
    const entry = async (areaName, name) => {
      const section = await area(areaName);
      const result = section.locator(`details[data-path='${JSON.stringify([areaName, name])}']`);
      await reveal(result);
      if (!(await result.evaluate((element) => element.open)))
        await result.locator(":scope > summary").click();
      return result;
    };
    const documentNow = async () =>
      parse((await (await fetch(`${base}/api/project`)).json()).files.spec);
    const stored = async (path) => path.reduce((value, key) => value?.[key], await documentNow());
    const waitStored = async (path, wanted) => {
      const until = Date.now() + 15000;
      while (JSON.stringify(await stored(path)) !== JSON.stringify(wanted)) {
        if (Date.now() > until)
          throw Error(`Stored ${JSON.stringify(path)} did not become ${JSON.stringify(wanted)}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };
    const save = async (scope, label, confirm = false) => {
      const response = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/op" && response.request().method() === "POST",
      );
      await scope.getByRole("button", { name: label, exact: true }).click();
      let result = await (await response).json();
      if (confirm && result.needsConfirm) {
        const accepted = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/api/op" &&
            response.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Apply anyway", exact: true }).click();
        result = await (await accepted).json();
      }
      assert.ok(result.ok, result.output);
      if (!["Change field", "Save timer"].includes(label))
        await scope.getByRole("button", { name: label, exact: true }).waitFor({ state: "hidden" });
    };
    const context = () =>
      page.evaluate(
        () => JSON.parse(sessionStorage.getItem("smithable:place") ?? "{}").nocode?.page,
      );
    await go("/orders");
    await followed("orders");
    const timerEntry = await entry("timers", "dateReminder");
    const timer = timerEntry.getByRole("form", { name: "When dateReminder runs", exact: true });
    const timerDate = timer.getByRole("combobox", { name: "Record date", exact: true });
    const timerOptions = await timerDate
      .locator("option")
      .evaluateAll((options) => options.map((option) => option.value));
    assert.ok(timerOptions.includes("ownDate"));
    assert.ok(timerOptions.includes("customer.dateDay"));
    assert.ok(timerOptions.includes("customer.dateStarts"));
    assert.ok(!timerOptions.includes("customer.copiedStart"));
    let before = operations.length;
    await timer.getByRole("spinbutton", { name: "Offset amount", exact: true }).fill("0");
    assert.ok(await timer.getByRole("button", { name: "Save timer", exact: true }).isDisabled());
    assert.equal(operations.length, before);
    await timer.getByRole("spinbutton", { name: "Offset amount", exact: true }).fill("2");
    await timer.getByRole("combobox", { name: "Offset unit", exact: true }).selectOption("hour");
    await timer
      .getByRole("combobox", { name: "Before or after", exact: true })
      .selectOption("after");
    await save(timer, "Save timer");
    await waitStored(["timers", "dateReminder", "at"], "2 hours after customer.dateStarts");
    assert.equal(operations.length, before + 1);
    await timer
      .getByRole("combobox", { name: "Kind of record", exact: true })
      .selectOption("Customer");
    assert.ok(await timer.getByRole("button", { name: "Save timer", exact: true }).isDisabled());
    await timer.getByRole("button", { name: "Reset", exact: true }).click();
    assert.equal(await timerDate.inputValue(), "customer.dateStarts");
    assert.equal(operations.length, before + 1);
    console.log(
      "PASS shared timer date parts preserve one-hop eligibility, reject zero and reset model changes",
    );

    let order = await entry("models", "Order");
    let capacity = order.getByRole("group", { name: "Edit capacity references", exact: true });
    let closes = capacity.locator('[data-key="closes"]');
    await reveal(closes);
    before = operations.length;
    await closes.getByRole("checkbox", { name: "Set a deadline", exact: true }).check();
    assert.ok(
      await capacity.getByRole("button", { name: "Save capacity", exact: true }).isDisabled(),
    );
    await go("/customers");
    await outside();
    await settled();
    assert.equal(await context(), "orders", "incomplete deadline lost its requesting context");
    assert.equal(operations.length, before);
    const deadline = closes.getByRole("combobox", { name: "Deadline date", exact: true });
    const deadlineOptions = await deadline
      .locator("option")
      .evaluateAll((options) => options.map((option) => option.value));
    assert.ok(deadlineOptions.includes("customer.dateStarts"));
    assert.ok(!deadlineOptions.includes("customer.dateDay"));
    assert.ok(!deadlineOptions.includes("customer.copiedStart"));
    assert.ok(!deadlineOptions.includes("ownDate"));
    await deadline.selectOption("customer.dateStarts");
    await closes.getByRole("checkbox", { name: "Before this date", exact: true }).check();
    assert.equal(
      await closes.getByRole("combobox", { name: "Before or after", exact: true }).count(),
      0,
    );
    await closes.getByRole("spinbutton", { name: "Offset amount", exact: true }).fill("0");
    assert.ok(
      await capacity.getByRole("button", { name: "Save capacity", exact: true }).isDisabled(),
    );
    await closes.getByRole("spinbutton", { name: "Offset amount", exact: true }).fill("2");
    await closes.getByRole("combobox", { name: "Offset unit", exact: true }).selectOption("hour");
    await save(capacity, "Save capacity");
    await waitStored(
      ["models", "Order", "capacity", "closes"],
      "2 hours before customer.dateStarts",
    );
    assert.equal(operations.length, before + 1);
    await outside();
    await followed("customers");
    console.log(
      "PASS capacity exposes only referenced stored datetimes and before offsets, keeps unfinished draft pending and releases follow on Save",
    );

    await go("/orders");
    await followed("orders");
    order = await entry("models", "Order");
    capacity = order.getByRole("group", { name: "Edit capacity references", exact: true });
    closes = capacity.locator('[data-key="closes"]');
    await reveal(closes);
    await closes.getByRole("spinbutton", { name: "Offset amount", exact: true }).fill("0");
    await capacity.getByRole("button", { name: "Cancel changes", exact: true }).click();
    assert.equal(
      await closes.getByRole("spinbutton", { name: "Offset amount", exact: true }).inputValue(),
      "2",
    );
    await closes.getByRole("checkbox", { name: "Set a deadline", exact: true }).click();
    await save(capacity, "Save capacity");
    await waitStored(["models", "Order", "capacity", "closes"], undefined);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await waitStored(
      ["models", "Order", "capacity", "closes"],
      "2 hours before customer.dateStarts",
    );
    await reveal(closes);
    assert.ok(
      await closes.getByRole("checkbox", { name: "Set a deadline", exact: true }).isChecked(),
    );
    assert.equal(
      await closes.getByRole("spinbutton", { name: "Offset amount", exact: true }).inputValue(),
      "2",
    );
    console.log("PASS deadline Cancel and removal Undo restore the complete date expression");

    const outgoing = await entry("outgoing", "dateDigest");
    const list = outgoing.locator('[data-key="list"]');
    await reveal(list);
    const listDate = list.getByRole("combobox", { name: "List date", exact: true });
    await reveal(list.locator('[data-key="when"]'));
    await listDate.selectOption("customer.dateDay");
    const window = list.getByRole("combobox", { name: "List date window", exact: true });
    await window.selectOption("span");
    await list.getByRole("spinbutton", { name: "Window amount", exact: true }).fill("2");
    await list.getByRole("combobox", { name: "Window unit", exact: true }).selectOption("week");
    await save(outgoing, "Save dateDigest");
    await waitStored(["outgoing", "dateDigest", "list", "when"], "customer.dateDay");
    await waitStored(["outgoing", "dateDigest", "list", "within"], "2 weeks");
    before = operations.length;
    await list.getByRole("spinbutton", { name: "Window amount", exact: true }).fill("0");
    assert.ok(
      await outgoing.getByRole("button", { name: "Save dateDigest", exact: true }).isDisabled(),
    );
    assert.equal(operations.length, before);
    await outgoing.getByRole("button", { name: "Cancel changes", exact: true }).click();
    assert.equal(
      await list.getByRole("spinbutton", { name: "Window amount", exact: true }).inputValue(),
      "2",
    );
    console.log(
      "PASS list mail shares one-hop date choices and its own days/weeks window, invalid zero stays local and Cancel restores it",
    );

    await listDate.selectOption("");
    assert.ok(
      await outgoing.getByRole("button", { name: "Save dateDigest", exact: true }).isDisabled(),
    );
    await window.selectOption("");
    await save(outgoing, "Save dateDigest");
    await waitStored(["outgoing", "dateDigest", "list", "when"], undefined);
    await waitStored(["outgoing", "dateDigest", "list", "within"], undefined);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await waitStored(["outgoing", "dateDigest", "list", "within"], "2 weeks");
    await reveal(list.locator('[data-key="when"]'));
    assert.equal(await listDate.inputValue(), "customer.dateDay");
    assert.equal(
      await list.getByRole("spinbutton", { name: "Window amount", exact: true }).inputValue(),
      "2",
    );
    console.log("PASS list date/window removal is atomic and Undo restores both controls");
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
