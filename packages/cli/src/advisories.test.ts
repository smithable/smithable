import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  type Advisory,
  affected,
  compareVersions,
  inRange,
  lockedVersions,
  newerPatch,
  readAdvisories,
} from "./advisories.js";
import { published } from "./security.js";
import { tempDir } from "./test-dir.js";

// The advisories of 2026-09-30 and two older ones, as their repositories publish them.
const start: Advisory = {
  id: "GHSA-qx66-fv34-fjm8",
  severity: "critical",
  summary: "Reflected XSS in server-function responses",
  repository: "TanStack/router",
  affects: [
    { name: "@tanstack/start-server-core", range: ">= 1.143.12, < 1.169.39", patched: "1.169.39" },
    { name: "@tanstack/react-start", range: ">= 1.143.12, < 1.168.60", patched: "1.168.60" },
  ],
};
const drizzle: Advisory = {
  id: "GHSA-gpj5-g38j-94v9",
  severity: "high",
  summary: "SQL injection via improperly escaped SQL identifiers",
  repository: "drizzle-team/drizzle-orm",
  affects: [
    { name: "drizzle-orm", range: "<= 0.45.1", patched: "0.45.2" },
    { name: "drizzle-orm", range: "<= 1.0.0-beta.19", patched: "1.0.0-beta.20" },
  ],
};
const vitest: Advisory = {
  id: "GHSA-82fw-gwwq-j7x9",
  severity: "medium",
  summary: "Arbitrary file read",
  repository: "vitest-dev/vitest",
  affects: [
    { name: "vitest", range: ">=v2.1.0, <4.1.11", patched: "4.1.11" },
    { name: "vitest", range: ">=5.0.0-beta.1", patched: "5.0.0-rc.2" },
  ],
};
const organization: Advisory = {
  id: "GHSA-fmh4-wcc4-5jm3",
  severity: "high",
  summary: "Organization invitations can be accepted by an unverified account",
  repository: "better-auth/better-auth",
  affects: [
    { name: "better-auth", range: "< 1.6.11", patched: "1.6.11" },
    { name: "better-auth", range: ">= 1.6.14" },
  ],
};
const versions = (pairs: Record<string, string>) =>
  new Map(Object.entries(pairs).map(([name, version]) => [name, [version]]));

describe("versions and ranges", () => {
  test("versions order as semver says, a pre-release before its release", () => {
    expect(compareVersions("1.168.58", "1.168.60")).toBe(-1);
    expect(compareVersions("1.10.0", "1.9.9")).toBe(1);
    expect(compareVersions("5.0.0-rc.2", "5.0.0")).toBe(-1);
    expect(compareVersions("1.0.0-beta.19", "1.0.0-beta.2")).toBe(1);
    expect(compareVersions("v2.1.0", "2.1")).toBe(0);
    expect(compareVersions("latest", "1.0.0")).toBeUndefined();
  });

  test("a range is read as maintainers write them: commas, spaces, several in a row, single releases", () => {
    expect(inRange("1.7.6", ">= 1.4.0-beta.18, < 1.7.7")).toBe(true);
    expect(inRange("1.7.7", ">= 1.4.0-beta.18, < 1.7.7")).toBe(false);
    expect(inRange("3.1.0", ">=3.0.2 <=3.2.6")).toBe(true);
    expect(inRange("8.3.1", ">=3.0.2 <=3.2.6")).toBe(false);
    const row = ">=4.0.0,<4.0.5,>=4.1.0,<4.1.5,>=4.2.0,<=4.2.2";
    expect([inRange("4.1.2", row), inRange("4.0.7", row), inRange("4.2.2", row)]).toEqual([
      true,
      false,
      true,
    ]);
    expect(inRange("1.169.8", "1.169.5, 1.169.8")).toBe(true);
    expect(inRange("1.169.6", "1.169.5, 1.169.8")).toBe(false);
    expect(inRange("10.0.13", "<= 10.0.12")).toBe(false);
  });

  test("a range that cannot be read is not guessed at", () => {
    expect(inRange("1.0.0", "all versions")).toBeUndefined();
    expect(inRange("1.0.0", "")).toBeUndefined();
    expect(inRange("1.0.0", ">= 1.0.0, 2.0.0")).toBeUndefined();
  });
});

describe("affected", () => {
  test("the pins of the morning of 2026-10-04 are found, the installed sub-package too, and the fixed ones are not", () => {
    const old = versions({
      "@tanstack/react-start": "1.168.58",
      "@tanstack/start-server-core": "1.169.37",
    });
    expect(affected(old, [start])).toEqual([
      "@tanstack/react-start@1.168.58: GHSA-qx66-fv34-fjm8 (critical) Reflected XSS in server-function responses; fixed in 1.168.60",
      "@tanstack/start-server-core@1.169.37: GHSA-qx66-fv34-fjm8 (critical) Reflected XSS in server-function responses; fixed in 1.169.39",
    ]);
    const fixed = versions({
      "@tanstack/react-start": "1.168.60",
      "@tanstack/start-server-core": "1.169.39",
    });
    expect(affected(fixed, [start])).toEqual([]);
  });

  test("a range written loosely does not reach a version that has the fix", () => {
    // "<= 1.0.0-beta.19" is the beta line; 0.45.3 has the older line's fix.
    expect(affected(versions({ "drizzle-orm": "0.45.3" }), [drizzle])).toEqual([]);
    expect(affected(versions({ "drizzle-orm": "0.45.1" }), [drizzle])).toEqual([
      "drizzle-orm@0.45.1: GHSA-gpj5-g38j-94v9 (high) SQL injection via improperly escaped SQL identifiers; fixed in 0.45.2",
    ]);
    expect(affected(versions({ "drizzle-orm": "1.0.0-beta.5" }), [drizzle])).toHaveLength(1);
    // ">= 5.0.0-beta.1", fixed in 5.0.0-rc.2, is not about 5.0.2.
    expect(affected(versions({ vitest: "5.0.2" }), [vitest])).toEqual([]);
    expect(affected(versions({ vitest: "5.0.0-rc.1" }), [vitest])).toHaveLength(1);
    expect(affected(versions({ vitest: "3.2.0" }), [vitest])).toHaveLength(1);
  });

  test("no fixed version and an unreadable range are both said", () => {
    expect(affected(versions({ "better-auth": "1.7.7" }), [organization])).toEqual([
      "better-auth@1.7.7: GHSA-fmh4-wcc4-5jm3 (high) Organization invitations can be accepted by an unverified account; no fixed version yet",
    ]);
    expect(affected(versions({ "better-auth": "1.6.12" }), [organization])).toEqual([]);
    const vague = { ...start, affects: [{ name: "srvx", range: "all versions" }] };
    expect(affected(versions({ srvx: "1.0.5" }), [vague])[0]).toContain(
      'its range "all versions" could not be read, so check it by hand',
    );
  });
});

test("a lockfile gives every installed version, of dependencies' dependencies too", () => {
  const lock = `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      nodemailer:
        specifier: 10.0.14
        version: 10.0.14
packages:
  '@tanstack/start-server-core@1.169.39':
    resolution: {integrity: sha512-x}
  nodemailer@10.0.14:
    resolution: {integrity: sha512-y}
  seroval@1.6.8:
    resolution: {integrity: sha512-z}
snapshots:
  '@tanstack/react-start@1.168.60(react@19.3.0)':
    dependencies:
      seroval: 1.6.8
  seroval@1.5.0: {}
`;
  expect(Object.fromEntries(lockedVersions(lock))).toEqual({
    "@tanstack/start-server-core": ["1.169.39"],
    nodemailer: ["10.0.14"],
    seroval: ["1.6.8", "1.5.0"],
    "@tanstack/react-start": ["1.168.60"],
  });
});

test("the newest patch of the same line, never a pre-release or another line", () => {
  const released = ["10.0.12", "10.0.13", "10.0.14", "10.1.0", "10.0.15-beta.1", "11.0.0"];
  expect(newerPatch("10.0.12", released)).toBe("10.0.14");
  expect(newerPatch("10.0.14", released)).toBeUndefined();
});

/** The registry and GitHub, answering for two packages of one repository and one that fails. */
const web = (limit = false) =>
  (async (input: string | URL | Request) => {
    const url = String(input);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (url.startsWith("https://registry.npmjs.org/@tanstack/"))
      return json({ repository: { url: "git+https://github.com/TanStack/router.git" } });
    if (url.startsWith("https://registry.npmjs.org/clsx/"))
      return json({ repository: "lukeed/clsx" });
    if (url.startsWith("https://registry.npmjs.org/")) return json({}, 404);
    if (url.includes("/repos/TanStack/router/security-advisories"))
      return limit
        ? json({ message: "API rate limit exceeded" }, 403)
        : json([
            {
              ghsa_id: start.id,
              severity: start.severity,
              summary: start.summary,
              vulnerabilities: [
                ...start.affects.map((a) => ({
                  package: { ecosystem: "npm", name: a.name },
                  vulnerable_version_range: a.range,
                  patched_versions: a.patched,
                })),
                { package: { ecosystem: "pip", name: "other" }, vulnerable_version_range: "< 1" },
              ],
            },
          ]);
    return json([], 200);
  }) as typeof fetch;

describe("readAdvisories", () => {
  const packages = {
    "@tanstack/react-start": "1.168.58",
    "@tanstack/react-router": "1.170.39",
    missing: "1.0.0",
  };

  test("one list per repository, npm packages only; what could not be read is named", async () => {
    const read = await readAdvisories(packages, { fetch: web() });
    expect(read.advisories).toEqual([start]);
    expect(read.unread).toEqual(["missing"]);
  });

  test("GitHub's hourly limit leaves the repository unread, not clean", async () => {
    const read = await readAdvisories(packages, { fetch: web(true) });
    expect(read.advisories).toEqual([]);
    expect(read.unread).toEqual(["TanStack/router", "missing"]);
  });
});

describe("the check in `smithable security`", () => {
  const app = (dependencies: Record<string, string>) => {
    const dir = tempDir("smithable-advisories-");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies }));
    return dir;
  };
  const lists = (advisories: Advisory[], unread: string[] = []) => {
    let calls = 0;
    const read = async () => {
      calls++;
      return { advisories, unread };
    };
    return Object.assign(read, { calls: () => calls });
  };

  test("a hole in a pinned version fails it, with the fix; the lists are kept for the next run", async () => {
    const dir = app({ "@tanstack/react-start": "1.168.58" });
    const read = lists([start]);
    const first = await published(dir, read, {});
    expect(first).toMatchObject({ ok: false, what: "Dependencies, at their source" });
    expect(first.findings).toEqual([
      "@tanstack/react-start@1.168.58: GHSA-qx66-fv34-fjm8 (critical) Reflected XSS in server-function responses; fixed in 1.168.60",
    ]);
    expect((await published(dir, read, {})).findings).toEqual(first.findings);
    expect(read.calls()).toBe(1);
  });

  test("an accepted advisory is said with its reason and fails nothing", async () => {
    const dir = app({ "better-auth": "1.7.7" });
    const result = await published(dir, lists([organization]), {
      [organization.id]: "it is in a plugin the app does not use",
    });
    expect(result).toMatchObject({ ok: true, findings: [] });
    expect(result.notes).toEqual([
      "Accepted, since it is in a plugin the app does not use: better-auth@1.7.7: GHSA-fmh4-wcc4-5jm3 (high) Organization invitations can be accepted by an unverified account",
    ]);
  });

  test("a list that could not be read is not a pass, and is read again next time", async () => {
    const dir = app({ "@tanstack/react-start": "1.168.60" });
    const read = lists([], ["TanStack/router"]);
    const result = await published(dir, read, {});
    expect(result.ok).toBe(false);
    expect(result.findings[0]).toContain("The advisory lists of TanStack/router could not be read");
    expect(result.findings[0]).toContain("GITHUB_TOKEN");
    await published(dir, read, {});
    expect(read.calls()).toBe(2);
  });

  test("GitHub's hourly limit is said as such, with when it opens again", async () => {
    const dir = app({ "@tanstack/react-start": "1.168.60" });
    const at = Date.now() + 25 * 60_000;
    const read = async () => ({ advisories: [], unread: ["TanStack/router"], limitedUntil: at });
    const result = await published(dir, read, {});
    expect(result.ok).toBe(false);
    expect(result.findings[0]).toContain(
      "GitHub allowed no more reads from this machine this hour",
    );
    expect(result.findings[0]).toContain(
      `run again after ${new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
    );
  });
});

test("the lists are kept a day on the machine, so a second read asks GitHub nothing", async () => {
  const dir = tempDir("smithable-advisories-cache-");
  let github = 0;
  const fetchFn = (async (url: string) => {
    if (String(url).startsWith("https://registry.npmjs.org/"))
      return new Response(
        JSON.stringify({ repository: { url: "git+https://github.com/TanStack/router.git" } }),
      );
    github++;
    return new Response(JSON.stringify([]), { headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  const packages = { "@tanstack/react-start": "1.168.60" };
  const first = await readAdvisories(packages, { fetch: fetchFn, cacheDir: dir });
  const second = await readAdvisories(packages, { fetch: fetchFn, cacheDir: dir });
  expect(first.unread).toEqual([]);
  expect(second.unread).toEqual([]);
  expect(github).toBe(1);
});
