import { expect, test } from "vitest";

// The kit's zoned.ts is a template copied into apps; imported by address so the build's
// rootDir does not take it in.
interface Zoned {
  wallTime(date: Date, timeZone?: string): string;
  instant(wall: string, timeZone?: string): Date;
}
const template = "../templates/src/kit/zoned.ts";
const { instant, wallTime } = (await import(/* @vite-ignore */ template)) as Zoned;
const tz = "Europe/Mariehamn"; // UTC+2 in winter, +3 in summer

test("a wall time and its instant round-trip in the app's zone, whatever zone runs the code", () => {
  const at = instant("2026-09-30T09:30", tz);
  expect(at.toISOString()).toBe("2026-09-30T06:30:00.000Z");
  expect(wallTime(at, tz)).toBe("2026-09-30T09:30");
  expect(instant("2026-01-15T09:30", tz).toISOString()).toBe("2026-01-15T07:30:00.000Z");
});

test("the day clocks go forward: a time that does not exist moves forward by the gap", () => {
  // 29 March 2026: 03:00 local becomes 04:00.
  expect(instant("2026-03-29T02:30", tz).toISOString()).toBe("2026-03-29T00:30:00.000Z");
  expect(instant("2026-03-29T04:30", tz).toISOString()).toBe("2026-03-29T01:30:00.000Z");
  expect(wallTime(instant("2026-03-29T03:30", tz), tz)).toBe("2026-03-29T04:30");
});

test("the day clocks go back: a time that happens twice is the first", () => {
  // 25 October 2026: 04:00 local becomes 03:00, so 03:30 happens twice.
  expect(instant("2026-10-25T03:30", tz).toISOString()).toBe("2026-10-25T00:30:00.000Z");
  expect(instant("2026-10-25T05:00", tz).toISOString()).toBe("2026-10-25T03:00:00.000Z");
});

test("without a time zone, the browser's own is used, as before", () => {
  const at = new Date("2026-09-30T09:30");
  expect(instant("2026-09-30T09:30").getTime()).toBe(at.getTime());
  expect(wallTime(at)).toBe("2026-09-30T09:30");
});
