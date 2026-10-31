# The look gap: what makes the references look better, and what the look system needs (design)

Status: first round, 2026-10-31 (Fable), from Johan's design brief of 2026-10-30 (reference sites per starter) and his words: the starters do not look as good as the sites he linked, and it is unclear whether that is icons, pictures, fonts, colours or themes; the apps may look less alike than they do. Builds on [look.md](look.md) (the ux file's choices, custom CSS, themes as files) and [theme-lab.md](theme-lab.md) (the style layer: fonts, headings, surfaces, buttons, pictures, tables). Backlog Fable 85. Two second reviewers read it; their points are in the text.

## 1. The method

The experiment is repeatable and cheap, so it can run after every change:

1. **A compare sheet per starter.** Two fresh pictures of our starter (taken by the starter-shots script, since the site's own pictures can be a day behind the starter) beside the reference pages the brief picked, all at 1280 wide, one sheet per starter (`look-compare.mjs` in the session scripts; a new folder under Pictures each round).
2. **The analysis by a model with the pictures.** Claude Opus reads the sheet with the look system's vocabulary (theme-lab.md §2 and look.md §1, read from main each run) and the starter's ux file, and answers in five fixed sections: where the gap is, settings to change now (only values that exist), choices the look system lacks (a fixed set of values any app could carry, never a position or CSS), pictures, what not to copy (`look-analyse.mjs`; about forty cents a starter).
3. **A person judges**, on the pictures, and the choices worth building go to A; the starters' own settings go in at once since they are data.

The first round covered the CRM (against Atomic CRM and Shadcn Admin) and booking (against Tensile Pilates and HAAR), the two extremes: an operational tool and a public service site.

## 2. Where the gap is

The same answer for both, in the same order, and it is not colour:

1. **Composition and content.** The references' pages carry facts: Atomic CRM's contact rows hold an initials mark, the role at the company, tags, the last activity and a status dot, with a faceted filter panel beside the list; its home is a summary (figures, tasks due, the latest activity). Tensile's home says where the studio is, counts its studios, teachers and classes, and offers two actions; its timetable opens with a display title and rows of filter chips (studio, time of day, class, level, instructor with small portraits), and colour-codes the classes; HAAR says "opens today at 09:00". Ours show one fact per column; one sentence, two buttons and a row of round icon links that overlap the hero and repeat the header; a schedule of identical grey blocks that say neither how full a class is nor how classes differ. For booking, the schedule is the first gap; for the CRM, the rows and the home.
2. **Typography.** The references set one neutral face at medium weights with sentence-case labels (the tools), or a display face at a large size with small tracked capitals for labels (the sites). Ours sets everything in one face at polite sizes, with a heavy title and tiny letter-spaced column headers. The style layer can already say most of this; the starters do not use it.
3. **Pictures.** Operational screens need none beyond an initials mark per record. Sites need one real photograph, lightly treated, inset as a card rather than buried under a heavy overlay, one per class or service card, and a small portrait per instructor for cards and filter chips. Our booking hero runs edge to edge under a dark scrim since 27 October (a brand-colour wash the day before); both bury the picture.
4. **Colour and chrome.** The references are near-white and quiet, with colour kept for data (tags, status, a class's colour), one ink on warm paper, square bold buttons. Our dark sidebar with a gradient active pill is the loudest thing on the CRM's screen; the booking starter mixes a navy primary, a white header and grey blocks with no shared logic, at sizes so modest the schedule page reads as empty.

So Johan's question has an answer: themes and fonts come second and are half there; the first gap is what the pages carry and how they are composed, which is the ux file's and the kit's; pictures third; icons nowhere.

## 3. Settings to change now (data, A applies)

Each starter gets its own theme file instead of a preset, and its ux file says more. Nothing new is built; the values exist. These are the model's proposals, read by Fable; A may adjust to taste on the pictures.

**CRM** (`examples/crm/themes/crm.yml`, the ux file): body Inter; headings weight 600, tracking tight, scale regular, case none; cards bordered, sections open, dividers light; buttons rounded, regular; tables tabular, lined; pictures round; density compact. The customers table gets the account manager as a column, `below: { email: phone }` stays, sort by name; the form gets sections (contact, terms, notes) in two columns with notes as a textarea.

**Booking** (`examples/booking/themes/stillwater.yml` in place of the ink-and-brass preset, the ux file): body Source Sans 3, heading DM Sans; headings weight 800, tracking tight, scale large, case none; cards bordered, sections open, dividers light; buttons square, bold (the buttons' shape wins over the radius for buttons; the radius is for cards and inputs); pictures corners theme, frame none; radius 4px; shadow soft; chroma 0.06; light: primary `#16181a`, background `#ecebe6`, foreground `#16181a`; dark: primary `#ecebe6`, background `#141516`, foreground `#ecebe6`. The class types page as picture cards sorted by name; the sessions table in time order with the instructor and capacity; selects for the references in the staff form. The round icon shortcuts under the hero are the starter's own ask (`hero: { shortcuts: [schedule, blog] }` in its spec) and go: they repeat the header and overlap the picture.

A round of the theme sheet and the starter pictures after, for Johan's eye; the site's starter pictures are retaken in the same PR, since they are behind.

## 4. Choices the look system lacks

Each is a choice from a fixed set, carried in the ux file or the theme and rendered by the kit for every app; none is a position, a margin or a per-element style (look.md §1.6 stands). Each is one ux key (or one theme field) the kit renders as a variant of a section, a page or a table it already has; the home is the dashboard the spec already has, with two more tiles (decided 2026-10-31: a second page kind for the same thing failed §2.4's simplest form). Ranked per starter by the gap of §2: the CRM's first three are the navigation, the home and the filters; booking's are the schedule's colour and capacity, the filters and the hero.

| Choice | Where | Values | What it changes | Seen in |
|---|---|---|---|---|
| `navigation` | app (ux) | `sidebar` (today) \| `topbar` \| `topbar-centered` | Where the navigation sits: the sidebar, a bar across the top with the wordmark at the left, or the wordmark centred between the links | Atomic CRM (top), Shadcn Admin, HAAR (centred) |
| `chrome` | app (ux) | `dark` (today) \| `light` | The weight of the navigation's surface, apart from where it sits | Shadcn Admin's light sidebar |
| a dashboard at `/` | page (spec) | the dashboard's tiles, and two more: `{ list: Model, when: field, within: 7 days }` and `{ activity: changes }` | A start page: counts of the viewer's visible records, what is due from the date field named (the overdue first, marked), the latest changes for those who may open Activity; over no records, a quiet page. The models and fields are named by the person or by Smith, never guessed | Atomic CRM's dashboard |
| `filters.look` | a list or schedule page (ux) | `default` (today) \| `chips` \| `panel` | How the page's filters show, over the fields its `filters.shown` already names: the drop-downs of today, a row of chips (a referenced record's picture on its chip when it has one), or a side panel with counts. Chips first; the panel is a phone drawer and count queries, built after | Tensile's timetable (chips), Atomic's panel, Shadcn's chips |
| `schedule.colorBy` | a schedule page (ux) | `none` (today) \| a choice field of the model | Calendar blocks take the choice value's colour, which `tones` already gives choice values | Tensile's colour-coded classes |
| `schedule.capacity` | a schedule page (ux) | `none` (today) \| `{ left: field, of: field, look: number \| pips \| bar }` | How the places left show on a session, from the two number fields named (booking's `placesLeft` and `capacity`); a field that is not there falls back to `none` with a warning, as the section looks do | Tensile's "each pip is a bed" |
| `hero.layout: inset` | a landing section (ux) | adds `inset` to `split \| centered \| plain \| photo \| cover` | The picture as a card on the page with the text beside it, in its own colours | Tensile's hero |
| `hero.overlay` | a landing section (ux) | `brand` (today for `cover`) \| `dark` (today for `photo`) \| `none` | How a picture-backed hero keeps its text readable; the defaults are what each layout does today | Tensile |
| `hero.facts` | a landing section (ux) | `none` (today) \| `{ counts: [Model…] }` | A row of figures under the hero text: the count of each model named (instructors, class types, locations), never a guess | Tensile's "Studios 03 · Teachers 08 · Classes 08" |
| `hero.eyebrow` | a landing section (ux) | `none` (today) \| `address` \| `hours` | A small line above the title: the city from the contact section's address, or today's opening status from its hours (both declared in the content file and rendered in the footer already) | Tensile's "Reformer Pilates · Berlin", HAAR's "Opens today at 09:00" |
| `table.mark` | a list page (ux) | `none` (today) \| `initials` \| `picture` | A round mark before the title: initials from the model's title field on a colour derived from them, or the model's picture field | Atomic's contacts |
| `labels.font` | theme | `body` (today) \| `mono` | The face of eyebrows, column labels and small capitals, tracked wide | Tensile's and HAAR's monospaced labels |
| `table.actions` | a list page (ux) | `below` (today) \| `menu` | A "…" menu per row instead of the links under the table | Shadcn's tasks |

The five questions of ARCHITECTURE §2.4, for the set: each is a presentation choice with a small fixed set of values (a position would fail); each has a default that is today's look; each is one ux key or one theme field; the ones that read data (the due and activity tiles, `hero.facts`, `hero.eyebrow`, `schedule.capacity`, `schedule.colorBy`, `table.mark: picture`) read only what the ux key names or what the spec declares (address, hours, the title and picture fields the IR already knows), never a field by its name; each is undoable as any ux change. Every kit variant gets its line in the generate snapshot and, where it is interactive (filters, the menu), a step in the apps' browser check; the per-app files add no tests.

What the analysis said not to copy, and we do not: bespoke editorial devices (a magazine issue line, hand-placed arches, an italic accent word), custom lettering and two-weight headline lockups, domain widgets (a reformer's bed count), a revenue chart that assumes a deals model, demo text, a template's showcase chrome. Photo avatars are not copied either: a mark is initials unless the model has a picture field with a picture in it.

## 5. Pictures

The booking starter's home needs one real photograph of a calm studio in its own colours, and one per class type card; instructor portraits come from the model's picture field (the booking starter's instructors have generated portraits; a model without one shows initials); the CRM needs none. The Pixabay CC0 pipeline (uploaded before 9 January 2019) and the Commons rule of the image library (CC0 or public domain from Wikimedia Commons only, see the site's pictures page and the library's README) supply them, with the credits beside them as today. The brief's Pexels candidates stay candidates: Pexels is not CC0, so not for the redistributable library.

## 6. Looking less alike

Johan's worry was that similar looks are easier to test. They are not what keeps the apps similar: one kit renders every app, and the tests exercise the kit's components. A theme file or a ux file that differs adds no test; a new kit variant does (one line in the snapshot, a browser step where it is interactive), which is the cost of §4 and is paid once per variant, not per app. The thirteen starters look alike because they share one shape (theme-lab.md §1) and say little in their ux files. Each starter with its own theme and ux file, and the choices of §4, gives thirteen designs on one kit.

The theme lab (the outside review's point of 2026-10-30) should then lead with these complete directions, a starter's own theme with its layouts as one card with a picture of the real page, and keep the chroma, the fine typography and the YAML under an Advanced fold. That is a small change to the lab once the starters carry their themes.

## 7. Steps

1. **The settings** (§3): A, the two starters' theme and ux files, the generate snapshot, the starter pictures and the theme sheet retaken; one PR. Now.
2. **The choices** (§4), in the order of the table per starter, a few per PR, each with its default as today's look, the kit's variant, the schema and the ux operation (as the section looks have), the spec reference and the snapshot: A builds, Fable reviews the core bits. On Johan's go after the pictures of step 1.
3. **The next round** of the sheets and the analysis on the other starters (barbers, kiosk, invoicing, marketplace, status, support) after step 1; the choices they need queue at the end of the table unless Johan re-ranks them.
4. **The lab** leads with the directions (§6): A, after step 2.

## 8. Decisions for Johan

1. The two starters get their own theme files with the values of §3 now, and the pictures decide if they stay. Recommended: yes.
2. The choices of §4 are built in that order per starter, a few at a time, with today's look as every default. Recommended: yes; the CRM's first three (navigation, the summary home, the filters' chips) and booking's first three (the schedule's colour and capacity, the filters' chips) close most of what §2 names.
3. The other starters get their round of the analysis after step 1. Recommended: yes.
