import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateAuth } from "../auth.js";
import { validateSpec } from "../spec.js";
import { validateUx } from "../ux.js";

const files = import.meta.glob("../../../../examples/booking/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const file = (name: string) =>
  Object.entries(files).find(([path]) => path.endsWith(`/${name}`))?.[1] as string;
const spec = file("smithable.yml");
const authText = file("smithable.auth.yml");
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
if (!ir) throw new Error("the booking starter does not read");
const auth = validateAuth({ path: "smithable.auth.yml", text: authText }, ir).auth;
const read = (hero: string) =>
  validateUx(
    {
      path: "smithable.ux.yml",
      text: `smithableUx: 0.1\npages:\n  home:\n    sections:\n      hero: ${hero}\n`,
    },
    ir,
    [],
    auth,
  );
const message = (hero: string) => read(hero).diagnostics[0]?.message;

test("a hero's inset layout, overlay, facts and line from the contact section (look-gap §4)", () => {
  const said = read("{ layout: inset, facts: [Instructor, ClassType], eyebrow: address }");
  expect(said.diagnostics).toEqual([]);
  expect(said.ux?.pages.home?.looks?.hero).toEqual({
    layout: "inset",
    facts: ["Instructor", "ClassType"],
    eyebrow: "address",
  });
  expect(read("{ layout: photo, overlay: brand }").ux?.pages.home?.looks?.hero?.overlay).toBe(
    "brand",
  );
  expect(message("{ layout: split, overlay: dark }")).toBe(
    '"overlay" goes with cover or photo, where the text stands on the picture.',
  );
  expect(message("{ layout: cover, overlay: none }")).toBe(
    'The text of hero on page "home" stands on the picture; brand or dark keeps it readable.',
  );
  expect(message("{ facts: [Booking] }")).toBe(
    "home is public, and visitors may not read Booking: its count would show what they may not see.",
  );
  expect(message("{ facts: [Teacher] }")).toBe('There is no model named "Teacher".');
});

test("setSectionLook writes a hero's facts as a list of models", () => {
  const files = { spec, auth: authText, ux: "smithableUx: 0.1\n" };
  const set = applyOperation(files, "setSectionLook", {
    page: "home",
    section: "hero",
    key: "facts",
    value: "Instructor ClassType",
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.ux).toMatch(/facts:[\s\S]*Instructor[\s\S]*ClassType/);
  // A model visitors may not read is refused on the public home page.
  expect(
    applyOperation(files, "setSectionLook", {
      page: "home",
      section: "hero",
      key: "facts",
      value: "Booking",
    }).ok,
  ).toBe(false);
});

test("a hero's height: auto or full (A 215)", () => {
  expect(read("{ layout: photo, height: auto }").ux?.pages.home?.looks?.hero?.height).toBe("auto");
  expect(read("{ layout: split, height: full }").ux?.pages.home?.looks?.hero?.height).toBe("full");
  expect(message("{ height: tall }")).toBe(
    '"height" of the look of hero on page "home" is one of auto, full.',
  );
});
