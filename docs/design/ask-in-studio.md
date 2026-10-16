# Ask in Studio: the change box becomes a panel that builds the app

Design, 2026-10-16 (Fable). Johan, 2026-10-16: an assistant chat in Studio instead of a single prompt box; the first-build questions asked by it, one at a time, as a wizard; "What should I do next?"; undo from the chat; the panel movable or docked; start with making it dockable. Status: step 1 to build (A, backlog A 120), the rest designed here for later (Fable 44). Supersedes nothing: it grows the change box of studio-v2.md §4.

## 1. What people get

- **One panel, "Ask".** The change box ("Describe a change, or ask a question", `apps/studio/src/builder/Ask.tsx`) and its answers become a thread: what the person wrote, what Studio proposed (the summary's words for each operation, as today), what was applied, refused or undone, and the answers to questions. The thread is the Changes trace read as a conversation: nothing new is stored, every line already exists as a change, a proposal or an answer.
- **It docks.** On a desktop the panel sits right of the preview or under it, chosen once from the panel's own corner and kept per device; the Builder's other panels (Your app, Change by form, Changes) keep their place. On a phone it is a sheet over the preview, half the height first so the preview shows what a proposed change does, draggable up to full and down to a one-line bar at the foot with the last line of the thread. It never takes the whole window: a change is confirmed looking at the app.
- **It builds from blank.** A project begun with no description (or a starter) gets the first-build questions in the panel, one at a time, from the same `clarify` call and the reader without a model as `smithable new --describe` uses (first-build.md §2.1, §2.9): "Who will use it?", "What should it show?", each with its options as chips and a box for other words. The answers fold into the description as they do on the command line, and the draft lands as the first entry of the thread, with Apply or Change as any proposal.
- **It proposes the next step.** A named thing gets a proposal of its fields ("Dogs: age, breed, sex, picture; add them?"), from the model with the spec as context, as one proposal with the usual Apply. "What should I do next?" (or an empty send) answers from the advice notes (advice.md §1: the rules' notes, each with its operation) and the judgment part later (advice.md §4): "The Dog page is open to anyone; close it, or say so on purpose. Customers have no page yet."
- **Undo from the chat.** "Undo" or "undo that" is the Undo button (studio-v2.md §4); a line says what was undone. The same for "redo".
- **Everything is confirmed.** As today: a proposal is shown in the summary's words and waits for Apply (Johan, 2026-10-11); Discard, Change it in the forms, Refine it. The panel adds no way to change the app that skips that.

## 2. What it costs, and which model

Each turn is one model call with the fixed context (the spec's summary and the operations' schemas) as a cached prefix, so a turn is a few thousand new tokens in and a few hundred out. On Haiku 5.5 that is well under a cent a turn; a turn that proposes many operations at once, or a question Haiku's answer fails the checks for, goes to Sonnet 5.5 (the cascade of first-build.md and assistant.md, on the checks and never on the model's own confidence). A first build made by chat from blank, ten turns, stays under a dime. The person building is signed in, so the model is always available to Ask in Studio; assistant.md decision 3 (no model for an app's visitors) is about the apps and unchanged. The figures for the hosted service are in smithable-cloud/docs.

## 3. Where it lives

- `apps/studio/src/builder/Ask.tsx` grows into the panel: the thread is drawn from the project's change log (`api.project().changes`, what the Changes tab lists) merged with the panel's own proposals and answers kept for the browser tab's session, so a reload keeps the applied part and loses only unsent words (as `DRAFT` does today).
- Docking is `App.tsx`'s: the frame already owns the preview (studio-v2.md §1) and gives the panels the rest; a `dock` state (right, foot, sheet on a phone) kept in `localStorage` moves the Ask panel between two slots. No free-floating windows (focus, stacking and phones make them a long tail of bugs); draggable dividers between the preview and the panels are a later step (A 120 step 2).
- The questions come from `clarify` and the reader through the daemon's existing route for first builds; the panel asks them one at a time instead of the command line's list.
- "What should I do next?" reads the advice notes the validator already returns; the judgment part waits for advice.md §4.

## 4. Steps

1. **The panel and the dock** (A 120 step 1): Ask.tsx as the thread with the dock on a desktop and the sheet on a phone; the forms and Changes stay where they are. No model change.
2. **From blank:** the questions in the panel, the draft as the first proposal.
3. **Next steps:** "What should I do next?" from the advice notes; fields proposed for a named thing.
4. **Undo and redo by words.**

## 5. ARCHITECTURE §2.4

No construct is added: the panel is the change box with its history shown, the questions are the first build's, the proposals are operations shown before they apply.
