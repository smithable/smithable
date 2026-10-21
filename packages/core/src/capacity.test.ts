import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateAuth } from "./auth.js";
import { validateSpec } from "./spec.js";

const spec = (booking: string) => `smithable: 0.1
app: { name: Studio }
models:
  Session:
    fields:
      startsAt: datetime!
      capacity: int! = 12
      bookings: Booking[]
  Booking:
    fields:
      session: Session! unique
      status: confirmed | canceled
      paid: bool
    ${booking}
pages:
  sessions: { crud: Session }
`;
const read = (booking: string) => validateSpec({ path: "smithable.yml", text: spec(booking) });
const codes = (booking: string) => read(booking).diagnostics.map((d) => `${d.severity} ${d.code}`);

test("a capacity per reference, with a number or the referenced record's field, and a where", () => {
  const ir = read(
    "capacity: { per: session, max: session.capacity, where: { status: confirmed } }",
  ).ir;
  expect(ir?.models[1]?.capacity).toEqual({
    per: "session",
    max: "session.capacity",
    where: { status: "confirmed" },
  });
  expect(read("capacity: { per: session, max: 3 }").ir?.models[1]?.capacity).toEqual({
    per: "session",
    max: 3,
  });
  expect(
    read("capacity: { per: session, max: 3, where: { paid: true } }").ir?.models[1]?.capacity
      ?.where,
  ).toEqual({ paid: true });
});

test("what a capacity names is checked, and a per that is not unique is a warning", () => {
  expect(codes("capacity: { per: startsAt, max: 3 }")).toEqual(["error invalid-capacity"]);
  expect(codes("capacity: { per: session, max: session.startsAt }")).toEqual([
    "error invalid-capacity",
  ]);
  expect(codes("capacity: { per: session, max: 0 }")).toEqual(["error invalid-value"]);
  expect(codes("capacity: { per: session, max: 3, where: { status: maybe } }")).toEqual([
    "error invalid-capacity",
  ]);
  expect(codes("capacity: { per: session, max: 3, where: { paid: yes } }")).toEqual([
    "error invalid-capacity",
  ]);
  expect(codes("capacity: { per: session }")).toEqual(["error missing-key"]);
  const loose = spec("capacity: { per: session, max: 3 }").replace(
    "session: Session! unique",
    "session: Session!",
  );
  expect(
    validateSpec({ path: "smithable.yml", text: loose }).diagnostics.map((d) => d.code),
  ).toEqual(["capacity-no-unique"]);
});

test("renames follow into a capacity; a removal it counts on is refused", () => {
  const files = {
    spec: spec("capacity: { per: session, max: session.capacity, where: { status: confirmed } }"),
  };
  const per = applyOperation(files, "renameField", {
    model: "Booking",
    from: "session",
    to: "class",
  });
  expect(per.ok && per.files.spec).toContain(
    "capacity: { per: class, max: class.capacity, where: { status: confirmed } }",
  );
  const max = applyOperation(files, "renameField", {
    model: "Session",
    from: "capacity",
    to: "places",
  });
  expect(max.ok && max.files.spec).toContain("max: session.places");
  const where = applyOperation(files, "renameField", {
    model: "Booking",
    from: "status",
    to: "state",
  });
  expect(where.ok && where.files.spec).toContain("where: { state: confirmed }");
  expect(
    applyOperation(files, "removeField", { model: "Session", field: "capacity" }),
  ).toMatchObject({
    ok: false,
    message: expect.stringContaining("counts on Session.capacity"),
  });
});

test("closes and cancelUntil: a date-time of the referenced record, as it is or a period before", () => {
  const both = read(
    "capacity: { per: session, max: 3, closes: 2 hours before session.startsAt, cancelUntil: session.startsAt }",
  );
  expect(both.diagnostics).toEqual([]);
  expect(both.ir?.models[1]?.capacity).toEqual({
    per: "session",
    max: 3,
    closes: { field: "session.startsAt", before: { amount: 2, unit: "hours" } },
    cancelUntil: { field: "session.startsAt" },
  });
  expect(
    read("capacity: { per: session, max: 3, closes: 1 day before session.startsAt }").ir?.models[1]
      ?.capacity?.closes,
  ).toEqual({
    field: "session.startsAt",
    before: { amount: 1, unit: "days" },
  });
  // The shape, then what it names: a date-time of the referenced record, through per.
  expect(codes("capacity: { per: session, max: 3, closes: startsAt }")).toEqual([
    "error invalid-value",
  ]);
  expect(
    codes("capacity: { per: session, max: 3, closes: 0 hours before session.startsAt }"),
  ).toEqual(["error invalid-value"]);
  expect(codes("capacity: { per: session, max: 3, closes: soon }")).toEqual([
    "error invalid-value",
  ]);
  expect(codes("capacity: { per: session, max: 3, closes: session.capacity }")).toEqual([
    "error invalid-capacity",
  ]);
  expect(codes("capacity: { per: session, max: 3, cancelUntil: status }")).toEqual([
    "error invalid-value",
  ]);
});

test("setCapacity writes the deadlines and refuses a malformed one", () => {
  const files = { spec: spec("") };
  const set = applyOperation(files, "setCapacity", {
    model: "Booking",
    per: "session",
    max: "3",
    closes: "2 hours before session.startsAt",
    cancelUntil: "session.startsAt",
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.spec).toContain(
    "    capacity:\n      per: session\n      max: 3\n      closes: 2 hours before session.startsAt\n      cancelUntil: session.startsAt\n",
  );
  expect(validateSpec({ path: "smithable.yml", text: set.files.spec }).diagnostics).toEqual([]);
  const lifted = applyOperation({ ...files, ...set.files }, "setCapacity", {
    model: "Booking",
    per: "session",
    max: "3",
    closes: "none",
  });
  expect(lifted.ok && lifted.files.spec).not.toContain("closes:");
  expect(
    applyOperation(files, "setCapacity", {
      model: "Booking",
      per: "session",
      max: "3",
      closes: "two hours before",
    }),
  ).toMatchObject({
    ok: false,
    message: expect.stringContaining("2 hours before session.startsAt"),
  });
});

test("setCapacity sets and removes a model's capacity", () => {
  const files = { spec: spec("") };
  const set = applyOperation(files, "setCapacity", {
    model: "Booking",
    per: "session",
    max: "session.capacity",
    where: { status: "confirmed" },
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.spec).toContain(
    "    capacity:\n      per: session\n      max: session.capacity\n      where:\n        status: confirmed\n",
  );
  const number = applyOperation(files, "setCapacity", {
    model: "Booking",
    per: "session",
    max: "3",
  });
  expect(number.ok && number.files.spec).toContain("max: 3\n");
  const none = applyOperation({ ...files, ...set.files }, "setCapacity", {
    model: "Booking",
    per: "none",
  });
  expect(none.ok && none.files.spec).not.toContain("    capacity:\n");
  expect(
    applyOperation(files, "setCapacity", { model: "Booking", per: "startsAt", max: "3" }),
  ).toMatchObject({ ok: false });
});

test("a capacity may count several values, and refuses to lose one", () => {
  const files = {
    spec: spec("capacity: { per: session, max: 3, where: { status: [confirmed] } }"),
  };
  expect(
    read("capacity: { per: session, max: 3, where: { status: [confirmed] } }").ir?.models[1]
      ?.capacity?.where,
  ).toEqual({ status: ["confirmed"] });
  expect(codes("capacity: { per: session, max: 3, where: { status: [confirmed, paid] } }")).toEqual(
    ["error invalid-capacity"],
  );
  expect(
    applyOperation(files, "changeField", {
      model: "Booking",
      field: "status",
      type: "held | canceled",
    }),
  ).toMatchObject({ ok: false, message: expect.stringContaining("status is confirmed") });
  const set = applyOperation({ spec: spec("") }, "setCapacity", {
    model: "Booking",
    per: "session",
    max: "3",
    where: { status: "confirmed | canceled" },
  });
  expect(set.ok && set.files.spec).toContain("        status: [confirmed, canceled]\n");
});

test("a unique per on shared records holds one in all: the auth file's check says so", () => {
  const ir = read("capacity: { per: session, max: session.capacity }").ir;
  const access = (defaultAccess: string) =>
    validateAuth(
      {
        path: "smithable.auth.yml",
        text: `smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: ${defaultAccess}\n`,
      },
      ir,
    ).diagnostics.map((d) => d.code);
  expect(access("shared")).toContain("capacity-unique-shared");
  // Private: unique is per owner, one place per person and session.
  expect(access("private")).not.toContain("capacity-unique-shared");
  // A max of 1 is what unique gives anyway.
  const one = read("capacity: { per: session, max: 1 }").ir;
  expect(
    validateAuth(
      {
        path: "smithable.auth.yml",
        text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n",
      },
      one,
    ).diagnostics.map((d) => d.code),
  ).not.toContain("capacity-unique-shared");
});
