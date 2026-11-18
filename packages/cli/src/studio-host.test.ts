import { type ChildProcess, spawn } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { PREVIEW_TOKEN_HEADER, previewTokenOf, tokenDigest } from "./preview-editor.js";

/**
 * Studio behind a proxy (`--host`, the token on standard input), with the app's dev server
 * replaced by project code that writes down every request's raw headers and its own
 * environment: what the app's code could read in the preview's process (T1001).
 */
const TOKEN = "studio-token-for-the-host-test";
const root = new URL("../../../", import.meta.url).pathname;
const bin = join(root, "packages/cli/dist/bin.js");
// Off the gates' port ranges (smithable/CLAUDE.md), and new each run.
const port = 20000 + Math.floor(Math.random() * 9000) * 2;
let dir: string;
let studio: ChildProcess | undefined;

const fakeVite = `#!/usr/bin/env node
const { createServer } = require("node:http");
const { appendFileSync } = require("node:fs");
const args = process.argv.slice(2);
const port = Number(args[args.indexOf("--port") + 1]);
const host = args.includes("--host") ? args[args.indexOf("--host") + 1] : "127.0.0.1";
appendFileSync("seen.jsonl", JSON.stringify({ env: process.env }) + "\\n");
createServer((req, res) => {
  appendFileSync("seen.jsonl", JSON.stringify({ url: req.url, raw: req.rawHeaders }) + "\\n");
  res.end("<h1>ok</h1>");
}).listen(port, host);
`;

async function until(check: () => boolean, ms = 30_000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((done) => setTimeout(done, 200));
  }
}

const seen = () =>
  existsSync(join(dir, "seen.jsonl")) ? readFileSync(join(dir, "seen.jsonl"), "utf8") : "";

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "studio-host-"));
  for (const name of [
    "smithable.yml",
    "smithable.auth.yml",
    "smithable.ux.yml",
    "smithable.content.yml",
  ])
    cpSync(join(root, "examples/records", name), join(dir, name));
  mkdirSync(join(dir, "node_modules/.bin"), { recursive: true });
  writeFileSync(join(dir, "node_modules/.bin/vite"), fakeVite);
  chmodSync(join(dir, "node_modules/.bin/vite"), 0o755);
  studio = spawn(
    process.execPath,
    [bin, "studio", dir, "--host", "127.0.0.1", "--port", String(port), "--secrets-stdin"],
    { stdio: ["pipe", "ignore", "ignore"], detached: true },
  );
  studio.stdin?.end(JSON.stringify({ studioToken: TOKEN }));
  // Studio's own first request to the preview (its warm-up) has come in.
  await until(() => seen().includes('"url"'));
}, 60_000);

afterAll(() => {
  if (studio?.pid) process.kill(-studio.pid, "SIGKILL");
  rmSync(dir, { recursive: true, force: true });
});

test("the preview's process never sees Studio's token, only its own credential", () => {
  const lines = seen()
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { env?: Record<string, string>; raw?: string[] });
  const values = lines.flatMap((line) => [...Object.values(line.env ?? {}), ...(line.raw ?? [])]);
  expect(values.length).toBeGreaterThan(0);
  for (const value of values) {
    expect(value).not.toContain(TOKEN);
    expect(tokenDigest(value)).not.toBe(tokenDigest(TOKEN));
  }
  const requests = lines.filter((line) => line.raw);
  for (const { raw = [] } of requests) {
    const names = raw.filter((_, i) => i % 2 === 0).map((name) => name.toLowerCase());
    expect(names).not.toContain("x-smithable-studio-token");
    expect(raw[raw.findIndex((name) => name.toLowerCase() === PREVIEW_TOKEN_HEADER) + 1]).toBe(
      previewTokenOf(TOKEN),
    );
  }
});

test("Studio takes its own token and refuses the preview's credential, in either header", async () => {
  const status = async (headers: Record<string, string>) =>
    (await fetch(`http://127.0.0.1:${port}/api/project`, { headers })).status;
  const preview = previewTokenOf(TOKEN);
  expect(preview).not.toBe(TOKEN);
  expect(await status({ "x-smithable-studio-token": TOKEN })).toBe(200);
  expect(await status({ "x-smithable-studio-token": preview })).toBe(401);
  expect(await status({ [PREVIEW_TOKEN_HEADER]: preview })).toBe(401);
  expect(await status({})).toBe(401);
});
