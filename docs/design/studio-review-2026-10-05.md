# Builder and Studio as a first-time owner meets them

A walkthrough of 2026-10-05, asked for by Johan ("the biggest weakness right now is the builder/studio"). One session played a shop owner who has never seen the tool: a fresh CRM starter, `smithable studio`, no model configured, thirteen ordinary tasks in "No code" (Builder) and some again in "Code" (Studio), at 1440×900 and once at phone width. 84 screenshots are in Johan's pictures folder under `studio-review/`; the file names below are from there. Fable checked the first finding from the command line and the first screen's picture; the rest is as the walkthrough saw it.

## What works

A change made through the right form lands in the preview in three to eight seconds, with a plain sentence ("Customers: added a mobile phone") and "Undo this change". The summary in sentences ("Only admins can delete customers") is the best part of the tool. Removing a field warns with numbers ("8 of 8 customers have a value for it"). The notice that the records are samples is clear, and records added in the preview survive later changes.

## Where a new person loses confidence, most damaging first

1. **The words box fails on its own example.** "customers should have a mobile number", the sentence printed under the box, answers "No model is available under the AI policy". So do "add a notes field to customers" (the field exists already, which is the real reason and is not said) and "let me filter orders by status" ("filter orders by status" works). The most inviting control fails first, in words an owner cannot act on. *The rules read too few shapes, and a request they half read is not explained.* (`10-words-box-own-example-no-model.png`)
2. **A choice field's values cannot be changed.** "in progress" is refused for its space; "inProgress" then fails on the sample records ("8 errors in samples … Nothing was changed"), and nothing in Builder edits samples. (`06-status-values-change.png`)
3. **The preview stopped showing theme changes** while the tool said they were done, after several undos; the stylesheet answered 500 until an undo restarted the preview. Seen once, trigger not found. (`08i-theme-change-not-in-preview.png`)
4. **Undo looks like a crash, and there is no redo.** The message is clear, but the preview is white or a broken-page icon for ten to forty seconds. (`12b-undo-preview-broken-icon-20s.png`)
5. **Showing a field in the list is hidden under Look.** A new field is not in its list, and none of the places an owner looks (the field, the page, Select in the preview, the Change list) offers it; found after six minutes. The docs say a new field shows in the list. (`03g-column-shown-via-look-tab.png`)
6. **"A button that marks an order as done" ends in code.** The action form asks for a camelCase name and "keep: Customer!", says the behaviour is a stub for a developer, and confirms with a line of JavaScript. A standard action (set a field to a value) is not offered there. (`06e-action-form-developer-terms.png`)
7. **Refusals speak the file's language.** "Model name must start with a capital letter", "In PascalCase", `addField: "type" is missing`, "removeField would make smithable.yml invalid … smithable.yml:39:18". A field's name may have a space; a record's, a page's or a choice value's may not. (`11b-record-name-with-space-refused.png`)
8. **Renaming Orders to Jobs is four edits in three places**, and half-done it says "New job" under "Orders". (`05c-orders-page-half-renamed.png`)
9. **Access is findable but the words undermine trust.** One click gives "Only sales users, the owner and admins", which is still everyone; the general sentence then contradicts the rule; "the owner" reads as the business's owner. The rule itself held when tried as a sales user. (`07b-after-see-the-owner.png`)
10. **The working area is a strip about 360 pixels high**: the words box and Changes take the lower half for good; forms are cut off; at phone width the preview gets about 200 pixels. (`14b-phone-390-preview.png`)
11. **Select in the preview** answers only column headers and form inputs, and silently blocks the app's own menu while it is on.
12. **The left side shows the old state for five to twenty seconds** after a change, and forms keep their values, which invites a second click.
13. **Code mode's column chooser opens with nothing ticked** (ticking one column removed the others); its operations are sixty names in no order.
14. **No publish, share, code or help anywhere.** The docs call the modes Builder and Studio; the screen says "No code" and "Code".
15. **The first screen** has two "Your app" tabs, one above the other, and the preview opens on a sign-in page with "Development only" buttons.

## The tasks

| Task | Builder | Studio |
|---|---|---|
| Understand the screen | with trouble, 2 min | |
| Add a phone field | 40 s, after the words box failed | 1.5 min, two refusals |
| Show it as a list column | with trouble, 6 min | 1.5 min, first try wiped the columns |
| A new kind of record with a page | 2.5 min, three forms, two refusals | 1 min |
| Rename Orders to Jobs | with trouble, 4 min | |
| A status with three values, and a "done" button | status only as a second field; button not managed | |
| Each salesperson sees their own customers | 1.5 min; trusted partly | |
| Colour and theme | 1 min | 2 min, the preview did not show it |
| Undo three times | managed, 10 to 40 s each | |
| Three requests in words | none of three as written | |
| Break things on purpose | all refused or confirmed; wording mixed | |
| Keep up in the preview | 3 to 8 s a change; stuck once | |
| Publish, get the code, get help | not managed | |

Not tried: anything with a model, publishing, CSV import, landing pages and dashboard tiles, keyboard-only use.

## What to do first

The order follows what a first visit meets, not what is largest: the words box (1), since it is the first thing tried; then the dead ends (2, 6) and the hidden list column (5); then the preview's look while it restarts (3, 4, 12), which is what makes working changes feel broken; then the wording (7, 9) and the rename (8); then the layout (10, 15) and the missing ways out (14).
