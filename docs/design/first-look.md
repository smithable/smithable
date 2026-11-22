# First look: pick a theme, then an image style, when a new app opens in Studio

Status: decided 2026-11-18, not built yet. The order of work is in section 8.

## 1 What the user gets

A new app opens in Studio with an overlay of two steps beside the running preview. While it is
open, Studio shows only the preview and the overlay: Smith's pane and the settings pane (No code,
Code) are hidden, and they come back as they were when it closes, by Keep, Cancel or Escape
(Johan, 2026-11-22).

**Which app is new** is read from the app, not the browser: the server marks the project `asMade`
when the app is a repository of its own whose history holds only the start of the history and the
setting up (commits with `Smithable-Setup`), no change of the owner's and no commit made by hand.
Only then does the overlay open by itself. An app changed since it was made never opens it by
itself, in any browser; the browser's own mark (`lookPickerSeen:<app>`) stays as a second guard,
so the overlay shows once per browser even while the app is still as made.

The two steps:

1. **Theme.** The shipped themes as cards, the picked set first, in its order. Choosing a card
   shows it in the preview at once, on the page being looked at, without changing the app. The
   app's current theme is shown as chosen.
2. **Pictures.** The image styles this app can have, as cards, each showing three of the app's
   own pictures in that style, straight from the library. The chosen style is put into the
   app once, when the look is kept.

"Keep this look" makes the changes and closes it. "Cancel" closes it and changes nothing. Then
Smith's presentation and the guide follow as today. For any app, new or not, Look in the top bar
opens the Look panel beside the preview, without the presentation or the guide. Its theme cards
try a theme on the same way, and "Apply theme" makes it the app's; closing the panel without it
takes the tried theme off. Its other settings apply at once.

No model runs: the themes exist, and the pictures are made beforehand and lie in the image
library. Picking is free, instant and the same every time.

**One part's layout** is not in the Look panel, which holds only the whole app's settings (Johan,
2026-11-21). With Select, a click on a landing section where none of its parts is marked (a hero's
edge or its picture) picks the whole section. Its box is drawn inside the section's own edges, so
all four sides show on a desk and a phone. A small form opens beside it: to its right, else its
left, below or above it, and inside its visible foot only when the section fills the window.
Nothing joins the form to the box. The form lists the choices that arrange that kind of section:
its layout (a hero's two full-width ones among them), columns, the picture's side, height and
background. Each choice is one `setSectionLook` at once, which Undo steps back. "Ask Smith"
hands the same selection to Smith. On a phone the form is a sheet at the foot, the selection
scrolled above it.

## 2 How it works today (read from main, 2026-11-18)

- First run is decided in Studio (`App.tsx`, `firstVisit`), per browser and per app, in the
  browser's storage: the making screen, then Smith's presentation on an overlay, then the guide.
- Themes: `THEME_PRESETS`, the picked themes first. Look's cards ran `setTheme { preset }` on a
  click. There was no trying before applying (changed in §3, 2026-11-22).
- Every applied operation is one Git commit in the app's repository, with the files it changed,
  and can be undone on its own (ARCHITECTURE, "Checkpoints use Git").
- Pictures are placed once, by the CLI at creation (`pictures.ts`, `addLibraryPictures`), fetched
  from the image library: a starter's own files first, then the picked hero over
  `public/images/hero.webp`, the mark to `logo.webp`, sample pictures to `public/images/samples/`.
  The hero's and the logo's words and `generated` go into `smithable.content.yml`, the sample
  pictures' `generated` into `public/images/pictures.json`, credits into `CREDITS.md`. A hero the
  owner already set is kept. Nothing records which library entry a file came from, the library
  has no versions, and no operation changes the pictures later.
- The AI mark is one switch per app (`aiBadge`, on by default), the same in Studio's preview and
  in a published app.

## 3 Step 1: theme

- Look's theme cards become one component used in both places.
- A click in the overlay only tries the theme on (Johan, 2026-11-22: until the picker closes no
  real change should be made). The card shows as chosen at once, and Studio puts the theme's
  CSS, as the app's `theme.css` would have it (`stageThemeSelection` in the browser, then the
  adapter's `themeCss`), into the preview's page through the preview editor's
  `smithable:theme-css` message, the same way the theme lab shows a theme. There is no
  operation, no commit, no regeneration, and no line in Smith or Changes. A page that loads again
  while the overlay is open gets the tried theme again.
- "Keep this look" makes the look's changes through the operation layer: the picture style when
  one was chosen (first, since it needs the image library and is the one likely to be refused),
  then one `setTheme { preset }` when the theme differs from the app's. Each runs on the
  revision the last left. These are the only entries in the app's history, and the only lines in
  Smith and Changes. While they run, Smith's working face shows; the preview keeps showing the
  tried look until the new page has it.
- "Cancel", Escape or leaving the app makes no change, and takes the tried theme off the preview
  page (an empty `smithable:theme-css`). There is nothing to undo, so nothing can undo another
  writer's work.
- On a wide screen the overlay sits to one side, the preview beside it; on a phone it is a sheet
  over the lower half.

## 4 Step 2: image style

### 4.1 Styles and sets in the library

- A **style** is an entry in the library's index: an id, whether an image model makes it, and
  its name and one line about it per language (the library carries the words; Studio shows them).
  The first: Photographs, Lifelike (what a new app gets today), Pastel, Ink wash.
- A **subject** is what a picture shows (a bicycle, a cappuccino, a reading corner), with an id
  of its own. The same subject exists once per style. Each entry gets `style` and `subject`.
- The library gets **versions**: the index names each file with its SHA-256, and the index itself
  has a version id. A version, once published, is never changed; a new picture is a new version.
- A style is offered for an app only when it has a picture for **every** library picture the app
  holds (its hero and each sample picture, matched by subject). So a style either dresses the
  whole app or is not on the list; styles are never mixed and there are no gaps to fill. Starters
  get complete sets first, since their subjects are fixed; apps made from a description gain
  styles as the library grows.
- A complete set has exactly the app's library pictures, one for one, so no file is left over.
- The logo is not part of a style and is never changed here.

### 4.2 What is recorded

- `smithable.ux.yml` gets `pictures: { style: pastel }`. It says what the app has, in words. The
  default is said, not guessed: an app without the key is shown as "Lifelike" only if its placed
  pictures say so (below), otherwise as "your own pictures".
- `public/images/pictures.json` becomes the record of what was placed: for each file, the library
  version, the entry id, the file's SHA-256, its role (hero, sample), `generated` and credit. It
  is written by placing, at creation too from now on.
- A file whose bytes no longer match its recorded hash was changed by the owner: it is theirs and
  is never replaced. A picture with no record is theirs as well. For apps made before this, the
  record is rebuilt once by the host (which reads the files and the index; core does not), by
  matching file hashes against the library's index, never by names.
- A picture the owner changed stays when a style is applied, so the app can then show their
  picture beside the new style. The card says so before applying ("2 of your own pictures stay").
- The key and the record can disagree only after a hand edit of the key. `smithable check` says
  so and names the command that applies the style; generation never tries to.

### 4.3 The operation

- The style is applied once, at "Keep this look" (or at once when a style is chosen from Look
  later), never on every click: a style change fetches and commits files.
- `setPictureStyle { style }` in core changes the key and reports an effect, `place-pictures`,
  as `importRecords` reports its effect: core does no fetching.
- The host (the CLI, and the daemon for Studio) carries the effect out before the commit:
  it resolves the style against one library version into a list (file, entry id, hash, words,
  `generated`, credit), fetches each file, checks each hash, and only when all are there writes
  them: the files under their existing names, `pictures.json`, `CREDITS.md`, and the hero's words
  and `generated` in `smithable.content.yml`. Then the one commit. A failed or partial fetch, or
  no network, refuses the operation and changes nothing.
- The commit holds the old and the new files, so undo brings the old pictures back byte for byte.
- Generation never fetches: the files are in the repository, so generating again, on any
  machine and whatever has happened to the library since, gives the same app.
- A style that later leaves the library changes nothing in an app that has it; the app's card
  then reads "no longer offered" and the other styles stay available.
- The preview must show the new pictures without a reload; a picture's address carries its
  recorded hash where it today carries part of its file name.

### 4.4 Records in the app's own data

Seeding copies each sample picture into the app's uploads, and a sample record stores that copy.
So placing new files alone would leave the records already seeded with the old pictures. The
host therefore also rewrites, in the project's own development data only, each record whose
stored picture is the copy of a sample this change replaces: found by the old sample's hash and
confirmed by comparing the bytes, never by names. It happens inside the operation's data
snapshot, so undo brings the records and files back, and a failure rewrites nothing. The result
says how many records changed. A picture a person uploaded, or one replaced by hand, never
matches and is not touched. A deployed app's data is never touched by a style change.

## 5 The AI mark

Replaced 2026-11-22 by picture-kinds.md (the three kinds of pictures, the badge's default by kind, no
badge in Studio's preview). What follows is the first version as built.

The first version keeps today's behaviour: one switch per app, the mark on every picture an
image model made, the same in Studio and when published. Photographs carry no mark and keep
their credit. A style's card says only what is true whatever the switch: "Made by an image
model" or "Photographs by people", with "More" opening what that means for the mark in this app.

The Photographs style may hold a few pictures an image model made, where no photograph was
found for a subject. Each picture says for itself whether a model made it; such a picture
carries the mark like any other, and the card says how many there are ("2 of 14 made by an
image model").

Showing the mark differently per stage is a later step with its own note.

## 6 Pictures that may not be handed on

Every picture offered in the first version may be published and exported with the app. A source
whose licence forbids that (bought stock) is out of scope here. The one rule fixed now: such a
picture is never written into a project, since a project's files go to its owner at export and
publish. How it is delivered, to whom, and how publish and export are stopped is designed when a
source and its licence are chosen, from that licence's terms.

## 7 What a published app carries

Separate from the picker, to be checked first: a built app seems to carry its sample pictures
though its records start empty. With `pictures.json` naming each file's role, the build can leave
out what no page uses, by that record and not by folder names. Its own task.

## 8 Order of work

| Step | What |
| - | - |
| 1 | Library: versions and hashes in the index, `style` and `subject` on entries, the style list with its words; today's entries labelled |
| 2 | Complete sets for marketplace, kiosk and booking in Photographs, Pastel and Ink wash |
| 3 | Core: the key, `setPictureStyle`, the `place-pictures` effect. CLI and daemon: resolving, fetching, checking, writing, `pictures.json` as the record, the one-time rebuild for older apps |
| 4 | Studio: the two-step overlay, the shared theme cards, its own "seen" mark, Look opens it again |
| 5 | The other starters' sets; described apps by subject |

Step 3 gets the full review and the gate (core, and files written into projects). Tests, at
least: a style change undone restores the same bytes; a changed or uploaded picture survives; an
incomplete style is not offered; no network refuses and changes nothing; a changed library does
not change a generated app; a tried theme writes nothing and Cancel leaves the app as it was;
Keep makes one `setTheme`; Studio's check walks the overlay, keeps, skips and reopens it from
Look.
