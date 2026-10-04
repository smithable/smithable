# M12 first builds: claude-code (2026-10-04)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 12 / 12 created, 10 type-check, 334,897 tokens (306,550 in, 28,347 out), $0.9698 (as Claude Code reports it; the run was on a subscription); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 24,023 | 2,251 | $0.2372 | 0 | 1 | 30 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 23,578 | 2,405 | $0.0659 | 0 | 1 | 32 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | **no** | 49,045 | 4,696 | $0.1447 | 0 | 2 | 57 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | **no** | 23,061 | 1,713 | $0.0480 | 0 | 1 | 28 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 22,935 | 1,307 | $0.0388 | 0 | 1 | 37 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 23,060 | 2,850 | $0.0707 | 0 | 1 | 61 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 22,922 | 2,797 | $0.0685 | 0 | 1 | 61 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 24,018 | 1,767 | $0.0567 | 0 | 1 | 56 s |
| A help desk for an IT team: tickets, priorities and who handles them. | records | yes | yes | 22,931 | 1,617 | $0.0450 | 0 | 1 | 39 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 22,930 | 1,618 | $0.0450 | 0 | 1 | 33 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 24,022 | 2,675 | $0.0749 | 0 | 1 | 41 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 24,025 | 2,651 | $0.0744 | 0 | 1 | 37 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 3 | 4 / 6 (has 4) | 7 / 10 (has 7) | 0 / 0 (has 0) | private; admin, member (member) | sessions: admin, class-types: admin, instructors: admin | pages home, schedule; read ClassType, Instructor, Session; create none | 1 (no-timezone) | none | 3 / 4 | mentions visitors; landing page |
| 2 | crm | 3 | 0 / 2 (has 4) | 1 / 3 (has 5) | 0 / 1 (has 3) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 3 | 3 / 4 (has 4) | 5 / 7 (has 6) | 2 / 2 (has 4) | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 1) | 3 / 4 (has 4) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, catalog; read Tool; create none | 0 | none | 0 / 1 | no mention; landing page |
| 5 | records (words: booking) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 4 (has 5) | 0 / 0 (has 5) | private; admin, staff, member (member) | applications: staff/admin | pages home, jobs; read Job; create none | 0 | none | 0 / 2 | no mention; landing page |
| 7 | records | 3 | 0 / 1 (has 3) | 1 / 2 (has 4) | 0 / 0 (has 1) | private; admin, member (member) | none | pages home, teams, players, matches; read Team, Player, Match; create none | 0 | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 3 / 10 (has 6) | 0 / 0 (has 0) | private; admin, attendee (attendee) | talks: admin, speakers: admin | pages home, schedule; read Talk, Speaker; create none | 1 (no-timezone) | none | 0 / 3 | no mention; landing page |
| 9 | records (words: invoicing) | 3 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 4) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page |
| 11 | status | 3 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page |
| 12 | status | 2 | 3 / 4 (has 3) | 6 / 8 (has 6) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate; create none | 0 | Payments | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Lotus Path Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, teachers, faq and footer)
  - Schedule (a calendar of sessions by week or month)
  - My bookings (lists bookings)
  - Sessions (lists sessions; only for admins)
  - Class types (lists class types; only for admins; visitors see class types on the Home page)
  - Teachers (lists teachers; only for admins; visitors see teachers on the Home page)
  - Admin (every kind of record, to find, open, change and delete)

Class types
  Class types have:
  - a name (required)
  - a summary
  - a level (all levels, beginner or advanced, all levels by default)
  - duration minutes (a whole number, required, 60 by default)
  Only admins can add class types.

Teachers
  Teachers have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)
  Only admins can add teachers.

Sessions
  Sessions have:
  - a class type (a class type, required)
  - an instructor (a teacher, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 12 by default)
  Each session lists its bookings.
  The places left is calculated as the capacity minus the number of its bookings.
  Only admins can add sessions.

Bookings
  Bookings have:
  - a session (a session, required, unique)
  At most the session's capacity bookings per session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studio staff. Manage the schedule, classes and teachers)
  - member (A student who books classes)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors and reading sessions.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 119 files (119 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4TFGeM/app-1/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 5 columns 1 indexes 2 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_smiling_dracula.sql 🚀

Created /tmp/smithable-bench-m12-4TFGeM/app-1. Start it with:

  cd /tmp/smithable-bench-m12-4TFGeM/app-1
  smithable run
/tmp/smithable-bench-m12-4TFGeM/app-1/smithable.yml:52:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Pipeline CRM
  A simple CRM for a small sales team to track companies, contacts, deals and follow-ups.

Pages
  - Deals (lists deals; search by title; “Mark won”; “Mark lost”)
  - Companies (lists companies; search by name or industry)
  - Contacts (lists contacts; search by name, email or phone; filter by company)
  - Follow ups (lists follow ups; search by subject; “Complete”)
  - Team (who has access: invite people, change roles, remove users)

Companies
  Companies have:
  - a name (required)
  - a website (a web address)
  - a phone
  - an industry
  - a segment (smb, enterprise or government, smb by default)
  - notes
  Each company can have an account manager (a user).
  Each company lists its contacts.
  Each company lists its deals.
  Only admins can delete companies.

Contacts
  Contacts have:
  - a name (required)
  - a job title
  - an email (unique)
  - a phone
  - a company (a company)
  - notes

Deals
  Deals have:
  - a title (required)
  - a company (a company, required)
  - a contact (a contact)
  - a value (an amount)
  - a stage (lead, qualified, proposal, negotiation, won or lost, lead by default)
  - an expected close (a date)
  - closed at (a date and time)
  - a lost reason
  Each deal can have a salesperson (a user).
  Each deal lists its follow ups.
  Only admins can delete deals.

Follow ups
  Follow ups have:
  - a subject (required)
  - a due date (required)
  - a deal (a deal)
  - a contact (a contact)
  - status (open or done, open by default)
  - done at (a date and time)
  - notes
  Each follow up can have an assignee (a user).

Mark won
  For a deal that is lead, qualified, proposal or negotiation; sets stage to won and closed at to now.
  Close the deal as won.

Mark lost
  For a deal that is lead, qualified, proposal or negotiation; sets stage to lost and closed at to now; asks for the lost reason.
  Close the deal as lost and note why.

Complete
  For a follow up that is open; sets status to done and done at to now.
  Mark the follow-up as done.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Sales management. Full access)
  - sales (Works with companies, contacts, deals and follow-ups)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 104 files (104 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4TFGeM/app-2/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
companies 11 columns 0 indexes 2 fks
contacts 10 columns 1 indexes 2 fks
deals 13 columns 0 indexes 4 fks
follow_ups 12 columns 0 indexes 4 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_modern_living_lightning.sql 🚀

Created /tmp/smithable-bench-m12-4TFGeM/app-2. Start it with:

  cd /tmp/smithable-bench-m12-4TFGeM/app-2
  smithable run
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Ledgerly
  Simple invoicing for freelancers: keep track of clients, invoices and the payments that settle them.

Pages
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Clients (lists clients; search by name or email)
  - Payments (lists payments; filter by method or paid on)
  - Invoice lines (lists invoice lines)
  - Overview (a dashboard: received, outstanding, overdue, invoiced and latest)
  - Invoices (lists invoices; search by number; filter by status, client or issued on; “Mark sent”; “Mark overdue”; “Mark paid”; “Duplicate”)

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
  - paid on (a date, required, today by default)
  - an amount (an amount, required)
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

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The due date passed without full payment.

Mark paid
  For an invoice that is sent or overdue; sets status to paid; asks for the payment's amount and the payment's method; adds a payment (paid on today).
  The client paid the invoice; the payment is recorded.

Duplicate
  Makes a copy of an invoice with status draft and issued on today, asking for the number; its lines are copied too.
  Start a new invoice from an earlier one.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member (A freelancer invoicing their own clients)
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 109 files (109 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4TFGeM/app-3/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 12 columns 1 indexes 2 fks
payments 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_milky_micromacro.sql 🚀

Created /tmp/smithable-bench-m12-4TFGeM/app-3. Start it with:

  cd /tmp/smithable-bench-m12-4TFGeM/app-3
  smithable run

/tmp/smithable-bench-m12-4TFGeM/app-3/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-4TFGeM/app-3/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-4TFGeM/app-3/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-4TFGeM/app-3/src/db/seed.ts:59:6)
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
  - Catalog (lists tools; search by title, description or place; filter by category, condition or available; sort by title or date added; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Saved (lists tools; only the viewer's saved records)
  - Home (a landing page: hero, tools where available is yes and footer)

Tools
  Tools have:
  - a title (required)
  - photos (pictures)
  - a description (required)
  - a category (power tools, hand tools, garden, ladders, cleaning or other, power tools by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - an available (yes or no, true by default)

Lend out
  For a tool that is available; sets available to no.
  Mark a tool as lent to a neighbor.

Mark returned
  For a tool that is not available; sets available to yes.
  Mark a lent tool as back and available again.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member (Lends and borrows tools)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading tools.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 97 files (97 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4TFGeM/app-4/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
session 8 columns 2 indexes 1 fks
tools 11 columns 0 indexes 1 fks
tools_favorites 4 columns 1 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_hesitant_butterfly.sql 🚀

Created /tmp/smithable-bench-m12-4TFGeM/app-4. Start it with:

  cd /tmp/smithable-bench-m12-4TFGeM/app-4
  smithable run
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Stock
  Keep track of the bakery's ingredients, their suppliers and how much is in stock.

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
  - a supplier (a supplier)
  - a unit (kg, g, l, ml or pieces, kg by default)
  - a quantity in stock (a number, required, 0 by default)
  - a reorder level (a number, 0 by default)
  - notes
  The low stock is calculated as the quantity in stock is at most the reorder level.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4TFGeM/app-5/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
ingredients 11 columns 1 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
suppliers 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_gifted_vermin.sql 🚀

Created /tmp/smithable-bench-m12-4TFGeM/app-5. Start it with:

  cd /tmp/smithable-bench-m12-4TFGeM/app-5
  smithable run
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Jobs
  Job posts for union members, and the applications they send.

Pages
  - Jobs (lists jobs; search by title, employer, description or location; filter by type, status or deadline; sort by deadline or date added; records can be saved as favorites; “Mark filled”; “Close”)
  - My applications (lists applications; only the viewer's own records)
  - Applications (lists applications; search by name or email; filter by job or status; only for staff users and admins)
  - Home (a landing page: hero, jobs where status is open and footer)
  - Team (who has access: invite people, change roles, remove users)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a description (required)
  - a location
  - a type (full time, part time, temporary or contract, full time by default)
  - a pay
  - a deadline (a date)
  - status (open, filled or closed, open by default)
  Each job lists its applications.
  Only staff users and admins can add jobs.
  Only staff users and admins can delete jobs.

Applications
  Applications have:
  - a job (a job, required)
  - a name (required)
  - an email (required)
  - a phone
  - a message
  - status (submitted, reviewing, accepted or rejected, submitted by default)
  Only the owner, staff users and admins can see applications.

Start review
  For an application that is submitted; sets status to reviewing.
  Mark an application as being reviewed.
  Only staff users and admins can use it.

Accept
  For an application that is submitted or reviewing; sets status to accepted.
  Accept an application.
  Only staff users and admins can use it.

Reject
  For an application that is submitted or reviewing; sets status to rejected.
  Turn down an application.
  Only staff users and admins can use it.

Mark filled
  For a job that is open; sets status to filled.
  Mark a job as filled.
  Only staff users and admins can use it.

Close
  For a job that is open; sets status to closed.
  Close a job post without filling it.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - staff (Union staff who post jobs and review applications)
  - member (Union members who browse jobs and apply)
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page and reading jobs where status is open.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 102 files (102 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4TFGeM/app-6/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
applications 10 columns 0 indexes 2 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
jobs 12 columns 0 indexes 1 fks
jobs_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_ambiguous_sauron.sql 🚀

Created /tmp/smithable-bench-m12-4TFGeM/app-6. Start it with:

  cd /tmp/smithable-bench-m12-4TFGeM/app-6
  smithable run
```

### 7. A football club's site: teams, players, matches and results.

```text
Football Club
  The club's site with its teams, players, fixtures and results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams and footer)
  - Matches (lists matches; filter by team, venue or status; “Record result”)
  - Teams (lists teams)
  - Players (lists players; search by name; filter by team or position)

Teams
  Teams have:
  - a name (required)
  - an age group
  - a coach
  - a description
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
  - a bio
  Only admins can add players.
  Only admins can change players.
  Only admins can delete players.

Matches
  Matches have:
  - a team (a team, required)
  - an opponent (required)
  - a kickoff (a date and time, required)
  - a venue (home or away, home by default)
  - a location
  - status (scheduled, played, postponed or canceled, scheduled by default)
  - a goals for (a whole number)
  - a goals against (a whole number)
  - a report
  Only admins can add matches.
  Only admins can change matches.
  Only admins can delete matches.

Record result
  For a match that is scheduled; sets status to played; asks for the goals for and the goals against.
  Enter the final score of a match.
  Only admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Runs the club's site)
  - member (Follows the club)
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, the players page, the matches page, reading teams, reading players and reading matches.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 92 files (92 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4TFGeM/app-7/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
matches 13 columns 0 indexes 2 fks
players 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_remarkable_meggan.sql 🚀

Created /tmp/smithable-bench-m12-4TFGeM/app-7. Start it with:

  cd /tmp/smithable-bench-m12-4TFGeM/app-7
  smithable run
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Registration
  Talks, speakers and registration for attendees of a conference.

Pages
  - Home (a landing page: hero, talks, speakers, faq, call to action and footer)
  - My registrations (lists registrations)
  - Schedule (a calendar of talks by week or month)
  - Talks (lists talks; only for admins; visitors see talks on the Home page)
  - Speakers (lists speakers; only for admins; visitors see speakers on the Home page)
  - Admin (every kind of record, to find, open, change and delete)

Speakers
  Speakers have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)
  Only admins can add speakers.

Talks
  Talks have:
  - a title (required)
  - a summary
  - a speaker (a speaker, required)
  - starts at (a date and time, required)
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
  Everyone sees and changes only their own records.
  Roles:
  - admin (Conference organizers. Manage the talks and speakers)
  - attendee (Someone attending the conference who registers for talks)
  New users get the attendee role.
  Open to anyone without signing in: the home page, the schedule page, reading talks and reading speakers.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 111 files (111 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4TFGeM/app-8/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
registrations 5 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
speakers 7 columns 0 indexes 1 fks
talks 11 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_moaning_sir_ram.sql 🚀

Created /tmp/smithable-bench-m12-4TFGeM/app-8. Start it with:

  cd /tmp/smithable-bench-m12-4TFGeM/app-8
  smithable run
/tmp/smithable-bench-m12-4TFGeM/app-8/smithable.yml:37:15  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  A help desk where the IT team tracks tickets, their priorities and who handles them.

Pages
  - Tickets (lists tickets; search by title, description or requester; sort by priority, status or date added; “Take”; “Resolve”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users)

Tickets
  Tickets have:
  - a title (required)
  - a description
  - a requester
  - a priority (low, normal, high or urgent, low by default)
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
  Reopen a ticket whose problem came back.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 91 files (91 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4TFGeM/app-9/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
tickets 11 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_acoustic_sabretooth.sql 🚀

Created /tmp/smithable-bench-m12-4TFGeM/app-9. Start it with:

  cd /tmp/smithable-bench-m12-4TFGeM/app-9
  smithable run
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Kitchen
  The family's recipe collection, with each recipe's ingredients and shared shopping lists.

Pages
  - Recipes (lists recipes; search by name, summary or category; filter by category or favorite)
  - Shopping lists (lists shopping lists; filter by status; “Finish shopping”)
  - Team (who has access: invite people, change roles, remove users)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - a category (main, side, soup, dessert, breakfast, baking or drink, main by default)
  - servings (a whole number, 4 by default)
  - minutes (a whole number)
  - instructions
  - a source (a web address)
  - a favorite (yes or no)
  Each recipe lists its ingredients.

Ingredients
  Ingredients have:
  - a recipe (a recipe, required)
  - a name (required)
  - a quantity
  - a note

Shopping lists
  Shopping lists have:
  - a name (required)
  - shop on (a date, today by default)
  - status (open or done, open by default)
  Each shopping list lists its shopping items.

Shopping items
  Shopping items have:
  - a list (a shopping list, required)
  - a name (required)
  - a quantity
  - a for recipe (a recipe)
  - a bought (yes or no)

Mark bought
  For a shopping item that is not bought; sets bought to yes.
  Tick off an item once it is in the basket.

Finish shopping
  For a shopping list that is open; sets status to done.
  Mark a shopping list as done after the trip to the shop.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 96 files (96 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4TFGeM/app-10/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
ingredients 8 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
recipes 12 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
shopping_items 9 columns 0 indexes 3 fks
shopping_lists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_safe_zodiak.sql 🚀

Created /tmp/smithable-bench-m12-4TFGeM/app-10. Start it with:

  cd /tmp/smithable-bench-m12-4TFGeM/app-10
  smithable run
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  The live state of our API, its incidents and planned maintenance.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Components (lists components; only for admins; visitors see components on the Home page)
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
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status page and the team)
  - staff (Writes incidents, their updates and planned maintenance)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 109 files (109 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4TFGeM/app-11/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
api_key 10 columns 1 indexes 0 fks
audit_log 13 columns 2 indexes 0 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
maintenances 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_overjoyed_wasp.sql 🚀

Created /tmp/smithable-bench-m12-4TFGeM/app-11. Start it with:

  cd /tmp/smithable-bench-m12-4TFGeM/app-11
  smithable run
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The state of our web shop's services, outages and their updates, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved and footer)
  - Overview (a dashboard: open, per month and latest)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
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
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved and reading incident updates.
  Other programs can read and change components and incidents with a key, and run resolve.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 104 files (104 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4TFGeM/app-12/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
api_key 10 columns 1 indexes 0 fks
audit_log 13 columns 2 indexes 0 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_numerous_diamondback.sql 🚀

Created /tmp/smithable-bench-m12-4TFGeM/app-12. Start it with:

  cd /tmp/smithable-bench-m12-4TFGeM/app-12
  smithable run
```
