# Film in a section: a short silent loop where a picture is

Status: proposed 2026-11-22, not built. Design only. It follows Johan's decision of 2026-11-22 (film
on heroes for sure, other section pictures if it is not much more work). It builds on the section
picture (`setSectionPicture`, spec "Landing pages") and on [picture-kinds.md](picture-kinds.md).

## 1 What changes for the user

- A hero's or a media-and-text section's picture may **move**: a short, silent loop plays where the
  picture is. Nothing else about the section changes: same crop, same wash under the text, same words.
- The picture stays. It is what shows first, what a phone on a slow link, a visitor who asked for
  less motion, a printed page and a shared link get. A film without a picture cannot be set.
- In Studio the section's form has one more row under the picture, "Film", with the owner's own file.
  No new control at the top level.
- A gallery's pictures and a record's pictures do not get film in this step.

## 2 What a film is

| | Rule | Why |
| - | - | - |
| Sound | none; a file with a sound track is refused | a background never speaks; browsers block it anyway |
| Length | 3 to 12 seconds, loops | a loop, not a film to watch |
| Size | at most 1920 × 1080; at most 5 MB | about 3 Mbit/s at eight seconds; more is not seen behind a wash |
| Format | MP4 (H.264), and optionally a WebM beside it | plays everywhere without a player library |
| Controls | none shown; a pause button appears for keyboard and screen-reader users | WCAG 2.2.2: motion longer than five seconds can be paused |

- The film is decoration: it has no text of its own, and the picture's `alt` stays the description.
- The app does not convert film. Studio's upload checks the rules above and says which one failed;
  it does not re-encode (no encoder in the browser or the generated app). The hosted service may
  offer a conversion later; that is its own note.

## 3 Where it is written

In `smithable.content.yml`, beside the section's picture, since the picture is there:

```yaml
pages:
  home:
    hero:
      image:
        src: images/hero-coast.webp
        alt: Waves on a pebble beach
        film: images/hero-coast.mp4      # new; optional
```

- `film` is a file under the app's `public/images/`, as `src` is. A `.webm` of the same name beside
  it is used when it is there.
- A translation file never names a film of its own: the film follows the picture.
- The operation `setSectionFilm <page> <section> [film]` sets or removes it. Refused when the section
  has no picture. `setSectionPicture` with another file removes the film, as it removes `generated`,
  `kind` and widths: they said nothing of the new picture.
- A film has the picture's kind (picture-kinds.md): a film made by an AI that looks real is
  `ai-realistic`, and the badge and the publish review treat it as they treat the picture.

### The five questions (ARCHITECTURE §2.4)

1. *Is it about what the app is, not how it is built?* Yes: "this picture moves" is presentation
   content, in the file that already holds the picture.
2. *Can it be said without a technology's name?* Yes: a file and nothing else. No player, no codec key.
3. *Does it have one meaning in every adapter?* Yes: show the picture, play the loop over it where
   motion is welcome.
4. *Is it off unless written?* Yes. Every starter and every app made before is byte-identical.
5. *Can it be undone?* Yes: the operation without a file removes it; the picture never left.

## 4 What the generated app does

- The section renders the picture exactly as today. When `film` is set it adds a plain `<video>`
  over it: `muted`, `loop`, `playsinline`, `preload="none"`, the picture as `poster`, `aria-hidden`.
- A few lines in the kit start it: only when the section is in view, the visitor has not asked for
  reduced motion, and the browser does not report data saving. Out of view it pauses. If playing
  fails, nothing happens: the picture is there.
- The film is never the page's largest paint: the picture loads first, with its widths, as today.
- No package is added. The generated app stays free of Smithable packages.
- The file is served as the pictures are, from `public/images/`, with range requests.

## 5 Where films come from

1. **The owner's own file**, first and for the first build.
2. **The image library**, later: loops that match a still already in the library, so a starter's hero
   can move. Only clips we may give away as freely as the stills; each with its source and rights
   recorded as the stills have. Which clips and how they are made is the library's own note.
3. **Made for the app by a model**, later still, and only as a choice the owner makes; it follows
   picture-kinds.md like any generated picture.

The builder never adds a film by itself in the first step: an app's first look does not depend on one.

## 6 Steps

1. Core: the key, its validation (file kind by first bytes, the rules of §2), `setSectionFilm`,
   the spec reference. Kit: the `<video>` and the start rule. Tests: a hero with and without, reduced
   motion, removal with the picture.
2. Studio: the "Film" row in the section form, upload with the checks, Cancel puts it back.
3. Media-and-text sections (the same code path; a separate check of the layouts).
4. Library loops and the starters that use them.

## 7 Not decided

- Whether a published app on the hosted service converts an owner's film that breaks the size rule,
  or only refuses it.
- Whether a hero with a film shows the pause button to everyone or only on focus.
