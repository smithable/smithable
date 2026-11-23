import assert from "node:assert/strict";
import { test } from "node:test";
import { gatePorts, listening } from "./gate-ports.mjs";
import { appBases } from "./ports.mjs";

test("the gate checks each example's four ports and Studio's six", () => {
  assert.deepEqual(
    gatePorts(7000, 7600, 2),
    [7000, 7100, 7200, 7300, 7010, 7110, 7210, 7310, 7600, 7601, 7602, 7603, 7604, 7605],
  );
});

test("an example whose ports include a refused one takes the next ten, as test-apps-parallel does", () => {
  // 6000 (X11) is refused: 5700's +300 reaches it, so the first example moves on.
  assert.deepEqual(appBases(5700, 2), [5710, 5720]);
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
