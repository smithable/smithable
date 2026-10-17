# Studio v3: five windows, Smith, and a change only when a step is done

Design, 2026-10-17 (Fable), from Johan's sixth testing round (2026-10-17): his layout vision in full, the names, and seven observations. Status: proposed; A builds in the steps of §9 after Johan's go on the open points in §10. Supersedes studio-v2.md §1 (the frame) and §5, what-it-does.md §2 and §5 (the summary and the hand-made panels; its form from the schema stays as Behavior), and ask-in-studio.md §1 and §3 where they differ (the panel's name, its place and the layout). The operation layer is unchanged except §7 and §8.

## 1. The five windows

Studio is five windows and nothing else: **No code**, **Preview**, **Code**, **Changes** and **Smith**. The mode switch, the tabs inside the modes and the panels that moved between them (Your app, Details, Change by form, the Changes trace, Logs, Operation, the concepts tree) go. Each window has one job:

- **No code**: three sub views, **Behavior** (every setting of the spec, §5), **Look** (the ux file, as today) and **Who can** (the auth file, as today), and a fourth, **Content** (the content file's texts and pictures, with Languages under it). "What it does", the summary read aloud, is no longer shown; its sentences live on in two places: the words of each change (§3) and Smith's answer to "What does this app do?" (§2), both from the same `summarize()`.
- **Preview**: the app, as today (studio-v2.md §1: one frame, kept across everything else; one reload per change, #684).
- **Code**: the files, nothing else: the spec files in the editor (§4). No concepts, no logs, no operation forms, no changes.
- **Changes**: what was done, in plain language, the same window whichever way the change was made (§3).
- **Smith**: the assistant (§2). "Ask" in Studio is called Smith, in full "Agent Smith"; the apps' own Ask button keeps its name.

## 2. Smith

Smith is a chat, and looks like one: the person's lines and Smith's answers in a thread, the whole session visible. Behind it is what Studio does already, in the same order as for every request (docs/ai.md, first-build.md §2.10): is it a question or a change; can it be answered or made without a model (the phrases, the reader, the summary, the docs); else the local model, then Haiku, then Sonnet when a check says Haiku's answer is not good enough. As much of Smith's language as possible is Studio's own, not a model's: a proposed change in the operations' words, an answer about the app from the spec's summary, an answer from the docs as the page's own lines with a link.

- **What he does.** Helps with creation (the first-build questions one at a time, ask-in-studio.md; the creation wizard's "Ask Smith for help", §4); answers questions about the app (the summary, the validator's notes, the trace); answers questions in general from the docs, with a link to the page and heading, using the site's search index (`search.json`, C 40: the match is found without a model, a model only words the answer when the lines do not answer by themselves); suggests changes (advice.md's notes, "What should I do next?").
- **Context.** Not the whole thread goes to a model: a turn is sent alone with the fixed context (the spec's summary, the operations), and with the earlier turns only when it reads as a follow-up: an answer to a question Smith asked, a short line ("yes", "the second one", "also for orders"), a pronoun or "it" or "that" with no noun, or a line within a minute of Smith's question. The rule is by pattern, no model.
- **Ready prompts.** When Smith is not in the middle of a discussion (no question of his waiting), a few chips under the box: "What should I do next?", "Help me add…", "What does this app do?", "How do I publish?" (the docs). They go when the person types.
- **Changes from Smith** are proposals, confirmed in the Changes window's words before they apply, as today (Johan, 2026-10-11).

## 3. Changes

One window for every change, made in No code, in Code or by Smith. Each entry is one line of plain language ("Added a phone to customers", "Changed the Orders page's title to All orders"), from the operation's summary where the change is operations, and for an edit of the files (Code) from the difference between the files before and after, read as operations where it can be (`describeChange`, `change-diff.ts`: a key added under a model is "Added a field…", a value changed is "Changed … from … to …"), else "Edited smithable.yml" with the parts named. Clicking an entry expands it: still words, not a diff: what changed in which kind of record, page or text, what happened to the records (a column added, a default filled in), what it depends on; a "Show the files" link opens Code at the change's diff for those who want it.

**Undo by X.** Each entry has an X. The newest change is undone as today: its commit reverted and the database snapshot put back. An earlier change is undone as a new change that reverses it, and only when that is safe:

- Studio asks the daemon for the undo of change C; the daemon reverts C's commit into a scratch copy of the files (no commit) and validates the result with the ordinary validator. If the spec after the revert is invalid, the undo is refused with the validator's words as the reason, naming the dependant: "The Orders page you added later shows Order, which this change added"; a revert git cannot apply cleanly (a later change edited the same lines) is refused as "a later change edited the same part". Nothing is written.
- If valid, the reverse is applied as a new change (the files as reverted, generated and migrated forward like any change): a removed column is a data loss and asks first, like any removing change. The snapshot is not used for an earlier change, since putting it back would lose the records written since.
- The entry stays in the list, marked undone; the undo is an entry of its own ("Undid: Added a phone to customers").

Core/CLI: `smithable undo --change <id>` with `--check` (the refusal or "safe"), in `packages/cli/src/undo.ts` beside today's undo; the daemon's route `/api/undo` takes the id. The validator is the dependency check: no new bookkeeping of what depends on what (ARCHITECTURE §2.4: no construct).

## 4. Code: the files, and a wizard for adding

The Code window is the editor over the spec files (and `src/custom/**` listed, opened in the person's own editor as before, what-it-does.md §3). Everything else that was in Code mode leaves: the concepts tree (Behavior has it), the operation forms (Behavior and the wizard), the Changes diff (the Changes window), Logs (§6).

**Adding by wizard.** Under `models:`, `pages:`, `actions:` (and any named map with semantic text later), Ctrl+Space, or Enter at the end of the key's line (A 122 gives the indent), offers "Add a model…" / "Add a page…" / "Add an action…" first in the completion list, before the keys. Choosing it opens an input area at that place in the editor with a placeholder that says what to type: "A kind of record and what it holds, e.g. customers with a name, email and phone; only staff may change them". Enter sends the text to the parse Studio has (`phrases.ts`, the reader, then the model as for any described change) and shows the **change form**: the kind's name, its fields with their types as proposed, who may do what, each editable, with the validator's words beside anything refused, and a **Create** button. Create applies one change (addModel with its fields, addPage…) and the editor shows the file with the new part in it. Esc in the input area goes back to editing as before; **Dismiss** in the form goes back to the input area with the text kept. **Ask Smith for help** in the form sends the text and the form's state to Smith, who answers in his window with suggestions (the fields a kind usually has, what the description leaves open) and can fill the form.

The same wizard is No code's "Add" (§5): one flow, one look, the same words in both windows. Code users know more terms, but a different wizard for them would be two to keep right. The purpose is that the semantic texts (intent, description, labels) are written for the person from what they typed, instead of asked field by field.

## 5. Behavior (No code)

"Every setting" becomes **Behavior**: the form built from the spec's schema (what-it-does.md §2 and §4, built as #657–#679), with these rules:

- **Collapsed first.** The areas (the app, kinds of record, pages, actions, queries, navigation, integrations) are closed at first, and inside them every entry, as the pages are today.
- **No look, no permissions.** Look and Who can are their own sub views; the ux and auth files' keys are not in Behavior.
- **Friendly names only.** A kind of record, a page, an action is shown by its label (the content file's, else its name in words); its spec name is not shown and not editable here. Renaming the label is `setText`; renaming the identifier is Code's (renameModel/renamePage/renameField stay as operations, and the identifier shows in Code).
- **Labels, not descriptions.** Each key's label is its schema `title` where one is given, else the first sentence of its description as today; the description is the tooltip. The schemas get titles where the description is technical: "Currency" (tooltip: the ISO 4217 code, e.g. EUR; a drop-down with search over `currencies.ts`), "Time zone" (tooltip: the IANA name, e.g. Europe/Mariehamn; a drop-down with search over `time-zones.ts`), "What it is for" (tooltip: where the description is used: the landing page, the API's and assistants' description, the first-build questions; a link to the docs page, opened in a new tab), "Rules" (the domain rules: editable, a placeholder with one example rule, a text above that says where the rules go: the model's context for Ask and for drafts, and the advice notes; a link to the docs). The spec format version (`smithable:`) is not shown at all: an older version opened in Studio gets a migration wizard instead (later; today the CLI migrates). "The application as a whole" (the `app` block's description) is dropped from the schema's descriptions: it says nothing.
- **Semantic texts together.** The texts a model reads (the app's description, the rules, each action's and query's intent, each kind's description) are also gathered in one group at the top of Behavior, "What the app is about", with one explanation and one docs link for all of them, whichever level of the spec they live at. Each is written for the person where it can be (from the wizard's text, from the spec's shape) and editable.
- **Adding** a kind of record, a page or an action opens the wizard of §4, not an empty entry.

## 6. Logs only when something went wrong

No Logs tab. When a change fails, the preview does not come back, or the daemon answers an error, a bar at the top says so in a sentence, with **Troubleshoot**. Troubleshoot opens a panel: the error in words, the last log lines, and the buttons **Report**, **Undo last change** and **Reload Studio**. No "fix it with AI": a change Studio allowed that broke the app or Studio is Smithable's bug, not the person's to fix (and a change whose regeneration fails is rolled back already).

**What is collected.** Two levels, the second only on the person's word:

- **Always, hosted:** the failure record without the person's content: Smithable's version, the operation's name (not its arguments), the error's class and message with quoted values taken out, the stack of Smithable's own code, the request's trace id. It reaches the service like a log line. With the trace id the service's own logs (which hold no content) show the request; this is the "we want to know every way we can break" part, and it looks at nothing of theirs. Self-hosted, nothing is sent without "Always" chosen (docs/ai.md and the self-host page say so).
- **Report:** adds the arguments, the spec files and the log lines, shown in full before they leave (as today, `report.ts`). The spec is structure, not personal data of the app's users, but it names the business; it goes only on Report. Records, uploads and custom code never go. Undo and Reload send nothing.

The beta terms' line on diagnostics is B's to check against the first level (cloud, with the terms).

## 7. No change until a step is done; no change for formatting

- **Adding writes nothing until Create.** Today "Add" in Every setting writes an entry with default values at once and the person edits it in place, so a kind of record goes through three or four changes before it is what they meant. With the wizard (§4) nothing is written until Create. Editing an existing entry in Behavior writes when the person leaves the control (blur, Enter), as today; a control whose change is not disruptive (a label, a help text, a default) may write at once, many small changes being fine when nothing reloads for them (#684).
- **Code saves when the person leaves the editor** (the editor loses focus, another window is chosen, Ctrl+S), not after a pause in typing. The pause-save of 1.5 s (`Studio.tsx`) made a change out of half an edit, and once out of nothing: with an unsaved draft kept in the tab's session, a reload of the Studio page (the hosted workspace waking, #6 of the round) mounted the editor with `text !== saved` and saved 1.5 s later with nobody typing. The rule becomes: a save needs a keystroke in this page's life and the person leaving.
- **Formatting is not a change.** The spec files are shown formatted: block mappings for objects (never `{ a: 1 }`, which a person may type but Studio does not keep), lists as `[a, b]` on one line where they fit as today, two-space indents, one blank line between the top-level sections. Core gets `formatSpec(text)` (the writer in `edit.ts` has the rules; the Editor keeps a person's formatting when operations edit, which is why a `{}` written by hand survived operations). The editor shows `formatSpec(saved)`; when the person leaves, the text is formatted before it is compared and saved; a save whose parsed content equals the file's (formatting or whitespace only) is dropped by the daemon as no change, and the formatted text goes into the file with the next real change. Same for whitespace. A refused no-change edit today says "Nothing was changed"; this makes it silent.

## 8. Layout

- **The top bar chooses the layout**, not the windows: a row of small rectangles, each a layout (one window; two side by side; two with a third column; two with a row below). Which window is in which slot is a setting (the gear): the defaults are No code | Preview (or Code | Preview) and, when a third slot is shown, Smith with Changes under it, right or below. The bar also has arrows at the left and right edge of the preview that hide and show the left and the right window for a bigger preview for a while; no dragging of dividers (A 120 step 2 is dropped: dragging was buggy and a few fixed shares are enough).
- **Phone.** One window at a time; swipe at the top switches the main window (No code, Preview, Smith by default; Code when switched on in settings), swipe below switches the sub view (Behavior, Look, Who can, Content; Smith, Changes). The settings say whether Changes is under Smith and whether Code shows.
- **Kept per device** in `localStorage` (layout, slots, hidden sides), as the preview's width was.

## 9. Steps (A, each a PR; core parts by Fable first where named)

1. **Names and windows:** Smith for Ask; Behavior for Every setting; Content with Languages; the five windows with the layout bar and the settings for slots, arrows instead of dragging; Code reduced to the files; Changes as the one window; Logs gone, the error bar with Troubleshoot (Report, Undo, Reload). What it does removed. (Core first: schema titles, the version key hidden, the `app` description text; Fable 46 (c).)
2. **No change until done:** Code saves on leaving with a keystroke; Behavior's Add opens the wizard; formatting on leave with core's `formatSpec` and the daemon's no-change drop (Fable 46 (b)).
3. **The wizard** in Code and Behavior, with Ask Smith for help.
4. **Changes expanded** in words, and undo of any change by X (core first: `undo --change <id>` with the check, Fable 46 (a)).
5. **Smith's sources:** the docs index, the follow-up rule, the ready prompts.
6. **Phone** swipes and defaults.

## 10. Open with Johan

- Content as a sub view of No code: yes (Johan, 2026-10-17: "Content as a subview of no-code is probably the best. Coders can go there for looks and content changes."). Who can stays a sub view of its own beside Behavior, Look and Content; the round named it in the phone's default.
- The first level of §6 (a failure record without content, always, hosted) needs the terms' line checked.

## 11. Gaps, as asked

With these windows, what can a person not do in Studio? Checked against the spec and today's panels:

- **Nothing of the spec:** Behavior is every key of the spec, Who can every key of the auth file, Look of the ux file, Content of the content file; Code is all four files as text. The context file (implementation policy) has no form and stays Code's; it is rare and technical.
- **Custom code** is written in the person's editor, with the warning and the links (what-it-does.md §3), in both windows.
- **The spec names** (model and page identifiers) are Code's to see and rename; No code shows labels only. That is the one thing No code gives up by design.
- **Running any operation by name** (Code mode's Operation forms) goes; Behavior's controls and Smith cover what they did, and the CLI stays for the rest.
- **Who can** still lacks controls for the `api` and `assistant` blocks (A 95); Behavior must not take them (no permissions there), so they are Who can's.
- **Switching windows** is encouraged by the layout, not forced: a Code user's Look is the Look window, one click in the bar; Smith's answers link to the window where a thing is set ("Open Look").
