import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

test("generated development clock freezes exact replay time and refuses unauthenticated/malformed changes", {
  timeout: 240000,
}, async () => {
  const repo = resolve(import.meta.dirname, ".."),
    root = mkdtempSync(join(tmpdir(), "scenario-clock-")),
    app = join(root, "app"),
    cli = join(repo, "packages/cli/dist/bin.js");
  const socket = createServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const base = `http://localhost:${port}`,
    secret = randomBytes(24).toString("hex"),
    env = { ...process.env };
  for (const key of Object.keys(env))
    if (
      /^(SMITHABLE_|ANTHROPIC_|OPENAI_|GOOGLE_|GEMINI_|MISTRAL_|AZURE_|AWS_|SMTP_|MAIL_)/.test(key)
    )
      delete env[key];
  env.SMITHABLE_DOOR_SECRET = secret;
  let server,
    log = "";
  try {
    execFileSync(process.execPath, [cli, "new", app, "--starter", "booking"], {
      cwd: repo,
      env,
      encoding: "utf8",
      timeout: 120000,
      stdio: "pipe",
    });
    server = spawn(process.execPath, [cli, "preview", app, "--port", String(port)], {
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const stream of [server.stdout, server.stderr])
      stream.on("data", (chunk) => {
        log = (log + chunk).slice(-10000);
      });
    const deadline = Date.now() + 90000;
    for (;;) {
      try {
        if ((await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) })).ok) break;
      } catch {}
      if (server.exitCode !== null || Date.now() > deadline) throw Error(`Preview failed: ${log}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const post = (body, authorized = true) =>
      fetch(`${base}/_dev/clock`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(authorized ? { "x-dev-door": secret } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
    const at = new Date(Date.now() - 3600000).toISOString();
    assert.equal((await post({ at }, false)).status, 404);
    const frozen = await post({ at });
    assert.equal(frozen.status, 200);
    assert.equal((await frozen.json()).now, at);
    await new Promise((resolve) => setTimeout(resolve, 25));
    const moves = await fetch(`${base}/_dev/moves?user=visitor`, {
      headers: { "x-dev-door": secret },
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(moves.status, 200);
    assert.equal((await moves.json()).now, at);
    assert.equal((await post(null)).status, 400);
    assert.equal((await post({ at: "1970-01-01T00:00:00.000Z" })).status, 400);
    const resumed = await post({ offset: 0 });
    assert.equal(resumed.status, 200);
    assert.ok(Date.parse((await resumed.json()).now) > Date.parse(at) + 1800000);
  } finally {
    if (server?.pid) {
      const exited = new Promise((resolve) => server.once("exit", resolve));
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {}
      if (server.exitCode === null)
        await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {}
    }
    rmSync(root, { recursive: true, force: true });
  }
});
