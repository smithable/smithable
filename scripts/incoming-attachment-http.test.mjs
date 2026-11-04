import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

test("generated incoming mail persists scoped attachment receipts and threaded reply bytes", {
  timeout: 240000,
}, async () => {
  const repo = resolve(import.meta.dirname, ".."),
    root = mkdtempSync(join(tmpdir(), "incoming-attachments-")),
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
  env.INCOMING_SUPPORT_SECRET = secret;
  let server,
    log = "";
  try {
    execFileSync(process.execPath, [cli, "new", app, "--starter", "support"], {
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
    execFileSync("pnpm", ["exec", "tsc", "--noEmit"], {
      cwd: app,
      env,
      encoding: "utf8",
      timeout: 120000,
      stdio: "pipe",
    });
    const post = (mail, authorized = true) =>
      fetch(`${base}/incoming/support`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${authorized ? secret : "wrong"}`,
        },
        body: JSON.stringify(mail),
        signal: AbortSignal.timeout(10000),
      });
    const content = "Literal incoming attachment\n";
    const mail = {
      from: "Synthetic Sender <sender@example.org>",
      to: "support@example.org",
      subject: "Attachment fixture",
      text: "Literal persisted body",
      attachments: [{ name: "evidence.txt", data: Buffer.from(content).toString("base64") }],
    };
    assert.equal((await post(mail, false)).status, 401);
    await new Promise((resolve, reject) => {
      const req = httpRequest(
        `${base}/incoming/support`,
        {
          method: "POST",
          headers: { authorization: "Bearer wrong", "transfer-encoding": "chunked" },
        },
        (res) => {
          try {
            assert.equal(res.statusCode, 401);
            resolve();
          } catch (error) {
            reject(error);
          }
          res.resume();
          req.destroy();
        },
      );
      req.once("error", reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("Unauthorized body was read before refusing"));
      });
      req.flushHeaders();
    });
    const response = await post(mail);
    assert.equal(response.status, 201, await response.clone().text());
    const { id } = await response.json();
    const db = new DatabaseSync(join(app, "data/db/app.db"));
    try {
      const row = db
        .prepare("SELECT subject, customer_email, body, attachments FROM support_cases WHERE id=?")
        .get(id);
      assert.equal(row.subject, "Attachment fixture");
      assert.equal(row.customer_email, "sender@example.org");
      assert.equal(row.body, "Literal persisted body");
      const [stored] = JSON.parse(row.attachments);
      assert.equal(stored.name, "evidence.txt");
      assert.equal(stored.size, Buffer.byteLength(content));
      assert.equal(stored.receipt, undefined);
      assert.equal(readFileSync(join(app, "data/uploads", stored.file), "utf8"), content);
      const reply = await post({
        ...mail,
        subject: `[Support #${id}] Re: Attachment fixture`,
        text: "Literal reply",
        attachments: [
          { name: "reply.txt", data: Buffer.from("Literal reply attachment\n").toString("base64") },
        ],
      });
      assert.equal(reply.status, 201, await reply.clone().text());
      const result = await reply.json();
      assert.equal(result.thread, id);
      const message = db
        .prepare("SELECT content, attachments, support_case_id FROM messages WHERE id=?")
        .get(result.id);
      assert.equal(message.content, "Literal reply");
      assert.equal(message.support_case_id, id);
      const [attachment] = JSON.parse(message.attachments);
      assert.equal(attachment.name, "reply.txt");
      assert.equal(
        readFileSync(join(app, "data/uploads", attachment.file), "utf8"),
        "Literal reply attachment\n",
      );
    } finally {
      db.close();
    }
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
