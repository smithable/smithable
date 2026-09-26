// End-to-end test: every example becomes a real app that installs, type-checks, builds,
// serves its pages with sample data, and regenerates without changes. The CRM (the
// running example) is also used in a real browser: validation, create, edit, delete.
// Run after `pnpm build`: `pnpm test:apps [example…]`.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const examples = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(join(repo, "examples"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

const failures = [];

function step(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.log(`  ✗ ${name}\n    ${String(error.message).split("\n").join("\n    ")}`);
    failures.push(name);
    throw error;
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${url} did not respond`);
}

/** Formula defaults fill a new invoice; a computed amount follows the inputs live. */
async function formulaFlow(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    await page.goto(`${base}/invoices/new`);
    const issued = await page.getByLabel("Issued on *").inputValue();
    const dueOn = await page.getByLabel("Due on *").inputValue();
    if (issued !== today || dueOn !== due) throw new Error(`defaults were ${issued} and ${dueOn}`);
    console.log("  ✓ browser: formula defaults fill a new invoice (today, today + 30 days)");

    await page.goto(`${base}/invoice-lines/new`);
    await page.getByRole("textbox", { name: "Quantity *" }).fill("2");
    await page.getByRole("textbox", { name: "Unit price *" }).fill("12.50");
    await page.getByText("€25.00").waitFor({ timeout: 5000 });
    console.log("  ✓ browser: a computed amount follows the inputs live");
  } catch (error) {
    console.log(`  ✗ browser: ${error.message.split("\n")[0]}`);
    failures.push("invoicing formula flow");
  } finally {
    await browser.close();
  }
}

/** Runs a query against the app's dev database with the app's own SQLite driver. */
function query(dir, sql) {
  const code = `const D=require("better-sqlite3");console.log(JSON.stringify(new D("data/db/app.db").prepare(${JSON.stringify(sql)}).all()))`;
  return JSON.parse(run("node", ["-e", code], dir));
}

function smithable(dir, ...args) {
  const result = spawnSync("node", [cli, ...args, "--dir", dir], { cwd: repo, encoding: "utf8" });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

/** M3: operations change spec, code, migrations and data; undo restores both; drift is refused. */
function operationsFlow(dir) {
  const expectOk = (result) => {
    if (result.code !== 0) throw new Error(result.out);
  };
  step("op addField keeps existing rows and adds the column", () => {
    const before = query(dir, "select count(*) n from customers")[0].n;
    expectOk(smithable(dir, "op", "addField", "Customer", "website", "url"));
    const after = query(dir, "select count(*) n, count(website) w from customers")[0];
    if (after.n !== before || after.w !== 0) throw new Error(JSON.stringify({ before, after }));
    if (!readFileSync(join(dir, "smithable.yml"), "utf8").includes("      website: url\n"))
      throw new Error("spec");
    if (!readFileSync(join(dir, "src/generated/customer.ts"), "utf8").includes('name: "website"'))
      throw new Error("form/table");
    run("pnpm", ["typecheck"], dir);
  });
  step("op renameField keeps the data", () => {
    const [{ notes }] = query(dir, "select notes from customers where id = 1");
    expectOk(smithable(dir, "op", "renameField", "Customer", "notes", "remarks"));
    const [{ remarks }] = query(dir, "select remarks from customers where id = 1");
    if (remarks !== notes || !notes) throw new Error(JSON.stringify({ notes, remarks }));
  });
  step("op renameField on a reference keeps every link", () => {
    const before = query(dir, "select id, customer_id from orders order by id");
    expectOk(smithable(dir, "op", "renameField", "Order", "customer", "buyer"));
    const after = query(dir, "select id, buyer_id as customer_id from orders order by id");
    if (JSON.stringify(after) !== JSON.stringify(before))
      throw new Error(JSON.stringify({ before, after }));
    run("pnpm", ["typecheck"], dir);
    expectOk(smithable(dir, "undo"));
  });
  step("a new required field on a table with rows is refused with a way forward", () => {
    const refused = smithable(dir, "op", "addField", "Customer", "vatId", "string!");
    if (refused.code !== 1 || !refused.out.includes("Add vatId as optional first"))
      throw new Error(refused.out);
  });
  step("a destructive op needs --yes", () => {
    const refused = smithable(dir, "op", "removeField", "Customer", "phone");
    if (refused.code !== 1 || !refused.out.includes("--yes")) throw new Error(refused.out);
    if (query(dir, "select count(phone) p from customers")[0].p === 0)
      throw new Error("phone was removed");
  });
  step("undo restores code and data, one operation at a time", () => {
    expectOk(smithable(dir, "undo"));
    if (query(dir, "select notes from customers where id = 1")[0].notes === undefined)
      throw new Error("notes not back");
    expectOk(smithable(dir, "undo"));
    const columns = query(dir, "select name from pragma_table_info('customers')").map(
      (c) => c.name,
    );
    if (columns.includes("website")) throw new Error("website still in the database");
    if (readFileSync(join(dir, "smithable.yml"), "utf8").includes("website"))
      throw new Error("website still in the spec");
    run("pnpm", ["typecheck"], dir);
  });
  step("a hand-edited generated file is reported, not overwritten", () => {
    const file = join(dir, "src/generated/customer.ts");
    const edited = `${readFileSync(file, "utf8")}// my change\n`;
    writeFileSync(file, edited);
    const result = spawnSync("node", [cli, "generate", dir], { cwd: repo, encoding: "utf8" });
    if (result.status !== 1 || !result.stderr.includes("src/generated/customer.ts"))
      throw new Error(result.stderr);
    if (readFileSync(file, "utf8") !== edited) throw new Error("the edit was overwritten");
  });
}

/** Creates, edits and deletes a customer through the UI, checking messages on the way. */
async function browserFlow(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const expectText = async (name, text) => {
    await page.getByText(text).first().waitFor({ timeout: 5000 });
    console.log(`  ✓ browser: ${name}`);
  };
  try {
    await page.goto(`${base}/customers/new`);
    await page.getByRole("button", { name: "Create customer" }).click();
    await expectText("empty required field says Required", "Required");

    await page.getByRole("textbox", { name: "Name *" }).fill("Mariehamn Marine AB");
    await page.getByRole("textbox", { name: "Email" }).fill("nordic.timber.oy@example.com");
    await page.getByRole("textbox", { name: "Credit limit" }).fill("lots");
    await page.getByRole("button", { name: "Create customer" }).click();
    await expectText("a non-number amount says Enter a number", "Enter a number");

    await page.getByRole("textbox", { name: "Credit limit" }).fill("1500");
    await page.getByRole("button", { name: "Create customer" }).click();
    await expectText("a taken email is explained", "Another customer already has this email.");

    await page.getByRole("textbox", { name: "Email" }).fill("hello@mariehamn-marine.example.com");
    await page.getByRole("button", { name: "Create customer" }).click();
    await page.waitForURL(`${base}/customers`);
    await expectText("create: the new customer is listed with its amount", "€1,500.00");

    await page.getByRole("cell", { name: "Mariehamn Marine AB" }).click();
    await page.getByRole("textbox", { name: "Credit limit" }).fill("2750.50");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(`${base}/customers`);
    await expectText("edit: the change is saved", "€2,750.50");

    await page.getByRole("cell", { name: "Mariehamn Marine AB" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await page.waitForURL(`${base}/customers`);
    await page.getByRole("cell", { name: "Nordic Timber Oy" }).waitFor();
    if (await page.getByText("Mariehamn Marine AB").count())
      throw new Error("The customer was not deleted");
    console.log("  ✓ browser: delete removes the customer");

    await page.goto(`${base}/orders/new`);
    await page.getByRole("textbox", { name: "Number *" }).fill("ORD-2001");
    await page.getByLabel("Customer *").selectOption({ label: "Skerry Software" });
    await page.getByRole("textbox", { name: "Total *" }).fill("99");
    await page.getByRole("button", { name: "Create order" }).click();
    await page.waitForURL(`${base}/orders`);
    await page.getByRole("row", { name: /ORD-2001.*Skerry Software/ }).waitFor({ timeout: 5000 });
    console.log("  ✓ browser: an order is created for a customer chosen from a list");

    await page.goto(`${base}/customers`);
    await page.getByRole("cell", { name: "Skerry Software" }).click();
    await page.getByRole("cell", { name: "ORD-2001" }).waitFor({ timeout: 5000 });
    console.log("  ✓ browser: the customer's page lists its orders");

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expectText(
      "a customer with orders cannot be deleted, and it says why",
      "This customer is still used by other records.",
    );
  } catch (error) {
    console.log(`  ✗ browser: ${error.message.split("\n")[0]}`);
    failures.push("crm browser flow");
  } finally {
    await browser.close();
  }
}

for (const [index, example] of examples.entries()) {
  console.log(`\n${example}`);
  const dir = join(mkdtempSync(join(tmpdir(), `smithable-${example}-`)), "app");
  const port = 4400 + index;
  try {
    step("smithable new", () => run("node", [cli, "new", dir, "--starter", example], repo));
    step("no dependency on Smithable", () => {
      if (/smithable/i.test(readFileSync(join(dir, "package.json"), "utf8")))
        throw new Error("package.json mentions Smithable");
    });
    step("type-checks", () => run("pnpm", ["typecheck"], dir));
    step("builds", () => run("pnpm", ["build"], dir));
    step("the app's own tests pass (formula examples)", () => run("pnpm", ["test"], dir));

    const server = spawn("pnpm", ["start"], {
      cwd: dir,
      env: { ...process.env, PORT: String(port) },
      detached: true,
    });
    try {
      await waitFor(`http://localhost:${port}/health`);
      const spec = readFileSync(join(dir, "smithable.yml"), "utf8");
      const routes = [...spec.matchAll(/^ {2}([a-z][\w-]*):\n {4}(?:route: (\S+)\n {4})?/gm)];
      for (const route of routes.length ? routes : []) {
        const path = route[2] ?? `/${route[1]}`;
        const response = await fetch(`http://localhost:${port}${path}`);
        const html = await response.text();
        const ok = response.status === 200 && html.includes("<table");
        console.log(`  ${ok ? "✓" : "✗"} ${path} lists sample data`);
        if (!ok) failures.push(`${example} ${path}`);
      }
      if (example === "crm") await browserFlow(`http://localhost:${port}`);
      if (example === "invoicing") await formulaFlow(`http://localhost:${port}`);
    } finally {
      process.kill(-server.pid);
    }

    step("regenerating changes nothing", () => {
      const out = run("node", [cli, "generate", dir], repo);
      if (!out.includes("(0 changed, 0 removed)")) throw new Error(out);
    });
    if (example === "crm") operationsFlow(dir);
  } catch {
    // Already reported; continue with the next example.
  }
}

if (failures.length) {
  console.log(`\n${failures.length} failed.`);
  process.exit(1);
}
console.log(`\nAll ${examples.length} example apps passed.`);
