// Independent published booking workflow: expected results are literal fixture contracts,
// never derived from the generator's access predicates. All identities/data are synthetic.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { checkPorts, refused } from "./ports.mjs";

if (process.argv.includes("--calibrate")) {
  const { calibrate } = await import("./booking-assurance-calibration.mjs");
  await calibrate(import.meta.filename);
} else {
  const repo = resolve(import.meta.dirname, "..");
  const root = process.argv.includes("--reuse-root")
    ? process.argv[process.argv.indexOf("--reuse-root") + 1]
    : (process.env.TEST_BOOKING_DIR ?? mkdtempSync(join(tmpdir(), "booking-assurance-")));
  assert.ok(
    realpathSync(root).startsWith(join(tmpdir(), "booking-assurance-")),
    "Only owned disposable booking fixture roots may be used",
  );
  const dir = join(root, "app"),
    cli = join(repo, "packages/cli/dist/bin.js");
  const output = resolve(
    process.argv.includes("--evidence")
      ? process.argv[process.argv.indexOf("--evidence") + 1]
      : (process.env.TEST_BOOKING_EVIDENCE ?? "test-results/booking-assurance.json"),
  );
  const evidence = {
    status: "running",
    nonce: process.argv.includes("--nonce")
      ? process.argv[process.argv.indexOf("--nonce") + 1]
      : randomUUID(),
    node: process.version,
    checks: [],
    scope:
      "One disposable published booking app; synthetic email-code authentication and independent outcomes.",
  };
  const messages = [],
    sockets = new Set();
  let smtp,
    server,
    browser,
    serverLog = "",
    succeeded = false;
  let stopping = false;
  const stop = () => {
    stopping = true;
    if (server?.pid) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {}
    }
    void browser?.close().catch(() => {});
    for (const socket of sockets) socket.destroy();
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  function run(command, args, cwd = repo) {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      timeout: 240000,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
  function op(...args) {
    run(process.execPath, [cli, "op", ...args, "--dir", dir]);
  }
  function sql(query) {
    return JSON.parse(
      run(
        process.execPath,
        [
          "-e",
          `const D=require('better-sqlite3');const db=new D('data/db/app.db');const stmt=db.prepare(${JSON.stringify(query)});console.log(JSON.stringify(stmt.reader?stmt.all():stmt.run()));db.close();`,
        ],
        dir,
      ),
    );
  }
  async function until(fn, what, ms = 15000) {
    const end = Date.now() + ms;
    for (;;) {
      if (stopping) throw new Error("Booking assurance cancelled");
      const value = await fn();
      if (value) return value;
      if (Date.now() >= end) throw new Error(`Timed out: ${what}`);
      await new Promise((done) => setTimeout(done, 30));
    }
  }
  async function check(name, fn) {
    const start = performance.now();
    try {
      console.log(`CHECK ${name}`);
      await fn();
    } catch (error) {
      evidence.failedCheck = name;
      evidence.checks.push({ name, status: "failed", ms: performance.now() - start });
      throw error;
    }
    evidence.checks.push({ name, status: "passed", ms: performance.now() - start });
    console.log(`PASS ${name}`);
  }
  async function freePort() {
    for (;;) {
      const listener = createServer();
      await new Promise((done) => listener.listen(0, "127.0.0.1", done));
      const port = listener.address().port;
      await new Promise((done) => listener.close(done));
      if (!refused(port)) return port;
    }
  }
  async function mailServer() {
    smtp = createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.write("220 fixture ESMTP\r\n");
      let buffer = "",
        data = false,
        mail = "";
      socket.on("data", (chunk) => {
        buffer += chunk;
        while (buffer.includes("\n")) {
          const at = buffer.indexOf("\n"),
            line = buffer.slice(0, at).replace(/\r$/, "");
          buffer = buffer.slice(at + 1);
          if (data) {
            if (line === ".") {
              messages.push(mail);
              mail = "";
              data = false;
              socket.write("250 queued\r\n");
            } else mail += `${line}\n`;
            continue;
          }
          if (/^EHLO|^HELO/.test(line)) socket.write("250-fixture\r\n250 PIPELINING\r\n");
          else if (/^DATA/.test(line)) {
            data = true;
            socket.write("354 send message\r\n");
          } else if (/^QUIT/.test(line)) socket.end("221 bye\r\n");
          else socket.write("250 ok\r\n");
        }
      });
    });
    await new Promise((done) => smtp.listen(0, "127.0.0.1", done));
    return smtp.address().port;
  }
  async function open(page, url) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.locator('body[data-hydrated="true"]').waitFor({ timeout: 15000 });
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll("form input, form select, form textarea")].every((element) =>
          Object.keys(element).some((key) => key.startsWith("__reactProps")),
        ),
      null,
      { timeout: 15000 },
    );
  }
  async function login(base, email, viewport) {
    const context = await browser.newContext({
      serviceWorkers: "block",
      ...(viewport ? { viewport } : {}),
    });
    const page = await context.newPage();
    const diagnostics = [];
    page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
    page.on("requestfailed", (request) =>
      diagnostics.push(`request failed: ${request.url()} ${request.failure()?.errorText}`),
    );
    await open(page, `${base}/sign-in`);
    assert.equal(
      await page.getByRole("button", { name: /^Sign in as / }).count(),
      0,
      "published app offers development role login",
    );
    await page.getByLabel("Email address", { exact: true }).fill(email);
    let before;
    for (let attempt = 0; attempt < 2; attempt++) {
      before = messages.length;
      const sending = page.waitForResponse(
        (response) =>
          response.url().includes("/email-otp/send-verification-otp") &&
          response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Send me a code", exact: true }).click();
      let response;
      try {
        response = await sending;
      } catch (error) {
        await page.screenshot({ path: join(root, "login-failure.png"), fullPage: true });
        writeFileSync(join(root, "login-failure.html"), await page.content());
        throw new Error(
          `${error.message}; diagnostics: ${diagnostics.join("; ")}; form: ${await page.locator("main").innerText()}`,
        );
      }
      if (response.status() !== 429) {
        assert.equal(response.status(), 200, "OTP request failed");
        break;
      }
      if (attempt === 1)
        throw new Error("Fixture authentication remains rate-limited after one bounded retry");
      console.log("WAIT published email-code rate limit; retrying after its normal window");
      await new Promise((done) => setTimeout(done, 60000));
    }
    const code = await until(() => {
      const mail = messages
        .slice(before)
        .find((mail) => mail.includes(email) && mail.includes("Your code for"));
      const match = mail?.match(/Your code for .+ is (\d{3}) (\d{3})/);
      return match ? match[1] + match[2] : undefined;
    }, `synthetic OTP for ${email}`);
    await page.getByLabel("Code", { exact: true }).fill(code);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((url) => url.pathname !== "/sign-in", { timeout: 15000 });
    return { context, page, email };
  }
  const defect = process.argv.includes("--seed-defect")
    ? process.argv[process.argv.indexOf("--seed-defect") + 1]
    : undefined;
  if (defect && !["permission", "count", "persistence"].includes(defect))
    throw new Error("Unknown booking calibration defect");
  if (defect && (process.argv.includes("--reuse-root") || process.env.TEST_BOOKING_DIR))
    throw new Error("Planted variants require a fresh fixture root");
  evidence.seedDefect = defect;
  evidence.reusedBuiltFixture = process.argv.includes("--reuse-built");
  function seedDefect() {
    if (!defect) return;
    if (process.argv.includes("--reuse-built"))
      throw new Error("Fault injection requires a fresh fixture build");
    const file = join(
      dir,
      "src/generated",
      defect === "count" ? "booking.ts" : "booking.server.ts",
    );
    const source = readFileSync(file, "utf8");
    const from =
      defect === "permission"
        ? 'read: { public: false, roles: ["admin"], owner: true },'
        : defect === "count"
          ? "left: Math.max(0, max - taken),"
          : "check(bookingAccess.create, viewer);";
    const to =
      defect === "permission"
        ? 'read: { public: true, roles: ["admin"], owner: true },'
        : defect === "count"
          ? "left: Math.max(0, max - taken) + 1,"
          : `check(bookingAccess.create, viewer); return {id:-999,sessionId:values.sessionId,attendeeId:viewer?.id,createdAt:new Date(),updatedAt:new Date(),proof:null} as typeof schema.bookings.$inferSelect;`;
    assert.equal(source.split(from).length, 2, "calibration injection point changed");
    writeFileSync(file, source.replace(from, to));
  }

  try {
    await check("disposable booking fixture generated through CLI operations", async () => {
      if (process.argv.includes("--reuse-built")) {
        assert.ok(root.startsWith(join(tmpdir(), "booking-assurance-")));
        assert.ok(existsSync(join(dir, "server.mjs")));
        return;
      }
      if (!existsSync(dir))
        run(process.execPath, [
          cli,
          "new",
          dir,
          "--starter",
          "booking",
          "--admin",
          "owner@assurance.example",
        ]);
      op("setApi", "Booking", "Session", "--assistants", "true", "--assistants-delete", "true");
      if (!/^\s+proof:\s+file/m.test(readFileSync(join(dir, "smithable.yml"), "utf8")))
        op("addField", "Booking", "proof", "file");
      if (!/^ {2}team:/m.test(readFileSync(join(dir, "smithable.yml"), "utf8")))
        op("addUsersPage", "team");
      op(
        "setRoles",
        "--roles",
        JSON.stringify({
          admin: "Fixture administrator",
          member: "Fixture member",
          observer: "Restricted fixture role",
        }),
        "--default-role",
        "member",
      );
    });
    seedDefect();
    await check("published app builds", async () => {
      if (!process.argv.includes("--reuse-built")) run("pnpm", ["build"], dir);
    });
    const port = await freePort(),
      smtpPort = await mailServer(),
      base = `http://127.0.0.1:${port}`;
    checkPorts("booking assurance", [port]);
    const env = {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "production",
      BETTER_AUTH_URL: base,
      BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
      SMTP_URL: `smtp://127.0.0.1:${smtpPort}?ignoreTLS=true`,
      MAIL_FROM: "fixture@assurance.example",
    };
    for (const key of Object.keys(env))
      if (/^(DEMO_|DEV_DOOR|SMITHABLE_|ANTHROPIC_|OPENAI_|GOOGLE_|GEMINI_|AZURE_|AWS_)/.test(key))
        delete env[key];
    server = spawn("pnpm", ["start"], {
      cwd: dir,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (chunk) => {
      serverLog = (serverLog + chunk).slice(-1000000);
    });
    server.stderr.on("data", (chunk) => {
      serverLog = (serverLog + chunk).slice(-1000000);
    });
    await until(
      async () => {
        if (server.exitCode !== null) throw new Error("Published fixture exited during startup");
        try {
          return (await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) })).ok;
        } catch {
          return false;
        }
      },
      "published fixture health",
      30000,
    );
    browser = await chromium.launch();
    let admin, alice, bob;
    await check("ordinary email-code browser login; published role bypass absent", async () => {
      admin = await login(base, "owner@assurance.example");
      alice = await login(base, "alice@assurance.example");
      bob = await login(base, "bob@assurance.example");
      const people = sql(
        "SELECT email,role FROM user WHERE email IN ('alice@assurance.example','bob@assurance.example','owner@assurance.example') ORDER BY email",
      );
      assert.deepEqual(
        people.map(({ email, role }) => ({ email, role })),
        [
          { email: "alice@assurance.example", role: "member" },
          { email: "bob@assurance.example", role: "member" },
          { email: "owner@assurance.example", role: "admin" },
        ],
      );
    });
    const anonymous = await browser.newContext({ serviceWorkers: "block" });
    const accounts = [alice, bob, admin];
    let choice, booking, winner, other, bookRPC;
    async function withObserver(fn) {
      assert.ok([alice.email, bob.email].includes(other.email));
      sql(`UPDATE user SET role='observer' WHERE email='${other.email}'`);
      try {
        const session = await (
          await other.context.request.get(`${base}/api/auth/get-session`)
        ).json();
        assert.equal(session.user.email, other.email);
        assert.equal(session.user.role, "observer", "restricted role was not effective");
        return await fn(other.context);
      } finally {
        sql(`UPDATE user SET role='member' WHERE email='${other.email}'`);
        const restored = await (
          await other.context.request.get(`${base}/api/auth/get-session`)
        ).json();
        assert.equal(restored.user.role, "member", "member role did not restore");
      }
    }
    const replayHeaders = (request) =>
      Object.fromEntries(
        Object.entries(request.headers).filter(
          ([name]) => !["cookie", "authorization", "host", "content-length"].includes(name),
        ),
      );

    async function choose(person, selected) {
      await open(person.page, selected?.schedule ?? `${base}/schedule`);
      const buttons = person.page.locator("section ol button"),
        panel = person.page.getByRole("dialog");
      if (selected) {
        await buttons.nth(selected.nth).click();
        await panel.waitFor();
        return panel;
      }
      for (const week of [0, 1]) {
        if (week)
          await person.page.getByRole("button", { name: "Next", exact: true }).first().click();
        await buttons.first().waitFor();
        const schedule = person.page.url();
        for (let nth = 0; nth < (await buttons.count()); nth++) {
          await buttons.nth(nth).click();
          await panel.waitFor();
          await panel
            .getByText(/places? left$|^No mats left$/)
            .first()
            .waitFor();
          if (
            !(await panel.getByText(/^Booking closed at /).count()) &&
            !(await panel.getByText(/^No mats left$/).count())
          ) {
            assert.equal(
              await panel.getByText(/places? left$/).textContent(),
              "1 of 1 place left",
              "Published available-place count mismatch",
            );
            choice = { nth, schedule };
            return panel;
          }
          await panel.getByRole("button", { name: "Close", exact: true }).click();
          await panel.waitFor({ state: "hidden" });
        }
      }
      throw new Error("No future one-place class in independent fixture");
    }
    function countRows(text) {
      let quoted = false,
        lines = 0;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === '"') {
          if (quoted && text[i + 1] === '"') {
            i++;
            continue;
          }
          quoted = !quoted;
        }
        if (text[i] === "\n" && !quoted) lines++;
      }
      assert.equal(quoted, false);
      return lines + (text.endsWith("\n") ? 0 : 1);
    }
    const live = () => sql("SELECT id,session_id,attendee_id,proof FROM bookings ORDER BY id");
    await check(
      "two real accounts contend for the final place; exactly one booking persists",
      async () => {
        sql("DELETE FROM bookings");
        sql("DELETE FROM api_key");
        sql("UPDATE sessions SET capacity=1");
        const left = await choose(alice),
          right = await choose(bob, choice);
        const queued = [],
          routes = [],
          replies = [];
        try {
          for (const actor of [alice, bob]) {
            const intercept = async (route) => {
              const request = route.request();
              if (
                request.method() === "POST" &&
                request.url().includes("_serverFn") &&
                !queued.some((item) => item.actor === actor)
              ) {
                let release;
                const gate = new Promise((done) => {
                  release = done;
                });
                queued.push({ actor, request, release });
                if (queued.length === 2) for (const item of queued) item.release();
                await gate;
              }
              await route.continue();
            };
            routes.push([actor.page, intercept]);
            await actor.page.route("**/*", intercept);
            replies.push(
              actor.page.waitForResponse(
                (response) =>
                  response.request().method() === "POST" && response.url().includes("_serverFn"),
              ),
            );
          }
          await Promise.all([
            left.getByRole("button", { name: "Book a mat", exact: true }).click(),
            right.getByRole("button", { name: "Book a mat", exact: true }).click(),
          ]);
          const completed = await Promise.all(replies);
          await Promise.all(completed.map((response) => response.finished()));
          assert.equal(queued.length, 2, "both booking requests must reach the release barrier");
          assert.equal(
            queued[0].request.postData(),
            queued[1].request.postData(),
            "contenders targeted different bookings",
          );
          for (const response of completed)
            assert.ok(
              response.status() < 500,
              `booking contender crashed with ${response.status()}`,
            );
          const captured = queued.find((item) => item.actor === alice).request;
          bookRPC = { url: captured.url(), headers: captured.headers(), body: captured.postData() };
          evidence.contention = {
            requests: queued.length,
            bothCompleted: true,
            responseStatuses: completed.map((response) => response.status()),
          };
        } finally {
          for (const item of queued) item.release();
          await Promise.all(routes.map(([page, intercept]) => page.unroute("**/*", intercept)));
        }
        await until(() => live().length === 1, "one committed booking");
        [booking] = live();
        const [person] = sql(`SELECT email FROM user WHERE id='${booking.attendee_id}'`);
        winner = person.email === alice.email ? alice : bob;
        other = winner === alice ? bob : alice;
        await choose(winner, choice);
        await winner.page.getByRole("dialog").getByText("You're booked", { exact: true }).waitFor();
        await choose(other, choice);
        await other.page.getByRole("dialog").getByText("No mats left", { exact: true }).waitFor();
        assert.equal(live().length, 1);
        assert.ok([alice.email, bob.email].includes(person.email));
        evidence.winner = person.email;
      },
    );
    async function denied(response, label) {
      const body = await response.text();
      assert.ok(
        [401, 403, 404].includes(response.status()) ||
          ([301, 302, 303, 307, 308].includes(response.status()) &&
            /sign-in/.test(response.headers().location ?? "")),
        `${label}: status ${response.status()}`,
      );
      assert.ok(!body.includes("booking-proof-canary"), `${label}: private file bytes leaked`);
    }
    await check(
      "ownership survives reload and direct routes deny visitor, second account and restricted role",
      async () => {
        await open(winner.page, `${base}/my-bookings`);
        await winner.page.reload();
        assert.equal(await winner.page.locator("main tbody tr").count(), 1);
        await open(other.page, `${base}/my-bookings`);
        assert.equal(
          await other.page.locator("main tbody tr").count(),
          0,
          "Second account read another member booking",
        );
        const route = `${base}/my-bookings/${booking.id}`;
        assert.equal((await winner.context.request.get(route)).status(), 200);
        for (const [context, label] of [
          [anonymous, "visitor"],
          [other.context, "second account"],
        ])
          await denied(await context.request.get(route, { maxRedirects: 0 }), label);
        const memberReplay = await other.context.request.post(bookRPC.url, {
          headers: replayHeaders(bookRPC),
          data: bookRPC.body,
          maxRedirects: 0,
        });
        assert.ok(
          memberReplay.status() === 409 ||
            /no places|full|capacity|Conflict/i.test(await memberReplay.text()),
          "member positive control never reached capacity validation",
        );
        await withObserver(async (context) => {
          await denied(await context.request.get(route, { maxRedirects: 0 }), "restricted role");
          assert.ok(bookRPC, "missing successful browser booking request");
          const response = await context.request.post(bookRPC.url, {
            headers: replayHeaders(bookRPC),
            data: bookRPC.body,
          });
          const text = await response.text();
          assert.ok(
            response.status() === 403 || /not allowed|AccessDenied/i.test(text),
            "restricted role could invoke hidden booking action",
          );
          assert.equal(live().length, 1);
        });
        assert.equal((await admin.context.request.get(route)).status(), 200);
      },
    );
    await check(
      "owner upload persists and private bytes are refused through direct download routes",
      async () => {
        await open(winner.page, `${base}/my-bookings/${booking.id}`);
        await winner.page.locator('input[type="file"]').setInputFiles({
          name: "proof.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("booking-proof-canary"),
        });
        await winner.page.getByText("proof.txt", { exact: true }).waitFor();
        await winner.page.getByRole("button", { name: "Save changes", exact: true }).click();
        await until(
          () => live().find((row) => row.id === booking.id)?.proof,
          "stored upload reference",
        );
        const address = `${base}/files/booking/${booking.id}/proof`;
        const response = await winner.context.request.get(address);
        assert.equal(response.status(), 200);
        assert.equal((await response.body()).toString(), "booking-proof-canary");
        for (const [context, label] of [
          [anonymous, "visitor file"],
          [other.context, "other file"],
        ])
          await denied(await context.request.get(address, { maxRedirects: 0 }), label);
        await withObserver(async (context) =>
          denied(await context.request.get(address, { maxRedirects: 0 }), "restricted file"),
        );
        assert.equal((await admin.context.request.get(address)).status(), 200);
        await open(winner.page, `${base}/my-bookings/${booking.id}`);
        await winner.page.reload();
        await winner.page.getByText("proof.txt", { exact: true }).first().waitFor();
        const ownerPage = await winner.context.request.get(`${base}/my-bookings/${booking.id}`);
        assert.ok((await ownerPage.text()).includes("proof.txt"));
        for (const context of [anonymous, other.context])
          await denied(
            await context.request.get(`${base}/my-bookings/${booking.id}`, { maxRedirects: 0 }),
            "private route after upload",
          );
        assert.equal(
          live().find((row) => row.id === booking.id).proof.file?.length > 0 ||
            JSON.parse(live().find((row) => row.id === booking.id).proof).file.length > 0,
          true,
        );
      },
    );
    let adminKey, restrictedKey, memberKey;
    async function key(name, role) {
      await open(admin.page, `${base}/team`);
      const panel = admin.page.locator('[data-kit="keys"]');
      await panel.getByLabel("What it is for").fill(name);
      assert.equal(await panel.getByRole("combobox").count(), 1);
      await panel.getByRole("combobox").selectOption(role);
      await panel.getByRole("button", { name: "Make a key", exact: true }).click();
      const value = await panel.locator('[data-part="key"]').textContent();
      assert.match(value, /^smk_/);
      return value;
    }
    const api = (path, key, options = {}) =>
      fetch(`${base}/api/v1${path}`, {
        ...options,
        ...(options.method === "DELETE" ? { body: "{}" } : {}),
        headers: {
          ...(key ? { authorization: `Bearer ${key}` } : {}),
          ...(options.method === "DELETE" ? { "content-type": "application/json" } : {}),
          ...options.headers,
        },
        signal: AbortSignal.timeout(10000),
      });
    async function rpc(key, name, args) {
      const response = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(key ? { authorization: `Bearer ${key}` } : {}),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name, arguments: args },
        }),
        signal: AbortSignal.timeout(10000),
      });
      return { response, body: await response.json() };
    }
    await check(
      "real administrator creates keys; API/MCP and file endpoints respect role rather than impersonating owner",
      async () => {
        adminKey = await key("Fixture administrator", "admin");
        restrictedKey = await key("Fixture observer", "observer");
        memberKey = await key("Fixture member", "member");
        const sameOwner = await api(`/bookings/${booking.id}`, adminKey, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ attendee: booking.attendee_id }),
        });
        assert.equal(
          sameOwner.status,
          200,
          `Opaque User id did not round-trip through API: ${await sameOwner.text()}`,
        );

        assert.equal(
          (
            await api(`/bookings/${booking.id}`, adminKey, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ attendee: 123 }),
            })
          ).status,
          400,
          "Numeric User id was accepted",
        );
        assert.equal(
          (await api("/sessions", restrictedKey)).status,
          200,
          "restricted key never had valid public access",
        );
        assert.equal((await api("/sessions", memberKey)).status, 200);
        assert.equal((await api(`/bookings/${booking.id}`, memberKey)).status, 404);
        const [adminIdentity] = sql("SELECT id FROM user WHERE email='owner@assurance.example'");
        const [free] = sql(
          `SELECT id FROM sessions WHERE id<>${booking.session_id} ORDER BY id LIMIT 1`,
        );
        const owned = sql(
          `INSERT INTO bookings(session_id,attendee_id,created_at,updated_at) VALUES(${free.id},'${adminIdentity.id}',strftime('%s','now')*1000,strftime('%s','now')*1000)`,
        );
        try {
          assert.equal((await api(`/bookings/${owned.lastInsertRowid}`, adminKey)).status, 200);
          const changed = await api(`/bookings/${owned.lastInsertRowid}`, adminKey, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ attendee: booking.attendee_id }),
          });
          assert.equal(changed.status, 200);
          assert.equal(
            sql(`SELECT attendee_id FROM bookings WHERE id=${owned.lastInsertRowid}`)[0]
              .attendee_id,
            booking.attendee_id,
            "API ignored a valid changed User id",
          );
          for (const attendee of ["", "fixture-nonexistent-user"]) {
            const bad = await api(`/bookings/${owned.lastInsertRowid}`, adminKey, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ attendee }),
            });
            assert.equal(
              bad.status,
              attendee === "" ? 400 : 409,
              "Invalid User reference was accepted",
            );
            assert.equal(
              sql(`SELECT attendee_id FROM bookings WHERE id=${owned.lastInsertRowid}`)[0]
                .attendee_id,
              booking.attendee_id,
            );
          }
          assert.equal(
            (
              await api(`/bookings/${owned.lastInsertRowid}`, adminKey, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ attendee: adminIdentity.id }),
              })
            ).status,
            200,
          );
          for (const token of [restrictedKey, memberKey])
            assert.equal(
              (await api(`/bookings/${owned.lastInsertRowid}`, token)).status,
              404,
              "role key inherited creator ownership",
            );
        } finally {
          sql(`DELETE FROM bookings WHERE id=${owned.lastInsertRowid}`);
        }
        for (const token of [restrictedKey, memberKey]) {
          const response = await api("/bookings?limit=1", token);
          assert.equal(response.status, 200);
          const result = await response.json();
          assert.equal(result.total, 0);
          assert.deepEqual(result.items, []);
          const csv = await api("/bookings.csv", token);
          assert.equal(csv.status, 200);
          assert.equal(countRows(await csv.text()), 1, "private CSV leaked rows to role key");
          const found = await rpc(token, "find", { kind: "Booking", limit: 1 });
          assert.ok(
            found.body.result?.isError ||
              found.body.error ||
              (found.body.result?.structuredContent?.total === 0 &&
                found.body.result?.structuredContent?.rows?.length === 0),
            "MCP list leaked private rows",
          );
          const deleted = await rpc(token, "delete", { kind: "Booking", id: booking.id });
          assert.equal(deleted.body.result?.isError, true);
        }
        assert.equal((await api("/bookings")).status, 401);
        assert.equal((await api("/bookings.csv")).status, 401);
        const uploaded = await api(`/bookings/${booking.id}/proof`, adminKey, {
          method: "PUT",
          headers: { "content-type": "application/octet-stream", "x-file-name": "proof.txt" },
          body: "booking-proof-canary",
        });
        assert.equal(uploaded.status, 200, "Authorized API upload failed");
        const stored = await api(`/bookings/${booking.id}/proof`, adminKey);
        assert.equal(stored.status, 200);
        assert.equal(await stored.text(), "booking-proof-canary");
        const beforeProof = live().find((row) => row.id === booking.id).proof;
        for (const token of [restrictedKey, memberKey, undefined]) {
          const overwritten = await api(`/bookings/${booking.id}/proof`, token, {
            method: "PUT",
            headers: { "x-file-name": "tampered.txt" },
            body: "tampered-private-file",
          });
          assert.ok([401, 403, 404].includes(overwritten.status));
          assert.equal(live().find((row) => row.id === booking.id).proof, beforeProof);
          const changed = await api(`/bookings/${booking.id}`, token, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ session: booking.session_id }),
          });
          assert.ok([401, 403, 404].includes(changed.status));
        }
        const adminFound = await rpc(adminKey, "find", { kind: "Booking", limit: 1 });
        assert.equal(adminFound.body.result?.structuredContent?.total, 1);
        assert.equal(adminFound.body.result?.structuredContent?.rows?.length, 1);
        const read = await api(`/bookings/${booking.id}`, adminKey);
        assert.equal(read.status, 200);
        assert.equal((await read.json()).id, booking.id);
        assert.equal((await api(`/bookings/${booking.id}`, restrictedKey)).status, 404);
        assert.equal((await api(`/bookings/${booking.id}`)).status, 401);
        const bytes = await api(`/bookings/${booking.id}/proof`, adminKey);
        assert.equal(bytes.status, 200);
        assert.equal(await bytes.text(), "booking-proof-canary");
        assert.equal((await api(`/bookings/${booking.id}/proof`, restrictedKey)).status, 404);
        assert.equal((await api(`/bookings/${booking.id}/proof`)).status, 401);
        const allowed = await rpc(adminKey, "read", { kind: "Booking", id: booking.id });
        assert.equal(allowed.response.status, 200);
        assert.equal(allowed.body.result?.isError ?? false, false);
        const forbidden = await rpc(restrictedKey, "read", { kind: "Booking", id: booking.id });
        assert.equal(forbidden.body.result?.isError, true);
        const anonymousRead = await rpc(undefined, "read", { kind: "Booking", id: booking.id });
        assert.ok(
          anonymousRead.body.result?.isError ||
            anonymousRead.body.error ||
            [401, 403].includes(anonymousRead.response.status),
        );
        assert.ok(!JSON.stringify(anonymousRead.body).includes("booking-proof-canary"));
        const lowered = await api(`/sessions/${booking.session_id}`, adminKey, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ capacity: 0 }),
        });
        assert.equal(
          lowered.status,
          409,
          "direct API lowered capacity below its committed booking",
        );
        assert.equal(
          sql(`SELECT capacity FROM sessions WHERE id=${booking.session_id}`)[0].capacity,
          1,
        );
        const before = JSON.stringify(live());
        const change = await api(`/bookings/${booking.id}`, restrictedKey, { method: "DELETE" });
        assert.ok(
          [403, 404].includes(change.status),
          `Observer DELETE ${change.status}: ${await change.text()}`,
        );
        assert.equal(JSON.stringify(live()), before);
      },
    );
    await check(
      "hidden cancel server action denies another account; owner cancels and rebooks after confirmation",
      async () => {
        const cancelledId = booking.id;
        const panel = await choose(winner, choice);
        await panel.getByRole("button", { name: "Cancel booking", exact: true }).click();
        let release;
        const captured = new Promise((done) => {
          const intercept = async (route) => {
            const request = route.request();
            if (request.method() === "POST" && request.url().includes("_serverFn")) {
              release = async () => {
                await route.continue();
                await winner.page.unroute("**/*", intercept);
              };
              done({ url: request.url(), headers: request.headers(), body: request.postData() });
            } else await route.continue();
          };
          void winner.page.route("**/*", intercept);
        });
        await panel.getByRole("button", { name: "Yes, cancel it", exact: true }).click();
        const request = await Promise.race([
          captured,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Cancel RPC not captured")), 10000),
          ),
        ]);
        try {
          const headers = Object.fromEntries(
            Object.entries(request.headers).filter(
              ([name]) => !["cookie", "authorization", "host", "content-length"].includes(name),
            ),
          );
          for (const [context, label] of [[anonymous, "visitor hidden cancel"]]) {
            const response = await context.request.post(request.url, {
              headers,
              data: request.body,
              maxRedirects: 0,
            });
            const text = await response.text();
            if (![401, 403, 404].includes(response.status())) {
              // TanStack serializes thrown errors inside a successful transport response.
              // Require the exact error envelope and refusal; a sign-in page is not proof.
              assert.equal(response.status(), 200, label);
              const envelope = JSON.parse(text);
              const index = envelope.p?.k?.indexOf("error");
              assert.ok(index >= 0, `${label}: missing error envelope`);
              const error = envelope.p.v[index];
              assert.equal(error.c, "$TSR/Error", label);
              assert.equal(error.s?.message?.s, "Please sign in first.", label);
            }
            assert.equal(live().length, 1, `${label} changed someone else's booking`);
          }
          await withObserver(async (context) => {
            const response = await context.request.post(request.url, {
              headers,
              data: request.body,
              maxRedirects: 0,
            });
            const text = await response.text();
            assert.ok(
              [401, 403, 404].includes(response.status()) ||
                /not allowed|not found|may not|AccessDenied|NotFound/i.test(text),
            );
            assert.equal(live().length, 1);
          });
          const response = await other.context.request.post(request.url, {
            headers,
            data: request.body,
          });
          const text = await response.text();
          assert.ok(
            [401, 403, 404].includes(response.status()) ||
              /not allowed|not found|may not|AccessDenied|NotFound/i.test(text),
            `Hidden action did not refuse: ${response.status()}`,
          );
          assert.equal(live().length, 1, "hidden action cancelled someone else's booking");
        } finally {
          await release?.();
        }
        await until(() => live().length === 0, "owner cancellation committed");
        await panel.getByText(/^1 of 1 place left$/).waitFor();
        await panel.getByRole("button", { name: "Book a mat", exact: true }).click();
        await until(() => live().length === 1, "rebooking committed");
        [booking] = live();
        assert.equal(sql(`SELECT COUNT(*) n FROM bookings WHERE id=${cancelledId}`)[0].n, 0);
        assert.notEqual(booking.id, cancelledId);
        await choose(winner, choice);
        await winner.page.getByRole("dialog").getByText("You're booked", { exact: true }).waitFor();
      },
    );
    await check(
      "administrator export contains all 152 records across pagination; personal export stays scoped",
      async () => {
        const made = sql(
          `INSERT INTO sessions (class_type_id,instructor_id,starts_at,capacity,created_at,updated_at) SELECT class_type_id,instructor_id,starts_at+86400000,151,created_at,updated_at FROM sessions WHERE id=${booking.session_id}`,
        );
        sql(
          `WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<151) INSERT INTO bookings (session_id,attendee_id,created_at,updated_at) SELECT ${made.lastInsertRowid},NULL,strftime('%s','now')*1000,strftime('%s','now')*1000 FROM n`,
        );
        const [otherIdentity] = sql(`SELECT id FROM user WHERE email='${other.email}'`);
        sql(
          `UPDATE bookings SET attendee_id='${otherIdentity.id}' WHERE id=(SELECT MIN(id) FROM bookings WHERE session_id=${made.lastInsertRowid})`,
        );
        assert.equal(live().length, 152);
        const limited = await api("/bookings?limit=1", adminKey);
        const list = await limited.json();
        assert.equal(list.total, 152);
        assert.equal(list.items.length, 1);
        assert.equal(list.pages, 152);
        const next = await (await api("/bookings?limit=1&page=2", adminKey)).json();
        assert.equal(next.items.length, 1);
        assert.notEqual(next.items[0].id, list.items[0].id);
        const csv = await api("/bookings.csv", adminKey);
        assert.equal(csv.status, 200);
        assert.equal(
          countRows(await csv.text()),
          153,
          "export silently omitted rows beyond its first page",
        );
        await open(winner.page, `${base}/my-bookings`);
        const ready = winner.page.waitForEvent("download");
        await winner.page.getByRole("button", { name: "Export CSV", exact: true }).click();
        const download = await ready,
          stream = await download.createReadStream();
        let content = "";
        for await (const chunk of stream) content += chunk;
        assert.equal(countRows(content), 2, "personal export leaked unowned or other-user rows");
      },
    );
    await check(
      "revoked key cannot fall back to public access or read private API/MCP",
      async () => {
        await open(admin.page, `${base}/team`);
        const row = admin.page.locator('[data-part="key-row"]', { hasText: "Fixture observer" });
        admin.page.once("dialog", (dialog) => dialog.accept());
        await row.getByRole("button", { name: "Revoke", exact: true }).click();
        await until(
          async () => (await api("/sessions", restrictedKey)).status === 401,
          "revoked key refusal",
        );
        assert.equal((await api(`/bookings/${booking.id}`, restrictedKey)).status, 401);
        const result = await rpc(restrictedKey, "read", { kind: "Booking", id: booking.id });
        assert.equal(result.response.status, 401);
      },
    );
    await check(
      "mobile visitor navigates the public schedule; published bypass endpoints stay closed",
      async () => {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          serviceWorkers: "block",
        });
        const page = await context.newPage();
        const diagnostics = [];
        page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
        page.on("requestfailed", (request) =>
          diagnostics.push(`request failed: ${request.url()} ${request.failure()?.errorText}`),
        );
        await open(page, base);
        const menu = page.getByRole("button", { name: /menu/i }).filter({ visible: true });
        if (await menu.count()) await menu.first().click();
        await page
          .getByRole("link", { name: "Class schedule", exact: true })
          .filter({ visible: true })
          .first()
          .click();
        await page.waitForURL((url) => url.pathname === "/schedule");
        await page.locator("section ol button").first().waitFor();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
          true,
        );
        const bypass = await context.request.post(`${base}/_dev/act`, {
          data: { user: "role:admin" },
        });
        assert.equal(bypass.status(), 404);
        const fixturePassword = `synthetic-fixture-${process.pid}-only`;
        const passwordHash = run(
          process.execPath,
          [
            "--input-type=module",
            "-e",
            `import{hashPassword,verifyPassword}from'better-auth/crypto';const password=${JSON.stringify(fixturePassword)};const hash=await hashPassword(password);if(!await verifyPassword({hash,password}))throw Error('bad fixture hash');console.log(hash);`,
          ],
          dir,
        ).trim();
        const [adminIdentity] = sql("SELECT id FROM user WHERE email='owner@assurance.example'");
        sql(
          `INSERT INTO account(id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES('fixture-password','${adminIdentity.id}','credential','${adminIdentity.id}','${passwordHash}',strftime('%s','now')*1000,strftime('%s','now')*1000) ON CONFLICT(id) DO UPDATE SET password=excluded.password`,
        );
        const password = await context.request.post(`${base}/api/auth/sign-in/email`, {
          data: { email: "owner@assurance.example", password: fixturePassword },
        });
        assert.ok([400, 401, 403, 404].includes(password.status()));
        await context.close();
      },
    );
    await check("administrator can cancel another account through direct API", async () => {
      assert.equal(
        (await api(`/bookings/${booking.id}`, adminKey, { method: "DELETE" })).status,
        204,
      );
      assert.equal(
        live().some((row) => row.id === booking.id),
        false,
      );
    });
    for (const person of accounts) await person.context.close();
    await anonymous.close();
    evidence.status = "passed";
    succeeded = true;
  } catch (error) {
    evidence.status = stopping ? "cancelled" : "failed";
    evidence.error = String(error);
    console.error(error);
    process.exitCode = stopping ? 143 : 1;
  } finally {
    process.off("SIGTERM", stop);
    process.off("SIGINT", stop);
    await browser?.close();
    if (server?.pid) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {}
      await new Promise((done) => setTimeout(done, 100));
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {}
    }
    for (const socket of sockets) socket.destroy();
    if (smtp) await new Promise((done) => smtp.close(done));
    mkdirSync(resolve(output, ".."), { recursive: true });
    writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
    if (succeeded && !process.env.TEST_BOOKING_KEEP && !process.argv.includes("--keep"))
      rmSync(root, { recursive: true, force: true });
    else {
      writeFileSync(join(root, "server.log"), serverLog);
      console.error(`Disposable ${succeeded ? "fixture" : "failed fixture"} retained: ${root}`);
    }
  }
}
