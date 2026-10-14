# Rules on a record: what the support portal needs from the spec (design)

Status: 2026-10-14, Fable, from Johan's own build of a support portal on the hosted service
(backlog Fable 39 and 40). Five things the spec could not say, each small, each a line in the
grammar the actions already have. One note, since four of them share one piece: a condition
on a record, as an action's `when` writes it. A build for A, after the Studio findings of the
same build; merging this note is the go-ahead.

The five, in the portal's words:

1. "You don't fill in that you are the agent when adding a message: that is obvious."
2. "A closed case should not be editable, except to reopen it."
3. "Require an assignee when putting a case in progress; only an open case may lack one."
4. "Assign to any agent: a dropdown of the agents to pick from."
5. "To close a case, the last message must be from the agent."

And beside them, from the same build, a person as a filter (§6: "my cases", "unassigned").

## 1. Fields the app fills: `by: app`

```yaml
models:
  Message:
    fields:
      content: text!
      sender: customer | agent        # the first value is the default, as today
      agent: { type: User, by: app, default: ME() }
      supportCase: SupportCase!
```

- **`by: app`** on a field: the form never shows it, on create or edit. Its value comes from
  its default (a literal, or a formula: `ME()` for who is making the record, `TODAY()`), from an
  action's `set` or `add`, from an incoming entry's `set` (`sender: customer` for a mail), from
  an import, or from custom code. The record page and lists show it as any field.
- Required and `by: app` means the default, the action or the entry must give a value: a form
  that would create the record without one is refused by the server with the field's name, and
  validation warns when a required `by: app` field has no default and no `set` anywhere.
- The portal: `sender` stays a plain choice whose default is `agent` for the form (its first
  value), and the mail entry sets `customer`; `agent` is `by: app` with `ME()`.
- Why not hide it in the ux file: who fills a field is what the record means, not how the form
  looks (rule 1); a hidden field that the form still accepts from a request is a hole.

## 2. Fields locked by a condition: `locked`

```yaml
  SupportCase:
    fields:
      subject: string!
      status: open | inProgress | closed | reopened
      customerEmail: { type: email!, locked: true }               # set once, when the case is made
      priority: { type: int!, min: 1, max: 5, default: 3, locked: { status: closed } }
```

- **`locked: <condition>`**, the condition as an action's `when` (a choice field's value or a
  list of them, a yes/no field's `true` or `false`): while the record fits it, the field is
  read-only in the form (shown as the fixed reference is shown when adding from a list) and a
  change to it is refused by the server ("Priority cannot be changed on a closed case"). An
  action's `set` may still change it: `reopenCase` sets the status, which is how a closed case
  comes back. **`locked: true`**: set when the record is made, never changed after.
- The lock reads the record as it is before the change, so an edit that both closes a case
  and changes its priority is refused; the action that closes it is the way.
- A model-level shorthand (`locked: { when: { status: closed }, except: [status] }`) only if
  the field form proves wordy in real apps; the portal's four fields do not need it.

## 3. Required by a condition: `required`

```yaml
      assignee: { type: User, required: { status: [inProgress, closed] } }
```

- **`required: <condition>`**: the field must have a value while the record fits the condition.
  The form marks it required when the record fits (as the status is chosen, the mark follows),
  the server refuses a change that leaves it empty where the record fits, and an action whose
  `set` makes the record fit (`markInProgress`) asks for the field in its dialog when it is
  empty, as it asks today for a field with no value. One rule for the form, the action and the
  server; `required: true` stays the plain form.
- The portal: an open case may lack an assignee; `markInProgress` on an unassigned case asks
  whom; the form refuses "in progress" without one.

## 4. An action asking for a reference

```yaml
actions:
  assignToAgent:
    on: SupportCase
    set: { assignee: }                 # asked for: a choice among the users the field may hold
```

- Today `ME()` is "the one reference an action sets", and `set: { assignee: }` is refused
  ("cannot be set, it is a reference"). An asked reference is the form's own control for the
  field (the combobox for a record, the people chooser for a user, narrowed to the role the
  field's rules allow), so the dialog needs nothing new. A literal reference in `set` stays
  refused (a record's id in a spec is nonsense); `ME()` and the asked form are the two.
- The portal: `assignToMe` with `ME()` first on the page, `assignToAgent` beside it.

## 5. A condition over related records

The last message's sender is not a field of the case. Two small additions, no new condition
grammar:

- **A computed field over the list:** `lastSender: { type: string, formula: LAST(messages.sender) }`
  with `LAST(list.field)` and `FIRST(list.field)` added to the formula library: the value of
  the newest (oldest) record in the list by its creation time, empty for an empty list. The
  aggregates already run over lists (`COUNT(lines)`, `SUM(lines.amount)`).
- **`when` on a computed field:** a computed choice-like string or yes/no field may be named
  in `when`, `locked` and `required`. The condition is read on the record as the page or the
  server loads it (computed fields are worked out there, never in the query), so it costs
  nothing new; it is only not a filter or a sort, as computed fields are not today.

```yaml
  markClosed:
    on: SupportCase
    when: { status: [open, inProgress, reopened], lastSender: agent }
    set: { status: closed }
```

- Validation: a `when` naming a computed field whose formula reads a list warns when the list
  is large in sample data (a thousand messages per case is not a case); nothing refuses it.

## 6. A person as a filter

```yaml
pages:
  cases:
    crud: SupportCase
    filters: [status, priority, assignee]
```

- A field that refers to `User` becomes a filter of three kinds of chip: **Mine** (the viewer),
  **Unassigned** (empty), and the people by name when the role the field may hold has eight
  or fewer users, else a chooser. The address carries `?assignee=me`, `=none` or an id, so a
  filtered view can be linked, as for every filter. `owner` keeps its Mine toggle; a model
  with both offers both.
- The spec reference's line "people who sign in are not filters" becomes this.

## 7. Where each part lives

| Part | New or reused |
|---|---|
| `by`, `locked`, `required` conditions on a field; `when` on computed fields; `LAST`/`FIRST` | core: the field's long form (`readLongField`), the condition reader (`condition.ts`) given computed fields, the formula library, validation, the schema, the spec reference, `setFieldRules <model> <field> --locked … --once --required … --by app` (an operation of its own: changeField's type is positional and drives its destructive check, and rules change no data) |
| An asked reference in `set` | core: the action reader lifts the refusal for an asked reference; the adapter's action dialog uses the field's own control |
| The form: hidden, read-only, conditionally required fields; the server's refusals | the kit's `ModelForm` and the generated server functions, one check in each |
| A person as a filter | core: `filters` validation; the adapter's filter row and query (`me`, `none`, an id) |
| Studio | What it does shows a field's `by`, `locked` and `required` as sentences; the Builder's field panel offers them |
| First builds | the prompt's field line names `by: app` for "who did it" fields and `locked` for set-once ones; nothing else |

## 8. ARCHITECTURE §2.4

1. **Common:** every app with a status has fields that must not change after it, fields that
   become required with it, and an action that picks a person; every record that notes who
   made it needs §1.
2. **Deterministic:** a condition, a default, a formula; no model.
3. **Less AI and ambiguity:** without them, every such app needs custom hooks that refuse edits
   and a form that hides fields by hand; Johan's own build stopped at exactly these.
4. **Technology-neutral:** keys on a field, the condition grammar the actions have.
5. **Better than free text and custom code:** the form, the dialog and the server must agree
   on what is locked, required and asked; only the engine can keep them so.

## 9. Steps (A; one pull request each; core diffs to Fable)

1. `by: app`, `locked` and `required` as conditions in core, validation, the schema, the spec
   reference, `setFieldRules`; the kit's form and the server checks; a test-apps flow
   on a starter (a locked field refused, a conditional requirement asked in an action's dialog).
2. The asked reference in `set` (§4) and the dialog's control.
3. `LAST`/`FIRST` and `when` on computed fields (§5).
4. A person as a filter (§6).
5. Studio's sentences and the Builder's field panel; the first-build prompt line.

## 10. Out of scope, for now

- **A condition that compares two fields** (`dueOn` before `issuedOn`) or reads a number
  (`priority >= 4`): the condition grammar stays values of choice and yes/no fields, with
  computed fields as the way to anything else. A richer grammar comes when three apps need it.
- **Who may change a locked field:** a lock holds for everyone, administrators included; the
  action is the way through. A per-role lock is a later line in the auth file, if asked.
