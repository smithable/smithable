# Film in a section: a short silent loop where a picture is

Status: proposed 2026-11-22, not built. Design only. It follows Johan's decision of 2026-11-22 (film
on heroes for sure, other section pictures if it is not much more work). It builds on the section
picture (`setSectionPicture`, spec "Landing pages") and on [picture-kinds.md](picture-kinds.md).

## 1 What changes for the user

- A hero's or a media-and-text section's picture may **move**: a short, silent loop plays where the
  picture is. Nothing else about the section changes: same crop, same wash under the text, same words.
- The picture stays. It is what shows first, and all that a visitor who asked for less motion or for
  data saving, a printed page and a shared link get (§4). A film without a picture cannot be set.
- In Studio the section's form has one more row under the picture, "Film", with the owner's own file.
  No new control at the top level.
- A gallery's pictures and a record's pictures do not get film in this step.

## 2 What a film is

| | Rule | Why |
| - | - | - |
| Sound | none; a file with a sound track is refused | a background never speaks; browsers block it anyway |
| Length | 3 to 12 seconds (both included), loops | a loop, not a film to watch |
| Picture size | shown size (after the file's rotation) at most 1920 on the long side and 1080 on the short | landscape and portrait both; more is not seen behind a wash |
| File size | one file of at most 5 000 000 bytes, and at most 5 Mbit/s on average (bytes × 8 / seconds) | a three-second clip may not spend the whole allowance; and the file stays in the app's history for good (§4) |
| Format | MP4 with H.264 picture, the index (`moov`) before the data | plays everywhere without a player library; with the index last nothing shows until the whole file is fetched |
| Pause | a Pause button is shown to everyone whenever the film runs | WCAG 2.2.2: a loop repeats past five seconds whatever its length |
| Flashing | not more than three flashes in a second | WCAG 2.3.1; the form says so, see below |

- A WebM beside the MP4 is not in these steps: one operation carries one file, and a second file found
  by its name would be shown without having been checked.
- The film is decoration: it has no text of its own, and the picture's `alt` stays the description.
- **Where the rules are checked.** Core checks only what it can without reading a file: the name, under
  `images/`, ending `.mp4`. The bytes are read by the host, as a picture's are: Studio's server at
  upload, and `smithable check` for a file put there by hand. It reads the container's boxes (brand,
  codec, a sound track, length, shown size, where the index is) and names the rule that failed.
- Flashing cannot be measured by that read. Studio's form states the rule beside the upload, an
  owner's file is the owner's to answer for, and a clip in the library is checked before it is added.
- The app does not convert film. Nothing re-encodes (no encoder in the browser or the generated app).
  The hosted service may offer a conversion later; that is its own note.

## 3 Where it is written

In `smithable.content.yml`, beside the section's picture, since the picture is there:

```yaml
pages:
  home:
    hero:
      image:
        src: images/hero-coast.webp
        alt: Waves on a pebble beach
        film:                              # new; optional
          src: images/hero-coast.mp4
```

- `film.src` is a file under the app's `public/images/`, as the picture's `src` is.
- **The film has its own origin.** A photograph may carry a film a model made, or the reverse, so
  `film` takes the same origin keys a picture has (picture-kinds.md) and inherits nothing from the
  picture. An owner's upload is recorded as an owner's file, as an uploaded picture is.
- The badge follows what is seen at that moment: the picture's origin decides while the picture
  shows (before the film starts, and for a visitor who never gets the film), the film's while the film
  plays. An owner's switch for the section's badge covers both. The publish review lists the film
  as its own item, by its file; a "keep" given to the picture does not cover it, and a film that is
  replaced is reviewed again.
- A film plays only over the picture it was set with. A language whose file names its own picture
  for the section shows that picture and no film, in these steps.
- The operation `setSectionFilm <page> <section> [film]` sets or removes it. Refused when the section
  has no picture. `setSectionPicture` with another file removes the film, as it removes `generated`,
  `kind` and widths: they said nothing of the new picture.

### The five questions (ARCHITECTURE §2.4)

1. *Common across many applications?* Yes: a moving hero is usual on the sites of the businesses
   the starters are for (food, travel, studios, trades), and any landing page can have one.
2. *Deterministic?* Yes: a file name in, one element out. No model takes part.
3. *Does formalizing it reduce AI use or ambiguity?* Yes: without the key a film is custom code in
   every app that wants one, written by a model each time, and the poster, reduced-motion and
   pause rules are then written (or forgotten) each time.
4. *Technology-neutral?* Yes: a file and nothing else. No player, no codec key.
5. *Materially better than free text plus custom code?* Yes: the section keeps its crop, wash, badge
   and publish review, which custom code would have to copy.

It is off unless written. The film's code is a kit file of its own that the generator writes only
into an app that has a film, and the page that has the film hands it to the section. The kit's
landing file gains one optional place for it, a plain property that an app without a film never
fills; it is not cut into variants by the generator. So an app without a film gets the same pages
as today and no film code, and the operation without a file undoes it and takes the kit file out.

## 4 What the generated app does

- The section renders the picture exactly as today. When a film is set, a plain `<video>` lies over
  it: `muted`, `loop`, `playsinline`, `aria-hidden`, no `poster` (the picture is already under it; a
  poster would fetch a second copy), and **no source yet**.
- The kit's film file gives it its source and starts it only when all of these hold: the section is in
  view, the visitor has not asked for reduced motion, the browser does not report data saving, and
  the visitor has not paused it. A browser that reports nothing about data saving is not thereby
  known to be on a fast link; the claim is only that a visitor who asked to save data fetches no film.
- The video is invisible until its `playing` event. If the fetch, the decoding or the start fails, it
  is hidden again and the picture shows: nothing else happens. In print the picture shows.
- Out of view it pauses, and comes back when in view. A hidden tab pauses it.
- **Pause.** While the film runs, a small button in a corner of the section says Pause (then Play),
  outside the hidden video, for pointer, touch, keyboard and screen reader alike, with a visible
  focus ring and its own backing so it reads over every frame. A visitor's pause holds for the page
  view: scrolling away and back, or leaving the tab and returning, does not start it again.
- Reduced motion is listened to, not only read at the start: switched on while the film plays, the
  film stops and the picture shows.
- The wash, the section's text and the badge lie above the video, as they lie above the picture. The
  wash is the same over every frame, and strong enough for the section's text over a white frame, as
  it is over a white picture; the tests check the text's contrast on a film with a bright frame as
  well as on the picture.
- The picture loads first, with its widths, as today, and is meant to stay the page's largest paint.
  That is measured in the tests (paint and bytes fetched), not assumed.
- The static frames of a page (`smithable static`, which have no scripts) leave the video out; the
  picture shows.
- No package is added. The generated app stays free of Smithable packages.
- The file is served as the pictures are, from `public/images/`. Safari plays a video only from a
  server that answers a range request with a part (206): the generated app's production server and
  the hosted service's static path are checked for that in step 1, and fixed there if they do not.
- A film is up to five megabytes in the app's history for good, since every change is a commit that
  can be undone. That is the reason for the size rule, and Studio's form says it once.

## 5 Where films come from

1. **The owner's own file**, first and for the first build.
2. **The image library**, later: loops that match a still already in the library, so a starter's hero
   can move. Only clips we may give away as freely as the stills; each with its source and rights
   recorded as the stills have. Which clips and how they are made is the library's own note.
3. **Made for the app by a model**, later still, and only as a choice the owner makes; it follows
   picture-kinds.md like any generated picture.

The builder never adds a film by itself in the first step: an app's first look does not depend on one.

## 6 Steps

1. Core: the key (name check only), `setSectionFilm`, `setSectionPicture` clearing it, the spec
   reference. Kit: the film file, written only when a film is set. Host: the byte check, in
   `smithable check`. The range check of both servers.
2. Studio: the "Film" row in the section form, upload with the checks, the try-on, Cancel puts it back.
3. Media-and-text sections (the same code path; a separate check of the layouts).
4. Library loops and the starters that use them.

Tests with the first two steps: an app without a film has today's pages and no film file; a three-second
loop; pause by touch and by keyboard; coming back into view after a pause (it stays paused); a start
that is blocked and a file that does not decode (the picture shows); reduced motion and data saving
from the start (no film request at all) and reduced motion switched on mid-play; a photograph with a
generated film and the reverse, playing and not (badge and review); a bright frame under the
text (contrast); a film replaced (reviewed again); a film removed (the output is
what it was before); each refusal of §2 on a file built by hand for the test.

## 7 Not decided

- Whether a published app on the hosted service converts an owner's film that breaks the size rule,
  or only refuses it.
- Whether a language's own picture may later carry its own film.
