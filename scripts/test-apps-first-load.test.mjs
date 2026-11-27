import assert from "node:assert/strict";
import { test } from "node:test";
import { networkOnly, retriedNote } from "./test-apps-first-load.mjs";

const changed = { kind: "request", text: "net::ERR_NETWORK_CHANGED" };
const script = { kind: "request", text: "net::ERR_CONNECTION_RESET", script: true };
const imported = {
  kind: "error",
  text: "TypeError: Failed to fetch dynamically imported module: x",
};

test("failed requests of the network and the import errors they cause are retried", () => {
  assert.ok(networkOnly([changed]));
  assert.ok(networkOnly([imported, changed, script]));
});

test("anything else among them, or no failed request at all, is not", () => {
  assert.ok(!networkOnly([]));
  assert.ok(!networkOnly([imported]));
  assert.ok(!networkOnly([changed, { kind: "error", text: "ReferenceError: x is not defined" }]));
  assert.ok(!networkOnly([changed, { kind: "response", text: "500" }]));
  assert.ok(!networkOnly([changed, { kind: "request", text: "net::ERR_CONNECTION_REFUSED" }]));
});

test("the summary says how many loads were retried", () => {
  assert.equal(retriedNote(0), "");
  assert.match(retriedNote(2), /2 first load\(s\) retried/);
});
