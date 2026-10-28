# Tell people and other systems

When something happens in an app, it can say so: a mail to a person, or a call to another system. You write what should happen in `smithable.yml`. The app keeps each message in an outbox, sends it after the change is saved, and tries again when it can't get through.

## 1. Mail a person

```yaml
outgoing:
  bookingMade:
    when: Booking created            # created | changed | deleted, or an action's name
    to: mail
    recipient: owner                 # the record's owner, a role (admin), or an email field
```

- **`when`** is `<Model> created`, `changed` or `deleted`, or the name of a button's action (it fires once the action has run). For a [custom action](code.md) there is no record: a call's body carries the action's input and output, a mail shows them and goes to a role, and `where` and `fields` are refused. Code of your own can queue mail and calls the same way with `tell` and `tellMail` ([your own code](code.md#mail-and-web-calls-from-code)).
- **`where`** (optional) narrows it: `where: { status: shipped }`. A change counts only when the record fits afterwards and did not fit before, so editing an order that is already shipped sends nothing.
- **`recipient`** can be:
  - `owner`;
  - a role (every user who has it);
  - an `email` field of the record, or one a reference away (`customer.email`);
  - a field that refers to a user.
- **The mail** has the subject and text from `smithable.content.yml` (`outgoing: { bookingMade: { subject: Your booking, text: … } }`), then the record's fields as its page shows them, then a link to the record. The person who made the change is not mailed about their own change, except when they made the record: the owner of a new booking gets its mail as a confirmation.

From the command line: `smithable op addOutgoing bookingMade "Booking created" --to mail --recipient owner`.

## 2. Call another system

```yaml
outgoing:
  incidentResolved:
    when: Incident changed
    where: { status: resolved }
    to: statusFeed                   # a name; its address and secret are settings
```

The app posts JSON to the address set for `statusFeed`:

```json
{ "event": "incidentResolved", "model": "Incident", "happened": "changed",
  "at": "2026-10-13T08:00:00.000Z", "record": { "id": 12, "title": "…", "status": "resolved" } }
```

The record is as the API shows it. Each call carries three headers:

- **`X-Event`**: the entry's name.
- **`X-Signature-256`**: `sha256=` and the HMAC-SHA256 of the body with the target's secret, so the receiver can check the call came from the app.
- **`Idempotency-Key`**: the same on every try of one call, so a receiver that got it once can tell a repeat.

A receiver checks the signature like this:

```js
import { createHmac, timingSafeEqual } from "node:crypto";
// secret: the target's secret; rawBody: the request's body exactly as it came; signature: its X-Signature-256 header.
const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
const ok = expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
```

**Settings.** A target's address and secret are two settings named after it: `OUTGOING_STATUSFEED_URL` and `OUTGOING_STATUSFEED_SECRET`.
- On your own server, they are environment variables.
- On smithable.ai, you set them on the project's Connections page.
- Until they are set, the calls wait in the outbox, and `smithable deploy` warns about the target.

**Which addresses the app will call.** Only http or https. Never the app itself, and in a published app never a private or local network. The check is made on the address the app actually connects to, so a name that later points somewhere else cannot get round it. On smithable.ai, the app reaches the internet only through the service's outgoing gateway, and only for the Connections you added.

## 3. Delivery and its history

- **The outbox:** a mail or call is written in the same step as the change, and sent right after. So a change never waits for another system, and nothing is sent for a change that didn't happen.
- **Retries:** a failed one is tried again after 1, 2, 4… minutes, at most three hours apart, for a day. Then it is given up and shown as failed in Activity.
- **Activity** (Admin → Activity, for administrators) has a line for every mail and call. A call's line says when it was sent, which entry it was and the answer's status.
  - **A target's delivery history is Activity filtered to it:** choose it under *Sent to*, or open `/team/activity?target=statusFeed`. The page then starts with "Calls to statusFeed" and the last call's time and answer, so you see at once whether deliveries work.
  - **Send again:** a mail or call that was given up has a *Send again* button.
- **On smithable.ai,** a call the service refuses says why in its line. An address you haven't connected yet waits until you add it on the Connections page.

## 4. In the preview

The preview sends no mail and makes no calls. Mails stay in its outbox, and calls to a target are skipped. Activity shows both as what a published app would do.
