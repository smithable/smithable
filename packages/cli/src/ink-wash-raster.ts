import { clamp, hexOf, hexToRgb, type Oklab, oklabToRgb, rgbToOklab } from "@smithable/core";

export interface InkWashColours {
  foreground: string;
  background: string;
  primary: string;
}

const blendBack = 0.9;
const byteMax = 255;
const lightnessOf = (values: Float64Array, count: number, quantile: number) =>
  values.subarray(0, count).sort()[Math.floor(count * quantile)] as number;
const median = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1] as number;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixLab = (a: Oklab, b: Oklab, t: number): Oklab => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
  mix(a[2], b[2], t),
];
function themeLab(value: string): Oklab {
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(value);
  if (!match) return rgbToOklab(hexToRgb(hexOf(value)));
  const l = Number(match[1]);
  const c = Number(match[2]);
  const hue = (Number(match[3]) * Math.PI) / 180;
  return [l, c * Math.cos(hue), c * Math.sin(hue)];
}

/** The Ink wash b90 transform on decoded RGBA pixels (theme-pictures.md §3 and §10). */
export function tintInkWash(
  pixels: Uint8ClampedArray,
  colours: InkWashColours,
  washHue: number,
): { pixels: Uint8ClampedArray } | { reason: "theme" | "picture" } {
  const foreground = themeLab(colours.foreground);
  const background = themeLab(colours.background);
  const primary = themeLab(colours.primary);
  if (background[0] - foreground[0] < 0.4) return { reason: "theme" };

  const count = pixels.length / 4;
  const lab = new Float64Array(count * 3);
  const lightness = new Float64Array(count);
  let visibleCount = 0;
  for (let i = 0; i < count; i++) {
    const offset = i * 4;
    if (!pixels[offset + 3]) continue;
    const colour = rgbToOklab([
      (pixels[offset] as number) / byteMax,
      (pixels[offset + 1] as number) / byteMax,
      (pixels[offset + 2] as number) / byteMax,
    ]);
    lab.set(colour, i * 3);
    lightness[visibleCount++] = colour[0];
  }
  if (!visibleCount) return { reason: "picture" };

  const inkL = lightnessOf(lightness, visibleCount, 0.02);
  const paperL = lightnessOf(lightness, visibleCount, 0.9);
  const span = paperL - inkL;
  if (span < 0.2) return { reason: "picture" };
  const inkA: number[] = [];
  const inkB: number[] = [];
  const paperA: number[] = [];
  const paperB: number[] = [];
  const washL: number[] = [];
  const washA: number[] = [];
  const washB: number[] = [];
  const washCentre = Math.floor(washHue / 10) * 10 + 5;
  for (let i = 0; i < count; i++) {
    if (!pixels[i * 4 + 3]) continue;
    const l = lab[i * 3] as number;
    const a = lab[i * 3 + 1] as number;
    const b = lab[i * 3 + 2] as number;
    if (l <= inkL) {
      inkA.push(a);
      inkB.push(b);
    }
    if (l >= paperL) {
      paperA.push(a);
      paperB.push(b);
    }
    const hue = (Math.atan2(b, a) * 180) / Math.PI;
    const distance = Math.abs(((hue - washCentre + 900) % 360) - 180);
    if (distance <= 30 && Math.hypot(a, b) > 0.03) {
      washL.push(l);
      washA.push(a);
      washB.push(b);
    }
  }
  if (washL.length / visibleCount < 0.005) return { reason: "picture" };

  const ink: Oklab = [inkL, median(inkA), median(inkB)];
  const paper: Oklab = [paperL, median(paperA), median(paperB)];
  const aWash = median(washA);
  const bWash = median(washB);
  const washChroma = Math.hypot(aWash, bWash);
  if (washChroma === 0) return { reason: "picture" };
  const unitA = aWash / washChroma;
  const unitB = bWash / washChroma;
  const washPosition = (median(washL) - inkL) / span;
  const washLightness = (primary[0] - mix(foreground[0], background[0], washPosition)) * 0.5;

  const output = pixels.slice();
  for (let i = 0; i < count; i++) {
    const offset = i * 4;
    if (!pixels[offset + 3]) continue;
    const original: Oklab = [
      lab[i * 3] as number,
      lab[i * 3 + 1] as number,
      lab[i * 3 + 2] as number,
    ];
    const t = clamp((original[0] - inkL) / span, 0, 1);
    const source = mixLab(ink, paper, t);
    const a = original[1] - source[1];
    const b = original[2] - source[2];
    const along = Math.max(0, a * unitA + b * unitB);
    const weight = clamp(along / washChroma, 0, 1);
    const ramp = mixLab(foreground, background, t);
    const target: Oklab = [ramp[0] + washLightness, primary[1], primary[2]];
    const tinted = mixLab(ramp, target, weight);
    tinted[1] += a - along * unitA;
    tinted[2] += b - along * unitB;
    const [red, green, blue] = oklabToRgb(mixLab(tinted, original, blendBack));
    output[offset] = Math.round(red * byteMax);
    output[offset + 1] = Math.round(green * byteMax);
    output[offset + 2] = Math.round(blue * byteMax);
  }
  return { pixels: output };
}
