import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, vi } from "vitest";
import { warmPreview } from "./warm.js";

test("the log says when the preview answered, and that it did not when it never did", async () => {
  const server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(req.url === "/health" ? "ok" : "<html></html>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const said: string[] = [];
  expect(await warmPreview(base, (text) => said.push(text), 2)).toBe(0);
  expect(said[0]).toMatch(/^The preview answers \(\d+(\.\d)? s after it was started\)\.$/);
  expect(said[1]).toMatch(/^The preview is warmed up \(0 modules, /);
  await new Promise((resolve) => server.close(resolve));

  // Nothing listens there any more: one try, and no claim that it answered.
  const silent: string[] = [];
  expect(await warmPreview(base, (text) => silent.push(text), 1)).toBe(0);
  expect(silent).toHaveLength(1);
  expect(silent[0]).toMatch(/^The preview has not answered \d+(\.\d)? s after it was started\.$/);
});

test("warm-up uses the preview origin for health, redirects and modules", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response("ok"))
    .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/sign-in" } }))
    .mockResolvedValueOnce(new Response('<script type="module" src="/entry.js"></script>'))
    .mockResolvedValueOnce(new Response("export {};"));
  const base = "http://[::1]:12121";
  const headers = { "x-preview-test": "local" };
  try {
    expect(await warmPreview(base, () => {}, 1, headers)).toBe(1);
    expect(fetch.mock.calls).toEqual(
      ["/health", "/", "/sign-in", "/entry.js"].map((path) => [
        base + path,
        { headers, redirect: "manual" },
      ]),
    );
  } finally {
    fetch.mockRestore();
  }
});
