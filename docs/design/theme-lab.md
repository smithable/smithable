# The theme lab, and the style layer it edits (design)

Johan, 2026-10-13: "the next thing I want is the theme builder": a tool apart from Studio, with
more options than the Look tab, where a theme is made on real pages and one sees which looks it
carries. An outside review's point behind it (2026-10-11): our themes vary colours, corners, shadows,
density and one font, never typography or composition, so they look alike. This note designs
the two halves together: the **style layer**, the fields a theme gains so two themes can look
like two designs; and the **lab**, the page that edits a theme on the kit's real pages. Backlog
Fable 26 and 28; A builds in the order of §7, Fable reviews the core and the kit's CSS.

## 1. What a theme can say today, and what it cannot

A theme (`look.md` §3.1, `themes/<name>.yml`) is colours in two modes, one font, a radius, a
shadow, a density, a motion and a chroma cap. The four design-delivery presets also have a
*shape* (heading weight and tracking, card border, button radius, tabular numbers), but it is a
table in `themes.ts` keyed by the preset's name: a project's theme gets the modern shape and
cannot say otherwise. Nothing names a second font, a type scale, how sections sit on the page
or how pictures are framed. That is why the thirteen look like one design in thirteen colours.

## 2. The style layer: new fields of a theme

Every field is data with a fixed set of values, never CSS, never a URL (the rule stays). The
four presets' shapes move out of `themes.ts` into their files, so a project theme can have any.

```yaml
# themes/nordic-restaurant.yml
smithableTheme: 0.1
name: nordic-restaurant
fonts:
  body: Source Sans 3            # the hosted fonts: Inter, Nunito Sans, Source Sans 3, and new: Source Serif 4, Fraunces, Archivo Narrow, DM Sans
  heading: Fraunces              # left out: the body font
headings:
  weight: 600                    # 400–800
  tracking: tight | normal | wide
  scale: small | regular | large # the size steps from body to page title
  case: none | upper             # section titles and labels in capitals (with wide tracking)
surfaces:
  cards: flat | bordered | raised   # a card: the background alone, a border, or a shadow
  sections: open | boxed            # a page's sections: rules between them, or each in a box
  dividers: light | strong | none   # the lines between rows and sections
buttons:
  shape: rounded | pill | square
  weight: regular | bold
pictures:
  corners: theme | square | round   # the theme's radius, none, or a circle for marks
  frame: none | border
tables:
  numbers: tabular | normal
  rows: lined | zebra | plain
radius: 12px
shadow: soft
density: comfortable
motion: subtle
chroma: 0.22
light: { primary: "#2f5d50", background: "#f7f3ec", foreground: "#1f2420" }
dark: { primary: "#9fcbb8", background: "#171a18", foreground: "#ebe7df" }
```

- **Fonts** are packages the stack profile pins (`@fontsource-variable/*`), added to the list
  with their licence line as the three were; a theme names fonts, never files. Seven cover the
  families the review named: a geometric sans, a humanist sans, a workhorse sans, a book serif, a
  display serif with character, a condensed face, a rounded sans.
- **Each new field maps to one CSS variable** the kit already reads or gains
  (`--font-heading`, `--heading-weight`, `--heading-tracking`, `--heading-scale`,
  `--heading-case`, `--card-border`, `--card-shadow`, `--section-style`, `--divider`,
  `--button-radius`, `--button-weight`, `--picture-radius`, `--picture-frame`,
  `--table-numbers`, `--row-style`). No component knows the theme's name; `themes.ts` writes
  the variables from the fields, and the kit's pages use them. The `SHAPES` table goes.
- **Defaults** are today's modern shape, so every existing theme and app renders as before.
- **Validation** as today (every colour pair's contrast, the ring), plus: a heading font that
  is a display face with `scale: small` is allowed but noted (§5), `case: upper` with
  `tracking: tight` refused (unreadable), fonts from the list only.
- **Not added, as look.md §1.6 says:** positions, margins, per-element styles. Composition
  stays in the ux file's layouts (a hero's `split`, a records section's `grid`), which the lab
  shows beside the theme (§4) because a theme is judged on them.

## 3. The lab

A web app of its own, `apps/theme-lab` (React, Vite, the engine in the browser as Studio has
it), in two modes:

- **Local:** `smithable theme lab [--project <dir>]` makes the sheet app once in a temporary
  folder (the booking starter with every control, as `theme-sheet.mjs` makes it), serves its
  preview and the lab on two ports, and opens the lab. The lab's frames show the preview's
  pages; a change to a field computes the theme's CSS in the browser (`themeCss` from the
  adapter) and posts it to each frame, where the preview editor's runtime (`preview-editor.ts`,
  dev only, already in every preview) swaps a `<style id="sm-theme">`. No regeneration per
  keystroke: a theme change is CSS variables. Save writes `themes/<name>.yml` into the project
  (or the current folder) through the lab's server, through `addTheme` when a project is
  given, so it is a change like any other and the Look tab shows the theme at once.
- **Public:** the same app on docs.smithable.ai/theme-lab, with no server: the sheet app's
  pages exported once per release as static HTML with the kit's CSS (a script, C), so the lab
  swaps variables on real markup; Save downloads the file. Anyone can make a theme for their
  own project this way, which is the funnel's point.

**What the lab shows,** all at once on a desktop and one at a time on a phone:

| Frame | Page | Why |
|---|---|---|
| Landing | the sheet app's home, with the hero in the layout chosen | the first impression, typography and pictures |
| List | a table page, then the same as cards | surfaces, dividers, numbers, density |
| Form | the form with every control | controls, labels, case, buttons |
| Dialog | a confirm dialog over the list | shadows, radius, the ring |
| Menu and header | the shell with the mark | the heading font on the brand |

As first built, each frame was shown in light and dark side by side, at desktop width and at
phone width (a toggle), all frames at once at 42 % of their size. A "greyscale" toggle takes the
colour out: if two themes still read as different, the style layer did its work (the review's
test).

**Changed 2026-10-21 (Johan, after the tester's report of 2026-10-17):** the frames at 42 % of
their size were too small to judge a look by, and light beside dark says little. The lab shows
**one frame at full size**, and the person picks what it shows:

- **The page:** Landing, List (table or cards), Form, Dialog, Shell, as tabs over the frame.
- **The mode:** light or dark, one at a time (a switch; the theme's dark rules apply, not the
  visitor's setting). The greyscale toggle stays.
- **The size:** buttons for the common widths (phone 390, tablet 820, laptop 1280, desktop
  1600), each at 100 % when it fits the window and scaled down only as much as the window needs;
  between them the frame's edge can be dragged, so the breakpoints in between are seen. A
  **"phone beside"** switch shows the phone frame next to the chosen one, since a theme is met
  on both, and that pair is the one worth seeing at once.
- **The starter:** the sheet app is made from the starter chosen (booking by default; crm,
  kiosk, support, status, api, records, articles, the lab's own with every control), so a theme
  is judged on the kind of app it is for. Local: the lab makes the chosen starter's app in its
  temporary folder on the switch (a few seconds, the frame says so). Public: the export script
  saves every starter's pages, and the lab loads the chosen set.

The controls, the file and Save are as before. The old all-at-once sheet stays as the
`theme-sheet.mjs` picture for Johan's look, not as the lab's view.

**As built (A 132 step 1, 2026-10-21):** the page tabs are the lab's frames (Landing, List, Form,
Record: Dialog and Shell come with the starter switch); the mode is sent to the frame, so switching
it does not reload the page; the dragged width runs from 320 to 1920 px; the frame is as tall as
the stage under the bar, so a page is seen as a visitor's window shows it. The starter switch is
step 2.

**As built (A 132 step 2, 2026-10-21):** locally, `smithable theme lab --starter <name>` and the
lab's Starter switch make that starter's app in a temporary folder and serve it on the same
port (the old one is stopped and removed), then the lab signs in to it again; with `--app` there
is no switch. Public: the export saves each starter's pages in `frames/<starter>/` and the fonts
once in `frames/fonts/`; `start.json` lists the starters, booking first, and the switch needs no
server. A starter without a list of its own frames its data page as the list (api), and one
without a landing page its front page.

**The controls,** on the left, grouped as the file is: colours (the brand colour and
background with the derived tokens shown, each overridable as `look.md` §3.3 says), fonts
(body and heading with a specimen line each), headings, surfaces, buttons, pictures, tables,
radius, shadow, density, motion, chroma. Every control writes the file's value, and the file is
shown as text at the bottom, editable both ways (the lab is for designers and developers).

**Starting points:** the thirteen built-in themes, the project's own, and three styles this
note adds as built-ins to show the range (§6). A theme can be started from any, renamed and
saved.

## 4. Compatibility lines

Under the frames, one line per look the ux file can ask for, computed from the theme (no
model): "A cover hero: fine, the primary washes the picture at 60 %." "A split hero: the
heading font at this scale needs a short title." "Cards in a grid: flat cards on this
background have no edge; add a border or a shadow." "Zebra rows with strong dividers: busy."
Each is a rule in `theme-fit.ts` in core (pure, tested), returning `fine`, `note` or `avoid`
with its sentence; the Look tab can show the same lines beside a theme later. The contrast
errors are the same as `smithable validate`'s and block Save.

## 5. The kit's part

The pages read the new variables: headings use `--font-heading`, the scale and the case; cards
and sections their surface; buttons their shape and weight; pictures their corners and frame;
tables their numbers and rows. One pass through the kit's components and the landing sections,
each change a variable, no component branching on a theme name. The generate snapshot changes
once. The theme sheet script keeps working and gains the three styles.

## 6. Three styles to start from

Built as theme files, judged in the lab on the booking starter's pages (the service business
closest to the review's restaurant), then shown to Johan:

| Style | Fonts | Headings | Surfaces | Colours |
|---|---|---|---|---|
| **Nordic restaurant** | Source Sans 3 / Fraunces | 600, normal, large | cards flat, sections open, dividers light | cream and forest green |
| **Street food** | DM Sans / Archivo Narrow | 800, tight, large, upper | cards bordered, sections boxed, dividers strong | near-black and a hot accent |
| **Neighbourhood café** | Nunito Sans / Nunito Sans | 700, normal, regular | cards raised, sections open, dividers none | warm neutrals, soft round |

If they read as three designs in greyscale on a phone, the layer is right; if not, the missing
field shows itself, and it is added before the lab ships.

## 7. Steps, in order

1. **Core:** the style fields in the theme file (schema, validation, the IR), the four presets'
   shapes moved into their files, `theme-fit.ts` with the first six rules; units. (A; Fable
   reviews.)
2. **Adapter and kit:** `themes.ts` writes the variables from the fields, the `SHAPES` table
   goes, the four new fonts pinned, the kit's components and landing sections read the
   variables; the generate snapshot; the three styles as built-in theme files; the theme sheet
   with them. (A; Fable reviews the CSS mapping.)
3. **The preview runtime:** a `theme-css` message that swaps the `<style>` (dev only, from
   Studio's or the lab's origin). (A, small.)
4. **The lab, local mode:** `apps/theme-lab`, `smithable theme lab`, the frames, the controls,
   the file view, the fit lines, Save through `addTheme`. (A.)
5. **The lab, public mode:** the static export script and the docs site page. (C, then B for
   the link from the site.) Since 2026-10-21 the saving is `smithable static`'s (`savePages` in
   packages/cli/src/static.ts): any app's pages saved in the layout the lab frames, so the
   several-starter lab above can take a folder made by the command.
6. **Docs:** the spec reference's theme section, a "Make a theme" page on the docs site.
   (C.)

Tests: units for the fields and the fit rules; the adapter's CSS mapping per field; test-studio
unchanged (the Look tab's preset cards show the new built-ins); a lab test in a browser (open,
change the heading font, see the frame's `<style>` change, save, see the file); the theme
sheet of the three styles in Pictures/claude for Johan.

## 8. Out of scope

Importing a theme from a site (`smithable theme --from` exists and stays), a marketplace of
themes, per-page themes beyond the landing page's own, custom CSS (the hooks in look.md §2 stay
the developer's road), and any layout the ux file does not have: the lab shows layouts, it does
not invent them.
