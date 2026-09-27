# Smithable design system — design handoff

Prepared 27 September 2026 from the attached design brief and five current screenshots.

**Start with `index.html`.** It is an offline gallery: open it in your browser, filter by theme, mode or section, and open any PNG preview or editable SVG. No server, account or external assets are required. The SVGs retain text and vector shapes. Install the bundled fonts before importing into a design editor.

## What is included

- Four presets: **modern, minimal, playful, corporate**, each in light and dark.
- 1440 px desktop and 390 px mobile page patterns: list, detail, create customer, create order, dashboard, settings, three onboarding steps, sign-in, and landing pages with/without an image slot.
- Component and state sheets for buttons, fields, feedback, navigation, density and difficult data.
- Individually reusable landing-section SVGs and PNGs: hero, features, pricing, testimonial, FAQ, CTA and footer.
- Three complete **design references**: Acme CRM / corporate; Stillwater Yoga / playful; Invoicely / modern. Each has desktop/mobile and light/dark screens.
- OKLCH CSS custom properties, colour-token JSON, foundation tokens, measured contrast results and 24 derived brand examples (3 inputs × 4 presets × 2 modes).
- Self-hostable fonts with their licences, Lucide licence, a 200-customer data fixture, original brief and original screenshots.
- An AI-generated visual-direction board in `01-direction`. It communicates mood; the exact SVGs and token files are the implementation authority.

## Important delivery boundaries

This is **not a native Figma `.fig` file**. The environment can deliver editable SVGs and token exports, but cannot author Figma variables, Auto Layout or native component variants. SVG import preserves vector objects and text; it does not automatically recreate those Figma features. `06-guidelines/figma-assembly.md` explains the intended structure.

The brief's week-one approval gate has not happened. The complete package is a proposed direction for review, produced now at the user's request. No design direction is represented as approved.

These are designs, not working reference applications. The final milestone in the brief—reviewing all three apps after Claude implements them—remains open. Likewise, palette and geometry checks are not a claim that a future application is WCAG conformant.

## Read order for Claude

1. `06-guidelines/CLAUDE-HANDOFF.md`
2. `06-guidelines/design-system.md`
3. `06-guidelines/brand-input-rules.md`
4. `06-guidelines/component-state-matrix.md`
5. `06-guidelines/requirements-coverage.md`
6. Tokens, component sheets and reference screens.

## Authority and content

Use the tokens for exact colours and the SVGs for exact geometry. Keep content-driven height: artboard heights illustrate scrollable pages, not fixed-height containers. A screenshot's visible sample rows are not the complete dataset. Counts of 200 refer to the supplied fixture.

The apps and their pricing/testimonials are illustrative design content, not product commitments or real endorsements. The image slot is deliberately generic: no bespoke photography, logo or mascot is required. Smithable builder UI and Smithable branding are outside scope.

Original design work is supplied under 0BSD to the extent rights exist. Fonts and Lucide remain separately licensed: retain their notices. See `LICENSE` and `07-assets/THIRD-PARTY-NOTICES.md`.
