import type { ThemeIR } from "./theme.js";
/** Theme choices which affect generated markup/bootstrap rather than CSS alone. */
export const THEME_STRUCTURE = {
  bands: "Section banding",
  appearance: "Appearance controls",
} as const;
export const hasAppearance = (modes: ThemeIR["modes"]): boolean => modes === "both";
export const themeStructure = (theme: ThemeIR) => ({
  bands: theme.style.surfaces.sections === "banded",
  appearance: hasAppearance(theme.modes),
});
