import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateSpec } from "./spec.js";

// Editing in the preview (A 231): a layout change (an order, a grouping, a layout choice) never
// alters access, a record's identity or what a part shows, and the operation layer refuses an
// invalid arrangement itself, whichever editor asked for it.
const raw = import.meta.glob("../../../examples/booking/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const at = (file: string) => raw[`../../../examples/booking/${file}`] as string;
const files = {
  spec: at("smithable.yml"),
  auth: at("smithable.auth.yml"),
  ux: at("smithable.ux.yml"),
  content: at("smithable.content.yml"),
};

const LAYOUT: [string, Record<string, unknown>][] = [
  ["setColumns", { page: "sessions", columns: ["startsAt", "classType", "capacity"] }],
  ["setFieldOrder", { page: "sessions", fields: ["startsAt", "classType"] }],
  ["setFormSections", { page: "sessions", sections: ["when:startsAt", "what:classType,capacity"] }],
  ["setFormColumns", { page: "sessions", columns: 2 }],
  ["setBelow", { page: "sessions", column: "classType", field: "instructor" }],
  ["moveSection", { page: "about", section: "faq", before: "story" }],
];

test.each(LAYOUT)("%s changes the layout alone: access, records and bindings stay", (op, args) => {
  const result = applyOperation(files, op, args);
  if (!result.ok) throw new Error(result.message);
  // Access and sign-in are untouched.
  expect(result.files.auth).toBe(files.auth);
  expect(result.files.content).toBe(files.content);
  const before = validateSpec({ path: "smithable.yml", text: files.spec }).ir;
  const after = validateSpec({ path: "smithable.yml", text: result.files.spec }).ir;
  expect(before?.models.length).toBeGreaterThan(0);
  expect(after?.pages.length).toBe(before?.pages.length);
  // The models (their fields, keys and rules) are the same, and so is every page's binding:
  // each section shows the same records with the same conditions, whatever its place.
  expect(after?.models).toEqual(before?.models);
  const bound = (ir: typeof before) =>
    ir?.pages.map((p) => ({
      ...p,
      sections: [...p.sections].sort((a, b) => a.name.localeCompare(b.name)),
    }));
  expect(bound(after)).toEqual(bound(before));
});

test("an invalid arrangement is refused by the operation, not only by an editor", () => {
  const applies = (op: string, args: Record<string, unknown>) => applyOperation(files, op, args).ok;
  // A field in two groups of a form, a field the model does not have, a group's name twice.
  expect(
    applies("setFormSections", { page: "sessions", sections: ["a:startsAt", "b:startsAt"] }),
  ).toBe(false);
  expect(applies("setFormSections", { page: "sessions", sections: ["a:nosuch"] })).toBe(false);
  expect(
    applies("setFormSections", { page: "sessions", sections: ["a:startsAt", "a:capacity"] }),
  ).toBe(false);
  // A column the page's records do not have; a section beside itself or one the page lacks.
  expect(applies("setColumns", { page: "sessions", columns: ["nosuch"] })).toBe(false);
  expect(applies("moveSection", { page: "about", section: "faq", before: "faq" })).toBe(false);
  expect(applies("moveSection", { page: "about", section: "faq", before: "nosuch" })).toBe(false);
});
