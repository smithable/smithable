import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { changeDetail, refusal, studio, trace } from "./studio.js";
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
