import { expect, test } from "vitest";
import { heldProgress, progress } from "./Making";

test("the bar follows the usual time, slows past it, and is never full before the app is there", () => {
  expect(progress(0, 20_000)).toBe(0);
  expect(progress(10_000, 20_000)).toBeCloseTo(0.45);
  expect(progress(20_000, 20_000)).toBeCloseTo(0.9);
  expect(progress(40_000, 20_000)).toBeGreaterThan(0.9);
  expect(progress(10 * 60_000, 20_000)).toBeLessThan(1);
  // A clock behind the server's start time does not go backwards.
  expect(progress(-500, 20_000)).toBe(0);
});

test("while questions wait the bar holds at half; answered, it goes on from half", () => {
  expect(heldProgress(5_000, 20_000, undefined, true)).toBeCloseTo(0.225);
  expect(heldProgress(60_000, 20_000, undefined, true)).toBe(0.5);
  // Answered after a minute: half at once, then along the usual time from there.
  expect(heldProgress(60_000, 20_000, 60_000)).toBe(0.5);
  expect(heldProgress(70_000, 20_000, 60_000)).toBeCloseTo(0.725);
  expect(heldProgress(10 * 60_000, 20_000, 60_000)).toBeLessThan(1);
  // No questions: the bar as before.
  expect(heldProgress(10_000, 20_000)).toBeCloseTo(0.45);
});
