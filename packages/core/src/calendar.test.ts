import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateSpec } from "./spec.js";

const spec = (
  calendar: string,
  extra = "",
  timezone = "  timezone: Europe/Mariehamn\n",
) => `smithable: 0.1
app:
  name: Studio
${timezone}models:
  ClassType:
    fields: { name: string!, durationMinutes: int! }
  Session:
    fields: { classType: ClassType!, startsAt: datetime!${extra} }
pages:
  sessions: { crud: Session }
  schedule: { calendar: ${calendar} }
`;
const read = (text: string) => validateSpec({ path: "smithable.yml", text });
const messages = (text: string) => read(text).diagnostics.map((d) => d.message);

test("the short form infers the one date-time field; the long form names fields, a duration one reference away", () => {
  expect(read(spec("Session")).ir?.pages[1]?.pattern).toEqual({
    kind: "calendar",
    model: "Session",
    starts: "startsAt",
  });
  expect(
    read(spec("{ model: Session, duration: classType.durationMinutes, title: classType }")).ir
      ?.pages[1]?.pattern,
  ).toEqual({
    kind: "calendar",
    model: "Session",
    starts: "startsAt",
    duration: "classType.durationMinutes",
    title: "classType",
  });
});

test("what cannot be inferred or does not fit is an error that says what to write", () => {
  expect(messages(spec("Session", ", endsAt: datetime")).join(" ")).toMatch(
    /several date fields \(startsAt, endsAt\)/,
  );
  expect(
    read(spec("{ model: Session, starts: startsAt, ends: endsAt }", ", endsAt: datetime")).ir,
  ).toBeDefined();
  expect(messages(spec("ClassType")).join(" ")).toMatch(/no date or date-time field/);
  expect(messages(spec("{ model: Session, duration: classType.name }")).join(" ")).toMatch(
    /whole-number field/,
  );
  expect(messages(spec("{ model: Session, starts: startTime }")).join(" ")).toMatch(
    /no field named "startTime"/,
  );
});

test("without the app's time zone, a calendar warns that it uses UTC", () => {
  const result = read(spec("Session", "", ""));
  expect(result.ir).toBeDefined();
  expect(result.diagnostics.map((d) => d.code)).toContain("no-timezone");
  expect(read(spec("Session")).diagnostics.map((d) => d.code)).not.toContain("no-timezone");
});

test("addCalendarPage adds one to the main menu, naming the start when asked", () => {
  const base = spec("Session").replace("  schedule: { calendar: Session }\n", "");
  const made = applyOperation({ spec: base }, "addCalendarPage", {
    page: "week",
    model: "Session",
  });
  if (!made.ok) throw new Error(made.message);
  expect(made.files.spec).toContain("week:\n    calendar: Session");
  const named = applyOperation({ spec: base }, "addCalendarPage", {
    page: "week",
    model: "Session",
    starts: "startsAt",
  });
  expect(named.ok && named.files.spec).toContain(
    "calendar:\n      model: Session\n      starts: startsAt",
  );
});
