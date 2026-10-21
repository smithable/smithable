import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateSpec } from "./spec.js";

const spec = (barber: string, appointment: string, timeOff = "") => `smithable: 0.1
app: { name: Barbers, timezone: Europe/Mariehamn }
models:
  Service:
    fields: { name: string!, minutes: int!, price: money }
  Barber:
    fields: { name: string!, phone: phone }
    ${barber}
  TimeOff:
    fields: { barber: Barber!, from: datetime!, until: datetime!, note: string${timeOff} }
  Appointment:
    fields:
      service: Service!
      barber: Barber!
      startsAt: datetime!
      name: string!
      status: requested | confirmed | cancelled
    ${appointment}
pages:
  appointments: { crud: Appointment }
`;
const SCHEDULE =
  'schedule: { hours: { mon-fri: "09:00-17:00", sat: "10:00-14:00" }, breaks: "12:00-12:30", gap: 10, away: TimeOff }';
const OCCUPIES =
  "occupies: { resource: barber, starts: startsAt, duration: service.minutes, while: { status: [requested, confirmed] }, cancelUntil: 12h }";
const read = (barber: string, appointment: string, timeOff = "") =>
  validateSpec({ path: "smithable.yml", text: spec(barber, appointment, timeOff) });
// Notes (a list back, filters) are advice, not about these keys.
const problems = (text: string) =>
  validateSpec({ path: "smithable.yml", text }).diagnostics.filter((d) => d.severity !== "note");
const codes = (barber: string, appointment: string, timeOff = "") =>
  problems(spec(barber, appointment, timeOff)).map((d) => `${d.severity} ${d.code}`);

test("a schedule and an occupies as the design writes them", () => {
  const { ir } = read(SCHEDULE, OCCUPIES);
  expect(problems(spec(SCHEDULE, OCCUPIES))).toEqual([]);
  expect(ir?.models[1]?.schedule).toEqual({
    hours: {
      mon: [[540, 1020]],
      tue: [[540, 1020]],
      wed: [[540, 1020]],
      thu: [[540, 1020]],
      fri: [[540, 1020]],
      sat: [[600, 840]],
    },
    breaks: [[720, 750]],
    gap: 10,
    // Found by shape: TimeOff's one reference to Barber, its first two date-and-time fields.
    away: { model: "TimeOff", resource: "barber", from: "from", until: "until" },
  });
  expect(ir?.models[3]?.occupies).toEqual({
    resource: "barber",
    starts: "startsAt",
    duration: "service.minutes",
    while: { status: ["requested", "confirmed"] },
    cancelUntil: "12h",
    // The one value outside while.
    cancel: { field: "status", to: "cancelled" },
  });
});

test("what a schedule names is checked", () => {
  expect(codes('schedule: { hours: { mon-fri: "17:00-09:00" } }', "")).toEqual([
    "error invalid-value",
  ]);
  expect(codes('schedule: { hours: { someday: "09:00-17:00" } }', "")).toEqual([
    "error invalid-value",
  ]);
  expect(codes('schedule: { breaks: "12:00-12:30" }', "")).toEqual(["error missing-key"]);
  expect(codes('schedule: { hours: { mon: "09:00-17:00" }, gap: -5 }', "")).toEqual([
    "error invalid-value",
  ]);
  expect(
    codes(
      'schedule: { hours: { mon: "09:00-17:00" }, breaks: ["12:00-13:00", "12:30-12:45"] }',
      "",
    ),
  ).toEqual(["error invalid-value"]);
  expect(codes('schedule: { hours: { mon: "09:00-17:00" }, away: Holiday }', "")).toEqual([
    "error unknown-model",
  ]);
  // A model with no reference to the scheduled one cannot hold its time away.
  expect(codes('schedule: { hours: { mon: "09:00-17:00" }, away: Service }', "")).toEqual([
    "error invalid-schedule",
  ]);
  // The long form says the fields; a wrong one is named.
  expect(
    read(
      'schedule: { hours: { mon: "09:00-17:00" }, away: { model: TimeOff, from: until, until: from } }',
      "",
    ).ir?.models[1]?.schedule?.away,
  ).toEqual({ model: "TimeOff", resource: "barber", from: "until", until: "from" });
  expect(
    codes('schedule: { hours: { mon: "09:00-17:00" }, away: { model: TimeOff, from: note } }', ""),
  ).toEqual(["error invalid-schedule"]);
});

test("what an occupies names is checked, and its Cancel's value", () => {
  const occupies = (rest: string) =>
    `occupies: { resource: barber, starts: startsAt, duration: service.minutes${rest} }`;
  expect(codes(SCHEDULE, occupies(""))).toEqual([]);
  // Without a schedule there is no time to take.
  expect(codes("", occupies(""))).toEqual(["error invalid-occupies"]);
  expect(
    codes(SCHEDULE, "occupies: { resource: service, starts: startsAt, duration: service.minutes }"),
  ).toEqual(["error invalid-occupies"]);
  expect(
    codes(SCHEDULE, "occupies: { resource: barber, starts: name, duration: service.minutes }"),
  ).toEqual(["error invalid-occupies"]);
  expect(
    codes(SCHEDULE, "occupies: { resource: barber, starts: startsAt, duration: service.price }"),
  ).toEqual(["error invalid-occupies"]);
  expect(codes(SCHEDULE, occupies(", while: { status: maybe }"))).toEqual([
    "error invalid-occupies",
  ]);
  expect(codes(SCHEDULE, "occupies: { resource: barber }")).toEqual(["error missing-key"]);
  expect(codes(SCHEDULE, occupies(", cancelUntil: 12 hours"))).toEqual(["error invalid-value"]);
  // A Cancel needs the status in while, and a value outside it to set.
  expect(codes(SCHEDULE, occupies(", cancelUntil: 2d"))).toEqual(["error invalid-occupies"]);
  expect(codes(SCHEDULE, occupies(", while: { status: [requested] }, cancelUntil: 30m"))).toEqual([
    "error invalid-occupies",
  ]);
  const named = read(
    SCHEDULE,
    occupies(", while: { status: [requested] }, cancelUntil: 30m, cancelTo: cancelled"),
  );
  expect(named.diagnostics.filter((d) => d.severity !== "note")).toEqual([]);
  expect(named.ir?.models[3]?.occupies?.cancel).toEqual({ field: "status", to: "cancelled" });
  expect(
    codes(SCHEDULE, occupies(", while: { status: [requested] }, cancelTo: confirmed2")),
  ).toEqual(["error invalid-occupies"]);
});

test("renames follow into a schedule and an occupies; a removal they name is refused", () => {
  const files = { spec: spec(SCHEDULE, OCCUPIES) };
  const renamed = (model: string, from: string, to: string) => {
    const done = applyOperation(files, "renameField", { model, from, to });
    if (!done.ok) throw new Error(done.message);
    return done.files.spec;
  };
  expect(renamed("Appointment", "barber", "stylist")).toContain(
    "occupies: { resource: stylist, starts: startsAt",
  );
  expect(renamed("Appointment", "startsAt", "at")).toContain("starts: at,");
  expect(renamed("Appointment", "service", "treatment")).toContain("duration: treatment.minutes");
  expect(renamed("Service", "minutes", "length")).toContain("duration: service.length");
  expect(renamed("Appointment", "status", "state")).toContain("while: { state: [requested");
  // The away model's fields were found by shape: nothing written to follow, and it still reads.
  const away = renamed("TimeOff", "barber", "who");
  expect(problems(away)).toEqual([]);
  for (const [model, field] of [
    ["Appointment", "startsAt"],
    ["Appointment", "status"],
    ["Service", "minutes"],
    ["TimeOff", "until"],
  ] as const)
    expect(applyOperation(files, "removeField", { model, field })).toMatchObject({ ok: false });
  expect(
    applyOperation(files, "changeField", {
      model: "Appointment",
      field: "status",
      type: "requested | cancelled",
    }),
  ).toMatchObject({ ok: false, message: expect.stringContaining("status is confirmed") });
});

test("setSchedule and setOccupies set and remove them", () => {
  const files = { spec: spec("", "") };
  const schedule = applyOperation(files, "setSchedule", {
    model: "Barber",
    hours: "mon-fri 09:00-17:00, sat 10:00-14:00",
    breaks: "12:00-12:30",
    gap: "10",
    away: "TimeOff",
  });
  if (!schedule.ok) throw new Error(schedule.message);
  expect(schedule.files.spec).toContain(
    "    schedule:\n      hours:\n        mon-fri: 09:00-17:00\n        sat: 10:00-14:00\n      breaks: 12:00-12:30\n      gap: 10\n      away: TimeOff\n",
  );
  const occupies = applyOperation({ ...files, ...schedule.files }, "setOccupies", {
    model: "Appointment",
    resource: "barber",
    starts: "startsAt",
    duration: "service.minutes",
    while: { status: "requested | confirmed" },
    cancelUntil: "12h",
  });
  if (!occupies.ok) throw new Error(occupies.message);
  expect(
    validateSpec({ path: "smithable.yml", text: occupies.files.spec }).ir?.models[3]?.occupies,
  ).toMatchObject({ resource: "barber", cancel: { field: "status", to: "cancelled" } });
  const both = { ...files, ...occupies.files };
  // The schedule cannot go while an appointment takes its time.
  expect(applyOperation(both, "setSchedule", { model: "Barber", hours: "none" })).toMatchObject({
    ok: false,
    message: expect.stringContaining("Appointment takes Barber's time"),
  });
  const none = applyOperation(both, "setOccupies", { model: "Appointment", resource: "none" });
  expect(none.ok && none.files.spec).not.toContain("occupies");
  expect(
    applyOperation({ ...files, ...schedule.files }, "setOccupies", {
      model: "Appointment",
      resource: "barber",
      starts: "name",
      duration: "service.minutes",
    }),
  ).toMatchObject({ ok: false });
});

test("a field the time relies on keeps its kind; a choice change keeps one Cancel value", () => {
  const files = { spec: spec(SCHEDULE, OCCUPIES) };
  const change = (model: string, field: string, type: string) =>
    applyOperation(files, "changeField", { model, field, type });
  for (const [model, field, type] of [
    ["Appointment", "startsAt", "string!"],
    ["Service", "minutes", "string!"],
    ["Appointment", "barber", "Barber"],
    ["TimeOff", "until", "date!"],
    ["TimeOff", "barber", "Service!"],
  ] as const)
    expect(change(model, field, type)).toMatchObject({
      ok: false,
      message: expect.stringContaining("needs"),
    });
  // A change that keeps the kind is fine.
  expect(change("Service", "minutes", "int! = 45")).toMatchObject({ ok: true });
  // The Cancel's value was found by shape (cancelled): a second value outside while is refused.
  expect(
    change("Appointment", "status", "requested | confirmed | cancelled | noShow"),
  ).toMatchObject({ ok: false, message: expect.stringContaining("Write cancelTo first") });
  const renamed = applyOperation(files, "changeField", {
    model: "Appointment",
    field: "status",
    type: "requested | confirmed | dropped",
    renames: ["cancelled=dropped"],
  });
  expect(renamed.ok && problems(renamed.files.spec)).toEqual([]);
});

test("a schedule's hours name a day, and time away has a start and an end", () => {
  expect(codes("schedule: { hours: {} }", "")).toEqual(["error invalid-value"]);
  expect(
    codes(
      'schedule: { hours: { mon: "09:00-17:00" }, away: { model: TimeOff, from: until, until: until } }',
      "",
    ),
  ).toEqual(["error invalid-schedule"]);
});

test("a renamed model of time away is followed, short and long", () => {
  for (const away of ["away: TimeOff", "away: { model: TimeOff, from: from }"]) {
    const files = { spec: spec(SCHEDULE.replace("away: TimeOff", away), OCCUPIES) };
    const done = applyOperation(files, "renameModel", { from: "TimeOff", to: "Holiday" });
    if (!done.ok) throw new Error(done.message);
    expect(done.files.spec).toContain(away.replace("TimeOff", "Holiday"));
    expect(problems(done.files.spec)).toEqual([]);
  }
});

test("setSchedule takes time away in the long form too", () => {
  const done = applyOperation({ spec: spec("", "") }, "setSchedule", {
    model: "Barber",
    hours: "mon-fri 09:00-17:00",
    away: { model: "TimeOff", from: "from", until: "until" },
  });
  if (!done.ok) throw new Error(done.message);
  expect(
    validateSpec({ path: "smithable.yml", text: done.files.spec }).ir?.models[1]?.schedule?.away,
  ).toEqual({ model: "TimeOff", resource: "barber", from: "from", until: "until" });
});
