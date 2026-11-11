import { afterEach, expect, test, vi } from "vitest";

// The connection's own address, as TanStack Start gives it inside a request.
vi.mock("@tanstack/react-start/server", () => ({ getRequestIP: () => "9.9.9.9" }));
afterEach(() => {
  delete process.env.TRUST_PROXY;
});

// The kit's limit.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/limit.ts";
const kit = (await import(path)) as {
  count(
    key: string,
    limit: { max: number; seconds: number },
    what: string,
    now?: number,
    person?: boolean,
  ): void;
  TooMany: new (what: string) => Error;
  address(headers: { get(name: string): string | null }): string;
};
const headers = (given: Record<string, string>) => ({ get: (name: string) => given[name] ?? null });

test("the address is the connection's own: a forwarded one is believed only behind a trusted proxy", () => {
  // Without TRUST_PROXY a client could name any address with a header, and escape the limits.
  expect(kit.address(headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.2" }))).toBe("9.9.9.9");
  expect(kit.address(headers({ "x-real-ip": "5.6.7.8" }))).toBe("9.9.9.9");
  // Behind the proxy, its own hop: the rightmost, which a client behind it cannot choose.
  process.env.TRUST_PROXY = "1";
  expect(kit.address(headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.2" }))).toBe("10.0.0.2");
  expect(kit.address(headers({}))).toBe("9.9.9.9");
});

test("the limit counts within a window, refuses beyond it, and starts over after it", () => {
  const limit = { max: 3, seconds: 60 };
  const at = (seconds: number) => 1_000_000 + seconds * 1000;
  for (let i = 0; i < 3; i++) kit.count("write:a", limit, "changes", at(i));
  expect(() => kit.count("write:a", limit, "changes", at(10))).toThrow(
    "Too many changes in a short time. Wait a minute and try again.",
  );
  // Another key is counted on its own; the first is free again after its window.
  expect(() => kit.count("write:b", limit, "changes", at(10))).not.toThrow();
  expect(() => kit.count("write:a", limit, "changes", at(61))).not.toThrow();
  // A refusal is not counted: the window keeps its start.
  expect(() => kit.count("write:a", limit, "changes", at(62))).not.toThrow();
  expect(() => kit.count("write:a", limit, "changes", at(63))).not.toThrow();
  expect(() => kit.count("write:a", limit, "changes", at(64))).toThrow(kit.TooMany);
});

test("full of strangers' counts, a newcomer pushes out a count of one; a count above one stays", () => {
  const limit = { max: 2, seconds: 60 };
  const now = 5_000_000;
  // One stranger near the limit, then a flood of new keys, each counted once.
  kit.count("near", limit, "changes", now);
  kit.count("near", limit, "changes", now);
  for (let i = 0; i < 50_000; i++) kit.count(`flood:${i}`, limit, "changes", now + 1);
  // A newcomer is counted: room is made among the counts of one.
  expect(() => kit.count("newcomer", limit, "changes", now + 2)).not.toThrow();
  // The count at its limit was not dropped: it still refuses.
  expect(() => kit.count("near", limit, "changes", now + 3)).toThrow(kit.TooMany);
});

test("a flood counted twice each does not refuse a newcomer either: the lowest counts make room", () => {
  const limit = { max: 5, seconds: 3600 };
  const now = 20_000_000;
  for (let i = 0; i < 50_000; i++) {
    kit.count(`twice:${i}`, limit, "changes", now);
    kit.count(`twice:${i}`, limit, "changes", now);
  }
  expect(() => kit.count("newcomer-2", limit, "changes", now + 1)).not.toThrow();
});

test("a count at its own limit outlasts a flood whose counts are higher but further from theirs", () => {
  const now = 30_000_000;
  // A mailbox's codes at their limit of 5.
  for (let i = 0; i < 5; i++) kit.count("code:victim", { max: 5, seconds: 3600 }, "codes", now);
  // A flood of keys counted 10 times each against a limit of 60.
  for (let i = 0; i < 50_000; i++)
    for (let j = 0; j < 10; j++)
      kit.count(`api-nokey:${i}`, { max: 60, seconds: 3600 }, "requests", now);
  kit.count("newcomer-3", { max: 5, seconds: 3600 }, "codes", now + 1);
  // The mailbox's limit still holds.
  expect(() => kit.count("code:victim", { max: 5, seconds: 3600 }, "codes", now + 2)).toThrow(
    kit.TooMany,
  );
});

test("a signed-in person's count is kept apart: strangers filling theirs never refuse a person", () => {
  const limit = { max: 1, seconds: 3600 };
  const now = 9_000_000;
  for (let i = 0; i < 50_000; i++)
    kit.count(`stranger:${i}`, { max: 5, seconds: 3600 }, "changes", now);
  expect(() => kit.count("write:person", limit, "changes", now + 1, true)).not.toThrow();
  expect(() => kit.count("write:person", limit, "changes", now + 2, true)).toThrow(kit.TooMany);
});

test("an IPv6 address counts by its /64; an IPv4 one, also written IPv4-mapped, by itself", () => {
  process.env.TRUST_PROXY = "1";
  const of = (address: string) => kit.address(headers({ "x-forwarded-for": address }));
  expect(of("2001:db8:1:2:aaaa::1")).toBe(of("2001:0db8:0001:0002:bbbb:cccc:dddd:eeee"));
  expect(of("2001:db8:1:2::1")).not.toBe(of("2001:db8:1:3::1"));
  expect(of("2001:db8::1")).toBe("2001:db8:0:0::/64");
  for (const mapped of [
    "::ffff:203.0.113.9",
    "::FFFF:cb00:7109",
    "[::ffff:203.0.113.9]:443",
    "203.0.113.9:443",
  ])
    expect(of(mapped), mapped).toBe("203.0.113.9");
  expect(of("203.0.113.9")).toBe("203.0.113.9");
  // A port or brackets do not make another address; ::1 is IPv6 like the rest.
  expect(of("[2001:db8:1:2::1]:443")).toBe(of("2001:db8:1:2::9"));
  expect(of("::1")).toBe("0:0:0:0::/64");
});
