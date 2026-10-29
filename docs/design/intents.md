# Named intents: merge, split, aggregate; contracts for the rest (design)

Status: draft for Johan, 2026-10-29 (Fable), on his go of the same morning for backlog item Fable 76; §3 made per field at Johan's word the same morning (the kept record from a dropdown of the two, a rule per field, the spec deciding fields so the form asks only the rest) ("merging, splitting and perhaps aggregations should be possible at least"). A second reviewer's points taken the same morning (undo under later edits, reference collisions, access on the moved records, the delete grant, totals over all rows, `touches` as a fence, examples with a role and a clock). The question behind it (2026-10-27): custom code, such as the CRM starter's merge-customers action, cannot be shown well in Studio; should the AI close the gap with the result specified better, or should there be a graph of boxes and lines?

## 1. The answer in one paragraph

Name the what, not the how. A thing many apps need (merging two records, splitting one, totals) becomes a word in the spec, judged by the five questions of ARCHITECTURE §2.4: Studio shows it as a form and a sentence in What it does, the engine generates and tests it, undo holds, and no model is needed. The long tail stays a custom action, but with its contract in the spec: what it takes and gives (exist), what it touches, and examples (given these records and this input, then these records and this output) that become tests. Smith writes the code against the contract with a capable model; Studio shows the contract and the examples, and the code stays in the project for anyone who reads code. No graph editor for logic: it exposes the how, breaks on phones and in Smith's chat, and in our experience such graphs end up as code. A picture of what a custom action touches is derived from the contract, in the data map's style, as a view.

## 2. What exists

- **Standard actions** set fields of one record (`resolve: { on: Incident, set: { status: resolved } }`); **custom actions** declare `input`, `output`, `intent` and `rules`, and their code is written once under `src/custom/actions/`; one input may be the rows picked in a list.
- **Aggregates** exist in three places: formulas over related records on a computed field (`SUM(lines.amount)`, `COUNT(orders)`, `COUNTIF`, `AVG`, `MIN`, `MAX`, `FIRST`, `LAST`), dashboard tiles (`count`, `sum`, `average`, with `where` and `by` a date field for the last six months), and Ask's measures. "How many orders a customer has and the total amount" (the ten-changes benchmark's request 7) is two computed fields today; the builder's miss there was the model's, not the spec's.
- **The trash** keeps a deleted record thirty days with what went with it (delete-together.md); Restore brings it back, refusing when a unique value has been taken since.

## 3. Merge

```yaml
actions:
  mergeCustomers:
    merge: Customer                  # two or more customers become one; the person picks which stays
    fields:                          # what each field does; a field not named is asked when the records differ
      email: ask                     # the person picks one of the values in the form
      segment: keep                  # the kept record's value (the other's when the kept is empty)
      revenue: add                   # numbers and amounts: the sum
      notes: append                  # texts: the kept's, a blank line, the other's
```

- **What happens.** A merge takes two or more records of the model, one of which stays (Johan, 2026-10-29: the person picks it; no rule picks by age). The records have an order: the order they were picked in a list, the order of the ids given to the API or Ask; "first" and "last" below are that order, the kept record first. Every reference to the other records, in every model (`order.customer`, `note.customer`, a list's items), moves to the kept record, in one transaction. The kept record's owner stays. Each field follows its rule: `keep` (the kept record's value; where it is empty, which is no value or an empty text, the first other's that is not; `false` and `0` are values), `other` (the first other's value that is not empty; the kept's when they all are), `add` (numbers and amounts: the sum), `append` (text and markdown: the kept's, then each other's, a blank line between), `ask` (the person picked in the form, see Where). A field not named in `fields` is `ask`; computed fields are worked out, sequences and `by: app` fields stay the kept record's, and references between models are not fields here: they move. Each other record goes to the trash, marked "merged into <title>", and its unique values are released as a trashed record's are. The moved records are moved, not changed: no `changed` event, no outgoing mail or call fires for them, since a move is not a thing to tell anyone about and could not be undone if it were. Formulas over related records (`COUNT(orders)`) follow by themselves, since they read the references.
- **Where moving is not mechanical, a rule.** A unique reference or a one-to-one (`account.customer unique`): when more than one of the records has one, the merge is refused with the field named ("Arctic Outdoor Co and Arctic Outdoor both have an account; keep one first"). A join record with a unique pair (customer and tag) that the kept record already has, or that an earlier other already brought: the later one's goes to the trash with it, not moved. A list that would hold the kept record twice holds it once. A reference between any two of the picked records is cleared, never a self-reference. Records that go to the trash together with a record (delete-together) are references too: they move to the kept record and do not go to the trash.
- **Undo.** The merge is one checkpoint in the app's history and one trash entry, the same thing: the entry keeps which references moved and which fields were filled. Restore puts back what is still as the merge left it: a moved reference that still points at the kept record moves back, a filled field that still holds the filled value is cleared; anything edited since stays and is reported ("2 orders were changed since and stay with Arctic Outdoor Co"). A unique value taken since refuses the restore, as any restore. After the thirty days the entry goes and the merge stands.
- **Where.** In a list's selection bar when two or more records are picked ("Merge"), and on a record's page ("Merge into…", picking the others). The form has a dropdown of the picked records for which stays (the first picked preselected), then only the fields that are `ask` and whose values differ among the records (an empty one is no difference: it is left out of the pick, and where only one record has a value it is taken), each with the values to pick from and, for a number or amount, the sum, for a text the join; fields the spec decides do not show. Below it, the sentence counting only what the viewer may see: "Arctic Outdoor Co keeps its values; 3 orders and 5 notes move to it, and Arctic Outdoor and Arctic Outdoors go to the trash." Through the API and Ask's `run` too: run on the record that stays, with `others` (one id or more) and `choices` (per differing `ask` field, `keep` or the id of the record whose value is taken; one missing is asked back); the sample users merge two or more records they may write.
- **Into a new record** (`into: new`; the default is `into: chosen`, the above). Johan, 2026-10-29: "a new resource is created as an aggregation of the selected; the selected are untouched." A new record of the model is made from the picked ones, which stay as they are: the field rules give its values as for a merge with the first picked in the kept record's place (`keep`: the first picked's, filled from the others where empty; `other`: the first other's that is not empty; `add`: the sum; `append`: all the texts joined; `ask`: the person picks in the form, by the record's id), sequences and `by: app` fields are new, computed fields over related records start empty (the new record has no orders), nothing moves and nothing goes to the trash. A unique field is the exception: its value stays with the source that holds it, so the new record's is left empty and the form says so ("email stays empty: Arctic Outdoor Co keeps arctic@example.com"), unless the removal below is taken, which frees it; a required unique field without a sequence makes the combine depend on the removal, and the form says that too. No link back to the sources (Johan): the checkpoint names them, and a notice at the time says "Combined Arctic Outdoor Co, Arctic Outdoor and Arctic Outdoors into a new customer; they stay as they were." One offer in the form: when the picked records agree on every field that is not summed or joined (an empty value agrees) and nothing outside refers to them, they are the same record apart from the sums, and the form offers to remove them ("the 3 lines are the same apart from quantity: remove them", shown only to a viewer who may delete them, preselected; order lines of one product with their quantities added are the case; nothing of theirs is lost, since every value of theirs is on the new record); taken, they go to the trash in the same checkpoint and the notice says so. Where they differ or something refers to them, they stay and the form says so. The new record belongs to whoever ran it, as a record they add. Undo: one checkpoint in the app's history, not the trash; undoing deletes the new record and restores the removed. Access: the action's grant and create on the model, read on the picked, delete on them for the removal offer. Offered in the selection bar only: a record's page has no "into a new one". Words: "Combine" in the selection bar, landing on the new record; summary line "Customers can be combined." The API and Ask run it on the model, not a record, with `ids` (two or more, in order), `choices` (per differing `ask` field, the id of the record whose value is taken) and `remove: true` for the offer, and answer the new record.
- **Access.** The role needs the action's grant (`actions: [mergeCustomers]`), write on the kept record and write on every record that moves. The delete grant on the other records decides their fate, not whether the merge may run (Johan, 2026-10-29): with it they go to the trash; without it they stay, emptied of what moved, and the form says so before the merge ("Arctic Outdoor and Arctic Outdoors stay, since you may not delete customers"); where a moved record is outside the viewer's rules the merge is refused naming the model ("orders you may not change refer to it"). Users (sign-in identities) cannot be merged. A model nothing refers to can still be merged: duplicates exist there too.
- **Words.** What it does: "Merge customers: the others' orders and notes move to the kept one, which keeps its values; the others go to the trash." With `into: new`: "Combine customers into a new one: its values come from the picked ones, which stay." Summary line: "Customers can be merged."
- **Operation.** `addAction mergeCustomers --merge Customer [--into chosen|new] [--fields email=ask revenue=add …]`; `removeAction`. Builder's form "An action" gets "Merge records of…". (`keep: chosen | oldest | newest` was designed and built first and dropped on Johan's word, 2026-10-29: the person picks, or a new record is made.)
- **§2.4.** Common (every CRM, inventory, contacts, members); deterministic (reference moving is mechanical with the rules above, the kept record is the person's choice); it removes a whole class of custom code and the model's guesswork about which fields to keep; technology-neutral; materially better than code, since the trash, undo and the access rules come with it. Finding the duplicates is not part of it: that is an Ask question or a query, later.

## 4. Split

```yaml
actions:
  splitOrder:
    split: Order                     # one order becomes two
    move: lines                      # the list field whose picked records go to the new order
    copy: [customer, deliverTo]      # fields the new record takes from the old (default: every stored field but the unique, the sequence and the lists)
```

- **What happens.** A new record of the model is made with the copied fields (sequences and `by: app` defaults run as for a new record, so an order number is new), the picked children of `move` go to it, the other lists stay on the original, and formulas follow. Nothing is deleted. One transaction.
- **Undo.** One checkpoint: the children that are still on the new record move back, then the new record goes to the trash. The order number it took stays taken.
- **Where.** On a record's page ("Split…"): the children the viewer may see listed with a checkbox each, at least one picked and at least one of them left. Not in a list's selection bar. Through the API and Ask's `run` too, with `move`, the ids of the list's records that go to the new record; the sample users split a record with two or more in the list.
- **Access.** Create on the model, write on the picked children, the action's grant.
- **Words.** "Split an order: the picked lines go to a new order with the same customer; the order number is new."
- **Operation.** `addAction splitOrder --split Order --move lines [--copy a,b,c]`.
- **§2.4.** Common enough (orders and invoices with lines, group bookings, tickets with tasks, shipments) though less than merge; deterministic; neutral; better than code since the new record goes through the model's rules. Second, after merge.

## 5. Aggregations

What the ten-changes request asked for exists. Three small gaps stay, each a word, each a §2.4 pass:

- **Totals on a list** (`smithable.ux.yml`: `lists: { Order: { totals: [total, quantity] } }`): a last row with the sum of each named number or amount field, and the count, over every record the viewer may see that fits the filters and the search, worked out by the server (not the page shown). An amount field has one currency, the app's, so sums are plain.
- **`by` a choice, or a reference's choice** on a dashboard tile (`byStatus: { count: Order, by: status }`, `bySegment: { sum: Order.total, by: customer.segment }`): today `by` is a date field (the last six months as bars). A choice gives one bar per value; `customer.segment` is one hop to a choice field of the referred model. `by: customer` (a reference itself, unbounded) is refused. A tile grouped by a field the viewer may not read is not shown, as a tile over a model they may not read is not.
- **A period for `by` a date** (`by: issuedOn, period: week | month | quarter | year`): eight weeks (starting Monday), six months as today, four quarters, three years, in the app's time zone (`app.timezone`).

Running totals, ranks and cohorts stay queries (code), as do aggregates with a condition a filter cannot say.

## 6. Contracts for custom code

A custom action's contract gains three keys, all optional, all read by the engine:

```yaml
actions:
  reconcilePayments:
    custom: true
    input: { statement: file! }
    output: { matched: int!, unmatched: int! }
    intent: Match a bank statement's lines to open invoices.
    touches: { reads: [Invoice, Payment], writes: [Payment, Invoice.status] }
    triggers: [paymentBooked]        # outgoing entries the code may fire
    examples:
      - as: accountant
        now: 2026-01-15
        given: { Invoice: [{ id: 1, number: "INV-1", total: 120, status: sent }] }
        input: { statement: samples/statements/one-line.csv }
        after: { Invoice: [{ id: 1, status: paid }], Payment: [{ invoice: 1, amount: 120 }] }
        nothingElse: true
        output: { matched: 1, unmatched: 0 }
```

- **`touches`** names the models (or `Model.field`) the code reads and writes; **`triggers`** the outgoing entries it may fire. The generated server function hands the code data functions for those models only, so honest code that reaches further fails type checking; it is a fence, not a wall (code can import anything), and the words say so: Studio shows "reads invoices and payments, writes payments and an invoice's status, may send paymentBooked", and the data map draws exactly that (§7).
- **`examples`** are tests the generator writes (`src/generated/actions/reconcile-payments.test.ts`): the given records are seeded into an empty database (a field the example leaves out takes the sample data's value for its kind, so required fields need not be spelled out; the ids are the example's own and are mapped), the clock is `now` (today's date when left out, so an example that depends on time says so), the action runs as a person of the role `as` (the first admin when left out; a refusal expected is `output: refused`), and the records and the output must match what `after` and `output` say: fields not named are not checked, records not named are not checked unless `nothingElse: true`, which fails on any other record created, changed or deleted. A file input names a file under `samples/`. They are the "specified better" part: they hold the model to the result, a changed example is an undoable spec change, and `smithable code action:reconcilePayments` has the model write the code until the examples and the app's other tests pass. Two or three examples invite special-casing; the intent and rules stay the words the code must honour, and the code is in the project for review. Studio shows the examples as a table (given, input, after), not the code.
- **Undo** for a custom action is what it is today: its writes through the data functions are recorded as changes, but the action as a whole is not one checkpoint. The contract lets Studio say so ("writes payments; not undoable as one").
- The three keys apply to custom queries and custom incoming calls the same way (`triggers` to incoming calls' code).

## 7. The picture, derived

Studio draws a custom action from its contract in the data map's style (A 164/165): the input on the left, the models it reads and writes as boxes, the outgoing entries in `triggers`, lines between them; a view, not an editor. Nothing is drawn that the contract does not say, so an action without `touches` is a box with its intent.

## 8. Steps

1. **Merge (Fable core, A kit):** the `merge` action kind in core (parse, validation, the rules of §3, words, `addAction --merge`, the summary), the adapter's server function in one transaction with the trash entry, the moved references and the filled fields, Restore with the still-as-left rule, the selection bar and the record page's form (A), tests on the CRM starter (two customers with orders and notes). The CRM starter's custom merge-customers action becomes `merge: Customer` in the same step, and its custom file goes.
2. **Split (Fable core, A kit):** the `split` kind, the record page's picker.
3. **Aggregations (Fable core, A kit):** `totals` in the ux file, `by` a choice or a reference's choice, `period`.
4. **Contracts (Fable core, A adapter):** `touches`, `triggers` and `examples` on custom actions, the generated test, the narrowed data functions; then on queries and incoming calls. `examples` are ordinary tests of the app (§6): they run in every test run, so at the first build and after every change, to an example or to the code, by Smith or by hand (Johan, 2026-10-29). The key for the records after is `after`, not `then`: an object with a `then` property is a thenable to `await`.
5. **The picture (A, Studio):** the derived view.
6. **Merging several, and into a new record (Fable core, A kit):** `keep` goes; the merge takes two or more records, the person picks which stays; `into: new` with its form offer and notice; `others` in the API and Ask.
7. **From code to a kind (Fable core, A Studio):** §10, once examples exist.

Each step is its own pull request; the spec reference, the operations and the schema change with it.

## 9. Undecided

Settled 2026-10-29 (Johan): `keep: oldest` and `newest` go; the person picks which stays, a merge takes two or more records, and `into: new` makes a new record from the picked ones, untouched, with no link back and a notice at the time (step 6). `examples` are ordinary tests of the app, run in every test run (step 4). Nothing is open.

## 10. From code to a kind

Smith's handling of a request is the same in chat and in Studio's forms: a standard kind when one fits (a merge, a split, a set of fields), a custom action only when none does; in code mode the person chooses. The other way, an existing custom action becoming a kind, is not read from its code: what code does is not decidable in general, and a guess that is wrong corrupts data. It is decided by the examples (§6), which say what the code must do: when a custom action has examples, the engine tries each kind whose shape the input fits (a merge: two or more inputs of one model, or one and a list of it, the first the kept record; a split: a record and a list of its children; a set of fields: one record), with the kind's parameters read off the examples (a merge's rule per field, the one of keep, other, add and append that gives every example's value; a set's values), on every example's given records. It matches when every example's `after` holds and every refusal example (`output: refused`) is refused by the kind too; the custom `output` is not matched, since a kind answers its record and the output's only reader was the code. At least two examples, and among them one where the records differ in a field, else the rules are not determined and nothing is offered. Then Studio offers "this does what a merge of customers does; make it one", an undoable spec change like any other: the custom action becomes the kind, its code file goes to the project's history. The CRM's merge-customers was the case in point, converted by hand in step 1.
