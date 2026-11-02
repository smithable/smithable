import { expect, test } from "vitest";
import { lookImpact } from "./look-impact.js";
import { validateSpec } from "./spec.js";
import { type ThemeIR, themeNamed } from "./theme.js";
import { validateUx } from "./ux.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: "smithable: 0.1\napp: {name: Things}\nmodels: {Item: {fields: {name: string!}}}\npages:\n  home: {route: /, landing: {hero: {}, catalog: {records: Item}}}\n  items: {crud: Item}\n",
}).ir;
if (!ir) throw new Error("invalid fixture");
const base = themeNamed("modern") as ThemeIR;
const direction: ThemeIR = {
  ...base,
  name: "direction",
  source: "project",
  defaults: { app: { navigation: "topbar" }, sections: { hero: { layout: "cover" } } },
};
const read = (text: string, theme = direction) => {
  const result = validateUx(
    { path: "smithable.ux.yml", text: "smithableUx: 0.1\ntheme: {preset: direction}\n" + text },
    ir,
    [theme],
  );
  if (!result.ux) throw new Error(JSON.stringify(result.diagnostics));
  return result.ux;
};
test("effective structural defaults classify; masked defaults and token edits retain the CSS path", () => {
  const old = read("navigation: sidebar\npages: {home: {sections: {hero: {layout: split}}}}\n");
  expect(lookImpact(old, old, [direction], [{ ...direction, radius: "22px" }])).toEqual({
    kind: "css",
    reasons: [],
  });
  expect(lookImpact(old, read(""), [direction], [direction])).toMatchObject({
    kind: "structural",
    reasons: expect.arrayContaining(["Menu layout", "home: Section composition"]),
  });
  const changed = {
    ...direction,
    defaults: { app: { navigation: "topbar-centered" }, sections: { hero: { layout: "photo" } } },
  };
  expect(
    lookImpact(
      old,
      read("navigation: sidebar\npages: {home: {sections: {hero: {layout: split}}}}\n", changed),
      [direction],
      [changed],
    ).kind,
  ).toBe("css");
});
test("existing generated section banding and root appearance topology classify too", () => {
  const ux = read("");
  const banded: ThemeIR = {
    ...direction,
    style: { ...direction.style, surfaces: { ...direction.style.surfaces, sections: "banded" } },
  };
  expect(lookImpact(ux, ux, [direction], [banded]).reasons).toContain("Section banding");
  expect(lookImpact(ux, ux, [direction], [{ ...direction, modes: "light" }]).reasons).toContain(
    "Appearance controls",
  );
});
