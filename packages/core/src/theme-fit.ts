// How a theme suits the looks a ux file can ask for (docs/design/theme-lab.md §4): one line each,
// computed from the theme alone, no model. The lab shows them under its frames; the Look tab
// can show them beside a theme later. Contrast errors are the parser's, not these.
import { contrast, hexOf } from "./color.js";
import type { ThemeIR } from "./theme.js";
import { DISPLAY_FONTS } from "./theme-style.js";

export interface Fit {
  /** Which look the line is about. */
  rule: string;
  verdict: "fine" | "note" | "avoid";
  text: string;
}

/** Whether two colors are near enough that one does not show on the other (white on cream does not). */
const blends = (a: string, b: string) => contrast(hexOf(a), hexOf(b)) < 1.15;

/** The six first rules, each about one look, in the order the lab shows them. */
export function themeFit(theme: ThemeIR): Fit[] {
  const { style, light } = theme;
  const heading = style.headingFont ?? theme.font;
  const display = DISPLAY_FONTS.includes(heading);
  return [
    // A cover hero sets its title on the picture under the primary color.
    contrast(hexOf(light["primary-foreground"]), hexOf(light.primary)) >= 4.5
      ? {
          rule: "cover-hero",
          verdict: "fine",
          text: "A cover hero: fine, its title reads on the primary color.",
        }
      : {
          rule: "cover-hero",
          verdict: "note",
          text: "A cover hero: the title on the primary color is faint; a split hero reads better.",
        },
    // A split hero gives the title half the width.
    display && style.headings.scale === "large"
      ? {
          rule: "split-hero",
          verdict: "note",
          text: "A split hero: the heading font at this scale needs a short title.",
        }
      : { rule: "split-hero", verdict: "fine", text: "A split hero: fine." },
    // Cards in a grid need an edge: a border, a shadow, or a color of their own.
    style.surfaces.cards === "flat" && blends(light.card, light.background)
      ? {
          rule: "card-grid",
          verdict: "avoid",
          text: "Cards in a grid: flat cards on this background have no edge; add a border or a shadow.",
        }
      : { rule: "card-grid", verdict: "fine", text: "Cards in a grid: fine." },
    style.tables.rows === "zebra" && style.surfaces.dividers === "strong"
      ? {
          rule: "table-rows",
          verdict: "note",
          text: "Zebra rows with strong dividers: busy; one of the two is enough.",
        }
      : { rule: "table-rows", verdict: "fine", text: "Table rows: fine." },
    display && style.headings.scale === "small"
      ? {
          rule: "heading-scale",
          verdict: "note",
          text: `${heading} is a display face: at a small scale its character is lost.`,
        }
      : { rule: "heading-scale", verdict: "fine", text: "Headings: fine." },
    style.surfaces.sections === "boxed" && style.surfaces.cards === "raised"
      ? {
          rule: "sections",
          verdict: "note",
          text: "Boxed sections with raised cards: boxes in boxes; flat or bordered cards sit better.",
        }
      : { rule: "sections", verdict: "fine", text: "Sections: fine." },
  ];
}
