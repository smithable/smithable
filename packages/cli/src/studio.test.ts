import { expect, test } from "vitest";
import { refusal, studio } from "./studio.js";
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
