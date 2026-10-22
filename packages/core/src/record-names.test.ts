import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateSpec } from "./spec.js";
import { validateUx } from "./ux.js";

// A record's name from its parts (docs/design/record-names.md): a field, a reference (that
// record's own name) or a field one reference away, joined with " · "; the ux file's record lines.
const spec = `smithable: 0.1
app: { name: Studio }
models:
  ClassType:
    fields:
      name: string
      level: beginner | regular | advanced
  Instructor:
    fields:
      name: string
  Session:
    namedBy: [classType, startsAt]
    fields:
      classType: ClassType!
      instructor: Instructor!
      startsAt: datetime
      capacity: int
      bookings: Booking[]
  Booking:
    namedBy: session
    fields:
      session: Session!
      note: text
  Customer:
    namedBy: company
    fields:
      company: string
      email: email
pages:
  sessions: { crud: Session }
  bookings: { crud: Booking }
`;

const read = (text: string) => validateSpec({ path: "smithable.yml", text });
const codes = (text: string) => read(text).diagnostics.map((d) => `${d.code}: ${d.message}`);

test("namedBy takes one field, a reference, a path or a list; one text field stays today's title", () => {
  const { ir, diagnostics } = read(spec);
  expect(diagnostics.filter((d) => d.severity !== "note")).toEqual([]);
  const model = (name: string) => ir?.models.find((m) => m.name === name);
  expect(model("Session")?.nameParts).toEqual([{ field: "classType" }, { field: "startsAt" }]);
  expect(model("Session")?.namedBy).toBeUndefined();
  expect(model("Booking")?.nameParts).toEqual([{ field: "session" }]);
  expect(model("Customer")?.nameParts).toEqual([{ field: "company" }]);
  expect(model("Customer")?.namedBy).toBe("company");
  const path = read(spec.replace("namedBy: [classType, startsAt]", "namedBy: classType.name")).ir;
  expect(path?.models.find((m) => m.name === "Session")?.nameParts).toEqual([
    { field: "name", through: "classType" },
  ]);
});

test("a part must be a field a name can show, one reference deep, with no circle", () => {
  expect(
    codes(spec.replace("namedBy: [classType, startsAt]", "namedBy: [classType, bookings]")),
  ).toEqual([expect.stringContaining("Session.bookings cannot be part of a name")]);
  expect(
    codes(spec.replace("namedBy: [classType, startsAt]", "namedBy: classType.level.x")),
  ).toEqual([expect.stringContaining("is not a field of Session or a field one reference away")]);
  expect(codes(spec.replace("namedBy: [classType, startsAt]", "namedBy: startsAt.year"))).toEqual([
    expect.stringContaining("Session.startsAt does not refer to one record"),
  ]);
  expect(
    codes(spec.replace("namedBy: [classType, startsAt]", "namedBy: classType.colour")),
  ).toEqual([expect.stringContaining('ClassType has no field "colour"')]);
  expect(
    codes(spec.replace("namedBy: [classType, startsAt]", "namedBy: [classType, classType]")),
  ).toEqual([expect.stringContaining("names classType twice")]);
  // Session named by its booking, named by its session.
  expect(
    codes(
      spec
        .replace("namedBy: [classType, startsAt]", "namedBy: firstBooking")
        .replace(
          "      bookings: Booking[]\n",
          "      bookings: Booking[]\n      firstBooking: Booking\n",
        ),
    ),
  ).toContainEqual(
    expect.stringContaining("Session's name comes back to itself: Session → Booking → Session"),
  );
});

test("setNamedBy writes parts, a field or none; a renamed or removed part follows into the name", () => {
  const parts = applyOperation({ spec }, "setNamedBy", {
    model: "Session",
    parts: ["instructor.name", "startsAt"],
  });
  if (!parts.ok) throw new Error(parts.message);
  expect(parts.files.spec).toContain("namedBy: [instructor.name, startsAt]");
  const one = applyOperation({ spec }, "setNamedBy", { model: "Session", parts: ["classType"] });
  expect(one.ok && one.files.spec).toContain("namedBy: classType\n");
  expect(
    applyOperation({ spec }, "setNamedBy", { model: "Session", parts: ["bookings"] }),
  ).toMatchObject({
    ok: false,
    message: expect.stringContaining("cannot be part of a name"),
  });
  const none = applyOperation({ spec }, "setNamedBy", { model: "Customer", none: true });
  expect(none.ok && none.files.spec).not.toContain("namedBy: company");
  const renamed = applyOperation({ spec }, "renameField", {
    model: "Session",
    from: "startsAt",
    to: "begins",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.spec).toContain("namedBy: [classType, begins]");
  const far = applyOperation(
    { spec: spec.replace("namedBy: [classType, startsAt]", "namedBy: [classType.name, startsAt]") },
    "renameField",
    {
      model: "ClassType",
      from: "name",
      to: "title",
    },
  );
  if (!far.ok) throw new Error(far.message);
  expect(far.files.spec).toContain("namedBy: [classType.title, startsAt]");
  const removed = applyOperation({ spec }, "removeField", { model: "Session", field: "startsAt" });
  if (!removed.ok) throw new Error(removed.message);
  expect(removed.files.spec).toContain("    namedBy: classType\n");
  const gone = applyOperation({ spec }, "removeField", { model: "Customer", field: "company" });
  expect(gone.ok && gone.files.spec).not.toContain("namedBy: company");
});

test("the ux file's record lines take the same parts, by page; setRecordLines writes them; a rename follows", () => {
  const ir = read(spec).ir;
  if (!ir) throw new Error("spec");
  const ux = (text: string) => validateUx({ path: "smithable.ux.yml", text }, ir);
  const lines = ux(
    "smithableUx: 0.1\npages:\n  sessions:\n    record: { subtitle: instructor.name, detail: [classType.level, capacity] }\n",
  );
  expect(lines.diagnostics).toEqual([]);
  expect(lines.ux?.pages.sessions).toEqual({
    subtitle: { field: "name", through: "instructor" },
    detail: [{ field: "level", through: "classType" }, { field: "capacity" }],
  });
  expect(
    ux(
      "smithableUx: 0.1\npages:\n  sessions:\n    record: { subtitle: bookings }\n",
    ).diagnostics.map((d) => d.message),
  ).toEqual([expect.stringContaining("Session.bookings cannot be part of a name")]);
  const set = applyOperation({ spec }, "setRecordLines", {
    page: "sessions",
    subtitle: "instructor.name",
    detail: ["classType.level"],
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.ux).toContain(
    "  sessions:\n    record:\n      subtitle: instructor.name\n      detail: [classType.level]\n",
  );
  const renamed = applyOperation(set.files, "renameField", {
    model: "Instructor",
    from: "name",
    to: "fullName",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.ux).toContain("subtitle: instructor.fullName");
  const dropped = applyOperation(set.files, "removeField", { model: "ClassType", field: "level" });
  if (!dropped.ok) throw new Error(dropped.message);
  expect(dropped.files.ux).not.toContain("detail");
  const cleared = applyOperation(set.files, "setRecordLines", {
    page: "sessions",
    subtitle: "none",
    detail: [],
  });
  expect(cleared.ok && cleared.files.ux).not.toContain("record");
});
