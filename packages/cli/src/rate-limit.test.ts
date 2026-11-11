// The production server's limit on changes (adapter-tanstack/templates/server.mjs): per address,
// and a list of addresses that cannot grow without end.

import { readFileSync } from "node:fs";
import { isIPv4, isIPv6 } from "node:net";
import { expect, test } from "vitest";

const source = readFileSync(
  new URL("../../adapter-tanstack/templates/server.mjs", import.meta.url),
  "utf8",
);
const start = source.indexOf("function rateLimiter(");
const body = source.slice(start, source.indexOf("\n}\n", start) + 2);
const rateLimiter = new Function(`${body}; return rateLimiter;`)() as (
  burst: number,
  size: number,
) => ((address: string, now?: number) => boolean) & { size?: number };

test("a burst, then one a second", () => {
  const limited = rateLimiter(3, 100);
  expect([1, 2, 3, 4].map(() => limited("a", 0))).toEqual([true, true, true, false]);
  expect(limited("a", 1)).toBe(true);
  expect(limited("b", 1)).toBe(true);
});

test("an address seen once is forgotten when the list is full, and a flood keeps the newest", () => {
  // The map the limiter keeps, to see how many addresses it holds.
  let kept = new Map();
  const RealMap = Map;
  globalThis.Map = class extends RealMap {
    constructor() {
      super();
      kept = this;
    }
  } as MapConstructor;
  const limited = rateLimiter(60, 10);
  globalThis.Map = RealMap;
  // Ten addresses, each one change, then quiet for a minute: full again, so forgotten.
  for (let i = 0; i < 10; i++) limited(`one-${i}`, 0);
  limited("late", 61);
  expect(kept.size).toBe(1);
  // A thousand addresses at once: never more than ten kept, and the newest is limited normally.
  for (let i = 0; i < 1000; i++) {
    limited(`flood-${i}`, 62);
    expect(kept.size).toBeLessThanOrEqual(10);
  }
  expect(kept.has("flood-999")).toBe(true);
  for (let i = 0; i < 59; i++) limited("busy", 63);
  expect(limited("busy", 63)).toBe(true);
  expect(limited("busy", 63)).toBe(false);
});

// The same file's addressKey: an IPv6 address counts by its /64, as the kit's own limits count it.
const keyStart = source.indexOf("function addressKey(");
const keyBody = source.slice(keyStart, source.indexOf("\n}\n", keyStart) + 2);
const addressKey = new Function("isIPv4", "isIPv6", `${keyBody}; return addressKey;`)(
  isIPv4,
  isIPv6,
) as (address: string) => string;

test("an IPv6 address is counted by its /64; an IPv4 one, also written IPv4-mapped, by itself", () => {
  expect(addressKey("2001:db8:1:2:aaaa::1")).toBe(
    addressKey("2001:0db8:0001:0002:bbbb:cccc:dddd:eeee"),
  );
  expect(addressKey("2001:db8:1:2::1")).not.toBe(addressKey("2001:db8:1:3::1"));
  expect(addressKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
  for (const mapped of [
    "::ffff:203.0.113.9",
    "::FFFF:cb00:7109",
    "[::ffff:203.0.113.9]:443",
    "203.0.113.9:443",
  ])
    expect(addressKey(mapped), mapped).toBe("203.0.113.9");
  expect(addressKey("203.0.113.9")).toBe("203.0.113.9");
  // A port or brackets do not make another address; ::1 is IPv6 like the rest.
  expect(addressKey("[2001:db8:1:2::1]:443")).toBe(addressKey("2001:db8:1:2::9"));
  expect(addressKey("::1")).toBe("0:0:0:0::/64");
  expect(addressKey("")).toBe("");
});
