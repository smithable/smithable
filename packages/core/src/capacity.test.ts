import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
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
