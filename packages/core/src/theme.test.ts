import { expect, test } from "vitest";
import { contrast, hexOf } from "./color.js";
import { validateSpec } from "./spec.js";
import {
  BUILT_IN_THEMES,
  checkContrast,
  FONTS,
  parseTheme,
  themeNamed,
  themeThumbnail,
  withBackground,
} from "./theme.js";
import { THEME_LIBRARY } from "./theme-library.js";
import { emptyUx, THEME_PRESETS, validateUx } from "./ux.js";

const forest = `smithableTheme: 0.1
name: forest
font: Nunito Sans
radius: 12px
shadow: soft
light:
  primary: "#2f6b3a"
  background: "#f6f8f4"
  foreground: "#1f2a1f"
dark:
  primary: "#8fd19a"
  background: "#141a14"
  foreground: "#e6ece4"
`;
const parse = (text: string) => parseTheme({ path: "themes/forest.yml", text });

test("the twenty built-in themes read in both modes, each under its own name", () => {
  const names = BUILT_IN_THEMES.map((t) => t.name);
  expect(names).toEqual([...THEME_PRESETS]);
  expect(names).toHaveLength(20);
  expect(new Set(names).size).toBe(20);
  expect(names.slice(0, 4)).toEqual(["modern", "minimal", "playful", "corporate"]);
  for (const theme of BUILT_IN_THEMES) {
    expect(theme.source).toBe("built-in");
    expect(FONTS, theme.name).toContain(theme.font);
    expect(checkContrast(theme.light), `${theme.name} light`).toEqual([]);
    expect(checkContrast(theme.dark), `${theme.name} dark`).toEqual([]);
  }
});

test("the theme library's twelve are theme files a project could have written", () => {
  expect(Object.keys(THEME_LIBRARY)).toEqual(THEME_PRESETS.slice(8));
  for (const [name, text] of Object.entries(THEME_LIBRARY)) {
    const { theme, diagnostics } = parseTheme({ path: `themes/${name}.yml`, text });
    expect(diagnostics, name).toEqual([]);
    expect(theme?.name).toBe(name);
  }
  expect(emptyUx().theme.preset).toBe("modern");
});

test("a theme of three colors per mode gets the rest derived, and reads", () => {
  const { theme, diagnostics } = parse(forest);
  expect(diagnostics).toEqual([]);
  expect(theme).toMatchObject({
    name: "forest",
    source: "project",
    font: "Nunito Sans",
    radius: "12px",
    chroma: 0.22,
    motion: "subtle",
  });
  expect(parse(`${forest}motion: lively\n`).theme?.motion).toBe("lively");
  const light = theme?.light as Record<string, string>;
  expect(Object.keys(light)).toHaveLength(28);
  expect(light.primary).toBe("#2f6b3a");
  expect(light["primary-foreground"]).toBe("#ffffff");
  expect(
    contrast(light["muted-foreground"] as string, light.muted as string),
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    contrast(light["accent-foreground"] as string, light.accent as string),
  ).toBeGreaterThanOrEqual(4.5);
  expect(checkContrast(theme?.light as never)).toEqual([]);
  expect(checkContrast(theme?.dark as never)).toEqual([]);
  // Given tokens are kept; oklch values are accepted and turned into hex.
  const given = parse(
    forest.replace(
      '  primary: "#2f6b3a"',
      '  primary: "oklch(0.51 0.23 277)"\n  accent: "#ffeedd"',
    ),
  );
  expect(given.theme?.light.accent).toBe("#ffeedd");
  expect(given.theme?.light.primary).toBe(hexOf("oklch(0.51 0.23 277)"));
});

test("a theme that does not read, or is not a theme, is refused with the reason", () => {
  const pale = parse(forest.replace('  foreground: "#1f2a1f"', '  foreground: "#c0c8c0"'));
  expect(pale.theme).toBeUndefined();
  expect(pale.diagnostics.map((d) => d.code)).toContain("theme-contrast");
  expect(pale.diagnostics.find((d) => d.code === "theme-contrast")?.message).toMatch(
    /foreground on background is [\d.]+:1; it needs 4.5:1/,
  );
  const wrong = parse(
    "smithableTheme: 0.1\nfont: Comic Sans\nmotion: bouncy\nlight: { background: red }\n",
  );
  expect(wrong.diagnostics.map((d) => d.code).sort()).toEqual([
    "invalid-value",
    "invalid-value",
    "invalid-value",
    "missing-key",
    "missing-key",
    "missing-key",
    "missing-key",
  ]);
});

test("the ux file may name a project theme, and says which exist when it cannot", () => {
  const ir = validateSpec({ path: "smithable.yml", text: "smithable: 0.1\napp: { name: A }\n" }).ir;
  const theme = parse(forest).theme;
  if (!ir || !theme) throw new Error("setup");
  expect(
    validateUx(
      { path: "smithable.ux.yml", text: "smithableUx: 0.1\ntheme: { preset: forest }\n" },
      ir,
      [theme],
    ).ux?.theme.preset,
  ).toBe("forest");
  const missing = validateUx(
    { path: "smithable.ux.yml", text: "smithableUx: 0.1\ntheme: { preset: forest }\n" },
    ir,
  );
  expect(missing.diagnostics[0]).toMatchObject({
    code: "unknown-preset",
    hint: `Available: ${THEME_PRESETS.join(", ")}.`,
  });
  expect(themeNamed("forest", [theme])?.source).toBe("project");
  expect(themeNamed("modern", [{ ...theme, name: "modern" }])?.source).toBe("project");
});

test("a theme's picture is drawn from its tokens", () => {
  const svg = themeThumbnail(parse(forest).theme as never);
  expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
  expect(svg).toContain('fill="#2f6b3a"');
  expect(svg).toContain('font-family="Nunito Sans, sans-serif"');
  expect(svg).toContain("forest");
});

test("an owner's background: a wash in light mode and a deep one in dark, everything on it readable", () => {
  for (const name of ["modern", "minimal", "playful", "corporate"]) {
    const theme = themeNamed(name);
    if (!theme) throw new Error(name);
    // A beige, a loud red and a near-black all become quiet backgrounds of their hue.
    for (const color of ["#f5efe6", "#e11d48", "#0b1020"]) {
      const out = withBackground(theme, color);
      if (!out) throw new Error(`${name} ${color}`);
      expect(checkContrast(out.light)).toEqual([]);
      expect(checkContrast(out.dark)).toEqual([]);
      expect(contrast(hexOf(out.light.background), "#000000")).toBeGreaterThan(17);
      expect(contrast(hexOf(out.dark.background), "#ffffff")).toBeGreaterThan(14);
      // The primary and the states are the theme's own.
      expect(out.light.primary).toBe(theme.light.primary);
      expect(out.dark.success).toBe(theme.dark.success);
    }
  }
});

test("the ux file's background: a color, set by setTheme, refused when not a color", () => {
  const ir = validateSpec({ path: "smithable.yml", text: "smithable: 0.1\napp: { name: A }\n" }).ir;
  if (!ir) throw new Error("setup");
  const read = (theme: string) =>
    validateUx({ path: "smithable.ux.yml", text: `smithableUx: 0.1\ntheme: ${theme}\n` }, ir);
  expect(read('{ brand: { background: "#F5EFE6" } }').ux?.theme.background).toBe("#f5efe6");
  expect(read("{ brand: { background: beige } }").diagnostics[0]).toMatchObject({
    code: "invalid-color",
    message: '"background" must be a color like "#2563eb".',
  });
});
