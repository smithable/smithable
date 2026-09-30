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
  expect(read.ux?.pages.home?.sections).toEqual({
    hero: { layout: "split", image: "left" },
    features: { columns: 4 },
    items: { layout: "grid" },
    faq: { layout: "list" },
  });
  const messages = ux(
    "{ hero: { layout: wavy }, footer: { layout: list }, nope: {} }",
  ).diagnostics.map((d) => d.message);
  expect(messages).toContain(
    '"layout" of the look of hero on page "home" is one of split, centered, plain.',
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
  expect(notLanding).toBe('"sections" is for a landing page; items is not one.');
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
