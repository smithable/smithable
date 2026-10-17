# Studio's changes: one tab in both modes, the prompt in it, edits that save themselves (design)

From Johan's testing round 5 (2026-10-10): the changes list is too small to see that there are
several changes, even on desktop; the "last change" in Code mode shows the whole app's diff when
only the spec files matter; the prompt box, the change forms and the list are three places for
one thing; and an edit in Code mode is saved by a button, where a valid edit could be a change
by itself. This note designs the tab, the entries, the prompt's place and the saving; A builds
it (steps in §8).

## 1. What there is today

- A change is a commit (`smithable: <description>`, ARCHITECTURE §8) with trailers: the
  operation (`Smithable-Op`), the database snapshot, the duration, and for a model's change
  `Smithable-AI` with the request, tier, model, tokens and cost. Undo is a revert commit.
- The trace (`trace()` in `packages/cli/src/studio.ts`) reads the log into entries (description,
  time, engine, tokens, cost, undone, the operation) without the commit's id or its files.
- Builder shows the trace under every panel, in a box at most 35 % of the window's height shared
  with the Ask box, foldable to one line; its tabs are "What it does", "Look" and "Change" (the
  forms). Code mode shows the trace in the lower half of the Details column, and a "Last change"
  tab with `git show` of the newest change, every file but the bookkeeping ones.
- Code mode's editor keeps an unsaved draft per file for the browser's session and saves on a
  button, as one `editSpec` change of the whole file.

## 2. One Changes tab, in both modes

Builder's tabs become **What it does · Look · Changes**; Code mode's become
**Files · Operation · Changes · Logs**. The Changes tab holds, top to bottom:

1. **The prompt** ("Describe a change"), the Ask box as it is, with its queue of requests
   waiting while a change runs. It is the first thing in the tab in both modes, so the way to
   change the app in words is the same in both.
2. **By form**, folded: in Builder the change forms (today's Change tab), in Code mode nothing
   (the Operation tab stays, since it is the forms' equivalent for every operation). A click
   from "What it does" ("add a field" in a group, a part's properties) or from a proposal
   ("edit this") opens the Changes tab with the form unfolded and prefilled, as the Change tab
   is opened today.
3. **The list**, newest first, with the rest of the tab's height: on a desktop that is the
   whole panel, twenty changes without scrolling. Each entry is one line as today (the words of
   the change, then how it was made, when), and opens in place (§3).

The box under the panels goes. What it gave while looking at the preview stays as one line
under the preview: "Last change: added a website to Customers" and, for the newest change that
is still in place, "Undo". The guide's "change" stop moves to the Changes tab.

On a phone the tab is a panel like the others, and the preview gets the box's room back.

## 3. An entry opened

An entry carries its commit's id and the files it changed among the ones a person edits: the
four spec files, `src/custom/**`, and a custom migration. Opening it shows the change itself:

- **In Builder, in plain language.** The app's summary (`summarize` in `@smithable/index`,
  the sentences of "What it does") is made from the spec files before the change and after,
  and the sentences that differ are shown under their part: the old one struck through, the
  new one beside it, as in "Customers have: a name (required), ~~a phone~~ a phone (required)".
  A non-developer reads what changed in the words the summary uses, whatever made the change:
  a form, the prompt, a whole-file edit in Code mode, or an undo. The client has the engine and
  both versions of the files, so it makes this itself; the server only serves the files.
- **In Code mode, the files.** The entry names the files it changed ("smithable.yml,
  smithable.ux.yml"); opened, it shows the patch of those files only, with Git's context, and
  a line "and 23 generated files" that opens the whole patch for whoever wants it. A change
  that added logic (a custom action's code, `smithable customize`) shows its custom files in
  the same patch; generated files never, since nobody edits them.
- **A request's changes together.** A request to the model that applied several operations
  made several commits with the same request in their `Smithable-AI` trailer; consecutive
  entries with the same request are one entry ("You asked: …") that lists its operations when
  opened. Tokens and cost are on the first commit already.

The server gains `GET /api/change/<id>`: the patch of the person's files, the whole patch on
`?all`, and the four files before and after. The trace's entries gain `id`, `files` and
`request`. The "Last change" tab and `GET /api/diff` go, their one use being this.

## 4. Edits that save themselves

Superseded 2026-10-17 by studio-v3.md §7: the editor saves when the person leaves it, after a keystroke, never on a pause, and nothing grows a change any more; `editSpec`'s `grow` argument and the daemon's folding are removed. Kept as the record of what was built on 2026-10-11.

Code mode's editor saves a valid edit by itself, and an edit that continues in the same place
grows the same change rather than making a new one.

- **When.** After a pause in typing (about a second and a half) the file is checked in the
  browser with the validator the CLI uses, as it is now for the gutter's marks. Valid: it is
  saved as `editSpec`, and the change shows in the list at once and the preview reloads.
  Invalid: nothing is saved, the marks show what is wrong, and the last valid state is what is
  saved. A destructive edit (a removed field with values in it, as `editSpec` finds) is never
  saved by itself: the Save button stays for it, with the confirmation it has today.
- **Growing.** The client remembers the id of the change its editing made. The next save of
  the same file sends `editSpec` with `grow: <id>`; the server applies it as a change and, when
  the head is still that commit (an `editSpec` of the same file, not undone, nothing in
  between), folds the two into one: the first commit's message and database snapshot, the
  second's files. Undo then undoes the whole edit, back to before the typing began, which is
  what a person means by undoing it. When the head moved (a change from the forms, the prompt,
  an undo, an agent on the command line), the save is a new change, and the editing continues
  from there.
- **Closing.** The edit stops growing when the person leaves it: another file in the selector,
  another tab or mode, a change made anywhere else (the head moved), or five minutes without a
  keystroke. The next save is a new entry.
- **The same rule for "What it does".** When editing the summary's text becomes a change
  (backlog Fable 21, uncertain), an edit that goes on in the same part grows the same change,
  by the same `grow` flag; nothing in this design depends on it.
- **What stays.** A change that fails downstream (the type check, a migration refused) is
  reported as today, the draft kept and marked; the editor's unsaved draft per file stays for a
  reload, and a draft that is invalid when the tab closes is what the "unsaved edits" prompt
  is for, nothing else.

`editSpec` gains the optional `grow` argument (an id); the server does the folding, since the
engine does not touch Git (CLAUDE.md rule 8). On the command line `smithable op editSpec` is
unchanged: a whole file is one change there.

## 5. What the list shows per entry

As today: the words (the Builder's wording of the operation where it has one, the commit's
description otherwise, "Undid: …" for an undo), then how it was made (generator, or the model
and its tokens and cost) and when. New: the files in Code mode, the request for a model's
change, and "Undo" on the newest change that is still in place, which is also under the
preview. An undone change stays struck through as today.

## 6. What this is not

- Not a history browser with checkout: an older entry opens its diff and nothing else; undo
  stays one step at a time, so what is undone is always clear.
- Not a conversation: the prompt's answers (a question, a refusal, "done") are notices as
  today, not a thread; the list is of changes.
- Not a merge of the modes: each keeps its editing surface; they share the tab, the entries and
  the prompt.

## 7. Tests

In `scripts/test-studio.mjs`, both modes: the Changes tab opens with the prompt first; a form
change appears in the list; opened in Builder it shows the field's sentence struck and
replaced; opened in Code mode it names smithable.yml only and the patch has no `src/` line;
typing a valid field in Code mode saves by itself and the list has one entry; typing on in the
same file leaves one entry with both fields; switching the file and typing makes a second
entry; undoing a grown change removes both fields. Units: `trace()` with id, files and request;
the folding of `grow` (head moved → a new commit); the summary diff on two spec texts.

## 8. Steps (A)

1. Server: `id`, `files`, `request` on the trace's entries; `GET /api/change/<id>`; drop
   `/api/diff`.
2. Builder: the Changes tab (prompt, folded forms, the list), the line under the preview, the
   guide's stop; the plain-language diff of an opened entry; requests grouped.
3. Code mode: the Changes tab in place of "Last change" and the Details column's trace; the
   files' patch, "and N generated files".
4. `editSpec` with `grow`; the server's folding; the editor's saving after a pause; the Save
   button kept for destructive edits.
5. Tests, and `docs/design/studio-guide.md` §5 if a stop moved.
