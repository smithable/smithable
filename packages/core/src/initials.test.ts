import { expect, test } from "vitest";
import { textPaths, validateContent } from "./content.js";
import { initialsForm, initialsOf } from "./initials.js";
import type { SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";

// The letters on an app's tile (docs/design/app-logo.md §0 and §8).
test("the initials by rule: the first letters of the first two words that have one", () => {
  expect(initialsOf("Invoicely")).toBe("I");
  expect(initialsOf("Stillwater Yoga")).toBe("SY");
  expect(initialsOf("Smith & Sons")).toBe("SS");
  // Emoji and signs are passed over, also in front.
  expect(initialsOf("🌿 Garden club")).toBe("GC");
  expect(initialsOf("7 eleven")).toBe("7E");
  // A fraction is a sign, and a keycap digit an emoji.
  expect(initialsOf("½ moon bakery")).toBe("MB");
  expect(initialsOf("1\uFE0F\u20E3 Garden club")).toBe("GC");
  // Upper-cased without a locale, only the first character kept: ß gives S.
  expect(initialsOf("ßeta works")).toBe("SW");
  expect(initialsOf("ß\u0301eta")).toBe("S\u0301");
  // A mark the upper case brings is kept: ǰ has no capital of its own.
  expect(initialsOf("ǰ")).toBe("J\u030C");
  // A letter keeps its combining marks, three at most.
  expect(initialsOf("école normale")).toBe("ÉN");
  expect(initialsOf(`e${"\u0301".repeat(200)}x`)).toBe("E\u0301\u0301\u0301");
  // A modifier letter at the front of an upper case is passed over: ŉ upper-cases to ʼN.
  expect(initialsOf("ŉ works")).toBe("NW");
  // A name without spaces in a script without case: one, as written.
  expect(initialsOf("東京書店")).toBe("東");
  // Two right-to-left words: in their own (logical) order; the tile sets their direction.
  expect(initialsOf("שלום עולם")).toBe("שע");
  // No letter at all: none, and the tile is drawn without letters.
  expect(initialsOf("🙂 & !")).toBe("");
});

test("a given initials is one or two letters or digits", () => {
  expect(initialsForm("SY")).toBe(true);
  expect(initialsForm("東")).toBe(true);
  expect(initialsForm("ÉN")).toBe(true);
  expect(initialsForm("E\u0301\u0301\u0301")).toBe(true);
  expect(initialsForm(`E${"\u0301".repeat(4)}`)).toBe(false);
  expect(initialsForm("SYZ")).toBe(false);
  expect(initialsForm("S Y")).toBe(false);
  expect(initialsForm("S&")).toBe(false);
  expect(initialsForm("½")).toBe(false);
  expect(initialsForm("1\uFE0F\u20E3")).toBe(false);
  expect(initialsForm("")).toBe(false);
});

const ir = validateSpec({
  path: "smithable.yml",
  text: "smithable: 0.1\napp: { name: Stillwater Yoga }\nmodels:\n  Class: { fields: { name: string! } }\npages:\n  classes: { crud: Class }\n",
}).ir as SpecIR;
const read = (text: string) =>
  validateContent({ path: "smithable.content.yml", text: `smithableContent: 0.1\n${text}` }, ir);

test("the content file's initials are read, refused at three letters, and are no text", () => {
  const given = read("initials: SW\n");
  expect(given.content?.initials).toBe("SW");
  expect([...textPaths(given.content as never).keys()]).not.toContain("initials");
  const three = read("initials: SWY\n");
  expect(three.diagnostics.map((d) => d.code)).toContain("initials-form");
  expect(read("").content?.initials).toBeUndefined();
});
