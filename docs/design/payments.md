# Payments: a record paid on the provider's page, recorded by its word (design)

Status: proposed 2026-11-08, Fable, on Johan's questions the same night: "Can you design payments?
Should the builder be able to pick among different providers? How can we test this, do I need to
register a provider for smithable and we try to use that for our own payments later and now only
for testing?" Payments were his "maybe payments", the first complete business capability left
before the product is there. Nothing in the engine changes with this note alone; it adds one
spec section, so merging it is the go-ahead for step 1 of §9, and each later step is confirmed
when its turn comes. §10 lists what Johan decides. Facts not yet confirmed say "to check".
Reviewed by three second reviewers (§11).

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
  pass through the app, its database, its logs or Smithable. This is meant to keep the app at
  the lightest self-assessment the card industry's security standard asks of a merchant whose
  payers pay on a provider's hosted page (the exact form to check, per provider).
- **The provider's word is the truth.** The provider tells the app by a call the app verifies
  (its signature, or the provider's own API asked again, §4.3) that a payment succeeded; the app
  records it. The return to the app's page after paying shows what
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
  It may be left out: every payment made through the provider has its Payment line (§3.3).
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
| `status` | `pending`, `paid`, `failed`, `refunding`, `refunded` (the moves between them in §4.3) |
| `provider` | the provider's name from the context file (`stripe`, `mollie`, `fake`) |
| `providerMode` | `test` or `live`: the provider's mode the payment was made in |
| `providerAccount` | the provider's account id, where it gives one (optional) |
| `reference` | the provider's own id for the payment |
| `note` | what went wrong, in the app's words (declined, amount differs, paid twice, paid after the hold, the record no longer asks, refund refused, disputed) |
| `createdAt`, `paidAt`, `refundedAt` | when |

Under each Payment, its refund lines (§4.4): the amount, the provider's refund id, asked, done
or refused, and by whom.

- It is in the IR as a model so pages, access, outgoing entries and the app card can refer to
  it; a spec that has its own model named `Payment` (actions.md's `recordPayment` example adds
  one) and a `payments` section is refused, naming another name for the maker's
  (`ManualPayment`). No starter has such a model today.
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
  per app at first: a record is paid in the app's currency, whatever the payer's own.
- Money is stored in hundredths of the currency, the yen's too. A provider takes the currency's
  own smallest unit, so the kit converts exactly: for a currency with two decimals the stored
  number is the provider's, for one with none (the yen) an amount that is not whole is refused
  before the checkout. A currency with three decimals cannot be stored in hundredths, so a
  `payments` section refuses it. Which currencies each provider takes is to check in step 3.

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
- **Summary:** "An order is paid when it is added, on the payment provider's page; a paid order
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
  - A warning when `when: created` is on a model whose records are also made where the pay step
    cannot follow (an incoming call, an import, a key): those records are created unheld and
    unpaid (§4.7), and the warning says so.
  - A warning when `when` is a condition and no role that may read the record could press Pay,
    and the record's model is not reached by a pay link (§4.1).

## 4. The flow in the app

### 4.1 Paying

1. **The button.** With `when: created`, the form's, order page's or reservation block's submit
   reads "Pay {amount}" and leads on to the provider. With a condition, the record page shows a
   Pay button on records that fit and are unpaid, to whoever may read them. For someone without
   an account (an invoice's customer), an outgoing mail's text may hold `{pay}`: the address of a
   page of the app that shows the description and the amount and a Pay button, nothing else of
   the record. The link carries a random token (stored as a hash, as keys are) bound to the entry
   and the record; it works while the record fits `when`, is unpaid and keeps the amount the link
   was made for, and ends after 60 days. The page is behind the kit's limiter.
2. **The server function.** A same-origin call, checked as every server function is. It reads
   the record (as the viewer, or with the link's token), checks `when` and that the record is not
   paid, reads the amount, and in one write transaction writes the held record (for `created`)
   and a `pending` Payment. A unique index allows one pending Payment per entry and record, so
   two clicks at once make one; a click while one is pending goes to step 4. An amount of zero
   needs no payment: the record is not held, its `created` events fire at once, no Payment line
   is written and the payments entry's outgoing event does not fire. A negative amount is refused.
3. **The checkout.** After that transaction (a provider's call never sits inside one), the kit
   asks the provider for a checkout session: the amount and currency, the description, the
   success and cancel addresses of the app (`/payments/<payment id>/back`), the Payment's own id
   in the provider's metadata, an expiry at the hold time where the provider takes one, and an
   idempotency key made from the Payment's id, so a retried request makes no second session. The
   Payment keeps the provider's reference, and the browser goes to the provider's page. If the
   provider refuses or cannot be reached, the Payment is marked `failed` and a held record is
   released at once, so no place stays blocked; the person is told to try again. If the reference
   cannot be saved, the provider's call still finds the Payment by the id in its metadata (§4.3).
4. **A second click.** While a Payment is pending, Pay leads to its session again if the provider
   still has it open; else the kit closes it at the provider, marks it `failed` ("left
   unfinished") and makes a new one.

### 4.2 Coming back

The page at `/payments/<id>/back` shows the Payment's state as the app knows it: "Paid" once the
provider's call has come; until then "Waiting for the payment to be confirmed", refreshing itself
for a minute and then saying the payer will hear by the provider's receipt. The return address
carries nothing that marks anything paid. Only the browser that started the payment (a cookie
set then, bound to the Payment) or a viewer who may read the record sees the page; a visitor's
page says the order's number and the state, nothing else of the record. Cancel comes back to the
same page, which then offers Pay again (and for `when: created`, says how long the place is
held).

### 4.3 The provider's call

- **The address:** `/incoming/payments-<provider>`, a route the kit generates beside the spec's
  incoming entries. The spec's entry names are camelCase, so it cannot clash with one.
- **Verified by the provider's scheme**, in the provider's module: a signature of the body with
  `PAYMENTS_WEBHOOK_SECRET` and a timestamp checked to five minutes, where the provider signs; or,
  for a provider that sends only a payment's id (Mollie's classic payment calls, to check), by
  asking the provider's API for that payment with the app's secret key: the answer, not the
  call, is what the app acts on. Either way the payment must carry, in its metadata, the id of a
  Payment the app made, and match that Payment's stored reference when there is one (it is
  stored now when there was none). An unverified call, or one for a Payment the app did not
  make, is refused with 401 and logged.
- **Bound to the account.** A Payment records the provider, whether it was made in test or live
  mode, and the provider's account id where the provider gives one; an event from another
  account or mode is refused. Changing the provider or its keys leaves the old Payments as they
  are; their refunds are then made at the old provider's dashboard.
- **One transaction, one state machine.** Everything below happens in one write transaction,
  the event id included: it is taken in the `incoming_seen` table in that transaction, so a
  failure that rolls back gives it back, and the provider's retry is acted on. (SQLite runs one
  write transaction at a time, so two deliveries cannot interleave; a database with row locks
  takes the Payment's.) Since `incoming_seen` keeps ids for a day while providers retry for longer
  (days, to check per provider), the Payment's state is the second guard. Its states move only
  this way:

  | From | To | By |
  |---|---|---|
  | `pending` | `paid` | the provider's success, amounts equal |
  | `pending` | `failed` | the provider's failure or expiry; the hold timer; an unfinished checkout replaced |
  | `failed` | `paid` | a success after the Payment was given up (§4.5): recorded, then refunded by the app |
  | `paid` | `refunding` | a refund asked, in the app |
  | `paid`, `refunding` | `refunded` | the provider's word that the whole amount went back |
  | `refunding` | `paid` | the provider's refusal of the refund, noted |

  Any other event changes nothing and answers 200: a failure or expiry after `paid`, a success
  after `refunded`, the same success twice. `paid.set` is applied only on the first move to
  `paid` of a pending Payment, never again.
- **What a success does:** checks the event's amount and currency against the Payment's
  (§4.6) and, with a condition, that the record still fits `when`; marks the Payment `paid` with
  `paidAt`; unholds the record (for `created`); applies `paid.set`; writes the audit lines; and
  writes the outbox rows of outgoing entries on the payment (below) and of the record's waiting
  `created` entries. Then it answers 200. A failure before the commit answers 500, so the
  provider tries again.
- **Outgoing hears it:** an outgoing entry's `when` may name the payments entry
  (`when: orderPayment`), fired when a payment of it succeeds, on the paid record, with `where`
  as for an action. So a receipt mail or a call to the kitchen is an ordinary outgoing entry. The
  outline called the event `paid`; the entry's name is how `when` already names actions and
  timers, and it keeps two entries apart.
- **Money that came for nothing.** The money is the payer's in these cases, and the Payment says
  so in `note`, shown to admins and the refund roles on the Payments page:
  - *After the hold* (paid after the record was released, the checkout not closed in time): the
    record is not brought back, and the app refunds the payment by itself, the one refund no
    person asks for. The refund is retried with growing pauses for a day, as the outbox's calls
    are, then shown as given up, with Refund for an admin.
  - *Paid twice* (two sessions both completed) and *the record no longer asks* (an invoice
    cancelled while its payer was on the provider's page): the Payment is marked paid, the record
    is not changed and `paid.set` is not applied. Refund is offered to admins and the refund
    roles, whether or not the entry has `refund` or the record fits `refund.when`: this is money
    that should not have come, not a refund of a sale.

### 4.4 Refunds

- **In the app:** a Refund button on a paid Payment, for the roles `refund.by` names (admins
  always), while the record fits `refund.when`. It asks to be sure ("Refund 24,50 € to the
  payer?"), marks the Payment `refunding` in one transaction and then calls the provider's
  refund, with an idempotency key made from the refund line's own id (below), so a retry of the
  same request is one refund and a later attempt is a new one. The Payment becomes `refunded`
  when the provider's call says so, as payment does. A refusal by the provider (an old payment,
  a balance too low, to check) returns it to `paid` with the reason noted and shown. Full
  refunds only, from the app; partial later. The button is the kit's, not an entry in `actions`,
  so it takes no action's name.
- **Refund lines.** Each refund, asked in the app or made at the provider, is a line of its own
  under the Payment (amount, the provider's refund id, asked, done or refused, by whom or "the
  app"), so a partial refund made in the provider's dashboard is recorded with its amount: the
  Payment then shows "refunded 10,00 € of 24,50 €" and stays `paid` until the whole amount is
  back.
- **What a refund does to the record:** nothing by itself. The owner's own action (`decline`,
  `cancel`) says what the record becomes; a refund says what happened to the money.
- **Disputes** (a payer's bank reverses a payment) are noted on the Payment when the provider's
  call says so; the record is not changed, and acting on them is the owner's, at the provider.
  To check per provider which calls carry them.

### 4.5 Failures and holds

- A declined or abandoned payment leaves the Payment `failed` (with the provider's reason in
  `note` where it gives one) and the record unpaid. With a condition, Pay is offered again.
- **The hold timer** runs every minute, so a place is released within a minute of the hold time.
  For each held record past it: first, outside any transaction, it asks the provider about the
  checkout and to close it where the provider has such a call (to check per provider). If the
  provider says it is paid, the success is recorded as in §4.3. If the payment is still being
  processed (a payment method that settles later, to check per provider which), the hold stays
  until it settles or fails: the hold time is a time to start paying, not to have finished. If
  the provider cannot be reached, the timer tries again next minute. Otherwise, in one
  transaction, and only if the Payment is still `pending`, it marks it `failed` ("not paid in
  time") and removes the record, its place freed. A held record never goes to the trash: it was
  never there. The Payment keeps the record's id as a plain value, not a reference, as the audit
  log does, so the line stays when the record is gone.
- The hold time should not be shorter than the provider's shortest checkout expiry, so the
  checkout closes by itself before the record is released (Stripe's shortest expiry is
  30 minutes, to check), and the late payment of §4.3 stays rare.

### 4.6 Amounts

- The amount is read from the record on the server when the payment starts and stored on the
  Payment; the provider's event must carry the same amount and currency, and when the payment
  is recorded the record's amount must still be the same. Otherwise the Payment is marked paid
  with the note "amount differs", `paid.set` is not applied, and admins are shown it, with
  Refund. A held record cannot be changed, so this concerns `when` as a condition: an order
  edited while its payer was on the provider's page.
- A record whose amount changes after it is paid (a line added to an order) keeps its Payment;
  the record page shows "Paid 24,50 € of 28,00 €". Paying the difference is later; the owner
  settles it by hand today.
- Amounts are compared in the currency's smallest unit, as integers, never as decimals.

### 4.7 Records made another way

With `when: created`, the pay step is the way in: a visitor's create through the API (when the
model is under `public.create`) is refused for that model, since it would skip paying. Records a
key's role, an import or an incoming call makes are the app's trusted ways in: they are created
unheld and unpaid, as today, and validation's warning (§3.6) says so.

## 5. Providers, and whether the builder picks

Yes: the maker picks one provider per app in the context file, from a short list, and Studio's
settings offer it as a choice with a sentence on each. The first two:

- **Stripe:** a global provider; for European merchants its contracting entity is in Ireland
  (to check), and where payment data is processed under an app's level is to check.
- **Mollie:** an EU company, in the Netherlands.

**Which provider an app may use on the hosted service follows its level.** A Strict app takes
only services run by EU companies. If that means a company of an EU-owned group rather than a
non-EU group's EU entity (to check with the level's own definition), Stripe's Irish entity does
not count, and a Strict app offers Mollie. A Normal app takes services served from the EU
(Mollie; Stripe if its API is served from the EU, to check). A Relaxed app and a non-EU app may
use either. A self-hosted app uses what its owner chooses.

**Payment methods** (cards, iDEAL, Klarna, Swish, Apple Pay and the rest) are the hosted page's
business: the owner turns them on in their provider account, not in the spec. The pay button
names them only as the provider module can say in general ("card or the provider's other
methods"); whether a module reads the account's methods to say more is to check in step 3.
Which methods a provider offers is the provider's list, not ours: Klarna is offered through both
first providers in the countries they serve (to check per country); Swish, a Swedish method run
through the payer's bank, is not offered by either as far as known (to check), so a Swedish app
that needs Swish takes a Swedish provider as a third module later, through the same interface;
nothing in the spec changes for it. Enabling a method is done in the owner's provider account,
and the hosted page shows it the next time someone pays.

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
signed event back to the app's own payments address, as a provider would, signed with a secret
the app makes for itself when it first starts (kept in its data, never a setting). The fake page
and the fake payments address exist only when the provider is `fake` or the app is a demo; an
app with a real provider has neither. `test:apps`, Studio's
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
behind Smithable, one per provider. The keys live in the runner's secrets,
never in a repository; nothing in this repository names the accounts.

## 7. What it never does

- No card data in the app, ever; the `card-data` warning stays.
- No money through Smithable, and no share of it.
- No provider named in `smithable.yml`.
- No record marked paid on a return to the app's page; only the provider's verified word.
- No provider call acted on without its signature, or without the provider's API confirming it,
  and none for a Payment the app did not make, or from another account or mode.
- No payment marked paid whose amount or currency differs from what was asked.
- No refund by a person without a role for it: `refund.by`, admins, and for money that should
  not have come (§4.3) admins and the refund roles. The app refunds by itself only a payment for
  a record it had already released.
- No `paid.set` applied twice, after a refund, or for a payment whose amount differs or whose
  record no longer asks for it.
- No call to a provider inside a database transaction.
- No place held past the hold time (within the timer's minute) unless the provider says the
  payment is still being processed.
- No Payment line edited or deleted by hand, like the audit log's.
- A demo (`DEMO_VISITORS=1`) uses `fake` only, whatever the context file says: its visitors'
  copies must never reach a real provider.

## 7b. The owner's part, and what the app says

The owner is the merchant, and the app says so where it matters (Johan, 2026-11-08: push the
responsibility for card handling and the rest to the app's owner as far as possible, and say it
plainly).

- **The owner's part:** the account with the provider and what the provider asks of them
  (identity, business, payouts); the payment methods they turn on; their prices, VAT and
  invoices; their terms of sale, refund policy and consumer rights; disputes and chargebacks at
  the provider; the amount the spec computes being the right amount; and keeping their provider
  keys secret. Smithable's part is the flow in the app (§4) and the words below.
- **Said when payments are turned on.** `setPaymentProvider` and Studio's settings, the first
  time a real provider is chosen, show one notice: that the owner is the merchant and the
  provider's customer, that card data is the provider's and must never be taken into the app
  (not in a field, a form, a message or a file), and the list above in one sentence each; the
  hosted service shows the same on the Connections page where the keys are set, and the hosted
  terms name it. The notice is ours; it does not replace the owner's own terms with their
  customers.
- **Said in the app, by the kit.** When the spec has a `payments` section, every place of the
  kit where a person writes to the app's people carries one line of the kit's words: the contact
  block, the thread's reply box, the support page's message form, and the assistant's box:
  "Never send card numbers here; payments go through the payment provider's page." The
  assistant's prompt tells the model to refuse card data and point to the pay button. The
  owner's own page texts are theirs to write; the line is the kit's and comes with the section.
- **Said on the legal pages.** The generated privacy page names the provider and what it
  gets, and the app card does (§5); the kit's terms-of-sale text is not generated: the owner
  writes theirs, and the record page's Pay button can link to it (`payments.<name>.terms` in the
  content file, a page or an address), shown beside the button where set.
- **What the owner cannot turn off:** the provider's hosted page (no card form in the app), the
  amount check, the refund roles, the Payment lines. Those are the app's guarantees to the
  payer, not settings.
- **Card numbers written anyway are masked.** People send card data when a payment went wrong
  and they write about it, rarely on the first try (Johan, 2026-11-08). So the line is not the
  only guard: when the spec has a `payments` section, the kit masks what looks like a card
  number (13 to 19 digits with spaces or dashes that pass the Luhn check, the card industry's own
  check digit) in every text that reaches the app through its people: the contact block, a
  thread's reply, the support page's form, the assistant's box and mail that comes in as a
  record. The number is stored as its last four digits (`**** 1234`), the writer is told in
  the form's answer, and nothing of it reaches the audit log, the outbox or a model. A number
  that is not a card's (an order number, a phone) fails the check and is left alone.
- **Finding out what went wrong.** Every step of a payment writes a log line that carries the
  Payment's id and the provider's reference: the checkout asked for, the provider's answer,
  the event received and whether it was verified or refused and why, each state move, the hold
  timer's release, a refund asked and answered. So the app's log search (the project page's,
  by words; logging.md §5) finds a payment's whole story by either id, and the Payments page's
  line has "Logs" beside a failed or noted payment, which opens the search with the id filled in
  (hosted: the project page's log search; self-hosted: the id to search the app's output for).
  The Payment's `note` says the reason in the app's words; the log says what the provider said.

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

1. **Core (Fable).** Built in #1081. The section, its validation, the built-in `Payment` model in the IR, the
   held state on `when: created` and the refusal of a visitor's API create (§4.7), the Payment's
   states and their moves (§4.3), the currencies a section accepts, the payments entry as an
   outgoing `when`, the `{pay}` placeholder, the operations, the summary words, the schema, the context file's key, the spec
   reference, ARCHITECTURE §6.3 and §3.4. As built: the built-in models are the IR's `builtInModels` (`Payment`
   and its refund lines, `PaymentRefund`), the moves are core's `PAYMENT_MOVES`, and a pay-to-create
   model is marked `heldByPayment`, which the adapter consumes in step 2 (the held column, the
   refused API create).
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
2. Register the company's own account with both now, in test mode only? Recommended: yes.
3. The hold time for an unpaid `when: created` record: 30 minutes by default? Recommended: yes,
   a setting per app.
4. A Payments page for admins and the refund roles, as well as the list on the record page?
   Recommended: both, the page simple.
5. Receipts: the provider's own receipt mail on (in the owner's provider account), and the app's
   outgoing `when: <payment>` optional? Recommended: yes.
6. `when` as a condition rather than an action's name (§3.2)? Recommended: a condition.

## 11. Second reviewers

Taken: the event id taken in the same transaction as the Payment's change, so a rolled-back
call is retried; a state machine for the Payment, so a late failure never undoes a payment and
an old success never applies `paid.set` again after a refund; a `refunding` state and refund
lines of their own (with dashboard partial refunds recorded by amount) instead of a note; a
refund's idempotency key from the refund line, not the Payment; no provider call inside a
database transaction, and the hold timer asking the provider first, outside it; a payment still
being processed keeps its hold; a failed checkout releases the hold at once; one pending Payment
per record by a unique index, and step 2 and step 4 of §4.1 made one rule; the Payment found by
its own id in the provider's metadata, and bound to the provider's account and mode; the
record's id kept as a plain value, so a released record leaves its Payment; `when` checked
again and the record's amount compared when the payment is recorded, with money that came for
nothing (late, twice, no longer asked, amount changed) marked and offered for refund, the
app's own automatic refund named as the one exception to "a role for every refund" and retried;
a zero amount said in full; the fake provider's secret and its address only when `fake` is the
provider or the app a demo; the pay link's token hashed, bound to its amount and limited; a
visitor's API create refused on a pay-to-create model; currencies settled now (exact conversion,
whole yen, three decimals refused); the PCI sentence softened; "EU company" for Stripe's Irish
entity marked to check.

Declined: that the kiosk starter's `recordPayment` would be refused by the `Payment` name (it
is actions.md's example, not a starter; the note says so); a validation warning when no action
moves a refunded record out of its paid state (what a record becomes is the owner's action, and
`paid.set` is not run again); CSRF as a rule of its own (the pay step is a same-origin server
function, as every change in the app); taking payments for imports and keys on pay-to-create
models (those are the app's trusted ways in, and the warning says so).
