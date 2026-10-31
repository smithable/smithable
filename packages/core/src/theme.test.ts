import { expect, test } from "vitest";
import { contrast, hexOf } from "./color.js";
import { validateSpec } from "./spec.js";
import {
  BUILT_IN_THEMES,
  checkContrast,
  FONTS,
  hardToRead,
  lowContrast,
  oppositeMode,
  parseTheme,
  type Tokens,
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

test("the nineteen built-in themes read in both modes, each under its own name", () => {
  const names = BUILT_IN_THEMES.map((t) => t.name);
  expect(names).toEqual([...THEME_PRESETS]);
  expect(names).toHaveLength(19);
  expect(new Set(names).size).toBe(19);
  expect(names.slice(0, 4)).toEqual(["modern", "minimal", "playful", "corporate"]);
  for (const theme of BUILT_IN_THEMES) {
    expect(theme.source).toBe("built-in");
    expect(FONTS, theme.name).toContain(theme.font);
    expect(checkContrast(theme.light), `${theme.name} light`).toEqual([]);
    expect(checkContrast(theme.dark), `${theme.name} dark`).toEqual([]);
  }
});

test("the theme library's fifteen are theme files a project could have written", () => {
  expect(Object.keys(THEME_LIBRARY)).toEqual(THEME_PRESETS.slice(4));
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
  expect(parse(`${forest}density: standard\n`).theme?.density).toBe("standard");
  expect(parse(`${forest}density: tight\n`).diagnostics.map((d) => d.message)).toEqual([
    '"density" is comfortable, standard or compact.',
  ]);
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
  // A bright primary keeps its color; the focus ring made from it steps darker until it shows.
  const bright = parse(forest.replace('  primary: "#2f6b3a"', '  primary: "#ffcc00"'));
  expect(bright.diagnostics).toEqual([]);
  expect(bright.theme?.light.primary).toBe("#ffcc00");
  expect(
    contrast(bright.theme?.light.ring as string, bright.theme?.light.card as string),
  ).toBeGreaterThanOrEqual(3);
  expect(light.ring).toBe("#2f6b3a");
});

test("a theme that may not read applies with a plain warning; one that is not a theme is refused", () => {
  const paleText = forest.replace('  foreground: "#1f2a1f"', '  foreground: "#c0c8c0"');
  const pale = parse(paleText);
  // The colours are the person's choice (Johan, 2026-10-25): said in plain words, never refused.
  expect(pale.theme).toBeDefined();
  const said = pale.diagnostics.find((d) => d.code === "theme-contrast");
  expect(said?.severity).toBe("warning");
  expect(said?.message).toBe("In light mode, the text on the page may be hard to read.");
  // Only the candidates script asks for a refusal, to drop the unreadable.
  expect(
    parseTheme({ path: "themes/forest.yml", text: paleText }, { contrast: "error" }).theme,
  ).toBeUndefined();
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

test("for the theme lab, text that may not read is a warning: the theme is made and every colour applies", () => {
  const text = forest.replace('  foreground: "#1f2a1f"', '  foreground: "#c0c8c0"');
  const lab = parseTheme({ path: "themes/forest.yml", text });
  expect(lab.theme).toBeDefined();
  const said = lab.diagnostics.find((d) => d.code === "theme-contrast");
  expect(said?.severity).toBe("warning");
  // The pairs, for the lab to say in its own words.
  expect(lowContrast(lab.theme?.light as Tokens)).toContainEqual(
    expect.objectContaining({ text: "foreground", on: "background", needed: 4.5 }),
  );
});

test("a ratio just under the one needed is rounded down, never shown as reaching it", () => {
  // #767676 on white is 4.54:1; #777777 on white is 4.48:1, which toFixed(1) would print as 4.5.
  const tokens = {
    ...BUILT_IN_THEMES[0]?.light,
    foreground: "#777777",
    background: "#ffffff",
  } as Tokens;
  expect(checkContrast(tokens).find((p) => p.startsWith("foreground on background"))).toBe(
    "foreground on background is 4.4:1; it needs 4.5:1 to read.",
  );
});

test("the other mode made from one mode keeps the hues, turns the lightness over, and reads", () => {
  // Every built-in theme, both ways: the made mode passes the floor a theme file is checked by.
  for (const t of BUILT_IN_THEMES) {
    expect(hardToRead(oppositeMode(t.light, "light"), "dark"), `${t.name} dark`).toEqual([]);
    expect(hardToRead(oppositeMode(t.dark, "dark"), "light"), `${t.name} light`).toEqual([]);
  }
  const forest = parseTheme({
    path: "themes/forest.yml",
    text: `smithableTheme: 0.1\nmodes: light\nlight: { primary: "#2f6b3a", background: "#f6f8f4", foreground: "#1f2a1f" }\n`,
  }).theme as { light: Tokens };
  const dark = oppositeMode(forest.light, "light");
  // Deep paper of the same tint, pale ink, the green kept and lifted to show on it.
  expect(contrast(dark.foreground, dark.background)).toBeGreaterThan(10);
  expect(contrast(dark.primary, dark.background)).toBeGreaterThanOrEqual(3);
  expect(contrast(dark["primary-foreground"], dark.primary)).toBeGreaterThanOrEqual(4.5);
  const [l] = ((hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255)];
  })(dark.background);
  expect(l).toBeLessThan(3 * 70);
  // An ink primary (stillwater's) turns to a pale one on dark paper, still its own text's colour.
  const ink = oppositeMode(
    { ...forest.light, primary: "#16181a", "primary-foreground": "#ffffff" } as Tokens,
    "light",
  );
  expect(contrast(ink.primary, ink.background)).toBeGreaterThanOrEqual(3);
  // Back again from dark gives light paper and dark ink.
  const back = oppositeMode(dark, "dark");
  expect(contrast(back.foreground, back.background)).toBeGreaterThan(10);
  expect(hardToRead(back, "light")).toEqual([]);
});
