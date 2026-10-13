# Appointments: one person's time (design)

Status: 2026-10-11, proposed by Opus (backlog A 101, from an outside review, which Johan
called excellent). The booking starter books **places on a session**: a class at 09:00 with
twelve places (`booking.md`). A barber, a physiotherapist or a clinic books **one person's
time**: a service of 30 minutes at the first free moment that person has, never two at once.
This note designs that with two spec constructs and the parts already built. The build waits
for the support portal (the backlog's order); merging this note is the go-ahead for the
constructs.

## 1. What people get

- **A customer, on a phone:** the public page's Book button opens the service (haircut, 30 min,
  €25), then who (a person, or "anyone"), then a day strip starting today, then that day's free
  times ("09:30, 10:00, 11:30 …"). The first day with a free time is preselected, so the
  earliest slot is one tap away. Choosing a time asks for name and email (or the signed-in
  person's), and the appointment is made **requested** or **confirmed** (the owner's choice),
  with a mail saying so.
- **Cancelling:** the customer signs in with the email code (no password, already built) and
  cancels from **My appointments** until the window closes (say, 12 hours before). After that
  the button says to call. The owner can always cancel.
- **The owner's day:** a day view of every person's appointments side by side (the calendar's
  week view, one day wide, a column per person), with Confirm on requested ones and the
  customer's name and phone. The week view stays for looking ahead.
- **Never two at once:** two customers taking the same 10:00 at the same moment: one gets it,
  the other is shown the next free times. A time outside the person's hours, in a break, on a
  day off, or within the gap after another appointment is never offered and is refused if sent.

## 2. The spec

```yaml
models:
  Service:
    fields: { name: string!, minutes: int!, price: money }
  Barber:
    fields: { name: string!, phone: phone }
    schedule:                                  # NEW: this model's records are people whose time is booked
      hours: { mon-fri: "09:00-17:00", sat: "10:00-14:00" }
      breaks: "12:00-12:30"
      gap: 10                                  # minutes kept free after each appointment
      away: TimeOff                            # optional: records of days or hours away
  TimeOff:
    fields: { barber: Barber!, from: datetime!, until: datetime!, note: string }
  Appointment:
    fields:
      service: Service!
      barber: Barber!
      startsAt: datetime!
      name: string!
      email: email!
      status: requested | confirmed | cancelled
    occupies:                                  # NEW: an appointment takes its barber's time
      resource: barber
      starts: startsAt
      duration: service.minutes
      while: { status: [requested, confirmed] }
      cancelUntil: 12h                         # the customer's Cancel is offered until then
      cancelTo: cancelled                      # optional: the value the customer's Cancel sets
```

- **`schedule`** on a model says its records are people (or rooms, or chairs) whose time is
  booked: weekly `hours` per weekday or range (`mon-fri`), `breaks` every day (a range or a
  list), a `gap` in minutes, and optionally `away`, a model whose records (a reference to this
  model and a `from`/`until`) block time: days off, holidays, a dentist's afternoon. The
  hours are the business's; a person whose week differs gets `away` records (a recurring "every
  Wednesday" is an action that makes them, as calendar.md says of repeats).
- **`occupies`** on a model says each of its records takes `resource`'s time from `starts` for
  `duration` (minutes, on the record or one reference away: the same grammar as the calendar's
  `duration`), while `while` holds (the capacity's `where` grammar). `cancelUntil` is how long
  before the start the customer may cancel their own; without it, until the start. Its grammar
  is a whole number and a unit: `30m` (minutes), `12h` (hours) or `2d` (days). This is the one
  place the spec writes a duration as text. `cancelTo` is the value the customer's Cancel sets.
  It is optional when exactly one value of the status is outside `while`, and then defaults to
  that value. When several are outside `while` (`cancelled` and `noShow`, say) and none is
  named, validation refuses it. The status values are the owner's: `while` names which ones take the time. The
  window is the occupying construct's, read by the customer's Cancel action; an action's `when`
  stays choices only.
- Validation: `resource` a required single reference to a model with a `schedule`, `starts` a
  date-and-time field, `duration` as the calendar's, `while` choice or yes/no fields, `hours`
  well-formed ranges, `away` a model with a reference to the scheduled model and two
  date-and-time fields. One `occupies` per model.
- Operations: `setSchedule <Model> --hours … --breaks … --gap … --away <Model>` (none removes)
  and `setOccupies <Model> <resource> <starts> <duration> [--while …] [--cancel-until …] [--cancel-to …]`; tier-0
  phrases "barbers have opening hours 9 to 17 on weekdays" and "an appointment takes its
  barber's time". The summary: "Barbers are booked by their time: weekdays 09:00–17:00,
  Saturdays 10:00–14:00, a break 12:00–12:30, 10 minutes between appointments." and "An
  appointment takes its barber's time for its service's minutes while requested or confirmed;
  its customer may cancel until 12 hours before."

## 3. Reused, not new

| Part | From | How |
|---|---|---|
| The write-path check in the same transaction, `Conflict` codes in words | `booking.md` §3.1 (capacity) | `occupies` counts overlapping records of the same resource (including the gap) instead of records per parent |
| `starts` / `duration` one reference away, the app's time zone | `calendar.md` §2, §3.1 (`zoned.ts`) | the same grammar and kit module |
| The owner's week view | the calendar page pattern | `calendar: Appointment`, unchanged |
| The owner's day view | calendar.md §5 lists "a day view" as later | the calendar gains `view: day` with a column per resource when its model `occupies` one |
| Confirm, and the owner's Cancel | standard actions (`set: { status: confirmed }`) | nothing new |
| The confirmation and cancellation mails | outgoing mail (integrations.md §4.1b) | `outgoing` on Appointment's create and status change |
| The customer's sign-in | email-code sign-in | nothing new; their appointments are theirs by ownership |
| The public Book button | a landing section `{ form: Appointment }` and `public.create` | the form of a model that `occupies` shows the slot picker in place of the date-and-time field |

## 4. What is new in the app

- **The free times** for a resource, a service length and a day: the resource's hours that day,
  minus breaks, `away` records and occupying records widened by the gap, cut into starts every
  15 minutes (or the service's length when shorter) where the whole length fits. A server
  function in the model's generated module; "anyone" merges every resource's times and books
  the first free one. It reads occupying records without returning whose they are, as the
  capacity's `places()` does.
- **The slot picker** (`src/kit/Slots.tsx`, copied only into apps with `occupies`):
  service, then resource (or anyone), then a day strip and the times, phone-first, from the
  server function; the earliest day preselected.
- **The data function's check** on create and on a change of `resource`, `starts`, `duration`'s
  inputs or `while`'s fields: inside the hours, outside breaks and `away`, no overlap with
  another occupying record of the same resource widened by the gap, else
  `Conflict("taken")` with the next free times in the answer. The scheduled model's update
  refuses hours that would leave existing appointments outside them, naming how many.
- **The customer's Cancel:** a standard action the generator adds when `cancelUntil` is set:
  offered to the record's owner until `starts - cancelUntil`, setting the status to `cancelTo`
  (Fable, 2026-10-13: explicit, not inferred).

## 5. ARCHITECTURE §2.4

1. **Common:** barbers, hairdressers, clinics, therapists, tutors, car services, consultations,
   room and court bookings: one resource's time is the most asked-for kind of booking.
2. **Deterministic:** hours, breaks, gaps and overlaps are interval arithmetic; no model.
3. **Less AI and ambiguity:** without it, every such app is a rule in words and custom code
   that a model writes differently each time, and overlaps are checked in a page or not at all.
4. **Technology-neutral:** times, minutes and references; nothing names a library.
5. **Better than free text and custom code:** the check must sit in the write path's
   transaction (two customers at once), the picker must agree with the check, and the summary,
   the tests and the owner's day view all read the same two keys.

## 6. Out of scope

- **Payment** and deposits, no-show fees.
- **Waiting lists** (a freed time offered to the first in line).
- **Several resources per appointment** (a barber and a chair, a doctor and a room). One
  resource covers the brief; a second `occupies` on one model can come when an app needs it.
- **Reminders** before the appointment (a daily hook can send them; a construct when several
  apps want the same).
- **Per-person weekly hours.** The business's hours plus `away` records cover the first
  version (Fable, 2026-10-11). They come when a tester has two people with different days: hours
  given on one person's record override the model's `schedule`, in the same grammar, so nothing
  in the spec changes then.
- **Recurring appointments** ("every second Tuesday"): an action that makes the copies.

## 7. Not this construct: an enquiry and a visit

The review's point: a carpenter or a builder does not want an instant booking. The customer
describes the job with photos and the carpenter comes to look before any price. That is a
**form**, not `occupies`: a public `Request` model (description, `pictures`, address, phone)
with `public.create`, a status workflow (`new | visitPlanned | quoted | won | lost`) moved by
standard actions, a mail to the owner on a new one (outgoing), and the visit itself as an
ordinary date-and-time field the owner sets, shown in a calendar page. Everything there is
built today; a starter can show it. If the carpenter later wants customers to pick the visit's
time, the visit becomes an `occupies` record of the carpenter's schedule.

## 8. Steps (when the support portal is done)

1. Core: `schedule` and `occupies` (schemas, validation, the IR), `setSchedule` and
   `setOccupies`, the summary's sentences, the spec reference. Units: the validation (`cancelTo`
   and `cancelUntil` included), the operations, and the free-time arithmetic as a pure function
   (hours, breaks, away, gap, overlap). A free-times test across a summer-time change catches
   the zoned.ts edge (Fable).
2. Adapter: "anyone" books the first free resource deterministically, the first in the spec,
   so two bookings at once cannot both land on the same person after a retry (Fable). Then the
   data function's check, the free-times server function, the customer's Cancel
   action, the form's slot picker (`Slots.tsx`), the calendar's day view by resource; the
   generated access test fills a time and sees the next booking refused.
3. A starter (a barber, beside the class-booking one), shown to one local owner before more,
   as A 101 says; test-apps: book the earliest time, see it gone, cancel inside and outside the
   window, the owner's day view.
4. Docs: a page on booking a person's time, beside the one on places.
