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
import { crc32, deflateSync } from "node:zlib";
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

/** A grey PNG of the size given, for the logo. */
function png(width, height) {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])));
    return Buffer.concat([length, Buffer.from(type), data, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 0, 0, 0, 0], 8); // 8-bit greyscale
  const rows = Buffer.alloc((width + 1) * height, 0x80);
  for (let y = 0; y < height; y++) rows[y * (width + 1)] = 0; // each row: no filter
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function step(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    const shot = join(root, "failure.png");
    await page.screenshot({ path: shot }).catch(() => {});
    // What Code mode's Problems list said, for a failure the picture alone cannot explain (CI).
    const problems = await page
      .getByRole("list", { name: "Problems" })
      .innerText({ timeout: 1000 })
      .catch(() => "");
    console.log(
      `  ✗ ${name}\n    ${String(error.message).split("\n").slice(0, 3).join("\n    ")}\n    see ${shot}${problems ? `\n    Problems: ${problems.replace(/\n+/g, " | ")}` : ""}`,
    );
    failed = true;
    throw error;
  }
}

// The administrator is given, not taken from the machine's Git user: CI's is ci@example.com, and
// an administrator nobody can mail is a problem the auth file's check reports (as it should).
const created = spawnSync("node", [cli, "new", dir, "--admin", "studio-test@smithable.ai"], {
  encoding: "utf8",
});
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
  // Builder's newest change, under the panels; the list itself is in the Changes tab.
  const last = page.getByRole("region", { name: "Last change" });
  const changeCount = async () => (await (await fetch(`${base}/api/project`)).json()).trace.length;
  const changesTab = () => page.getByRole("tab", { name: "Changes" }).click();
  const change = async (label) => {
    await changesTab();
    const forms = page.locator("details", { hasText: "Change by form" });
    if (!(await forms.getAttribute("open").then((v) => v !== null)))
      await forms.locator("summary").click();
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
    await page.goto(`${base}/?guide=off`);
    await page.getByRole("region", { name: "Customers" }).getByText("a name (required)").waitFor();
    await page.getByText("an email (unique)", { exact: true }).waitFor();
    // A new app has no repository until its first change: its changes are none, not Git's
    // refusal.
    const { trace: made } = await (await fetch(`${base}/api/project`)).json();
    if (made.length) throw new Error(`a new app has changes: ${JSON.stringify(made[0])}`);
  });
  await step(
    "the header has How to publish and Help, which open the docs (finding 14)",
    async () => {
      const header = page.locator("header").first();
      for (const [name, href] of [
        ["How to publish", "https://docs.smithable.ai/self-host.html"],
        ["Help", "https://docs.smithable.ai/start.html"],
      ])
        if ((await header.getByRole("link", { name, exact: true }).getAttribute("href")) !== href)
          throw new Error(`${name} does not lead to ${href}`);
    },
  );
  await step("the Changes tab: the prompt first, the forms folded, then the list", async () => {
    await changesTab();
    const forms = page.locator("details", { hasText: "Change by form" });
    if ((await forms.getAttribute("open")) !== null) throw new Error("the forms are not folded");
    await page.getByLabel("Describe a change").waitFor();
    await page.getByRole("tab", { name: "What it does" }).click();
    await last.waitFor();
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
  await step(
    "a note in What it does applies its advice with Apply, and undo takes it back",
    async () => {
      // The CRM took its own advice (filters on its orders): take them away for the note to show.
      const op = (...args) => {
        const done = spawnSync("node", [cli, "op", ...args, "--dir", dir], {
          cwd: repo,
          encoding: "utf8",
        });
        if (done.status !== 0) throw new Error(`${args[0]}: ${done.stdout}${done.stderr}`);
      };
      op("setFilters", "orders");
      await page.reload();
      const notes = page.getByRole("region", { name: "Worth considering" });
      const orders = notes.getByRole("listitem").filter({ hasText: "orders lists orders" });
      await orders.getByRole("button", { name: "Apply" }).click();
      await orders.waitFor({ state: "detached", timeout: 30000 });
      const spec = () => readFileSync(join(dir, "smithable.yml"), "utf8");
      if (!/ {2}orders:\n(?: {4}.*\n)*? {4}filters: \[status, shippingMethod\]/.test(spec()))
        throw new Error("the orders page has no filters after Apply");
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await orders.waitFor({ timeout: 30000 });
      if (/ {4}filters: \[status, shippingMethod\]/.test(spec()))
        throw new Error("undo left the filters");
      op("setFilters", "orders", "status");
      await page.reload();
    },
  );
  await step("the preview says its records are samples, until dismissed", async () => {
    const note = page.getByRole("note").filter({ hasText: "Your published app starts empty" });
    await note.waitFor();
    await note.getByRole("button", { name: "Dismiss" }).click();
    await page.reload();
    await page.getByRole("region", { name: "Customers", exact: true }).waitFor();
    if (await note.count()) throw new Error("the samples notice came back");
  });
  await step(
    "the guide asks No code or Code, walks the places once, Guide shows it again, its Code switches modes, a reload shows nothing",
    async () => {
      // On a page of its own: every other step runs with ?guide=off.
      const fresh = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      try {
        await fresh.goto(base);
        const card = fresh.locator("[data-guide-card]");
        const seen = [];
        for (let i = 0; i < 7; i++) {
          await card.waitFor({ timeout: 20000 });
          const at = await card.getAttribute("data-guide-card");
          seen.push(at);
          // Beside a place that is on the screen.
          if (!(await fresh.locator(`[data-guide="${at}"]`).first().isVisible()))
            throw new Error(`the card for ${at} is beside nothing`);
          const button = i === 0 ? "No code" : i === 6 ? "Done" : "Next";
          await card.getByRole("button", { name: button, exact: true }).click();
        }
        if (seen.join() !== "mode,preview,summary,details,change,look,publish")
          throw new Error(seen.join());
        await card.waitFor({ state: "detached" });
        await fresh.locator("header").getByRole("button", { name: "Guide" }).click();
        await card.waitFor();
        // The first stop's Code switches to Code mode, which is remembered, and goes on with
        // Code mode's own tour.
        await card.getByRole("button", { name: "Code", exact: true }).click();
        const code = [];
        for (let i = 0; i < 5; i++) {
          await fresh.waitForFunction(
            (seen) => {
              const at = document
                .querySelector("[data-guide-card]")
                ?.getAttribute("data-guide-card");
              return at && at !== seen;
            },
            code.at(-1) ?? "mode",
            { timeout: 20000 },
          );
          const at = await card.getAttribute("data-guide-card");
          code.push(at);
          if (!(await fresh.locator(`[data-guide="${at}"]`).first().isVisible()))
            throw new Error(`the Code card for ${at} is beside nothing`);
          await card.getByRole("button", { name: i === 4 ? "Done" : "Next", exact: true }).click();
        }
        if (code.join() !== "files,problems,concepts,operation,changes")
          throw new Error(`Code mode's tour: ${code.join()}`);
        await card.waitFor({ state: "detached" });
        if (!(await fresh.getByRole("radio", { name: "Code", exact: true }).isChecked()))
          throw new Error("Code in the guide did not switch to Code mode");
        // Guide in Code mode is Code mode's tour.
        await fresh.locator("header").getByRole("button", { name: "Guide" }).click();
        await card.waitFor();
        if ((await card.getAttribute("data-guide-card")) !== "files")
          throw new Error("Guide in Code mode did not start Code mode's tour");
        await fresh.keyboard.press("Escape");
        await card.waitFor({ state: "detached" });
        await fresh.getByRole("radio", { name: "No code", exact: true }).check({ force: true });
        await fresh.reload();
        await fresh.getByRole("region", { name: "Customers", exact: true }).waitFor();
        await fresh.waitForTimeout(1000);
        if (await card.count()) throw new Error("the guide came back after a reload");
      } finally {
        await fresh.close();
      }
    },
  );
  await step(
    "the preview opens with the owner signed in as an administrator (finding 15)",
    async () => {
      // Signed in by Studio, without a click: the customers page, which needs sign-in, opens.
      await preview.getByRole("heading", { name: "Customers" }).waitFor({ timeout: 120000 });
    },
  );
  await step(
    "a click in the preview opens the page in the same document, never a new load (the white flash)",
    async () => {
      const frame = await (
        await page.locator('iframe[title="App preview"]').elementHandle()
      )?.contentFrame();
      if (!frame) throw new Error("no preview frame");
      await frame.evaluate(() => {
        window.__sameDocument = true;
      });
      await preview.locator("main tbody tr").first().click();
      await frame.waitForURL(/\/customers\/\d+$/, { timeout: 30000 });
      // Studio's address follows the page; the frame must not be loaded again for it.
      await page.waitForFunction(() =>
        document
          .querySelector('input[aria-label="Preview address"]')
          ?.value.includes("/customers/"),
      );
      await page.waitForTimeout(500);
      if (!(await frame.evaluate(() => window.__sameDocument === true)))
        throw new Error("the preview loaded a new document");
      await frame.evaluate(() => history.back());
      await preview.getByRole("heading", { name: "Customers" }).waitFor({ timeout: 30000 });
    },
  );
  await step(
    "adding a field: the summary and the change trace follow at once, the form empties, and the preview follows and flashes what changed",
    async () => {
      await change("Add a field");
      await page.getByLabel("Name", { exact: true }).fill("website");
      await page.getByLabel("Field type").selectOption({ label: "Web address" });
      await page.getByRole("button", { name: "Add field" }).click();
      // The field, then its column in the list (Show it in listings): the trace has both.
      await last
        .getByText("Customers: added a website (a web address)")
        .waitFor({ timeout: 60000 });
      // The left side has the change as soon as it is done, before the app has restarted with
      // it (finding 12), and the form starts again empty rather than inviting a second click.
      await last.getByText("Customers: added a website (a web address)").waitFor({ timeout: 3000 });
      if ((await page.getByLabel("Name", { exact: true }).inputValue()) !== "")
        throw new Error("The add-field form kept its values after the change went through");
      await page.getByRole("tab", { name: "What it does" }).click();
      await page.getByText("a web address").first().waitFor();
      await openPreview("/customers/new");
      await preview.getByLabel("Website").waitFor({ timeout: 60000 });
      // "Show it in listings" was on: the customers list has the column (its look names columns).
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
      await last
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
      await last
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
      await last.getByText("Customers: removed the phone").waitFor({ timeout: 60000 });
      await status.getByRole("button", { name: "Undo this change" }).click();
      await status.getByText("Undid: Customers: removed the phone").waitFor({ timeout: 60000 });
      await last.getByText("Undid: Customers: removed the phone").waitFor();
    },
  );
  await step(
    "an action's intent is changed from its own form, and Undo takes it back",
    async () => {
      await change("Change what an action says");
      await page.getByLabel("Action").selectOption("mergeCustomers");
      await page.getByLabel("Intent").fill("Fold a duplicate customer into the one to keep.");
      await page.getByRole("button", { name: "Change action" }).click();
      await last
        .getByText(/mergeCustomers/)
        .first()
        .waitFor({ timeout: 60000 });
      await status.getByRole("button", { name: "Undo this change" }).click();
      await status.getByText(/^Undid: .*mergeCustomers/).waitFor({ timeout: 60000 });
    },
  );
  await step("access: sales may add orders, and nothing else", async () => {
    await change("Who can do what");
    await page.getByLabel("Role", { exact: true }).selectOption("sales");
    await page.getByLabel("What", { exact: true }).selectOption("create");
    await page.getByRole("checkbox", { name: "Order" }).check();
    await page.getByRole("button", { name: "Grant" }).click();
    await status.getByText("sales may add orders", { exact: true }).waitFor({ timeout: 60000 });
    await page.getByRole("tab", { name: "What it does" }).click();
    await page.getByText(/adds orders/).waitFor();
  });

  await step(
    "Who can: each tick one grant, the all headers, the record rule's warning, anyone, a new role",
    async () => {
      const authFile = join(dir, "smithable.auth.yml");
      const before = readFileSync(authFile, "utf8");
      const waitAuth = async (fits, what) => {
        for (let i = 0; i < 60 && !fits(readFileSync(authFile, "utf8")); i++)
          await new Promise((r) => setTimeout(r, 1000));
        if (!fits(readFileSync(authFile, "utf8")))
          throw new Error(`no ${what} in smithable.auth.yml:\n${readFileSync(authFile, "utf8")}`);
        // A change made while another runs is dropped: the next waits for Studio to be done.
        await page.getByText("Working…").waitFor({ state: "detached", timeout: 60000 });
      };
      await page.getByRole("tab", { name: "Who can" }).click();
      const grid = page.getByRole("region", { name: "Who can" });
      const box = (name) => grid.getByRole("checkbox", { name, exact: true });
      let changes = 0;
      // A tick, its file, and the box showing it: "Working…" goes before Studio has read the
      // project again, and a box clicked on the old state would write the old grant (an "every
      // page" header still showing all writes none).
      const tick = async (name, fits, what) => {
        const was = await box(name).isChecked();
        await box(name).click();
        changes++;
        await waitAuth(fits, what);
        for (let i = 0; i < 60 && (await box(name).isChecked()) === was; i++)
          await new Promise((r) => setTimeout(r, 500));
        if ((await box(name).isChecked()) === was)
          throw new Error(`${name} did not follow the file`);
      };
      // One tick is the role's grant written whole (the access step left create: [Order]).
      if (!(await box("sales may add orders").isChecked())) throw new Error("orders not ticked");
      await tick(
        "sales may add customers",
        (t) => /create: \[Customer, Order\]/.test(t),
        "create: [Customer, Order]",
      );
      await status.getByText("sales may add customers, orders").waitFor({ timeout: 60000 });
      // Under "pages: all" an untick writes the rest; the header writes all again.
      await tick("sales may open the customers page", (t) => !/pages: all/.test(t), "a page list");
      await tick(
        "sales: Every page (also pages added later)",
        (t) => /pages: all/.test(t),
        "pages: all",
      );
      // Private records: changing everyone's customers without seeing them is marked in place.
      await page.getByLabel("Everyone sees, changes and deletes only their own records").click();
      changes++;
      await waitAuth((t) => /defaultAccess: private/.test(t), "defaultAccess: private");
      const unseen = grid.getByText(
        "Tick See too, or sales cannot open the customers they may change.",
      );
      await unseen.waitFor({ state: "attached", timeout: 60000 });
      await tick(
        "sales may see everyone's customers",
        (t) => /read: \[Customer\]/.test(t),
        "read: [Customer]",
      );
      await unseen.waitFor({ state: "detached", timeout: 60000 });
      // Anyone reading customers is told they hold personal data.
      await tick(
        "Anyone may read customers",
        (t) => /read: \[Customer\]\n/.test(t.split("public:")[1] ?? ""),
        "public read",
      );
      await grid
        .getByText(/Anyone on the internet can read .*email/)
        .waitFor({ state: "attached", timeout: 60000 });
      // A new role starts empty, with the note to tick its pages; new users may get it.
      const roles = page.getByRole("region", { name: "Roles" });
      await roles.getByLabel("New role's name").fill("teacher");
      await roles.getByLabel("New role's description").fill("Teaches the classes.");
      await roles.getByRole("button", { name: "Add a role" }).click();
      changes++;
      await waitAuth(
        (t) => /teacher:\n\s+description: Teaches the classes\./.test(t),
        "the teacher role",
      );
      await grid
        .getByText("teacher opens no page yet: tick the pages they use.")
        .waitFor({ timeout: 60000 });
      await roles.getByLabel("New users get").selectOption("teacher");
      changes++;
      await waitAuth((t) => /defaultRole: teacher/.test(t), "defaultRole: teacher");
      // Ask, the assistant in the app: on for everyone who signs in, its button in the preview,
      // then off again.
      const asking = page.getByRole("region", { name: "Ask, the assistant in the app" });
      await asking.getByLabel("Who gets Ask").selectOption("signed-in");
      changes++;
      await waitAuth((t) => /assistant:\n {2}for: signed-in/.test(t), "assistant for signed-in");
      await preview.getByRole("button", { name: "Ask", exact: true }).waitFor({ timeout: 90000 });
      // Its name from the content file, shown on its button; its voice in the ux file.
      await asking.getByLabel("Ask's name").fill("Nova");
      await asking.getByLabel("Ask's name").blur();
      changes++;
      const contentFile = join(dir, "smithable.content.yml");
      for (let i = 0; i < 60 && !/name: Nova/.test(readFileSync(contentFile, "utf8")); i++)
        await new Promise((r) => setTimeout(r, 1000));
      await page.getByText("Working…").waitFor({ state: "detached", timeout: 60000 });
      await preview.getByRole("button", { name: "Nova", exact: true }).waitFor({ timeout: 90000 });
      await asking.getByLabel("Ask's voice").selectOption("friendly");
      changes++;
      const uxFile = join(dir, "smithable.ux.yml");
      for (let i = 0; i < 60 && !/voice: friendly/.test(readFileSync(uxFile, "utf8")); i++)
        await new Promise((r) => setTimeout(r, 1000));
      if (!/voice: friendly/.test(readFileSync(uxFile, "utf8")))
        throw new Error("no voice in the ux file");
      await page.getByText("Working…").waitFor({ state: "detached", timeout: 60000 });
      await asking.getByLabel("Who gets Ask").selectOption("off");
      changes++;
      await waitAuth((t) => !/^assistant:/m.test(t), "no assistant");
      // Everything undone, as later steps expect the file as it was.
      for (let i = 0; i < changes; i++) {
        const undone = await fetch(`${base}/api/undo`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-smithable": "1" },
          body: "{}",
        });
        if (!undone.ok) throw new Error(`undo answered ${undone.status}`);
      }
      await waitAuth((t) => t === before, "the file as it was");
      await page.getByRole("tab", { name: "What it does" }).click();
    },
  );

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
      await last.getByText("in the customers table").first().waitFor({ timeout: 60000 });
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
      // The preview reloads a few seconds after the column change before: a click that lands in
      // the frame being replaced edits nothing, so the title must be editable before typing.
      const title = preview.locator('[data-sm-text="pages.customers.title"]');
      await page.getByRole("button", { name: "Select" }).click();
      for (let attempt = 1; ; attempt++) {
        await openPreview("/customers");
        await preview
          .locator("html[data-sm-selecting]")
          .waitFor({ state: "attached", timeout: 60000 });
        await title.click({ timeout: 60000 });
        try {
          await title.and(preview.locator("[contenteditable=true]")).waitFor({ timeout: 5000 });
          break;
        } catch (error) {
          if (attempt === 3) throw error;
        }
      }
      await page.keyboard.type("Clients");
      await page.keyboard.press("Enter");
      await last.getByText("Changed a text to “Clients”").first().waitFor({ timeout: 60000 });
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
    await last
      .getByText("Order records are now called jobs (one job)")
      .first()
      .waitFor({ timeout: 60000 });
    // The list page, and so its menu entry, is called Jobs too.
    if (!(await project()).files.content.includes("title: Jobs"))
      throw new Error("the orders page kept its title");
    await page.locator("header").getByRole("button", { name: "Undo", exact: true }).click();
    await last
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
    await last
      .getByText("Show Order.status shipped as success")
      .first()
      .waitFor({ timeout: 60000 });
    await page
      .getByRole("region", { name: "Pages" })
      .getByLabel("Icon of Orders")
      .selectOption("truck");
    await last.getByText(/truck/i).first().waitFor({ timeout: 60000 });
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
      // The edge between Builder and the preview gives the preview more room, and back.
      const edge = page.getByRole("separator", { name: "Preview width" });
      const width = Number(await edge.getAttribute("aria-valuenow"));
      const frameWidth = async () =>
        (await page.locator("[data-guide-view]").boundingBox())?.width ?? 0;
      const narrower = await frameWidth();
      await edge.focus();
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      if (
        Number(await edge.getAttribute("aria-valuenow")) !== width + 4 ||
        (await frameWidth()) <= narrower
      )
        throw new Error("the preview's edge does not widen it");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
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
      await last.getByText("Use the Playful theme").first().waitFor({ timeout: 60000 });
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
    await status.getByText(/Undid: Use the Playful theme/).waitFor({ timeout: 60000 });
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
      await last.getByText("Add theme moss and use it").first().waitFor({ timeout: 60000 });
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
    await changesTab();
    await page.getByLabel("Describe a change").fill("Who can add orders?");
    await page.getByRole("button", { name: "Make the change" }).click();
    await page.getByText("Admins can add orders.").waitFor({ timeout: 30000 });
    if ((await project()).files.spec !== before) throw new Error("the spec changed");
  });
  await step(
    "a change that deletes data is proposed first, and opens in a form with its values filled in",
    async () => {
      await changesTab();
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
      await changesTab();
      await page
        .getByLabel("Describe a change")
        .fill("A mobile number for every customer would help");
      await page.getByRole("button", { name: "Make the change" }).click();
      // Every proposal is shown first and waits for Apply, losing data or not.
      const shown = page.getByRole("region", { name: "Proposal" });
      await shown
        .getByText("Customers: added a mobile (a phone number)")
        .waitFor({ timeout: 60000 });
      await shown.getByRole("button", { name: "Discard" }).waitFor();
      await shown.getByLabel("Refine the proposal").waitFor();
      await shown.getByRole("button", { name: "Apply" }).click();
      await page
        .getByText(
          // In No code: which model made it, in words; the trace keeps the tier and tokens.
          /^Done: Customers: added a mobile \(a phone number\)\. Made with fake-model\./,
        )
        .waitFor({ timeout: 60000 });
      await trace
        .getByText("Customers: added a mobile (a phone number)")
        .waitFor({ timeout: 60000 });
      await trace.getByText(/local model \(fake-model\) · [\d,]+ tokens/).waitFor();
      // Opened, it says what changed in the summary's words.
      await trace.getByRole("button", { name: /Customers: added a mobile/ }).click();
      await trace
        .getByRole("region", { name: "What changed" })
        .getByText(/a mobile \(a phone number\)/)
        .waitFor({ timeout: 60000 });
    },
  );

  await step(
    "Your app is a map to its parts: a field's line opens its properties, Add a field opens the form for that record, and no sentence is a text to edit",
    async () => {
      await page.getByRole("tab", { name: "What it does" }).click();
      const customers = page.getByRole("region", { name: "Customers", exact: true });
      await customers.getByRole("button", { name: "a phone", exact: true }).click();
      await customers.getByRole("textbox", { name: "Label" }).fill("Mobile phone");
      await customers.getByRole("button", { name: "Save label" }).click();
      await last.getByText("Mobile phone").first().waitFor({ timeout: 60000 });
      // Who can: a record's properties say which roles may for everyone's, and under it the
      // roles as the spec's form has them: a name added to a grant goes through grant (offered
      // from the app's kinds of record), and taken away again.
      await customers.getByRole("button", { name: "Customers", exact: true }).click();
      const who = customers.getByRole("region", { name: "Who can" });
      await who.getByText("only their own").first().waitFor();
      await who.locator("summary", { hasText: /^sales$/ }).click();
      await who
        .locator("summary", { hasText: /^Not set/ })
        .last()
        .click();
      await who.getByLabel("Add to delete").fill("Customer");
      await who.getByLabel("Add to delete").press("Enter");
      await last
        .getByText(/sales may delete everyone's customers/i)
        .first()
        .waitFor({ timeout: 60000 });
      await who.getByRole("button", { name: "Remove Customer" }).click();
      await last
        .getByText("sales may delete only their own records")
        .first()
        .waitFor({ timeout: 60000 });
      // Adding a field: its form in place, under the customers (A 116), never the Changes tab;
      // once added, the new field's own properties are open there.
      const adding = page.getByRole("region", { name: "Customers", exact: true });
      await adding.getByRole("button", { name: "Add a field" }).click();
      if (await adding.getByLabel("Kind of record").count())
        throw new Error("the form in place asks which kind of record");
      await adding.getByLabel("Name", { exact: true }).fill("loyalty code");
      await adding.getByRole("checkbox", { name: "Unique" }).check();
      await adding.getByRole("button", { name: "Add field" }).click();
      await last.getByText("Customers: added a loyalty code (unique)").waitFor({ timeout: 60000 });
      await adding
        .getByRole("button", { name: "a loyalty code (unique)", expanded: true })
        .waitFor({ timeout: 30000 });
      await adding.getByRole("button", { name: "Remove field" }).waitFor();
      // A sentence is a way into its form, never a text to edit (what-it-does.md §2).
      const again = page.getByRole("region", { name: "Customers", exact: true });
      if (await again.getByRole("button", { name: "In my words" }).count())
        throw new Error("In my words is still offered");
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
      // The newest change stays under every panel.
      await last.waitFor();
      await panels.getByLabel("Your app + Details").check();
      await current("Your app,Details");
      // A wide window has the preview's column: no Preview in the mode switch.
      const viewPreview = page.getByRole("radio", { name: "Preview", exact: true });
      if (await viewPreview.count()) throw new Error("Preview in the mode switch on a wide window");
      // A narrow window: Preview is the mode switch's third choice, the frame the window's
      // width, and the panels have no Preview of their own.
      await page.setViewportSize({ width: 800, height: 900 });
      if (await panels.getByRole("button", { name: "Preview" }).count())
        throw new Error("a Preview panel on a narrow window");
      await viewPreview.check({ force: true });
      await page.waitForFunction(
        () => {
          const r = document.querySelector('iframe[title="App preview"]')?.getBoundingClientRect();
          return r && Math.abs(r.left) < 2 && r.width > 700;
        },
        null,
        { timeout: 5000 },
      );
      if (await panels.isVisible()) throw new Error("the panels show beside the Preview");
      // Back to No code, as it was.
      await page.getByRole("radio", { name: "No code", exact: true }).check({ force: true });
      await panels.getByRole("button", { name: "Details" }).click();
      await current("Details");
      // With nothing selected, Details shows the app's own details and how to see a part's.
      // An earlier step's selection may still be open: closed, the app's own details show.
      const selected = page
        .locator('[data-panel="details"]')
        .getByRole("button", { name: "Close" });
      if (await selected.count()) await selected.click();
      const app = page.getByRole("region", { name: "The app" });
      await app.getByText("Choose Select above the preview").waitFor();
      if (!(await app.getByLabel("App name").inputValue()))
        throw new Error("no app name in Details");
      await panels.getByRole("button", { name: "Your app" }).click();
      await current("Your app");
      // Code mode on a narrow window: the same snapping row, the editor the window's width.
      await page.getByRole("radio", { name: "Code", exact: true }).check({ force: true });
      await page.waitForFunction(
        () => {
          const files = [...document.querySelectorAll('[role="tab"]')].find(
            (t) => t.textContent === "Files",
          );
          const panel = files?.closest("section");
          return panel && panel.getBoundingClientRect().width > 760;
        },
        null,
        { timeout: 10000 },
      );
      await page.getByRole("radio", { name: "No code", exact: true }).check({ force: true });
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
      // Code mode keeps the file open, its cursor and an unsaved edit across a switch to No code
      // and back, and across a reload.
      await page.getByRole("tab", { name: "Files" }).click();
      await page.getByLabel("File", { exact: true }).selectOption("smithable.ux.yml");
      // Beside the file, its part of the spec reference, following the file chosen.
      const howTo = await page
        .getByRole("link", { name: "How this file is written" })
        .getAttribute("href");
      if (!howTo?.endsWith("spec.html#smithableuxyml-how-the-app-looks"))
        throw new Error(`the ux file links to ${howTo}`);
      // The ux file says where its choices have controls, with a way there.
      await page.getByRole("button", { name: "Open Look" }).waitFor({ timeout: 10000 });
      const ux = page.getByLabel("smithable.ux.yml");
      const saved = await ux.evaluate((e) => e.value);
      await ux.focus();
      await ux.evaluate((e) => e.setSelectionRange(0));
      await page.keyboard.type("#");
      const kept = async (when) => {
        const editor = page.getByLabel("smithable.ux.yml");
        await editor.waitFor({ timeout: 30000 });
        if ((await page.getByLabel("File", { exact: true }).inputValue()) !== "smithable.ux.yml")
          throw new Error(`${when}: another file is open`);
        if ((await editor.evaluate((e) => e.value)) !== `#${saved}`)
          throw new Error(`${when}: the unsaved edit is gone`);
        if ((await editor.evaluate((e) => e.selectionStart)) !== 1)
          throw new Error(`${when}: the cursor moved`);
      };
      await page.locator("label", { hasText: /^No code$/ }).click();
      await page.getByText("Email of Customer").waitFor({ timeout: 10000 });
      await page.locator("label", { hasText: /^Code$/ }).click();
      await kept("after No code and back");
      // The browser asks before a reload loses an unsaved edit; here it is kept, so leave.
      const leave = (dialog) => dialog.accept();
      page.on("dialog", leave);
      await page.reload();
      page.off("dialog", leave);
      await kept("after a reload");
      // The edit taken back is no edit: nothing is kept.
      await page.getByLabel("smithable.ux.yml").evaluate((e, text) => {
        e.value = text;
      }, saved);
      await page.getByLabel("File", { exact: true }).selectOption("smithable.yml");
      await page.locator("label", { hasText: /^No code$/ }).click();
      await page.getByText("Email of Customer").waitFor({ timeout: 10000 });
    },
  );
  await step(
    "Select in Code mode: a text opens its line in the content file, a field its lines in smithable.yml",
    async () => {
      await page.locator("label", { hasText: /^Code$/ }).click();
      await openPreview("/customers");
      await page.getByRole("button", { name: "Select" }).click();
      // The page in the frame is in select mode before anything is clicked: a click before it is
      // the app's own (a new frame after Go hears of select mode only once it has loaded).
      const selecting = () =>
        preview.locator("html[data-sm-selecting]").waitFor({ state: "attached", timeout: 60000 });
      await selecting();
      const editorText = async (file) => {
        await page.getByLabel(file).waitFor({ timeout: 10000 });
        if ((await page.getByLabel("File", { exact: true }).inputValue()) !== file)
          throw new Error(`another file is open than ${file}`);
        return page
          .getByLabel(file)
          .evaluate((e) => e.value.slice(e.selectionStart, e.selectionEnd));
      };
      const subtitle = preview.locator('[data-sm-text="pages.customers.subtitle"]');
      await subtitle.click({ timeout: 60000 });
      const text = await editorText("smithable.content.yml");
      if (text !== "Keep every relationship in view.")
        throw new Error(`the content file shows "${text}", not the subtitle`);
      // Not changed in place, as it is in No code.
      if (await subtitle.evaluate((e) => e.isContentEditable))
        throw new Error("the text became editable in Code mode");
      await openPreview("/customers/new");
      await selecting();
      await preview.locator('[data-sm-concept="field:Customer.email"]').click({ timeout: 60000 });
      const field = await editorText("smithable.yml");
      if (!field.trim().startsWith("email:")) throw new Error(`smithable.yml shows "${field}"`);
      await page
        .getByRole("navigation", { name: "Concepts" })
        .locator('[aria-current="true"]', { hasText: /^email/ })
        .waitFor({ timeout: 10000 });
      await page.getByRole("button", { name: "Select" }).click();
      await page.locator("label", { hasText: /^No code$/ }).click();
    },
  );
  // The log's last line before the undo: the next step reads only what came after it, since a
  // start before the undo (a page reloaded without its stylesheet) can still be in the log.
  let beforeUndo;
  await step("Ctrl+Z outside a text field undoes the last change", async () => {
    beforeUndo = (await (await fetch(`${base}/api/logs`)).json()).at(-1);
    await page.locator("header").first().click();
    await page.keyboard.press("Control+z");
    await last
      .getByText("Undid: Customers: added a loyalty code (unique)")
      .waitFor({ timeout: 60000 });
  });
  // A start is 15 s in a hosted workspace: after an undo the preview opens the database that
  // was put back, in the process it runs in, and is not started again.
  await step("an undo does not start the preview again", async () => {
    await new Promise((r) => setTimeout(r, 3000));
    const lines = await (await fetch(`${base}/api/logs`)).json();
    const since = lines.slice(lines.lastIndexOf(beforeUndo) + 1);
    const started = since.filter((l) => /The preview (answers|stopped)/.test(l));
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
      newest = await last.innerText();
      if (newest.includes("loyalty code") && !newest.includes("Undid")) break;
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
    // The app's language: the content file says it, and English is saying nothing.
    const content = () => readFileSync(join(dir, "smithable.content.yml"), "utf8");
    await look("Language").getByLabel("The app's language").selectOption("sv");
    for (let i = 0; !/^language: sv$/m.test(content()); i++) {
      if (i === 60) throw new Error("the language was not set");
      await new Promise((r) => setTimeout(r, 1000));
    }
    await look("Language").getByLabel("The app's language").selectOption("en");
    for (let i = 0; /^language:/m.test(content()); i++) {
      if (i === 60) throw new Error("English did not take the language line away");
      await new Promise((r) => setTimeout(r, 1000));
    }
    // The app's logo (app-logo.md §5): a file from the computer, shown in the preview's frame,
    // then removed. One too small is refused before it is sent, saying what is wanted.
    const tiny = join(dir, "..", "studio-test-tiny.png");
    writeFileSync(tiny, png(1, 1));
    await look("Logo").locator('input[type="file"]').setInputFiles(tiny);
    await look("Logo").getByRole("alert").getByText("at least 64 px").waitFor();
    const mark = join(dir, "..", "studio-test-mark.png");
    writeFileSync(mark, png(64, 64));
    await look("Logo").locator('input[type="file"]').setInputFiles(mark);
    for (let i = 0; !/src: images\/logo\.png/.test(content()); i++) {
      if (i === 60) throw new Error(`no logo in smithable.content.yml:\n${content()}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!existsSync(join(dir, "public", "images", "logo.png")))
      throw new Error("the logo's file was not written under public/images/");
    await preview
      .locator('img[data-part="logo"][src="/images/logo.png"] >> visible=true')
      .first()
      .waitFor({ timeout: 60000 });
    await look("Logo").getByRole("button", { name: "Remove" }).click();
    for (let i = 0; /^logo:/m.test(content()); i++) {
      if (i === 60) throw new Error("Remove did not take the logo away");
      await new Promise((r) => setTimeout(r, 1000));
    }
    await look("Logo").getByText("Add a logo").waitFor({ timeout: 60000 });
    await look("Font, density and motion").getByRole("button", { name: "Comfortable" }).click();
    await look("Font, density and motion")
      .getByRole("button", { name: "Comfortable", pressed: true })
      .waitFor({ timeout: 60000 });
    await look("Colors of choices").getByLabel("Color of Draft").first().selectOption("warning");
    await last.getByText(/draft/i).first().waitFor({ timeout: 60000 });
    // A second line under a column's value.
    await look("Pages").getByLabel("Second line under Email").first().selectOption("phone");
    for (let i = 0; i < 60 && !/email: phone/.test(ux()); i++)
      await new Promise((r) => setTimeout(r, 1000));
    if (!/email: phone/.test(ux())) throw new Error(`no second line in smithable.ux.yml:\n${ux()}`);
    // A change made while another runs is dropped: wait for the trace.
    await last
      .getByText("Show phone under email in the customers table")
      .waitFor({ timeout: 60000 });
    const columns = look("Pages").getByRole("list", { name: "Columns of Customers" });
    const before = await changeCount();
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
    for (let i = 0; i < 60 && (await changeCount()) === before; i++)
      await new Promise((r) => setTimeout(r, 1000));
    if ((await changeCount()) === before) throw new Error("hiding a column made no change");
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
    // The order chosen at once, while the view is still being changed: it waits its turn and
    // is made too (a change made while one runs was once refused, its refusal hidden).
    await pages.getByLabel("Order of Customers").selectOption("-email");
    await waitUx(/view: cards/);
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
    // A list on the record page as a conversation (conversation.md §2): the orders have no long
    // text to show as the message, so the change is refused in words.
    await pages
      .getByRole("group", { name: "Orders on a record of Customers" })
      .getByRole("button", { name: "Conversation" })
      .click();
    await page
      .getByText(/Order cannot be a thread: it has no long text field/)
      .first()
      .waitFor({ timeout: 60000 });
    if (/lists:/.test(ux())) throw new Error("a refused conversation changed smithable.ux.yml");
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
      await last
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
      await last
        .getByText("Added the Home page, a landing page for visitors")
        .waitFor({ timeout: 60000 });
      await change("A section on a landing page");
      await page.getByRole("button", { name: "Add section" }).click();
      await last.getByText("Added a contact section to the Home page").waitFor({ timeout: 60000 });
      await openPreview("/");
      await preview
        .getByRole("heading", { name: "Acme CRM", level: 1 })
        .waitFor({ timeout: 60000 });
      // Its own theme, from the Look tab (look.md §1.5).
      await page.getByRole("tab", { name: "Look" }).click();
      await page.getByLabel("Theme of Home").selectOption("playful");
      await last
        .getByText(/theme on the home page/i)
        .first()
        .waitFor({ timeout: 60000 });
      // A background of the owner's: picked, applied when the picker closes, in the CSS.
      await page.getByLabel("Background", { exact: true }).fill("#f5efe6");
      await page.getByLabel("Background", { exact: true }).blur();
      await last
        .getByText(/background #f5efe6/i)
        .first()
        .waitFor({ timeout: 60000 });
      if (!readFileSync(join(dir, "smithable.ux.yml"), "utf8").includes('background: "#f5efe6"'))
        throw new Error("the ux file has no background");
      // The contact section, added last, moved above the footer with its arrow.
      await page
        .getByRole("list", { name: "Sections of Home" })
        .getByRole("button", { name: "Move Contact up" })
        .click();
      const above = () => {
        const spec = readFileSync(join(dir, "smithable.yml"), "utf8");
        const home = spec.slice(spec.indexOf("\n  home:"));
        return home.indexOf("contact:") < home.indexOf("footer:");
      };
      for (let i = 0; i < 60 && !above(); i++) await new Promise((r) => setTimeout(r, 1000));
      if (!above()) throw new Error("the contact section was not moved above the footer");
      // The panel follows: the contact section is no longer last.
      const down = page
        .getByRole("list", { name: "Sections of Home" })
        .getByRole("button", { name: "Move Contact down" });
      for (let i = 0; i < 60 && (await down.isDisabled()); i++)
        await new Promise((r) => setTimeout(r, 1000));
      if (await down.isDisabled()) throw new Error("the sections' arrows did not follow the move");
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
  await step(
    "the spec editor checks as you type, and saves a valid edit by itself, growing one change",
    async () => {
      // The editor's text element answers `value` like a text box (only the lines in view are in
      // the page), for reading and for setting the whole text.
      const editor = page.getByLabel("smithable.yml");
      const text = await editor.evaluate((e) => e.value);
      const startCount = await changeCount();
      const settled = () => page.getByText("Saved", { exact: true }).waitFor({ timeout: 60000 });
      const write = (to) =>
        editor.evaluate((e, value) => {
          e.value = value;
        }, to);
      await write(text.replace("      notes: text\n", "      notes: txt\n"));
      // The problem is shown in the text where it is, and in the list.
      await page.locator(".cm-lintRange-error").first().waitFor();
      await page
        .getByRole("list", { name: "Problems" })
        .getByText(/Unknown field type "txt"/)
        .waitFor();
      if (await page.getByRole("button", { name: "Save", exact: true }).isEnabled())
        throw new Error("Save is enabled");
      // Two alike problems at one place (the YAML parser gives two for a line indented too far),
      // then put right: the list says only "No problems.", none of them left behind.
      await write(text.replace("      notes: text\n", "      notes: text\n        fax: phone\n"));
      await page
        .getByRole("list", { name: "Problems" })
        .getByText(/Implicit keys need to be on a single line/)
        .waitFor();
      await write(text.replace("      notes: text\n", "      notes: text\n      fax: phone\n"));
      await page.getByRole("list", { name: "Problems" }).getByText("No problems.").waitFor();
      const rows = await page.getByRole("list", { name: "Problems" }).getByRole("listitem").count();
      if (rows !== 1) throw new Error(`the problems list has ${rows} rows beside "No problems."`);
      // Valid, it is saved by itself after a pause: one change.
      await settled();
      if (!readFileSync(join(dir, "smithable.yml"), "utf8").includes("      fax: phone\n"))
        throw new Error("the valid edit was not saved by itself");
      // What can be written at the cursor is offered as it is typed: one of the app's own pages
      // in the navigation, and at the start of a line the sections the spec does not have yet.
      const good = await editor.evaluate((e) => e.value);
      const cursor = (at) => editor.evaluate((e, to) => e.setSelectionRange(to), at);
      const offered = page.locator(".cm-tooltip-autocomplete");
      // The editor takes Enter for the list only a moment after it opens (75 ms), so that a line
      // break typed just then is not swallowed.
      const accept = async () => {
        await new Promise((r) => setTimeout(r, 200));
        await page.keyboard.press("Enter");
      };
      const nav = /^navigation: \[(.*), ([\w-]+)\]$/m.exec(good);
      if (!nav) throw new Error("the navigation is not a list on one line");
      const [line, before, last] = nav;
      await write(good.replace(line, `navigation: [${before}]`));
      await editor.focus();
      await cursor(nav.index + line.length - `, ${last}]`.length);
      await page.keyboard.type(`, ${last.slice(0, -1)}`);
      await offered.getByText(last, { exact: true }).waitFor();
      await accept();
      if ((await editor.evaluate((e) => e.value)) !== good)
        throw new Error("the page offered was not put in the text");
      await page.keyboard.press("ControlOrMeta+End");
      await page.keyboard.type("qu");
      await offered.getByText("queries", { exact: true }).waitFor();
      await offered.getByText(/Records chosen or ordered by code/).waitFor();
      await accept();
      if (!(await editor.evaluate((e) => e.value)).endsWith("queries: "))
        throw new Error("the key offered was not put in the text with its colon");
      // On an empty indented line, where a key goes, the keys are offered as soon as the cursor
      // lands there, with no keystroke (a phone has no Ctrl-Space); "What goes here?" asks too.
      const crud = "    crud: Customer\n";
      await write(good.replace(crud, `${crud}    \n`));
      await editor.focus();
      await cursor(good.indexOf(crud) + crud.length + 4);
      await offered.getByText("route", { exact: true }).waitFor();
      await page.keyboard.press("Escape");
      await offered.waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "What goes here?" }).click();
      await offered.getByText("route", { exact: true }).waitFor();
      await page.keyboard.press("Escape");
      // Where there is nothing to offer (inside a sentence), the button says so.
      const intent = "    intent: Find a customer";
      await cursor(good.indexOf(intent) + intent.length);
      await page.getByRole("button", { name: "What goes here?" }).click();
      await page.getByText("Nothing to suggest at the cursor").waitFor();
      // Under a map of names (the actions) a template entry is offered and fills in its keys.
      const actions = "actions:\n";
      await write(good.replace(actions, `${actions}  \n`));
      await editor.focus();
      await cursor(good.indexOf(actions) + actions.length + 2);
      await offered.getByText("myEntry", { exact: true }).waitFor();
      await accept();
      if (!/^actions:\n {2}myEntry:\n/m.test(await editor.evaluate((e) => e.value)))
        throw new Error("the template entry was not put in the text");
      // The first time, the editor says how to ask it; once seen, it stays quiet.
      const hint = page.getByText(/Ctrl-Space \(⌃Space on a Mac\) lists what fits/);
      if (await hint.isVisible()) {
        await page.getByRole("button", { name: "Got it" }).click();
        await hint.waitFor({ state: "hidden" });
      }
      await write(good);
      // A key says what it is for when the pointer rests on it.
      await cursor(good.indexOf("    crud: Customer"));
      await page.locator(".cm-line", { hasText: "crud: Customer" }).getByText("crud").hover();
      await page
        .locator(".cm-tooltip-hover")
        .getByText(/list, view, create, edit and delete/)
        .waitFor();
      await page.mouse.move(0, 0);
      // Every edit since went on in the same file: they grew the one change.
      await settled();
      if ((await changeCount()) !== startCount + 1)
        throw new Error(`the edits made ${(await changeCount()) - startCount} changes, not one`);
      // Typed text, and Ctrl+Z in the editor: the editor's own undo, not the app's last change.
      const changes = await changeCount();
      await editor.focus();
      await page.keyboard.press("ControlOrMeta+End");
      await page.keyboard.type("# typed");
      if (!(await editor.evaluate((e) => e.value)).endsWith("# typed"))
        throw new Error("typing did not reach the editor");
      await page.keyboard.press("ControlOrMeta+z");
      if ((await editor.evaluate((e) => e.value)).endsWith("# typed"))
        throw new Error("Ctrl+Z in the editor did not undo the typing");
      await new Promise((r) => setTimeout(r, 500));
      if ((await changeCount()) !== changes)
        throw new Error("Ctrl+Z in the editor undid a change of the app");
      // A broken edit cannot be saved, but it can be discarded: the file as saved comes back.
      const discard = page.getByRole("button", { name: "Discard", exact: true });
      if (await discard.isEnabled()) throw new Error("Discard is offered with nothing edited");
      const savedText = await editor.evaluate((e) => e.value);
      await editor.focus();
      await page.keyboard.press("ControlOrMeta+End");
      await page.keyboard.type("\nmodels: [broken");
      const save = page.getByRole("button", { name: "Save", exact: true });
      const until = async (done, what) => {
        for (let i = 0; i < 100 && !(await done()); i++)
          await new Promise((r) => setTimeout(r, 100));
        if (!(await done())) throw new Error(what);
      };
      await until(async () => !(await save.isEnabled()), "a broken edit could be saved");
      page.once("dialog", (dialog) => dialog.accept());
      await discard.click();
      await until(
        async () => (await editor.evaluate((e) => e.value)) === savedText,
        "Discard did not bring the saved file back",
      );
    },
  );
  await step("the companion files are edited the same way, each with its own checks", async () => {
    // The auth file: a grant must name a model there is; a role added is saved as one change.
    await page.getByLabel("File", { exact: true }).selectOption("smithable.auth.yml");
    const auth = page.getByLabel("smithable.auth.yml");
    const text = await auth.evaluate((e) => e.value);
    if (!text.includes("roles:")) throw new Error(`not the auth file: ${text.slice(0, 80)}`);
    const write = (to) =>
      auth.evaluate((e, value) => {
        e.value = value;
      }, to);
    if (!text.includes("    write: all")) throw new Error("no write grant to break");
    await write(text.replace("    write: all", "    write: [Custmer]"));
    await page
      .getByRole("list", { name: "Problems" })
      .getByText(/Line \d+: There is no model named "Custmer"/)
      .first()
      .waitFor();
    if (await page.getByRole("button", { name: "Save", exact: true }).isEnabled())
      throw new Error("Save is enabled with a grant that names no model");
    await write(
      text
        .replace("  sales:", "  support: { description: Answers questions., pages: all }\n  sales:")
        .replace("admins:", "defaultRole: sales\nadmins:"),
    );
    await page.getByRole("list", { name: "Problems" }).getByText("No problems.").waitFor();
    // The auth file is helped from its own schema and the spec's names: a public page offered.
    const authText = await auth.evaluate((e) => e.value);
    const pagesAt = authText.indexOf("pages: [");
    if (pagesAt < 0) throw new Error("no public pages line to complete on");
    await auth.focus();
    await auth.evaluate((e, to) => e.setSelectionRange(to), pagesAt + "pages: [".length);
    await page.keyboard.type("cu");
    await page
      .locator(".cm-tooltip-autocomplete")
      .getByText("customers", { exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    await write(
      text
        .replace("  sales:", "  support: { description: Answers questions., pages: all }\n  sales:")
        .replace("admins:", "defaultRole: sales\nadmins:"),
    );
    await page.getByRole("list", { name: "Problems" }).getByText("No problems.").waitFor();
    // Another file: saved by itself as a change of its own.
    await page.getByText("Saved", { exact: true }).waitFor({ timeout: 60000 });
    if (!readFileSync(join(dir, "smithable.auth.yml"), "utf8").includes("  support:"))
      throw new Error("the auth file's edit was not saved by itself");
    // A role's grant is completed with the spec's names: a kind of record for "create".
    const saved = await auth.evaluate((e) => e.value);
    // (sales may add orders since the access step: the grant is a list.)
    const createAt = saved.indexOf("    create: [Order]");
    if (createAt < 0) throw new Error("no create grant to complete on");
    await write(saved.replace("    create: [Order]", "    create: ["));
    await auth.focus();
    await auth.evaluate((e, to) => e.setSelectionRange(to), createAt + "    create: [".length);
    await page.keyboard.type("Or");
    await page.locator(".cm-tooltip-autocomplete").getByText("Order", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await write(saved);
    // The context file is offered too (the test project has one; a project without starts it
    // from its first line), with its own checks.
    await page.getByLabel("File", { exact: true }).selectOption("smithable.context.yml");
    const context = page.getByLabel("smithable.context.yml");
    await context.evaluate((e) => {
      e.value = "smithableContext: 0.1\nplugins: [greeting]\nnonsense: true\n";
    });
    await page
      .getByRole("list", { name: "Problems" })
      .getByText(/nonsense/)
      .waitFor();
    await context.evaluate((e) => {
      e.value = "smithableContext: 0.1\nplugins: [greeting]\n";
    });
    await page.getByRole("list", { name: "Problems" }).getByText("No problems.").waitFor();
    await page.getByLabel("File", { exact: true }).selectOption("smithable.yml");
  });
  await step(
    "the Changes tab: the prompt first; a change names its files and opens as their patch",
    async () => {
      await page.getByRole("tab", { name: "Changes" }).click();
      await page.getByLabel("Describe a change").waitFor();
      const entry = trace
        .getByRole("button", { name: /Edit smithable\.auth\.yml.*smithable\.auth\.yml/ })
        .first();
      await entry.click();
      const patch = trace.getByRole("region", { name: "The change's patch" });
      await patch
        .getByText("+  support: { description: Answers questions., pages: all }")
        .waitFor();
      if (/^diff --git a\/src\//m.test(await patch.innerText()))
        throw new Error("the patch shows generated files");
      await page.getByRole("tab", { name: "Files" }).click();
    },
  );
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
    // An unsaved edit in the spec editor (one with a problem: a valid one saves itself) is kept
    // when the file changes under it.
    await page.getByRole("tab", { name: "Files" }).click();
    await page.getByLabel("File", { exact: true }).selectOption("smithable.yml");
    const editor = page.getByLabel("smithable.yml");
    const typed = `${await editor.evaluate((e) => e.value)}unsaved: [broken\n`;
    await editor.evaluate((e, value) => {
      e.value = value;
    }, typed);
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
    for (let i = 0; i < 60; i++) {
      const { trace: made } = await (await fetch(`${base}/api/project`)).json();
      if (made[0]?.description === "Add field vatNumber (text) to Customer") break;
      if (i === 59)
        throw new Error(`the agent's change is not the newest: ${made[0]?.description}`);
      await new Promise((r) => setTimeout(r, 500));
    }
    await page
      .getByText("smithable.yml changed on disk while you were editing.")
      .waitFor({ timeout: 30000 });
    if ((await editor.evaluate((e) => e.value)) !== typed)
      throw new Error("the unsaved edit was replaced");
    await page.getByRole("button", { name: "Use the file on disk" }).click();
    if (!(await editor.evaluate((e) => e.value)).includes("vatNumber"))
      throw new Error("not the file on disk");
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
  await step(
    "a web page cannot reach Studio through another host name, its events included",
    async () => {
      for (const path of ["/api/project", "/api/events"]) {
        const status = await new Promise((resolve, reject) =>
          request({ port, path, headers: { host: "evil.example" } }, (r) => {
            r.destroy();
            resolve(r.statusCode);
          })
            .on("error", reject)
            .end(),
        );
        if (status !== 403) throw new Error(`${path} answered ${status}`);
      }
    },
  );
  await step(
    "the Languages tab adds a language, shows each text beside its words in it, saves one, and takes the language away",
    async () => {
      // Late in the run, so the steps before keep their last change; Builder's mode first.
      await page.getByRole("radio", { name: "No code", exact: true }).check({ force: true });
      await page.getByRole("tab", { name: "Languages" }).click();
      await page.getByLabel("Add a language").selectOption("sv");
      await page.getByRole("button", { name: "Add", exact: true }).click();
      const texts = page.getByRole("region", { name: "Texts in Swedish" });
      await texts.waitFor({ timeout: 60000 });
      await texts.getByText(/texts have no Swedish words yet/).waitFor();
      const file = join(dir, "smithable.content.sv.yml");
      const box = texts.getByLabel("Customers in Swedish").first();
      await box.fill("Kunder");
      await box.press("Enter");
      for (let i = 0; i < 60 && !readFileSync(file, "utf8").includes("Kunder"); i++)
        await new Promise((r) => setTimeout(r, 1000));
      if (!readFileSync(file, "utf8").includes("Kunder"))
        throw new Error(`the Swedish file has no Kunder:\n${readFileSync(file, "utf8")}`);
      await texts.getByRole("button", { name: "Remove Swedish" }).click();
      await page.getByRole("button", { name: "Apply anyway" }).click({ timeout: 30000 });
      for (let i = 0; i < 60 && existsSync(file); i++)
        await new Promise((r) => setTimeout(r, 1000));
      if (existsSync(file)) throw new Error("removing Swedish left its file");
      await page.getByRole("tab", { name: "What it does" }).click();
    },
  );
  await step(
    "a kind of record's properties in What it does have All settings: its description changed there lands in smithable.yml",
    async () => {
      await page.getByRole("radio", { name: "No code", exact: true }).check({ force: true });
      await page.getByRole("tab", { name: "What it does" }).click();
      const customers = page.getByRole("region", { name: "Customers", exact: true });
      await customers.getByRole("button", { name: "Customers", exact: true }).click();
      await customers.getByText("All settings").click();
      const box = customers.getByRole("textbox", { name: "description" }).first();
      await box.fill("Everyone we sell to.");
      await box.press("Enter");
      const file = join(dir, "smithable.yml");
      for (let i = 0; i < 60 && !readFileSync(file, "utf8").includes("Everyone we sell to."); i++)
        await new Promise((r) => setTimeout(r, 1000));
      if (!readFileSync(file, "utf8").includes("description: Everyone we sell to."))
        throw new Error("the description did not reach smithable.yml");
    },
  );
  await step(
    "a page's properties are its parts of the spec, the content and the look: its subtitle changed under Texts lands in the content file",
    async () => {
      await page.getByRole("radio", { name: "No code", exact: true }).check({ force: true });
      await page.getByRole("tab", { name: "What it does" }).click();
      const pages = page.getByRole("region", { name: "Pages", exact: true });
      await pages.getByRole("button", { name: /^(Customers|Clients) \(lists customers/ }).click();
      const texts = pages.getByRole("region", { name: "Texts" });
      const box = texts.getByRole("textbox", { name: "subtitle" });
      await box.fill("Every client and their orders.");
      await box.press("Enter");
      const file = join(dir, "smithable.content.yml");
      for (
        let i = 0;
        i < 60 && !readFileSync(file, "utf8").includes("Every client and their orders.");
        i++
      )
        await new Promise((r) => setTimeout(r, 1000));
      if (!readFileSync(file, "utf8").includes("Every client and their orders."))
        throw new Error("the subtitle did not reach the content file");
      if (await pages.getByLabel("Icon in the menu").count())
        throw new Error("the hand-made icon control is still there");
    },
  );
  await step(
    "the Every setting tab adds a kind of record and a field, and renames the field, through their operations",
    async () => {
      await page.getByRole("radio", { name: "No code", exact: true }).check({ force: true });
      await page.getByRole("tab", { name: "Every setting" }).click();
      const app = page.getByRole("region", { name: "What the app does" });
      const file = join(dir, "smithable.yml");
      const waitFile = async (text) => {
        for (let i = 0; i < 60 && !readFileSync(file, "utf8").includes(text); i++)
          await new Promise((r) => setTimeout(r, 1000));
        if (!readFileSync(file, "utf8").includes(text))
          throw new Error(`no ${text} in smithable.yml`);
      };
      await app.getByLabel("New entry in models").fill("Supplier");
      await app
        .getByLabel("New entry in models")
        .locator("..")
        .getByRole("button", { name: "Add" })
        .click();
      await waitFile("Supplier:");
      await app
        .locator("summary", { hasText: /^Customer$/ })
        .first()
        .click();
      const customer = app
        .locator("details", { has: page.locator("summary", { hasText: /^Customer$/ }) })
        .first();
      await customer.getByLabel("New entry in fields").fill("website");
      await customer
        .getByLabel("New entry in fields")
        .locator("..")
        .getByRole("button", { name: "Add" })
        .click();
      await waitFile("website: string");
      // A field is renamed through renameField, which keeps its data.
      await customer.locator("summary", { hasText: /^website$/ }).click();
      await customer.getByLabel("New name for website").fill("homepage");
      await customer.getByRole("button", { name: "Rename", exact: true }).click();
      await waitFile("homepage: string");
    },
  );
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
      // The tools for assistants: a page on another site that calls them is refused.
      const tools = await answer(
        "/mcp",
        "POST",
        { "content-type": "application/json", origin: "https://evil.example" },
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      );
      if (tools !== 403) throw new Error(`/mcp from another site answered ${tools}`);
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
        // the description and the bar, then the app's name and one line once the model has answered, then
        // Builder with the app (docs/design/while-it-is-made.md stage one).
        const watcher = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await watcher.goto(`${other}/?guide=off`);
        await watcher.locator("header").first().waitFor({ timeout: 60000 });
        const seen = (async () => {
          const screen = watcher.getByRole("region", { name: "Your app is being made" });
          await screen.getByText("A booking site for a pilates studio").waitFor({ timeout: 15000 });
          await screen.getByRole("progressbar").waitFor();
          if (!(await watcher.getByRole("button", { name: "Undo", exact: true }).isDisabled()))
            throw new Error("Undo is on while the app is being made");
          // Once drafted: the app's name, and one line of what it does, not the whole summary.
          await screen
            .getByRole("heading", { name: "Preparing Studio for Lotus Pilates" })
            .waitFor({ timeout: 15000 });
          if ((await screen.getByRole("region", { name: "What it does" }).locator("p").count()) > 1)
            throw new Error("the making page shows more than one line of what the app does");
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

        // The same through the page (stage two of docs/design/while-it-is-made.md): the question
        // with its answers as buttons, the words box keeping what is typed, and once the app is
        // in place, the request made as if typed then.
        await again();
        const watcher = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        try {
          await watcher.goto(`${other}/?guide=off`);
          await watcher.locator("header").first().waitFor({ timeout: 60000 });
          const again2 = await replace(port + 2, {
            describe: "A status page for our services",
            ask: true,
            wait: false,
          });
          if (again2.status !== 202) throw new Error(JSON.stringify(again2));
          const form = watcher.getByRole("form", { name: "Questions" });
          await form.waitFor({ timeout: 15000 });
          const box = watcher.getByLabel("Describe a change, or ask a question");
          await box.fill("not this one");
          await watcher.getByRole("button", { name: "Make it once the app is there" }).click();
          // Kept, the box is empty again for the next one.
          await watcher.getByText("Waiting: not this one").waitFor();
          // The stand-in model drafts its pilates studio: a request that fits it, made by the
          // wording rules without a model.
          await box.fill("add a phone number to sessions");
          await watcher.getByRole("button", { name: "Make it once the app is there" }).click();
          await watcher.getByRole("button", { name: "Take back: not this one" }).click();
          await watcher.getByText("Waiting: not this one").waitFor({ state: "detached" });
          // Several suggestions may be chosen together.
          await form.getByRole("button").first().click();
          await form.getByRole("button").nth(1).click();
          if ((await form.locator("button[aria-pressed=true]").count()) !== 2)
            throw new Error("two suggestions cannot be chosen together");
          await form.getByRole("button", { name: "Make it" }).click();
          await form.waitFor({ state: "detached", timeout: 15000 });
          // The request that waited is proposed once the app is there (the Changes tab opens
          // for it), and waits for Apply.
          await watcher
            .getByRole("region", { name: "Proposal" })
            .getByRole("button", { name: "Apply" })
            .click({ timeout: 90000 });
          // In place: the request that waited is made, and nothing waits any more.
          const changesTab = watcher.getByRole("tab", { name: "Changes" });
          const made = watcher.getByLabel("Change trace").getByText("Sessions: added a phone");
          for (let i = 0; i < 180 && !(await made.first().isVisible()); i++) {
            if (
              (await changesTab.isVisible()) &&
              (await changesTab.getAttribute("aria-selected")) !== "true"
            )
              await changesTab.click();
            await new Promise((r) => setTimeout(r, 500));
          }
          await made.first().waitFor({ timeout: 1000 });
          const after = await (await fetch(`${other}/api/project`)).json();
          if (after.waiting?.length) throw new Error(`still waiting: ${after.waiting}`);
        } catch (error) {
          await watcher.screenshot({ path: join(root, "making.png") }).catch(() => {});
          throw error;
        } finally {
          await watcher.close();
        }
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
// The theme lab (docs/design/theme-lab.md §3) on this app, once Studio is gone: a field changes
// the CSS in its frames without a regeneration, and Save adds the theme to the project.
if (!failed) {
  const labBrowser = await chromium.launch();
  const labUrl = `http://localhost:${port + 2}`;
  const lab = spawn(
    "node",
    [cli, "theme", "lab", "--app", dir, "--project", dir, "--port", String(port + 2)],
    { env: { ...process.env, SMITHABLE_NO_OPEN: "1" }, detached: true, stdio: "ignore" },
  );
  const labPage = await labBrowser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    await step(
      "the theme lab: a field changes its frames' CSS, and Save adds the theme",
      async () => {
        for (let i = 0; i < 120; i++) {
          if (
            await fetch(`${labUrl}/api/start`).then(
              (r) => r.ok,
              () => false,
            )
          )
            break;
          await new Promise((r) => setTimeout(r, 500));
        }
        await labPage.goto(labUrl);
        // The frames open once the app has signed the lab in; the landing page in light first.
        const frame = labPage.frameLocator('[data-frame="Landing-light"]');
        await frame.locator("body[data-hydrated=true]").waitFor({ timeout: 120000 });
        // Signed in (no sign-in form in the list), and the record frame shows a record.
        const list = labPage.frameLocator('[data-frame="List-light"]');
        await list.locator("body[data-hydrated=true]").waitFor({ timeout: 60000 });
        if (await list.getByText(/^Sign in to /).count())
          throw new Error("the lab's frames are not signed in");
        const record = labPage.frameLocator('[data-frame="Record-light"]');
        await record.locator("body[data-hydrated=true]").waitFor({ timeout: 60000 });
        if (await record.getByText("does not exist, or you cannot see it").count())
          throw new Error("the record frame shows no record");
        await labPage.getByLabel("Heading font", { exact: true }).selectOption("Fraunces");
        const sheet = frame.locator("style#sm-theme");
        for (
          let i = 0;
          i < 40 && !(await sheet.textContent().catch(() => ""))?.includes("Fraunces");
          i++
        )
          await new Promise((r) => setTimeout(r, 250));
        if (!(await sheet.textContent())?.includes('--font-heading: "Fraunces Variable"'))
          throw new Error("the frame did not get the heading font");
        await labPage.getByLabel("Name", { exact: true }).fill("lab-test");
        await labPage.getByRole("button", { name: /^Save/ }).click();
        await labPage.getByRole("status").getByText("Saved").waitFor();
        const saved = readFileSync(join(dir, "themes/lab-test.yml"), "utf8");
        if (!saved.includes("heading: Fraunces"))
          throw new Error(`saved without the font:\n${saved}`);
      },
    );
  } catch {
    // Reported above.
  } finally {
    await labBrowser.close();
    try {
      process.kill(-lab.pid);
    } catch {}
  }
}
if (failed) {
  console.log(`\nFailed. The app is kept in ${dir}`);
  process.exit(1);
}
rmSync(root, { recursive: true, force: true });
console.log("\nStudio works in both modes.");
