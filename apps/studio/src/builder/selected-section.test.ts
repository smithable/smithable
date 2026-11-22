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
  // Placed by its measured height (T1179): a taller form (a hero's three rows) stays wholly on
  // the screen, its foot above the window's, inside a full-window hero as beside a small box.
  for (const height of [260, 420, 640]) {
    const inside = beside(box(0, 1440, 60, 1400), screen, 320, height);
    expect(inside.top + height).toBeLessThanOrEqual(screen.height - 12);
    expect(inside.top).toBeGreaterThanOrEqual(screen.top);
    const right = beside(box(100, 500, 700, 860), screen, 320, height);
    expect(right.top + height).toBeLessThanOrEqual(screen.height - 12);
  }
  expect(beside(box(0, 1440, 60, 1400), screen, 320, 420)).toEqual({ left: 1108, top: 468 });
  // Never under Studio's bar, however high the box sits.
  expect(beside(box(100, 500, -300, 120), screen, 320, 260).top).toBe(64);
});

const spec = {
  ir: {
    navigation: [],
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
    ["height", "default"],
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

test("a hero offers only the layouts it can take: tiles with two or three shortcuts, a stage with a list everyone sees", () => {
  const layouts = (hero: object, pages: object[] = [], current?: string) =>
    selectedSection(picked("section:home.hero"), {
      ir: {
        navigation: [{ pages: pages.map((p) => (p as { id: string }).id) }],
        pages: [{ id: "home", sections: [{ name: "hero", kind: "hero", ...hero }] }, ...pages],
      },
      ux: { pages: { home: { looks: current ? { hero: { layout: current } } : {} } } },
    } as unknown as Spec)?.choices[0]?.values;
  const list = { id: "classes", pattern: { kind: "crud" } };
  expect(layouts({})).not.toContain("tiles");
  expect(layouts({})).not.toContain("stage");
  expect(layouts({})).toContain("photo");
  expect(layouts({ shortcuts: ["a", "b"] })).toContain("tiles");
  expect(layouts({ shortcuts: ["a", "b", "c", "d"] })).not.toContain("tiles");
  expect(layouts({}, [list])).toContain("stage");
  // A list of the viewer's own records is no stage.
  expect(layouts({}, [{ ...list, mine: true }])).not.toContain("stage");
  // The layout it has is always there, so the form shows it chosen.
  expect(layouts({}, [], "tiles")).toContain("tiles");
});
