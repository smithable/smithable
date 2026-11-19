# Studio opens on the app

Design reviewed by Fable, 19 November 2026. Based on engine main at `4f2c452f3`, Johan’s Studio feedback and his approval of all eight follow-up decisions. The pictures use Stillwater Yoga so the same button, page and conversation can be followed across states.

## From the Studio we have

Today `apps/studio/src/App.tsx` arranges Smith, Changes, Preview and manual editors into slots. Smith already floats or docks. The docked header says **Float**. Review and publish share a control and a current review count. Undo and redo already call project operations. The preview-first layout starts with the visitor’s page taking the available space. Open the other surfaces when the owner asks for them. Keep the same preview mounted when opening and closing a panel so a partly filled form survives.

Keep the short welcome, visible assistant and optional guided change from [Smith first, §12](smith-first.md#12-the-second-look-johan-2026-10-30-an-overlay-then-the-guide). The single change record and schema-backed manual forms in [Studio v3](studio-v3.md) still serve every route to an edit. This design changes where people find those routes.

## The toolbar

| Control | What happens |
| --- | --- |
| Page name | **Home** opens the editable preview address. Enter navigates to a valid local page or record, Escape returns to the name. Keep the last valid preview on error. |
| Select | The inspect icon arms selection. Click or tap a part to outline it and attach its name to the next request. Holding Shift temporarily arms selection on a keyboard. Escape clears it. Navigation works normally with selection off. |
| Undo · Changes · Redo | The curved arrows use the existing operations. Disable unavailable directions. The list between them opens history without changing the project. |
| Mail | Open Outbox. Opening a template gives its editor and example message a larger overlay, with a return to the same message list. |
| Review | The checklist badge counts open items from the existing review result. The overlay has Items, Summary and Map. A Summary sentence or Map node opens its existing detail. |
| Publish | The cloud-arrow checks the current review. With open items it opens Items and explains what needs attention. At zero it opens publish confirmation. An unknown, stale or failed check offers retry. Confirmation uses the existing hosted release flow and permissions. |
| Help | Open quick hints, the full guide, feedback and docs. Closing Help returns focus to its toolbar control. Contextual hints can be dismissed individually. |
| All settings | Open the current No code editors. Retain navigation to advanced Code. Smith, selection overlays and All settings should draw on the same edit forms and save operation. |
| Smith | Toggle his window. A steady highlight means he is speaking while hidden. A separate slow pulse means he has a question outside a conversation. Give each an accessible text equivalent and use a static attention marker with reduced motion. |

Recommended phone arrangement: keep page name, Select, Review, Publish and Smith directly reachable. A labelled More menu holds the undo/history/redo group, Mail, Help and All settings. Use labelled buttons inside menus and tooltips plus accessible names on the icon bar.

## Decisions Johan approved

1. **Dock / Undock.** Show the available action in Smith’s header. Dock gives the preview its own column. Undock returns Smith to his floating position. Hide works from either place. On first hide, point to the Smith icon for a few seconds.
2. **Movable overlays.** Smith, Changes and selection forms have a header drag handle. Remember their positions on this device, clamp them on resize and offer Reset position. Recommendation for phones: use a bottom sheet with a visible slice of the selection above it and a close button. A keyboard user can choose a corner or reset from the header.
3. **Select before “this.”** Keep the outline and the selected part’s name visible while the owner speaks. Smith resolves “this” against that selection. If the part disappears or navigation invalidates it, clear the selection and ask the owner to select again.
4. **One selection tool.** Offer **Look**, **Text** and **What it does** for the selected part. For “Change this button,” ask what should change and offer the full relevant form in Smith’s open window. With Smith hidden, anchor the form near the selection. **Apply** uses the usual validation and records one change. Cancel returns to the same page. For “change the timers” during a hidden call, show a list of the app’s timers and open the chosen timer’s form.
5. **Smith first, then the look.** On first creation, Smith greets the owner in one or two speech bubbles. His first question opens the theme picks, followed by image style. Required questions remain visible in Review and link back to their answers. Returning owners resume the preview. Keep Suggested topics collapsed in chat.
6. **Path on demand.** Show the page name in the toolbar. Reveal the address when the owner clicks the name. Deep pages and pasted record paths remain reachable.
7. **Review and Publish get separate icons.** Summary and Map live in Review. Publish follows the badge and confirmation behavior above. Recheck at confirmation if the project changed while Review was open.
8. **One-press call.** Keep the mic beside the phone. Mic toggles listening and shows red plus a listening label when active. **Start call** starts listening and Smith’s voice together. He says “Hi, it’s Smith. I’m listening.” End call stops both. On the first hide during a call, briefly show “You can hide Smith and keep talking.” Keep an End call action reachable while hidden. If microphone permission fails, explain how to retry and leave typing available.

### Interaction details recommended for implementation

**Selection.** Intercept the armed click before a link, submit or other app action runs. Shift only arms selection outside editable controls. Keyboard users can arm Select, move among named parts with the arrow keys, and press Enter to select. Resolve the chosen part to a stable spec reference and the edit forms that support it. If it has no editable fields, identify it and offer its nearest editable parent. With Smith hidden, a lost selection shows a hint beside Select and is also spoken during a call. Without a selection, a timers list or other app-wide form opens in a floating panel, or a sheet on the phone.

**Audio.** Start the mic or a call from the two controls in Smith’s composer. While he is hidden, a compact active-audio strip beside or below the Smith icon shows **Stop listening** or **End call**, plus the spoken-state indicator. Hide leaves the active audio session running. Ending a call releases the microphone and stops playback.

**Release.** Count required unanswered questions and other actionable review items. Informational hints alone do not raise the badge. Where existing policy permits acknowledgement, record it on the item. Show a read-only Review and explain who can publish to an owner without release permission. Bind confirmation and release to the same checked revision. If it moves, return to Review and ask for a fresh confirmation.

## History you can try before applying

Show what changed, when, and which version is current. If the owner undoes B, then makes C, B stays discoverable as an alternate version. Clicking B opens an isolated preview with **Viewing B**, **Apply this version** and **Back to current**. Close or Back discards the preview. Apply creates a new restoration entry on the current history and preserves B and C. If another edit arrives while previewing, ask the owner to revisit the latest change before applying. Keep operation descriptions as the default; offer an existing diff only where available.

Today `history.ts` groups trace entries and `OldVersion.tsx` opens an isolated copy in another tab with its own data. A branch-preserving restore needs its own storage and operation contract. Reuse the isolated viewer first. Applying restores project configuration and content from a recoverable snapshot. Show the scope before confirmation and leave visitor records out of the restore. Disable edit, Undo and Redo during the historical preview. After Apply, Undo returns to the state immediately before Apply and Redo repeats that restoration. An edit after Undo starts a branch. Redo follows the active branch only; other branches remain available in Changes. Refuse restoration when the older schema cannot represent current visitor records without loss. Show the incompatible fields and keep the current revision. The persistence and schema compatibility contract needs core review before implementation.

**Still Johan’s to pick.** My recommendation is to reopen on the current app with the latest ten entries expanded, a **Show earlier** action, and alternate versions visible with a branch label. Ten is a display limit only. Decide the retention period for restorable snapshots separately before promising older entries can be applied. For an unavailable snapshot, keep its description and explain why Apply is unavailable. A new code-history tab can wait for demand. These choices leave all eight decisions above intact.

## Small pull requests

| PR | Task and owner | Deliverable and acceptance |
| --- | --- | --- |
| First | T1021 · Codex | Deliver Undock, collapsed Suggested topics, the mic toggle, undo/redo and mail icons, a large mail-template overlay and the toolbar’s Smith toggle. Later PRs reuse these controls. |
| 1 | T1022 · Codex | Preview-first chrome, names, responsive overflow and page-name disclosure. Verify a typed visitor form survives opening Help or Smith, keyboard focus returns and phone controls fit. |
| 2 | T1022 · Codex | Smith bubbles, Dock / Undock, hide hint, collapsed topics and first-run ordering. Verify a returning owner skips the welcome and a new owner reaches both look picks. |
| 3 | T1022 · Codex | Keep mic toggle, add call lifecycle and hidden-state indicators. Exercise first-hide hint, denied permission, end call while hidden and reduced motion. |
| 4 | T1023 · Sol | Inspect click/tap and temporary Shift selection. Route one representative button through Look, Text and What it does in both panel positions. Expand by reusing the same forms. |
| 5 | T1022 · Codex | Draggable overlays, reset position, phone sheets, Help and large mail-template editor. Exercise resize, reopen and keyboard operation. |
| 6 | T1023 · Sol | Split Review and Publish over the existing review result. Move Summary and Map; exercise zero, nonzero and unreadable counts, plus a change before confirmation. |
| 7 | Later · pending Fable’s go-ahead | List full history and open the existing isolated viewer. Show branch, current and unavailable states. Existing undo and redo remain available. |
| 8 | Later · core design first | Write a separate core design note on snapshots, retention, migration, schema compatibility and restoration. Fable must read it before any PR 8 implementation begins. Resolve retention with Johan before building Apply. Test A → B → undo → C → preview B → apply → reopen, including preservation of C and visitor data. |

After T1021, Codex builds PRs 1, 2, 3 and 5 in sequence. When PR 1 lands on main, Codex tells Fable and Sol. Sol then builds PR 6 followed by PR 4, using the existing release permissions and operations. Fable schedules PRs 7 and 8 separately.
