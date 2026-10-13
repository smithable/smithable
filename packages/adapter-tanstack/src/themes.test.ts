import { emptyUx, FONTS } from "@smithable/core";
import { expect, test } from "vitest";
import { FONT_PACKAGES, themeCss } from "./themes.js";

test("the owner's switch for the AI badge (aiBadge: false) hides every mark", () => {
  expect(themeCss(emptyUx())).not.toContain("ai-mark");
  expect(themeCss({ ...emptyUx(), aiBadge: false })).toContain(
    '[data-part="ai-mark"] {\n  display: none;',
  );
});

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

test("every font a theme may name is one the app can host: it has a package", () => {
  for (const font of FONTS) expect(FONT_PACKAGES[font], font).toBeTruthy();
});

test("a theme's style is one variable per field; the presets read as before by the defaults", () => {
  const css = (preset: string) =>
    themeCss({ ...emptyUx(), theme: { ...emptyUx().theme, preset: preset as never } });
  const root = (text: string, name: string) =>
    new RegExp(`:root \\{[^}]*--${name}: ([^;]+);`).exec(text)?.[1];
  const modern = css("modern");
  expect(root(modern, "heading-weight")).toBe("700");
  expect(root(modern, "heading-tracking")).toBe("-0.02em");
  expect(root(modern, "card-border")).toBe("1px");
  expect(root(modern, "button-radius")).toBe("calc(var(--radius) - 2px)");
  expect(root(css("playful"), "card-border")).toBe("0");
  expect(root(css("playful"), "button-radius")).toBe("9999px");
  expect(root(css("corporate"), "table-numbers")).toBe("tabular-nums");
  // Street food: capitals tracked wide, its heading font imported beside the body's.
  const street = css("street-food");
  expect(root(street, "heading-case")).toBe("uppercase");
  expect(root(street, "heading-tracking")).toBe("0.05em");
  expect(root(street, "font-heading")).toContain("Archivo Narrow Variable");
  expect(street).toContain('@import "@fontsource-variable/archivo-narrow";');
  expect(street).toContain('@import "@fontsource-variable/dm-sans";');
});

test("the theme's motion is a few variables, all 0 for a visitor who asks for less", () => {
  const css = (motion: "none" | "subtle" | "lively") =>
    themeCss({ ...emptyUx(), theme: { ...emptyUx().theme, motion } });
  const slow = (text: string) => /:root \{[^}]*--motion-slow: ([^;]+);/.exec(text)?.[1];
  expect(slow(css("none"))).toBe("0ms");
  expect(slow(css("subtle"))).toBe("180ms");
  expect(slow(css("lively"))).toBe("200ms");
  expect(css("lively")).toMatch(
    /@media \(prefers-reduced-motion: reduce\) \{\s*:root \{\s*--motion-fast: 0ms;\s*--motion-slow: 0ms;\s*--motion-distance: 0px;/,
  );
});
