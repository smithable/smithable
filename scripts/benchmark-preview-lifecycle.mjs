import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright";
export async function measurePreview(app, cli, run, selection = false) {
  let started = performance.now();
  run("pnpm", ["build"], app);
  const firstBuildMs = performance.now() - started;
  run("pnpm", ["typecheck"], app);
  const socket = createServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const env = { ...process.env, HOST: "127.0.0.1", BETTER_AUTH_URL: `http://127.0.0.1:${port}` };
  for (const key of Object.keys(env))
    if (/^(DEMO_|DEV_DOOR|SMITHABLE_|ANTHROPIC_|OPENAI_|GOOGLE_|GEMINI_|AZURE_|AWS_)/.test(key))
      delete env[key];
  let log = "";
  started = performance.now();
  const server = spawn(
    "pnpm",
    ["exec", "vite", "dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: app, env, detached: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (chunk) => {
      log = (log + chunk).slice(-10000);
    });
  const signal = (name) => {
    try {
      process.kill(-server.pid, name);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  };
  let browser;
  try {
    const deadline = Date.now() + 60000;
    for (;;) {
      if (server.exitCode !== null) throw Error(`Preview exited: ${log}`);
      try {
        if (
          (await fetch(`${env.BETTER_AUTH_URL}/health`, { signal: AbortSignal.timeout(1000) })).ok
        )
          break;
      } catch {}
      if (Date.now() > deadline) throw Error(`Preview never became healthy: ${log}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(env.BETTER_AUTH_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => document.body.dataset.hydrated === "true");
    const firstSettledPreviewMs = performance.now() - started;
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const name = `Measured booking ${i + 1}`;
      started = performance.now();
      run(process.execPath, [cli, "op", "setApp", "--name", name, "--dir", app]);
      await page.waitForFunction((name) => document.title.includes(name), name, { timeout: 30000 });
      await page.waitForLoadState("networkidle");
      samples.push(performance.now() - started);
    }
    if (selection) {
      run(
        process.execPath,
        [
          "-e",
          `const D=require('better-sqlite3');const db=new D('data/db/app.db');db.transaction(()=>{for(let id=1001;id<=1500;id++)db.prepare('INSERT OR IGNORE INTO counters(id,enabled,created_at,updated_at) VALUES(?,0,0,0)').run(id)})();db.close();`,
        ],
        app,
      );
      await page.goto(`${env.BETTER_AUTH_URL}/sign-in`);
      await page.locator('body[data-hydrated="true"]').waitFor();
      await page.locator('[data-dev-role="admin"]').click();
      await page.waitForURL((url) => url.pathname !== "/sign-in");
      await page.goto(`${env.BETTER_AUTH_URL}/booking-filters`);
      await page.locator('body[data-hydrated="true"]').waitFor();
      const combo = page.getByRole("combobox", { name: "Counter", exact: true });
      await combo.fill("1001");
      await page.getByRole("option", { name: "1001", exact: true }).click();
      await page.waitForURL((url) => ["1001", '"1001"'].includes(url.searchParams.get("counter")));
      await page.reload();
      await page.locator('body[data-hydrated="true"]').waitFor();
      if (
        (await page.getByRole("combobox", { name: "Counter", exact: true }).inputValue()) !== "1001"
      )
        throw Error("Selected numeric id was lost after reload");
    }
    const sorted = [...samples].sort((a, b) => a - b);
    return {
      status: "passed",
      selectionBrowser: selection ? "passed" : "not run",
      firstBuildMs,
      firstSettledPreviewMs,
      changeSamplesMs: samples,
      changeP50Ms: sorted[1],
      changeP95Ms: sorted[2],
      browserVersion: browser.version(),
      scope:
        "Local generated booking production build, cold Vite development preview, three CLI setApp changes observed in browser title and network idle; no paid model or hosted queue.",
    };
  } finally {
    await browser?.close();
    const exited = new Promise((resolve) => server.once("exit", resolve));
    signal("SIGTERM");
    if (server.exitCode === null)
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
    signal("SIGKILL");
  }
}
