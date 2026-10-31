import { expect, test } from "vitest";

// The kit's aggregate.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/aggregate.ts";
const kit = (await import(path)) as {
  due<R>(
    rows: R[],
    when: (row: R) => unknown,
    within: { amount: number; unit: "day" | "week" },
    timeZone: string,
    now?: Date,
  ): { row: R; day: string; overdue: boolean }[];
};

test("what is due: up to the end of the span from today in the app's time zone, the overdue first and marked", () => {
  // 23:30 UTC on Saturday 31 October is already Sunday 1 November in Mariehamn.
  const now = new Date("2026-10-31T23:30:00Z");
  const rows = [
    { id: 1, on: "2026-11-08" }, // the 7th day after today: past "within 7 days" (today to the 7th)
    { id: 2, on: "2026-11-07" }, // the last day in it
    { id: 3, on: "2026-10-30" }, // overdue
    { id: 4, on: null }, // no date: left out
    { id: 5, on: new Date("2026-11-01T06:00:00Z") }, // a date-time, by its day in Mariehamn
  ];
  const due = kit.due(rows, (r) => r.on, { amount: 7, unit: "day" }, "Europe/Mariehamn", now);
  expect(due.map((d) => [d.row.id, d.day, d.overdue])).toEqual([
    [3, "2026-10-30", true],
    [5, "2026-11-01", false],
    [2, "2026-11-07", false],
  ]);
  // In UTC it is still Saturday 31 October: the week runs to the 6th, so the 7th is out.
  const utc = kit.due(rows, (r) => r.on, { amount: 1, unit: "week" }, "UTC", now);
  expect(utc.map((d) => d.row.id)).toEqual([3, 5]);
});
