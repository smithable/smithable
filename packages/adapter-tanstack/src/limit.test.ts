import { afterEach, expect, test, vi } from "vitest";

// The connection's own address, as TanStack Start gives it inside a request.
vi.mock("@tanstack/react-start/server", () => ({ getRequestIP: () => "9.9.9.9" }));
afterEach(() => {
  delete process.env.TRUST_PROXY;
});

// The kit's limit.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/limit.ts";
const kit = (await import(path)) as {
  count(key: string, limit: { max: number; seconds: number }, what: string, now?: number): void;
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

test("full of live counts, the limit keeps them and refuses a new key until the window ends", () => {
  const limit = { max: 1, seconds: 60 };
  const now = 5_000_000;
  for (let i = 0; i < 50_000; i++) kit.count(`flood:${i}`, limit, "changes", now);
  // A live count is not dropped to make room: its limit still holds.
  expect(() => kit.count("flood:0", limit, "changes", now + 1000)).toThrow(kit.TooMany);
  expect(() => kit.count("newcomer", limit, "changes", now + 1000)).toThrow(kit.TooMany);
  // Once the window is over the expired counts go, and a new key is counted.
  expect(() => kit.count("newcomer", limit, "changes", now + 61_000)).not.toThrow();
});
