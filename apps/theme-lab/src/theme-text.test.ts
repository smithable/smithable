import { BUILT_IN_THEMES, hexOf, parseTheme, type ThemeIR } from "@smithable/core";
import { expect, test } from "vitest";
import { getField, setField, themeText } from "./theme-text";

test("every built-in theme, written as a file to start from, reads back as itself", () => {
  for (const theme of BUILT_IN_THEMES) {
    const { theme: read, diagnostics } = parseTheme({
      path: `themes/${theme.name}.yml`,
      text: themeText(theme),
    });
    expect(diagnostics, theme.name).toEqual([]);
    const { font, radius, shadow, density, motion, chroma, style } = theme;
    expect(read, theme.name).toMatchObject({
      font,
      radius,
      shadow,
      density,
      motion,
      chroma,
      style,
    });
    // The parser keeps a color as hex; the built-ins carry OKLCH.
    expect(hexOf(read?.light.primary ?? ""), theme.name).toBe(hexOf(theme.light.primary));
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
