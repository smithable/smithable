# Reports: a day's list, a list by mail on a clock, an export, a period (design)

Status: 2026-11-03, Fable, from Johan's questions the same day: "is it easy for a booking app's
owner to get an overview of a specific day's bookings? could they get a scheduled report? reports
and dashboards we should add at some point" and "is an admin the one who builds the site or the
owner/shop? they could be different people and interested in different things" (backlog Fable 95
and 96). Four small constructs on what exists, and the three people an app has.

## 1. What exists

- **Dashboards** (spec, Dashboards): `count`, `sum`, `average`, a number `by` a month, week,
  quarter or year or by a choice (one reference away too), a `list` of the newest or of what is
  `due` (`when: dueOn, within: 2 weeks`), a `query`'s records, the latest changes. The numbers
  follow the viewer's access.
- **Lists** filter by their model's fields, a date as a range or a relative value (`today`,
  `thisWeek`, `thisMonth`, `upcoming`, `past`), in the address, so a view can be linked.
- **The calendar's day view** shows a day's sessions with the places taken (the booking starter's
  schedule); a session's page lists its bookings.
- **Timers** on a clock (`every: day, at: "06:30"`) run a custom action; **outgoing** mails a
  role, the owner or an address on a record, about a record.

So the booking owner today opens the schedule's day, then each session. What is missing is one
list of the day's bookings, a mail with that list every morning, a file to take away, and a
dashboard that can be turned to last week.

## 2. Four constructs

### 2.1 A filter one reference away

`filters: [session.startsAt]` on a crud page of bookings: a date, choice, reference, number or
yes/no field of the record the reference names, one step, as dashboards' `by` has it
(`by: customer.segment`). The chips, ranges and relative values are the field's own; the address
carries `?session.startsAt=today`; `defaultFilter` may name it. The SQL joins the one reference.
Not two steps, not lists. The same step is given to a dashboard list's and a mail list's `when`
(2.2, 2.4): `when: session.startsAt` means the session's date. This alone gives the booking starter a staff page "today's bookings":
`bookings: { crud: Booking, filters: [session.startsAt, session.classType], defaultFilter:
{ session.startsAt: today } }`.

### 2.2 A list in a mail, on a clock

An outgoing entry may listen to a clock timer and carry a list instead of a record:

```yaml
timers:
  morning: { every: day, at: "06:30" }
outgoing:
  todaysBookings:
    when: morning
    to: mail
    recipient: admin                         # a role, or an address field is no use here: no record
    list: { model: Booking, when: session.startsAt, within: today, columns: [session, attendee, status] }
    empty: skip                              # skip (unsaid) | send: a mail that says "nothing today"
```

`list` is the dashboard tile's grammar (`model`, `where`, `when` with `within`, a `query` instead
of a model, `limit`), `when` reaching one reference as 2.1 says, `within` taking `today` and
`tomorrow` beside the `<n> days` and `<n> weeks` it has, plus `columns`, the fields the mail's table shows in that order, each one
the record page could show (as `show` on an outgoing entry). `within: today` means the day that
starts when the timer fires, in the app's time zone; `tomorrow` the next. The mail's subject and
text come from the content file as for any entry, with `{count}` and `{date}` as placeholders; the
body is the table, each row's title a link to the record. Which entry carries a list is decided by
the timer its `when` names: a clock timer (`every` or `cron`, no record) makes the entry a list
mail and `list` is required; a record timer (`on` and `at`) keeps mailing per record as today, and
`list` is refused there. The records are those the app may read: a timer runs as the app, so the
list is everyone's, which is why the recipient must be a role granted `read` on every model the
list shows (`admin` always is; a `staff` role with the record rule alone is refused, since the mail
would show it records it cannot open), never an address field or a customer. The content file's `empty: send` text covers the
quiet morning.

### 2.3 An export

Every list already has one: **Export CSV** under the table, and on the selection bar for the chosen
rows. It gives the list as it stands, the filters, search and sort applied, within what the viewer
may read, up to the app's cap (fewer for a visitor), and says so when it cuts. So no key turns it
on, and what the bookings and invoices pages need they have.

What changes: the file is named `<page>-<date>.csv` (the app's day), and times are ISO in the app's
zone with their offset (`2026-11-03T09:00:00+02:00`), so a column reads as the app does. Values stay
what a spreadsheet can use: amounts plain decimals that sum, a reference by its title, a choice by
its label, the table's labels as the first row. Files and pictures are left out, and so is a list
field (`bookings: Booking[]`); a count of one is a formula field, and that is exported as its number.

`export: false` on a crud page takes the button away, from the list and the selection bar, for a
page an owner wants kept in the app. It takes nothing from existing apps. The API's CSV is a separate
door, for a program with a key, and stays.

### 2.4 A period on a dashboard

A dashboard may name its clock: `overview: { dashboard: { … }, period: issuedOn }`, a date field
every tile's model has, or a map per model (`period: { Invoice: issuedOn, Payment: paidOn }`). The
page then has the period chips the lists have (`thisWeek`, `thisMonth`, `lastMonth`, `thisYear`, a
range), in the address as `?period=lastMonth`; each `count`, `sum`, `average` and `list` tile is
scoped to it, a `by` chart shows the bars inside it, and a `due` list and `activity` ignore it.
Unsaid, a dashboard is as today: all time, a `by` chart over its own window.

## 3. The builder, the owner and the staff

Today the app's administrators are the addresses in `admins:`; `smithable new` writes the
builder's, and the starters describe the admin as the staff ("Studio staff. Manage the schedule").
On the hosted service the project's owner builds in Studio and need not be an administrator of the
running app at all, so a consultant building for a shop is already possible; what is missing is the
words and the shape.

Three people, in words the starters and the docs use the same way:

- **The builder** has Studio and the spec. They are an administrator of the app only while they
  also run it: when the owner's address goes into `admins:` the builder's comes out, unless the
  builder says they run it too; the users page shows who the administrators are either way.
- **The owner** is the app's administrator: the team (the users page), the settings, the money,
  the reports, the mail that comes in and goes out. `admins:` are the owners.
- **The staff** is a role: the day's work (the schedule, the cases, the orders). Every starter gets
  a `staff` role described as such, and its `admin` description says the owner's work.

What changes: each starter's roles and descriptions (A); the users page's words ("administrator"
is the owner, never the builder) and the docs' "who is the administrator" paragraph (C); Studio's
first-build questions ask, when the builder says the app is for someone else, for the owner's
address, which goes into `admins:` beside or instead of the builder's (A, Studio). Nothing in the
spec changes: `admins` and roles already carry it.

## 4. ARCHITECTURE §2.4

1. Who asks: the booking owner's day, the shop owner's morning, every app whose owner reads on the
   phone and files in a spreadsheet; the builder-for-a-client case.
2. Smaller construct: a custom action that mails a list (code for every app; refused: the common
   case needs no code); a saved filter as the report (exists: a filtered list is a link; the mail
   and the file are what it lacks).
3. Deterministic: yes, all four are queries over the records with the viewer's or the app's access.
4. Undo: each is one key (`filters` entry, `outgoing` entry, `export`, `period`); the operations
   `setFilters`, `addOutgoing --list`, `setExport`, `setPeriod` and their undo.
5. Plain words: "today's bookings"; "every morning at 06:30, the day's bookings to the
   administrators"; "download the list"; "last month".

## 5. Steps

1. Core and adapter: 2.1 (a filter one reference away), the smallest; the booking starter's staff
   bookings page with it (A).
2. Core and adapter: 2.2 (a timer with no record, an outgoing entry with `list` and `empty`, the
   mail's table), the booking starter's morning mail; a content-file text (A, with Fable on the
   core grammar).
3. Adapter and core: 2.3 (the file's name and zone, `export: false`) (A).
4. Core and adapter: 2.4 (`period`), the invoicing starter's overview (A).
5. The three people (§3): starters' roles and texts (A), docs (C), Studio's owner question (A).
Each step its own pull request; the spec reference with each.
