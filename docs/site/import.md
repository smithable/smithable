# Bring records in from a spreadsheet

An app starts empty, but the records often exist already: customers in a spreadsheet, last year's orders in another tool. A list page's **Import** reads them from a CSV file, which any spreadsheet saves (Save as, then CSV) and checks every row: the rows that fit go in, and the panel lists the ones it left out. This page shows it on the CRM starter.

## On a list page

**Import** is under the list for every role that may add that kind of record. It asks for a CSV file whose first line names the columns:

```csv
Number,Customer,Status,Total,Placed at
A-1001,Nordvik AB,Placed,"1 250,00",3.11.2026
A-1002,Hansen & Co,Shipped,480.50,2026-11-04
```

- **Columns** are matched to fields by the field's label as the app shows it ("Placed at") or by its name (`placedAt`), in any order. A column no field is named after is left out, and the panel says which.
- **A choice** is matched by its label ("Placed").
- **A reference** is matched by the title of the record it names: "Nordvik AB" is the customer of that name. No such record, or two of them, is a problem on that row.
- **Dates** may be written plainly (`3.11.2026`, `2026-11-04`), and **numbers** with a decimal comma (`1 250,00`) or a point.

Before anything goes in, the panel shows every problem, by line and column, and how many records will be added. A row with a value that is not one of the choices, not a date or not a number is left out, and the rest go in when you press **Import 12 records** (the rows that fit). A problem with the file itself stops it all: a required field no column fills, two columns for one field, a column no field can be filled from, or more than ten thousand rows. Fix the file and choose it again.

## Take it back

For a day, **Undo the import** takes the records back, in the panel and on the line the import left on the app's activity page. On a kind of record with a trash, they go to the trash. On one without, the records nobody has changed since are deleted, and the panel names the ones that were kept. An import is undone once.

## From the command line, and from other programs

On your own machine, the same file goes into the app's own data with

```sh
smithable import Order orders.csv --dry-run   # what would go in, and every problem
smithable import Order orders.csv
```

It checks the file the same way but adds every record or none: one refused row and nothing goes in, with every problem listed. There, a date must be written `2026-11-04`.

Another program adds many records in one call through the [API](api.md#many-at-once), with an address to take them back. There, too, each record is added or refused on its own, and a reference is the other record's id, not its title.
