# Why may they: `explainAccess` (design)

From the app-map proposal (2026-10-20) and Johan's wish to see, in Studio, why a role can or
cannot do something. Studio's Who can shows what each role may do (who-can.md); the summary says
it in words; the generated app enforces it. None of them says *why*: which line of
`smithable.auth.yml` or `smithable.yml` decided a cell, and what it depends on when it depends
on the record. This note designs one core function that answers that, for Who can's "Why?" (the
app map's first step, A 127) and for an assistant asked "why can a member not delete a session".

## 1. One policy, explained

The access rules are already one definition: `pageAccess`, `modelAccess` and `actionAccess` in
core's `access.ts`, read by the validator, the generator and the generated tests
(ARCHITECTURE §3.1). The explanation is computed from the same functions and the same inputs,
never from a second reading of the files: the verdict is what those functions say, and the
reasons name the inputs that made them say it. A reason that disagreed with the app would be a
bug in the explanation, never a second opinion; a test runs every example's roles, pages, models
and actions through both and checks they agree.

## 2. The question

```ts
explainAccess(ir, auth, scenario, resource, verb): AccessExplanation
```

- **Scenario:** `as` (a role's name; left out, a visitor who has not signed in); `record`
  (`own`, `another's`, `ownerless`; left out, the records in general: a list, no record chosen);
  `values` (the record's field values a condition may read; a field left out is unknown).
- **Resource and verb:** a page is `open`ed; a model's records are `read`, `create`d, `write`d
  (changed) or `delete`d, and their files `review`ed; an action is `run`.
- **Answer:** `verdict` is `allowed`, `denied` or `conditional` (it depends on the record: whose
  it is, or a value the scenario did not give), and `reasons`, in the order the rules apply, the
  last one deciding. Each reason is one sentence and the setting that decided it, as a file and
  a path in it (`roles.member.create`, `public.read.Post.where`, `defaultAccess`,
  `actions.markSent.when`, `models.Booking.ownedBy`), so Studio can take the person to the line,
  and an assistant can quote it.

A name the files do not have, or a verb the resource does not take, is an error, not an
explanation: the asker's mistake, not the app's rule.

## 3. What the reasons say

The sentences follow the spec's three rules and the grants, in the words Who can uses:

- *Administrators do everything.* · *sales is granted all: the whole app.* · *member's create
  grant names Booking.* · *sales's write grant is all, which covers customers.* · *member's pages
  grant does not name team.*
- *Anyone may open the schedule page without signing in: public.pages names schedule.* ·
  *Opening the my bookings page needs signing in.* · *member's pages grant is all, which leaves
  out the pages kept for administrators, the team page among them; a role opens one by naming
  it.*
- *With defaultAccess shared, everyone who signs in sees every record.* · *With defaultAccess
  private, member sees only their own bookings: its read grant does not name Booking.* ·
  *Everyone who signs in deletes their own bookings; member's delete grant does not name
  Booking, so not everyone's.* · *This booking is someone else's: its owner is another person.*
  (with `ownedBy`: *they are its attendee*).
- *Anyone reads posts only where status is published.* · *This post does not fit: anyone reads
  posts only where status is published.*
- *Mark sent changes an invoice: whoever may change one runs it, and the roles whose actions
  grant names it.* · *Mark sent runs only while status is draft.* · *This invoice fits: status is
  draft.* · *Add update also adds updates, which staff may not add: its create grant does not
  name Update.* · *Merge customers is a custom action: the roles whose actions grant names it
  run it.*

Conditions are evaluated as the generated app tests a stored row (`fitsCode`): a yes/no field
that is false or empty is no, a list of values is any of them.

## 4. What this is not

- Not a second policy engine: nothing here decides; `access.ts` decides and this reports.
- Not per-record data: it takes the scenario's word for whose a record is and what it holds; the
  app's own answer for a real record is the data layer's (`readable`, `allows`).
- Not keys or programs yet: a key has a role and is no person, so it owns nothing (`personOf`);
  the scenario speaks of people. A `key: true` on the scenario comes with the API's own map.
- Not the trash, held files or locked fields: a trashed record is gone to every reader, a record
  whose required file waits is its owner's and the reviewers', a locked field refuses a change
  while its condition fits (record-rules.md §2). Each is a rule on the record's state, told by
  the record page; they join the scenario (`state: trashed | held`, a field's lock) when the map
  shows a record.

## 5. Built (2026-10-21, Fable)

`packages/core/src/explain-access.ts`, exported from core (`explainAccess`, `AccessScenario`,
`AccessResource`, `AccessVerb`, `AccessExplanation`, `AccessReason`); tests on the booking, CRM
and invoicing examples, and the agreement test over every example with an auth file. Studio's
Why? is A 127 (who-can.md, "Why?").
