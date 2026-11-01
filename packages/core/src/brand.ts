// The design system's brand-input rules (in core since 2026-11-01, so the ux check reads the brand's
// colours as the app will have them; the adapter imports it from here) (docs/design/delivery/06-guidelines/brand-input-rules.md):
// a brand color replaces a preset's primary, ring, accent and chart-1 colors, keeping text
// readable. Pure color maths, so the same input always gives the same theme.
import { clamp, contrast, gamutMap, hexOf, hexToRgb, rgbToOklch } from "./color.js";
import type { ThemeIR } from "./theme.js";

type Mode = "light" | "dark";
const DARK_TEXT = "#101522";

export interface BrandColors {
  primary: string;
  "primary-foreground": string;
  ring: string;
  accent: string;
  "accent-foreground": string;
  "chart-1": string;
}

/** The colors a brand color gives a theme in one mode, as hex. */
export function brandColors(input: string, theme: ThemeIR, mode: Mode): BrandColors {
  const tokens = theme[mode];
  const [L, C0, H] = rgbToOklch(hexToRgb(input));
  // A theme's chroma cap keeps a quiet theme quiet.
  const C = Math.min(C0, theme.chroma);
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
