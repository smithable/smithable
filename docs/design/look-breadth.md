# Look breadth: more faces, more a theme can say, themes from the open catalogs

Status: proposed 2026-10-31 by Fable, on Johan's direction of the same day: add the fonts, extend what a theme and a page layout can say so our apps can match more of the good-looking open themes, and prefer looking good in general with an occasional miss over playing it safe. It builds on theme-lab.md (the style layer, §2) and look-gap.md (the choices the look system lacks, §4; its three decisions are taken as yes by the same direction). Two second reviewers read a draft; their points are in. Merging this document is the go-ahead; §8 splits the work.

## 1. Where the themes come from

Two open catalogs carry what a designer would set and we have not:

- **Hallmark** (`Nutlope/hallmark`, MIT): fifty theme "materials", each a file of OKLCH tokens (paper, ink, muted, rule, accent, focus), a display and a body face, radius, shadow, the heading weight and tracking, surfaces, controls, motion and do-nots, with a picture of a finished page beside it, and ten to twenty-five keywords that route a prompt to it. Twenty editorial, twelve modern-minimal, nine atmospheric, nine playful. Made for landing pages; the materials carry over, the page shapes do not.
- **tweakcn** (`jnsahaj/tweakcn`, Apache-2.0): forty-two presets for the component library our kit is built on, each the same colour tokens our theme file has in light and dark (background, foreground, card, primary, secondary, muted, accent, border, input, ring, sidebar), with fonts, radius, shadow and letter-spacing. Thirty-five are usable; the seven named after companies or other products are left out, palette and name.

Both are read by a script into candidate theme files (§4), never by hand, so a later version of either is a rerun. Their licences allow it; `NOTICE` names them. A theme's name in our library is our own word, never the catalog's brand-like one, and a theme file says where it came from in a comment.

What the catalogs do not give: a page's content and order (Hallmark says so itself: a theme is a material, not a plan), and nothing runs a model at generation time. Our apps stay deterministic from the theme and ux files through one kit (ARCHITECTURE §2.4, rules 2, 4 and 6); the catalogs only widen what those files can say and offer good starting values.

## 2. Fonts: twelve more faces

The eight hosted faces (Inter, Nunito Sans, Source Sans 3, Source Serif 4, Fraunces, Archivo Narrow, DM Sans, Outfit) cover the review's families but not the catalogs' character: none of the forty display faces Hallmark's materials name is among them. Twelve join, every one under the SIL Open Font License on Fontsource (its API checked on 2026-10-31 for the package, the licence and the weights), chosen so each class of the catalogs has one or two:

| Face | Class | Weights | Package |
|---|---|---|---|
| Hanken Grotesk | grotesk sans, workhorse | 100–900, variable | `@fontsource-variable/hanken-grotesk` |
| Instrument Sans | grotesk sans, quiet | 400–700, variable | `@fontsource-variable/instrument-sans` |
| Mona Sans | grotesk sans, heavy heads | 200–900, variable | `@fontsource-variable/mona-sans` |
| Bricolage Grotesque | display grotesk with character | 200–800, variable | `@fontsource-variable/bricolage-grotesque` |
| Oswald | condensed display | 200–700, variable | `@fontsource-variable/oswald` |
| Big Shoulders Display | heavy display | 100–900, variable | `@fontsource-variable/big-shoulders-display` |
| Instrument Serif | roman serif display | 400 | `@fontsource/instrument-serif` |
| Young Serif | roman serif display, warm | 400 | `@fontsource/young-serif` |
| Newsreader | book serif for prose | 200–800, variable | `@fontsource-variable/newsreader` |
| Bodoni Moda | high-contrast serif display | 400–900, variable | `@fontsource-variable/bodoni-moda` |
| Zilla Slab | slab serif | 300–700 | `@fontsource/zilla-slab` |
| JetBrains Mono | mono, for labels and figures | 100–800, variable | `@fontsource-variable/jetbrains-mono` |

- `FONTS` and `FONT_WEIGHTS` (theme-style.ts) grow by the twelve; a one-weight face has `[400, 400]`, so a theme asking it for 600 is refused as today. `DISPLAY_FONTS` gains the display faces (Bricolage Grotesque, Oswald, Big Shoulders Display, Instrument Serif, Young Serif, Bodoni Moda). A display face as `fonts.body` is refused (long text at 16px in a face made for 48px is unreadable, which is the floor's business); as `fonts.heading` or `fonts.labels` it is a look, noted at `scale: small` as today.
- **Italics:** where a face has an italic (Newsreader, Instrument Serif, Bodoni Moda, Instrument Sans, Hanken Grotesk and the eight's), the app imports Fontsource's italic file beside the roman, since the editorial materials lean on true italics; the rest fall back to the browser's synthetic italic.
- **Every app installs all twenty**, as every app has the eight today, and imports the faces its theme names (body, heading, labels, and a landing page's own theme, look.md §1.5). Only the imported faces reach the build, so the twelve cost install size, not the app; the lab and Studio's preview switch themes without an install, which an install-only-what-the-theme-names rule would have broken.
- Not taken: the catalogs' faces that are not on Fontsource or not OFL (General Sans, Switzer, Cabinet Grotesk, Chillax, Boska, Sentient, Ranade, Wix Madefor), the novelty faces (pixel, blackletter, handwritten), and a second geometric sans (Space Grotesk, Plus Jakarta Sans), since DM Sans and Outfit are that class.

## 3. What a theme can say: the style layer grows

Every new field is a choice from a fixed set with today's look as its default; no positions, no per-element styles (look.md §1.6 stands). Each becomes one CSS variable the kit reads, or, where one variable cannot carry it (glass, duotone, a mode), one switch the kit's components take; never a CSS value from the file. The fields come from what the catalogs' materials say and our file cannot:

```yaml
fonts:
  body: Newsreader
  heading: Instrument Serif
  labels: JetBrains Mono     # new: the face of column labels, eyebrows, small figures and tags; default: the body face
headings:
  weight: 400                # now 300 to 900 (was 400 to 800), clamped to the face's range: a light display face is a look
  scale: huge                # adds huge to small | regular | large: a display-led hero and page titles
labels:                      # new
  case: upper                # none | upper; default: the headings' case, which is what decides labels today
  tracking: wide             # normal | wide; default: wide with upper, normal otherwise (today's look)
surfaces:
  cards: glass               # adds glass to flat | bordered | raised: translucent, blurred, a lit top edge, over bands and pictures
  sections: banded
  bands: strong              # new: soft | strong, how far a band's paper steps from the background; default soft, today's one step
  dividers: light
texture: grain               # new: none | grain | paper, a quiet noise or a paper fibre on the page's surfaces, as CSS alone (an SVG filter in the stylesheet, no file); default none
pictures:
  treatment: duotone         # new: natural | muted | warm | mono | duotone, what the theme does to every photograph (duotone: the primary over the background, a blend the kit's picture component draws); default natural
modes: dark                  # new: both | light | dark; default both
```

- **Why these.** `fonts.labels` and `labels` are look-gap §4's `labels.font` with its case and tracking beside it (eleven of the fifty materials set labels apart). `glass`, `bands`, `texture` and `treatment` are what most of the atmospheric and editorial materials are made of; without them an import keeps the colours and loses the material. `modes` is the bold choice: nine materials are one mode by design, and a dark-only app is a look, not a failure. `huge` and the wider weight range are what display faces are for.
- **`modes: light` or `dark`** means the file carries that one colour block (a second block is refused as unused), the kit renders that mode whatever the system preference says, and the mode switch is not generated (a generation-time switch, not a variable). The contrast floor checks the one mode.
- **Validation.** The contrast floor stays (every text pair at AA, the ring visible): it is the one check that keeps a bold theme readable. Text on glass is checked as text on the glass's tint at the kit's minimum opacity (0.65 of the card token) over the band it sits on; over a photograph the kit keeps the scrim the picture-backed heroes have today (look-gap §4, `hero.overlay`), so the floor has no hole there. `texture` does not go on glass cards (both are filters; the kit draws texture on page surfaces only), and it is allowed with `motion: lively`. Nothing else is refused for taste: a condensed display face at `scale: huge` in capitals is a look someone chose.
- **One exception to "today's look as the default" (decided 2026-10-31, building step 2):** the kit wrote every label in tracked capitals by its own habit, never by a theme's choice, and the look-gap analysis and the published gates both name that as the first machine-made tell. So labels now follow the theme, and unsaid the headings: sentence case, normal tracking, in every app; a theme that wants capitals says `labels: { case: upper }` (street-food's labels stay capitals by the follow rule, since its headings are). The snapshots show the change once.
- **The kit's part.** Variables `--font-labels`, `--label-case`, `--label-tracking`, `--band-step`, `--texture`; switches for glass (the card component's surface), duotone (the picture component's blend, per mode) and the mode; set by `themes.ts` and taken by the components that already read the style layer. Each variant gets its line in the generate snapshot, and so do the combinations where misses show: glass in dark, duotone in dark, huge with a condensed face in capitals, texture with bands. None is interactive, so no browser step.
- **The ux side** is look-gap §4 as written (navigation, chrome, the summary home, the filters' look, the schedule's colour and capacity, the hero's inset layout, overlay, facts and eyebrow, the table's mark and actions), now decided. Two join it from the catalogs' pages, both landing sections: `hero.layout: stage` (the headline on the left columns and, on the right in a glass or well surface, the app's own first list page drawn by the kit's own components with the sample records, at the hero's size: no screenshot, deterministic, how every modern-minimal material shows a product) and `records.layout: ledger` (a records section as ruled rows with a figure column, for prices, sessions and accounts, instead of cards).

## 4. The import: catalogs to candidates

`node scripts/theme-import.mjs hallmark|tweakcn <checkout> [--out <dir>]` reads a catalog's files and writes one candidate theme file per entry. Every mapping is a table in the script (token to token, face to nearest hosted face by class, OKLCH to our hex), so a rerun gives the same files and two runs can be compared.

- **Hallmark**, from the header block and the `:root` block: `--color-paper` → `background`, `--color-ink` → `foreground`, `--color-card` (else `--color-paper` on a light material, `--color-paper-2` on a dark one) → `card`, `--color-paper-2` → `muted` and `sidebar`, `--color-paper-3` (else a step from paper-2) → `secondary`, `--color-muted` → `muted-foreground`, `--color-rule` → `border` and `input`, `--color-accent` and `--color-accent-ink` → `primary` and `primary-foreground`, `--color-accent-2` → `accent`, `--color-focus` → `ring`; the header's `display` face → `fonts.heading`, the body face in `--font-body` → `fonts.body`, a mono `--font-label` or `--font-mono` on labels → `fonts.labels`; `labels.case: upper` only when the build hint sets `text-transform: uppercase` on labels, else `none`; `--radius-card` → `radius`, `--shadow-card` → `shadow` by its blur (none, soft, strong), `--display-weight` → `headings.weight` clamped to the mapped face's range, `--tracking-display` → `headings.tracking` by thresholds; `paper: dark` → `modes: dark` and a light material → `modes: light`, since a material is one palette (a second mode is added by hand in the lab if a picked theme wants one); the header's `photo` line → `pictures.treatment`; glass in the material line → `surfaces.cards: glass`; a texture recipe named → `texture`. A face we do not host maps to the nearest hosted one of its class, noted in the file's comment. The `keywords` line is kept for §6, with a short list of brand words dropped.
- **tweakcn:** the colour tokens by name for both modes (`modes: both`), `radius`, the shadow variables → `shadow` by blur and opacity, `font-sans` → `fonts.body` and `fonts.heading` (a preset's heads use its sans), `font-mono` → nothing (our labels face is a theme's own choice), `letter-spacing` → nothing (it is body tracking, which the file does not have; noted in the comment).
- **Check and sheet.** Every candidate goes through the theme's own validation (the contrast floor and the refusals above); the unreadable are listed, not written. `scripts/theme-sheet.mjs` then shoots the readable ones, and the sheet goes to Johan as a pictures round. The ones he picks go into `theme-library.ts` under our names with their `keywords`, and the lab and the Starters page show them. No candidate is a starter's default until the look-gap round says so.
- The two catalogs are the first sources; the script's shape (a reader per source, one writer) takes another. The theme-candidates script by rule stays for hue ladders; this is the counterpart from designed materials.

## 5. The kit against the tells

Hallmark's sixty-five gates are a list of the defaults a model falls into, sorted by how binding they are: a floor nobody admired breaks (contrast, focus, reduced motion, animating width or height, `transition: all`, pure black and white outside the tokens), reflexes a designer may overrule (Inter as the display face, tracked-capital labels, one coloured word in a headline, a glow behind glass, a card inside a card), and finish. Its lint runs against a dev server. Once, against the CRM and booking starters:

- Floor findings are kit defects: fixed in one kit PR.
- Reflex findings are read against our choices: a tracked capital label is `labels.case: upper`, a choice, not a defect; what the kit does without a theme asking for it is a defect of the default.
- The list of what was fixed and what was kept as a choice goes in the PR text, so the next round knows.

The look-gap analysis of the CRM named the same tells (the uppercase tracked column headers, the heavy title, Inter everywhere), so this is the mechanical half of what it found.

## 6. A theme from the description, later

Each library theme carries `keywords` (the catalogs' lines, ours added). `smithable new --describe` already reads the description without a model (read-description.ts); a deterministic match of its words against the keywords picks the starting theme: the most matches win, a tie goes to the theme earlier in the library, no match gives today's default. `--explain` says why ("theme: hedgerow, from 'distillery' and 'tasting'"). No model decides a look; the person changes it in the lab. After §4's first round, when the library has the themes to route to.

## 7. The builders and theme editors, considered

A survey of open-source visual builders and theme editors (2026-10-31) was read against this note:

- **Page editors with the host's own components** (Puck, MIT; Craft.js, MIT): a visual arrangement of registered blocks with editable fields. Not now. Their data document would be a second page format beside the ux file, and free arrangement is the layout language look.md §1.6 refuses: a section's order and its look are already choices Studio's Look tab writes through the operation layer (moveSection, setSectionLook). Revisit if people ask to place things the choices cannot.
- **Source-editing tools** (Onlook, Apache-2.0) and **HTML template builders** (GrapesJS, BSD-3; ChaiBuilder, BSD-3, bound to another framework): edits to generated code or to templates, which the spec would not know about. No.
- **AGPL builders** (Webstudio; Plasmic's platform): out by licence for the engine.
- **Theme editors for the kit's component library** (tweakcn, Apache-2.0; the smaller MIT editor; the library's own customizer): the same tokens as our theme file. tweakcn's presets are an import source (§4); its editor is a reference for the lab's controls (the token picker with the live preview, the shadow and letter-spacing dials), not a dependency: the lab edits our theme file, which has more than tokens.

## 8. Steps and owners

1. **Fonts and fields, core** (Fable): `FONTS`, `FONT_WEIGHTS`, `DISPLAY_FONTS` and the body refusal; the style layer's new fields with validation, schema, the spec reference and the lab's controls' values; one PR with its unit tests.
2. **Fonts and fields, kit** (A, after step 1 merges): the twelve pins in the stack profile with their italic imports, the variables and switches and the components' reading of them, the snapshot with the combinations of §3; the gate audit of §5 in a PR of its own.
3. **The import** (Fable): `scripts/theme-import.mjs` with both readers, the candidates' sheet as a pictures round; Johan picks; the picked ones into the library (Fable), the lab and the Starters page (C).
4. **look-gap §4 and the two layouts of §3** (A builds, Fable reviews the core bits), a few per PR, as look-gap §7 step 2 says; its step 1 (the two starters' own files) first.
5. **Routing** (§6, Fable), after step 3's first round.
6. **The next analysis round** on the other starters (look-gap §7 step 3), with the new vocabulary.

Testing does not multiply: one kit, variants and the named combinations tested once each in the snapshot; a theme file adds no test (look-gap §6).

## 9. Out of scope

Running a model at generation time; a page editor; the catalogs' page shapes and copy; a theme per customer by a designer (the lab is for that); fonts outside Fontsource or outside the OFL; a body tracking field.
