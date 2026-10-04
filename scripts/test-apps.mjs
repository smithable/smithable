// End-to-end test: every example becomes a real app that installs, type-checks, builds,
// serves its pages with sample data, and regenerates without changes. The production
// build is checked for page access and the absence of the development sign-in; the
// development server is used in a real browser, signed in as the examples' roles.
// Run after `pnpm build`: `pnpm test:apps [example…]`.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { chromium } from "playwright";
import { validateSpec } from "../packages/core/dist/index.js";
import { startFakeModel } from "./fake-model.mjs";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const examples = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(join(repo, "examples"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

const failures = [];
/** Apps under test; removed when everything passes, kept for inspection otherwise. */
const dirs = [];
// Apps kept by failed runs, once a day old: each failure keeps its app to look at, and they add up.
for (const entry of readdirSync(tmpdir()).filter((e) => /^smithable-/.test(e))) {
  const path = join(tmpdir(), entry);
  try {
    if (Date.now() - statSync(path).mtimeMs > 86400_000)
      rmSync(path, { recursive: true, force: true });
  } catch {}
}

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

async function asyncStep(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.log(`  ✗ ${name}\n    ${String(error.message).split("\n").join("\n    ")}`);
    failures.push(name);
    throw error;
  }
}

function run(command, args, cwd, env) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    ...(env ? { env: { ...process.env, ...env } } : {}),
  });
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      // Each try is bounded: a server that takes the connection and never answers would
      // otherwise hold the run forever.
      if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${url} did not respond`);
}

/** Production needs a secret for sessions and the public address of the app. */
const authEnv = (port) => ({
  BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789",
  BETTER_AUTH_URL: `http://localhost:${port}`,
});

/**
 * Every process this run started and has not stopped, so that a run that is stopped or fails
 * leaves no server behind on the ports the next run needs.
 */
const live = new Set();
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
  process.on(signal, () => {
    for (const pid of live) killTree(pid);
    process.exit(130);
  });
process.on("exit", () => {
  for (const pid of live) killTree(pid);
});

/** Kills a process and everything it started (pnpm, then node, then Vite), children first. */
export function killTree(pid, signal = "SIGTERM") {
  const children = spawnSync("ps", ["-o", "pid=", "--ppid", String(pid)], { encoding: "utf8" })
    .stdout.split("\n")
    .map((s) => Number(s.trim()))
    .filter(Boolean);
  for (const child of children) killTree(child, signal);
  try {
    process.kill(pid, signal);
  } catch {}
}

/** Starts `pnpm start` (production) or the Vite dev server; returns a stop function. */
async function serve(dir, port, mode) {
  // A fixed port: Vite would otherwise move to another one while the old server is stopping.
  const args =
    mode === "dev" ? ["exec", "vite", "dev", "--port", String(port), "--strictPort"] : ["start"];
  const server = spawn("pnpm", args, {
    cwd: dir,
    env: { ...process.env, PORT: String(port), ...authEnv(port) },
  });
  let output = "";
  server.stdout.on("data", (d) => (output += d));
  server.stderr.on("data", (d) => (output += d));
  live.add(server.pid);
  const stop = () => {
    live.delete(server.pid);
    killTree(server.pid);
  };
  try {
    await waitFor(`http://localhost:${port}/health`);
  } catch (error) {
    stop();
    throw new Error(`${error.message}. The server said:\n${output.slice(-2000)}`);
  }
  // What the server has written so far: its access and app log lines.
  stop.output = () => output;
  return stop;
}

/** Saves what the page shows, for a failed browser check. */
async function screenshot(page) {
  const path = join(tmpdir(), `smithable-failure-${Date.now()}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

/**
 * Waits until React has hydrated the page, so typing and clicking reach their handlers: the root
 * sets body[data-hydrated] in its first client effect. Typed before that, text shows in a box
 * but nothing reacts (a search that never filters), which load made a flake.
 */
async function hydrated(page) {
  await page.locator('body[data-hydrated="true"]').waitFor({ state: "attached", timeout: 60_000 });
}

/** Opens a page and waits until it is interactive: the dev server loads code on demand. */
async function open(page, url) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await hydrated(page);
}

/** Chooses a related record in a searchable field: type part of its name, click it. */
async function chooseRecord(page, label, name) {
  await page.getByRole("combobox", { name: label }).fill(name.slice(0, 5));
  await page.getByRole("option", { name }).click();
}

/** Signs in through the development sign-in on the sign-in page. */
async function signInAs(page, base, role) {
  // A cold dev server optimizes dependencies and reloads the page, which can swallow a click.
  for (let attempt = 1; ; attempt++) {
    await open(page, `${base}/sign-in`);
    await page.getByRole("button", { name: `Sign in as ${role}` }).click();
    try {
      // Signed in: on to the app, or first to its onboarding.
      await page.waitForURL((url) => url.pathname !== "/sign-in", { timeout: 5000 });
      return;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
}

/** Writes to the app's dev database, e.g. records of another user. */
function write(dir, sql) {
  const code = `const D=require("better-sqlite3");new D("data/db/app.db").exec(${JSON.stringify(sql)})`;
  run("node", ["-e", code], dir);
}

/**
 * After `smithable detach`, a developer who knows only Drizzle and TanStack adds a column and
 * a page; migrations continue from the existing ones.
 */
async function detachFlow(dir, port) {
  step("smithable detach leaves an ordinary project", () => {
    run("git", ["add", "-A"], dir);
    run("git", ["commit", "-q", "--allow-empty", "-m", "work before detaching"], dir);
    const out = smithable(dir, "detach");
    if (out.code !== 0) throw new Error(out.out);
    const mentions = spawnSync("grep", ["-rli", "smithable", "src", "README.md", "package.json"], {
      cwd: dir,
      encoding: "utf8",
    })
      .stdout.split("\n")
      .filter((f) => f && !f.startsWith("src/custom/"));
    if (mentions.length) throw new Error(`still mentions Smithable: ${mentions.join(", ")}`);
    for (const gone of [
      ".smithable",
      "smithable.yml",
      "smithable.lock",
      "AGENTS.md",
      ".mcp.json",
      "CLAUDE.md",
    ]) {
      if (spawnSync("test", ["-e", join(dir, gone)]).status === 0)
        throw new Error(`${gone} is still there`);
    }
    readFileSync(join(dir, "docs/smithable/smithable.yml"), "utf8");
  });
  step("after detaching, a column and a page are added with only Drizzle and TanStack", () => {
    const schema = join(dir, "src/db/schema.ts");
    writeFileSync(
      schema,
      readFileSync(schema, "utf8").replace(
        "  phone: text(),",
        "  phone: text(),\n  website: text(),",
      ),
    );
    const migrations = () =>
      readdirSync(join(dir, "drizzle")).filter((f) => f.endsWith(".sql")).length;
    const before = migrations();
    run("pnpm", ["db:generate"], dir);
    if (migrations() !== before + 1) throw new Error("drizzle-kit did not continue the migrations");
    writeFileSync(
      join(dir, "src/routes/about.tsx"),
      'import { createFileRoute } from "@tanstack/react-router";\n\nexport const Route = createFileRoute("/about")({\n  component: () => <h1>About Acme</h1>,\n});\n',
    );
    run("pnpm", ["routes"], dir);
    run("pnpm", ["typecheck"], dir);
    run("pnpm", ["build"], dir);
    run("pnpm", ["test"], dir);
  });
  const stop = await serve(dir, port, "production");
  try {
    const about = await (await fetch(`http://localhost:${port}/about`)).text();
    const columns = query(dir, "select name from pragma_table_info('customers')").map(
      (c) => c.name,
    );
    const ok = about.includes("About Acme") && columns.includes("website");
    console.log(`  ${ok ? "✓" : "✗"} the detached app serves the new page and has the new column`);
    if (!ok) failures.push("detached app");
  } finally {
    stop();
  }
}

/** A test that names the rule it covers, as a developer (or AI) writes it. */
const MERGE_CUSTOMERS_TEST = `import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { db } from "#/db";
import { customers, orders } from "#/db/schema";
import { mergeCustomers } from "./merge-customers";

test("rule mergeCustomers.move-orders: the duplicate's orders move to the kept customer", async () => {
  const keep = db.insert(customers).values({ name: "Keep Ltd" }).returning().get();
  const duplicate = db.insert(customers).values({ name: "Duplicate Ltd" }).returning().get();
  db.insert(orders).values({ number: \`T-\${Date.now()}\`, customerId: duplicate.id, total: 100 }).run();
  await mergeCustomers({ keep: keep.id, duplicate: duplicate.id }, null);
  expect(db.select().from(orders).where(eq(orders.customerId, keep.id)).all()).toHaveLength(1);
  expect(db.select().from(customers).where(eq(customers.id, duplicate.id)).all()).toHaveLength(0);
});
`;

/** A visitor opens a gallery picture and sends the contact form; an admin reads the message. */
/**
 * The booking starter's public schedule: a visitor sees this week's sessions and opens one; Next
 * and Previous change the week and the address; an admin clicks an empty hour and the new
 * session starts then.
 */
async function calendarFlow(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await open(page, `${base}/schedule`);
    const week = page.getByRole("heading", { level: 2 }).first();
    const shown = await week.innerText();
    const session = page.locator("section ol button").first();
    await session.waitFor({ timeout: 10000 });
    if (process.env.CALENDAR_SHOTS)
      await page.screenshot({ path: `${process.env.CALENDAR_SHOTS}/week.png`, fullPage: true });
    // A visitor gets the session's details in a panel.
    const title = (await session.locator("span").first().innerText()).trim();
    await session.click();
    await page.getByRole("dialog").getByRole("heading", { name: title }).waitFor({ timeout: 5000 });
    // Its places, and for a visitor a way to sign in and book.
    await page
      .getByRole("dialog")
      .getByText(/^\d+ of \d+ places? left$/)
      .waitFor({ timeout: 10000 });
    await page.getByRole("dialog").getByRole("link", { name: "Sign in to book" }).waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    // Next and Previous: another week, in the address too.
    await page.getByRole("button", { name: "Next" }).click();
    await page.waitForURL(/\?week=\d{4}-W\d{2}/);
    await page.waitForFunction(
      (text) => [...document.querySelectorAll("h2")].every((h) => h.textContent !== text),
      shown,
      { timeout: 10000 },
    );
    await page.getByRole("button", { name: "Previous" }).click();
    await page.waitForFunction(
      (text) => [...document.querySelectorAll("h2")].some((h) => h.textContent === text),
      shown,
      { timeout: 10000 },
    );
    await page.getByRole("button", { name: "Month" }).click();
    await page.waitForURL(/\?month=\d{4}-\d{2}/);
    if (process.env.CALENDAR_SHOTS)
      await page.screenshot({ path: `${process.env.CALENDAR_SHOTS}/month.png`, fullPage: true });
    await page.getByRole("button", { name: "Week" }).click();
    // A visitor sees the schedule in the site's frame, not the app's; the app's name leads back
    // to the landing page, whose hero says more follows.
    if (await page.locator('[data-kit="app-shell"]').count())
      throw new Error("a visitor sees the public schedule in the app's frame");
    await page
      .getByRole("banner")
      .getByRole("link", { name: "Stillwater Yoga", exact: true })
      .click();
    await page.waitForURL(`${base}/`);
    await page.getByRole("link", { name: "More below" }).click();
    await page.waitForURL(/#/);
    // An admin clicks an empty hour: the new session's start is that hour.
    await signInAs(page, base, "admin");
    await open(page, `${base}/schedule`);
    // Signed in, the same page is in the app's frame.
    await page.locator('[data-kit="app-shell"]').waitFor({ timeout: 10000 });
    const slot = page.getByRole("button", { name: /^New session, .* at 07:00$/ }).first();
    const label = await slot.getAttribute("aria-label");
    await slot.click();
    await page.waitForURL(/\/sessions\/new\?startsAt=/);
    const starts = await page.getByLabel("Starts at").inputValue();
    if (!starts.endsWith("T07:00"))
      throw new Error(`the new session starts at ${starts}, from ${label}`);
    console.log(
      "  ✓ browser: the schedule shows this week's sessions to a visitor, in the site's frame, who opens one (its places, Sign in to book); Next and Previous change the week and the address; the app's name leads home, where the hero's arrow scrolls on; signed in, the schedule is in the app's frame, and an admin's click on an empty hour starts a new session then",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("booking calendar flow");
  } finally {
    await browser.close();
  }
}

/**
 * Booking a place (docs/design/booking.md): with one place per session, a member books one
 * and sees it among their bookings; the admin then finds it full and cannot lower its places
 * below one; the member cancels and the place is free again.
 */
async function bookingFlow(dir, base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const panel = page.getByRole("dialog");
  try {
    write(dir, "UPDATE sessions SET capacity = 1");
    await signInAs(page, base, "member");
    await open(page, `${base}/schedule`);
    const session = page.locator("section ol button").first();
    await session.waitFor({ timeout: 10000 });
    const title = (await session.locator("span").first().innerText()).trim();
    await session.click();
    await panel.getByText(/^1 of 1 place left$/).waitFor({ timeout: 10000 });
    await panel.getByRole("button", { name: "Book a mat" }).click();
    await panel.getByText("You're booked").waitFor({ timeout: 10000 });
    await panel.getByText(/^No mats left$/).waitFor();
    await open(page, `${base}/my-bookings`);
    await page.locator("main tbody tr").first().waitFor({ timeout: 10000 });
    if ((await page.locator("main tbody tr").count()) !== 1)
      throw new Error("not one booking in My bookings");
    // The admin opens the same session on its page: full, and its places cannot go below one.
    await signInAs(page, base, "admin");
    await open(page, `${base}/schedule`);
    await page.locator("section ol button", { hasText: title }).first().click();
    await page.waitForURL(/\/sessions\/\d+$/);
    await page.getByText(/^No mats left$/).waitFor({ timeout: 10000 });
    if (await page.getByRole("button", { name: "Book a mat" }).count())
      throw new Error("a full session offers a place");
    await page.getByLabel("Capacity").fill("0");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page
      .getByText("1 is already taken; the number cannot go below that.")
      .waitFor({ timeout: 10000 });
    // The member cancels; the place is free again.
    await signInAs(page, base, "member");
    await open(page, `${base}/schedule`);
    await page.locator("section ol button", { hasText: title }).first().click();
    await panel.getByRole("button", { name: "Cancel my booking" }).click();
    await panel.getByRole("button", { name: "Yes, cancel it" }).click();
    await panel.getByText(/^1 of 1 place left$/).waitFor({ timeout: 10000 });
    await panel.getByRole("button", { name: "Book a mat" }).waitFor();
    console.log(
      "  ✓ browser: a member books a place and sees it in My bookings; the admin finds the session full and cannot lower its places below the bookings; the member cancels and the place is free again",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("booking flow");
  } finally {
    write(dir, "UPDATE sessions SET capacity = 12");
    await browser.close();
  }
}

/**
 * A list's filters and sort (the CRM's customers, by operations): a segment chip, a credit range
 * and a sort, all in the address and applied by the query; "Mine" for those signed in only.
 */
async function filtersFlow(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const names = async () =>
    (await page.locator('[data-part="row"] [data-field="name"]').allInnerTexts()).map((t) =>
      t.trim(),
    );
  try {
    await signInAs(page, base, "admin");
    await open(page, `${base}/customers`);
    await page.getByRole("button", { name: "Enterprise", exact: true }).click();
    await page.waitForURL(/segment=enterprise/);
    await page.getByRole("spinbutton", { name: "Credit limit from" }).fill("30000");
    await page.waitForURL(/creditLimit=30000\.\./);
    await page.getByLabel("Sort by").selectOption({ label: "Credit limit, high to low" });
    await page.waitForURL(/sort=-creditLimit/);
    // The address changes first; the sorted rows follow when the list's data arrives.
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('[data-part="row"] [data-field="name"]')]
            .map((e) => e.textContent?.trim())
            .join() === "Nordic Timber Oy,Helios Energy",
        undefined,
        { timeout: 10000 },
      )
      .catch(() => {});
    const shown = await names();
    if (shown.join() !== "Nordic Timber Oy,Helios Energy")
      throw new Error(`the list shows ${shown.join()}`);
    // The address alone gives the same list (a linked view).
    await open(page, page.url());
    if ((await names()).join() !== "Nordic Timber Oy,Helios Energy")
      throw new Error("a reloaded view differs");
    await page.getByRole("button", { name: "Remove the segment filter" }).click();
    await page.waitForURL((url) => !url.searchParams.has("segment"));
    // "Mine": the admin manages no customers; a visitor is not offered it at all.
    // The box follows the address, which changes a moment after the click.
    await page.getByRole("checkbox", { name: "Mine" }).click();
    await page.waitForURL(/owner=mine/);
    await page.getByText("No customers match the search and filters.").waitFor({ timeout: 10000 });
    console.log(
      "  ✓ browser: a list filters by a chip, a range and Mine and sorts by the address's order, applied by the query; a linked view gives the same list",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("filters flow");
  } finally {
    await browser.close();
  }
}

/**
 * Favorites (marketplace.md §2.3): the admin saves a customer with its heart; the Saved view
 * lists only it, the record page shows it saved, another person's Saved view stays empty, and
 * unsaving on the record page empties the admin's.
 */
async function favoritesFlow(base) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const heart = page.getByRole("button", { name: "Save Nordic Timber Oy" });
  const rows = () => page.locator('[data-part="row"] [data-field="name"]').allInnerTexts();
  try {
    await signInAs(page, base, "admin");
    await open(page, `${base}/customers`);
    await heart.click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Save Nordic Timber Oy"]')
          ?.getAttribute("aria-pressed") === "true",
    );
    await page.getByRole("button", { name: "Saved", exact: true }).click();
    await page.waitForURL(/view=saved/);
    await page.waitForFunction(
      () => document.querySelectorAll('[data-part="row"] [data-field="name"]').length === 1,
    );
    if ((await rows()).join().trim() !== "Nordic Timber Oy")
      throw new Error(`the Saved view shows ${(await rows()).join()}`);
    // Saved views are each person's own.
    const other = await (
      await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    ).newPage();
    await signInAs(other, base, "sales");
    await open(other, `${base}/customers?view=saved`);
    await other
      .getByText("No saved customers yet: the heart on one saves it.")
      .waitFor({ timeout: 10000 });
    await page
      .getByRole("button", { name: "Open Nordic Timber Oy" })
      .or(page.getByRole("button", { name: "Nordic Timber Oy", exact: true }))
      .first()
      .click();
    await page.waitForURL(/\/customers\/\d+$/);
    if ((await heart.getAttribute("aria-pressed")) !== "true")
      throw new Error("the record page does not show the customer saved");
    await heart.click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Save Nordic Timber Oy"]')
          ?.getAttribute("aria-pressed") === "false",
    );
    await open(page, `${base}/customers?view=saved`);
    await page
      .getByText("No saved customers yet: the heart on one saves it.")
      .waitFor({ timeout: 10000 });
    console.log(
      "  ✓ browser: a heart saves a customer; the Saved view and the record page show it, another person's Saved view does not, and unsaving empties it",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("favorites flow");
  } finally {
    await browser.close();
  }
}

/**
 * Contact the owner: the admin adds a customer (and so owns it); a sales user writes from its
 * page; the mail reaches the admin with the sender as reply-to, and the page never shows the
 * admin's address.
 */
async function contactFlow(dir, base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const outbox = join(dir, "data", "mail", "outbox");
  try {
    await signInAs(page, base, "admin");
    await open(page, `${base}/customers/new`);
    await page.getByRole("textbox", { name: "Name *" }).fill("Contact Test AB");
    await page.getByRole("button", { name: "Create customer" }).click();
    await page.waitForURL(`${base}/customers`);
    await page
      .getByRole("button", { name: "Contact Test AB" })
      .filter({ visible: true })
      .first()
      .click();
    await page.waitForURL(/\/customers\/\d+$/);
    const address = page.url();
    await signInAs(page, base, "sales");
    await open(page, address);
    const before = existsSync(outbox) ? readdirSync(outbox).length : 0;
    await page.getByRole("textbox", { name: "Message" }).fill("Is the spring order still on?");
    await page.getByRole("button", { name: "Send" }).click();
    await page.getByText("Your message is sent.").waitFor({ timeout: 10000 });
    if ((await page.content()).includes("dev-admin@"))
      throw new Error("the page shows the owner's address");
    const mails = readdirSync(outbox).sort();
    if (mails.length !== before + 1) throw new Error("no mail was sent");
    // Mail bodies are quoted-printable: soft line breaks joined, so the text reads whole.
    const mail = readFileSync(join(outbox, mails.at(-1)), "utf8").replace(/=\r?\n/g, "");
    for (const part of [
      /^To: dev-admin@/m,
      /^Reply-To: .*dev-sales@/m,
      /Contact Test AB/,
      /Is the spring order still on\?/,
      // The record's own address, once (not "customers//10").
      /[^/]\/customers\/\d+$/m,
    ])
      if (!part.test(mail)) throw new Error(`the mail lacks ${part}:\n${mail.slice(0, 600)}`);
    console.log(
      "  ✓ browser: a sales user writes to a customer's owner from its page; the mail reaches the owner with the sender as reply-to, and the owner's address is never shown",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("contact flow");
  } finally {
    await browser.close();
  }
}

/**
 * The marketplace starter (marketplace.md §4): a visitor starts on the catalog in the site's
 * frame, searches from the landing page's box, filters by category and price and sorts by price
 * in the address, and is asked to sign in by a heart; a member sells an item and sees only it
 * under My items, saves and unsaves another; an admin writes to the seller, and the mail reaches
 * the seller's outbox with the admin as reply-to.
 */
async function marketplaceFlow(dir, base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const outbox = join(dir, "data", "mail", "outbox");
  const titles = async () =>
    (await page.locator('[data-part="row"]').filter({ visible: true }).allInnerTexts()).map((t) =>
      t.split("\n")[0].trim(),
    );
  try {
    await open(page, `${base}/welcome`);
    await page.getByRole("searchbox", { name: "Search items" }).fill("bike");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForURL(/\/\?q=bike/);
    if (await page.locator('[data-kit="app-shell"]').count())
      throw new Error("a visitor sees the catalog in the app's frame");
    await page.getByText("City bike, seven gears").first().waitFor({ timeout: 10000 });
    await open(page, `${base}/?category=bikes&price=100..400&sort=-price`);
    const shown = await titles();
    if (shown.join() !== "Road bike, 56 cm frame,City bike, seven gears")
      throw new Error(`bikes from 100 to 400, dearest first, show ${shown.join()}`);
    await page
      .getByRole("button", { name: "Save Road bike, 56 cm frame" })
      .filter({ visible: true })
      .click();
    await page.waitForURL(/\/sign-in\?redirect=/);
    console.log(
      "  ✓ browser: a visitor starts on the catalog in the site's frame, searches from the landing page, filters and sorts in the address, and a heart asks them to sign in",
    );
    // A visitor who may only read gets the item as a page, not a disabled form.
    await open(page, `${base}/1`);
    const record = page.locator('[data-kit="model-form"]');
    await record.locator('[data-part="pictures"] img').first().waitFor({ timeout: 10000 });
    const controls = await record
      .locator("input, textarea, select, button:not([type=button])")
      .count();
    if (controls) throw new Error(`a visitor's item page has ${controls} form controls`);
    if (await page.getByRole("button", { name: /Remove|Add pictures/ }).count())
      throw new Error("a visitor's item page offers to change its pictures");
    console.log("  ✓ browser: a visitor sees an item's pictures and texts, without form controls");

    await signInAs(page, base, "member");
    await open(page, `${base}/new`);
    await page.getByRole("textbox", { name: "Title *" }).fill("Test lamp");
    await page.getByRole("textbox", { name: "Description *" }).fill("A lamp for the test.");
    await page.getByRole("button", { name: "Create item" }).click();
    await page.waitForURL(`${base}/`);
    await open(page, `${base}/my-items`);
    if ((await titles()).join() !== "Test lamp")
      throw new Error(`My items shows ${(await titles()).join()}`);
    await open(page, `${base}/`);
    await page.getByRole("button", { name: "Save Turntable" }).filter({ visible: true }).click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('[aria-label="Save Turntable"]')].some(
        (b) => b.getAttribute("aria-pressed") === "true",
      ),
    );
    await open(page, `${base}/saved`);
    if ((await titles()).join() !== "Turntable")
      throw new Error(`Saved shows ${(await titles()).join()}`);
    await page.getByRole("button", { name: "Save Turntable" }).filter({ visible: true }).click();
    await page.getByText("No saved items yet.").waitFor({ timeout: 10000 });
    console.log(
      "  ✓ browser: a member sells an item and sees only it under My items, and saves and unsaves another",
    );

    await signInAs(page, base, "admin");
    await open(page, `${base}/?q=Test%20lamp`);
    await page.getByRole("button", { name: "Test lamp" }).filter({ visible: true }).first().click();
    await page.waitForURL(/\/\d+$/);
    const before = existsSync(outbox) ? readdirSync(outbox).length : 0;
    await page.getByRole("textbox", { name: "Message" }).fill("Is the lamp still for sale?");
    await page.getByRole("button", { name: "Send" }).click();
    await page.getByText("Your message is sent.").waitFor({ timeout: 10000 });
    const mails = readdirSync(outbox).sort();
    if (mails.length !== before + 1) throw new Error("no mail was sent");
    const mail = readFileSync(join(outbox, mails.at(-1)), "utf8").replace(/=\r?\n/g, "");
    for (const part of [/^To: dev-member@/m, /^Reply-To: .*dev-admin@/m, /Test lamp/])
      if (!part.test(mail)) throw new Error(`the mail lacks ${part}:\n${mail.slice(0, 600)}`);
    console.log(
      "  ✓ browser: an admin writes to an item's seller, and the mail reaches the seller",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("marketplace flow");
  } finally {
    await browser.close();
  }
}

/**
 * The status starter: a visitor sees the services with their state, the recent incidents and
 * the history, without signing in; staff resolve an incident with its action, and the public
 * page shows the incident resolved and its service working again.
 */
async function statusFlow(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await open(page, `${base}/`);
    const services = page.locator('[data-section="services"]');
    await services.getByText("Payments", { exact: true }).waitFor({ timeout: 10000 });
    await services.getByText("Degraded").waitFor();
    // The starter's own section (src/custom/sections/Uptime.tsx): 90 days of each service.
    await page
      .locator('[data-section="uptime"]')
      .getByRole("img", { name: /^Payments: \d+\.\d\d% up over the last 90 days$/ })
      .waitFor({ timeout: 10000 });
    // What is still going on, apart from what was resolved.
    await page
      .locator('[data-section="open"]')
      .getByText("Card payments slow at checkout")
      .waitFor();
    await page
      .locator('[data-section="recent"]')
      .getByText("Website unreachable for twenty minutes")
      .waitFor();
    await open(page, `${base}/history`);
    await page.getByRole("link", { name: "Website unreachable for twenty minutes" }).click();
    await page.getByText("A certificate renewal failed").first().waitFor({ timeout: 10000 });
    console.log(
      "  ✓ browser: a visitor sees the services with their state and 90 days of uptime (the starter's own section), what is going on now, what was resolved and an incident's story, without signing in",
    );

    await signInAs(page, base, "admin");
    await open(page, `${base}/incidents`);
    // A standard action: the row's button resolves it and adds an update saying so.
    const card = page.locator("tr", { hasText: "Card payments slow at checkout" });
    await card.getByRole("button", { name: "Resolve" }).click();
    await card.getByText("Resolved").waitFor({ timeout: 10000 });
    // Signed out again, the public page shows it.
    await page.context().clearCookies();
    await open(page, `${base}/`);
    // Resolved, it leaves "going on now" for "recently resolved".
    await page
      .locator('[data-section="recent"]')
      .getByText("Card payments slow at checkout")
      .waitFor({ timeout: 10000 });
    if (
      await page
        .locator('[data-section="open"]')
        .getByText("Card payments slow at checkout")
        .count()
    )
      throw new Error("the resolved incident is still under going on now");
    console.log(
      "  ✓ browser: resolving an incident (its standard action) marks it resolved, on the public page too",
    );

    // The standard action: a button only on the rows it fits; pressed, the record changes.
    await signInAs(page, base, "admin");
    await open(page, `${base}/incidents`);
    const row = page.locator("tr", { hasText: "Card payments slow at checkout" });
    await row.getByRole("button", { name: "Reopen" }).click();
    // It asks for the update's message in a dialog first.
    const dialog = page.getByRole("dialog", { name: "Reopen" });
    await dialog.getByLabel("Message").fill("The errors are back; we are looking again.");
    await dialog.getByRole("button", { name: "Reopen" }).click();
    await row.getByText("Investigating").waitFor({ timeout: 10000 });
    await row.getByRole("button", { name: "Reopen" }).waitFor({ state: "detached" });
    const fits = await page
      .locator("tr", { hasText: "Website unreachable" })
      .getByRole("button", { name: "Reopen" })
      .count();
    if (fits !== 1) throw new Error("the resolved incident has no Reopen button");
    // The update it added, with the message typed, is in the incident's updates.
    await row.getByRole("button", { name: "Card payments slow at checkout" }).click();
    // The newest update, last in the incident's list, carries it (its own page shows the message).
    await page.locator("section", { hasText: "Updates" }).locator("tbody tr").last().click();
    await page.getByText("The errors are back; we are looking again.").waitFor({ timeout: 10000 });
    console.log(
      "  ✓ browser: a standard action's button is on the rows it fits; it asks for a message, reopens the incident and adds the update",
    );

    // Chosen rows (actions.md §9): two selected, the action runs on the one it fits.
    await open(page, `${base}/incidents`);
    for (const title of [
      "Card payments slow at checkout",
      "Website unreachable for twenty minutes",
    ])
      await page.locator("tr", { hasText: title }).getByRole("checkbox").check();
    const bar = page.locator('[data-kit="selection-bar"]');
    await bar.getByText("2 selected").waitFor();
    await bar.getByRole("button", { name: "Resolve (1)" }).click();
    await bar.getByText("Resolve: 1 incident changed, 1 skipped.").waitFor({ timeout: 10000 });
    await page
      .locator("tr", { hasText: "Card payments slow at checkout" })
      .getByText("Resolved")
      .waitFor({ timeout: 10000 });
    if (await page.locator("tbody").getByRole("checkbox", { checked: true }).count())
      throw new Error("the selection was not cleared after the run");
    console.log(
      "  ✓ browser: two rows selected, Resolve (1) resolves the one it fits and skips the other",
    );

    // Keys for the API, on the team page: made with a name and a role, shown once, revoked.
    await open(page, `${base}/team`);
    const keys = page.locator('[data-kit="keys"]');
    await keys.getByLabel("What it is for").fill("Uptime monitor");
    await keys.getByRole("button", { name: "Make a key" }).click();
    const shown = await keys.locator('[data-part="key"]').textContent({ timeout: 10000 });
    if (!/^smk_[A-Za-z0-9_-]{20,}$/.test(shown ?? "")) throw new Error(`the key shown is ${shown}`);
    const keyRow = keys.locator('[data-part="key-row"]', { hasText: "Uptime monitor" });
    await keyRow.getByText(`${shown?.slice(0, 10)}…`).waitFor();
    // "Using a key": a call to copy with the key filled in, which works as copied, and the lines
    // an assistant needs.
    const using = keys.locator('[data-part="using-a-key"]').first();
    const call = (await using.locator("pre").first().textContent()) ?? "";
    const [, header, url] = /^curl -H "([^"]+)" (\S+)$/.exec(call) ?? [];
    if (header !== `Authorization: Bearer ${shown}` || !url?.endsWith("/api/v1/components"))
      throw new Error(`the call to copy is ${call}`);
    if ((await fetch(url, { headers: { authorization: header.split(": ")[1] } })).status !== 200)
      throw new Error("the call to copy does not work");
    const tools = (await using.locator("pre").nth(1).textContent()) ?? "";
    if (!tools.includes(`"url": "${base}/mcp"`) || !tools.includes(`Bearer ${shown}`))
      throw new Error(`the assistant's lines are ${tools}`);
    // The API with that key: what the auth file offers, as the key's role may.
    const api = (path, init = {}) =>
      fetch(`${base}/api/v1${path}`, {
        ...init,
        headers: { authorization: `Bearer ${shown}`, "content-type": "application/json" },
      });
    // Without a key a program is a visitor (api-only.md §3.4): it reads what anyone may read,
    // and is refused the rest; a key that is not valid is refused, never taken for a visitor.
    const visitorList = await fetch(`${base}/api/v1/incidents`);
    if (visitorList.status !== 200 || !(await visitorList.json()).items?.length)
      throw new Error(`a visitor could not read the public incidents (${visitorList.status})`);
    const keyless = await fetch(`${base}/api/v1/incidents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Not mine to add" }),
    });
    if (keyless.status !== 401)
      throw new Error(`a visitor could add an incident (${keyless.status})`);
    // Writes without a key are held to a visitor's limit, 10 a minute per address.
    let held = 0;
    for (let n = 2; n <= 11 && !held; n++) {
      const tried = await fetch(`${base}/api/v1/incidents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (tried.status === 429) held = n;
    }
    if (held !== 11)
      throw new Error(`the eleventh keyless write was not held (${held || "never"})`);
    const wrong = await fetch(`${base}/api/v1/incidents`, {
      headers: { authorization: "Bearer smk_not_a_key" },
    });
    if (wrong.status !== 401)
      throw new Error(`a wrong key was taken for a visitor (${wrong.status})`);
    const strangerSees = await (await fetch(`${base}/api/v1/openapi.json`)).json();
    if (
      !strangerSees.paths?.["/api/v1/incidents"]?.get ||
      strangerSees.paths["/api/v1/incidents"].post ||
      Object.keys(strangerSees.paths).some((p) => p.includes("/actions/"))
    )
      throw new Error("the description shows a stranger more than reading");
    // Signed in, the users page's download is the whole description, what a key reaches.
    const downloaded = await (await page.request.get(`${base}/api/v1/openapi.json`)).json();
    if (!downloaded.paths?.["/api/v1/incidents/{id}/actions/resolve"])
      throw new Error("the signed-in download is not the whole description");
    const listed = await api("/incidents");
    const listing = await listed.json();
    if (listed.status !== 200 || !listing.items?.length || !listing.items[0].title)
      throw new Error(
        `listing incidents gave ${listed.status} ${JSON.stringify(listing).slice(0, 200)}`,
      );
    const added = await api("/incidents", {
      method: "POST",
      body: JSON.stringify({
        title: "Search is slow",
        status: "investigating",
        detectedAt: new Date().toISOString(),
      }),
    });
    const incident = await added.json();
    if (added.status !== 201 || !incident.id)
      throw new Error(`adding gave ${added.status} ${JSON.stringify(incident)}`);
    const resolved = await (
      await api(`/incidents/${incident.id}/actions/resolve`, { method: "POST" })
    ).json();
    if (resolved.status !== "resolved")
      throw new Error(`resolving gave ${JSON.stringify(resolved)}`);
    // The incident's history names the key that added and resolved it, not a person.
    await open(page, `${base}/incidents/${incident.id}`);
    await page
      .locator('[data-kit="activity-log"]')
      .getByText('key "Uptime monitor"')
      .first()
      .waitFor({ timeout: 10000 });
    await open(page, `${base}/team`);
    if ((await api("/maintenances")).status !== 404)
      throw new Error("a model not offered answered");
    // A record lists no list of related records (they are reached from their own route).
    const component = (await (await api("/components")).json()).items[0];
    if ("incidents" in component) throw new Error("a component lists its incidents as a field");
    // The same as tools for an AI assistant, with the same key.
    const rpc = async (method, params) => {
      const answer = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: { authorization: `Bearer ${shown}`, "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      return (await answer.json()).result;
    };
    const started = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    if (!started?.capabilities?.tools)
      throw new Error(`initialize gave ${JSON.stringify(started)}`);
    const names = (await rpc("tools/list", {})).tools.map((tool) => tool.name);
    if (
      !names.includes("find_incidents") ||
      !names.includes("resolve") ||
      names.some((n) => n.startsWith("delete_"))
    )
      throw new Error(`the tools are ${names.join(", ")}`);
    const found = await rpc("tools/call", { name: "find_incidents", arguments: {} });
    if (found.isError || !found.structuredContent?.items?.length)
      throw new Error(`find_incidents gave ${JSON.stringify(found)}`);
    const refused = await rpc("tools/call", { name: "delete_incident", arguments: { id: 1 } });
    if (!refused.isError) throw new Error("a delete tool answered");
    // An assistant without a key is a visitor too: finding and reading what anyone may read.
    const strangerTools = await (
      await fetch(`${base}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      })
    ).json();
    const offered = strangerTools.result.tools.map((tool) => tool.name).sort();
    if (offered.join() !== "find_components,find_incidents,read_component,read_incident")
      throw new Error(`a stranger's tools are ${offered.join(", ")}`);
    // One message per request: a batch would run many calls for one count of the limit.
    const batch = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { authorization: `Bearer ${shown}`, "content-type": "application/json" },
      body: JSON.stringify([{ jsonrpc: "2.0", id: 1, method: "ping" }]),
    });
    if (batch.status !== 400) throw new Error(`a batch was answered with ${batch.status}`);
    const described = await (
      await fetch(`${base}/api/v1/openapi.json`, { headers: { authorization: `Bearer ${shown}` } })
    ).json();
    if (!described.paths?.["/api/v1/incidents/{id}/actions/resolve"])
      throw new Error("the description lacks resolve");
    page.once("dialog", (d) => d.accept());
    await keyRow.getByRole("button", { name: "Revoke" }).click();
    await keyRow.getByText(/^Revoked/).waitFor({ timeout: 10000 });
    if ((await api("/incidents")).status !== 401) throw new Error("a revoked key still answers");
    console.log(
      "  ✓ browser: an admin makes an API key on the team page and gets a call to copy that works and an assistant's lines; with it a program lists and adds incidents and resolves one, a model not offered is not there, the description says what is, and an assistant finds incidents through /mcp (no delete tool); without a key a program or assistant reads only what anyone may, is refused the rest and held to ten writes a minute; revoked, it stops",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("status flow");
  } finally {
    await browser.close();
  }
}

/**
 * Several pictures (a post's gallery, added by an operation): an admin adds two at once,
 * describes them and moves the second first; they are served in that order, the first as the
 * cover; removing one deletes its file and keeps the other.
 */
async function picturesFlow(dir, base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const uploads = join(dir, "data", "uploads", "post");
  try {
    await signInAs(page, base, "admin");
    const none = await page.request.get(`${base}/files/post/1/gallery/0`);
    if (none.status() !== 404)
      throw new Error(`a post without pictures served one (${none.status()})`);
    await open(page, `${base}/posts/1`);
    const before = new Set(readdirSync(uploads));
    // A click before the page's scripts are ready opens nothing: try again, a few times.
    let chooser;
    for (let attempt = 1; !chooser; attempt++) {
      const opened = page.waitForEvent("filechooser", { timeout: 5000 });
      await page.getByRole("button", { name: "Choose pictures" }).click();
      chooser = await opened.catch((error) => {
        if (attempt === 5) throw error;
      });
    }
    await chooser.setFiles([
      join(dir, "public", "images", "hero.webp"),
      join(dir, "public", "images", "gallery", "coast.webp"),
    ]);
    await page.locator('[data-part="picture"]').nth(1).waitFor({ timeout: 20000 });
    await page.getByLabel("Description of picture 1").fill("The studio");
    await page.getByLabel("Description of picture 2").fill("The coast");
    await page.getByRole("button", { name: "Move picture 2 earlier" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(/\/posts$/);
    await open(page, `${base}/posts/1`);
    if ((await page.getByLabel("Description of picture 1").inputValue()) !== "The coast")
      throw new Error("the moved picture is not the cover");
    const served = await Promise.all(
      [0, 1, 2].map((n) =>
        page.request.get(`${base}/files/post/1/gallery/${n}`).then((r) => r.status()),
      ),
    );
    if (served.join() !== "200,200,404") throw new Error(`the pictures answered ${served.join()}`);
    if (readdirSync(uploads).filter((f) => !before.has(f)).length !== 2)
      throw new Error("the two pictures were not both stored");
    await page.getByRole("button", { name: "Remove picture 2" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(/\/posts$/);
    if (readdirSync(uploads).length !== before.size + 1)
      throw new Error("the removed picture's file was not deleted");
    console.log(
      "  ✓ browser: several pictures are added at once, described, reordered (the first is the cover) and served in order; removing one deletes its file",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("pictures flow");
  } finally {
    await browser.close();
  }
}

/**
 * A picture field (an instructor's portrait): the seeded portrait shows in the list and is
 * served as WebP; an admin replaces it from a file (scaled and encoded in the browser, checked
 * on the server), the new one is kept and the old file is gone; a visitor sees a public
 * instructor's portrait but cannot upload; a picture that is not one is refused.
 */
async function pictureFlow(dir, base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const uploads = join(dir, "data", "uploads", "instructor");
  try {
    const seeded = await page.request.get(`${base}/files/instructor/1/portrait`);
    if (!seeded.ok() || seeded.headers()["content-type"] !== "image/webp")
      throw new Error(`the seeded portrait is not served (${seeded.status()})`);
    const refused = await page.request.post(`${base}/files/instructor/portrait`, {
      headers: { "content-type": "image/webp" },
      data: Buffer.from("not a picture"),
    });
    if (refused.status() !== 401) throw new Error(`a visitor could upload (${refused.status()})`);
    await signInAs(page, base, "admin");
    const junk = await page.request.post(`${base}/files/instructor/portrait`, {
      headers: { "content-type": "image/webp" },
      data: Buffer.from("not a picture"),
    });
    if (junk.status() !== 400) throw new Error(`junk was stored (${junk.status()})`);
    await open(page, `${base}/instructors`);
    // The list is a table on a wide screen and cards on a phone: both carry the picture.
    await page
      .locator('img[src="/files/instructor/1/portrait"]:visible')
      .waitFor({ timeout: 10000 });
    await open(page, `${base}/instructors/1`);
    const before = new Set(readdirSync(uploads));
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Replace" }).click();
    await (await chooser).setFiles(join(dir, "public", "images", "hero.webp"));
    // Uploaded: the form shows the browser's copy of the new picture.
    await page.locator('img[src^="blob:"]').waitFor({ timeout: 15000 });
    await page.getByLabel("Description (for those who cannot see it)").fill("Emma at the studio");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(/\/instructors$/);
    await open(page, `${base}/instructors/1`);
    await page.getByRole("img", { name: "Emma at the studio" }).waitFor({ timeout: 10000 });
    // The new file is kept and the old one, no other record's, is gone; the new one goes when
    // removed.
    const after = readdirSync(uploads);
    if (!after.some((f) => !before.has(f))) throw new Error("the new file was not kept");
    if (after.length !== before.size) throw new Error("the replaced file was not deleted");
    await page.getByRole("button", { name: "Remove" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(/\/instructors$/);
    if (readdirSync(uploads).length !== before.size - 1)
      throw new Error("the removed file was not deleted");
    console.log(
      "  ✓ browser: a portrait is served from its record, replaced from a file (scaled in the browser, checked on the server) and removed with its file; visitors and junk are refused",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("picture flow");
  } finally {
    await browser.close();
  }
}

/**
 * A Markdown field (an instructor's bio): written, previewed formatted with headings from h2
 * and raw HTML shown as text, saved and kept.
 */
async function markdownFlow(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await signInAs(page, base, "admin");
    await open(page, `${base}/instructors/1`);
    const bio = page.getByLabel("Bio");
    await bio.fill(
      "# Teaching since 2010\n\nShe teaches **Yin** and <b>Hatha</b>.\n\n- Mornings\n- Weekends",
    );
    await page.getByRole("button", { name: "Preview" }).click();
    await page
      .getByRole("heading", { level: 2, name: "Teaching since 2010" })
      .waitFor({ timeout: 10000 });
    await page.locator("strong", { hasText: "Yin" }).waitFor();
    await page.getByText("<b>Hatha</b>", { exact: false }).waitFor();
    if (await page.locator("main b").count()) throw new Error("raw HTML was run");
    await page.getByRole("button", { name: "Write" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(/\/instructors$/);
    await open(page, `${base}/instructors/1`);
    if (!(await page.getByLabel("Bio").inputValue()).startsWith("# Teaching since 2010"))
      throw new Error("the bio was not kept");
    console.log(
      "  ✓ browser: a Markdown bio is written, previewed formatted (headings from h2, raw HTML as text), saved and kept",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("markdown flow");
  } finally {
    await browser.close();
  }
}

/**
 * Articles (docs/design/articles.md): visitors see the published ones, in the list, as the home
 * page's cards and on their own page with head tags; a draft is not found; an admin's new
 * article gets its address from its title.
 */
async function articlesFlow(dir, base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    write(
      dir,
      "UPDATE posts SET status = 'draft'; " +
        "UPDATE posts SET status = 'published', title = 'Morning practice', address = 'morning-practice', published_on = '2026-09-01' WHERE id = 1; " +
        "UPDATE posts SET title = 'Secret plans', address = 'secret-plans' WHERE id = 2;",
    );
    await open(page, `${base}/blog`);
    await page.getByRole("link", { name: "Morning practice" }).waitFor({ timeout: 10000 });
    if (await page.getByText("Secret plans").count()) throw new Error("a draft is listed");
    await page.getByRole("link", { name: "Morning practice" }).click();
    await page
      .getByRole("heading", { level: 1, name: "Morning practice" })
      .waitFor({ timeout: 10000 });
    if (
      (await page.locator('meta[property="og:title"]').getAttribute("content")) !==
      "Morning practice"
    )
      throw new Error("no og:title");
    const draft = await fetch(`${base}/blog/secret-plans`);
    if (draft.status !== 404 && !(await draft.text()).includes("does not exist"))
      throw new Error(`a draft opens: ${draft.status}`);
    await open(page, `${base}/`);
    await page.getByRole("link", { name: "Morning practice" }).first().waitFor({ timeout: 10000 });
    if (await page.getByText("Secret plans").count())
      throw new Error("a draft is a card on the home page");
    // An admin writes one: its address is made from its title.
    await signInAs(page, base, "admin");
    await open(page, `${base}/posts/new`);
    await page.getByLabel("Title").fill("Yin for beginners");
    await page.getByLabel("Body").fill("Slow and **deep**.");
    await page.getByLabel("Status").selectOption("published");
    await page.getByRole("button", { name: "Create post" }).click();
    await page.waitForURL(/\/posts$/);
    await open(page, `${base}/blog/yin-for-beginners`);
    await page
      .getByRole("heading", { level: 1, name: "Yin for beginners" })
      .waitFor({ timeout: 10000 });
    await page.locator("strong", { hasText: "deep" }).waitFor();
    console.log(
      "  ✓ browser: visitors see only published articles (list, home cards, article with head tags; a draft is not found); a new article's address comes from its title",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("articles flow");
  } finally {
    await browser.close();
  }
}

/** A calculator on the landing page: its results follow the inputs as they are typed. */
async function calculatorFlow(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await open(page, `${base}/`);
    const calculator = page.locator('[data-kit="calculator"]');
    await calculator.getByLabel("Classes a month").fill("10");
    // 10 classes at €16 is €160; the €99 pass saves €61.
    await calculator.getByText("€160.00").waitFor({ timeout: 10000 });
    await calculator.getByText("€61.00").waitFor({ timeout: 10000 });
    console.log(
      "  ✓ browser: the landing page's calculator works its results out as a visitor types",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("calculator flow");
  } finally {
    await browser.close();
  }
}

async function landingFlow(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await open(page, base);
    // The cover hero's shortcuts: round links to the schedule and the blog over its edge.
    const shortcuts = page.getByRole("navigation", { name: "Shortcuts" });
    await shortcuts.getByRole("link", { name: "Blog" }).waitFor({ timeout: 5000 });
    await shortcuts.getByRole("link", { name: "Schedule" }).click();
    await page.waitForURL(`${base}/schedule`);
    console.log("  ✓ browser: the hero's shortcuts lead to their pages");
    // Classes have no picture field: their cards stay text cards, with no placeholder.
    await open(page, base);
    await page
      .locator('[data-section="classes"]')
      .getByText("Foundations")
      .first()
      .waitFor({ timeout: 5000 });
    if (await page.locator('[data-section="classes"] [data-part="placeholder"]').count())
      throw new Error("cards of a model without pictures show placeholders");
    console.log("  ✓ browser: cards of a model without pictures stay text cards");
    // The site's frame: the public pages as a menu (a button on a phone), contact details below.
    await page
      .getByRole("banner")
      .getByRole("navigation", { name: "Site" })
      .getByRole("link", { name: "Blog" })
      .waitFor({ timeout: 5000 });
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "+358 18 123 456" })
      .waitFor({ timeout: 5000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Menu" }).click();
    await page.locator("#site-menu").getByRole("link", { name: "Blog" }).click();
    await page.waitForURL(`${base}/blog`);
    await page.setViewportSize({ width: 1280, height: 720 });
    console.log(
      "  ✓ browser: the site's header lists its public pages (a menu button on a phone); the footer has its contact details",
    );
    await open(page, base);
    await page.getByRole("button", { name: /^Open A rolled-up yoga mat/ }).click();
    const lightbox = page.getByRole("dialog");
    await lightbox.getByRole("img", { name: /yoga mat/ }).waitFor({ timeout: 5000 });
    await page.keyboard.press("ArrowRight");
    await lightbox.getByRole("img", { name: /Three people stretching/ }).waitFor({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await lightbox.waitFor({ state: "hidden", timeout: 5000 });
    console.log(
      "  ✓ browser: a gallery picture opens large; the arrow keys move on, Escape closes",
    );

    await page.getByRole("textbox", { name: "Name *" }).fill("Aino Visitor");
    await page.getByRole("textbox", { name: "Email *" }).fill("aino@example.com");
    await page.getByRole("textbox", { name: "Message *" }).fill("Do you have classes in Swedish?");
    await page.getByRole("button", { name: "Send message" }).click();
    await page
      .getByText("Thank you! We will get back to you within a day.")
      .waitFor({ timeout: 10000 });
    await signInAs(page, base, "admin");
    await open(page, `${base}/messages`);
    await page.getByRole("cell", { name: "Aino Visitor", exact: true }).waitFor({ timeout: 10000 });
    console.log(
      "  ✓ browser: a visitor sends the contact form without an account; an admin reads it",
    );
    // The data page: the admin finds the message there too, opens it and deletes it.
    await open(page, `${base}/admin`);
    await page
      .getByRole("main")
      .getByRole("link", { name: /^Messages/ })
      .click();
    await page.waitForURL(/\/admin\/messages\/?$/);
    await page.getByRole("cell", { name: "Aino Visitor", exact: true }).click();
    await page.waitForURL(/\/admin\/messages\/\d+$/);
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Delete message" }).click();
    await page.waitForURL(/\/admin\/messages\/?$/);
    await page
      .getByRole("cell", { name: "Aino Visitor", exact: true })
      .waitFor({ state: "detached", timeout: 10000 });
    // Activity: the visitor's message and the admin's delete are in the audit log; the deleted
    // message keeps its name on its delete line until it is forgotten in the log.
    await open(page, `${base}/admin/activity?model=Message`);
    const deleted = page.locator('[data-part="line"]', { hasText: "deleted" }).first();
    await deleted.getByText('Message "Aino Visitor" (deleted)').waitFor({ timeout: 10000 });
    await page.locator('[data-part="line"]', { hasText: "visitor" }).first().waitFor();
    await deleted.getByRole("button", { name: "Forget in the log" }).click();
    await page
      .locator('[data-part="line"]', { hasText: "deleted" })
      .first()
      .getByText(/a deleted message \(#\d+\)/)
      .waitFor({ timeout: 10000 });
    if (await page.getByText("Aino Visitor").count())
      throw new Error("the forgotten name is still in the activity");
    // Signing out is in the log (only a sign-out request, not a session that expired).
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await page.waitForURL((url) => !url.pathname.startsWith("/admin"), { timeout: 10000 });
    await signInAs(page, base, "admin");
    await open(page, `${base}/admin/activity?action=signed%20out`);
    await page
      .locator('[data-part="line"]', { hasText: "signed out" })
      .first()
      .waitFor({ timeout: 10000 });
    // A member may not open it.
    await signInAs(page, base, "member");
    await open(page, `${base}/admin`);
    await page.getByText("You are not allowed to do this.").waitFor({ timeout: 10000 });
    console.log(
      "  ✓ browser: the data page lists every model; an admin opens a message and deletes it, sees it in Activity and forgets it in the log, and signing out is there too; a member is refused",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("booking landing flow");
  } finally {
    await browser.close();
  }
}

/** A copy: Duplicate asks for the new invoice's number and opens the copy, with the lines. */
async function copyFlow(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await signInAs(page, base, "admin");
    await open(page, `${base}/invoices`);
    const first = page.locator("tbody tr").first();
    await first.getByRole("button", { name: "Duplicate" }).waitFor();
    await first.getByRole("button", { name: "Duplicate" }).click();
    const dialog = page.getByRole("dialog", { name: "Duplicate" });
    await dialog.getByLabel("Number").fill("COPY-900");
    await dialog.getByRole("button", { name: "Duplicate" }).click();
    // The copy's own page, with its number and the lines that came along.
    await page.waitForURL(/\/invoices\/\d+$/);
    await page
      .getByLabel("Number")
      .and(page.locator('[value="COPY-900"]'))
      .waitFor({ timeout: 10000 });
    await page
      .locator("section", { hasText: "Lines" })
      .locator("tbody tr")
      .first()
      .waitFor({ timeout: 10000 })
      .catch(() => {
        throw new Error("the copy has no lines");
      });
    console.log("  ✓ browser: Duplicate asks for a number and opens the copy, with its lines");

    // An action on a record's own page: the form shows the record as the action left it, so
    // "Save changes" afterwards cannot quietly undo it.
    await open(page, `${base}/invoices`);
    await page.getByRole("cell", { name: "2026-006", exact: true }).click();
    // The list's rows have their own Mark sent until the record's page has replaced it.
    await page.getByRole("heading", { name: "2026-006", exact: true }).waitFor();
    const markSent = page.getByRole("button", { name: "Mark sent" }).filter({ visible: true });
    await markSent.click();
    await markSent.waitFor({ state: "detached", timeout: 10000 });
    for (let i = 0; (await page.getByLabel("Status").inputValue()) !== "sent"; i++) {
      if (i === 50) throw new Error("the form still shows the status from before the action");
      await page.waitForTimeout(100);
    }
    // The record's own history, for administrators: the action, with the field it changed.
    await page
      .locator('[data-kit="activity-log"] [data-part="line"]', { hasText: "mark sent" })
      .getByText("(status)")
      .waitFor({ timeout: 10000 });
    console.log(
      "  ✓ browser: after an action on its page, the record's form shows the new values, and its history the action",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("copy flow");
  } finally {
    await browser.close();
  }
}

/** Formula defaults fill a new invoice; a computed amount follows the inputs live. */
async function formulaFlow(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await signInAs(page, base, "member");
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    await open(page, `${base}/invoices/new`);
    const issued = await page.getByLabel("Issued on *").inputValue();
    const dueOn = await page.getByLabel("Due on *").inputValue();
    if (issued !== today || dueOn !== due) throw new Error(`defaults were ${issued} and ${dueOn}`);
    console.log("  ✓ browser: formula defaults fill a new invoice (today, today + 30 days)");

    await open(page, `${base}/invoice-lines/new`);
    await page.getByRole("textbox", { name: "Quantity *" }).fill("2");
    await page.getByRole("textbox", { name: "Unit price *" }).fill("12.50");
    await page.getByText("€25.00").waitFor({ timeout: 5000 });
    console.log("  ✓ browser: a computed amount follows the inputs live");
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("invoicing formula flow");
  } finally {
    await browser.close();
  }
}

/**
 * Every page, in light and dark, on desktop and on a phone: no accessibility violations
 * (axe-core, WCAG 2 A and AA, including contrast) and no sideways scrolling.
 */
async function visualChecks(dir, base) {
  const axe = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
  const { ir } = validateSpec({
    path: "smithable.yml",
    text: readFileSync(join(dir, "smithable.yml"), "utf8"),
  });
  // A crud page also has its form and a record; landing pages and dashboards are one page.
  const paths = [
    ...ir.pages.flatMap((p) =>
      p.pattern.kind === "crud" ? [p.route, join(p.route, "new"), join(p.route, "1")] : [p.route],
    ),
    "/sign-in",
  ];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const problems = [];
  try {
    if (!readFileSync(join(dir, "smithable.auth.yml"), "utf8").includes("signIn: none"))
      await signInAs(page, base, "admin");
    for (const colorScheme of ["light", "dark"]) {
      for (const [width, height] of [
        [1440, 900],
        [390, 844],
      ]) {
        // Under "reduce motion", so no element is read in the middle of easing in.
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.setViewportSize({ width, height });
        for (const path of paths) {
          await open(page, `${base}${path}`);
          await page.addScriptTag({ path: axe });
          const violations = await page.evaluate(async () => {
            const result = await window.axe.run(document, {
              runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
            });
            return result.violations.map((v) => `${v.id} at ${v.nodes[0]?.target.join(" ")}`);
          });
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          );
          const where = `${path} (${colorScheme}, ${width} px)`;
          for (const v of violations) problems.push(`${where}: ${v}`);
          if (overflow > 1) problems.push(`${where}: scrolls sideways by ${overflow} px`);
        }
      }
    }
    // The theme's motion, and none at all for a visitor who asks for less: the variables the
    // kit's dialogs, drawer, notices, rows and page changes take their durations from.
    for (const reducedMotion of ["no-preference", "reduce"]) {
      await page.emulateMedia({ reducedMotion });
      await open(page, `${base}${paths[0]}`);
      const motion = await page.evaluate(() =>
        ["--motion-fast", "--motion-slow", "--motion-distance"].map((v) =>
          getComputedStyle(document.documentElement).getPropertyValue(v).trim(),
        ),
      );
      const still = motion.every((v) => /^0(ms|px)$/.test(v));
      if (reducedMotion === "reduce" && !still)
        problems.push(`reduce motion: still moves (${motion.join(", ")})`);
      if (reducedMotion === "no-preference" && (still || motion.some((v) => !v)))
        problems.push(`the theme's motion is missing (${motion.join(", ")})`);
    }
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const ok = problems.length === 0;
    console.log(
      `  ${ok ? "✓" : "✗"} visual checks: ${paths.length} pages, light and dark, desktop and phone: no accessibility violations or sideways scrolling; the theme's motion, none under "reduce motion"${ok ? "" : `\n    ${problems.slice(0, 10).join("\n    ")}`}`,
    );
    if (!ok) failures.push("visual checks");
  } finally {
    await browser.close();
  }
}

/** /robots.txt: served as text, refusing all that is not public. */
async function robotsCheck(base) {
  const response = await fetch(`${base}/robots.txt`);
  const text = await response.text();
  const ok =
    response.status === 200 &&
    response.headers.get("content-type")?.startsWith("text/plain") &&
    text.startsWith("User-agent: *\n") &&
    text.endsWith("Disallow: /\n");
  console.log(
    `  ${ok ? "✓" : "✗"} robots.txt: the public pages allowed, the rest refused${ok ? "" : `\n    ${response.status} ${text}`}`,
  );
  if (!ok) failures.push("robots.txt");
}

/** In the invoicing app, a new member is welcomed by the onboarding, then edits it in settings. */
async function onboardingFlow(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await signInAs(page, base, "member");
    await page.waitForURL(`${base}/welcome`);
    await page.getByText("Step 1 of 2").waitFor();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("Required", { exact: true }).waitFor();
    await page.getByRole("textbox", { name: "Business name *" }).fill("Åland Design Studio");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("heading", { name: "Getting paid" }).waitFor();
    await page.getByRole("button", { name: "Back" }).click();
    if (
      (await page.getByRole("textbox", { name: "Business name *" }).inputValue()) !==
      "Åland Design Studio"
    )
      throw new Error("going back lost the business name");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("textbox", { name: "IBAN" }).fill("FI21 1234 5600 0007 85");
    await page.getByRole("button", { name: "Finish" }).click();
    await page.waitForURL(`${base}/overview`);
    console.log(
      "  ✓ browser: a new member is welcomed in two steps, with Back, then lands in the app",
    );

    await open(page, `${base}/welcome`);
    await page.waitForURL(`${base}/overview`);
    await open(page, `${base}/settings`);
    const name = page.getByRole("textbox", { name: "Business name *" });
    if ((await name.inputValue()) !== "Åland Design Studio")
      throw new Error("settings do not show the onboarding's business name");
    await name.fill("Åland Design Studio Ab");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByRole("status").getByText("Saved.").waitFor();
    await open(page, `${base}/settings`);
    if (
      (await page.getByRole("textbox", { name: "Business name *" }).inputValue()) !==
      "Åland Design Studio Ab"
    )
      throw new Error("the settings change was not saved");
    console.log("  ✓ browser: the onboarding is done once; settings edit the same record");
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("invoicing onboarding flow");
  } finally {
    await browser.close();
  }
}

/** In the invoicing app, a member never sees another user's invoices, even by their id. */
async function isolationFlow(dir, base) {
  write(
    dir,
    `insert into user (id, name, email, email_verified, role, created_at, updated_at)
       values ('other-user', 'Other Freelancer', 'other@example.com', 1, 'member', 0, 0);
     insert into clients (name, email, owner_id, created_at, updated_at)
       values ('Other Client', 'client@other.example.com', 'other-user', 0, 0);
     insert into invoices (number, client_id, issued_on, due_on, status, owner_id, created_at, updated_at)
       values ('OTHER-001', last_insert_rowid(), '2026-09-01', '2026-10-01', 'sent', 'other-user', 0, 0);`,
  );
  const [{ id }] = query(dir, "select id from invoices where number = 'OTHER-001'");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await signInAs(page, base, "member");
    await open(page, `${base}/clients/new`);
    await page.getByRole("textbox", { name: "Name *" }).fill("My Client");
    await page.getByRole("textbox", { name: "Email *" }).fill("me@client.example.com");
    await page.getByRole("button", { name: "Create client" }).click();
    await page.waitForURL(`${base}/clients`);
    await page.getByRole("cell", { name: "My Client", exact: true }).waitFor({ timeout: 5000 });
    if (await page.getByText("Other Client").count())
      throw new Error("another user's client is listed");
    await open(page, `${base}/invoices`);
    await page.getByRole("heading", { name: "Invoices" }).waitFor();
    if (await page.getByText("OTHER-001").count())
      throw new Error("another user's invoice is listed");
    await open(page, `${base}/invoices/${id}`);
    await page.getByRole("heading", { name: "Not found" }).waitFor({ timeout: 5000 });
    await open(page, `${base}/invoices/new`);
    const clients = await page.getByLabel("Client *").locator("option").allTextContents();
    if (clients.includes("Other Client")) throw new Error("another user's client can be chosen");
    console.log("  ✓ browser: a member sees only their own clients and invoices, even by id");
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("invoicing isolation flow");
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
  return { code: result.status, out: `${result.stdout}${result.stderr}`, stdout: result.stdout };
}

/** Runs the CLI without blocking, so a stand-in model in this process can answer it. */
function smithableAsync(dir, env, ...args) {
  return new Promise((resolve) => {
    const child = spawn("node", [cli, ...args, "--dir", dir], {
      cwd: repo,
      env: { ...process.env, ...env },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

/** Smithable's own AI (ARCHITECTURE §9): a model proposes, the user confirms, undo reverts. */
async function askFlow(dir) {
  const model = await startFakeModel();
  const local = { SMITHABLE_LOCAL_MODEL: "fake-model", SMITHABLE_LOCAL_URL: model.url };
  try {
    await asyncStep(
      "ask: a model proposes in plain language; nothing changes without confirmation",
      async () => {
        const unconfirmed = await smithableAsync(
          dir,
          local,
          "ask",
          "Customers should have a mobile number",
        );
        if (
          unconfirmed.code === 0 ||
          !unconfirmed.out.includes("Add field mobile (phone) to Customer")
        )
          throw new Error(unconfirmed.out);
        if (!unconfirmed.out.includes("Run again with --yes"))
          throw new Error(`no confirmation asked:\n${unconfirmed.out}`);
        if (readFileSync(join(dir, "smithable.yml"), "utf8").includes("mobile"))
          throw new Error("the spec changed without confirmation");
        // The model got the relevant slice and the operations, with a schema for its answer.
        const sent = model.requests[0];
        if (
          !sent.response_format?.json_schema ||
          !sent.messages[1].content.includes("model:Customer")
        )
          throw new Error("the model was not given the context and the answer's schema");
      },
    );
    await asyncStep(
      "ask --yes applies it through an operation, records the model in the commit, and undo reverts it",
      async () => {
        const applied = await smithableAsync(
          dir,
          local,
          "ask",
          "Customers should have a mobile number",
          "--yes",
        );
        if (applied.code !== 0) throw new Error(applied.out);
        if (!applied.out.includes("Local model (fake-model)")) throw new Error(applied.out);
        if (!readFileSync(join(dir, "smithable.yml"), "utf8").includes("mobile: phone"))
          throw new Error("mobile not in the spec");
        const body = run("git", ["log", "-1", "--format=%B"], dir);
        if (!/Smithable-AI: .*"tier":"local".*"model":"fake-model"/.test(body))
          throw new Error(body);
        const undone = smithable(dir, "undo");
        if (undone.code !== 0) throw new Error(undone.out);
        if (readFileSync(join(dir, "smithable.yml"), "utf8").includes("mobile"))
          throw new Error("undo left mobile in the spec");
      },
    );
    await asyncStep(
      "ask: an unclear request gets a question; custom code is said to be custom code",
      async () => {
        const question = await smithableAsync(dir, local, "ask", "Add a date");
        if (!question.out.includes("A date on what?") || !question.out.includes("- Orders"))
          throw new Error(question.out);
        const none = await smithableAsync(
          dir,
          local,
          "ask",
          "Email the customer when an order ships",
        );
        if (!none.out.includes("No operation can do this: Sending email needs custom code."))
          throw new Error(none.out);
      },
    );
    const coder = {
      ...local,
      SMITHABLE_CODER_COMMAND: `node ${join(repo, "scripts/fake-coder.mjs")}`,
      // It runs on this machine; unsaid, a coder counts as outside the EU.
      SMITHABLE_CODER_LOCATION: "local",
    };
    await asyncStep(
      "code: a coder the AI policy does not allow is refused before it runs",
      async () => {
        const result = await smithableAsync(
          dir,
          { ...coder, SMITHABLE_CODER_LOCATION: "", SMITHABLE_AI_POLICY: "eu-only" },
          "code",
          "action:mergeCustomers",
          "anything",
        );
        if (
          result.code === 0 ||
          !result.out.includes("which the AI policy (eu-only) does not allow")
        )
          throw new Error(result.out);
        if (run("git", ["status", "--porcelain"], dir).trim()) throw new Error("something changed");
      },
    );
    await asyncStep(
      "ask: 'prioritise customers likely to churn on the dashboard' adds a query and a tile, and a coder writes the query in src/custom only",
      async () => {
        const result = await smithableAsync(
          dir,
          coder,
          "ask",
          "Prioritise customers most likely to churn on the dashboard",
          "--yes",
        );
        if (result.code !== 0) throw new Error(result.out);
        const spec = readFileSync(join(dir, "smithable.yml"), "utf8");
        if (!spec.includes("churnRisk:") || !spec.includes("query: churnRisk"))
          throw new Error(`the spec has no query or tile:\n${spec}`);
        const log = run("git", ["log", "-3", "--format=%s"], dir);
        if (!log.startsWith("smithable: Write the code of query:churnRisk")) throw new Error(log);
        const files = run("git", ["show", "--name-only", "--format=", "HEAD"], dir)
          .trim()
          .split("\n");
        if (files.some((f) => !f.startsWith("src/custom/")))
          throw new Error(`the code commit touches more than src/custom: ${files.join(", ")}`);
        if (
          !readFileSync(join(dir, "src/custom/queries/churn-risk.ts"), "utf8").includes(
            "orderData.list",
          )
        )
          throw new Error("the query's code was not written");
      },
    );
    await asyncStep("code: a coder that plants a Git hook is undone, hook and all", async () => {
      const result = await smithableAsync(
        dir,
        { ...coder, FAKE_CODER: "hook" },
        "code",
        "query:churnRisk",
        "rank by the last order",
      );
      if (result.code === 0 || !result.out.includes(".git/hooks/pre-commit"))
        throw new Error(result.out);
      if (run("git", ["status", "--porcelain"], dir).trim())
        throw new Error("changes were left behind");
      if (existsSync(join(dir, ".git/hooks/pre-commit"))) throw new Error("the hook was left");
    });
    await asyncStep("code: a coder that plants a hook and then fails leaves no hook", async () => {
      const result = await smithableAsync(
        dir,
        { ...coder, FAKE_CODER: "hook-fail" },
        "code",
        "query:churnRisk",
        "rank by the last order",
      );
      if (result.code === 0) throw new Error(result.out);
      if (existsSync(join(dir, ".git/hooks/pre-commit"))) throw new Error("the hook was left");
    });
    await asyncStep(
      "code: a coder that edits an installed package is refused before any test runs, and the packages are installed again",
      async () => {
        const pkg = join(dir, "node_modules/zod/package.json");
        const before = readFileSync(pkg, "utf8");
        const result = await smithableAsync(
          dir,
          { ...coder, FAKE_CODER: "package" },
          "code",
          "query:churnRisk",
          "rank by the last order",
        );
        if (result.code === 0 || !/node_modules\/\S*zod/.test(result.out))
          throw new Error(result.out);
        if (result.out.includes("The tests")) throw new Error("the tests ran");
        if (readFileSync(pkg, "utf8") !== before) throw new Error("the package was left changed");
      },
    );
    await asyncStep("code: a coder that edits a generated file is undone entirely", async () => {
      const before = readFileSync(join(dir, "src/custom/queries/churn-risk.ts"), "utf8");
      const result = await smithableAsync(
        dir,
        { ...coder, FAKE_CODER: "trespass" },
        "code",
        "query:churnRisk",
        "rank by the last order",
      );
      if (result.code === 0 || !result.out.includes("src/generated/app.ts"))
        throw new Error(result.out);
      if (run("git", ["status", "--porcelain"], dir).trim())
        throw new Error("changes were left behind");
      if (readFileSync(join(dir, "src/custom/queries/churn-risk.ts"), "utf8") !== before)
        throw new Error("the custom file was left changed");
      // Back to where the flow started: code, tile, query.
      for (let i = 0; i < 3; i++) {
        const undone = smithable(dir, "undo");
        if (undone.code !== 0) throw new Error(undone.out);
      }
    });
    await asyncStep("ask: the policy decides which models may see the project", async () => {
      const asked = model.requests.length;
      const refused = await smithableAsync(
        dir,
        {
          SMITHABLE_MODEL: "fake-model",
          SMITHABLE_MODEL_URL: model.url,
          SMITHABLE_MODEL_LOCATION: "elsewhere",
          SMITHABLE_AI_POLICY: "eu-only",
        },
        "ask",
        "Customers should have a mobile number",
      );
      if (refused.code === 0 || !refused.out.includes("No model is available under the AI policy"))
        throw new Error(refused.out);
      if (model.requests.length !== asked) throw new Error("a model outside the policy was asked");
    });
  } finally {
    await model.close();
  }
}

/** An agent's view: the MCP server finds the concept and changes the app through an operation. */
async function mcpFlow(dir) {
  await asyncStep(
    "MCP: context finds Customer, add_field adds the field, the app type-checks, undo reverts it",
    async () => {
      const client = new Client({ name: "test-apps", version: "0" });
      await client.connect(
        new StdioClientTransport({
          command: "node",
          args: [cli, "mcp", "--dir", dir],
          stderr: "ignore",
        }),
      );
      try {
        const call = async (name, args) => {
          const result = await client.callTool({ name, arguments: args });
          if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
          return result.content[0].text;
        };
        const { tools } = await client.listTools();
        if (!tools.some((t) => t.name === "smithable_add_field"))
          throw new Error("no smithable_add_field");
        const context = await call("smithable_context", {
          request: "Customers should have a LinkedIn page",
        });
        if (!context.includes("- model:Customer:")) throw new Error(context);
        const added = await call("smithable_add_field", {
          model: "Customer",
          field: "linkedin",
          type: "url",
        });
        if (!added.includes("No custom code is affected.")) throw new Error(added);
        if (!readFileSync(join(dir, "smithable.yml"), "utf8").includes("      linkedin: url\n"))
          throw new Error("not in the spec");
        run("pnpm", ["typecheck"], dir);
        await call("smithable_undo", {});
        if (readFileSync(join(dir, "smithable.yml"), "utf8").includes("linkedin"))
          throw new Error("undo kept the field");
      } finally {
        await client.close();
      }
      const log = readFileSync(join(dir, "data/.smithable/token-log.jsonl"), "utf8");
      if (!log.includes('"tool":"smithable_add_field"')) throw new Error("token use not recorded");
    },
  );
}

/** M3: operations change spec, code, migrations and data; undo restores both; drift is refused. */
function operationsFlow(dir) {
  const expectOk = (result) => {
    if (result.code !== 0) throw new Error(result.out);
  };
  step("an operation that fails halfway (a file it cannot write) is rolled back", () => {
    const content = join(dir, "smithable.content.yml");
    chmodSync(content, 0o444);
    try {
      const result = smithable(dir, "op", "setText", "Clients", "pages", "customers", "title");
      if (result.code === 0 || !result.out.includes("stopped halfway")) throw new Error(result.out);
    } finally {
      chmodSync(content, 0o644);
    }
    if (run("git", ["status", "--porcelain"], dir).trim())
      throw new Error("changes were left behind");
  });
  step("snapshots undo can no longer reach are pruned after an operation", () => {
    const folder = join(dir, "data/.smithable/snapshots");
    writeFileSync(join(folder, "19990101-00000000.db"), "");
    expectOk(smithable(dir, "op", "setText", "Clients", "pages", "customers", "title"));
    if (existsSync(join(folder, "19990101-00000000.db")))
      throw new Error("the old snapshot is still there");
    const last = run(
      "git",
      ["log", "-1", "--format=%(trailers:key=Smithable-Snapshot,valueonly)"],
      dir,
    ).trim();
    if (!existsSync(join(folder, `${last}.db`))) throw new Error("the latest snapshot was pruned");
    expectOk(smithable(dir, "undo"));
  });
  step("op addTheme writes themes/<name>.yml, --use applies it, and undo removes the file", () => {
    const file = `${dir}-forest.yml`;
    writeFileSync(
      file,
      'smithableTheme: 0.1\nfont: Nunito Sans\nlight:\n  primary: "#2f6b3a"\n  background: "#f6f8f4"\n  foreground: "#1f2a1f"\ndark:\n  primary: "#8fd19a"\n  background: "#141a14"\n  foreground: "#e6ece4"\n',
    );
    const refused = smithable(
      dir,
      "op",
      "addTheme",
      "forest",
      "--text",
      "smithableTheme: 0.1\nfont: Comic Sans\n",
    );
    if (refused.code === 0 || !refused.out.includes('"font" must be one of'))
      throw new Error(refused.out);
    expectOk(smithable(dir, "op", "addTheme", "forest", "--text", `@${file}`, "--use"));
    if (!existsSync(join(dir, "themes/forest.yml")))
      throw new Error("themes/forest.yml is missing");
    if (!readFileSync(join(dir, "smithable.ux.yml"), "utf8").includes("preset: forest"))
      throw new Error("the ux file does not use the theme");
    if (!readFileSync(join(dir, "src/theme.css"), "utf8").includes("Nunito Sans"))
      throw new Error("theme.css was not regenerated with the theme's font");
    expectOk(smithable(dir, "undo"));
    if (existsSync(join(dir, "themes/forest.yml"))) throw new Error("undo left themes/forest.yml");
    if (run("git", ["status", "--porcelain"], dir).trim()) throw new Error("undo left changes");
  });
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
  step(
    "op renameField on a reference keeps every link, and flags custom code using the old name",
    () => {
      const before = query(dir, "select id, customer_id from orders order by id");
      expectOk(smithable(dir, "op", "renameField", "Order", "customer", "buyer"));
      const after = query(dir, "select id, buyer_id as customer_id from orders order by id");
      if (JSON.stringify(after) !== JSON.stringify(before))
        throw new Error(JSON.stringify({ before, after }));
      const typecheck = spawnSync("pnpm", ["typecheck"], { cwd: dir, encoding: "utf8" });
      if (typecheck.status === 0 || !typecheck.stdout.includes("merge-customers.ts")) {
        throw new Error(`expected the custom code to be flagged:\n${typecheck.stdout}`);
      }
      expectOk(smithable(dir, "undo"));
      run("pnpm", ["typecheck"], dir);
    },
  );
  step("making a field required rebuilds its table and keeps every row and reference", () => {
    const before = query(dir, "select count(*) c from customers")[0].c;
    expectOk(smithable(dir, "op", "changeField", "Customer", "email", "email!", "unique"));
    const [{ n }] = query(
      dir,
      "select \"notnull\" n from pragma_table_info('customers') where name = 'email'",
    );
    const after = query(dir, "select count(*) c from customers")[0].c;
    const orphans = query(
      dir,
      "select count(*) c from orders where customer_id not in (select id from customers)",
    )[0].c;
    if (n !== 1 || after !== before || orphans !== 0)
      throw new Error(JSON.stringify({ n, before, after, orphans }));
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
  step("op setPackage adds a library custom code can use; undo removes it again", () => {
    expectOk(smithable(dir, "op", "setPackage", "dayjs", "1.11.13"));
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    if (pkg.dependencies.dayjs !== "1.11.13") throw new Error(JSON.stringify(pkg.dependencies));
    if (!existsSync(join(dir, "node_modules", "dayjs"))) throw new Error("not installed");
    const custom = join(dir, "src/custom/when.ts");
    writeFileSync(
      custom,
      'import dayjs from "dayjs";\nexport const today = (): string => dayjs().format("YYYY-MM-DD");\n',
    );
    run("pnpm", ["typecheck"], dir);
    rmSync(custom);
    expectOk(smithable(dir, "undo"));
    if (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).dependencies.dayjs)
      throw new Error("undo kept the package");
    // The stack profile's own packages stay Smithable's.
    const refused = smithable(dir, "op", "setPackage", "react", "19.0.0");
    if (refused.code === 0) throw new Error("setPackage react was accepted");
  });
  step("op setAccess changes who may do what; the access tests follow; undo reverts it", () => {
    const data = join(dir, "src/generated/customer.server.ts");
    const salesDelete = 'delete: { public: false, roles: ["admin", "sales"], owner: false }';
    expectOk(smithable(dir, "op", "setAccess", "model:Customer.delete", "admin", "sales"));
    if (!readFileSync(data, "utf8").includes(salesDelete)) throw new Error("rule not regenerated");
    run("pnpm", ["test"], dir);
    expectOk(smithable(dir, "undo"));
    if (readFileSync(data, "utf8").includes(salesDelete)) throw new Error("undo kept the rule");
  });
  step(
    "a page and a landing section of your own: created once as stubs, the app type-checks, and removing them leaves the code",
    () => {
      const page = join(dir, "src/custom/pages/Planner.tsx");
      const section = join(dir, "src/custom/sections/Intro.tsx");
      const start = run("git", ["rev-parse", "HEAD"], dir).trim();
      expectOk(smithable(dir, "op", "addCustomPage", "planner", "Planner"));
      expectOk(smithable(dir, "op", "addLandingPage", "welcome"));
      expectOk(smithable(dir, "op", "addSection", "welcome", "intro", "--custom", "Intro"));
      if (!existsSync(page) || !existsSync(section)) throw new Error("no stubs");
      const route = readFileSync(join(dir, "src/routes/planner/index.tsx"), "utf8");
      if (!route.includes('import { Planner } from "#/custom/pages/Planner"'))
        throw new Error(route);
      writeFileSync(
        page,
        readFileSync(page, "utf8").replace("This page is yours", "Plan the week"),
      );
      run("pnpm", ["typecheck"], dir);
      run("git", ["commit", "-qam", "Write the planner"], dir);
      expectOk(smithable(dir, "op", "removePage", "planner"));
      if (!readFileSync(page, "utf8").includes("Plan the week"))
        throw new Error("the page's code went");
      run("pnpm", ["typecheck"], dir);
      // Back to before: nothing here touched the database.
      run("git", ["reset", "-q", "--hard", start], dir);
    },
  );
  step(
    "changing an action's input breaks its custom code at type-check; regeneration leaves the code alone",
    () => {
      const specFile = join(dir, "smithable.yml");
      const spec = readFileSync(specFile, "utf8");
      const custom = readFileSync(join(dir, "src/custom/actions/merge-customers.ts"), "utf8");
      writeFileSync(specFile, spec.replace("keep: Customer!", "primary: Customer!"));
      run("node", [cli, "generate", dir], repo);
      const typecheck = spawnSync("pnpm", ["typecheck"], { cwd: dir, encoding: "utf8" });
      writeFileSync(specFile, spec);
      run("node", [cli, "generate", dir], repo);
      if (typecheck.status === 0) throw new Error("typecheck passed after the input changed");
      if (!typecheck.stdout.includes("merge-customers.ts")) throw new Error(typecheck.stdout);
      if (readFileSync(join(dir, "src/custom/actions/merge-customers.ts"), "utf8") !== custom) {
        throw new Error("the custom code was changed");
      }
      run("pnpm", ["typecheck"], dir);
    },
  );
  step("rule status: not implemented → implemented and tested → changed", () => {
    const rule = "mergeCustomers.move-orders";
    const status = () => {
      const out = smithable(dir, "inspect").out;
      const line = out.split("\n").find((l) => l.trim().startsWith(rule));
      if (!line) throw new Error(`no ${rule} in:\n${out}`);
      return line.trim().slice(rule.length).trim();
    };
    expectOk(smithable(dir, "op", "setRuleId", "action:mergeCustomers", "1", "move-orders"));
    if (status() !== "Not implemented") throw new Error(status());

    const custom = join(dir, "src/custom/actions/merge-customers.ts");
    writeFileSync(
      custom,
      readFileSync(custom, "utf8").replace(
        "export async",
        `// implements rule ${rule}\nexport async`,
      ),
    );
    writeFileSync(join(dir, "src/custom/actions/merge-customers.test.ts"), MERGE_CUSTOMERS_TEST);
    if (!status().startsWith("Implemented and tested, but the tests have not run"))
      throw new Error(status());
    expectOk(smithable(dir, "test"));
    if (status() !== "Implemented and tested") throw new Error(status());

    const specFile = join(dir, "smithable.yml");
    writeFileSync(
      specFile,
      readFileSync(specFile, "utf8").replace(
        "move to the kept customer",
        "move to the customer we keep",
      ),
    );
    if (!status().startsWith("Changed")) throw new Error(status());
  });
  step(
    "inspect action:mergeCustomers gives its meaning, rules, files, symbols, routes and tests",
    () => {
      const { code, out, stdout } = smithable(dir, "inspect", "action:mergeCustomers", "--json");
      if (code !== 0) throw new Error(out);
      // Warnings go to stderr; the JSON is stdout.
      const info = JSON.parse(stdout);
      const has = (role, path, symbol) =>
        info.files.some(
          (f) => f.role === role && f.path === path && (!symbol || f.symbols.includes(symbol)),
        );
      const ok =
        info.intent.startsWith("Merge a duplicate customer") &&
        info.rules.some((r) => r.id === "mergeCustomers.move-orders") &&
        has("generated", "src/generated/actions/merge-customers.ts", "MergeCustomersInput") &&
        has("implements", "src/custom/actions/merge-customers.ts", "mergeCustomers") &&
        info.routes.includes("/customers/actions/merge-customers") &&
        info.tests.some((t) => t.file === "src/custom/actions/merge-customers.test.ts");
      if (!ok) throw new Error(out);
    },
  );
  step(
    "customize page:customers gives the page its own component; regeneration leaves it alone; a spec change it no longer fits fails the type-check; undo reverts it",
    () => {
      run("git", ["add", "-A"], dir);
      run("git", ["commit", "-q", "-m", "custom action and its test"], dir);
      expectOk(smithable(dir, "customize", "page:customers"));
      const custom = join(dir, "src/custom/pages/customers.tsx");
      writeFileSync(
        custom,
        readFileSync(custom, "utf8").replace(
          "<PageHeader",
          "<p>Our customers</p>\n      <PageHeader",
        ),
      );
      run("pnpm", ["typecheck"], dir);
      const regenerated = run("node", [cli, "generate", dir], repo);
      if (!regenerated.includes("(0 changed, 0 removed)")) throw new Error(regenerated);
      if (!readFileSync(custom, "utf8").includes("Our customers"))
        throw new Error("the custom page was changed");
      run("git", ["checkout", "--", "src/custom/pages/customers.tsx"], dir);
      // The spec no longer gives the page a search: the custom page's code no longer fits.
      expectOk(smithable(dir, "op", "setSearch", "customers"));
      const typecheck = spawnSync("pnpm", ["typecheck"], { cwd: dir, encoding: "utf8" });
      if (typecheck.status === 0 || !typecheck.stdout.includes("src/custom/pages/customers.tsx"))
        throw new Error(`expected the custom page to fail type-checking:\n${typecheck.stdout}`);
      expectOk(smithable(dir, "undo"));
      expectOk(smithable(dir, "undo"));
      if (spawnSync("test", ["-e", custom]).status === 0)
        throw new Error("undo kept the custom page");
    },
  );
  step("a hand-edited generated file is reported, not overwritten", () => {
    const file = join(dir, "src/generated/customer.ts");
    const edited = `${readFileSync(file, "utf8")}// my change\n`;
    writeFileSync(file, edited);
    const result = spawnSync("node", [cli, "generate", dir], { cwd: repo, encoding: "utf8" });
    if (result.status !== 1 || !result.stderr.includes("src/generated/customer.ts"))
      throw new Error(result.stderr);
    if (readFileSync(file, "utf8") !== edited) throw new Error("the edit was overwritten");
    // Back to what Smithable generated, for the flows after this one.
    run("git", ["checkout", "--", "src/generated/customer.ts"], dir);
  });
}

/** Creates, edits and deletes a customer through the UI, checking messages on the way. */
async function browserFlow(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const expectText = async (name, text) => {
    await page.getByText(text).filter({ visible: true }).first().waitFor({ timeout: 5000 });
    console.log(`  ✓ browser: ${name}`);
  };
  try {
    await signInAs(page, base, "admin");
    console.log("  ✓ browser: the development sign-in signs in as a role");
    await open(page, `${base}/customers`);
    const spacing = await page
      .locator('[data-kit="model-table"] [data-part="header"] th')
      .first()
      .evaluate((th) => getComputedStyle(th).letterSpacing);
    if (spacing !== "3px") throw new Error(`src/custom/styles.css did not apply (${spacing})`);
    console.log(
      "  ✓ browser: a rule in src/custom/styles.css on the kit's hooks applies over the kit's styles",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, `${base}/customers`);
    const menu = page.getByRole("button", { name: "Open menu" });
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await menu.click();
    await drawer.getByRole("button", { name: "Sign out" }).waitFor();
    await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "hidden" });
    if (!(await menu.evaluate((button) => button === document.activeElement)))
      throw new Error("closing the menu did not return focus to its button");
    await menu.click();
    await drawer.getByRole("link", { name: "Orders" }).click();
    await page.waitForURL(`${base}/orders`);
    await drawer.waitFor({ state: "hidden" });
    await page.setViewportSize({ width: 1280, height: 720 });
    console.log(
      "  ✓ browser: on a phone the menu is a drawer: Escape closes it and returns focus, a link in it navigates",
    );
    // A slow answer while typing keeps the page, the box's focus and every letter typed.
    await open(page, `${base}/customers`);
    const slow = async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.continue();
    };
    await page.route((url) => url.pathname.includes("_serverFn"), slow);
    const box = page.getByRole("searchbox", { name: "Search by name or email" });
    for (const letter of "nor") {
      await box.press(letter);
      await page.waitForTimeout(400);
    }
    await page.waitForURL(/q=nor/);
    await page.waitForTimeout(800);
    await page.unroute((url) => url.pathname.includes("_serverFn"), slow);
    if (!(await box.evaluate((input) => input === document.activeElement)))
      throw new Error("the search box lost focus while the results loaded");
    if ((await box.inputValue()) !== "nor")
      throw new Error(`the search box holds "${await box.inputValue()}" instead of "nor"`);
    console.log(
      "  ✓ browser: typing a search keeps the box's focus and text while a slow answer loads",
    );
    await page.getByRole("searchbox", { name: "Search by name or email" }).fill("NORDIC");
    await page.waitForURL(/q=NORDIC/);
    await page
      .getByRole("cell", { name: "Baltic Freight AB", exact: true })
      .waitFor({ state: "detached", timeout: 5000 });
    await page.getByRole("cell", { name: "Nordic Timber Oy", exact: true }).waitFor();
    console.log(
      "  ✓ browser: searching customers by name ignores case and keeps the search in the URL",
    );
    await open(page, `${base}/customers/new`);
    await page.getByRole("button", { name: "Create customer" }).click();
    await expectText("empty required field says Required", "Required");

    await page.getByRole("textbox", { name: "Name *" }).fill("Mariehamn Marine AB");
    // Nordic Timber's email in the starter's samples/Customer.yml.
    await page.getByRole("textbox", { name: "Email" }).fill("orders@nordictimber.example");
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

    await page.getByRole("cell", { name: "Mariehamn Marine AB", exact: true }).click();
    await page.getByRole("textbox", { name: "Credit limit" }).fill("2750.50");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(`${base}/customers`);
    await expectText("edit: the change is saved", "€2,750.50");

    await page.getByRole("cell", { name: "Mariehamn Marine AB", exact: true }).click();
    // The confirmation names the record and starts on Cancel, so Enter does not delete.
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Delete “Mariehamn Marine AB”?" });
    await confirm.waitFor();
    if (
      !(await confirm
        .getByRole("button", { name: "Cancel" })
        .evaluate((b) => b === document.activeElement))
    )
      throw new Error("the delete confirmation does not start on Cancel");
    await confirm.getByRole("button", { name: "Delete customer" }).click();
    await page.waitForURL(`${base}/customers`);
    await page.getByRole("cell", { name: "Nordic Timber Oy", exact: true }).waitFor();
    if (await page.getByText("Mariehamn Marine AB").count())
      throw new Error("The customer was not deleted");
    console.log("  ✓ browser: delete asks first, naming the customer, then removes it");

    await open(page, `${base}/orders/new`);
    await page.getByRole("textbox", { name: "Number *" }).fill("ORD-2001");
    await chooseRecord(page, "Customer *", "Skerry Software");
    await page.getByRole("textbox", { name: "Total *" }).fill("99");
    await page.getByRole("button", { name: "Create order" }).click();
    await page.waitForURL(`${base}/orders`);
    await page.getByRole("row", { name: /ORD-2001.*Skerry Software/ }).waitFor({ timeout: 5000 });
    console.log("  ✓ browser: an order is created for a customer chosen from a list");

    await open(page, `${base}/customers`);
    await page.getByRole("cell", { name: "Skerry Software", exact: true }).click();
    await page.getByRole("cell", { name: "ORD-2001", exact: true }).waitFor({ timeout: 5000 });
    console.log("  ✓ browser: the customer's page lists its orders");

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete customer" }).click();
    await expectText(
      "a customer with orders cannot be deleted, and it says why",
      "This customer is still used by other records.",
    );
    await open(page, `${base}/orders`);
    await page.getByRole("searchbox", { name: "Search by number or customer" }).fill("skerry");
    await page.waitForURL(/q=skerry/);
    // The other customers' orders go; Skerry's stay.
    await page
      .getByRole("cell", { name: "Nordic Timber Oy", exact: true })
      .first()
      .waitFor({ state: "detached", timeout: 5000 });
    await page.getByRole("cell", { name: "ORD-2001", exact: true }).waitFor({ timeout: 5000 });
    console.log("  ✓ browser: orders are found by their customer's name");

    await open(page, `${base}/customers`);
    await page.getByRole("link", { name: "Merge customers" }).click();
    // By keyboard: type part of the name, then Enter on the first match.
    const keep = page.getByRole("combobox", { name: "Keep *" });
    await keep.fill("nordic");
    await keep.press("ArrowDown");
    await keep.press("ArrowUp");
    await keep.press("Enter");
    if ((await keep.inputValue()) !== "Nordic Timber Oy")
      throw new Error(`the keyboard chose "${await keep.inputValue()}"`);
    await chooseRecord(page, "Duplicate *", "Skerry Software");
    await page.getByRole("button", { name: "Merge customers" }).click();
    await page.waitForURL(`${base}/customers`);
    await page.getByRole("cell", { name: "Nordic Timber Oy", exact: true }).waitFor();
    // The list refreshes after the action; the duplicate must disappear from it.
    await page
      .getByRole("cell", { name: "Skerry Software", exact: true })
      .waitFor({ state: "detached", timeout: 10000 })
      .catch(() => {
        throw new Error("the duplicate is still there");
      });
    await page.getByRole("cell", { name: "Nordic Timber Oy", exact: true }).click();
    await page.getByRole("cell", { name: "ORD-2001", exact: true }).waitFor({ timeout: 5000 });
    console.log("  ✓ browser: the custom action merges customers and moves their orders");

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/sign-in/);
    await signInAs(page, base, "sales");
    await open(page, `${base}/customers`);
    if (await page.getByRole("link", { name: "Merge customers" }).count())
      throw new Error("sales can merge customers");
    await page.getByRole("cell", { name: "Nordic Timber Oy", exact: true }).click();
    await page.getByRole("button", { name: "Save changes" }).waitFor();
    if (await page.getByRole("button", { name: "Delete" }).count())
      throw new Error("sales can delete customers");
    console.log("  ✓ browser: sales edit customers but cannot delete or merge them; admins can");
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("crm browser flow");
  } finally {
    await browser.close();
  }
}

for (const [index, example] of examples.entries()) {
  console.log(`\n${example}`);
  const dir = join(mkdtempSync(join(tmpdir(), `smithable-${example}-`)), "app");
  dirs.push(dir);
  // Parallel runs (scripts/test-apps-parallel.mjs) give each process its own ports.
  const port = Number(process.env.TEST_APPS_PORT ?? 4400) + index;
  const reported = failures.length;
  try {
    // Its own administrator: the default is the Git user's address, which on a developer's
    // machine may name Smithable, and a detached project must not.
    step("smithable new", () =>
      run("node", [cli, "new", dir, "--starter", example, "--admin", "owner@acme.dev"], repo),
    );
    if (example === "crm") {
      step("the starter comes with its custom action implemented", () => {
        const code = readFileSync(join(dir, "src/custom/actions/merge-customers.ts"), "utf8");
        if (code.includes("not implemented yet"))
          throw new Error("the stub, not the starter's code");
      });
    }
    step("no dependency on Smithable", () => {
      if (/smithable/i.test(readFileSync(join(dir, "package.json"), "utf8")))
        throw new Error("package.json mentions Smithable");
    });
    step("type-checks", () => run("pnpm", ["typecheck"], dir));
    step("builds, and the production build contains no preview-editor markers", () => {
      run("pnpm", ["build"], dir);
      const found = spawnSync("grep", ["-rl", "data-sm-\\|smithable-editor", "dist"], {
        cwd: dir,
        encoding: "utf8",
      }).stdout.trim();
      if (found) throw new Error(`found in ${found}`);
    });
    step("the app's own tests pass (access for every role, formula examples)", () =>
      run("pnpm", ["test"], dir),
    );
    step("the generated smoke tests pass: every page opens for every role that may see it", () =>
      run("pnpm", ["test:smoke"], dir, { SMOKE_PORT: String(port + 200) }),
    );

    if (existsSync(join(dir, "src/lib/auth.ts")))
      await asyncStep(
        "without BETTER_AUTH_SECRET and BETTER_AUTH_URL, the built app signs nobody in",
        async () => {
          const env = { ...process.env, PORT: String(port + 300) };
          delete env.BETTER_AUTH_SECRET;
          delete env.BETTER_AUTH_URL;
          const server = spawn("pnpm", ["start"], { cwd: dir, env });
          live.add(server.pid);
          const exited = new Promise((r) => server.on("exit", (code) => r(code)));
          try {
            // Either it does not start, or its sign-in fails instead of using a default secret.
            const outcome = await Promise.race([
              exited.then((code) => `exited ${code}`),
              (async () => {
                // Any answer at all: an app that refuses to run answers every request with 500.
                for (let i = 0; i < 120; i++) {
                  const answer = await fetch(
                    `http://localhost:${port + 300}/api/auth/get-session`,
                  ).catch(() => undefined);
                  if (answer) return `sign-in answered ${answer.status}`;
                  await new Promise((r) => setTimeout(r, 500));
                }
                return "no answer";
              })(),
            ]);
            if (/exited 0|answered 200/.test(outcome)) throw new Error(outcome);
          } finally {
            live.delete(server.pid);
            killTree(server.pid);
          }
        },
      ).catch(() => {});

    let stop = await serve(dir, port, "production");
    try {
      const base = `http://localhost:${port}`;
      const { ir } = validateSpec({
        path: "smithable.yml",
        text: readFileSync(join(dir, "smithable.yml"), "utf8"),
      });
      const publicPages =
        /public:\n(?:.*\n)*? {2}pages: \[([^\]]*)\]/
          .exec(readFileSync(join(dir, "smithable.auth.yml"), "utf8"))?.[1]
          ?.split(",")
          .map((p) => p.trim()) ?? [];
      for (const page of ir.pages) {
        const path = page.route;
        const response = await fetch(`${base}${path}`, { redirect: "manual" });
        const html = await response.text();
        const isPublic = publicPages.includes(page.id);
        const landing = page.pattern.kind === "landing";
        const ok = isPublic
          ? response.status === 200 &&
            (landing
              ? html.includes("<h1")
              : page.pattern.kind === "calendar"
                ? html.includes("<ol") && !/aria-label="New [a-z ]+, /.test(html)
                : page.pattern.kind === "articles"
                  ? html.includes('data-kit="articles"') && !/>New [a-z ]+<\/a>/.test(html)
                  : // A list, as a table or as cards.
                    html.includes('data-kit="model-table"') && !/>New [a-z ]+<\/a>/.test(html))
          : response.status === 307 && response.headers.get("location").includes("/sign-in");
        const what = !isPublic
          ? "needs sign-in"
          : landing
            ? "is public: the landing page opens without sign-in"
            : page.pattern.kind === "calendar"
              ? "is public: this week's sample records without sign-in, and no way to add one"
              : page.pattern.kind === "articles"
                ? "is public: the published articles without sign-in, read-only"
                : "is public: lists sample data without sign-in, read-only";
        console.log(`  ${ok ? "✓" : "✗"} ${path} ${what}`);
        if (!ok) failures.push(`${example} ${path}`);
        // A starter's pictures (its hero) are in the app and served.
        for (const [, src] of html.matchAll(/<img[^>]* src="(\/images\/[^"]+)"/g)) {
          const image = await fetch(`${base}${src}`);
          const served = image.ok && image.headers.get("content-type")?.startsWith("image/");
          console.log(`  ${served ? "✓" : "✗"} ${path} shows ${src}`);
          if (!served) failures.push(`${example} ${src}`);
        }
      }
      const signIn = await (await fetch(`${base}/sign-in`)).text();
      const devSignIn = await fetch(`${base}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({ email: "dev-admin@example.com", password: "dev-password" }),
      });
      const absent =
        !signIn.includes("Development only") &&
        !signIn.includes("missing from the environment") &&
        devSignIn.status === 400;
      console.log(
        `  ${absent ? "✓" : "✗"} the production build has no development sign-in or setup notes`,
      );
      if (!absent) failures.push(`${example} development sign-in in production`);
      await asyncStep(
        "a request's trace id is continued from traceparent, answered, and on its access line (who, path without query values)",
        async () => {
          const path = ir.pages.find((p) => publicPages.includes(p.id))?.route ?? "/sign-in";
          const id = "4bf92f3577b34da6a3ce929d0e0e4736";
          const answer = await fetch(`${base}${path}?q=secret`, {
            headers: { traceparent: `00-${id}-00f067aa0ba902b7-01` },
          });
          if (!answer.headers.get("traceparent")?.startsWith(`00-${id}-`))
            throw new Error(`answered with traceparent ${answer.headers.get("traceparent")}`);
          // The line is written as the answer goes out: wait for it.
          let line;
          for (let i = 0; !line && i < 50; i++) {
            line = stop
              .output()
              .split("\n")
              .find((l) => l.includes(`"trace":"${id}"`) && l.includes('"log":"access"'));
            if (!line) await new Promise((r) => setTimeout(r, 100));
          }
          if (!line) throw new Error("no access line with the trace id");
          const access = JSON.parse(line);
          if (access.path !== `${path}?q` || access.who !== "visitor" || access.status !== 200)
            throw new Error(`access line: ${line}`);
          if (line.includes("secret")) throw new Error("the query's value is in the access line");
        },
      );
      await asyncStep(
        "production pages carry the security headers, and the Content Security Policy blocks nothing they need",
        async () => {
          const path = ir.pages.find((p) => publicPages.includes(p.id))?.route ?? "/sign-in";
          const headers = (await fetch(`${base}${path}`)).headers;
          for (const name of [
            "content-security-policy",
            "x-content-type-options",
            "cross-origin-embedder-policy",
          ])
            if (!headers.get(name)) throw new Error(`${path} has no ${name} header`);
          if (!/script-src 'self' 'nonce-/.test(headers.get("content-security-policy") ?? ""))
            throw new Error("the policy does not use a nonce");
          const browser = await chromium.launch();
          try {
            const page = await browser.newPage();
            const errors = [];
            page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
            page.on("pageerror", (e) => errors.push(e.message));
            await open(page, `${base}${path}`);
            await page.waitForTimeout(500);
            if (errors.length) throw new Error(errors.join("\n"));
          } finally {
            await browser.close();
          }
        },
      ).catch(() => {});
      await asyncStep(
        "changes are limited per address, and a made-up X-Forwarded-For is no new address",
        async () => {
          // All at once, and well over the burst of 60: the burst refills at one a second, so a
          // busy machine that spreads 65 requests over five seconds let them all through. 200
          // would need over two minutes of refilling to pass.
          const answers = await Promise.all(
            Array.from({ length: 200 }, (_, i) =>
              fetch(`${base}/`, { method: "POST", headers: { "x-forwarded-for": `10.0.${i}.1` } }),
            ),
          );
          if (!answers.some((answer) => answer.status === 429))
            throw new Error("200 changes from made-up addresses were all let through");
        },
      ).catch(() => {});
    } finally {
      stop();
    }

    // The owner's stylesheet, on the kit's hooks (docs/design/look.md §2): checked in the CRM.
    if (example === "crm")
      appendFileSync(
        join(dir, "src/custom/styles.css"),
        '\n[data-page="customers"] [data-kit="model-table"] [data-part="header"] th { letter-spacing: 3px; }\n',
      );
    // A list's filters and sort (marketplace.md §2.2): the CRM's customers get them by operations.
    if (example === "crm")
      step(
        "op setFilters, setSortable and setFavorites give the customers list filters, a sort and hearts, and the app type-checks",
        () => {
          for (const args of [
            ["setFilters", "customers", "segment", "creditLimit", "owner"],
            ["setSortable", "customers", "creditLimit", "name"],
            ["setFavorites", "customers"],
          ]) {
            const result = smithable(dir, "op", ...args);
            if (result.code !== 0) throw new Error(result.out);
          }
          run("pnpm", ["typecheck"], dir);
        },
      );
    // Contact the owner (marketplace.md §2.4): a customer's page mails the customer's owner.
    if (example === "crm")
      step(
        "op setContact gives a customer's page a contact block for its owner, and the app type-checks",
        () => {
          const result = smithable(dir, "op", "setContact", "customers", "owner");
          if (result.code !== 0) throw new Error(result.out);
          run("pnpm", ["typecheck"], dir);
        },
      );
    // Several pictures on a record (marketplace.md §2.1): posts get a gallery by an operation.
    if (example === "booking")
      step("op addField gives posts a gallery of several pictures, and the app type-checks", () => {
        const added = smithable(dir, "op", "addField", "Post", "gallery", "pictures");
        if (added.code !== 0) throw new Error(added.out);
        run("pnpm", ["typecheck"], dir);
      });
    // A copy (actions.md §8): duplicate an invoice with its lines, asking for its own number.
    if (example === "invoicing")
      step(
        "op addAction --copy gives invoices a duplicate action that takes their lines along",
        () => {
          const added = smithable(
            dir,
            "op",
            "addAction",
            "duplicate",
            "--on",
            "Invoice",
            "--copy",
            "status=draft",
            "--copy",
            "number=",
            "--copy",
            "issuedOn=TODAY()",
            "--with",
            "lines",
          );
          if (added.code !== 0) throw new Error(added.out);
          run("pnpm", ["typecheck"], dir);
        },
      );
    // A standard action (actions.md): a button that sets fields of a record, without code.
    if (example === "status")
      step(
        "op addAction --on gives incidents a standard action (reopen), with no code to write, and the app type-checks",
        () => {
          const added = smithable(
            dir,
            "op",
            "addAction",
            "reopen",
            "--on",
            "Incident",
            "--when",
            "status=resolved",
            "--set",
            "status=investigating",
            "--add",
            "IncidentUpdate.at=NOW()",
            "--add",
            "IncidentUpdate.status=investigating",
            "--add",
            "IncidentUpdate.message=",
          );
          if (added.code !== 0) throw new Error(added.out);
          if (existsSync(join(dir, "src/custom/actions/reopen.ts")))
            throw new Error("a stub was made");
          run("pnpm", ["typecheck"], dir);
        },
      );
    // Models whose tables have the names of generated locals (rows, values): the generated code
    // reaches tables through the schema namespace, so nothing shadows them.
    if (example === "status")
      step(
        "models named Row and Value, with a data page and the API on every model, type-check; undo takes them back",
        () => {
          const ops = [
            ["addModel", "Row", "label=string!", "amount=money"],
            ["addField", "Row", "twice", "money", "--formula", "amount * 2"],
            ["addModel", "Value", "name=string!", "amount=int"],
            ["addDataPage"],
            ["setApi", "all", "--actions", "all", "--assistants", "true"],
          ];
          for (const args of ops) {
            const done = smithable(dir, "op", ...args);
            if (done.code !== 0) throw new Error(done.out);
          }
          run("pnpm", ["typecheck"], dir);
          for (const _ of ops) {
            const undone = smithable(dir, "undo");
            if (undone.code !== 0) throw new Error(undone.out);
          }
        },
      );
    stop = await serve(dir, port + 100, "dev");
    try {
      const base = `http://localhost:${port + 100}`;
      await visualChecks(dir, base);
      await robotsCheck(base);
      if (example === "crm") {
        await browserFlow(base);
        await filtersFlow(base);
        await favoritesFlow(base);
        await contactFlow(dir, base);
      }
      if (example === "booking") {
        await landingFlow(base);
        await calendarFlow(base);
        await bookingFlow(dir, base);
        await markdownFlow(base);
        await articlesFlow(dir, base);
        await calculatorFlow(base);
        await pictureFlow(dir, base);
        await picturesFlow(dir, base);
      }
      if (example === "marketplace") await marketplaceFlow(dir, base);
      if (example === "status") await statusFlow(base);
      if (example === "invoicing") {
        await copyFlow(base);
        await formulaFlow(base);
        await onboardingFlow(base);
        await isolationFlow(dir, base);
      }
    } finally {
      stop();
    }
    // The CRM's later steps work on its customers page as the starter has it.
    if (example === "crm")
      step("undo takes the list's filters, sort, hearts and contact block back off", () => {
        for (let i = 0; i < 4; i++) {
          const undone = smithable(dir, "undo");
          if (undone.code !== 0) throw new Error(undone.out);
        }
        const spec = readFileSync(join(dir, "smithable.yml"), "utf8");
        if (["filters:", "favorites:", "contact:"].some((key) => spec.includes(key)))
          throw new Error("the filters, favorites or contact block are still in the spec");
      });

    // Records from a spreadsheet (importRecords): a dry run adds nothing, an import adds every
    // row in one go, a file with a problem adds none and says where, undo takes an import back.
    if (example === "crm")
      step(
        "importRecords: a dry run shows the converted rows, an import adds them, a bad file adds none, undo removes them",
        () => {
          const count =
            "const{DatabaseSync}=require('node:sqlite');console.log(new DatabaseSync('data/db/app.db').prepare('select count(*) n from customers').get().n)";
          const customers = () => Number(run("node", ["-e", count], dir).trim());
          // Outside the project, as a download would be: the project stays clean for the checkpoint.
          const files = mkdtempSync(join(tmpdir(), "smithable-import-"));
          const imported = join(files, "imported.csv");
          const broken = join(files, "broken.csv");
          writeFileSync(
            imported,
            'Name,E-mail,Segment,Credit limit\nÅland Fish AB,fish@example.ax,Enterprise,"25 000,00"\nMarina Café,cafe@example.ax,smb,1200\n',
          );
          writeFileSync(broken, "Name,Credit limit\nGood AB,10\nBad AB,lots\n");
          const importing = (file, ...more) =>
            smithable(dir, "op", "importRecords", "Customer", "--from", file, ...more);
          const before = customers();
          const dry = importing(imported, "--dry-run");
          if (
            dry.code !== 0 ||
            !dry.out.includes('"creditLimit":2500000') ||
            customers() !== before
          )
            throw new Error(`the dry run: ${dry.out}`);
          const bad = importing(broken);
          if (bad.code === 0 || !bad.out.includes("line 3, Credit limit") || customers() !== before)
            throw new Error(`the bad file: ${bad.out}`);
          const done = importing(imported);
          if (done.code !== 0 || customers() !== before + 2)
            throw new Error(`the import: ${done.out}`);
          const undone = smithable(dir, "undo");
          if (undone.code !== 0 || customers() !== before) throw new Error(`undo: ${undone.out}`);
          rmSync(files, { recursive: true });
        },
      );

    step("regenerating changes nothing", () => {
      const out = run("node", [cli, "generate", dir], repo);
      if (!out.includes("(0 changed, 0 removed)")) throw new Error(out);
    });
    if (example === "booking") await teachFlow(dir);
    if (example === "crm") {
      await mcpFlow(dir);
      await askFlow(dir);
      operationsFlow(dir);
      upgradeFlow(dir);
      await detachFlow(dir, port);
    }
  } catch (error) {
    // A step's failure is reported already; anything else (a mistake in this script) is not,
    // and must not pass as a green run.
    if (failures.length === reported) {
      console.log(`  ✗ ${error instanceof Error ? error.stack : error}`);
      failures.push(`${example}: unexpected error`);
    }
    // Continue with the next example.
  }
}

/** Upgrading across a stack profile (ARCHITECTURE §14): checked, reported, undoable. */
function upgradeFlow(dir) {
  const git = (...args) =>
    run("git", ["-c", "user.name=Test", "-c", "user.email=t@example.com", ...args], dir);
  const lockPath = join(dir, "smithable.lock");
  const current = JSON.parse(readFileSync(lockPath, "utf8")).stackProfile;
  step("an app from an older stack profile: generate refuses and points to upgrade", () => {
    // As if made by an earlier Smithable: another profile, and an older clsx.
    writeFileSync(lockPath, readFileSync(lockPath, "utf8").replace(current, "2026-08"));
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    pkg.dependencies.clsx = "2.1.0";
    writeFileSync(join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
    run("pnpm", ["install", "--silent"], dir);
    // Smithable's record says it wrote these files so, as the older Smithable would have.
    const recordPath = join(dir, ".smithable/files.json");
    const record = JSON.parse(readFileSync(recordPath, "utf8"));
    for (const entry of record.files)
      if (["package.json", "smithable.lock"].includes(entry.path))
        entry.sha256 = createHash("sha256")
          .update(readFileSync(join(dir, entry.path)))
          .digest("hex");
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
    git("add", "-A");
    git("commit", "-qm", "An app from stack profile 2026-08");
    const result = spawnSync("node", [cli, "generate", dir], { encoding: "utf8" });
    if (result.status === 0 || !result.stderr.includes("smithable upgrade"))
      throw new Error(result.stderr);
  });
  step(
    "upgrade: custom code that no longer fits is reported, not fixed, and nothing changes",
    () => {
      writeFileSync(
        join(dir, "src/custom/legacy.ts"),
        'import { formatMoney } from "#/kit/format";\n\nexport const total = (cents: number) => formatMoney(cents);\n',
      );
      git("add", "-A");
      git("commit", "-qm", "Custom code using the old kit");
      const result = smithable(dir, "upgrade");
      if (
        result.code === 0 ||
        !result.out.includes("src/custom/legacy.ts") ||
        !result.out.includes("formatMoney")
      )
        throw new Error(result.out);
      if (run("git", ["status", "--porcelain"], dir).trim())
        throw new Error("the failed upgrade left changes");
      if (!readFileSync(lockPath, "utf8").includes("2026-08"))
        throw new Error("the profile changed anyway");
    },
  );
  step(
    "upgrade: with the custom code updated, the app moves to the new profile and its tests pass",
    () => {
      rmSync(join(dir, "src/custom/legacy.ts"));
      git("add", "-A");
      git("commit", "-qm", "Custom code updated for the new kit");
      const result = smithable(dir, "upgrade");
      if (result.code !== 0 || !result.out.includes(`to ${current}`)) throw new Error(result.out);
      if (!readFileSync(lockPath, "utf8").includes(current))
        throw new Error("the lock was not updated");
      if (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).dependencies.clsx === "2.1.0")
        throw new Error("clsx was not upgraded");
      if (
        !run("git", ["log", "-1", "--format=%s"], dir).includes(
          `Upgrade to stack profile ${current}`,
        )
      )
        throw new Error("no upgrade commit");
    },
  );
}

/** Teach Smithable (ARCHITECTURE §5.1): an unknown section gets a project plugin, once. */
async function teachFlow(dir) {
  const specPath = join(dir, "smithable.yml");
  writeFileSync(
    specPath,
    `${readFileSync(specPath, "utf8")}\nnewsletter:\n  from: hello@stillwater.ax\n  lists: [classes, offers]\n`,
  );
  // A person edits the spec and commits, as in any project under Git.
  if (spawnSync("git", ["rev-parse"], { cwd: dir }).status !== 0) run("git", ["init", "-q"], dir);
  run("git", ["add", "-A"], dir);
  run(
    "git",
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "-q",
      "-m",
      "Add a newsletter section by hand",
    ],
    dir,
  );
  await asyncStep("an unknown section is an error that suggests teaching Smithable", async () => {
    const result = spawnSync("node", [cli, "validate", dir], { encoding: "utf8" });
    const out = `${result.stdout}${result.stderr}`;
    if (result.status === 0 || !out.includes("smithable teach newsletter")) throw new Error(out);
  });
  await asyncStep(
    "teach: a coder writes a plugin in smithable/plugins only; the app gets its model and page",
    async () => {
      const result = await smithableAsync(
        dir,
        {
          SMITHABLE_CODER_COMMAND: `node ${join(repo, "scripts/fake-coder.mjs")}`,
          SMITHABLE_CODER_LOCATION: "local",
        },
        "teach",
        "newsletter",
      );
      if (result.code !== 0) throw new Error(result.out);
      const files = run("git", ["show", "--name-only", "--format=", "HEAD"], dir)
        .trim()
        .split("\n");
      for (const expected of [
        "smithable/plugins/newsletter/plugin.mjs",
        "smithable.context.yml",
        "src/routes/subscribers/index.tsx",
        "src/generated/plugins/newsletter/sender.ts",
      ])
        if (!files.includes(expected))
          throw new Error(`${expected} is not in the change: ${files.join(", ")}`);
      if (
        !/sqliteTable\(\s*"subscribers"/.test(readFileSync(join(dir, "src/db/schema.ts"), "utf8"))
      )
        throw new Error("no subscribers table");
    },
  );
  await asyncStep("after teaching, regenerating uses no AI and changes nothing", async () => {
    const out = run("node", [cli, "generate", dir], repo);
    if (!out.includes("(0 changed, 0 removed)")) throw new Error(out);
  });
}

if (examples.includes("booking")) {
  console.log("\nnew from a sentence");
  const model = await startFakeModel();
  const dir = join(mkdtempSync(join(tmpdir(), "smithable-describe-")), "app");
  dirs.push(dir);
  try {
    await asyncStep("without a model, it says how to start from a starter instead", async () => {
      const result = await smithableAsync(
        dir,
        { SMITHABLE_LOCAL_MODEL: "" },
        "new",
        dir,
        "--describe",
        "A booking site for a pilates studio",
      );
      if (result.code === 0 || !result.out.includes("--starter booking"))
        throw new Error(result.out);
    });
    await asyncStep(
      "clarify --json: the model's questions and starter for a program; no model means no questions",
      async () => {
        const asked = await smithableAsync(
          dir,
          { SMITHABLE_LOCAL_MODEL: "fake-model", SMITHABLE_LOCAL_URL: model.url },
          "clarify",
          "A site to show my dogs",
          "--json",
        );
        const answer = JSON.parse(asked.out);
        if (asked.code !== 0 || answer.starter !== "records" || answer.questions.length !== 2)
          throw new Error(asked.out);
        const none = await smithableAsync(
          dir,
          { SMITHABLE_LOCAL_MODEL: "" },
          "clarify",
          "A site to show my dogs",
          "--json",
        );
        if (none.code !== 0 || none.out.trim() !== '{"questions":[]}') throw new Error(none.out);
      },
    );
    await asyncStep(
      "the closest starter, adapted by a model, is summarized in plain language and becomes the app",
      async () => {
        const result = await smithableAsync(
          dir,
          { SMITHABLE_LOCAL_MODEL: "fake-model", SMITHABLE_LOCAL_URL: model.url },
          "new",
          dir,
          "--describe",
          "A booking site for a pilates studio",
          "--yes",
        );
        if (result.code !== 0) throw new Error(result.out);
        for (const expected of [
          "Starting from the booking starter.",
          "Local model (fake-model)",
          "Lotus Pilates",
          "Created",
        ])
          if (!result.out.includes(expected))
            throw new Error(`missing "${expected}":\n${result.out}`);
        if (!readFileSync(join(dir, "src/generated/app.ts"), "utf8").includes("Lotus Pilates"))
          throw new Error("the app was not generated from the draft");
      },
    );
  } catch {
    // Already reported.
  } finally {
    await model.close();
  }
}

if (failures.length) {
  console.log(`\n${failures.length} failed. The apps are kept in:\n${dirs.join("\n")}`);
  process.exit(1);
}
for (const dir of dirs) rmSync(join(dir, ".."), { recursive: true, force: true });
console.log(`\nAll ${examples.length} example apps passed.`);
