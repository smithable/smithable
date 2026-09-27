// End-to-end test of Smithable Studio (M9): on a new CRM, `smithable studio` runs the app's
// preview and the Studio app; a real browser makes the M3-M5 changes in both modes.
// Run after `pnpm build`: `pnpm test:studio`.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const root = mkdtempSync(join(tmpdir(), "smithable-studio-"));
const dir = join(root, "crm");
const port = 4900;
const base = `http://localhost:${port}`;
let failed = false;

async function step(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.log(`  ✗ ${name}\n    ${String(error.message).split("\n")[0]}`);
    failed = true;
    throw error;
  }
}

const created = spawnSync("node", [cli, "new", dir], { encoding: "utf8" });
if (created.status !== 0) throw new Error(created.stdout + created.stderr);
const server = spawn("node", [cli, "studio", dir, "--port", String(port)], { detached: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`http://localhost:${port + 1}/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const preview = page.frameLocator('iframe[title="App preview"]');
  const status = page.getByRole("status");
  const trace = page.getByRole("list", { name: "Change trace" });
  const change = async (label) => {
    await page.getByRole("tab", { name: "Change" }).click();
    await page.getByLabel("What do you want to change?").selectOption({ label });
  };
  const openPreview = async (path) => {
    await page.getByLabel("Preview address").fill(path);
    await page.getByRole("button", { name: "Go" }).click();
  };

  console.log("Builder mode");
  await step("the app is described in plain language", async () => {
    await page.goto(base);
    await page.getByText("Customers have a name (required), an email (unique)").waitFor();
  });
  await step("the preview runs the app, with the development sign-in", async () => {
    for (let attempt = 1; ; attempt++) {
      await page.waitForTimeout(2000);
      await preview.getByRole("button", { name: "Sign in as admin" }).click({ timeout: 60000 });
      try {
        await preview.getByText("Dev admin", { exact: true }).waitFor({ timeout: 8000 });
        break;
      } catch (error) {
        if (attempt === 5) throw error;
      }
    }
  });
  await step("adding a field: the summary, the change trace and the preview follow", async () => {
    await change("Add a field");
    await page.getByLabel("Name", { exact: true }).fill("website");
    await page.getByLabel("Holds").selectOption({ label: "Web address" });
    await page.getByRole("button", { name: "Add field" }).click();
    await status.getByText("Add field website (url) to Customer").waitFor({ timeout: 60000 });
    await trace.getByText("Add field website (url) to Customer").waitFor();
    await page.getByRole("tab", { name: "Your app" }).click();
    await page.getByText("a web address").first().waitFor();
    await openPreview("/customers/new");
    await preview.getByLabel("Website").waitFor({ timeout: 60000 });
  });
  await step(
    "removing a field asks first, with what data it loses; undo brings it back",
    async () => {
      await change("Remove a field");
      await page.getByLabel("Kind of record").selectOption("Customer");
      await page.getByLabel("Field").selectOption({ label: "Phone" });
      await page.getByRole("button", { name: "Remove field" }).click();
      await page
        .getByRole("alert")
        .getByText("this deletes the phone column")
        .waitFor({ timeout: 60000 });
      await page.getByRole("button", { name: "Apply anyway" }).click();
      await trace.getByText("Remove field phone from Customer").waitFor({ timeout: 60000 });
      await page.getByRole("button", { name: "Undo" }).click();
      await status.getByText("Undid: Remove field phone from Customer").waitFor({ timeout: 60000 });
      await trace.getByText("Undid: Remove field phone from Customer").waitFor();
    },
  );
  await step("access: only admins may create orders", async () => {
    await change("Who can do what");
    await page.getByLabel("Who can").selectOption({ label: "Create order records" });
    await page.getByRole("checkbox", { name: "admin" }).check();
    await page.getByRole("button", { name: "Set access" }).click();
    await status.getByText("Allow model:Order.create for admin").waitFor({ timeout: 60000 });
    await page.getByRole("tab", { name: "Your app" }).click();
    await page.getByText("Only admins can add orders.").waitFor();
  });

  await step("look and feel: a theme and density are chosen without touching code", async () => {
    await change("Look and feel");
    await page.getByLabel("Theme").selectOption("playful");
    await page.getByLabel("Density").selectOption("compact");
    await page.getByRole("button", { name: "Apply" }).click();
    await status.getByText("Set the theme: preset playful").waitFor({ timeout: 60000 });
  });

  console.log("Studio mode");
  await step("the concept tree shows a concept with its rules and files", async () => {
    await page.locator("label", { hasText: /^Studio$/ }).click();
    if (!(await page.getByRole("radio", { name: "Studio" }).isChecked()))
      throw new Error("not in Studio mode");
    await page
      .getByRole("navigation", { name: "Concepts" })
      .getByRole("button", { name: /^mergeCustomers/ })
      .click();
    await page.getByText("src/generated/actions/merge-customers.ts").waitFor();
    await page
      .getByText("All orders of the duplicate move to the kept customer.")
      .first()
      .waitFor();
  });
  await step("the spec editor checks as you type, and saves an edit as a change", async () => {
    const editor = page.getByLabel("smithable.yml");
    const text = await editor.inputValue();
    await editor.fill(text.replace("      notes: text\n", "      notes: txt\n"));
    await page
      .getByRole("list", { name: "Problems" })
      .getByText(/Unknown field type "txt"/)
      .waitFor();
    if (await page.getByRole("button", { name: "Save" }).isEnabled())
      throw new Error("Save is enabled");
    await editor.fill(text.replace("      notes: text\n", "      notes: text\n      fax: phone\n"));
    await page.getByRole("list", { name: "Problems" }).getByText("No problems.").waitFor();
    await page.getByRole("button", { name: "Save" }).click();
    await status.getByText("Edit smithable.yml").waitFor({ timeout: 60000 });
  });
  await step("the last change is shown as a diff", async () => {
    await page.getByRole("tab", { name: "Last change" }).click();
    await page.getByLabel("Last change").getByText("+      fax: phone").waitFor();
  });
  await step("any operation can be applied from a form built from its schema", async () => {
    await page.getByRole("tab", { name: "Operation" }).click();
    await page.getByLabel("Operation").selectOption("setSearch");
    await page.getByLabel("page", { exact: true }).fill("orders");
    await page.getByLabel("fields", { exact: true }).fill("number");
    await page.getByRole("button", { name: "Apply setSearch" }).click();
    await status.getByText("Search orders by number").waitFor({ timeout: 60000 });
  });
  await step("a page can get its own component", async () => {
    await page
      .getByRole("navigation", { name: "Concepts" })
      .getByRole("button", { name: /^customers/ })
      .click();
    await page.getByRole("button", { name: "Give this page its own component" }).click();
    await status
      .getByText("the page is now src/custom/pages/customers.tsx")
      .waitFor({ timeout: 60000 });
    await page.getByText("This page has its own component").waitFor();
  });
  await step("the preview shows the changes, and the logs are there", async () => {
    await page.getByRole("tab", { name: "Preview" }).click();
    await openPreview("/orders");
    await preview.getByRole("searchbox", { name: "Search by number" }).waitFor({ timeout: 60000 });
    await page.getByRole("tab", { name: "Logs" }).click();
    if (!(await page.getByLabel("Logs").innerText()).includes("VITE")) throw new Error("no logs");
  });
} catch {
  // Reported above.
} finally {
  await browser.close();
  try {
    process.kill(-server.pid);
  } catch {}
}
if (failed) {
  console.log(`\nFailed. The app is kept in ${dir}`);
  process.exit(1);
}
rmSync(root, { recursive: true, force: true });
console.log("\nStudio works in both modes.");
