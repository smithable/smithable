# Book a person's time

Some apps book **places**: a yoga class at 09:00 has twelve, and each booking takes one (the booking starter). Others book **a person's time**: a haircut takes thirty minutes of one barber's day, and that barber can't cut two people's hair at once. This page is about the second kind, on the barbers starter.

```sh
smithable new my-shop --starter barbers
```

## 1. Whose time is booked: `schedule`

```yaml
models:
  Barber:
    fields: { name: string!, bio: text, portrait: picture }
    schedule:
      hours: { mon-fri: "09:00-17:00", sat: "10:00-14:00" }
      breaks: "12:00-12:30"
      gap: 10                  # minutes kept free after each appointment
      away: TimeOff            # days or hours away
  TimeOff:
    fields: { barber: Barber!, from: datetime!, until: datetime!, note: string }
```

- **`hours`** are the shop's week, the same for every barber, in the app's time zone (`timezone` under `app`); a barber's own days off are time away (below). A day not named is closed. A day can have two spans, like `sat: ["10:00-14:00", "17:00-20:00"]`.
- **`breaks`** are kept free every open day.
- **`gap`** is the minutes kept free after each appointment, to sweep up or write notes.
- **`away`** is a kind of record that blocks time: a holiday, a course, an afternoon at the dentist. Smithable reads its one reference to the barbers and its first two date-and-time fields, as when the time away starts and when it ends; the summary says which fields it reads. To name them, write `away: { model: TimeOff, resource: barber, from: from, until: until }`.

In words: *"Barbers have opening hours 9 to 17 on weekdays"*, then *"the barbers are open 10-14 on saturdays"* (each keeps the other days, the breaks and the gap).

## 2. What takes it: `occupies`

```yaml
models:
  Appointment:
    fields:
      service: Service!
      barber: Barber!
      startsAt: datetime!
      name: string!
      status: { type: requested | confirmed | cancelled, by: app }
    occupies:
      resource: barber           # whose time
      starts: startsAt
      duration: service.minutes  # the service's length, one reference away
      while: { status: [requested, confirmed] }
      cancelUntil: 12h
```

- **`resource`** is a required reference to a model with a `schedule`.
- **`starts`** is a date-and-time field, and **`duration`** the minutes, on the record or one reference away.
- **`while`** says which records take the time: a cancelled appointment frees it.
- **`cancelUntil`** gives the customer a **Cancel booking** button on their appointment until that long before it starts (`30m`, `12h`, `2d`). After that the button is replaced by a line saying to contact the shop. It sets the status to the value outside `while`; with several outside it, `cancelTo` says which.

In words: *"An appointment takes its barber's time"*. The start and the length are found by shape: the model's one date-and-time field, and its one whole-number field (or one on a record it refers to). When there are more, say them in the file, or ask in your own words.

## 3. What the app does

- **The form** shows a strip of days from today and the chosen day's free times, every quarter hour (or the service's length, when shorter) where the whole appointment fits. The form opens on the first day with a free time, so the earliest time is one tap away. Leave the barber empty for *anyone*: each time goes to the first barber free then, and choosing it fills in the barber.
- **Never two at once.** The time is checked again where the appointment is saved, in the same transaction: outside the hours, in a break, while away, or over another appointment (with the gap after it), it is refused with the next free times that day. Two people taking the same time at once cannot both get it. Moving an appointment is checked the same way.
- **The shop's day.** A calendar of appointments switches between Week, Month and **Day**, the day with a column for each barber.
- **Tests.** The generated access test books a free time and sees the same time refused the second time.

From the command line:

```sh
smithable op setSchedule Barber "mon-fri 09:00-17:00, sat 10:00-14:00" --breaks 12:00-12:30 --gap 10 --away TimeOff
smithable op setOccupies Appointment barber startsAt service.minutes status="requested | confirmed" --cancel-until 12h
```

The spec reference has every key: [One person's time](../spec/v0.1.md#one-persons-time).
