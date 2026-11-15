import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Read the persisted YAML; the daemon validates it with the project's plugins. A plain
// validateSpec call here would reject sections supplied by the shared fixture's plugin.
const { parse } = createRequire(new URL("../packages/core/package.json", import.meta.url))("yaml");

export async function checkStudioTimers(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const stem = `studio${Date.now()}`;
  const sent = [];
  try {
    const project = await (await page.request.get(`${base}/api/project`)).json();
    const original = parse(project.files.spec);
    await page.addInitScript((name) => {
      for (const key of ["guideDone", "presented", "zoneAsked", "ownerAsked"])
        localStorage.setItem(`${key}:${name}`, "1");
      const NativeEvents = window.EventSource;
      window.EventSource = class extends NativeEvents {
        constructor(url) {
          super(url);
          window.timerEvents = this;
        }
      };
      localStorage.setItem("smithable:smith", "docked");
      localStorage.setItem(
        "smithable:windows",
        JSON.stringify({
          layout: "three",
          slots: ["smith", "preview", "manual"],
          manual: "nocode",
        }),
      );
    }, project.name);
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/op") sent.push(request.postDataJSON());
    });
    await page.goto(`${base}?guide=off`);
    const form = page.getByRole("region", { name: "What the app does", exact: true });
    await form.waitFor();
    const area = async (key) => {
      const section = form.locator(`details[data-key="${key}"]`);
      if (!(await section.isVisible()))
        await form.locator(":scope > div > details").last().locator("summary").first().click();
      if (!(await section.evaluate((element) => element.open)))
        await section.locator(":scope > summary").click();
      return section;
    };
    const save = async (button, operation) => {
      assert.ok(
        await button.isEnabled(),
        await button.evaluate((element) => element.closest("form").innerText),
      );
      const [response] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === "/api/op" &&
            r.request().postDataJSON().name === operation,
        ),
        button.click(),
      ]);
      const result = await response.json();
      assert.ok(result.ok, result.output);
      return sent.at(-1);
    };
    const timer = async () => {
      const body = await (await page.request.get(`${base}/api/project`)).json();
      return parse(body.files.spec).timers?.[`${stem}Timer`];
    };
    const timers = await area("timers");
    const add = timers.getByRole("form", { name: "Add timer", exact: true });
    const addButton = add.getByRole("button", { name: "Add timer", exact: true });
    await add.getByRole("textbox", { name: "Timer name", exact: true }).fill(`${stem}Timer`);
    assert.ok(await addButton.isDisabled());
    await add.getByRole("combobox", { name: "When the timer runs" }).selectOption("every");
    assert.ok(await addButton.isDisabled(), "a clock without a time could be added");
    await add.getByLabel("Time of day", { exact: true }).fill("08:00");
    // A refresh from the daemon must not save or discard an unfinished operation.
    const refreshed = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/project");
    await page.evaluate(() =>
      window.timerEvents.dispatchEvent(new MessageEvent("changed", { data: "{}" })),
    );
    await refreshed;
    assert.equal(await add.getByLabel("Time of day", { exact: true }).inputValue(), "08:00");
    assert.equal(sent.length, 0, "editing a timer wrote a half-set operation");
    const added = await save(addButton, "addTimer");
    assert.deepEqual(added.args, { name: `${stem}Timer`, every: "day", at: "08:00" });
    const entry = timers.locator(
      `details[data-path='${JSON.stringify(["timers", `${stem}Timer`])}']`,
    );
    await entry.waitFor({ state: "attached" });
    // Its first entry moves the area from Not set into the written keys, with fresh folding.
    await area("timers");
    await entry.locator(":scope > summary").click();
    const edit = entry.getByRole("form", { name: `When ${stem}Timer runs`, exact: true });
    const when = edit.getByRole("combobox", { name: "When the timer runs" });
    const saveTimer = edit.getByRole("button", { name: "Save timer", exact: true });
    await when.selectOption("cron");
    for (const [label, value] of [
      ["minute", "99"],
      ["hour", "9"],
      ["day of month", "*"],
      ["month", "*"],
      ["weekday", "1"],
    ])
      await edit.getByRole("textbox", { name: `Schedule ${label}`, exact: true }).fill(value);
    assert.ok(await saveTimer.isDisabled(), "an invalid cron field could be saved");
    await edit.getByRole("textbox", { name: "Schedule minute", exact: true }).fill("0");
    assert.equal(sent.length, 1, "changing modes wrote before Save");
    await save(saveTimer, "setTimer");
    assert.deepEqual(await timer(), { cron: "0 9 * * 1" });
    await when.selectOption("record");
    await edit
      .getByRole("combobox", { name: /Kind of record|For each record of/ })
      .selectOption("Customer");
    const offered = await edit
      .getByRole("combobox", { name: "Runs" })
      .locator("option")
      .evaluateAll((options) => options.map((o) => o.value));
    assert.ok(!offered.includes("mergeCustomers"), "a merge was offered to a timer");
    assert.ok(!offered.includes("scheduleFollowUps"), "a record timer offered a custom action");
    await edit
      .getByRole("combobox", { name: /Kind of record|For each record of/ })
      .selectOption("Order");
    assert.ok(await saveTimer.isDisabled(), "a record timer without a date could be saved");
    await edit.getByRole("combobox", { name: "Record date" }).selectOption("placedAt");
    await edit.getByRole("checkbox", { name: "Before or after this date", exact: true }).check();
    await edit.getByRole("spinbutton", { name: "Offset amount", exact: true }).fill("0");
    assert.ok(await saveTimer.isDisabled());
    await edit.getByRole("spinbutton", { name: "Offset amount", exact: true }).fill("2");
    await edit.getByRole("button", { name: "Add a condition", exact: true }).click();
    const conditionProject = await (await page.request.get(`${base}/api/project`)).json();
    const reference = parse(conditionProject.files.spec).models.Order.fields.customer;
    assert.equal(
      typeof reference === "string" ? reference : reference.type,
      "Customer!",
      "fixture must have the reference whose exclusion is checked",
    );
    const conditionField = edit.getByRole("combobox", { name: "Field", exact: true });
    const conditionChoices = await conditionField
      .locator("option")
      .evaluateAll((options) => options.map((option) => option.value));
    assert.ok(
      !conditionChoices.includes("customer"),
      "timer conditions offered an unsupported reference",
    );
    await conditionField.selectOption("status");
    await save(saveTimer, "setTimer");
    assert.deepEqual(await timer(), {
      on: "Order",
      at: "2 days before placedAt",
      where: { status: "draft" },
    });
    await when.selectOption("every");
    await edit
      .getByRole("combobox", { name: /Kind of record|For each record of/ })
      .selectOption("");
    await edit.getByLabel("Time of day", { exact: true }).fill("09:30");
    await save(saveTimer, "setTimer");
    assert.deepEqual(await timer(), { every: "day", at: "09:30" });
    console.log(
      "  ✓ Timer drafts: required mode/time, atomic add, refresh, all modes, positive offset, conditions and action choices",
    );

    for (const [key, label, operation] of [
      ["queries", "query", "addQuery"],
      ["payments", "payment", "addPayment"],
      ["outgoing", "outgoing mail", "addOutgoing"],
      ["incoming", "incoming call", "addIncoming"],
    ]) {
      const section = await area(key);
      const creation = section.getByRole("form", { name: `Add ${label}`, exact: true });
      const button = creation.getByRole("button", { name: `Add ${label}`, exact: true });
      await creation
        .getByRole("textbox", {
          name: `${label.charAt(0).toUpperCase()}${label.slice(1)} name`,
          exact: true,
        })
        .fill(`${stem}${key}`);
      assert.ok(await button.isDisabled(), `${key} accepted a name alone`);
      if (key === "outgoing") {
        await creation
          .getByRole("combobox", { name: "Mail is sent when" })
          .selectOption("Order created");
        await creation.getByRole("combobox", { name: "Mail recipient" }).selectOption("owner");
      } else {
        if (key === "incoming")
          await creation
            .getByRole("combobox", { name: "Incoming call does" })
            .selectOption("record");
        await creation.getByRole("combobox", { name: "Kind of record" }).selectOption("Order");
        if (key === "payments")
          await creation.getByRole("combobox", { name: "Payment amount" }).selectOption("total");
        if (key === "incoming") {
          assert.ok(
            await button.isDisabled(),
            "a call could leave a required record link unresolved",
          );
          assert.equal(
            await creation.getByLabel("Customer (required)", { exact: true }).count(),
            0,
          );
          await creation.getByRole("combobox", { name: "Kind of record" }).selectOption("Customer");
          assert.ok(await button.isDisabled(), "a call could omit the required name");
          for (const field of ["name", "email"])
            await creation
              .getByRole("textbox", {
                name: new RegExp(`^${field.charAt(0).toUpperCase()}${field.slice(1)}`),
                exact: true,
              })
              .fill(`{${field}}`);
        }
      }
      const request = await save(button, operation);
      assert.ok(Object.keys(request.args).length > 1, `${key} wrote an empty entry`);
      console.log(`  ✓ New ${label}: ${operation} includes its required first values`);
    }
    // Later Code checks require the original available keys and a warning-free fixture.
    // Restore these sections through the daemon, after proving every creation succeeded.
    for (const key of ["outgoing", "payments", "incoming", "queries", "timers"]) {
      const response = await page.request.post(`${base}/api/op`, {
        headers: { "x-smithable": "1" },
        data: { name: "editSpec", args: { path: [key], value: original[key] ?? null } },
      });
      const result = await response.json();
      assert.ok(result.ok, result.output);
    }
    const restored = parse(
      (await (await page.request.get(`${base}/api/project`)).json()).files.spec,
    );
    for (const key of ["outgoing", "payments", "incoming", "queries", "timers"])
      assert.deepEqual(restored[key], original[key], `${key} fixture was not restored`);
    console.log("  ✓ Timer and entry fixtures restored before the remaining editor checks");
  } finally {
    await page.close();
  }
}
