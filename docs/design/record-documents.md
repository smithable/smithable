# Record documents: a mail that carries the amount, a link the client can open, and a printable record

Design, 2026-11-18. Decided: a document is declared once on the record's page and used by Print,
by the link in a mail and later by a PDF; the link lives 60 days unless the mail says otherwise;
a PDF made on the server comes later; the link shows a copy fixed at sending.

## 1 What the user gets

In the invoicing starter:

- **Send invoice** on a draft invoice. A confirmation names who it goes to ("Send invoice 2026-014
  to anna@example.com?"). The client gets a mail with the number, the total, the due date and a
  link.
- **The link** opens the invoice itself, as a clean page, without an account: the business's
  details, the client, the lines, the totals. A "Print or save as PDF" button is on it.
- **The same page for the owner**: "Print" on an invoice in the app opens the same document.
- **Mark as sent** stays as a second action, for an invoice sent another way.

Nothing here is special to invoices. A quote, an order confirmation, a receipt and a work order
are the same three things: a mail with worked-out values, a record shown as a document, and a
link to that document for one person outside.

## 2 How it works today (read from main, 2026-11-18)

- The starter: `total: { type: money, formula: SUM(lines.amount) }`; the action `markSent` sets
  `status: sent`; `outgoing.invoiceSent` fires on it, to `client.email`. Its text has no
  placeholders: the mail says "the amount is on it" and carries no amount and no invoice.
- A mail's text takes `{field}`, `{ref}`, `{ref.field}`, `{title}`, `{link}`, `{by}`. A worked-out
  field and a list are refused, in the text and in `show` (`outgoing-templates.md`: formulas are
  computed when a record is read, the mail is written in the change's own transaction; "a later
  step may add them with the record page's formatter").
- `{link}` is the record page's address: it needs an account with the right to read the record.
- One thing reaches a person without an account: `{pay}` (payments.md §4.1), a page showing the
  description, the amount and a Pay button, "nothing else of the record", by a random token
  stored as a hash, bound to the entry and the record, ended after 60 days, behind the limiter.
- `public:` in the auth file opens a whole model (with a `where`), never one record to one person.
- There is no print view. `confirm` on an action is in the grammar as "later", not built.

## 3 Worked-out values in a mail

- A mail's text and `show` may name a worked-out field of the record (`{total}`), not of a
  record one hop away, and not a list.
- The value is computed once, when the mail is written, inside the action's transaction and on
  its connection, after the action's own writes: the kit loads the lists the named formulas read
  (`lines` for `SUM(lines.amount)`) through that transaction and evaluates them there. The
  status, the mail's fixed text, the sent document (section 5) and the outbox row are committed
  together or not at all.
- It is written as the record page writes it: money with the app's currency, a date in the
  app's format. One formatter, the kit's, used by both.
- A named worked-out value that has no value (a formula that fails) **refuses the action**: the
  person sees which value is missing, nothing is changed and nothing is sent. A mail never goes
  out with a hole where an amount should be.
- Validation keeps refusing files, lists, sensitive kinds and two hops, as today.

## 4 A record as a document

### 4.1 The spec

A crud page may say that its record has a document. Every block names its fields; nothing is
taken over from another page's columns or a model's title.

```yaml
pages:
  invoices:
    pattern: crud
    model: Invoice
    document:
      from: [businessName, address, vatNumber, iban]      # fields of the settings model
      to: { ref: client, show: [name, address, vatNumber] }
      show: [number, issued, due]
      lines: { list: lines, show: [description, quantity, unitPrice, amount] }
      totals: [total]
      note: paymentTerms
```

- `show` and `totals` name fields of the record (worked-out ones allowed); `to` names one
  reference and fields of its model; `lines` names one list field and fields of the listed
  model; `note` one text field; `from` fields of the app's settings model (the spec has one
  `settings` page naming a model; without one, `from` is refused and the app's name is printed).
- Every named field, in every block, is checked alike: no files, pictures or sensitive kinds,
  and a worked-out field's inputs are checked too. **The document holds exactly the named
  fields.** A column added to the lines' own table later does not appear here.
- Missing values, the same for printing and for sending: a worked-out field anywhere in the
  document that has no value refuses; an empty optional stored field is left out cleanly; a
  `from` whose settings record does not exist yet refuses the send with "Fill in your business
  details first" and a link to the settings page.
- A model has at most one document (a second page with `document` for the same model is
  refused), so `{view}` always means one thing.
- The words (the document's title "Invoice", the blocks' headings, the button) are in the
  content file. The summary says it: "An invoice can be printed as a document: …".

### 4.2 The page for people of the app

- `/<page>/<id>/document`: a plain page in the app's theme with a print style sheet (A4 and
  Letter, no navigation, page breaks between table rows only) and a "Print or save as PDF" button
  that calls the browser's own print. No new dependency in generated apps.
- It is read as that person: the record by its read rule, and the client, the lines and the
  settings record by theirs. A block the person may not read is refused, not left out silently.
- Whose `from`: where records are private, the settings record of the document record's owner
  (a record with no owner, such as a seeded sample, takes the reading or sending person's own,
  never another member's); where shared, the app's.
- The record page gets a "Print" button, and a list "Sent" of the copies sent (section 5).

### 4.3 The five questions (ARCHITECTURE §2.4)

1. Common: invoices, quotes, orders, receipts, work orders, certificates. Yes.
2. Deterministic: named fields on a fixed layout. Yes.
3. Less ambiguity: "make the invoice printable" has one answer instead of a custom page. Yes.
4. Technology-neutral: fields, a reference, a list; nothing of the adapter. Yes.
5. Better than free text plus custom code: a custom page cannot be opened by the link in
   section 5 without access code written by hand, which is the code that should not be. Yes.

## 5 The link for one person outside: a copy of what was sent

`{view}` in a mail's text, allowed only on a model that has a document.

**A sent copy, not the live record.** When the mail is written, the document's named values are
read (in the action's transaction, as section 3) and stored as a **sent document**: the values
as text, the recipient, the time, who sent it. The link opens that copy. So:

- what the client sees is what was sent, whatever is changed afterwards in the invoice, its
  lines, the client's address or the business's details; no rule has to freeze them;
- the page behind the link reads one row and nothing else: no live record, no other model, no
  question of whose rights apply when nobody is signed in;
- people of the app see the same copies under "Sent" on the record: a copy opens, and "Withdraw
  links" shows, only for someone who may open the record's document page (4.2), since a copy
  holds the client's and the business's details.

**Who may send it.** The copy is read with the rights of the person running the action. If they
may not read a named field (the client's model, the settings), the action is refused. Validation
warns when a role that may run the action lacks a read right the document needs. No new right is
added; the summary says beside the action: "Send invoice mails the client a link to a copy of
the invoice."

**The link.**

- One route, `/d/<token>`, and the token is all it takes: the copy is found from the token's
  row alone, never from an id in the address.
- The token is random (256 bits) and kept as a hash in its row. The whole address necessarily
  stands in the queued mail's text, for delivery. Wherever the app shows a queued or sent mail
  (the outbox), the address is shown whole only to a person who may open that record's document
  page (4.2) and masked (`/d/…`) to everyone else; the kit's request log writes it masked too.
- It ends after 60 days unsaid (`outgoing.<name>.viewDays`, 1 to 365), counted from the send; a
  retry of the same mail's delivery uses the same link.
- It ends for good when the record goes to the trash or is removed, and when someone who may
  write the record presses "Withdraw links". Ending is stored on the link; restoring the record
  from the trash does not bring a link back. A new send makes a new copy and a new link; earlier
  ones live until their own end.
- The page: `noindex`, `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, no
  third-party request. A GET changes nothing and nothing is counted, so a mail scanner that
  opens the link does no harm. A wrong, ended or withdrawn token gets one and the same 404 page.
  The limiter is strict on wrong tokens per network, and roomy on a valid one.
- Making and withdrawing a link go to the app's audit log, with the record and the actor.
- **It never pays.** The page shows no Pay button, and a view token is refused by the pay page
  as a pay token is refused here: two kinds, two tables' worth of checks. A mail that should let
  the client pay holds `{pay}` beside `{view}` (payments.md §4.1). The links share one token
  table with a `kind` column; this page reads only kind `view`, and a pay link's row has no copy.
- A sent copy is removed with its record. Until then it stays for the owner after its link has
  ended, as the record of what was sent.

Access rules are core: this part gets the full review and the gate.

## 6 The starter

- `sendInvoice`: `on: Invoice`, `when: { status: draft }`, `set: { status: sent, sentAt: NOW() }`,
  `confirm: true`. `markSent` stays, with the intent "The invoice went to the client another
  way", and fires no mail.
- `confirm` is new and is built with this (the grammar does not have it): `confirm: true` on a
  standard action asks before running; its text is in the content file and takes `{field}`,
  `{ref}`, `{ref.field}`, `{title}` and worked-out fields of the record as it is before the
  action ("Send invoice {number} to {client.email}?"), not `{view}`, `{pay}`, `{link}` or `{by}`.
  An action whose mail has no recipient on this record (the client has no address) says so
  instead of asking.
  Unsaid text: the action's label and the record's title. It passes §2.4 as actions' `intent`
  did: common, deterministic, a word in the spec instead of custom code.
- `outgoing.invoiceSent` fires on `sendInvoice`; its text: "Invoice {number}: {total}, due
  {due}. See it here: {view}".
- The invoices page gets `document` as in 4.1.
- The starter still locks a sent invoice's own fields (`locked` by status, which exists). Its
  lines cannot be locked by the parent's status today; with sent copies that is no longer a
  hole in what the client sees, only a tidiness point for a later step.
- In a hosted app that is test-only the mail goes to the outbox, and the confirmation says so.

## 7 Later, not in this step

- A PDF made on the server and attached to the mail. It needs a PDF library in generated apps
  and a choice of one; the document page is its source, so nothing here is thrown away.
- A record's lines listed in the mail's own text.
- "Seen by the client": needs a count that mail scanners do not trigger.
- The Pay button on the copy's page; locking a list's records by their parent.
- Documents on other patterns than crud.

## 8 Order of work

| Step | What |
| - | - |
| 1 | Worked-out fields in a mail's text and `show` (section 3) |
| 2 | `document` on a crud page: core, the adapter's route and print styles, the Print button (section 4) |
| 3 | `{view}`: the sent copy, the token, `/d/<token>`, withdrawing, the audit lines, the outbox's guard (section 5); full review |
| 4 | `confirm` on an action, with step 2 |
| 5 | The starter (section 6), its pictures for the Starters page |

Steps 1, 2 and 4 are ordinary changes; step 3 is on the sensitive list. Tests, at least: a mail
holds the total as the page writes it, and not zero, for an invoice with lines; a missing value
refuses the send and changes nothing; a failure after the status change rolls everything back; a
changed invoice, line, client or business detail changes neither a queued mail nor a sent copy;
the document and the copy hold only the named fields, also after a column is added to the
lines' table; in an app with private records two members' copies carry their own business
details; a person who may not read a block cannot print or send; a token opens one copy and no
other route; an ended, withdrawn and wrong token answer alike; a pay token does not open a copy
and a view token does not pay; a trashed and restored record's links stay ended; a delivery
retry keeps its link; the request log holds no token.
