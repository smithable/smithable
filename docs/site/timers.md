# Things that happen on a clock

Some things should happen at a time rather than when someone presses a button: a reminder the day before a class, an invoice marked overdue a week after it was due, a post published when its time comes, a digest every Monday morning. A **timer** says so in `smithable.yml`. The app raises it itself, on time, and it is versioned, shown in What it does and undone like any other change.

A timer does one of two things: it runs an action, or it only raises its event, for an [outgoing](outgoing.md) entry to send a mail or make a call. Sending is always outgoing's.

## 1. At a date of each record

```yaml
timers:
  remind:
    on: Booking
    at: 1 day before session.startsAt   # a date or date-time of the record, or one reference away
    where: { status: confirmed }        # optional: only the records that fit

outgoing:
  reminder:
    when: remind                        # the timer's name, as an action's
    to: mail
    recipient: owner
```

- **`at`** is a stored date or date-time field of the model, or one reference away (`session.startsAt`), with an optional offset: `N minutes`, `hours` or `days`, `before` or `after`. Without an offset it fires when the time comes (`at: publishAt`).
- It fires **once per record** for that time. When the time moves (the class is moved), the timer follows it. A record whose time had already passed when the timer was added is left alone.
- **`run`** (optional) names a standard [action](actions.md) of the model, run for each record that is due: `run: markOverdue`. A record the action's own `when` does not fit is skipped, and Activity says so.
- Without `run`, the timer only raises its event: that is how a reminder with no change to the record is written, a timer and an outgoing entry on it.

## 2. On a clock

```yaml
timers:
  weeklyDigest:
    every: monday        # day, weekday, week, month, or a weekday's name
    at: "08:00"          # in the app's time zone
    run: sendDigest      # a custom action, run once
  payroll:
    cron: "0 6 25 * *"   # what every cannot say
    run: closePayroll
```

- **`every`** is `day`, `weekday`, `week` or `month` (a week and a month fire on their first day), or a weekday's name, with **`at`**, a clock time in the app's time zone.
- **`cron`** takes the five-field expression (minute, hour, day of the month, month, weekday: `*`, numbers, ranges, steps and lists) for what `every` cannot say.
- With a **custom action** in `run` the timer runs it once, so it has no `on`. With `on`, a clock timer runs its action over every record that fits `where`, and its event fires once per record.
- With neither `on` nor `run` (`morning: { every: day, at: "06:30" }`) it only raises its event, for a list mail: an outgoing entry with `list` that names it.

## What a timer may do

A timer runs as the app, with no one signed in: no role's rights apply, as for [calls in](incoming.md). The app's summary says each timer in one sentence ("Every Monday at 08:00: runs Send digest").

A timer follows a field that is renamed, and a field or an action it uses cannot be removed while it is there. A timer that an outgoing entry listens to cannot be removed until the entry goes.

## From the command line

```console
$ smithable op addTimer remind --on Booking --at "1 day before session.startsAt" --where status=confirmed
$ smithable op addTimer weeklyDigest --every monday --at 08:00 --run sendDigest
$ smithable op setTimer remind --where none
$ smithable op removeTimer remind
```

`setTimer` changes the parts it names: a new time replaces the old one, and `none` takes `where`, `run` or `on` away. The [spec reference](../spec/v0.1.md#timers) has every rule.
