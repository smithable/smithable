import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { changeDetail, foldGrow, refusal, studio, trace } from "./studio.js";
import { captureIo } from "./test-io.js";

test("locally, only this machine's own host names reach Studio", () => {
  expect(refusal({ host: "localhost:4321" }, undefined, undefined)).toBeUndefined();
  expect(refusal({ host: "evil.example:4321" }, undefined, undefined)?.status).toBe(403);
});

test("behind a proxy with a token, only requests carrying it reach Studio", () => {
  const behind = (headers: Record<string, string>) => refusal(headers, "0.0.0.0", "s3cret-token");
  expect(behind({ host: "ws-0123456789:4321" })?.status).toBe(401);
  expect(behind({ host: "x", "x-smithable-studio-token": "wrong-token!" })?.status).toBe(401);
  expect(behind({ host: "x", "x-smithable-studio-token": "s3cret-token" })).toBeUndefined();
});

test("a change needs Studio's header, JSON and no other site's origin", () => {
  const post = (headers: Record<string, string>, path = "/api/op") =>
    refusal({ host: "localhost:4321", ...headers }, undefined, undefined, "POST", path);
  const json = { "content-type": "application/json", "x-smithable": "1" };
  expect(post(json)).toBeUndefined();
  expect(post({ ...json, origin: "http://localhost:4321" })).toBeUndefined();
  expect(post({ ...json, origin: "https://evil.example" })?.status).toBe(403);
  expect(post({ "content-type": "text/plain" })?.status).toBe(403);
  expect(post({ "content-type": "application/json" })?.status).toBe(403);
  // MCP clients are not pages; a page on another site that calls /mcp is refused.
  expect(post({ "content-type": "application/json" }, "/mcp")).toBeUndefined();
  expect(
    post({ "content-type": "application/json", origin: "https://evil.example" }, "/mcp")?.status,
  ).toBe(403);
});

test("on the network, Studio does not start without a token unless told to run open", async () => {
  const saved = process.env.SMITHABLE_STUDIO_TOKEN;
  delete process.env.SMITHABLE_STUDIO_TOKEN;
  try {
    const io = captureIo();
    expect(await studio("/nonexistent", io, 4999, { host: "0.0.0.0" })).toBe(1);
    expect(io.stderr).toMatch(/without a token.*--insecure/s);
  } finally {
    if (saved !== undefined) process.env.SMITHABLE_STUDIO_TOKEN = saved;
  }
});

test("a crashed preview restarts at once a few times, then with a growing pause, never giving up", async () => {
  const { previewRestartDelay } = await import("./studio.js");
  expect([1, 2, 5].map(previewRestartDelay)).toEqual([1000, 1000, 1000]);
  expect([6, 7, 8, 9].map(previewRestartDelay)).toEqual([10_000, 20_000, 40_000, 80_000]);
  expect([10, 11, 50].map(previewRestartDelay)).toEqual([120_000, 120_000, 120_000]);
});

test("the trace has each change's id, the person's files it changed and a model's request; a change opens as its patch", () => {
  const dir = mkdtempSync(join(tmpdir(), "smithable-trace-"));
  const commit = (message: string, files: Record<string, string>) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(dir, path, ".."), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    spawnSync("git", ["add", "-A"], { cwd: dir });
    spawnSync(
      "git",
      ["-c", "user.name=T", "-c", "user.email=t@t.invalid", "commit", "-qm", message],
      { cwd: dir },
    );
  };
  try {
    spawnSync("git", ["init", "-q"], { cwd: dir });
    commit("smithable: start of history", { "smithable.yml": "smithable: 0.1\n" });
    commit("smithable: Add field phone to Customer", {
      "smithable.yml": "smithable: 0.1\nmodels: {}\n",
      "src/generated/schema.ts": "export {};\n",
      "src/custom/actions/merge.ts": "export {};\n",
    });
    commit(
      'smithable: Add field website to Customer\n\nSmithable-AI: {"request":"customers need a website","tier":"frontier","model":"m","tokens":10,"cost":0.01}',
      { "smithable.yml": "smithable: 0.1\nmodels: { A: {} }\n" },
    );
    const [asked, added] = trace(dir);
    expect(asked).toMatchObject({ files: ["smithable.yml"], request: "customers need a website" });
    expect(added?.id).toMatch(/^[0-9a-f]{40}$/);
    expect(added?.files).toEqual(["smithable.yml", "src/custom/actions/merge.ts"]);
    expect(added?.request).toBeUndefined();
    const detail = changeDetail(dir, added?.id ?? "");
    expect(detail?.patch).toContain("+models: {}");
    expect(detail?.patch).not.toContain("src/generated");
    expect(detail?.generated).toBe(1);
    expect(detail?.before.spec).toBe("smithable: 0.1");
    expect(detail?.after.spec).toContain("models: {}");
    expect(changeDetail(dir, added?.id ?? "", true)?.patch).toContain("src/generated/schema.ts");
    expect(changeDetail(dir, "0".repeat(40))).toBeUndefined();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an edit of the same file right after the editor's last grows that change; one after another change does not", () => {
  const dir = mkdtempSync(join(tmpdir(), "smithable-grow-"));
  const git = (...args: string[]) =>
    spawnSync("git", ["-c", "user.name=T", "-c", "user.email=t@t.invalid", ...args], {
      cwd: dir,
      encoding: "utf8",
    }).stdout.trim();
  let snapshots = 0;
  const edit = (text: string, file = "smithable.yml") => {
    writeFileSync(join(dir, file), text);
    git("add", "-A");
    git(
      "commit",
      "-qm",
      `smithable: Edit ${file}\n\nSmithable-Op: ${JSON.stringify({ op: "editSpec", args: { text, ...(file === "smithable.yml" ? {} : { file }) } })}\nSmithable-Snapshot: snap-${++snapshots}`,
    );
    return git("rev-parse", "HEAD");
  };
  try {
    git("init", "-q");
    edit("smithable: 0.1\n");
    const first = edit("smithable: 0.1\n# a\n");
    edit("smithable: 0.1\n# a\n# b\n");
    const grown = foldGrow(dir, first);
    expect(git("rev-list", "--count", "HEAD")).toBe("2");
    expect(git("show", "HEAD:smithable.yml")).toBe("smithable: 0.1\n# a\n# b");
    expect(git("log", "-1", "--format=%B", grown)).toContain('"text":"smithable: 0.1\\n# a\\n"');
    // The first change's database snapshot stays: undo goes back to before the typing began.
    expect(git("log", "-1", "--format=%(trailers:key=Smithable-Snapshot,valueonly)", grown)).toBe(
      "snap-2",
    );
    // Another file's edit in between: the next save is a change of its own.
    edit("smithableUx: 0.1\n", "smithable.ux.yml");
    edit("smithable: 0.1\n# c\n");
    expect(foldGrow(dir, grown)).toBe(git("rev-parse", "HEAD"));
    expect(git("rev-list", "--count", "HEAD")).toBe("4");
    // Typed back to where it began: the grown change is gone.
    const again = git("rev-parse", "HEAD");
    edit("smithable: 0.1\n# a\n# b\n");
    foldGrow(dir, again);
    expect(git("rev-list", "--count", "HEAD")).toBe("3");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a request's body is refused past its limit, before it is read in full", async () => {
  const { readJson, TooLarge } = await import("./studio.js");
  async function* parts(...chunks: string[]) {
    for (const c of chunks) yield Buffer.from(c);
  }
  expect(await readJson(parts('{"a":', "1}"), "6")).toEqual({ a: 1 });
  expect(await readJson(parts(), undefined)).toEqual({});
  // Its stated length alone is enough to refuse it.
  await expect(readJson(parts("{}"), "21000000")).rejects.toBeInstanceOf(TooLarge);
  // Without one, it stops once too much has come.
  let read = 0;
  async function* endless() {
    for (;;) {
      read++;
      yield Buffer.alloc(1000, 32);
    }
  }
  await expect(readJson(endless(), undefined, 10_000)).rejects.toBeInstanceOf(TooLarge);
  expect(read).toBeLessThanOrEqual(11);
});

test("the dev server's last word about a replaced app's modules is not the new app's log", async () => {
  const { oldAppEcho } = await import("./studio.js");
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "echo-"));
  mkdirSync(join(dir, "src", "generated"), { recursive: true });
  writeFileSync(join(dir, "src", "generated", "session.ts"), "");
  const line = (file: string) =>
    `11:14:00 PM [vite] (ssr) Failed to load url /src/generated/${file}?tss-serverfn-split (resolved id: /x). Does the file exist?`;
  const now = 1_000_000;
  // Just after a replacement, about a module that is gone: dropped.
  expect(oldAppEcho(line("item.ts"), dir, now - 2000, now)).toBe(true);
  // About a module the app has: kept, it is this app's own trouble.
  expect(oldAppEcho(line("session.ts"), dir, now - 2000, now)).toBe(false);
  // Long after, or with no replacement: kept.
  expect(oldAppEcho(line("item.ts"), dir, now - 60_000, now)).toBe(false);
  expect(oldAppEcho(line("item.ts"), dir, 0, now)).toBe(false);
  // Any other line: kept.
  expect(oldAppEcho("[vite] page reload src/routes/index.tsx", dir, now - 2000, now)).toBe(false);
});
