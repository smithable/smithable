import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";
import { validateUx } from "../ux.js";

const booking = Object.values(
  import.meta.glob("../../../../examples/booking/smithable.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
)[0] as string;
const ir = validateSpec({ path: "smithable.yml", text: booking }).ir;
if (!ir) throw new Error("the booking starter does not read");
const read = (calendar: string, page = "schedule") =>
  validateUx(
    {
      path: "smithable.ux.yml",
      text: `smithableUx: 0.1\npages:\n  ${page}:\n    calendar: ${calendar}\n`,
    },
    ir,
  );
const message = (calendar: string, page?: string) => read(calendar, page).diagnostics[0]?.message;

test("a calendar's blocks take a colour and their places left (look-gap §4)", () => {
  const said = read(
    "{ colorBy: classType.level, capacity: { left: placesLeft, of: capacity, look: pips } }",
  );
  expect(said.diagnostics).toEqual([]);
  expect(said.ux?.pages.schedule?.calendar).toEqual({
    colorBy: { kind: "choice", model: "ClassType", field: "level", reference: "classType" },
    capacity: { left: "placesLeft", of: "capacity", look: "pips" },
  });
  // The referenced record itself: each class type its own colour.
  expect(read("{ colorBy: classType }").ux?.pages.schedule?.calendar?.colorBy).toEqual({
    kind: "record",
    model: "ClassType",
    reference: "classType",
  });
  expect(
    read("{ capacity: { left: placesLeft, of: capacity } }").ux?.pages.schedule?.calendar?.capacity
      ?.look,
  ).toBe("number");
  expect(message("{ colorBy: startsAt }")).toBe(
    '"colorBy" needs a stored choice: startsAt is not one.',
  );
  expect(message("{ colorBy: classType.name }")).toBe(
    '"colorBy" needs a stored choice: classType.name is not one.',
  );
  expect(message("{ colorBy: room }")).toBe('Session has no field named "room".');
  expect(message("{ capacity: { left: placesLeft, of: startsAt } }")).toBe(
    '"of" of the capacity needs a number field: startsAt is not one.',
  );
  expect(message("{ capacity: { left: placesLeft, of: capacity, look: dots } }")).toBe(
    '"look" of the capacity is number, pips or bar.',
  );
  expect(message("{ colorBy: classType }", "sessions")).toBe(
    '"calendar" belongs to a calendar page; sessions is not one.',
  );
});

test("setCalendarColor and setCalendarCapacity write the part; renames follow, removals take it", () => {
  const files = { spec: booking, ux: "smithableUx: 0.1\n" };
  const color = applyOperation(files, "setCalendarColor", {
    page: "schedule",
    field: "classType.level",
  });
  if (!color.ok) throw new Error(color.message);
  const both = applyOperation(color.files, "setCalendarCapacity", {
    page: "schedule",
    left: "placesLeft",
    of: "capacity",
    look: "pips",
  });
  if (!both.ok) throw new Error(both.message);
  expect(both.files.ux).toContain("    calendar:\n      colorBy: classType.level\n      capacity:");
  expect(
    applyOperation(files, "setCalendarColor", { page: "schedule", field: "startsAt" }).ok,
  ).toBe(false);
  expect(
    applyOperation(files, "setCalendarColor", { page: "sessions", field: "classType" }),
  ).toMatchObject({
    ok: false,
    message: "sessions is not a calendar page.",
  });
  // A renamed field is followed; a removed one takes its key.
  const renamed = applyOperation(both.files, "renameField", {
    model: "Session",
    from: "capacity",
    to: "places",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.ux).toContain("of: places");
  const level = applyOperation(both.files, "renameField", {
    model: "ClassType",
    from: "level",
    to: "grade",
  });
  if (!level.ok) throw new Error(level.message);
  expect(level.files.ux).toContain("colorBy: classType.grade");
  // The reference itself renamed: the path follows at its start.
  const kind = applyOperation(both.files, "renameField", {
    model: "Session",
    from: "classType",
    to: "kind",
  });
  if (!kind.ok) throw new Error(kind.message);
  expect(kind.files.ux).toContain("colorBy: kind.level");
  const off = applyOperation(both.files, "setCalendarColor", { page: "schedule", field: "none" });
  if (!off.ok) throw new Error(off.message);
  expect(off.files.ux).not.toContain("colorBy");
});
