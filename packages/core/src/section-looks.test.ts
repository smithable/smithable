import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateSpec } from "./spec.js";
import { validateUx } from "./ux.js";

const spec = `smithable: 0.1
app: { name: Site }
models:
  Item: { fields: { name: string! } }
pages:
  home:
    route: /
    landing:
      hero:
      features:
      items: { records: Item }
      faq:
      footer:
  items: { crud: Item }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
if (!ir) throw new Error("no ir");
const ux = (sections: string) =>
  validateUx(
    {
      path: "smithable.ux.yml",
      text: `smithableUx: 0.1\npages:\n  home:\n    sections: ${sections}\n`,
    },
    ir,
  );

test("each section kind takes its own looks, checked by name and value", () => {
  const read = ux(
    "{ hero: { layout: split, image: left }, features: { columns: 4 }, items: { layout: grid }, faq: { layout: list } }",
  );
  expect(read.diagnostics).toEqual([]);
  expect(read.ux?.pages.home?.looks).toEqual({
    hero: { layout: "split", image: "left" },
    features: { columns: 4 },
    items: { layout: "grid" },
    faq: { layout: "list" },
  });
  const messages = ux(
    "{ hero: { layout: wavy }, footer: { layout: list }, nope: {} }",
  ).diagnostics.map((d) => d.message);
  expect(messages).toContain(
    '"layout" of the look of hero on page "home" is one of split, centered, plain, cover.',
  );
  expect(messages.join()).toContain('Unknown key "layout" in the look of footer');
  expect(messages).toContain('home has no section named "nope".');
  const notLanding = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\npages:\n  items: { sections: { hero: {} } }\n",
    },
    ir,
  ).diagnostics[0]?.message;
  expect(notLanding).toBe('"sections" are looks of a page\'s sections; items has none.');
});

test("setSectionLook writes a look, default removes it, a wrong value is refused; a removed section's look goes too", () => {
  const set = applyOperation({ spec }, "setSectionLook", {
    page: "home",
    section: "features",
    key: "columns",
    value: "2",
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.ux).toContain("columns: 2");
  const back = applyOperation(set.files, "setSectionLook", {
    page: "home",
    section: "features",
    key: "columns",
    value: "default",
  });
  expect(back.ok && back.files.ux).not.toContain("columns");
  expect(
    applyOperation({ spec }, "setSectionLook", {
      page: "home",
      section: "faq",
      key: "layout",
      value: "grid",
    }),
  ).toMatchObject({ ok: false });
  const faq = applyOperation({ spec }, "setSectionLook", {
    page: "home",
    section: "faq",
    key: "layout",
    value: "list",
  });
  if (!faq.ok) throw new Error(faq.message);
  const removed = applyOperation(faq.files, "removeSection", { page: "home", section: "faq" });
  expect(removed.ok && removed.files.ux).not.toContain("faq");
});

test("a landing page may have a theme of its own, set with setTheme --page; other pages may not", () => {
  const read = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\ntheme: { preset: corporate }\npages:\n  home: { theme: { preset: playful, brand: { font: Nunito Sans } } }\n",
    },
    ir,
  );
  expect(read.diagnostics).toEqual([]);
  // A preset brings its own density and motion unless the file sets them: corporate is
  // compact, playful lively.
  expect(read.ux?.pages.home?.theme).toEqual({
    preset: "playful",
    font: "Nunito Sans",
    density: "comfortable",
    motion: "lively",
  });
  expect(read.ux?.theme.preset).toBe("corporate");
  expect(read.ux?.theme.density).toBe("compact");
  expect(read.ux?.theme.motion).toBe("subtle");
  const crud = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\npages:\n  items: { theme: { preset: playful } }\n",
    },
    ir,
  ).diagnostics[0]?.message;
  expect(crud).toBe("A theme of its own is for a landing page; items is not one.");
  const set = applyOperation({ spec }, "setTheme", { page: "home", preset: "playful" });
  if (!set.ok) throw new Error(set.message);
  expect(set.description).toBe("Use the Playful theme on the home page");
  expect(set.files.ux).toContain("home:\n    theme:\n      preset: playful");
  const back = applyOperation(set.files, "setTheme", { page: "home", preset: "none" });
  expect(back.ok && back.files.ux).not.toContain("playful");
  expect(applyOperation({ spec }, "setTheme", { page: "items", preset: "playful" })).toMatchObject({
    ok: false,
  });
});

test("motion is a theme value: the preset's own, the ux file's over it, set with setTheme --motion", () => {
  const read = (text: string) =>
    validateUx({ path: "smithable.ux.yml", text: `smithableUx: 0.1\n${text}` }, ir).ux?.theme
      .motion;
  expect(read("theme: { preset: modern }\n")).toBe("subtle");
  expect(read("theme: { preset: playful }\n")).toBe("lively");
  expect(read("theme: { preset: playful, motion: none }\n")).toBe("none");
  const set = applyOperation({ spec }, "setTheme", { motion: "lively" });
  if (!set.ok) throw new Error(set.message);
  expect(set.description).toBe("Set the look: lively motion");
  const still = applyOperation({ spec }, "setTheme", { motion: "none" });
  expect(still).toMatchObject({ ok: true, description: "Set the look: no motion" });
  expect(set.files.ux).toContain("motion: lively");
});
