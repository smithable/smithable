# The look of an app: presentation choices, custom CSS and themes as files (design)

Status: built 2026-09-30 to 2026-10-01 by Fable and Opus; the notes under the sections say how. Proposed 2026-09-30 by Fable, from three questions: what `smithable.ux.yml` can do, whether custom CSS can reach the app's elements, and whether themes could be pluggable with a picture of each. It changes the ux file (more choices, ARCHITECTURE §3.2), the app kit (stable hooks and a custom stylesheet) and how a theme is defined (a file of tokens, built in or the project's own). Merging this document is the go-ahead; §5 splits the work. Step 1 (hooks and `src/custom/styles.css`) built 2026-09-30 by Opus; `data-page` is on `<body>` (so landing pages have it too), and `reserve` joins the `data-kit` values. §1.4 (landing section looks, `setSectionLook`) built 2026-10-01 by Opus; a look that needs a missing picture falls back quietly in the kit rather than with a validation warning, since the ux file is checked without the content file. §1.5 (a landing page's theme, `setTheme --page`) built 2026-10-01 by Opus, with the app theme's keys (`preset`, `brand: { primary, font }`, `density`), so one reader serves both. The Look tab's controls for §1.1–1.5 built 2026-10-01 by Opus: per page a view and an order, a folded form part (columns, a control per field where more than one fits, sections by moving each field into one), and on a landing page its own theme and each section's look.

The rule of the ux file stays: **presets and choices, never CSS**, and it never names a technology. Nothing here positions anything or gives one element its own font or colour. What that rule refuses has a supported way out, custom CSS with stable hooks (§2), so nobody has to copy a kit component to move a button.

## 1. More presentation choices

Built 2026-10-01 (Fable): §1.1–1.3 (`control`, `sections`/`columns`, `view`/`sort`) in core and the kit, with their operations and texts. §1.4–1.5 (landing looks, a landing page's own theme) are still to come.

What the file can do today: the theme (preset, brand colour, one of three fonts, density) for the whole app; a crud page's icon, table columns, a second field under a column, and the form's field order; the colours of choice values. These are the choices asked for most and still refused, each a choice, not a position.

### 1.1 How a field is entered: `control`

```yaml
pages:
  sessions:
    form:
      fieldOrder: [classType, startsAt, capacity, notes]
      control: { capacity: slider, level: radio, notes: textarea, instructor: select }
```

| Control | For | Default when |
|---|---|---|
| `input` | any field | the default for most |
| `slider` | `int`, `decimal`, `money` with both `min` and `max` (validation refuses it otherwise); shows the value beside | never by default |
| `stepper` | `int` with `min` or `max` | never by default |
| `radio` | a choice with at most five values, a yes/no | a choice with at most three values |
| `select` | a choice, a reference | a choice with more than three values |
| `combobox` | a reference | a reference with more than ten records (the kit's `Combobox` today) |
| `textarea` | `string`, `text` | `text` |
| `switch` | a yes/no | a yes/no in a compact form |

`control` names a form's fields, so it lives under a page's `form` as `fieldOrder` does; a calculator's fields ([calculator.md](calculator.md)) take it the same way. The operation `setControl page field control` (`input` removes the choice).

### 1.2 Groups and columns in a form: `sections` and `columns`

```yaml
pages:
  customers:
    form:
      sections:
        - { name: contact, fields: [name, email, phone] }
        - { name: terms, fields: [creditLimit, paymentTerms] }
      columns: 2
```

- A section is a group with a heading, its fields in the order given; fields in no section follow at the end under no heading. `sections` and `fieldOrder` cannot both be given (`fieldOrder` is the one-section case). Section names are keyed in `smithable.content.yml` (`pages.customers.form.sections.contact: { title: How to reach them }`); without a text the name is the heading (`contact` → "Contact").
- `columns: 2` (the default is 1) puts short fields two abreast on wide screens; `text`, lists and pictures always take the full width. One choice, no spans.
- Renaming or removing a field updates the sections, as `fieldOrder` today. The operations `setFormSections page [name:field,field …]` and `setFormColumns page 1|2`.

### 1.3 How a list looks: `view` and `sort`

```yaml
pages:
  classTypes:
    table: { columns: [name, level, duration], sort: -createdAt, view: cards }
```

- `view: table | cards`. Cards show the title, a picture when the model has one (articles.md) and the first three columns; a phone shows cards for every list already, so this is the wide-screen choice.
- `sort: field | -field`, the list's order until someone clicks a column; today newest first.
- Operations `setView page table|cards`, `setSort page [-]field`.

### 1.4 Landing sections have a few looks: `layout`

Each section kind has two or three looks, chosen by name in the ux file, keyed like its texts:

```yaml
pages:
  home:
    sections:
      hero: { layout: split, image: right }     # split (text and picture) | centered (text over the picture) | plain (no picture)
      features: { columns: 3 }                   # 2 | 3 | 4
      classes: { layout: cards }                 # cards | list | grid (pictures only)
      testimonials: { layout: carousel }         # cards | carousel | one (a single quote, large)
      pricing: { highlight: standard }           # the plan drawn forward, by its key in the content file
      faq: { layout: accordion }                 # accordion | list
```

The kit's `Landing.tsx` gets one variant per look, all built on the same tokens. Looks that need something the section does not have (a `split` hero without a picture) fall back with a warning, not an error, so a missing picture never breaks a page. Operation `setSectionLook page section key value`.

### 1.5 A landing page may look different: `theme` on a landing page

```yaml
pages:
  home:
    theme: { preset: playful, font: Nunito Sans }      # the app keeps corporate
```

A public page is often warmer than the tool behind it. Only landing pages take a `theme` (any of the app theme's keys; unnamed ones come from the app's), because they already have their own frame; a crud page in another theme would be two apps. It is the one place a font is chosen for a page. Generated as a second `theme.css` scope (`[data-page="home"]`) with its own variables, nothing else changes. Operation `setTheme --page home preset|primary|font|density`.

### 1.6 Not added, on purpose

Positions, margins, sizes, per-element colours and fonts, button order, custom CSS values, hidden buttons. Each is either a position (no choice fits every app, so it becomes a layout language), or a per-element style (the AI cannot tell a wanted difference from a mistake). The way out is §2.

## 2. Custom CSS with stable hooks

### 2.1 What is there today

The kit's components carry only utility classes (`space-y-6 p-card`); there is no class or attribute a stylesheet can rely on, so `form > div:nth-child(3)` is the only way to reach the buttons and it breaks on the next kit change. And there is nowhere to put such a rule: `src/styles.css` is a kit file, `src/theme.css` is generated, and `src/custom/` has no stylesheet.

### 2.2 Hooks

Every kit component marks its root and its notable parts with data attributes, which is how shadcn/ui does it (`data-slot`), so the idiom is the stack's:

| Attribute | On | Values |
|---|---|---|
| `data-page` | the page's root | the page's name (`customers`, `home`) |
| `data-kit` | a kit component's root | `app-shell`, `nav`, `model-table`, `model-form`, `field`, `search-box`, `dashboard`, `tile`, `calendar`, `landing`, `section`, `users`, `sign-in`, `onboarding`, `calculator` |
| `data-part` | inside a component | `header`, `title`, `actions`, `row`, `cell`, `label`, `input`, `help`, `error`, `empty`, `pagination`, `menu`, `footer` |
| `data-field` | a field's wrapper and its input | the field's name |
| `data-section` | a landing section | its name (the `id` it has today stays) |
| `data-tone` | a badge | `neutral`, `success`, `warning`, `danger` |

The kit uses five shadcn/ui components today (badge, button, card, input, table) and hand-rolls the rest (a combobox, confirmations). From here on, what the kit needs and shadcn has is added with the shadcn CLI, in this order as the work in §5 needs it: `select`, `dialog` (confirmations), `tabs`, `sheet` (the phone menu), `sonner` (notices), `form`, `slider`, `radio-group`, `switch`, `textarea`, `popover`+`command` (the combobox). Their `data-slot` attributes are hooks of the stack's own, so `data-part` is only added where the kit wraps or composes them.

Rules: attributes name what a thing *is*, never how it looks; the set is closed and listed in the generated README, and a value is removed only in a major version. Tests: a snapshot of each kit component's attributes, so a change to a hook is a visible change.

### 2.3 `src/custom/styles.css`

Created once, empty but for a comment, and imported last by the kit's `styles.css`. Ordinary CSS on the hooks and the theme's variables:

```css
[data-kit="model-form"] [data-part="actions"] { justify-content: flex-start; }
[data-page="home"] [data-section="hero"] { min-height: 70vh; }
[data-field="notes"] textarea { font-family: ui-monospace, monospace; }
```

Tailwind's `@apply` works there too, since the file is in the app's stylesheet. It is the owner's file: the compiler never touches it, and `smithable code` may edit it under the same rules as other custom code. The ux file cannot reference it and does not know it exists; the Builder's Look tab shows a line "This app also has custom styles" when the file has rules, so a change that seems not to apply has an explanation.

## 3. Themes as files

Built 2026-09-30 (Fable, core and CLI): `packages/core/src/theme.ts` and `colour.ts`, `themes/<name>.yml` read by `loadSpec`, `smithable themes`, the daemon's `/api/project` lists every theme with its thumbnail for the Look tab's cards (Opus). 2026-10-01: `addTheme <name> --text @file [--use]`, an operation (`Editors.themes`; the host writes the result's `added` files and commits them with the rest, so `undo` removes the theme); the Look tab's "Add a theme" posts it to `/api/op` like any operation (Opus). Left of §3: npm packages of themes.

### 3.1 A theme is data

A preset today is 28 colour tokens in light and dark mode (`theme-presets.ts`, from the design delivery), a font, a corner radius and a shadow. No component knows which preset it is: `theme.css` sets the variables and the kit uses them. A theme is therefore a file:

```yaml
# themes/forest.yml
smithableTheme: 0.1
name: Forest
font: Nunito Sans                 # one of the hosted fonts (Inter, Nunito Sans, Source Sans 3; more added as fonts, never as URLs)
radius: 12px
shadow: soft                      # none | soft | raised
density: comfortable              # the default for apps that do not say
motion: subtle                    # none | subtle | lively: dialogs, the menu, notices, new rows, page changes: never over 0.2 s, since the person is waiting on them; lively alone adds a landing page's entrance, the sections rising as they scroll in and the hero's picture settling once, up to 0.5 s, since nobody waits on it. Reduce motion always wins
light:
  primary: "#2f6b3a"
  background: "#f6f8f4"
  foreground: "#1f2a1f"
  card: "#ffffff"
  accent: "#dfeadb"
dark:
  primary: "#8fd19a"
  background: "#141a14"
  foreground: "#e6ece4"
  card: "#1c241c"
```

- **Token names are the 28 the kit uses** (`background`, `foreground`, `card`, `primary`, `muted`, `border`, `ring`, `success`, `warning`, `destructive`, `chart-1`…, and their `-foreground`s). Any may be given; the rest are **derived** as the brand colour is today: the `-foreground` of a colour is the foreground that reads on it, `muted` and `secondary` are the background stepped towards the foreground, `border` and `input` the same a step further, `ring` the primary, the charts a spread around the primary's hue. A theme can be five colours per mode or all 28.
- **Validation** checks every pair the kit puts together (text on background, card, primary, muted, accent, destructive, the badge tones) for 4.5:1, the ring against the card for 3:1, and both modes; a theme that fails is an error naming the pair and the ratio, as the brand colour's adjustment reports today. The maths (`brand.ts`, OKLCH and WCAG) moves to core, since checking a theme is validation, not generation.
- **Where a theme lives:** the four built-in presets become four such files inside Smithable (checked by the same validation, so the delivery's audit becomes a test; thirteen since 2026-10-04, when nine rule-made themes Johan picked were added as theme files in core's `theme-library.ts`: coastal, navy, editorial, woodland, contrast, nordic, pastel, midnight, craft); a project's own go in `themes/<name>.yml` next to the spec; one shared as an npm package is a package whose main file is the theme file (`smithable-theme-forest`), listed in `smithable.context.yml` under `themes:` since installing a package is an implementation choice. The ux file names any of them by name: `theme: { preset: forest }`. A name that is both built in and the project's is an error.
- **A theme never ships CSS, components or fonts from a URL.** That keeps a theme safe to switch and safe to host: it is data, validated, and the hosted product can offer a gallery of them without vetting code.

### 3.2 Every theme has a picture

The thumbnail is rendered from the tokens, so built-in and project themes look alike and no author draws anything: a small SVG (light and dark halves) with the background, a card, a heading in the theme's font, a line of muted text, a primary button, a success badge and the radius, generated by core (`themeThumbnail(theme): string`). Studio's Look tab (studio-v2.md §3) shows the theme cards with it; `smithable themes` lists the themes with their source; the hosted gallery shows the same picture. The Look tab also takes a theme pasted or dropped as a file ("Add a theme"), which writes `themes/<name>.yml` through an operation (`addTheme name < file`) and is refused with the validation's message when it fails.

### 3.3 What a brand colour does to a theme

Unchanged: `brand.primary` replaces the theme's primary, ring, accent and first chart colour, adjusted for readable text, whatever theme is under it. A theme may give a `chroma` cap as the built-ins do (quiet themes stay quiet).

## 4. Operations, Builder, index

- Every new key has an operation (§1) and the ux companion `follow`s renames and removals, as today.
- Tier-0 phrases: "show capacity as a slider", "put the customer form in two columns", "show class types as cards", "sort sessions by start", "use the forest theme", "make the home page playful". The Look tab offers all of §1 as controls beside the theme cards; nothing here needs a model call.
- The index gains a sentence per choice ("The customer form has two columns and the sections Contact and Terms"), and the summary a line per theme in use.

## 6. Out of scope, for later

- More hosted fonts (a font is a package the app hosts; adding one is a row in `FONT_PACKAGES` and a size budget).
- A theme editor in Studio (sliders for the tokens with the thumbnail live). The file is small enough to write by hand, and the AI can write one from "a warm theme with terracotta" through `addTheme`.
- Translating a theme's name and a section's look into words for the index beyond one sentence.
- Positions, the answer stays custom CSS.

### Decided 2026-10-21: a third density, and radii derived in the kit

From the UI feedback's product decisions (a tester's report of 2026-10-17; Johan's answers of
2026-10-21).

- **`density: comfortable | standard | compact`.** Standard sits between the two: controls
  2.5rem, rows 3.5rem, cells 0.875rem, cards 1.25rem. One density per theme scope, as today: a
  landing page's own theme already gives the public pages their own, which is how "customer pages
  comfortable, staff pages standard" is written; list density and section density stay one
  setting, since two knobs would let the one scale drift apart within a page. Core's value and
  the adapter's row are Fable 61; the theme lab's control A 137.
- **Corner radii per component, derived, no new keys.** Controls a step smaller than the theme's
  `--radius` (the kit's `--radius-md`, two pixels less), cards the radius itself (`--radius-lg`,
  which equals `--radius` in styles.css today), dialogs and drawers a step larger (`--radius-xl`,
  four pixels more). The kit's classes are checked to agree (A 136). Three keys in the theme
  file only if a theme author asks.
