#!/usr/bin/env node
// What a generated app costs a visitor and its host, per starter, as a Markdown table:
// the JS and CSS the first page loads (gzip), the container image, the server's cold start to
// /health, the first page's time until React has hydrated it on that cold server, and with
// --gate the duration of the engine's `pnpm check` (docs/benchmarks/app-size-2026-10-07.md).
//
//   node scripts/measure-app.mjs [--engine <checkout>] [--starters crm,booking] [--port 9100]
//                                [--image] [--gate [--gate-log <file>]] [--keep]
//
// --engine measures another checkout's engine (built, e.g. a worktree of an older main) with
// this script; its starters are the ones its `smithable new` lists. Ports are the hand-run
// range (docs/ci.md): 9100 and up, two per starter. Free, no model.
import { spawn, spawnSync } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const flag = (name) => process.argv.includes(`--${name}`);
const engine = resolve(arg("engine") ?? repo);
const cli = join(engine, "packages/cli/dist/bin.js");
if (!existsSync(cli)) throw new Error(`${cli} is missing: build that checkout first (pnpm build)`);
const listed = /--starter ([a-z|]+)/.exec(
  spawnSync("node", [cli, "new", "--help"], { encoding: "utf8" }).stdout,
)?.[1];
const starters = (arg("starters") ?? listed ?? "crm").split(/[,|]/);
const basePort = Number(arg("port") ?? 9100);
const work = mkdtempSync(join(tmpdir(), "smithable-measure-"));
const commit = spawnSync("git", ["log", "-1", "--format=%h %ad", "--date=short"], {
  cwd: engine,
  encoding: "utf8",
}).stdout.trim();

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
const sec = (ms) => `${(ms / 1000).toFixed(2)} s`;
const run = (command, args, cwd, env = {}) => {
  const r = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
  if (r.status !== 0)
    throw new Error(`${command} ${args.join(" ")} failed in ${cwd}:\n${r.stdout}${r.stderr}`);
  return r.stdout;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The app's server, cold, until /health answers 200: the time, and a way to stop it. */
async function coldStart(dir, port) {
  // The start script itself, without pnpm's own start-up in the measurement.
  const start = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).scripts.start;
  const began = Date.now();
  const server = spawn("sh", ["-c", start], {
    cwd: dir,
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: "measure-app-secret-0123456789abcdef",
      BETTER_AUTH_URL: `http://localhost:${port}`,
    },
  });
  for (;;) {
    const answer = await fetch(`http://localhost:${port}/health`).catch(() => undefined);
    if (answer?.ok) break;
    if (Date.now() - began > 60_000) throw new Error(`${dir}: no /health after a minute`);
    await sleep(25);
  }
  return { ms: Date.now() - began, stop: () => process.kill(-server.pid, "SIGTERM") };
}

/**
 * The first page a visitor gets ("/", or where it sends them), on a fresh browser: the JS and
 * CSS it loads (as sent and gzipped here, the same for every engine), and the time from asking
 * until React has hydrated the document.
 */
async function firstPage(browser, port) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const loads = [];
  page.on("response", async (response) => {
    const type = response.request().resourceType();
    if (type !== "script" && type !== "stylesheet") return;
    loads.push(
      response
        .body()
        .then((body) => ({
          type,
          url: response.url(),
          raw: body.length,
          gz: gzipSync(body).length,
        }))
        .catch(() => undefined),
    );
  });
  const began = Date.now();
  await page.goto(`http://localhost:${port}/`);
  // Hydrated: React has attached to the document (its fiber keys on <body>), whatever the
  // engine's own markers.
  await page.waitForFunction(
    () => Object.keys(document.body).some((k) => k.startsWith("__react")),
    undefined,
    { timeout: 60_000 },
  );
  const hydrated = Date.now() - began;
  await page.waitForLoadState("networkidle").catch(() => {});
  const files = (await Promise.all(loads)).filter(Boolean);
  const path = new URL(page.url()).pathname;
  await context.close();
  const sum = (type, key) => files.filter((f) => f.type === type).reduce((n, f) => n + f[key], 0);
  return {
    path,
    hydrated,
    js: sum("script", "gz"),
    jsRaw: sum("script", "raw"),
    css: sum("stylesheet", "gz"),
    files: files.length,
    largest: files.sort((a, b) => b.gz - a.gz).slice(0, 3),
  };
}

/** The kit files an app got, by size: the ledger of which parts each starter carries. */
function kit(dir) {
  const root = join(dir, "src/kit");
  const walk = (d) =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)],
    );
  const files = existsSync(root) ? walk(root) : [];
  return {
    count: files.length,
    bytes: files.reduce((n, f) => n + statSync(f).size, 0),
    names: files.map((f) => relative(root, f)).sort(),
  };
}

function imageSize(dir, name) {
  run("docker", ["build", "-q", "-t", name, "."], dir);
  const size = Number(run("docker", ["image", "inspect", "-f", "{{.Size}}", name], dir).trim());
  spawnSync("docker", ["image", "rm", "-f", name], { encoding: "utf8" });
  return size;
}

/**
 * `pnpm check` of the engine under the machine's gate lock: the time from its turn to its end.
 * Its output goes to `log`, to see why when it fails.
 */
async function gate(log) {
  return new Promise((done) => {
    let began;
    const out = createWriteStream(log);
    const child = spawn(join(repo, "scripts/gate.sh"), [], {
      cwd: engine,
      env: { ...process.env, SESSION: "A", TEST_APPS_PORT: "7000", TEST_STUDIO_PORT: "7600" },
    });
    const watch = (chunk) => {
      out.write(chunk);
      // Lines of gate.sh itself are the queue; the first other line is pnpm check starting.
      if (
        !began &&
        chunk
          .toString()
          .split("\n")
          .some((l) => l && !l.startsWith("gate.sh:"))
      )
        began = Date.now();
    };
    child.stdout.on("data", watch);
    child.stderr.on("data", watch);
    child.on("exit", (code) => done({ ms: Date.now() - (began ?? Date.now()), code }));
  });
}

const rows = [];
const browser = await chromium.launch();
try {
  for (const [i, starter] of starters.entries()) {
    const dir = join(work, starter);
    process.stderr.write(`${starter}: new, build…\n`);
    run("node", [cli, "new", dir, "--starter", starter], engine);
    run("pnpm", ["build"], dir);
    const port = basePort + 2 * i;
    const server = await coldStart(dir, port);
    try {
      const first = await firstPage(browser, port);
      const image = flag("image") ? imageSize(dir, `smithable-measure-${starter}`) : undefined;
      rows.push({ starter, cold: server.ms, ...first, image, kit: kit(dir) });
    } finally {
      server.stop();
    }
  }
} finally {
  await browser.close();
  if (!flag("keep")) rmSync(work, { recursive: true, force: true });
}

console.log(`Engine ${commit} (${relative(process.cwd(), engine) || "."})\n`);
console.log(
  "| Starter | First page | JS (gzip) | CSS (gzip) | Files | Cold start to /health | To hydrated | Image | Kit files |",
);
console.log("|---|---|---:|---:|---:|---:|---:|---:|---:|");
for (const r of rows)
  console.log(
    `| ${r.starter} | ${r.path} | ${kb(r.js)} | ${kb(r.css)} | ${r.files} | ${sec(r.cold)} | ${sec(r.hydrated)} | ${r.image ? `${(r.image / 1e6).toFixed(0)} MB` : "–"} | ${r.kit.count} (${kb(r.kit.bytes)}) |`,
  );
console.log("\nLargest files on the first page (gzip):");
for (const r of rows)
  console.log(
    `- ${r.starter}: ${r.largest.map((f) => `${new URL(f.url).pathname.split("/").pop()} ${kb(f.gz)}`).join(", ")}`,
  );
console.log("\nKit files per starter:");
for (const r of rows) console.log(`- ${r.starter}: ${r.kit.names.join(", ")}`);
if (flag("gate")) {
  process.stderr.write("gate…\n");
  const log = resolve(arg("gate-log") ?? join(tmpdir(), `measure-gate-${Date.now()}.log`));
  const g = await gate(log);
  console.log(
    `\nGate (pnpm check under scripts/gate.sh): ${sec(g.ms)}, exit ${g.code} (its output: ${log})`,
  );
}
