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
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
// The MCP SDK is the CLI's dependency.
import { Client } from "../packages/cli/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StreamableHTTPClientTransport } from "../packages/cli/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js";
import { startFakeModel } from "./fake-model.mjs";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const root = mkdtempSync(join(tmpdir(), "smithable-studio-"));
const dir = join(root, "crm");
// Another checkout testing at the same time sets its own (TEST_APPS_PORT does the same for test-apps).
const port = Number(process.env.TEST_STUDIO_PORT ?? 4900);
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
// A project's own theme, which the Look tab shows as a card beside the built-in ones.
mkdirSync(join(dir, "themes"), { recursive: true });
writeFileSync(
  join(dir, "themes/forest.yml"),
  'smithableTheme: 0.1\nname: forest\nfont: Nunito Sans\nradius: 12px\nshadow: soft\nlight:\n  primary: "#2f6b3a"\n  background: "#f6f8f4"\n  foreground: "#1f2a1f"\ndark:\n  primary: "#8fd19a"\n  background: "#141a14"\n  foreground: "#e6ece4"\n',
);
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
  env: {
    ...process.env,
    SMITHABLE_LOCAL_MODEL: "fake-model",
    SMITHABLE_LOCAL_URL: model.url,
    // The person's own report choice stays out of the test: Studio offers a report.
    XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), "smithable-studio-config-")),
  },
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
    // A change from the step before reloads the preview a few seconds after it went through:
    // until then it is updating (aria-busy), and a page opened now would be replaced under us.
    await page
      .locator('section[aria-busy="true"]', { has: page.getByRole("heading", { name: "Preview" }) })
      .waitFor({ state: "detached", timeout: 60000 });
    await page.getByLabel("Preview address").fill(path);
    await page.getByRole("button", { name: "Go", exact: true }).click();
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
    "removing a field asks first, with what data it loses; its notice's Undo brings it back",
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
      await status.getByRole("button", { name: "Undo this change" }).click();
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
      await trace.getByText("in the customers table").first().waitFor({ timeout: 60000 });
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
      await trace.getByText("Changed a text to “Clients”").first().waitFor({ timeout: 60000 });
      if (!(await project()).files.content.includes("title: Clients"))
        throw new Error("content not changed");
      await page.getByRole("button", { name: "Select" }).click();
      await preview.getByRole("heading", { name: "Clients" }).waitFor({ timeout: 60000 });
    },
  );
  await step("colors of a choice and a page's icon, from the Look tab", async () => {
    await page.getByRole("button", { name: "Your app", exact: true }).first().click();
    await page.getByRole("tab", { name: "Look" }).click();
    const choices = page.getByRole("region", { name: "Colors of choices" });
    await choices
      .getByRole("group", { name: "Status of Order" })
      .getByLabel("Color of Shipped")
      .selectOption("success");
    await trace
      .getByText("Show Order.status shipped as success")
      .first()
      .waitFor({ timeout: 60000 });
    await page
      .getByRole("region", { name: "Pages" })
      .getByLabel("Icon of Orders")
      .selectOption("truck");
    await trace.getByText(/truck/i).first().waitFor({ timeout: 60000 });
    const ux = readFileSync(join(dir, "smithable.ux.yml"), "utf8");
    if (!ux.includes("shipped: success") || !ux.includes("truck")) throw new Error(ux);
  });
  await step("look and feel: a theme and density are chosen without touching code", async () => {
    const theme = page.getByRole("region", { name: "Font and density" });
    await theme.getByRole("button", { name: "Compact" }).click();
    await theme.getByRole("button", { name: "Compact", pressed: true }).waitFor({ timeout: 60000 });
    const themes = page.getByRole("list", { name: "Themes" });
    // The project's own theme has its card, named with its file.
    await themes
      .getByRole("button", { name: /Forest/ })
      .getByText("themes/forest.yml", { exact: false })
      .waitFor();
    await themes.getByRole("button", { name: /Playful/ }).click();
    await trace.getByText("Use the playful theme").first().waitFor({ timeout: 60000 });
    await themes
      .getByRole("button", { name: /Playful/, pressed: true })
      .waitFor({ timeout: 60000 });
  });
  await step("undoing a theme puts back the packages it swapped (its font)", async () => {
    const before = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).dependencies;
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await status.getByText(/Undid: Use the playful theme/).waitFor({ timeout: 60000 });
    const after = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).dependencies;
    if (JSON.stringify(before) === JSON.stringify(after))
      throw new Error("the theme changed no package");
    for (const name of Object.keys(after))
      if (!existsSync(join(dir, "node_modules", name))) throw new Error(`${name} is not installed`);
  });
  await step(
    "a theme pasted in the Look tab is checked, added as a file and used; undo removes it",
    async () => {
      const look = page.getByRole("region", { name: "Theme" });
      await look.getByText("Add a theme").click();
      await look
        .getByLabel("Theme", { exact: true })
        .fill("smithableTheme: 0.1\nname: moss\nlight:\n  primary: nope\n");
      await look.getByRole("button", { name: "Add and use" }).click();
      await page
        .getByText(/The theme is refused/)
        .first()
        .waitFor({ timeout: 60000 });
      const forest = readFileSync(join(dir, "themes/forest.yml"), "utf8");
      await look
        .getByLabel("Theme", { exact: true })
        .fill(forest.replace("name: forest", "name: moss"));
      await look.getByRole("button", { name: "Add and use" }).click();
      await trace.getByText("Add theme moss and use it").first().waitFor({ timeout: 60000 });
      if (!existsSync(join(dir, "themes/moss.yml"))) throw new Error("no themes/moss.yml");
      await page
        .getByRole("list", { name: "Themes" })
        .getByRole("button", { name: /Moss/, pressed: true })
        .waitFor({ timeout: 60000 });
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await status.getByText(/Undid: Add theme moss/).waitFor({ timeout: 60000 });
      if (existsSync(join(dir, "themes/moss.yml"))) throw new Error("undo left themes/moss.yml");
    },
  );

  await step("a question about the app is answered from the spec, not applied", async () => {
    const before = (await project()).files.spec;
    await page.getByLabel("Describe a change").fill("Who can add orders?");
    await page.getByRole("button", { name: "Make the change" }).click();
    await page.getByText("Admins can add orders.").waitFor({ timeout: 30000 });
    if ((await project()).files.spec !== before) throw new Error("the spec changed");
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
    "Your app is a map to its parts: a field's line opens its properties, Add a field opens the form for that record, and In my words changes only the wording",
    async () => {
      await page.getByRole("tab", { name: "Your app" }).click();
      const customers = page.getByRole("region", { name: "Customers", exact: true });
      await customers.getByRole("button", { name: "a phone", exact: true }).click();
      await customers.getByRole("textbox", { name: "Label" }).fill("Mobile phone");
      await customers.getByRole("button", { name: "Save label" }).click();
      await trace.getByText("Mobile phone").first().waitFor({ timeout: 60000 });
      // Who can: a record's properties, a chip per role.
      await customers.getByRole("button", { name: "Customers", exact: true }).click();
      await customers.getByRole("button", { name: "Delete: sales" }).click();
      await trace
        .getByText(/delete customers/i)
        .first()
        .waitFor({ timeout: 60000 });
      // Adding a field: the Change tab's form, with the record filled in.
      await page
        .getByRole("region", { name: "Customers", exact: true })
        .getByRole("button", { name: "Add a field" })
        .click();
      if ((await page.getByLabel("Kind of record").inputValue()) !== "Customer")
        throw new Error("the form is not for customers");
      await page.getByLabel("Name", { exact: true }).fill("loyalty code");
      await page.getByRole("checkbox", { name: "Unique" }).check();
      await page.getByRole("button", { name: "Add field" }).click();
      await trace.getByText("Customers: added a loyalty code (unique)").waitFor({ timeout: 60000 });
      // In my words: the wording only, for this session; no change is made.
      await page.getByRole("tab", { name: "Your app" }).click();
      const again = page.getByRole("region", { name: "Customers", exact: true });
      await again.getByRole("button", { name: "In my words" }).click();
      await page.getByLabel("Customers, in your words").fill("Our clients and how to reach them.");
      await again.getByRole("button", { name: "Keep my words" }).click();
      await again.getByText("Our clients and how to reach them.").waitFor();
      if (!(await trace.locator("li").first().innerText()).includes("loyalty code"))
        throw new Error("rewording made a change");
      await again.getByRole("button", { name: "Back to the generated text" }).click();
      await again.getByRole("button", { name: "a loyalty code (unique)" }).waitFor();
    },
  );
  await step(
    "the panels snap: one at a time, picked above or with the arrow keys; very wide windows pair Your app and Details; the preview has its own column, and on a narrow window it is a panel",
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
      await page.setViewportSize({ width: 1700, height: 900 });
      await panels.getByLabel("Your app + Details").uncheck();
      await panels.getByRole("button", { name: "Details" }).click();
      await current("Details");
      await page.keyboard.press("ArrowLeft");
      await current("Your app");
      // The change box, and the changes under it, stay under every panel.
      await page.getByLabel("Describe a change").waitFor();
      await trace.waitFor();
      await panels.getByLabel("Your app + Details").check();
      await current("Your app,Details");
      // A narrow window: the preview is a panel of the strip, the frame placed over it.
      await page.setViewportSize({ width: 800, height: 900 });
      await panels.getByRole("button", { name: "Preview" }).click();
      await current("Preview");
      // Once the strip has snapped, the frame covers the window's width.
      await page.waitForFunction(
        () => {
          const r = document.querySelector('iframe[title="App preview"]')?.getBoundingClientRect();
          return r && Math.abs(r.left) < 2 && r.width > 700;
        },
        null,
        { timeout: 5000 },
      );
      await panels.getByRole("button", { name: "Your app" }).click();
      await current("Your app");
      await page.setViewportSize({ width: 1440, height: 900 });
    },
  );
  await step(
    "one preview for both modes: the address follows it, and a mode switch keeps its page",
    async () => {
      await openPreview("/orders");
      await preview.getByRole("heading", { name: "Orders" }).waitFor({ timeout: 60000 });
      // Navigating inside the app (opening an order) shows in the address.
      // A click before the reloaded page is ready does nothing: try again, a few times.
      for (let attempt = 1; ; attempt++) {
        // The table's title or a card's: whichever is visible (both exist; one is hidden by width).
        await preview
          .getByRole("button", { name: "ORD-1008" })
          .filter({ visible: true })
          .first()
          .click();
        try {
          await page.waitForFunction(
            () =>
              /^\/orders\/\d+$/.test(
                document.querySelector('input[aria-label="Preview address"]')?.value ?? "",
              ),
            null,
            { timeout: 5000 },
          );
          break;
        } catch (error) {
          if (attempt === 3) throw error;
        }
      }
      const opened = await page.getByLabel("Preview address").inputValue();
      await page.locator("label", { hasText: /^Code$/ }).click();
      await page.getByRole("navigation", { name: "Concepts" }).waitFor();
      if ((await page.getByLabel("Preview address").inputValue()) !== opened)
        throw new Error("the preview lost its page in Code mode");
      await preview.getByRole("heading", { name: "ORD-1008" }).waitFor({ timeout: 5000 });
      await page.locator("label", { hasText: /^No code$/ }).click();
      await preview.getByRole("heading", { name: "ORD-1008" }).waitFor({ timeout: 5000 });
    },
  );
  await step(
    "the place is remembered per mode: a field picked in the preview is the field in Code mode, and back",
    async () => {
      await openPreview("/customers/new");
      await page.getByRole("button", { name: "Select" }).click();
      await preview.locator('[data-sm-concept="field:Customer.email"]').click({ timeout: 60000 });
      await page.getByText("Email of Customer").waitFor({ timeout: 10000 });
      await page.getByRole("button", { name: "Select" }).click();
      await page.locator("label", { hasText: /^Code$/ }).click();
      await page
        .getByRole("navigation", { name: "Concepts" })
        .locator('[aria-current="true"]', { hasText: /^email/ })
        .waitFor({ timeout: 10000 });
      // A reload keeps both modes' places (the browser tab's session).
      await page.reload();
      await page
        .getByRole("navigation", { name: "Concepts" })
        .locator('[aria-current="true"]')
        .waitFor({ timeout: 30000 });
      await page.locator("label", { hasText: /^No code$/ }).click();
      await page.getByText("Email of Customer").waitFor({ timeout: 10000 });
    },
  );
  await step("Ctrl+Z outside a text field undoes the last change", async () => {
    await page.locator("header").first().click();
    await page.keyboard.press("Control+z");
    await trace
      .getByText("Undid: Customers: added a loyalty code (unique)")
      .waitFor({ timeout: 60000 });
  });
  await step("the Look tab shows smithable.ux.yml as controls, each applied at once", async () => {
    const ux = () => readFileSync(join(dir, "smithable.ux.yml"), "utf8");
    await page.getByRole("button", { name: "Your app", exact: true }).first().click();
    await page.getByRole("tab", { name: "Look" }).click();
    const look = (name) => page.getByRole("region", { name });
    await look("Font and density").getByRole("button", { name: "Comfortable" }).click();
    await look("Font and density")
      .getByRole("button", { name: "Comfortable", pressed: true })
      .waitFor({ timeout: 60000 });
    await look("Colors of choices").getByLabel("Color of Draft").first().selectOption("warning");
    await trace.getByText(/draft/i).first().waitFor({ timeout: 60000 });
    // A second line under a column's value.
    await look("Pages").getByLabel("Second line under Email").first().selectOption("phone");
    for (let i = 0; i < 60 && !/email: phone/.test(ux()); i++)
      await new Promise((r) => setTimeout(r, 1000));
    if (!/email: phone/.test(ux())) throw new Error(`no second line in smithable.ux.yml:\n${ux()}`);
    // A change made while another runs is dropped: wait for the trace.
    await trace
      .getByText("Show phone under email in the customers table")
      .waitFor({ timeout: 60000 });
    const columns = look("Pages").getByRole("list", { name: "Columns of Customers" });
    await columns
      .getByRole("button", { name: /^Hide / })
      .last()
      .click();
    await columns
      .getByRole("button", { name: /^Show / })
      .first()
      .waitFor({ timeout: 60000 });
    // The last change is done before the next (a change while one runs is not made).
    await trace
      .getByText("Show email, name, segment in the customers table")
      .waitFor({ timeout: 60000 });
    // A list page's view and order, and its form's columns and sections (look.md §1.1–1.3).
    const waitUx = async (re) => {
      for (let i = 0; i < 60 && !re.test(ux()); i++) await new Promise((r) => setTimeout(r, 1000));
      if (!re.test(ux())) throw new Error(`no ${re} in smithable.ux.yml:\n${ux()}`);
    };
    const pages = look("Pages");
    await pages
      .getByRole("group", { name: "View of Customers" })
      .getByRole("button", { name: "Cards" })
      .click();
    await waitUx(/view: cards/);
    await pages.getByLabel("Order of Customers").selectOption("-email");
    await waitUx(/sort: -email/);
    await pages.getByText("Form of Customers").click();
    await pages
      .getByRole("group", { name: "Columns of the Customers form" })
      .getByRole("button", { name: "Two columns" })
      .click();
    await waitUx(/columns: 2/);
    await pages.getByLabel("New section of the Customers form").fill("contact");
    await pages.getByRole("button", { name: "Add a section" }).first().click();
    await pages.getByLabel("Section of Email").first().selectOption("contact");
    await waitUx(/name: contact/);
    await page.getByRole("tab", { name: "Your app" }).click();
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
      // Its own theme, from the Look tab (look.md §1.5).
      await page.getByRole("tab", { name: "Look" }).click();
      await page.getByLabel("Theme of Home").selectOption("playful");
      await trace
        .getByText(/theme on the home page/i)
        .first()
        .waitFor({ timeout: 60000 });
      // A background of the owner's: picked, applied when the picker closes, in the CSS.
      await page.getByLabel("Background", { exact: true }).fill("#f5efe6");
      await page.getByLabel("Background", { exact: true }).blur();
      await trace
        .getByText(/background #f5efe6/i)
        .first()
        .waitFor({ timeout: 60000 });
      if (!readFileSync(join(dir, "smithable.ux.yml"), "utf8").includes('background: "#f5efe6"'))
        throw new Error("the ux file has no background");
      await page.getByRole("tab", { name: "Your app" }).click();
    },
  );

  await step(
    "records from a CSV file: the preview shows them as they would land, Import adds them",
    async () => {
      await change("Records from a CSV file");
      await page.getByLabel("Kind of record").selectOption("Customer");
      await page.getByLabel("CSV file").setInputFiles({
        name: "customers.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          'Name,E-mail,Credit limit\nÅland Fish AB,fish@example.ax,"25 000,00"\nMarina Café,cafe@example.ax,1200\n',
        ),
      });
      await page
        .getByRole("status", { name: "Import preview" })
        .getByText('"creditLimit":2500000')
        .waitFor({ timeout: 60000 });
      await page.getByRole("button", { name: "Import", exact: true }).click();
      await status.getByText("2 added").waitFor({ timeout: 60000 });
    },
  );

  console.log("Studio mode");
  await step("the concept tree shows a concept with its rules and files", async () => {
    await page.locator("label", { hasText: /^Code$/ }).click();
    if (!(await page.getByRole("radio", { name: "Code", exact: true }).isChecked()))
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
  await step(
    "the preview can be hidden for room: the details then sit beside the tree, and it stays hidden after a reload",
    async () => {
      const concepts = page.getByRole("navigation", { name: "Concepts" });
      const details = page.getByRole("heading", { name: "Details" });
      await page.getByRole("button", { name: "Hide", exact: true }).click();
      await page.locator('iframe[title="App preview"]').waitFor({ state: "hidden" });
      const beside = async () => {
        const [a, b] = [await concepts.boundingBox(), await details.boundingBox()];
        return a && b && b.x >= a.x + a.width - 2;
      };
      if (!(await beside())) throw new Error("the details are not beside the tree");
      await page.reload();
      await page.getByRole("button", { name: "Show preview" }).click();
      await page.locator('iframe[title="App preview"]').waitFor();
      if (await beside())
        throw new Error("the details stay beside the tree with the preview shown");
    },
  );
  await step("the preview shows the changes, and the logs are there", async () => {
    // Beside Code mode from lg: no tab to open.
    // Just shown again, the preview may still be loading, or restarting after the last change,
    // on a slow runner; a page that failed to load is not retried by the frame. Go to the page
    // again until it shows, for up to three minutes.
    const search = preview.getByRole("searchbox", { name: "Search by number" });
    for (const deadline = Date.now() + 180000; ; ) {
      await openPreview("/orders");
      try {
        await search.waitFor({ timeout: 30000 });
        break;
      } catch (error) {
        if (Date.now() > deadline) throw error;
      }
    }
    await page.getByRole("tab", { name: "Logs" }).click();
    // Every change logs what it generated (the panel may fill a moment after it opens).
    await page.getByLabel("Logs").getByText("Generated").first().waitFor({ timeout: 30000 });
  });
  await step(
    "a change whose regeneration fails is rolled back, and the preview comes back; so does a crashed one, and a page opened while it was down shows once it is up",
    async () => {
      const health = async () => {
        for (let i = 0; i < 60; i++) {
          try {
            if ((await fetch(`http://localhost:${port + 1}/health`)).ok) return;
          } catch {}
          await new Promise((r) => setTimeout(r, 500));
        }
        throw new Error("the preview did not come back");
      };
      // Regenerating fails (on the beta it was the route generator; here a package that does
      // not exist cannot be installed): the change is rolled back.
      const answer = await (
        await fetch(`http://localhost:${port}/api/op`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-smithable": "1" },
          body: JSON.stringify({
            name: "setPackage",
            args: { name: "smithable-no-such-package", version: "9.9.9" },
          }),
        })
      ).json();
      if (answer.ok || !answer.output.includes("Nothing was changed."))
        throw new Error(`the failed change was not rolled back: ${answer.output}`);
      if (readFileSync(join(dir, "smithable.context.yml"), "utf8").includes("no-such-package"))
        throw new Error("the context file kept the failed change");
      // Studio offers to report it; the report holds the change and the spec, never records.
      if (answer.report !== "offer") throw new Error(`no report offered: ${answer.report}`);
      const report = await (await fetch(`http://localhost:${port}/api/report`)).json();
      if (
        !report.text?.includes("smithable-no-such-package") ||
        !report.text.includes("smithable.yml")
      )
        throw new Error(`the report: ${report.text?.slice(0, 300)}`);
      if (report.text.includes("ORD-1001")) throw new Error("the report holds records");
      await health();
      // A preview that stops by itself is started again.
      if (spawnSync("pkill", ["-f", `preview.vite.config.mjs --port ${port + 1}`]).status !== 0)
        throw new Error("no preview process to stop");
      // One Go while it is down (the customers page, titled Clients by now): the preview waits
      // ("Starting…") and opens the page once the server answers again, without a reload.
      await openPreview("/customers");
      await health();
      await preview.getByRole("heading", { name: "Clients", level: 1 }).waitFor({ timeout: 60000 });
    },
  );
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
