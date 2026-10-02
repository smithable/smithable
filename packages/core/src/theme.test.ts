import { expect, test } from "vitest";
import { contrast, hexOf } from "./color.js";
import { validateSpec } from "./spec.js";
import { BUILT_IN_THEMES, checkContrast, parseTheme, themeNamed, themeThumbnail } from "./theme.js";
import { validateUx } from "./ux.js";

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

test("the built-in themes read in both modes", () => {
  expect(BUILT_IN_THEMES.map((t) => t.name)).toEqual(["modern", "minimal", "playful", "corporate"]);
  for (const theme of BUILT_IN_THEMES) {
    expect(checkContrast(theme.light), `${theme.name} light`).toEqual([]);
    expect(checkContrast(theme.dark), `${theme.name} dark`).toEqual([]);
  }
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
  });
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
  const wrong = parse("smithableTheme: 0.1\nfont: Comic Sans\nlight: { background: red }\n");
  expect(wrong.diagnostics.map((d) => d.code).sort()).toEqual([
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
    hint: "Available: modern, minimal, playful, corporate.",
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
