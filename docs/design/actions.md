# Standard actions: a button that changes a record, without code

Status: 2026-10-03, proposed by Fable; Johan said go the same day and asked for more than `set` (section 3 has what he asked for and the order it comes in). The spec has reserved `on`, `when` and `set` since 0.1 ("Standard actions that change a record without code come in a later version"), and ARCHITECTURE §3 already says whose access they follow. This fills them in. It adds a construct to the spec, so merging this document is the go-ahead for step 1.

## 1. Why now

Every action is custom today: the spec declares input and output, and the behavior is a file in `src/custom/actions/`. That is right for merging two customers. It is wrong for the most common action there is, "move this record to its next state": resolve an incident, mark an invoice paid, cancel a booking, approve a request, archive an item, publish a post. Each is a few field values, and each is custom code today.

What that costs showed on 2026-10-03, in the first-build benchmark with the status starter. Its three actions (identified, monitoring, resolve) are custom, an app drafted from a sentence gets only generated stubs, and a stub throws "is not implemented yet". A draft that keeps the starter's actions has three buttons that fail; a draft that drops them (what the model did once the guidance was fixed) has no incident flow. Neither is the status page the starter shows.

The five questions (ARCHITECTURE §2.4): common (every model with a state has these); deterministic (field values, a condition, a formula from the fixed library); it removes a model call and custom code from the most frequent kind of action, and the ambiguity of "what does this button do"; technology-neutral (fields and values, nothing about the stack); and materially better than free text plus custom code, since the code was five lines of the same shape each time and the validator can now check it (a value the field does not have, a state the action can never leave).

## 2. The construct

```yaml
actions:
  resolve:
    on: Incident                                   # the record it changes
    when: { status: [investigating, identified, monitoring] }   # offered and allowed only then
    set: { status: resolved, resolvedAt: NOW() }   # the new values
    allow: [admin, staff]                          # optional, as for custom actions
  markPaid:
    on: Invoice
    when: { status: sent }
    set: { status: paid, paidOn: TODAY() }
```

- `on` names a model. The action runs on one record of it.
- `set` gives fields of that model their new values: a literal the field accepts (a choice value, `true`, a number, a text), or a formula from the existing library evaluated on the record as it is before the change (`NOW()`, `TODAY()`, `DATEADD(TODAY(), 14, "day")`, `(total * 0.25)`). The rule is the one a field's default follows: a value with parentheses is a formula, anything else a literal. At least one field. Not settable: computed fields, references, lists, pictures and the automatic fields (`owner`, `createdAt`, `updatedAt`).
- `when` (optional) is a condition as everywhere else (`packages/core/src/condition.ts`): choice values, one or a list, and yes/no fields. The button is shown only on a record it fits, and the server refuses the action on one it does not ("This incident is already resolved" becomes the general "This cannot be done now").
- A standard action has no `input` and no `output`, and no `custom` (what it asks the person for comes with section 3, step 1). `custom: true` and `on`/`set` exclude each other.
- `allow`, `intent` and `rules` work as for custom actions. `rules` on a standard action are documentation only; a warning says so when one is given, so nobody believes a sentence is enforced.

**Access.** As ARCHITECTURE §3 says: a standard action follows the model's write access (whoever may edit the record may run it). Since 2026-10-21 (the spec plan's phase 2, Johan: "like pages") a role whose `actions` grant in the auth file names a standard action runs it too, without `write` on the model, as a role opens the pages its `pages` grant names; roles with `write` keep running the model's actions, and `actions: all` is every action, standard ones included (`smithable upgrade` writes the explicit list of custom actions for a role whose `all` would otherwise widen). With it, the action writes only the fields its `set` names and the ones it asks for, never the whole row back, and bypasses `locked` only for the fields in `set`: that is what makes "a customer cancels their own booking" safe without `write` on bookings. (The earlier `allow` key narrowed access to roles; it went when access moved to the auth file.)

**Where it is offered.** As custom actions are: a page lists it (`actions: [resolve]`), and that page must be a crud page of the action's model (an error otherwise). The button is on the record's page and in the row's menu, for records the condition fits and viewers who may run it. `addAction` puts a new standard action on the model's crud page when there is exactly one, so one operation gives a working button.

**What it does.** The generated server function loads the record through the model's data function (so access and the public condition apply), checks `when`, computes the values and writes them through the same `update` the edit form uses: validation, hooks, capacity and `updatedAt` behave as for an edit, in one transaction. Nothing new is stored.

**Validation** (errors unless said):
- `on` is not a model; a field in `set` or `when` is not the model's, or not settable; a literal the field does not accept; a formula that does not type-check against the field (`checkFormula`, as for defaults).
- `set` changes nothing the condition could not already be: a warning when `when` and `set` name the same field with the same single value ("the action leaves the record as it was").
- A required field set to an empty value.
- The condition can never hold or the action can be repeated forever is not checked: that is the author's intent.

**Following changes.** A renamed field is renamed in `when` and `set` (keys, and inside formulas with `renameInFormula`); a renamed model in `on`. Removing a field or a choice value the action names is refused, naming the action, as for the other conditions (`lostValues`). Removing the model removes its standard actions with it, listed in the confirmation.

## 3. What comes after `set`, in this order

Johan's input (2026-10-03): spec-only actions should also be able to create and delete, ask the person for a value, copy a record ("clone"), work on several selected rows of a list, and show only to those who may run them. All of it fits, as further keys of the same action rather than as sub-actions with their own parameters: one action stays one thing a person does, said in one line of YAML. Each step below is its own small decision when its turn comes.

1. **Ask for a value.** A field in `set` with no value is asked for when the button is pressed: `set: { status: canceled, cancelReason: }` opens a dialog with the field's own control (its label, its help, required as the field is) and Cancel. Several fields may be asked at once. This is the "input" of a standard action, with nothing new to learn.
2. **Copy.** `copy: { status: draft, issuedOn: TODAY() }` on an action makes a new record from the one it runs on: every stored field copied, the ones named set (or asked for, as above), unique fields and the automatic ones left to the new record. "Duplicate invoice", "Repeat this booking", Johan's "clone a dog". The person lands on the new record.
3. **Add a related record.** `add: { IncidentUpdate: { status: resolved, message: } }` creates a record of a model that refers to this one, linked to it, in the same transaction as `set`. The status page's "with an update saying so"; a payment on an invoice; a note on a customer.
4. **Selected rows.** A list gets checkboxes when its page offers actions; a standard action runs on every selected record its `when` fits and the person may change, all or none, and says how many it changed. Delete joins it as a built-in action on the selection ("Delete 3 customers?"). "All records matching a condition" is then the list's filter plus select all, with no new expression language (`dogs[age > 13]` is the filter `age > 13` and the checkbox in the header).
5. **The viewer as a value:** `ME()` in a formula, for "assign to me".

Left out, on purpose:

- **Changing a referenced record** (the incident's component back to operational). The other record's own action, or a formula on it, says it better; custom code otherwise.
- **Several steps in one action**, conditions between them, loops. That is a workflow language; a custom action is the honest tool.
- **Automatic rules** (when an edit changes the status, set the time). A different thing: an action is a button someone presses. The same `set` grammar would serve a later `on change`.
- **Undo.** The button acts at once and the page shows the record's new state.

## 4. Operations, words, drafts

- `addAction <action> --on <Model> [--when field=value…] --set field=value…` adds a standard action (the existing custom form stays: without `--on`, it is custom). Several values in `--when` are written as the choices are, `"status=investigating | identified"`, as in the other conditions. `removeAction <action>` removes one, from its pages and from what the API offers by name. `setAction <action> [--intent] [--when] [--set]` changes one part of an action and leaves the rest (added 2026-10-04 with `removeAction`; it was first left out as "remove and add again is cheap", but changing one sentence of an action with five parts meant restating the other four, which a model gets wrong and which moves the button on its page; the api starter's intent went in by hand for want of it). What it adds or copies, and its model, still change by removing and adding.
- Summary (`packages/index`): "Resolve: for an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now. Admins and staff."
- Tier-0 phrases: "add a button to mark an invoice as paid", "let staff resolve an incident".
- First builds: the draft guidance says to use standard actions for state changes and never to add a custom action unless the description asks for something only code can do; a starter's custom actions are not carried into a draft, its standard ones are.

## 5. Steps

1. **Core (Fable):** the grammar and IR (`ActionIR` becomes custom or standard), validation, follow, `addAction`'s standard form, the summary sentence, the schema, the spec reference, the draft guidance. Tests in core. The adapter refuses nothing yet: a standard action generates no button until step 2, and a test pins that it generates no stub either.
2. **Adapter (A):** the server function, the button on the record page and the row menu, the generated access test (who may run it, and that it is refused when the condition does not fit), a browser step in test-apps.
3. **Starters (A, C):** the status starter's three actions become standard (its custom code keeps only what `set` cannot say, or goes); invoicing gets "mark as sent" and "mark as paid", booking "cancel".
4. **Then section 3, in its order:** asking for a value, `copy`, `add`, selected rows, `ME()`.

Exit for steps 1–3: the status starter has no custom action code, its incident flow works in the browser test, and a first build from "a status page for our API" keeps working resolve buttons.

## 6. §3 step 1: asking for a value

Status: 2026-10-03, proposed by Opus A after Fable's go for §3. Johan's words: a field in `set` with no value opens a good-looking dialog where the value is typed, several fields may be asked at once, and the action only shows to those who may run it.

```yaml
actions:
  cancel:
    on: Booking
    when: { status: booked }
    set: { status: canceled, cancelReason: }      # asked for
  postpone:
    on: Invoice
    when: { status: sent }
    set: { dueOn:, note: }                         # two at once
```

- **The grammar:** a key in `set` with no value (YAML null) is asked for. Nothing else is new. An action whose `set` has only asked fields is fine (postpone).
- **What the person sees:**
  - Pressing the button opens a dialog titled with the action's label, holding the asked fields in the order written. Each field uses its own control, label and help, as the edit form shows them (a date picker, a choice list, a text area).
  - The fields start with the record's current values.
  - The dialog has two buttons: the action's label, and Cancel.
  - A field that is required on the model is required here. The error shows under it, as in the form.
  - With nothing asked, the button acts at once, as now.
- **Validation:** an asked field must be settable, as for any value in `set` (not computed, not a reference, not a picture). `when` and an asked field may name the same field.
- **Access:** unchanged. The button shows only to those who may run the action on that record (the rule with `among`) and only where `when` fits. The server checks both again.
- **What runs:**
  - The server function takes the record's id and the asked values, validated by the model's own schema for those fields.
  - It works out the literal and formula values on the record as it was, takes the asked ones as given, and saves all of them through the edit's `update`.
- **Follow:** asked fields are keys of `set`, so renames and removals follow as they already do.
- **The operation:** `addAction cancel --on Booking --when status=booked --set status=canceled --set cancelReason=`. An empty value asks for the field and is written as YAML null.
- **Summary:** "For a booking that is booked; sets status to canceled and asks for the cancel reason."
- **Left out:** values that are not fields of the record (that stays the custom action's `input`), questions that depend on an earlier answer, and a value suggested by a formula.

## 7. §3 step 3: adding a related record

Status: 2026-10-03, proposed by Opus A together with step 1, because it lets the status starter drop its custom code.

```yaml
actions:
  resolve:
    on: Incident
    when: { status: [investigating, identified, monitoring] }
    set: { status: resolved, resolvedAt: NOW() }
    add:
      IncidentUpdate: { at: NOW(), status: resolved, message: This incident is resolved. }
  recordPayment:
    on: Invoice
    when: { status: [sent, overdue] }
    add:
      Payment: { amount:, paidOn: TODAY() }        # asked for, as in step 1
```

- **The grammar:** `add` maps a model to the values of one new record. The model must have exactly one reference to the action's model, and that reference is filled with the record the action runs on (it may not be given). Values work as in `set`:
  - a literal;
  - a formula worked out on the action's record as it was, so `(total)` means the invoice's total;
  - nothing, to ask for it, in the same dialog under a heading with the model's label.
  
  `add` may name several models, one record each. An action needs `set`, `add` or both.
- **What the person sees:** the button acts as before. The added record shows in the record page's list of it (an incident's updates, an invoice's payments). The dialog appears only when something is asked.
- **Validation:**
  - The model exists and refers to the action's model exactly once. A list (`Order[]`) does not count.
  - Each field is settable on that model.
  - Every required field of the added model that has no default gets a value or is asked for. Otherwise this error: "Adding a Payment needs a value for amount, or ask for it."
  - The reference back is not given.
  - Formulas type-check against the field they fill, on the action's model.
- **Access:**
  - Running the action also needs the right to create the added model's records.
  - The kit's `allows` is asked for both, so the button shows only to those who may do both.
  - A warning, like `action-role-cannot-write`, flags an allowed role that may not create the added model.
  - The new record is owned by the person who pressed the button, as a create would be.
- **What runs:** the record's update and the new records' inserts happen in one database transaction, through the data functions' rules (references readable, capacity, validation by the model's schema). Hooks run after it, as they do for a create.
- **Follow:**
  - A renamed field of the added model is renamed in `add`, keys and formulas alike.
  - Removing such a field, or the reference back, is refused while the action uses it.
  - Removing a choice value used in `add` is refused, as in `set`.
- **The operation:** `addAction resolve --on Incident … --add "IncidentUpdate.status=resolved" --add "IncidentUpdate.at=NOW()" --add "IncidentUpdate.message=This incident is resolved."`. Each pair is written `Model.field=value`, and an empty value asks for it.
- **Summary:** "…; sets status to resolved and resolved at to now; adds an update (at now, status resolved, message "This incident is resolved.")."
- **Left out:** changing the referenced record (as §3 says), several records of one model, adding through a list or a many-to-many, and deleting.

**The status starter with steps 1 and 3:**
- `identified`, `monitoring` and `resolve` become standard: each sets the status and adds an IncidentUpdate with the status and its message.
- `src/custom/actions/` goes.
- One thing the custom code does is left out on purpose: resolving no longer sets the incident's component back to operational. That changes a referenced record. A component's state becomes what the team sets, which is also what the landing shows.
- **Decided (Fable, 2026-10-03):** accepted. A component can have a second incident open, so resolving one must not mark it operational; its state is what the team sets.

**Steps:**
1. Core: `set` takes null as asked; `add` in the grammar and IR, validation, follow, access with create, the operation's `--add`, the summary, the schema and the spec reference.
2. Adapter:
   - the dialog, as a kit component on the shadcn Dialog, using the form's field controls;
   - the server function with the asked values and the transaction;
   - the access test cases (asked values validated; add refused without create);
   - a browser step.
3. The status starter on standard actions without custom code; its browser flow stays green.

## 8. §3 step 2: copy

Status: 2026-10-03, by Fable. "Duplicate this invoice", "Repeat this booking", Johan's "clone a dog".

```yaml
actions:
  duplicate:
    on: Invoice
    copy: { status: draft, issuedOn: TODAY(), number: }   # what differs; number is asked for
    with: [lines]                                          # its lines come along
  repeat:
    on: Booking
    when: { status: [confirmed, done] }
    copy: { status: confirmed, startsAt: }
```

- **The grammar:** `copy` makes a new record of the action's model from the record it runs on. Its map says what differs, with values as in `set`: a literal, a formula on the original, or nothing to ask for it; `copy: {}` copies as is. `with` (optional) names lists of the model (`lines: InvoiceLine[]`) whose records are copied too, each pointing at the new record. An action has `copy`, or `set` and `add`, never both: it changes this record or makes a new one. `when` works as always.
- **What is copied:** every stored field of the record, references included. Not copied: computed fields (they compute), the automatic fields (the copy is owned by whoever pressed the button and is created now), pictures (a picture is a file that belongs to one record; the copy starts without), and unique fields (two records cannot share the value).
- **What the person sees:** the button; the dialog when something is asked, with the asked fields starting at the original's values; then the new record's page, so what was copied can be looked over and changed.
- **Validation:**
  - Keys of `copy` are settable fields, as in `set`; here a reference may not be named either (it is copied).
  - A unique field that is required must be in `copy` with a formula or asked for: "A copy needs its own number (it is unique): give it in copy, or ask for it."
  - A required picture cannot be copied: such a model cannot be copied by an action yet.
  - `with` names lists of the model. The listed model's own unique and picture rules apply the same way, except that nothing can be asked for a list's records: a required unique field there is an error.
  - `copy` with `set` or `add` is an error.
- **Access:** making a copy needs the right to read the record and to create one of the model, and to create the records of each list in `with`; `allow` narrows it to roles, through `among` as for the other actions. Write access to the original is not needed: it is not changed.
- **What runs:** one transaction: the new record through the data functions' create (validation, capacity, hooks as for any create), then the lists' records. A refusal anywhere leaves nothing behind.
- **Follow:** a renamed field is renamed in `copy` (keys and formulas) and a renamed list in `with`; removing a field named in `copy`, or a list named in `with`, is refused while the action names it; a choice value used in `copy` cannot go.
- **The operation:** `addAction duplicate --on Invoice --copy status=draft --copy number= --with lines`. `--copy` alone (no pair) copies as is.
- **Summary:** "Makes a copy of an invoice with status draft and issued on today, asking for the number; its lines are copied too."
- **Left out:** copying to another model, lists of lists (only the lists named, one level), choosing which of a list's records come along, and copying pictures.

## 9. §3 step 4: selected rows, and delete

Status: 2026-10-03, by Fable. Johan: check items with a checkbox, or select like in a spreadsheet; delete what is selected; "all dogs older than 13" as a future thing. This step adds no grammar: the actions are the ones already written, and "all that match" is the list's own filter.

- **Where:** a crud page's table gets a checkbox per row and one in the header when the page offers at least one standard action or the viewer may delete records of the model. A page shown as cards gets the checkbox in the card's corner. Nothing to configure; a ux key to turn it off waits for someone who needs it.
- **Selecting:** a click on a checkbox; shift-click selects the range between two; the header's checkbox selects the rows shown. When the list has more records than are shown, a line appears: "All 25 on this page are selected. Select all 132 that match." That is the list with its current search and filters, which is how "every dog older than 13" is said: filter by age, select all.
- **The bar:** with a selection, a bar over the table says how many are selected and offers each of the page's standard actions that fits at least one of them and that the viewer may run, with the count it applies to ("Resolve (3)"), and Delete when the viewer may delete at least one. Copy actions are not offered: a copy is looked over one at a time.
- **Running one:** the action runs on the selected records its `when` fits and the viewer may run it on; the others are skipped and counted ("3 resolved, 1 skipped: already resolved"). Asked values are asked once, in the same dialog, starting empty, and go to every record. `add` adds its record to each.
- **All or none:** one transaction. If one record is refused (a validation, a capacity), nothing changes and the message names the record and the reason.
- **Delete:** a confirmation that says how many and what ("Delete 3 customers? This cannot be undone."). Records that cannot be deleted (still referred to) are named before anything is deleted, and nothing is.
- **Access:** the server runs each record through the same check as the single action or delete; the selection is ids, never trusted. "All that match" is evaluated again on the server with the filters, within what the viewer may read, up to 1,000 records; more than that is refused with the count, so nobody changes ten thousand records by one click.
- **Tests:** the generated access test runs an action over a mixed selection (fits, does not fit, not the viewer's) and checks the counts and that a refusal changes nothing; a browser step selects two rows and resolves them.
- **Left out:** selection across pages other than "all that match", drag selection, keyboard-only range selection beyond shift-click, exporting the selection, and a condition language (`dogs[age > 13]`): the filter says it.

## 10. §3 step 5: the viewer as a value

Status: 2026-10-03, by Fable. "Assign to me", "approved by".

```yaml
actions:
  take:
    on: Ticket
    when: { status: open }
    set: { assignee: ME(), status: inProgress }
```

- **The grammar:** `ME()` as a whole value in `set`, `add` or `copy`, for a field that refers to `User`. It is the person who pressed the button. This is the one case where an action sets a reference.
- **Validation:** only on a `User` field ("ME() is a person: assignee must refer to User"); not inside a larger formula, not in `when`, and not in a field's default (the owner already records who created a record).
- **What runs:** the server puts in the signed-in user's id. An action with `ME()` is never offered to a visitor.
- **Summary:** "sets assignee to whoever presses it".
- **Left out:** comparing with the viewer ("only when it is assigned to me"), which is access by a field and belongs with the access rules, not with actions.

**Order to build:** §10 is small and can ride with §8; §9 is the adapter's and the kit's alone and comes last. Core pull requests come to Fable as before.
