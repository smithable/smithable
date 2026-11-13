import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { git } from "./git.js";
import { closeOldVersion, oldEnvironment, openVersion, snapshotAfter } from "./old-version.js";
import { tempDir } from "./test-dir.js";

const commit = (dir: string, message: string) => {
  expect(git(dir, ["add", "-A"]).ok).toBe(true);
  expect(
    git(dir, ["-c", "user.name=T", "-c", "user.email=t@example.com", "commit", "-q", "-m", message])
      .ok,
  ).toBe(true);
  return git(dir, ["rev-parse", "HEAD"]).out.trim();
};
const cache = tempDir("old-version-cache-");
const before = process.env.XDG_CACHE_HOME;
process.env.XDG_CACHE_HOME = cache;
afterEach(() => {
  if (before === undefined) delete process.env.XDG_CACHE_HOME;
  else process.env.XDG_CACHE_HOME = before;
  process.env.XDG_CACHE_HOME = cache;
});

test("the old version's environment holds nothing to reach outside with (old-version-preview.md §3.4)", () => {
  const outside = {
    PATH: "/usr/bin",
    LANG: "sv_SE.UTF-8",
    NODE_EXTRA_CA_CERTS: "/etc/ca.pem",
    NODE_OPTIONS: "--require /tmp/x.js",
    HOME: "/home/someone",
    SMTP_URL: "smtp://user:pass@mail.example",
    SMS_PROVIDER: "46elks",
    SMS_KEY: "k",
    STRIPE_SECRET_KEY: "sk_live_x",
    MOLLIE_API_KEY: "live_x",
    OUTGOING_KITCHEN_URL: "https://kitchen.example",
    OUTGOING_KITCHEN_SECRET: "s",
    INCOMING_MAIL_SECRET: "m",
    ASSISTANT_URL: "https://ai.example",
    ASSISTANT_KEY: "a",
    BETTER_AUTH_SECRET: "b",
    AWS_ACCESS_KEY_ID: "x",
    SMITHABLE_STUDIO_TOKEN: "t",
    GITHUB_TOKEN: "g",
  };
  const env = oldEnvironment(outside, {
    home: "/tmp/empty-home",
    dataDir: "/tmp/copy/data",
    url: "http://localhost:5555",
    lookKey: "look",
    doorSecret: "door",
  });
  expect(env).toEqual({
    PATH: "/usr/bin",
    LANG: "sv_SE.UTF-8",
    NODE_EXTRA_CA_CERTS: "/etc/ca.pem",
    HOME: "/tmp/empty-home",
    DATA_DIR: "/tmp/copy/data",
    BETTER_AUTH_URL: "http://localhost:5555",
    DEV_DOOR_SECRET: "door",
    SMITHABLE_LOOK_KEY: "look",
    NO_COLOR: "1",
  });
});

test("the data as it was: the snapshot taken before the next change, while it is kept", () => {
  const dir = tempDir("old-version-");
  expect(git(dir, ["init", "-q"]).ok).toBe(true);
  writeFileSync(join(dir, "smithable.yml"), "smithable: 0.1\n");
  const first = commit(dir, "smithable: start\n\nSmithable-Snapshot: none");
  writeFileSync(join(dir, "smithable.yml"), "smithable: 0.1\n# a phone\n");
  const second = commit(dir, "smithable: a phone\n\nSmithable-Snapshot: 20261113-031500000");
  // Not kept: nothing to copy, so the old version gets samples.
  expect(snapshotAfter(dir, first)).toBeUndefined();
  mkdirSync(join(dir, "data", ".smithable", "snapshots"), { recursive: true });
  writeFileSync(join(dir, "data", ".smithable", "snapshots", "20261113-031500000.db"), "");
  expect(snapshotAfter(dir, first)).toBe(
    join(dir, "data", ".smithable", "snapshots", "20261113-031500000.db"),
  );
  // The newest change is the app as it is now: no view of its own.
  expect(snapshotAfter(dir, second)).toBeUndefined();
});

test("closing leaves no worktree, folder or record behind, and touches nothing else", () => {
  const dir = tempDir("old-version-");
  expect(git(dir, ["init", "-q"]).ok).toBe(true);
  writeFileSync(join(dir, "smithable.yml"), "smithable: 0.1\n");
  const sha = commit(dir, "start");
  const folder = join(cache, "smithable", "old-versions", `${"a".repeat(12)}-${sha.slice(0, 12)}`);
  mkdirSync(join(cache, "smithable", "old-versions"), { recursive: true });
  expect(git(dir, ["worktree", "add", "--detach", folder, sha]).ok).toBe(true);
  mkdirSync(`${folder}.home`);
  mkdirSync(join(dir, "data", ".smithable"), { recursive: true });
  writeFileSync(
    join(dir, "data", ".smithable", "old-version.json"),
    JSON.stringify({
      commit: sha,
      folder,
      home: `${folder}.home`,
      port: 1,
      data: "samples",
      pictures: "none",
    }),
  );
  expect(openVersion(dir)?.commit).toBe(sha);
  closeOldVersion(dir);
  expect(existsSync(folder)).toBe(false);
  expect(existsSync(`${folder}.home`)).toBe(false);
  expect(openVersion(dir)).toBeUndefined();
  expect(git(dir, ["worktree", "list"]).out.trim().split("\n")).toHaveLength(1);
  expect(existsSync(join(dir, "smithable.yml"))).toBe(true);
});

test("closing never removes a folder outside Studio's own, whatever the record says", () => {
  const dir = tempDir("old-version-");
  expect(git(dir, ["init", "-q"]).ok).toBe(true);
  const victim = tempDir("victim-");
  const named = join(victim, `${"b".repeat(12)}-${"c".repeat(12)}`);
  mkdirSync(named);
  mkdirSync(join(dir, "data", ".smithable"), { recursive: true });
  const escaping = join(cache, "smithable", "old-versions", "..", "..", "..", named.slice(1));
  for (const folder of [named, escaping]) {
    writeFileSync(
      join(dir, "data", ".smithable", "old-version.json"),
      JSON.stringify({
        commit: "x",
        folder,
        home: `${folder}.home`,
        port: 1,
        data: "samples",
        pictures: "none",
      }),
    );
    closeOldVersion(dir);
    expect(existsSync(named)).toBe(true);
  }
});
