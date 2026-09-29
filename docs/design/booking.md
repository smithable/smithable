# Booking a place: a capacity on related records, and Book and Cancel (design)

Status: 2026-09-29, proposed by Fable. The booking starter says "online booking" but has no bookings: its only trace is the rule "A session never has more confirmed bookings than its capacity", written in words and enforced nowhere. This adds one construct to the spec, so merging this document is the go-ahead. It passes ARCHITECTURE §2.4: common (classes, events, tables, rooms, tickets, appointment slots, course seats), deterministic, no model or custom code, technology-neutral, and it is exactly the kind of rule that must be enforced where records are written, not in a page: two people taking the last place at once is the case that matters.

## 1. What people get

- A member opens a session and taps **Book a place**. The session then says **You're booked**, with **Cancel booking** (asking first). A full session says **Full** and offers no button; a visitor who is not signed in is asked to sign in first.
- Sessions show their **places left** ("3 of 12 left", "Full") on their page, in lists, and in the calendar once that lands.
- Members see their own bookings under **My bookings**; staff see who is coming on each session's page.
- Two members taking the last place at the same moment: one gets it, the other is told the session is full. Lowering a session's capacity below its bookings is refused with the number booked.

## 2. The spec

```yaml
models:
  Session:
    fields:
      startsAt: datetime!
      capacity: int! = 12
      bookings: Booking[]
      placesLeft: { type: int, formula: capacity - COUNT(bookings) }   # an ordinary formula
  Booking:
    fields:
      session: Session! unique           # with private access: one booking per member and session
    capacity: { per: session, max: session.capacity }
```

- **`capacity`** is a new model key: at most `max` records of this model per record that `per` refers to. `per` is a required reference of the model. `max` is a whole number or a whole-number field of the referenced record (`session.capacity`). An optional `where` counts only some records, with the dashboard's grammar (`where: { status: confirmed }`), for models that keep cancelled records.
- Nothing else is new. One booking per member is the existing `unique`, which under private access already means unique per owner. Places left is an ordinary formula: aggregates over a list already count every related record, not only those the viewer may read, and only the number leaves the server, never whose bookings they are.
- Validation: `per` must be a required single reference, `max` a positive number or an `int` field of the referenced model, `where` choice or yes/no fields of this model. A warning when a model with a capacity is not unique per owner or per `per` ("a member can take several places"), since that is usually a mistake but sometimes intended (tickets).
- The operation `setCapacity model per max [where]` (none removes it), and tier-0 phrases such as "at most capacity bookings per session" and "a session can't have more bookings than its capacity".

## 3. How it works

### 3.1 Enforced where records are written

The model's generated data function checks the capacity inside the same database transaction as the write: on create, and on update when `per` or a field `where` reads changes, it counts the matching records for that referenced record and refuses with a `Conflict("full")` when the count has reached `max`. SQLite serialises writes and better-sqlite3's transactions are synchronous, so the count and the insert cannot interleave with another request's; the generated access test gains a case that fills a session and sees the next booking refused. The referenced model's update refuses lowering `max` below the current count (`Conflict("booked:<n>")`). Forms turn both codes into words, as they do for "taken".

(A later PostgreSQL mode needs the count under a row lock on the referenced record, `SELECT … FOR UPDATE`; noted in the adapter's scalable-mode list, not needed now.)

### 3.2 Book and Cancel

When a model has a capacity, the referenced model's record page, and the calendar's panel, get a **reservation block** for signed-in users who may create the model:

- If the viewer has no record of the model for this referenced record: **Book a place** (text from `smithable.content.yml`, `models.Booking.book`, default "Book a place"), which creates it in one step. This needs every other required field of the model to have a default or be filled by the owner; validation reports a model whose other required fields would need a form, and then the button opens the new-record form with the reference filled instead.
- If the viewer has one: "You're booked" and **Cancel booking** (the model's `cancel` text), which deletes it after a confirmation, through the data function, so only its owner (or staff with delete access) can.
- A full session shows "Full" and no button; the places left come from the formula when there is one, else from the count the block's server function returns.

Visitors see "Sign in to book" linking to the sign-in page, which returns them to the session. The block is part of the kit (`src/kit/Reserve.tsx`), copied only into apps with a capacity.

### 3.3 The booking starter

- `Booking` as above (private access, so members see their own), `Session.bookings` and `Session.placesLeft`, and the rule text replaced by the construct (the rule's words stay as the capacity's description, so rule status shows it as implemented and enforced).
- Pages: `my-bookings: { crud: Booking }` for members (their own, by access), and staff see each session's bookings on its page through the related list.
- Sample data: none for bookings (they need users); sessions show all their places left.

## 4. Order of work

1. **Core:** the `capacity` model key (schema, parse, checks and the warning), `setCapacity`, the phrases, index and summary words ("At most `capacity` bookings per session").
2. **Adapter, data functions:** the count in the write transaction, the capacity-lowering check, the conflict codes and their words, the access test case.
3. **Adapter, the reservation block:** `Reserve.tsx`, its server function (the viewer's own record, places left), on the referenced model's record page and, when the calendar exists, in its panel; sign-in return path.
4. **Example and tests:** the starter as in 3.3; `test-apps` browser steps: a member books a session and sees "You're booked"; with capacity 1, a second member sees "Full"; the member cancels and the place is free again; an admin lowering the capacity below the bookings is refused.
5. **Docs:** spec (a "Capacity" subsection under models, and the reservation block under pages), ARCHITECTURE (the access layer paragraph: capacity is checked in the same place as access), ROADMAP.

Steps 1 and 2 are the engine part (the write path and its transaction); I'd do those. Steps 3 to 5 follow the patterns Opus has built twice now. Apps without a capacity stay byte-identical.

## 5. Out of scope, for later

- Waiting lists (a place freed goes to the first in line, with a mail through the mail kit).
- Payment for a place.
- Reminder mails (a daily hook can send them today; a construct can come when several apps want the same).
- Booking several places at once, or for someone else (ticket-style `max` per owner).
- Cancellation deadlines ("no cancelling in the last 12 hours"): a rule for custom code or a later `when` on actions.
