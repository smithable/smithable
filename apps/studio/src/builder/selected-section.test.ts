import { expect, test } from "vitest";
import type { Spec } from "../engine";
import type { Selection } from "../preview";
import { beside, selectedSection } from "./SelectedSection";

const screen = { width: 1440, height: 900, top: 64 };

test("a section's form goes to the right of its box, else left, below, above, else inside its visible foot", () => {
  const box = (left: number, right: number, top: number, bottom: number) => ({
    left,
    right,
    top,
    bottom,
  });
  expect(beside(box(100, 500, 200, 500), screen, 320, 260)).toEqual({ left: 512, top: 200 });
  expect(beside(box(900, 1300, 200, 500), screen, 320, 260)).toEqual({ left: 568, top: 200 });
  // Across the width: below when there is room, above when not.
  expect(beside(box(0, 1440, 100, 400), screen, 320, 260)).toEqual({ left: 560, top: 412 });
  expect(beside(box(0, 1440, 500, 800), screen, 320, 260)).toEqual({ left: 560, top: 228 });
  // A hero filling the window: inside it, at the foot of what shows, never off the screen.
  expect(beside(box(0, 1440, 60, 1400), screen, 320, 260)).toEqual({ left: 1108, top: 628 });
  // Never under Studio's bar, however high the box sits.
  expect(beside(box(100, 500, -300, 120), screen, 320, 260).top).toBe(64);
});

const spec = {
  ir: {
    pages: [
      {
        id: "home",
        sections: [
          { name: "hero", kind: "hero" },
          { name: "classes", kind: "records" },
          { name: "story", kind: "custom" },
        ],
      },
    ],
  },
  ux: { pages: { home: { looks: { classes: { layout: "list" } } } } },
} as unknown as Spec;
const picked = (concept: string, label = "") => ({ type: "select", concept, label }) as Selection;

test("a picked section offers the looks that arrange it, each with its current value", () => {
  const hero = selectedSection(picked("section:home.hero", "Find your calm"), spec);
  expect(hero?.label).toBe("Find your calm");
  expect(hero?.choices.map((choice) => [choice.key, choice.current])).toEqual([
    ["layout", "split"],
    ["image", "right"],
    ["height", ""],
  ]);
  expect(hero?.choices[0]?.values).toContain("photo");
  const classes = selectedSection(picked("section:home.classes"), spec);
  expect(classes?.label).toBe("Classes");
  expect(classes?.choices.map((choice) => [choice.key, choice.current])).toEqual([
    ["layout", "list"],
    ["columns", "3"],
    ["band", "none"],
  ]);
  expect(selectedSection(picked("section:home.story"), spec)?.choices).toEqual([]);
  expect(selectedSection(picked("section:home.missing"), spec)).toBeUndefined();
  expect(selectedSection(picked("text:pages.home.hero.title"), spec)).toBeUndefined();
});
