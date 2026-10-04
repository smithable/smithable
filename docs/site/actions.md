# Buttons that change a record

A standard action is a button on a record's page that moves the record on: mark an invoice sent, resolve an incident, take over a customer. It needs no code. You say which records it applies to and what it changes, and Smithable generates the button, the server function that checks who may press it, and the tests.

This page adds five actions to the invoicing starter and one to the CRM, each with the command and what it printed. Every example was run for real, and the app type-checked afterwards. Each command is one change, so `smithable undo` takes it back.

```console
$ smithable new books --starter invoicing
$ cd books
```

The starter already has two actions, **Mark sent** and **Mark paid**. You can see them in `smithable.yml`:

```yaml
actions:
  markSent:
    on: Invoice
    when: { status: draft }
    set: { status: sent }
```

## Set a field, under a condition

```console
$ smithable op addAction markOverdue --on Invoice --when status=sent --set status=overdue
Generated 100 files (5 changed, 0 removed).
Add the standard action markOverdue. Undo with: smithable undo
```

`--on` names the model, `--when` says which records the button is for, and `--set` gives the new values. The button appears on the invoice page because Invoice has one list-and-record page; on any other invoice the server refuses the action ("This cannot be done now").

![An invoice that has been sent, with the buttons Mark paid, Mark overdue, Postpone and Duplicate](actions/invoice-buttons.webp)

A value can also be a formula, worked out on the record as it was: `--set "paidOn=TODAY()"`, or `--set "dueOn=DATEADD(dueOn, 14, \"day\")"`.

## Ask for a value

A field given no value is asked for when someone presses the button:

```console
$ smithable op addAction postpone --on Invoice --when "status=sent | overdue" --set dueOn= --set status=sent
Generated 102 files (5 changed, 0 removed).
Add the standard action postpone. Undo with: smithable undo
```

`status=sent | overdue` offers it on both states. Pressing **Postpone** opens a dialog with the field's own control, starting at the record's value:

![The Postpone dialog, asking for the new due date](actions/postpone-dialog.webp)

## Add a related record

`--add` creates a record of a model that refers to this one, in the same step:

```console
$ smithable op addAction lateFee --on Invoice --when status=overdue --add "InvoiceLine.description=Late payment fee" --add InvoiceLine.unitPrice=25
Generated 104 files (5 changed, 0 removed).
Add the standard action lateFee. Undo with: smithable undo
```

Pressing **Late fee** on an overdue invoice adds a line of 25.00, and the invoice's total follows. The line's reference to its invoice is filled in, and its quantity takes its default (1). Every required field without a default must get a value, or be left empty to be asked for. Whoever presses the button also needs the right to create invoice lines.

## Copy a record, with its lists

`--copy` makes a new record from this one instead of changing it, and `--with` copies its lists too:

```console
$ smithable op addAction duplicate --on Invoice --copy status=draft --copy "issuedOn=TODAY()" --copy number= --with lines
Generated 106 files (5 changed, 0 removed).
Add the standard action duplicate. Undo with: smithable undo
```

**Duplicate** asks for the new number (an invoice's number is unique, so it cannot be copied), then opens the copy: a draft issued today, with the same client and every line. Computed fields, pictures and the owner are never copied; the copy belongs to whoever pressed the button.

## The person pressing the button

`ME()` puts in the signed-in person, for a field that refers to a user. On the CRM starter, where every customer has an account manager:

```console
$ smithable new sales --starter crm
$ cd sales
$ smithable op addAction takeOver --on Customer --set "accountManager=ME()"
Generated 88 files (5 changed, 0 removed).
Add the standard action takeOver. Undo with: smithable undo
```

**Take over** makes whoever presses it the customer's account manager. With no `--when`, it is offered on every customer.

## What ends up in the spec

After the four invoicing commands, `smithable.yml` has:

```yaml
actions:
  markOverdue:
    on: Invoice
    when:
      status: sent
    set:
      status: overdue
  postpone:
    on: Invoice
    when:
      status: [sent, overdue]
    set:
      dueOn:
      status: sent
  lateFee:
    on: Invoice
    when:
      status: overdue
    add:
      InvoiceLine:
        description: Late payment fee
        unitPrice: 25
  duplicate:
    on: Invoice
    copy:
      status: draft
      issuedOn: TODAY()
      number:
    with: [lines]
```

and the invoice page lists them: `actions: [markSent, markPaid, markOverdue, postpone, lateFee, duplicate]`.

## Change or remove one

`setAction` changes an action there is: its intent, the records it is for, or the values it sets. Each part you name replaces what was there, and the rest stays. On the invoicing starter:

```console
$ smithable op setAction markPaid --when "status=sent | overdue"
Change the condition of the action markPaid. Undo with: smithable undo
$ smithable op setAction markSent --intent "The invoice has gone to the customer."
Change the intent of the action markSent. Undo with: smithable undo
$ smithable op removeAction markSent
Remove the action markSent. Undo with: smithable undo
```

A bare `--when` removes the condition, so the button is offered on every record; `--intent ""` removes the intent. `removeAction` takes the action off the pages that list it and out of what an API offers by name. For anything else (another model, what it adds or copies), remove the action and add it again.

## Who may press them

An action follows its model's write access: whoever may edit the record may run it. `--allow admin` (or any roles) narrows that, and never widens it. On a list, ticking several rows offers each action that fits at least one of them, as **Postpone (3)**; it changes the ones it fits and skips the others.

When a button needs more than setting fields (sending a mail, calling another system, a calculation over many records), a [custom action](../spec/v0.1.md#actions) is code of your own in `src/custom/actions/`. The [spec reference](../spec/v0.1.md#standard-actions) has every rule of standard actions.
