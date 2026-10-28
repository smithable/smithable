// The ten-changes benchmark, Smithable's side: ten plain-language requests, in order, on the same
// CRM, each through Smith as the Builder's path (`smithable ask "<request>" --yes`), with the same
// rules a person follows at any app builder: the app starts from one description (no hand-written
// spec), eight customers are typed through the form, a failed acceptance check sends one repair
// prompt in a fixed form (three at most), a question back is answered from the request only.
// After each request: the acceptance check in a real browser, every earlier check again
// (regressions), the eight customers read back (data kept); and in their own columns, type-check,
// build, the app's own tests and whether the code is still what the spec generates. (The Builder
// changes bench, bench-changes.mjs, is another thing: single requests on fresh starters, checked in
// the spec they leave.)
// Needs the models set up in the environment (docs/ai.md: the Smithable model; on a machine that
// keeps them in a file, source it first: `set -a; . ~/.config/smithable/<model>.env; set +a`) and
// Playwright. Costs the model's tokens (cents a run): ask before running.
//   node scripts/bench-ten-changes.mjs [--runs N] [--extra <file.md>] [--port P] [--keep]
//   node scripts/bench-ten-changes.mjs --check-only <app dir>   (the checks on a kept app, no model)
// --extra: more requests in the results sheet's table form ("| H1 | request | acceptance |"),
// run after the ten with no check and no repair: a person judges them from the app and the
// screenshots taken after each. Writes docs/benchmarks/ten-changes.md.
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : fallback;
};
const RUNS = Number(option("runs", "1"));
const PORT = Number(option("port", "4760"));
const EXTRA = option("extra");
const KEEP = args.includes("--keep");
const REPAIRS = 3;
const GIVE_UP_MS = 15 * 60_000;
const root = mkdtempSync(join(tmpdir(), "smithable-bench-ten-"));

const DESCRIPTION =
  "A lightweight CRM for a small B2B sales team. Customers have a name, an email, a segment (SMB, enterprise or government) and notes. A page to manage the team. People sign in with their email; two roles, admin and sales.";

/** The eight customers of the results sheet, typed through the form; the eighth by a sales person. */
const CUSTOMERS = [
  ["Nordic Sails Ltd", "anna@nordicsails.example", "SMB", "Met at the boat show."],
  ["Harbour Freight AB", "ops@harbourfreight.example", "enterprise", "Quarterly review in March."],
  ["Åland Museum", "info@alandmuseum.example", "government", "Procurement through the county."],
  ["Birch & Co", "hello@birchco.example", "SMB", "Prefers phone calls."],
  ["Mariehamn Energy", "sales@mhenergy.example", "enterprise", "Framework agreement until 2027."],
  ["Kvarken Ferries", "contact@kvarken.example", "enterprise", "Seasonal, April to October."],
  ["Town of Eckerö", "registry@eckero.example", "government", "Tender expected in autumn."],
  ["Lotta's Bakery", "lotta@bakery.example", "SMB", "Small orders, pays on time."],
];
const CUSTOMERS_PAGE = /customers|clients/i;
const ORDERS_PAGE = /orders/i;

const sh = (command, cmdArgs, cwd, env) => {
  const started = Date.now();
  const r = spawnSync(command, cmdArgs, {
    cwd,
    encoding: "utf8",
    maxBuffer: 1 << 27,
    env: { ...process.env, ...env },
  });
  return {
    ok: r.status === 0,
    out: `${r.stdout}${r.stderr}`,
    stdout: r.stdout,
    ms: Date.now() - started,
  };
};

const mainText = (page) =>
  page
    .locator("main")
    .innerText()
    .catch(() => "");

/**
 * A page's content comes after the network is idle, and after a click in the app a little later
 * than that (the app renders the next page some 150 ms after the click, with no request at all),
 * so given the main text before the click, wait until it has changed; then for a link or heading.
 */
const settled = async (page, before) => {
  if (before !== undefined)
    await page
      .waitForFunction((t) => document.querySelector("main")?.innerText !== t, before, {
        timeout: 10000,
      })
      .catch(() => {});
  await page.waitForLoadState("networkidle");
  await page
    .locator("main a, main h1, main button")
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => {});
};

const open = async (page, url) => {
  await page.goto(url);
  await settled(page);
};

/** The menu link whose name fits, clicked; false when there is none. */
async function go(page, base, name) {
  await open(page, base);
  const link = page.getByRole("navigation").getByRole("link", { name }).first();
  if (!(await link.count())) return false;
  const before = await mainText(page);
  await link.click();
  await settled(page, before);
  return true;
}

/** Fills the form on the current page by its labels and saves; true when the page left the form. */
async function fillAndSave(page, values) {
  for (const [label, value] of Object.entries(values)) {
    const field = page.getByLabel(new RegExp(`^${label}`, "i")).first();
    if (!(await field.count())) return false;
    const tag = await field.evaluate((e) => e.tagName.toLowerCase());
    if (tag === "select") {
      // The option whose label or value is the word, whatever its case ("SMB" is shown as "Smb").
      const options = await field
        .locator("option")
        .evaluateAll((os) =>
          os.map((o) => ({ value: o.value, label: (o.textContent ?? "").trim() })),
        );
      const want = String(value).toLowerCase();
      const found = options.find(
        (o) => o.label.toLowerCase() === want || o.value.toLowerCase() === want,
      );
      if (!found) return false;
      await field.selectOption(found.value);
    } else if ((await field.getAttribute("role")) === "combobox") {
      // A reference: type the title, then take the option that names it.
      await field.fill(value);
      const option = page.getByRole("option", { name: new RegExp(literal(value), "i") }).first();
      try {
        await option.waitFor({ timeout: 3000 });
        await option.click();
      } catch {
        await field.press("Enter");
      }
    } else await field.fill(value);
  }
  // A required choice the request said nothing about gets its first option, as a person would.
  await page
    .locator("main select")
    .evaluateAll((selects) => {
      for (const select of selects) {
        if (select.value) continue;
        const label = select.labels?.[0]?.textContent ?? "";
        if (!(select.required || label.includes("*"))) continue;
        const option = [...select.options].find((o) => o.value);
        if (!option) continue;
        select.value = option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    })
    .catch(() => {});
  const save = page.getByRole("button", { name: /^(save|create|add)/i }).first();
  if (!(await save.count())) return false;
  const before = page.url();
  const textBefore = await mainText(page);
  await save.click();
  // A form that asks before a change it tells people about ("Save the change?") is confirmed.
  const dialog = page.getByRole("dialog");
  if (
    await dialog
      .count()
      .then((n) => n > 0)
      .catch(() => false)
  ) {
    const confirm = dialog.getByRole("button", { name: /^(save|yes|confirm)/i }).first();
    if (await confirm.count()) await confirm.click();
  }
  await page
    .waitForFunction(
      ([u, t]) => location.href !== u || document.querySelector("main")?.innerText !== t,
      [before, textBefore],
      { timeout: 10000 },
    )
    .catch(() => {});
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
  // Saved: the page moved on, or says so; a refused save stays on the form and says what is wrong.
  return page.url() !== before || (await page.getByText(/saved/i).count()) > 0;
}

/** Opens the list page of a kind and presses its add button; true when a form is shown. */
async function openAddForm(page, base, kind) {
  if (!(await go(page, base, kind))) return false;
  const add = page
    .locator("main")
    .getByRole("link", { name: /^(add|new|create)/i })
    .or(page.locator("main").getByRole("button", { name: /^(add|new|create)/i }));
  await add
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  if (!(await add.count())) return false;
  const before = await mainText(page);
  await add.first().click();
  await settled(page, before);
  const save = page.getByRole("button", { name: /^(save|create|add)/i }).first();
  await save.waitFor({ timeout: 10000 }).catch(() => {});
  return (await save.count()) > 0;
}

/** The record page of the record with this name, from the list: a row's title is a link or a button. */
async function openRecord(page, base, kind, name) {
  if (!(await go(page, base, kind))) return false;
  const main = page.locator("main");
  const title = main.getByRole("link", { name }).or(main.getByRole("button", { name })).first();
  await title.waitFor({ timeout: 10000 }).catch(() => {});
  if (!(await title.count())) return false;
  const before = page.url();
  const textBefore = await mainText(page);
  await title.click();
  await page.waitForURL((u) => u.toString() !== before, { timeout: 10000 }).catch(() => {});
  await settled(page, textBefore);
  return page.url() !== before;
}

/**
 * A record's edit form: the record page is the form itself in a Smithable app; a builder that
 * puts it behind an "Edit" link gets the click. False when no form is to be had.
 */
async function openEdit(page) {
  const edit = page
    .getByRole("link", { name: /^edit/i })
    .or(page.getByRole("button", { name: /^edit/i }));
  if (await edit.count()) {
    const before = await mainText(page);
    await edit.first().click();
    await settled(page, before);
  }
  return (await page.getByRole("button", { name: /^(save|create|add)/i }).count()) > 0;
}

const literal = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Narrows the list on the current page to one value of a choice: a filter select labelled with
 * the field's name, or a chip (a button or link) named after the value. False when there is none.
 */
async function narrowTo(page, field, value) {
  const main = page.locator("main");
  const before = await mainText(page);
  const select = main.getByLabel(field).first();
  const option = new RegExp(`^${literal(value)}$`, "i");
  if ((await select.count()) && (await select.evaluate((e) => e.tagName)) === "SELECT") {
    await select.selectOption({ label: option }).catch(() => select.selectOption(value));
  } else {
    const chip = main
      .getByRole("button", { name: option })
      .or(main.getByRole("link", { name: option }))
      .first();
    if (!(await chip.count())) return false;
    await chip.click();
  }
  await page
    .waitForFunction((t) => document.querySelector("main")?.innerText !== t, before, {
      timeout: 5000,
    })
    .catch(() => {});
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
  return true;
}

const seen = async (page, text) => (await page.getByText(text, { exact: false }).count()) > 0;

/** The eight customers are listed with their names (data kept). */
async function customersKept(page, base) {
  if (!(await go(page, base, CUSTOMERS_PAGE))) return false;
  for (const [name] of CUSTOMERS) if (!(await seen(page, name))) return false;
  return true;
}

/**
 * Customer 2's order with this number exists: made through the form, or already there from an
 * earlier pass of the checks (they run again after every later request, and a number is unique).
 */
async function orderMade(page, base, number, total) {
  if (!(await go(page, base, ORDERS_PAGE))) return false;
  if (await seen(page, number)) return true;
  if (!(await openAddForm(page, base, ORDERS_PAGE))) return false;
  return fillAndSave(page, { Number: number, Customer: "Harbour Freight AB", Total: total });
}

/** Signs in with the development sign-in as a role. */
async function signIn(page, base, role) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await open(page, `${base}/sign-in`);
    const button = page.getByRole("button", { name: `Sign in as ${role}` });
    if (!(await button.count())) return false;
    await button.click();
    // The dev sign-in's first try after a restart fails on the password and sets it anew: wait.
    try {
      await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 10000 });
      await settled(page);
      return true;
    } catch {}
  }
  return false;
}

/** The ten requests, typed as written, each with its acceptance check as a person sees it. */
const REQUESTS = [
  {
    id: 1,
    prompt: "Customers should have a phone number.",
    accept:
      'The customer form has a phone field; the list shows it; customer 4 gets "+358 40 123 4567" and shows it.',
    check: async ({ page, base }) => {
      if (!(await openRecord(page, base, CUSTOMERS_PAGE, "Birch & Co"))) return false;
      if (!(await openEdit(page))) return false;
      if (!(await fillAndSave(page, { Phone: "+358 40 123 4567" }))) return false;
      if (!(await go(page, base, CUSTOMERS_PAGE))) return false;
      return seen(page, "+358 40 123 4567");
    },
  },
  {
    id: 2,
    prompt: "The customer email should be required, and no two customers may share one.",
    accept:
      "Saving a new customer without an email is refused with a message; a new customer with customer 1's email is refused; all eight customers are still listed with their emails.",
    check: async ({ page, base }) => {
      if (!(await openAddForm(page, base, CUSTOMERS_PAGE))) return false;
      if (await fillAndSave(page, { Name: "No Mail Ltd", Segment: "SMB" })) return false;
      if (!(await openAddForm(page, base, CUSTOMERS_PAGE))) return false;
      if (await fillAndSave(page, { Name: "Twin Ltd", Email: CUSTOMERS[0][1], Segment: "SMB" }))
        return false;
      if (!(await go(page, base, CUSTOMERS_PAGE))) return false;
      for (const [, email] of CUSTOMERS) if (!(await seen(page, email))) return false;
      return true;
    },
  },
  {
    id: 3,
    prompt: 'Add a segment "partner", and let me filter the customer list by segment.',
    accept:
      '"partner" can be chosen on a customer; the list can be narrowed to one segment and shows the right customers; the eight keep their segments.',
    check: async ({ page, base }) => {
      if (!(await openAddForm(page, base, CUSTOMERS_PAGE))) return false;
      const made = await fillAndSave(page, {
        Name: "Partner Co",
        Email: "partner@partnerco.example",
        Segment: "partner",
      });
      if (!made) return false;
      if (!(await go(page, base, CUSTOMERS_PAGE))) return false;
      if (!(await narrowTo(page, /segment|market/i, "government"))) return false;
      return (await seen(page, "Åland Museum")) && !(await seen(page, "Nordic Sails Ltd"));
    },
  },
  {
    id: 4,
    prompt:
      "Add orders: each order has a number, belongs to a customer and has a total amount. Show them on their own page in the menu.",
    accept:
      '"Orders" is in the menu; an order "1001" for customer 2 with total 1200 can be added, picking the customer from a list; it is listed with the customer\'s name.',
    check: async ({ page, base }) => {
      if (!(await orderMade(page, base, "1001", "1200"))) return false;
      if (!(await go(page, base, ORDERS_PAGE))) return false;
      return (await seen(page, "1001")) && (await seen(page, "Harbour Freight AB"));
    },
  },
  {
    id: 5,
    prompt: "Sales people may only see their own customers. Admins see everyone's.",
    accept:
      "Signed in as a sales person who made customer 8, the list shows customer 8 and not customer 1, and customer 1's address is refused; signed in as admin, all eight are listed.",
    check: async ({ page, base }) => {
      if (!(await signIn(page, base, "sales"))) return false;
      if (!(await go(page, base, CUSTOMERS_PAGE))) return false;
      if (!((await seen(page, "Lotta's Bakery")) && !(await seen(page, "Nordic Sails Ltd"))))
        return false;
      // Customer 1's page, by its address: the admin finds the link, the sales person is refused.
      await signIn(page, base, "admin");
      if (!(await openRecord(page, base, CUSTOMERS_PAGE, "Nordic Sails Ltd"))) return false;
      const address = page.url();
      await signIn(page, base, "sales");
      await open(page, address);
      const refused = !(await seen(page, "anna@nordicsails.example"));
      await signIn(page, base, "admin");
      return refused && (await customersKept(page, base));
    },
  },
  {
    id: 6,
    prompt:
      'Each order has a status: draft, placed or shipped. Add a "Mark shipped" button that only shows for placed orders.',
    accept:
      "Order 1001 set to placed shows the button; pressing it shows shipped; a draft order shows no button.",
    check: async ({ page, base }) => {
      if (!(await openRecord(page, base, ORDERS_PAGE, "1001"))) return false;
      if (!(await openEdit(page))) return false;
      if (!(await fillAndSave(page, { Status: "placed" }))) return false;
      if (!(await openRecord(page, base, ORDERS_PAGE, "1001"))) return false;
      const button = page.getByRole("button", { name: /mark shipped/i });
      if (!(await button.count())) return false;
      await button.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(800);
      if (!(await seen(page, /shipped/i))) return false;
      // A draft order has no button.
      if (!(await orderMade(page, base, "1002", "300"))) return false;
      if (!(await openRecord(page, base, ORDERS_PAGE, "1002"))) return false;
      return (await page.getByRole("button", { name: /mark shipped/i }).count()) === 0;
    },
  },
  {
    id: 7,
    prompt: "On a customer's page, show how many orders they have and the total amount ordered.",
    accept:
      'Customer 2\'s page shows 1 order and 1200; after a second order "1002" of 300 it shows 2 and 1500.',
    check: async ({ page, base }) => {
      // Orders 1001 (1200) and 1002 (300) exist from the earlier checks: 2 orders, 1500 in all.
      if (!(await openRecord(page, base, CUSTOMERS_PAGE, "Harbour Freight AB"))) return false;
      const text = await page.locator("main").innerText();
      return /\b2\b/.test(text) && /1[\s,.]?500/.test(text);
    },
  },
  {
    id: 8,
    prompt: "Send the customer an email when their order is marked shipped.",
    accept:
      'Marking order 1002 shipped produces a mail to customer 2\'s address with "1002" in it, seen in the outbox.',
    check: async ({ page, base, dir }) => {
      const outbox = join(dir, "data", "mail", "outbox");
      const before = existsSync(outbox) ? readdirSync(outbox).length : 0;
      if (!(await openRecord(page, base, ORDERS_PAGE, "1002"))) return false;
      if (await openEdit(page)) {
        await fillAndSave(page, { Status: "placed" });
        await openRecord(page, base, ORDERS_PAGE, "1002");
      }
      const button = page.getByRole("button", { name: /mark shipped/i });
      if (!(await button.count())) return false;
      await button.click();
      await page.waitForTimeout(3000);
      const files = existsSync(outbox) ? readdirSync(outbox).sort() : [];
      if (files.length <= before) return false;
      const mail = readFileSync(join(outbox, files[files.length - 1]), "utf8");
      return mail.includes("ops@harbourfreight.example") && mail.includes("1002");
    },
  },
  {
    id: 9,
    prompt: 'Rename "segment" to "market" everywhere.',
    accept:
      'The word is "market" on the form, in the list and in the filter; the eight customers keep their values.',
    check: async ({ page, base }) => {
      if (!(await openAddForm(page, base, CUSTOMERS_PAGE))) return false;
      if (!(await page.getByLabel(/^market/i).count())) return false;
      if (await page.getByLabel(/^segment/i).count()) return false;
      if (!(await go(page, base, CUSTOMERS_PAGE))) return false;
      const list = await mainText(page);
      if (!/market/i.test(list) || /segment/i.test(list)) return false;
      return (await seen(page, /enterprise/i)) && (await customersKept(page, base));
    },
  },
  {
    id: 10,
    prompt: "Give the app a blue look with rounded corners.",
    accept:
      "Buttons and the header are blue and the controls' corners rounded, on the customers and orders pages alike.",
    check: async ({ page, base }) => {
      const blue = (rgb) => {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
        if (!m) return false;
        const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
        return b > r + 30 && b > g;
      };
      for (const kind of [CUSTOMERS_PAGE, ORDERS_PAGE]) {
        if (!(await go(page, base, kind))) return false;
        const main = page.locator("main");
        const button = main
          .getByRole("link", { name: /^(add|new|create)/i })
          .or(main.getByRole("button"))
          .first();
        if (!(await button.count())) return false;
        const style = await button.evaluate((e) => {
          const s = getComputedStyle(e);
          return {
            bg: s.backgroundColor,
            color: s.color,
            radius: Number.parseFloat(s.borderRadius),
          };
        });
        if (!(blue(style.bg) || blue(style.color)) || !(style.radius >= 6)) return false;
      }
      return true;
    },
  },
];

/** A request that cannot be tried without an earlier one: orders (4) carry 6, 7 and 8. */
const dependsOn = (id, earlier) => earlier === 4 && [6, 7, 8].includes(id);

/** Smith takes the request; the trace line gives the model, the tokens and the price. */
function askSmith(dir, prompt) {
  const asked = sh("node", [cli, "ask", prompt, "--yes", "--dir", dir], repo);
  // "Smithable model (mistral-small-latest) · 17,602 tokens (17,497 in, 105 out) · $0.0027".
  const used = /\(([^)]+)\) · ([\d,]+) tokens(?: \([^)]*\))?(?: · ([€$])([\d.]+))?/.exec(asked.out);
  const lines = asked.out.split("\n").filter(Boolean);
  const applied = /^Generator |applied|Applied/m.test(asked.out);
  return {
    ms: asked.ms,
    ok: asked.ok,
    model: used?.[1] ?? "none",
    generator: /^Generator /m.test(asked.out),
    tokens: Number((used?.[2] ?? "0").replaceAll(",", "")),
    costEur: used?.[3] === "€" ? Number(used[4]) : 0,
    costUsd: used?.[3] === "$" ? Number(used[4]) : 0,
    // A question back: a line ending in a question mark, and nothing applied.
    question: !applied && lines.some((l) => /\?\s*$/.test(l)),
    outcome: lines.slice(0, 3).join(" ").slice(0, 200),
  };
}

/** A dev server for the app, and a browser signed in as admin; the body runs with them. */
async function withApp(dir, body) {
  const server = spawn("pnpm", ["exec", "vite", "dev", "--port", String(PORT), "--strictPort"], {
    cwd: dir,
    env: {
      ...process.env,
      BETTER_AUTH_SECRET: "bench-secret-0123456789abcdef0123456789",
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
    },
    detached: true,
  });
  const base = `http://localhost:${PORT}`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    for (let i = 0; i < 120; i++) {
      try {
        if ((await fetch(`${base}/health`)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    await signIn(page, base, "admin");
    return await body({ page, base, dir, signIn: (role) => signIn(page, base, role) });
  } finally {
    await browser.close();
    try {
      process.kill(-server.pid);
    } catch {}
  }
}

/** The acceptance checks up to `upTo`, each in a fresh admin session; a thrown check is a fail. */
async function checkAll(dir, upTo) {
  return withApp(dir, async (app) => {
    const results = {};
    for (const request of REQUESTS.slice(0, upTo + 1)) {
      try {
        await app.signIn("admin");
        results[request.id] = await request.check(app);
      } catch (error) {
        console.log(`    check ${request.id}: ${String(error.message).split("\n")[0]}`);
        results[request.id] = false;
      }
    }
    await app.signIn("admin");
    results.kept = await customersKept(app.page, app.base).catch(() => false);
    return results;
  });
}

/** The start: the spec has the customer's fields, a team page and the two roles. */
function startCheck(dir) {
  const spec = readFileSync(join(dir, "smithable.yml"), "utf8");
  const authPath = join(dir, "smithable.auth.yml");
  const auth = existsSync(authPath) ? readFileSync(authPath, "utf8") : "";
  const missing = [];
  for (const field of ["name", "email", "segment", "notes"])
    if (!new RegExp(`^\\s+${field}:`, "m").test(spec)) missing.push(`the ${field} field`);
  if (!/users:\s*manage/.test(spec)) missing.push("the team page");
  if (!/^\s+admin:/m.test(auth)) missing.push("the admin role");
  if (!/^\s+sales:/m.test(auth)) missing.push("the sales role");
  return missing;
}

/** More requests from a file in the sheet's table form: | H1 | request | acceptance |. */
function extraRequests(file) {
  if (!file) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.split("|").map((c) => c.trim()))
    .filter((cells) => cells.length >= 4 && /^H\d+$/.test(cells[1]) && cells[2])
    .map((cells) => ({ id: cells[1], prompt: cells[2], accept: cells[3] ?? "" }));
}

const commit = (dir, message) => {
  sh("git", ["add", "-A"], dir);
  sh("git", ["commit", "-q", "--allow-empty", "-m", message], dir);
};

const spent = (row, asked) => {
  row.prompts++;
  row.builderMs += asked.ms;
  row.tokens += asked.tokens;
  row.costEur += asked.costEur;
  row.costUsd += asked.costUsd;
};

async function oneRun(run) {
  const dir = join(root, `run-${run}`);
  console.log(`\nRun ${run}: ${dir}`);
  // The start, as a person makes it: the description, then the start check, two prompts at most.
  const start = { prompts: 0, builderMs: 0, tokens: 0, costEur: 0, costUsd: 0 };
  const made = sh(
    "node",
    [cli, "new", dir, "--describe", DESCRIPTION, "--yes", "--no-sample-data"],
    repo,
  );
  spent(start, { ms: made.ms, tokens: 0, costEur: 0, costUsd: 0 });
  if (!made.ok) throw new Error(`the start failed: ${made.out.slice(0, 500)}`);
  let missing = startCheck(dir);
  for (let repair = 0; repair < 2 && missing.length; repair++) {
    spent(start, askSmith(dir, `The app is missing ${missing.join(", ")}. Add them.`));
    missing = startCheck(dir);
  }
  sh("pnpm", ["install", "--prefer-offline"], dir);
  sh("git", ["init", "-q"], dir);
  commit(dir, "start");
  // The eight customers through the form; the eighth by a sales person.
  const typed = await withApp(dir, async ({ page, base, signIn: as }) => {
    let n = 0;
    for (const [i, [name, email, segment, notes]] of CUSTOMERS.entries()) {
      await as(i === 7 ? "sales" : "admin");
      if (!(await openAddForm(page, base, CUSTOMERS_PAGE))) break;
      if (await fillAndSave(page, { Name: name, Email: email, Segment: segment, Notes: notes }))
        n++;
    }
    return n;
  });
  commit(dir, "customers");
  console.log(
    `  start: ${missing.length ? `missing ${missing.join(", ")}` : "ok"}; ${typed} of 8 customers typed`,
  );

  const rows = [];
  const started = Date.now();
  for (const [index, request] of REQUESTS.entries()) {
    const blockedBy = rows.find((r) => r.done !== "yes" && dependsOn(request.id, r.id));
    const row = {
      id: request.id,
      prompts: 0,
      builderMs: 0,
      totalMs: 0,
      tokens: 0,
      costEur: 0,
      costUsd: 0,
      model: "",
      firstTime: false,
      done: "no",
      regressions: [],
      kept: true,
      notes: [],
    };
    if (blockedBy) {
      row.done = `blocked by #${blockedBy.id}`;
      rows.push(row);
      console.log(`  ${request.id}: ${row.done}`);
      continue;
    }
    const t0 = Date.now();
    let prompt = request.prompt;
    let checks;
    for (let attempt = 0; attempt <= REPAIRS; attempt++) {
      let asked = askSmith(dir, prompt);
      spent(row, asked);
      if (asked.question) {
        // A question back: answered from the request's text only.
        row.notes.push(`asked: ${asked.outcome}`);
        asked = askSmith(dir, `${request.prompt} Use your judgement.`);
        spent(row, asked);
      }
      row.model = asked.generator ? `generator (${asked.model}), no model` : asked.model;
      commit(dir, `request ${request.id}, prompt ${row.prompts}`);
      checks = await checkAll(dir, index);
      if (checks[request.id]) {
        row.done = "yes";
        row.firstTime = attempt === 0;
        break;
      }
      if (Date.now() - t0 > GIVE_UP_MS) {
        row.notes.push("given up: fifteen minutes");
        break;
      }
      prompt = `That didn't work: ${request.accept}`;
    }
    row.totalMs = Date.now() - t0;
    row.regressions = REQUESTS.slice(0, index)
      .filter((r) => rows.find((x) => x.id === r.id)?.done === "yes" && checks && !checks[r.id])
      .map((r) => r.id);
    row.kept = checks?.kept ?? false;
    // Smithable's own checks, in their own columns.
    row.typecheck = sh("pnpm", ["typecheck"], dir).ok;
    row.build = sh("pnpm", ["build"], dir).ok;
    row.tests = sh("pnpm", ["test"], dir).ok;
    row.regenerates = !sh("node", [cli, "generate", dir], repo).out.includes("edited by hand");
    sh("git", ["checkout", "--", "."], dir);
    rows.push(row);
    console.log(`  ${request.id}: ${JSON.stringify(row)}`);
  }

  // The extra requests: run, measured, screenshotted; judged by a person.
  const extras = [];
  const shots = join(root, `run-${run}-shots`);
  for (const extra of extraRequests(EXTRA)) {
    const asked = askSmith(dir, extra.prompt);
    commit(dir, `extra ${extra.id}`);
    mkdirSync(shots, { recursive: true });
    await withApp(dir, async ({ page, base }) => {
      for (const [name, kind] of [
        ["customers", CUSTOMERS_PAGE],
        ["orders", ORDERS_PAGE],
      ])
        if (await go(page, base, kind))
          await page.screenshot({ path: join(shots, `${extra.id}-${name}.png`), fullPage: true });
      if (await openRecord(page, base, CUSTOMERS_PAGE, "Harbour Freight AB"))
        await page.screenshot({ path: join(shots, `${extra.id}-customer-2.png`), fullPage: true });
    });
    extras.push({
      id: extra.id,
      prompts: asked.question ? 2 : 1,
      builderMs: asked.ms,
      tokens: asked.tokens,
      costEur: asked.costEur,
      costUsd: asked.costUsd,
      model: asked.generator ? `generator (${asked.model}), no model` : asked.model,
      outcome: asked.outcome,
    });
    console.log(`  ${extra.id}: ${JSON.stringify(extras[extras.length - 1])}`);
  }

  // The final pass: every check once more, and the four core flows.
  const finalChecks = await checkAll(dir, REQUESTS.length - 1);
  const flows = await withApp(dir, async ({ page, base }) => {
    const signedIn = await signIn(page, base, "admin");
    const listed = await customersKept(page, base);
    const added =
      (await openAddForm(page, base, CUSTOMERS_PAGE)) &&
      (await fillAndSave(page, {
        Name: "Final Check Oy",
        Email: "final@check.example",
        Segment: "SMB",
      }));
    let edited = false;
    if ((await openRecord(page, base, CUSTOMERS_PAGE, "Final Check Oy")) && (await openEdit(page)))
      edited = await fillAndSave(page, { Notes: "Edited at the end." });
    return { signedIn, listed, added, edited };
  });
  return {
    dir,
    start: { ...start, missing, typed },
    rows,
    extras,
    shots: extras.length ? shots : undefined,
    finalChecks,
    flows,
    totalMs: Date.now() - started,
  };
}

// ── Run ──────────────────────────────────────────────────────────────────────────────────────────

if (option("check-only")) {
  // The checks alone, against an app a run kept: for mending a check without a model.
  const results = await checkAll(option("check-only"), REQUESTS.length - 1);
  console.log(JSON.stringify(results));
  process.exit(0);
}

const runs = [];
for (let run = 1; run <= RUNS; run++) runs.push(await oneRun(run));

// ── Report ───────────────────────────────────────────────────────────────────────────────────────

const yes = (v) => (v ? "yes" : "**no**");
const secs = (ms) => `${(ms / 1000).toFixed(0)} s`;
const money = (r) =>
  r.costEur ? `€${r.costEur.toFixed(4)}` : r.costUsd ? `$${r.costUsd.toFixed(4)}` : "€0";
const model =
  process.env.SMITHABLE_MODEL || process.env.SMITHABLE_LOCAL_MODEL || "the configured model";
const commitHash = sh("git", ["rev-parse", "--short", "HEAD"], repo).stdout.trim();
const date = new Date().toISOString().slice(0, 10);
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};

const perRun = runs
  .map((r, i) => {
    const rowsText = r.rows
      .map((row) => {
        const request = REQUESTS.find((q) => q.id === row.id);
        const own =
          row.typecheck === undefined
            ? "– | –"
            : `${yes(row.typecheck && row.build && row.tests)} | ${yes(row.regenerates)}`;
        return `| ${row.id} | ${request.prompt} | ${row.done} | ${row.done === "yes" ? yes(row.firstTime) : "–"} | ${row.prompts} | ${secs(row.builderMs)} | ${secs(row.totalMs)} | ${row.tokens.toLocaleString("en")} · ${money(row)} | ${row.regressions.length ? `**${row.regressions.join(", ")}**` : "none"} | ${yes(row.kept)} | ${row.model} | ${own} | ${row.notes.join("; ")} |`;
      })
      .join("\n");
    const extrasText = r.extras.length
      ? `\n\n**Extra requests** (judged by a person; screenshots in \`${r.shots}\`):\n\n| H | Prompts | Builder time | Tokens · cost | Model | What Smith said |\n|---|---|---|---|---|---|\n${r.extras.map((e) => `| ${e.id} | ${e.prompts} | ${secs(e.builderMs)} | ${e.tokens.toLocaleString("en")} · ${money(e)} | ${e.model} | ${e.outcome} |`).join("\n")}`
      : "";
    const failedFinal = REQUESTS.filter((q) => !r.finalChecks[q.id]).map((q) => q.id);
    const startText = r.start.missing.length
      ? `missing ${r.start.missing.join(", ")} after ${r.start.prompts} prompts`
      : `the start check passed after ${r.start.prompts} prompt${r.start.prompts === 1 ? "" : "s"}`;
    return `### Run ${i + 1}

Start: ${startText}; ${r.start.typed} of 8 customers typed through the form; ${r.start.tokens.toLocaleString("en")} tokens · ${money(r.start)}.

| # | Request | Done | Right first time | Prompts | Builder time | Total time | Tokens · cost | Regressions | Data kept | Model | Type-checks, builds, tests | Regenerates cleanly | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
${rowsText}${extrasText}

Final pass: acceptance checks ${failedFinal.length ? `failing: **${failedFinal.join(", ")}**` : "1–10 all pass"}; data kept ${yes(r.finalChecks.kept)}; core flows: sign in ${yes(r.flows.signedIn)}, list ${yes(r.flows.listed)}, add ${yes(r.flows.added)}, edit ${yes(r.flows.edited)}. The run took ${secs(r.totalMs)}. The app is in \`${r.dir}\`.`;
  })
  .join("\n\n");

const tried = runs.flatMap((r) => r.rows.filter((row) => !row.done.startsWith("blocked")));
const summary = `| Smithable (Smith with ${model}, engine ${commitHash}) | ${runs.length} | ${median(runs.map((r) => r.rows.filter((row) => row.done === "yes").length))} of 10 | ${tried.filter((row) => row.firstTime).length} of ${tried.length} | ${runs.some((r) => r.rows.some((row) => row.regressions.length)) ? "**some**" : "none"} | ${money({ costEur: median(tried.map((row) => row.costEur)), costUsd: median(tried.map((row) => row.costUsd)) })} | ${secs(median(tried.map((row) => row.builderMs)))} |`;

const report = `# The ten-changes benchmark: Smithable's side (${date})

Ten plain-language requests, in order, on a CRM made from one description (\`smithable new --describe\`), with eight customers typed through the form; each request through Smith as the Builder's path (\`smithable ask --yes\`), under the rules every side follows: a failed acceptance check sends one repair prompt in a fixed form ("That didn't work: <the acceptance line>"), three at most, fifteen minutes at most; a question back is answered from the request only ("Use your judgement."). After each request, the acceptance check in a real browser, every earlier check again (regressions), and the eight customers read back (data kept). Type-check, build, the app's own tests and "regenerates cleanly" are Smithable's own checks and have their own columns.

Model: ${model}. Engine: ${commitHash}. Runs: ${runs.length}.

## Summary

| Side | Runs | Done (median of 10) | Right first time | Regressions (any run) | Cost per request (median) | Builder time per request (median) |
|---|---|---|---|---|---|---|
${summary}

## Per run

${perRun}

## Raw results

\`\`\`json
${JSON.stringify(
  runs.map(({ dir: _dir, ...r }) => r),
  null,
  2,
)}
\`\`\`
`;
writeFileSync(join(repo, "docs/benchmarks/ten-changes.md"), report);
console.log(
  `\nWrote docs/benchmarks/ten-changes.md. The apps are in ${root}${KEEP ? "" : " (remove them when done)"}`,
);
