import {
  BUILT_IN_THEMES,
  hexOf,
  parseTheme,
  type ThemeIR,
  TOKEN_NAMES,
  withBackground,
} from "@smithable/core";
import { expect, test } from "vitest";
import { getField, resetColors, setField, themeText } from "./theme-text";

test("every built-in theme, written as a file to start from, reads back as itself", () => {
  for (const theme of BUILT_IN_THEMES) {
    const { theme: read, diagnostics } = parseTheme({
      path: `themes/${theme.name}.yml`,
      text: themeText(theme),
    });
    expect(
      diagnostics.filter((d) => d.severity === "error"),
      theme.name,
    ).toEqual([]);
    const { font, radius, shadow, density, motion, chroma, style, modes } = theme;
    expect(read, theme.name).toMatchObject({
      font,
      radius,
      shadow,
      density,
      motion,
      chroma,
      style,
      modes,
    });
    // The parser keeps a color as hex; the built-ins carry OKLCH.
    for (const mode of ["light", "dark"] as const) {
      if (theme.modes !== "both" && theme.modes !== mode) continue;
      for (const token of TOKEN_NAMES)
        expect(hexOf(read?.[mode][token] ?? ""), `${theme.name}.${mode}.${token}`).toBe(
          hexOf(theme[mode][token]),
        );
    }
  }
});

test("a field is set where the file says it: the body font as font or fonts.body", () => {
  expect(setField("name: x\nfont: Inter\n", ["fonts", "body"], "DM Sans")).toBe(
    "name: x\nfont: DM Sans\n",
  );
  expect(setField("name: x\n", ["fonts", "body"], "DM Sans")).toBe(
    "name: x\nfonts:\n  body: DM Sans\n",
  );
  // A heading font set back to the body's is taken out of the file.
  expect(
    setField("fonts:\n  body: Inter\n  heading: Fraunces\n", ["fonts", "heading"], undefined),
  ).toBe("fonts:\n  body: Inter\n");
});

test("a field reads back as the file has it, also one the checks would refuse", () => {
  const text = setField(themeText(BUILT_IN_THEMES[0] as ThemeIR), ["dark", "primary"], "#151a28");
  expect(getField(text, ["dark", "primary"])).toBe("#151a28");
  expect(getField(text, ["fonts", "body"])).toBe("Inter");
  expect(getField(text, ["dark", "nothing"])).toBeUndefined();
});

test("corporate exceptions survive an unrelated edit; derived colours still follow primary", () => {
  const theme = BUILT_IN_THEMES.find((t) => t.name === "corporate") as ThemeIR;
  const text = setField(themeText(theme), ["radius"], "18px");
  const read = parseTheme({ path: "corporate.yml", text }).theme as ThemeIR;
  expect(hexOf(read.light.sidebar)).toBe("#102e42");
  for (const mode of ["light", "dark"] as const)
    for (const token of TOKEN_NAMES)
      expect(hexOf(read[mode][token]), `${mode}.${token}`).toBe(hexOf(theme[mode][token]));
  const modern = themeText(BUILT_IN_THEMES[0] as ThemeIR);
  expect(getField(modern, ["light", "chart-1"])).toBeUndefined();
  const edited = parseTheme({
    path: "modern.yml",
    text: setField(modern, ["light", "primary"], "#553399"),
  }).theme;
  expect(edited?.light["chart-1"]).toBe("#553399");
});

test("source edits preserve comments and explicit colours until reset is requested", () => {
  const source = `${themeText(BUILT_IN_THEMES[0] as ThemeIR)}# my palette\n`;
  const custom = setField(
    setField(source, ["light", "sidebar"], "#102e42"),
    ["light", "chart-2"],
    "#448866",
  );
  const edit = setField(custom, ["light", "background"], "#f8f8f8");
  expect(edit).toContain("# my palette");
  expect(getField(edit, ["light", "sidebar"])).toBe("#102e42");
  expect(getField(edit, ["light", "chart-2"])).toBe("#448866");
  const reset = resetColors(edit, "light");
  expect(getField(reset, ["light", "sidebar"])).toBeUndefined();
  expect(getField(reset, ["light", "chart-2"])).toBeUndefined();
  expect(getField(reset, ["light", "background"])).toBe("#f8f8f8");
  for (const token of TOKEN_NAMES)
    expect(getField(reset, ["dark", token])).toEqual(getField(edit, ["dark", token]));
  expect(parseTheme({ path: "custom.yml", text: reset }).theme).toBeDefined();
});

test("app background overrides produce the same valid tokens before and after theme serialization", () => {
  for (const theme of BUILT_IN_THEMES) {
    const parsed = parseTheme({ path: "draft.yml", text: themeText(theme) }).theme;
    if (!parsed) throw new Error(theme.name);
    for (const background of ["#f5efe6", "#e11d48"]) {
      const original = withBackground(theme, background);
      const draft = withBackground(parsed, background);
      expect(!!draft, theme.name).toBe(!!original);
      if (!original || !draft) continue;
      for (const mode of ["light", "dark"] as const) {
        if (theme.modes !== "both" && theme.modes !== mode) continue;
        for (const token of TOKEN_NAMES) {
          expect(hexOf(original[mode][token]), `${theme.name}.${mode}.${token}`).toMatch(
            /^#[0-9a-f]{6}$/i,
          );
          expect(hexOf(draft[mode][token]), `${theme.name}.${mode}.${token}`).toBe(
            hexOf(original[mode][token]),
          );
        }
      }
    }
  }
});
