import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";
import { validateUx } from "../ux.js";

const files = import.meta.glob("../../../../examples/booking/smithable.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const spec = Object.values(files)[0] as string;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
if (!ir) throw new Error("the booking starter does not read");
const read = (calendar: string) =>
  validateUx(
    {
      path: "smithable.ux.yml",
      text: `smithableUx: 0.1\npages:\n  schedule:\n    calendar: ${calendar}\n`,
    },
    ir,
    [],
  );

test("a calendar's view (week unsaid, agenda or days) and its own filter, timeOfDay (A 215)", () => {
  const days = read("{ view: days, filters: [timeOfDay] }");
  expect(days.diagnostics).toEqual([]);
  expect(days.ux?.pages.schedule?.calendar).toEqual({ view: "days", filters: ["timeOfDay"] });
  expect(read("{ view: week }").ux?.pages.schedule?.calendar).toBeUndefined();
  expect(read("{ view: month }").diagnostics[0]?.message).toBe(
    '"view" of a calendar is week, agenda or days.',
  );
  expect(read("{ filters: [level] }").diagnostics[0]?.message).toBe(
    'A calendar\'s own filter is timeOfDay; "level" is not one.',
  );
});

test("setCalendarView and setCalendarFilters write the ux file; the defaults take the key away", () => {
  const agenda = applyOperation({ spec }, "setCalendarView", { page: "schedule", view: "agenda" });
  if (!agenda.ok) throw new Error(agenda.message);
  expect(agenda.files.ux).toBe(
    "smithableUx: 0.1\npages:\n  schedule:\n    calendar:\n      view: agenda\n",
  );
  expect(
    applyOperation({ spec, ux: agenda.files.ux as string }, "setCalendarView", {
      page: "schedule",
      view: "week",
    }),
  ).toMatchObject({ ok: true, files: { ux: "smithableUx: 0.1\n" } });
  const timed = applyOperation({ spec }, "setCalendarFilters", {
    page: "schedule",
    filters: ["timeOfDay"],
  });
  if (!timed.ok) throw new Error(timed.message);
  expect(timed.files.ux).toContain("timeOfDay");
  expect(
    applyOperation({ spec }, "setCalendarView", { page: "sessions", view: "days" }),
  ).toMatchObject({
    ok: false,
  });
});
