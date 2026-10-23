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

// How long the waits are, times TEST_PATIENCE (the gate sets it from the machine's load, 1 to 3):
// a check that waits a minute on a quiet machine waits three under load, so a slow answer is
// not read as a failure.
const P = Math.max(1, Number(process.env.TEST_PATIENCE) || 1);

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
      .innerText({ timeout: 1000 * P })
      .catch(() => "");
    // A fetch that failed says only "fetch failed": its cause (the socket's error) is the clue.
    const cause = error.cause ? ` (${error.cause.code ?? error.cause.message ?? error.cause})` : "";
    console.log(
      `  ✗ ${name}\n    ${String(error.message).split("\n").slice(0, 3).join("\n    ")}${cause}\n    see ${shot}${problems ? `\n    Problems: ${problems.replace(/\n+/g, " | ")}` : ""}`,
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
// Wide enough that the preview, beside No code and Smith, shows lists as tables.
const page = await browser.newPage({ viewport: { width: 1920, height: 1000 } });
try {
  for (let i = 0; i < 120 * P; i++) {
    try {
      if ((await fetch(`http://localhost:${port + 1}/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const preview = page.frameLocator('iframe[title="App preview"]');
  const status = page.getByRole("status");
  // The Changes window, with Smith above it in the third place (the test's layout).
  const trace = page.getByRole("list", { name: "Change trace" });
  const last = trace;
  const changeCount = async () => (await (await fetch(`${base}/api/project`)).json()).trace.length;
  // A change made through Studio's own operation route, as MCP and Smith make theirs: Studio
  // shows it at once.
  const op = async (name, args) => {
    const answer = await (
      await fetch(`${base}/api/op`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-smithable": "1" },
        body: JSON.stringify({ name, args }),
      })
    ).json();
    if (!answer.ok) throw new Error(`${name}: ${answer.output}`);
  };
  // No code's sub views.
  const sub = (name) => page.getByRole("tab", { name, exact: true }).click();
  // Behavior's form: an area of the spec (models, pages…) and an entry in it, opened.
  const area = async (key) => {
    const found = page
      .getByRole("region", { name: "What the app does" })
      .locator(`details[data-key="${key}"]`)
      .first();
    if (!(await found.evaluate((d) => d.open))) await found.locator("summary").first().click();
    return found;
  };
  const entry = async (scope, name) => {
    const found = scope
      .locator("details", { has: page.locator(`summary:text-is("${name}")`) })
      .first();
    if (!(await found.evaluate((d) => d.open)))
      await found.locator(`summary:text-is("${name}")`).first().click();
    return found;
  };
  // The window in the first place: No code or Code (the gear's dialog).
  const firstWindow = async (value) => {
    await page.getByRole("button", { name: "Which window goes where" }).click();
    const dialog = page.getByRole("dialog", { name: "Which window goes where" });
    await dialog.getByLabel("The first window").selectOption(value);
    await dialog.getByRole("button", { name: "Done" }).click();
  };
  const openPreview = async (path) => {
    // A change from the step before reloads the preview a few seconds after it went through:
    // until the new frame is up it is updating (aria-busy), and a page opened now would be
    // replaced under us.
    await page
      .locator('section[aria-busy="true"]', { has: page.getByRole("heading", { name: "Preview" }) })
      .waitFor({ state: "detached", timeout: 60000 * P });
    await page.getByLabel("Preview address").fill(path);
    await page.getByRole("button", { name: "Go", exact: true }).click();
    // Go makes a new frame; until it has loaded the page, select mode sent would reach the old
    // one (marking it, so a test sees the mark) and a click would land on the new one, unmarked.
    // The old frame, on the same page, may be found in the moment before it is removed: then the
    // next one is waited for.
    const deadline = Date.now() + 60000 * P;
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

  console.log("No code");
  await step("Studio opens on No code's Behavior beside the preview", async () => {
    await page.goto(`${base}/?guide=off`);
    await page.getByRole("tab", { name: "Behavior", selected: true }).waitFor();
    await page.locator("iframe[title='App preview']").waitFor();
    // The areas of the spec are closed at first.
    const models = page.locator('details[data-key="models"]');
    if ((await models.getAttribute("open")) !== null) throw new Error("the models area is open");
    if (await page.getByRole("list", { name: "Change trace" }).count())
      throw new Error("two windows show Changes");
    // A new app has no repository until its first change: its changes are none, not Git's
    // refusal.
    const { trace: made } = await (await fetch(`${base}/api/project`)).json();
    if (made.length) throw new Error(`a new app has changes: ${JSON.stringify(made[0])}`);
  });
  await step("a notice left for Studio is shown once, then gone", async () => {
    const alert = page.getByRole("alert").filter({ hasText: "The description could not be used" });
    await alert.waitFor();
    await alert.getByRole("button", { name: "Dismiss" }).click();
    if (existsSync(join(dir, "data/.smithable/notice.txt")))
      throw new Error("the notice file is still there");
    await page.reload();
    await page.getByRole("tab", { name: "Behavior" }).waitFor();
    if (await alert.count()) throw new Error("the notice came back");
  });
  await step(
    "the bar's three windows add Smith with Changes under it, kept after a reload",
    async () => {
      await page.getByRole("radio", { name: "Three windows side by side" }).check({ force: true });
      await page.getByRole("heading", { name: "Ask agent Smith", exact: true }).waitFor();
      await page.reload();
      await page.getByRole("heading", { name: "Ask agent Smith", exact: true }).waitFor();
      await page.getByText("No changes yet.").waitFor();
    },
  );
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
  await step(
    "the app in words tops Behavior, the rest behind Show all; a sentence opens the entry it was made from",
    async () => {
      const words = page.getByRole("region", { name: "The app in words" });
      await words.getByRole("button", { name: "Show all" }).click();
      // The customers' email (the first kind of record that has one).
      await words.getByRole("button", { name: "an email (unique)", exact: true }).first().click();
      await page
        .getByRole("region", { name: "What the app does" })
        .locator("details[open]", { has: page.locator('summary:text-is("email")') })
        .first()
        .waitFor();
      await words.getByRole("button", { name: "Show less" }).click();
    },
  );
  await step(
    "the gear says which window goes where: Code in the first place, then No code again",
    async () => {
      await page.getByRole("button", { name: "Which window goes where" }).click();
      const dialog = page.getByRole("dialog", { name: "Which window goes where" });
      await dialog.getByLabel("The first window").selectOption("code");
      await dialog.getByRole("button", { name: "Done" }).click();
      await page
        .getByRole("region", { name: "Code" })
        .getByLabel("File", { exact: true })
        .waitFor();
      if (await page.getByRole("tab", { name: "Behavior" }).count())
        throw new Error("No code still shows");
      await page.getByRole("button", { name: "Which window goes where" }).click();
      await dialog.getByLabel("The first window").selectOption("nocode");
      await dialog.getByRole("button", { name: "Done" }).click();
      await page.getByRole("tab", { name: "Behavior" }).waitFor();
    },
  );
  await step(
    "the preview's arrow hides the window beside it for a while, and brings it back",
    async () => {
      await page.getByRole("button", { name: "Hide the window on the left" }).click();
      await page.getByRole("tab", { name: "Behavior" }).waitFor({ state: "detached" });
      await page.getByRole("button", { name: "Show the window on the left" }).click();
      await page.getByRole("tab", { name: "Behavior" }).waitFor();
    },
  );
  await step("a note in Code applies its advice with Apply, and undo takes it back", async () => {
    // The CRM took its own advice (filters on its orders): take them away for the note to show.
    await op("setFilters", { page: "orders", fields: [] });
    await firstWindow("code");
    const notes = page.getByRole("list", { name: "Worth considering" });
    const orders = notes.getByRole("listitem").filter({ hasText: "orders lists orders" });
    await orders.getByRole("button", { name: "Apply" }).click({ timeout: 60000 * P });
    await orders.waitFor({ state: "detached", timeout: 30000 * P });
    const spec = () => readFileSync(join(dir, "smithable.yml"), "utf8");
    if (!/ {2}orders:\n(?: {4}.*\n)*? {4}filters: \[status, shippingMethod\]/.test(spec()))
      throw new Error("the orders page has no filters after Apply");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await orders.waitFor({ timeout: 30000 * P });
    if (/ {4}filters: \[status, shippingMethod\]/.test(spec()))
      throw new Error("undo left the filters");
    await op("setFilters", { page: "orders", fields: ["status"] });
    await firstWindow("nocode");
  });
  await step("the preview says its records are samples, until dismissed", async () => {
    const note = page.getByRole("note").filter({ hasText: "Your published app starts empty" });
    await note.waitFor();
    await note.getByRole("button", { name: "Dismiss" }).click();
    await page.reload();
    await page.getByRole("heading", { name: "Ask agent Smith", exact: true }).waitFor();
    if (await note.count()) throw new Error("the samples notice came back");
  });
  await step(
    "the guide asks No code or Code, walks the places once, Guide shows it again, its Code puts Code first, a reload shows nothing",
    async () => {
      // On a page of its own: every other step runs with ?guide=off.
      const fresh = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      try {
        await fresh.goto(base);
        const card = fresh.locator("[data-guide-card]");
        const seen = [];
        for (let i = 0; i < 7; i++) {
          await card.waitFor({ timeout: 20000 * P });
          const at = await card.getAttribute("data-guide-card");
          seen.push(at);
          // Beside a place that is on the screen.
          if (!(await fresh.locator(`[data-guide="${at}"]`).first().isVisible()))
            throw new Error(`the card for ${at} is beside nothing`);
          const button = i === 0 ? "No code" : i === 6 ? "Done" : "Next";
          await card.getByRole("button", { name: button, exact: true }).click();
        }
        if (seen.join() !== "layout,preview,behavior,change,changes,look,publish")
          throw new Error(seen.join());
        await card.waitFor({ state: "detached" });
        await fresh.locator("header").getByRole("button", { name: "Guide" }).click();
        await card.waitFor();
        // The first stop's Code puts Code in the first place, which is remembered, and goes on
        // with Code's own tour.
        await card.getByRole("button", { name: "Code", exact: true }).click();
        const code = [];
        for (let i = 0; i < 2; i++) {
          await fresh.waitForFunction(
            (seen) => {
              const at = document
                .querySelector("[data-guide-card]")
                ?.getAttribute("data-guide-card");
              return at && at !== seen;
            },
            code.at(-1) ?? "layout",
            { timeout: 20000 * P },
          );
          const at = await card.getAttribute("data-guide-card");
          code.push(at);
          if (!(await fresh.locator(`[data-guide="${at}"]`).first().isVisible()))
            throw new Error(`the Code card for ${at} is beside nothing`);
          await card.getByRole("button", { name: i === 1 ? "Done" : "Next", exact: true }).click();
        }
        if (code.join() !== "files,problems") throw new Error(`Code's tour: ${code.join()}`);
        await card.waitFor({ state: "detached" });
        await fresh.getByRole("region", { name: "Code" }).waitFor();
        // Guide with Code first is Code's tour.
        await fresh.locator("header").getByRole("button", { name: "Guide" }).click();
        await card.waitFor();
        if ((await card.getAttribute("data-guide-card")) !== "files")
          throw new Error("Guide with Code first did not start Code's tour");
        await fresh.keyboard.press("Escape");
        await card.waitFor({ state: "detached" });
        await fresh.reload();
        await fresh.getByRole("region", { name: "Code" }).waitFor();
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
      await preview.getByRole("heading", { name: "Customers" }).waitFor({ timeout: 120000 * P });
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
      // The table's row or a card's title: whichever the preview's width shows.
      await preview
        .getByRole("button", { name: "Arctic Outdoor Co" })
        .filter({ visible: true })
        .first()
        .click();
      await frame.waitForURL(/\/customers\/\d+$/, { timeout: 30000 * P });
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
      await preview.getByRole("heading", { name: "Customers" }).waitFor({ timeout: 30000 * P });
    },
  );
  await step(
    "adding a field in Behavior: Changes says so, the preview follows, and a rename there flashes what changed",
    async () => {
      const customer = await entry(await area("models"), "Customer");
      await customer.getByLabel("New entry in fields").fill("website");
      await customer
        .getByLabel("New entry in fields")
        .locator("..")
        .getByRole("button", { name: "Add" })
        .click();
      await last
        .getByText("Customers: added a website")
        .first()
        .waitFor({ timeout: 60000 * P });
      await openPreview("/customers/new");
      await preview.getByLabel("Website").waitFor({ timeout: 60000 * P });
      // Friendly names become spec names.
      const website = await entry(customer, "website");
      await website.getByLabel("New name for website").fill("webPage");
      await website
        .getByLabel("New name for website")
        .locator("..")
        .getByRole("button", { name: "Rename", exact: true })
        .click();
      await status
        .getByText("Customers: the website is now called web page")
        .waitFor({ timeout: 60000 * P });
      // The preview flashes what the change touched once it shows it (motion 9a), and says so:
      // the flash is over in 1.6 s, so the test reads what Studio heard, which stays on the
      // frame. The page shows the field under its new name.
      await page
        .locator('iframe[title="App preview"][data-flashed~="field:Customer.webPage"]')
        .waitFor({ state: "attached", timeout: 90000 * P });
      await preview.locator('[data-sm-concept="field:Customer.webPage"]').first().waitFor();
    },
  );
  await step(
    "a choice field's values are changed in ordinary words, and the records holding one that goes get the one chosen",
    async () => {
      const segment = await entry(await entry(await area("models"), "Customer"), "segment");
      await segment.getByLabel("Values").fill("smb, enterprise, public sector");
      await segment.getByLabel("Records with government get").selectOption("publicSector");
      await segment.getByRole("button", { name: "Change field" }).click();
      const apply = page.getByRole("button", { name: "Apply anyway" });
      if (await apply.isVisible({ timeout: 5000 * P }).catch(() => false)) await apply.click();
      await last
        .getByText(/public sector/i)
        .first()
        .waitFor({ timeout: 90000 * P });
      await openPreview("/customers");
      // A migration restarts the preview, which takes longer than a plain change.
      await preview
        .getByText("Public sector")
        .filter({ visible: true })
        .first()
        .waitFor({ timeout: 120000 * P });
      if (await preview.getByText("Government", { exact: true }).filter({ visible: true }).count())
        throw new Error("a customer still shows Government");
    },
  );
  await step(
    "an action that changes a record is a button on the records it fits, and does what it says",
    async () => {
      await op("addAction", {
        action: "cancelOrder",
        on: "Order",
        set: { status: "canceled" },
        when: { status: "placed" },
      });
      await last
        .getByText(/cancel ?order/i)
        .first()
        .waitFor({ timeout: 90000 * P });
      await openPreview("/orders");
      // The button is on the placed orders only, and does what it says.
      const row = preview.locator("tr", { hasText: "ORD-1007" }).filter({ visible: true });
      // The page answers clicks once React has taken it over; a press made earlier is lost.
      await preview.locator("body[data-hydrated]").waitFor({ timeout: 60000 * P });
      for (let attempt = 1; ; attempt++) {
        await row.getByRole("button", { name: "Cancel order" }).click({ timeout: 60000 * P });
        try {
          await row.getByText("Canceled").waitFor({ timeout: 10000 * P });
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
    "removing a field in Behavior asks first, with what data it loses; its notice's Undo brings it back",
    async () => {
      const customer = await entry(await area("models"), "Customer");
      const phone = await entry(customer, "phone");
      await phone.getByRole("button", { name: "Remove phone", exact: true }).click();
      await page
        .getByRole("alert")
        .getByText("this deletes the phone column")
        .waitFor({ timeout: 60000 * P });
      await page.getByRole("button", { name: "Apply anyway" }).click();
      await last
        .getByText("Customers: removed the phone")
        .first()
        .waitFor({ timeout: 60000 * P });
      await status.getByRole("button", { name: "Undo this change" }).click();
      await status.getByText("Undid: Customers: removed the phone").waitFor({ timeout: 60000 * P });
      await last.getByText("Undid: Customers: removed the phone").first().waitFor();
    },
  );
  await step("access: sales may add orders, and nothing else", async () => {
    await sub("Who can");
    const grid = page.getByRole("region", { name: "Who can" });
    // Sales may add every kind of record (create: all): taking customers away leaves orders.
    await grid.getByRole("checkbox", { name: "sales may add customers", exact: true }).click();
    await status.getByText("sales may add orders", { exact: true }).waitFor({ timeout: 60000 * P });
    await sub("Behavior");
  });
  await step(
    "Who can's Why?: the answer from the rules, and a reason's setting shown in Code",
    async () => {
      await sub("Who can");
      const why = page.getByRole("region", { name: "Why?" });
      await why.getByLabel("Who", { exact: true }).selectOption("sales");
      await why.getByLabel("What", { exact: true }).selectOption("model:Customer");
      await why.getByLabel("Do what", { exact: true }).selectOption("create");
      // Where each window is, to put them back after Code is shown for a reason.
      const arrange = async () => {
        await page.getByRole("button", { name: "Which window goes where" }).click();
        return page.getByRole("dialog", { name: "Which window goes where" });
      };
      let dialog = await arrange();
      const before = await dialog.locator("select").evaluateAll((s) => s.map((x) => x.value));
      await dialog.getByRole("button", { name: "Done" }).click();
      // Sales may add orders only (the step before): adding a customer is no, and says why.
      await why.locator('[data-verdict="denied"]').waitFor({ timeout: 10000 * P });
      await why
        .getByRole("button", { name: /^smithable\.auth\.yml: roles\.sales/ })
        .first()
        .click();
      const file = page.getByRole("region", { name: "Code" }).getByLabel("File", { exact: true });
      await file.waitFor({ timeout: 30000 * P });
      for (let i = 0; i < 40 && (await file.inputValue()) !== "smithable.auth.yml"; i++)
        await new Promise((r) => setTimeout(r, 250));
      if ((await file.inputValue()) !== "smithable.auth.yml")
        throw new Error(`Code shows ${await file.inputValue()}, not the auth file`);
      dialog = await arrange();
      const selects = dialog.locator("select");
      for (let i = 0; i < before.length; i++)
        if ((await selects.nth(i).inputValue()) !== before[i])
          await selects.nth(i).selectOption(before[i]);
      await dialog.getByRole("button", { name: "Done" }).click();
      await sub("Behavior");
    },
  );
  await step(
    "the Data map: a box per kind of record, arrows between them, a name opens Behavior",
    async () => {
      await sub("Data map");
      const map = page.getByRole("region", { name: "Data map" });
      for (const box of ["Customer", "Order", "User"])
        await map.locator(`[data-map-box="${box}"]`).waitFor({ timeout: 30000 * P });
      // An order refers to its customer; the account manager owns a customer; an order is its
      // maker's, said in its box.
      if ((await map.locator(".react-flow__edge").count()) < 2)
        throw new Error(`${await map.locator(".react-flow__edge").count()} arrows on the map`);
      // The line says how the two relate (Johan, 2026-10-23).
      await map
        .getByText(/· many to one/)
        .first()
        .waitFor({ timeout: 10000 * P });
      await map
        .locator('[data-map-box="Order"]')
        .getByText("Each is its maker's own.")
        .waitFor({ timeout: 10000 * P });
      await map
        .locator('[data-map-box="Customer"]')
        .getByRole("button", { name: "Customer" })
        .click();
      await page
        .getByRole("tab", { name: "Behavior", selected: true })
        .waitFor({ timeout: 10000 * P });
    },
  );

  await step(
    "Who can: each tick one grant, the all headers, the record rule's warning, anyone, a new role",
    async () => {
      const authFile = join(dir, "smithable.auth.yml");
      const before = readFileSync(authFile, "utf8");
      const waitAuth = async (fits, what) => {
        for (let i = 0; i < 60 * P && !fits(readFileSync(authFile, "utf8")); i++)
          await new Promise((r) => setTimeout(r, 1000));
        if (!fits(readFileSync(authFile, "utf8")))
          throw new Error(`no ${what} in smithable.auth.yml:\n${readFileSync(authFile, "utf8")}`);
        // A change made while another runs is dropped: the next waits for Studio to be done.
        await page.getByText("Working…").waitFor({ state: "detached", timeout: 60000 * P });
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
        for (let i = 0; i < 60 * P && (await box(name).isChecked()) === was; i++)
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
      await status.getByText("sales may add customers, orders").waitFor({ timeout: 60000 * P });
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
      await unseen.waitFor({ state: "attached", timeout: 60000 * P });
      await tick(
        "sales may see everyone's customers",
        (t) => /read: \[Customer\]/.test(t),
        "read: [Customer]",
      );
      await unseen.waitFor({ state: "detached", timeout: 60000 * P });
      // Anyone reading customers is told they hold personal data.
      await tick(
        "Anyone may read customers",
        (t) => /read: \[Customer\]\n/.test(t.split("public:")[1] ?? ""),
        "public read",
      );
      await grid
        .getByText(/Anyone on the internet can read .*email/)
        .waitFor({ state: "attached", timeout: 60000 * P });
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
        .waitFor({ timeout: 60000 * P });
      await roles.getByLabel("New users get").selectOption("teacher");
      changes++;
      await waitAuth((t) => /defaultRole: teacher/.test(t), "defaultRole: teacher");
      // Ask, the assistant in the app: on for everyone who signs in, its button in the preview,
      // then off again.
      const asking = page.getByRole("region", { name: "Ask, the assistant in the app" });
      await asking.getByLabel("Who gets Ask").selectOption("signed-in");
      changes++;
      await waitAuth((t) => /assistant:\n {2}for: signed-in/.test(t), "assistant for signed-in");
      await preview
        .getByRole("button", { name: "Ask", exact: true })
        .waitFor({ timeout: 90000 * P });
      // Its name from the content file, shown on its button; its voice in the ux file.
      await asking.getByLabel("Ask's name").fill("Nova");
      await asking.getByLabel("Ask's name").blur();
      changes++;
      const contentFile = join(dir, "smithable.content.yml");
      for (let i = 0; i < 60 * P && !/name: Nova/.test(readFileSync(contentFile, "utf8")); i++)
        await new Promise((r) => setTimeout(r, 1000));
      await page.getByText("Working…").waitFor({ state: "detached", timeout: 60000 * P });
      await preview
        .getByRole("button", { name: "Nova", exact: true })
        .waitFor({ timeout: 90000 * P });
      await asking.getByLabel("Ask's voice").selectOption("friendly");
      changes++;
      const uxFile = join(dir, "smithable.ux.yml");
      for (let i = 0; i < 60 * P && !/voice: friendly/.test(readFileSync(uxFile, "utf8")); i++)
        await new Promise((r) => setTimeout(r, 1000));
      if (!/voice: friendly/.test(readFileSync(uxFile, "utf8")))
        throw new Error("no voice in the ux file");
      await page.getByText("Working…").waitFor({ state: "detached", timeout: 60000 * P });
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
      await sub("Behavior");
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
        .waitFor({ state: "attached", timeout: 60000 * P });
      await preview
        .locator('[data-sm-concept="field:Customer.email"]')
        .click({ timeout: 60000 * P });
      // Behavior opens at the field picked.
      const email = page
        .getByRole("region", { name: "What the app does" })
        .locator("details[open]", { has: page.locator('summary:text-is("email")') })
        .first();
      await email.getByRole("checkbox", { name: "Required" }).check();
      await email.getByRole("button", { name: "Change field" }).click();
      await status
        .getByText("Customers: now an email (required, unique)")
        .waitFor({ timeout: 60000 * P });
      if (!(await project()).files.spec.includes("      email: email! unique\n"))
        throw new Error("spec not changed");
      await preview
        .locator('[data-sm-concept="field:Customer.email"]')
        .getByText("*")
        .waitFor({ timeout: 60000 * P });
    },
  );
  await step(
    "drag a column in the preview: smithable.ux.yml changes, smithable.yml does not",
    async () => {
      const before = (await project()).files.spec;
      await openPreview("/customers");
      await preview
        .locator("html[data-sm-selecting]")
        .waitFor({ state: "attached", timeout: 60000 * P });
      const header = (field) => preview.locator(`th[data-sm-concept="field:Customer.${field}"]`);
      await header("email").dragTo(header("name"), { timeout: 60000 * P });
      await last
        .getByText("in the customers table")
        .first()
        .waitFor({ timeout: 60000 * P });
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
          .waitFor({ state: "attached", timeout: 60000 * P });
        await title.click({ timeout: 60000 * P });
        try {
          await title.and(preview.locator("[contenteditable=true]")).waitFor({ timeout: 5000 * P });
          break;
        } catch (error) {
          if (attempt === 3) throw error;
        }
      }
      await page.keyboard.type("Clients");
      await page.keyboard.press("Enter");
      await last
        .getByText("Changed the Customers page's title to “Clients”")
        .first()
        .waitFor({ timeout: 60000 * P });
      if (!(await project()).files.content.includes("title: Clients"))
        throw new Error("content not changed");
      await page.getByRole("button", { name: "Select" }).click();
      await preview.getByRole("heading", { name: "Clients" }).waitFor({ timeout: 60000 * P });
    },
  );
  await step("colors of a choice and a page's icon, from the Look tab", async () => {
    await sub("Look");
    const choices = page.getByRole("region", { name: "Colors of choices" });
    await choices
      .getByRole("group", { name: "Status of Order" })
      .getByLabel("Color of Shipped")
      .selectOption("success");
    await last
      .getByText("Show Order.status shipped as success")
      .first()
      .waitFor({ timeout: 60000 * P });
    await page
      .getByRole("region", { name: "Pages" })
      .getByLabel("Icon of Orders")
      .selectOption("truck");
    await last
      .getByText(/truck/i)
      .first()
      .waitFor({ timeout: 60000 * P });
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
        .waitFor({ timeout: 60000 * P });
      await theme.getByRole("button", { name: "Lively" }).click();
      await theme
        .getByRole("button", { name: "Lively", pressed: true })
        .waitFor({ timeout: 60000 * P });
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
      await last
        .getByText("Use the Playful theme")
        .first()
        .waitFor({ timeout: 60000 * P });
      await themes
        .getByRole("button", { name: /Playful/, pressed: true })
        .waitFor({ timeout: 60000 * P });
      await page.getByText("Updating…").waitFor({ state: "hidden", timeout: 120000 * P });
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
    await status.getByText(/Undid: Use the Playful theme/).waitFor({ timeout: 60000 * P });
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
      await page.getByText("Updating…").waitFor({ state: "hidden", timeout: 120000 * P });
      await preview.locator("body[data-hydrated]").waitFor({ timeout: 120000 * P });
      await say();
      for (const deadline = Date.now() + 30000 * P; (await unstyled()) === before; ) {
        if (Date.now() > deadline) throw new Error("the preview was not started again");
        await new Promise((r) => setTimeout(r, 500));
      }
      // It comes back; said again without a change in between, it is not started again.
      await preview.locator("body[data-hydrated]").waitFor({ timeout: 120000 * P });
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
        .waitFor({ timeout: 60000 * P });
      const forest = readFileSync(join(dir, "themes/forest.yml"), "utf8");
      await look
        .getByLabel("Theme", { exact: true })
        .fill(forest.replace("name: forest", "name: moss"));
      await look.getByRole("button", { name: "Add and use" }).click();
      await last
        .getByText("Add theme moss and use it")
        .first()
        .waitFor({ timeout: 60000 * P });
      if (!existsSync(join(dir, "themes/moss.yml"))) throw new Error("no themes/moss.yml");
      await page
        .getByRole("list", { name: "Themes" })
        .getByRole("button", { name: /Moss/, pressed: true })
        .waitFor({ timeout: 60000 * P });
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await status.getByText(/Undid: Add theme moss/).waitFor({ timeout: 60000 * P });
      if (existsSync(join(dir, "themes/moss.yml"))) throw new Error("undo left themes/moss.yml");
    },
  );

  await step("a question about the app is answered from the spec, not applied", async () => {
    const before = (await project()).files.spec;
    await page.getByLabel("Describe a change").fill("Who can add orders?");
    await page.getByRole("button", { name: "Make the change" }).click();
    await page.getByText("Admins can add orders.").waitFor({ timeout: 30000 * P });
    // A question is looked up in the docs too: what they say, or that they cannot be reached.
    await page.getByRole("region", { name: "From the docs" }).waitFor({ timeout: 30000 * P });
    if ((await project()).files.spec !== before) throw new Error("the spec changed");
  });
  await step(
    "a change that deletes data is proposed first, and Discard leaves it in Smith's thread",
    async () => {
      await page.getByLabel("Describe a change").fill("Customers without notes");
      await page.getByRole("button", { name: "Make the change" }).click();
      const proposal = page.getByRole("region", { name: "Proposal" });
      await proposal.getByText("(loses data)").waitFor({ timeout: 30000 * P });
      await proposal.getByRole("button", { name: "Discard" }).click();
      await page
        .getByRole("list", { name: "Thread" })
        .getByText("Discarded.")
        .last()
        .waitFor({ timeout: 30000 * P });
    },
  );
  await step(
    "describe a change: one that loses no data is made at once, and traced with its model",
    async () => {
      await page
        .getByLabel("Describe a change")
        .fill("A mobile number for every customer would help");
      await page.getByRole("button", { name: "Make the change" }).click();
      // Every proposal is shown first and waits for Apply, losing data or not.
      const shown = page.getByRole("region", { name: "Proposal" });
      await shown
        .getByText("Customers: added a mobile (a phone number)")
        .waitFor({ timeout: 60000 * P });
      await shown.getByRole("button", { name: "Discard" }).waitFor();
      await shown.getByLabel("Refine the proposal").waitFor();
      await shown.getByRole("button", { name: "Apply" }).click();
      await page
        .getByText(
          // Which model made it, in words; the trace keeps the tier and tokens.
          /^Done: Customers: added a mobile \(a phone number\)\. Made with fake-model\./,
        )
        .waitFor({ timeout: 60000 * P });
      await trace
        .getByText("Customers: added a mobile (a phone number)")
        .waitFor({ timeout: 60000 * P });
      // Without the model's use or cost under it (Johan, 2026-10-23).
      if (await trace.getByText(/ tokens/).count())
        throw new Error("Changes shows a model's tokens");
      // Opened, it says what changed in words.
      await trace.getByRole("button", { name: /^Customers: added a mobile/ }).click();
      await trace
        .getByRole("region", { name: "What changed" })
        .getByText(/a mobile \(a phone number\)/)
        .waitFor({ timeout: 60000 * P });
    },
  );
  await step(
    "Smith's ready prompts are answered by Studio: the app in short with a way to each part, how to publish",
    async () => {
      // Smith greets as an assistant does, by rule, with the app's name.
      await page
        .getByText(/^Hi! How can I help you with your .+ app\?$/)
        .waitFor({ timeout: 10000 * P });
      const prompts = page.getByRole("group", { name: "Ready prompts" });
      await prompts.getByRole("button", { name: "How do I publish?" }).click();
      const how = page.getByRole("region", { name: "How to publish" });
      if (
        (await how.getByRole("link", { name: "Self-hosting" }).getAttribute("href")) !==
        "https://docs.smithable.ai/self-host.html"
      )
        throw new Error("How do I publish? does not lead to the self-hosting page");
      await prompts.getByRole("button", { name: "What does this app do?" }).click();
      const short = page.getByRole("region", { name: "What the app does, in short" });
      await short.getByRole("button", { name: "Customers", exact: true }).click();
      await page
        .getByRole("region", { name: "What the app does" })
        .locator("details[open]", { has: page.locator('summary:text-is("Customer")') })
        .first()
        .waitFor({ timeout: 10000 * P });
      await prompts.getByRole("button", { name: "Help me add…" }).click();
      if ((await page.getByLabel("Describe a change").inputValue()) !== "Help me add ")
        throw new Error("Help me add did not start the request");
      await page.getByLabel("Describe a change").fill("");
    },
  );
  await step(
    "a narrow window shows one window at a time, chosen in the header: the preview the window's width, Code too",
    async () => {
      await page.setViewportSize({ width: 800, height: 900 });
      const pick = (name) => page.getByRole("radio", { name, exact: true }).check({ force: true });
      await pick("Preview");
      await page.waitForFunction(
        () => {
          const r = document.querySelector('iframe[title="App preview"]')?.getBoundingClientRect();
          return r && Math.abs(r.left) < 2 && r.width > 700;
        },
        null,
        { timeout: 5000 * P },
      );
      if (await page.getByRole("tab", { name: "Behavior" }).count())
        throw new Error("No code shows beside the preview");
      // Code is offered on a phone once its settings say so.
      if (await page.getByRole("radio", { name: "Code", exact: true }).count())
        throw new Error("Code is offered on a phone by default");
      await page.getByRole("button", { name: "Phone settings" }).click();
      const settings = page.getByRole("dialog", { name: "Phone settings" });
      await settings.getByLabel("Show Code among the windows").check();
      await settings.getByRole("button", { name: "Done" }).click();
      await pick("Code");
      await page.waitForFunction(
        () => {
          const code = document.querySelector('section[aria-label="Code"]');
          return code && code.getBoundingClientRect().width > 760;
        },
        null,
        { timeout: 10000 * P },
      );
      await pick("Ask agent Smith");
      await page.getByLabel("Describe a change").waitFor();
      // Changes is under Smith on a phone: its tab beside his.
      await page.getByRole("tab", { name: "Changes", exact: true }).click();
      await page.getByRole("list", { name: "Change trace" }).waitFor();
      await page.getByRole("tab", { name: "Ask agent Smith", exact: true }).click();
      await pick("No code");
      await page.getByRole("tab", { name: "Behavior" }).waitFor();
      await page.setViewportSize({ width: 1920, height: 1000 });
    },
  );
  await step(
    "one preview whatever moves: the address follows it, and putting Code first keeps its page",
    async () => {
      await openPreview("/orders");
      await preview.getByRole("heading", { name: "Orders" }).waitFor({ timeout: 60000 * P });
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
            { timeout: 5000 * P },
          );
          break;
        } catch (error) {
          if (attempt === 3) throw error;
        }
      }
      const opened = await page.getByLabel("Preview address").inputValue();
      await firstWindow("code");
      await page.getByRole("region", { name: "Code" }).waitFor();
      if ((await page.getByLabel("Preview address").inputValue()) !== opened)
        throw new Error("the preview lost its page when Code came first");
      await preview.getByRole("heading", { name: "ORD-1008" }).waitFor({ timeout: 5000 * P });
      await page.getByRole("radio", { name: "One window" }).check({ force: true });
      await page.getByRole("radio", { name: "Three windows side by side" }).check({ force: true });
      await preview.getByRole("heading", { name: "ORD-1008" }).waitFor({ timeout: 5000 * P });
      await firstWindow("nocode");
      await preview.getByRole("heading", { name: "ORD-1008" }).waitFor({ timeout: 5000 * P });
    },
  );
  await step(
    "a field picked in the preview opens Behavior at it; Code keeps its file, cursor and unsaved edit across a window change and a reload",
    async () => {
      await openPreview("/customers/new");
      await page.getByRole("button", { name: "Select" }).click();
      await preview
        .locator('[data-sm-concept="field:Customer.email"]')
        .click({ timeout: 60000 * P });
      const email = page
        .getByRole("region", { name: "What the app does" })
        .locator("details[open]", { has: page.locator('summary:text-is("email")') });
      await email.first().waitFor({ timeout: 10000 * P });
      await page.getByRole("button", { name: "Select" }).click();
      // A reload keeps the place (the browser tab's session).
      await page.reload();
      await email.first().waitFor({ timeout: 30000 * P });
      await firstWindow("code");
      await page.getByLabel("File", { exact: true }).selectOption("smithable.ux.yml");
      // Beside the file, its part of the spec reference, following the file chosen.
      const howTo = await page
        .getByRole("link", { name: "How this file is written" })
        .getAttribute("href");
      if (!howTo?.endsWith("spec.html#smithableuxyml-how-the-app-looks"))
        throw new Error(`the ux file links to ${howTo}`);
      const ux = page.getByLabel("smithable.ux.yml", { exact: true });
      const saved = await ux.evaluate((e) => e.value);
      await ux.focus();
      await ux.evaluate((e) => e.setSelectionRange(0));
      // An edit with a problem (a key the file does not know): leaving cannot save it, so it is
      // kept as a draft.
      await page.keyboard.type("x");
      const kept = async (when) => {
        const editor = page.getByLabel("smithable.ux.yml", { exact: true });
        await editor.waitFor({ timeout: 30000 * P });
        if ((await page.getByLabel("File", { exact: true }).inputValue()) !== "smithable.ux.yml")
          throw new Error(`${when}: another file is open`);
        if ((await editor.evaluate((e) => e.value)) !== `x${saved}`)
          throw new Error(`${when}: the unsaved edit is gone`);
        if ((await editor.evaluate((e) => e.selectionStart)) !== 1)
          throw new Error(`${when}: the cursor moved`);
      };
      await firstWindow("nocode");
      await firstWindow("code");
      await kept("after No code and back");
      // The browser asks before a reload loses an unsaved edit; here it is kept, so leave.
      const leave = (dialog) => dialog.accept();
      page.on("dialog", leave);
      await page.reload();
      page.off("dialog", leave);
      await kept("after a reload");
      // The edit taken back is no edit: nothing is kept.
      await page.getByLabel("smithable.ux.yml", { exact: true }).evaluate((e, text) => {
        e.value = text;
      }, saved);
      // The ux file says where its choices have controls, with a way there.
      await page.getByRole("button", { name: "Open Look" }).click();
      await page.getByRole("tab", { name: "Look", selected: true }).waitFor({ timeout: 10000 * P });
      await firstWindow("code");
      await page.getByLabel("File", { exact: true }).selectOption("smithable.yml");
      await firstWindow("nocode");
      await sub("Behavior");
    },
  );
  await step(
    "Select with Code first: a text opens its line in the content file, a field its lines in smithable.yml",
    async () => {
      await firstWindow("code");
      await openPreview("/customers");
      await page.getByRole("button", { name: "Select" }).click();
      // The page in the frame is in select mode before anything is clicked: a click before it is
      // the app's own (a new frame after Go hears of select mode only once it has loaded).
      const selecting = () =>
        preview
          .locator("html[data-sm-selecting]")
          .waitFor({ state: "attached", timeout: 60000 * P });
      await selecting();
      const editorText = async (file) => {
        await page.getByLabel(file, { exact: true }).waitFor({ timeout: 10000 * P });
        if ((await page.getByLabel("File", { exact: true }).inputValue()) !== file)
          throw new Error(`another file is open than ${file}`);
        return page
          .getByLabel(file, { exact: true })
          .evaluate((e) => e.value.slice(e.selectionStart, e.selectionEnd));
      };
      const subtitle = preview.locator('[data-sm-text="pages.customers.subtitle"]');
      await subtitle.click({ timeout: 60000 * P });
      const text = await editorText("smithable.content.yml");
      if (text !== "Keep every relationship in view.")
        throw new Error(`the content file shows "${text}", not the subtitle`);
      // Not changed in place, as it is with No code shown.
      if (await subtitle.evaluate((e) => e.isContentEditable))
        throw new Error("the text became editable with Code first");
      await openPreview("/customers/new");
      await selecting();
      await preview
        .locator('[data-sm-concept="field:Customer.email"]')
        .click({ timeout: 60000 * P });
      const field = await editorText("smithable.yml");
      if (!field.trim().startsWith("email:")) throw new Error(`smithable.yml shows "${field}"`);
      await page.getByRole("button", { name: "Select" }).click();
      await firstWindow("nocode");
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
      .getByText("Undid: Customers: added a mobile (a phone number)")
      .first()
      .waitFor({ timeout: 60000 * P });
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
    for (const deadline = Date.now() + 90000 * P; ; ) {
      newest = await last.locator("li").first().innerText();
      if (newest.includes("a mobile") && !newest.includes("Undid")) break;
      if (Date.now() > deadline) throw new Error(`after Redo the newest change is ${newest}`);
      await new Promise((r) => setTimeout(r, 500));
    }
    await page
      .locator("header")
      .getByRole("button", { name: "Redo", exact: true, disabled: true })
      .waitFor({ timeout: 30000 * P });
  });
  await step(
    "an earlier change is undone by its X as a new change; one a later change built on is refused, saying why",
    async () => {
      const count = await changeCount();
      await trace
        .getByRole("button", { name: /^Undo: .*in the customers table/ })
        .first()
        .click();
      await status.getByText(/^Undid: .*customers table/).waitFor({ timeout: 60000 * P });
      if (/columns: \[email, name/.test(readFileSync(join(dir, "smithable.ux.yml"), "utf8")))
        throw new Error("the columns' change was not undone");
      if ((await changeCount()) !== count + 1)
        throw new Error("the earlier change was not undone as a change of its own");
      // The website was renamed later: undoing its adding is refused, and nothing changes.
      await trace.getByRole("button", { name: "Undo: Customers: added a website" }).click();
      const refused = page.getByRole("alert").first();
      await refused.waitFor({ timeout: 60000 * P });
      await refused.getByRole("button", { name: "Dismiss" }).click();
      if ((await changeCount()) !== count + 1) throw new Error("a refused undo changed something");
    },
  );
  await step("the Look tab shows smithable.ux.yml as controls, each applied at once", async () => {
    const ux = () => readFileSync(join(dir, "smithable.ux.yml"), "utf8");
    await sub("Look");
    const look = (name) => page.getByRole("region", { name });
    // The app's language: the content file says it, and English is saying nothing.
    const content = () => readFileSync(join(dir, "smithable.content.yml"), "utf8");
    await look("Language").getByLabel("The app's language").selectOption("sv");
    for (let i = 0; !/^language: sv$/m.test(content()); i++) {
      if (i === 60 * P) throw new Error("the language was not set");
      await new Promise((r) => setTimeout(r, 1000));
    }
    await look("Language").getByLabel("The app's language").selectOption("en");
    for (let i = 0; /^language:/m.test(content()); i++) {
      if (i === 60 * P) throw new Error("English did not take the language line away");
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
      if (i === 60 * P) throw new Error(`no logo in smithable.content.yml:\n${content()}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!existsSync(join(dir, "public", "images", "logo.png")))
      throw new Error("the logo's file was not written under public/images/");
    // A 138: when the logo never shows, say which half is stale: what the dev server renders
    // for the frame's address and what it gives the browser for the root route.
    await preview
      .locator('img[data-part="logo"][src="/images/logo.png"] >> visible=true')
      .first()
      .waitFor({ timeout: 60000 * P })
      .catch(async (error) => {
        const at = (await page.locator('iframe[title="App preview"]').getAttribute("src")) ?? "/";
        const app = `http://localhost:${port + 1}`;
        const text = (path) =>
          page
            .context()
            .request.get(new URL(path, app).toString())
            .then(
              (r) => r.text(),
              () => "",
            );
        const html = await text(at);
        const root = await text("/src/routes/__root.tsx");
        throw new Error(
          `no logo in the preview (frame at ${at}; the server's page ${html.includes('data-part="logo"') ? "has" : "lacks"} it, the root module ${/logo/.test(root) ? "has" : "lacks"} it): ${error.message.split("\n")[0]}`,
        );
      });
    await look("Logo").getByRole("button", { name: "Remove" }).click();
    for (let i = 0; /^logo:/m.test(content()); i++) {
      if (i === 60 * P) throw new Error("Remove did not take the logo away");
      await new Promise((r) => setTimeout(r, 1000));
    }
    await look("Logo")
      .getByText("Add a logo")
      .waitFor({ timeout: 60000 * P });
    await look("Font, density and motion").getByRole("button", { name: "Comfortable" }).click();
    await look("Font, density and motion")
      .getByRole("button", { name: "Comfortable", pressed: true })
      .waitFor({ timeout: 60000 * P });
    await look("Colors of choices").getByLabel("Color of Draft").first().selectOption("warning");
    await last
      .getByText(/draft/i)
      .first()
      .waitFor({ timeout: 60000 * P });
    // A second line under a column's value.
    await look("Pages").getByLabel("Second line under Email").first().selectOption("phone");
    for (let i = 0; i < 60 * P && !/email: phone/.test(ux()); i++)
      await new Promise((r) => setTimeout(r, 1000));
    if (!/email: phone/.test(ux())) throw new Error(`no second line in smithable.ux.yml:\n${ux()}`);
    // A change made while another runs is dropped: wait for the trace.
    await last
      .getByText("Show phone under email in the customers table")
      .waitFor({ timeout: 60000 * P });
    const columns = look("Pages").getByRole("list", { name: "Columns of Customers" });
    const before = await changeCount();
    await columns
      .getByRole("button", { name: /^Hide / })
      .last()
      .click();
    await columns
      .getByRole("button", { name: /^Show / })
      .first()
      .waitFor({ timeout: 60000 * P });
    // The last change is done before the next (a change while one runs is not made).
    // (Which columns depends on the fields added before: one change more is enough.)
    for (let i = 0; i < 60 * P && (await changeCount()) === before; i++)
      await new Promise((r) => setTimeout(r, 1000));
    if ((await changeCount()) === before) throw new Error("hiding a column made no change");
    // A list page's view and order, and its form's columns and sections (look.md §1.1–1.3).
    const waitUx = async (re) => {
      for (let i = 0; i < 60 * P && !re.test(ux()); i++)
        await new Promise((r) => setTimeout(r, 1000));
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
      .waitFor({ timeout: 60000 * P });
    if (/lists:/.test(ux())) throw new Error("a refused conversation changed smithable.ux.yml");
    await sub("Behavior");
  });

  await step("a refusal is said without the files' language (finding 7)", async () => {
    // The shipping cost's formula names the shipping method: refused, in plain words.
    const order = await entry(await area("models"), "Order");
    const method = await entry(order, "shippingMethod");
    await method.getByRole("button", { name: "Remove shippingMethod", exact: true }).click();
    const alert = page.getByRole("alert").first();
    await alert.waitFor({ timeout: 60000 * P });
    const said = await alert.innerText();
    if (/smithable\.yml|removeField|:\d+:\d+/.test(said))
      throw new Error(`the refusal speaks the files' language: ${said}`);
    await alert.getByRole("button", { name: "Dismiss" }).click();
  });
  await step(
    "records from a CSV file, from a kind of record in Behavior: the preview shows them as they would land, Import adds them",
    async () => {
      const customer = await entry(await area("models"), "Customer");
      await customer.getByRole("button", { name: "Import records from a file…" }).click();
      await customer.getByLabel("CSV file").setInputFiles({
        name: "customers.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          'Name,E-mail,Credit limit\nÅland Fish AB,fish@example.ax,"25 000,00"\nMarina Café,cafe@example.ax,1200\n',
        ),
      });
      await customer
        .getByRole("status", { name: "Import preview" })
        .getByText('"creditLimit":2500000')
        .waitFor({ timeout: 60000 * P });
      await customer.getByRole("button", { name: "Import", exact: true }).click();
      await status.getByText("2 added").waitFor({ timeout: 60000 * P });
    },
  );
  await step("a page's code is made the person's own from its entry in Behavior", async () => {
    const customers = await entry(await area("pages"), "customers");
    await customers.getByRole("button", { name: "Make this page's code your own" }).click();
    await customers
      // The notice shows until the files' refresh says the page is its own, which under load may come first.
      .getByText(/the page is now src\/custom\/pages\/customers\.tsx|This page's code is your own/)
      .waitFor({ timeout: 60000 * P });
    await page
      .getByText("This page's code is your own: src/custom/pages/customers.tsx")
      .waitFor({ timeout: 60000 * P });
  });
  await step(
    "a landing page and a contact section show in the preview, with a theme and background of their own from Look",
    async () => {
      await op("addLandingPage", { page: "home" });
      await last
        .getByText("Added the Home page, a landing page for visitors")
        .first()
        .waitFor({ timeout: 60000 * P });
      await op("addSection", { page: "home", section: "contact" });
      await last
        .getByText("Added a contact section to the Home page")
        .first()
        .waitFor({ timeout: 60000 * P });
      await openPreview("/");
      await preview
        .getByRole("heading", { name: "Acme CRM", level: 1 })
        .waitFor({ timeout: 60000 * P });
      // Its own theme, from the Look tab (look.md §1.5).
      await sub("Look");
      await page.getByLabel("Theme of Home").selectOption("playful");
      await last
        .getByText(/theme on the home page/i)
        .first()
        .waitFor({ timeout: 60000 * P });
      // A background of the owner's: picked, applied when the picker closes, in the CSS.
      await page.getByLabel("Background", { exact: true }).fill("#f5efe6");
      await page.getByLabel("Background", { exact: true }).blur();
      await last
        .getByText(/background #f5efe6/i)
        .first()
        .waitFor({ timeout: 60000 * P });
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
      for (let i = 0; i < 60 * P && !above(); i++) await new Promise((r) => setTimeout(r, 1000));
      if (!above()) throw new Error("the contact section was not moved above the footer");
      // The panel follows: the contact section is no longer last.
      const down = page
        .getByRole("list", { name: "Sections of Home" })
        .getByRole("button", { name: "Move Contact down" });
      for (let i = 0; i < 60 * P && (await down.isDisabled()); i++)
        await new Promise((r) => setTimeout(r, 1000));
      if (await down.isDisabled()) throw new Error("the sections' arrows did not follow the move");
      // A page's frame (page-sections.md §4): the customers in the site's frame, in the ux file.
      await page.getByLabel("Frame of Customers").selectOption("site");
      const framed = () =>
        /customers:\s*\n(\s+\S.*\n)*?\s+frame: site/.test(
          readFileSync(join(dir, "smithable.ux.yml"), "utf8"),
        );
      for (let i = 0; i < 60 * P && !framed(); i++) await new Promise((r) => setTimeout(r, 1000));
      if (!framed()) throw new Error("the ux file has no frame for the customers");
      // Back to its kind's, for the steps after this one.
      await page.getByLabel("Frame of Customers").selectOption("default");
      for (let i = 0; i < 60 * P && framed(); i++) await new Promise((r) => setTimeout(r, 1000));
      if (framed()) throw new Error("the customers kept the site's frame");
      await sub("Behavior");
    },
  );

  console.log("Code");
  await firstWindow("code");
  await step(
    "the spec editor checks as you type, saves a valid edit when it is left (never on a pause), and a formatting-only edit is no change",
    async () => {
      // The editor's text element answers `value` like a text box (only the lines in view are in
      // the page), for reading and for setting the whole text.
      const editor = page.getByLabel("smithable.yml", { exact: true });
      const text = await editor.evaluate((e) => e.value);
      const startCount = await changeCount();
      const settled = () =>
        page.getByText("Saved", { exact: true }).waitFor({ timeout: 60000 * P });
      // Leaving the editor: the focus elsewhere.
      const leave = async () => {
        await editor.focus();
        await page
          .locator("header")
          .first()
          .click({ position: { x: 800, y: 10 } });
      };
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
      // Valid, it is not saved on a pause, only when the editor is left: one change.
      await new Promise((r) => setTimeout(r, 2500));
      if (readFileSync(join(dir, "smithable.yml"), "utf8").includes("      fax: phone\n"))
        throw new Error("the edit was saved on a pause");
      await leave();
      await settled();
      if (!readFileSync(join(dir, "smithable.yml"), "utf8").includes("      fax: phone\n"))
        throw new Error("the valid edit was not saved on leaving");
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
      // Under models:, the creation wizard is offered first; Esc goes back to the text.
      const models = "models:\n";
      await write(good.replace(models, `${models}  \n`));
      await editor.focus();
      await cursor(good.indexOf(models) + models.length + 2);
      await offered.getByText("Add a model…", { exact: true }).waitFor();
      await accept();
      const wizard = page.getByRole("region", { name: "Add a kind of record" });
      await wizard.getByLabel("Add a kind of record, in your words").waitFor();
      await page.keyboard.press("Escape");
      await wizard.waitFor({ state: "detached" });
      // Under a map of names (the actions) a template entry is offered and fills in its keys.
      const actions = "actions:\n";
      await write(good.replace(actions, `${actions}  \n`));
      await editor.focus();
      await cursor(good.indexOf(actions) + actions.length + 2);
      // (The wizard comes first in that list: the template is chosen by its name.)
      await offered.getByText("myEntry", { exact: true }).click();
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
      // The text back as saved, and whitespace only: leaving makes no change.
      await write(`${good}\n\n`);
      await leave();
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
        for (let i = 0; i < 100 * P && !(await done()); i++)
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
    const auth = page.getByLabel("smithable.auth.yml", { exact: true });
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
    // Another file: saved on leaving, as a change of its own.
    await auth.focus();
    await page
      .locator("header")
      .first()
      .click({ position: { x: 800, y: 10 } });
    await page.getByText("Saved", { exact: true }).waitFor({ timeout: 60000 * P });
    if (!readFileSync(join(dir, "smithable.auth.yml"), "utf8").includes("  support:"))
      throw new Error("the auth file's edit was not saved on leaving");
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
    const context = page.getByLabel("smithable.context.yml", { exact: true });
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
  await step("an edit in Code shows in Changes, naming its file", async () => {
    await trace
      .getByText(/smithable\.auth\.yml/)
      .first()
      .waitFor({ timeout: 30000 * P });
  });
  await step(
    "a failure offers Troubleshoot: what went wrong, the log's last lines, Report, Undo and Reload",
    async () => {
      // A package that does not exist cannot be installed: the change fails and is rolled back.
      await page.getByLabel("File", { exact: true }).selectOption("smithable.context.yml");
      await page.getByLabel("smithable.context.yml", { exact: true }).evaluate((e) => {
        e.value =
          "smithableContext: 0.1\nplugins: [greeting]\npackages:\n  smithable-no-such-package: 9.9.9\n";
      });
      const save = page.getByRole("button", { name: "Save", exact: true });
      if (await save.isEnabled()) await save.click();
      const alert = page.getByRole("alert").filter({ hasText: "Nothing was changed." });
      await alert.waitFor({ timeout: 120000 * P });
      await alert.getByRole("button", { name: "Troubleshoot" }).click();
      const dialog = page.getByRole("dialog", { name: "Troubleshoot" });
      await dialog.getByRole("region", { name: "Logs" }).waitFor();
      for (const name of ["Report", "Undo last change", "Reload Studio"])
        await dialog.getByRole("button", { name, exact: true }).waitFor();
      await dialog.getByRole("button", { name: "Close" }).click();
      await alert.getByRole("button", { name: "Dismiss" }).click();
      if (readFileSync(join(dir, "smithable.context.yml"), "utf8").includes("no-such-package"))
        throw new Error("the context file kept the failed change");
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "Discard", exact: true }).click();
      await page.getByLabel("File", { exact: true }).selectOption("smithable.yml");
    },
  );
  await step("the preview shows a change made elsewhere", async () => {
    await op("setSearch", { page: "orders", fields: ["number"] });
    // The preview may still be restarting after the last change on a slow runner; a page that
    // failed to load is not retried by the frame. Go to the page again until it shows, for up
    // to three minutes.
    const search = preview.getByRole("searchbox", { name: "Search by number" });
    for (const deadline = Date.now() + 180000 * P; ; ) {
      await openPreview("/orders");
      try {
        await search.waitFor({ timeout: 30000 * P });
        break;
      } catch (error) {
        if (Date.now() > deadline) throw error;
      }
    }
  });
  await step(
    "a change whose regeneration fails is rolled back, and the preview comes back; so does a crashed one, and a page opened while it was down shows once it is up",
    async () => {
      const health = async () => {
        for (let i = 0; i < 60 * P; i++) {
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
      await preview
        .getByRole("heading", { name: "Clients", level: 1 })
        .waitFor({ timeout: 60000 * P });
    },
  );
  await step("an agent changes the app over MCP (HTTP), and Studio shows it", async () => {
    // An unsaved edit in the spec editor (one with a problem, which leaving cannot save) is kept
    // when the file changes under it.
    await page.getByLabel("File", { exact: true }).selectOption("smithable.yml");
    const editor = page.getByLabel("smithable.yml", { exact: true });
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
    for (let i = 0; i < 60 * P; i++) {
      const { trace: made } = await (await fetch(`${base}/api/project`)).json();
      if (made[0]?.description === "Add field vatNumber (text) to Customer") break;
      if (i === 60 * P - 1)
        throw new Error(`the agent's change is not the newest: ${made[0]?.description}`);
      await new Promise((r) => setTimeout(r, 500));
    }
    await page
      .getByText("smithable.yml changed on disk while you were editing.")
      .waitFor({ timeout: 30000 * P });
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
    "Content's Languages adds a language, shows each text beside its words in it, saves one, and takes the language away",
    async () => {
      // Late in the run, so the steps before keep their last change; No code first again.
      await firstWindow("nocode");
      await sub("Content");
      const languages = page.getByRole("region", { name: "Languages" });
      await languages.getByLabel("Add a language").selectOption("sv");
      await languages.getByRole("button", { name: "Add", exact: true }).click();
      const texts = page.getByRole("region", { name: "Texts in Swedish" });
      await texts.waitFor({ timeout: 60000 * P });
      await texts.getByText(/texts have no Swedish words yet/).waitFor();
      const file = join(dir, "smithable.content.sv.yml");
      const box = texts.getByLabel("Customers in Swedish").first();
      await box.fill("Kunder");
      await box.press("Enter");
      for (let i = 0; i < 60 * P && !readFileSync(file, "utf8").includes("Kunder"); i++)
        await new Promise((r) => setTimeout(r, 1000));
      if (!readFileSync(file, "utf8").includes("Kunder"))
        throw new Error(`the Swedish file has no Kunder:\n${readFileSync(file, "utf8")}`);
      await texts.getByRole("button", { name: "Remove Swedish" }).click();
      await page.getByRole("button", { name: "Apply anyway" }).click({ timeout: 30000 * P });
      for (let i = 0; i < 60 * P && existsSync(file); i++)
        await new Promise((r) => setTimeout(r, 1000));
      if (existsSync(file)) throw new Error("removing Swedish left its file");
    },
  );
  await step(
    "Content's form: a page's subtitle changed there lands in the content file",
    async () => {
      const texts = page.getByRole("region", { name: "The texts" });
      const pagesArea = texts.locator('details[data-key="pages"]').first();
      if (!(await pagesArea.evaluate((d) => d.open)))
        await pagesArea.locator("summary").first().click();
      const customers = await entry(pagesArea, "customers");
      const box = customers.getByRole("textbox", { name: "subtitle" });
      await box.fill("Every client and their orders.");
      await box.press("Enter");
      const file = join(dir, "smithable.content.yml");
      for (
        let i = 0;
        i < 60 * P && !readFileSync(file, "utf8").includes("Every client and their orders.");
        i++
      )
        await new Promise((r) => setTimeout(r, 1000));
      if (!readFileSync(file, "utf8").includes("Every client and their orders."))
        throw new Error("the subtitle did not reach the content file");
      await sub("Behavior");
    },
  );
  await step(
    "Behavior: a kind of record's description changed there lands in smithable.yml",
    async () => {
      const customer = await entry(await area("models"), "Customer");
      let box = customer.getByRole("textbox", { name: "description" }).first();
      if (!(await box.isVisible())) {
        await customer
          .locator("summary", { hasText: /^Not set/ })
          .first()
          .click();
        box = customer.getByRole("textbox", { name: "description" }).first();
      }
      await box.fill("Everyone we sell to.");
      await box.press("Enter");
      const file = join(dir, "smithable.yml");
      for (
        let i = 0;
        i < 60 * P && !readFileSync(file, "utf8").includes("Everyone we sell to.");
        i++
      )
        await new Promise((r) => setTimeout(r, 1000));
      if (!readFileSync(file, "utf8").includes("description: Everyone we sell to."))
        throw new Error("the description did not reach smithable.yml");
    },
  );
  await step(
    "Behavior adds a kind of record and a field, renames the field and a page and changes the field's type, through their operations",
    async () => {
      await sub("Behavior");
      const app = page.getByRole("region", { name: "What the app does" });
      await area("models");
      const file = join(dir, "smithable.yml");
      const waitFile = async (text) => {
        for (let i = 0; i < 60 * P && !readFileSync(file, "utf8").includes(text); i++)
          await new Promise((r) => setTimeout(r, 1000));
        if (!readFileSync(file, "utf8").includes(text))
          throw new Error(`no ${text} in smithable.yml`);
      };
      // A kind of record comes from the creation wizard: words, then the change as a form,
      // nothing written before Create; Dismiss goes back to the words.
      const models = await area("models");
      await models.getByRole("button", { name: "Add a kind of record…" }).click();
      const wizard = page.getByRole("region", { name: "Add a kind of record" });
      const words = wizard.getByLabel("Add a kind of record, in your words");
      await words.fill("suppliers with a name and an email");
      await words.press("Enter");
      const kind = wizard.getByLabel("Kind of record", { exact: true });
      await kind.waitFor({ timeout: 60000 * P });
      if (readFileSync(file, "utf8").includes("Supplier:"))
        throw new Error("the wizard wrote before Create");
      await wizard.getByRole("button", { name: "Dismiss" }).click();
      if ((await words.inputValue()) !== "suppliers with a name and an email")
        throw new Error("Dismiss did not keep the words");
      await words.press("Enter");
      // Edited in the form: the name given there is the one made.
      await kind.fill("Vendor");
      await wizard.getByRole("button", { name: "Create" }).click();
      await waitFile("Vendor:");
      await wizard.waitFor({ state: "detached" });
      const customer = await entry(await area("models"), "Customer");
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
      await customer
        .getByLabel("New name for website")
        .locator("..")
        .getByRole("button", { name: "Rename", exact: true })
        .click();
      await waitFile("homepage: string");
      // A field's type is its own control in the form, changed through changeField.
      const homepage = customer.locator("details", {
        has: page.locator("summary", { hasText: /^homepage$/ }),
      });
      if (!(await homepage.evaluate((d) => d.open)))
        await homepage.locator("summary", { hasText: /^homepage$/ }).click();
      await homepage.getByLabel("Field type").selectOption({ label: "Web address" });
      await homepage.getByRole("button", { name: "Change field" }).click();
      // Another type may lose values, so it is confirmed first.
      await page.getByRole("button", { name: "Apply anyway" }).click();
      await waitFile("homepage: url");
      // A page is renamed through renamePage, its references following; and back again.
      // The pages' own entries, not a customer's list of orders.
      const pages = await area("pages");
      const pageEntry = (name) =>
        pages.locator("details", {
          has: page.locator(`summary:text-is("${name}")`),
        });
      const renameBox = (name) => pages.getByLabel(`New name for ${name}`, { exact: true });
      await pageEntry("orders").locator(`summary:text-is("orders")`).click();
      await renameBox("orders").fill("sales");
      await renameBox("orders").locator("..").getByRole("button", { name: "Rename" }).click();
      await waitFile("  sales:");
      if (!(await renameBox("sales").isVisible()))
        await pageEntry("sales").locator(`summary:text-is("sales")`).click();
      await renameBox("sales").fill("orders");
      await renameBox("sales").locator("..").getByRole("button", { name: "Rename" }).click();
      for (let i = 0; i < 60 * P && readFileSync(file, "utf8").includes("  sales:"); i++)
        await new Promise((r) => setTimeout(r, 1000));
      if (readFileSync(file, "utf8").includes("  sales:"))
        throw new Error("sales was not renamed back");
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
    const ask = () =>
      fetch(`http://localhost:${at}/api/project/replace`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-smithable": "1" },
        body: JSON.stringify(body),
      });
    // One more try after a second when the request itself failed (a pooled connection the
    // server had closed meanwhile: the answer is the same either way); a server that is down
    // fails the second time too, and the cause is printed.
    const answer = await ask().catch(async () => {
      await new Promise((r) => setTimeout(r, 1000));
      return ask();
    });
    return { status: answer.status, ...(await answer.json()) };
  };
  // The preview answers on the app that came in, in the process it was running in: a start
  // would say so in Studio's log, which begins anew with the app.
  const previewUp = async (at) => {
    for (let i = 0; i < 480 * P; i++) {
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
    for (let i = 0; i < 240 * P; i++) {
      if (
        await fetch(`http://localhost:${at}/health`).then(
          (r) => r.ok,
          () => false,
        )
      )
        break;
      if (i === 240 * P - 1) throw new Error("the preview did not answer on the new app");
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
        await watcher
          .locator("header")
          .first()
          .waitFor({ timeout: 60000 * P });
        const seen = (async () => {
          const screen = watcher.getByRole("region", { name: "Your app is being made" });
          await screen
            .getByText("A booking site for a pilates studio")
            .waitFor({ timeout: 15000 * P });
          await screen.getByRole("progressbar").waitFor();
          if (!(await watcher.getByRole("button", { name: "Undo", exact: true }).isDisabled()))
            throw new Error("Undo is on while the app is being made");
          // Once drafted: the app's name, and one line of what it does, not the whole summary.
          await screen
            .getByRole("heading", { name: "Preparing Studio for Lotus Pilates" })
            .waitFor({ timeout: 15000 * P });
          if ((await screen.getByRole("region", { name: "What it does" }).locator("p").count()) > 1)
            throw new Error("the making page shows more than one line of what the app does");
          await screen.waitFor({ state: "detached", timeout: 60000 * P });
          await watcher
            .locator("header")
            .first()
            .getByText("Lotus Pilates")
            .waitFor({ timeout: 30000 * P });
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
          for (let i = 0; i < 600 * P; i++) {
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
          await watcher
            .locator("header")
            .first()
            .waitFor({ timeout: 60000 * P });
          const again2 = await replace(port + 2, {
            describe: "A status page for our services",
            ask: true,
            wait: false,
          });
          if (again2.status !== 202) throw new Error(JSON.stringify(again2));
          const form = watcher.getByRole("form", { name: "Questions" });
          await form.waitFor({ timeout: 15000 * P });
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
          await form.waitFor({ state: "detached", timeout: 15000 * P });
          // The request that waited is proposed once the app is there (Smith and Changes come
          // into view for it), and waits for Apply.
          await watcher
            .getByRole("region", { name: "Proposal" })
            .getByRole("button", { name: "Apply" })
            .click({ timeout: 90000 * P });
          // In place: the request that waited is made, and nothing waits any more.
          const made = watcher.getByLabel("Change trace").getByText("Sessions: added a phone");
          await made.first().waitFor({ timeout: 90000 * P });
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
        for (let i = 0; i < 120 * P; i++) {
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
        await frame.locator("body[data-hydrated=true]").waitFor({ timeout: 120000 * P });
        // One page at a time, chosen by its tab: signed in (no sign-in form in the list), and the
        // record's page shows a record.
        const tab = (name) =>
          labPage.getByRole("group", { name: "Page" }).getByRole("button", { name });
        await tab("List").click();
        const list = labPage.frameLocator('[data-frame="List-light"]');
        await list.locator("body[data-hydrated=true]").waitFor({ timeout: 60000 * P });
        if (await list.getByText(/^Sign in to /).count())
          throw new Error("the lab's frames are not signed in");
        await tab("Record").click();
        const record = labPage.frameLocator('[data-frame="Record-light"]');
        await record.locator("body[data-hydrated=true]").waitFor({ timeout: 60000 * P });
        if (await record.getByText("does not exist, or you cannot see it").count())
          throw new Error("the record frame shows no record");
        // The width at 100 % when it fits, the phone beside it, and dark in the same frame.
        await labPage.getByRole("button", { name: "Phone 390" }).click();
        const shown = await labPage
          .locator('[data-frame="Record-light"]')
          .evaluate((f) => [f.clientWidth, f.getBoundingClientRect().width]);
        if (shown[0] !== 390 || Math.round(shown[1]) !== 390)
          throw new Error(`the phone width is shown as ${shown.join(" / ")}`);
        await labPage.getByRole("button", { name: "Laptop 1280" }).click();
        await labPage.getByLabel("Phone beside").check();
        await labPage
          .frameLocator('[data-frame="Record-light-phone"]')
          .locator("body[data-hydrated=true]")
          .waitFor({ timeout: 60000 * P });
        const background = (mode) =>
          labPage
            .frameLocator(`[data-frame="Record-${mode}"]`)
            .locator("body")
            .evaluate((b) => getComputedStyle(b).backgroundColor);
        const light = await background("light");
        await labPage.getByRole("button", { name: "Dark", exact: true }).click();
        for (let i = 0; i < 40 && (await background("dark")) === light; i++)
          await new Promise((r) => setTimeout(r, 250));
        if ((await background("dark")) === light) throw new Error("Dark left the frame light");
        await labPage.getByRole("button", { name: "Light", exact: true }).click();
        await labPage.getByLabel("Phone beside").uncheck();
        await tab("Landing").click();
        await frame.locator("body[data-hydrated=true]").waitFor({ timeout: 60000 * P });
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
