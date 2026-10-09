# A mark for every app

Design, 2026-10-09 (Fable). Johan's question and go (2026-10-09): the starters should have logos, "just for the looks", and an app made from a description should get one the way it gets its hero. The library already holds twelve abstract marks that nothing uses, and an app shows its name as text in the shell and on its landing page. So this is a place for a mark, a mark for each starter, and a rule that picks one for a described app. C makes the marks (backlog C 15), A builds the place and the rule (backlog A 62).

## 1. The place: `logo` in `smithable.content.yml`

```yaml
smithableContent: 0.1
language: en
logo: { src: images/logo.webp, alt: A lotus on still water }
```

- The mark is presentation that a visitor sees, like a hero's picture, so it lives in the content file, at the top beside `language`; never in `smithable.yml`. `src` follows the hero's rule (a file under the app's `public/images/`, which generation never touches), and takes `svg` too, since a maker's own logo is usually one; `alt` is required, as for every picture.
- Square or nearly so, about 512 px: it is drawn small. A wide wordmark is not what this is for; the app's name stays beside the mark as text, so the wordmark's job is done by the two together.
- The operation `setLogo <src> [--alt <text>]` sets it, and `setLogo` with an empty src removes it. The validator checks the form of `src` and that `alt` is there (`logo-src`, `logo-alt`, errors); whether the file exists is the host's check, as for the hero (a drafted app's content file is cleaned of pictures the project does not have, cli/src/pictures.ts).
- Nothing said, the app looks as it does today: the name as text, the favicon with its initial.

## 2. Where it shows

- **The app shell** (kit AppShell.tsx, `AppName`): the mark before the name, about 24 px high, rounded by 4 px, inside the same link to the app's start. `alt` is empty there (the name beside it says what it is), so a screen reader does not read it twice.
- **The landing page's header** (kit Landing.tsx, `LandingLayout`): the same, 28 px, before the name; the footer keeps text only.
- **The favicon**: when the app has a logo, the generated head's icon link points at the logo's file (`/images/logo.webp`; browsers take webp, png and svg as icons) and `public/favicon.svg` with the initial is still generated as the fallback for the apps without one. The apple-touch icon stays as it is today.
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

- `pickPictures` (packages/ai/src/pictures.ts) returns `logo` beside `hero` and `samples`: the marks (`kind: "logo"`) scored by their tags against the description and the spec as the heroes are. Among those that fit (a score of 1 or more, and as good as the best), the description and the app's name choose, with the same hash as the hero's but salted (`logo\n` before the text), so the hero's tie-break and the mark's are independent. **When no mark fits, the choice is still made: among every mark tagged `abstract`, by the hash.** Two cafés get different marks, the same app always gets the same, and no app is without one. The marks a starter ships (`starter-…` tags) count a tenth, as the heroes' do.
- cli/src/pictures.ts writes it to `public/images/logo.webp` and the `logo` line to the content file, the way it writes the hero; the "No pictures" line stays true (a logo alone is a picture).
- For the rule to have something to choose from, C adds about thirty marks across the trades the bench's descriptions name: food and cafés, pets, sport and clubs, health and care, home and repairs, money, learning, events, music, gardens, cars, beauty, travel, tools, books, with the trade's tags as the heroes have them (`cafe`, `dog`, `football`, `clinic`…). The existing twelve keep their shape tags and get a subject where the shape has one (`logo-leaf`: garden, nature; `logo-drop`: water, plumbing; `logo-house`: home, property).

## 5. The maker's own

- Replace the file, or `setLogo images/my-mark.svg --alt "…"` with a file put under `public/images/`.
- Studio, Look tab: a **Logo** row with the mark as it is, **Replace** (a file from the maker's computer, written under `public/images/` by the host and then `setLogo`), **Remove**. Builder's operation panel has `setLogo` as it has every operation.

## 6. Not now

- Tinting the mark to the theme (the marks are raster; tintable SVG marks are a remake of the library, later if wanted).
- A mark drawn by a model per app: the library is the answer, as it is for heroes (no spend per build, no surprises).
- A wordmark: the name as text beside the mark is the wordmark.

## 7. Steps and tests

A, one engine PR (core and adapter together are small; Fable reviews the core part):
1. Core: `logo` in the content file's type, reader and schema (companion-schemas.ts); `setLogo`; the two validator codes; the spec reference's content section (`logo` beside `language`) and the operations page come from the registry.
2. Adapter: the shell and the landing header (§2); the favicon link; the generate snapshot. Tests: the content reader with and without `logo`; `setLogo` set and remove, undo; a generated app with a logo shows it in the shell and the header and links the icon (test-apps on the booking starter once C's mark is in).
3. AI and CLI: `pickPictures` returns `logo` (§4), with tests: a fitting mark wins, no fitting mark still gives one, the same input the same mark, two descriptions two marks; cli writes the file and the line.
4. Studio: the Look tab's Logo row (§5); a Studio-test step: Replace with a file, the preview's header shows it, Remove.

C, the library (before A's step 3 merges, so test-apps has a mark to find):
1. The logo style's colour line and the sheet on white and dark (§3); the seven starter marks and their files in `examples/`; about thirty trade marks (§4); subjects on the twelve; upload and index.json.
2. Pictures of the seven starters' headers to Pictures/claude/artwork/starter-logos/ for Johan.
