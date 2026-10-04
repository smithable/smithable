# M12 first builds: eu.anthropic.claude-sonnet-4-6 (2026-10-04)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 12 / 12 created, 11 type-check, 364,217 tokens (327,231 in, 36,986 out), $0.8681; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

Prompt caching: of the input of the 30 calls the model answered (the response cache's are not counted), 281,333 tokens were read from the cache (the fixed system text, at a tenth of the price), 16,549 written to it (a quarter more than the price) and 45,250 were new.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 18,304 | 3,523 | $0.1322 | 0 | 3 | 79 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 36,912 | 4,086 | $0.0909 | 0 | 6 | 58 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 17,960 | 3,025 | $0.0600 | 0 | 4 | 49 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 35,792 | 2,651 | $0.0636 | 0 | 5 | 41 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 17,434 | 1,079 | $0.0262 | 0 | 3 | 29 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 17,526 | 3,116 | $0.0601 | 0 | 4 | 41 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 35,803 | 2,714 | $0.0646 | 0 | 7 | 38 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 18,301 | 2,351 | $0.0500 | 0 | 3 | 34 s |
| A help desk for an IT team: tickets, priorities and who handles them. | status | yes | yes | 37,172 | 4,658 | $0.1012 | 0 | 4 | 44 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | **no** | 17,431 | 1,814 | $0.0383 | 0 | 4 | 28 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 37,468 | 4,284 | $0.0960 | 0 | 5 | 43 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 37,128 | 3,685 | $0.0850 | 0 | 7 | 37 s |

Each created app's four spec files are in [m12-first-builds-eu.anthropic.claude-sonnet-4-6/](m12-first-builds-eu.anthropic.claude-sonnet-4-6/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 2 | 6 / 6 (has 6) | 10 / 10 (has 10) | 0 / 0 (has 0) | private; admin, member (member) | sessions: admin, class-types: admin, instructors: admin, messages: admin, posts: admin | pages home, schedule, blog; read ClassType, Instructor, Session, Post; create Message | 0 | none | 4 / 6 | mentions visitors; landing page |
| 2 | crm | 2 | 0 / 2 (has 4) | 1 / 3 (has 5) | 0 / 1 (has 4) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 0 | 4 / 4 (has 5) | 5 / 7 (has 7) | 2 / 2 (has 3) | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 3 / 5 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 1) | 3 / 4 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 0 / 1 | no mention; landing page |
| 5 | records (words: booking) | 3 | 0 / 1 (has 3) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 4 (has 5) | 0 / 0 (has 5) | private; admin, member (member) | applications: admin | pages home, jobs; read JobPost; create none | 0 | none | 0 / 2 | no mention; landing page |
| 7 | records | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, teams, matches; read Team, Match; create none | 0 | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 1 / 6 (has 4) | 4 / 10 (has 8) | 0 / 0 (has 0) | private; admin, attendee (attendee) | talks: admin, speakers: admin, messages: admin | pages home, schedule; read Talk, Speaker; create Message | 3 (capacity-no-unique, no-timezone, public-personal-data) | none | 0 / 4 | no mention; landing page |
| 9 | status (words: invoicing) | 3 | 0 / 4 (has 2) | 3 / 8 (has 4) | 1 / 3 (has 4) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 5) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page |
| 11 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page |
| 12 | status | 1 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
YogaBook
  Class schedule and online booking for a yoga studio.

Pages
  - Welcome to Our Yoga Studio (a landing page: hero, class types, gallery, faq, call to action, posts where status is published, contact and footer)
  - Class Schedule (a calendar of sessions by week or month)
  - My Bookings (lists bookings; only the viewer's own records)
  - Sessions (lists sessions; filter by class type, instructor or starts at; only for admins)
  - Class Types (lists class types; search by name; only for admins; visitors see class types on the Welcome to Our Yoga Studio page)
  - Instructors (lists instructors; search by name; only for admins)
  - Messages (lists messages; only for admins)
  - News & Articles (posts as articles, newest first, each on its own page)
  - Posts (lists posts; only for admins; visitors see posts on the Welcome to Our Yoga Studio page)
  - Admin (every kind of record, to find, open, change and delete)

Class types
  Class types have:
  - a name (required)
  - a summary
  - a level (beginner, all levels or advanced, beginner by default)
  - duration minutes (a whole number, required, 60 by default)
  Only admins can add class types.

Instructors
  Instructors have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)
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

Posts
  Posts have:
  - a title (required)
  - address (unique)
  - a summary
  - a cover (picture)
  - a body (formatted text, required)
  - published on (a date)
  - status (draft or published, draft by default)
  Only admins can add posts.
  Only admins can change posts.
  Only admins can delete posts.

Messages
  Messages have:
  - a name (required)
  - an email (required)
  - a message (required)
  Only admins can see messages.
  Only admins can change messages.
  Only admins can delete messages.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studio staff. Manage the schedule, classes and teachers)
  - member (A student who books classes)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the blog page, reading class types, reading instructors, reading sessions, reading posts where status is published and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 140 files (140 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-fprkNv/app-1/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 5 columns 1 indexes 2 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
messages 7 columns 0 indexes 1 fks
posts 11 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_nice_gladiator.sql 🚀

Created /tmp/smithable-bench-m12-fprkNv/app-1. Start it with:

  cd /tmp/smithable-bench-m12-fprkNv/app-1
  smithable run
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Sales CRM
  Lightweight CRM for a small sales team to manage companies, contacts, deals and follow-ups.

Pages
  - Contacts (lists contacts; search by first name, last name, email or phone; filter by company; sort by first name or last name)
  - Deals (lists deals; search by title; filter by status, company or expected close date; sort by title, value or expected close date; “Mark won”; “Mark lost”)
  - Follow ups (lists follow ups; search by notes; filter by status, type, due date or deal; sort by due date; “Complete”; “Skip”)
  - Team (who has access: invite people, change roles, remove users)
  - Companies (lists companies; search by name or email; sort by name)

Contacts
  Contacts have:
  - a first name (required)
  - a last name (required)
  - a title
  - an email
  - a phone
  - notes
  - a company (a company)
  Only admins can delete contacts.

Deals
  Deals have:
  - a title (required)
  - a contact (a contact)
  - a value (an amount)
  - status (prospecting, qualified, proposal, negotiation, won or lost, prospecting by default)
  - an expected close date
  - notes
  - a company (a company)
  Each deal can have an assigned to (a user).
  Only admins can delete deals.

Follow ups
  Follow ups have:
  - a deal (a deal, required)
  - a contact (a contact)
  - a due date (required)
  - a type (call, email, meeting, demo or other, call by default)
  - notes
  - status (pending, done or skipped, pending by default)
  Each follow up can have an assigned to (a user).
  Only admins can delete follow ups.

Companies
  Companies have:
  - a name (required)
  - a website (a web address)
  - a phone
  - an email
  - an industry
  - a size (1–10, 11–50, 51–200, 201–1000 or 1000+, 1–10 by default)
  - notes
  Each company can have an account manager (a user).
  Only admins can delete companies.

Mark won
  For a deal that is prospecting, qualified, proposal or negotiation; sets status to won.
  Mark a deal as won.

Mark lost
  For a deal that is prospecting, qualified, proposal or negotiation; sets status to lost.
  Mark a deal as lost.

Complete
  For a follow up that is pending; sets status to done.
  Mark a follow-up as done.

Skip
  For a follow up that is pending; sets status to skipped.
  Mark a follow-up as skipped.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Sales management. Full access)
  - sales (Works with companies, contacts, deals and follow-ups)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 106 files (106 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-fprkNv/app-2/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
companies 12 columns 0 indexes 2 fks
contacts 11 columns 0 indexes 2 fks
deals 12 columns 0 indexes 4 fks
follow_ups 11 columns 0 indexes 4 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_stormy_jack_power.sql 🚀

Created /tmp/smithable-bench-m12-fprkNv/app-2. Start it with:

  cd /tmp/smithable-bench-m12-fprkNv/app-2
  smithable run
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
FreelanceInvoice
  Simple invoicing for freelancers, with clients, invoices and payments.

Pages
  - Invoice with ease (a landing page: hero, features, pricing, faq, call to action and footer)
  - Invoices (lists invoices; search by number or status; filter by status, client, issued on or due on)
  - Clients (lists clients; search by name or email; sort by name)
  - Payments (lists payments; filter by invoice or paid on)
  - Invoice lines (lists invoice lines)
  - Overview (a dashboard: latest)
  - Team (who has access: invite people, change roles, remove users)

Business profiles
  Business profiles have:
  - a business name (required)
  - a VAT number
  - an IBAN
  - payment term days (a whole number, required, 30 by default)
  - an invoice footer

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  - a VAT number
  Each client lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required)
  - status (draft, sent, paid or overdue, draft by default)
  Each invoice lists its invoice lines.
  The total is calculated as the total amount of its lines.

Invoice lines
  Invoice lines have:
  - an invoice (an invoice, required)
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  The amount is calculated as the quantity times the unit price.

Payments
  Payments have:
  - an invoice (an invoice, required)
  - paid on (a date, required, today by default)
  - an amount (an amount, required)
  - notes

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The client paid the invoice.

Mark overdue
  For an invoice that is sent; sets status to overdue.
  Mark the invoice as overdue when the due date has passed.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (App administrator)
  - member (A freelancer using the app)
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 113 files (113 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-fprkNv/app-3/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
payments 8 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_sad_doorman.sql 🚀

Created /tmp/smithable-bench-m12-fprkNv/app-3. Start it with:

  cd /tmp/smithable-bench-m12-fprkNv/app-3
  smithable run

/tmp/smithable-bench-m12-fprkNv/app-3/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-fprkNv/app-3/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-fprkNv/app-3/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-fprkNv/app-3/src/db/seed.ts:74:6)
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
ToolShare
  A neighborhood tool library where people lend and borrow tools from each other.

Pages
  - Browse Tools (lists tools; search by title or location; filter by category, condition or available; sort by title or date added; records can be saved as favorites; contact the owner by mail)
  - Borrow the tools you need from your neighbors (a landing page: hero, tools and footer)
  - My Tools (lists tools; only the viewer's own records)
  - Saved Tools (lists tools; only the viewer's saved records)

Tools
  Tools have:
  - a title (required)
  - photos (pictures)
  - a description (required)
  - a category (hand tools, power tools, garden, plumbing, electrical, measuring or other, hand tools by default)
  - a condition (like new, good or worn, like new by default)
  - a location
  - an available (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the tool library tidy)
  - member (Lends and borrows tools)
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 93 files (93 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-fprkNv/app-4/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
session 8 columns 2 indexes 1 fks
tools 11 columns 0 indexes 1 fks
tools_favorites 4 columns 1 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_conscious_multiple_man.sql 🚀

Created /tmp/smithable-bench-m12-fprkNv/app-4. Start it with:

  cd /tmp/smithable-bench-m12-fprkNv/app-4
  smithable run
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  Track ingredients, suppliers and stock levels for a small bakery.

Pages
  - Suppliers (lists suppliers; search by name, contact name or email; sort by name)
  - Ingredients (lists ingredients; search by name, category or unit; filter by supplier; sort by name, category or unit)
  - Stock (lists stock entries; filter by ingredient or date)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact name
  - an email
  - a phone
  - notes

Ingredients
  Ingredients have:
  - a name (required)
  - a category
  - a unit (required)
  - a reorder level (a number)
  - a supplier (a supplier)

Stock entries
  Stock entries have:
  - an ingredient (an ingredient, required)
  - a quantity (a number, required)
  - a date (required, today by default)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 89 files (89 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-fprkNv/app-5/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
ingredients 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
stock_entries 8 columns 0 indexes 2 fks
suppliers 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_faulty_killer_shrike.sql 🚀

Created /tmp/smithable-bench-m12-fprkNv/app-5. Start it with:

  cd /tmp/smithable-bench-m12-fprkNv/app-5
  smithable run
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  A job board for local union members to post and apply for jobs.

Pages
  - Job Posts (lists job posts; search by title, trade or location; sort by closing date, wage or date added; “Close job”; “Reopen job”)
  - All Applications (lists applications; filter by status or job post; only for admins)
  - My Applications (lists applications; filter by status or job post; only the viewer's own records)
  - Union Job Board (a landing page: hero, features, call to action and footer)
  - Team (who has access: invite people, change roles, remove users)

Job posts
  Job posts have:
  - a title (required)
  - a description (required)
  - a location
  - a type (full time, part time, temporary or apprenticeship, full time by default)
  - a trade
  - a wage (an amount)
  - a closing date
  - status (open or closed, open by default)
  Only admins can add job posts.
  Only admins can delete job posts.

Applications
  Applications have:
  - a job post (a job post, required)
  - a cover letter
  - a resume URL (a web address)
  - status (submitted, reviewing, accepted or rejected, submitted by default)

Close job
  For a job post that is open; sets status to closed.
  Close a job post so no more applications are accepted.
  Only admins can use it.

Reopen job
  For a job post that is closed; sets status to open.
  Reopen a closed job post to accept applications again.
  Only admins can use it.

Accept application
  For an application that is submitted or reviewing; sets status to accepted.
  Accept an application.
  Only admins can use it.

Reject application
  For an application that is submitted or reviewing; sets status to rejected.
  Reject an application.
  Only admins can use it.

Mark reviewing
  For an application that is submitted; sets status to reviewing.
  Mark an application as under review.
  Only admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Manages job posts and oversees applications)
  - member (Browses job posts and submits applications)
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page and reading job posts where status is open.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 102 files (102 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-fprkNv/app-6/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
applications 8 columns 0 indexes 2 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
job_posts 12 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_foamy_living_mummy.sql 🚀

Created /tmp/smithable-bench-m12-fprkNv/app-6. Start it with:

  cd /tmp/smithable-bench-m12-fprkNv/app-6
  smithable run
```

### 7. A football club's site: teams, players, matches and results.

```text
Club FC
  A football club's public site showing teams, players, matches and results.

Pages
  - Welcome to Club FC (a landing page: hero, teams, matches where status is scheduled, matches where status is played and footer)
  - Teams (lists teams; search by name, category or coach)
  - Matches (lists matches; search by opponent or venue; filter by team, status or home; “Record result”; “Cancel match”)
  - Team (who has access: invite people, change roles, remove users)
  - Players (lists players; search by name or position; filter by team or position)

Teams
  Teams have:
  - a name (required)
  - a category
  - a coach
  - a description
  Only admins can add teams.
  Only admins can change teams.
  Only admins can delete teams.

Matches
  Matches have:
  - a date (a date and time, required)
  - an opponent (required)
  - a home (yes or no, required, true by default)
  - a team (a team, required)
  - a venue
  - status (scheduled, played or cancelled, scheduled by default)
  - a home score (a whole number)
  - an away score (a whole number)
  - a report
  Only admins can add matches.
  Only admins can change matches.
  Only admins can delete matches.

Players
  Players have:
  - a name (required)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a number (a whole number)
  - a date of birth
  - a team (a team, required)
  Only admins can add players.
  Only admins can change players.
  Only admins can delete players.

Record result
  For a match that is scheduled; sets status to played; asks for the home score and the away score.
  Record the final score and mark the match as played.

Cancel match
  For a match that is scheduled; sets status to cancelled.
  Mark a scheduled match as cancelled.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, the matches page, reading teams and reading matches.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 98 files (98 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-fprkNv/app-7/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
matches 13 columns 0 indexes 2 fks
players 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_silky_masked_marvel.sql 🚀

Created /tmp/smithable-bench-m12-fprkNv/app-7. Start it with:

  cd /tmp/smithable-bench-m12-fprkNv/app-7
  smithable run
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
ConferenceHub
  Event registration for a conference: browse talks and speakers, and register your place.

Pages
  - Welcome to the Conference (a landing page: hero, features, talks, speakers, faq, contact and footer)
  - Schedule (a calendar of talks by week or month)
  - My Registrations (lists registrations)
  - Talks (lists talks; search by title or room; filter by speaker or starts at; only for admins; visitors see talks on the Welcome to the Conference page)
  - Speakers (lists speakers; search by name; only for admins; visitors see speakers on the Welcome to the Conference page)
  - Messages (lists messages; only for admins)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)

Speakers
  Speakers have:
  - a name (required)
  - a bio
  - a photo (picture)
  - an email
  Only admins can add speakers.
  Only admins can change speakers.
  Only admins can delete speakers.

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
  Only admins can change talks.
  Only admins can delete talks.

Registrations
  Registrations have:
  - a talk (a talk, required)
  At most the talk's capacity registrations per talk.

Messages
  Messages have:
  - a name (required)
  - an email (required)
  - a message (required)
  Only admins can see messages.
  Only admins can change messages.
  Only admins can delete messages.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Conference organiser. Manages talks, speakers and registrations)
  - attendee (A conference participant who registers for talks)
  New users get the attendee role.
  Open to anyone without signing in: the home page, the schedule page, reading talks, reading speakers and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 123 files (123 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-fprkNv/app-8/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
messages 7 columns 0 indexes 1 fks
registrations 5 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
speakers 8 columns 0 indexes 1 fks
talks 12 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_uneven_edwin_jarvis.sql 🚀

Created /tmp/smithable-bench-m12-fprkNv/app-8. Start it with:

  cd /tmp/smithable-bench-m12-fprkNv/app-8
  smithable run
/tmp/smithable-bench-m12-fprkNv/app-8/smithable.yml:37:7  warning  Registration has a capacity per talk, but "talk" is not unique: one person can take several places.
    hint: Write "talk: Talk! unique" for one registration per person and talk (unique per owner with private access).
/tmp/smithable-bench-m12-fprkNv/app-8/smithable.yml:64:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-fprkNv/app-8/smithable.auth.yml:7:16  warning  Anyone on the internet can read Speaker, including personal data in email.
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  A help desk for an IT team to manage support tickets, priorities and assignments.

Pages
  - Team (who has access: invite people, change roles, remove users)
  - Tickets (lists tickets; search by title or category; sort by priority, status, date added or resolved at; “Assign”; “Put on hold”; “Resolve”; “Close”)
  - Updates (lists ticket updates)
  - Overview (a dashboard: open, in progress, critical and latest)

Tickets
  Tickets have:
  - a title (required)
  - status (open, in progress, on hold, resolved or closed, open by default)
  - a priority (low, medium, high or critical, low by default)
  - a category (hardware, software, network, access or other, hardware by default)
  - a description (required)
  - resolved at (a date and time)
  Each ticket can have an assignee (a user).
  Each ticket lists its ticket updates.

Ticket updates
  Ticket updates have:
  - a ticket (a ticket, required)
  - a date and time (at, required)
  - status (open, in progress, on hold, resolved or closed, open by default)
  - a message (required)

Assign
  For a ticket that is open; sets status to in progress and assignee to whoever presses it; adds a ticket update (at now, status in progress, message Ticket picked up and is now being worked on.).
  An agent takes the ticket; it moves to in-progress and is assigned to them.
  Only agent users and admins can use it.

Put on hold
  For a ticket that is open or in progress; sets status to on hold; asks for the ticket update's message; adds a ticket update (at now, status on hold).
  The ticket is waiting on something; it moves to on-hold with a note.
  Only agent users and admins can use it.

Resolve
  For a ticket that is open, in progress or on hold; sets status to resolved and resolved at to now; asks for the ticket update's message; adds a ticket update (at now, status resolved).
  The issue is fixed; the ticket moves to resolved with a resolution note.
  Only agent users and admins can use it.

Close
  For a ticket that is resolved; sets status to closed; adds a ticket update (at now, status closed, message Ticket closed.).
  The resolved ticket is confirmed closed.
  Only agent users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the help desk, team members and all tickets)
  - agent (Handles and resolves support tickets)
  New users get the agent role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 99 files (99 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-fprkNv/app-9/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
ticket_updates 8 columns 0 indexes 2 fks
tickets 11 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_gorgeous_lord_hawal.sql 🚀

Created /tmp/smithable-bench-m12-fprkNv/app-9. Start it with:

  cd /tmp/smithable-bench-m12-fprkNv/app-9
  smithable run
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A recipe collection for the whole family, with ingredients and shopping lists.

Pages
  - Recipes (lists recipes; search by name or description; filter by category or is favorite; sort by name, category, prep time or cook time; records can be saved as favorites)
  - Ingredients (lists ingredients)
  - Shopping lists (lists shopping lists; search by name)
  - Shopping items (lists shopping items; filter by shopping list or checked; “Check item”; “Uncheck item”)
  - Team (who has access: invite people, change roles, remove users)

Recipes
  Recipes have:
  - a name (required)
  - a description
  - a category (breakfast, lunch, dinner, dessert, snack or drink, breakfast by default)
  - servings (a whole number, 4 by default)
  - a prep time (a whole number)
  - a cook time (a whole number)
  - an image URL (a web address)
  - an is favorite (yes or no)

Ingredients
  Ingredients have:
  - a recipe (a recipe, required)
  - a name (required)
  - a quantity
  - a unit

Shopping lists
  Shopping lists have:
  - a name (required)
  - a date (required, today by default)
  - notes

Shopping items
  Shopping items have:
  - a shopping list (a shopping list, required)
  - a name (required)
  - a quantity
  - a unit
  - a checked (yes or no)

Check item
  For a shopping item that is not checked; sets checked to yes.
  Mark a shopping item as picked up.

Uncheck item
  For a shopping item that is checked; sets checked to no.
  Mark a shopping item as not yet picked up.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 101 files (101 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-fprkNv/app-10/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
ingredients 8 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
recipes 12 columns 0 indexes 1 fks
recipes_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
shopping_items 9 columns 0 indexes 2 fks
shopping_lists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_yielding_junta.sql 🚀

Created /tmp/smithable-bench-m12-fprkNv/app-10. Start it with:

  cd /tmp/smithable-bench-m12-fprkNv/app-10
  smithable run
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  The state of our API services, live — incidents and planned maintenance.

Pages
  - API Status (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; search by title or status; filter by status, component or detected at; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances; filter by component or starts at)
  - Components (lists components; search by name; filter by status; only for admins; visitors see components on the API Status page)
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
  - a summary (formatted text)
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
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 121 files (121 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-fprkNv/app-11/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_romantic_ultimo.sql 🚀

Created /tmp/smithable-bench-m12-fprkNv/app-11. Start it with:

  cd /tmp/smithable-bench-m12-fprkNv/app-11
  smithable run
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is it working? The state of our web shop services, live.

Pages
  - Shop Status (a landing page: hero, components, uptime, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Shop Status page)
  - Maintenance (lists maintenances)
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
  - a summary (formatted text)
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
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 120 files (120 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-fprkNv/app-12/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_wild_landau.sql 🚀

Created /tmp/smithable-bench-m12-fprkNv/app-12. Start it with:

  cd /tmp/smithable-bench-m12-fprkNv/app-12
  smithable run
```
