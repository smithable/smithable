# The hero deck: three ways to make one change, and what came of it (design)

Johan, 2026-10-13: three rounded cards, the front one casting a shadow on the two behind, each
with a badge half outside its edge, "Edit by prompt", "Edit without code", "Edit by code"; to
the right the result, which fades as the front card changes; each starter page shows its own.
And: the pictures must come from a script, since Studio's and the apps' looks will change and
there are seven starters. This note is the shape and the script; C makes the pictures (backlog
C 21), B puts the deck on the start page and the starter pages (B 34, B 42).

## 1. What the deck says

One change, three roads, one result. For a starter the deck shows the same change made in the
three ways Smithable offers, and the app before and after it. The viewer learns in a few seconds
that a prompt, a form and the file are the same thing, and that the app follows at once.

| Starter | The sentence (read by the wording rules) | The new field | Where it shows |
|---|---|---|---|
| crm | Customers need a website | `website: url` on Customer | the new-customer form |
| booking | Sessions need a room | `room: string` on Session | the new-session form |
| invoicing | Invoices need a reference | `reference: string` on Invoice | the new-invoice form |
| marketplace | Items need a brand | `brand: string` on Item | the new-item form (My items) |
| status | Incidents need a monitoring date and time | `monitoringAt: datetime` on Incident | the new-incident form |
| records | Items need a tag | `tag: string` on Item | the new-item form |
| api | Tasks need a priority | `priority: low \| normal \| high` on Task | the new-task form |

Each is one `addField` (Johan, 2026-10-13: the result is the record's form for all seven; the
invoicing starter has a due date and the marketplace a condition already, so a reference and a
brand); the data file (`scripts/hero-shots.json`) names them, so a better one later is a line,
not code. Three rules for choosing, from C's mock-up (2026-10-13): the result must be the same whichever way made the change, so for a field it is
the record's **form** (a field added by code never adds a list column, and the three cards must
not differ in what they did); the change must not exist in the starter already (the CRM has a
phone, so a website); and the sentence should be one the wording rules read without a model
("Customers need a website"), so the prompt card shows "No AI needed" and the picture is the same
on every run. A sentence no rule reads stops the script (Studio runs it with no model set up);
choose another wording rather than a model, whose words would differ between runs.

## 2. The cards

Each card is a real screenshot of Studio at 1280×800, cropped to the part that shows the way,
saved at 2× as WebP, light scheme (the hero sits on the start page's own ground):

- **Edit by prompt:** the Changes tab's prompt box with the sentence typed ("Customers need a
  website") and the proposal shown under it, before Apply (A 96 shows every proposal
  first).
- **Edit without code:** the Change form for a field, filled in (the kind of record, the name,
  the type), before the button.
- **Edit by code:** the Code mode editor on smithable.yml, scrolled to the model, the new line
  typed and highlighted, the "Saved" state (the edit saves itself): the editor at its own text
  size (taken in a window under 1024 pixels, where Studio gives the editor the window's width),
  whole lines with the new one near the end. A long line runs off the card's right edge, as in
  an editor; readable text matters more than whole lines (Johan, 2026-10-14).

The three cards are one size, 560×420 (1120×840 at 2×), so they read as a deck: each picture is
fitted whole into it on white, Studio's own background. The prompt card and the form card cut
no word: the prompt card from its label "Describe a change, or ask a question" down, with room
above for the badge; the form card is the field form from the kind of record to its button.

The result is two screenshots of the record's form, whole and from the page's top: before the
change and after it. They line up at the top, so in the fade the new field is the one thing
that appears; the "after" is taller by that field.

## 3. On the page

- Desktop: the deck left (about 45 %), the result right; the front card's badge is in the
  brand's accent, the two behind in the panel's tone. Every five seconds the next card comes to
  the front (a transform and a shadow, 300 ms) and the result cross-fades from "before" to
  "after" once, then stays on "after" until the next card, which shows "before" again for a
  moment and then "after". A click on a card brings it forward and runs the same fade.
- Phone: the deck above the result, cards slightly fanned; the fade the same.
- `prefers-reduced-motion`: the front card is "Edit by prompt", the result is "after", nothing
  moves; a click still switches, without transitions.
- Alt texts from the data file ("Studio's prompt box with 'Customers need a website' and the
  change it proposes").
- Between the deck and the result, in every view (light, dark, phone): an arrow from the front
  card's frame to the result, for now a plain dark triangle (Johan, 2026-10-13: no badge-like
  arrow in a corner; the final form is open). It is one piece of CSS on the page, never part of
  a screenshot, so it can change without a rerun.
- Each starter page (`/starters/<name>`, B 42) renders the deck with its own starter; the start
  page cycles the starters too, one deck at a time, so a visitor sees several apps.

## 4. The script: `scripts/hero-shots.mjs`

Like `starter-shots.mjs`: makes each starter in a temporary folder, serves Studio on a port of
its own (8404), drives it with Playwright as `test-studio.mjs` does, and writes:

```
docs/site/brand/hero/<starter>/prompt.webp
docs/site/brand/hero/<starter>/nocode.webp
docs/site/brand/hero/<starter>/code.webp
docs/site/brand/hero/<starter>/before.webp
docs/site/brand/hero/<starter>/after.webp
docs/site/brand/hero/deck.json
```

`deck.json` is the data the page reads: per starter the change's three texts (the sentence, the
form's values, the YAML lines), the result page's route, the alt texts and the five files.
The script takes its instructions from `scripts/hero-shots.json` (the table in §1 as data:
starter, sentence, operation and arguments, the form's values, the lines, the result route). Steps per starter:

1. `new` the starter; start Studio; wait for the preview.
2. The result "before": the preview's page at the route, from the top to the form's end.
3. The prompt card: type the sentence, wait for the proposal, crop to the box and the proposal.
4. The no-code card: open the Change form for the operation, fill the values, crop.
5. The code card: open Code mode on smithable.yml, go to the model, type the line, wait for
   "Saved", crop. (The change is now applied once, by this save.)
6. The result "after": the same page, from the top to the form's end.
7. Write the WebP files and the starter's entry in `deck.json`.

Deterministic (the same spec and change give the same pictures but for the day's dates, which
the sample data fixes). Not part of `check`; C runs it after a change to Studio's look, a
theme preset, a starter or the kit's pages, and the cloud's Docs or Release workflow picks up
the files as it picks up the starters' pictures. A `--starter <name>` takes one; `--copy <dir>`
copies into Johan's Pictures folder for a look, as `starter-shots.mjs` does.

## 5. Not in it

No generated pictures, no mock-ups kept as the final: the deck is screenshots of the product
or nothing. No video: the fade is CSS. No Twitter tags. The forge stays behind at low opacity
if Johan keeps it.

## 6. Steps

1. C: `scripts/hero-shots.json` and `scripts/hero-shots.mjs`, the seven starters' pictures and
   `deck.json`; a static mock-up of the CRM deck in Pictures/claude for Johan's look first.
2. B: the deck on the start page and on each starter page from `deck.json`; the cycle, the
   click, reduced motion, the phone layout.
3. CLAUDE.md's script list gains the one line; the pictures' licence line as the starters'.
