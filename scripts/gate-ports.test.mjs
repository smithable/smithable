import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { test } from "node:test";
import { gatePorts, listening } from "./gate-ports.mjs";
import { APP_LIMIT, APP_OFFSETS, appBases, claimPort } from "./ports.mjs";

test("the gate checks each example's six ports and Studio's six", () => {
  assert.deepEqual(
    gatePorts(7000, 7600, 2),
    [
      7000, 7100, 7200, 7300, 7400, 7450, 7001, 7101, 7201, 7301, 7401, 7451, 7600, 7601, 7602,
      7603, 7604, 7605,
    ],
  );
});

test("no two examples share a port, for every example there is and up to the limit", () => {
  const examples = readdirSync(new URL("../examples", import.meta.url), {
    withFileTypes: true,
  }).filter((e) => e.isDirectory()).length;
  assert.ok(examples <= APP_LIMIT, `${examples} examples, room for ${APP_LIMIT}`);
  for (const base of [4400, 6400, 7000, 8600])
    for (const count of [examples, APP_LIMIT]) {
      const ports = appBases(base, count).flatMap((b) => APP_OFFSETS.map((offset) => b + offset));
      assert.equal(new Set(ports).size, count * APP_OFFSETS.length);
    }
  assert.throws(() => appBases(4400, APP_LIMIT + 1), /do not fit apart/);
});

test("test-apps.mjs takes every port it adds from APP_PORT", () => {
  const script = readFileSync(new URL("test-apps.mjs", import.meta.url), "utf8");
  assert.deepEqual(script.match(/\bport\s*[+-]\s*\d+/g), null);
});

test("a server is not started on a port that already answers", async () => {
  for (const host of ["127.0.0.1", "::1"]) {
    const server = createServer((socket) => socket.destroy());
    await new Promise((resolve) => server.listen(0, host, resolve));
    const { port } = server.address();
    await assert.rejects(claimPort(port, "support", 300), new RegExp(`port ${port} .*support`));
    // One just stopped is waited for.
    setTimeout(() => server.close(), 100);
    await claimPort(port, "support", 5000);
  }
});

test("a base whose ports include a refused one is passed over, as test-apps-parallel does", () => {
  // 6000 (X11) is refused: 5700's +300 reaches it, so the first example moves on.
  assert.deepEqual(appBases(5700, 2), [5701, 5702]);
});

test("ss's listening sockets are read with their pids, any address form", () => {
  const held = listening(
    [
      'LISTEN 0      511        127.0.0.1:7200       0.0.0.0:*    users:(("node",pid=949219,fd=21))',
      "LISTEN 0      511             [::1]:7201          [::]:*",
      'LISTEN 0      4096                *:7202             *:*    users:(("vite",pid=12,fd=3))',
      "",
    ].join("\n"),
  );
  assert.deepEqual(
    [...held],
    [
      [7200, { name: "node", pid: 949219 }],
      [7201, undefined],
      [7202, { name: "vite", pid: 12 }],
    ],
  );
});
