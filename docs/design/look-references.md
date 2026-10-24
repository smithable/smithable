# Two reference sites, and what our generated apps cannot yet look like (design)

Status: experimental, 2026-10-24 (Fable, for Johan). Branch `fable/look-refs-experimental`, a draft
pull request not for merging as is. It compares two public sites built on the same stack family
as our generated apps with apps Smithable made from them, lists what the apps cannot express,
ranked by how much look a change buys for how little, and tries the first few.

The two sites (public, with their code):

- **Padel club**: <https://pasiopadelclub.vercel.app>, code
  <https://github.com/viclafouch/pasiopadelclub>. A dark-green sports club: a full-bleed photo
  hero with a heavy italic display face, a black "facilities" band with a bento of cards, a text
  section beside a photo, an app promotion with a phone and store badges, a two-column FAQ, a
  sideways strip of photos, a four-column footer.
- **Bistro**: <https://shadcn-nextjs-bistro-landing-page.vercel.app>, code
  <https://github.com/shadcnstudio/shadcn-nextjs-bistro-landing-page-free>. A one-page restaurant
  site in shadcn/ui: a pink-tinted page, a red primary, Outfit throughout, every section head
  centered under a small pill ("Popular dishes"), four dish cards, stats over a photo, testimonials
  with avatars and stars, offer tiles with text on the picture, a contact block of four cards, a
  one-row footer. Dark mode by a header switch.

The pictures (each reference beside our app, light and dark, desktop 1440 and phone 390, full
page) are in Johan's pictures folder, `look-refs/2026-10-24-1625-padel-and-bistro/`.
`scripts/look-shots.mjs` on the branch takes them again (`node scripts/look-shots.mjs <dir>
<label>=<url> …`, then `--pair` for a side-by-side).

## 1. What was tried

**Padel.** `smithable new padel --from https://pasiopadelclub.vercel.app --yes` read 21 headings
and 12 menu links, chose the booking starter and drafted a French app (courts, sessions,
instructors, credit packs, a blog, a gallery, contact) with a landing page of hero, comfort
(features), app (call to action), FAQ, moments (testimonials), contact and footer; library
pictures for the hero, the logo and the samples. `smithable theme --from … --name pasio --use`
then gave a white page, grey text and a **blue** primary ("no colored button found"), Inter.

Then by Smithable's own means only:

| Change | How |
|---|---|
| The club's theme from its tokens: white page, slate text, dark green primary (`oklch(0.35 0.09 165)`), a light green on navy for dark mode; Inter at 800, tight, large; pill buttons, bold; 16px corners; lively motion | `addTheme pasio-club --text @… --use` (its muted text was refused at 4.3:1, so derived instead) |
| Name "Pasio Padel Club" (the draft took the page's `<title>`) | `app.name` |
| Hero `cover` (the photo across, the primary washed over it, the white button), its button to the booking page, the site's own lead | ux `hero: { layout: cover }`, `hero.button`, content |
| Six facility features in three columns, a court types section (records), the FAQ's six questions as a `list`, a gallery instead of testimonials, contact details and hours, footer text and links; the footer moved last (the draft listed it second) | spec `landing`, ux looks, content items |

How close: **the frame and colors are close, the composition is not.** Light mode at a glance
reads as the same club: the green photo hero with white text and a white pill, the same green on
buttons and the call to action, heavy tight headings. What stays different: the display face
(the club's is a heavy italic extended face; Inter 800 is upright and normal width), the black
facilities band and its bento, the photo beside the text, the phone and store badges, the
two-column FAQ, the photo strip, the transparent header over the hero with a booking button in it.
Dark mode is worse than the reference's light page: `cover` washes the photo with the dark mode's
bright primary, nearly opaque on a phone (§3, gap 6; fixed on the branch, §2).

**Bistro.** `smithable new … --from` and `theme --from` both refuse the page, since its
robots.txt asks not to be read; that is right. The app was made with `--describe` from the page's
visible text instead (hero, popular dishes, about with four figures, testimonials, fresh menu
items, contact, offers, staff manage dishes, offers, bookings and messages); the model chose the
booking starter and the `restaurant` theme. Then:

| Change | How |
|---|---|
| The site's theme from its tokens: pink-tinted page `oklch(0.98 0.01 25)`, deep red-brown text, red primary `oklch(0.55 0.22 27)`, tinted cards and borders, its dark tokens; DM Sans at 600 (Outfit was not hosted); pill buttons; no shadows; square pictures | `addTheme bistro-site --text @… --use` (accepted as given) |
| The draft's "welcome" text and "buttons" call to action dropped (the hero has both), the footer moved last, the about section as four figures (features, four columns), testimonials with three quotes, offers as a picture `grid` | spec, ux looks, content |
| The site's dishes and offers as sample records, with the library's pictures (the generated ones were "Dish 8, €640") | `samples/Dish.yml`, `samples/Offer.yml` |

How close: **colors, type and spacing close; section heads and tiles not.** The tinted page,
red pill buttons, tinted bordered cards and the dark mode all match well. What stayed different
before the experimental changes: every section head is centered under a small pill in the
reference and at the start without one in ours; four dish cards across (ours three); the offer
tiles are two wide pictures with the text and a button on them (ours four small titled pictures);
Outfit; the round plate picture and the second hero button; the alternating tinted bands with
slanted edges; avatars and stars; the contact as four cards beside a photo; the header's
centered in-page links, mode switch and "Book table" button.

After the experimental changes (§2) both apps have centered heads with an eyebrow line, the bistro
has four dish cards and two-column offer tiles, and Outfit.

## 2. Tried on the branch

Each is small, keeps every default as it was, and is written so it can be judged on its own.

1. **A section's eyebrow** (content): `eyebrow` beside `title` in `smithable.content.yml` for a
   hero and the features, records, pricing, testimonials, faq, contact, gallery and text
   sections: a short line over the title in the primary color (`data-part="eyebrow"`). Text only,
   so it translates like a title and `setText` sets it. Both references have one on nearly every
   section ("Nos installations", "Popular dishes").
2. **Centered section heads** (theme): `headings.align: start | center` in a theme file
   (`start` by default). It centers a section's eyebrow, title and lead (two variables,
   `--heading-align`, `--heading-inline`), never a hero, which keeps its own layout. A theme's,
   because in both references it is the site's habit, not one section's.
3. **A records section's columns** (ux): `columns: 2 | 3 | 4` beside `layout` (cards 3, grid 4
   when not said, as today), through the existing `setSectionLook`. Four dish cards across; two
   wide offer tiles.
4. **Outfit** as an eighth hosted font (OFL), the bistro's face and a common geometric sans for
   landing pages. Every app gains the package, as for the other seven.
5. **`theme --from` reads Tailwind 4 sites**: colors are read through a one-pixel canvas, so
   `oklch()` and `color-mix()` values count (before, only `rgb()` did, so a shadcn/ui site of today
   had no primary); links drawn as buttons count as buttons; the page's own background wins over
   bands and photos; a hosted font is matched by its own name first (a DM Sans site kept Nunito
   Sans before). On the padel site the primary is now its green, `#00482e`, not a neutral blue.
6. **A `cover` hero in dark mode** (kit only): the wash is the background tinted with the
   primary (`color-mix(in oklch, var(--primary) 30%, var(--background))`), the text the page's
   own and the button the primary, so the picture shows and the hero is not a slab of the dark
   mode's light primary.

Tests: the theme style test (align, Outfit), the section looks test (records columns, a wrong
value refused), the content test (eyebrows read), the adapter's look test (eyebrow and columns
reach the landing route as props; a section without an eyebrow gets none), the CSS variables.
`docs/spec/v0.1.md` has a sentence for each.

Five questions (ARCHITECTURE §2.4) for 1–3: common (both references, and most landing pages
built on shadcn/ui blocks, do all three); deterministic (a text, two values, three numbers); they
remove a reason to write custom CSS or ask a model to edit a kit file; neutral (a line of text, an
alignment, a count); and better than free text plus custom CSS, since a centered head written in
`src/custom/styles.css` has to know the kit's hooks and breaks with them. Outfit and the
`theme --from` changes add no construct.

## 3. The gaps, ranked by look per change

Cost: S a value and a few kit lines, M a new look with its own markup, L a new section kind or a
change to the frame. "2.4" says whether the five questions pass as proposed.

| # | Gap (seen in) | Change it needs | Cost | 2.4 |
|---|---|---|---|---|
| 1 | Centered section heads with a line over the title (both) | Done on the branch: content `eyebrow`, theme `headings.align` | S | yes |
| 2 | Cards per row (bistro: four dishes, two offer tiles) | Done for records: ux `columns` on a records section; the same on `gallery` (`columns: 2 \| 3 \| 4`) | S | yes |
| 3 | The face (bistro Outfit; padel a heavy italic extended display face) | Outfit done. A wide, heavy display family with italics (an OFL face with a width axis) and a theme field `headings.style: normal \| italic` (refused for a face without italics, as weights are) | S | yes |
| 4 | `theme --from` missed the primary and font of shadcn/ui sites, and refuses a robots-closed page (padel, bistro) | Colors done. Next: read the heading font, weight and style into `fonts.heading` and `headings`; read a class-switched dark mode (`.dark` on `<html>`) when there is a switch and no system setting. A robots-closed page stays closed: the theme lab or a theme file by hand | S–M | n/a |
| 5 | Section bands: padel's black facilities band, bistro's alternating tinted bands | A section look `band: none \| muted \| inverse \| primary` (the section across the width on that surface, its tokens swapped as the hero's `cover` does, contrast checked), and a theme `surfaces.sections: banded` that alternates `muted` bands. The slanted edges stay custom CSS | M | yes |
| 6 | The dark mode of a `cover` hero (padel) | Done on the branch. Kit only: in dark mode wash with the primary mixed into the background (`color-mix(in oklch, var(--primary) 35%, var(--background))`) and use the foreground for text, so the photo shows and the wash is not the dark primary at full strength | S | n/a |
| 7 | A hero's second button (bistro "Order now / Book table") and a full-bleed photo hero with a dark scrim and text at the start (padel) | Spec `hero: { button, secondButton }` with content `secondButton` (an outline button); a hero layout `photo` (the picture across the width, a dark scrim from the start side, white text at the start, at least 80vh on wide screens) | M | yes |
| 8 | The site header: a call-to-action button, in-page links to sections, a mode switch; the header over the hero (both) | Ux on a landing page: `header: { button: <page>, links: [section…], over: hero }`; the mode switch moves from the footer to the header when `links` are given. On a phone, Sign in goes into the menu so the app's name is not cut ("Pasio Padel C…") | M–L | yes, `over` needs care for contrast |
| 9 | Feature cards with icons, figures, a bento (both) | Content `icon` on a feature item (from the navigation's icon set); features `layout: cards \| figures \| bento` (figures: the title large as a number; bento: the first item twice the size on the primary) | M | yes |
| 10 | A text section beside a picture (padel "Réservez votre terrain") and a call to action with a picture (padel's app band) | Content `image` on a text and a call-to-action section; ux `image: left \| right` as on the hero | M | yes |
| 11 | Record tiles with the text and a button on the picture (bistro offers); a card's button ("Full menu") | Records `layout: tiles` (the picture with a scrim, title and amount over it, the card's link as a button) | M | yes |
| 12 | Testimonials with avatars, stars and the heading beside a carousel (bistro) | Content `image` and `rating` (1–5) on a testimonial; testimonials `layout: side` (heading and arrows at the start, the cards scrolling beside) | M | yes |
| 13 | A sideways strip of photos with captions on them (padel) | Gallery `layout: grid \| strip` | S–M | yes |
| 14 | The FAQ in two columns (padel) | FAQ `columns: 1 \| 2` for the `list` layout | S | yes |
| 15 | Contact as four cards beside a photo (bistro) | Contact `layout: list \| cards` and content `image` | M | yes |
| 16 | Footer: social links, one row (bistro), an app download column (padel) | Content `social: { instagram, facebook, … }` (links, the icons the kit's); footer `layout: columns \| row` | M | yes |
| 17 | Round plate pictures and a dish carousel under the hero (bistro) | Not proposed: a picture's shape per picture is a per-element style (look.md §1.6); custom CSS on `[data-hero] img` | – | no |
| 18 | Slanted section edges, the phone mockup, store badges, QR codes | Not proposed: one site's ornament; custom CSS or a custom section | – | no |

What made the first draft look further from the reference than the look does, worth as much as
the gaps above but in the drafting, not the look:

- `--from` drafted the sections but left their items empty: the six facilities and six FAQ
  answers the page showed were not carried into the content file, so the draft showed headings
  over nothing. The page reader has them; the draft should write them as content items.
- The app's name came from the page's `<title>` ("Réservation de courts de padel à Bayonne |
  Pasio Padel Club"); the logo's alt or the header's name is the better source.
- Generated sample records read as placeholders ("Court type 8, €640", "Dish 8"), and the image
  library's sample pictures were off topic (books and a yoga class for dishes, bicycles and
  dumbbells for a padel club). Samples drafted with the app, and pictures chosen per model,
  would carry more of the reference's look than any section layout.
- The drafted landing order put the footer second; the footer should always be placed last when
  a draft lists it.

## 4. Suggested order

Merge 1–2 (with the gallery's columns) as they are, with the dark `cover` fix (6) and Outfit (3)
and the `theme --from` color reading (4), since they are small and every landing page gains.
Then bands (5) and the hero's second button and photo layout (7), which together close most of
the remaining difference at first sight. The header (8) is the largest and touches the frame,
so it wants its own short design note. The drafting points above go to the first-build work.
