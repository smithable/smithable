import { expect, test } from "vitest";

// The kit's limit.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/limit.ts";
const kit = (await import(path)) as {
  count(key: string, limit: { max: number; seconds: number }, what: string, now?: number): void;
  TooMany: new (what: string) => Error;
  address(headers: { get(name: string): string | null }): string;
};
const headers = (given: Record<string, string>) => ({ get: (name: string) => given[name] ?? null });

test("the address is the rightmost forwarded one, which a client behind one proxy cannot choose", () => {
  expect(kit.address(headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.2" }))).toBe("10.0.0.2");
  expect(kit.address(headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
  expect(kit.address(headers({}))).toBe("unknown");
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
