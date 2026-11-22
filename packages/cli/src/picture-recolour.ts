import { hexOf, hexToRgb, rgbToOklch } from "@smithable/core";

/** At or below this chroma, Ink wash pictures should stay as drawn. */
export const INK_WASH_GREYSCALE_CUTOFF = 0.02;

export function inkWashRule(chroma: number): "none" | "ink-wash-b90" {
  return chroma > INK_WASH_GREYSCALE_CUTOFF ? "ink-wash-b90" : "none";
}

/** Measure the colour in force using the same sRGB representation as the theme sheets. */
export function inkWashTreatment(effectivePrimary: string) {
  const primary = hexOf(effectivePrimary);
  const [, chroma] = rgbToOklch(hexToRgb(primary));
  const rule = inkWashRule(chroma);
  return { primary, chroma, rule, treatment: rule === "none" ? "as drawn" : "light tint" };
}
