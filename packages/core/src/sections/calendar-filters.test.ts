import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";

const files = import.meta.glob("../../../../examples/booking/smithable.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const booking = Object.values(files)[0] as string;
const withFilters = (filters: string) =>
  validateSpec({
    path: "smithable.yml",
    text: booking
      .split("    filters: [classType, instructor]  # a timetable by class and by teacher\n")
      .join(`    filters: [${filters}]\n`),
  });

test("a calendar page filters by choices, references and people; its days are the range (A 215 5b)", () => {
  const read = withFilters("classType, instructor");
  expect(read.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(read.ir?.pages.find((p) => p.id === "schedule")?.filters).toEqual([
    "classType",
    "instructor",
  ]);
  for (const [field, kind] of [
    ["startsAt", "date"],
    ["capacity", "number"],
  ])
    expect(
      withFilters(`classType, ${field}`).diagnostics.map((d) => d.message),
      kind,
    ).toContain(
      `"${field}" cannot be a filter on a calendar: its days are the range; a calendar filters by choices, references, people and yes/no fields.`,
    );
});

test("a calendar page's filters follow a renamed field", () => {
  const renamed = applyOperation({ spec: booking }, "renameField", {
    model: "Session",
    from: "instructor",
    to: "teacher",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.spec).toContain("filters: [classType, teacher]");
});
