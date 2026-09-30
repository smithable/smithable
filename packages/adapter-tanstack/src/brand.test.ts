import { contrast, hexToRgb, type ThemeIR, type ThemePreset, themeNamed } from "@smithable/core";
import { describe, expect, test } from "vitest";
import { brandColors } from "./brand.js";

const examples = JSON.parse(
  Object.values(
    import.meta.glob("../../../docs/design/delivery/02-tokens/brand-examples.json", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  )[0] as string,
) as {
  theme: ThemePreset;
  mode: "light" | "dark";
  input: string;
  derived: Record<string, string>;
}[];

/** Colours match when every 8-bit channel is within 1 (rounding differences). */
const close = (a: string, b: string) =>
  hexToRgb(a).every((v, i) => Math.abs(v - (hexToRgb(b)[i] as number)) * 255 <= 1.01);

describe("the design system's brand examples", () => {
  test.each(examples.map((e) => [`${e.input} in ${e.theme} ${e.mode}`, e]))("%s", (_, example) => {
    const colors = brandColors(example.input, themeNamed(example.theme) as ThemeIR, example.mode);
    for (const [role, expected] of Object.entries(example.derived)) {
      const actual = colors[role as keyof typeof colors];
      expect(close(actual, expected), `${role}: ${actual}, expected ${expected}`).toBe(true);
    }
    expect(contrast(colors.primary, colors["primary-foreground"])).toBeGreaterThanOrEqual(4.5);
  });
});
