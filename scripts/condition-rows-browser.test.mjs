import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { openPreviewAddress } from "./studio-form-checks.mjs";

const { parse } = createRequire(new URL("../apps/studio/package.json", import.meta.url))("yaml");

// A real app and preview runtime: navigation reports are observed, never substituted.
test("condition rows preserve valid drafts, contextual fields and atomic operations", {
  timeout: 300000,
}, async () => {
  const repo = resolve(import.meta.dirname, "..");
  const root = mkdtempSync(join(tmpdir(), "smithable-condition-rows-"));
  const dir = join(root, "crm"),
    cli = join(repo, "packages/cli/dist/bin.js");
  const port = Number(process.env.CONDITION_TEST_PORT ?? 5860),
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
    for (const [field, type] of [
      ["active", "bool"],
      ["assignee", "User"],
      ["conditionStarts", "datetime"],
      ["conditionMinutes", "int"],
    ])
      await prepare("addField", { model: "Order", field, type });
    for (const [path, value] of [
      [["models", "Order", "fields", "conditionNote"], { type: "text" }],
      [["models", "Order", "fields", "derivedLabel"], { type: "string", formula: "number" }],
      [["models", "Order", "fields", "optionalStatus"], { type: "cold | warm", default: "none" }],
      [["models", "Order", "fields", "derivedList"], { type: "string", formula: "number" }],
      [["models", "Order", "fields", "derivedFresh"], { type: "string", formula: "number" }],
      [["models", "Customer", "schedule"], { hours: { "mon-fri": "09:00-17:00" } }],
      [
        ["models", "Order", "occupies"],
        {
          resource: "customer",
          starts: "conditionStarts",
          duration: "conditionMinutes",
          while: { status: "draft" },
        },
      ],
    ])
      await prepare("editSpec", { file: "smithable.yml", path, value });
    await prepare("setCapacity", { model: "Order", per: "customer", max: "3" });
    await prepare("addPayment", {
      name: "conditionPay",
      on: "Order",
      amount: "total",
      when: "created",
    });
    await prepare("editSpec", {
      file: "smithable.yml",
      path: ["payments", "conditionPay", "refund"],
      value: { by: ["admin"], when: { status: "draft" } },
    });
    await prepare("addOutgoing", {
      outgoing: "conditionNotice",
      when: "Order created",
      to: "mail",
      recipient: "owner",
    });
    await prepare("addTimer", { name: "conditionDaily", every: "day", at: "09:00" });
    await prepare("editSpec", {
      file: "smithable.yml",
      path: ["outgoing", "conditionList"],
      value: {
        when: "conditionDaily",
        to: "mail",
        recipient: "admin",
        list: { model: "Order", columns: ["number"], where: { status: "draft" } },
      },
    });
    await prepare("addLandingPage", {
      page: "conditionHome",
      route: "/condition-home",
      public: false,
    });
    await prepare("editSpec", {
      file: "smithable.yml",
      path: ["pages", "conditionHome", "landing", "records"],
      value: { records: "Order", where: { status: "draft" } },
    });
    await prepare("editSpec", {
      file: "smithable.yml",
      path: ["pages", "conditionStats"],
      value: {
        route: "/condition-stats",
        dashboard: { orders: { count: "Order", where: { status: "draft" } } },
      },
    });
    await prepare("addAction", {
      action: "conditionAction",
      on: "Order",
      when: { derivedLabel: "", derivedList: ["a", "b"], active: true },
      set: { status: "placed" },
    });
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
    const save = async (scope, label) => {
      const response = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/op" && response.request().method() === "POST",
      );
      await scope.getByRole("button", { name: label, exact: true }).click();
      const result = await (await response).json();
      assert.ok(result.ok, result.output);
      await scope.getByRole("button", { name: label, exact: true }).waitFor({ state: "hidden" });
    };
    const key = async (scope, name) => {
      const result = scope.locator(`[data-key="${name}"]`).first();
      await reveal(result);
      return result;
    };
    const pickField = async (scope, from, to) => {
      const row = scope.locator(`[data-when-row="${from}"]`);
      await row.getByRole("combobox", { name: "Field", exact: true }).selectOption(to);
    };
    const expectChoice = async (path, wanted) => {
      const until = Date.now() + 15000;
      while (true) {
        const value = await stored(path);
        if (JSON.stringify(Array.isArray(value) ? value : [value]) === JSON.stringify(wanted))
          return;
        if (Date.now() > until)
          throw Error(`Condition ${JSON.stringify(path)} did not match ${JSON.stringify(wanted)}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };
    const saveDraft = async (scope, label, path) => {
      const before = operations.length;
      await save(scope, label);
      await scope.getByRole("button", { name: label, exact: true }).waitFor({ state: "hidden" });
      assert.equal(operations.length, before + 1, "one parent Save must write one operation");
      assert.ok(await stored(path));
    };
    await go("/orders");
    await followed("orders");
    let order = await entry("models", "Order");
    const note = order.locator(
      `details[data-path='${JSON.stringify(["models", "Order", "fields", "conditionNote"])}']`,
    );
    await reveal(note);
    if (!(await note.evaluate((element) => element.open)))
      await note.locator(":scope > summary").click();
    const locked = await key(note, "locked");
    await locked
      .getByRole("combobox", { name: "locked mode", exact: true })
      .selectOption("condition");
    await locked.getByRole("button", { name: "Add a condition", exact: true }).click();
    await locked.getByRole("checkbox", { name: "Draft", exact: true }).uncheck();
    assert.ok(await locked.getByRole("button", { name: "Save locked", exact: true }).isDisabled());
    const beforeGuard = operations.length;
    await go("/customers");
    await outside();
    await settled();
    assert.equal(await context(), "orders", "incomplete condition lost its requesting page");
    assert.equal(operations.length, beforeGuard, "incomplete condition wrote an operation");
    await locked.getByRole("checkbox", { name: "Placed", exact: true }).check();
    await saveDraft(locked, "Save locked", [
      "models",
      "Order",
      "fields",
      "conditionNote",
      "locked",
    ]);
    await expectChoice(
      ["models", "Order", "fields", "conditionNote", "locked", "status"],
      ["placed"],
    );
    await outside();
    await followed("customers");
    console.log(
      "PASS field condition keeps incomplete choices pending, saves once and releases preview-follow",
    );

    await go("/orders");
    await followed("orders");
    order = await entry("models", "Order");
    const noteAgain = order.locator(
      `details[data-path='${JSON.stringify(["models", "Order", "fields", "conditionNote"])}']`,
    );
    await reveal(noteAgain);
    if (!(await noteAgain.evaluate((element) => element.open)))
      await noteAgain.locator(":scope > summary").click();
    let required = await key(noteAgain, "required");
    await required
      .getByRole("combobox", { name: "required mode", exact: true })
      .selectOption("condition");
    await required.getByRole("button", { name: "Add a condition", exact: true }).click();
    await saveDraft(required, "Save required", [
      "models",
      "Order",
      "fields",
      "conditionNote",
      "required",
    ]);
    await required
      .getByRole("combobox", { name: "required mode", exact: true })
      .selectOption("always");
    const refusal = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/op" && response.request().method() === "POST",
    );
    await required.getByRole("button", { name: "Save required", exact: true }).click();
    const refused = await (await refusal).json();
    assert.equal(refused.ok, false);
    assert.match(refused.output, /have no conditionNote/);
    await required.getByRole("alert").waitFor();
    assert.equal(
      await required.getByRole("combobox", { name: "required mode", exact: true }).inputValue(),
      "always",
    );
    await required.getByRole("button", { name: "Cancel changes", exact: true }).click();
    await required
      .getByRole("combobox", { name: "required mode", exact: true })
      .selectOption("never");
    await saveDraft(required, "Save required", ["models", "Order", "fields", "conditionNote"]);
    await waitStored(["models", "Order", "fields", "conditionNote", "required"], undefined);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expectChoice(
      ["models", "Order", "fields", "conditionNote", "required", "status"],
      ["draft"],
    );
    required = await key(noteAgain, "required");
    assert.equal(
      await required.getByRole("combobox", { name: "required mode", exact: true }).inputValue(),
      "condition",
    );
    console.log(
      "PASS required mode refusal retains the draft, Cancel restores it and Undo restores a saved condition",
    );

    const optional = order.locator(
      `details[data-path='${JSON.stringify(["models", "Order", "fields", "optionalStatus"])}']`,
    );
    await reveal(optional);
    if (!(await optional.evaluate((element) => element.open)))
      await optional.locator(":scope > summary").click();
    const optionalRequired = await key(optional, "required");
    assert.equal(
      await optionalRequired
        .getByRole("combobox", { name: "required mode", exact: true })
        .locator('option[value="always"]')
        .count(),
      1,
    );
    await optionalRequired
      .getByRole("combobox", { name: "required mode", exact: true })
      .selectOption("condition");
    await optionalRequired.getByRole("button", { name: "Add a condition", exact: true }).click();
    await saveDraft(optionalRequired, "Save required", [
      "models",
      "Order",
      "fields",
      "optionalStatus",
    ]);
    await expectChoice(
      ["models", "Order", "fields", "optionalStatus", "required", "status"],
      ["draft"],
    );
    const capacity = await key(order, "capacity");
    const capacityWhere = await key(capacity, "where");
    await capacityWhere.getByRole("button", { name: "Add a condition", exact: true }).click();
    await pickField(capacityWhere, "status", "active");
    await capacityWhere
      .getByRole("combobox", { name: "Active is", exact: true })
      .selectOption("false");
    assert.equal(
      await capacity.getByRole("button", { name: "Save where", exact: true }).count(),
      0,
      "condition created a nested Save",
    );
    await saveDraft(capacity, "Save capacity", ["models", "Order", "capacity"]);
    assert.equal(await stored(["models", "Order", "capacity", "where", "active"]), false);
    assert.equal(await stored(["models", "Order", "capacity", "per"]), "customer");
    const occupies = await key(order, "occupies");
    const whileRows = await key(occupies, "while");
    await pickField(whileRows, "status", "active");
    await whileRows.getByRole("combobox", { name: "Active is", exact: true }).selectOption("false");
    await saveDraft(occupies, "Save occupies", ["models", "Order", "occupies"]);
    assert.equal(await stored(["models", "Order", "occupies", "while", "active"]), false);
    console.log("PASS capacity and schedule rows use their own record and one atomic parent Save");

    const pay = await entry("payments", "conditionPay");
    const payWhen = await key(pay, "when");
    await payWhen
      .getByRole("combobox", { name: "created mode", exact: true })
      .selectOption("condition");
    assert.ok(
      await pay.getByRole("button", { name: "Save conditionPay", exact: true }).isDisabled(),
    );
    await payWhen.getByRole("button", { name: "Add a condition", exact: true }).click();
    await pickField(payWhen, "customer", "assignee");
    const assignee = payWhen.getByRole("combobox", { name: "Assignee is", exact: true });
    assert.deepEqual(
      await assignee
        .locator("option")
        .evaluateAll((options) => options.map((option) => option.value)),
      ["none", "any"],
    );
    await assignee.selectOption("none");
    await saveDraft(pay, "Save conditionPay", ["payments", "conditionPay"]);
    await waitStored(["payments", "conditionPay", "when"], { assignee: "none" });
    const refund = await key(pay, "refund");
    const refundWhen = await key(refund, "when");
    await pickField(refundWhen, "status", "assignee");
    assert.deepEqual(
      await refundWhen
        .getByRole("combobox", { name: "Assignee is", exact: true })
        .locator("option")
        .evaluateAll((options) => options.map((option) => option.value)),
      ["none", "any"],
    );
    await saveDraft(pay, "Save conditionPay", ["payments", "conditionPay"]);
    await waitStored(["payments", "conditionPay", "refund", "when"], { assignee: "any" });
    console.log(
      "PASS payment modes require a condition and payment/refund references never offer ME",
    );

    const notice = await entry("outgoing", "conditionNotice");
    const where = await key(notice, "where");
    await where.getByRole("button", { name: "Add a condition", exact: true }).click();
    assert.equal(
      await where
        .getByRole("combobox", { name: "Field", exact: true })
        .locator('option[value="derivedLabel"], option[value="assignee"]')
        .count(),
      0,
    );
    const beforeParent = operations.length;
    await notice
      .getByRole("combobox", { name: "when", exact: true })
      .selectOption("Customer created");
    assert.ok(
      await notice.getByRole("button", { name: "Save conditionNotice", exact: true }).isDisabled(),
    );
    assert.equal(operations.length, beforeParent);
    await pickField(where, "status", "segment");
    await saveDraft(notice, "Save conditionNotice", ["outgoing", "conditionNotice"]);
    assert.equal(await stored(["outgoing", "conditionNotice", "when"]), "Customer created");
    await expectChoice(["outgoing", "conditionNotice", "where", "segment"], ["smb"]);
    const listNotice = await entry("outgoing", "conditionList");
    const listWhere = await key(await key(listNotice, "list"), "where");
    await pickField(listWhere, "status", "active");
    await listWhere.getByRole("combobox", { name: "Active is", exact: true }).selectOption("false");
    await saveDraft(listNotice, "Save conditionList", ["outgoing", "conditionList"]);
    assert.equal(await stored(["outgoing", "conditionList", "list", "where", "active"]), false);
    console.log(
      "PASS outgoing and list conditions follow current parent context and keep booleans typed",
    );

    for (const [name, kind, item] of [
      ["conditionHome", "landing", "records"],
      ["conditionStats", "dashboard", "orders"],
    ]) {
      const pageEntry = await entry("pages", name);
      const child = pageEntry.locator(
        `details[data-path='${JSON.stringify(["pages", name, kind, item])}']`,
      );
      await reveal(child);
      if (!(await child.evaluate((element) => element.open)))
        await child.locator(":scope > summary").click();
      const pageWhere = await key(child, "where");
      await pickField(pageWhere, "status", "active");
      await pageWhere
        .getByRole("combobox", { name: "Active is", exact: true })
        .selectOption("false");
      await saveDraft(pageEntry, `Save ${name}`, ["pages", name]);
      assert.equal(await stored(["pages", name, kind, item, "where", "active"]), false);
    }
    console.log("PASS landing sections and dashboard tiles expose the shared condition rows");

    const action = await entry("actions", "conditionAction");
    await action.getByRole("combobox", { name: "Active is", exact: true }).selectOption("false");
    await save(action, "Change the condition");
    await waitStored(["actions", "conditionAction", "when"], {
      derivedLabel: "",
      derivedList: ["a", "b"],
      active: false,
    });
    await action
      .getByRole("textbox", { name: "Derived list is value 1", exact: true })
      .fill("changed");
    await save(action, "Change the condition");
    await waitStored(["actions", "conditionAction", "when"], {
      derivedLabel: "",
      derivedList: ["changed", "b"],
      active: false,
    });
    await action.getByRole("textbox", { name: "Derived list is value 1", exact: true }).fill("");
    const remainingText = action.getByRole("textbox", {
      name: "Derived list is value 1",
      exact: true,
    });
    assert.equal(
      await remainingText.evaluate((element) => element === document.activeElement),
      false,
      "deleting a text value transferred focus to the next member",
    );
    await page.keyboard.type("continuation");
    assert.equal(await remainingText.inputValue(), "b", "continued typing changed the next member");
    await save(action, "Change the condition");
    await waitStored(["actions", "conditionAction", "when"], {
      derivedLabel: "",
      derivedList: "b",
      active: false,
    });
    await action.getByRole("button", { name: "Add a condition", exact: true }).click();
    await pickField(action, "customer", "derivedFresh");
    assert.ok(
      await action.getByRole("button", { name: "Change the condition", exact: true }).isDisabled(),
    );
    await action
      .getByRole("checkbox", { name: "Derived fresh matches empty text", exact: true })
      .check();
    await save(action, "Change the condition");
    await waitStored(["actions", "conditionAction", "when"], {
      derivedLabel: "",
      derivedList: "b",
      active: false,
      derivedFresh: "",
    });
    console.log(
      "PASS saved empty text and value lists survive edits, while a new empty-text guard requires explicit intent",
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
