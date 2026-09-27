# Deterministic brand-input rules

Inputs: a valid opaque sRGB colour and optionally a font. The preset's default palette remains unchanged if no colour is supplied. The following algorithm applies only when an override is supplied; do not re-derive the curated preset from its own default colour.

## Conversion and gamut handling

1. Parse the input to sRGB, linearise using the standard sRGB transfer function, then convert to OKLab/OKLCH. L is 0–1, C is non-negative, H is degrees. Keep hue H; when C is below 0.0001 use H=0 because a grey has no meaningful hue.
2. Cap chroma by preset: modern 0.22, minimal 0.08, playful 0.22, corporate 0.16. This preserves the quieter minimal and corporate character.
3. For each derived colour, gamut-map into sRGB without changing L or H: while any linear RGB channel is outside [0,1], multiply C by 0.97. Stop at the first in-gamut result (maximum 200 iterations; fall back to C=0). Round the final sRGB channels to 8 bits for the supplied hex examples. Keep six-decimal OKLCH precision in exports.
4. Calculate contrast from final, gamut-mapped sRGB using WCAG relative luminance. Never estimate contrast using the OKLCH L difference alone.

## Derived roles

| Role | Light mode | Dark mode |
|---|---|---|
| primary | L=clamp(input L, .38, .62); capped C; input H | L=clamp(input L, .68, .84); capped C; input H |
| primary-foreground | Choose white or #101522, whichever gives higher contrast | Same rule |
| ring | L=.46; C=min(capped C,.16); input H | L=.78; C=min(capped C,.16); input H |
| accent | L=.94; C=min(capped C×.25,.035); input H | L=.28; same C rule; input H |
| accent-foreground | Preset foreground | Preset foreground |
| chart-1 | Same as ring | Same as ring |

Only these roles adapt. Keep semantic success, warning and destructive colours unchanged. Neutral surfaces, sidebar, borders, secondary, typography weights, spacing and corner radii stay owned by the preset. The selected sidebar item uses the primary pair. Charts 2–5 stay curated; distinguish coincident series with marks/labels if a custom brand resembles one of them.

## Contrast safeguards

The supplied 24 examples pass 4.5:1 button-text contrast and 3:1 focus-on-card contrast. Arbitrary inputs must still be validated in the implementation.

- If primary-foreground contrast is below 4.5, search L in increments of .01 toward 0 for a white foreground or toward 1 for a dark foreground; re-map gamut and re-test each candidate. Use the closest passing candidate. If no candidate is found, use the preset primary pair.
- If the filled button has less than 3:1 contrast against its surrounding surface, add a 1 px ring-colour outline. A pastel is never made readable by white text alone.
- If accent-foreground fails 4.5:1 on accent, reduce accent C toward zero and move L toward 1 in light mode or toward 0 in dark mode until it passes; then fall back to the preset accent pair if necessary.
- Test the focus colour against both the component and the surrounding surface. Use a 2 px surface-colour offset gap and a 2 px outer ring. If the ring fails 3:1 against the outer surface, use the preset ring; if necessary use the higher-contrast white/dark neutral.
- Underlines and text labels distinguish links/selection/status independently of hue. Avoid overriding the primary-foreground using a hard-coded text-white utility.

## Fonts

Default families: Inter (modern/minimal), Nunito Sans (playful), Source Sans 3 (corporate). All three are bundled with their upstream OFL text.

Accept replacements from this short list: Inter, Nunito Sans, Source Sans 3. A developer may expand the list to a self-hostable sans-serif with a reviewed open licence, true weights 400/600/700, Latin extended coverage including å/ä/ö, clear numerals and tabular figures. No remote font request is required at runtime. Keep the preset type scale and weights when replacing the family. Recheck long labels and buttons; allow height to grow rather than reduce text size.

## Examples and authority

`brand-examples.json` gives exact source inputs and resulting values for blue #2563eb, saturated orange #f97316 and very light pastel #e9d5ff in every theme/mode. The eight brand-example artboards show real buttons, focus and selected surfaces with those values. These inputs are deliberately fixed so the algorithm is reproducible.
