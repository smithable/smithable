import { expect, test } from "vitest";
import { tintInkWash } from "./ink-wash-raster.js";

const colours = { foreground: "#232323", background: "#f8f6ef", primary: "#006d66" };
const swatches = [
  [25, 22, 29, 255],
  [160, 124, 186, 255],
  [243, 239, 233, 255],
  [10, 177, 22, 0],
];

test("Ink wash keeps the alpha and original input while lightly tinting the visible pixels", () => {
  const pixels = Uint8ClampedArray.from(
    swatches.flatMap((colour) => Array.from({ length: 20 }, () => colour).flat()),
  );
  const before = pixels.slice();
  const result = tintInkWash(pixels, colours, 300);
  expect(pixels).toEqual(before);
  expect(result).toEqual(tintInkWash(pixels, colours, 300));
  expect("pixels" in result).toBe(true);
  if ("pixels" in result) {
    const { pixels: tinted } = result;
    expect(tinted.length).toBe(pixels.length);
    expect(tinted.slice(80, 84)).not.toEqual(pixels.slice(80, 84));
    expect(tinted.slice(80, 84)[0]).toBeGreaterThan(145);
    expect(tinted.slice(240)).toEqual(pixels.slice(240));
  }
});

test("the renderer falls back for a flat theme, flat picture, or absent wash", () => {
  const pixels = Uint8ClampedArray.from(
    swatches.flatMap((colour) => Array.from({ length: 20 }, () => colour).flat()),
  );
  expect(tintInkWash(pixels, { ...colours, foreground: "#f0f0f0" }, 300)).toEqual({
    reason: "theme",
  });
  expect(tintInkWash(pixels, colours, 100)).toEqual({ reason: "picture" });
  expect(tintInkWash(Uint8ClampedArray.from(swatches[0] ?? []), colours, 300)).toEqual({
    reason: "picture",
  });
});
