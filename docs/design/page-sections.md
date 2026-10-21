# Pages as a list of sections, and a page's frame (design)

Status: proposed 2026-10-22 by Fable, from Johan's questions of 2026-10-21 (a generic way to
build a page from existing parts, the same FAQ on two pages, the menu optional on every page; is
there a point in page kinds once sections exist?) and his decision of 2026-10-22 on the UI
feedback's point 4: the frame is the page's, not the role's, and staff see the members' pages as
members do. Build after Johan reads it: core by Fable, the generated page, Studio and the starters
by A (§8).

## 1. Today

- A page has exactly one pattern key (`crud`, `landing`, `dashboard`, `calendar`, `articles`,
  `order`, `calculator`, `data`, `users`, `settings`, `onboarding`, `legal`, `review`, `custom`);
  two is an error, and the key is the page's kind.
- A landing page is already an ordered list of named sections (hero, records, features, pricing,
  testimonials, faq, callToAction, gallery, contact, footer, a calculator), each with its texts
  under the page and section name in the content file; a dashboard a list of tiles.
- Frames: a landing page has the site frame (the app's name, a way in, its own footer); a public
  crud page and the sign-in page show in the site frame to visitors; everyone signed in gets the
  app shell with the side menu of the pages their role may open (`navigation`). A member of the
  booking app therefore sees the schedule, the blog and My bookings in the same shell as the
  staff, and a second landing page is the only way to show a FAQ in two places.

## 2. The rule

Two layers. **The generic page** is what every page is in the IR and in the generated code: a
route, its access (the auth file), its menu entry (`navigation`), its frame (§4) and `sections`,
an ordered map of named sections. **The kinds stay as shorthands** for it: the ones that only
compose parts (`landing`, `dashboard`) expand to sections and nothing else; the ones that bring
routes or flows beyond one page (`crud` with its record pages and forms, `articles` with a page
per article, `order` with its checkout, `onboarding` with its steps, `users`, `data`, `settings`,
`legal`, `review`, `custom`, and `calendar` and `calculator` as pages) keep their bodies, and
each is also one section of its kind on its own page, so a page of any kind may carry more
sections beside it. A flow kind is written only as a page's kind, one per page, never added as a
section of another page, so two flows' routes cannot meet on one page. The one-word forms stay because
they are what a person or a model writes well (`crud: Customer`, `calendar: Session`) and what
ARCHITECTURE §2.4 protects; the generic form is for what they do not cover.

```yaml
pages:
  about:                                  # a page of parts, no kind
    route: /about
    sections:
      story: { text: }                    # heading and paragraphs, from the content file
      team: { records: Instructor }       # a model's records as cards, as on a landing page
      faq:
      visit: { contact: }
  sessions:
    crud: Session                         # the shorthand: the page is its list and record pages
    sections:                             # more parts around it
      notice: { text: }
      crud:                               # where the shorthand's own section sits (first, when not named)
      faq:
  schedule:
    calendar: Session                     # the page kind: its one section is the calendar; nothing else changes
  planning:
    sections:
      week: { records: Session, view: calendar }   # a calendar on a page of parts is a records section
```

- **Section kinds** are the landing page's today (`hero`, `records`, `features`, `pricing`,
  `testimonials`, `faq`, `callToAction`, `gallery`, `contact`, `footer`, `calculator`), the
  dashboard's tiles as one `tiles` section, and two new ones: `text` (a heading and paragraphs from the content file, the plainest part) and
  `custom: <Component>` (a component of one's own in `src/custom/sections/`, as a custom page
  is). A `records` section takes `view: cards | table | calendar` (cards today), with `search`,
  `filters`, `where` and `limit` as now, so a list on a page of parts is a records section, not a
  crud page.
- **Order** is the order written; `moveSection <page> <section> --before|--after <other>` moves
  one, as on a landing page today. A shorthand's own section sits first unless the sections name
  it by the kind's name, as `crud:` above.
- **Texts** stay under the page and section name in the content file, for every kind of page
  now. **Reuse** is the words', not the section's: a section is a position on a page, so a FAQ on
  two pages is `faq:` written twice, and the content file is where one FAQ serves both: a
  `shared` block (`shared: { faq: {…} }`) that a section's texts point at (`faq: { content:
  shared.faq }`, a path the content file's parser resolves, not a YAML anchor). Built when an app
  has the same words in two places; not in the first step.
- **What a section needs that a page has today:** its own address state when two lists share a
  page: the page's first list (the kind's own, or the first records section) keeps the bare keys
  for good, so a link to it never breaks, and every later list carries its section's name before
  the key (`?team.q=anna`); its texts under `page.section`; its access from its model (a
  records section shows what the viewer may read, and a public page whose section's model
  visitors cannot read shows it empty, with the validator's `public-page-closed-records` warning
  as today).

## 3. Why the kinds stay

Johan asked whether a fully generic page makes the kinds pointless. As the foundation, yes: the
generated code has one page renderer that lays out sections, and a landing page is nothing else.
As the only way to write a page, no: `crud: Customer` says in two words what twenty lines of
sections, routes and forms would say, the first-build reader and the operations know the kinds,
and a kind's flow (a checkout, an onboarding) is not a list of parts. The kinds are the
vocabulary; the sections are the grammar under it.

## 4. The frame

A page's frame is a presentation choice, in the ux file: `pages.<id>.frame: site | app | none`.

- `site`: the public frame, the app's name, a top menu and the site's footer. `app`: the
  workspace shell, with the side menu. `none`: no menu and no page header, for a screen that
  stands alone (a kiosk display, a page embedded elsewhere); such a page is in no menu and is
  reached by its route or a link (a hero's button or shortcut).
- Defaults by kind, which is today's rule written down: landing pages and the articles' public
  pages `site`; everything else `app`; a public crud page `site` for a visitor and `app` for
  someone signed in, until the page says `frame: site`, which then holds for everyone.
- **The frame is the page's, never the role's.** The booking app writes `frame: site` on the
  schedule, My bookings, the blog and home: a member sees the service pages in the site frame
  with a top menu of them, and nothing else, since their grants open no other page. Staff open
  the same pages from the workspace and see them exactly as members do; the site frame shows a
  "Workspace" link to a viewer who may open any app-frame page, and the workspace menu lists the
  site pages under their own heading, so one person sees both views with no role switch and no
  impersonation. There is no `shell.byRole`.
- The menus come from one `navigation`: the site frame's top menu is the site pages the viewer
  may open, in `navigation`'s order; the workspace's side menu the app pages. Layout variants
  within a frame (where the menu is, where the header goes) are words-once.md §4, later.
- Operation `setFrame <page> site|app|none`; `none` returns the default. Studio's Look tab has
  the control on the page.

## 5. The five questions (ARCHITECTURE §2.4)

Common: an about page, a notice above a list, a FAQ in two places, a page without the menu; the
booking starter needs the frame today. Deterministic. Replaces custom pages written for a
paragraph and a FAQ, and the second landing page used as a workaround. Framework-neutral: a page
is a route, a frame and an ordered list of named parts. One grammar for the first-build reader,
Studio's "add a part" and the generator.

## 6. Validation

A page has a kind, `sections`, or both; a kind named again in `sections` places it and takes no
value; a flow kind (§2) appears only as a page's kind, so `sections` never carries `crud`,
`order` or the others with a value. A section's name is unique on its page and is its text key. A `records` section names a
model; `view: calendar` needs a date field as the calendar page does. `text` and `custom` need
no model. `frame: none` on a page that needs sign-in is allowed (the sign-in page itself keeps
its frame). The JSON Schema, the spec reference's `pages` table and a "Sections" section, the
summary ("The about page shows a story, the instructors, questions and answers, and how to
visit"), the operations `addSection`, `removeSection`, `moveSection`, `setFrame`, and the
section's texts in the content schema.

## 7. Not in this

Per-role frames or menus (the grants decide what a role sees; the frame is the page's). Section
reuse beyond shared words (§2). Positions, columns or CSS (a section's look is `looks`, as on a
landing page). Pages inside pages. Changing what a kind's own flow does.

## 8. Steps

1. Core (Fable): `sections` on every page in the IR, the kinds expanding to sections, the
   `text` and `custom` sections, `records` with `view`, the content keys, validation (§6), the
   operations, the JSON Schema, the spec reference, `summarize`; `frame` in the ux file with
   `setFrame`.
2. Adapter (A): one page renderer laying out sections (the landing's section components as they
   are, the kinds' own sections wrapping what they render today), the address prefix for a second
   list, the frame per page with the site menu and the "Workspace" link, `none`.
3. Starters (A): booking's `frame: site` on the schedule, My bookings, blog and home, and an
   about page of a story, the instructors and a FAQ; the theme lab and hero-pairs rerun.
4. Studio (A): the page's sections in What it does with add, move and remove; the frame control
   in Look; the first-build reader offering an about page when a description asks for one.
