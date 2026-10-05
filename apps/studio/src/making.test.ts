import { expect, test } from "vitest";
import { progress } from "./Making";

test("the bar follows the usual time, slows past it, and is never full before the app is there", () => {
  expect(progress(0, 20_000)).toBe(0);
  expect(progress(10_000, 20_000)).toBeCloseTo(0.45);
  expect(progress(20_000, 20_000)).toBeCloseTo(0.9);
  expect(progress(40_000, 20_000)).toBeGreaterThan(0.9);
  expect(progress(10 * 60_000, 20_000)).toBeLessThan(1);
  // A clock behind the server's start time does not go backwards.
  expect(progress(-500, 20_000)).toBe(0);
});
