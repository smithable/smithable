# A mark for every app

Design, 2026-10-09 (Fable). Johan's question and go (2026-10-09): the starters should have logos, "just for the looks", and an app made from a description should get one the way it gets its hero. The library already holds twelve abstract marks that nothing uses, and an app shows its name as text in the shell and on its landing page. So this is a place for a mark, a mark for each starter, and a rule that picks one for a described app. C makes the marks (backlog C 15), A builds the place and the rule (backlog A 62).

**Changed 2026-11-20 (Johan's yes, after the lettering sheets): the name is the mark.** Good logos are more often good letters than an icon, and a mark picked by a hash fits nobody. So a new app's identity is now its name as a wordmark and its initials in a tile (§0); a library icon is added only when one clearly fits (§4), and `logo` stays the place for it and for the maker's own. Where a section below says otherwise, §0 and §4 hold.

## 0. The default: a wordmark and a lettermark tile

- **The wordmark** is the app's name where it already stands as text (the shell's `AppName`, the landing page's header), set in the theme's heading face with tracking a little tight (-0.02em), in the text's own colour. Weight and case are the theme's where it sets them (`--heading-weight`, `--heading-case`); a theme that says nothing gets 700 and the name as written. It is type, not a picture: nothing is generated, it follows the theme and the mode, and it is sharp at every size. The sheets showed heavier and tighter reads best small.
- **The lettermark tile** is the favicon, and what a device makes its home-screen icon from: `public/favicon.svg`, as today, with three changes. The square's corner is a fifth of its side. Its fill and its letters are the theme's light-mode `primary` and `primary-foreground`, resolved from the UX file and the theme files and written into the SVG as hex (today the tile is one fixed blue for every app); one palette for both modes, since a filled tile reads on a light and a dark browser alike and a favicon cannot follow the mode a visitor picks inside the app. It carries one or two initials (today one).
- **What the tile is not.** Its letters stay in the system's font, as today: a favicon is loaded as an image and the app's fonts do not reach it, so the heading face cannot be used there without shipping its outlines in the engine, which is not in this build. There are no raster icons today (no apple-touch icon, no PNG; the web manifest, made only with push, lists the SVG) and this build adds none: a rasteriser has no place in an engine that must run in the browser. Where a browser takes no SVG icon the app has its default one, as today.
- **The initials** are a default with a key, shown by `--explain` like every default. The rule, the same in generation, validation and `--explain`:
  - a *letter* is a Unicode letter or digit (`\p{L}` or `\p{N}`) with the combining marks that follow it; emoji and signs are passed over;
  - words are what whitespace separates; the first initial is the first letter of the first word that has one, the second is the first letter of the next word that has one ("Smith & Sons": SS; "Invoicely": I; a name written without spaces, as in Japanese, gets one);
  - each is upper-cased without a locale and only the first character of the result is kept (ß gives S); a script without case is left as it is;
  - the SVG's text takes its direction from the letters themselves (`unicode-bidi: plaintext`), so two right-to-left initials stand in their own order;
  - a name with no letter at all gives the tile without letters.

  `initials: SY` in `smithable.content.yml`, beside `logo`, says otherwise: one or two letters by the rule above (the validator's `initials-form`), set by the operation `setInitials`, an empty value going back to the default. Like `logo` it is not a text to translate: it is left out of the content file's text paths and of the word editor.
- **Lettering styles** (a second step, after the default is in): two or three named treatments of the wordmark, picked from the sheets with Johan, as one key `lettering` in `smithable.ux.yml` and a row in Studio's Look tab. Not in the first build.
- An app with a `logo` keeps the wordmark: the picture stands before it and is the favicon, as §2 says, and the tile is generated as the fallback only. All nine starters ship a `logo` today, so none of them shows its tile; whether a starter gives up its picture for the wordmark alone is Johan's to say when he has seen both (§8, step 5).

## 1. The place: `logo` in `smithable.content.yml`

```yaml
smithableContent: 0.1
language: en
logo: { src: images/logo.webp, alt: A lotus on still water }
```

- The mark is presentation that a visitor sees, like a hero's picture, so it lives in the content file, at the top beside `language`; never in `smithable.yml`. `src` follows the hero's rule (a file under the app's `public/images/`, which generation never touches), and takes `svg` too, since a maker's own logo is usually one; `alt` is required, as for every picture.
- Square or nearly so, about 512 px: it is drawn small. A wide wordmark is not what this is for; the app's name stays beside the mark as text, so the wordmark's job is done by the two together.
- The operation `setLogo <src> [--alt <text>]` sets it, and `setLogo` with an empty src removes it. The validator checks the form of `src` and that `alt` is there (`logo-src`, `logo-alt`, errors); whether the file exists is the host's check, as for the hero (a drafted app's content file is cleaned of pictures the project does not have, cli/src/pictures.ts).
- Nothing said, the app has the wordmark and the tile of §0.

## 2. Where it shows

- **The app shell** (kit AppShell.tsx, `AppName`): the mark before the name, about 24 px high, rounded by 4 px, inside the same link to the app's start. `alt` is empty there (the name beside it says what it is), so a screen reader does not read it twice.
- **The landing page's header** (kit Landing.tsx, `LandingLayout`): the same, 28 px, before the name; the footer keeps text only.
- **The favicon**: when the app has a logo, the generated head's icon link points at the logo's file (`/images/logo.webp`; browsers take webp, png and svg as icons) and `public/favicon.svg`, the tile of §0, is still generated as the fallback and is the icon of the apps without one.
- **Studio's preview** shows it as the app does; nothing in Studio's own header changes (that is Smithable's mark).

## 3. Every starter has its own

C generates one mark per starter with the library's pipeline (manifest.yml, kind `logo`, the logo style), tagged `starter-<name>` plus its subjects, and the file goes into `examples/<starter>/public/images/logo.webp` with the `logo` line in its content file, in the same pull request as the picker (§4) or before it. Subjects as a start, C's taste decides:

| Starter | App | A mark of |
|---|---|---|
| booking | Stillwater Yoga | a lotus, or a single ripple on still water |
| crm | Acme CRM | two linked rings, or a handshake reduced to two curves |
| invoicing | Invoicely | a receipt with a torn edge, or a coin and a line |
| marketplace | the second-hand market | a price tag |
| records | the plain records app | three stacked cards |
| status | the status page | a pulse line in a circle |
| api | an app for programs and assistants | a plug, or a hexagon with a dot |

The library's logo style stays ("a simple flat abstract mark in one or two solid colours, centred, on a transparent background, no letters"), with one addition for every mark from now on: **colours that read on white and on a dark ground** (mid-lightness, saturated: teal, coral, amber, a clear blue; never navy alone, never pale grey), because the shell is dark in dark mode and the mark is drawn as is, with no tile behind it. C's sheet shows every mark on white and on `#101b2a`, and a mark that disappears on either is remade. The twelve marks there are checked the same way and remade where needed.

## 4. A described app gets one by rule

- `pickPictures` (packages/ai/src/pictures.ts) returns `logo` beside `hero` and `samples`: the marks (`kind: "logo"`) scored by their tags against the description and the spec as the heroes are. Among those that fit (a score of 1 or more, and as good as the best), the description and the app's name choose, with the same hash as the hero's but salted (`logo\n` before the text), so the hero's tie-break and the mark's are independent. **When no mark fits, the app gets none** (changed 2026-11-20; before, one was taken among the abstract marks by the hash): its wordmark and tile are its identity. "Fits" is what the picker's own test (`asGood`) says today, unchanged; only the step after it, taking an abstract mark when nothing passed, is removed. The hash still breaks a tie between marks that fit, so the same app always gets the same, and `misses.logo` now also means there is no `logo` line. The marks a starter ships (`starter-…` tags) count a tenth, as the heroes' do.
- cli/src/pictures.ts writes it to `public/images/logo.webp` and the `logo` line to the content file, the way it writes the hero; the "No pictures" line stays true (a logo alone is a picture).
- For the rule to have something to choose from, C adds about thirty marks across the trades the bench's descriptions name: food and cafés, pets, sport and clubs, health and care, home and repairs, money, learning, events, music, gardens, cars, beauty, travel, tools, books, with the trade's tags as the heroes have them (`cafe`, `dog`, `football`, `clinic`…). The existing twelve keep their shape tags and get a subject where the shape has one (`logo-leaf`: garden, nature; `logo-drop`: water, plumbing; `logo-house`: home, property).

## 5. The maker's own

- Replace the file, or `setLogo images/my-mark.svg --alt "…"` with a file put under `public/images/`.
- Studio, Look tab: a **Logo** row with the mark as it is, **Replace** (a file from the maker's computer, written under `public/images/` by the host and then `setLogo`), **Remove**. Builder's operation panel has `setLogo` as it has every operation.

## 6. Not now

- Tinting the mark to the theme (the marks are raster; tintable SVG marks are a remake of the library, later if wanted).
- A mark drawn by a model per app: the library is the answer, as it is for heroes (no spend per build, no surprises).
- Lettering drawn by a model per app: a later option, for display sizes only (the landing page's header, not the shell or the favicon), and only once the image model gives a transparent background; it gives opaque white today.
- Raster home-screen icons, and the tile's letters in the heading face (§0).

## 7. Steps and tests

A, one engine PR (core and adapter together are small; Fable reviews the core part):
1. Core: `logo` in the content file's type, reader and schema (companion-schemas.ts); `setLogo`; the two validator codes; the spec reference's content section (`logo` beside `language`) and the operations page come from the registry.
2. Adapter: the shell and the landing header (§2); the favicon link; the generate snapshot. Tests: the content reader with and without `logo`; `setLogo` set and remove, undo; a generated app with a logo shows it in the shell and the header and links the icon (test-apps on the booking starter once C's mark is in).
3. AI and CLI: `pickPictures` returns `logo` (§4), with tests: a fitting mark wins, no fitting mark gives none (2026-11-20), the same input the same mark, two descriptions two marks; cli writes the file and the line.
4. Studio: the Look tab's Logo row (§5); a Studio-test step: Replace with a file, the preview's header shows it, Remove.

C, the library (before A's step 3 merges, so test-apps has a mark to find):
1. The logo style's colour line and the sheet on white and dark (§3); the seven starter marks and their files in `examples/`; about thirty trade marks (§4); subjects on the twelve; upload and index.json.
2. Pictures of the seven starters' headers to Pictures/claude/artwork/starter-logos/ for Johan.

## 8. Steps for the change of 2026-11-20

A, one pull request, after the hardening pass (kit and core together):
1. Kit and adapter: the wordmark's type on `AppName` in the shell and the landing header; `favicon(ir)` takes the resolved look (`resolveLook`, the light `primary` and `primary-foreground` as hex) and the initials. The generate snapshot.
2. Core: `initials` in the content file (type, reader, schema, `initials-form`), out of `textPaths` and the word editor; `setInitials`; the default in `--explain`; the spec reference.
3. AI: no abstract fallback in `pickPictures`.
4. Tests: the initials rule on one word, two words, "Smith & Sons", a leading emoji, ß, a name without spaces in a script without case, two right-to-left words, no letter at all; `initials` set and removed with undo, and refused when it is three letters; the tile's colours follow a theme change and are the same bytes for the same files; an app with a `logo` links it as the icon and keeps the wordmark; a description that fits no mark gets no `logo` line; a theme with its own heading weight and case keeps them on the wordmark.
5. Pictures for Johan, in a new folder: each of the nine starters' headers and browser tabs twice, with its picture as today and with the wordmark and tile alone, light and dark, and the tile at 16 px for I, W and two wide letters, so he can say which starters keep their picture.
