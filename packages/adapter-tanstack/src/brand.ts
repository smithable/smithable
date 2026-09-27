// The design system's brand-input rules (docs/design/delivery/06-guidelines/brand-input-rules.md):
// a brand colour replaces a preset's primary, ring, accent and chart-1 colours, keeping text
// readable. Pure colour maths, so the same input always gives the same theme.
import type { ThemePreset } from "@smithable/core";
import { PRESET_TOKENS } from "./theme-presets.js";

type Mode = "light" | "dark";
type Oklch = [l: number, c: number, h: number];
type Rgb = [r: number, g: number, b: number];

/** Preset chroma caps keep the quieter presets quiet. */
const CHROMA_CAP: Record<ThemePreset, number> = {
  modern: 0.22,
  minimal: 0.08,
  playful: 0.22,
  corporate: 0.16,
};
const DARK_TEXT = "#101522";

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

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
function oklchToLinear([L, C, H]: Oklch): Rgb {
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

/** WCAG contrast ratio of two colours. */
export function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = hexToRgb(hex).map(toLinear) as Rgb;
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** A token's value as hex: preset tokens are oklch() strings. */
function hexOf(value: string): string {
  const [L, C, H] = (/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/.exec(value) ?? [])
    .slice(1)
    .map(Number) as Oklch;
  return gamutMap([L, C, H]);
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export interface BrandColors {
  primary: string;
  "primary-foreground": string;
  ring: string;
  accent: string;
  "accent-foreground": string;
  "chart-1": string;
}

/** The colours a brand colour gives a preset in one mode, as hex. */
export function brandColors(input: string, preset: ThemePreset, mode: Mode): BrandColors {
  const tokens = PRESET_TOKENS[preset][mode];
  const [L, C0, H] = rgbToOklch(hexToRgb(input));
  const C = Math.min(C0, CHROMA_CAP[preset]);
  const dark = mode === "dark";
  const foreground = hexOf(tokens.foreground);
  const card = hexOf(tokens.card);
  const bestText = (bg: string) =>
    contrast("#ffffff", bg) >= contrast(DARK_TEXT, bg) ? "#ffffff" : DARK_TEXT;

  // Primary and the text on it: at least 4.5:1, moving lightness if needed.
  let primaryL = dark ? clamp(L, 0.68, 0.84) : clamp(L, 0.38, 0.62);
  let primary = gamutMap([primaryL, C, H]);
  let primaryText = bestText(primary);
  if (contrast(primary, primaryText) < 4.5) {
    const step = primaryText === "#ffffff" ? -0.01 : 0.01;
    let found: string | undefined;
    for (let l = primaryL + step; l >= 0 && l <= 1; l += step) {
      const candidate = gamutMap([l, C, H]);
      if (contrast(candidate, primaryText) >= 4.5) {
        found = candidate;
        primaryL = l;
        break;
      }
    }
    if (found) primary = found;
    else {
      primary = hexOf(tokens.primary);
      primaryText = hexOf(tokens["primary-foreground"]);
    }
  }

  // The focus ring: 3:1 against the card, or the preset's.
  let ring = gamutMap([dark ? 0.78 : 0.46, Math.min(C, 0.16), H]);
  if (contrast(ring, card) < 3) ring = hexOf(tokens.ring);

  // A tinted accent that keeps the preset's text readable on it.
  let accentL = dark ? 0.28 : 0.94;
  let accentC = Math.min(C * 0.25, 0.035);
  let accent = gamutMap([accentL, accentC, H]);
  for (let i = 0; contrast(accent, foreground) < 4.5 && i < 100; i++) {
    accentC *= 0.9;
    accentL = clamp(accentL + (dark ? -0.01 : 0.01), 0, 1);
    accent = gamutMap([accentL, accentC, H]);
  }
  if (contrast(accent, foreground) < 4.5) accent = hexOf(tokens.accent);

  return {
    primary,
    "primary-foreground": primaryText,
    ring,
    accent,
    "accent-foreground": foreground,
    "chart-1": ring,
  };
}
