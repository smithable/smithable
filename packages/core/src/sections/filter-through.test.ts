import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";

// A filter one reference away (docs/design/reports.md §2.1).
const spec = (page: string) => `smithable: 0.1
app:
  name: Studio
models:
  Kind:
    fields:
      name: string!
  Session:
    fields:
      title: string!
      startsAt: datetime!
      status: open | full
      online: bool
      kind: Kind
      teacher: User
      next: Session
      notes: text
      bookings: Booking[]
  Booking:
    fields:
      session: Session!
      who: User
pages:
  bookings:
    crud: Booking
${page}`;

const errors = (page: string) =>
  validateSpec({ path: "smithable.yml", text: spec(page) }, { roles: ["admin"] })
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => d.message)
    .join("\n");

test("a crud page filters by a field of the record a reference names, and may default to it", () => {
  const result = validateSpec(
    {
      path: "smithable.yml",
      text: spec(`    filters: [session.startsAt, session.status, session.online, session.kind]
    defaultFilter: { session.startsAt: today, session.status: open }
`),
    },
    { roles: ["admin"] },
  );
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(result.ir?.pages[0]?.filters).toContain("session.startsAt");
  expect(result.ir?.pages[0]?.defaultFilter).toEqual({
    "session.startsAt": "today",
    "session.status": "open",
  });
});

test("what a filter through a reference refuses", () => {
  expect(errors("    filters: [session.next.startsAt]\n")).toMatch(/one reference away at most/);
  expect(errors("    filters: [who.name]\n")).toMatch(/not a reference to one record/);
  expect(errors("    filters: [nothing.startsAt]\n")).toMatch(/no field named "nothing"/);
  expect(errors("    filters: [session.nothing]\n")).toMatch(/Session has no field named/);
  expect(errors("    filters: [session.notes]\n")).toMatch(/cannot be a filter/);
  expect(errors("    filters: [session.teacher]\n")).toMatch(/cannot be a filter/);
  expect(errors("    filters: [session.bookings]\n")).toMatch(/cannot be a filter/);
  expect(
    errors("    filters: [session.startsAt]\n    defaultFilter: { session.startsAt: soon }\n"),
  ).toMatch(/startsAt/);
  // An order stays on the record's own fields.
  expect(errors("    sortable: [session.startsAt]\n")).not.toBe("");
});

test("a landing section's filters stay on its own model's fields", () => {
  const text = `${spec("")}  home:
    route: /
    landing:
      list: { records: Booking, filters: [session.startsAt] }
`;
  const found = validateSpec({ path: "smithable.yml", text }, { roles: ["admin"] }).diagnostics;
  expect(found.some((d) => d.severity === "error")).toBe(true);
});

test("a rename follows either side of the dot, and a removal drops the filter", () => {
  const files = {
    spec: spec(`    filters: [session.startsAt, session.status]
    defaultFilter: { session.startsAt: today }
`),
  };
  const far = applyOperation(files, "renameField", {
    model: "Session",
    from: "startsAt",
    to: "begins",
  });
  const near = applyOperation(files, "renameField", {
    model: "Booking",
    from: "session",
    to: "lesson",
  });
  const gone = applyOperation(files, "removeField", { model: "Session", field: "startsAt" });
  if (!far.ok || !near.ok || !gone.ok) throw new Error("an operation was refused");
  expect(far.files.spec).toContain("filters: [session.begins, session.status]");
  expect(far.files.spec).toContain("session.begins: today");
  expect(near.files.spec).toContain("filters: [lesson.startsAt, lesson.status]");
  expect(near.files.spec).toContain("lesson.startsAt: today");
  expect(gone.files.spec).not.toContain("session.startsAt");
  expect(gone.files.spec).toContain("session.status");
});
