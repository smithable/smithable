# M12 first builds: mistral-medium-latest (2026-10-03)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 11 / 12 created, 11 type-check, 203,662 tokens, €0.1142.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 18,403 | €0.0099 | 24 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 9,408 | €0.0060 | 20 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 30,811 | €0.0193 | 38 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 16,422 | €0.0080 | 22 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 8,331 | €0.0045 | 20 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 9,097 | €0.0059 | 22 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 8,469 | €0.0048 | 17 s |
| Event registration for a conference: talks, speakers and attendees. | booking | **no** | **no** | 35,115 | €0.0167 | 21 s |
| A help desk for an IT team: tickets, priorities and who handles them. | records | yes | yes | 8,500 | €0.0048 | 19 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 8,577 | €0.0050 | 23 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 19,855 | €0.0118 | 29 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 30,674 | €0.0175 | 33 s |

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest/](m12-first-builds-mistral-medium-latest/), one folder per description (app-1 …).

<!-- scorecard -->
## Against the earlier runs

The runs so far:
1. From main before #169 and #174.
2. After them (#176).
3. After #180 (#181): 12 of 12.
4. After #190 (#193): status drafts without actions.
5. This one: after #194, A's fixes for the fourth run.

The kept columns now also say how many models, pages and actions each draft has in all.

- **Better: the status drafts keep their actions.** 11 and 12 keep 3 of 3 (0 of 3 in the fourth run).
- **Better: everything created type-checks** (11 of 11), including 1, the yoga studio, whose calculator broke the fourth run.
- **Invoicing** keeps mark sent and mark paid (2 of 2).
- **Worse: one draft fails.** 8, the conference: the model's `register` action adds a Registration that also needs an attendee, a reference an action cannot fill. Since #194 a refused action fails the draft; before, the action was dropped and the app created. Reported to session A.

## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 0 | 5 / 6 (has 5) | 8 / 10 (has 9) | 0 / 0 (has 0) | private; admin, member (member) | class-types: admin, instructors: admin, messages: admin, sessions: admin, my-bookings: member/admin | pages home, schedule; read ClassType, Instructor, Session; create Message | 2 (capacity-no-unique, no-timezone) | none | 3 / 5 | mentions visitors; landing page |
| 2 | crm | 0 | 0 / 2 (has 4) | 1 / 3 (has 5) | 0 / 1 (has 4) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 0 | 4 / 4 (has 4) | 6 / 7 (has 7) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 0 | 0 / 1 (has 1) | 1 / 4 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home; read Tool; create none | 0 | none | 0 / 1 | no mention; landing page |
| 5 | records (words: booking) | 2 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 0) | shared; admin, staff (staff) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page |
| 6 | marketplace | 2 | 0 / 1 (has 2) | 1 / 4 (has 4) | 0 / 0 (has 4) | shared; admin, employer, member (member) | none | pages home, jobs; read JobPost; create none | 0 | none | 0 / 2 | no mention; landing page |
| 7 | records | 0 | 0 / 1 (has 3) | 1 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, teams, players, matches; read Team, Player, Match; create none | 0 | none | 0 / 3 | mentions visitors; landing page |
| 9 | records (words: invoicing) | 2 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 4) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page |
| 10 | records | 2 | 0 / 1 (has 3) | 1 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, recipes; read Recipe; create none | 0 | none | 0 / 3 | no mention; landing page |
| 11 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page |
| 12 | status | 0 | 4 / 4 (has 4) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Yoga Studio Booking
  Class schedule and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, contact and footer)
  - Class types (lists class types; only for admins; visitors see class types on the Home page)
  - Instructors (lists instructors; only for admins)
  - Messages (lists messages; only for admins)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)
  - Sessions (lists sessions; only for admins)
  - My bookings (lists bookings; only for member users and admins)
  - Schedule (a calendar of sessions by week or month)

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
  - a bio
  - a portrait (picture)
  Only admins can add instructors.

Messages
  Messages have:
  - a name (required)
  - an email (required)
  - a message (required)
  Only admins can see messages.
  Only admins can change messages.
  Only admins can delete messages.

Sessions
  Sessions have:
  - a class type (a class type, required)
  - an instructor (an instructor, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 12 by default)
  Each session lists its bookings.
  Only admins can add sessions.

Bookings
  Bookings have:
  - a session (a session, required)
  Each booking can have a user (a user).
  At most the session's capacity bookings per session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studio staff. Manage the schedule, classes and teachers)
  - member (A student who books classes)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors, reading sessions and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 121 files (121 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-x2j3nC/app-1/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
bookings 6 columns 0 indexes 3 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
messages 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 8 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_magical_timeslip.sql 🚀

Created /tmp/smithable-bench-m12-x2j3nC/app-1. Start it with:

  cd /tmp/smithable-bench-m12-x2j3nC/app-1
  smithable run
/tmp/smithable-bench-m12-x2j3nC/app-1/smithable.yml:44:7  warning  Booking has a capacity per session, but "session" is not unique: one person can take several places.
    hint: Write "session: Session! unique" for one booking per person and session (unique per owner with private access).
/tmp/smithable-bench-m12-x2j3nC/app-1/smithable.yml:78:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Sales CRM
  Lightweight CRM for a small sales team to manage companies, contacts, deals and follow-ups.

Pages
  - Companies (lists companies; search by name or email)
  - Contacts (lists contacts; search by first name, last name or email)
  - Deals (lists deals; search by name or company; filter by stage, company or contact; sort by value, close date or stage; “Mark won”; “Mark lost”)
  - Follow ups (lists follow ups; search by title or deal; filter by status, due date or deal; sort by due date or status; “Complete follow up”; “Cancel follow up”)
  - Team (who has access: invite people, change roles, remove users)

Companies
  Companies have:
  - a name (required)
  - an email
  - a phone
  - a segment (smb, enterprise or government, smb by default)
  - notes
  Each company can have an account manager (a user).
  Only admins can delete companies.
  Only sales users and admins can change companies.

Contacts
  Contacts have:
  - a first name (required)
  - a last name (required)
  - an email
  - a phone
  - a role (decision maker, influencer or end user, decision maker by default)
  - a company (a company, required)
  - notes
  Only admins can delete contacts.
  Only sales users and admins can change contacts.

Deals
  Deals have:
  - a name (required)
  - a company (a company, required)
  - a contact (a contact)
  - a value (an amount, required)
  - a stage (lead, qualified, proposal, negotiation, closed won or closed lost, lead by default)
  - a close date
  - notes
  Only admins can delete deals.
  Only sales users and admins can change deals.

Follow ups
  Follow ups have:
  - a title (required)
  - a deal (a deal, required)
  - a due date (required)
  - status (pending, completed or canceled, pending by default)
  - notes
  Only admins can delete follow ups.
  Only sales users and admins can change follow ups.

Mark won
  For a deal that is negotiation; sets stage to closed won and close date to today.
  Mark a deal as won.

Mark lost
  For a deal that is negotiation; sets stage to closed lost and close date to today.
  Mark a deal as lost.

Complete follow up
  For a follow up that is pending; sets status to completed.
  Mark a follow-up as completed.

Cancel follow up
  For a follow up that is pending; sets status to canceled.
  Cancel a follow-up.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Sales management. Full access)
  - sales (Works with companies, contacts, deals and follow-ups)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 100 files (100 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-x2j3nC/app-2/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
companies 10 columns 0 indexes 2 fks
contacts 11 columns 0 indexes 2 fks
deals 11 columns 0 indexes 3 fks
follow_ups 9 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_brainy_justin_hammer.sql 🚀

Created /tmp/smithable-bench-m12-x2j3nC/app-2. Start it with:

  cd /tmp/smithable-bench-m12-x2j3nC/app-2
  smithable run
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Freelance Invoicing
  Invoicing for freelancers, with clients, invoices and payments.

Pages
  - Home (a landing page: hero and footer)
  - Clients (lists clients; search by name or email)
  - Settings (lists business profiles)
  - Team (who has access: invite people, change roles, remove users)
  - Invoices (lists invoices; search by number or client; filter by status or client; sort by issued on, due on, total or number)
  - Invoice lines (lists invoice lines)
  - Overview (lists invoices)

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
  - an amount (an amount)
  - an invoice (an invoice, required)

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required, the issued on plus 30 days by default)
  - status (draft, sent, paid or overdue, draft by default)
  - a total (an amount)
  Each invoice lists its invoice lines.

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The client paid the invoice.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member (A freelancer using the app)
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 100 files (100 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-x2j3nC/app-3/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_many_jackpot.sql 🚀

Created /tmp/smithable-bench-m12-x2j3nC/app-3. Start it with:

  cd /tmp/smithable-bench-m12-x2j3nC/app-3
  smithable run
```

### 4. A tool library where neighbors lend each other tools.

```text
Tool Library
  A tool library where neighbors lend each other tools.

Pages
  - Tools (lists tools; search by name or description; filter by category, condition or available; sort by name or date added; records can be saved as favorites; contact the owner by mail)
  - Home (a landing page: hero, tools where available is yes and footer)
  - My tools (lists tools; only the viewer's own records)

Tools
  Tools have:
  - a name (required)
  - a description (required)
  - a category (garden, power, hand, measuring or other, garden by default)
  - a condition (excellent, good or fair, excellent by default)
  - an available (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the tool library tidy)
  - member (Lends and borrows tools)
  New users get the member role.
  Open to anyone without signing in: the home page and reading tools.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 77 files (77 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-x2j3nC/app-4/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
tools 9 columns 0 indexes 1 fks
tools_favorites 4 columns 1 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_past_iron_monger.sql 🚀

Created /tmp/smithable-bench-m12-x2j3nC/app-4. Start it with:

  cd /tmp/smithable-bench-m12-x2j3nC/app-4
  smithable run
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  Track ingredients, suppliers and stock levels for a small bakery.

Pages
  - Ingredients (lists ingredients; search by name, description or category)
  - Suppliers (lists suppliers; search by name, contact name or email)
  - Stock (lists stocks; search by ingredient; filter by ingredient or last updated)
  - Team (who has access: invite people, change roles, remove users)

Ingredients
  Ingredients have:
  - a name (required)
  - a description
  - a category (dry, wet or frozen, dry by default)
  - a unit (required)
  - a min stock (a whole number, 0 by default)
  - a supplier (a supplier)
  Only admins can delete ingredients.

Suppliers
  Suppliers have:
  - a name (required)
  - a contact name
  - an email
  - a phone
  - address
  Only admins can delete suppliers.

Stocks
  Stocks have:
  - an ingredient (an ingredient, required)
  - a quantity (a number, required)
  - a last updated (required, today by default)
  - an expiry date

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages inventory and suppliers)
  - staff (Views and updates stock levels)
  New users get the staff role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-x2j3nC/app-5/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
ingredients 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
stocks 8 columns 0 indexes 2 fks
suppliers 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_violet_dormammu.sql 🚀

Created /tmp/smithable-bench-m12-x2j3nC/app-5. Start it with:

  cd /tmp/smithable-bench-m12-x2j3nC/app-5
  smithable run
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  A job board for a local union to post jobs and receive applications.

Pages
  - Jobs (lists job posts; search by title, description, company or location; filter by type, status or salary; sort by posted at or salary; “Close job”)
  - Applications (lists applications; “Review application”; “Shortlist application”; “Reject application”)
  - Home (a landing page: hero and footer)
  - Team (who has access: invite people, change roles, remove users)

Job posts
  Job posts have:
  - a title (required)
  - a description (required)
  - a company (required)
  - a location
  - a salary (an amount)
  - a type (full time, part time, contract or temporary, full time by default)
  - status (open or closed, open by default)
  - posted at (a date, today by default)
  Only employer users and admins can add job posts.
  Only employer users, the owner and admins can delete job posts.

Applications
  Applications have:
  - a job post (a job post, required)
  - a name (required)
  - an email (required)
  - a phone
  - a resume
  - a cover letter
  - status (submitted, reviewed, shortlisted or rejected, submitted by default)
  Only member users, employer users and admins can add applications.
  Only employer users, the owner and admins can see applications.
  Only employer users and admins can delete applications.

Close job
  For a job post that is open; sets status to closed.
  Close a job post when it is no longer open.

Review application
  For an application that is submitted; sets status to reviewed.
  Mark an application as reviewed.

Shortlist application
  For an application that is reviewed or submitted; sets status to shortlisted.
  Shortlist an application for further consideration.

Reject application
  For an application that is submitted, reviewed or shortlisted; sets status to rejected.
  Reject an application.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the job board)
  - employer (Posts job openings)
  - member (Applies to jobs)
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page and reading job posts where status is open.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 92 files (92 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-x2j3nC/app-6/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
applications 11 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
job_posts 12 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_wide_black_bird.sql 🚀

Created /tmp/smithable-bench-m12-x2j3nC/app-6. Start it with:

  cd /tmp/smithable-bench-m12-x2j3nC/app-6
  smithable run
```

### 7. A football club's site: teams, players, matches and results.

```text
Football Club
  A football club's site with teams, players, matches and results.

Pages
  - Home (a landing page: hero, teams, matches where status is played and footer)
  - Teams (lists teams; search by name or description)
  - Players (lists players; search by name, position or nationality)
  - Matches (lists matches; search by location; filter by status, date, home team or away team; sort by date, home score or away score)

Teams
  Teams have:
  - a name (required)
  - a description
  - a sport (football, futsal or beach, football by default)
  - a founded (a whole number)
  - a logo (a web address)

Players
  Players have:
  - a name (required)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a number (a whole number)
  - a team (a team, required)
  - a birth date
  - a nationality
  - a photo (a web address)

Matches
  Matches have:
  - a home team (a team, required)
  - an away team (a team, required)
  - a date (a date and time, required)
  - a location
  - status (scheduled, played or canceled, scheduled by default)
  - a home score (a whole number)
  - an away score (a whole number)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, the players page, the matches page, reading teams, reading players and reading matches.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 83 files (83 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-x2j3nC/app-7/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
matches 11 columns 0 indexes 3 fks
players 11 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_stormy_wrecking_crew.sql 🚀

Created /tmp/smithable-bench-m12-x2j3nC/app-7. Start it with:

  cd /tmp/smithable-bench-m12-x2j3nC/app-7
  smithable run
```

### 8. Event registration for a conference: talks, speakers and attendees.

Failed:

```text
n has a capacity per talk, but "talk" is not unique: one person can take several places. "add" of action "register": Registration also needs attendee, another required reference, which an action cannot fill yet; a model with another required reference cannot be added by an action. Registration in "add" of action "register": talk is filled with the record the action runs on; leave it out. Registration in "add" of action "register": Registration.attendee cannot be set, it is a reference.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-x2j3nC/app-8 --starter booking

```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  A help desk for an IT team to manage support tickets, priorities and assignments.

Pages
  - Tickets (lists tickets; search by title or description; sort by priority, status or date added; “Start work”; “Resolve”; “Reopen”; “Close”)
  - Team (who has access: invite people, change roles, remove users)

Tickets
  Tickets have:
  - a title (required)
  - a description
  - a priority (low, medium, high or critical, low by default)
  - status (open, in progress, resolved or closed, open by default)
  Each ticket can have an assignee (a user).
  Only admins can delete tickets.

Start work
  For a ticket that is open; sets status to in progress and assignee to whoever presses it.
  Assign the ticket to yourself and start working on it.

Resolve
  For a ticket that is in progress; sets status to resolved.
  Mark the ticket as resolved.

Reopen
  For a ticket that is resolved or closed; sets status to open.
  Reopen the ticket for further work.

Close
  For a ticket that is resolved; sets status to closed.
  Close the ticket.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - agent (Handles support tickets)
  New users get the agent role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 85 files (85 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-x2j3nC/app-9/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
tickets 9 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_tranquil_grey_gargoyle.sql 🚀

Created /tmp/smithable-bench-m12-x2j3nC/app-9. Start it with:

  cd /tmp/smithable-bench-m12-x2j3nC/app-9
  smithable run
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A place to keep and share family recipes with ingredients and shopping lists.

Pages
  - Home (a landing page: hero, recipes where category is breakfast or lunch or dinner or dessert or snack or drink and footer)
  - Recipes (lists recipes; search by name, description, category or difficulty; filter by category or difficulty; sort by name, servings, prep time or cook time)
  - Shopping lists (lists shopping lists; search by name; filter by status)

Recipes
  Recipes have:
  - a name (required)
  - a description
  - servings (a whole number, 4 by default)
  - a prep time (a whole number)
  - a cook time (a whole number)
  - instructions (required)
  - a category (breakfast, lunch, dinner, dessert, snack or drink, breakfast by default)
  - a difficulty (easy, medium or hard, easy by default)
  - an image (a web address)
  Only admins can delete recipes.

Ingredients
  Ingredients have:
  - a name (required)
  - a quantity
  - a unit
  - a recipe (a recipe, required)

Shopping lists
  Shopping lists have:
  - a name (required)
  - a date (required, today by default)
  - status (pending or completed, pending by default)
  - items (required)
  Only admins can delete shopping lists.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Manages recipes and shopping lists)
  - member (Views and adds recipes and shopping lists)
  New users get the member role.
  Open to anyone without signing in: the home page, the recipes page and reading recipes.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 81 files (81 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-x2j3nC/app-10/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
ingredients 8 columns 0 indexes 2 fks
recipes 13 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
shopping_lists 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_futuristic_vindicator.sql 🚀

Created /tmp/smithable-bench-m12-x2j3nC/app-10. Start it with:

  cd /tmp/smithable-bench-m12-x2j3nC/app-10
  smithable run
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  Live status of our API services, incidents and planned maintenance.

Pages
  - API Status (a landing page: hero, components, incidents where status is investigating or identified or monitoring and footer)
  - Incidents (lists incidents)
  - Incident Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the API Status page)
  - Planned Maintenance (lists maintenances)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)
  - Overview (lists incidents)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each component lists its incidents.
  Only admins can delete components.

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a component)
  - detected at (a date and time, required)
  - resolved at (a date and time)
  - a summary (formatted text)
  Each incident lists its incident updates.
  Only staff users and admins can delete incidents.

Incident updates
  Incident updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)
  Only staff users and admins can delete incident updates.

Maintenances
  Maintenances have:
  - a title (required)
  - a component (a component)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description
  Only staff users and admins can delete maintenances.

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
  The incident is over, with an update saying so. The component's state stays what the team sets.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 114 files (114 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-x2j3nC/app-11/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
maintenances 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_funny_proteus.sql 🚀

Created /tmp/smithable-bench-m12-x2j3nC/app-11. Start it with:

  cd /tmp/smithable-bench-m12-x2j3nC/app-11
  smithable run
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Web Shop Uptime
  A public uptime page showing which services work, current outages and their updates.

Pages
  - Web Shop Uptime (a landing page: hero, services, outages where status is investigating or identified or monitoring, outages where status is resolved, maintenances and footer)
  - Incidents (lists outages; search by title or summary; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Incident Updates (lists incident updates)
  - Components (lists services; only for admins; visitors see services on the Web Shop Uptime page)
  - Planned Maintenance (lists maintenances)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)

Services
  Services have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each service lists its outages.
  Only admins can delete services.

Outages
  Outages have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a service)
  - detected at (a date and time, required)
  - resolved at (a date and time)
  - a summary (formatted text)
  Each outage lists its incident updates.
  Only admins can delete outages.

Incident updates
  Incident updates have:
  - an incident (an outage, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)
  Only admins can delete incident updates.

Maintenances
  Maintenances have:
  - a title (required)
  - a component (a service)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description
  Only admins can delete maintenances.

Identified
  For an outage that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.
  Only staff users and admins can use it.

Monitoring
  For an outage that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.
  Only staff users and admins can use it.

Resolve
  For an outage that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The incident is over, with an update saying so. The component's state stays what the team sets.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the uptime page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 114 files (114 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-x2j3nC/app-12/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
maintenances 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_flimsy_terrax.sql 🚀

Created /tmp/smithable-bench-m12-x2j3nC/app-12. Start it with:

  cd /tmp/smithable-bench-m12-x2j3nC/app-12
  smithable run
```
