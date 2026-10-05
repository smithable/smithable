import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "vitest";
import { warmPreview } from "./warm.js";

test("the log says when the preview answered, and that it did not when it never did", async () => {
  const server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(req.url === "/health" ? "ok" : "<html></html>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const said: string[] = [];
  expect(await warmPreview(port, (text) => said.push(text), 2)).toBe(0);
  expect(said[0]).toMatch(/^The preview answers \(\d+(\.\d)? s after it was started\)\.$/);
  expect(said[1]).toMatch(/^The preview is warmed up \(0 modules, /);
  await new Promise((resolve) => server.close(resolve));

  // Nothing listens there any more: one try, and no claim that it answered.
  const silent: string[] = [];
  expect(await warmPreview(port, (text) => silent.push(text), 1)).toBe(0);
  expect(silent).toHaveLength(1);
  expect(silent[0]).toMatch(/^The preview has not answered \d+(\.\d)? s after it was started\.$/);
});
