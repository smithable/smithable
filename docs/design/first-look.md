# First look: pick a theme, then an image style, when a new app opens in Studio

Status: decided 2026-11-18, not built yet. The order of work is in section 8.

## 1 What the user gets

A new app opens in Studio with an overlay of two steps beside the running preview:

1. **Theme.** The shipped themes as cards, the picked set first, in its order. Choosing a card
   applies it to the preview at once. The app's current theme is shown as chosen.
2. **Pictures.** The image styles this app can have, as cards, each showing three of the app's
   own pictures in that style, straight from the library. The chosen style is put into the
   app once, when the look is kept.

"Keep this look" closes it. "Skip" closes it and puts back what was there when it opened. Then
Smith's presentation and the guide follow as today. Look in the top bar opens the same two steps
again at any time, without the presentation or the guide.

No model runs: the themes exist, and the pictures are made beforehand and lie in the image
library. Picking is free, instant and the same every time.

## 2 How it works today (read from main, 2026-11-18)

- First run is decided in Studio (`App.tsx`, `firstVisit`), per browser and per app, in the
  browser's storage: the making screen, then Smith's presentation on an overlay, then the guide.
- Themes: `THEME_PRESETS`, the picked themes first. Look's cards run `setTheme { preset }` on a
  click. There is no trying before applying.
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
- A click applies the theme with `setTheme`. A second click first undoes the overlay's own
  earlier theme change, so the overlay leaves at most one theme change behind.
- "Skip" undoes the overlay's own changes, newest first, and nothing else. If someone else (a
  second browser, Smith, the command line) changed the app meanwhile so that an undo no longer
  applies cleanly, the overlay says so and leaves the app as it is; it never undoes another's work.
- When Skip had to refuse, the changes are ordinary entries in the app's history and can be
  undone there like any other.
- Clicks are handled one at a time; a click while a change is being applied waits for it.
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

The first version keeps today's behaviour: one switch per app, the mark on every picture an
image model made, the same in Studio and when published. Photographs carry no mark and keep
their credit. A style's card says only what is true whatever the switch: "Made by an image
model" or "Photographs by people", with "More" opening what that means for the mark in this app.

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
not change a generated app; Skip puts back the opening state and refuses when another change
came between; Studio's check walks the overlay, keeps, skips and reopens it from Look.
