import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { BETA, limitOf, readBeta, releaseOf } from "./beta.js";
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

test("the hosted release flow's progress is checked field by field and says when the app changed since the review", () => {
  const A = "a".repeat(40);
  const ok = {
    url: "https://smithable.test/projects/p1/release",
    reviewed: A,
    staging: "ready",
    production: "locked",
  };
  expect(releaseOf(ok, A)).toEqual({ ...ok, changed: false });
  expect(releaseOf(ok, "b".repeat(40))?.changed).toBe(true);
  expect(releaseOf({ ...ok, reviewed: null }, A)).toEqual({
    ...ok,
    reviewed: null,
    changed: false,
  });
  for (const bad of [
    { ...ok, url: "http://smithable.test/x" },
    { ...ok, url: "javascript:alert(1)" },
    { ...ok, reviewed: "HEAD" },
    { ...ok, staging: "done" },
    { ...ok, production: "maybe" },
    null,
    "release",
  ])
    expect(releaseOf(bad, A)).toBeUndefined();
});

test("uncommitted changes count as changed since the review (a second reviewer)", () => {
  const dir = tempDir("smithable-beta-dirty-");
  mkdirSync(join(dir, "data/.smithable"), { recursive: true });
  const run = (args: string[]) =>
    execFileSync("git", args, { cwd: dir, stdio: "pipe" }).toString().trim();
  run(["init", "-q"]);
  run([
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@example.com",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "x",
  ]);
  const head = run(["rev-parse", "HEAD"]);
  writeFileSync(join(dir, ".gitignore"), "data/\n");
  run(["add", ".gitignore"]);
  run(["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "ignore data"]);
  const reviewed = run(["rev-parse", "HEAD"]);
  writeFileSync(
    join(dir, BETA),
    JSON.stringify({
      release: {
        url: "https://smithable.test/projects/p1/release",
        reviewed,
        staging: "todo",
        production: "locked",
      },
    }),
  );
  expect(readBeta(dir)?.release?.changed).toBe(false);
  writeFileSync(join(dir, "edited.txt"), "not yet a version");
  expect(readBeta(dir)?.release?.changed).toBe(true);
  expect(head).not.toBe(reviewed);
});
