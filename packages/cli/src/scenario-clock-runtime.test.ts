import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  delete (globalThis as { appClockOffset?: number }).appClockOffset;
  delete (globalThis as { appClockFixed?: number }).appClockFixed;
  vi.useRealTimers();
});
function clock(dev: boolean) {
  const source = stripTypeScriptTypes(
    readFileSync(
      new URL("../../adapter-tanstack/templates/src/kit/now.ts", import.meta.url),
      "utf8",
    )
      .replaceAll("import.meta.env?.DEV", "DEV")
      .replace(/\bexport /g, ""),
  );
  return new Function("DEV", `${source};return {now,setClockAt,setClockOffset};`)(dev) as {
    now: () => Date;
    setClockAt: (ms: number) => void;
    setClockOffset: (ms: number) => void;
  };
}
test("development replay freezes exact time and offset zero resumes the real clock", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-03T10:00:00Z"));
  const kit = clock(true);
  kit.setClockAt(Date.parse("2026-10-29T10:00:00Z"));
  vi.advanceTimersByTime(10000);
  expect(kit.now().toISOString()).toBe("2026-10-29T10:00:00.000Z");
  kit.setClockOffset(0);
  expect(kit.now().toISOString()).toBe("2026-11-03T10:00:10.000Z");
});
test("production ignores development clock offsets and frozen times", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-03T10:00:00Z"));
  const kit = clock(false);
  kit.setClockAt(0);
  kit.setClockOffset(1000000);
  expect(kit.now().toISOString()).toBe("2026-11-03T10:00:00.000Z");
});
