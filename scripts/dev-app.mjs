// A starter app made, served and signed into for the scripts that photograph apps (theme-sheet,
// starter-shots): `smithable new` from this checkout's build, Vite's dev server on a fixed port,
// and the development sign-in. Not part of `check`.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// How long the waits are, times TEST_PATIENCE (the gate sets it from the machine's load, 1 to 3):
// a check that waits a minute on a quiet machine waits three under load, so a slow answer is
// not read as a failure.
const P = Math.max(1, Number(process.env.TEST_PATIENCE) || 1);

export const repo = new URL("..", import.meta.url).pathname;
export const cli = join(repo, "packages/cli/dist/bin.js");

export function run(args, cwd = repo) {
  const result = spawnSync(args[0], args.slice(1), { cwd, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(`${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

/** An operation on the app, confirmed. */
export const op = (dir, ...args) => run(["node", cli, "op", ...args, "--dir", dir, "--yes"]);

/** A new app from a starter, in a temporary directory that stays for a look afterwards. */
export function newApp(starter, label = starter) {
  const dir = join(mkdtempSync(join(tmpdir(), `smithable-${label}-`)), "app");
  run(["node", cli, "new", dir, "--starter", starter]);
  return dir;
}

/** Kills a process and everything it started (pnpm, node, Vite), children first. */
function killTree(pid) {
  const children = spawnSync("ps", ["-o", "pid=", "--ppid", String(pid)], { encoding: "utf8" })
    .stdout.split("\n")
    .map((s) => Number(s.trim()))
    .filter(Boolean);
  for (const child of children) killTree(child);
  try {
    process.kill(pid);
  } catch {}
}

/** Starts the app's dev server on the port and waits for it; returns a stop function. */
export async function serveDev(dir, port) {
  const server = spawn("pnpm", ["exec", "vite", "dev", "--port", String(port), "--strictPort"], {
    cwd: dir,
    env: { ...process.env, PORT: String(port) },
  });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  const stop = () => killTree(server.pid);
  process.on("exit", stop);
  for (let i = 0; i < 240 * P; i++) {
    try {
      if (
        (await fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(2000) })).ok
      )
        return stop;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  stop();
  throw new Error(`the app did not start:\n${log.slice(-2000)}`);
}

/** Opens a page and waits until it is idle: the dev server loads code on demand. */
export async function open(page, url) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

/** Signs in through the development sign-in; a first click on a cold server can be lost. */
export async function signIn(page, base, role) {
  for (let attempt = 1; ; attempt++) {
    await open(page, `${base}/sign-in`);
    await page.getByRole("button", { name: `Sign in as ${role}` }).click();
    try {
      await page.waitForURL((url) => url.pathname !== "/sign-in", { timeout: 5000 * P });
      return;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(130));
