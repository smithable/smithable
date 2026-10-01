# The calendar page pattern (design)

Status: built 2026-09-30 by Opus, reviewed by Fable. Proposed 2026-09-29 by Fable. The last page pattern ARCHITECTURE §10.4 lists as "still to come" besides kanban. It is the most visible gap in the booking starter, whose schedule is a plain list today. It adds one page pattern, so merging this document is the go-ahead. It passes §2.4: common (classes, appointments, shifts, events, deadlines), deterministic, no model or custom code needed, technology-neutral, and it goes through the same data functions and access rules as every list.

## 1. What people get

- **A week view** on computers: days side by side, hours down the side, each record a block from its start to its end, overlapping records side by side. Previous, Today and Next, with the week in the address (`/schedule?week=2026-W40`), so a week can be shared and bookmarked.
- **A month view**, switched to with one button, for records that are days rather than hours (deadlines, holidays) or to look further ahead.
- **A day-by-day list on a phone**: the week's days with their records under them, which reads better on a small screen than a squeezed grid.
- **Opening a record**: a click opens it on its own page (its crud or data page) for those who may read it there; on a public schedule, a visitor gets the record's details in a small panel instead.
- **Adding a record**: for those who may create one, clicking an empty hour opens the new-record form with the start filled in.

## 2. The spec

```yaml
pages:
  schedule:
    calendar: Session                 # short form: everything inferred
    # calendar: { model: Session, starts: startsAt, duration: classType.durationMinutes, title: classType }
```

- **`starts`**: the date or date-and-time field that places a record. Inferred when the model has exactly one.
- **`ends`** or **`duration`** (optional, one of them): an end field of the same kind, or a whole number of minutes, either on the record or one reference away (`classType.durationMinutes`: the booking starter keeps the length on the class type, which is common). Without them, a date-and-time record lasts an hour and a date record the whole day.
- **`title`** (optional): what a block says. By default the model's title field, or, when it has none, its first required reference's title (a session shows its class type's name). A reference's title is allowed, as here.
- A calendar page needs `app.timezone`; without it validation warns and the calendar uses UTC. Records are placed by the app's time zone, never the viewer's: a studio in Mariehamn shows 09:00 to a visitor browsing from Stockholm.
- The operation `addCalendarPage page model [starts]`, and tier-0 phrases such as "add a calendar for sessions" and "show sessions in a calendar".

## 3. How it works

### 3.1 First, a fix: date-times in the app's time zone everywhere

Today forms turn a date-and-time into text and back in the browser's time zone (`toInput`/`fromInput` in `src/kit/format.ts`), while tables show it in the app's (`formatValue` with `app.timeZone`). A staff member entering 09:00 from another time zone, or a server test in UTC, stores a different moment than the page then shows. A calendar makes that visible at once, so the fix comes first: one small kit module, `src/kit/zoned.ts`, converts between an instant and the app zone's wall time with `Intl.DateTimeFormat` (the offset for a wall time, found in at most two steps, so the change to and from summer time is right), and forms, tables and the calendar all use it. Apps whose server and staff share the app's zone see no difference.

### 3.2 Loading only the range shown

The route's server function asks the model's data function for the records whose start falls in the range shown (the week, or the month's full weeks, plus a day on each side for records crossing midnight): `list(viewer, and(gte(starts, from), lt(starts, to)))`. So visitors see what `public.read` allows (and, once the articles design lands, only what its `where` allows), members their own records under private access, and no week ever loads the whole table. A duration one reference away comes with the referenced record, as a list's related titles do today.

### 3.3 The kit's `Calendar.tsx`

Written for Smithable, with no calendar library: the grid is CSS grid with rows per quarter hour, blocks placed by their start and length, overlaps laid out in columns by the usual sweep (records sorted by start, each put in the first free column of its overlapping group). Hours shown default to 07:00–21:00 and widen to the week's earliest and latest record. Weeks start on Monday. Colours come from the theme, one tone for all blocks in this version.

Accessibility: each day is a `section` labelled with its date, and its records an ordered list of links or buttons whose text is complete ("Vinyasa, Tuesday 30 September, 09:00–10:00"). The grid is their layout, not a second copy, so screen readers get a plain list per day. Previous, Today and Next are buttons with names, the week's heading is announced when it changes (`aria-live="polite"`), and the visual checks (axe, no sideways scrolling at 390 px) cover the page.

### 3.4 Sample data

Sample records of a calendar's model are placed around the day the sample data is loaded (the same weekday and hour as the sample, in the current and next week), so a new booking app's schedule is never an empty week. The generated seed stays byte-identical; only the dates it writes depend on the day it runs.

## 5. Out of scope, for later

- **Booking a place** in a session with a capacity (the booking starter's rule "never more confirmed bookings than its capacity" has no model yet). It needs its own design: a reservation model, the capacity check in the data function, and the member's "Book" and "Cancel".
- Repeating records ("every Tuesday at 09:00 until December"): an action that creates the copies is simpler than recurrence rules and fits the spec as it is.
- Dragging a block to move or resize it.
- Colour by a choice field or reference (the ux file's tones), week start and hours in `smithable.ux.yml`, a day view, iCalendar feeds.
