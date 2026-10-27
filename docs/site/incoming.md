# Mail and calls into your app

Other things can put records into an app: a mail sent to a support address, or a call from another service, such as a monitor that finds a site down. You say in `smithable.yml` what each one does. The app gives it an address of its own, `/incoming/<name>`, checks the caller's secret, and adds the record as a role you choose.

## 1. Mail that becomes a record

A support desk where each mail to the support address becomes a request:

```yaml
incoming:
  support:
    mail: true
    create: Request
    set: { status: new }
    fields: { from: email, subject: title, body: body, attachments: files }
```

- **`fields`** says where each part of the mail goes:
  - `from` to an email or text field: the address alone, without the name;
  - `subject` to a text field;
  - `body` to a text or Markdown field: the mail's text, or its HTML without the tags;
  - `attachments` to a `files` or `file` field.
- **`set`** gives the other fields their values, here `status: new`.
- **Attachments** are kept as uploads are: at most 10 MB each, checked, and held for review when the model reviews that field (`review`), so nobody else sees a file until it is approved.

From the command line: `smithable op addIncoming support --mail --create Request --fields from=email subject=title body=body attachments=files`.

### Where the mail comes from

The app doesn't read a mailbox itself. Something passes each mail on to `/incoming/support` as JSON in this shape:

```json
{
  "from": "Ada Lovelace <ada@example.com>",
  "to": "support@your-domain.example",
  "subject": "The invoice page is blank",
  "text": "Hello, since this morning…",
  "html": "<p>Hello, since this morning…</p>",
  "attachments": [{ "name": "screenshot.png", "type": "image/png", "data": "<base64>" }]
}
```

That can be:

- **On smithable.ai:** a mailbox you connect to the app. The service reads it and passes each new mail on.
- **Hosted yourself:** your own receiver, a small program that reads a mailbox (IMAP, for example) or takes mail from an inbound-mail service, and posts each mail in the shape above.

## 2. Calls from other services

A monitor that posts JSON when a site stops answering, so each alert becomes an incident:

```yaml
incoming:
  monitorDown:
    create: Incident
    set:
      title: "{check.name} is not responding"   # {path}: a value from the call's JSON
      status: investigating
      detectedAt: NOW()
    id: "{event.id}"                 # optional: a call seen in the last day is not acted on again
    as: staff                        # the role the call acts as
```

- **`set`** gives each field a value: a fixed one, a formula such as `NOW()`, or text with `{path}` placeholders filled from the call's JSON (`{check.name}`, `{items.0.id}`).
- **`as`** is the role the call acts as; the record goes through that role's rules. Without it the call acts as an administrator, and the app's summary says so.
- **`custom: true`** hands the call to your own code instead, in `src/custom/incoming/<name>.ts`, for what `set` and `fields` can't say, such as finding a record and changing it.

From the command line: `smithable op addIncoming monitorDown --create Incident --set "status=investigating" --as staff`.

## 3. The secret, repeats and answers

- **The secret** is a setting, `INCOMING_<NAME>_SECRET`, for example `INCOMING_SUPPORT_SECRET` (the name in capitals: `monitorDown` reads `INCOMING_MONITORDOWN_SECRET`); without it every call is refused with `401`. The caller sends it as `Authorization: Bearer <secret>`. With `signed: sha256`, it sends a signature of the body in `X-Signature-256` instead. Without the setting, the address refuses every call.
- **Repeats:** services try again when they don't hear back. A call carrying an id the app saw in the last day, in the `Idempotency-Key` header or in the value `id` names, is answered as received and not acted on again.
- **Answers:** `201` with the new record's id; `200` for a repeat or a custom call; `401` for a wrong secret or signature; `422` when the record is refused, for example a required field left empty.

The full rules are in the [spec reference](../spec/v0.1.md#incoming).
