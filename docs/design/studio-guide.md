# The Studio guide: a short tour of the places

Design, 2026-10-06 (Fable). Johan's idea (2026-10-03): a walkthrough that shows the places of Studio and says what each means, starting with the notice that the preview's records are samples. Status: a proposal; A builds it on Johan's word.

## 1. What it is

Five stops, each a small card beside the thing it is about, with one or two sentences, **Next** and **Skip**; the last says **Done**. The rest of the screen dims a little and takes no clicks while a card is open, with a cut-out around the thing, so a visitor sees where they are and nothing else moves. The tour takes under a minute; nothing in it has to be done, only read.

| Stop | Beside | Says |
|---|---|---|
| 0 | (removed 2026-10-27, smith-first.md §7: the stops are Smith's lines, and the view with No code and Code has its own stop, "By hand") The mode switch (No code, Code) | How do you want to work? No code changes the app in plain words and forms; Code edits its definition as text. **No code** goes on with the tour; **Code** switches to Code mode, remembered, and goes on with its tour, below. (Johan, 2026-10-06 and 2026-10-09) |
| 1 | The preview | This is your app, running: click around as anyone would. What you change shows here at once. (The samples are the preview's own notice, above it; the card does not say it again.) |
| 2 | "What it does" | Your app in plain words, kept true as it changes. Click a sentence to change that part; the buttons add a record, a page, an action. |
| 2b | The Details panel | Choose Select above the preview and click a part, or click a sentence in What it does: its details and forms open here; with nothing chosen, the app's own details. (Johan, 2026-10-06) |
| 3 | The change box | Describe a change in your own words, or ask a question about the app. A change is checked and shown before it is kept, and every change can be undone. |
| 4 | The Look tab | Colors, type, the app's language and how lists and forms are laid out: the look is separate from what the app does. |
| 5 | Publish and share | When it does what you want, publish it: an address people can open, with sign-in and backups. Until then, nothing leaves this page. |

Code mode has a tour of its own (Johan, 2026-10-09):

| Stop | Beside | Says |
|---|---|---|
| 1 | The Files tab | Your app as text: smithable.yml says what it does; its companions say who may sign in, how it looks and what it says. Ctrl-Space, or What goes here?, lists what can be written at the cursor. |
| 2 | The editor's Problems and Save | Checked as you type: a problem is named here and marked in the text. Save keeps the file as one change. |
| 3 | The concept tree | Every part of your app, with its rules and the files each became; Show in smithable.yml takes you to its lines. |
| 4 | The Operation tab | Every change is an operation, with a form; the line under it is the same change for a terminal. |
| 5 | The Changes tab | Describe a change as in No code; each change names its files and opens as their patch; an edit in Files saves itself after a pause; Ctrl+Z takes any change back. |

The header's **Guide** link starts the tour of the mode shown, at any time.

## 2. When it shows

- The first time a browser opens a project's Studio in Builder, once the project is loaded and, for a described app, after the making screen has handed over (docs/design/while-it-is-made.md): never over the stage; and once the preview shows the app (its second stop points at it), or after twenty seconds when the preview is slow to start. The hosted beta's claim lands here too.
- Not again for that project in that browser after Done or Skip (`localStorage`, `guideDone:<app>`); a new project starts it once more, since the first visit to any app is what the tour is for. Through **Guide** whenever wanted.
- Not by itself in Code mode (only from **Guide** or the first stop's **Code**), never in the Studio tests except the one that walks it, and never when `?guide=off` is in the address (the screenshot scripts).

## 3. How it behaves

- A card is a `dialog` with its stop's title; focus moves into it and back to where it was at the end; **Esc** skips; **Enter** is Next. The thing it is about is named for screen readers (`aria-describedby` from the card), and the dimmed rest is `aria-hidden` while the tour runs.
- On a phone the panels are a horizontal row that snaps (studio-v2.md §1): a stop scrolls its panel into view first, then opens its card; the card sits below the thing or above it, whichever has room, and never off the screen.
- The tab a stop needs is opened for it (the Look tab for stop 4) and left as the visitor had it when the tour ends.
- A stop whose thing is not on the screen (the publish button hidden by a setting, a panel the visitor closed) is left out, never shown as a card beside nothing.

## 4. Where its texts live

Studio's words are inline English in the beta (language.md §4: Studio stays English for now). The tour's stops are one table in `apps/studio/src/guide.ts`: the anchor's name, the title and the sentences. When Studio gets a language, that table is what is translated.

## 5. How it stays true when Studio changes

- Each thing a stop is about carries `data-guide="<name>"` (`mode`, `preview`, `summary`, `details`, `change`, `look`, `publish`; in Code mode `files`, `problems`, `concepts`, `operation`, `changes`); the tour finds its anchors by that and by nothing else, so a moved or restyled element keeps its stop and a removed one drops it.
- A unit test holds the two lists together: every stop's anchor appears in the components, and every `data-guide` in the components has a stop. A new place in Studio either gets a stop in the same change or has no attribute.
- The Studio test walks the tour once on a fresh project: five cards in order, each beside a visible anchor, Done ends it and the project is as it was; **Guide** starts it again; a reload shows nothing.

## 6. What it is not

No video, no pointer animations, no checklist of things to try, no counting what the visitor read; no tour inside a form; nothing sent to the service. One tour, five sentences, found again from the header.

## 7. Steps (A)

1. `guide.ts` with the stops; `data-guide` on the five anchors; the overlay and the cards (one component, `Guide.tsx`), the first-visit rule and **Guide** in the header; `?guide=off`.
2. The unit test of the two lists and the Studio test's walk; `scripts/theme-sheet.mjs` and `scripts/starter-shots.mjs` open Studio with `?guide=off` where they do.
3. docs/site/start.md: one line, "a short tour shows you around the first time; Guide in the header shows it again".
