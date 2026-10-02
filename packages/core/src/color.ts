// Color maths for themes and the brand color (docs/design/delivery/06-guidelines): sRGB,
// OKLCH, gamut mapping and WCAG contrast. Pure functions: the same input always gives the
// same color.
const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export type Oklch = [l: number, c: number, h: number];
export type Rgb = [r: number, g: number, b: number];

export function hexToRgb(hex: string): Rgb {
  return [0, 1, 2].map((i) => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255) as Rgb;
}

export function rgbToHex(rgb: Rgb): string {
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function rgbToOklch([r, g, b]: Rgb): Oklch {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + B * B);
  const H = (Math.atan2(B, A) * 180) / Math.PI;
  return [L, C, C < 0.0001 ? 0 : H < 0 ? H + 360 : H];
}

/** OKLCH to linear sRGB; channels may fall outside [0, 1] when out of gamut. */
export function oklchToLinear([L, C, H]: Oklch): Rgb {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Into sRGB without changing lightness or hue: chroma shrinks by 3% until it fits. */
export function gamutMap([L, C, H]: Oklch): string {
  let c = C;
  for (let i = 0; i < 200; i++) {
    const rgb = oklchToLinear([L, c, H]);
    if (rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6)) return rgbToHex(rgb.map(fromLinear) as Rgb);
    c *= 0.97;
  }
  return rgbToHex(oklchToLinear([L, 0, H]).map(fromLinear) as Rgb);
}

/** WCAG contrast ratio of two colors. */
export function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = hexToRgb(hex).map(toLinear) as Rgb;
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** A color as hex: "#rrggbb" as it is, an "oklch(L C H)" string mapped into sRGB. */
export function hexOf(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  const [L, C, H] = (/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/.exec(value) ?? [])
    .slice(1)
    .map(Number) as Oklch;
  return gamutMap([L, C, H]);
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
