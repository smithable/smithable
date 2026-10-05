// End-to-end test of Smithable Studio (M9): on a new CRM, `smithable studio` runs the app's
// preview and the Studio app; a real browser makes the M3-M5 changes in both modes.
// Run after `pnpm build`: `pnpm test:studio`.
import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
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
import { checkPorts } from "./ports.mjs";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const root = mkdtempSync(join(tmpdir(), "smithable-studio-"));
const dir = join(root, "crm");
// Another checkout testing at the same time sets its own (TEST_APPS_PORT does the same for test-apps).
const port = Number(process.env.TEST_STUDIO_PORT ?? 4900);
checkPorts("Studio's test (TEST_STUDIO_PORT)", [port, port + 1, port + 2, port + 3]);
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
    // until the new frame is up it is updating (aria-busy), and a page opened now would be
    // replaced under us.
    await page
      .locator('section[aria-busy="true"]', { has: page.getByRole("heading", { name: "Preview" }) })
      .waitFor({ state: "detached", timeout: 60000 });
    await page.getByLabel("Preview address").fill(path);
    await page.getByRole("button", { name: "Go", exact: true }).click();
    // Go makes a new frame; until it has loaded the page, select mode sent would reach the old
    // one (marking it, so a test sees the mark) and a click would land on the new one, unmarked.
    // The old frame, on the same page, may be found in the moment before it is removed: then the
    // next one is waited for.
    const deadline = Date.now() + 60000;
    for (;;) {
      const frame = page.frames().find((f) => {
        if (f === page.mainFrame() || f.isDetached()) return false;
        const url = new URL(f.url(), base);
        return url.pathname + url.search === path;
      });
      if (
        frame &&
        (await frame.waitForLoadState("load").then(
          () => true,
          () => false,
        ))
      )
        break;
      if (Date.now() > deadline) throw new Error(`the preview did not open ${path}`);
      await page.waitForTimeout(100);
    }
  };

  console.log("Builder mode");
  await step("the app is described in plain language", async () => {
    await page.goto(base);
    await page.getByRole("region", { name: "Customers" }).getByText("a name (required)").waitFor();
    await page.getByText("an email (unique)", { exact: true }).waitFor();
  });
  await step("the header has Publish and Help, which open the docs (finding 14)", async () => {
    const header = page.locator("header").first();
    for (const [name, href] of [
      ["Publish", "https://docs.smithable.ai/self-host.html"],
      ["Help", "https://docs.smithable.ai/start.html"],
    ])
      if ((await header.getByRole("link", { name, exact: true }).getAttribute("href")) !== href)
        throw new Error(`${name} does not lead to ${href}`);
  });
  await step("the change box folds to one line and opens again (finding 10)", async () => {
    await page.getByRole("button", { name: "Fold", exact: true }).click();
    await page.getByRole("button", { name: "Show the change box" }).waitFor();
    if (await page.getByLabel("Change trace").isVisible())
      throw new Error("the folded change box still shows the changes");
    await page.getByRole("button", { name: "Show the change box" }).click();
    await page.getByLabel("Describe a change").waitFor();
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
  await step("the preview says its records are samples, until dismissed", async () => {
    const note = page.getByRole("note").filter({ hasText: "Your published app starts empty" });
    await note.waitFor();
    await note.getByRole("button", { name: "Dismiss" }).click();
    await page.reload();
    await page.getByRole("region", { name: "Customers", exact: true }).waitFor();
    if (await note.count()) throw new Error("the samples notice came back");
  });
  await step(
    "the preview opens with the owner signed in as an administrator (finding 15)",
    async () => {
      // Signed in by Studio, without a click: the customers page, which needs sign-in, opens.
      await preview.getByRole("heading", { name: "Customers" }).waitFor({ timeout: 120000 });
    },
  );
  await step(
    "adding a field: the summary and the change trace follow at once, the form empties, and the preview follows and flashes what changed",
    async () => {
      await change("Add a field");
      await page.getByLabel("Name", { exact: true }).fill("website");
      await page.getByLabel("Holds").selectOption({ label: "Web address" });
      await page.getByRole("button", { name: "Add field" }).click();
      // The field, then its column in the list (Show it in the list): the trace has both.
      await trace
        .getByText("Customers: added a website (a web address)")
        .waitFor({ timeout: 60000 });
      // The left side has the change as soon as it is done, before the app has restarted with
      // it (finding 12), and the form starts again empty rather than inviting a second click.
      await trace
        .getByText("Customers: added a website (a web address)")
        .waitFor({ timeout: 3000 });
      if ((await page.getByLabel("Name", { exact: true }).inputValue()) !== "")
        throw new Error("The add-field form kept its values after the change went through");
      await page.getByRole("tab", { name: "What it does" }).click();
      await page.getByText("a web address").first().waitFor();
      await openPreview("/customers/new");
      await preview.getByLabel("Website").waitFor({ timeout: 60000 });
      // "Show it in the list" was on: the customers list has the column (its look names columns).
      await openPreview("/customers");
      await preview
        .getByRole("columnheader", { name: "Website" })
        .filter({ visible: true })
        .waitFor({ timeout: 60000 });
      // Friendly names become spec names.
      await change("Rename a field");
      await page.getByLabel("Field", { exact: true }).selectOption({ label: "Website" });
      await page.getByLabel("New name").fill("Web page");
      await page.getByText("Customers: the website is now called web page").first().waitFor();
      await page.getByRole("button", { name: "Rename field" }).click();
      await status
        .getByText("Customers: the website is now called web page")
        .waitFor({ timeout: 60000 });
      // The preview flashes what the change touched once it shows it (motion 9a), and says so:
      // the flash is over in 1.6 s, so the test reads what Studio heard, which stays on the
      // frame. The page shows the field under its new name.
      await page
        .locator('iframe[title="App preview"][data-flashed~="field:Customer.webPage"]')
        .waitFor({ state: "attached", timeout: 90000 });
      await preview.locator('[data-sm-concept="field:Customer.webPage"]').first().waitFor();
    },
  );
  await step(
    "a choice field's values are changed in ordinary words, and the records holding one that goes get the one chosen",
    async () => {
      await change("Change a field");
      await page.getByLabel("Kind of record").selectOption("Customer");
      // A value nothing else names (a formula naming one is refused, as its spec would break).
      await page.getByLabel("Field", { exact: true }).selectOption({ label: "Segment" });
      await page.getByLabel("Values").fill("smb, enterprise, public sector");
      await page.getByLabel("Records with government get").selectOption("publicSector");
      await page.getByRole("button", { name: "Change field" }).click();
      await trace
        .getByText(/public sector/i)
        .first()
        .waitFor({ timeout: 90000 });
      await openPreview("/customers");
      // A migration restarts the preview, which takes longer than a plain change.
      await preview
        .getByText("Public sector")
        .filter({ visible: true })
        .first()
        .waitFor({ timeout: 120000 });
      if (await preview.getByText("Government", { exact: true }).filter({ visible: true }).count())
        throw new Error("a customer still shows Government");
    },
  );
  await step(
    "an action is first a button that changes a record, in plain words: it appears on the records it fits and does what it says",
    async () => {
      await change("An action");
      await page.getByLabel("The button says").fill("Cancel order");
      await page.getByLabel("On each").selectOption("Order");
      await page.getByLabel("It sets").selectOption({ label: "Status" });
      await page.getByLabel("To", { exact: true }).selectOption("canceled");
      await page.getByLabel("Only when").selectOption({ label: "Status" });
      await page.getByLabel("Is", { exact: true }).selectOption("placed");
      await page
        .getByText(
          'A "Cancel order" button on each order sets status to canceled, when status is placed.',
        )
        .waitFor();
      await page.getByRole("button", { name: "Add button" }).click();
      await trace
        .getByText(/cancel ?order/i)
        .first()
        .waitFor({ timeout: 90000 });
      await openPreview("/orders");
      // The button is on the placed orders only, and does what it says.
      const row = preview.locator("tr", { hasText: "ORD-1007" }).filter({ visible: true });
      // The page answers clicks once React has taken it over; a press made earlier is lost.
      await preview.locator("body[data-hydrated]").waitFor({ timeout: 60000 });
      for (let attempt = 1; ; attempt++) {
        await row.getByRole("button", { name: "Cancel order" }).click({ timeout: 60000 });
        try {
          await row.getByText("Canceled").waitFor({ timeout: 10000 });
          break;
        } catch (error) {
          if (attempt === 3) throw error;
        }
      }
      if (
        await preview
          .locator("tr", { hasText: "Draft" })
          .getByRole("button", { name: "Cancel order" })
          .count()
      )
        throw new Error("a draft order has the button");
    },
  );
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
  await step(
    "an action's intent is changed from its own form, and Undo takes it back",
    async () => {
      await change("Change what an action says");
      await page.getByLabel("Action").selectOption("mergeCustomers");
      await page.getByLabel("Intent").fill("Fold a duplicate customer into the one to keep.");
      await page.getByRole("button", { name: "Change action" }).click();
      await trace
        .getByText(/mergeCustomers/)
        .first()
        .waitFor({ timeout: 60000 });
      await status.getByRole("button", { name: "Undo this change" }).click();
      await status.getByText(/^Undid: .*mergeCustomers/).waitFor({ timeout: 60000 });
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
    await page.getByRole("tab", { name: "What it does" }).click();
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
  await step("a kind of record is renamed everywhere in one change (finding 8)", async () => {
    await page.getByRole("tab", { name: "What it does" }).click();
    const orders = page.getByRole("region", { name: "Orders", exact: true });
    await orders.getByRole("button", { name: "Orders", exact: true }).click();
    await orders.getByLabel("Called, for one").fill("Job");
    // The name for several follows until it is typed.
    if ((await orders.getByLabel("Called, for several").inputValue()) !== "Jobs")
      throw new Error("the name for several did not follow");
    await orders.getByRole("button", { name: "Rename everywhere" }).click();
    await trace
      .getByText("Order records are now called jobs (one job)")
      .first()
      .waitFor({ timeout: 60000 });
    // The list page, and so its menu entry, is called Jobs too.
    if (!(await project()).files.content.includes("title: Jobs"))
      throw new Error("the orders page kept its title");
    await page.locator("header").getByRole("button", { name: "Undo", exact: true }).click();
    await trace
      .getByText("Undid: Order records are now called jobs (one job)")
      .first()
      .waitFor({ timeout: 60000 });
  });
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
  await step(
    "look and feel: a theme, density and motion are chosen without touching code",
    async () => {
      const theme = page.getByRole("region", { name: "Font, density and motion" });
      await theme.getByRole("button", { name: "Compact" }).click();
      await theme
        .getByRole("button", { name: "Compact", pressed: true })
        .waitFor({ timeout: 60000 });
      await theme.getByRole("button", { name: "Lively" }).click();
      await theme
        .getByRole("button", { name: "Lively", pressed: true })
        .waitFor({ timeout: 60000 });
      const themes = page.getByRole("list", { name: "Themes" });
      // The project's own theme has its card, named with its file.
      await themes
        .getByRole("button", { name: /Forest/ })
        .getByText("themes/forest.yml", { exact: false })
        .waitFor();
      // The theme swaps a font package, so the app's server restarts: the preview keeps the last
      // page on screen meanwhile (never an empty panel) and says Updating… from the start.
      await page.locator('iframe[title="App preview"]').waitFor();
      await page.evaluate(() => {
        const watch = { gaps: 0, updating: false };
        window.__previewWatch = watch;
        window.__previewTimer = setInterval(() => {
          // The new page, or the last ready one kept on screen while it loads.
          if (
            !document.querySelector('iframe[title="App preview"], iframe[title="Previous preview"]')
          )
            watch.gaps++;
          for (const el of document.querySelectorAll("span"))
            if (el.textContent === "Updating…") watch.updating = true;
        }, 50);
      });
      await themes.getByRole("button", { name: /Playful/ }).click();
      await trace.getByText("Use the playful theme").first().waitFor({ timeout: 60000 });
      await themes
        .getByRole("button", { name: /Playful/, pressed: true })
        .waitFor({ timeout: 60000 });
      await page.getByText("Updating…").waitFor({ state: "hidden", timeout: 120000 });
      const watch = await page.evaluate(() => {
        clearInterval(window.__previewTimer);
        return window.__previewWatch;
      });
      if (watch.gaps)
        throw new Error(`the preview was empty in ${watch.gaps} checks during the restart`);
      if (!watch.updating) throw new Error("the preview never said Updating…");
    },
  );
  // Every app has every theme's font, so a theme never needs an install (a hosted workspace
  // could not fetch one).
  await step("a theme and its undo change no package: its font was installed already", async () => {
    const before = readFileSync(join(dir, "package.json"), "utf8");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await status.getByText(/Undid: Use the playful theme/).waitFor({ timeout: 60000 });
    if (readFileSync(join(dir, "package.json"), "utf8") !== before)
      throw new Error("the theme changed package.json");
    const after = JSON.parse(before).dependencies;
    if (Object.keys(after).filter((name) => name.startsWith("@fontsource-variable/")).length < 3)
      throw new Error("package.json does not list every theme's font");
    for (const name of Object.keys(after))
      if (!existsSync(join(dir, "node_modules", name))) throw new Error(`${name} is not installed`);
  });
  await step(
    "a page that comes without its stylesheet starts the preview again, once for each change (finding 3)",
    async () => {
      const unstyled = async () =>
        (await (await fetch(`${base}/api/logs`)).json()).filter((l) =>
          l.startsWith("The preview's page came without its stylesheet"),
        ).length;
      const before = await unstyled();
      // A page that had its stylesheet never said otherwise before this step.
      if (before) throw new Error(`the preview was started again ${before} times for no reason`);
      // As the preview editor says it when the theme's variables are missing once the page loaded.
      const say = () =>
        preview
          .locator("body")
          .evaluate(() =>
            window.parent.postMessage({ source: "smithable-preview", type: "unstyled" }, "*"),
          );
      // The undo before reloads the preview (without a restart, a second later): until Studio
      // has had its "changed" the undo is the change under way, and a frame still loading is
      // about:blank, whose messages carry Studio's own origin and are rightly not the preview's.
      await page.getByText("Updating…").waitFor({ state: "hidden", timeout: 120000 });
      await preview.locator("body[data-hydrated]").waitFor({ timeout: 120000 });
      await say();
      for (const deadline = Date.now() + 30000; (await unstyled()) === before; ) {
        if (Date.now() > deadline) throw new Error("the preview was not started again");
        await new Promise((r) => setTimeout(r, 500));
      }
      // It comes back; said again without a change in between, it is not started again.
      await preview.locator("body[data-hydrated]").waitFor({ timeout: 120000 });
      await say();
      await new Promise((r) => setTimeout(r, 2000));
      if ((await unstyled()) !== before + 1) throw new Error("the preview was started again twice");
    },
  );
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
      await page
        .getByLabel("Describe a change")
        .fill("A mobile number for every customer would help");
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
      await page.getByRole("tab", { name: "What it does" }).click();
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
      // "Their own" beside a role that may see them all says so, in the chips and the change
      // (finding 9); Default takes the row back.
      await customers.getByRole("button", { name: "See: their own" }).click();
      await trace
        .getByText(
          "Sales users and admins can see all customers; everyone else only the ones they own",
        )
        .first()
        .waitFor({ timeout: 60000 });
      await customers.getByText("sales users may see all of them").waitFor();
      await customers.getByRole("button", { name: "See: default" }).click();
      await trace
        .getByText("Everyone with access can see customers again")
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
      await page.getByRole("tab", { name: "What it does" }).click();
      const changes = await trace.locator("li").count();
      const again = page.getByRole("region", { name: "Customers", exact: true });
      await again.getByRole("button", { name: "In my words" }).click();
      await page.getByLabel("Customers, in your words").fill("Our clients and how to reach them.");
      await again.getByRole("button", { name: "Keep my words" }).click();
      await again.getByText("Our clients and how to reach them.").waitFor();
      if ((await trace.locator("li").count()) !== changes)
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
  // A start is 15 s in a hosted workspace: after an undo the preview opens the database that
  // was put back, in the process it runs in, and is not started again.
  await step("an undo does not start the preview again", async () => {
    await new Promise((r) => setTimeout(r, 3000));
    const lines = await (await fetch(`${base}/api/logs`)).json();
    const started = lines.slice(-150).filter((l) => /The preview (answers|stopped)/.test(l));
    if (started.length) throw new Error(`the preview was started again: ${started[0]}`);
    if (!(await fetch(`http://localhost:${port + 1}/health`)).ok)
      throw new Error("the preview does not answer after the undo");
  });
  await step("Redo makes again the change undone, and then has nothing left to redo", async () => {
    const redo = page.getByRole("button", { name: "Redo", exact: true });
    await redo.click();
    // The button is off while Studio works too: first the change made again, then nothing left.
    let newest = "";
    for (const deadline = Date.now() + 90000; ; ) {
      newest = await trace.locator("li").first().innerText();
      if (newest.includes("loyalty code") && !newest.startsWith("Undid")) break;
      if (Date.now() > deadline) throw new Error(`after Redo the newest change is ${newest}`);
      await new Promise((r) => setTimeout(r, 500));
    }
    await page
      .locator("header")
      .getByRole("button", { name: "Redo", exact: true, disabled: true })
      .waitFor({ timeout: 30000 });
  });
  await step("the Look tab shows smithable.ux.yml as controls, each applied at once", async () => {
    const ux = () => readFileSync(join(dir, "smithable.ux.yml"), "utf8");
    await page.getByRole("button", { name: "Your app", exact: true }).first().click();
    await page.getByRole("tab", { name: "Look" }).click();
    const look = (name) => page.getByRole("region", { name });
    await look("Font, density and motion").getByRole("button", { name: "Comfortable" }).click();
    await look("Font, density and motion")
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
    const before = await trace.locator("li").count();
    await columns
      .getByRole("button", { name: /^Hide / })
      .last()
      .click();
    await columns
      .getByRole("button", { name: /^Show / })
      .first()
      .waitFor({ timeout: 60000 });
    // The last change is done before the next (a change while one runs is not made).
    // (Which columns depends on the fields added before: one change more is enough.)
    for (let i = 0; i < 60 && (await trace.locator("li").count()) === before; i++)
      await new Promise((r) => setTimeout(r, 1000));
    if ((await trace.locator("li").count()) === before)
      throw new Error("hiding a column made no change");
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
    await page.getByRole("tab", { name: "What it does" }).click();
  });

  await step(
    "Builder takes ordinary names, and says a refusal without the files' language (finding 7)",
    async () => {
      await change("Add a kind of record");
      await page.getByLabel("Model name").fill("Order line");
      await page.getByText("Saved as OrderLine").waitFor();
      await page.getByLabel("First field").fill("product name");
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await trace
        .getByText("Added a new kind of record: order lines")
        .first()
        .waitFor({ timeout: 60000 });
      if (!readFileSync(join(dir, "smithable.yml"), "utf8").includes("OrderLine:"))
        throw new Error("Order line was not made OrderLine");
      // The shipping cost's formula names the shipping method: refused, in plain words.
      await change("Remove a field");
      await page.getByLabel("Kind of record").selectOption("Order");
      await page.getByLabel("Field", { exact: true }).selectOption("shippingMethod");
      // The form's button (a selected field has one of its own).
      await page.locator('button[type="submit"]', { hasText: "Remove field" }).click();
      const alert = page.getByRole("alert").first();
      await alert.waitFor({ timeout: 60000 });
      const said = await alert.innerText();
      if (/smithable\.yml|removeField|:\d+:\d+/.test(said))
        throw new Error(`the refusal speaks the files' language: ${said}`);
      await alert.getByRole("button", { name: "Dismiss" }).click();
    },
  );
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
      await page.getByRole("tab", { name: "What it does" }).click();
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
    // A name is checked as it is typed, in the words the operation would refuse it with, and
    // the operation waits (Johan's feedback).
    await page.getByLabel("Operation").selectOption("addPage");
    await page.getByLabel("page", { exact: true }).fill("Hello");
    await page.getByText('Page name "Hello" must start with a lowercase letter').waitFor();
    if (!(await page.getByRole("button", { name: "Apply addPage" }).isDisabled()))
      throw new Error("addPage can be applied with a name that does not fit");
    await page.getByLabel("page", { exact: true }).fill("hello");
    await page.getByRole("button", { name: "Apply addPage", disabled: false }).waitFor();
    // A list opens as the app has it (finding 13): the customers table's columns are ticked.
    await page.getByLabel("Operation").selectOption("setColumns");
    await page.getByLabel("page", { exact: true }).selectOption("customers");
    const columns = page.getByRole("group", { name: "columns" });
    if (
      !(await columns.getByLabel("Email").isChecked()) ||
      (await columns.getByLabel("Account manager", { exact: true }).isChecked())
    )
      throw new Error("setColumns does not open with the table's columns");
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
      // A refusal is not a failure: a name that does not fit offers no report, not even the
      // earlier one.
      const refused = await (
        await fetch(`http://localhost:${port}/api/op`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-smithable": "1" },
          body: JSON.stringify({
            name: "addField",
            args: { model: "Customer", field: "Bad Name", type: "string" },
          }),
        })
      ).json();
      if (refused.ok || !refused.output.includes("must start with a lowercase letter"))
        throw new Error(`the name was not refused: ${refused.output}`);
      if (refused.report) throw new Error(`a refusal offered a report: ${refused.report}`);
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
  // docs/design/fast-start.md: a hosted workspace waits with Studio running and gets its app
  // when someone claims it. Never a person's own project.
  const replace = async (at, body) => {
    const answer = await fetch(`http://localhost:${at}/api/project/replace`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-smithable": "1" },
      body: JSON.stringify(body),
    });
    return { status: answer.status, ...(await answer.json()) };
  };
  // The preview answers on the app that came in, in the process it was running in: a start
  // would say so in Studio's log, which begins anew with the app.
  const previewUp = async (at) => {
    for (let i = 0; i < 480; i++) {
      const up = await fetch(`http://localhost:${at}/health`).then(
        (r) => r.ok,
        () => false,
      );
      if (up) return new Promise((r) => setTimeout(r, 1500));
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error("the waiting workspace's preview did not answer");
  };
  const notStartedAgain = async (studio) => {
    const at = Number(new URL(studio).port) + 1;
    for (let i = 0; i < 240; i++) {
      if (
        await fetch(`http://localhost:${at}/health`).then(
          (r) => r.ok,
          () => false,
        )
      )
        break;
      if (i === 239) throw new Error("the preview did not answer on the new app");
      await new Promise((r) => setTimeout(r, 250));
    }
    await new Promise((r) => setTimeout(r, 2000));
    const lines = await (await fetch(`${studio}/api/logs`)).json();
    const started = lines.filter((l) => /The preview (answers|stopped|has not answered)/.test(l));
    if (started.length) throw new Error(`the preview was started again: ${started[0]}`);
  };
  const finished = join(root, "finished-booking");
  await step("a project that Studio was not started to replace refuses, untouched", async () => {
    const made = spawnSync("node", [cli, "new", finished, "--starter", "booking"], {
      encoding: "utf8",
    });
    if (made.status !== 0) throw new Error(made.stdout + made.stderr);
    rmSync(join(finished, "node_modules"), { recursive: true, force: true });
    const refused = await replace(port, { from: finished });
    if (refused.status !== 403 || refused.ok) throw new Error(JSON.stringify(refused));
    if (!readFileSync(join(dir, "smithable.yml"), "utf8").includes("Customer:"))
      throw new Error("the project was touched");
  });
  let waiting;
  try {
    await step(
      "a Studio started as replaceable gets another app once, under its running preview",
      async () => {
        const pool = join(root, "pool");
        const made = spawnSync("node", [cli, "new", pool, "--starter", "records"], {
          encoding: "utf8",
        });
        if (made.status !== 0) throw new Error(made.stdout + made.stderr);
        waiting = spawn(
          "node",
          [cli, "studio", pool, "--port", String(port + 2), "--replaceable"],
          { detached: true, env: { ...process.env, SMITHABLE_LOCAL_MODEL: "" } },
        );
        const other = `http://localhost:${port + 2}`;
        const preview = `http://localhost:${port + 3}`;
        const answers = async (url, within) => {
          for (let i = 0; i < within * 4; i++) {
            const status = await fetch(url, { redirect: "manual" }).then(
              (r) => r.status,
              () => 0,
            );
            if (status === 200) return true;
            await new Promise((r) => setTimeout(r, 250));
          }
          return false;
        };
        if (!(await answers(`${preview}/health`, 120))) throw new Error("the first preview");
        // An app whose packages are not the ones installed is refused, and may be asked again.
        const odd = join(root, "odd");
        cpSync(finished, odd, { recursive: true });
        const pkg = JSON.parse(readFileSync(join(odd, "package.json"), "utf8"));
        pkg.dependencies.dayjs = "1.11.13";
        writeFileSync(join(odd, "package.json"), JSON.stringify(pkg));
        const unfit = await replace(port + 2, { from: odd });
        if (unfit.ok || !unfit.output.includes("other packages")) throw new Error(unfit.output);
        if (!readFileSync(join(pool, "smithable.yml"), "utf8").includes("Our Collection"))
          throw new Error("a refused replacement touched the project");

        const started = Date.now();
        const done = await replace(port + 2, {
          from: finished,
          name: "Morning Yoga",
          admin: "tester@example.org",
        });
        if (!done.ok) throw new Error(done.output);
        // Studio shows the new app at once, under the person's name for it and with them as
        // its administrator; its history starts anew.
        const project = await (await fetch(`${other}/api/project`)).json();
        if (project.name !== "Morning Yoga") throw new Error(`Studio shows ${project.name}`);
        if (project.trace?.length) throw new Error("the new app has the old one's history");
        if (!readFileSync(join(pool, "smithable.auth.yml"), "utf8").includes("tester@example.org"))
          throw new Error("the administrator was not set");
        if (existsSync(join(pool, ".git"))) throw new Error("the old history is still there");
        // The preview answers on the new app: a page only the booking site has.
        if (!(await answers(`${preview}/schedule`, 60)))
          throw new Error("the preview does not show the new app's schedule");
        console.log(
          `    (the preview answered ${Math.round((Date.now() - started) / 100) / 10} s after the request)`,
        );
        // Nothing was bundled again for it (the blog shows Markdown, the collection did not):
        // every app lists the same libraries.
        if (!(await answers(`${preview}/blog`, 30))) throw new Error("the blog did not answer");
        // Its log starts with it: nothing of the app that was there, nor of the exchange.
        const said = await (await fetch(`${other}/api/logs`)).json();
        const stale = said.filter((l) =>
          /Our Collection|Failed to load url|optimized dependencies changed/.test(l),
        );
        if (stale.length) throw new Error(`the log has: ${stale[0].slice(0, 200)}`);
        // Once: the app is a person's own now.
        const again = await replace(port + 2, { from: finished });
        if (again.status !== 403) throw new Error(`a second replacement answered ${again.status}`);
      },
    );
    await step(
      "from a description without a model the starter comes in under the running preview, and Studio says why",
      async () => {
        const pool = join(root, "pool");
        process.kill(-waiting.pid);
        await new Promise((r) => setTimeout(r, 1500));
        waiting = spawn(
          "node",
          [cli, "studio", pool, "--port", String(port + 2), "--replaceable"],
          { detached: true, env: { ...process.env, SMITHABLE_LOCAL_MODEL: "" } },
        );
        const other = `http://localhost:${port + 2}`;
        // The waiting workspace is ready when its own preview has answered (as the service
        // waits before it offers one): what the log says after that is about the new app.
        await previewUp(port + 3);
        const done = await replace(port + 2, {
          describe: "A site to show my dogs",
          starter: "records",
          name: "Dogs",
          admin: "tester@example.org",
        });
        if (!done.ok || !done.output.includes("no AI model is available); starting from records"))
          throw new Error(done.output);
        const project = await (await fetch(`${other}/api/project`)).json();
        if (project.name !== "Dogs") throw new Error(`Studio shows ${project.name}`);
        if (!project.notice?.includes("could not be used this time"))
          throw new Error(`no notice: ${project.notice}`);
        if (
          readFileSync(join(pool, "smithable.yml"), "utf8").includes("ClassType") ||
          existsSync(join(pool, ".git"))
        )
          throw new Error("the app that was there is still there");
        await notStartedAgain(other);
      },
    );
    await step(
      "an app from a description is made beside the project and comes in under the running preview",
      async () => {
        const pool = join(root, "pool");
        process.kill(-waiting.pid);
        await new Promise((r) => setTimeout(r, 1500));
        waiting = spawn(
          "node",
          [cli, "studio", pool, "--port", String(port + 2), "--replaceable"],
          {
            detached: true,
            env: {
              ...process.env,
              SMITHABLE_LOCAL_MODEL: "fake-model",
              SMITHABLE_LOCAL_URL: model.url,
            },
          },
        );
        const other = `http://localhost:${port + 2}`;
        await previewUp(port + 3);
        const done = await replace(port + 2, {
          describe: "A booking site for a pilates studio",
          admin: "tester@example.org",
        });
        if (!done.ok) throw new Error(done.output);
        const project = await (await fetch(`${other}/api/project`)).json();
        if (project.name !== "Lotus Pilates") throw new Error(`Studio shows ${project.name}`);
        if (project.notice) throw new Error(`a notice for a draft that worked: ${project.notice}`);
        if (existsSync(`${pool}.incoming`))
          throw new Error("what was made beside it is still there");
        await notStartedAgain(other);
      },
    );
    // docs/design/while-it-is-made.md: the person is let into Studio at once, and Studio says
    // where the making of their app is.
    await step(
      "a described app can be taken on at once: Studio says where its making is, and lets nothing else change the project meanwhile",
      async () => {
        const pool = join(root, "pool");
        process.kill(-waiting.pid);
        await new Promise((r) => setTimeout(r, 1500));
        waiting = spawn(
          "node",
          [cli, "studio", pool, "--port", String(port + 2), "--replaceable"],
          {
            detached: true,
            env: {
              ...process.env,
              SMITHABLE_LOCAL_MODEL: "fake-model",
              SMITHABLE_LOCAL_URL: model.url,
            },
          },
        );
        const other = `http://localhost:${port + 2}`;
        await previewUp(port + 3);
        // The page, open before the description is sent: the making screen comes at once, with
        // the description and the bar, then What it does once the model has answered, then
        // Builder with the app (docs/design/while-it-is-made.md stage one).
        const watcher = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await watcher.goto(other);
        await watcher.locator("header").first().waitFor({ timeout: 60000 });
        const seen = (async () => {
          const screen = watcher.getByRole("region", { name: "Your app is being made" });
          await screen.getByText("A booking site for a pilates studio").waitFor({ timeout: 15000 });
          await screen.getByRole("progressbar").waitFor();
          if (!(await watcher.getByRole("button", { name: "Undo", exact: true }).isDisabled()))
            throw new Error("Undo is on while the app is being made");
          await screen
            .getByRole("region", { name: "What it does" })
            .getByText("Sessions")
            .first()
            .waitFor({ timeout: 15000 });
          await screen.waitFor({ state: "detached", timeout: 60000 });
          await watcher
            .locator("header")
            .first()
            .getByText("Lotus Pilates")
            .waitFor({ timeout: 30000 });
        })();
        // Awaited after the making: a failure meanwhile is held for then, not thrown unhandled.
        seen.catch(() => {});
        const taken = await replace(port + 2, {
          describe: "A booking site for a pilates studio",
          admin: "tester@example.org",
          wait: false,
          usual: 20000,
        });
        if (taken.status !== 202 || !taken.accepted) throw new Error(JSON.stringify(taken));
        const stages = new Set();
        let drafted = false;
        let refused = false;
        for (let i = 0; ; i++) {
          const project = await (await fetch(`${other}/api/project`)).json();
          const making = project.making;
          if (!making) {
            if (project.name !== "Lotus Pilates") throw new Error(`Studio shows ${project.name}`);
            break;
          }
          if (i > 600) throw new Error(`still ${making.stage} after a minute`);
          if (making.stage === "failed") throw new Error(`the making failed: ${making.error}`);
          if (
            making.description !== "A booking site for a pilates studio" ||
            making.usual !== 20000
          )
            throw new Error(`making says ${JSON.stringify(making).slice(0, 200)}`);
          stages.add(making.stage);
          // Once the model has answered, the draft's files are there for "What it does".
          if (making.files?.spec?.includes("Lotus Pilates")) drafted = true;
          if (!refused) {
            const change = await fetch(`${other}/api/op`, {
              method: "POST",
              headers: { "content-type": "application/json", "x-smithable": "1" },
              body: JSON.stringify({ name: "setApp", args: { name: "Mine" } }),
            });
            if (change.status === 409) refused = true;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        if (!stages.size) throw new Error("Studio never said the app was being made");
        if (!drafted) throw new Error("the draft's files were never shown while it was built");
        if (!refused) throw new Error("a change was let through while the app was being made");
        await seen.finally(() => watcher.close());
        await notStartedAgain(other);
      },
    );
    await step(
      "asked to, Studio reads the description itself: it asks only what that leaves open, drafts with the answer, and keeps what is typed meanwhile",
      async () => {
        const pool = join(root, "pool");
        const again = async () => {
          process.kill(-waiting.pid);
          await new Promise((r) => setTimeout(r, 1500));
          waiting = spawn(
            "node",
            [cli, "studio", pool, "--port", String(port + 2), "--replaceable"],
            {
              detached: true,
              env: {
                ...process.env,
                SMITHABLE_LOCAL_MODEL: "fake-model",
                SMITHABLE_LOCAL_URL: model.url,
              },
            },
          );
          await previewUp(port + 3);
        };
        const other = `http://localhost:${port + 2}`;
        const post = (path, body) =>
          fetch(`${other}${path}`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-smithable": "1" },
            body: JSON.stringify(body),
          });
        const until = async (done, what) => {
          for (let i = 0; i < 600; i++) {
            const project = await (await fetch(`${other}/api/project`)).json();
            if (project.making?.stage === "failed")
              throw new Error(`the making failed: ${project.making.error}`);
            if (done(project)) return project;
            await new Promise((r) => setTimeout(r, 100));
          }
          throw new Error(`never ${what}`);
        };
        // A starter's own description leaves nothing open: no question, and no model.
        await again();
        const calls = model.requests.length;
        const crm = JSON.parse(
          spawnSync("node", [cli, "starters", "--json"], { encoding: "utf8" }).stdout,
        ).find((starter) => starter.name === "crm").description;
        const plain = await replace(port + 2, { describe: crm, ask: true, wait: false });
        if (plain.status !== 202) throw new Error(JSON.stringify(plain));
        const asked = new Set();
        await until((project) => {
          if (project.making) asked.add(project.making.stage);
          return !project.making;
        }, "in place");
        if (asked.has("asking")) throw new Error("it asked about a starter's own description");
        if (model.requests.length !== calls) throw new Error("a model was asked for it");

        // The reader knows this is a status page for a team, not what visitors may see: one
        // question, at once and without a model; the answer goes into what the model drafts from.
        await again();
        const taken = await replace(port + 2, {
          describe: "A status page for our services",
          ask: true,
          wait: false,
        });
        if (taken.status !== 202) throw new Error(JSON.stringify(taken));
        const asking = await until((project) => project.making?.stage === "asking", "asked");
        const questions = asking.making.questions;
        if (questions.length !== 1 || questions[0].about !== "visitors")
          throw new Error(`asked ${JSON.stringify(questions)}`);
        if (model.requests.length !== calls) throw new Error("a model was asked before the draft");
        // What the person types meanwhile waits in Studio, and may be taken back.
        await post("/api/waiting", { add: "add a phone number to components" });
        await post("/api/waiting", { add: "not this one" });
        const kept = await (await post("/api/waiting", { remove: 1 })).json();
        if (kept.waiting.join() !== "add a phone number to components")
          throw new Error(`waiting: ${kept.waiting}`);
        const answered = await post("/api/making/answer", { answers: ["Yes, they can look"] });
        if (!answered.ok) throw new Error(`the answer was refused: ${answered.status}`);
        const made = await until((project) => !project.making, "in place");
        if (made.waiting?.join() !== "add a phone number to components")
          throw new Error(`what was typed did not wait: ${made.waiting}`);
        const drafted = model.requests.slice(calls).map((request) => JSON.stringify(request));
        if (!drafted.some((text) => text.includes("Yes, they can look")))
          throw new Error("the answer did not reach the draft");
        if ((await post("/api/making/answer", { answers: [] })).status !== 409)
          throw new Error("an answer was taken with nothing asked");
      },
    );
  } finally {
    try {
      if (waiting) process.kill(-waiting.pid);
    } catch {}
  }
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
