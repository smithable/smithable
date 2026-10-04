import { BUILT_IN_THEMES, emptyUx } from "@smithable/core";
import { expect, test } from "vitest";
import { FONT_PACKAGES, themeCss } from "./themes.js";

test("an owner's background goes in under the brand color, in both modes", () => {
  const ux = {
    ...emptyUx(),
    theme: { ...emptyUx().theme, background: "#f5efe6", primary: "#7c3aed" },
  };
  const css = themeCss(ux);
  const plain = themeCss({ ...ux, theme: { ...ux.theme, background: undefined } });
  // The light mode's background, then the dark mode's.
  const backgrounds = (text: string) =>
    [...text.matchAll(/--background: ([^;]+);/g)].map((m) => m[1]);
  const [light, dark] = backgrounds(css);
  const [plainLight, plainDark] = backgrounds(plain);
  expect(light).toBe("#f9f3ea");
  expect(dark).toBe("#130f09");
  expect([plainLight, plainDark]).not.toContain(light);
  // The brand's primary is the same with or without the background.
  const primary = (text: string) => /:root \{[^}]*--primary: ([^;]+);/.exec(text)?.[1];
  expect(primary(css)).toBe(primary(plain));
});

test("every built-in theme's font is one the app can host: it has a package", () => {
  for (const theme of BUILT_IN_THEMES)
    expect(FONT_PACKAGES[theme.font], `${theme.name}: ${theme.font}`).toBeTruthy();
});
