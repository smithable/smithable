# Theme-coloured pictures: drawn library pictures in the app's own colours

Status: the CLI can apply the tint rule. Preparing and showing an offer in Studio is pending.
The design follows the
trial of 2026-11-20/21, two rounds of sheets on contrasting themes, where Johan chose variant B
("light, keep hues, 25% back toward the original"). It builds on first-look.md §4: image styles,
the record in `pictures.json`, and the host's `place-pictures` effect.

**Changed 2026-11-22 after the comparison sheets: a theme change keeps the current pictures. Coloured
themes qualify for a light tint and greyscale themes use the original drawings. §10 supersedes the
earlier design where they differ.**

## 1 What changes for the user

Today an app in the Ink wash style shows its pictures as drawn: paper white, grey-black ink and one
violet wash. On a theme with a teal primary and a warm paper background, the violet is the only colour
on the page that belongs to no theme. With this change, an app whose pictures are in a drawn style
gets them in its theme's colours:

- the paper takes the theme's background;
- the ink takes its foreground;
- the wash takes its primary;
- the picture's other colours (skin, wood, leaves, food) keep their hues.

The whole result is then blended a quarter of the way back toward the drawing. The pictures still look
drawn, not printed in three inks, and they sit on the page as if made for it. A theme change re-colours
them, so they follow the theme.

## 2 What is recoloured

- **Recoloured:** pictures in the **Ink wash** style only, both heroes and samples (3 heroes and 26
  samples in the library today). The rule depends on a style with one known wash colour, on paper,
  in ink. The trial covered only this style.
- **Not recoloured:**
  - Photographs and Lifelike pictures. A rule that moves paper and ink has nothing to move in a
    photograph, and people's skin and food in a photograph must stay as they are.
  - Logos, which are never part of a style (first-look §4.1).
  - Pictures the owner placed or changed (no record, or a hash that no longer matches; first-look §4.2).
  - Pastel, until a trial on its pictures (§8).
- **Inside an Ink wash picture, nothing is left exactly as drawn.** Every pixel moves toward the theme,
  and then 25% back. What keeps its character is the colour outside the wash: a face, a loaf of bread
  or a wooden table keeps its offset from the paper-to-ink scale, so it stays recognisably the same
  colour while its base follows the new scale (not an exact hue match, §3). The trial
  included people (a yoga class, someone stretching) and food (a salad, a food truck). The faces and the
  food kept their hues in variant B, which is why B was chosen over the stronger variant A.

## 3 The rule (variant B), with the trial's parameters

All the arithmetic is per pixel in OKLab, so lightness and hue are handled the way they are seen.

1. **The picture's anchors**, read from the picture itself:
   - The **ground** (paper): its lightness is the 90th percentile of the picture's lightness; its a
     and b are the separate medians of a and b over the pixels at or above it.
   - The **ink**: the same at the 2nd percentile, over the pixels at or below it.
   - The **wash**: the separate medians of L, a and b over the pixels with chroma above 0.03 whose hue
     is within 30° of the centre of the style's 10° hue bin (for a wash hue of 300°, the bin 300–310°,
     centre 305°).
   - The style's wash hue is a fixed property of the style, recorded in the library: 300° (violet) for
     Ink wash. It is not detected per picture. In the trial, detection picked the wrong colour for some
     pictures: in the yoga class, 86% of the chroma-weighted colour is warm (about 75°) and only 13% is
     near the violet wash.
2. **Each pixel's place:**
   - Its position t on the ink-to-ground scale is its lightness between the two, clamped to 0–1.
   - Its colour offset from the source scale at t (its a and b minus the scale's) is projected on the
     wash's direction (the wash's a, b as a unit vector): the projection is "along".
   - Its wash weight w is along divided by the wash's chroma, clamped to 0–1.
   - The "rest" is the offset minus the whole projection when along is positive (even where w is
     clamped at 1), and the whole offset when along is zero or negative.
3. **The theme's version of the pixel** is built in four steps:
   1. Start from the same position t on the theme's foreground-to-background scale (all three of L, a,
      b mixed).
   2. The wash's target: lightness = that scale's L at t, plus half of (the primary's L minus the theme
      scale's L at the wash anchor's own position, which is not clamped); a and b = the primary's hue
      at the primary's chroma. So the wash keeps its weight on the page and does not turn into a dark
      button colour.
   3. Mix the pixel toward that target by w, in all three of L, a and b.
   4. Add the rest to a and b, unchanged. This is "keep hues".
4. **25% back:** the result is mixed in OKLab with the original pixel, by 0.25 toward the original.
5. Back to sRGB with each channel clipped to 0–1 and rounded, then written as WebP at quality 82, the
   same size as the original.

Any change to this list, or to the wash hue, is a new rule version (§5).

The **light** mode's three colours are used, whatever mode the app is shown in. The pictures are light
drawings (the library's index marks them `tone: light`), framed on the page as they are today in dark
mode. A dark-mode variant would need a second file per picture and was not tried (§8).

## 4 Where it runs: in the host, when pictures are placed (recommended)

The two candidates:

| | Stored variants in the library | In the host when placing |
| - | - | - |
| What it is | The library's build writes one recoloured file per Ink wash picture per built-in theme, and lists them as entries | The CLI and the daemon recolour the library's original while carrying out `place-pictures` |
| Files | 29 pictures × about 70 built-in themes = some 2,000 files, about 220 MB (light mode only), on top of 3.2 MB of originals. Each new theme adds 29 files and a library version; each new Ink wash picture adds about 70 | None in the library; in an app, the same files it has today (one hero and its samples) |
| A project's own theme | Nothing that matches: the nearest built-in theme's pictures, or the originals | Its own colours, like any theme |
| Theme change offline | The files must be fetched (refused without the network) | Works from the cached originals (§5) |
| New code | Only in the library's build | A WebP decoder and encoder in the host (WebAssembly, pinned, so the output is the same on every machine); none in the engine packages or in the generated app |

**Recommended: in the host.** It is the only option that serves a project's own theme. It needs no
library version per theme. The work sits where pictures are already fetched, checked against their
hash and written. Core still fetches nothing, and generation still never fetches or recolours: the
recoloured files are in the repository, and generating again gives the same app.

The recolouring must be deterministic: the same original bytes, the same three colours, the same wash
hue and the same rule version give the same file, byte for byte. That needs the whole path pinned: the
decoder, the colour arithmetic with its clipping and rounding, and the encoder with its settings. A
test checks it with a fixed source picture and the expected output hash, run on the CLI's and the
daemon's path on each supported platform (§7). Undo does not depend on it: the old files are in the
commit either way.

## 5 How a theme change picks the pictures

1. `setTheme` changes the theme as today. When the app's `pictures.style` is a recoloured style, it reports the same
   `place-pictures` effect `setPictureStyle` does.
2. The host recolours each placed library picture from its original, never from the picture already
   recoloured, so colours never drift over many changes. It takes the original from its cache of library
   files, or fetches it, or from the service's mirror in a hosted workspace, always checked against the
   original's hash.
3. **Two hashes per file.** `pictures.json` keeps:
   - `sha256`: the hash of the file as placed (recoloured). As in first-look §4.2–4.4 it tells an
     owner's change, goes in the preview's address and finds the seeded sample copies to rewrite;
   - `source`: the library original's hash, used only to find and check the original. It can also be
     resolved from the record's library version and entry id, which never change.
   - `colours`: the three colours used, and `rule`: `ink-wash-b25`, the rule's version, or `none`
     with the reason for a fallback (§6).
4. **All or nothing, as first-look §4.3.** The host recolours every picture to be changed before it
   writes any. On success it writes the files and `pictures.json` together with the theme in the one
   commit, and rewrites the development sample copies inside the operation's data snapshot, so undo
   brings back the theme, the files and the records together.
5. **An original missing (no network, not cached):**
   - For `setTheme`: the theme alone is changed and committed; every picture, `pictures.json` and the
     sample copies stay as they were, none half done. A theme change is never refused for want of the
     pictures. The result says so in a line, and `smithable check` says it too: the recorded `colours`
     differ from the theme's. It names `setPictureStyle` with the app's present style, which runs even
     when the style key already says that style, and places and recolours.
   - For `setPictureStyle`: refused and nothing changed, as today.
6. `setTheme --page` changes no pictures and reports no effect.
7. **The time it takes.** The trial's script took about a second per picture on the development
   machine (66 files in 66 seconds on one core, decode and encode included, in plain per-pixel
   JavaScript), so a theme change waits some 10 seconds for a hero and ten samples. Recolouring the
   pictures four at a time, or in tighter code, should bring that to a few seconds. Studio shows the
   step as it does for `setPictureStyle`.
8. **A theme tried, not yet applied:** Studio's Look tab and the theme lab show a theme before
   `setTheme`. There the pictures stay in the present colours, and the preview says so in a line,
   until the theme is applied. Recolouring for every theme tried would cost that time again for each
   theme.
9. Files the owner changed and files with no record are left alone, as in first-look §4.2. The card's
   "2 of your own pictures stay" covers a theme change too.

## 6 A project's own theme, and the fallback to the original

- A theme in `themes/<name>.yml`, or a theme pasted in the Look tab, gets its pictures in its own
  colours by the same rule, since only its light background, foreground and primary are read.
- **The original is placed instead**, and the record says `rule: none` with its reason, when the
  recolouring would make an unreadable picture or cannot run. The cut-offs are proposals, to be
  checked on the sheets (§7):
  - `theme`: the theme's light foreground and background differ by less than 0.40 in OKLab lightness
    (the built-in themes differ by 0.55 or more, and the originals' own ink and paper by about 0.55);
  - `picture`: the picture's ink and paper differ by less than 0.20 in lightness (the rule divides by
    that span), or fewer than 0.5% of its pixels qualify as wash. With no qualifying pixel at all the
    wash has no colour to read; with a few, it is read from those few, which the sheets must show to be
    good enough;
  - `codec`: the decoder or encoder failed.

  Studio's card shows "as drawn" for such a picture. `check` treats `theme` and `picture` for the
  current colours as settled, and treats `codec`, or colours that differ from the theme's, as worth
  another try.

## 7 How the look is checked

- **A sheet per theme:** a script in the engine repository renders every Ink wash picture in every
  built-in theme's colours, each on its theme's own background, at card and hero size. It is the
  trial's script, made permanent, in the way `scripts/theme-sheet.mjs` works for themes. Johan looks at
  the sheets before the rule ships and after any change to the rule. A new theme in the library gets
  its sheet in the same pull request.
- **A test for each built-in theme**, on the decoded output WebP, with ink and paper read as the
  anchors in §3 read them:
  1. the recoloured hero's ink-to-paper lightness difference is at least 0.40;
  2. its paper is within a quarter of (original paper minus theme background) plus 0.01 of the theme's
     background in lightness: the 25% blend keeps a quarter of the original's paper, and the rest is
     encoding;
  3. a fixed source picture with fixed colours gives the expected output hash, on each platform (§4).

  These test the rendered pictures; whether a theme gets recoloured pictures at all is §6's rule.
- No text sits on these pictures except on a hero, where the text has its own dark scrim or the
  primary's wash, so a picture's colours do not change text contrast.

## 8 Not done

- Photographs and Lifelike pictures, including people's skin and food in photographs: never
  recoloured.
- Logos and the app's own uploaded pictures: never recoloured.
- **Pastel:** the style is listed but has no pictures in the library yet. It waits for them and for a
  trial of its own, since the rule assumes one wash colour.
- **A dark-mode variant:** one file serves both modes, as today.
- **Landing pages with their own theme** (`setTheme --page`): they show the app theme's pictures.
- **Recolouring in the browser:** at run time with CSS filters, or in the generated app. CSS filters
  cannot do a per-colour mapping, and the app must not depend on Smithable.
- **Deployed apps' data:** sample records that hold a copy of a picture are rewritten in development
  data only, as in first-look §4.4.

## 9 Order of work

1. **The library:** the style's wash hue as a field of the style in the library's manifest and index
   (`washHue: 300` for Ink wash).
2. **The host:** the rule as a small module beside `picture-style.ts`, with the codec and the tests in
   §7. `place-pictures` recolours when the style is a recoloured one, and `pictures.json` gets `source`,
   `colours` and `rule` (§5).
3. **Core:** `setTheme` reports `place-pictures` when the app's style is recoloured. The spec reference
   and the operations page say so.
4. **The theme sheet script** for the pictures. Johan reads the sheets before the change merges.

## 10 A light tint for coloured themes (2026-11-22)

The 2026-11-22 comparison sheets favoured a light tint across the coloured themes sampled. The
design adopted one tint and one greyscale cutoff. Applying a theme leaves the pictures in place
and the person decides whether to use the offered set.

- **A theme change changes the theme only.** `setTheme` reports no `place-pictures` effect and waits for
  no pictures. The app keeps the pictures it has. This replaces §5 points 1, 5 and 7.
- **Which rule a theme gets**, read from the theme's light primary in OKLCH, never from its name:

  | Primary's chroma | Offer | Rule recorded |
  | - | - | - |
  | At or below 0.02 | the original drawings | `none` |
  | Above 0.02 | a light tint, 90% back toward the drawing | `ink-wash-b90` |

  The rule measures the light primary in force, including any brand colour override, in the same
  sRGB representation used by the [theme measurement sheets](../../scripts/theme-sheet.mjs).
  Run the sheet script with `--all` for every built-in theme. The CLI host's
  `INK_WASH_GREYSCALE_CUTOFF` supplies the cutoff to both the sheets and `validate --explain`.
  §6's picture and codec fallbacks still apply. Set §7's paper lightness bound for the light tint
  when its rendered output is measured.
- **The host prepares the set in the background** after the theme is applied, from the originals, into
  a folder outside the project's files. Nothing in the project changes while it works. A newer theme
  change discards a set still being prepared for the older one.
- **An offer is made only when it would change something.** A coloured theme offers a light tint
  when it differs from the placed pictures. A greyscale theme offers the drawings when the placed
  pictures were recoloured for an earlier theme.
- **Studio offers it** with a quiet notice, "Pictures to match your theme are ready", opening a
  before-and-after of the hero and a few samples, with "Use these" and "Keep mine".
- **An offer is bound to what it was made from:** the style, the library version, the theme's three
  colours, the rule, and the hash of each file it would replace. "Use these" checks all of them again.
  A file changed since is left alone, as §5 point 9; a changed theme or style withdraws the offer.
- **"Use these" is one operation: `setPictureStyle { style, recolour: true }`** with the app's present
  style, carried out as §5 points 2 to 4: all or nothing, one commit, the records and sample copies with
  it. Undo brings back the earlier files and records and leaves the theme as it is.
- **"Keep mine" is remembered per person in Studio**, for that binding. The same offer is not made
  again; a different theme, style or library version makes a new one. Nothing is written to the project.
- **At creation it is the same**: a new app gets the drawings as they are, and the offer follows.
- **From the command line:** `setPictureStyle` with `--recolour` prepares and applies in one step.
  Without the flag it places the drawings as drawn. With the flag on a style that is not recoloured (§2),
  it is refused with the reason and nothing changes; on a greyscale theme it places the drawings and
  says why.
- **The file's statement that a model made it** (picture-kinds.md §7) is written again into every
  recoloured file and checked; without it the recolouring has failed.
- `pictures.json` records the rule used, so `check` no longer reports colours that differ from the
  theme's: after this that is a normal state.
- The same prepare-in-the-background-and-offer pattern can carry other picture improvements later. Each
  would be its own design.

**Order of work, replacing §9 points 2 and 3:** the host's module and codec as before; the background
preparation and the offer in Studio; `setTheme` unchanged in core; the `--recolour` flag and the record's
`rule` values in the spec reference.
