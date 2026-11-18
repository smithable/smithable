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
test("small controls offer uploads, typed favorites, atomic rules and bounded numbers", {
  timeout: 300000,
}, async () => {
  const repo = resolve(import.meta.dirname, "..");
  const root = mkdtempSync(join(tmpdir(), "smithable-control-gaps-"));
  const dir = join(root, "crm"),
    cli = join(repo, "packages/cli/dist/bin.js");
  const port = Number(process.env.CONTROL_GAPS_TEST_PORT ?? 5880),
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
    for (const [path, value] of [
      [["models", "Customer", "schedule"], { hours: { "mon-fri": "09:00-17:00" } }],
      [["models", "Order", "fields", "gapAmount"], { type: "decimal", min: -3.5, max: 9.5 }],
      [["models", "Order", "fields", "gapUpload"], "string"],
      [["models", "Order", "rules"], [{ id: "keepOrder", rule: "Keep every receipt." }]],
    ])
      await prepare("editSpec", { file: "smithable.yml", path, value });
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
      await page.getByLabel("Preview address", { exact: true }).press("Enter");
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
      if (label !== "Change field")
        await scope.getByRole("button", { name: label, exact: true }).waitFor({ state: "hidden" });
    };
    await go("/orders");
    await followed("orders");
    let order = await entry("models", "Order");
    const field = (name) =>
      order.locator(`details[data-path='${JSON.stringify(["models", "Order", "fields", name])}']`);
    const amount = field("gapAmount");
    await reveal(amount);
    if (!(await amount.evaluate((el) => el.open))) await amount.locator(":scope > summary").click();
    const minimum = amount.getByRole("spinbutton", { name: "min", exact: true });
    const maximum = amount.getByRole("spinbutton", { name: "max", exact: true });
    await reveal(minimum);
    assert.equal(await minimum.getAttribute("max"), "9.5");
    assert.equal(await maximum.getAttribute("min"), "-3.5");
    assert.equal(await minimum.getAttribute("step"), "any");
    let before = operations.length;
    await minimum.fill("-2");
    await amount.getByRole("button", { name: "Reset value", exact: true }).click();
    assert.equal(await minimum.inputValue(), "-3.5");
    assert.equal(operations.length, before, "Reset must not blur-commit a valid edit");
    await minimum.fill("10");
    await outside();
    assert.equal(operations.length, before);
    assert.equal(await stored(["models", "Order", "fields", "gapAmount", "min"]), -3.5);
    assert.ok(await amount.getByRole("alert").isVisible());
    await amount.getByRole("button", { name: "Reset value", exact: true }).click();
    assert.equal(await minimum.inputValue(), "-3.5");
    assert.equal(operations.length, before);
    await minimum.fill("-2.5");
    await minimum.press("Enter");
    await outside();
    await waitStored(["models", "Order", "fields", "gapAmount", "min"], -2.5);
    assert.equal(operations.length, before + 1, "Enter and blur must commit only once");
    console.log(
      "PASS numeric bounds reject a crossing range locally and commit valid decimals once",
    );

    const rules = order.getByRole("group", { name: "Edit domain rules", exact: true }).first();
    await reveal(rules);
    before = operations.length;
    await rules.getByRole("button", { name: "Add a rule", exact: true }).click();
    const saveRules = rules.getByRole("button", { name: "Save rules", exact: true });
    assert.ok(await saveRules.isDisabled());
    assert.equal(operations.length, before);
    await rules
      .getByRole("textbox", { name: "Rule 2", exact: true })
      .fill("Send a receipt for each order.");
    await outside();
    await save(rules, "Save rules");
    await waitStored(
      ["models", "Order", "rules"],
      [{ id: "keepOrder", rule: "Keep every receipt." }, "Send a receipt for each order."],
    );
    assert.equal(operations.length, before + 1);
    await rules.getByRole("button", { name: "Add a rule", exact: true }).click();
    await rules.getByRole("button", { name: "Cancel changes", exact: true }).click();
    assert.equal(operations.length, before + 1);
    console.log("PASS rule additions are atomic, preserve named IDs and cancel without writes");

    const app = await area("app");
    const appRuleKey = app.locator('[data-key="rules"]');
    await reveal(appRuleKey);
    const appRules = appRuleKey.getByRole("group", { name: "Edit domain rules", exact: true });
    await appRules.getByRole("button", { name: "Add a rule", exact: true }).click();
    assert.ok(await appRules.getByRole("button", { name: "Save rules", exact: true }).isDisabled());
    await appRules
      .getByRole("textbox", { name: "Rule 1", exact: true })
      .fill("Keep the app simple.");
    await outside();
    await save(appRules, "Save rules");
    await waitStored(["app", "rules"], ["Keep the app simple."]);
    await appRules.getByRole("button", { name: "Remove rule 1", exact: true }).click();
    await save(appRules, "Save rules");
    await waitStored(["app", "rules"], undefined);
    await appRules.getByRole("button", { name: "Add a rule", exact: true }).click();
    await appRules.getByRole("button", { name: "Cancel changes", exact: true }).click();
    console.log("PASS first and last rule controls work for an unset list");

    const customer = await entry("models", "Customer");
    const schedule = customer.locator('[data-key="schedule"]');
    await reveal(schedule.locator('[data-key="gap"]'));
    const gap = schedule.getByRole("spinbutton", { name: "gap", exact: true });
    assert.equal(await gap.getAttribute("min"), "0");
    before = operations.length;
    await gap.fill("-1");
    await outside();
    assert.ok(
      await schedule.getByRole("button", { name: "Save schedule", exact: true }).isDisabled(),
    );
    assert.equal(operations.length, before);
    await schedule.getByRole("button", { name: "Cancel changes", exact: true }).click();
    await reveal(schedule.locator('[data-key="gap"]'));
    assert.equal(await gap.inputValue(), "");
    await gap.fill("5");
    await outside();
    await save(schedule, "Save schedule");
    await waitStored(["models", "Customer", "schedule", "gap"], 5);
    console.log("PASS atomic parent refuses invalid numbers and Cancel resets local input");

    const pageEntry = await entry("pages", "orders");
    const favorites = pageEntry.getByRole("combobox", { name: "favorites", exact: true });
    await reveal(pageEntry.locator('[data-key="favorites"]'));
    for (const value of [true, "only", false]) {
      await favorites.selectOption(JSON.stringify(value));
      const savePage = pageEntry.getByRole("button", { name: "Save orders", exact: true });
      if (await savePage.isVisible()) await save(pageEntry, "Save orders");
      await waitStored(["pages", "orders", "favorites"], value);
    }
    console.log("PASS unset favorites offers typed boolean and only modes");

    order = await entry("models", "Order");
    const upload = field("gapUpload");
    await reveal(upload);
    if (!(await upload.evaluate((el) => el.open))) await upload.locator(":scope > summary").click();
    const type = upload.getByRole("combobox", { name: "Field type", exact: true });
    await reveal(type);
    await upload.getByRole("combobox", { name: "Unique", exact: true }).selectOption("yes");
    for (const kind of ["pictures", "file", "files"]) {
      await type.selectOption(kind);
      await save(upload, "Change field", true);
      await waitStored(["models", "Order", "fields", "gapUpload"], kind);
      assert.equal(await upload.getByRole("combobox", { name: "Unique", exact: true }).count(), 0);
    }
    console.log("PASS missing upload kinds can be selected without carrying forbidden modifiers");
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
