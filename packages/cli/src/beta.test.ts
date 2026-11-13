import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { BETA, limitOf, readBeta } from "./beta.js";
import { tempDir } from "./test-dir.js";

const limit = {
  limit: "published",
  message: "Your account has one published app, the most on the free level.",
  blocking: [{ id: "p1", name: "Yoga" }],
  apps: "https://smithable.ai/apps",
};

test("a limit in the service's shape is read; anything else is no limit", () => {
  expect(limitOf(limit)).toEqual(limit);
  expect(limitOf({ ...limit, limit: "storage" })).toBeUndefined();
  expect(limitOf({ ...limit, message: " " })).toBeUndefined();
  // The overview's address is the service's https page, never a script or a plain http one.
  expect(limitOf({ ...limit, apps: "javascript:alert(1)" })).toBeUndefined();
  expect(limitOf({ ...limit, apps: "http://smithable.ai/apps" })).toBeUndefined();
  expect(
    limitOf({ ...limit, blocking: [{ id: 1 }, { id: "p2", name: "Shop" }] })?.blocking,
  ).toEqual([{ id: "p2", name: "Shop" }]);
});

test("the beta file carries the limit to Studio; without one, none", () => {
  const dir = tempDir("beta-");
  mkdirSync(join(dir, "data", ".smithable"), { recursive: true });
  writeFileSync(join(dir, BETA), JSON.stringify({ invite: "https://smithable.ai/invite", limit }));
  expect(readBeta(dir)?.limit).toEqual(limit);
  writeFileSync(join(dir, BETA), JSON.stringify({ invite: "https://smithable.ai/invite" }));
  expect(readBeta(dir)?.limit).toBeUndefined();
});
