# M12 first builds: claude-code (2026-10-07)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 12 / 12 created, 9 type-check, 0 tokens (0 in, 0 out), €0.0000; 12 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 0 | 0 | €0.0000 | 1 | 1 | 7 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | ? | yes | yes | 0 | 0 | €0.0000 | 0 | 0 | 6 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | **no** | 0 | 0 | €0.0000 | 2 | 2 | 7 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 0 | 0 | €0.0000 | 1 | 1 | 8 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 0 | 0 | €0.0000 | 1 | 1 | 6 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | **no** | 0 | 0 | €0.0000 | 1 | 1 | 7 s |
| A football club's site: teams, players, matches and results. | records | yes | **no** | 0 | 0 | €0.0000 | 1 | 1 | 7 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 0 | 0 | €0.0000 | 1 | 1 | 8 s |
| A help desk for an IT team: tickets, priorities and who handles them. | records | yes | yes | 0 | 0 | €0.0000 | 1 | 1 | 6 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 0 | 0 | €0.0000 | 1 | 1 | 6 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 0 | 0 | €0.0000 | 1 | 1 | 7 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 0 | 0 | €0.0000 | 1 | 1 | 7 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 2 | 5 / 6 (has 5) | 9 / 11 (has 9) | 0 / 0 (has 0) | private; admin, member (member) | sessions: admin, class-types: admin, instructors: admin, messages: admin | pages home, schedule, privacy; read ClassType, Instructor, Session; create Message | 2 (no-timezone, operator-unknown) | none |  | none | 3 / 5 | mentions visitors; landing page |
| 2 | ? (words: crm) | 0 | 0 / 0 (has 6) | 0 / 0 (has 5) | 0 / 0 (has 1) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 6 | no mention; no landing page |
| 3 | invoicing | 2 | 3 / 4 (has 4) | 5 / 7 (has 7) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 3 / 4 (has 6) | 0 / 0 (has 1) | private; admin, member (member) | none | pages home, catalog; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 4 (has 5) | 0 / 0 (has 4) | private; admin, staff, member (member) | applications: staff/admin | pages home, jobs; read Job; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, matches, teams, players, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 4 / 11 (has 7) | 0 / 0 (has 0) | private; admin, attendee (attendee) | talks: admin, speakers: admin | pages home, schedule, privacy; read Talk, Speaker; create none | 2 (no-timezone, operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | records (words: invoicing) | 3 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 4) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 1 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 2 | 3 / 4 (has 3) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate; create none | 1 (operator-unknown) | none |  | Payments | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Open Sky Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, instructors, call to action, contact and footer)
  - My bookings (lists bookings)
  - Schedule (a calendar of sessions by week or month)
  - Sessions (lists sessions; only for admins)
  - Class types (lists class types; only for admins; visitors see class types on the Home page)
  - Instructors (lists instructors; only for admins; visitors see instructors on the Home page)
  - Messages (lists messages; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete)

Class types
  Class types have:
  - a name (required)
  - a summary
  - a level (all levels, beginner or advanced, all levels by default)
  - duration minutes (a whole number, required, 60 by default)
  Only admins can add class types.

Instructors
  Instructors have:
  - a name (required)
  - a bio
  Only admins can add instructors.

Sessions
  Sessions have:
  - a class type (a class type, required)
  - an instructor (an instructor, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 12 by default)
  Each session lists its bookings.
  The places left is calculated as the capacity minus the number of its bookings.
  Only admins can add sessions.

Bookings
  Bookings have:
  - a session (a session, required, unique)
  At most the session's capacity bookings per session.

Messages
  Messages have:
  - a name (required)
  - an email (required)
  - a message (required)
  Only admins can see messages.
  Only admins can change messages.
  Only admins can delete messages.

Booking made
  When a booking is added: mails its owner.

Booking cancelled
  When a booking is deleted: mails its owner.

Sign-in and access
  People sign in with a code sent to their email.
  Unless a kind of record says otherwise, everyone sees and changes only their own records.
  Roles:
  - admin (Studio staff. Manage the schedule, classes and teachers)
  - member (A student who books classes)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors, reading sessions and adding messages.
Pictures from the Smithable image library: hero.webp.
Generated 141 files (141 changed, 0 removed).

Created /tmp/smithable-bench-m12-nNatGW/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-nNatGW/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-nNatGW/app-1/smithable.yml:52:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-nNatGW/app-1/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
addModel Company {"name":"string!","notes":"text"}
  addPage companies Company
  addModel Contact {"name":"string!","notes":"text"}
  addPage contacts Contact
  addModel Deal {"name":"string!","notes":"text"}
  addPage deals Deal
  addModel FollowUp {"name":"string!","notes":"text"}
  addPage follow-ups FollowUp
  removePage customers
  removePage orders
Added companies with a name and notes: say what else they hold.
Added contacts with a name and notes: say what else they hold.
Added deals with a name and notes: say what else they hold.
Added follow-ups with a name and notes: say what else they hold.
The starter let only acme.example addresses sign in (a sample domain no one has); that limit is gone.
Generated 123 files (122 changed, 0 removed).

Created /tmp/smithable-bench-m12-nNatGW/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-nNatGW/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Ledgerly
  Simple invoicing for freelancers: keep your clients, send invoices and record the payments you receive.

Pages
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Clients (lists clients; search by name or email)
  - Payments (lists payments)
  - Invoice lines (lists invoice lines)
  - Overview (a dashboard: received, outstanding, overdue and latest)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Invoices (lists invoices; filter by status or client; “Mark sent”; “Mark paid”)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  - a VAT number
  Each client lists its invoices.

Invoice lines
  Invoice lines have:
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  - an invoice (an invoice, required)
  The amount is calculated as the quantity times the unit price.

Payments
  Payments have:
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - a method (bank transfer, card, cash or other, bank transfer by default)
  - a note
  - an invoice (an invoice, required)

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required, the issued on plus 30 days by default)
  - status (draft, sent, paid or overdue, draft by default)
  Each invoice lists its invoice lines.
  Each invoice lists its payments.
  The total is calculated as the total amount of its lines.
  The paid is calculated as the total amount of its payments.
  The balance is calculated as the total minus the paid.

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The client paid the invoice in full.

Invoice sent
  When “Mark sent” runs on a invoice: mails client's email.

Sign-in and access
  People sign in with a code sent to their email.
  Unless a kind of record says otherwise, everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page and the privacy page.
Pictures from the Smithable image library: hero.webp.
Generated 126 files (126 changed, 0 removed).

Created /tmp/smithable-bench-m12-nNatGW/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-nNatGW/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-nNatGW/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).

/tmp/smithable-bench-m12-nNatGW/app-3/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-nNatGW/app-3/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-nNatGW/app-3/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-nNatGW/app-3/src/db/seed.ts:59:6)
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  code: 'SQLITE_CONSTRAINT_FOREIGNKEY'
}

Node.js v24.21.0
Could not add sample data; the app works without it.
```

### 4. A tool library where neighbors lend each other tools.

```text
Toolshed
  Neighbors lend each other tools instead of each buying their own.

Pages
  - Catalog (lists tools; search by name, description or place; filter by category, condition or available; sort by name or date added; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Saved (lists tools; only the viewer's saved records)
  - Loans (lists loans; filter by status or tool; “Mark returned”)
  - Home (a landing page: hero, tools where available is yes and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tools
  Tools have:
  - a name (required)
  - photos (pictures)
  - a description (required)
  - a category (power, hand, garden, ladders, cleaning or other, power by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - an available (yes or no, true by default)

Loans
  Loans have:
  - a tool (a tool, required)
  - a borrower (required)
  - lent on (a date, required)
  - due on (a date)
  - status (out or returned, out by default)
  - returned on (a date)
  - notes

Mark returned
  For a loan that is out; sets status to returned and returned on to today.
  Record that the borrowed tool has come back.

Sign-in and access
  People sign in with a code sent to their email.
  Unless a kind of record says otherwise, everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the tool library tidy)
  - member (Lends and borrows tools)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading tools.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 117 files (117 changed, 0 removed).

Created /tmp/smithable-bench-m12-nNatGW/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-nNatGW/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-nNatGW/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Stock
  Keeps track of the bakery's ingredients, their suppliers and how much is in stock.

Pages
  - Ingredients (lists ingredients; search by name)
  - Suppliers (lists suppliers; search by name, contact name or email)
  - Team (who has access: invite people, change roles, remove users)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact name
  - an email
  - a phone
  - notes
  Each supplier lists its ingredients.

Ingredients
  Ingredients have:
  - a name (required, unique)
  - a unit (kg, g, l, ml, pieces or packs, kg by default)
  - a supplier (a supplier)
  - an in stock (a number, required, 0 by default)
  - a reorder level (a number, 0 by default)
  - a cost per unit (an amount)
  - notes
  The low stock is calculated as the in stock is at most the reorder level.

Sign-in and access
  People sign in with a code sent to their email.
  Unless a kind of record says otherwise, everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
No pictures: none of the library's files could be fetched.
Generated 99 files (99 changed, 0 removed).

Created /tmp/smithable-bench-m12-nNatGW/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-nNatGW/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Jobs
  A job board where the local union posts jobs and members apply for them.

Pages
  - Jobs (lists jobs; search by title, employer, description or location; filter by trade, job type, status or closes on; sort by closes on or date added; records can be saved as favorites; “Mark filled”; “Close job”)
  - My applications (lists applications; only the viewer's own records)
  - Applications (lists applications; search by name, email or member number; filter by job or status; only for staff users and admins)
  - Home (a landing page: hero, jobs where status is open and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a description (required)
  - a trade (construction, electrical, plumbing, carpentry, transport, healthcare or other, construction by default)
  - a job type (full time, part time or temporary, full time by default)
  - a location
  - a pay
  - closes on (a date)
  - status (open, filled or closed, open by default)
  Each job lists its applications.
  Only staff users and admins can add jobs.
  Only staff users and admins can delete jobs.

Applications
  Applications have:
  - a job (a job, required, unique)
  - a name (required)
  - an email (required)
  - a phone
  - a member number
  - a message
  - status (submitted, reviewed, accepted or rejected, submitted by default)
  Staff users and admins can see all applications; everyone else only the ones they own.

Mark filled
  For a job that is open; sets status to filled.
  Mark a job as filled once someone has been hired.
  Only staff users and admins can use it.

Close job
  For a job that is open; sets status to closed.
  Close a job post without filling it.
  Only staff users and admins can use it.

Accept
  For an application that is submitted or reviewed; sets status to accepted.
  Accept an application.
  Only staff users and admins can use it.

Reject
  For an application that is submitted or reviewed; sets status to rejected.
  Turn down an application.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Unless a kind of record says otherwise, everyone sees and changes only their own records.
  Roles:
  - admin
  - staff (Union staff who post jobs and review applications)
  - member (Union members who browse jobs and apply)
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page and reading jobs where status is open.
Pictures from the Smithable image library: hero.webp.
Generated 112 files (112 changed, 0 removed).

Created /tmp/smithable-bench-m12-nNatGW/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-nNatGW/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-nNatGW/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Club Football
  The club's site with its teams, players, fixtures and results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams and footer)
  - Matches (lists matches; search by opponent or competition; filter by team, status or venue; “Record result”; “Postpone”)
  - Teams (lists teams)
  - Players (lists players; search by name; filter by team or position)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - an age group (senior, youth or veterans, senior by default)
  - a coach
  - an about
  Each team lists its players.
  Each team lists its matches.
  Only admins can add teams.
  Only admins can change teams.
  Only admins can delete teams.

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a shirt number (a whole number)
  - an about
  Only admins can add players.
  Only admins can change players.
  Only admins can delete players.

Matches
  Matches have:
  - a team (a team, required)
  - an opponent (required)
  - a kickoff (a date and time, required)
  - a venue (home or away, home by default)
  - a competition
  - status (scheduled, played, postponed or cancelled, scheduled by default)
  - a goals for (a whole number)
  - a goals against (a whole number)
  - a report
  Only admins can add matches.
  Only admins can change matches.
  Only admins can delete matches.

Record result
  For a match that is scheduled or postponed; sets status to played; asks for the goals for and the goals against.
  Record the final score of a match.
  Only admins can use it.

Postpone
  For a match that is scheduled; sets status to postponed.
  Mark a match as postponed.
  Only admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Unless a kind of record says otherwise, everyone sees and changes only their own records.
  Roles:
  - admin (Runs the club site: teams, players, matches and results)
  - member (A club member who follows the teams)
  New users get the member role.
  Open to anyone without signing in: the home page, the matches page, the teams page, the players page, the privacy page, reading teams, reading players and reading matches.
Pictures from the Smithable image library: hero.webp.
Generated 111 files (111 changed, 0 removed).

Created /tmp/smithable-bench-m12-nNatGW/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-nNatGW/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-nNatGW/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Registration
  Talks, speakers and registration for attendees of a conference.

Pages
  - Home (a landing page: hero, speakers, faq, call to action and footer)
  - Schedule (a calendar of talks by week or month)
  - My registrations (lists registrations)
  - Talks (lists talks; only for admins)
  - Speakers (lists speakers; only for admins; visitors see speakers on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete)

Speakers
  Speakers have:
  - a name (required)
  - a title
  - a bio (formatted text)
  - a portrait (picture)
  Only admins can add speakers.

Talks
  Talks have:
  - a title (required)
  - a summary
  - a speaker (a speaker, required)
  - starts at (a date and time, required)
  - duration minutes (a whole number, required, 45 by default)
  - a room
  - a capacity (a whole number, required, 100 by default)
  Each talk lists its registrations.
  The places left is calculated as the capacity minus the number of its registrations.
  Only admins can add talks.

Registrations
  Registrations have:
  - a talk (a talk, required, unique)
  At most the talk's capacity registrations per talk.

Sign-in and access
  People sign in with a code sent to their email.
  Unless a kind of record says otherwise, everyone sees and changes only their own records.
  Roles:
  - admin (Conference organizers. Manage talks, speakers and registrations)
  - attendee (Someone attending the conference who registers for talks)
  New users get the attendee role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading talks and reading speakers.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 129 files (129 changed, 0 removed).

Created /tmp/smithable-bench-m12-nNatGW/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-nNatGW/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-nNatGW/app-8/smithable.yml:37:15  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-nNatGW/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  A help desk where the IT team tracks tickets, their priorities and who handles them.

Pages
  - Tickets (lists tickets; search by title or description; sort by priority, status or date added; “Take”; “Resolve”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users)

Tickets
  Tickets have:
  - a title (required)
  - a description
  - a category (other, hardware, software, network or access, other by default)
  - a priority (normal, low, high or urgent, normal by default)
  - status (open, in progress, resolved or closed, open by default)
  - resolved at (a date and time)
  Each ticket can have an assignee (a user).

Take
  For a ticket that is open; sets assignee to whoever presses it and status to in progress.
  Take an open ticket and start working on it.

Resolve
  For a ticket that is open or in progress; sets status to resolved and resolved at to now.
  Mark a ticket as resolved.

Close
  For a ticket that is resolved; sets status to closed.
  Close a resolved ticket.

Reopen
  For a ticket that is resolved or closed; sets status to open; asks for the resolved at.
  Reopen a ticket that needs more work.

Sign-in and access
  People sign in with a code sent to their email.
  Unless a kind of record says otherwise, everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
No pictures: none of the library's files could be fetched.
Generated 103 files (103 changed, 0 removed).

Created /tmp/smithable-bench-m12-nNatGW/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-nNatGW/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A family's shared recipe collection, with each recipe's ingredients and shopping lists for the next trip to the store.

Pages
  - Recipes (lists recipes; search by name or summary; filter by category or favorite)
  - Shopping lists (lists shopping lists; “Mark done”)
  - Team (who has access: invite people, change roles, remove users)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - a category (main, starter, side, dessert, baking, breakfast or drink, main by default)
  - servings (a whole number, 4 by default)
  - minutes (a whole number)
  - instructions
  - a link (a web address)
  - a favorite (yes or no)
  Each recipe lists its ingredients.

Ingredients
  Ingredients have:
  - a recipe (a recipe, required)
  - a name (required)
  - a quantity

Shopping lists
  Shopping lists have:
  - a name (required)
  - shop on (a date)
  - status (open or done, open by default)
  Each shopping list lists its shopping items.

Shopping items
  Shopping items have:
  - a list (a shopping list, required)
  - a name (required)
  - a quantity
  - a bought (yes or no)

Mark done
  For a shopping list that is open; sets status to done.
  Mark a shopping list as done after the shopping trip.

Mark bought
  For a shopping item that is not bought; sets bought to yes.
  Tick off an item once it is in the basket.

Sign-in and access
  People sign in with a code sent to their email.
  Unless a kind of record says otherwise, everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the app and invites the family)
  - member (A family member: adds and edits recipes and shopping lists)
  New users get the member role.
No pictures: none of the library's files could be fetched.
Generated 110 files (110 changed, 0 removed).

Created /tmp/smithable-bench-m12-nNatGW/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-nNatGW/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  The live state of our API: incidents as they happen and planned maintenance ahead.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Overview (a dashboard: open, per month and latest)
  - Team (who has access: invite people, change roles, remove users)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each component lists its incidents.

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a component)
  - detected at (a date and time, required)
  - resolved at (a date and time)
  - a summary
  Each incident lists its incident updates.
  Only staff users and admins can change incidents.

Incident updates
  Incident updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)

Maintenances
  Maintenances have:
  - a title (required)
  - a component (a component)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description

Identified
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.
  Only staff users and admins can use it.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.
  Only staff users and admins can use it.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The incident is over, with an update saying so.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Unless a kind of record says otherwise, everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status page and the team)
  - staff (Writes incidents, their updates and planned maintenance)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
Pictures from the Smithable image library: hero.webp.
Generated 143 files (143 changed, 0 removed).

Created /tmp/smithable-bench-m12-nNatGW/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-nNatGW/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-nNatGW/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The state of our web shop's services, outages and their updates, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Overview (a dashboard: open, per month and latest)
  - Team (who has access: invite people, change roles, remove users)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each component lists its incidents.

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a component)
  - detected at (a date and time, required)
  - resolved at (a date and time)
  - a summary
  Each incident lists its incident updates.

Incident updates
  Incident updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)

Identified
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.
  Only staff users and admins can use it.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.
  Only staff users and admins can use it.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The incident is over, with an update saying so.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Unless a kind of record says otherwise, everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved and reading incident updates.
Pictures from the Smithable image library: hero.webp.
Generated 118 files (118 changed, 0 removed).

Created /tmp/smithable-bench-m12-nNatGW/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-nNatGW/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-nNatGW/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
