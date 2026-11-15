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
test("typed reference forms write complete operations and protect unfinished drafts", {
  timeout: 300000,
}, async () => {
  const repo = resolve(import.meta.dirname, "..");
  const root = mkdtempSync(join(tmpdir(), "smithable-reference-forms-"));
  const dir = join(root, "crm"),
    cli = join(repo, "packages/cli/dist/bin.js");
  const port = Number(process.env.REFERENCE_TEST_PORT ?? 5840),
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
    for (let index = 0; index < 12; index++)
      await prepare("addField", {
        model: "Customer",
        field: `referenceLabel${index}`,
        type: "string",
      });
    await prepare("addQuery", { query: "referenceRecords", returns: "Customer" });
    await prepare("addPayment", {
      name: "referencePayment",
      on: "Order",
      amount: "total",
      when: "created",
    });
    await prepare("addOutgoing", {
      outgoing: "referenceNotice",
      when: "Order created",
      to: "mail",
      recipient: "owner",
    });
    await prepare("addIncoming", {
      name: "referenceCall",
      create: "Customer",
      set: ["name={name}"],
    });
    await prepare("editSpec", {
      file: "smithable.yml",
      path: ["navigation"],
      value: ["start", "customers"],
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
    const following = noCode.getByRole("checkbox", { name: "Follows preview", exact: true });
    await following.waitFor();
    assert.ok(await following.isChecked());
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
    const save = async (scope, label) => {
      const response = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/op" && response.request().method() === "POST",
      );
      await scope.getByRole("button", { name: label, exact: true }).click();
      const result = await (await response).json();
      assert.ok(result.ok, result.output);
    };
    await go("/customers");
    await followed("customers");
    const customer = await entry("models", "Customer");
    const naming = customer.locator('[data-key="namedBy"]');
    await reveal(naming);
    const search = naming.getByRole("searchbox", { name: "Find namedBy", exact: true });
    await search.fill("not a real field");
    assert.equal(operations.length, 0, "search wrote an operation");
    assert.equal(
      await naming.getByRole("combobox").locator('option[value="not a real field"]').count(),
      0,
    );
    await go("/orders");
    await outside();
    await settled();
    assert.equal(await context(), "customers", "reference filter was left by preview-follow");
    assert.equal(await search.inputValue(), "not a real field");
    await search.fill("");
    await outside();
    await followed("orders");
    await following.uncheck();
    console.log("PASS actual preview navigation preserves reference search without any operation");

    await entry("models", "Customer");
    await reveal(naming);
    const firstName = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/op",
    );
    await naming
      .getByRole("combobox", { name: "Add to namedBy", exact: true })
      .selectOption("name");
    assert.ok((await (await firstName).json()).ok);
    await page.waitForFunction(() => !document.querySelector('fieldset[aria-busy="true"]'));
    await search.fill("referenceLabel11");
    await naming.getByRole("combobox").selectOption("referenceLabel11");
    await waitStored(["models", "Customer", "namedBy"], ["name", "referenceLabel11"]);
    await naming
      .getByRole("button", { name: "Move referenceLabel11 earlier", exact: true })
      .click();
    await waitStored(["models", "Customer", "namedBy"], ["referenceLabel11", "name"]);
    const removedName = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/op",
    );
    await naming.getByRole("button", { name: "Remove referenceLabel11", exact: true }).click();
    assert.ok((await (await removedName).json()).ok);
    const named = await stored(["models", "Customer", "namedBy"]);
    assert.deepEqual([named].flat(), ["name"]);
    console.log("PASS model references search/add/reorder/remove through setNamedBy");

    const payment = await entry("payments", "referencePayment");
    const beforeParent = operations.length;
    await payment.getByRole("combobox", { name: "on", exact: true }).selectOption("Customer");
    assert.equal(operations.length, beforeParent, "parent model wrote before atomic Save");
    assert.equal(await stored(["payments", "referencePayment", "on"]), "Order");
    assert.ok(
      (
        await payment
          .getByRole("combobox", { name: "amount", exact: true })
          .locator('option[value="total"]')
          .innerText()
      ).includes("not available"),
    );
    await payment
      .getByRole("combobox", { name: "amount", exact: true })
      .selectOption("creditLimit");
    assert.equal(operations.length, beforeParent);
    await save(payment, "Save referencePayment");
    await waitStored(["payments", "referencePayment", "on"], "Customer");
    assert.equal(await stored(["payments", "referencePayment", "amount"]), "creditLimit");
    assert.equal(
      operations.length,
      beforeParent + 1,
      "dependent model/amount did not use one operation",
    );
    assert.deepEqual(operations.at(-1).args.path, ["payments", "referencePayment"]);
    assert.equal(operations.at(-1).args.value.amount, "creditLimit");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await waitStored(["payments", "referencePayment", "on"], "Order");
    assert.equal(await stored(["payments", "referencePayment", "amount"]), "total");
    console.log("PASS payment parent/dependent draft writes once and real Undo restores both");

    const query = await entry("queries", "referenceRecords");
    await query.getByRole("combobox", { name: "returns", exact: true }).selectOption("Order[]");
    await waitStored(["queries", "referenceRecords", "returns"], "Order[]");
    const outgoing = await entry("outgoing", "referenceNotice");
    const beforeOutgoing = operations.length;
    await outgoing
      .getByRole("combobox", { name: "recipient", exact: true })
      .selectOption("customer.email");
    assert.equal(operations.length, beforeOutgoing);
    await save(outgoing, "Save referenceNotice");
    await waitStored(["outgoing", "referenceNotice", "recipient"], "customer.email");
    const incoming = await entry("incoming", "referenceCall");
    const mapping = incoming.locator('[data-key="set"]');
    await reveal(mapping);
    await mapping
      .getByRole("combobox", { name: "Field in set", exact: true })
      .selectOption("email");
    await mapping.getByRole("textbox", { name: "Value in set", exact: true }).fill("{email}");
    await mapping.getByRole("button", { name: "Add set", exact: true }).click();
    assert.equal(await stored(["incoming", "referenceCall", "set", "email"]), undefined);
    await save(incoming, "Save referenceCall");
    await waitStored(["incoming", "referenceCall", "set", "email"], "{email}");
    console.log(
      "PASS query Model[] serialization, channel-aware recipient and closed incoming field keys",
    );

    const orders = await entry("pages", "orders");
    const searchFields = orders.locator('[data-key="search"]');
    await reveal(searchFields);
    await searchFields
      .getByRole("combobox", { name: "Add to search", exact: true })
      .selectOption("status");
    assert.equal((await stored(["pages", "orders", "search"])).includes("status"), false);
    await save(orders, "Save orders");
    assert.equal((await stored(["pages", "orders", "search"])).includes("status"), true);
    const navigation = await area("navigation");
    await navigation
      .getByRole("combobox", { name: "Add to navigation", exact: true })
      .selectOption("orders");
    await waitStored(["navigation"], ["start", "customers", "orders"]);
    await navigation.getByRole("button", { name: "Move orders earlier", exact: true }).click();
    await waitStored(["navigation"], ["start", "orders", "customers"]);
    console.log("PASS page references and ordered navigation through real manifest writers");
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
