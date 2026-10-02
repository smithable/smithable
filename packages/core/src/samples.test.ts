import { expect, test } from "vitest";
import { validateContent } from "./content.js";
import { validateSamples } from "./samples.js";
import { validateSpec } from "./spec.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Studio }
models:
  Instructor:
    fields: { name: string!, bio: text }
  ClassType:
    fields:
      name: string!
      level: all | beginner | advanced
      price: money
      instructor: Instructor
      photo: picture
  Session:
    fields: { classType: ClassType!, startsAt: datetime!, day: date }
pages:
  classes: { crud: ClassType }
`,
}).ir;
if (!ir) throw new Error("the spec is invalid");
const content = validateContent(
  {
    path: "smithable.content.yml",
    text: "smithableContent: 0.1\nmodels:\n  ClassType:\n    fields:\n      level: { values: { all: All levels } }\n",
  },
  ir,
).content;

const check = (files: Record<string, string>) =>
  validateSamples(
    Object.entries(files).map(([path, text]) => ({ path, text })),
    ir,
    content,
  );

test("a model's records: references by title, choices by label, money in cents, pictures by file", () => {
  const { samples, diagnostics } = check({
    "samples/Instructor.yml": "- { name: Emma Lind, bio: Teaches calm. }\n- name: Oskar Berg\n",
    "samples/ClassType.yml": `- name: Hatha
  level: All levels
  price: 16.5
  instructor: Oskar Berg
  photo: { file: hatha.webp, alt: A class stretching }
- { name: Yin, level: beginner, photo: yin.webp }
`,
    "samples/Session.yml": "- { classType: Yin, startsAt: 2026-10-05 08:00, day: 2026-10-05 }\n",
  });
  expect(diagnostics).toEqual([]);
  expect(samples.ClassType).toEqual([
    {
      name: "Hatha",
      level: "all",
      price: 1650,
      instructor: 2,
      photo: { picture: "hatha.webp", alt: "A class stretching" },
    },
    { name: "Yin", level: "beginner", photo: { picture: "yin.webp", alt: "A picture of Yin" } },
  ]);
  expect(samples.Session).toEqual([
    { classType: 2, startsAt: "2026-10-05T08:00", day: "2026-10-05" },
  ]);
});

test("a sample naming a field or model that is gone warns and is left out, never blocks", () => {
  const stale = check({
    "samples/Teacher.yml": "- { name: A }\n",
    "samples/Instructor.yml": "- { name: Emma, age: 3 }\n",
  });
  expect(stale.diagnostics.map((d) => d.severity)).toEqual(["warning", "warning"]);
  expect(stale.samples.Instructor).toEqual([{ name: "Emma" }]);
});

test("mistakes are reported where they are: model, field, kind, required, reference", () => {
  const messages = (files: Record<string, string>) =>
    check(files).diagnostics.map((d) => d.message);
  expect(messages({ "samples/Teacher.yml": "- { name: A }\n" })[0]).toContain(
    'There is no model "Teacher"',
  );
  expect(messages({ "samples/Instructor.yml": "- { name: A, age: 3 }\n" })[0]).toContain(
    'Instructor has no field "age"',
  );
  expect(messages({ "samples/ClassType.yml": "- { name: A, price: cheap }\n" })[0]).toContain(
    '"price" of ClassType is an amount',
  );
  expect(messages({ "samples/Instructor.yml": "- { bio: Calm. }\n" })[0]).toContain(
    'Record 1 of Instructor needs "name"',
  );
  expect(
    messages({
      "samples/Instructor.yml": "- { name: Emma Lind }\n",
      "samples/ClassType.yml": "- { name: A, instructor: Emma Lindh }\n",
    })[0],
  ).toContain('samples/Instructor.yml has no record called "Emma Lindh"');
  // A wrong value is one problem, not also a missing field.
  expect(
    check({
      "samples/ClassType.yml": "- { name: Yin }\n",
      "samples/Session.yml": "- { classType: Yinn, startsAt: 2026-10-05 08:00 }\n",
    }).diagnostics,
  ).toHaveLength(1);
  // Without the referenced model's file, a generated record by its number.
  expect(messages({ "samples/ClassType.yml": "- { name: A, instructor: Emma }\n" })[0]).toContain(
    "Instructor has no samples/Instructor.yml; refer to a generated instructor by its number",
  );
  expect(check({ "samples/ClassType.yml": "- { name: A, instructor: 2 }\n" }).diagnostics).toEqual(
    [],
  );
  const where = check({ "samples/Instructor.yml": "- name: A\n  age: 3\n" }).diagnostics[0];
  expect([where?.line, where?.column]).toEqual([2, 3]);
});
