import { expect, test } from "vitest";
import { zoneOf } from "./TimeZoneCheck";

test("the app's time zone is read from its block, not from another one's", () => {
  expect(zoneOf("smithable: 0.1\napp:\n  name: Notes\n  timezone: Europe/Oslo\nmodels: {}\n")).toBe(
    "Europe/Oslo",
  );
  expect(zoneOf('app:\n  name: Notes\n  timezone: "Etc/GMT+2"\n')).toBe("Etc/GMT+2");
  expect(zoneOf("app:\n  name: Notes\nmodels:\n  Note:\n    timezone: nope\n")).toBeUndefined();
  expect(zoneOf(undefined)).toBeUndefined();
});
