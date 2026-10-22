# Timed actions: what the app does on a clock (design)

Status: step 1 (core) built 2026-10-22 by Fable (the section, its three forms, the words, the operations, outgoing's `when` on a timer, the spec reference); steps 2–4 by A follow. Proposed 2026-10-22 by Fable, from Johan's questions of 2026-10-21 ("did you implement
schedules? should it be in the spec, or an admin setting up scheduled actions in the app? should
mail go directly or always via an action?") and his go the same night, with two asks: a cron
expression may be the spec's form if the person can choose in a more normal way, and other
outgoing channels must fit later. Build after Johan reads it: core and the spec reference by
Fable, the generated app's tick and Studio's picker by A (§8).

## 1. Today

- `outgoing` fires when a record is created, changed or deleted, or when a standard action runs;
  it delivers `to: mail` or `to: <target>` (a signed POST), one recipient per entry
  (spec, "outgoing"; integrations.md §2). Nothing fires on a clock.
- The generated app has one daily tick (hooks.ts, `daily`), used by the trash's emptying and open
  to custom hooks. It runs a day after the server started, so "every morning at eight" is not
  written with it.
- Reminders, scheduled publishing and marking invoices overdue are parked in booking.md,
  appointments.md and articles.md on "a daily hook can do it today; a construct when several
  apps want the same". Three starters want it now (booking, invoicing, the blog's posts).
- `schedule` on a model already means a person's bookable hours (appointments.md), so the
  construct is called `timers`.

## 2. The rule

A **timer** is an event the app raises itself, at a time: on a clock, or relative to a date-time
of a record. It may run an action over the records the time has come for. What else happens, a
mail or a call, is `outgoing`'s, whose `when` names the timer as it names an action today. The
spec holds the timer, because what the app does on a clock is what the app does: versioned,
generated, shown in What it does, undoable through Changes. An administrator does not set up
schedules in the running app; what they may set at runtime is a value the timer reads from the
app's settings (an hour, on or off), which the spec names (§6).

```yaml
timers:
  remind:                                   # a name, as an action has one
    on: Booking                             # the records it runs for
    at: 1 day before session.startsAt       # a date-time of the record, or one reference away, with an offset
    where: { status: confirmed }            # optional, the dashboard's grammar
                                            # no run: the timer only raises its event; outgoing listens
  markOverdue:
    on: Invoice
    at: 7 days after dueOn
    where: { status: sent }
    run: markOverdue                        # a standard action of Invoice; skipped where its when does not fit
  publish:
    on: Post
    at: publishAt                           # as it is: when the time comes
    run: publish
  weeklyDigest:
    every: monday                           # day | weekday | week | month | monday … sunday
    at: "08:00"                             # a clock time, in the app's time zone
    run: sendDigest                         # a custom action, once per tick
  payroll:
    cron: "0 6 25 * *"                      # what every cannot say: five fields, the app's time zone
    run: closePayroll

outgoing:
  reminder:
    when: remind                            # a timer's name, as an action's
    to: mail
    recipient: owner
```

- **A record timer** has `on` and `at: <date-time field path> [N minutes|hours|days before|after]`,
  the field of the record or one reference away. It fires once per record for that time; when the
  time moves (the session is rescheduled), the timer follows and fires for the new time, never
  twice for the same record and time (§5). A record whose time has passed when the timer is added
  is left alone, and so is one that did not fit `where` when its time came and fits later: the
  time is the window, and it passed. The offset is written `<whole number> <minute|minutes|hour|hours|day|days> <before|after> <field path>`, nothing else; the
  parser takes the singular and the plural alike, and the summary and the formatter write the
  one the number wants.
- **A clock timer** has `every` and `at`, or `cron`. `every` is `day`, `weekday`, `week`,
  `month` or a weekday's name; `at` a clock time; `week` and `month` fire on the first day of
  theirs. `cron` is the five-field expression (minute, hour, day of month, month, weekday), for
  what `every` cannot say; Studio shows one picker for both and writes `every` and `at` when the
  choice fits them, `cron` when it does not (§7). Either way the summary says it in words
  ("every weekday at 08:00", "at 06:00 on the 25th of every month"). A clock timer with `on`
  runs its action over every record fitting `where`, and its event fires once per record (so an
  outgoing entry on it mails per record); without `on` it runs a custom action once, and its
  event fires once.
- **`run`** names a standard action of `on` (its `when` must fit the record, else that record is
  skipped and Activity says so) or a custom action. A timer without `run` only raises its event,
  which is how a reminder with no state change is written: the timer and an outgoing entry on it.
- **Delivery is never the timer's.** `outgoing` sends: mail today, a signed call to a target, and
  later the channels integrations.md §2 names (built in, from a plugin, custom). A timer names no
  channel, so a new channel is one more `to`, nothing in `timers`.
- A timer runs as the app, with no viewer, as incoming entries and the daily jobs do: no role's
  grants apply, the action's `set` may change a locked field as an action's may (record-rules.md
  §2), and the Activity line reads "by the timer remind". The records it reaches are all the
  model's that fit, within nothing else.
- Time is the app's time zone (`app.timeZone`), daylight saving by the zone; a clock time that
  does not exist on the day it changes runs at the next minute that does, and one that comes
  twice that night runs once, since a run is keyed by the time as written (§5).

## 3. The five questions (ARCHITECTURE §2.4)

Common: reminders, overdue marking, publishing at a time, digests; three starters want it today.
Deterministic: a time and an action, no model. Replaces hand-written daily hooks and anything a
host's cron would do, with a definition the spec can show and check. Framework-neutral: an event
and a tick, nothing of TanStack or SQLite in the grammar. One grammar for Studio's picker and
the generated tick, so what the form shows is what the server runs.

## 4. Validation

`every` with `at`, or `cron`, or `at` with a field: exactly one form, else an error naming the
three. `on` required with a field `at`, refused with `cron` or `every` only when `run` is a
custom action. `at`'s field is a date-time (or date) of `on` or one reference away; the offset
is a whole number of minutes, hours or days. `run` is a standard action of `on`, or a custom
action; a standard action with `on` elsewhere is an error naming the model. `where` as the
dashboard's. A cron expression is checked field by field; `*/N` and lists are allowed, names of
months and weekdays are not (the words are `every`'s). The summary line per timer; the spec
reference's section; the JSON Schema. A timer follows a renamed field or action and refuses the
removal of what it names, as outgoing does.

## 5. The generated app

- One module, `timers.server.ts`: a tick every minute (the daily tick stays for the trash), run
  from the server's start, that works out what is due: a clock timer whose next time has come, a
  record timer's records whose time (field plus offset) falls in the window since the last tick.
- Due times are found at the tick, never scheduled ahead: a record timer's query reads the
  field plus the offset as the record is now, so a moved time is simply found at its new time and
  nothing is kept to be dropped. A table `timer_runs` (timer, record id or null, due time as
  written, ran at, outcome) makes a run happen once: the tick inserts the row before acting and
  skips what is already there, so two processes or a restart never run the same thing twice, and
  a time that moved after its run is a new due time, a new row. A window the server missed (down
  for the night) is caught up differently by kind: a record timer's due records run late within a
  day, older ones are skipped and noted in Activity, since a reminder for yesterday's class helps
  no one; a clock timer runs once, late, however long the server was down, one run for all the
  times it missed, since the payroll must close and closing it twice is wrong.
- Each run goes through the action's data function with no viewer and the timer's name as the
  actor, in its own transaction, the outgoing entries firing as for any action; a failing run is
  noted and tried again next tick, three times, then given up with an Activity line.
- Development: timers do not fire in the preview and in tests on their own. `smithable timers`
  lists them with their next time; `smithable timers run <name> [--at <time>]` runs one as if the
  time had come, which test-apps uses on the starters (a reminder lands in the outbox, an
  overdue invoice changes status, a post publishes).
- Hosted apps have their process up, so the tick is the app's; a detached app keeps it, since it
  is in-app code with no host cron.

## 6. Settings a timer reads

Not in the first build: a timer's value may later come from the app's settings page
(`at: settings.reminderHours hours before session.startsAt`, `every: settings.digestDay`), so a
studio changes its notice without a change to the spec; the spec still says there is a reminder
and what it does. The same step gives `capacity`'s notice periods (booking.md §6) their
settings value. One mechanism, when asked.

## 7. Studio

A **Timers** group in What it does and Behavior, each timer a sentence ("A day before a session
starts, mails every confirmed booking's owner") linking to its entry; the form, in No code: what
(the model, or none), when (a picker: "Every day / weekday / week / month / a weekday, at hh:mm",
or "N days/hours before/after <a date field>", and under "Advanced" a cron field that takes the
picker's place when filled), only where (the condition's control), then (an action, or nothing).
The form writes `every`/`at` or `cron` as §2 says. Who can has nothing to show: the app runs
them. The summary's words are the test of the grammar: a timer that cannot be said in one
sentence is too clever.

## 8. Steps

1. Core (Fable): the section's schema, parser and IR (`timers`), validation (§4), `summarize`,
   the operations `addTimer`, `setTimer`, `removeTimer`, the JSON Schema, the spec reference,
   `outgoing`'s `when` taking a timer's name.
2. Adapter (A, with Fable on the data-layer call): `timers.server.ts`, `timer_runs`, the
   minute tick beside the daily one, Activity lines, `smithable timers` and `timers run`.
3. Starters (A): booking `remind` (a day before, mails the owner), invoicing `markOverdue`
   (seven days after `dueOn`), the blog's `publish` (at `publishAt`); test-apps on each.
4. Studio (A): the Timers group and form (§7).

## 9. Not in this

An administrator defining schedules in the running app (the spec is where behaviour lives; §6
gives them the values that are theirs). Per-user reminder preferences (a user setting, later).
A channel chosen on the timer (delivery is `outgoing`'s). Retrying an action beyond the tick's
three tries. Timers for the hosted service itself (backups, bills): smithable-cloud's.
