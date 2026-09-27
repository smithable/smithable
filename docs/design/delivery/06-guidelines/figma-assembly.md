# Optional Figma assembly

This archive contains no `.fig` file and no native Figma variables or Auto Layout. The SVGs are editable vectors with text. Importing them is a useful starting point but not equivalent to a finished native component library.

1. Install Inter, Nunito Sans and Source Sans 3 from `07-assets/fonts`, including font availability for the Figma client you use.
2. Create pages: 00 Direction, 01 Foundations, 02 Components, 03 Patterns, 04 Acme CRM, 05 Stillwater Yoga, 06 Invoicely, 07 Review.
3. Import SVG files from the matching folders. Keep their original 1440 or 390 px widths. Page heights represent scrolling content.
4. Create colour-variable collections for the eight theme/mode combinations using `themes.css`/`colors.tokens.json` as the source of truth. Create density variables separately. These files are not claimed to match a particular Figma plugin's import schema.
5. Rebuild repeated primitives as native components using the component sheets and state matrix. Bind fills, strokes, type styles and radius to variables. Replace fixed imported geometry with Auto Layout and responsive constraints.
6. Add named properties such as variant, size/density, state, icon and selected where they apply. Do not create nonsensical variants for static elements.
7. Connect onboarding, list/detail/form, drawer and dialog interactions. Run keyboard and browser reviews on the actual implementation; a Figma prototype cannot establish WCAG conformance.

Suggested component names: `Button/Primary`, `Field/Text`, `Field/RecordLink`, `Field/Computed`, `Navigation/Sidebar`, `Navigation/Drawer`, `Record/TableRow`, `Record/MobileCard`, `Feedback/Empty`, `Feedback/Error`, `Dialog/Delete`, `Landing/Hero`, `Landing/Pricing`.

SVG text may wrap into several independent text objects. If a renderer substitutes fonts, use the PNG as the visual comparison and relink the correct font before rebuilding constraints.
