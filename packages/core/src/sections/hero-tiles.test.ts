import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateContent } from "../content.js";
import { validateSpec } from "../spec.js";
import { validateUx } from "../ux.js";

const spec = (shortcuts: string) => `smithable: 0.1
app: { name: Shop }
models:
  Item: { fields: { name: string! } }
pages:
  home:
    route: /
    landing:
      hero: { button: items, shortcuts: [${shortcuts}] }
      footer: {}
  about:
    landing:
      hero: {}
  items: { crud: Item }
  extra: { crud: Item }
  more: { crud: Item }
`;
const ir = (shortcuts: string) => {
  const read = validateSpec({ path: "smithable.yml", text: spec(shortcuts) }).ir;
  if (!read) throw new Error("the shop does not read");
  return read;
};
const tiles = "smithableUx: 0.1\npages: { home: { sections: { hero: { layout: tiles } } } }\n";

test("a tiles hero draws its shortcuts as tiles: two or three (A 215)", () => {
  expect(
    validateUx({ path: "smithable.ux.yml", text: tiles }, ir("items, about"), []).diagnostics,
  ).toEqual([]);
  expect(
    validateUx({ path: "smithable.ux.yml", text: tiles }, ir("items, about, extra"), [])
      .diagnostics,
  ).toEqual([]);
  for (const few of ["items", "items, about, extra, more"])
    expect(
      validateUx({ path: "smithable.ux.yml", text: tiles }, ir(few), []).diagnostics.map(
        (d) => d.message,
      ),
    ).toEqual([
      `A tiles hero shows its shortcuts as tiles, two or three; home's hero has ${few.split(",").length}.`,
    ]);
});

test("the content file dresses each tile by its shortcut's page; another page is refused; a rename follows", () => {
  const content = (tilesText: string) =>
    validateContent(
      {
        path: "smithable.content.yml",
        text: `smithableContent: 0.1\npages:\n  home:\n    hero:\n      tiles:\n${tilesText}`,
      },
      ir("items, about"),
    );
  const dressed = content(
    "        items: { label: Everything we sell, image: { src: images/items.webp, alt: Shelves } }\n",
  );
  expect(dressed.diagnostics).toEqual([]);
  expect(dressed.content?.pages.home?.sections?.hero?.tiles).toEqual({
    items: { label: "Everything we sell", image: { src: "images/items.webp", alt: "Shelves" } },
  });
  expect(
    content("        extra: { label: Not a shortcut }\n").diagnostics.map((d) => d.code),
  ).toEqual(["unknown-shortcut"]);
  const renamed = applyOperation(
    {
      spec: spec("items, about"),
      content:
        "smithableContent: 0.1\npages:\n  home:\n    hero:\n      tiles:\n        items: { label: All }\n",
    },
    "renamePage",
    { from: "items", to: "catalog" },
  );
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.content).toContain("catalog: { label: All }");
});
