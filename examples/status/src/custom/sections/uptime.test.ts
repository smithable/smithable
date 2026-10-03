import { expect, test } from "vitest";
import { uptime } from "./uptime";

const now = Date.parse("2026-10-03T12:00:00Z");
const at = (iso: string) => Date.parse(`${iso}Z`);

test("a day without incidents is all up; an incident counts on the days it lasted", () => {
  const { days, up } = uptime(
    [{ from: at("2026-10-01T23:30:00"), to: at("2026-10-02T00:30:00") }],
    now,
    3,
  );
  expect(days).toEqual([
    { date: "2026-10-01", minutes: 30 },
    { date: "2026-10-02", minutes: 30 },
    { date: "2026-10-03", minutes: 0 },
  ]);
  // An hour down in two and a half days.
  expect(up).toBeCloseTo(1 - 1 / 60, 4);
});

test("overlapping incidents count once, an open one runs to now, older ones are left out", () => {
  const { days } = uptime(
    [
      { from: at("2026-10-03T10:00:00"), to: at("2026-10-03T11:00:00") },
      { from: at("2026-10-03T10:30:00"), to: null },
      { from: at("2026-06-01T10:00:00"), to: at("2026-06-01T11:00:00") },
    ],
    now,
    3,
  );
  expect(days.map((d) => d.minutes)).toEqual([0, 0, 120]);
});
