import { type ChildProcess, spawn } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { fixturePids, stopStudioFixture } from "../../../scripts/studio-test-processes.mjs";
import {
  PREVIEW_TOKEN_DIGEST,
  PREVIEW_TOKEN_HEADER,
  previewTokenOf,
  tokenDigest,
} from "./preview-editor.js";

/**
 * Studio behind a proxy (`--host`), with the app's dev server replaced by project code that
 * writes down every request's address and raw headers and its own environment: what the app's
 * code could read in the preview's process (T1001). Every request Studio makes to the preview
 * (warm-up, health, the door) carries the same headers; WebSocket upgrades come from the proxy,
 * not through Studio.
 */
const TOKEN = "studio-token-for-the-host-test";
const FELL_BACK =
  "The description could not be used this time: no AI model is available. This is the crm starter; describe changes to it below.";
const root = new URL("../../../", import.meta.url).pathname;
const bin = join(root, "packages/cli/dist/bin.js");

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

interface Seen {
  env?: Record<string, string>;
  url?: string;
  raw?: string[];
}

/** Studio on the fake project, given its token on standard input or in its environment. */
function hosted(given: "stdin" | "env") {
  // Off the gates' port ranges (smithable/CLAUDE.md), and new each run.
  const port = 20000 + Math.floor(Math.random() * 9000) * 2;
  let dir = "";
  let studio: ChildProcess | undefined;
  const seen = (): Seen[] => {
    const file = join(dir, "seen.jsonl");
    if (!existsSync(file)) return [];
    return readFileSync(file, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Seen);
  };

  beforeAll(async () => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "studio-host-")));
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
    // A hosted workspace whose description fell back to the starter leaves why (T1577).
    mkdirSync(join(dir, "data/.smithable"), { recursive: true });
    writeFileSync(join(dir, "data/.smithable/notice.txt"), `${FELL_BACK}\n`);
    const args = [bin, "studio", dir, "--host", "127.0.0.1", "--port", String(port)];
    studio = spawn(process.execPath, given === "stdin" ? [...args, "--secrets-stdin"] : args, {
      env: given === "env" ? { ...process.env, SMITHABLE_STUDIO_TOKEN: TOKEN } : process.env,
      stdio: ["pipe", "ignore", "ignore"],
      detached: true,
    });
    studio.stdin?.end(given === "stdin" ? JSON.stringify({ studioToken: TOKEN }) : "");
    // Studio's own first request to the preview (its warm-up) has come in.
    await until(() => seen().some((line) => line.url));
    expect(fixturePids(dir).length).toBeGreaterThan(0);
  }, 60_000);

  afterAll(async () => {
    if (!dir) return;
    try {
      const graceful = await stopStudioFixture(studio, dir);
      expect(fixturePids(dir)).toEqual([]);
      expect(graceful, "Studio should stop its own preview without the cleanup fallback").toBe(
        true,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);

  // First, so it makes the first read of the project itself.
  test("a fallback to the starter is said in every read of the project, the notice in one", async () => {
    const read = async () =>
      (await (
        await fetch(`http://127.0.0.1:${port}/api/project`, {
          headers: { "x-smithable-studio-token": TOKEN },
        })
      ).json()) as { notice?: string; fallback?: string };
    const first = await read();
    const second = await read();
    expect(first.fallback).toBe(FELL_BACK);
    expect(second.fallback).toBe(FELL_BACK);
    // The page's message comes once, to the first read.
    expect(first.notice).toBe(FELL_BACK);
    expect(second.notice).toBeUndefined();
    expect(existsSync(join(dir, "data/.smithable/notice.txt"))).toBe(false);
    // Kept on disk, for a Studio started again on the same app.
    expect(readFileSync(join(dir, "data/.smithable/fallback.txt"), "utf8").trim()).toBe(FELL_BACK);
  });

  test("the preview's process never sees Studio's token, only its own credential", () => {
    const lines = seen();
    const preview = previewTokenOf(TOKEN);
    const values = lines.flatMap((line) => [
      ...Object.values(line.env ?? {}),
      ...(line.raw ?? []),
      ...(line.url ? [decodeURIComponent(line.url)] : []),
    ]);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value).not.toContain(TOKEN);
      expect(value).not.toContain(tokenDigest(TOKEN));
    }
    // The preview holds only its own credential's digest.
    const env = lines.find((line) => line.env)?.env ?? {};
    expect(env[PREVIEW_TOKEN_DIGEST]).toBe(tokenDigest(preview));
    expect(env.SMITHABLE_STUDIO_TOKEN).toBeUndefined();
    const requests = lines.filter((line) => line.raw);
    expect(requests.length).toBeGreaterThan(0);
    for (const { raw = [] } of requests) {
      const names = raw.filter((_, i) => i % 2 === 0).map((name) => name.toLowerCase());
      expect(names).not.toContain("x-smithable-studio-token");
      expect(raw[names.indexOf(PREVIEW_TOKEN_HEADER) * 2 + 1]).toBe(preview);
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
}

describe("the token on standard input", () => hosted("stdin"));
describe("the token in Studio's environment", () => hosted("env"));

/**
 * The fallback's life (T1585): a Studio started again on the same app keeps saying why it is the
 * starter; an app that comes in takes that reason away, and a Studio started after it does not
 * bring it back.
 */
describe("the fallback to the starter, across restarts and a replacement", () => {
  const port = 20001 + Math.floor(Math.random() * 9000) * 2;
  let dir = "";
  let from = "";
  let studio: ChildProcess | undefined;
  const files = [
    "smithable.yml",
    "smithable.auth.yml",
    "smithable.ux.yml",
    "smithable.content.yml",
  ];
  const pkg = JSON.stringify({ name: "fallback-test", private: true });
  const call = async (path: string, init: RequestInit = {}) =>
    fetch(`http://127.0.0.1:${port}${path}`, {
      ...init,
      // As Studio's own page sends a change.
      headers: {
        "x-smithable-studio-token": TOKEN,
        "x-smithable": "1",
        "content-type": "application/json",
      },
    });
  const project = async () =>
    (await (await call("/api/project")).json()) as { notice?: string; fallback?: string };
  const start = async (replaceable: boolean) => {
    const args = [bin, "studio", dir, "--host", "127.0.0.1", "--port", String(port)];
    studio = spawn(
      process.execPath,
      [...args, "--secrets-stdin", ...(replaceable ? ["--replaceable"] : [])],
      { stdio: ["pipe", "ignore", "ignore"], detached: true },
    );
    studio.stdin?.end(JSON.stringify({ studioToken: TOKEN }));
    // Studio's warm-up has reached the preview: stopped before that, it is not yet settled.
    await until(
      () =>
        existsSync(join(dir, "seen.jsonl")) &&
        readFileSync(join(dir, "seen.jsonl"), "utf8").includes('"url"'),
    );
    const end = Date.now() + 30_000;
    while ((await call("/api/project").catch(() => undefined))?.status !== 200) {
      if (Date.now() > end) throw new Error("Studio did not answer");
      await new Promise((done) => setTimeout(done, 200));
    }
  };
  const stop = async () => {
    expect(await stopStudioFixture(studio, dir)).toBe(true);
    expect(fixturePids(dir)).toEqual([]);
    rmSync(join(dir, "seen.jsonl"), { force: true });
  };

  beforeAll(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "studio-fallback-")));
    from = realpathSync(mkdtempSync(join(tmpdir(), "studio-fallback-from-")));
    for (const name of files) {
      cpSync(join(root, "examples/records", name), join(dir, name));
      cpSync(join(root, "examples/records", name), join(from, name));
    }
    writeFileSync(join(dir, "package.json"), pkg);
    writeFileSync(join(from, "package.json"), pkg);
    mkdirSync(join(dir, "node_modules/.bin"), { recursive: true });
    writeFileSync(join(dir, "node_modules/.bin/vite"), fakeVite);
    chmodSync(join(dir, "node_modules/.bin/vite"), 0o755);
    mkdirSync(join(dir, "data/.smithable"), { recursive: true });
    writeFileSync(join(dir, "data/.smithable/notice.txt"), `${FELL_BACK}\n`);
  });

  afterAll(async () => {
    try {
      if (studio && studio.exitCode === null) await stopStudioFixture(studio, dir);
    } finally {
      for (const d of [dir, from]) if (d) rmSync(d, { recursive: true, force: true });
    }
  }, 15_000);

  test("kept by a Studio started again, cleared by an app that comes in, also after a restart", async () => {
    await start(true);
    expect((await project()).fallback).toBe(FELL_BACK);
    await stop();

    // Started again (a workspace woken): the reason holds, and the one-time notice is not repeated.
    await start(true);
    const again = await project();
    expect(again.fallback).toBe(FELL_BACK);
    expect(again.notice).toBeUndefined();

    // A finished app takes the starter's place: it is not the starter, so no reason stays.
    const replaced = await call("/api/project/replace", {
      method: "POST",
      body: JSON.stringify({ from }),
    });
    expect(replaced.status, await replaced.clone().text()).toBe(200);
    expect((await project()).fallback).toBeUndefined();
    expect(existsSync(join(dir, "data/.smithable/fallback.txt"))).toBe(false);
    await stop();

    await start(false);
    expect((await project()).fallback).toBeUndefined();
    await stop();
  }, 120_000);
});
