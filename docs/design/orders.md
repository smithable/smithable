# Orders: a menu and what people choose from it (design)

Status: 2026-10-13, Fable, on Johan's brief: a restaurant and food-truck starter (backlog A 102)
with menus people choose from, an order the business receives by mail or by a call to another
system, and later a checkout that pays through a payment service, never through the app. The
build waits for the support portal (the backlog's order); merging this note is the go-ahead for
the one construct it adds. The same construct is a café's takeaway, a bakery's pre-orders, a
club's merchandise, a farm shop's weekly box: anywhere a person picks several things and sends
them as one order.

## 1. What people get

- **A customer, on a phone:** the menu page, grouped by section (Starters, Mains, Drinks, Today's
  special), each dish with its picture, a line of description, the price, and **+**. A sold-out
  dish shows "Sold out" and no button. A bar at the bottom follows the page: "3 items · €34.50 ·
  Order". Order asks for a name, a phone number, when (as soon as possible, or a time among the
  next few hours in quarter-hour steps while the place is open) and a note (allergies, "no
  onions"), then sends the order. The page says "Order 1042 is in. We'll text you when it's
  ready." with what was ordered. No account, no password.
- **The business, on a phone:** a page of today's orders, newest first, each with its number,
  the items, the customer's phone and when it is wanted, with **Accept**, **Ready**, **Collected**
  and **Decline** (asked for a reason). A new order mails the staff address; accepting it mails
  the customer when they gave an email. Another system (a kitchen screen, a cash register, a
  messaging bot) gets the same order as a signed call the moment it is placed, through an
  outgoing target.
- **The owner's daily edits, from a phone:** mark a dish sold out and back (one button), change
  a price, add today's special with a picture taken on the spot, change today's opening hours or
  where the truck stands. That pass is the starter's acceptance test (A 102).
- **Later, paying:** the page has a Pay step after the order's details: the customer goes to the
  payment service's own page and comes back, and the order is marked paid when the service tells
  the app (an incoming call, [integrations.md §3](integrations.md)). The app never sees a card.

## 2. The spec

```yaml
app:
  name: Kiosken
  currency: EUR
  timezone: Europe/Mariehamn

models:
  Dish:
    fields:
      name: string!
      description: text
      price: money!
      section: starters | mains | sides | drinks | specials
      picture: picture
      diet: none | vegetarian | vegan
      allergens: string                       # free text: "nuts, gluten"
      available: bool = true
    actions:
      soldOut:  { when: { available: true },  set: { available: false } }
      backOn:   { when: { available: false }, set: { available: true } }
  Order:
    fields:
      number: int!                            # given by the app, counting up, shown to the customer
      name: string!
      phone: phone!
      email: email
      wanted: datetime                        # empty means as soon as possible
      note: text
      status: new | accepted | ready | collected | declined
      reason: text
      lines: OrderLine[]
      total: { type: money, formula: SUM(lines.amount) }
    actions:
      accept:    { when: { status: new },      set: { status: accepted } }
      ready:     { when: { status: accepted }, set: { status: ready } }
      collected: { when: { status: ready },    set: { status: collected } }
      decline:   { when: { status: [new, accepted] }, set: { status: declined, reason: } }
  OrderLine:
    fields:
      order: Order!
      dish: Dish!
      quantity: int! = 1
      unitPrice: money!                       # the dish's price when ordered; a later price change leaves old orders alone
      amount: { type: money, formula: quantity * unitPrice }
  Stop:                                       # a food truck: where it stands when
    fields: { place: string!, day: date!, hours: string!, note: text }   # hours as written: "11:00-14:00"

pages:
  menu:
    route: /
    order:                                    # NEW: a page where visitors compose an order
      from: Dish                              # what is chosen: its price, picture, section, available
      into: Order                             # one record per order; its one list of lines is filled
      ask: [name, phone, email, wanted, note] # Order's fields the customer fills, in this order
      hours: { mon-thu: "11:00-20:00", fri-sat: "11:00-22:00" }
      lead: 20                                # minutes before the earliest "wanted"
  orders:
    crud: Order
    filters: [status]
    sortable: [createdAt, wanted]
  dishes:
    crud: Dish
    filters: [section, available]
  where:
    landing:
      hero: {}
      stops: { records: Stop, limit: 7 }
      contact: {}
      footer: {}

outgoing:
  orderPlaced:   { when: Order created, to: mail, recipient: admin }
  orderAccepted: { when: accept, to: mail, recipient: email }
  orderReady:    { when: ready,  to: mail, recipient: email }
  toKitchen:     { when: Order created, to: kitchen }      # OUTGOING_KITCHEN_URL and _SECRET

navigation:
  main: [orders, dishes]
```

`smithable.auth.yml`: `public.pages: [menu, where]`, `public.read: [Dish, Stop]`, and
`public.create: [Order]` for the order page; `OrderLine` needs no entry: the page creates the
lines with their order, never on its own. Staff is a role with `Order` and `Dish` in full.

Every key but the `order` page exists today: models, pictures, formulas over a list, standard
actions with an asked value, outgoing mail and targets, `records` sections, `public.create`,
the `recipient: email` warning (an email field on a model visitors create is not mailed by the
app: `orderAccepted` goes out on an action staff press, which is the case the warning leaves
alone, and the design makes that explicit in §4). `number` counting up is the one small model
addition (§4). The `hours` grammar is the appointments design's (`appointments.md` §2),
unchanged.

## 3. The `order` page

The page is the shop window and the basket in one. It needs five things that a records section
and a public form do not give, which is why it is a page kind and not content on a landing page:

1. **Several records in one write.** A visitor's form today creates one record and may not link
   to others (`public.create`). An order is one `Order` and its `OrderLine`s in one transaction,
   each line linking to a `Dish` the visitor may read. The page's create path is the one place a
   visitor's write links records, and it links only to records of `from` and only through
   `into`'s one list.
2. **The server sets the prices.** The browser sends dish ids and quantities, nothing else about
   the dish. The data function reads each dish, refuses one that is unavailable or not readable
   by visitors ("Sold out: Fish soup"), copies its price into `unitPrice`, and the formulas do the
   rest. A price changed in the owner's phone between the menu loading and the order being sent
   gives the order the new price and the confirmation shows it.
3. **When it is open.** `hours` says when orders are taken: outside them the bar says "Closed,
   opens Friday 11:00" and the create path refuses with the same words, so a page kept open
   overnight cannot order. `wanted` offers times from now plus `lead` to closing, in quarter
   hours; without `hours` the page always takes orders and `wanted` is free. A `Stop`-like model
   does not drive the hours: a truck's owner changes `hours` when it changes, or leaves it off.
4. **A number people can say.** `into`'s `int!` field named in content (`order: { number:
   number }`, default: a field named `number`) is set by the app, the next after the highest, in
   the transaction; it is what the confirmation, the mails and the staff page show, and it is
   never entered.
5. **Writes limited like a public form**, the same as today's contact forms: by address, with
   the kit's words when refused. An order with no lines, more than fifty lines, or a quantity
   over ninety-nine is refused as a bad request, in words.

Operations: `addOrderPage <page> --from <Model> --into <Model> [--ask f,g] [--route /]`,
checked: `from` has one `money` field (or `price` names it in content) and is readable by
visitors; `into` has exactly one list whose model has exactly one reference to `from` and one
`money` field for the unit price; `into` is under `public.create` (a warning says so, as for
contact forms); `ask` names fields of `into` that are neither computed, the number, the list, nor
`status`. `removePage` takes it away like any page; `renameField` and `changeField` follow into
`ask` and `hours`; removing `available` is allowed (every dish is then available). The summary
sentence: "Visitors choose dishes on the menu page and send an order; open Mon–Thu 11:00–20:00,
Fri–Sat 11:00–22:00."

Content: the page's title, the bar's words, the sections' titles (the choice field's values are
the default: `section: { starters: Förrätter, … }` in the content file names them, as choice
values are named today), the confirmation text. The ux file: `order: { layout: list | cards }`
(a list of rows with a small picture is the phone default; cards for a bakery with pictures
worth the space), the same looks as records sections.

Access: the page is public when it is under `public.pages`; signed-in people order the same way
and own their orders. Staff see orders on the crud page by their role. A visitor's order page
shows no other order, and the confirmation is in the response once; the customer keeps the
number and the mail.

## 4. New in the app, and where it comes from

| Part | New or reused |
|---|---|
| The menu page with sections, +, the bar and the details step | new: `src/kit/OrderPage.tsx`, copied only into apps with an `order` page; phone-first; the basket lives in the page's state and `sessionStorage`, nothing on the server until sent |
| The create path: dishes read, prices copied, number given, lines and order in one transaction | new, in the model's generated data module; the capacity check in `booking.md` §3.1 is the pattern (a write-path check in the transaction, `Conflict` codes in words) |
| Opening hours and the `wanted` times | the appointments design's hours and quarter-hour steps (`zoned.ts`); shared code when both exist |
| Sold out, Accept, Ready, Collected, Decline | standard actions, nothing new |
| Mail to staff on a new order, to the customer on accept and ready | outgoing mail, nothing new; `recipient: email` on an action, not on `created`, is what the validator allows (the customer's own address, mailed by a staff decision) |
| The kitchen screen or register | an outgoing target with the signed call, nothing new; A 103's deliveries page shows each call |
| The staff page on a phone | the crud page as it is; the order's lines are its list, shown on the record page; the visual pass (A 102) says where rows are too wide |
| Where the truck stands | `Stop` records in a landing section, nothing new |
| The number counting up | new, small: a model's `int!` field may be `sequence: true` (set by the app, next after the highest, never entered); the order page requires one on `into`; useful for invoices and tickets too, so it is a field key, not an order-page key |

## 5. ARCHITECTURE §2.4

1. **Common:** takeaway, cafés, bakeries, farm shops, club merchandise, event food, school
   lunches, print shops: choosing several things and sending them as one order is the second
   most common public write after a contact form.
2. **Deterministic:** sums, hours, a sequence; no model anywhere.
3. **Less AI and ambiguity:** a basket written as custom code is the piece a first build would
   get wrong most, and differently each time: client-side prices, a line created without its
   order, a visitor linking to records they should not.
4. **Technology-neutral:** two models, a list, a money field, hours.
5. **Better than free text and custom code:** the write must be one transaction with the prices
   read on the server; the page, the check, the summary and the tests read the same three keys.

## 6. Paying, later

A `pay` key on the order page (`pay: true`) adds a step after the details: the app asks the
payment service for a payment page for the order's total and number, sends the customer there,
and takes them back to the confirmation. The service's call back to the app is an `incoming`
entry (`integrations.md` §3; `paymentReceived` with `custom: true` is the example there, and a
fixed kind for payments is the better end: a payment kind that knows the service's signature and
sets `paid: true` on the order with the service's reference). `Order` then has `paid: bool` and a
`paymentRef: string`, and staff accept only paid orders when the owner says so (`when: { status:
new, paid: true }`). Which services, and how one is connected, is the context file's and the
hosted service's business (an account at the service, its keys as settings); the spec says only
that the order is paid before it is made. Not in this build: the brief says receive first, pay
later, and the first testers will say whether a prepaid order or a counter payment is what they
want. `smithable validate`'s `card-data` warning already tells a maker who adds a card field to
use a service instead.

## 7. Out of scope

- **Delivery** (an address, a fee by distance, a driver): pickup only; a delivery address is an
  `ask` field a maker adds, the fee a later key.
- **Options on a dish** (size, extras, "without onions" as choices): the note covers the first
  version; a `Dish` with `options: Option[]` and a line's chosen options is the next step of the
  same construct when a tester asks.
- **Tables and reservations:** the appointments construct (a table is a resource) or a request
  form, not this.
- **Stock** (five left): `available` is a switch; a count is a later key.
- **Accounts for customers:** none; a signed-in customer owns their orders and gets a My orders
  page by `mine: true` on a crud page, already built.

## 8. The starter

`examples/kiosk`: a harbour food truck with a dozen dishes in four sections and pictures from the
library, a week of stops, twenty sample orders across the statuses, the staff role, the
outgoing mail and a kitchen target without an address (the preview says so, A 86). Its test-apps
flow: a visitor orders two dishes at a time inside the hours, the number comes back, the staff
page shows it, Accept mails the customer; outside the hours the create is refused; a sold-out
dish is refused by the server when sent anyway. Two bench descriptions from its territory. Its
Swedish copy exercises `language: sv` on the words the page adds (the bar, "Sold out", "Closed,
opens …"), which go in `words/en.ts` and `sv.ts` like every kit word.

## 9. Steps (after the support portal, A, with C for samples and pictures)

1. `sequence: true` on an `int!` field: core (validation, the summary, the schema, the spec
   reference), the generator (set in the create path, never a form field), one test.
2. The `order` page kind as an internal plugin: schema, `addOrderPage`, validation (§3's
   checks), the summary sentence, the spec reference and the schema; the hours grammar shared
   with appointments.
3. The generator: the create path (§3 items 1–3 and 5), `OrderPage.tsx`, the words in both
   languages, the content and ux keys.
4. The starter, its samples, pictures and test-apps flow; the phone-editing pass written down as
   findings (starters.md §1.2); the Starters page entry.
5. Later: `pay` (§6), options, delivery, each when asked for.
