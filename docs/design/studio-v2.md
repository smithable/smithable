# Studio, second round: one preview, a remembered place, a Look tab, questions, editing by parts (design)

Status: §1 (one preview), §3 (the Look tab) and §4 (questions) are built; §2 (the remembered place) is built for each mode's tab and pick, and in Code mode for the file open, its cursor and unsaved edits (2026-10-09); §5 (editing by parts) is not built and not scheduled. Proposed 2026-09-30 by Fable from Johan's testing of the yoga app on the beta. The routine items from the same testing (the mode names "No code" and "Code", the change notice with Undo, the trace below the change box, a no-change edit refused, one-click editing of a sentence, adding a custom action, details beside the concepts) are with Opus already. This document is the rest: the parts that change how Builder and Studio are put together.

## 1. One preview, outside both modes

Today each mode renders the preview inside its own layout, so switching modes remounts it, loses its page, and the preview address is a field inside Builder. As designed: the preview is one frame owned by the app shell (`App.tsx`), rendered once, next to whichever mode is open; the modes render their panels beside it, never around it. The address bar sits above the preview, always: it shows the page the preview is on and follows navigation inside the preview (the preview editor script posts `{ type: "navigated", path }` on every route change, as it posts `ready`), and typing a path or picking a page from a list opens it. Selecting in the preview, editing a text in place, and the highlight of the selected concept stay as they are; they belong to the frame.

Where Builder's panels snap (Your app, Preview, Changes), "Preview" snaps to the frame; on wide windows the frame is always visible and the panels take the rest.

**As built (2026-09-30, Opus, #36, #38 and the Hide button):**
- **The frame:** it's made once in `App.tsx` and never moves in the page. From lg it's a column taking 55% of the window, because at 45% the preview's app fell into its phone layout at 1440 px. Below lg the mode switch has a third choice, **No code | Preview | Code**: Preview shows the frame alone, the window's width, with the mode hidden (not unmade) under it; the modes have no Preview panel or tab of their own (Johan, 2026-10-09). Before, it was placed over a slot in the mode's snapping strip.
- **Builder:** "Your app + Details" side by side from 1680 px.
- **Hide:** the column's Hide button, and "Show preview" in the header, remembered with the place.
- **Code mode's details:** beside the tree from lg while the preview is hidden, otherwise from 1800 px.
- **Address bar:** the preview editor reports `navigated` after the router's History API calls and Back. Repeated reports of the same page are ignored.
- **One reload per change (2026-10-16, Fable, after Johan's "full rerender should be kept to a minimum"):** the frame is made again once, when the daemon says the app has taken the change in ("changed", after the dev server's watcher went quiet), and only when the change touches the page shown (`touchesPage`: a field, a record's text or a page's own text of other records or pages leaves it; a page's title is in every menu, so it does not). The dev server's own hot updates for the generated files are held back in Studio's preview (`smithableEditor({ holdUpdates: true })` in the wrapper config): the generator writes the files one by one, and each route file reloaded the page at once, one to four reloads in the second before the change was whole, the last with a stale client module against the new server HTML. `src/custom/` keeps hot reload; the theme lab keeps everything. Measured on a CRM before: three reloads for a field on the shown records and one for another page's text. The dev server's log lines live outside React (`logs.ts`): as App's state each line (a dozen to a hundred a change) re-rendered the whole page.

## 2. The place is remembered per mode

What someone selected, opened or was editing survives a mode switch and comes back on the next: in Studio the selected concept and the editor's file and cursor, in Builder the selected sentence or the change being filled in. Kept in one piece of app-level state (`{ builder: { selected?, change? }, studio: { concept?, file?, cursor? } }`) in `sessionStorage` per project, restored when the mode opens, and, when the other mode selected a concept that this mode shows, opened at it: a field selected in the preview is the sentence about that field in Builder and the field in Studio's tree. The preview's own place needs nothing: it is one frame now.

## 3. The Look tab

Looks are hard to change today: one form, "Look and feel", with the theme presets and a colour box, and nothing shows the current state. Builder gets a **Look** tab beside Your app and Changes, a picture of `smithable.ux.yml` with controls:

- **Theme:** the presets as cards (name, a swatch of the preset's colours and its font), the current one marked; a click applies it (`setTheme preset`).
- **Colour:** the brand colour as a picker with the current value, and "the theme's own" to remove it; the palette the app derives from it shown beside, so the adjustment for readable text is visible (`setTheme primary`).
- **Font** and **density** as segmented controls (`setTheme font|density`).
- **Pages:** each page's icon (the icon picker) and, for a list page, its columns as a reorderable list with hidden ones greyed (`setIcon`, `setColumns`, `setBelow`), which the preview also offers by dragging.
- **Colours of choices:** each choice field with a tone per value (`setTone`).

Every control shows the value in the file and applies its operation at once, undoable like any change; there is no Apply button and no form state to lose. The tab reads the ux file through the spec, so what someone edits in Studio shows here on the next change.

In Studio, the editor gets the companion files beside `smithable.yml`: `smithable.ux.yml`, `smithable.content.yml`, `smithable.auth.yml`, `smithable.context.yml`, each saved through `editSpec` with the file as an argument, refused when the result is invalid, as the spec is. Built 2026-10-06 (Fable): a file switcher in the Files tab, each file checked as you type by its own validator and against the spec (a role the spec names cannot go), and the spec checked with the roles as edited.

## 4. Questions about the app

Built 2026-09-30 (Fable): `answerQuestion` and `looksLikeQuestion` in `@smithable/index`, the `answer` kind in `proposeChange`, `smithable ask` and the change box; the links from an answer to the parts it names wait for the properties panel (§5).

The change box says "Describe a change, or ask a question". A question ("who can delete orders?", "what happens when I remove a customer?", "is the schedule public?") is answered, not applied:

- **Tier 0 first:** the project index already answers what a concept is, who may do what and where a rule lives (`inspect`); the common question shapes ("who can X", "what is Y", "is Z public", "where is W used") map to it without a model.
- **Then the model:** with the app's summary and the question, constrained to `{ kind: "answer", text }`, and shown as a reply under the box, with the parts of the app it named linked to their sentences.
- A request that is neither is what it is today: a proposal. The router decides by the answer: `{ kind: "operations" | "question" | "none" | "answer" }`; the model is told that a question about the app gets an answer, not a change.

## 5. Editing "Your app" by parts

Johan's doubt is right: rewriting a sentence freely and hoping the model reads it back is a hard way to change a field. The sentences stay (they are the app in plain language, and the summary of every change), but editing them changes:

- **A click on a part opens its properties**, the same panel Studio has for a selected concept (name, kind, required, unique, default, choices, label, access, removal), beside the sentence, with the values filled in. Each control is an operation. This is the Photoshop-like panel from ARCHITECTURE §10.1 brought into Builder, so both modes edit through one component.
- **Choices instead of prose** wherever the spec has a fixed set: kinds of field, roles, page patterns, icons, tones.
- **Free text stays for intent:** "describe a change" for what has no control, and each sentence keeps "put it in your own words" for the wording only, which is what the session-kept wording is for; it never proposes a change any more.
- **Adding:** "add a record", "add a field", "add a page", "add an action" as buttons in the summary's groups, opening the same forms as the Change tab, prefilled with the group.

The Change tab's forms and the properties panel are then the same thing seen from two sides, and the summary is a map to them.
