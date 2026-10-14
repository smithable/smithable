# Mail threads: a reply joins its request (design)

Status: 2026-10-14, Fable, on Johan's question for the support portal: "when we send from the
support portal it will use the same id and subject; if they reply it will append to the
existing support case". `integrations.md` §3's mail kind (built 2026-10-13) makes one record per
mail; nothing yet joins a reply to the record its mail was about, and the mails an app sends
carry no case number and no threading headers. This note adds both. A build for A, with one
change in the hosted mailbox watcher for B; merging it is the go-ahead.

## 1. What people get

- **A customer** writes to support@ and gets "We got your request" with the request's number
  in the subject, `Printer out of toner [Harbour Support #12]`. Every mail from the portal about
  that request carries the same tag and threads under the first in their mail client. When
  they reply, by the Reply button or by writing the tag in a new mail, the reply lands on
  request 12 as a message, not as request 13.
- **Staff** see the request's page with its messages in order, each with who wrote it and when,
  and a Reply button that mails the customer from the page. A reply from the customer to a
  closed request reopens it, when the spec says so.
- **The maker** adds two lines to the incoming entry (`reply`), and the Message model it
  names. Nothing else: the tag, the headers, the matching and the reopening come with them.

## 2. The spec

```yaml
# smithable.yml
models:
  Request:
    title: string!
    email: email!
    body: text
    status: new | open | closed = new
    files: files
    messages: Message[]           # the reverse side of Message.request, as today
  Message:
    request: Request!
    from: email!
    body: text!
    direction: in | out = in
    files: files
incoming:
  support:
    mail: true
    create: Request
    fields: { from: email, subject: title, body: body, attachments: files }
    set: { status: new }
    reply:                        # NEW: a mail that answers one of a request's thread
      create: Message
      fields: { from: email, body: body, attachments: files }
      set: { direction: in }
      then: { status: open }      # on the request, optional: a reply reopens it
actions:
  Request:
    reply: { add: { Message: { direction: out, body: } } }   # asks for the body, as `add` does
outgoing:
  requestReceived: { when: Request created, to: mail, recipient: email }
  replySent: { when: Message created, where: { direction: out }, to: mail, recipient: request.email }
```

- **`reply`** on a mail-kind incoming entry: a mail that belongs to the thread of a record this
  entry created (§3) becomes one record of `reply.create` instead of a new `create`. That model
  must refer to the created model exactly once (`Message.request`), as an action's `add`
  requires; the engine fills the reference. `fields` names where the mail's parts go, as the
  entry's own `fields` does; `set` the rest. `then` sets fields of the record the reply joins,
  for "a reply reopens a closed request"; without it the request is left as it is.
- **The tag** is `[<app name> #<id>]` at the end of the subject, the record's own id: the
  numbers people already see in the app's addresses (`/requests/12`). No new key.
- **Validation:** `reply.create` exists and refers to `create` once; `reply.fields` parts are
  the mail's (from, subject, body, attachments) and their fields have the right types, as for
  the entry's `fields`; `then` names fields of `create` with values they accept; a warning when
  the `as` role may not create the reply model. The summary adds "a reply to one of them is
  added to it as a message".
- **Operations:** `addIncoming … --mail --create Request --fields … --reply Message
  --reply-fields from=email body=body attachments=files [--reply-set direction=in] [--reply-then
  status=open]`; `setIncomingReply <name> --create <Model> --fields … [--set …] [--then …]`
  and `setIncomingReply <name> --none` on an existing entry. A rename of a model or field
  follows into `reply` as it does into `fields`.
- **Why on the incoming entry and not on the model:** the thread is a property of the mail
  address, not of the Request: an app with two mailboxes (sales@, support@) can make two
  models or the same one, and each entry says what a reply to its own mails becomes.

## 3. How a mail finds its thread

1. **By the headers first.** The app keeps every message id it sends or receives about a
   threaded record in a small kit table, `mail_threads` (`model`, `record_id`, `message_id`,
   `at`). An incoming mail's `In-Reply-To` and `References` are looked up there; the first hit
   is the thread. This is what every mail client sets on Reply, and it survives a changed
   subject.
2. **By the tag second.** A bracket group ending in `#<number>` anywhere in the subject
   (`\[[^\[\]]*#(\d+)\]`), for a forwarded mail or one typed by hand, whose headers do not
   point at the thread. The number must be a record of `create` that exists; otherwise the
   mail is new.
3. **Neither:** a new record, as today.

A mail that matches joins the thread whoever sent it (the customer's colleague answering from
another address is still about request 12; the message shows its own `from`). A mail about a
deleted record is new. An automatic reply (`Auto-Submitted` other than `no`, `Precedence`
bulk, junk, list or auto_reply, a delivery report) joins the thread as a message but sends
nothing back: `requestReceived` and any entry on the reply model are not run for it, so two
auto-responders never mail each other. The hosted watcher already drops such mail before the
app sees it; the rule is in the app too, for a self-hosted receiver that does not.

**What the host passes on:** the payload of `integrations.md` §3 gains `messageId`,
`inReplyTo` and `references` (an array), read from the mail's headers, and `autoSubmitted`
(the reason, or nothing). The hosted watcher (B) adds them; a self-hosted receiver does the
same. An app that gets a payload without them still works by the tag.

## 4. What goes out

For a record that a mail-kind entry creates, and for its reply model, every outgoing mail
(`to: mail`) is a thread mail:

- **Subject:** the content file's subject if the entry has one, else the request's title
  (the original subject; for the reply model, its request's title), with the tag at the end.
  A client's `Re:` is left to the client.
- **Headers:** `In-Reply-To` the thread's latest received message id, `References` the
  thread's ids, oldest first, the last twenty; `Reply-To` the mailbox the entry is fed from,
  the setting `INCOMING_<NAME>_ADDRESS` (the hosted service sets it from the connected
  mailbox; self-hosted the owner does, with the secret). Without it the reply goes to
  `MAIL_FROM`, as today. Every mail the app sends is marked `Auto-Submitted: auto-generated`
  (RFC 3834), so auto-responders do not answer it and a self-hosted watcher can drop the app's
  own mail; the hosted relay also sets `X-Smithable-App`, as it does today. (Built 2026-10-14:
  the kit sets no header naming Smithable, since a detached app names it nowhere.)
- **The body of a mail about a reply model record is its body part alone** (the field
  `reply.fields.body` names), with the content file's text above it if the entry has one: a
  reply reads as a letter, not as a record with labels, and the customer gets no link to a page
  they cannot open. Every other mail keeps today's form (the fields as the record page shows
  them, the link).
- **Kept:** the message id of every thread mail sent, in `mail_threads`, so the customer's
  reply to it is found by its headers.

The sender is the outbox that exists (`outgoing.server.ts` → `mail.ts`); the subject, the
headers and the body form are decided when the outbox row is written, in the change's
transaction, so a retry sends the same mail.

## 5. New in the app, and where it comes from

| Part | New or reused |
|---|---|
| `reply` on the mail-kind entry, validation, summary, operations, schema, spec reference | new in core, beside the mail kind's own (`sections/incoming.ts`) |
| `mail_threads` | a kit table, like `incoming_seen` and `outgoing_mail` (`schema.ts`); `smithable upgrade` adds it |
| The incoming route's matching (§3) and the reply record | the generated route (`incoming.ts`), one more branch before `create` |
| The thread subject, the headers, the reply body | `outgoing.server.ts` when the row is written; `mail.ts` sends headers it is given (`inReplyTo`, `references`, `replyTo` is there already) |
| The request page's messages in order with a Reply button | nothing new: the reverse list and the action's form, as any related records |
| The payload's header fields, `INCOMING_<NAME>_ADDRESS` | the hosted watcher and the connection (B) |

## 6. ARCHITECTURE §2.4

1. **Common:** every app fed by a mailbox; support, orders by mail, applications, bookings
   that are confirmed by mail. The second mail of every conversation is a reply.
2. **Deterministic:** headers, a tag, a table; no model.
3. **Less AI and ambiguity:** without it every such app needs a custom incoming handler that
   parses subjects and keeps message ids, written differently each time.
4. **Technology-neutral:** a model for the reply and where the mail's parts go; the headers
   are mail's own, not a provider's.
5. **Better than free text and custom code:** the ids sent and received, the subject, the
   headers and the reopening must agree across the incoming route, the outbox and the host's
   watcher; only the engine can keep them so.

## 7. Steps (A; one pull request each; the support starter afterwards)

1. Core: `reply` and `then` on the mail kind, validation, the summary, the operations, the
   schema, the spec reference.
2. Adapter: `mail_threads`; the thread subject, the headers, `Auto-Submitted` and the reply
   body on outgoing mail; the route's matching and the reply record; a test-apps flow on a
   starter with the entry: a mail makes a request and the acknowledgement carries the tag and
   is kept in `mail_threads`; a second mail with `In-Reply-To` of that acknowledgement becomes
   a message on the request and reopens it; a third with only the tag in its subject does the
   same; an auto-reply joins without an acknowledgement.
3. Service (B, beside 2): `messageId`, `inReplyTo`, `references` and `autoSubmitted` in the
   payload; `INCOMING_<NAME>_ADDRESS` from the connected mailbox.
4. The support starter (A 102's neighbour, from Johan's own build): Request, Message, the
   entry with `reply`, the action, the two outgoing entries.

## 8. Out of scope, for now

- **Staff answering from their own mail client** rather than the portal: their mail joins
  the thread as a message with their address and `direction: in`; marking it as the app's
  reply (a `from` that is a user's address) is a later rule, when someone works that way.
- **Quoting the earlier mail** under a reply, and stripping a client's quoted text from an
  incoming one: the message keeps the mail as it came. A stripping rule (the `On … wrote:`
  line, `>` lines) is small and comes when a tester's threads show the need.
- **Several mailboxes into one model** with one thread table: works today by two entries;
  a mail that answers the other entry's thread is new. Rare; a later line.
- **HTML mail out:** the thread mails are plain text, as every mail of the app is.
