// A short recording for the site: an AI assistant (Claude Code, run headless) uses a generated
// app's tools at /mcp with a reception key. It adds a class to the schedule, which appears in the
// live app beside it, and is refused a change the key's role may not make, in the app's words.
// The run is real: Claude Code's own events are shown as they come, and its transcript is kept.
// A new booking app (sample data only) on a fixed port; the key is made on its Team page and
// never printed or saved. Uses the user's Claude usage (a few cents a take), so ask before
// running. Writes the video (WebM), the transcript (JSONL, the key masked) and a JSON of when each
// moment starts with its caption, to --out.
// Run after `pnpm build`: `node scripts/record-assistant.mjs [--out <dir>] [--port 8413] [--dry-run]`.
// --dry-run prints what a take would do and changes nothing. The demo app lives in a temporary
// folder and is removed at the end of the take. Not part of `check`.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { newApp, op, open, serveDev, signIn } from "./dev-app.mjs";

const { values: opts } = parseArgs({
  options: {
    out: { type: "string", default: join(process.cwd(), "recordings/assistant") },
    port: { type: "string", default: process.env.RECORD_PORT ?? "8413" },
    model: { type: "string", default: "claude-opus-5-5" },
    "dry-run": { type: "boolean", default: false },
  },
});
const port = Number(opts.port);
const base = `http://localhost:${port}`;
const size = { width: 1280, height: 720 };
mkdirSync(opts.out, { recursive: true });

// What the receptionist asks: one thing reception may do, one it may not.
const ask =
  "Add a Yin class this Saturday at 10:00 with Emma Lindqvist. Also change Emma's bio to say she is away in December.";

if (opts["dry-run"]) {
  console.log(`A take would:
  1. make a new booking app from the starter (sample data only) in a temporary folder, with a Team
     page and its records offered to assistants (setApi all --assistants true);
  2. serve it at ${base} and, signed in as its development administrator, make a reception key on
     the Team page (kept in a temporary file, never printed or saved);
  3. run Claude Code headless (${opts.model}, your Claude usage, a few cents) with only the app's
     /mcp, asking: "${ask}";
  4. film the live app beside Claude Code's events at ${size.width}x${size.height};
  5. check in the database that one session was added and the bio was refused, unchanged;
  6. write assistant.webm, transcript.jsonl (the key masked) and assistant.json to ${opts.out};
  7. stop the app and remove its folder and the key file.
Nothing was done.`);
  process.exit(0);
}
const dir = newApp("booking", "record-assistant");
// The owner's set-up: a team page to make keys on, and the app offered to programs and assistants.
op(dir, "addUsersPage", "team", "/team", "--setup");
op(dir, "setApi", "all", "--assistants", "true", "--setup");
const stopApp = await serveDev(dir, port);

const database = () => new DatabaseSync(join(dir, "data/db/app.db"), { readOnly: true });
const read = (sql, ...args) => {
  const db = database();
  try {
    return db.prepare(sql).get(...args);
  } finally {
    db.close();
  }
};
const bioBefore = read("select bio from instructors where name = 'Emma Lindqvist'").bio;
const sessionsBefore = read("select count(*) as n from sessions").n;

const browser = await chromium.launch();

// Off camera: the owner makes a key for reception on the Team page (role staff, the default).
let key;
{
  const page = await browser.newPage();
  await signIn(page, base, "admin");
  await open(page, `${base}/team`);
  const purpose = page.getByRole("textbox", { name: "What it is for" });
  await purpose.fill("Reception assistant");
  // The key form's own Role (the invite form above has one too).
  await page
    .locator("form", { has: purpose })
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption({ label: "Staff" });
  await page.getByRole("button", { name: "Make a key" }).click();
  await page.getByText("Copy the key now").waitFor();
  key = (await page.locator("main").innerText()).match(/smk_[A-Za-z0-9_-]+/)?.[0];
  await page.close();
  if (!key) throw new Error("no key on the Team page");
}
const mask = (text) => text.split(key).join("smk_…");
const secret = mkdtempSync(join(tmpdir(), "record-assistant-"));
const config = join(secret, "mcp.json");
writeFileSync(
  config,
  JSON.stringify({
    mcpServers: {
      "stillwater-yoga": {
        type: "http",
        url: `${base}/mcp`,
        headers: { Authorization: `Bearer ${key}` },
      },
    },
  }),
  { mode: 0o600 },
);

// The stage, served at the app's own address so the app beside it is the live one: the run on
// the left as it happens, the app's schedule on the right.
const stage = `<!doctype html><html><head><meta charset="utf-8"><style>
  :root { font: 15px/1.45 system-ui, sans-serif; color: #1d1b18; }
  body { margin: 0; display: grid; grid-template-columns: 460px 1fr; height: 100vh; background: #f4f1ec; }
  aside { display: flex; flex-direction: column; background: #1f1d1a; color: #ece8e1; min-height: 0; }
  header { padding: 14px 18px 10px; border-bottom: 1px solid #3a3631; }
  header b { display: block; font-size: 15px; }
  header small { color: #b3ab9f; font-size: 12.5px; }
  #log { flex: 1; overflow: auto; padding: 12px 18px 18px; display: flex; flex-direction: column; gap: 10px; }
  .you { align-self: flex-end; background: #d9622b; color: #fff; padding: 9px 12px; border-radius: 12px 12px 2px 12px; max-width: 92%; }
  .call { font: 12.5px/1.4 ui-monospace, monospace; color: #c9c1b5; border-left: 3px solid #6b6359; padding: 2px 0 2px 9px; white-space: pre-wrap; word-break: break-word; }
  .call .name { color: #fff; font-weight: 600; }
  .ok { border-left-color: #5fa36b; }
  .no { border-left-color: #e0574a; }
  .no .answer { color: #ff9b90; font-weight: 600; }
  .ok .answer { color: #9fd3a7; }
  .claude { background: #2c2925; padding: 9px 12px; border-radius: 12px 12px 12px 2px; white-space: pre-wrap; }
  main { position: relative; }
  iframe { border: 0; width: 100%; height: 100%; background: #fff; }
  .tag { position: absolute; bottom: 12px; right: 12px; background: #1f1d1aE6; color: #fff; font-size: 12px; padding: 4px 9px; border-radius: 999px; }
</style></head><body>
<aside><header><b>Claude Code, with this app's tools</b><small>A recorded run · key for reception (role: staff) · ${base}/mcp</small></header><div id="log"></div></aside>
<main><iframe id="app" src="/schedule"></iframe><span class="tag">The live app</span></main>
<script>
  const log = document.getElementById("log");
  const el = (cls, html) => { const d = document.createElement("div"); d.className = cls; d.innerHTML = html; log.append(d); log.scrollTop = log.scrollHeight; return d; };
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  window.say = (who, text) => el(who, esc(text).replace(/\\*\\*(.+?)\\*\\*/g, "<b>$1</b>"));
  window.call = (id, name, input) => { const d = el("call", '<span class="name">' + esc(name) + "</span> " + esc(input)); d.id = "c" + id; };
  window.answer = (id, ok, text) => { const d = document.getElementById("c" + id); if (!d) return; d.classList.add(ok ? "ok" : "no"); d.insertAdjacentHTML("beforeend", '\\n<span class="answer">' + (ok ? "→ " : "✕ ") + esc(text) + "</span>"); log.scrollTop = log.scrollHeight; };
  window.show = (path) => { document.getElementById("app").src = path; };
</script></body></html>`;

const context = await browser.newContext({
  viewport: size,
  deviceScaleFactor: 2,
  // The video at the viewport size: at twice it, Playwright put most frames at the viewport size in
  // the top-left corner of a grey canvas and only some at full size (2026-11-13).
  recordVideo: { dir: opts.out, size },
  colorScheme: "light",
  timezoneId: "Europe/Mariehamn",
});
await context.route(`${base}/__stage`, (route) =>
  route.fulfill({ contentType: "text/html", body: stage }),
);
const page = await context.newPage();
const started = Date.now();
const moments = [];
const moment = (name, caption) =>
  moments.push({ at: (Date.now() - started) / 1000, name, caption });
const hold = (ms) => page.waitForTimeout(ms);
let shots = 0;
const shot = (name) =>
  page.screenshot({ path: join(opts.out, `${String(++shots).padStart(2, "0")}-${name}.png`) });
const app = page.frameLocator("#app");
const lines = [];

// One tool call as the stage shows it: the tool's own name and its input, short.
const short = (input) => {
  const text = JSON.stringify(input);
  return text.length > 220 ? `${text.slice(0, 217)}…` : text;
};
const resultText = (content) =>
  (Array.isArray(content)
    ? content.map((c) => c.text ?? "").join("")
    : String(content ?? "")
  ).trim();

let added;
let refused;
try {
  await page.goto(`${base}/__stage`);
  await app.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 60000 });
  moment("the app as it is", "The studio's schedule, live");
  await shot("before");
  await hold(2500);

  moment("the ask", "Reception asks Claude, which has only the app's tools");
  await page.evaluate((text) => window.say("you", text), ask);
  await hold(1500);

  const claude = spawn(
    "claude",
    [
      "-p",
      ask,
      "--mcp-config",
      config,
      "--strict-mcp-config",
      "--allowedTools",
      "mcp__stillwater-yoga",
      "--disallowedTools",
      "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Task,NotebookEdit",
      "--output-format",
      "stream-json",
      "--verbose",
      "--model",
      opts.model,
    ],
    { cwd: secret, stdio: ["ignore", "pipe", "pipe"] },
  );
  let stderr = "";
  claude.stderr.on("data", (d) => (stderr += d));
  const calls = new Map();
  for await (const line of createInterface({ input: claude.stdout })) {
    if (!line.trim()) continue;
    lines.push(mask(line));
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue; // a notice that is not an event
    }
    if (event.type !== "assistant" && event.type !== "user") continue;
    for (const part of event.message.content ?? []) {
      if (part.type === "text" && event.type === "assistant" && part.text.trim())
        await page.evaluate((text) => window.say("claude", text), part.text.trim());
      if (part.type === "tool_use" && part.name.startsWith("mcp__stillwater-yoga__")) {
        const name = part.name.replace("mcp__stillwater-yoga__", "");
        calls.set(part.id, { name, input: part.input });
        await page.evaluate(
          ([id, n, i]) => window.call(id, n, i),
          [part.id, name, short(part.input)],
        );
      }
      if (part.type === "tool_result" && calls.has(part.tool_use_id)) {
        const { name, input } = calls.get(part.tool_use_id);
        const text = resultText(part.content);
        const ok = !part.is_error;
        let shown = text;
        if (ok && name === "add") {
          const record = JSON.parse(text);
          shown = `added ${input.kind} #${record.id}`;
          if (input.kind === "Session") added = record;
        } else if (ok) shown = text.length > 90 ? `${text.slice(0, 87)}…` : text;
        await page.evaluate(([id, o, t]) => window.answer(id, o, t), [part.tool_use_id, ok, shown]);
        if (added && name === "add" && input.kind === "Session") {
          moment("the class is added", "The app adds it: it is in the schedule");
          await page.evaluate(() => window.show(`/schedule?t=${Date.now()}`));
          await app.getByText(/Yin/).first().waitFor({ timeout: 60000 });
          await hold(1500);
          await shot("added");
        }
        if (!ok && name === "change" && input.kind === "Instructor") {
          refused = text;
          moment("the refusal", "Reception may not change a teacher: the app refuses");
          await hold(1500);
          await shot("refused");
        }
      }
    }
  }
  const code = await new Promise((resolve) => claude.on("close", resolve));
  if (code !== 0) throw new Error(`claude exited ${code}: ${mask(stderr).slice(-800)}`);
  moment("the answer", "Claude says what was done and what was refused");
  await hold(4000);
  await shot("answer");
  moment("end");

  // What the run did, from the database: one session more, Yin with Emma on Saturday at 10:00
  // Mariehamn time; Emma's bio as it was.
  if (!added) throw new Error("no session was added");
  if (!refused) throw new Error("the change to the instructor was not tried, or not refused");
  if (refused !== "You are not allowed to do this.") throw new Error(`refused as: ${refused}`);
  const session = read(
    `select s.starts_at as startsAt, c.name as classType, i.name as instructor
       from sessions s join class_types c on c.id = s.class_type_id join instructors i on i.id = s.instructor_id
      where s.id = ?`,
    added.id,
  );
  if (!session) throw new Error(`session ${added.id} is not in the database`);
  const local = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Mariehamn",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(session?.startsAt));
  if (session?.classType !== "Yin" || session?.instructor !== "Emma Lindqvist")
    throw new Error(`the session added: ${JSON.stringify(session)}`);
  if (local !== "Saturday 10:00") throw new Error(`the session starts ${local}`);
  if (read("select count(*) as n from sessions").n !== sessionsBefore + 1)
    throw new Error("not exactly one session more");
  if (read("select bio from instructors where name = 'Emma Lindqvist'").bio !== bioBefore)
    throw new Error("Emma's bio changed");
} catch (error) {
  await page.screenshot({ path: join(opts.out, "failed.png") }).catch(() => {});
  throw error;
} finally {
  rmSync(secret, { recursive: true, force: true });
  const video = page.video();
  await context.close();
  await browser.close();
  stopApp();
  // The demo app goes with the take: its whole temporary folder.
  // newApp made it as <tmp>/smithable-record-assistant-XXXX/app.
  if (basename(dirname(dir)).startsWith("smithable-record-assistant-"))
    rmSync(dirname(dir), { recursive: true, force: true });
  if (video) renameSync(await video.path(), join(opts.out, "assistant.webm"));
  writeFileSync(join(opts.out, "transcript.jsonl"), lines.map((l) => `${l}\n`).join(""));
  writeFileSync(
    join(opts.out, "assistant.json"),
    `${JSON.stringify({ size, ask, moments }, null, 2)}\n`,
  );
}
console.log(`Recorded ${join(opts.out, "assistant.webm")} (${moments.at(-1)?.at ?? 0} s)`);
