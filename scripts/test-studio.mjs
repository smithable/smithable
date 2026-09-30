// End-to-end test of Smithable Studio (M9): on a new CRM, `smithable studio` runs the app's
// preview and the Studio app; a real browser makes the M3-M5 changes in both modes.
// Run after `pnpm build`: `pnpm test:studio`.
import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
// The MCP SDK is the CLI's dependency.
import { Client } from "../packages/cli/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StreamableHTTPClientTransport } from "../packages/cli/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js";
import { startFakeModel } from "./fake-model.mjs";

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
    const shot = join(root, "failure.png");
    await page.screenshot({ path: shot }).catch(() => {});
    console.log(
      `  ✗ ${name}\n    ${String(error.message).split("\n").slice(0, 3).join("\n    ")}\n    see ${shot}`,
    );
    failed = true;
    throw error;
  }
}

const created = spawnSync("node", [cli, "new", dir], { encoding: "utf8" });
if (created.status !== 0) throw new Error(created.stdout + created.stderr);
// A project plugin with a section of its own: the engine in the tab must load it, or it
// reports the section as unknown and the app cannot be described.
mkdirSync(join(dir, "smithable/plugins/greeting"), { recursive: true });
writeFileSync(
  join(dir, "smithable/plugins/greeting/plugin.mjs"),
  `export default {
  key: "greeting",
  description: "A greeting.",
  schema: { type: "string" },
  expand() { return {}; },
};
`,
);
writeFileSync(join(dir, "smithable.context.yml"), "smithableContext: 0.1\nplugins: [greeting]\n");
appendFileSync(join(dir, "smithable.yml"), "\ngreeting: Hello\n");
// Left by a hosted workspace whose description could not be used: shown once.
mkdirSync(join(dir, "data/.smithable"), { recursive: true });
writeFileSync(
  join(dir, "data/.smithable/notice.txt"),
  "The description could not be used this time.\n",
);
// A stand-in model, so describing a change works without a real one.
const model = await startFakeModel();
const server = spawn("node", [cli, "studio", dir, "--port", String(port)], {
  detached: true,
  env: { ...process.env, SMITHABLE_LOCAL_MODEL: "fake-model", SMITHABLE_LOCAL_URL: model.url },
});
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
    await page.getByRole("region", { name: "Customers" }).getByText("a name (required)").waitFor();
    await page.getByText("an email (unique)", { exact: true }).waitFor();
  });
  await step("a notice left for Studio is shown once, then gone", async () => {
    const alert = page.getByRole("alert").filter({ hasText: "The description could not be used" });
    await alert.waitFor();
    await alert.getByRole("button", { name: "Dismiss" }).click();
    if (existsSync(join(dir, "data/.smithable/notice.txt")))
      throw new Error("the notice file is still there");
    await page.reload();
    await page.getByRole("region", { name: "Customers", exact: true }).waitFor();
    if (await alert.count()) throw new Error("the notice came back");
  });
  await step("the preview runs the app, with the development sign-in", async () => {
    for (let attempt = 1; ; attempt++) {
      await page.waitForTimeout(2000);
      await preview.getByRole("button", { name: "Sign in as admin" }).click({ timeout: 60000 });
      try {
        // Signed in: the customers page, which needs sign-in, opens.
        await preview.getByRole("heading", { name: "Customers" }).waitFor({ timeout: 8000 });
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
    await status
      .getByText("Customers: added a website (a web address)")
      .waitFor({ timeout: 60000 });
    await trace.getByText("Customers: added a website (a web address)").waitFor();
    await page.getByRole("tab", { name: "Your app" }).click();
    await page.getByText("a web address").first().waitFor();
    await openPreview("/customers/new");
    await preview.getByLabel("Website").waitFor({ timeout: 60000 });
    // Friendly names become spec names.
    await change("Rename a field");
    await page.getByLabel("Field", { exact: true }).selectOption({ label: "Website" });
    await page.getByLabel("New name").fill("Web page");
    await page.getByText("Customers: the website is now called web page").first().waitFor();
    await page.getByRole("button", { name: "Rename field" }).click();
    await status
      .getByText("Customers: the website is now called web page")
      .waitFor({ timeout: 60000 });
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
      await trace.getByText("Customers: removed the phone").waitFor({ timeout: 60000 });
      await page.getByRole("button", { name: "Undo" }).click();
      await status.getByText("Undid: Customers: removed the phone").waitFor({ timeout: 60000 });
      await trace.getByText("Undid: Customers: removed the phone").waitFor();
    },
  );
  await step("access: only admins may create orders", async () => {
    await change("Who can do what");
    await page.getByLabel("Who can").selectOption({ label: "Create order records" });
    await page.getByRole("checkbox", { name: "admin" }).check();
    await page.getByRole("button", { name: "Set access" }).click();
    await status
      .getByText("Only admins can add orders", { exact: true })
      .waitFor({ timeout: 60000 });
    await page.getByRole("tab", { name: "Your app" }).click();
    await page.getByText("Only admins can add orders.").waitFor();
  });

  const project = async () => (await fetch(`${base}/api/project`)).json();
  await step(
    "click the email field in the preview, make it required: spec, validation and form follow",
    async () => {
      await openPreview("/customers/new");
      await page.getByRole("button", { name: "Select" }).click();
      await preview
        .locator("html[data-sm-selecting]")
        .waitFor({ state: "attached", timeout: 60000 });
      await preview.locator('[data-sm-concept="field:Customer.email"]').click({ timeout: 60000 });
      await page.getByText("an email (unique)", { exact: true }).first().waitFor();
      await page.getByRole("checkbox", { name: "Required" }).click();
      await status
        .getByText("Customers: now an email (required, unique)")
        .waitFor({ timeout: 60000 });
      await page.getByText("an email (required, unique)", { exact: true }).first().waitFor();
      if (!(await project()).files.spec.includes("      email: email! unique\n"))
        throw new Error("spec not changed");
      await preview
        .locator('[data-sm-concept="field:Customer.email"]')
        .getByText("*")
        .waitFor({ timeout: 60000 });
    },
  );
  await step(
    "drag a column in the preview: smithable.ux.yml changes, smithable.yml does not",
    async () => {
      const before = (await project()).files.spec;
      await openPreview("/customers");
      await preview
        .locator("html[data-sm-selecting]")
        .waitFor({ state: "attached", timeout: 60000 });
      const header = (field) => preview.locator(`th[data-sm-concept="field:Customer.${field}"]`);
      await header("email").dragTo(header("name"), { timeout: 60000 });
      await status.getByText("in the customers table").waitFor({ timeout: 60000 });
      const after = await project();
      if (after.files.spec !== before) throw new Error("smithable.yml changed");
      const ux = readFileSync(join(dir, "smithable.ux.yml"), "utf8");
      if (!/columns: \[email, name/.test(ux)) throw new Error(ux);
      await page.getByRole("button", { name: "Select" }).click();
    },
  );
  await step(
    "a page title is changed in place in the preview: smithable.content.yml follows",
    async () => {
      await openPreview("/customers");
      await page.getByRole("button", { name: "Select" }).click();
      await preview
        .locator("html[data-sm-selecting]")
        .waitFor({ state: "attached", timeout: 60000 });
      await preview.locator('[data-sm-text="pages.customers.title"]').click({ timeout: 60000 });
      await page.keyboard.type("Clients");
      await page.keyboard.press("Enter");
      await status.getByText("Changed a text to “Clients”").waitFor({ timeout: 60000 });
      if (!(await project()).files.content.includes("title: Clients"))
        throw new Error("content not changed");
      await page.getByRole("button", { name: "Select" }).click();
      await preview.getByRole("heading", { name: "Clients" }).waitFor({ timeout: 60000 });
    },
  );
  await step("colours of a choice and a page's icon, from the Change tab", async () => {
    await change("Colours of a choice");
    await page.getByLabel("Choice field").selectOption({ label: "Status of Order" });
    await page.getByLabel("Value", { exact: true }).selectOption({ label: "Shipped" });
    await page.getByLabel("Colour").selectOption({ label: "Green (good)" });
    await page.getByRole("button", { name: "Set colour" }).click();
    await status.getByText("Show Order.status shipped as success").waitFor({ timeout: 60000 });
    await change("A page's icon");
    await page.getByLabel("Page", { exact: true }).selectOption({ label: "Orders" });
    await page.getByLabel("Icon").selectOption({ label: "Truck" });
    await page.getByRole("button", { name: "Set icon" }).click();
    await status
      .getByText(/orders/i)
      .first()
      .waitFor({ timeout: 60000 });
    const ux = readFileSync(join(dir, "smithable.ux.yml"), "utf8");
    if (!ux.includes("shipped: success") || !ux.includes("truck")) throw new Error(ux);
  });
  await step("look and feel: a theme and density are chosen without touching code", async () => {
    await change("Look and feel");
    await page.getByLabel("Theme").selectOption("playful");
    await page.getByLabel("Density").selectOption("compact");
    await page.getByRole("button", { name: "Apply" }).click();
    await status.getByText("Set the theme: preset playful").waitFor({ timeout: 60000 });
  });
  await step("undoing a theme puts back the packages it swapped (its font)", async () => {
    const before = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).dependencies;
    await page.getByRole("button", { name: "Undo" }).click();
    await status.getByText(/Undid: Set the theme/).waitFor({ timeout: 60000 });
    const after = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).dependencies;
    if (JSON.stringify(before) === JSON.stringify(after))
      throw new Error("the theme changed no package");
    for (const name of Object.keys(after))
      if (!existsSync(join(dir, "node_modules", name))) throw new Error(`${name} is not installed`);
  });

  await step(
    "a change that deletes data is proposed first, and opens in a form with its values filled in",
    async () => {
      await page.getByLabel("Describe a change").fill("Customers without notes");
      await page.getByRole("button", { name: "Make the change" }).click();
      const proposal = page.getByRole("region", { name: "Proposal" });
      await proposal.getByText("(loses data)").waitFor({ timeout: 30000 });
      await proposal.getByRole("button", { name: "Edit in a form" }).click();
      const values = [
        await page.getByLabel("What do you want to change?").inputValue(),
        await page.getByLabel("Kind of record").inputValue(),
        await page.getByLabel("Field", { exact: true }).inputValue(),
      ];
      if (values.join() !== "removeField,Customer,notes") throw new Error(values.join());
    },
  );
  await step(
    "describe a change: one that loses no data is made at once, and traced with its model",
    async () => {
      await page.getByLabel("Describe a change").fill("Customers should have a mobile number");
      await page.getByRole("button", { name: "Make the change" }).click();
      await page
        .getByText(
          /^Done: Customers: added a mobile \(a phone number\)\. Local model \(fake-model\)/,
        )
        .waitFor({ timeout: 60000 });
      await trace
        .getByText("Customers: added a mobile (a phone number)")
        .waitFor({ timeout: 60000 });
      await trace.getByText(/local model \(fake-model\) · [\d,]+ tokens/).waitFor();
    },
  );

  await step(
    "Your app is edited in its own words: a new item in the list of fields is added without AI",
    async () => {
      await page.getByRole("tab", { name: "Your app" }).click();
      await page.getByRole("button", { name: "Edit Customers" }).click();
      const box = page.getByLabel("Customers, in your words");
      const lines = (await box.inputValue()).split("\n");
      const last = lines.findLastIndex((l) => l.startsWith("- "));
      lines.splice(last + 1, 0, "- a loyalty code (unique)");
      await box.fill(lines.join("\n"));
      await page
        .getByRole("region", { name: "Customers", exact: true })
        .getByRole("button", { name: "Make the change" })
        .click();
      await trace.getByText("Customers: added a loyalty code (unique)").waitFor({ timeout: 60000 });
      // The part keeps the user's wording.
      await page.getByText("a loyalty code (unique)", { exact: true }).first().waitFor();
    },
  );
  await step(
    "the panels snap: one at a time, picked above or with the arrow keys; wide windows pair Preview and Changes",
    async () => {
      const panels = page.getByRole("navigation", { name: "Panels" });
      const current = (name) =>
        page.waitForFunction(
          (label) =>
            [...document.querySelectorAll("nav[aria-label=Panels] [aria-current=true]")]
              .map((b) => b.textContent)
              .join() === label,
          name,
          { timeout: 5000 },
        );
      await panels.getByLabel("Preview + Changes").uncheck();
      await panels.getByRole("button", { name: "Preview" }).click();
      await current("Preview");
      await page.keyboard.press("ArrowRight");
      await current("Changes");
      // The change box stays under every panel.
      await page.getByLabel("Describe a change").waitFor();
      await panels.getByLabel("Preview + Changes").check();
      await panels.getByRole("button", { name: "Preview" }).click();
      await current("Preview,Changes");
      await panels.getByRole("button", { name: "Your app" }).click();
      await current("Your app");
    },
  );
  await step("Ctrl+Z outside a text field undoes the last change", async () => {
    await page.locator("header").first().click();
    await page.keyboard.press("Control+z");
    await trace
      .getByText("Undid: Customers: added a loyalty code (unique)")
      .waitFor({ timeout: 60000 });
  });

  await step(
    "a landing page and a contact section, made in Builder, show in the preview",
    async () => {
      await change("Add a page");
      await page.getByLabel("Page name").fill("home");
      await page.getByLabel("Kind of page").selectOption({ label: "A landing page for visitors" });
      await page.getByRole("button", { name: "Add page" }).click();
      await trace
        .getByText("Added the Home page, a landing page for visitors")
        .waitFor({ timeout: 60000 });
      await change("A section on a landing page");
      await page.getByRole("button", { name: "Add section" }).click();
      await trace.getByText("Added a contact section to the Home page").waitFor({ timeout: 60000 });
      await openPreview("/");
      await preview
        .getByRole("heading", { name: "Acme CRM", level: 1 })
        .waitFor({ timeout: 60000 });
    },
  );

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
  await step(
    "a field's properties: its label changes, and it is shown in smithable.yml",
    async () => {
      const tree = page.getByRole("navigation", { name: "Concepts" });
      await tree.getByRole("button", { name: "Open Customer" }).click();
      await tree.getByRole("button", { name: /^email/ }).click();
      await page.getByLabel("Label", { exact: true }).fill("E-mail address");
      await page.getByLabel("Label", { exact: true }).press("Enter");
      await status
        .getByText('Change the text models.Customer.fields.email.label to "E-mail address"')
        .waitFor({ timeout: 60000 });
      await page.getByRole("button", { name: "Show in smithable.yml" }).click();
      const selected = await page
        .getByLabel("smithable.yml")
        .evaluate((e) => e.value.slice(e.selectionStart, e.selectionEnd));
      if (!/^\s+email:/.test(selected)) throw new Error(`selected: ${selected}`);
    },
  );
  await step("the spec editor checks as you type, and saves an edit as a change", async () => {
    const editor = page.getByLabel("smithable.yml");
    const text = await editor.inputValue();
    await editor.fill(text.replace("      notes: text\n", "      notes: txt\n"));
    await page
      .getByRole("list", { name: "Problems" })
      .getByText(/Unknown field type "txt"/)
      .waitFor();
    if (await page.getByRole("button", { name: "Save", exact: true }).isEnabled())
      throw new Error("Save is enabled");
    await editor.fill(text.replace("      notes: text\n", "      notes: text\n      fax: phone\n"));
    await page.getByRole("list", { name: "Problems" }).getByText("No problems.").waitFor();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await status.getByText("Edit smithable.yml").waitFor({ timeout: 60000 });
  });
  await step("the last change is shown as a diff", async () => {
    await page.getByRole("tab", { name: "Last change" }).click();
    await page.getByLabel("Last change").getByText("+      fax: phone").waitFor();
  });
  await step("any operation can be applied from a form built from its schema", async () => {
    await page.getByRole("tab", { name: "Operation" }).click();
    await page.getByLabel("Operation").selectOption("setSearch");
    // Names in the spec are chosen, not typed: the page, then its model's fields.
    await page.getByLabel("page", { exact: true }).selectOption("orders");
    await page.getByRole("group", { name: "fields" }).getByLabel("Number").check();
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
    // Every change logs what it generated.
    if (!(await page.getByLabel("Logs").innerText()).includes("Generated"))
      throw new Error("no logs");
  });
  await step("an agent changes the app over MCP (HTTP), and Studio shows it", async () => {
    // An unsaved edit in the spec editor is kept when the file changes under it.
    await page.getByRole("tab", { name: "smithable.yml" }).click();
    const editor = page.getByLabel("smithable.yml");
    const typed = `${await editor.inputValue()}# unsaved\n`;
    await editor.fill(typed);
    const client = new Client({ name: "test", version: "1" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://localhost:${port}/mcp`)),
    );
    const result = await client.callTool({
      name: "smithable_add_field",
      arguments: { model: "Customer", field: "vatNumber", type: "text" },
    });
    await client.close();
    if (result.isError) throw new Error(result.content[0].text);
    await page
      .getByText("Add field vatNumber (text) to Customer")
      .first()
      .waitFor({ timeout: 30000 });
    await page.getByText("smithable.yml changed on disk while you were editing.").waitFor();
    if ((await editor.inputValue()) !== typed) throw new Error("the unsaved edit was replaced");
    await page.getByRole("button", { name: "Use the file on disk" }).click();
    if (!(await editor.inputValue()).includes("vatNumber")) throw new Error("not the file on disk");
  });
  await step(
    "Studio is not framed by other sites, and applies only the proposal it showed",
    async () => {
      const answer = await fetch(`${base}/`);
      if (answer.headers.get("content-security-policy") !== "frame-ancestors 'none'")
        throw new Error(`CSP: ${answer.headers.get("content-security-policy")}`);
      const post = (path, body) =>
        fetch(`${base}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-smithable": "1" },
          body: JSON.stringify(body),
        }).then((r) => r.json());
      const proposal = await post("/api/ask", { request: "Add a phone field to customers" });
      if (!proposal.id) throw new Error(JSON.stringify(proposal));
      const stale = await post("/api/ask/apply", { id: "another" });
      if (stale.ok || !/no longer the latest/.test(stale.output))
        throw new Error(JSON.stringify(stale));
    },
  );
  await step("a web page cannot reach Studio through another host name", async () => {
    const status = await new Promise((resolve, reject) =>
      request({ port, path: "/api/project", headers: { host: "evil.example" } }, (r) => {
        r.resume();
        resolve(r.statusCode);
      })
        .on("error", reject)
        .end(),
    );
    if (status !== 403) throw new Error(`answered ${status}`);
  });
  await step("a message from a window other than the preview is ignored", async () => {
    const before = (await project()).files.content;
    // Studio's own window, not the preview frame, pretending to be the preview.
    await page.evaluate(() =>
      window.postMessage(
        {
          source: "smithable-preview",
          type: "text",
          path: "pages.customers.title",
          text: "Hacked",
        },
        "*",
      ),
    );
    await page.waitForTimeout(2000);
    if ((await project()).files.content !== before) throw new Error("the message was acted on");
  });
  await step(
    "a form on another site cannot change the project, and a folder path is no crash",
    async () => {
      const answer = (path, method, headers, body) =>
        new Promise((resolve, reject) =>
          request(
            { port, path, method, headers: { host: `localhost:${port}`, ...headers } },
            (r) => {
              r.resume();
              resolve(r.statusCode);
            },
          )
            .on("error", reject)
            .end(body),
        );
      const form = await answer(
        "/api/op",
        "POST",
        { "content-type": "text/plain", origin: "https://evil.example" },
        JSON.stringify({ name: "removeField", args: { model: "Customer", field: "notes" } }),
      );
      if (form !== 403) throw new Error(`a cross-site form answered ${form}`);
      if ((await answer("/assets", "GET", {})) !== 200) throw new Error("a folder path failed");
    },
  );
} catch {
  // Reported above.
} finally {
  await browser.close();
  try {
    process.kill(-server.pid);
  } catch {}
  await model.close();
}
if (failed) {
  console.log(`\nFailed. The app is kept in ${dir}`);
  process.exit(1);
}
rmSync(root, { recursive: true, force: true });
console.log("\nStudio works in both modes.");
