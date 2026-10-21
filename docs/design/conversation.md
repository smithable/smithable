# A record's conversation: messages as a thread (design)

Status: 2026-10-14, Fable, from Johan's support portal build (backlog Fable 39 (e), pulled
forward on 2026-10-14: "the message subpage of support cases should be done before my next
support portal"). Builds on `mail-threads.md` (the customer's side, by mail) and
`record-rules.md` (who fills a message's fields). A build for A after A 111; merging this
note is the go-ahead.

What the portal showed: a case's messages are a table on the case's page, with "Add message"
opening the Message page's form; so the app needs a Messages page nobody wants, a message is
read by opening its row, nothing says which cases have something new, and an agent's reply is
a form, not a reply. Johan's wishes, in his words: no messages page; messages read or unread,
with a filter "has unread messages"; the messages as a subpage of the case, reached from a
link on each case row.

## 1. What people get

- **A case's page** shows its fields at the top and, under them, the conversation: the
  messages in the order they came, oldest first, newest at the bottom, each with who wrote it,
  when, the text and its attachments, and the message's own badges (a choice such as
  `sender: customer | agent` as a tone, as tables show it). A message from our side sits on
  the right, one from the other side on the left (§2 says how the side is known); without a
  side, every message sits on the left. At the bottom a **reply box**: the text, attachments
  when the model has them, and Send. Sending adds the message, fills what the app fills
  (`sender: agent`, `agent: ME()`), shows it in the thread without leaving the page, and, when
  an outgoing entry says so, mails the customer (`replySent` in mail-threads.md §2). No
  Messages page is needed: the thread is where a message is added and read.
- **The cases list** gets a column for the thread: the count of messages, with a badge when
  some are unread for the viewer, linking to the case's conversation. An **Unread** toggle
  beside the filters keeps the cases with a message the viewer has not seen, in the address as
  `?unread=1` so the view can be linked, as every filter is.
- **Read and unread** are the viewer's own: opening a case's conversation marks it read for
  them; a message they wrote is read for them from the start. Another agent's view is their
  own. The customer, who reads by mail, has no marks.
- **The customer** is unchanged: their reply by mail lands in the thread (mail-threads.md §3),
  and the thread shows it with their address as the writer.

## 2. The spec

```yaml
# smithable.yml (the portal's models, as record-rules.md and mail-threads.md leave them)
models:
  SupportCase:
    fields:
      subject: string!
      status: open | inProgress | closed
      customerEmail: { type: email!, locked: true }
      assignee: { type: User, required: { status: [inProgress, closed] } }
      messages: Message[]
  Message:
    fields:
      content: text!
      sender: agent | customer                 # the first value is what the reply box makes
      agent: { type: User, by: app, default: ME() }
      attachments: files
      supportCase: SupportCase!
```

```yaml
# smithable.ux.yml
pages:
  cases:
    record:
      lists: { messages: thread }              # NEW: a list on the record page as a conversation
```

- **`record.lists.<field>: thread`** in the ux file, for a list field (`Message[]`) of the
  page's model: the record page shows that list as the conversation of §1 instead of a table.
  `table` is the default and the other value. Why the ux file: how related records are shown
  is presentation (rule 1); what a message is stays in `smithable.yml`.
- **What the thread reads from the message model** (since 2026-10-21 the model may say it: `thread: { body, author, side: { field, ours } }` in `smithable.yml`, each part optional, set by `setThread`; the rule below fills what is left out, and `validate` warns, `thread-ambiguous`, where it had to pick one of several: Johan's rule that a default may be inferred from the spec's shape but everything is explicitly sayable). By rule: the **text** is the
  model's first long text field (`text` or `markdown`; a `string` when it has none); the
  **writer** is the model's first field that refers to `User` when it has a value, else its
  first `email` field, else nobody named; the **time** is `createdAt`; **attachments** are its
  `files` and `pictures` fields; the **side** is the first two-valued choice field, with its
  first value as our side (`sender: agent | customer`, `direction: out | in`); every other
  field is a badge or a line under the text. A model with no long text field cannot be a
  thread: validation refuses the key with that.
- **The reply box** adds a record of the message model by its ordinary create, with the
  reference to the page's record filled in and fixed (as "Add message" fills it today). So
  every required field of the message model but the text must be filled without the box:
  `by: app` with a default, a choice (its first value), or the reference. Validation warns
  when one is not (`thread-needs-form`: "Message.priority is required and the reply box does
  not ask for it: give it a default, or `by: app`, or the thread shows Add message instead"),
  and the page shows the Add button to the form in its place until it is.
- **Read marks** are the kit's, like favorites: a table of its own, one row per person and
  record (`model`, `record`, `user`, `readAt`), written when a conversation is opened and when
  the viewer sends a message. Unread for a viewer: a message in the thread made after their
  mark (or any, with no mark) by someone else. No spec key, no field on the maker's models: who
  has read what is not what the record means. The **Unread** toggle and the count column come
  with the `thread` key: a page whose record page has a thread gets them; `table.columns` may
  name the list field (`messages`) to place or drop the column.
- **An outgoing entry** on the message model fires on the box's create as on any create:
  `replySent: { when: Message created, where: { sender: agent }, to: mail, recipient: supportCase.customerEmail }`
  mails the customer in the case's thread (mail-threads.md §4). Nothing new there.
- **Summary sentence:** "A case's messages are shown as a conversation with a reply box."
- **Operations:** `setRecordList <page> <field> thread|table` (ux); Studio's page panel offers
  it beside the table's columns, and the Builder's first draft uses it for a model whose only
  list is of messages (a model with a long text field and a reference back, named messages,
  replies, comments or notes).

## 3. Where each part lives

| Part | New or reused |
|---|---|
| `record.lists` in the ux file, its validation (a list field of the page's model, a long text field on its model), the `thread-needs-form` warning, `setRecordList`, the summary line | core: the ux section and the page's IR (`PageUx.record.lists`) |
| The thread view: the messages in order with writer, time, text, attachments, badges and side; the reply box (text, attachments, Send) posting to the message model's create function with the reference fixed; the new message shown in place | the kit: `Thread.tsx` beside `ModelTable`, fed by the record page's loaded list as the table is; the record page template picks it by the ux key |
| Read marks: the table, `markRead(model, id)` on opening and on Send, `unreadOf(model, ids)` for the list's badges and the toggle's query | the kit: a migration it owns (as favorites'), two server functions in `kit/reads.server.ts`; `smithable upgrade` adds the table |
| The count column with the badge, the Unread toggle, `?unread=1` in the address | the adapter's list page and `Filters.tsx`, as `owner`'s Mine toggle |
| The thread's words (Reply, Send, Unread, "n messages", "No messages yet") | `words/<language>.ts` |
| The support starter: `record.lists.messages: thread`, no Messages page | with mail-threads' starter step (A 109) |
| Studio and the Builder's draft | the page panel; the draft prompt's one sentence (`setRecordList`) |

## 4. ARCHITECTURE §2.4

1. **Common:** every app whose record has a conversation under it: support cases, orders with
   notes, applications with remarks, a booking's messages with its guest.
2. **Deterministic:** a key in the ux file, rules for which field is the text, the writer and
   the side; no model.
3. **Less AI and ambiguity:** without it a model builds a chat component by hand for every
   such app, a second page for messages, and read marks as fields on the maker's model.
4. **Technology-neutral:** a look of a list, a per-person mark, a toggle.
5. **Better than free text and custom code:** the thread, the reply box, the mail that goes
   out and the unread marks must agree on one message model and its rules; the engine keeps
   them so, and the thread follows the model when a field is added or renamed.

## 5. Steps (A, after A 111; two pull requests)

1. The ux key, its validation and operation, the thread view with the reply box, the words,
   a test-apps flow on the CRM (a customer's notes as a thread: a note sent from the box shows
   in place, the Messages page absent, the warning when a required field is unfilled).
2. Read marks, the count column with its badge, the Unread toggle; the support starter's
   adoption with A 109's starter step; Studio's panel and the draft sentence.

Until step 1 is on main, a portal built today has the lines: a Messages page with
`filters: [supportCase, agent]` (a person is a filter from #614: Mine, Unassigned, by name),
`sortable: [createdAt]`, and `table: { sort: -createdAt }` in the ux file; or `mine: true` on
a second messages page for one's own.

## 6. Out of scope, for now

- **The customer's web view** of their request (a public page by the thread's tag, with a
  reply box): the mail is their side for now; the page comes with a tester who asks.
- **Live updates** while the page is open: the thread refreshes when the tab regains focus
  and after Send; no push.
- **Editing or deleting a message** from the thread: a message is a record and keeps the
  record page it has (opened from the thread's "…" when the model has a page), nothing more.
- **Per-message read receipts** and "seen by" lines: one mark per person and record is what
  the badge needs; more when asked.
- **Internal notes beside the customer's messages** (a message the customer never gets): a
  choice value the outgoing entry's `where` leaves out (`sender: agent | customer | note`,
  shown with its tone); no new key.
