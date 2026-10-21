import { expect, test } from "vitest";

// The kit's slots.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/slots.ts";
type Schedule = {
  hours: Record<string, [number, number][]>;
  breaks: [number, number][];
  gap: number;
};
type Taken = { from: number; until: number; away?: boolean };
const kit = (await import(path)) as {
  fits(
    schedule: Schedule,
    start: Date,
    minutes: number,
    taken: Taken[],
    timeZone?: string,
  ): boolean;
  freeTimes(
    schedule: Schedule,
    date: string,
    minutes: number,
    taken: Taken[],
    timeZone?: string,
    now?: Date,
  ): Date[];
};
const ZONE = "Europe/Mariehamn"; // EET, EEST in summer (UTC+2, +3)
const weekdays: [number, number][] = [[540, 1020]]; // 09:00-17:00
const SCHEDULE: Schedule = {
  hours: {
    mon: weekdays,
    tue: weekdays,
    wed: weekdays,
    thu: weekdays,
    fri: weekdays,
    sat: [[600, 840]],
  },
  breaks: [[720, 750]], // 12:00-12:30
  gap: 10,
};
const LONG_AGO = new Date("2020-01-01T00:00:00Z");
const local = (wall: string) => {
  // Wall times in October 2026 before the 25th are UTC+3.
  return new Date(`${wall}:00+03:00`);
};
const clocks = (times: Date[]) =>
  times.map((t) =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: ZONE, hour: "2-digit", minute: "2-digit" }).format(
      t,
    ),
  );

test("the hours, the breaks, the gap after each booking and time away", () => {
  // Wednesday 21 October 2026.
  const at = (clock: string) => local(`2026-10-21T${clock}`);
  expect(kit.fits(SCHEDULE, at("09:00"), 30, [], ZONE)).toBe(true);
  expect(kit.fits(SCHEDULE, at("08:45"), 30, [], ZONE)).toBe(false);
  expect(kit.fits(SCHEDULE, at("16:45"), 30, [], ZONE)).toBe(false);
  expect(kit.fits(SCHEDULE, at("11:45"), 30, [], ZONE)).toBe(false); // into the break
  expect(kit.fits(SCHEDULE, at("12:30"), 30, [], ZONE)).toBe(true);
  // Sunday is closed.
  expect(kit.fits(SCHEDULE, local("2026-10-25T10:00"), 30, [], ZONE)).toBe(false);
  const booked: Taken = { from: at("10:00").getTime(), until: at("10:30").getTime() };
  expect(kit.fits(SCHEDULE, at("10:15"), 30, [booked], ZONE)).toBe(false);
  // The gap after the booking at 10:00, and after the new one before it.
  expect(kit.fits(SCHEDULE, at("10:30"), 30, [booked], ZONE)).toBe(false);
  expect(kit.fits(SCHEDULE, at("10:40"), 30, [booked], ZONE)).toBe(true);
  expect(kit.fits(SCHEDULE, at("09:30"), 30, [booked], ZONE)).toBe(false);
  expect(kit.fits(SCHEDULE, at("09:20"), 30, [booked], ZONE)).toBe(true);
  // Time away keeps no gap.
  const away: Taken = { from: at("14:00").getTime(), until: at("15:00").getTime(), away: true };
  expect(kit.fits(SCHEDULE, at("14:30"), 30, [away], ZONE)).toBe(false);
  expect(kit.fits(SCHEDULE, at("15:00"), 30, [away], ZONE)).toBe(true);
  expect(kit.fits(SCHEDULE, at("13:30"), 30, [away], ZONE)).toBe(true);
});

test("a day's free times: every quarter hour where the whole length fits", () => {
  const booked: Taken = {
    from: local("2026-10-21T10:00").getTime(),
    until: local("2026-10-21T10:30").getTime(),
  };
  const times = clocks(kit.freeTimes(SCHEDULE, "2026-10-21", 30, [booked], ZONE, LONG_AGO));
  expect(times.slice(0, 6)).toEqual(["09:00", "09:15", "10:45", "11:00", "11:15", "11:30"]);
  expect(times).not.toContain("11:45");
  expect(times).toContain("12:30");
  expect(times.at(-1)).toBe("16:30");
  // Saturday 10:00-14:00 with an hour's booking length; past times are not offered.
  expect(clocks(kit.freeTimes(SCHEDULE, "2026-10-24", 60, [], ZONE, LONG_AGO))).toEqual([
    "10:00",
    "10:15",
    "10:30",
    "10:45",
    "11:00",
    "12:30",
    "12:45",
    "13:00",
  ]);
  expect(kit.freeTimes(SCHEDULE, "2026-10-21", 30, [], ZONE, local("2026-10-21T16:20"))).toEqual([
    local("2026-10-21T16:30"),
  ]);
  // A length shorter than a quarter hour steps by itself.
  expect(clocks(kit.freeTimes(SCHEDULE, "2026-10-21", 10, [], ZONE, LONG_AGO)).slice(0, 3)).toEqual(
    ["09:00", "09:10", "09:20"],
  );
});

test("across the change from summer time (25 October 2026), the times are the business's clock", () => {
  // Monday 26 October is UTC+2: 09:00 there is 07:00 UTC, the day before the change 06:00 UTC.
  const after = kit.freeTimes(SCHEDULE, "2026-10-26", 30, [], ZONE, LONG_AGO);
  expect(after[0]?.toISOString()).toBe("2026-10-26T07:00:00.000Z");
  const before = kit.freeTimes(SCHEDULE, "2026-10-23", 30, [], ZONE, LONG_AGO);
  expect(before[0]?.toISOString()).toBe("2026-10-23T06:00:00.000Z");
  expect(clocks(after)).toEqual(clocks(before));
  // A booking stored in UTC on the other side of the change still blocks its own wall time.
  const booked: Taken = {
    from: Date.parse("2026-10-26T08:00:00Z"), // 10:00 local
    until: Date.parse("2026-10-26T08:30:00Z"),
  };
  expect(kit.fits(SCHEDULE, new Date("2026-10-26T08:00:00Z"), 30, [booked], ZONE)).toBe(false);
  expect(clocks(kit.freeTimes(SCHEDULE, "2026-10-26", 30, [booked], ZONE, LONG_AGO))).not.toContain(
    "10:00",
  );
  // In spring the clock skips 03:00-04:00: hours across it offer no time that does not exist.
  const night: Schedule = { hours: { sun: [[120, 300]] }, breaks: [], gap: 0 };
  expect(clocks(kit.freeTimes(night, "2026-03-29", 60, [], ZONE, LONG_AGO))).not.toContain("03:00");
});

test("a booking lasts some time, no longer than a day", () => {
  const at = local("2026-10-21T10:00");
  expect(kit.fits(SCHEDULE, at, 0, [], ZONE)).toBe(false);
  expect(kit.fits(SCHEDULE, at, -30, [], ZONE)).toBe(false);
  expect(kit.freeTimes(SCHEDULE, "2026-10-21", -1_000_000, [], ZONE, LONG_AGO)).toEqual([]);
  expect(kit.freeTimes(SCHEDULE, "2026-10-21", 2000, [], ZONE, LONG_AGO)).toEqual([]);
});
