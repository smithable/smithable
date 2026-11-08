# Payments: a record paid on the provider's page, recorded by its word (design)

Status: proposed 2026-11-08, Fable, on Johan's questions the same night: "Can you design payments?
Should the builder be able to pick among different providers? How can we test this, do I need to
register a provider for smithable and we try to use that for our own payments later and now only
for testing?" Payments were his "maybe payments", the first complete business capability left
before the product is there. Nothing in the engine changes with this note alone; it adds one
spec section, so merging it is the go-ahead for step 1 of §9, and each later step is confirmed
when its turn comes. §10 lists what Johan decides. Facts not yet confirmed say "to check".

## 1. Today

- `money` is a field type, stored in hundredths of the app's currency, and formulas work on it:
  the kiosk starter's `Order.total` is `SUM(lines.amount)`. The currency is the app's,
  `app.currency` in `smithable.yml` (an ISO 4217 code), one per app.
- A standard action can add a related record by hand ([actions.md](actions.md) §3,
  `recordPayment` adds a `Payment` with an asked amount), and `markPaid` sets a status. Both are
  a person saying money came, not money coming.
- An incoming call with `custom: true` can take a payment provider's call
  ([integrations.md §3](integrations.md); `paymentReceived` is its example), but what it does is
  the maker's code, and so is asking the provider for a payment page.
- [orders.md §6](orders.md) sketched a `pay: true` on the order page with a `paid` field and a
  `paymentRef` on the order; [booking.md §5](booking.md) left "payment for a place" out and
  [appointments.md §6](appointments.md) left payment, deposits and no-show fees for later.
  This note replaces the order page's sketch with one section for every model.
- `smithable validate` warns on a field that looks like card data (`card-data`: "take payments
  through a payment provider and keep only its reference").

So nothing in a generated app takes a card today.

## 2. The principle

- **The app never touches card data.** The payer pays on the provider's own hosted page: the app
  sends them there and they come back. Card numbers, codes and the payer's bank sign-in never
  pass through the app, its database, its logs or Smithable. This keeps the app outside the
  scope of the card industry's security standard beyond the lightest self-assessment a merchant
  with a hosted page fills in (the exact form to check, per provider).
- **The provider's word is the truth.** The provider tells the app by a signed call that a
  payment succeeded; the app records it. The return to the app's page after paying shows what
  the provider has said, never decides it.
- **The owner is the merchant.** The account at the provider is the app owner's: their money,
  their payouts, their terms with the provider, their payment methods. Smithable moves no money
  and takes no share: neither the engine nor the hosted service sees a card, a payout or the
  provider's charges.
- **What is paid for is functionality; who processes it is implementation** (rule 1). The spec
  says what is paid, how much, when and what a payment does; `smithable.context.yml`, the only
  file that may name a technology, names the provider. One interface in the kit, several
  providers behind it.
- **Rule 4 holds.** No Smithable package in the app: the provider modules are kit files talking
  plain HTTPS (§5).

## 3. The spec

### 3.1 The section

A `payments` section in `smithable.yml`, one entry per thing paid for.

```yaml
payments:
  orderPayment:
    on: Order                          # the model whose record is paid for
    amount: total                      # a money field of the record, stored or a formula
    when: created                      # pay to create; or a condition, as an action's when
    paid: { set: { paid: true } }      # what a successful payment does to the record (the kiosk would add paid: bool)
    refund: { by: [admin], when: { status: declined } }   # optional: who may refund, and when
    description: "Order {number}"      # what the payer sees on the provider's page
```

```yaml
payments:
  invoicePayment:
    on: Invoice
    amount: total
    when: { status: [sent, overdue] }  # Pay is offered on records that fit
    paid: { set: { status: paid } }
    description: "Invoice {number}"
```

- **`on`** names a model; one entry per model at first (a second entry on the same model is
  refused; deposits and balances are later, §9).
- **`amount`** names a money field of `on`, stored or computed. It is read on the server when
  the payment is started, never taken from the browser.
- **`when`** says when payment is asked (§3.2): `created`, or a condition in the actions' `when`
  grammar.
- **`paid.set`** gives fields of the record their values when the payment succeeds, with the
  values `set` takes in a standard action (literals and formulas; nothing asked, since nobody is
  there to answer). It runs as the app, like a timer's action, so it needs no role's write right.
  It may be left out: the Payment line (§3.3) is always added.
- **`refund`**, optional, names the roles that may refund (admins always may when it is there)
  and, optionally, a condition on the record. Without it the app offers no refund; the owner
  refunds in the provider's own dashboard, and the app learns of it (§4.4).
- **`description`** is a text with the `{path}` placeholders outgoing mail has (a field of the
  record, one reference away), shown on the provider's page and in the provider's receipt. Its
  default is the record's title. Nothing sensitive and no list may be named, as for mail.

### 3.2 `when: created` and `when` as a condition

**`when: created`** is "pay to create": a booking's place, a kiosk order. The record is written
when the form or the order page or the reservation block is sent, but it is *held*: it awaits
payment, and the rest of the app treats it as not there yet.

- A held record counts where counting protects something (a booking's capacity, a sequence's
  number), so a place is not sold twice while someone is on the provider's page. A held record
  is shown nowhere else: not in lists, tiles, calendars, counts or searches, and not to the API.
- Its `created` events wait: an outgoing `Booking created` entry fires when it is paid, not when
  it was held, so the kitchen's mail and banner come for paid orders only. Timers at its dates
  start then too.
- If no successful payment has come after the hold time (a setting, `PAYMENTS_HOLD_MINUTES`,
  default 30), the kit's own timer releases it: the provider's checkout is closed where the
  provider allows it (§4.5), and the record is removed for good, its capacity freed. A sequence
  number it took is skipped, as for any refused create.
- The held state is the kit's (a column the generator adds to `on`'s table), not a field of the
  spec, so no one sets it by hand.

**`when` as a condition** is "pay for an existing record": an invoice once it is sent. Pay is
offered on every record that fits and is not paid, to the people who may read it (§4.1), and the
condition is checked again on the server when the payment starts and when it is recorded.

Fable's outline had `when` name a standard action ("payment is asked when `send` has run"). A
condition says the same with nothing stored: the action's `set` makes the record fit
(`markSent` sets `status: sent`), the button disappears when `paid.set` moves the record on, and
a record changed by hand behaves as its values say. One way to write it, the one actions and
timers already read.

### 3.3 The Payment record

An app with a `payments` section has a built-in model, `Payment`, generated like the audit log
is: in the generated schema, written only by the kit, never edited by hand. Its fields:

| Field | What it holds |
|---|---|
| `entry` | the payments entry's name (`orderPayment`) |
| `record` | the paid record's id (of `on`'s model) |
| `amount` | money, as asked of the provider |
| `currency` | the app's currency when it was asked |
| `status` | `pending`, `paid`, `failed`, `refunded` |
| `provider` | the provider's name from the context file (`stripe`, `mollie`, `fake`) |
| `reference` | the provider's own id for the payment |
| `note` | what went wrong, in the app's words (declined, amount differs, paid twice, refund refused) |
| `createdAt`, `paidAt`, `refundedAt` | when |

- It is in the IR as a model so pages, access, outgoing entries and the app card can refer to
  it; a spec that has its own model named `Payment` and a `payments` section is refused, naming
  another name for the maker's (`ManualPayment`).
- **Who sees it:** the record page of `on` lists its Payments to whoever may read the record
  (amount, status, when; the provider's reference to admins and refund roles only). A Payments
  page lists them all, newest first, filtered by status, for admins and the roles `refund.by`
  names. No one else reads them, and the API does not offer them in the first version.
- **No owner.** Payments are the app's, as an incoming call's record is.
- Each change of a Payment's status has an audit line, as an action has.

### 3.4 Words and currency

- `smithable.content.yml` holds the words under `payments: { orderPayment: … }`: the pay
  button's label (the default "Pay {amount}"), the waiting page ("Waiting for the payment to be
  confirmed"), the paid page and the cancelled page. The kit's own words are in its language
  files, as for every kit part.
- The currency is `app.currency`, and a `payments` section without one is an error. One currency
  per app at first: a record is paid in the app's currency, whatever the payer's own. Money is
  stored in hundredths; a provider takes the currency's own smallest unit, which the provider
  module converts (a currency without two decimals, such as the yen, to check in step 3).

### 3.5 The context file

```yaml
# smithable.context.yml
payments: { provider: mollie }       # stripe | mollie | fake
```

- One provider per app. Without the key the app uses `fake` in development and preview, and a
  release refuses to start the payments (as it does for mail without its settings): `smithable
  deploy` names what is missing.
- The settings, never in a file of the project: `PAYMENTS_SECRET_KEY`, `PAYMENTS_WEBHOOK_SECRET`
  (for a provider that signs its calls with a secret of its own), `PAYMENTS_PUBLIC_KEY` (where
  the provider has one). Self-hosted, the environment; hosted, the project's Connections page
  ([integrations.md §6](integrations.md)).
- `CONTEXT_SCHEMA` gains the key; the context file's "only the keys above" stays true.

### 3.6 Operations, summary, validation

- **Operations:** `addPayment <name> --on <Model> --amount <field> --when created|<field=value…>
  [--paid-set field=value…] [--refund-by role,…] [--refund-when field=value…] [--description
  "…"]`, `setPayment <name> …` (each part given replaces the old; `none` removes `paid.set`,
  `refund` or the description) and `removePayment <name>`. `setPaymentProvider
  stripe|mollie|fake|none` changes the context file. A renamed field follows into `amount`,
  `when`, `paid.set` and the description; removing one the entry uses is refused until the entry
  changes. `removePayment` keeps the Payment lines there are (the table stays until the section
  is gone and the owner removes it with a migration, as for any model's data), and says so.
- **Summary:** "An order is paid when it is placed, on the payment provider's page; a paid order
  becomes paid: yes. Admins may refund a declined order." / "An invoice can be paid while it is
  sent or overdue; a paid invoice becomes paid."
- **Validation:**
  - `on` is a model; `amount` is a money field of it.
  - `when` is `created`, or a condition whose fields and values `on` has (the actions' rules).
  - `paid.set` writes stored fields `on` has, with values they take; not a computed field, a
    reference, a list or a picture.
  - `refund.by` names roles in `smithable.auth.yml`; `refund.when` is a condition on `on`.
  - `description`'s placeholders are fields the record page could show.
  - `app.currency` is set.
  - A warning when `when: created` is on a model whose records are made somewhere the pay step
    cannot follow (an incoming call, an import, the API): those records are created unheld, as
    today, and the warning says they are never asked to pay.
  - A warning when `when` is a condition and no role that may read the record could press Pay,
    and the record's model is not reached by a pay link (§4.1).

## 4. The flow in the app

### 4.1 Paying

1. **The button.** With `when: created`, the form's, order page's or reservation block's submit
   reads "Pay {amount}" and leads on to the provider. With a condition, the record page shows a
   Pay button on records that fit and are unpaid, to whoever may read them. For someone without
   an account (an invoice's customer), an outgoing mail's text may hold `{pay}`: the address of a
   page of the app that shows the description and the amount and a Pay button, nothing else of
   the record. The link carries a token bound to the entry and the record, works while the record
   fits `when` and is unpaid, and ends after 60 days.
2. **The server function.** It reads the record (as the viewer, or with the link's token), checks
   `when` and that nothing is pending or paid for it, reads the amount, and in one transaction
   writes the held record (for `created`) and a `pending` Payment. An amount of zero needs no
   payment: the record goes on as paid, without a Payment line. A negative amount is refused.
3. **The checkout.** The kit asks the provider for a checkout session: the amount and currency,
   the description, the success and cancel addresses of the app (`/payments/<payment id>/back`),
   the Payment's id as the provider's reference to it, an expiry at the hold time where the
   provider takes one, and an idempotency key made from the Payment's id, so a retried request
   does not make a second session. The Payment keeps the provider's reference. Then the browser
   goes to the provider's page.
4. **A second click.** While a Payment is pending, Pay leads to its session again if the provider
   still has it open; else that Payment is closed as failed ("left unfinished") and a new one is
   made. One pending Payment per record at a time.

### 4.2 Coming back

The page at `/payments/<id>/back` shows the Payment's state as the app knows it: "Paid" once the
provider's call has come; until then "Waiting for the payment to be confirmed", refreshing itself
for a minute and then saying the payer will hear by the provider's receipt. The return address
carries nothing that marks anything paid. Only the browser that started the payment, or a viewer
who may read the record, sees the page (a cookie set when the payment started); a visitor's page
says the order's number and the state, nothing else of the record. Cancel comes back to the same
page, which then offers Pay again (and for `when: created`, says the place is held until the hold
time).

### 4.3 The provider's call

- **The address:** `/incoming/payments-<provider>`, a route the kit generates beside the spec's
  incoming entries. The spec's entry names are camelCase, so it cannot clash with one.
- **Verified by the provider's scheme**, in the provider's module: a signature of the body with
  `PAYMENTS_WEBHOOK_SECRET` and a timestamp checked to five minutes, where the provider signs; or,
  for a provider that sends only a payment's id (Mollie's classic payment calls, to check),
  by asking the provider's API for that payment with the app's secret key: the answer, not the
  call, is what the app acts on. An unverified call is refused with 401 and logged.
- **Idempotent twice over.** The provider's event id is taken in the `incoming_seen` table first,
  as for every incoming call; and since that table keeps ids for a day while providers retry for
  longer (days, to check per provider), the Payment's status is the second guard: an event that
  would make a paid Payment paid again does nothing and answers 200.
- **What it does,** in one transaction: finds the Payment by the provider's reference (refusing
  an event for a Payment the app did not make); checks that the event's amount and currency equal
  the Payment's; marks it `paid` with `paidAt`; unholds the record (for `created`); applies
  `paid.set`; writes the audit lines; and writes the outbox rows of outgoing entries on the
  payment (below) and of the record's waiting `created` entries. Then it answers 200. A failure
  before the commit answers 500, so the provider tries again.
- **Outgoing hears it:** an outgoing entry's `when` may name the payments entry
  (`when: orderPayment`), fired when a payment of it succeeds, on the paid record, with `where`
  as for an action. So a receipt mail or a call to the kitchen is an ordinary outgoing entry. The
  outline called the event `paid`; the entry's name is how `when` already names actions and
  timers, and it keeps two entries apart.
- **A payment for a released record** (paid after the hold time, the checkout not closed in
  time): the Payment is marked paid with the note "paid after the hold ended", the record is not
  brought back, and the kit refunds it at once, recorded on the Payment (§4.4). An admin sees it
  on the Payments page.
- **Paid twice** (two sessions both completed): the second Payment is marked paid with the note
  "paid twice"; the record is unchanged, and an admin is offered Refund on it.

### 4.4 Refunds

- **In the app:** a Refund button on a paid Payment, for the roles `refund.by` names, while the
  record fits `refund.when`. It asks to be sure ("Refund 24,50 € to the payer?"), calls the
  provider's refund with an idempotency key from the Payment's id, and marks the Payment
  "refund asked". It becomes `refunded` when the provider's call says so, as payment does. A
  refusal by the provider (an old payment, a payout already spent, to check) is noted on the
  Payment and shown. Full refunds only; partial later. The button is the kit's, not an entry in
  `actions`, so it takes no action's name.
- **What a refund does to the record:** nothing by itself. The owner's own action (`decline`,
  `cancel`) says what the record becomes; a refund says what happened to the money.
- **In the provider's dashboard:** the owner may refund there too; the provider's call marks the
  Payment refunded all the same.
- **Disputes** (a payer's bank reverses a payment) are noted on the Payment when the provider's
  call says so; acting on them is the owner's, at the provider. To check per provider which
  calls carry them.

### 4.5 Failures and holds

- A declined or abandoned payment leaves the Payment `failed` (with the provider's reason in
  `note` where it gives one) and the record unpaid. With a condition, Pay is offered again.
- The hold timer runs every minute: for each held record older than the hold time, it asks the
  provider to close the checkout where the provider has such a call (to check per provider),
  marks its pending Payment `failed` ("not paid in time") and removes the record, in one
  transaction. A held record never goes to the trash: it was never there.
- The hold time should not be shorter than the provider's shortest checkout expiry, so the
  checkout closes by itself before the record is released (Stripe's shortest expiry is
  30 minutes, to check), and the late payment of §4.3 stays rare.

### 4.6 Amounts

- The amount is read from the record on the server when the payment starts and stored on the
  Payment; the provider's event must carry the same amount and currency, else the Payment is not
  marked paid, gets the note "amount differs" and an admin is shown it.
- A record whose amount changes after it is paid (a line added to an order) keeps its Payment;
  the record page shows "Paid 24,50 € of 28,00 €". Paying the difference is later; the owner
  settles it by hand today.
- While a Payment is pending, the record's amount may still change; the Payment's amount is what
  the payer was asked, and it is what is checked.

## 5. Providers, and whether the builder picks

Yes: the maker picks one provider per app in the context file, from a short list, and Studio's
settings offer it as a choice with a sentence on each. The first two:

- **Stripe:** a global provider; for European merchants its contracting entity is in Ireland
  (to check), and where payment data is processed under an app's level is to check.
- **Mollie:** an EU company, in the Netherlands.

**Which provider an app may use on the hosted service follows its level.** A Strict app takes
only EU companies' services, so it offers Mollie. A Normal app takes services served from the EU
(Mollie; Stripe if its API is served from the EU, to check). A Relaxed app and a non-EU app may
use either. A self-hosted app uses what its owner chooses.

**Payment methods** (cards, iDEAL, Klarna, Swish, Apple Pay and the rest) are the hosted page's
business: the owner turns them on in their provider account, not in the spec. The pay button
names them only as the provider module can say in general ("card or the provider's other
methods"); whether a module reads the account's methods to say more is to check in step 3.

**One interface in the kit** (`src/kit/payments/`):

- `createCheckout(payment, record)`: the session and its address.
- `verifyEvent(request)`: the verified event (payment id, provider reference, status, amount,
  currency), or a refusal.
- `refund(payment)`: asks for a refund.
- `close(payment)`: closes an open checkout, where the provider can.
- `methodsLine()`: what the pay button says beside the amount.

Each provider is one module of a few hundred lines on plain HTTPS, through the kit's guarded
call (`call.server.ts`, so the hosted egress proxy and the private-address guard apply). A
provider's own library may be used instead if it is small and documented (A decides in step 2,
as for any library). The modules are kit files: copied into the app, rewritten on each change,
readable.

**`fake`**, for development, tests and the gate: a page of the app itself
(`/payments/fake/<id>`) shows the amount and description with Approve and Decline, and posts a
signed event back to the app's own payments address, as a provider would. `test:apps`, Studio's
preview, a hosted project's staging (which reaches no outside service) and sampleusers' runs need
no network and no account. A release with `fake` refuses to start the payments, except a demo.

**The app card and the privacy page** name the provider and what it gets: the amount, the
description, and the payer's details that the provider collects on its own page (card, name,
address, mail; the provider is the payer's controller for those, to check). The privacy page
writes it from the context file and the section, so it stays true.

## 6. Testing, and Smithable's own accounts

Three layers:

1. **`fake` in every gate and preview.** `test:apps` steps on the kiosk and booking starters:
   pay, decline, cancel, a held order released after the hold, an event sent twice, an event
   with the wrong amount, a refund. Studio's check pays once in each mode.
2. **A weekly run against the providers' test modes,** on the self-hosted runner, with test keys:
   a provider changes its API without telling us. The run makes the kiosk starter, pays and
   refunds in each provider's test mode, and reads the provider's calls through a tunnel or the
   provider's own test tooling (to check per provider which needs no public address). A failure
   opens an issue, as the stack advisories' daily run does.
3. **Before a release that touches payments,** the same by hand on the kiosk and booking
   starters, in a browser.

**Accounts for the tests.** A provider's test mode needs an account, but not an activated
business (to check per provider). The test keys belong to accounts registered to the company
behind Smithable, one per provider; the same account can later be activated for the hosted
service's own billing, which is a separate decision. The keys live in the runner's secrets,
never in a repository; nothing in this repository names the accounts.

## 7. What it never does

- No card data in the app, ever; the `card-data` warning stays.
- No money through Smithable, and no share of it.
- No provider named in `smithable.yml`.
- No record marked paid on a return to the app's page; only the provider's verified word.
- No provider call acted on without its signature, or without the provider's API confirming it.
- No payment marked paid whose amount or currency differs from what was asked.
- No refund without a role named for it.
- No place held for longer than the hold time; the timer releases it.
- No Payment line edited or deleted by hand, like the audit log's.
- A demo (`DEMO_VISITORS=1`) uses `fake` only, whatever the context file says: its visitors'
  copies must never reach a real provider.

## 8. Growing the DSL: the five questions

ARCHITECTURE §2.4, for the `payments` section:

1. **Common:** nearly every business app sells or books something: an order, a place, an
   appointment, an invoice.
2. **Deterministic:** the flow, the checks and the Payment record are generated from the entry;
   no model is involved.
3. **Less AI and less ambiguity:** "customers pay when they order" becomes one entry instead of
   custom code for a checkout, a webhook route and its verification.
4. **Technology-neutral:** the section says what is paid, how much, when and what follows; the
   provider is in the context file and its keys are settings.
5. **Better than free text and code:** the hold and its timer, the provider's word as the truth,
   idempotency, the amount check, the Payment record, the refund rule, the privacy page's line
   and the `fake` provider for tests come with the entry; custom code would have to write and
   test each, and would usually miss the hold and the amount check.

ARCHITECTURE §6.3 (the kit) gains in step 1: the payments interface and its provider modules,
the checkout and return pages, the payments address, the hold timer and the Payment table beside
the audit log.

## 9. Build order

1. **Core (Fable).** The section, its validation, the built-in `Payment` model in the IR, the
   held state on `when: created`, the payments entry as an outgoing `when`, the `{pay}`
   placeholder, the operations, the summary words, the schema, the context file's key, the spec
   reference, ARCHITECTURE §6.3 and §3.4.
2. **The kit (A).** The provider interface, `fake`, the checkout flow, the return page, the
   payments address, the hold timer, the Payment list and page, the refund button, the words,
   the privacy page's and the app card's lines; `test:apps` steps on kiosk with `fake`.
3. **Providers (A).** Stripe and Mollie, each with the weekly test-mode run (C the workflow).
4. **Hosted (B).** The Connections page's payment settings, the providers' hosts in the egress
   proxy, the level rule (Strict: EU companies' providers).
5. **Starters and docs (C).** The kiosk and booking starters take a payment; the docs' how-to;
   sampleusers' journey "a customer pays, the kitchen sees the paid order".

**Later:** partial refunds; paying the difference; deposits and no-show fees
([appointments.md](appointments.md)); several entries on one model; several currencies;
subscriptions; Payments in the API.

## 10. Open questions for Johan

1. The two first providers: Stripe and Mollie? Recommended: yes.
2. Register the company's own account with both now, in test mode only, to be activated later if
   the hosted service's billing goes there? Recommended: yes.
3. The hold time for an unpaid `when: created` record: 30 minutes by default? Recommended: yes,
   a setting per app.
4. A Payments page for admins and the refund roles, as well as the list on the record page?
   Recommended: both, the page simple.
5. Receipts: the provider's own receipt mail on (in the owner's provider account), and the app's
   outgoing `when: <payment>` optional? Recommended: yes.
6. `when` as a condition rather than an action's name (§3.2)? Recommended: a condition.
