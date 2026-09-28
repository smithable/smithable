import { expect, test } from "vitest";
import { refusal } from "./studio.js";

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
  // MCP clients are not pages.
  expect(post({ "content-type": "application/json" }, "/mcp")).toBeUndefined();
});
