# System foundations and responsive behaviour

## Four personalities, one component contract

| Preset | Character | Typeface | Radius | Surface treatment |
|---|---|---|---:|---|
| modern | Clear, confident general-purpose software | Inter | 12 px | Cool neutral surfaces; indigo accents; subtle optional shadow |
| minimal | Quiet and editorial, content first | Inter | 4 px | Warm neutrals; ink primary; no elevation except overlays |
| playful | Friendly, still credible for business | Nunito Sans | 18 px | Lavender-tinted surfaces; purple primary; rounder cards |
| corporate | Structured, dense and formal | Source Sans 3 | 4 px | Navy sidebar; teal primary; crisp borders and flat surfaces |

A preset changes typography, colour, radius and surface treatment. It never changes meaning, field order, keyboard behaviour or status terminology. Dark mode uses separate surfaces and foregrounds, not an inversion filter.

`foundations.json` defines type sizes, line heights, weights, spacing and density. Use one family per app. Body is 14/22; mobile inputs should be at least 16 px in browsers that zoom small form text, with field height growing when needed. The static artboards show 14 px values for visual consistency; browser behaviour takes precedence. Page titles are 32/40 desktop and 28/36 mobile; long titles wrap. Table headers are 11/16 semibold; do not reduce other text to make a table fit.

Use tabular lining numerals for amounts, counts and dates. Right-align numeric columns and align their headers the same way. Render the user's currency/locale with Intl.NumberFormat; example English currency formatting is not a localisation policy. Swedish and Finnish names must remain intact.

## Layout

Desktop shell: sidebar 224 px, header 72 px, content inset 36 px from sidebar, 36 px right gutter. Large pages may use a fluid maximum width; forms use an approximately 800 px content card plus contextual guidance. Avoid unbounded line lengths.

Phone shell: 72 px header, 20 px gutters, 350 px content at 390 px viewport. Use a labelled menu trigger and an accessible modal drawer with focus trap, Escape close, focus return and inert background. The drawer contains the same page links, user and sign-out as desktop. There is no hover dependency.

Breakpoint policy: below 768 px use the mobile layout. At 768–1023 px the sidebar becomes a drawer and cards may form two columns when space permits. At >=1024 px use the desktop shell. This policy is a proposed implementation rule; intermediate widths still need browser QA.

Tables never force document horizontal scrolling. On phones they become record cards with visible text links and optional explicit actions. Desktop may expose column visibility, sorting and pagination. Preserve sort/filter state when switching layout. Keep table semantics on desktop; use list semantics for mobile cards rather than mislabelled visual table cells.

## Densities

| Setting | Row minimum | Control height | Cell padding | Card padding |
|---|---:|---:|---:|---:|
| Comfortable | 64 px | 44 px | 16 px | 24 px |
| Compact / desktop fine pointer | 44 px | 36 px | 12 px | 20 px |
| Mobile or coarse pointer | Content height | >=44 px | 16 px | 20 px |

All row heights are minimums. Rows with two contact lines or wrapped names grow to 58 px or more, as shown in Acme's list. Compact must not truncate meaningful data or shrink touch targets. Density sheets show the actual compact minimum as well as comfortable rows.

## Forms

Keep a clear label above every field, with `*` for required and an explanation once per form. Link hint/error text with aria-describedby. Labels remain visible after values are entered. Errors use an icon/text and an error border, never red alone.

Number fields accept the correct precision; whole numbers do not silently round. Amounts show currency separately or in an accessible label. Telephone, email and URL fields use appropriate input modes and autocomplete. Date/datetime entry must work by keyboard as well as a calendar picker, with the time zone clearly stated for bookings.

A linked-record field is a searchable combobox. Show a useful secondary identifier for duplicate names. Support loading, no options, no match, selection, clear and unavailable/deleted selections. User selectors use the same contract. A plain choice field can use Select when the options are short and stable.

Computed values use a tinted read-only surface, lock/calculator icon and explanation. Never make them look editable. Recalculate while typing, show a temporary calculation state if asynchronous, and announce settled updates politely. Keep the previously valid value until the calculation succeeds or visibly mark it unavailable.

Primary form action is Save/Create. Cancel is secondary. Destructive action is separate, never adjacent to the primary action without spacing. On mobile stack when labels no longer fit. A sticky action bar needs safe-area padding and enough scroll padding that it does not cover focused fields.

## Feedback and reduced motion

Use static skeletons with a textual loading announcement. No animation is necessary. If a spinner is added, respect prefers-reduced-motion. Empty-data and no-search-match are different states, with different actions. Denied and not-found pages explain the next useful action without exposing internal configuration.

Show save success briefly but allow persistent access to important information. An error stays until resolved or deliberately dismissed. Retry must preserve entered data. Dialogs name the exact record and consequences, and default focus to Cancel.

## Landing blocks

Each section stands alone and uses the current app theme. `landing-blocks` contains independently sized vector sections; full pages demonstrate their combination. The hero is also shown without an image in the full-page patterns. Use the no-image hero when the app owner has no suitable image. Never require custom illustration, stock photography or a mascot.

The placeholder is a specified media slot, not final artwork. If filled, crop responsively with an appropriate focal point and provide meaningful alt text (or empty alt for decoration). Pricing is illustrative: real plans, entitlements, VAT wording and terms must be supplied by the app owner. Testimonials are explicitly marked as illustrative.

FAQ closed state is shown. Opening expands the answer inline, uses aria-expanded and keeps subsequent sections in normal flow. Feature cards can vary from three to six using the same grid. Pricing supports two to four plans, stacking on phone; avoid shrinking four desktop cards past their minimum readable width.
