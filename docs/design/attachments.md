# Attachments: a file on a record

Design, 2026-10-06 (Fable). Johan asked (2026-10-06) what "file attachments" would mean. Status: a proposal; built on his word.

## 1. What it is

A `file` field holds one document on a record, as `picture` holds one picture: a contract on an invoice, a CV on an application, a ticket on a booking, a report on an incident, a receipt on an expense. `files` holds several, as `pictures` does.

```yaml
models:
  Invoice:
    fields:
      number: string! unique
      contract: file                   # one document
      receipts: files                  # several, at most ten
```

## 2. How it behaves

- **In the form**, a file input; the record page shows the file's name and size as a link, and a `files` field as a list with remove and reorder, like the pictures strip without the thumbnails.
- **Stored** under `DATA_DIR/uploads/`, named by its content as pictures are, so `smithable backup` and point-in-time recovery cover it with the database. The record keeps `{ file, name, type, size }`: never the bytes in a database column, which would swell the database and every backup.
- **Served** at `/files/<model>/<id>/<field>` through the model's data function, so a file can be read exactly when its record can. Sent as a download (`Content-Disposition: attachment`, the stored type, `nosniff`), so nothing is ever run in the browser; a PDF or an image may open inline, since the browser renders those itself.
- **Kinds and size:** PDF, the Office formats (docx, xlsx, pptx), OpenDocument, plain text, CSV and the picture kinds, at most 10 MB; the kind is read from the file's own header, not its name. Anything else is refused in the app's words ("Choose a PDF, a document, a spreadsheet, a text or a picture"). The sizes are defaults in the kit, not settings, as the pictures' are.
- **Removing** a file, or its record, removes the stored file when no other record holds it, as for pictures. Whoever may add or change the model's records may send one; sending counts against the write limits.
- **The API** takes a file as the body of `PUT /api/v1/<model>/<id>/<field>` with its type in the header, and gives it back at the same address, so programs can attach and fetch documents; this is the same step as the picture upload the API lacks today, done once for both.
- **Sample data** has no files; a `files` field starts empty.
- A file field cannot be `unique`, have a default, or appear in formulas, searches, dashboards or calendars, as a picture cannot.

## 3. The five questions (ARCHITECTURE §2.4)

1. Common: every business app has documents on records; it is the first thing after pictures that people ask for.
2. Deterministic: the pictures code is the mould; nothing here needs a model.
3. Less ambiguity: "attach the contract" otherwise means custom code with storage, access and serving written by hand each time.
4. Technology-neutral: a field type; where the bytes live is the adapter's.
5. Better than free text plus custom code: the access rule (readable when the record is) and the backup are the parts people get wrong by hand.

## 4. What it is not

No preview, no editing, no versions, no virus scanning, no sharing a file by link outside the app. A file is as private as its record, which is the whole point. Two later additions ([file-review.md](file-review.md), 2026-10-09): a model may hold its pictures and files for review before others see them (`review`), and a `SCAN_URL`, when set, is asked about every file before it is stored; nothing is scanned without it.

## 5. Steps

1. Core: the `file` and `files` types (ir.ts, field-type.ts, the models section), their validation and schema, `addField … file`, the summary ("has a contract, a document"), the spec reference.
2. Adapter and kit: storage and serving beside the pictures code (uploads.ts, the file routes), the form control, the record page's list, the API's PUT and GET, test-apps checks (the kind read from the header, the size, access through the record, removal).
3. A starter shows it: the invoicing starter's invoice gets a `contract: file`.

## 6. Which files may go on a record (2026-10-12, Opus A; Fable re-reviews)

A stored file is named by its content (a hash), and a file is as private as the record that has it. So a file's name must never be enough to put that file on another record: the record that took it would then let its own readers download it.

- **At upload** (`/files/<model>/<field>`, and the API's PUT), the app records who uploaded the file (nothing for a visitor), for which model and field, and when. The answer carries a random **receipt**. These are kept in the `uploads` table.
- **On create and update**, each picture or document in the values is accepted only if:
  - the record already had it in that field (a form saved again unchanged), or
  - it comes with a receipt that the same person got for that model and field within the last day.

  Otherwise the write is refused: "This file was not uploaded here, or too long ago: choose it again." The receipt is never kept in the record.
- **There is no reuse of a file another record has**, even one the person may read: nothing needs it. A copy (actions.md §8) reads the original on the server, and sample data is put in directly.
- **Storing and permission are separate.** Two uploads of the same bytes are still one file in storage. Each upload gets its own receipt, and that receipt is what grants putting the file on a record.

The generated access tests send their files with their sender's receipt, so every app's tests use the same rule. Files that were uploaded and never saved are the next step: a daily sweep of `uploads` older than a day, deleting the file when no record has it.
