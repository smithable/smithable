// End-to-end test: every example becomes a real app that installs, type-checks, builds,
// serves its pages with sample data, and regenerates without changes. The production
// build is checked for page access and the absence of the development sign-in; the
// development server is used in a real browser, signed in as the examples' roles.
// Run after `pnpm build`: `pnpm test:apps [example…]`.
import { spawn, spawnSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
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
import { createServer, request } from "node:http";
import { createRequire } from "node:module";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fc from "fast-check";
import { chromium } from "playwright";
import { validateSpec } from "../packages/core/dist/index.js";
import { startFakeModel } from "./fake-model.mjs";
import { checkPorts } from "./ports.mjs";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const examples = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(join(repo, "examples"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

const failures = [];
// The secret of the mail address incomingMailFlow adds on the booking site (integrations.md §3).
process.env.INCOMING_SUPPORT_SECRET = "support-secret";
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
async function serve(dir, port, mode, env = {}) {
  // A fixed port: Vite would otherwise move to another one while the old server is stopping.
  const args =
    mode === "dev" ? ["exec", "vite", "dev", "--port", String(port), "--strictPort"] : ["start"];
  const server = spawn("pnpm", args, {
    cwd: dir,
    env: { ...process.env, PORT: String(port), ...authEnv(port), ...env },
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
    // The server had a migration to apply, so it kept the database as it was first: a copy
    // without the new column, for a deploy to put back if the new version fails to come up.
    const copy = join(dir, "data", "db", "before-migration.db");
    const kept =
      existsSync(copy) &&
      !query(dir, "select name from pragma_table_info('customers')", copy).some(
        (c) => c.name === "website",
      );
    console.log(
      `  ${kept ? "✓" : "✗"} before migrating, the server kept a copy of the database as it was`,
    );
    if (!kept) failures.push("before-migration copy");
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
    // Bookings have a trash here: the cancelled one holds no place, and the same session can be
    // booked again (a unique value holds among live records only).
    await panel.getByRole("button", { name: "Book a mat" }).click();
    await panel.getByText("You're booked").waitFor({ timeout: 10000 });
    await panel.getByRole("button", { name: "Cancel my booking" }).click();
    await panel.getByRole("button", { name: "Yes, cancel it" }).click();
    await panel.getByText(/^1 of 1 place left$/).waitFor({ timeout: 10000 });
    await panel.getByRole("button", { name: "Book a mat" }).waitFor();
    console.log(
      "  ✓ browser: a member books a place and sees it in My bookings; the admin finds the session full and cannot lower its places below the bookings; the member cancels and the place is free again, books it again and cancels again (bookings in the trash hold no place)",
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
 * Outgoing mail (docs/design/integrations.md §4.1b) on the booking starter: a member books and
 * gets the confirmation; the studio changes the booking and the member is told, the admin not;
 * the studio deletes it and the member is told about it as it was. Mails are sent after the
 * change, so each is waited for in the outbox.
 */
async function outgoingFlow(dir, base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const panel = page.getByRole("dialog");
  const outbox = join(dir, "data", "mail", "outbox");
  const mails = () => (existsSync(outbox) ? readdirSync(outbox).sort() : []);
  /** The next mail after `count`, with its To, Subject and body. */
  const next = async (count, what) => {
    for (let i = 0; i < 100 && mails().length <= count; i++) await page.waitForTimeout(100);
    const all = mails();
    if (all.length !== count + 1) throw new Error(`${what}: ${all.length - count} mails, not one`);
    return readFileSync(join(outbox, all.at(-1)), "utf8").replace(/=\r?\n/g, "");
  };
  try {
    await signInAs(page, base, "member");
    await open(page, `${base}/schedule`);
    let count = mails().length;
    await page.locator("section ol button").first().click();
    await panel.getByRole("button", { name: "Book a mat" }).click();
    await panel.getByText("You're booked").waitFor({ timeout: 10000 });
    const made = await next(count, "the booking");
    for (const part of [
      /^To: dev-member@/m,
      /^Subject: Your booking$/m,
      /Thank you for booking/,
      /Session: #\d+/,
      /\/my-bookings\/\d+/,
    ])
      if (!part.test(made))
        throw new Error(`the confirmation lacks ${part}: ${made.slice(0, 600)}`);
    const [{ id, session }] = query(
      dir,
      "select id, session_id as session from bookings order by id desc limit 1",
    );
    const [{ other }] = query(
      dir,
      `select id as other from sessions where id != ${session} order by id limit 1`,
    );

    // The studio moves it to another session: the member is told, the admin (who changed it) not.
    await signInAs(page, base, "admin");
    await open(page, `${base}/my-bookings/${id}`);
    count = mails().length;
    const field = page.getByLabel(/^Session/);
    if ((await field.evaluate((e) => e.tagName)) === "SELECT")
      await field.selectOption({ label: `#${other}` });
    else await chooseRecord(page, /^Session/, `#${other}`);
    await page.getByRole("button", { name: "Save changes" }).click();
    const changed = await next(count, "the change");
    if (
      !/^To: dev-member@/m.test(changed) ||
      !/^Subject: Your booking was changed$/m.test(changed) ||
      !changed.includes(`Session: #${other}`)
    )
      throw new Error(`the change's mail: ${changed.slice(0, 600)}`);

    // The studio deletes it: the member is told about the booking as it was.
    await open(page, `${base}/my-bookings/${id}`);
    count = mails().length;
    // Bookings have a trash in this run: a delete moves it there, and the mail goes then.
    await page.getByRole("button", { name: "Move to trash" }).click();
    await page.waitForURL(/\/my-bookings$/);
    const gone = await next(count, "the deletion");
    if (
      !/^To: dev-member@/m.test(gone) ||
      !/^Subject: Your booking was cancelled$/m.test(gone) ||
      !gone.includes(`Session: #${other}`)
    )
      throw new Error(`the deletion's mail: ${gone.slice(0, 600)}`);

    // Activity says what was sent, to whom.
    const lines = query(
      dir,
      // Without mail settings the app keeps its mail, and Activity says so (backlog A54).
      "select details from audit_log where action in ('kept in the preview', 'kept in the outbox') order by id desc limit 3",
    );
    if (lines.length !== 3 || !lines.every((l) => l.details.includes("dev-member@")))
      throw new Error(`Activity: ${JSON.stringify(lines)}`);
    console.log(
      "  ✓ outgoing mail: a booking mails the member a confirmation; the studio's change and deletion mail the member (the deleted booking as it was), never the admin who made them; each is in Activity",
    );
  } catch (error) {
    console.log(
      `  ✗ outgoing mail: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("outgoing mail");
  } finally {
    await browser.close();
  }
}

/**
 * A visitor's change mails only the app's users (C's review of #401): with entries that mail the
 * admins and the address typed into a contact message, a visitor's message reaches the admin and
 * never the typed address, so the form cannot send anyone's text anywhere.
 */
async function visitorMailFlow(dir, base) {
  const ok = (r) => {
    if (r.code !== 0) throw new Error(r.out);
  };
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const outbox = join(dir, "data", "mail", "outbox");
  const mails = () => (existsSync(outbox) ? readdirSync(outbox).sort() : []);
  let added = 0;
  try {
    ok(smithable(dir, "op", "addOutgoing", "messageIn", "Message created", "--recipient", "admin"));
    added++;
    ok(
      smithable(dir, "op", "addOutgoing", "messageEcho", "Message created", "--recipient", "email"),
    );
    added++;
    const before = mails().length;
    await open(page, base);
    await page.getByRole("textbox", { name: "Name *" }).fill("Mallory");
    await page.getByRole("textbox", { name: "Email *" }).fill("victim@example.com");
    await page.getByRole("textbox", { name: "Message *" }).fill("Click this link");
    await page.getByRole("button", { name: "Send message" }).click();
    await page.getByText("Thank you!").first().waitFor({ timeout: 15000 });
    for (let i = 0; i < 100 && mails().length === before; i++) await page.waitForTimeout(100);
    await page.waitForTimeout(500);
    const sent = mails()
      .slice(before)
      .map((f) => readFileSync(join(outbox, f), "utf8"));
    if (!sent.some((m) => /^To: dev-admin@/m.test(m)))
      throw new Error(`the admin was not mailed: ${sent.length} mails`);
    if (sent.some((m) => /victim@example\.com/.test(m.split("\n\n")[0])))
      throw new Error("a visitor's message mailed the address typed into it");
    console.log(
      "  ✓ outgoing mail: a visitor's contact message mails the admin, never the address typed into it",
    );
  } catch (error) {
    console.log(
      `  ✗ outgoing mail from a visitor: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("outgoing mail from a visitor");
  } finally {
    await browser.close();
    // Removed by operations, not undone: an undo puts back the database file under the
    // running server.
    for (const name of ["messageIn", "messageEcho"].slice(0, added))
      ok(smithable(dir, "op", "removeOutgoing", name));
  }
}

/**
 * A receiver for the status starter's calls (integrations.md §4.1), started before its dev server
 * so the target's address and secret are in its environment: it keeps each call's body and
 * whether its signature was right.
 */
async function callReceiver() {
  const secret = "test-secret";
  const calls = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const signed = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
      calls.push({
        body,
        event: req.headers["x-event"],
        signed: req.headers["x-signature-256"] === signed,
        key: req.headers["idempotency-key"],
      });
      res.writeHead(204).end();
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  // A stand-in for the hosted service's egress proxy: the app calls the receiver by a name only the
  // proxy knows, through a CONNECT tunnel with the credential, and anything else is refused.
  const tunnels = [];
  const proxy = createServer((req, res) => res.writeHead(403).end());
  proxy.on("connect", (req, socket) => {
    tunnels.push({ to: req.url, credential: req.headers["proxy-authorization"] });
    if (
      req.url !== `receiver.test:${port}` ||
      req.headers["proxy-authorization"] !== `Basic ${btoa("app:egress")}`
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n");
      return;
    }
    const upstream = connect(port, "127.0.0.1", () => {
      socket.write("HTTP/1.1 200 Connection established\r\n\r\n");
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
  });
  await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
  const egress = `http://app:egress@127.0.0.1:${proxy.address().port}`;
  process.env.OUTGOING_STATUSFEED_URL = `http://receiver.test:${port}/hook`;
  process.env.OUTGOING_STATUSFEED_SECRET = secret;
  // And the secret of the incoming call incomingFlow adds (integrations.md §3).
  process.env.INCOMING_MONITORDOWN_SECRET = "incoming-secret";
  return {
    calls,
    tunnels,
    // Only for the status app's server: what a hosted app is started with.
    env: {
      HTTP_PROXY: egress,
      HTTPS_PROXY: egress,
      NO_PROXY: "localhost,127.0.0.1",
      NODE_USE_ENV_PROXY: "1",
    },
    close: () => {
      server.close();
      proxy.close();
    },
  };
}

/**
 * A mail that becomes a record (an incoming call with mail: true): the host passes a mail on and
 * the booking site's messages get it, sender, subject and text in their fields.
 */
async function incomingMailFlow(dir, base) {
  try {
    const added = smithable(
      dir,
      "op",
      "addIncoming",
      "support",
      "--mail",
      "--create",
      "Message",
      "--fields",
      "from=email",
      "--fields",
      "subject=name",
      "--fields",
      "body=message",
    );
    if (added.code !== 0) throw new Error(added.out);
    let answer;
    for (let i = 0; i < 60; i++) {
      answer = await fetch(`${base}/incoming/support`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer support-secret" },
        body: JSON.stringify({
          from: "Ada Lovelace <ada@example.org>",
          to: "hello@studio.example",
          subject: "A question about Tuesdays",
          text: "Is there a class on Tuesday evenings?",
          attachments: [],
        }),
      });
      if (answer.status !== 404) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (answer.status !== 201)
      throw new Error(`the mail answers ${answer.status}: ${await answer.text()}`);
    const { id } = await answer.json();
    const [row] = query(dir, `select name, email, message from messages where id = ${Number(id)}`);
    if (
      row?.email !== "ada@example.org" ||
      row?.name !== "A question about Tuesdays" ||
      row?.message !== "Is there a class on Tuesday evenings?"
    )
      throw new Error(`the message: ${JSON.stringify(row)}`);
    console.log(
      "  ✓ incoming mail: a mail passed on becomes a message, its sender's address, subject and text in their fields",
    );
  } catch (error) {
    console.log(`  ✗ incoming mail: ${error.message.split("\n")[0]}`);
    failures.push("incoming mail");
  } finally {
    smithable(dir, "op", "removeIncoming", "support");
  }
}

/**
 * An incoming call (integrations.md §3): a monitor posts to /incoming/monitorDown with the
 * secret and an incident is added from its JSON; a wrong secret is refused; the same call again
 * (its Idempotency-Key) adds nothing.
 */
async function incomingFlow(dir, base) {
  try {
    const added = smithable(
      dir,
      "op",
      "addIncoming",
      "monitorDown",
      "--create",
      "Incident",
      "--set",
      "title={check.name} is not responding",
      "--set",
      "status=investigating",
      "--set",
      "detectedAt=NOW()",
      "--as",
      "staff",
    );
    if (added.code !== 0) throw new Error(added.out);
    const call = (secret, key) =>
      fetch(`${base}/incoming/monitorDown`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secret}`,
          ...(key ? { "idempotency-key": key } : {}),
        },
        body: JSON.stringify({ check: { name: "Checkout API" } }),
      });
    // The dev server finds the new route a moment after the change.
    let answer;
    for (let i = 0; i < 60; i++) {
      answer = await call("incoming-secret", "call-1");
      if (answer.status !== 404) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (answer.status !== 201)
      throw new Error(`the call answers ${answer.status}: ${await answer.text()}`);
    const { id } = await answer.json();
    const [row] = query(dir, `select title, status from incidents where id = ${Number(id)}`);
    if (row?.title !== "Checkout API is not responding" || row?.status !== "investigating")
      throw new Error(`the incident: ${JSON.stringify(row)}`);
    if ((await call("wrong", "call-2")).status !== 401) throw new Error("a wrong secret was taken");
    const again = await call("incoming-secret", "call-1");
    if (again.status !== 200) throw new Error(`a repeat answers ${again.status}`);
    const [{ n }] = query(
      dir,
      "select count(*) as n from incidents where title = 'Checkout API is not responding'",
    );
    if (n !== 1) throw new Error(`a repeat added an incident (${n})`);
    console.log(
      "  ✓ incoming call: a monitor's call with the secret adds an incident from its JSON; a wrong secret is refused; the same call again adds nothing",
    );
  } catch (error) {
    console.log(`  ✗ incoming call: ${error.message.split("\n")[0]}`);
    failures.push("incoming call");
  } finally {
    smithable(dir, "op", "removeIncoming", "monitorDown");
  }
}

/**
 * A call to a named target (integrations.md §4.1): an incident that becomes resolved is sent to
 * the status feed, signed with its secret, as the API gives it; Activity says so.
 */
async function callFlow(dir, base, receiver) {
  const ok = (r) => {
    if (r.code !== 0) throw new Error(r.out);
  };
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let added = false;
  try {
    ok(
      smithable(
        dir,
        "op",
        "addOutgoing",
        "incidentResolved",
        "Incident changed",
        "--where",
        "status=resolved",
        "--to",
        "statusFeed",
      ),
    );
    added = true;
    const [{ id, title }] = query(
      dir,
      "select id, title from incidents where status != 'resolved' order by id limit 1",
    );
    await signInAs(page, base, "admin");
    await open(page, `${base}/incidents/${id}`);
    await page
      .getByLabel(/^Status/)
      .first()
      .selectOption("resolved");
    await page.getByRole("button", { name: "Save changes" }).click();
    for (let i = 0; i < 100 && receiver.calls.length === 0; i++) await page.waitForTimeout(100);
    const call = receiver.calls.at(-1);
    if (!call) throw new Error("no call arrived");
    if (!call.signed) throw new Error("the signature does not match the secret");
    // A repeat can be told apart: the call carries a key of its own, the same on every try.
    if (!/^\d+-\d+$/.test(call.key ?? ""))
      throw new Error(`the call has no Idempotency-Key (${call.key})`);
    // As a hosted app does: through the egress proxy, with its credential, by a name the app never
    // looked up itself.
    if (
      !receiver.tunnels.some(
        (t) => t.to.startsWith("receiver.test:") && t.credential === `Basic ${btoa("app:egress")}`,
      )
    )
      throw new Error(
        `the call did not go through the egress proxy: ${JSON.stringify(receiver.tunnels)}`,
      );
    const sent = JSON.parse(call.body);
    if (
      call.event !== "incidentResolved" ||
      sent.event !== "incidentResolved" ||
      sent.happened !== "changed" ||
      sent.record?.id !== id ||
      sent.record?.title !== title ||
      sent.record?.status !== "resolved"
    )
      throw new Error(`the call: ${call.body.slice(0, 300)}`);
    for (
      let i = 0;
      i < 50 && !query(dir, "select id from audit_log where action = 'called'").length;
      i++
    )
      await page.waitForTimeout(100);
    if (
      !query(dir, "select details from audit_log where action = 'called'").some((l) =>
        l.details.includes('"status":204'),
      )
    )
      throw new Error("no Activity line for the call");
    // A target's deliveries: Activity filtered to it has the call's line and none of the rest.
    await open(page, `${base}/team/activity?target=statusFeed`);
    if ((await page.getByLabel("Sent to").inputValue()) !== "statusFeed")
      throw new Error("Activity has no filter for the target");
    // Whether deliveries work, at a glance: the last call's answer.
    const summary = page.locator('[data-part="target-summary"]');
    if (
      !/Calls to statusFeed/.test(await summary.innerText()) ||
      !/answered 204/.test(await summary.innerText())
    )
      throw new Error(`the summary says ${await summary.innerText()}`);
    const delivered = page.locator('[data-kit="activity-log"] [data-part="line"]');
    await delivered.filter({ hasText: "called" }).first().waitFor({ timeout: 10000 });
    if ((await delivered.filter({ hasText: /changed|created/ }).count()) > 0)
      throw new Error("the target's deliveries show other lines");
    console.log(
      "  ✓ outgoing call: an incident that becomes resolved is sent to the status feed, signed with its secret, as the API gives it; Activity has the line, and Activity for the target shows its deliveries only; it went through a stand-in egress proxy with its credential",
    );
  } catch (error) {
    console.log(
      `  ✗ outgoing call: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("outgoing call");
  } finally {
    await browser.close();
    // Removed by an operation, not undone: an undo puts back the database file under the server.
    if (added) ok(smithable(dir, "op", "removeOutgoing", "incidentResolved"));
  }
}

/**
 * The trash through the API (docs/design/trash.md §4), with tasks in a trash: a delete moves a
 * task there; reading it answers 410 with the restore address; ?trashed=true lists it for a key
 * whose role may delete and not for the assistant's; restore brings it back; ?permanent=true
 * removes it for good.
 */
async function apiTrashFlow(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await signInAs(page, base, "admin");
    await open(page, `${base}/team`);
    const keys = page.locator('[data-kit="keys"]');
    const make = async (purpose, role) => {
      await keys.getByLabel("What it is for").fill(purpose);
      await keys.getByLabel("Role").selectOption(role);
      await keys.getByRole("button", { name: "Make a key" }).click();
      const shown = keys.locator('[data-part="key"]');
      await shown.waitFor({ timeout: 10000 });
      const key = await shown.textContent();
      await open(page, `${base}/team`);
      return key;
    };
    const admin = await make("Trash admin", "admin");
    const assistant = await make("Trash assistant", "assistant");
    const call = (key, path, init = {}) =>
      fetch(`${base}/api/v1${path}`, {
        ...init,
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      });
    const [project] = (await (await call(admin, "/projects")).json()).items;
    const task = await (
      await call(admin, "/tasks", {
        method: "POST",
        body: JSON.stringify({ title: "Into the trash", project: project.id }),
      })
    ).json();
    if ((await call(admin, `/tasks/${task.id}`, { method: "DELETE" })).status !== 204)
      throw new Error("the delete did not answer 204");
    const gone = await call(admin, `/tasks/${task.id}`);
    const said = await gone.json();
    if (
      gone.status !== 410 ||
      said.restore !== `/api/v1/tasks/${task.id}/restore` ||
      !said.deletedAt
    )
      throw new Error(`reading a trashed task: ${gone.status} ${JSON.stringify(said)}`);
    const listed = await (await call(admin, "/tasks?trashed=true")).json();
    if (!listed.items.some((t) => t.id === task.id && t.deletedAt))
      throw new Error(`the admin's trash: ${JSON.stringify(listed).slice(0, 200)}`);
    const theirs = await (await call(assistant, "/tasks?trashed=true")).json();
    if (theirs.items.some((t) => t.id === task.id))
      throw new Error("a role that may not delete sees the trash");
    if ((await call(assistant, `/tasks/${task.id}/restore`, { method: "POST" })).status !== 404)
      throw new Error("a role that may not delete restored a task");
    const back = await call(admin, `/tasks/${task.id}/restore`, { method: "POST" });
    if (back.status !== 200 || (await back.json()).title !== "Into the trash")
      throw new Error(`restore answered ${back.status}`);
    if ((await call(admin, `/tasks/${task.id}`)).status !== 200)
      throw new Error("the restored task does not read");
    await call(admin, `/tasks/${task.id}`, { method: "DELETE" });
    if (
      (await call(admin, `/tasks/${task.id}?permanent=true`, { method: "DELETE" })).status !== 204
    )
      throw new Error("the permanent delete did not answer 204");
    if ((await call(admin, `/tasks/${task.id}`)).status !== 404)
      throw new Error("a task removed for good still answers");
    console.log(
      "  ✓ api: a delete moves a task to the trash; reading it answers 410 with the restore address; ?trashed=true lists it for an admin's key and not the assistant's; restore brings it back; ?permanent=true removes it for good",
    );
    // A project its tasks point to (docs/design/delete-together.md): refused with the facts,
    // taken along with ?together=true, a task not restored alone, restored together, and
    // removed for good together.
    const made = await (
      await call(admin, "/projects", { method: "POST", body: JSON.stringify({ name: "Together" }) })
    ).json();
    const inIt = await (
      await call(admin, "/tasks", {
        method: "POST",
        body: JSON.stringify({ title: "Goes with it", project: made.id }),
      })
    ).json();
    const refused = await call(admin, `/projects/${made.id}`, { method: "DELETE" });
    const facts = await refused.json();
    if (
      refused.status !== 409 ||
      facts.together !== true ||
      !facts.with?.some((e) => e.model === "Task" && e.count === 1) ||
      !/is used by 1 task\. Pass together=true/.test(facts.title)
    )
      throw new Error(`deleting a project with a task: ${refused.status} ${JSON.stringify(facts)}`);
    if (
      (await call(admin, `/projects/${made.id}?together=true`, { method: "DELETE" })).status !== 204
    )
      throw new Error("the delete together did not answer 204");
    if ((await call(admin, `/tasks/${inIt.id}`)).status !== 410)
      throw new Error("the task did not go to the trash with its project");
    const alone = await call(admin, `/tasks/${inIt.id}/restore`, { method: "POST" });
    if (
      alone.status !== 409 ||
      !/Restore the project "Together" first/.test((await alone.json()).title)
    )
      throw new Error(`restoring the task alone answered ${alone.status}`);
    if ((await call(admin, `/projects/${made.id}/restore`, { method: "POST" })).status !== 200)
      throw new Error("the project was not restored");
    if ((await call(admin, `/tasks/${inIt.id}`)).status !== 200)
      throw new Error("the task did not come back with its project");
    await call(admin, `/projects/${made.id}?together=true`, { method: "DELETE" });
    if (
      (await call(admin, `/projects/${made.id}?permanent=true`, { method: "DELETE" })).status !==
      204
    )
      throw new Error("the permanent delete of the project did not answer 204");
    if ((await call(admin, `/tasks/${inIt.id}`)).status !== 404)
      throw new Error("the task did not go for good with its project");
    console.log(
      "  ✓ api: deleting a project with a task answers 409 with the facts; ?together=true takes the task along; the task is not restored alone; the project's restore brings it back; removing the project for good removes the task",
    );
  } catch (error) {
    console.log(
      `  ✗ api trash: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("api trash flow");
  } finally {
    await browser.close();
  }
}

/**
 * Paging (docs/design/paging.md): with 1,200 more customers the list shows fifty a page with
 * the count, Next goes to ?page=2, a page past the end shows the remainder, and a filter
 * composes with the page.
 */
async function pagingFlow(dir, base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const now = Date.now();
  write(
    dir,
    `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1200)
     INSERT INTO customers (name, email, segment, created_at, updated_at)
     SELECT printf('Paged %04d', i), 'paged' || i || '@example.org',
       CASE WHEN i % 3 = 0 THEN 'government' ELSE 'smb' END, ${now}, ${now} FROM n`,
  );
  const rows = () => page.locator('tr[data-part="row"]').count();
  const counted = async () =>
    (await page.getByRole("navigation", { name: "Pages" }).innerText()).match(
      /([\d,]+)–([\d,]+) of ([\d,]+)/,
    );
  const number = (text) => Number(text.replaceAll(",", ""));
  try {
    await signInAs(page, base, "admin");
    await open(page, `${base}/customers`);
    const first = await counted();
    if (!first || first[1] !== "1" || first[2] !== "50" || number(first[3]) < 1200)
      throw new Error(`the first page says ${first?.[0]}`);
    if ((await rows()) !== 50) throw new Error(`the first page shows ${await rows()} rows`);
    const total = number(first[3]);
    await page.getByRole("button", { name: "Next" }).click();
    await page.waitForURL(/page=2/);
    await page.getByText(`51–100 of ${first[3]}`).waitFor({ timeout: 10000 });
    // Past the end: the last page, with what is left.
    await open(page, `${base}/customers?page=999`);
    const last = await counted();
    const left = total - Math.floor((total - 1) / 50) * 50;
    if (!last || number(last[3]) !== total || (await rows()) !== left)
      throw new Error(`?page=999 says ${last?.[0]} with ${await rows()} rows (${left} expected)`);
    if (!(await page.getByRole("button", { name: "Next" }).isDisabled()))
      throw new Error("Next is offered on the last page");
    // A filter and the page compose: the second fifty of the government customers.
    await open(page, `${base}/customers?segment=government&page=2`);
    const filtered = await counted();
    if (!filtered || filtered[1] !== "51" || number(filtered[3]) < 400)
      throw new Error(`government page 2 says ${filtered?.[0]}`);
    console.log(
      "  ✓ browser: a list of 1,200 more shows fifty a page with the count, Next goes to ?page=2, a page past the end shows the remainder, and a filter composes with the page",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("paging flow");
  } finally {
    write(dir, "DELETE FROM customers WHERE email LIKE 'paged%@example.org'");
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
    // Export CSV: the list as it is filtered and sorted, then only the chosen row.
    const saved = async (click) => {
      const [file] = await Promise.all([page.waitForEvent("download"), click()]);
      return readFileSync(await file.path(), "utf8");
    };
    const csv = await saved(() => page.getByRole("button", { name: "Export CSV" }).click());
    const lines = csv.split("\r\n");
    if (!csv.startsWith("\uFEFF") || !/^\uFEFFName,/.test(lines[0] ?? ""))
      throw new Error(`the CSV's header: ${lines[0]}`);
    if (
      !lines[1]?.startsWith("Nordic Timber Oy,") ||
      !lines[2]?.startsWith("Helios Energy,") ||
      lines.length !== 4
    )
      throw new Error(`the CSV's rows: ${lines.slice(1).join(" | ")}`);
    if (!/,\d+\.\d{2}(,|$)/.test(lines[1] ?? ""))
      throw new Error(`no amount as a decimal: ${lines[1]}`);
    await page.locator("tr", { hasText: "Helios Energy" }).getByRole("checkbox").check();
    const chosen = await saved(() =>
      page
        .locator('[data-kit="selection-bar"]')
        .getByRole("button", { name: "Export CSV" })
        .click(),
    );
    const chosenLines = chosen.split("\r\n");
    if (chosenLines.length !== 3 || !chosenLines[1]?.startsWith("Helios Energy,"))
      throw new Error(`the chosen row's CSV: ${chosenLines.join(" | ")}`);
    await page.locator("tr", { hasText: "Helios Energy" }).getByRole("checkbox").uncheck();
    console.log(
      "  ✓ browser: Export CSV saves the list as filtered and sorted (labels as headers, amounts as decimals); the selection bar's saves the chosen rows",
    );
    await page.getByRole("button", { name: "Remove the segment filter" }).click();
    await page.waitForURL((url) => !url.searchParams.has("segment"));
    // "Mine": the admin manages no customers; a visitor is not offered it at all.
    // The box follows the address, which changes a moment after the click.
    await page.getByRole("checkbox", { name: "Mine" }).click();
    await page.waitForURL(/owner=mine/);
    await page.getByText("No customers match the search and filters.").waitFor({ timeout: 10000 });
    // A range removed by its chip stays removed: what was typed in it goes too, or the typed
    // range came back with the next render.
    await page.getByRole("button", { name: "Remove the credit limit filter" }).click();
    await page.waitForURL((url) => !url.searchParams.has("creditLimit"));
    await page.waitForTimeout(1000);
    if (new URL(page.url()).searchParams.has("creditLimit"))
      throw new Error("the removed range came back");
    if ((await page.getByRole("spinbutton", { name: "Credit limit from" }).inputValue()) !== "")
      throw new Error("the removed range still shows its from");
    await page.getByRole("checkbox", { name: "Mine" }).click();
    await page.waitForURL((url) => !url.searchParams.has("owner"));
    // A sortable column's header sorts: once ascending, again descending, a third time the
    // page's own order. The list is high to low now (from Sort by), so the next click is off.
    const header = page.getByRole("button", { name: "Credit limit", exact: true });
    await header.click();
    await page.waitForURL((url) => !url.searchParams.has("sort"));
    await header.click();
    await page.waitForURL(/sort=creditLimit(&|$)/);
    if ((await page.locator("th[aria-sort=ascending]").count()) !== 1)
      throw new Error("the sorted column does not say it is ascending");
    await header.click();
    await page.waitForURL(/sort=-creditLimit/);
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
    await page
      .getByText("Your message is in the preview's outbox, not sent: the preview sends no mail.")
      .waitFor({ timeout: 10000 });
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
/**
 * Files reviewed before others see them (docs/design/file-review.md), on the marketplace's photos
 * (an optional field: the item shows, its waiting photo not): a seller's new photo waits; its
 * seller is told so, a visitor does not get it; the admin is told and sees the number in the menu,
 * rejects it with a reason the seller then reads, approves the next one, and visitors get it.
 */
async function reviewFlow(dir, base) {
  const browser = await chromium.launch();
  const seller = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const admin = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const samples = join(dir, "public", "images", "samples");
  const sample = readFileSync(
    join(
      samples,
      readdirSync(samples).find((f) => f.endsWith(".webp")),
    ),
  );
  const outbox = join(dir, "data", "mail", "outbox");
  const addPhoto = async (name) => {
    // A file chosen before the page's handlers are attached is lost (body[data-hydrated]).
    await seller.locator("body[data-hydrated]").waitFor({ timeout: 30000 });
    const form = seller.locator('[data-kit="model-form"]');
    const before = await form.locator('[data-part="picture"]').count();
    await form.locator('input[type="file"][accept="image/*"]').first().setInputFiles({
      name,
      mimeType: "image/webp",
      buffer: sample,
    });
    await seller
      .waitForFunction(
        (n) =>
          document.querySelectorAll('[data-kit="model-form"] [data-part="picture"]').length > n,
        before,
        { timeout: 20000 },
      )
      .catch(async (error) => {
        const said = await form.getByRole("alert").allInnerTexts();
        throw new Error(
          `the photo was not added${said.length ? `: ${said.join(" ")}` : ""} (${error.message})`,
        );
      });
  };
  const notice = () => seller.locator('[data-part="review-notice"]');
  const photo = async (id) => (await fetch(`${base}/files/item/${id}/photos/0`)).status;
  try {
    // The admin first, so a reviewer exists to be told.
    await signInAs(admin, base, "admin");
    await signInAs(seller, base, "member");
    await open(seller, `${base}/new`);
    await seller.getByRole("textbox", { name: "Title *" }).fill("Reviewed lamp");
    await seller
      .getByRole("textbox", { name: "Description *" })
      .fill("A lamp whose photo is reviewed.");
    await addPhoto("lamp.webp");
    await seller.getByRole("button", { name: "Create item" }).click();
    await seller.waitForURL(`${base}/`);
    await open(seller, `${base}/my-items`);
    await seller
      .locator('[data-part="row"]', { hasText: "Reviewed lamp" })
      .filter({ visible: true })
      .first()
      .click();
    await seller.waitForURL(/\/my-items\/\d+$/);
    const id = seller.url().match(/(\d+)$/)?.[1];
    await notice().getByText("Awaiting review").waitFor({ timeout: 10000 });
    if ((await photo(id)) !== 404) throw new Error("a visitor gets the waiting photo");
    // Photos are required: until they are approved the item is not there for anyone else.
    const listed = async () =>
      // The search box echoes what was asked: ask for less than the title.
      (await (await fetch(`${base}/?q=Reviewed`)).text()).includes("Reviewed lamp");
    if (await listed()) throw new Error("a visitor finds the item whose photo waits");
    const page = await fetch(`${base}/${id}`);
    if ((await page.text()).includes("A lamp whose photo is reviewed."))
      throw new Error("a visitor opens the item whose photo waits");
    console.log(
      "  ✓ browser: a seller's new item waits for its photo's review: the seller is told, a visitor neither finds nor opens it",
    );

    await open(admin, `${base}/`);
    const count = admin.locator('[data-part="count"]').filter({ visible: true }).first();
    await count.waitFor({ timeout: 10000 });
    if (Number(await count.innerText()) < 1)
      throw new Error(`the menu says ${await count.innerText()} wait`);
    for (let i = 0; ; i++) {
      const told =
        existsSync(outbox) &&
        readdirSync(outbox).some((f) =>
          /await(s)? review in Torget/.test(readFileSync(join(outbox, f), "utf8")),
        );
      if (told) break;
      if (i === 50) throw new Error("no reviewer was told by mail");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    await open(admin, `${base}/review`);
    const card = admin.locator('[data-part="waiting"]', { hasText: "Reviewed lamp" });
    await card.getByRole("button", { name: "Reject" }).click();
    await card.getByLabel(/Why/).fill("Too dark to see the lamp.");
    await card.getByRole("button", { name: "Reject" }).click();
    await card.waitFor({ state: "detached", timeout: 10000 });
    await admin
      .locator('[data-part="decided"]', { hasText: "Too dark to see the lamp." })
      .waitFor();
    await seller.reload();
    await notice()
      .getByText("Rejected by a reviewer: Too dark to see the lamp.")
      .waitFor({ timeout: 10000 });
    if (await seller.locator('[data-kit="model-form"] [data-part="picture"]').count())
      throw new Error("the rejected photo is still on the item");
    console.log(
      "  ✓ browser: the admin is told by mail and in the menu, rejects the photo with a reason, and the seller reads it",
    );

    await addPhoto("lamp-2.webp");
    await seller.getByRole("button", { name: "Save changes" }).click();
    await seller.waitForURL(/\/my-items$/);
    await open(admin, `${base}/review`);
    await admin
      .locator('[data-part="waiting"]', { hasText: "Reviewed lamp" })
      .getByRole("button", { name: "Approve" })
      .click();
    await admin
      .locator('[data-part="decided"]', { hasText: "Approved" })
      .first()
      .waitFor({ timeout: 10000 });
    if ((await photo(id)) !== 200) throw new Error("a visitor does not get the approved photo");
    if (!(await listed())) throw new Error("a visitor does not find the approved item");
    console.log(
      "  ✓ browser: a new photo waits again, and once approved a visitor finds the item and gets its photo",
    );
  } finally {
    await browser.close();
  }
}

async function marketplaceFlow(dir, base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const outbox = join(dir, "data", "mail", "outbox");
  const titles = async () =>
    (await page.locator('[data-part="row"]').filter({ visible: true }).allInnerTexts()).map(
      // The first line, after the mark on a picture an AI made.
      (t) =>
        t
          .split("\n")
          .find((line) => line.trim() !== "AI")
          ?.trim(),
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
    // Photos are required and reviewed (reviewFlow tests the review): one, approved at once.
    await page.locator("body[data-hydrated]").waitFor({ timeout: 30000 });
    const samples = join(dir, "public", "images", "samples");
    await page
      .locator('[data-kit="model-form"] input[type="file"][accept="image/*"]')
      .first()
      .setInputFiles({
        name: "lamp.webp",
        mimeType: "image/webp",
        buffer: readFileSync(
          join(
            samples,
            readdirSync(samples).find((f) => f.endsWith(".webp")),
          ),
        ),
      });
    await page
      .locator('[data-kit="model-form"] [data-part="picture"]')
      .first()
      .waitFor({ timeout: 20000 });
    await page.getByRole("button", { name: "Create item" }).click();
    await page.waitForURL(`${base}/`);
    write(dir, "update file_reviews set state = 'approved', decided_at = 0");
    await open(page, `${base}/my-items`);
    if ((await titles()).join() !== "Test lamp")
      throw new Error(`My items shows ${(await titles()).join()}`);
    // Who sells an item is told to its seller, never to a visitor (the owner is not shown).
    const owned = /ownerId["']?\s*:\s*"/;
    const visitorSees = await (await fetch(`${base}/?q=Test%20lamp`)).text();
    if (!visitorSees.includes("Test lamp") || owned.test(visitorSees))
      throw new Error("a visitor's page tells who sells the item");
    const sellerSees = await (await page.request.get(`${base}/my-items`)).text();
    if (!owned.test(sellerSees)) throw new Error("the seller's own page lost the owner");
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
      "  ✓ browser: a member sells an item and sees only it under My items, a visitor is not told who sells it, and saves and unsaves another",
    );

    await signInAs(page, base, "admin");
    await open(page, `${base}/?q=Test%20lamp`);
    await page.getByRole("button", { name: "Test lamp" }).filter({ visible: true }).first().click();
    await page.waitForURL(/\/\d+$/);
    const before = existsSync(outbox) ? readdirSync(outbox).length : 0;
    await page.getByRole("textbox", { name: "Message" }).fill("Is the lamp still for sale?");
    await page.getByRole("button", { name: "Send" }).click();
    await page
      .getByText("Your message is in the preview's outbox, not sent: the preview sends no mail.")
      .waitFor({ timeout: 10000 });
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
    // A standard action: the row's button resolves it and adds an update saying so. With three
    // actions or more, all but the first are behind the row's "…" button.
    const card = page.locator("tr", { hasText: "Card payments slow at checkout" });
    const more = card.locator('[data-part="more-actions"] summary');
    if (await more.count()) await more.click();
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
    await page.waitForURL(/\/updates\/\d+/);
    await page
      .getByText("The errors are back; we are looking again.")
      .first()
      .waitFor({ timeout: 10000 });
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
    // The preview says a key reaches the app from outside only once it is published.
    await keys
      .locator('[data-part="preview-note"]')
      .getByText("once it is published")
      .waitFor({ timeout: 10000 });
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
    // Filters, search and sort as query parameters (assistant.md §3), behind the same access.
    const resolvedOnly = await (await api("/incidents?status=resolved")).json();
    if (!resolvedOnly.items.length || resolvedOnly.items.some((i) => i.status !== "resolved"))
      throw new Error(`?status=resolved gave ${JSON.stringify(resolvedOnly).slice(0, 200)}`);
    const payments = await (await api("/incidents?component=Payments")).json();
    if (payments.total !== 1 || payments.items[0].title !== "Card payments slow at checkout")
      throw new Error(`?component=Payments gave ${JSON.stringify(payments).slice(0, 200)}`);
    const searched = await (await api("/incidents?search=certificate")).json();
    if (searched.total !== 1) throw new Error(`?search=certificate gave ${searched.total}`);
    const sorted = await (await api("/incidents?sort=detectedAt")).json();
    if (sorted.items[0]?.title !== "Website unreachable for twenty minutes")
      throw new Error(`?sort=detectedAt began with ${sorted.items[0]?.title}`);
    const unknown = await api("/incidents?colour=red");
    if (unknown.status !== 400 || !(await unknown.json()).title.includes("Fields: title, status"))
      throw new Error(`an unknown field gave ${unknown.status}`);
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
    if (!started?.capabilities?.tools || !started.instructions?.includes("Incident (incidents)"))
      throw new Error(`initialize gave ${JSON.stringify(started).slice(0, 300)}`);
    // The seven tools (assistant.md §3), each marked as reading only or changing what exists.
    const toolList = (await rpc("tools/list", {})).tools;
    const names = toolList.map((tool) => tool.name).sort();
    if (names.join() !== "add,change,describe,find,measure,read,run")
      throw new Error(`the tools are ${names.join(", ")}`);
    if (!toolList.find((tool) => tool.name === "find").annotations?.readOnlyHint)
      throw new Error("find is not marked as reading only");
    const useTool = (name, args) => rpc("tools/call", { name, arguments: args });
    const found = (
      await useTool("find", {
        kind: "Incident",
        where: { status: "resolved" },
        fields: ["component"],
      })
    ).structuredContent;
    if (
      found?.columns?.join() !== "id,title,component" ||
      !found.total ||
      !found.rows.some((row) => typeof row[2]?.title === "string")
    )
      throw new Error(`find gave ${JSON.stringify(found).slice(0, 300)}`);
    const counted = (await useTool("measure", { kind: "Incident", by: "status" }))
      .structuredContent;
    if (!counted?.rows?.some((r) => r.value === "resolved" && r.number >= 1))
      throw new Error(`measure gave ${JSON.stringify(counted)}`);
    // Names as people write them: part of a title in any case, a reference by part of its
    // title, every word of a search, an action on a record given by its title.
    const partly = (await useTool("find", { kind: "Incident", where: { title: "CARD PAYMENTS" } }))
      .structuredContent;
    if (partly?.total !== 1) throw new Error(`part of a title found ${JSON.stringify(partly)}`);
    const byComponent = (
      await useTool("find", { kind: "Incident", where: { component: "payments" } })
    ).structuredContent;
    if (byComponent?.total !== 1)
      throw new Error(`a component by part of its name found ${JSON.stringify(byComponent)}`);
    const words = (await useTool("find", { kind: "Incident", search: "checkout payments" }))
      .structuredContent;
    if (words?.total !== 1) throw new Error(`a search by two words found ${JSON.stringify(words)}`);
    const nothing = (await useTool("find", { kind: "Incident", search: "volcano" }))
      .structuredContent;
    if (!nothing?.note?.includes("A component is matched with where"))
      throw new Error(`an empty search said ${JSON.stringify(nothing)}`);
    const byTitle = await useTool("read", {
      kind: "Incident",
      id: "Website unreachable for twenty minutes",
    });
    if (
      byTitle.isError ||
      byTitle.structuredContent?.title !== "Website unreachable for twenty minutes"
    )
      throw new Error(`reading by title gave ${JSON.stringify(byTitle)}`);
    const missing = await useTool("read", { kind: "Incident", id: "No such outage" });
    if (!missing.isError || !missing.content[0].text.includes("that you may read; find it first"))
      throw new Error(`a missing title gave ${JSON.stringify(missing)}`);
    const refused = await useTool("delete", { kind: "Incident", id: 1 });
    if (!refused.isError) throw new Error("a delete tool answered");
    const wrongField = await useTool("find", { kind: "Incident", where: { colour: "red" } });
    if (!wrongField.isError || !wrongField.content[0].text.includes("Fields:"))
      throw new Error(`an unknown field gave ${JSON.stringify(wrongField)}`);
    // An assistant without a key is a visitor too: finding and reading what anyone may read.
    const strangerTools = await (
      await fetch(`${base}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      })
    ).json();
    const offered = strangerTools.result.tools.map((tool) => tool.name).sort();
    if (offered.join() !== "describe,find,measure,read")
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
    await apiSecurityChecks(base, shown);
    page.once("dialog", (d) => d.accept());
    await keyRow.getByRole("button", { name: "Revoke" }).click();
    await keyRow.getByText(/^Revoked/).waitFor({ timeout: 10000 });
    if ((await api("/incidents")).status !== 401) throw new Error("a revoked key still answers");
    console.log(
      "  ✓ browser: an admin makes an API key on the team page and gets a call to copy that works and an assistant's lines; with it a program lists, filters, searches and sorts incidents, adds one and resolves it, a model not offered is not there, the description says what is, and an assistant finds, counts and describes incidents with the seven tools at /mcp (no delete tool); without a key a program or assistant reads only what anyone may, is refused the rest and held to ten writes a minute; revoked, it stops",
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
 * The app for programs and assistants (docs/design/api-only.md §4): an admin makes a key with the
 * assistant role in the browser; with it a program lists, adds, changes and completes a task, is
 * refused a delete, and an assistant reads the tools' list.
 */
async function apiFlow(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await signInAs(page, base, "admin");
    await open(page, `${base}/team`);
    const keys = page.locator('[data-kit="keys"]');
    await keys.getByLabel("What it is for").fill("Assistant");
    // An assistant's role is the first a key is offered.
    if ((await keys.getByLabel("Role").inputValue()) !== "assistant")
      throw new Error("a key does not start with the assistant role");
    await keys.getByRole("button", { name: "Make a key" }).click();
    const key = await keys.locator('[data-part="key"]').textContent({ timeout: 10000 });
    const api = (path, init = {}) =>
      fetch(`${base}/api/v1${path}`, {
        ...init,
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      });
    // Nothing is public: without a key there is nothing to read, and the description names no
    // model or field to a stranger.
    if ((await fetch(`${base}/api/v1/tasks`)).status !== 401)
      throw new Error("the tasks answered without a key");
    const described = await (await fetch(`${base}/api/v1/openapi.json`)).json();
    if (
      Object.keys(described.paths ?? {}).length ||
      /Task|Project|Note/.test(JSON.stringify(described.components))
    )
      throw new Error("a stranger's description names the records");
    const listed = await (await api("/tasks")).json();
    if (!listed.items?.some((t) => t.title === "Draft the newsletter"))
      throw new Error(`listing tasks gave ${JSON.stringify(listed).slice(0, 200)}`);
    // The same list as CSV, for a spreadsheet; without a key, nothing.
    const csv = await api("/tasks.csv?sort=title");
    const bytes = new Uint8Array(await csv.arrayBuffer());
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    if (
      !csv.headers.get("content-type")?.startsWith("text/csv") ||
      !text.startsWith("\uFEFFTitle,") ||
      !text.includes("Draft the newsletter")
    )
      throw new Error(`tasks as CSV gave ${csv.status} ${text.slice(0, 200)}`);
    if ((await fetch(`${base}/api/v1/tasks.csv`)).status !== 401)
      throw new Error("the tasks' CSV answered without a key");
    const project = (await (await api("/projects")).json()).items[0];
    const added = await api("/tasks", {
      method: "POST",
      body: JSON.stringify({ title: "Send the invoice", project: project.id }),
    });
    const task = await added.json();
    if (added.status !== 201 || task.status !== "todo")
      throw new Error(`adding gave ${added.status} ${JSON.stringify(task)}`);
    const changed = await (
      await api(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "doing" }),
      })
    ).json();
    if (changed.status !== "doing") throw new Error(`changing gave ${JSON.stringify(changed)}`);
    const done = await (await api(`/tasks/${task.id}/actions/complete`, { method: "POST" })).json();
    if (done.status !== "done") throw new Error(`completing gave ${JSON.stringify(done)}`);
    // The assistant role deletes nothing: refused, in the app's words.
    const refused = await api(`/tasks/${task.id}`, { method: "DELETE" });
    if (refused.status !== 403) throw new Error(`deleting gave ${refused.status}`);
    // A document sent as the body (docs/design/attachments.md §2), and fetched back as it was.
    const note = (await (await api("/notes")).json()).items[0];
    const pdf = Buffer.from("%PDF-1.4\n%%EOF\n");
    const attach = (body, name) =>
      fetch(`${base}/api/v1/notes/${note.id}/attachment`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/pdf",
          "x-file-name": name,
        },
        body,
      });
    const sent = await attach(pdf, "Brief.pdf");
    const stored = await sent.json();
    if (sent.status !== 200 || stored.name !== "Brief.pdf" || stored.type !== "application/pdf")
      throw new Error(`attaching gave ${sent.status} ${JSON.stringify(stored)}`);
    const fetched = await fetch(`${base}/api/v1/notes/${note.id}/attachment`, {
      headers: { authorization: `Bearer ${key}` },
    });
    if (!Buffer.from(await fetched.arrayBuffer()).equals(pdf))
      throw new Error(`fetching the attachment gave ${fetched.status}`);
    if ((await attach(Buffer.from("not a pdf"), "fake.pdf")).status !== 400)
      throw new Error("a file that only claims to be a PDF was taken");
    const tools = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });
    // The seven tools, with the assistant's actions under run; no delete tool.
    const listedTools = (await tools.json()).result.tools;
    const names = listedTools.map((tool) => tool.name).sort();
    if (names.join() !== "add,change,describe,find,measure,read,run")
      throw new Error(`the tools are ${names.join(", ")}`);
    const runs = listedTools.find((tool) => tool.name === "run").inputSchema.properties.action.enum;
    if (!runs.includes("complete") || !runs.includes("reopen"))
      throw new Error(`run offers ${runs.join(", ")}`);
    console.log(
      "  ✓ browser: an admin makes a key with the assistant role; with it a program lists, adds, changes and completes a task, is refused a delete, and an assistant reads the tools' list",
    );
    // The inspector on the data page: a question asked as the assistant role, read by the rules
    // and answered from the records; as a visitor, nothing here is open.
    await open(page, `${base}/admin`);
    await page.getByRole("link", { name: "Ask", exact: true }).click();
    await page.waitForURL(`${base}/admin/ask`);
    await page.getByLabel("Act as").selectOption("assistant");
    await page.getByLabel("Question").fill("how many tasks");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    const answered = page.locator("[data-answer]").first();
    await answered.getByText("From your records").waitFor({ timeout: 10000 });
    const number = await answered.locator(".text-2xl").textContent();
    if (!/^\d+$/.test(number ?? "")) throw new Error(`the inspector answered ${number}`);
    if (!(await page.getByText("Answers may come from an AI and can be wrong.").isVisible()))
      throw new Error("the inspector does not say answers may come from an AI");
    // Read aloud by the browser's own speech: the number is what it says.
    await page.evaluate(() => {
      window.__spoken = [];
      window.speechSynthesis.speak = (u) => window.__spoken.push(u.text);
    });
    await answered.getByRole("button", { name: "Read aloud" }).click();
    const said = await page.evaluate(() => window.__spoken.join(" "));
    if (!said.includes(number ?? "?")) throw new Error(`read aloud: "${said}"`);
    await page.getByLabel("Act as").selectOption("visitor");
    await page.getByLabel("Question").fill("how many tasks");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await page.locator("[data-answer]").nth(1).waitFor();
    const asVisitor = await page.locator("[data-answer]").first().textContent();
    if (asVisitor?.includes("From your records"))
      throw new Error(`a visitor was answered: ${asVisitor}`);
    // The inspector is the administrator's alone.
    await page.context().clearCookies();
    await signInAs(page, base, "member");
    await page.goto(`${base}/admin/ask`);
    await page.waitForLoadState("networkidle");
    if (await page.getByRole("heading", { name: "Ask the app" }).count())
      throw new Error("a member was given the inspector");
    console.log(
      "  ✓ browser: the inspector answers a question as the assistant role from the records (the rules, no model), says answers may come from an AI, reads the answer aloud, answers a visitor nothing, and is not a member's",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("api flow");
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
    // As the page's own upload says it comes from the app (a browser sends Sec-Fetch-Site).
    const refused = await page.request.post(`${base}/files/instructor/portrait`, {
      headers: { "content-type": "image/webp", "sec-fetch-site": "same-origin" },
      data: Buffer.from("not a picture"),
    });
    if (refused.status() !== 401) throw new Error(`a visitor could upload (${refused.status()})`);
    await signInAs(page, base, "admin");
    const junk = await page.request.post(`${base}/files/instructor/portrait`, {
      headers: { "content-type": "image/webp", "sec-fetch-site": "same-origin" },
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
 * The security checks of the gate for the API and the tools for assistants (on the status app,
 * with a key of the staff role): each is an attack the app must refuse. A key counts only in its
 * header; a malformed body or call is a 400 or a refusal, never a crash; a body cannot set what
 * the app sets (the id, the owner, the dates); no other site is let in; and a condition or a
 * search that looks like SQL is only a value.
 */
async function apiSecurityChecks(base, key) {
  const check = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ security: ${name}`);
    } catch (error) {
      console.log(`  ✗ security: ${name}\n    ${error.message.split("\n")[0]}`);
      failures.push(`security: ${name}`);
    }
  };
  const call = (path, init = {}) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        ...init.headers,
      },
    });
  await check(
    "a key counts only in the Authorization header, and a malformed one is refused",
    async () => {
      const incident = (title) =>
        JSON.stringify({ title, status: "investigating", detectedAt: new Date().toISOString() });
      const control = await call("/api/v1/incidents", {
        method: "POST",
        body: incident("From the header"),
      });
      if (control.status !== 201)
        throw new Error(`the same incident with the key in its header gave ${control.status}`);
      for (const name of ["key", "access_token", "api_key"]) {
        const posted = await fetch(`${base}/api/v1/incidents?${name}=${key}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: incident("From the address"),
        });
        if (posted.ok) throw new Error(`a key in the address (?${name}=) could add`);
      }
      for (const header of [
        "Basic " + btoa(`x:${key}`),
        "Bearer",
        `Bearer ${key}x`,
        `Bearer ${"a".repeat(5000)}`,
      ]) {
        const answer = await fetch(`${base}/api/v1/incidents`, {
          method: "POST",
          headers: { authorization: header, "content-type": "application/json" },
          body: JSON.stringify({ title: "Malformed key" }),
        });
        if (answer.status !== 401 && answer.status !== 429)
          throw new Error(`Authorization "${header.slice(0, 20)}…" gave ${answer.status}`);
      }
    },
  );
  await check("a malformed body is a 400 or 422 with the app's words, never a crash", async () => {
    for (const body of [
      "{not json",
      "[]",
      "null",
      '"text"',
      JSON.stringify({ title: 12 }),
      JSON.stringify({ title: { $gt: "" } }),
    ]) {
      const answer = await call("/api/v1/incidents", { method: "POST", body });
      if (answer.status >= 500 || answer.ok)
        throw new Error(`the body ${body.slice(0, 30)} gave ${answer.status}`);
      const problem = await answer.json().catch(() => ({}));
      if (
        typeof problem.title !== "string" ||
        /at \w+ \(|node_modules|\.ts:\d+/.test(JSON.stringify(problem))
      )
        throw new Error(
          `the body ${body.slice(0, 30)} was answered with ${JSON.stringify(problem).slice(0, 100)}`,
        );
    }
  });
  await check("a body cannot set what the app sets: the id, the owner, the dates", async () => {
    for (const extra of [
      {},
      { id: 9999 },
      { ownerId: "someone" },
      { createdAt: "2000-01-01T00:00:00Z" },
      { __proto__: { admin: true }, constructor: {} },
    ]) {
      const answer = await call("/api/v1/incidents", {
        method: "POST",
        body: JSON.stringify({
          title: "Set by the app",
          status: "investigating",
          detectedAt: new Date().toISOString(),
          ...extra,
        }),
      });
      const raw = JSON.stringify(extra);
      if (raw === "{}" && answer.status !== 201)
        throw new Error(`the body alone gave ${answer.status}`);
      if (answer.ok && raw !== "{}") throw new Error(`a body with ${raw} was taken`);
    }
  });
  await check("no other site is let in (no CORS grant)", async () => {
    const answer = await fetch(`${base}/api/v1/incidents`, {
      headers: { Origin: "https://evil.example" },
    });
    const preflight = await fetch(`${base}/api/v1/incidents`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization",
      },
    });
    for (const response of [answer, preflight]) {
      const allowed = response.headers.get("access-control-allow-origin");
      if (allowed === "*" || allowed === "https://evil.example")
        throw new Error(`Access-Control-Allow-Origin: ${allowed}`);
    }
  });
  await check(
    "a condition or a search that looks like SQL is only a value, through the API and the tools",
    async () => {
      // Where the list takes filters (an unknown value is refused), one shaped like SQL must
      // match nothing; anywhere, it must not crash or change a thing.
      const filters = (await call("/api/v1/incidents?status=no-such-status")).status === 400;
      for (const query of [
        "title=%27%20OR%201%3D1%20--",
        "search=%22%3B%20DROP%20TABLE%20incidents%3B%20--",
        "status=resolved%27%20OR%20%271%27%3D%271",
        "sort=title%3B%20DROP%20TABLE%20incidents",
      ]) {
        const answer = await call(`/api/v1/incidents?${query}`);
        if (answer.status >= 500) throw new Error(`?${query} gave ${answer.status}`);
        if (filters && answer.ok && (await answer.json()).total)
          throw new Error(`?${query} matched records`);
      }
      const rpc = async (body) => {
        const answer = await call("/mcp", {
          method: "POST",
          body: typeof body === "string" ? body : JSON.stringify(body),
        });
        if (answer.status >= 500)
          throw new Error(`/mcp gave ${answer.status} for ${String(body).slice(0, 30)}`);
        return answer.json().catch(() => ({}));
      };
      const found = await rpc({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "find", arguments: { kind: "Incident", where: { title: "' OR 1=1 --" } } },
      });
      if (found.result?.structuredContent?.total)
        throw new Error("a condition like SQL matched records");
      const user = await rpc({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "find", arguments: { kind: "User" } },
      });
      if (!user.result?.isError) throw new Error("a kind not offered (User) was answered");
      const unknown = await rpc({ jsonrpc: "2.0", id: 3, method: "admin/shutdown" });
      if (unknown.error?.code !== -32601)
        throw new Error(`an unknown method gave ${JSON.stringify(unknown)}`);
      await rpc("{not json");
      // The incidents are all still there.
      const still = await (await call("/api/v1/incidents")).json();
      if (!still.total) throw new Error("the incidents are gone");
    },
  );
  // Property-based (backlog A 63): random bodies, addresses and calls, as a careless or hostile
  // program sends them. Each is answered (a refusal is fine, and so is being held to the write
  // limit), never a server error, and no answer shows the app's insides. Last of the checks,
  // since the bodies spend the key's writes.
  await check(
    "random bodies, queries and calls: a refusal or an answer, never a crash",
    async () => {
      // FC_RUNS sets the runs of each, to hunt locally; the gate's few dozen keep it quick.
      const runs = (n) => ({ numRuns: Number(process.env.FC_RUNS ?? n) });
      const inside = /at \w+ \(|node_modules|\.ts:\d+|\bstack\b/;
      const answered = async (what, answer) => {
        const text = await answer.text();
        if (answer.status >= 500)
          throw new Error(`${what} gave ${answer.status}: ${text.slice(0, 120)}`);
        if (inside.test(text))
          throw new Error(`${what} showed the app's insides: ${text.slice(0, 160)}`);
      };
      const odd = fc.oneof(
        fc.jsonValue({ maxDepth: 3 }),
        fc.constantFrom(
          "",
          " ",
          "null",
          "-1",
          "1e999",
          "NaN",
          "{}",
          "[]",
          "' OR 1=1 --",
          "\u0000",
          "../../etc/passwd",
          "x".repeat(5000),
        ),
      );
      const incident = fc.dictionary(
        fc.constantFrom(
          "title",
          "status",
          "detectedAt",
          "component",
          "componentId",
          "updates",
          "id",
          "__proto__",
          "x",
        ),
        odd,
        { maxKeys: 6 },
      );
      const body = fc.oneof(
        incident.map((v) => JSON.stringify(v)),
        odd.map((v) => JSON.stringify(v)),
        fc.string({ maxLength: 200 }),
      );
      await fc.assert(
        fc.asyncProperty(body, async (b) => {
          await answered(
            `POST ${b.slice(0, 40)}`,
            await call("/api/v1/incidents", { method: "POST", body: b }),
          );
        }),
        runs(40),
      );
      const id = fc.oneof(
        fc.nat({ max: 20 }).map(String),
        fc.constantFrom("0", "-1", "1.5", "abc", "%00", "..", "9".repeat(40)),
      );
      await fc.assert(
        fc.asyncProperty(id, body, async (i, b) => {
          const path = `/api/v1/incidents/${encodeURIComponent(i)}`;
          await answered(
            `PATCH ${i} ${b.slice(0, 30)}`,
            await call(path, { method: "PATCH", body: b }),
          );
        }),
        runs(25),
      );
      const query = fc.array(
        fc.tuple(
          fc.constantFrom(
            "status",
            "title",
            "sort",
            "page",
            "limit",
            "search",
            "sum",
            "detectedAt",
            "title.contains",
            "status[]",
            "componentId",
            "x",
          ),
          fc.oneof(
            fc.string({ maxLength: 30 }),
            fc.constantFrom(
              "-title",
              "title,-status",
              "999999999999",
              "-1",
              "0",
              "investigating | resolved",
              "%",
              "*",
            ),
          ),
        ),
        { maxLength: 5 },
      );
      await fc.assert(
        fc.asyncProperty(query, async (q) => {
          const params = new URLSearchParams(q).toString();
          await answered(`GET ?${params.slice(0, 60)}`, await call(`/api/v1/incidents?${params}`));
          await answered(
            `GET csv ?${params.slice(0, 60)}`,
            await call(`/api/v1/incidents.csv?${params}`),
          );
        }),
        runs(40),
      );
      const rpcCall = fc.record(
        {
          jsonrpc: fc.constantFrom("2.0", "1.0", 2),
          id: fc.oneof(fc.nat(), fc.string({ maxLength: 5 }), fc.constant(null)),
          method: fc.constantFrom(
            "initialize",
            "ping",
            "tools/list",
            "tools/call",
            "resources/list",
            "x",
          ),
          params: fc.oneof(
            fc.record({
              name: fc.constantFrom(
                "find",
                "count",
                "describe",
                "get",
                "add",
                "change",
                "act",
                "x",
              ),
              arguments: fc.oneof(
                fc.dictionary(
                  fc.constantFrom("kind", "where", "id", "values", "action", "limit", "sort"),
                  odd,
                  { maxKeys: 4 },
                ),
                odd,
              ),
            }),
            odd,
          ),
        },
        { requiredKeys: ["method"] },
      );
      await fc.assert(
        fc.asyncProperty(rpcCall, async (r) => {
          const text = JSON.stringify(r);
          await answered(
            `/mcp ${text.slice(0, 60)}`,
            await call("/mcp", { method: "POST", body: text }),
          );
        }),
        runs(60),
      );
    },
  );
}

/**
 * The security checks of the gate for input and sign-in (on the booking app): each is an attack
 * the app must refuse, kept as a named check for every later change. A script in a visitor's
 * message never runs for the admin who reads it; a Markdown link cannot run code; a search that
 * looks like SQL is only text; guessing a sign-in code stops after five tries; the session cookie
 * is out of a script's reach; sign-in never sends anyone to another site; and no file path
 * climbs out of the pictures.
 */
async function inputSecurityFlow(dir, base) {
  const check = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ security: ${name}`);
    } catch (error) {
      console.log(`  ✗ security: ${name}\n    ${error.message.split("\n")[0]}`);
      failures.push(`security: ${name}`);
    }
  };
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // Anything a page runs that it should not would set this, or open a dialog.
  const ran = async () => page.evaluate(() => Boolean(window.__ran));
  const dialogs = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    dialog.dismiss();
  });
  const attack = '<img src=x onerror="window.__ran=1"><script>window.__ran=1</script>';
  try {
    await check("a script in a visitor's message does not run when an admin reads it", async () => {
      await open(page, `${base}/`);
      await page.getByRole("textbox", { name: "Name *" }).fill(`Mallory ${attack}`);
      await page.getByRole("textbox", { name: "Email *" }).fill("mallory@example.com");
      await page.getByRole("textbox", { name: "Message *" }).fill(`Hello ${attack}`);
      await page.getByRole("button", { name: "Send message" }).click();
      await page.getByText("Thank you!", { exact: false }).waitFor({ timeout: 10000 });
      await signInAs(page, base, "admin");
      await open(page, `${base}/messages`);
      const row = page.getByRole("cell", { name: /^Mallory/ }).first();
      await row.waitFor({ timeout: 10000 });
      if (!(await row.innerText()).includes("<img src=x"))
        throw new Error("the message's name is not shown as the text it is");
      await row.click();
      await page.waitForURL(/\/messages\/\d+$/);
      await page.waitForTimeout(500);
      if ((await ran()) || dialogs.length) throw new Error("the message's script ran");
    });
    await check("a Markdown link cannot run code", async () => {
      await open(page, `${base}/instructors/1`);
      await page
        .getByLabel("Bio")
        .fill("[Book now](javascript:window.__ran=1) and [here](JaVaScRiPt:alert(1))");
      await page.getByRole("button", { name: "Preview" }).click();
      await page.getByText("Book now").first().waitFor({ timeout: 10000 });
      const hrefs = await page
        .locator("main a")
        .evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
      if (hrefs.some((href) => /^\s*javascript:/i.test(href)))
        throw new Error(`a link runs code: ${hrefs.join(", ")}`);
      if ((await ran()) || dialogs.length) throw new Error("the link's code ran");
      await page.getByRole("button", { name: "Write" }).click();
    });
    await check(
      "a search that looks like SQL is only text, and % or _ are no wildcards",
      async () => {
        for (const q of ["' OR 1=1 --", "%", "_", '"; DROP TABLE class_types; --']) {
          const answer = await page.request.get(
            `${base}/admin/class-types?q=${encodeURIComponent(q)}`,
          );
          if (answer.status() !== 200) throw new Error(`?q=${q} gave ${answer.status()}`);
          await open(page, `${base}/admin/class-types?q=${encodeURIComponent(q)}`);
          if (await page.locator('[data-part="row"]').filter({ visible: true }).count())
            throw new Error(`?q=${q} matched records`);
        }
        // The table is still there.
        await open(page, `${base}/class-types`);
        await page
          .locator('[data-part="row"]')
          .filter({ visible: true })
          .first()
          .waitFor({ timeout: 10000 });
      },
    );
    await check(
      "the session cookie is out of a script's reach and goes to no other site",
      async () => {
        const cookies = await page.context().cookies(base);
        const session = cookies.find((c) => c.name.includes("session_token"));
        if (!session) throw new Error("no session cookie");
        if (!session.httpOnly) throw new Error("a script can read the session cookie");
        if (session.sameSite !== "Lax" && session.sameSite !== "Strict")
          throw new Error(`the session cookie goes to other sites (SameSite ${session.sameSite})`);
      },
    );
    await check("sign-in never sends anyone on to another site", async () => {
      for (const target of [
        "//evil.example/",
        "/\\evil.example/",
        "https://evil.example/",
        "/%5Cevil.example",
      ]) {
        const visitor = await browser.newPage();
        try {
          await open(visitor, `${base}/sign-in?redirect=${encodeURIComponent(target)}`);
          await visitor.getByRole("button", { name: "Sign in as member" }).click();
          await visitor
            .waitForURL((url) => url.pathname !== "/sign-in", { timeout: 10000 })
            .catch(() => {});
          await visitor.waitForTimeout(500);
          if (new URL(visitor.url()).pathname === "/sign-in")
            throw new Error(`redirect=${target}: signing in did not leave /sign-in`);
          if (new URL(visitor.url()).host !== new URL(base).host)
            throw new Error(`redirect=${target} led to ${visitor.url()}`);
        } finally {
          await visitor.close();
        }
      }
    });
    await check(
      "guessing a sign-in code stops after five tries, even before the right one",
      async () => {
        const post = (path, body) =>
          fetch(`${base}/api/auth${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Origin: base },
            body: JSON.stringify(body),
          });
        const outbox = join(dir, "data", "mail", "outbox");
        let mailed = existsSync(outbox) ? readdirSync(outbox).length : 0;
        const codeFor = async (email) => {
          const sent = await post("/email-otp/send-verification-otp", { email, type: "sign-in" });
          if (!sent.ok) throw new Error(`asking for a code gave ${sent.status}`);
          let code;
          for (let i = 0; !code && i < 50; i++) {
            const mails = existsSync(outbox) ? readdirSync(outbox).sort() : [];
            if (mails.length > mailed)
              code = /\b(\d{3}) ?(\d{3})\b/
                .exec(readFileSync(join(outbox, mails.at(-1)), "utf8"))
                ?.slice(1)
                .join("");
            if (!code) await new Promise((r) => setTimeout(r, 100));
            else mailed = mails.length;
          }
          if (!code) throw new Error(`no code for ${email} in the outbox`);
          return code;
        };
        const fresh = await post("/sign-in/email-otp", {
          email: "fresh@example.com",
          otp: await codeFor("fresh@example.com"),
        });
        if (!fresh.ok) throw new Error(`a fresh code did not sign in (${fresh.status})`);
        const email = "guess@example.com";
        const code = await codeFor(email);
        const wrong = String((Number(code) + 1) % 1000000).padStart(6, "0");
        for (let i = 0; i < 5; i++) {
          const guess = await post("/sign-in/email-otp", { email, otp: wrong });
          if (guess.ok) throw new Error("a wrong code signed in");
        }
        const right = await post("/sign-in/email-otp", { email, otp: code });
        if (right.ok) throw new Error("the right code still worked after five wrong guesses");
      },
    );
    await check("no file path climbs out of the pictures", async () => {
      for (const path of [
        "/files/..%2F..%2Fdata%2Fdb%2Fapp.db",
        "/files/Post/1/picture/..%2F..%2F..%2F..%2Fsmithable.yml",
        "/files/%2e%2e/%2e%2e/data/db/app.db",
        "/images/..%2F..%2Fdata%2Fdb%2Fapp.db",
      ]) {
        const answer = await fetch(`${base}${path}`);
        const body = answer.ok ? await answer.text() : "";
        if (body.includes("SQLite format") || body.includes("smithable: 0.1"))
          throw new Error(`${path} served an app file`);
      }
    });
  } finally {
    await browser.close();
  }
}

/**
 * A session as a target (security): the session a person has open follows what an administrator
 * does at once (a new role, a removal), and a session cookie kept after signing out signs nobody in.
 */
async function sessionFlow(base) {
  const browser = await chromium.launch();
  const adminPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const staffPage = await (await browser.newContext()).newPage();
  const cookieOf = async (page) =>
    (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const who = async (cookie) => {
    const answer = await fetch(`${base}/api/auth/get-session`, { headers: { cookie } });
    return answer.ok ? ((await answer.json())?.user ?? null) : null;
  };
  const check = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ security: ${name}`);
    } catch (error) {
      console.log(`  ✗ security: ${name}\n    ${String(error.message).split("\n")[0]}`);
      failures.push(`security: ${name}`);
    }
  };
  try {
    await signInAs(staffPage, base, "staff");
    await signInAs(adminPage, base, "admin");
    await open(adminPage, `${base}/team`);
    const role = adminPage.getByLabel("Role of Dev staff").filter({ visible: true }).first();
    await check("a new role reaches the person's open session at once", async () => {
      const cookie = await cookieOf(staffPage);
      if ((await who(cookie))?.role !== "staff") throw new Error("the staff session is not staff");
      await role.selectOption("admin");
      await adminPage.waitForTimeout(500);
      const now = (await who(cookie))?.role;
      await role.selectOption("staff");
      await adminPage.waitForTimeout(500);
      if (now !== "admin") throw new Error(`after the change the session's role is ${now}`);
      if ((await who(cookie))?.role !== "staff") throw new Error("changing back did not reach it");
    });
    await check(
      "a session cookie kept after signing out signs nobody in, and the next sign-in gets a new one",
      async () => {
        const kept = await cookieOf(staffPage);
        const out = await fetch(`${base}/api/auth/sign-out`, {
          method: "POST",
          headers: { cookie: kept, Origin: base, "content-type": "application/json" },
          body: "{}",
        });
        if (!out.ok) throw new Error(`signing out gave ${out.status}`);
        if (await who(kept)) throw new Error("the kept cookie is still signed in");
        const replayed = await fetch(`${base}/incidents`, {
          headers: { cookie: kept },
          redirect: "manual",
        });
        if (replayed.status === 200 && (await replayed.text()).includes("Sign out"))
          throw new Error("a page opened with the kept cookie");
        await staffPage.context().clearCookies();
        await signInAs(staffPage, base, "staff");
        if ((await cookieOf(staffPage)) === kept)
          throw new Error("the new sign-in has the old cookie");
      },
    );
    await check("removing a person ends their open session", async () => {
      const cookie = await cookieOf(staffPage);
      if (!(await who(cookie))) throw new Error("the staff session is not signed in");
      await open(adminPage, `${base}/team`);
      await adminPage
        .locator("tr", { hasText: "Dev staff" })
        .getByRole("button", { name: "Remove" })
        .click();
      await adminPage.getByRole("button", { name: "Remove user" }).click();
      await adminPage
        .locator("tr", { hasText: "Dev staff" })
        .waitFor({ state: "detached", timeout: 10000 });
      if (await who(cookie)) throw new Error("the removed person is still signed in");
    });
  } finally {
    await browser.close();
  }
}

/**
 * A stand-in for the host's chat model (an OpenAI-style /chat/completions): asked to start a
 * task, it proposes changing "Draft the newsletter" to doing; anything else, a short reply.
 */
async function standInModel() {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const last = String(JSON.parse(body || "{}").messages?.at(-1)?.content ?? "");
      const call = {
        id: "1",
        type: "function",
        function: {
          name: "change",
          arguments: JSON.stringify({
            kind: "Task",
            id: "Draft the newsletter",
            values: { status: "doing" },
          }),
        },
      };
      const reply = /start/i.test(last)
        ? { choices: [{ message: { content: "Shall I start it?", tool_calls: [call] } }] }
        : { choices: [{ message: { content: "I can only start tasks here." } }] };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ...reply, usage: { prompt_tokens: 10, completion_tokens: 5 } }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  // It serves while the app does, and never keeps the run from ending.
  server.unref();
  return { url: `http://127.0.0.1:${server.address().port}` };
}

/**
 * "Ask" for the people who use the app (docs/design/assistant.md §6), on the api starter with
 * setAssistant member: a member asks with the button and is answered from the records they may
 * read (the rules, no model here); a role the block does not name, and a visitor, get no button.
 */
async function askPanelFlow(dir, base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await signInAs(page, base, "member");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Ask" });
    await sheet.getByLabel("Question").fill("how many tasks");
    await sheet.getByRole("button", { name: "Ask", exact: true }).click();
    const answered = sheet.locator("[data-answer]").first();
    await answered.getByText("From your records").waitFor({ timeout: 10000 });
    const number = await answered.locator(".text-2xl").textContent();
    if (!/^\d+$/.test(number ?? "")) throw new Error(`Ask answered ${number}`);
    if (!(await sheet.getByText("Answers may come from an AI and can be wrong.").isVisible()))
      throw new Error("Ask does not say answers may come from an AI");
    // may: change: the model's proposal is a card in the app's words, made only once confirmed.
    await sheet.getByLabel("Question").fill("start the newsletter draft");
    await sheet.getByRole("button", { name: "Ask", exact: true }).click();
    const card = sheet.locator("[data-proposal]").first();
    await card.getByText("Draft the newsletter").waitFor({ timeout: 10000 });
    await card.getByText("Status:").waitFor();
    const before = query(dir, "select status from tasks where title = 'Draft the newsletter'")[0]
      ?.status;
    if (before !== "todo") throw new Error(`the task was ${before} before confirming`);
    await card.getByRole("button", { name: "Confirm" }).click();
    await card.getByText("Done.").waitFor({ timeout: 10000 });
    const after = query(dir, "select status from tasks where title = 'Draft the newsletter'")[0]
      ?.status;
    if (after !== "doing") throw new Error(`after confirming the task is ${after}`);
    const logged = query(dir, "select details from audit_log order by id desc limit 1")[0]?.details;
    if (!String(logged).includes('"through":"Ask"'))
      throw new Error(`the change was logged as ${logged}`);
    await page.context().clearCookies();
    await signInAs(page, base, "admin");
    if (await page.getByRole("button", { name: "Ask", exact: true }).count())
      throw new Error("a role the assistant block does not name has Ask");
    await page.context().clearCookies();
    await open(page, `${base}/sign-in`);
    if (await page.getByRole("button", { name: "Ask", exact: true }).count())
      throw new Error("a visitor has Ask");
    console.log(
      "  ✓ browser: Ask answers a member from the records with the button (rules, no model) and says answers may come from an AI; a change the model proposes is a card made only once confirmed, logged as through Ask; a role the assistant block does not name and a visitor have no Ask",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("ask flow");
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
    // The article opens through the router: the same document, no white page between (a mark
    // on the window survives only that).
    await page.evaluate(() => {
      window.__sameDocument = true;
    });
    await page.getByRole("link", { name: "Morning practice" }).click();
    await page
      .getByRole("heading", { level: 1, name: "Morning practice" })
      .waitFor({ timeout: 10000 });
    if (!(await page.evaluate(() => window.__sameDocument === true)))
      throw new Error("opening an article loaded a new document");
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

/**
 * Documents (docs/design/attachments.md): a contract attached to an invoice in its form is
 * served through the invoice (inline, sandboxed, its own type); a file that only claims to be a
 * PDF, or one over 10 MB, is refused; a visitor cannot fetch it; removing it removes its file.
 */
async function documentFlow(dir, base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n");
  const stored = `invoice/${createHash("sha256").update(pdf).digest("hex").slice(0, 24)}.pdf`;
  const contract = () => page.locator('input[type="file"][accept*=".pdf"]').first();
  try {
    await signInAs(page, base, "admin");
    await open(page, `${base}/invoices`);
    // The list's totals are the lines' sums, worked out where the lines are (not €0.00).
    await page
      .getByRole("row", { name: /2026-001/ })
      .getByText("€1,700.00")
      .waitFor({ timeout: 10000 });
    await page.getByRole("cell", { name: "2026-005", exact: true }).click();
    await page.waitForURL(/\/invoices\/\d+$/);
    const id = page.url().match(/\/invoices\/(\d+)$/)?.[1];
    // Only claiming to be a PDF: refused in the app's words.
    await contract().setInputFiles({
      name: "fake.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("not a pdf"),
    });
    await page.getByRole("alert").filter({ hasText: "Choose a PDF" }).waitFor({ timeout: 10000 });
    await contract().setInputFiles({
      name: "Contract 2026.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await page.getByText("Contract 2026.pdf").first().waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "Save changes" }).click();
    // Saved, the list opens; the invoice's page shows the contract as a link.
    await page.waitForURL(/\/invoices$/);
    await open(page, `${base}/invoices/${id}`);
    await page.getByRole("link", { name: "Contract 2026.pdf" }).first().waitFor({ timeout: 10000 });
    const served = await page.request.get(`${base}/files/invoice/${id}/contract`);
    const headers = served.headers();
    if (
      served.status() !== 200 ||
      headers["content-type"] !== "application/pdf" ||
      !headers["content-disposition"]?.startsWith("inline;") ||
      headers["content-security-policy"] !== "sandbox" ||
      !(await served.body()).equals(pdf)
    )
      throw new Error(`the contract is served as ${served.status()} ${JSON.stringify(headers)}`);
    // A visitor cannot read the invoice, so not its contract either.
    const visitor = await fetch(`${base}/files/invoice/${id}/contract`);
    if (visitor.status !== 404) throw new Error(`a visitor gets ${visitor.status}`);
    // Larger than 10 MB: refused before it is stored.
    const large = await page.request.post(`${base}/files/invoice/contract`, {
      headers: { "x-file-name": "big.pdf", "x-smithable": "1", "sec-fetch-site": "same-origin" },
      data: Buffer.concat([pdf, Buffer.alloc(10_000_001)]),
    });
    if (large.status() !== 400) throw new Error(`a file over 10 MB gets ${large.status()}`);
    // Removed and saved: the stored file goes too.
    if (!existsSync(join(dir, "data", "uploads", stored)))
      throw new Error("the contract was not stored");
    await page.getByRole("button", { name: "Remove" }).first().click();
    await page.getByRole("button", { name: "Save changes" }).click();
    for (let i = 0; existsSync(join(dir, "data", "uploads", stored)); i++) {
      if (i === 50) throw new Error("the removed contract's file is still there");
      await page.waitForTimeout(100);
    }
    console.log(
      "  ✓ browser: a contract attached to an invoice is served through it (inline, sandboxed, its own type); a fake PDF and one over 10 MB are refused, a visitor gets nothing, and removing it removes its file",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("document flow");
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
 * A related list adds from its record (the stranger walk of 2026-10-07): "Add invoice line" on
 * an invoice opens the new line with the invoice filled in and fixed, and goes back to it.
 */
async function addChildFlow(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await signInAs(page, base, "admin");
    await open(page, `${base}/invoices/1`);
    await page.getByRole("link", { name: "Add invoice line" }).first().click();
    await page.waitForURL(/\/invoice-lines\/new\?invoice=1$/);
    if (!(await page.getByLabel("Invoice *").isDisabled()))
      throw new Error("the invoice can be changed on the new line");
    await page.getByRole("textbox", { name: "Description *" }).fill("Added from the invoice");
    await page.getByRole("textbox", { name: "Unit price *" }).fill("40");
    await page.getByRole("button", { name: "Create invoice line" }).click();
    await page.waitForURL(`${base}/invoices/1`);
    await page.getByRole("cell", { name: "Added from the invoice" }).waitFor({ timeout: 10000 });
    console.log(
      "  ✓ browser: Add invoice line on an invoice opens the new line with the invoice fixed, and the line is on the invoice after",
    );
  } catch (error) {
    console.log(
      `  ✗ browser: ${error.message.split("\n")[0]}\n    at ${page.url()}, see ${await screenshot(page)}`,
    );
    failures.push("invoicing add-child flow");
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
              // And one main landmark a page (a best practice, outside the tags): the privacy page
              // once framed itself inside the visitors' frame (the stranger walk, B11).
              rules: { "landmark-no-duplicate-main": { enabled: true } },
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
        ["--motion-fast", "--motion-slow", "--motion-distance", "--landing-motion"].map((v) =>
          getComputedStyle(document.documentElement).getPropertyValue(v).trim(),
        ),
      );
      const still = motion.every((v) => /^(0(ms|px)|none)$/.test(v));
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
    /\nDisallow: \/\n(Sitemap: \S+\n)?$/.test(text);
  console.log(
    `  ${ok ? "✓" : "✗"} robots.txt: the public pages allowed, the rest refused${ok ? "" : `\n    ${response.status} ${text}`}`,
  );
  if (!ok) failures.push("robots.txt");
}

/**
 * /sitemap.xml with public pages: every public page's address at the site's own origin, a public
 * blog's published posts with their dates and nothing unpublished, and robots.txt naming it;
 * without public pages, no sitemap. A public page carries its description for search engines.
 */
async function sitemapCheck(dir, base) {
  const auth = readFileSync(join(dir, "smithable.auth.yml"), "utf8");
  const publicPages = /^public:[\s\S]*?\n\s+pages:\s*\[([^\]]*)\]/m.exec(auth)?.[1];
  const robots = await (await fetch(`${base}/robots.txt`)).text();
  const response = await fetch(`${base}/sitemap.xml`);
  const problems = [];
  if (!publicPages) {
    if (response.status !== 404)
      problems.push(`a sitemap without public pages (${response.status})`);
    if (robots.includes("Sitemap:"))
      problems.push("robots.txt names a sitemap without public pages");
  } else {
    const text = await response.text();
    if (
      response.status !== 200 ||
      !response.headers.get("content-type")?.startsWith("application/xml")
    )
      problems.push(`${response.status} ${response.headers.get("content-type")}`);
    if (!robots.includes(`Sitemap: ${base}/sitemap.xml`))
      problems.push("robots.txt does not name the sitemap");
    const spec = readFileSync(join(dir, "smithable.yml"), "utf8");
    for (const id of publicPages
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)) {
      const route = new RegExp(`^  ${id}:[\\s\\S]*?\\n    route: (\\S+)`, "m").exec(spec)?.[1];
      if (route && !text.includes(`<loc>${base}${route === "/" ? "/" : route}</loc>`))
        problems.push(`${id} (${route}) missing`);
    }
    // A public blog: what its list page links to is in the sitemap (with a date), each entry
    // answers a visitor, and nothing more is listed than the list shows.
    const blog = /^ {2}(\S+):\n(?: {4}.*\n)*? {4}route: (\S+)\n(?: {4}.*\n)*? {4}articles:/m.exec(
      spec,
    );
    if (blog && publicPages.includes(blog[1])) {
      const route = blog[2];
      const prefix = route === "/" ? "/" : `${route}/`;
      const listPage = await (await fetch(`${base}${route}`)).text();
      const linked = new Set(
        [
          ...listPage.matchAll(
            new RegExp(`href="(${prefix.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}[^"?#]+)"`, "g"),
          ),
        ].map((m) => m[1]),
      );
      const listed = [...text.matchAll(/<loc>([^<]+)<\/loc>(<lastmod>[^<]*<\/lastmod>)?/g)]
        .map((m) => ({ path: m[1].replace(base, ""), dated: Boolean(m[2]) }))
        .filter((e) => e.path.startsWith(prefix) && e.path !== route);
      for (const href of linked)
        if (!listed.some((e) => e.path === href))
          problems.push(`${href} linked but not in the sitemap`);
      for (const e of listed) {
        if (!linked.has(e.path))
          problems.push(`${e.path} in the sitemap but not on the blog's first page`);
        if (!e.dated) problems.push(`${e.path} has no lastmod`);
        if ((await fetch(`${base}${e.path}`)).status !== 200)
          problems.push(`${e.path} does not answer a visitor`);
      }
      if (!linked.size) problems.push("the blog's first page links to no article");
    }
    const content = readFileSync(join(dir, "smithable.content.yml"), "utf8");
    const described = /^ {4}description: (.+)$/m.exec(content)?.[1];
    if (described) {
      const home = await (await fetch(`${base}/`)).text();
      if (
        !home.includes(`name="description"`) ||
        !home.includes(described.replace(/"/g, "&quot;").slice(0, 40))
      )
        problems.push("the home page lacks its meta description");
    }
  }
  const ok = problems.length === 0;
  console.log(
    `  ${ok ? "✓" : "✗"} sitemap.xml: ${publicPages ? "the public pages, a public blog's published posts, named by robots.txt, the page's description in its head" : "none without public pages"}${ok ? "" : `\n    ${problems.join("\n    ")}`}`,
  );
  if (!ok) failures.push("sitemap.xml");
}

/**
 * The app's mark (docs/design/app-logo.md §2), when its content file names one: drawn before
 * the name in the landing page's header and, signed in, in the shell, and linked as the tab's
 * icon.
 */
async function logoCheck(dir, base) {
  const src = /^logo:\s*(?:\{\s*src:|\n\s+src:)\s*([^\s,}]+)/m.exec(
    readFileSync(join(dir, "smithable.content.yml"), "utf8"),
  )?.[1];
  if (!src) return;
  const role = /^roles:.*\n\s+(\w+):/m.exec(
    readFileSync(join(dir, "smithable.auth.yml"), "utf8"),
  )?.[1];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // Drawn, and its file loaded: an <img> whose file is missing has no natural width.
  const drawn = async (where) => {
    const logo = page.locator(`${where} img[data-part="logo"]`).first();
    await logo.waitFor({ state: "visible" });
    if ((await logo.getAttribute("src")) !== `/${src}`) throw new Error(`${where}: not /${src}`);
    if (!(await logo.evaluate((img) => img.complete && img.naturalWidth > 0)))
      throw new Error(`${where}: the file did not load`);
  };
  try {
    await asyncStep(
      `the app's logo (/${src}) is before its name in the landing header or the shell, and is the tab's icon`,
      async () => {
        await open(page, `${base}/`);
        if (await page.locator('[data-kit="landing"]').count())
          await drawn('[data-kit="landing"] [data-part="header"]');
        const icon = await page.locator('link[rel="icon"]').getAttribute("href");
        if (icon !== `/${src}`) throw new Error(`the icon is ${icon}`);
        if (!role) return;
        await signInAs(page, base, role);
        // Signed in, the app's start is in the shell, or a landing page or onboarding leads there.
        for (let i = 0; i < 3 && !(await page.locator('[data-kit="app-shell"]').count()); i++) {
          const into = page
            .locator('[data-kit="landing"] [data-part="header"]')
            .getByRole("link", { name: /^Open / });
          if (await into.count()) await into.first().click();
          else await open(page, `${base}/`);
          await page.waitForLoadState("networkidle");
        }
        if (!(await page.locator('[data-kit="app-shell"]').count()))
          throw new Error(`signed in as ${role}, no shell at ${page.url()}`);
        await drawn('[data-kit="app-shell"] aside');
      },
    );
  } catch {
    // Reported by the step.
  } finally {
    await browser.close();
  }
}

/**
 * The mark on pictures an AI made (AiMark.tsx), on each landing page as the server sends it:
 * "AI" on every gallery picture marked `generated: true` and on the cards of records seeded with
 * the library's pictures; on a hero, "AI-generated" when shown whole, none under the theme's
 * wash or veil (cover, centered).
 */
async function aiMarkCheck(dir, base) {
  const content = readFileSync(join(dir, "smithable.content.yml"), "utf8");
  const ux = readFileSync(join(dir, "smithable.ux.yml"), "utf8");
  const samples = existsSync(join(dir, "samples"))
    ? readdirSync(join(dir, "samples"))
        .map((f) => readFileSync(join(dir, "samples", f), "utf8"))
        .join("\n")
    : "";
  const gallery = (content.match(/- image: \{[^}]*generated: true/g) ?? []).length;
  const hero = /image:\n\s+src: .*\n\s+alt: .*\n\s+generated: true/.test(content);
  const sampled = samples.includes("generated: true");
  // Switched off by the owner (aiBadge: false), the theme hides every mark.
  if ((!gallery && !hero && !sampled) || /^aiBadge: false/m.test(ux)) return;
  const veiled = /hero: \{[^}]*layout: (cover|centered)/.test(ux);
  // The landing pages: the routes that use the kit's landing sections.
  const routes = [];
  const walk = (at, route) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(at, entry.name), `${route}/${entry.name}`);
      else if (
        entry.name === "index.tsx" &&
        readFileSync(join(at, entry.name), "utf8").includes('from "#/kit/Landing"')
      )
        routes.push(route || "/");
    }
  };
  walk(join(dir, "src", "routes"), "");
  try {
    await asyncStep(
      `pictures an AI made are marked: ${gallery} gallery picture(s), ${sampled ? "the sample records' cards, " : ""}${hero ? (veiled ? "not the hero under its wash" : "the hero") : "no hero"} (${routes.join(", ")})`,
      async () => {
        const html = (
          await Promise.all(routes.map(async (r) => (await fetch(`${base}${r}`)).text()))
        ).join("");
        const small = (html.match(/data-part="ai-mark"[^>]*>AI</g) ?? []).length;
        const cards = sampled && html.includes('src="/files/') ? 1 : 0;
        if (small < gallery + cards)
          throw new Error(`${small} "AI" mark(s), expected at least ${gallery + cards}`);
        const first = /<section[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
        const marked = first.includes('data-part="ai-mark"');
        if (hero && veiled && marked) throw new Error("the hero under its wash is marked");
        if (hero && !veiled && !/data-part="ai-mark"[^>]*>AI-generated</.test(first))
          throw new Error("the hero is not marked AI-generated");
      },
    );
  } catch {
    // Reported by the step.
  }
}

/**
 * A privacy page (legal: privacy): written from the app, open to visitors, naming the operator
 * from the content file, with its parts; linked from the site's footer and never from the menu.
 */
async function legalCheck(dir, base) {
  const spec = readFileSync(join(dir, "smithable.yml"), "utf8");
  const page =
    /^ {2}(\S+):\n(?: {4}.*\n)*? {4}route: (\S+)\n(?: {4}.*\n)*? {4}legal: privacy/m.exec(spec);
  if (!page) return;
  const [, id, route] = page;
  const problems = [];
  const response = await fetch(`${base}${route}`);
  const html = await response.text();
  if (response.status !== 200) problems.push(`${route} answers ${response.status}`);
  const content = readFileSync(join(dir, "smithable.content.yml"), "utf8");
  const operator = new RegExp(`^  ${id}:[\\s\\S]*?      name: (.+)$`, "m").exec(content)?.[1];
  if (operator && !html.includes(operator)) problems.push("the operator's name is not on the page");
  const parts = (html.match(/<h2[^>]*>/g) ?? []).length;
  if (parts < 5) problems.push(`only ${parts} parts`);
  for (const word of ["cookie", "sign in", "90 days"])
    if (!html.toLowerCase().includes(word)) problems.push(`nothing about "${word}"`);
  const home = await (await fetch(`${base}/`)).text();
  if (!home.includes(`href="${route}"`)) problems.push("the home page does not link to it");
  const ok = problems.length === 0;
  console.log(
    `  ${ok ? "✓" : "✗"} privacy page: written from the app, the operator named, linked from the footer${ok ? "" : `\n    ${problems.join("\n    ")}`}`,
  );
  if (!ok) failures.push("privacy page");
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
    // Export CSV takes what the member may read, nothing more.
    const [file] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    const exported = readFileSync(await file.path(), "utf8");
    if (!exported.includes("My Client") || exported.includes("Other Client"))
      throw new Error(`the member's export: ${exported.slice(0, 300)}`);
    await open(page, `${base}/invoices`);
    await page.getByRole("heading", { name: "Invoices" }).waitFor();
    if (await page.getByText("OTHER-001").count())
      throw new Error("another user's invoice is listed");
    await open(page, `${base}/invoices/${id}`);
    await page.getByRole("heading", { name: "Not found" }).waitFor({ timeout: 5000 });
    await open(page, `${base}/invoices/new`);
    const clients = await page.getByLabel("Client *").locator("option").allTextContents();
    if (clients.includes("Other Client")) throw new Error("another user's client can be chosen");
    console.log(
      "  ✓ browser: a member sees only their own clients and invoices, even by id, and exports only theirs",
    );
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
function query(dir, sql, file = "data/db/app.db") {
  const code = `const D=require("better-sqlite3");console.log(JSON.stringify(new D(${JSON.stringify(file)}).prepare(${JSON.stringify(sql)}).all()))`;
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
          "A mobile number for every customer would help",
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
          "A mobile number for every customer would help",
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
    step(
      "op --setup: a change made for the owner is not in the history and undo passes over it",
      () => {
        const before = /^admins:\s*\[([^\]]*)\]/m.exec(
          readFileSync(join(dir, "smithable.auth.yml"), "utf8"),
        )?.[1];
        if (!before) throw new Error("no admins in smithable.auth.yml");
        const setup = smithable(
          dir,
          "op",
          "--setup",
          "setAdmins",
          "--admins",
          `${before},setup@acme.example`,
        );
        if (setup.code !== 0) throw new Error(setup.out);
        const body = run("git", ["log", "-1", "--format=%B"], dir);
        if (!/^Smithable-Setup: yes$/m.test(body)) throw new Error(body);
        // Undo goes past the setup to the change before it (or finds none); the admin stays.
        const undone = smithable(dir, "undo");
        if (
          readFileSync(join(dir, "smithable.auth.yml"), "utf8").includes("setup@acme.example") ===
          false
        )
          throw new Error(`undo took back the setup:\n${undone.out}`);
        const ok = (result) => {
          if (result.code !== 0) throw new Error(result.out);
        };
        if (undone.code === 0) ok(smithable(dir, "redo"));
        ok(smithable(dir, "op", "setAdmins", "--admins", before));
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
        "A mobile number for every customer would help",
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
    if (refused.out.includes("smithable report"))
      throw new Error(`a refusal offered a report: ${refused.out}`);
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
  step("op grant changes who may do what; the access tests follow; undo reverts it", () => {
    const data = join(dir, "src/generated/customer.server.ts");
    const salesDelete = 'delete: { public: false, roles: ["admin", "sales"], owner: true }';
    expectOk(smithable(dir, "op", "grant", "sales", "delete", "Customer"));
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
async function browserFlow(dir, base) {
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

    // The trash (docs/design/trash.md): Move to trash, Undo, the unique value it keeps, the Trash
    // page, the record's own page read-only with Restore, then removal for good.
    const trashIt = async () => {
      await page.getByRole("cell", { name: "Mariehamn Marine AB", exact: true }).click();
      await page.getByRole("button", { name: "Move to trash" }).click();
      await page.waitForURL(`${base}/customers`);
    };
    await trashIt();
    const notice = page.locator('[data-part="trash-notice"]');
    await notice.getByText("“Mariehamn Marine AB” is in the trash.").waitFor();
    if (await page.getByRole("cell", { name: "Mariehamn Marine AB", exact: true }).count())
      throw new Error("a trashed customer is still listed");
    await notice.getByRole("button", { name: "Undo" }).click();
    await page
      .getByRole("cell", { name: "Mariehamn Marine AB", exact: true })
      .waitFor({ timeout: 10000 });
    await trashIt();
    // A unique value holds among live records only: the email is free again, and restoring the
    // trashed customer is refused while another has it.
    await open(page, `${base}/customers/new`);
    await page.getByRole("textbox", { name: "Name *" }).fill("Mariehamn Marine Again");
    await page.getByRole("textbox", { name: "Email" }).fill("hello@mariehamn-marine.example.com");
    await page.getByRole("button", { name: "Create customer" }).click();
    await page.waitForURL(`${base}/customers`);
    await open(page, `${base}/customers/trash`);
    await page
      .locator("tr", { hasText: "Mariehamn Marine AB" })
      .getByRole("button", { name: "Restore" })
      .click();
    await expectText(
      "a restore is refused while a live customer has the email",
      "Another customer already has this email.",
    );
    await open(page, `${base}/customers`);
    await page.getByRole("cell", { name: "Mariehamn Marine Again", exact: true }).click();
    await page.getByRole("button", { name: "Move to trash" }).click();
    await page.waitForURL(`${base}/customers`);
    await open(page, `${base}/customers/trash`);
    await page.getByRole("cell", { name: "Mariehamn Marine AB", exact: true }).click();
    await page.waitForURL(/\/customers\/\d+$/);
    const banner = page.locator('[data-part="trashed"]');
    await banner
      .getByText(/^In the trash since .*, deleted by Dev admin\. It is removed for good on /)
      .waitFor();
    if (await page.getByRole("button", { name: "Save changes" }).count())
      throw new Error("a trashed customer can be changed");
    await banner.getByRole("button", { name: "Restore" }).click();
    await banner.waitFor({ state: "detached" });
    await open(page, `${base}/customers`);
    await page.getByRole("cell", { name: "Mariehamn Marine AB", exact: true }).waitFor();
    await trashIt();
    await open(page, `${base}/customers/trash`);
    await page.locator("tr", { hasText: "Mariehamn Marine AB" }).getByRole("checkbox").check();
    await page
      .locator('[data-kit="selection-bar"]')
      .getByRole("button", { name: /^Delete/ })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await page
      .getByRole("cell", { name: "Mariehamn Marine AB", exact: true })
      .waitFor({ state: "detached", timeout: 10000 });
    const kept = query(
      dir,
      "select count(*) as n from customers where name = 'Mariehamn Marine AB'",
    );
    const lines = query(
      dir,
      "select action from audit_log where model = 'Customer' and action in ('trashed', 'restored', 'removed')",
    ).map((l) => l.action);
    if (kept[0]?.n !== 0 || !["trashed", "restored", "removed"].every((a) => lines.includes(a)))
      throw new Error(`for good: ${JSON.stringify(kept)} ${lines.join()}`);
    console.log(
      "  ✓ browser: Move to trash hides the customer, Undo brings it back; its email is free for a new customer, and restoring it is refused until that one goes; its page is read-only with Restore; the Trash page removes it for good; the log has trashed, restored and removed",
    );

    // The Admin group (docs/design/admin.md): Team, every trash and the activity, beside Team.
    const adminMenu = page.locator('[data-kit="nav"]').first();
    for (const name of ["Team", "Trash", "Activity"])
      await adminMenu.getByRole("link", { name, exact: true }).waitFor();
    await open(page, `${base}/team/trash`);
    const customersTrash = page.locator('section[data-model="Customer"]');
    await customersTrash.getByRole("heading", { name: "Customers" }).waitFor();
    await customersTrash
      .locator("tr", { hasText: "Mariehamn Marine Again" })
      .getByRole("button", { name: "Restore" })
      .click();
    await customersTrash
      .getByRole("cell", { name: "Mariehamn Marine Again", exact: true })
      .waitFor({ state: "detached", timeout: 10000 });
    await open(page, `${base}/customers`);
    await page.getByRole("cell", { name: "Mariehamn Marine Again", exact: true }).waitFor();
    await open(page, `${base}/team/activity`);
    await page.getByRole("heading", { name: "Activity" }).waitFor();
    console.log(
      "  ✓ browser: the menu's Admin group has Team, Trash and Activity; the Team page's Trash names each model and restores from there",
    );

    // A field is checked when it is left, before saving.
    await open(page, `${base}/customers/new`);
    await page.getByRole("textbox", { name: "Credit limit" }).fill("lots");
    await page.getByRole("textbox", { name: "Credit limit" }).press("Tab");
    await expectText(
      "a field left with a non-number says Enter a number at once",
      "Enter a number",
    );
    await page.getByRole("textbox", { name: "Credit limit" }).fill("12");
    await page.getByText("Enter a number").waitFor({ state: "detached" });

    // A person sets the name others see from the menu (an invited one starts with none).
    const renameTo = async (from, to) => {
      await page.getByRole("button", { name: from, exact: true }).filter({ visible: true }).click();
      await page.getByRole("textbox", { name: "Your name" }).fill(to);
      await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
      await page.getByRole("button", { name: to, exact: true }).filter({ visible: true }).waitFor();
    };
    await open(page, `${base}/customers`);
    await renameTo("Dev admin", "Dev Admin Renamed");
    await renameTo("Dev Admin Renamed", "Dev admin");
    console.log("  ✓ browser: a signed-in person sets their own name from the menu");

    // In the preview an invitation stays in the outbox, and the Team page says so (backlog A54).
    await open(page, `${base}/team`);
    await page.getByRole("textbox", { name: "Email address" }).fill("new.person@example.com");
    await page.getByRole("button", { name: "Send invitation" }).click();
    await expectText(
      "an invitation in the preview says it is in the outbox, not sent",
      "Invitation to new.person@example.com written to the preview's outbox, not sent",
    );

    // Removing a member whom records name gives them to another (backlog A56): a customer's
    // account manager goes to the member chosen in the remove dialog, with the removal.
    await signInAs(page, base, "sales");
    await signInAs(page, base, "admin");
    await open(page, `${base}/customers`);
    await page.getByRole("cell", { name: "Arctic Outdoor Co", exact: true }).click();
    await chooseRecord(page, "Account manager", "Dev sales");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(`${base}/customers`);
    await open(page, `${base}/team`);
    await page
      .locator("tr", { hasText: "Dev sales" })
      .getByRole("button", { name: "Remove" })
      .filter({ visible: true })
      .click();
    const removeDialog = page.getByRole("dialog");
    await removeDialog.getByText("1 customer has Dev sales as account manager.").waitFor();
    await removeDialog
      .getByRole("combobox", { name: "Give them to" })
      .selectOption({ label: "Dev admin" });
    await removeDialog.getByRole("button", { name: "Remove user" }).click();
    await page
      .locator("tr", { hasText: "Dev sales" })
      .waitFor({ state: "detached", timeout: 10000 });
    const managed = query(
      dir,
      "select u.name from customers c join user u on u.id = c.account_manager_id where c.name = 'Arctic Outdoor Co'",
    );
    const moved = query(
      dir,
      "select count(*) as n from audit_log where action = 'records reassigned'",
    );
    if (managed[0]?.name !== "Dev admin" || moved[0]?.n !== 1)
      throw new Error(`reassigned: ${JSON.stringify(managed)} ${JSON.stringify(moved)}`);
    console.log(
      "  ✓ browser: removing a member says which records name them and gives them to the member chosen, in one change with its Activity line",
    );

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

    // Deleting a record that others point to (docs/design/delete-together.md): the dialog says
    // what goes with it, the group goes to the trash together, shows as a group there, an order
    // is not restored alone, and restoring the customer brings its orders back.
    await page.getByRole("button", { name: "Move to trash" }).click();
    const together = page.locator('[data-part="together"]');
    await together.getByText("Move “Skerry Software” to the trash?").waitFor();
    await together.getByText("2 orders go with it; they are restored together.").waitFor();
    await together.getByRole("button", { name: "Move all to the trash" }).click();
    await page.waitForURL(`${base}/customers`);
    await open(page, `${base}/orders`);
    if (await page.getByRole("cell", { name: "ORD-2001", exact: true }).count())
      throw new Error("the order of a customer moved to the trash with it is still listed");
    await open(page, `${base}/customers/trash`);
    await page.locator("tr", { hasText: "Skerry Software" }).getByText("and 2 records").waitFor();
    await open(page, `${base}/orders/trash`);
    const withRoot = page.locator("tr", { hasText: "ORD-2001" });
    await withRoot.getByText("with “Skerry Software”").waitFor();
    if (await withRoot.getByRole("button", { name: "Restore" }).count())
      throw new Error("an order in the trash with its customer offers Restore alone");
    await withRoot.getByRole("checkbox").check();
    await page
      .locator('[data-kit="selection-bar"]')
      .getByRole("button", { name: /^Restore/ })
      .click();
    await expectText(
      "restoring an order alone is refused while its customer is in the trash",
      "Restore the customer “Skerry Software” first",
    );
    await open(page, `${base}/customers/trash`);
    await page
      .locator("tr", { hasText: "Skerry Software" })
      .getByRole("button", { name: "Restore" })
      .click();
    await page
      .getByRole("cell", { name: "Skerry Software", exact: true })
      .waitFor({ state: "detached", timeout: 10000 });
    await open(page, `${base}/orders`);
    await page.getByRole("row", { name: /ORD-2001.*Skerry Software/ }).waitFor({ timeout: 5000 });
    const withLines = query(
      dir,
      "select action, details from audit_log where model = 'Order' and action in ('trashed', 'restored') order by id",
    );
    if (
      withLines.length !== 4 ||
      !withLines.every((l) => JSON.parse(l.details ?? "{}").with?.startsWith("Customer:"))
    )
      throw new Error(`the order's log lines: ${JSON.stringify(withLines)}`);
    console.log(
      "  ✓ browser: moving a customer with orders to the trash asks with the facts and takes the orders along; the trash shows the group; an order is not restored alone; restoring the customer restores the orders; the log says with whom",
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
    if (await page.getByRole("button", { name: /^(Delete|Move to trash)$/ }).count())
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
  checkPorts(`${example} (TEST_APPS_PORT)`, [port, port + 100, port + 200, port + 300]);
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
    if (example === "booking")
      step(
        "in Swedish the app carries the Swedish words, and type-checks (docs/design/language.md)",
        () => {
          // setLanguage through the operation layer, then the app as generated, then back.
          const ok = (result) => {
            if (result.code !== 0) throw new Error(result.out);
          };
          ok(smithable(dir, "op", "setLanguage", "sv"));
          try {
            const words = readFileSync(join(dir, "src/kit/words.ts"), "utf8");
            if (!words.includes('signIn: "Logga in"')) throw new Error("the words are not Swedish");
            if (existsSync(join(dir, "src/kit/words")))
              throw new Error("the words directory is in the app");
            run("pnpm", ["typecheck"], dir);
          } finally {
            ok(smithable(dir, "undo"));
          }
          if (!readFileSync(join(dir, "src/kit/words.ts"), "utf8").includes('signIn: "Sign in"'))
            throw new Error("the undo did not bring the English words back");
        },
      );
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
                  : page.pattern.kind === "legal"
                    ? html.includes('data-kit="legal"')
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
                : page.pattern.kind === "legal"
                  ? "is public: the privacy page opens without sign-in"
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
      // A page is asked for again every time; the build's hashed files are kept a year.
      {
        const page = await fetch(`${base}/sign-in`);
        const asset = /(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/.exec(await page.text())?.[1];
        const assetCache = asset && (await fetch(`${base}${asset}`)).headers.get("cache-control");
        const ok =
          page.headers.get("cache-control") === "no-store" &&
          assetCache === "public, max-age=31536000, immutable";
        console.log(
          `  ${ok ? "✓" : "✗"} a page is never cached (${page.headers.get("cache-control")}); the build's files a year (${asset}: ${assetCache})`,
        );
        if (!ok) failures.push(`${example} cache headers`);
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
      if (devSignIn.status !== 404)
        await asyncStep(
          "sign-in's own limit counts per address, and a made-up X-Forwarded-For is no new address",
          async () => {
            // Better Auth allows three sign-in tries in ten seconds per address: each try here
            // claims another one.
            const statuses = [];
            for (let i = 0; i < 6; i++) {
              const answer = await fetch(`${base}/api/auth/sign-in/email`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Origin: base,
                  "X-Forwarded-For": `10.9.${i}.1`,
                },
                body: JSON.stringify({ email: "guess@example.com", password: "guess" }),
              });
              // The server's own limit says so in plain text; this one is sign-in's.
              statuses.push(
                answer.status === 429 && !(await answer.text()).startsWith("Too many requests;")
                  ? 429
                  : answer.status,
              );
            }
            if (!statuses.includes(429))
              throw new Error(`six tries from "six addresses" gave ${statuses.join(", ")}`);
          },
        );
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
          if (headers.get("x-frame-options") !== "DENY")
            throw new Error(`X-Frame-Options: ${headers.get("x-frame-options")}`);
          if (!/camera=\(\).*geolocation=\(\)/.test(headers.get("permissions-policy") ?? ""))
            throw new Error(`Permissions-Policy: ${headers.get("permissions-policy")}`);
          // HSTS only over https (a proxy says so only when trusted): this request was plain http.
          if (headers.get("strict-transport-security"))
            throw new Error("Strict-Transport-Security over plain http");
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
        "a server function, and a file sent to a record, answer the app's own pages, and no other site or sibling app",
        async () => {
          // A server function's address is its id, which the built pages carry.
          const assets = join(dir, "dist/client/assets");
          const id = readdirSync(assets)
            .filter((file) => file.endsWith(".js"))
            .map((file) => readFileSync(join(assets, file), "utf8").match(/`([a-f0-9]{64})`/)?.[1])
            .find(Boolean);
          if (!id) throw new Error("no server function in the built pages");
          const call = async (headers) =>
            (await fetch(`${base}/_serverFn/${id}`, { headers })).status;
          for (const from of ["cross-site", "same-site"])
            if ((await call({ "Sec-Fetch-Site": from })) !== 403)
              throw new Error(`a ${from} call was answered`);
          if ((await call({ Origin: "https://other.example" })) !== 403)
            throw new Error("a call from another origin was answered");
          if ((await call({})) !== 403) throw new Error("a call that names no origin was answered");
          if ((await call({ "Sec-Fetch-Site": "same-origin" })) === 403)
            throw new Error("the app's own pages are refused");
          // An older browser names the page instead; behind a proxy only the host matches.
          if ((await call({ Origin: `https://localhost:${port}` })) === 403)
            throw new Error("the app's own address is refused");
          // A picture or document sent to a record is a session's call too, checked the same way.
          const send = async (headers) =>
            (await fetch(`${base}/files/no-model/no-field`, { method: "POST", headers, body: "x" }))
              .status;
          if ((await send({ "Sec-Fetch-Site": "cross-site" })) !== 403)
            throw new Error("an upload from another site was answered");
          if ((await send({ Origin: "https://other.example" })) !== 403)
            throw new Error("an upload from another origin was answered");
          if ((await send({ "Sec-Fetch-Site": "same-origin" })) === 403)
            throw new Error("an upload from the app's own pages is refused");
        },
      ).catch(() => {});
      await asyncStep(
        "a request may carry at most 1 MB, a document sent to its record 10 MB, said by its length: more is refused (413), and one without a length too (411)",
        async () => {
          // Only the length is sent: the server answers from it before any body, and a body
          // still being sent when it closes the connection would race its answer.
          const lengthOnly = (path, length) =>
            new Promise((resolve, reject) => {
              const asked = request(`${base}${path}`, {
                method: "POST",
                headers: {
                  "content-type": "application/octet-stream",
                  "content-length": length,
                  "sec-fetch-site": "same-origin",
                },
              });
              asked.on("response", (answer) => {
                resolve(answer.statusCode);
                asked.destroy();
              });
              asked.on("error", reject);
              asked.flushHeaders();
            });
          const big = await lengthOnly("/", 1_000_001);
          if (big !== 413) throw new Error(`1 MB and a byte gave ${big}`);
          // A document (up to 10 MB, src/kit/uploads.ts) goes to /files/…: 2 MB reaches the app
          // (which knows no such field: 404, answered without reading the body), 10 MB and a
          // byte does not.
          const upload = await lengthOnly("/files/no-model/no-field", 2_000_000);
          if (upload !== 404) throw new Error(`a 2 MB document gave ${upload}`);
          const huge = await lengthOnly("/files/no-model/no-field", 10_000_001);
          if (huge !== 413) throw new Error(`10 MB and a byte to /files gave ${huge}`);
          const chunked = await fetch(`${base}/`, {
            method: "POST",
            body: new ReadableStream({
              start(c) {
                c.enqueue(new Uint8Array(10));
                c.close();
              },
            }),
            duplex: "half",
          });
          if (chunked.status !== 411)
            throw new Error(`a body without a length gave ${chunked.status}`);
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
    // The trash (docs/design/trash.md) on a model with places and on one the API offers: the
    // dev server's flows run with it (a cancelled booking frees its place; the API's 410).
    // Tasks and notes point to projects: all three have a trash, so a project goes with them
    // (docs/design/delete-together.md), through the API.
    if (example === "booking" || example === "api")
      step(
        `op setTrash ${example === "booking" ? "Booking" : "Task, Project and Note"} true, and the app type-checks`,
        () => {
          for (const model of example === "booking" ? ["Booking"] : ["Task", "Project", "Note"]) {
            const done = smithable(dir, "op", "setTrash", model, "true");
            if (done.code !== 0) throw new Error(done.out);
          }
          run("pnpm", ["typecheck"], dir);
        },
      );
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
    // Ask proposing an action that asks for a value: a missing one is said when proposing, never
    // at Confirm (the reopen action just added asks for the update's message).
    if (example === "status")
      step("Ask checks what an action asks for when it proposes it", () => {
        const done = smithable(dir, "op", "setAssistant", "staff", "--may", "change");
        if (done.code !== 0) throw new Error(done.out);
        const check = join(dir, "src/ask-asks.test.ts");
        writeFileSync(
          check,
          `import { expect, test, vi } from "vitest";
import { db } from "#/db";
import * as schema from "#/db/schema";
import { traced } from "#/kit/trace.server";
import { ask } from "./generated/ask.server";

const staff = { id: "ask-staff", name: "S", email: "", role: "staff" };
const inRequest = async <T,>(run: () => Promise<T>): Promise<T> => {
  let result: T | undefined;
  await traced(new Request("http://app.test/"), "127.0.0.1", async () => {
    result = await run();
    return new Response(null);
  });
  return result as T;
};
const reopen = (input: unknown) => ({ choices: [{ message: { tool_calls: [{ id: "1", type: "function", function: { name: "run", arguments: JSON.stringify({ action: "reopen", id: incident.id, input }) } }] } }] });
const incident = db.insert(schema.incidents).values({ title: "Asks check", status: "resolved", detectedAt: new Date() }).returning().get();

test("what an action asks for is checked when it is proposed", async () => {
  process.env.ASSISTANT_URL = "http://model.test";
  process.env.ASSISTANT_MODEL = "stand-in";
  const replies: unknown[] = [reopen({}), { choices: [{ message: { content: "It needs a message." } }] }, reopen({ "IncidentUpdate.message": "Back again" })];
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify(replies.shift())));
  const missing = await inRequest(() => ask(staff, "reopen Asks check"));
  expect(missing.steps[0].error).toContain("needs");
  expect(missing.steps[0].proposal).toBeUndefined();
  const given = await inRequest(() => ask(staff, "reopen Asks check, the errors are back"));
  expect(given.steps[0].proposal).toBeTruthy();
  expect(given.steps[0].card?.title).toContain("Asks check");
});
`,
        );
        try {
          run("pnpm", ["exec", "vitest", "run", "src/ask-asks.test.ts"], dir);
        } finally {
          rmSync(check);
        }
        const undone = smithable(dir, "undo");
        if (undone.code !== 0) throw new Error(undone.out);
      });
    // Models whose tables have the names of generated locals (rows, values): the generated code
    // reaches tables through the schema namespace, so nothing shadows them.
    if (example === "status")
      step(
        "models named Row and Value, with a data page and the API on every model, type-check; the tools' measure sums, averages, names the largest's record and sums per value and per reference (by title) for real, and refuses to add up a computed field over more than 10,000 records; undo takes them back",
        () => {
          const ops = [
            ["addModel", "Row", "label=string!", "amount=money"],
            ["addField", "Row", "twice", "money", "--formula", "amount * 2"],
            ["addField", "Row", "size", "small | large"],
            ["addModel", "Value", "name=string!", "amount=int"],
            // A model with no text to search, offered to programs like the rest (a first build's).
            ["addModel", "Tally", "count=int!"],
            // A reference added to an existing table, to one named like an SQL word (values):
            // its migration names the table quoted (quoteReferences).
            ["addField", "Row", "group", "Value"],
            ["addDataPage"],
            ["setApi", "all", "--actions", "all", "--assistants", "true"],
          ];
          for (const args of ops) {
            const done = smithable(dir, "op", ...args);
            if (done.code !== 0) throw new Error(done.out);
          }
          run("pnpm", ["typecheck"], dir);
          // The assistants' measure, run for real through the generated tools: a sum, an
          // average with a condition, and a sum per value of a field.
          // As a test of the app's own (its Vitest gives the kit the environment Vite would).
          const check = join(dir, "src/measure-check.test.ts");
          writeFileSync(
            check,
            `import { expect, test } from "vitest";
import { db } from "#/db";
import * as schema from "#/db/schema";
import { callTool } from "./generated/mcp.server";

test("measure sums, averages and sums per value", async () => {
  const key = { id: "key:0", name: "Check", email: "", role: "admin" } as never;
  const groups: Record<string, number> = {};
  for (const name of ["North", "South"]) groups[name] = ((await callTool(key, "add", { kind: "Value", values: { name } })) as { id: number }).id;
  for (const [label, amount, size, group] of [["a", "10.00", "small", "South"], ["b", "20.50", "large", "South"], ["c", "30.00", "large", "North"], ["d", "1.00", "small", "North"]])
    await callTool(key, "add", { kind: "Row", values: { label, amount, size, group: groups[group] } });
  expect(await callTool(key, "measure", { kind: "Row", of: "sum amount" })).toEqual({ sum: 61.5 });
  // A computed field is worked out in the app and added up there.
  expect(await callTool(key, "measure", { kind: "Row", of: "sum twice" })).toEqual({ sum: 123 });
  expect(await callTool(key, "measure", { kind: "Row", of: "average amount", where: { size: "large" } })).toEqual({ average: 25.25 });
  expect(await callTool(key, "measure", { kind: "Row", of: "sum amount", by: "size" })).toEqual({
    by: "size",
    rows: [{ value: "large", number: 50.5 }, { value: "small", number: 11 }],
  });
  // The largest says which record holds it; a sum per reference names each group.
  expect(await callTool(key, "measure", { kind: "Row", of: "max amount" })).toMatchObject({ largest: 30, of: { title: "c" } });
  expect(await callTool(key, "measure", { kind: "Row", of: "max twice" })).toMatchObject({ largest: 60, of: { title: "c" } });
  expect(await callTool(key, "measure", { kind: "Row", of: "sum amount", by: "group" })).toMatchObject({
    rows: [{ title: "North", number: 31 }, { title: "South", number: 30.5 }],
  });
  // A computed field is added up over at most 10,000 records in one call; more are refused
  // with how to narrow them, and a narrower call still works.
  const bulk = Array.from({ length: 10_001 }, (_, i) => ({ label: \`bulk \${i}\`, amount: 100, size: "small" as const }));
  for (let i = 0; i < bulk.length; i += 500) db.insert(schema.rows).values(bulk.slice(i, i + 500)).run();
  await expect(callTool(key, "measure", { kind: "Row", of: "sum twice" })).rejects.toThrow("narrow them with where");
  expect(await callTool(key, "measure", { kind: "Row", of: "sum twice", where: { size: "large" } })).toEqual({ sum: 101 });
});
`,
          );
          try {
            run("pnpm", ["exec", "vitest", "run", "src/measure-check.test.ts"], dir);
          } finally {
            rmSync(check);
          }
          for (const _ of ops) {
            const undone = smithable(dir, "undo");
            if (undone.code !== 0) throw new Error(undone.out);
          }
        },
      );
    // The inspector's answering loop (docs/design/assistant.md §4), with a stand-in for the host's
    // model: the app runs the model's calls through the role's own tools and sends the results
    // back, a change is only proposed, a kind the role is not offered is refused, and a used-up
    // allowance (402) is said in the host's words.
    if (example === "api")
      step(
        "the inspector's model loop: tools run as the role and their results go back, tokens add up, a change is only proposed, a kind not offered is refused, a 402 is said",
        () => {
          const check = join(dir, "src/inspector-check.test.ts");
          writeFileSync(
            check,
            `import { expect, test } from "vitest";
import { db } from "#/db";
import * as schema from "#/db/schema";
import { callTool, offerFor } from "./generated/mcp.server";
import { answer } from "./kit/assistant.server";

const viewer = { id: "key:inspector:check", name: "Check", email: "", role: "assistant" };
const call = (name: string, args: Record<string, unknown>) => callTool(viewer, name, args);
const tasks = async () => ((await call("measure", { kind: "Task" })) as { total: number }).total;
const toolCall = (id: string, name: string, args: unknown) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });

test("the model's tool loop", async () => {
  const replies: unknown[] = [];
  const sent: { body: Record<string, any>; person: string }[] = [];
  const model = { url: "http://model.test", key: "k", model: "m", person: "admin-1" };
  const fake = (async (_url: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>;
    sent.push({ body: JSON.parse(String(init.body)), person: headers["x-assistant-person"] });
    return new Response(JSON.stringify(replies.shift()));
  }) as unknown as typeof fetch;
  const ask = (question: string) => answer(question, { offer: offerFor(viewer), kinds: [], call, model, fetch: fake });

  replies.push(
    { choices: [{ message: { content: null, tool_calls: [toolCall("1", "measure", { kind: "Task" })] } }], usage: { prompt_tokens: 100, completion_tokens: 10 } },
    { choices: [{ message: { content: "That many tasks." } }], usage: { prompt_tokens: 120, completion_tokens: 5 } },
  );
  const counted = await ask("what is on my plate");
  expect(counted).toMatchObject({ source: "ai", text: "That many tasks.", tokens: { in: 220, out: 15 } });
  expect(counted.steps[0]).toMatchObject({ tool: "measure", result: { total: await tasks() } });
  expect(sent[0].person).toBe("admin-1");
  expect(sent[0].body.tools.map((t: any) => t.function.name)).toContain("find");
  expect(sent[1].body.messages.at(-1)).toMatchObject({ role: "tool", tool_call_id: "1" });

  // A change is shown, never made.
  const before = await tasks();
  replies.push({ choices: [{ message: { content: "I can add it.", tool_calls: [toolCall("2", "add", { kind: "Task", values: { title: "Never made" } })] } }] });
  const proposed = await ask("add a task called Never made");
  expect(proposed.steps[0]).toMatchObject({ tool: "add", proposed: true });
  expect(await tasks()).toBe(before);

  // A change to a record is proposed too, and the record stays as it was.
  const project = db.insert(schema.projects).values({ name: "Inspector check" }).returning().get();
  const task = db.insert(schema.tasks).values({ title: "Kept as it is", projectId: project.id }).returning().get();
  const [taskId, title] = [task.id, "Kept as it is"];
  replies.push({ choices: [{ message: { tool_calls: [toolCall("4", "change", { kind: "Task", id: taskId, values: { title: "Changed by a model" } })] } }] });
  const change = await ask("rename the first task");
  expect(change.steps[0]).toMatchObject({ tool: "change", proposed: true });
  expect(((await call("read", { kind: "Task", id: taskId })) as { title: string }).title).toBe(title);

  // A role's name that is also an object's own word is no role.
  expect(offerFor({ ...viewer, role: "constructor" }).tools).toEqual([]);

  // Only the kinds the role is offered.
  replies.push(
    { choices: [{ message: { tool_calls: [toolCall("3", "find", { kind: "User" })] } }] },
    { choices: [{ message: { content: "I cannot." } }] },
  );
  const refused = await ask("list the users");
  expect(refused.steps[0].error).toContain('"kind" is one of');

  // The host's allowance used up: said in its words, and the rules still answer.
  const spent = await answer("anything", {
    offer: offerFor(viewer), kinds: [], call, model,
    fetch: (async () => new Response(JSON.stringify({ error: { message: "Used up for today." } }), { status: 402 })) as unknown as typeof fetch,
  });
  expect(spent).toMatchObject({ source: "none" });
  expect(spent.note).toContain("Used up for today.");
});
`,
          );
          try {
            run("pnpm", ["exec", "vitest", "run", "src/inspector-check.test.ts"], dir);
          } finally {
            rmSync(check);
          }
        },
      );
    // A visitor counting through the tools where only part of a model is public (security): with
    // incidents public only while investigated, nothing the tools answer a visitor tells of the
    // others: not their number, their values, their titles, their largest number or their ids.
    if (example === "status")
      step(
        "security: a visitor's tools count, add up, split, find, search and read only the public part of a model",
        () => {
          const ops = [
            ["setPublicWhere", "Incident", "status=investigating"],
            ["addField", "Incident", "minutes", "int"],
          ];
          for (const args of ops) {
            const done = smithable(dir, "op", ...args);
            if (done.code !== 0) throw new Error(done.out);
          }
          const check = join(dir, "src/partly-public-check.test.ts");
          writeFileSync(
            check,
            `import { expect, test } from "vitest";
import { db } from "#/db";
import * as schema from "#/db/schema";
import { callTool } from "./generated/mcp.server";

const visitor = null;
const ask = (name: string, args: Record<string, unknown>) => callTool(visitor, name, args);

test("only the public part", async () => {
  const at = new Date("2026-09-01T10:00:00Z");
  const shown = db.insert(schema.incidents).values({ title: "Shown outage", status: "investigating", detectedAt: at, minutes: 5 }).returning().get();
  const hidden = db.insert(schema.incidents).values({ title: "Hidden breach", status: "resolved", detectedAt: at, minutes: 999 }).returning().get();
  db.insert(schema.incidents).values({ title: "Hidden drill", status: "monitoring", detectedAt: at, minutes: 700 }).run();
  const seen = db.select().from(schema.incidents).all().filter((r) => r.status === "investigating");

  expect(await ask("measure", { kind: "Incident" })).toEqual({ total: seen.length });
  const largest = (await ask("measure", { kind: "Incident", of: "max minutes" })) as { largest: number; of: { id: number } };
  expect(largest.largest).toBeLessThan(700);
  expect(largest.of.id).not.toBe(hidden.id);
  const summed = (await ask("measure", { kind: "Incident", of: "sum minutes" })) as { sum: number };
  expect(summed.sum).toBe(seen.reduce((n, r) => n + (r.minutes ?? 0), 0));
  const split = (await ask("measure", { kind: "Incident", by: "status" })) as { rows: { value: unknown }[] };
  expect(split.rows.map((r) => r.value)).toEqual(["investigating"]);
  expect(await ask("find", { kind: "Incident", where: { status: "resolved" } })).toMatchObject({ total: 0 });
  expect(await ask("find", { kind: "Incident", search: "Hidden" })).toMatchObject({ total: 0 });
  expect(await ask("find", { kind: "Incident", search: "Shown" })).toMatchObject({ total: 1 });
  expect(await ask("find", { kind: "Incident", where: { minutes: { over: 100 } } })).toMatchObject({ total: 0 });
  expect(await ask("find", { kind: "Incident", where: { minutes: { over: 1 } } })).toMatchObject({ total: 1 });
  const listed = JSON.stringify(await ask("find", { kind: "Incident", limit: 50 }));
  expect(listed).not.toContain("Hidden");
  expect(listed).toContain(shown.title);
  // The visitor reads the public one, by id and by title; never a hidden one.
  expect(await ask("read", { kind: "Incident", id: shown.id })).toMatchObject({ title: "Shown outage" });
  expect(await ask("read", { kind: "Incident", id: "Shown outage" })).toMatchObject({ id: shown.id });
  await expect(ask("read", { kind: "Incident", id: hidden.id })).rejects.toThrow();
  await expect(ask("read", { kind: "Incident", id: "Hidden breach" })).rejects.toThrow();
  expect(JSON.stringify(await ask("describe", { kind: "Incident" }))).not.toContain("Hidden");
});
`,
          );
          try {
            run("pnpm", ["exec", "vitest", "run", "src/partly-public-check.test.ts"], dir);
          } finally {
            rmSync(check);
          }
          for (const _ of ops) {
            const undone = smithable(dir, "undo");
            if (undone.code !== 0) throw new Error(undone.out);
          }
        },
      );
    // "Ask" for the app's people (docs/design/assistant.md §6), switched on for members by its
    // operation and kept for the browser flow.
    if (example === "api")
      step(
        "op setAssistant gives members Ask and the app type-checks; ask() refuses whom the block does not name, and a visitor's question never reaches the model",
        () => {
          const op = (...args) => {
            const done = smithable(dir, "op", ...args);
            if (done.code !== 0) throw new Error(done.out);
          };
          const test = (name, source) => {
            const check = join(dir, `src/${name}.test.ts`);
            writeFileSync(check, source);
            try {
              run("pnpm", ["exec", "vitest", "run", `src/${name}.test.ts`], dir);
            } finally {
              rmSync(check);
            }
          };
          const people = `const member = { id: "ask-member", name: "M", email: "", role: "member" };
const admin = { id: "ask-admin", name: "A", email: "", role: "admin" };`;
          op("setAssistant", "member");
          run("pnpm", ["typecheck"], dir);
          test(
            "ask-named",
            `import { expect, test } from "vitest";
import { AccessDenied } from "#/kit/access";
import { ask } from "./generated/ask.server";
${people}

test("ask() answers only whom the block names", async () => {
  await expect(ask(admin, "how many tasks")).rejects.toThrow(AccessDenied);
  await expect(ask(null, "how many tasks")).rejects.toThrow(AccessDenied);
  expect((await ask(member, "how many tasks")).source).toBe("records");
});
`,
          );
          // Visitors too: answered by the rules, never by the model, which a person still reaches.
          op("setAssistant", "anyone");
          test(
            "ask-visitor",
            `import { expect, test, vi } from "vitest";
import { ask } from "./generated/ask.server";
${people}

test("a visitor's question never reaches the model", async () => {
  process.env.ASSISTANT_URL = "http://model.test";
  process.env.ASSISTANT_MODEL = "stand-in";
  const called: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    called.push(String(url));
    return new Response(JSON.stringify({ choices: [{ message: { content: "From the model." } }] }));
  });
  const visitor = await ask(null, "write a poem about the tasks");
  expect(visitor.source).toBe("none");
  expect(visitor.note).not.toContain("ASSISTANT_URL");
  expect(called).toEqual([]);
  const person = await ask(member, "write a poem about the tasks");
  expect(person.text).toBe("From the model.");
  expect(called).toHaveLength(1);
});
`,
          );
          const undone = smithable(dir, "undo");
          if (undone.code !== 0) throw new Error(undone.out);
          // may: change: a change the model proposes is checked, carded, and made once confirmed;
          // with the API's own assistants allowed to delete, Ask still never does.
          op(
            "setApi",
            "all",
            "--actions",
            "all",
            "--assistants",
            "true",
            "--assistants-delete",
            "true",
          );
          op("setAssistant", "member", "--may", "change");
          run("pnpm", ["typecheck"], dir);
          test(
            "ask-change",
            `import { eq } from "drizzle-orm";
import { expect, test, vi } from "vitest";
import { db } from "#/db";
import * as schema from "#/db/schema";
import { AccessDenied } from "#/kit/access";
import { traced } from "#/kit/trace.server";
import { ask, confirm } from "./generated/ask.server";
${people}

/** Inside a request, as a page's call is: the trace and the audit log see it. */
const inRequest = async <T,>(run: () => Promise<T>): Promise<T> => {
  let result: T | undefined;
  await traced(new Request("http://app.test/"), "127.0.0.1", async () => {
    result = await run();
    return new Response(null);
  });
  return result as T;
};
const toolCall = (id: string, name: string, args: unknown) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });

test("a change Ask proposes is checked, carded, and made once confirmed", async () => {
  process.env.ASSISTANT_URL = "http://model.test";
  process.env.ASSISTANT_MODEL = "stand-in";
  const replies: unknown[] = [];
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify(replies.shift() ?? { choices: [{ message: { content: "Done." } }] })));
  // The person asking is a user of the app: what they add is theirs.
  db.insert(schema.user).values({ id: member.id, name: member.name, email: "ask-member@example.com", role: "member" }).run();
  const project = db.insert(schema.projects).values({ name: "Ask change check" }).returning().get();
  const task = db.insert(schema.tasks).values({ title: "Kept for Ask", projectId: project.id, status: "todo" }).returning().get();
  const status = () => db.select().from(schema.tasks).where(eq(schema.tasks.id, task.id)).get()?.status;

  // Proposed by title: resolved to the record, checked, and carded in the app's words.
  replies.push({ choices: [{ message: { content: "Shall I?", tool_calls: [toolCall("1", "change", { kind: "Task", id: "Kept for Ask", values: { status: "doing" } })] } }] });
  const asked = await inRequest(() => ask(member, "start the task Kept for Ask"));
  const step = asked.steps[0];
  expect(step).toMatchObject({ tool: "change", proposed: true });
  expect(step.card?.title).toContain("Kept for Ask");
  expect(step.card?.changes).toEqual([{ label: "Status", from: "todo", to: "doing" }]);
  expect(status()).toBe("todo");

  // Confirmed: made as the person, once, and logged as through Ask.
  await inRequest(() => confirm(member, step.proposal as string, new Headers()));
  expect(status()).toBe("doing");
  const line = db.select().from(schema.auditLog).all().at(-1);
  expect(line).toMatchObject({ who: member.id, details: expect.objectContaining({ through: "Ask" }) });
  await expect(inRequest(() => confirm(member, step.proposal as string, new Headers()))).rejects.toThrow("no longer there");

  // Never a delete, even where the API's assistants may; never a value the schema refuses.
  replies.push({ choices: [{ message: { tool_calls: [toolCall("2", "delete", { kind: "Task", id: task.id })] } }] });
  const deleting = await inRequest(() => ask(member, "delete the task Kept for Ask"));
  expect(deleting.steps[0]).toMatchObject({ tool: "delete" });
  expect(deleting.steps[0].error).toBeTruthy();
  expect(deleting.steps[0].proposal).toBeUndefined();
  replies.push({ choices: [{ message: { tool_calls: [toolCall("3", "change", { kind: "Task", id: task.id, values: { status: "nonsense" } })] } }] });
  const refused = await inRequest(() => ask(member, "make it nonsense"));
  expect(refused.steps[0].error).toBeTruthy();
  expect(refused.steps[0].proposal).toBeUndefined();
  expect(status()).toBe("doing");

  // A record the values refer to by its title: found when proposing, kept by id, shown by title.
  replies.push({ choices: [{ message: { tool_calls: [toolCall("5", "add", { kind: "Task", values: { title: "Added by Ask", project: "Ask change check" } })] } }] });
  const adding = await inRequest(() => ask(member, "add a task to Ask change check"));
  expect(adding.steps[0].card?.changes).toContainEqual({ label: "Project", to: "Ask change check" });
  await inRequest(() => confirm(member, adding.steps[0].proposal as string, new Headers()));
  expect(db.select().from(schema.tasks).where(eq(schema.tasks.title, "Added by Ask")).get()?.projectId).toBe(project.id);

  // Only the person the proposal was made for, and only with Ask.
  replies.push({ choices: [{ message: { tool_calls: [toolCall("4", "change", { kind: "Task", id: task.id, values: { status: "done" } })] } }] });
  const again = await inRequest(() => ask(member, "finish it"));
  const id = again.steps[0].proposal as string;
  await expect(confirm(admin, id, new Headers())).rejects.toThrow(AccessDenied);
  await expect(confirm(null, id, new Headers())).rejects.toThrow(AccessDenied);
  await expect(confirm({ ...member, id: "someone-else" }, id, new Headers())).rejects.toThrow("no longer there");
  expect(status()).toBe("doing");
});
`,
          );
          for (const _ of [1, 2]) {
            const back = smithable(dir, "undo");
            if (back.code !== 0) throw new Error(back.out);
          }
          op("setAssistant", "member", "--may", "change");
        },
      );
    // Shapes first builds made that no example has: a hero shortcut to a page behind sign-in, a
    // model owned by a required User field, and an API in an app without a users page.
    if (example === "booking")
      step(
        "a hero shortcut to a page behind sign-in, and a model owned by a required User field, type-check; a key adding such a record names its owner or is told to",
        () => {
          const ops = [
            ["setShortcuts", "home", "schedule", "blog", "instructors"],
            ["addModel", "Posting", "title=string!", "poster=User!"],
            ["setOwner", "Posting", "poster"],
          ];
          for (const args of ops) {
            const done = smithable(dir, "op", ...args);
            if (done.code !== 0) throw new Error(done.out);
          }
          run("pnpm", ["typecheck"], dir);
          // A key owns nothing: it names the poster, or is told to.
          const check = join(dir, "src/required-owner.test.ts");
          writeFileSync(
            check,
            `import { expect, test } from "vitest";
import { db } from "#/db";
import { user } from "#/db/schema";
import { postingData } from "./generated/posting.server";

test("a key adding a posting names its poster, or is told to", async () => {
  const key = { id: "key:1", name: "A key", email: "", role: "admin" };
  await expect(postingData.create(key, { title: "By a key" } as never)).rejects.toThrow("A key owns nothing: name the poster");
  db.insert(user).values({ id: "poster-1", name: "Poster", email: "poster@example.com", role: "admin" }).run();
  const made = await postingData.create(key, { title: "By a key, named", posterId: "poster-1" } as never);
  expect(made.posterId).toBe("poster-1");
});
`,
          );
          try {
            run("pnpm", ["exec", "vitest", "run", "src/required-owner.test.ts"], dir);
          } finally {
            rmSync(check);
          }
          for (const _ of ops) {
            const undone = smithable(dir, "undo");
            if (undone.code !== 0) throw new Error(undone.out);
          }
        },
      );
    if (example === "records")
      step("an API in an app without a users page type-checks", () => {
        const done = smithable(dir, "op", "setApi", "all");
        if (done.code !== 0) throw new Error(done.out);
        run("pnpm", ["typecheck"], dir);
        const undone = smithable(dir, "undo");
        if (undone.code !== 0) throw new Error(undone.out);
      });
    // A stand-in for the host's model, for Ask's confirmation cards: it proposes starting a task.
    if (example === "api") {
      const stand = await standInModel();
      process.env.ASSISTANT_URL = stand.url;
      process.env.ASSISTANT_MODEL = "stand-in";
    }
    // Over https the session cookie is one only the app's own address can set (__Host-), so a
    // sibling app on the same domain cannot plant it.
    if (example === "crm")
      step(
        "over https the session cookie is __Host- (Secure, Path=/, no Domain); over http as before",
        () => {
          const check = join(dir, "src/host-cookie.test.ts");
          writeFileSync(
            check,
            `import { expect, test, vi } from "vitest";

const sessionCookie = async (url: string) => {
  vi.resetModules();
  process.env.BETTER_AUTH_URL = url;
  const { auth } = await import("#/lib/auth");
  const context = await auth.$context;
  return { ...context.authCookies.sessionToken, state: context.createAuthCookie("state") };
};

test("the session cookie's name and attributes", async () => {
  const https = await sessionCookie("https://crm.example");
  expect(https.name).toBe("__Host-better-auth.session_token");
  expect(https.attributes).toMatchObject({ secure: true, path: "/" });
  expect(https.attributes.domain).toBeUndefined();
  // A sign-in's state cookie stays Secure, and only this address's.
  expect(https.state.name).toBe("__Host-better-auth.state");
  expect(https.state.attributes.secure).toBe(true);
  const http = await sessionCookie("http://localhost:3000");
  expect(http.name.startsWith("__Host-")).toBe(false);
  // The auth module imported cold twice, beside the other examples building: more than
  // vitest's five seconds on a busy machine (a gate on 2026-10-09).
}, 60_000);
`,
          );
          try {
            run("pnpm", ["exec", "vitest", "run", "src/host-cookie.test.ts"], dir);
          } finally {
            rmSync(check);
          }
        },
      );
    const receiver = example === "status" ? await callReceiver() : undefined;
    stop = await serve(dir, port + 100, "dev", receiver?.env);
    try {
      const base = `http://localhost:${port + 100}`;
      await asyncStep(
        "the dev server hands out no file of the app's data (the database, the outbox)",
        async () => {
          for (const path of ["/data/db/app.db?raw", "/data/db/app.db?url", "/data/db/app.db"]) {
            const answer = await fetch(`${base}${path}`);
            if (answer.status !== 403) throw new Error(`${path} answers ${answer.status}`);
          }
        },
      ).catch(() => {});
      await visualChecks(dir, base);
      await robotsCheck(base);
      await sitemapCheck(dir, base);
      await legalCheck(dir, base);
      await logoCheck(dir, base);
      await aiMarkCheck(dir, base);
      if (example === "crm") {
        await browserFlow(dir, base);
        await filtersFlow(base);
        await pagingFlow(dir, base);
        await favoritesFlow(base);
        await contactFlow(dir, base);
      }
      if (example === "booking") {
        await landingFlow(base);
        await calendarFlow(base);
        await bookingFlow(dir, base);
        await outgoingFlow(dir, base);
        await visitorMailFlow(dir, base);
        await markdownFlow(base);
        await inputSecurityFlow(dir, base);
        await articlesFlow(dir, base);
        await calculatorFlow(base);
        await pictureFlow(dir, base);
        await picturesFlow(dir, base);
        await incomingMailFlow(dir, base);
      }
      if (example === "marketplace") await marketplaceFlow(dir, base);
      if (example === "marketplace") await reviewFlow(dir, base);
      if (example === "status") await statusFlow(base);
      if (example === "status") await sessionFlow(base);
      if (receiver) await callFlow(dir, base, receiver);
      if (receiver) await incomingFlow(dir, base);
      if (example === "api") await apiFlow(base);
      if (example === "api") await apiTrashFlow(base);
      if (example === "api") await askPanelFlow(dir, base);
      if (example === "invoicing") {
        await copyFlow(base);
        await documentFlow(dir, base);
        await formulaFlow(base);
        await addChildFlow(base);
        await onboardingFlow(base);
        await isolationFlow(dir, base);
      }
    } finally {
      stop();
      receiver?.close();
      delete process.env.OUTGOING_STATUSFEED_URL;
      delete process.env.OUTGOING_STATUSFEED_SECRET;
      delete process.env.INCOMING_MONITORDOWN_SECRET;
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

    if (example === "status") await analyticsFlow(dir, port);
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

/**
 * A counter of visits (docs/design/analytics.md), in a production build: Plausible's script is in
 * the page and allowed by the policy, with no bar; Google's waits for Accept in the consent bar,
 * and Decline is remembered. The providers' addresses answer from here, never the real ones.
 */
async function analyticsFlow(dir, port) {
  const ok = (r) => {
    if (r.code !== 0) throw new Error(r.out);
  };
  /** The app built with the counter, served; `check` gets the address and a browser. */
  const withCounter = async (provider, id, check) => {
    ok(smithable(dir, "op", "setAnalytics", provider, id));
    let stop;
    const browser = await chromium.launch();
    try {
      run("pnpm", ["build"], dir);
      stop = await serve(dir, port, "production");
      await check(`http://localhost:${port}`, browser);
    } finally {
      await browser.close();
      stop?.();
      ok(smithable(dir, "undo"));
    }
  };
  /** A page whose provider addresses are answered here, with what it asked of them. */
  const page = async (context) => {
    const asked = [];
    const tab = await context.newPage();
    await tab.route(/plausible\.io|googletagmanager\.com|google-analytics\.com/, (route) => {
      asked.push(route.request().url());
      return route.fulfill({ contentType: "text/javascript", body: "" });
    });
    return { tab, asked };
  };
  await asyncStep(
    "Plausible in a production build: its script is in the page and allowed, and no consent bar",
    () =>
      withCounter("plausible", "status.example.com", async (base, browser) => {
        const policy = (await fetch(`${base}/sign-in`)).headers.get("content-security-policy");
        if (!/script-src [^;]*https:\/\/plausible\.io/.test(policy ?? ""))
          throw new Error(`the policy: ${policy}`);
        if (/googletagmanager/.test(policy ?? "")) throw new Error("Google is allowed too");
        const { tab, asked } = await page(await browser.newContext());
        await tab.goto(`${base}/sign-in`);
        await tab.waitForSelector("body[data-hydrated]");
        await tab.waitForSelector(
          'script[src="https://plausible.io/js/script.js"][data-domain="status.example.com"]',
          { state: "attached" },
        );
        if (!asked.some((u) => u.includes("plausible.io/js/script.js")))
          throw new Error("the script was not loaded");
        await tab.waitForTimeout(300);
        if (await tab.locator('[data-part="consent"]').count())
          throw new Error("a consent bar for a counter without cookies");
      }),
  );
  await asyncStep(
    "Google Analytics: the consent bar, nothing of Google's before Accept, its script after, Decline remembered",
    () =>
      withCounter("google", "G-TEST1234", async (base, browser) => {
        const accepting = await browser.newContext();
        const { tab, asked } = await page(accepting);
        await tab.goto(`${base}/sign-in`);
        await tab.waitForSelector("body[data-hydrated]");
        const bar = tab.locator('[data-part="consent"]');
        await bar.waitFor();
        await tab.waitForTimeout(300);
        if (asked.length) throw new Error(`asked Google before a yes: ${asked.join(", ")}`);
        await bar.getByRole("button", { name: "Accept" }).click();
        await tab.waitForSelector('script[src*="googletagmanager.com/gtag/js?id=G-TEST1234"]', {
          state: "attached",
        });
        await bar.waitFor({ state: "detached" });
        // The next page has the yes already: the script comes at once, with no bar.
        await tab.reload();
        await tab.waitForSelector('script[src*="googletagmanager.com/gtag/js"]', {
          state: "attached",
        });
        if (await bar.count()) throw new Error("asked again after a yes");
        // Cookie settings is there to take it back.
        if (!(await tab.getByRole("button", { name: "Cookie settings" }).count()))
          throw new Error("no Cookie settings");

        const declining = await browser.newContext();
        const other = await page(declining);
        await other.tab.goto(`${base}/sign-in`);
        await other.tab.waitForSelector("body[data-hydrated]");
        await other.tab
          .locator('[data-part="consent"]')
          .getByRole("button", { name: "Decline" })
          .click();
        await other.tab.reload();
        await other.tab.waitForSelector("body[data-hydrated]");
        await other.tab.waitForTimeout(300);
        if (await other.tab.locator('[data-part="consent"]').count())
          throw new Error("asked again after a no");
        if (other.asked.length)
          throw new Error(`asked Google after a no: ${other.asked.join(", ")}`);
      }),
  );
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
    // The hosted form's call: the starter `clarify` picked, a name and --yes beside the text.
    await asyncStep(
      "a starter's own description makes the starter without asking the model, also with the starter named",
      async () => {
        const own = JSON.parse(run("node", [cli, "starters", "--json"], repo)).find(
          (s) => s.name === "crm",
        ).description;
        const calls = model.requests.length;
        for (const flags of [["--starter", "crm", "--name", "Demo app", "--yes"], []]) {
          const made = join(mkdtempSync(join(tmpdir(), "smithable-own-")), "app");
          dirs.push(made);
          const result = await smithableAsync(
            made,
            { SMITHABLE_LOCAL_MODEL: "fake-model", SMITHABLE_LOCAL_URL: model.url },
            "new",
            made,
            "--describe",
            own,
            ...flags,
          );
          if (result.code !== 0 || !result.out.includes("no model is needed"))
            throw new Error(result.out);
          if (model.requests.length !== calls) throw new Error("the model was asked");
          if (!existsSync(join(made, "src/routes/customers/index.tsx")))
            throw new Error("the CRM was not generated");
        }
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
