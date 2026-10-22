# Who can: permissions in Builder (design)

From Johan's testing round 5 (2026-10-10): "What it does" shows who may do what but cannot change
it; the only way in Builder is the grant form, which asks for a role, a kind of grant and names.
Johan asked for a separate no-code tab that makes it very easy to understand. This note designs
it; A builds it (steps in §8).

## 1. What there is

- The access model is three rules (spec, "Access"): the record rule (`defaultAccess`: with
  `shared` everyone who signs in reads every record, with `private` only their own; everyone
  changes and deletes their own); a role does what its block grants (`pages`, `read`, `create`,
  `write`, `delete`, `actions`, `review`, each a list or `all`); administrators do everything.
  `public` is shaped like a role's block, for anyone on the internet.
- Operations: `grant <role> <what> <names…|all|none>` sets one grant whole; `setRoles` sets the
  roles with their descriptions and which one new users get; `setDefaultAccess`; `setPublic`
  (pages, read, create, each list whole) and `setPublicWhere`; `setSignUp` (anyone or invited)
  and `setProviders`. `allowedDomains` has no operation yet.
- The validator warns, never changes: `role-opens-nothing`, `write-without-read` (both refined
  2026-10-11, #497), `public-page-closed-records`, `public-personal-data`, `open-shared-access`,
  `no-admin`, `admin-default-role`.
- The summary's "Sign-in and access" part words it all ("sales: opens every page; adds every
  kind of record; changes everyone's customers, orders"), and the Details pane has "Who may sign
  up".

## 2. The tab

Builder's tabs become **What it does · Look · Who can · Changes** (Changes from
`studio-changes.md`). "Who can" holds, top to bottom:

1. **Sign-in.** The providers as checkboxes in button order (`setProviders`); "Who may sign
   up": anyone, or only people who are invited (`setSignUp`, moved here from Details, which
   keeps a "Change it in Who can" line like the theme's); "Only these email domains" as a text
   field (a new operation `setDomains <domain…>`, none to lift it, core). The
   `open-shared-access` warning shows under this block when it applies.
2. **Records.** One control with two choices, each with its sentence from the summary: "Everyone
   who signs in sees all records, and changes and deletes the ones they own" (`shared`) and
   "Everyone sees, changes and deletes only their own records" (`private`); `setDefaultAccess`.
   The choice changes what the grid's "see" column means, so it sits right above it.
3. **The grid** (§3): what each role may do, and what anyone may do without signing in.
4. **Roles.** Each role's name, description (an input; `setRoles` with the same roles and the
   new text) and a Remove; "Add a role" (name and description; `setRoles` with the roles plus
   the new one; it starts with the record rule only, so the grid's new column is empty and the
   `role-opens-nothing` warning says to tick its pages); "New users get" as a select
   (`setRoles` with `defaultRole`). Removing a role is `setRoles` without it, after a
   confirmation that names what it loses; the people who have it are the users page's matter
   (their role is changed there), which the confirmation says.

Nothing here is for other programs or the assistant (`api`, `assistant`): they are not people,
and the Change tab's forms stay for them. A sentence under Roles says so, with a link to the
form.

## 3. The grid

Columns: one per role except admin, then **Admins** (every cell ticked and greyed: they do
everything), then **Anyone**, not signed in (the `public` block). Rows, in groups:

| Group | Rows | Cells per role | Cell for Anyone |
|---|---|---|---|
| Pages | one per page (the administrators' pages, users and data pages, marked "administrators' page") | open | open (`public.pages`) |
| Records | "Their own records" first, fixed: see, change, delete ticked for every role, not editable, with the record rule's sentence; then one row per model | see everyone's (only with `private`; with `shared` the column is greyed and ticked: everyone sees all), add, change everyone's, delete everyone's | read (`public.read`, with its "only where …" under the tick when a condition is set, and "narrow" opening the `setPublicWhere` form prefilled), add (`public.create`) |
| Custom actions | one per custom action (standard actions follow "change" on their model, said in the group's note) | run | none |
| Files to approve | one per model with pictures or files, only when the app reviews files | approve | none |

- **A tick is one operation:** the role's grant of that kind, written whole with the new list
  (`grant sales write Customer Order`), so the change list reads "sales may change customers,
  orders". For Anyone the same with `setPublic` (one list at a time: `setPublic --read Post
  Session`).
- **"All" is a column-group header checkbox:** "every page (also pages added later)", "every
  kind of record (also kinds added later)", "every custom action", writing `all`. Ticking the
  last row by hand writes the explicit list, which is what the person did; the header shows
  ticked-but-not-"all" as a dash, with the words "every one today, not ones added later", and a
  click on it writes `all`. Unticking a row under `all` writes the rest as a list. The
  administrators' pages are left out of `all` by the spec, so under "every page" their rows
  stay unticked until ticked by hand (which writes the list).
- **Warnings in place,** from the tab's own reading of the auth file, the same rules as the
  validator's (the grid has the files; it does not map the validator's line numbers back to
  cells): `write-without-read` as a mark beside a "change" or "delete" tick whose "see" is not
  ticked under `private`, with the hint "tick See too, or they cannot open what they may
  change"; `role-opens-nothing` under a column header with no page ticked (and not a role for
  keys); `public-personal-data` beside an Anyone "read" tick on a model with personal data;
  `public-page-closed-records` beside an Anyone "open" tick on a page whose records Anyone
  cannot read. The rest of the file's diagnostics, from the validator, in a list under the grid
  as they are, so nothing is hidden.
- **Hover or focus on a cell says the sentence** the summary would write for it ("sales may
  change everyone's customers"), so the words and the grid agree.
- **Phone:** the grid scrolls sideways with the row names fixed; a role's column is the unit.

## 4. "What it does" and the grid

The summary's "Sign-in and access" sentences stay as they are; a click on a role's sentence or
on "Open to anyone without signing in" opens the Who can tab with that column marked for a
moment, as a click on a group's "add a field" opens the forms. The summary is the map, the grid
the controls, as `studio-v2.md` §5 says of the forms.

## 5. What this is not

- Not per-record permissions (that is ownership and `setOwner`, which the record's properties
  keep) and not row filters for roles (only Anyone has `where`, as the spec has it).
- Not a user manager: who has which role is the app's users page; this tab is what a role may
  do.
- Not for `api` and `assistant`: §2.

## 6. New in core

`setDomains` (`allowedDomains`, a list of domains or none), with its describe ("Only
acme.com addresses may sign in"), its validation (a domain shape, not an email), the summary
unchanged (it reads `allowedDomains` already) and the spec reference's `signIn` line naming
it. Nothing else: every cell is a `grant`, `setPublic` or `setRoles` the engine has.

## 7. Tests

`scripts/test-studio.mjs`, Builder: open Who can; the booking app's grid shows member with
"my bookings" open and "add" on Booking; tick "add" on Session for member and the auth file
has `create: [Booking, Session]` and the change list says so; untick it; tick "see" on
Booking under `private` and the write-without-read mark on "change" goes (the test first ticks
"change", sees the mark, then "see"); tick the "every page" header for member and the file has
`pages: all`; Anyone: untick "read" on Post and `public.read` loses it, tick it again; add a
role "teacher" with a description and the column appears empty with the role-opens-nothing
note; "New users get" teacher. Units: `setDomains` (set, lift, a bad domain refused); the
grid's own reading of the four warnings on the CRM and booking files (a pure function
`gridWarnings(ir, auth)` in the Studio app, tested alone).

## 8. Steps (A)

1. Core: `setDomains`, the spec reference's line, units.
2. The tab's skeleton: Sign-in (providers, who may sign up moved from Details, domains),
   Records, Roles (descriptions, add, remove, new users get).
3. The grid: rows and columns from the IR, cells as operations, the "all" headers, Admins and
   Anyone columns, the "only where" line.
4. The four in-place warnings and the diagnostics list; the cell sentences.
5. The summary's click into the tab; the guide's stop if one is wanted; tests.

## Why? (A 127, 2026-10-22)

Under the grid, a question built from the app's own names: may *a visitor or a role* *open,
read, add, change, delete, review* *a page, a kind of record or an action*, and, once a record is
in question, *any of them, their own, someone else's or one with no owner*. Core's
`explainAccess` (explain-access.md) answers it from the same rules the app enforces: yes, no, or
it depends on the record, then the reasons in the order they apply, each naming its setting as
a file and a path. A click on one puts the Code window on screen (beside No code where there is
room) with that setting selected (`SHOW_CODE`, `src/code-jump.ts`). Nothing is changed from the
question; the cells are still where grants are set.
