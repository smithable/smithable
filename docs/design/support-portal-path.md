# The support portal's path through the spec (design)

Status: 2026-11-03, Fable, from Johan's decision the same day; §2–§4 sharpened the same evening after two second reviewers read the build (a message's writer, `none` alone, the proven address on create, a case's status by actions only): the full support portal, built by
him on the hosted service and written about before it becomes the starter (backlog, The next
starter; Fable 94). Two second reviewers' points taken. This note walks what the portal needs
against the spec as it stands, so his build shows the product and not its holes, and designs what
is missing: an owner that is not a `User` field, a role that runs no action on its own records, and
the reply box's side for a customer.

## 1. What the portal needs, and what the spec says today

| The portal needs | Today |
|---|---|
| Agents who see and answer every case; an administrator who manages the team | The support starter as it is: `defaultAccess: shared`, the `agent` role, a `users: manage` page, mail in and out (mail-threads.md), the conversation with its reply box and the viewer's unread marks (conversation.md) |
| A public support page: how to reach us, what to expect, a form that opens a case | A landing page under `public.pages` with a contact form, `into` a model under `public.create` (spec, Landing pages). The form may write `SupportCase` itself, `customerEmail` from the form: the case exists before anyone signs in, as a mailed-in case does |
| Customers who sign in and see only their own cases, messages and attachments, also by a direct address | **Missing.** `defaultAccess: private` with `read: all` for agents gives the record rule; but a case that came in by mail, or through the public form, has no owner the spec can name: `ownedBy` takes a `User` field, and the customer was no user when the case was made. A message an agent writes on the customer's case belongs to the agent, so the customer could not read it. §2 |
| Customers who write in their case but take, assign or close nothing | **Missing.** The owner of a record runs its standard actions (spec, Access); a customer owning their case would see Close and Assign to me. §3 |
| A customer's reply in the portal sits on the customer's side of the thread | **Missing.** The reply box writes the side field's first value, our side (conversation.md §2). §4 |
| A public knowledge base whose drafts stay private | `Article` under `public.read` with `where: { status: published }`; a public articles page; `smithable validate` warns when a public page shows such a model without a `where` |
| A case's state moves by actions alone, also for its owner | `status` with `locked: true`: a form or the API cannot write it, an action's `set` can (spec, Fields). With §3 the customer runs none of them |
| A case cannot close before an agent has replied | `close` with `when: { lastSender: agent }` over `lastSender: { type: string, formula: LAST(messages.sender) }`, `LAST` by when the messages were made: the button shows only then and the server refuses otherwise (spec, Actions). The starter's `close` gets this `when` |
| Unread marks, also for the customer | The viewer's own marks on the conversation (conversation.md §1): a signed-in customer is a viewer like any other. The **Unread** filter on the cases list follows |
| Mail when something happens | As mail-threads.md has it: an agent's reply mails the customer (`replySent`), a new case gets its receipt. A customer's reply written in the portal mails nobody; the agents see the unread mark, as for a reply by mail |

Six rows are a spec the portal writes today. Three are constructs, below; all three are small.

## 2. An owner that is an address, and an owner one reference away

`ownedBy` says which field is the record's owner, "the shape of the data" (access-in-auth.md). It
takes a `User` field. Two more shapes name an owner just as plainly:

- **An `email` field.** `ownedBy: customerEmail`: the record belongs to whoever has signed in
  with that address **proven**. Proven is a rule the app checks, not a description of the
  providers: the code by mail proves the address it was sent to, and a provider's account counts
  only when the provider says the address is verified; an account whose address is not proven
  owns nothing by address. The comparison is the address as the app stores it (lower-case,
  trimmed) against the signed-in person's; a record whose address is empty has no owner, as
  today. No account is made from a mail or a form: a customer gets one by signing in
  (`selfSignUp: true` with `defaultRole: customer`, or an invitation), and from then on owns every
  record with their address, the earlier ones too. For a viewer who may not choose whose a record
  is, the form leaves the field out and the app fills in the viewer's address, exactly as a
  required `User` owner left out is filled with the viewer today (data.ts, `ownerFor`); a value
  sent anyway is replaced by the viewer's, and a signed-in person whose address is not proven is
  refused with the reason ("Prove your address first"), so nobody files records into a portal they
  have not shown is theirs. The address is stored as it is compared, lower-case and trimmed, on
  every write, so the comparison is a plain equality and an index serves it. A visitor's public form takes the address written, as a
  mail takes its `From`: the case is what someone wrote to us, and the thread shows the writer as
  it does for mail; nothing goes to that address but the receipt, so writing someone else's
  address plants a case in their portal and nothing more, the same as mailing in their name
  today. `locked: true` stays on the field in the starter: set when the record is made, never
  changed by a form after.
- **A reference field.** `ownedBy: supportCase` on `Message`: a message belongs to whoever owns
  its case, one step, never two (`Message.supportCase` → `SupportCase.customerEmail`; a chain,
  or a reference to a model without an owner field, is refused, as `namedBy` refuses a name that
  comes back to itself). On create and on change, the record the reference names must be one the
  viewer may read, else the server refuses as for any record out of reach (404), so nobody writes
  into another customer's case by guessing its id; and the reference is locked once the record
  exists, so a message is never moved to another case. The customer reads the agents' replies and
  their attachments, the agent (with `read: all`) reads everything, and a message's own `agent`
  field stays what it is: who wrote it, not who owns it. The record's files follow the record
  (`/files/<model>/<id>/<field>` is read through the model's data function already).
  **Owning through a reference is reading.** The record keeps its creator as today (the app's
  owner column), and changing or deleting it stays the creator's and the roles granted `write` or
  `delete`: a customer reads the agents' replies and cannot edit or remove one, an agent cannot
  edit a customer's words; the viewer's own unread marks and "a message they wrote is read for
  them" go by that creator too. The owner's standard actions on a through-owned record follow
  the same line: they are the creator's, not the reader's.

What does not change: the record rule, the roles' grants, `review`, `where` on public reads. The
operation `setOwner <model> [field]` writes `ownedBy` and accepts the two new shapes. The form's
choice of whose a record is, for roles that change everyone's records, is offered for a `User`
owner only: an address owner is typed, an owner through a reference follows its parent.
`smithable validate --explain` says "a case belongs to whoever signed in as its customerEmail" and
"a message belongs to its case's owner". Who owns a record is told only to its owner and to roles
that read every record, as today.

## 3. A role that runs no action on its own records

Today the owner of a record runs its standard actions, beside the roles granted `write` or named
in `actions` (spec, Access). The portal needs the opposite for customers: they own their cases
and run nothing on them. The rule: `actions: none`, written in a role's block, means the role runs
no action at all, its own records included; a list keeps today's meaning (those actions, beside
the owner's own), so no existing app changes (the spec's own `sales: actions: [mergeCustomers]`
keeps closing its own orders). `grant customer actions none` writes it; `smithable validate
--explain` says "customers run no action, not on their own cases either". No new key: `none` was
the record rule and now means what it says for actions.

What an action would change must then move by actions alone: the starter's `status` gets
`locked: true`, set when the case is made and changed by `startWork`, `close` and `reopen` only,
so a customer who owns the case cannot close it through the form or the API either.

## 4. The reply box's side

The thread's side is a two-valued choice (`sender: agent | customer`), its first value our side,
and the reply box writes the first value (conversation.md §2). The rule becomes: the reply box
writes the first value for a viewer who may read everyone's records of the thread's model (a role
granted `read` or `write` on it, an administrator) and the second for anyone else: a customer's
reply sits on the customer's side, an agent's on ours, and a message a customer sends can never
say `sender: agent`, since the box fills the field and the server checks it as it checks a
`by: app` field.

The portal's auth file, then:

```yaml
defaultAccess: private
roles:
  admin: all
  agent: { pages: all, read: all, create: all, write: all, actions: all }
  customer:
    description: Follows their own cases and writes in them.
    pages: [myCases, knowledge]
    create: [SupportCase, Message]        # a new case; a reply, only on a case they may read (§2)
    actions: none                         # not even on their own cases (§3)
defaultRole: customer
public:
  pages: [support, knowledge]
  read: [Article: { where: { status: published } }]
  create: [SupportCase]                   # the public form opens a case
```

## 5. ARCHITECTURE §2.4

1. Who asks: Johan's portal, and every app where the people written about are not users yet (a
   booking's customer, an invoice's recipient, an applicant), and every app whose owners must
   not run the staff's actions.
2. Smaller construct: a `customer: User` field filled from the mail, which would make an account
   for every address that writes in: an account nobody asked for, and a sign-up path open to
   anyone who sends a mail. Refused. For §3, a `who` on the action: `allow` on an action was
   moved to the auth file on purpose (access-in-auth.md), and `none` already exists.
3. Deterministic: yes; comparisons at read and write time, as the owner id today.
4. Undo: `ownedBy` is one key, `actions` one grant; their operations accept the shapes, undo
   restores them.
5. Plain words: "a case belongs to whoever signed in as its customer address"; "customers run no
   action, not on their own cases either"; "a reply sits on the side of the one who wrote it".

## 6. Steps

1. Core: `ownedBy` accepts an `email` field and a reference field one step away; the IR carries
   `ownerKind: user | address | through`; validation refuses a chain and a reference to a model
   without an owner; a role's written `actions` is the whole of what it runs; `--explain` and the
   assistant's words say both (Fable).
2. Adapter: the owner comparison in the data functions (`ownerFor` and the read filter) by kind,
   the proven-address rule, the address filled for a viewer who may not choose, the through
   owner's read check and lock on create and change, the owner's actions by the role's written
   grant, the reply box's side by the viewer; `/files` follows (A, with Fable's core on main).
3. The starter: `ownedBy: customerEmail` on `SupportCase`, `ownedBy: supportCase` on `Message`,
   `status` locked, `close` with `when: { lastSender: agent }`, the `customer` role with `actions: none`, the
   public form into `SupportCase`, an `Article` model with a public knowledge page: after Johan's
   build, from his export, as starters.md says; the constructs are on main before it.
4. The spec reference's `ownedBy` row, the Access section and conversation.md §2; this note's §1
   becomes the starters.md entry's checklist when the portal becomes the starter.
