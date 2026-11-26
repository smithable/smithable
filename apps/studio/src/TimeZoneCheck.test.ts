import { expect, test } from "vitest";
import { sameClock, zoneOf } from "./TimeZoneCheck";

test("the app's time zone is read from its block, not from another one's", () => {
  expect(zoneOf("smithable: 0.1\napp:\n  name: Notes\n  timezone: Europe/Oslo\nmodels: {}\n")).toBe(
    "Europe/Oslo",
  );
  expect(zoneOf('app:\n  name: Notes\n  timezone: "Etc/GMT+2"\n')).toBe("Etc/GMT+2");
  expect(zoneOf("app:\n  name: Notes\nmodels:\n  Note:\n    timezone: nope\n")).toBeUndefined();
  expect(zoneOf("app:\r\n  name: Notes\r\n\r\n  # where it is\r\n  timezone: Asia/Tokyo\r\n")).toBe(
    "Asia/Tokyo",
  );
  expect(zoneOf("app:\n  texts:\n    timezone: nope\n  name: Notes\n")).toBeUndefined();
  expect(zoneOf(undefined)).toBeUndefined();
});

test("two names for one clock are the same zone; a zone an hour off, or one keeping summer time apart, is not", () => {
  const from = new Date(Date.UTC(2026, 10, 26));
  expect(sameClock("Europe/Mariehamn", "Europe/Helsinki", from)).toBe(true);
  expect(sameClock("Europe/Stockholm", "Europe/Helsinki", from)).toBe(false);
  // Same offset in winter, not in summer.
  expect(sameClock("Europe/Helsinki", "Africa/Cairo", new Date(Date.UTC(2022, 0, 1)))).toBe(false);
  expect(sameClock("Europe/Oslo", "Europe/Oslo", from)).toBe(true);
  expect(sameClock("Nowhere/Land", "Europe/Oslo", from)).toBe(false);
});
