# Your own code

Most of an app is generated from its spec and changes with it. When the spec cannot say something, you write code in `src/custom/`. Smithable writes a typed stub there once and never overwrites it, so what you write survives every change to the spec, and the spec still says what the code is for. This page says when to write code and how: a custom action and its test, hooks, custom pages and sections, a custom receiver for incoming calls, and plugins. Its example is the CRM starter's **Merge customers**.

## Standard or custom action

A button is a standard action when it can be said in the spec, and a custom action when it needs code. A standard action is a button on a record; a custom action is a button in a list page's header that opens a form, or, when its input includes a list of records, a button in the list's selection bar. Try the standard one first: it needs no code, is checked against the spec and stays right as the spec changes.

| | Standard action | Custom action |
|---|---|---|
| **Input** | The record it is pressed on, or the rows ticked on a list. A field left empty in `set` is asked for. | Typed values you declare (`input:`), references to records included, and at most one list of records (`customers: Customer[]`), the rows ticked on a list. There is no current record. |
| **What it does** | Sets fields (a value, a formula, `ME()`), adds one related record, or copies the record with its lists. | Anything the code does: other records, other models, a calculation over many records, a value it returns (`output:`). |
| **Mail and calls** | An [outgoing](outgoing.md) entry with the action's name in `when`: queued, retried for a day, listed in the app's Activity page. | The same: an outgoing entry with its name in `when`, sent once the function returns without an error. In the code itself, `tell` and `tellMail` from `#/kit/tell.server`, which use the same outbox; `sendMail` and `fetch` send straight away, without it. |
| **Who may run it** | Whoever may edit the record, or a role whose `actions` grant names it. | Only the roles whose `actions` grant names it, and administrators. |
| **Where it is** | In `smithable.yml`, under `actions:`. See [buttons on a record](actions.md). | Declared in `smithable.yml`, written in `src/custom/actions/`. |

## A custom action: Merge customers

The CRM starter declares one, offered on the customers page:

```yaml
actions:
  mergeCustomers:
    custom: true
    input: { keep: Customer!, duplicate: Customer! }
    intent: Merge a duplicate customer record into the one we keep.
    rules:
      - All orders of the duplicate move to the kept customer.
      - Empty fields on the kept customer are filled from the duplicate.
      - The duplicate is deleted afterwards.

pages:
  customers:
    crud: Customer
    actions: [mergeCustomers]
```

`input` uses the same shorthand as fields (`Customer!` is a required reference to a customer); `output: { moved: int! }` would declare what it returns. `intent` and `rules` say what it is for in words: they go into the stub's comment, into Studio (the visual editor), and to a coder (an AI coding agent such as Claude Code, see [AI setup](../ai.md)) if one writes it. From the command line, typed inputs and no `--on` make an action custom:

```console
$ smithable op addAction mergeCustomers keep=Customer! duplicate=Customer!
```

Then list it in the customers page's `actions:`. That page gets a **Merge customers** button in its header, opening a form for the input. Smithable generates the form, the server function that checks access and that the person may read every record the input refers to, and a stub in `src/custom/actions/merge-customers.ts`:

```ts
export async function mergeCustomers(
  input: MergeCustomersInput,
  _viewer: Viewer | null,
): Promise<MergeCustomersOutput> {
  throw new Error(`mergeCustomers is not implemented yet (input: ${JSON.stringify(input)}).`);
}
```

The function gets the input, where a reference arrives as the record's id, and the person running it (the stub's `_viewer`, without the underscore once you use it); it returns the output if one is declared. By the time it runs, the generated server function has checked that this person may run the action and may read every record the input names. Past that, the code is trusted: it reads and writes the database directly, so any further rule is the code's to keep. The starter's version imports `db` from `#/db` and the tables from `#/db/schema`, refuses two of the same customer, works out which of the kept customer's empty fields the duplicate can fill (`filled`), and then does the merge in one transaction:

```ts
export async function mergeCustomers({ keep, duplicate }: MergeCustomersInput, _viewer: Viewer | null) {
  if (keep === duplicate) throw new Error("Choose two different customers.");
  // … kept, other and filled: the kept customer's empty fields the duplicate has a value for
  db.transaction((tx) => {
  tx.update(orders).set({ customerId: keep }).where(eq(orders.customerId, duplicate)).run();
  tx.delete(customers).where(eq(customers.id, duplicate)).run();
  if (Object.keys(filled).length)
    tx.update(customers).set(filled).where(eq(customers.id, keep)).run();
  });
}
```

The duplicate is deleted before its values move, so a unique value such as its email is never on two customers at once; in one transaction, the person sees all of it or none.

Who may run it is a grant: `smithable op grant sales actions mergeCustomers` lets the sales role merge (`roles.sales.actions` in `smithable.auth.yml`). The CRM grants it to no one, so only administrators can.

### On the rows picked

A custom action whose input holds a list of records runs on the rows ticked in a list, once for all of them. One input may be such a list (always required, so it needs no `!`; never of users; and an output holds none):

```yaml
actions:
  setSegment:
    custom: true
    input: { customers: Customer[], segment: string! }
    intent: Move the customers picked to another segment.

pages:
  customers:
    crud: Customer
    actions: [setSegment]
```

The customers page then offers **Set segment** in its selection bar when rows are ticked, not as a header button; the other inputs are asked once, in the same dialog a standard action uses. The function gets the list as ids, each once, and the generated server function has checked that the person may read every one of them before it runs. Activity has one line for the run, with the records it ran on.

### Its test

A test is yours to write, next to the code, with Vitest: the CRM's is `src/custom/actions/merge-customers.test.ts`. It makes two customers and two orders on the duplicate, calls `mergeCustomers({ keep: keep.id, duplicate: duplicate.id }, null)`, and checks that the kept customer's own fields stayed, an empty one was filled from the duplicate, the duplicate is gone and both orders moved; a second test checks that merging a customer into itself is refused. The tests call the function directly, so they test the merge, not who may run it; access is the generated server function's, and has generated tests of its own. Run the app's tests with:

```console
$ pnpm test          # or: smithable test, which also records which rules have a passing test
```

Tests run against an empty database of their own (`data/test`), wiped when the run starts, one test file after another.

`smithable code action:mergeCustomers "…"` asks a coder to write the action instead: it writes the code and a test for each rule, the code must type-check, and Smithable runs the tests and undoes everything if one fails ([AI setup](../ai.md)).

## Mail and web calls from code

- **Mail:** `sendMail({ to, subject, text })` from `#/kit/mail` (the app kit: the small library every generated app carries in `src/kit/`) sends at once through the app's mail settings (`SMTP_URL`, or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` and `SMTP_PASSWORD`; the sender is `MAIL_FROM`). Without them the mail is written to the outbox folder (`data/mail/outbox`), where a test can read it with `outbox()` from the same file.
- **Web calls:** plain `fetch`. On smithable.ai every call leaves through the service's gateway, which checks where it goes against the app's level and counts it towards the day's limit ([mail and calls out](outgoing.md)).
- **Through the outbox:** `tell` and `tellMail` from `#/kit/tell.server` give your code what an [outgoing](outgoing.md) entry gives: a queue, retries for a day, a line in Activity and **Send again**. `tell(target, body)` calls one of the targets the spec's outgoing section names (`to:`), with the body as JSON, signed with the target's secret; the target's address and secret stay settings, so where the app may call stays the administrator's. `tellMail(to, subject, text)` mails an address or a role (every user who has it); in a visitor's request it mails a role only, never an address, since the code might pass on what a stranger typed. Use `fetch` when the code needs the answer at once.

  ```ts
  import { tell, tellMail } from "#/kit/tell.server";

  await tell("crmFeed", { customer: keep, merged: duplicate });
  await tellMail("admin", "Customers merged", `#${keep} kept, #${duplicate} merged into it.`);
  ```

- **After the action:** an outgoing entry may also name a custom action in `when` (`customersMerged: { when: mergeCustomers, to: crmFeed }`): it is sent once the function returns without an error, with the action's input and output, since there is no record. Its mail goes to a role, and `where` and `fields` are refused ([mail and calls out](outgoing.md)).

## Hooks

A hook runs your code after a record is made, changed or deleted, or once a day. Hooks need nothing in the spec: they are `src/custom/hooks.ts`, typed by the app's models.

```ts
import type { Hooks } from "#/generated/hooks";
import { sendMail } from "#/kit/mail";

export const hooks: Hooks = {
  afterCreate: {
    Order: async (order, viewer) => {
      await sendMail({ to: "sales@example.com", subject: `New order ${order.number}`, text: "…" });
    },
  },
  daily: [async () => { /* remind about overdue invoices */ }],
};
```

`afterCreate`, `afterUpdate` and `afterDelete` take the model's name; each hook gets the record (only its `id` after a delete) and the person who made the change. A hook runs on the server, in the same request, after the change is saved: if it throws, the person sees the request fail, though the change is already saved. Hooks run for changes made through the app (its pages, its API, standard actions); your own code's direct `db` writes, like the merge above, do not run them. There are no hooks before a change: a rule that must hold is a [field rule](../spec/v0.1.md) or an action's `when` condition. Daily jobs run in a published app, a day after it starts. `smithable code hooks "email the customer when an order ships"` asks a coder to write them, with a test.

## Custom pages and sections

A page or a landing section that none of the built-in page kinds (a list, a calendar, a dashboard…) can make is a component of your own:

```yaml
pages:
  planner: { custom: Planner }
  home:
    landing:
      uptime: { custom: Uptime }
```

```console
$ smithable op addCustomPage planner Planner
$ smithable op addSection home uptime --custom Uptime
```

The stubs are `src/custom/pages/Planner.tsx` and `src/custom/sections/Uptime.tsx`. A page gets `{ page, title, subtitle }` and draws its header with the kit's `PageHeader`; a section gets `{ name, texts, title, text }` and draws itself inside the kit's `Section`, so it looks like the sections around it and its texts are edited in `smithable.content.yml` like theirs. To read records, a component calls a server function that uses the generated data functions with the signed-in person, so access rules hold. The status starter's **Uptime** section, the last 90 days of each service drawn from its incidents, is one: its arithmetic is a plain function in `uptime.ts` with its own tests.

`smithable customize page:<page>` takes a different route: it moves a generated list page into `src/custom/pages/` as yours to change.

## Incoming calls

An [incoming](incoming.md) entry usually creates or changes a record with `set` and `fields`. For a body those cannot say, `custom: true` hands it to your code:

```console
$ smithable op addIncoming monitor --custom --as staff
```

The stub is `src/custom/incoming/monitor.ts`: `handle(body, caller)` gets the JSON body after the secret or signature was checked, and `caller` is a person with the entry's `as` role, so the data functions apply that role's access. Give it the lowest role that does the job (here staff, not admin); the call is answered `200` when `handle` returns.

## Plugins

Every built-in part of the spec (a section such as `actions:` or `outgoing:`, a companion file, a page pattern) is a plugin inside Smithable: it brings its schema, its operations (and so its commands, its MCP tools and what the AI may do) and its generator. A project can add one of its own: a folder `smithable/plugins/<key>/` with a `plugin.mjs` that gives a new spec key its schema, operations and generated files (only under `src/generated/plugins/<key>/`), declared in `smithable.context.yml` (the project's file for how it is built). `smithable teach <key>` asks a coder to write it once, then checks it like any change; after that the key is handled with no AI. The built app has no dependency on the plugin's code: what it generated is ordinary code in the app. A public plugin interface for packages comes later, once several real plugins use it ([ARCHITECTURE §5.1](https://github.com/smithable/smithable/blob/main/docs/ARCHITECTURE.md)).

## What stays yours

Smithable never overwrites `src/custom/` or a database migration (`drizzle/`) once written; everything in `src/generated/` is rewritten freely, and `src/kit/` is updated with Smithable. `smithable detach` leaves the app as an ordinary project with no tie to Smithable, your code untouched.
