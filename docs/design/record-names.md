# A record's name from its parts (design)

From the tester's report of 2026-10-17 (B1, "make every booking understandable") and A 131 item 7.
A session is shown as "Session #12" wherever one is chosen or referred to: in the booking form's
picker, My bookings, the confirmation mail, the staff's lists. Nothing a person decides on should
need an id. The name the tester asks for is "Hatha · Mon 19 Oct, 08:00", with "Emma Lindqvist ·
All levels" under it where there is room.

Fable 54 made `namedBy` the one explicit key for a record's title (no field's name decides it,
inference.md). This note extends that key rather than adding another: the title is still one
thing, used everywhere the title is used today; what it may be made of grows.

## 1. The spec: `namedBy` takes a path, or parts

```yaml
models:
  Session:
    namedBy: [classType, startsAt]          # "Hatha · Mon 19 Oct, 08:00"
  Booking:
    namedBy: session                        # a booking is named as its session is
  Customer:
    namedBy: company                        # as today
```

- **A part** is a field of the model (as today), a reference, or a path one reference deep. A
  reference alone (`classType`, `session`) means that record's own name, whatever its `namedBy`
  is, so names compose one step at a time; a path (`classType.name`) picks that one field and
  ignores the other record's name. A model whose name would come back to itself through
  references is refused, naming the circle.
- **The kinds a part may be:** a stored string, text or markdown field (its first line, sixty
  characters at most, as today), a choice (its label in the app's language), a date or date-time
  (written in the app's language and time zone, the short form the kit's lists use: "Mon 19 Oct,
  08:00"; a date alone "Mon 19 Oct"), a number or money field (formatted as in a list), or a
  reference (its record's name). Not a picture, a file, a list or a formula that reads a list.
- **Several parts** are joined with " · ", left out where empty: a session without a class type
  is "Mon 19 Oct, 08:00", never "· Mon 19 Oct". When every part is empty (or hidden from the
  viewer, §4), the name is today's fallback: the model's label and number, "Session #12".
- **The short form** stays: `namedBy: company` is one part. Nothing written today changes meaning.

## 2. Where the name is used

Everywhere a record's title is used today, from one formatter in the generated app, computed
where the record is loaded (the data functions, through the `with` columns the parts need):

- the options of a reference field (the booking form's session picker) and filters by reference,
- a reference shown in a table, a card, a record page and its heading, the breadcrumbs,
- the calendar's item, the reserve block's heading,
- outgoing mail (a record in a mail is named by it; a mail's subject template reads it),
- Ask's answers and the API's `title` of a record,
- the activity log's lines and the trash.

- **Searching** by name searches every text part, through a reference too (a join on the referenced
  table's column, within the viewer's read scope), since a person searches for what they see.
- **Sorting** by name sorts by the first part's value: a reference part by the referenced record's
  first stored part (a join), a date by the date; empty values last; a record with the first part
  empty does not fall back to the second.

## 3. Presentation lines: the ux file, per page

The lines under a name are presentation, so they go in `smithable.ux.yml` on the page that shows
the records, beside `below`:

```yaml
pages:
  sessions:
    record: { subtitle: instructor.name, detail: [classType.level, capacity] }
```

The same part kinds and paths as `namedBy`; read by the same formatter. A list's card and a
reference picker (a selector may show the subtitle under the name) use them; a page that says
nothing shows the name alone. The spec says what a record is called; the ux file says what else
a page shows about it.

## 4. Access

A part the viewer may not read is left out of the name, never shown: a session whose class type
the viewer cannot read is named by its start alone. The name is computed on the server from rows
the viewer's read scope already returned (`readable`, the `with` columns); no part is fetched
around access. The API and Ask get the same name as the page.

- **A mail** is named for its recipient: the parts that person may read (an administrator reads
  every part).
- **The activity log and the trash** show the name at the time they are shown, to the people who
  see them (administrators and the record's readers); nothing stores a name, so a renamed class
  type renames its sessions everywhere at once.

## 5. The words around it

- **The summary** says it: "A session is named after its class type and its start." (A reference
  part: "its class type"; a path: "its class type's name"; a date part: "its start".)
- **`smithable validate --explain`** prints each model's name and where it came from: "Session:
  named by classType · startsAt (namedBy)", or "Order: named by number (by rule: its first
  short text field)".
- **`smithable validate --write`** (writeExplicit) writes the rule's single field as `namedBy`, as
  today. It never invents a path or a list: those are written by a person or an operation.
- **The operation** `setNamedBy <model> <part…>` takes one part or several (`setNamedBy Session
  classType startsAt`); `--none` removes the key. A rename or removal of a field a part
  names follows into `namedBy` and `record` (a removed one is taken out of the list, and the
  operation says so).

## 6. The booking starter

`Session: namedBy: [classType, startsAt]`, `Booking: namedBy: session`, and on the sessions
page `record: { subtitle: instructor.name, detail: [classType.level] }`. My bookings then reads
"Hatha · Mon 19 Oct, 08:00", the booking mail names the class and the time, and the staff's
session picker shows the instructor under each.

## 7. Build

1. Core (Fable): the schema and validation of `namedBy`'s parts (kinds, one reference deep, no
   circle), the IR (`namedBy: { parts: [{ field, through? }] }`), the formatter's contract in core
   (the parts and kinds, not the formatting), `setNamedBy`'s parts and the rename follow, the
   summary sentence, `--explain`, the spec reference; the ux `record` key.
2. Adapter and kit (A): the formatter in the kit (dates in the app's language and time zone), the
   data functions computing the name from the loaded rows (the `with` columns the parts need,
   access as for references today), every place in §2 reading it, the `record` lines on cards and
   pickers; the booking starter's values; tests (an inaccessible part left out; a name in a mail;
   the picker's subtitle) and pictures of the picker, My bookings and a session page.
