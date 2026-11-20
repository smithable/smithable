# Theme-coloured pictures: drawn library pictures in the app's own colours

Status: proposed 2026-11-21, not built. Design only. It follows the trial of 2026-11-20/21, two rounds of
sheets on two contrasting themes, where Johan chose variant B ("light, keep hues, 25% back toward the
original"). It builds on first-look.md §4: image styles, the record in `pictures.json`, and the host's
`place-pictures` effect.

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
  and then 25% back. What keeps its character is the hues outside the wash: a face, a loaf of bread or
  a wooden table keeps its hue, and only its lightness follows the new paper-to-ink scale. The trial
  included people (a yoga class, someone stretching) and food (a salad, a food truck). The faces and the
  food kept their hues in variant B, which is why B was chosen over the stronger variant A.

## 3 The rule (variant B), with the trial's parameters

All the arithmetic is per pixel in OKLab, so lightness and hue are handled the way they are seen.

1. **The picture's anchors**, read from the picture itself:
   - The **ground** (paper) is the 90th percentile of lightness, with the median colour of the pixels
     at or above it.
   - The **ink** is the 2nd percentile, with the median colour of the pixels at or below it.
   - The **wash** is the median colour of the pixels within 30° of the style's wash hue and with chroma
     above 0.03.
   - The style's wash hue is a fixed property of the style, recorded in the library: 300° (violet) for
     Ink wash. It is not detected per picture. In the trial, detection picked the wrong colour for some
     pictures: in the yoga class, 86% of the coloured area is warm (75°) and only 13% is the violet wash.
2. **Each pixel's place:**
   - Its position on the ink-to-ground scale is its lightness between the two, clamped to 0–1.
   - Its colour beyond that scale is split into the part along the wash's direction and the rest.
   - Its wash weight is the part along the wash divided by the wash's own chroma, clamped to 0–1.
3. **The theme's version of the pixel** is built in four steps:
   1. Start from the same position on the theme's foreground-to-background scale.
   2. Mix toward the theme's primary hue, by the wash weight, at the primary's chroma.
   3. Set the wash's lightness halfway between the scale's lightness at that point and the primary's own
      lightness, so the wash keeps its weight on the page and does not turn into a dark button colour.
   4. Add back the rest (the colour outside the wash), unchanged. This is "keep hues".
4. **25% back:** the result is mixed in OKLab with the original pixel, by 0.25 toward the original.
5. The file is written as WebP at quality 82, the same size as the original.

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

The recolouring is deterministic. The same original bytes, the same three colours and the same rule
version give the same file, byte for byte, with a pinned codec. So two machines placing the same
pictures write the same files, and undo restores the old ones from the commit.

## 5 How a theme change picks the pictures

1. `setTheme` (and `setTheme --page`, which changes only a landing page, and does not recolour) changes
   the theme as today. When the app's `pictures.style` is a recoloured style, it reports the same
   `place-pictures` effect `setPictureStyle` does.
2. The host recolours each placed library picture from its original, never from the picture already
   recoloured, so colours never drift over many changes. It takes the original from its cache of library
   files (by SHA-256), or fetches it by the hash in `pictures.json`, or from the service's mirror in a
   hosted workspace.
3. **No network and no cached original:**
   - The theme change still applies, and the pictures keep their old colours.
   - The result says so in a line, and `smithable check` says it too, naming the command that brings
     them in line (`setPictureStyle` with the same style).
   - A theme change is never refused for want of the pictures.
4. `pictures.json` gets two fields per recoloured file:
   - `colours`: the three colours used;
   - `rule`: `ink-wash-b25`, the rule and its version.

   `check` compares them with the current theme to tell whether the pictures match it.
5. Files the owner changed and files with no record are left alone, as in first-look §4.2. The card's
   "2 of your own pictures stay" covers a theme change too.

## 6 A project's own theme, and the fallback to the original

- A theme in `themes/<name>.yml`, or a theme pasted in the Look tab, gets its pictures in its own
  colours by the same rule, since only its light background, foreground and primary are read.
- **The original is placed instead**, and the record says `rule: none`, when the recolouring would make
  an unreadable picture or cannot run:
  - the theme's light foreground and background differ by less than 0.40 in OKLab lightness (the
    built-in themes differ by 0.55 or more, and the originals' own ink and paper by about 0.55);
  - the picture's anchors cannot be read (fewer than 1% of its pixels are near the style's wash hue;
    in that case the wash weight is zero everywhere, and only ink and paper would move);
  - the codec fails.

  Studio's card shows "as drawn" for such a picture.

## 7 How the look is checked

- **A sheet per theme:** a script in the engine repository renders every Ink wash picture in every
  built-in theme's colours, each on its theme's own background, at card and hero size. It is the
  trial's script, made permanent, in the way `scripts/theme-sheet.mjs` works for themes. Johan looks at
  the sheets before the rule ships and after any change to the rule. A new theme in the library gets
  its sheet in the same pull request.
- **A test for each built-in theme**, with three checks:
  1. the recoloured hero's ink-to-paper lightness difference is at least 0.40;
  2. its paper is within 0.03 lightness of the theme's background, so it does not stand out as a box;
  3. the output's hash is stable across two runs.
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
   §7. `place-pictures` recolours when the style is a recoloured one, and `pictures.json` gets `colours`
   and `rule`.
3. **Core:** `setTheme` reports `place-pictures` when the app's style is recoloured. The spec reference
   and the operations page say so.
4. **The theme sheet script** for the pictures. Johan reads the sheets before the change merges.
