import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateSpec } from "./spec.js";
import { themeNamed } from "./theme.js";
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
      gallery:
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
    "{ hero: { layout: split, image: left }, features: { columns: 6 }, items: { layout: grid, columns: 5 }, faq: { layout: list, columns: 2 }, gallery: { columns: 4 } }",
  );
  expect(read.diagnostics).toEqual([]);
  expect(read.ux?.pages.home?.looks).toEqual({
    hero: { layout: "split", image: "left" },
    features: { columns: 6 },
    items: { layout: "grid", columns: 5 },
    faq: { layout: "list", columns: 2 },
    gallery: { columns: 4 },
  });
  expect(ux("{ items: { columns: 7 } }").diagnostics.map((d) => d.message)).toContain(
    '"columns" of the look of items on page "home" is one of 3, 2, 4, 5, 6.',
  );
  expect(ux("{ faq: { columns: 3 } }").diagnostics.map((d) => d.message)).toContain(
    '"columns" of the look of faq on page "home" is one of 1, 2.',
  );
  // An FAQ's columns are its list's: with the accordion they are a warning, not an error.
  const accordion = ux("{ faq: { columns: 2 } }").diagnostics;
  expect(accordion.map((d) => [d.severity, d.message])).toEqual([
    [
      "warning",
      '"columns" of the look of faq on page "home" is for the list layout; the accordion is one column.',
    ],
  ]);
  expect(ux("{ items: { layout: list, columns: 4 } }").diagnostics.map((d) => d.severity)).toEqual([
    "warning",
  ]);
  const messages = ux(
    "{ hero: { layout: wavy }, footer: { layout: list }, nope: {} }",
  ).diagnostics.map((d) => d.message);
  expect(messages).toContain(
    '"layout" of the look of hero on page "home" is one of split, centered, plain, cover, photo.',
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
  // A page's density likewise: a third value, and "none" returns it to the app's.
  const dense = applyOperation({ spec }, "setTheme", { page: "home", density: "standard" });
  expect(dense.ok && dense.files.ux).toContain("home:\n    theme:\n      density: standard");
  const undense = applyOperation(dense.ok ? dense.files : { spec }, "setTheme", {
    page: "home",
    density: "none",
  });
  expect(undense.ok && undense.files.ux).not.toContain("density");
  expect(applyOperation({ spec }, "setTheme", { density: "none" })).toMatchObject({
    ok: false,
    message: expect.stringContaining("comfortable, standard or compact"),
  });
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

test("a section's band is none, muted, inverse or primary, on every kind but the hero and the footer", () => {
  const read = ux(
    "{ hero: { layout: photo }, features: { band: muted }, items: { band: inverse }, faq: { band: primary }, gallery: { band: none } }",
  );
  expect(read.diagnostics).toEqual([]);
  expect(read.ux?.pages.home?.looks).toEqual({
    hero: { layout: "photo" },
    features: { band: "muted" },
    items: { band: "inverse" },
    faq: { band: "primary" },
    gallery: { band: "none" },
  });
  const messages = ux("{ hero: { band: muted }, footer: { band: muted }, faq: { band: dark } }")
    .diagnostics.map((d) => d.message)
    .join("\n");
  expect(messages).toContain('Unknown key "band" in the look of hero');
  expect(messages).toContain('Unknown key "band" in the look of footer');
  expect(messages).toContain(
    '"band" of the look of faq on page "home" is one of none, muted, inverse, primary.',
  );
  const set = applyOperation({ spec }, "setSectionLook", {
    page: "home",
    section: "faq",
    key: "band",
    value: "inverse",
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.ux).toContain("band: inverse");
});

test("a band whose text would not read on its surface is a warning, in the mode it fails in", () => {
  const modern = themeNamed("modern");
  if (!modern) throw new Error("no modern");
  // A project's theme whose muted surface is nearly as dark as its text in light mode.
  const murky = { ...modern, name: "murky", light: { ...modern.light, muted: "#3a3a3a" } };
  const read = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\ntheme: { preset: murky }\npages:\n  home:\n    sections: { features: { band: muted }, faq: { band: primary } }\n",
    },
    ir,
    [murky],
  );
  expect(read.ux).toBeDefined();
  // One plain warning per band and mode, however many of its pairs fail.
  expect(read.diagnostics.map((d) => [d.severity, d.code])).toEqual([["warning", "band-contrast"]]);
  expect(read.diagnostics[0]?.message).toMatch(
    /^On the muted band of features \(page "home"\), in light mode, the text may be hard to read\.$/,
  );
  // The built-in themes' bands all read.
  expect(
    ux("{ features: { band: muted }, items: { band: inverse }, faq: { band: primary } }")
      .diagnostics,
  ).toEqual([]);
});

test("a landing page's header stays or scrolls: header position, set with setSectionLook home header", () => {
  const read = (text: string) =>
    validateUx({ path: "smithable.ux.yml", text: `smithableUx: 0.1\npages:\n${text}` }, ir);
  // Nothing said is the header's own look, the first value: sticky (the kit's default).
  expect(read("  home: { icon: home }\n").ux?.pages.home?.header).toBeUndefined();
  const scrolling = read("  home: { header: { position: scrolling } }\n");
  expect(scrolling.diagnostics).toEqual([]);
  expect(scrolling.ux?.pages.home?.header).toEqual({ position: "scrolling" });
  expect(
    read("  home: { header: { position: fixed } }\n").diagnostics.map((d) => d.message),
  ).toEqual(['"position" of the header of page "home" is one of sticky, scrolling.']);
  expect(read("  home: { header: { size: big } }\n").diagnostics[0]?.message).toContain(
    'Unknown key "size" in the header of page "home"',
  );
  expect(read("  items: { header: { position: sticky } }\n").diagnostics[0]?.message).toBe(
    "A header's look is for a landing page; items is not one.",
  );
  const set = applyOperation({ spec }, "setSectionLook", {
    page: "home",
    section: "header",
    key: "position",
    value: "scrolling",
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.ux).toContain("home:\n    header:\n      position: scrolling");
  const back = applyOperation(set.files, "setSectionLook", {
    page: "home",
    section: "header",
    key: "position",
    value: "default",
  });
  expect(back.ok && back.files.ux).not.toContain("header");
  expect(
    applyOperation({ spec }, "setSectionLook", {
      page: "home",
      section: "header",
      key: "position",
      value: "fixed",
    }),
  ).toMatchObject({ ok: false, message: '"position" of a header is one of sticky, scrolling.' });
  expect(
    applyOperation({ spec }, "setSectionLook", {
      page: "items",
      section: "header",
      key: "position",
      value: "sticky",
    }),
  ).toMatchObject({ ok: false });
});
