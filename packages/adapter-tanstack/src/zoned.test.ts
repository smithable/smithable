import { expect, test } from "vitest";

// The kit's zoned.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/zoned.ts";
const kit = (await import(path)) as {
  wallTime(instant: Date, timeZone?: string): string;
  instantOf(wall: string, timeZone?: string): Date;
};
const ZONE = "Europe/Mariehamn"; // EET, EEST in summer (UTC+2, +3)

test("a wall time in the app's zone is the same instant whoever reads it", () => {
  expect(kit.instantOf("2026-09-30T09:00", ZONE).toISOString()).toBe("2026-09-30T06:00:00.000Z");
  expect(kit.wallTime(new Date("2026-09-30T06:00:00Z"), ZONE)).toBe("2026-09-30T09:00");
  expect(kit.instantOf("2026-01-15T09:00", ZONE).toISOString()).toBe("2026-01-15T07:00:00.000Z");
});

test("around the change to summer time (29 March 2026) and back (25 October 2026)", () => {
  // Before and after the spring change at 03:00 local (01:00 UTC).
  expect(kit.instantOf("2026-03-29T02:30", ZONE).toISOString()).toBe("2026-03-29T00:30:00.000Z");
  expect(kit.instantOf("2026-03-29T04:30", ZONE).toISOString()).toBe("2026-03-29T01:30:00.000Z");
  // 03:30 does not exist that night: read with the offset before the change.
  expect(kit.wallTime(kit.instantOf("2026-03-29T03:30", ZONE), ZONE)).toBe("2026-03-29T04:30");
  // In the autumn 03:30 happens twice; each instant shows its own wall time.
  expect(kit.wallTime(new Date("2026-10-25T00:30:00Z"), ZONE)).toBe("2026-10-25T03:30");
  expect(kit.wallTime(new Date("2026-10-25T01:30:00Z"), ZONE)).toBe("2026-10-25T03:30");
  expect(kit.instantOf("2026-10-25T05:00", ZONE).toISOString()).toBe("2026-10-25T03:00:00.000Z");
  // Every hour of both change days goes there and back.
  for (const day of ["2026-03-29", "2026-10-25"])
    for (let h = 0; h < 24; h++) {
      const wall = `${day}T${String(h).padStart(2, "0")}:15`;
      if (day === "2026-03-29" && h === 3) continue; // skipped by the change
      expect(kit.wallTime(kit.instantOf(wall, ZONE), ZONE)).toBe(wall);
    }
});
