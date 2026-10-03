# Standard actions: a button that changes a record, without code

Status: 2026-10-03, proposed by Fable. The spec has reserved `on`, `when` and `set` since 0.1 ("Standard actions that change a record without code come in a later version"), and ARCHITECTURE §3 already says whose access they follow. This fills them in. It adds a construct to the spec, so merging this document is the go-ahead for step 1.

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
- A standard action has no `input` and no `output` in this version, and no `custom`. `custom: true` and `on`/`set` exclude each other.
- `allow`, `intent` and `rules` work as for custom actions. `rules` on a standard action are documentation only; a warning says so when one is given, so nobody believes a sentence is enforced.

**Access.** As ARCHITECTURE §3 says: a standard action follows the model's write access (whoever may edit the record may run it), and `allow` narrows it to roles. It never widens: a role in `allow` that may not write the record still cannot run it, and the validator warns about such a role.

**Where it is offered.** As custom actions are: a page lists it (`actions: [resolve]`), and that page must be a crud page of the action's model (an error otherwise). The button is on the record's page and in the row's menu, for records the condition fits and viewers who may run it. `addAction` puts a new standard action on the model's crud page when there is exactly one, so one operation gives a working button.

**What it does.** The generated server function loads the record through the model's data function (so access and the public condition apply), checks `when`, computes the values and writes them through the same `update` the edit form uses: validation, hooks, capacity and `updatedAt` behave as for an edit, in one transaction. Nothing new is stored.

**Validation** (errors unless said):
- `on` is not a model; a field in `set` or `when` is not the model's, or not settable; a literal the field does not accept; a formula that does not type-check against the field (`checkFormula`, as for defaults).
- `set` changes nothing the condition could not already be: a warning when `when` and `set` name the same field with the same single value ("the action leaves the record as it was").
- A required field set to an empty value.
- The condition can never hold or the action can be repeated forever is not checked: that is the author's intent.

**Following changes.** A renamed field is renamed in `when` and `set` (keys, and inside formulas with `renameInFormula`); a renamed model in `on`. Removing a field or a choice value the action names is refused, naming the action, as for the other conditions (`lostValues`). Removing the model removes its standard actions with it, listed in the confirmation.

## 3. What it leaves out, on purpose

- **Adding a related record** (the status starter's "with an update saying so") and **changing a referenced record** (its component back to operational). Both are real and both are next (section 5), but each is a second construct, and `set` alone already gives a working incident flow: the status moves and `resolvedAt` is set.
- **Input** ("cancel, with a reason"). It needs the reason in `set` as a name, which the formula scope does not have yet.
- **The viewer as a value** ("assign to me"). One word in the formula library, `ME()`, typed as a user; it needs the user in the evaluation context of the kit. Next to input, the most asked for.
- **Automatic rules** (when an edit changes the status, set the time). A different thing: an action is a button someone presses. The same `set` grammar would serve a later `on change`.
- **Confirmation and undo.** The button acts at once and the page shows the record's new state. A confirm text can be content later.

## 4. Operations, words, drafts

- `addAction <action> --on <Model> [--when field=value…] --set field=value…` adds a standard action (the existing custom form stays: without `--on`, it is custom). Several values in `--when` are written as the choices are, `"status=investigating | identified"`, as in the other conditions. `setAction` is not added: `removeAction` and `addAction` again is cheap, and an action has no data.
- Summary (`packages/index`): "Resolve: for an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now. Admins and staff."
- Tier-0 phrases: "add a button to mark an invoice as paid", "let staff resolve an incident".
- First builds: the draft guidance says to use standard actions for state changes and never to add a custom action unless the description asks for something only code can do; a starter's custom actions are not carried into a draft, its standard ones are.

## 5. Steps

1. **Core (Fable):** the grammar and IR (`ActionIR` becomes custom or standard), validation, follow, `addAction`'s standard form, the summary sentence, the schema, the spec reference, the draft guidance. Tests in core. The adapter refuses nothing yet: a standard action generates no button until step 2, and a test pins that it generates no stub either.
2. **Adapter (A):** the server function, the button on the record page and the row menu, the generated access test (who may run it, and that it is refused when the condition does not fit), a browser step in test-apps.
3. **Starters (A, C):** the status starter's three actions become standard (its custom code keeps only what `set` cannot say, or goes); invoicing gets "mark as sent" and "mark as paid", booking "cancel".
4. **Then, each its own decision:** `ME()`, input, `add` (a related record), a referenced record's field.

Exit for steps 1–3: the status starter has no custom action code, its incident flow works in the browser test, and a first build from "a status page for our API" keeps working resolve buttons.
