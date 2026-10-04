# M12 first builds: gpt-6.1-sol (2026-10-04)

No price was given for this model, so the costs below read €0.0000. At OpenAI's list price ($2.00 in and $10.00 out per million tokens, today) the tokens below cost $0.55 for the first set and $1.00 for the second: see [the comparison](m12-model-comparison.md).

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 12 / 12 created, 8 type-check, 187,066 tokens (165,296 in, 21,770 out), €0.0000; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 13,108 | 1,651 | €0.0000 | 0 | 1 | 67 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 12,756 | 2,137 | €0.0000 | 0 | 1 | 63 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | **no** | 25,911 | 2,570 | €0.0000 | 0 | 2 | 66 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | **no** | 12,432 | 1,865 | €0.0000 | 0 | 1 | 54 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 12,351 | 1,012 | €0.0000 | 0 | 1 | 31 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | **no** | 12,436 | 1,902 | €0.0000 | 0 | 1 | 46 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 12,350 | 2,012 | €0.0000 | 0 | 1 | 42 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 13,104 | 2,101 | €0.0000 | 0 | 1 | 44 s |
| A help desk for an IT team: tickets, priorities and who handles them. | records | yes | yes | 12,352 | 983 | €0.0000 | 0 | 1 | 26 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | **no** | 12,349 | 1,501 | €0.0000 | 0 | 1 | 34 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 13,071 | 2,065 | €0.0000 | 0 | 1 | 61 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 13,076 | 1,971 | €0.0000 | 0 | 1 | 58 s |

Each created app's four spec files are in [m12-first-builds-gpt-6.1-sol/](m12-first-builds-gpt-6.1-sol/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 1 | 4 / 6 (has 4) | 6 / 10 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | sessions: admin, class-types: admin, instructors: admin | pages home, schedule; read ClassType, Instructor, Session; create none | 1 (no-timezone) | none | 3 / 4 | mentions visitors; landing page |
| 2 | crm | 2 | 1 / 2 (has 4) | 2 / 3 (has 5) | 0 / 1 (has 4) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 1 / 4 | no mention; no landing page |
| 3 | invoicing | 3 | 4 / 4 (has 5) | 4 / 7 (has 5) | 2 / 2 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 5 | no mention; no landing page |
| 4 | marketplace (words: records) | 2 | 1 / 1 (has 1) | 4 / 4 (has 4) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | no mention; landing page |
| 5 | records (words: booking) | 2 | 1 / 1 (has 2) | 1 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 1 / 1 (has 2) | 2 / 4 (has 3) | 0 / 0 (has 5) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 0 / 2 | no mention; landing page |
| 7 | records | 3 | 0 / 1 (has 3) | 1 / 2 (has 4) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, teams, players, matches; read Team, Player, Match; create none | 0 | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 4 / 6 (has 5) | 7 / 10 (has 8) | 0 / 0 (has 0) | private; admin, member (member) | sessions: admin, class-types: admin, instructors: admin | pages home, schedule; read ClassType, Instructor, Session; create none | 1 (no-timezone) | none | 3 / 5 | no mention; landing page |
| 9 | records (words: invoicing) | 3 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page |
| 10 | records | 2 | 1 / 1 (has 3) | 1 / 2 (has 4) | 0 / 0 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page |
| 11 | status | 3 | 4 / 4 (has 4) | 6 / 8 (has 6) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page |
| 12 | status | 1 | 3 / 4 (has 3) | 5 / 8 (has 5) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate; create none | 0 | none | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Yoga Studio
  Explore yoga classes, meet the teachers and book a place online.

Pages
  - Home (a landing page: hero, class types, instructors and footer)
  - My bookings (lists bookings)
  - Sessions (lists sessions; only for admins)
  - Class types (lists class types; only for admins; visitors see class types on the Home page)
  - Instructors (lists instructors; only for admins; visitors see instructors on the Home page)
  - Schedule (a calendar of sessions by week or month)

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
  - a portrait (a web address)
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

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studio staff who manage the schedule, classes and teachers)
  - member (A student who books classes)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors and reading sessions.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 97 files (97 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-W5gLO8/app-1/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_omniscient_darwin.sql 🚀

Created /tmp/smithable-bench-m12-W5gLO8/app-1. Start it with:

  cd /tmp/smithable-bench-m12-W5gLO8/app-1
  smithable run
/tmp/smithable-bench-m12-W5gLO8/app-1/smithable.yml:53:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Sales Team CRM
  A shared CRM for a small sales team to manage companies, contacts, deals and follow-ups.

Pages
  - Companies (lists companies; search by name or email)
  - Contacts (lists contacts; search by name, email or phone; filter by company)
  - Deals (lists deals; search by name; “Mark won”; “Mark lost”)
  - Follow ups (lists follow ups; search by subject; “Complete follow up”; “Cancel follow up”)
  - Team (who has access: invite people, change roles, remove users)

Companies
  Companies have:
  - a name (required)
  - an email (unique)
  - a phone
  - a segment (smb, enterprise or government, smb by default)
  - notes
  Each company can have an account manager (a user).
  Each company lists its contacts.
  Each company lists its deals.
  Each company lists its follow ups.
  Only sales users and admins can change companies.
  Only admins can delete companies.

Contacts
  Contacts have:
  - a name (required)
  - a company (a company, required)
  - a job title
  - an email
  - a phone
  - notes

Deals
  Deals have:
  - a name (required)
  - a company (a company, required)
  - a contact (a contact)
  - a stage (new, qualified, proposal, won or lost, new by default)
  - a value (an amount)
  - an expected close date
  - closed at (a date and time)
  - notes
  Each deal can have an assignee (a user).

Follow ups
  Follow ups have:
  - a subject (required)
  - a company (a company, required)
  - a contact (a contact)
  - a deal (a deal)
  - due at (a date and time, required)
  - status (pending, completed or canceled, pending by default)
  - completed at (a date and time)
  - notes
  Each follow up can have an assignee (a user).

Mark won
  For a deal that is new, qualified or proposal; sets stage to won and closed at to now.

Mark lost
  For a deal that is new, qualified or proposal; sets stage to lost and closed at to now.

Complete follow up
  For a follow up that is pending; sets status to completed and completed at to now.

Cancel follow up
  For a follow up that is pending; sets status to canceled.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Sales management with full access)
  - sales (Works with companies, contacts, deals and follow-ups)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 106 files (106 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-W5gLO8/app-2/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
contacts 10 columns 0 indexes 2 fks
customers 10 columns 1 indexes 2 fks
deals 13 columns 0 indexes 4 fks
follow_ups 13 columns 0 indexes 5 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_abandoned_rachel_grey.sql 🚀

Created /tmp/smithable-bench-m12-W5gLO8/app-2. Start it with:

  cd /tmp/smithable-bench-m12-W5gLO8/app-2
  smithable run
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Freelance Ledger
  Manage your freelance business's clients, invoices and payments in one private workspace.

Pages
  - Clients (lists clients)
  - Payments (lists payments)
  - Invoice lines (lists invoice lines)
  - Business Settings (lists business profiles)
  - Invoices (lists invoices; search by number; filter by status or client; “Mark sent”; “Mark paid”)

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
  - a reference
  - notes
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
  The paid amount is calculated as the total amount of its payments.
  The balance is calculated as the total minus the paid amount.

Mark sent
  For an invoice that is draft; sets status to sent.
  Mark the invoice as sent to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  Mark the invoice as fully paid after recording its payments.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Administers the invoicing app)
  - member (A freelancer managing their own clients, invoices and payments)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 105 files (105 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-W5gLO8/app-3/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 12 columns 1 indexes 2 fks
payments 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_massive_tattoo.sql 🚀

Created /tmp/smithable-bench-m12-W5gLO8/app-3. Start it with:

  cd /tmp/smithable-bench-m12-W5gLO8/app-3
  smithable run

/tmp/smithable-bench-m12-W5gLO8/app-3/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-W5gLO8/app-3/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-W5gLO8/app-3/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-W5gLO8/app-3/src/db/seed.ts:74:6)
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
Neighbor Tool Library
  Find, lend and borrow tools from neighbors in your community.

Pages
  - Browse Tools (lists tools; search by title, description or neighborhood; filter by category, condition or available; sort by title or date added; records can be saved as favorites; contact the owner by mail)
  - My Tools (lists tools; only the viewer's own records)
  - Saved Tools (lists tools; only the viewer's saved records)
  - Home (a landing page: hero, tools where available is yes and footer)

Tools
  Tools have:
  - a title (required)
  - a description (required)
  - a category (hand tools, power tools, garden, ladders or other, hand tools by default)
  - a condition (like new, good or worn, like new by default)
  - a neighborhood
  - an available (yes or no, true by default)

Lend tool
  For a tool that is available; sets available to no.

Return tool
  For a tool that is not available; sets available to yes.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the tool library tidy)
  - member (Lists tools to lend, finds tools to borrow and contacts their owners)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 91 files (91 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-W5gLO8/app-4/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
items 10 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_faulty_colleen_wing.sql 🚀

Created /tmp/smithable-bench-m12-W5gLO8/app-4. Start it with:

  cd /tmp/smithable-bench-m12-W5gLO8/app-4
  smithable run
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  Track a small bakery's ingredients, suppliers and current stock levels.

Pages
  - Ingredients (lists ingredients; search by name or summary; filter by supplier or unit)
  - Suppliers (lists suppliers; search by name, email or phone)
  - Team (who has access: invite people, change roles, remove users)

Suppliers
  Suppliers have:
  - a name (required)
  - an email
  - a phone
  - notes

Ingredients
  Ingredients have:
  - a name (required)
  - a summary
  - a supplier (a supplier)
  - a stock level (a number, required, 0 by default)
  - a unit (kg, g, l, ml or units, kg by default)
  - a reorder level (a number, required, 0 by default)
  Only admins can add ingredients.
  Only admins can change ingredients.
  Only admins can delete ingredients.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages ingredients and stock levels)
  - member (Views ingredient stock levels and maintains supplier details)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 87 files (87 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-W5gLO8/app-5/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
items 10 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
suppliers 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_tidy_runaways.sql 🚀

Created /tmp/smithable-bench-m12-W5gLO8/app-5. Start it with:

  cd /tmp/smithable-bench-m12-W5gLO8/app-5
  smithable run
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  Browse local union job posts and submit applications.

Pages
  - Jobs (lists job posts; search by title, description, employer or location; filter by open for applications; sort by title or date added; records can be saved as favorites; contact the owner by mail; “Close job”)
  - Applications (lists applications; filter by job or status; “Review application”; “Accept application”; “Reject application”; “Withdraw application”)
  - Home (a landing page: hero, job posts where available is yes and footer)

Job posts
  Job posts have:
  - a title (required)
  - a description (required)
  - an employer (required)
  - a location
  - open for applications (yes or no, true by default)
  Each job post lists its applications.

Applications
  Applications have:
  - a job (a job post, required)
  - a name (required)
  - an email (required)
  - a cover letter
  - a resume link (a web address)
  - status (submitted, reviewing, accepted, rejected or withdrawn, submitted by default)

Close job
  For a job post that is open for applications; sets open for applications to no.

Review application
  For an application that is submitted; sets status to reviewing.

Accept application
  For an application that is submitted or reviewing; sets status to accepted.

Reject application
  For an application that is submitted or reviewing; sets status to rejected.

Withdraw application
  For an application that is submitted or reviewing; sets status to withdrawn.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Maintains the union job board and manages applications)
  - member (Posts jobs, saves opportunities and submits applications)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 96 files (96 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-W5gLO8/app-6/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
applications 10 columns 0 indexes 2 fks
audit_log 13 columns 2 indexes 0 fks
items 9 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_superb_maddog.sql 🚀

Created /tmp/smithable-bench-m12-W5gLO8/app-6. Start it with:

  cd /tmp/smithable-bench-m12-W5gLO8/app-6
  smithable run
```

### 7. A football club's site: teams, players, matches and results.

```text
Club Football
  A football club site showcasing its teams, players, fixtures and match results.

Pages
  - Home (a landing page: hero, teams, matches where status is scheduled, matches where status is completed and footer)
  - Teams (lists teams; search by name or summary)
  - Players (lists players; search by name or position; filter by team)
  - Fixtures and results (lists matches; search by opponent or venue; filter by team, status or location; “Record result”; “Cancel match”)

Teams
  Teams have:
  - a name (required)
  - a summary
  Each team lists its players.
  Each team lists its matches.
  Only admins can add teams.
  Only admins can change teams.
  Only admins can delete teams.

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a shirt number (a whole number)
  - a position
  - a summary
  Only admins can add players.
  Only admins can change players.
  Only admins can delete players.

Matches
  Matches have:
  - a team (a team, required)
  - an opponent (required)
  - a kickoff (a date and time, required)
  - a venue
  - a location (home or away, home by default)
  - status (scheduled, completed or canceled, scheduled by default)
  - a team score (a whole number)
  - an opponent score (a whole number)
  - a summary
  Only admins can add matches.
  Only admins can change matches.
  Only admins can delete matches.

Record result
  For a match that is scheduled; sets status to completed; asks for the team score and the opponent score.
  Only admins can use it.

Cancel match
  For a match that is scheduled; sets status to canceled.
  Only admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Manages the club's teams, players, fixtures and results)
  - member (Browses the club's teams, players, fixtures and results)
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, the players page, the matches page, reading teams, reading players and reading matches.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 94 files (94 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-W5gLO8/app-7/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
matches 13 columns 0 indexes 2 fks
players 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 6 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_light_sway.sql 🚀

Created /tmp/smithable-bench-m12-W5gLO8/app-7. Start it with:

  cd /tmp/smithable-bench-m12-W5gLO8/app-7
  smithable run
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Registration
  Explore conference talks and speakers, register as an attendee, and reserve places at scheduled talks.

Pages
  - Home (a landing page: hero, talks, speakers and footer)
  - My bookings (lists bookings)
  - Attendees (lists attendees)
  - Sessions (lists sessions; only for admins)
  - Talks (lists talks; only for admins; visitors see talks on the Home page)
  - Speakers (lists speakers; only for admins; visitors see speakers on the Home page)
  - Schedule (a calendar of sessions by week or month)
  - Admin (every kind of record, to find, open, change and delete)

Talks
  Talks have:
  - a name (required)
  - a summary
  - duration minutes (a whole number, required, 60 by default)
  Only admins can add talks.

Speakers
  Speakers have:
  - a name (required)
  - a bio
  Only admins can add speakers.

Attendees
  Attendees have:
  - a name (required)
  - an email (required)
  Each attendee lists its bookings.

Sessions
  Sessions have:
  - a talk (a talk, required)
  - a speaker (a speaker, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 100 by default)
  Each session lists its bookings.
  The places left is calculated as the capacity minus the number of its bookings.
  Only admins can add sessions.

Bookings
  Bookings have:
  - a session (a session, required, unique)
  - an attendee (an attendee, required)
  At most the session's capacity bookings per session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Conference staff who manage talks, speakers, sessions and attendee registrations)
  - member (An attendee who registers and reserves places at conference talks)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors and reading sessions.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 119 files (119 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-W5gLO8/app-8/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
attendees 6 columns 0 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 6 columns 1 indexes 3 fks
class_types 7 columns 0 indexes 1 fks
instructors 6 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_amused_menace.sql 🚀

Created /tmp/smithable-bench-m12-W5gLO8/app-8. Start it with:

  cd /tmp/smithable-bench-m12-W5gLO8/app-8
  smithable run
/tmp/smithable-bench-m12-W5gLO8/app-8/smithable.yml:69:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  A shared help desk for an IT team to track tickets, prioritize work and assign responsibility.

Pages
  - Tickets (lists tickets; search by title or description; “Take ticket”; “Resolve”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users)

Tickets
  Tickets have:
  - a title (required)
  - a description (required)
  - a priority (normal, low, high or urgent, normal by default)
  - status (open, in progress or resolved, open by default)
  - resolved at (a date and time)
  Each ticket can have an assignee (a user).

Take ticket
  For a ticket that is open or in progress; sets assignee to whoever presses it and status to in progress.

Resolve
  For a ticket that is open or in progress; sets status to resolved and resolved at to now.

Reopen
  For a ticket that is resolved; sets status to open; asks for the resolved at.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 87 files (87 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-W5gLO8/app-9/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
tickets 10 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_keen_kylun.sql 🚀

Created /tmp/smithable-bench-m12-W5gLO8/app-9. Start it with:

  cd /tmp/smithable-bench-m12-W5gLO8/app-9
  smithable run
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipe Box
  Keep family recipes, their ingredients, and shared shopping lists in one place.

Pages
  - Family Recipes (lists recipes; search by name, summary or ingredients; filter by kind)
  - Shopping lists (lists shopping lists; “Complete shopping list”)
  - Shopping items (lists shopping items; filter by shopping list, purchased or recipe; “Mark purchased”; “Mark needed”)
  - Team (who has access: invite people, change roles, remove users)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - a kind (general, favorite or archived, general by default)
  - ingredients (required)
  - instructions (required)
  - servings (a whole number)
  - a link (a web address)
  - added on (a date, required, today by default)
  Only admins can add recipes.
  Only admins can change recipes.
  Only admins can delete recipes.

Shopping lists
  Shopping lists have:
  - a name (required)
  - status (open or completed, open by default)
  Each shopping list lists its shopping items.

Shopping items
  Shopping items have:
  - a shopping list (a shopping list, required)
  - a name (required)
  - a quantity and unit
  - a recipe (a recipe)
  - a purchased (yes or no, required, false by default)

Mark purchased
  For a shopping item that is not purchased; sets purchased to yes.

Mark needed
  For a shopping item that is purchased; sets purchased to no.

Complete shopping list
  For a shopping list that is open; sets status to completed.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Maintains the family recipe collection and manages shopping lists)
  - member (Reads family recipes and manages shared shopping lists)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 99 files (99 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-W5gLO8/app-10/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
items 12 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
shopping_items 9 columns 0 indexes 3 fks
shopping_lists 6 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_tough_doctor_doom.sql 🚀

Created /tmp/smithable-bench-m12-W5gLO8/app-10. Start it with:

  cd /tmp/smithable-bench-m12-W5gLO8/app-10
  smithable run
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  Public service status, incident updates, and planned maintenance for our API.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Maintenance (lists maintenances)
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
  For an incident that is investigating; sets status to identified; asks for the incident update's message; adds an incident update (at now, status identified).
  Identify the cause and publish an update describing the findings.
  Only staff users and admins can use it.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; asks for the incident update's message; adds an incident update (at now, status monitoring).
  Move the incident to monitoring and publish an update about the fix.
  Only staff users and admins can use it.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; asks for the incident update's message; adds an incident update (at now, status resolved).
  Close the incident with a resolution update, leaving component status under the team's control.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages service components, the status page, and team access)
  - staff (Publishes incidents, updates, and planned maintenance)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 105 files (105 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-W5gLO8/app-11/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
maintenances 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_open_lilandra.sql 🚀

Created /tmp/smithable-bench-m12-W5gLO8/app-11. Start it with:

  cd /tmp/smithable-bench-m12-W5gLO8/app-11
  smithable run
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Web Shop Status
  Live service status, outages, and incident updates for our web shop.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved and footer)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
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
  Only staff users and admins can change incidents.

Incident updates
  Incident updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)

Identified
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause has been identified and a fix is being worked on.).
  Mark the cause as identified and publish an update.
  Only staff users and admins can use it.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix has been deployed and we are monitoring the service.).
  Move the incident to monitoring and publish an update.
  Only staff users and admins can use it.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident has been resolved.).
  Resolve the incident and publish an update; service status remains separately managed.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status page and manages the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved and reading incident updates.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 100 files (100 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-W5gLO8/app-12/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_futuristic_omega_sentinel.sql 🚀

Created /tmp/smithable-bench-m12-W5gLO8/app-12. Start it with:

  cd /tmp/smithable-bench-m12-W5gLO8/app-12
  smithable run
```
