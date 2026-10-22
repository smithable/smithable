import { expect, test } from "vitest";

// The kit's clock.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/clock.ts";
type Clock = { every: string; at: string } | { cron: string };
const kit = (await import(path)) as {
  names(clock: Clock, wall: string): boolean;
  latestDue(clock: Clock, since: Date, now: Date, timeZone?: string): string | undefined;
};
const ZONE = "Europe/Mariehamn"; // EET, EEST in summer (UTC+2, +3)

test("every names its day and time: a weekday, the first of a week or a month, a weekday's name", () => {
  // Thursday 22 October 2026.
  expect(kit.names({ every: "day", at: "08:00" }, "2026-10-22T08:00")).toBe(true);
  expect(kit.names({ every: "day", at: "08:00" }, "2026-10-22T08:01")).toBe(false);
  expect(kit.names({ every: "weekday", at: "08:00" }, "2026-10-22T08:00")).toBe(true);
  expect(kit.names({ every: "weekday", at: "08:00" }, "2026-10-24T08:00")).toBe(false);
  expect(kit.names({ every: "week", at: "08:00" }, "2026-10-26T08:00")).toBe(true);
  expect(kit.names({ every: "month", at: "06:00" }, "2026-11-01T06:00")).toBe(true);
  expect(kit.names({ every: "month", at: "06:00" }, "2026-11-02T06:00")).toBe(false);
  expect(kit.names({ every: "thursday", at: "17:30" }, "2026-10-22T17:30")).toBe(true);
  expect(kit.names({ every: "friday", at: "17:30" }, "2026-10-22T17:30")).toBe(false);
});

test("a cron expression: lists, ranges, steps, either day field, Sunday as 0 or 7", () => {
  expect(kit.names({ cron: "0 6 25 * *" }, "2026-10-25T06:00")).toBe(true);
  expect(kit.names({ cron: "0 6 25 * *" }, "2026-10-24T06:00")).toBe(false);
  expect(kit.names({ cron: "*/15 8-18 * * 1-5" }, "2026-10-22T09:45")).toBe(true);
  expect(kit.names({ cron: "*/15 8-18 * * 1-5" }, "2026-10-22T09:50")).toBe(false);
  expect(kit.names({ cron: "0,30 9 * * *" }, "2026-10-22T09:30")).toBe(true);
  expect(kit.names({ cron: "0 8-18/2 * * *" }, "2026-10-22T10:00")).toBe(true);
  expect(kit.names({ cron: "0 8-18/2 * * *" }, "2026-10-22T11:00")).toBe(false);
  // The 1st of the month or any Monday.
  expect(kit.names({ cron: "0 7 1 * 1" }, "2026-10-26T07:00")).toBe(true);
  expect(kit.names({ cron: "0 7 * * 7" }, "2026-10-25T07:00")).toBe(true);
  expect(kit.names({ cron: "0 7 * * 0" }, "2026-10-25T07:00")).toBe(true);
  // A step on "*" counts from the field's first value: odd days of the month, from the 1st.
  expect(kit.names({ cron: "0 0 */2 * *" }, "2026-10-01T00:00")).toBe(true);
  expect(kit.names({ cron: "0 0 */2 * *" }, "2026-10-02T00:00")).toBe(false);
  expect(kit.names({ cron: "0 0 1 */3 *" }, "2026-04-01T00:00")).toBe(true);
  // A start with a step runs to the field's last value: 5, 20, 35, 50.
  expect(kit.names({ cron: "5/15 * * * *" }, "2026-10-22T09:35")).toBe(true);
  expect(kit.names({ cron: "5/15 * * * *" }, "2026-10-22T09:30")).toBe(false);
});

test("the latest time due in a stretch, in the app's zone, once however long it was", () => {
  const clock = { every: "day", at: "08:00" };
  // 08:00 in Mariehamn is 05:00 UTC in October before the change.
  const now = new Date("2026-10-22T05:00:30Z");
  expect(kit.latestDue(clock, new Date("2026-10-22T04:59:00Z"), now, ZONE)).toBe(
    "2026-10-22T08:00",
  );
  // The minute after: nothing new.
  expect(
    kit.latestDue(clock, new Date("2026-10-22T05:00:00Z"), new Date("2026-10-22T05:01:30Z"), ZONE),
  ).toBeUndefined();
  // Down for three days: one run, for the latest.
  expect(
    kit.latestDue(clock, new Date("2026-10-19T00:00:00Z"), new Date("2026-10-22T12:00:00Z"), ZONE),
  ).toBe("2026-10-22T08:00");
});

test("the spring change's missing hour runs at the next minute, as written; the autumn's repeated hour once", () => {
  // 29 March 2026: 03:00 local becomes 04:00 (01:00 UTC).
  const clock = { every: "day", at: "03:30" };
  expect(
    kit.latestDue(clock, new Date("2026-03-29T00:59:00Z"), new Date("2026-03-29T01:00:30Z"), ZONE),
  ).toBe("2026-03-29T03:30");
  // 25 October 2026: 04:00 local goes back to 03:00 (01:00 UTC); 03:30 comes twice.
  const autumn = { every: "day", at: "03:30" };
  expect(
    kit.latestDue(autumn, new Date("2026-10-25T00:29:00Z"), new Date("2026-10-25T00:30:30Z"), ZONE),
  ).toBe("2026-10-25T03:30");
  expect(
    kit.latestDue(autumn, new Date("2026-10-25T01:29:00Z"), new Date("2026-10-25T01:30:30Z"), ZONE),
  ).toBe("2026-10-25T03:30");
});
