# M12 first builds: mistral-medium-latest (2026-10-03)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 12 / 12 created, 12 type-check, 234,918 tokens, €0.1270.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 35,405 | €0.0172 | 27 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 19,406 | €0.0119 | 24 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 28,996 | €0.0163 | 50 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 16,437 | €0.0080 | 44 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 8,330 | €0.0045 | 56 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 17,956 | €0.0099 | 57 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 9,937 | €0.0077 | 46 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 35,115 | €0.0167 | 46 s |
| A help desk for an IT team: tickets, priorities and who handles them. | records | yes | yes | 8,500 | €0.0048 | 27 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 8,577 | €0.0050 | 24 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 27,485 | €0.0145 | 36 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 18,774 | €0.0105 | 30 s |

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest/](m12-first-builds-mistral-medium-latest/), one folder per description (app-1 …).

<!-- scorecard -->
## Against the earlier runs

The runs so far:
1. From main before #169 and #174.
2. After them (#176).
3. After #180 (#181).
4. After #190 (#193).
5. After #194 (#195).
6. This one: after #196 (chosen rows and delete) and #197 (an action still refused after the last round is left out and named; a formula over a list follows the list).

The actions column now names what a draft left out.

- **All twelve are created and type-check** (11 of 12 in the fifth run).
- **The conference is created again.** 8 leaves out its `register` action (an attendee it cannot fill) instead of failing. It also publishes personal data (public-personal-data), as in the third run.
- **Status keeps 3 of 3 actions, and invoicing keeps 2 of 2.**
- **Left out:** 1, the yoga studio, leaves out `book` and `cancelBooking`. That is the booking starter's flow written as actions the model could not make valid. Worth watching: before #194 they were dropped silently.

## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 0 | 5 / 6 (has 5) | 7 / 10 (has 7) | 0 / 0 (has 0); left out: book, cancelBooking | private; admin, member (member) | class-types: admin, instructors: admin, messages: admin, sessions: admin | pages home, schedule; read ClassType, Instructor, Session; create Message | 1 (capacity-no-unique) | none | 3 / 5 | mentions visitors; landing page |
| 2 | crm | 0 | 0 / 2 (has 4) | 1 / 3 (has 5) | 0 / 1 (has 7) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 0 | 4 / 4 (has 4) | 6 / 7 (has 7) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 0 | 0 / 1 (has 1) | 1 / 4 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 0 / 1 | no mention; landing page |
| 5 | records (words: booking) | 2 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 0) | shared; admin, manager (manager) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page |
| 6 | marketplace | 2 | 0 / 1 (has 2) | 1 / 4 (has 4) | 0 / 0 (has 4) | shared; admin, member (member) | none | pages home, jobs; read JobPost; create none | 0 | none | 0 / 2 | no mention; landing page |
| 7 | records | 0 | 0 / 1 (has 3) | 1 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, teams, players, matches; read Team, Player, Match; create none | 0 | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 2 | 0 / 6 (has 4) | 1 / 10 (has 6) | 0 / 0 (has 2); left out: register | shared; admin, attendee (attendee) | speakers: admin, attendees: admin, registrations: admin | pages home, talks; read Talk, Speaker; create none | 2 (capacity-no-unique, public-personal-data) | none | 0 / 4 | no mention; landing page |
| 9 | records (words: invoicing) | 2 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 4) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page |
| 10 | records | 2 | 0 / 1 (has 3) | 1 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, recipes; read Recipe; create none | 0 | none | 0 / 3 | no mention; landing page |
| 11 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page |
| 12 | status | 0 | 4 / 4 (has 4) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names actions the draft dropped because they could not be made valid. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Left out, since it could not be made valid:
  addAction book: addAction would make smithable.yml invalid. Booking has a capacity per session, but "session" is not unique: one person can take several places. "placesLeft" in "when" of action "book": compares a choice field with one of its values (or a list of them), and a yes/no field with true or false.
  addAction cancelBooking: addAction would make smithable.yml invalid. Booking has a capacity per session, but "session" is not unique: one person can take several places. "set" of action "cancelBooking": Booking has no field named "status".

Yoga Studio Booking
  Class schedule and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, contact and footer)
  - Class types (lists class types; only for admins; visitors see class types on the Home page)
  - Instructors (lists instructors; only for admins)
  - Messages (lists messages; only for admins)
  - Sessions (lists sessions; only for admins)
  - My bookings (lists bookings)
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
  - a places left (a whole number, the capacity minus the number of its bookings by default)
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
Generated 104 files (104 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-wLmuVc/app-1/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
bookings 6 columns 0 indexes 3 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
messages 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_familiar_marauders.sql 🚀

Created /tmp/smithable-bench-m12-wLmuVc/app-1. Start it with:

  cd /tmp/smithable-bench-m12-wLmuVc/app-1
  smithable run
/tmp/smithable-bench-m12-wLmuVc/app-1/smithable.yml:46:7  warning  Booking has a capacity per session, but "session" is not unique: one person can take several places.
    hint: Write "session: Session! unique" for one booking per person and session (unique per owner with private access).
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Sales CRM
  Lightweight CRM for a small sales team to manage companies, contacts, deals and follow-ups.

Pages
  - Companies (lists companies; search by name or email)
  - Team (who has access: invite people, change roles, remove users)
  - Contacts (lists contacts; search by first name, last name, email or company)
  - Deals (lists deals; search by name, company or stage; filter by stage, company or owner; sort by value, close date or date added; “Qualify”; “Send proposal”; “Start negotiation”; “Close won”; “Close lost”)
  - Follow ups (lists follow ups; search by title or status; filter by status, due date, deal or owner; sort by due date or date added; “Complete”; “Cancel”)

Companies
  Companies have:
  - a name (required)
  - an email
  - a phone
  - a segment (smb, enterprise or government, smb by default)
  - notes
  Each company can have an account manager (a user).
  Only admins can delete companies.

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

Deals
  Deals have:
  - a name (required)
  - a company (a company, required)
  - a value (an amount, required)
  - a stage (lead, qualified, proposal, negotiation, closed won or closed lost, lead by default)
  - a close date
  - notes
  - a contact (a contact)
  Only admins can delete deals.

Follow ups
  Follow ups have:
  - a title (required)
  - a due date (required)
  - status (pending, completed or canceled, pending by default)
  - notes
  - a deal (a deal, required)
  Only admins can delete follow ups.

Qualify
  For a deal that is lead; sets stage to qualified.

Send proposal
  For a deal that is qualified; sets stage to proposal.

Start negotiation
  For a deal that is proposal; sets stage to negotiation.

Close won
  For a deal that is negotiation; sets stage to closed won and close date to today.

Close lost
  For a deal that is negotiation; sets stage to closed lost and close date to today.

Complete
  For a follow up that is pending; sets status to completed.

Cancel
  For a follow up that is pending; sets status to canceled.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - sales (Works with companies, contacts, deals and follow-ups)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 107 files (107 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-wLmuVc/app-2/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_motionless_shocker.sql 🚀

Created /tmp/smithable-bench-m12-wLmuVc/app-2. Start it with:

  cd /tmp/smithable-bench-m12-wLmuVc/app-2
  smithable run
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Freelance Invoicing
  Invoicing for freelancers, with clients, invoices and payments.

Pages
  - Home (a landing page: hero and footer)
  - Clients (lists clients; search by name or email)
  - Invoices (lists invoices; search by number or client; filter by status or client; sort by issued on, due on, total or number; “Mark sent”; “Mark paid”)
  - Settings (lists business profiles)
  - Team (who has access: invite people, change roles, remove users)
  - Overview (lists invoices)
  - Invoice lines (lists invoice lines)

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
  - due on (a date, required, the issued on plus 30 days by default)
  - status (draft, sent, paid or overdue, draft by default)
  - a total (an amount, the total amount of its lines by default)
  Each invoice lists its invoice lines.

Invoice lines
  Invoice lines have:
  - an invoice (an invoice, required)
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  - an amount (an amount)

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
Generated 102 files (102 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-wLmuVc/app-3/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_peaceful_wildside.sql 🚀

Created /tmp/smithable-bench-m12-wLmuVc/app-3. Start it with:

  cd /tmp/smithable-bench-m12-wLmuVc/app-3
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
  - a condition (like new, good or worn, like new by default)
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
Generated 79 files (79 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-wLmuVc/app-4/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
tools 9 columns 0 indexes 1 fks
tools_favorites 4 columns 1 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_clever_goliath.sql 🚀

Created /tmp/smithable-bench-m12-wLmuVc/app-4. Start it with:

  cd /tmp/smithable-bench-m12-wLmuVc/app-4
  smithable run
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  Track ingredients, suppliers and stock levels for a small bakery.

Pages
  - Ingredients (lists ingredients; search by name, description or category)
  - Suppliers (lists suppliers; search by name, contact name or email)
  - Stock (lists stocks; search by ingredient; filter by ingredient or supplier)
  - Team (who has access: invite people, change roles, remove users)

Ingredients
  Ingredients have:
  - a name (required)
  - a description
  - a category (dry, wet or frozen, dry by default)
  - a unit (required)
  - a min stock level (a whole number, 0 by default)
  Only manager users and admins can delete ingredients.

Suppliers
  Suppliers have:
  - a name (required)
  - a contact name
  - an email
  - a phone
  - address
  Only manager users and admins can delete suppliers.

Stocks
  Stocks have:
  - an ingredient (an ingredient, required)
  - a supplier (a supplier)
  - a quantity (a number, required)
  - a last restocked (a date)
  - an expiry date
  Only manager users and admins can delete stocks.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - manager (Manages inventory and suppliers)
  New users get the manager role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 87 files (87 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-wLmuVc/app-5/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
ingredients 9 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
stocks 9 columns 0 indexes 3 fks
suppliers 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_wide_ultron.sql 🚀

Created /tmp/smithable-bench-m12-wLmuVc/app-5. Start it with:

  cd /tmp/smithable-bench-m12-wLmuVc/app-5
  smithable run
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  A job board for a local union to post jobs and receive applications.

Pages
  - Jobs (lists job posts; search by title, description, company or location; filter by type or status; sort by posted at or salary; “Close job”)
  - Applications (lists applications; search by name or email; filter by job post or status; “Review application”; “Shortlist application”; “Reject application”)
  - Team (who has access: invite people, change roles, remove users)
  - Home (a landing page: hero, job posts where status is open and footer)

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
  Only admins can delete job posts.

Applications
  Applications have:
  - a job post (a job post, required)
  - a name (required)
  - an email (required)
  - a phone
  - a resume
  - a cover letter
  - status (submitted, reviewed, shortlisted or rejected, submitted by default)
  Only admins can delete applications.

Close job
  For a job post that is open; sets status to closed.
  Only member users and admins can use it.

Review application
  For an application that is submitted; sets status to reviewed.
  Only member users and admins can use it.

Shortlist application
  For an application that is reviewed or shortlisted; sets status to shortlisted.
  Only member users and admins can use it.

Reject application
  For an application that is reviewed or shortlisted; sets status to rejected.
  Only member users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the job board)
  - member (Posts jobs and views applications)
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page and reading job posts where status is open.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 93 files (93 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-wLmuVc/app-6/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
applications 11 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
job_posts 12 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_daily_switch.sql 🚀

Created /tmp/smithable-bench-m12-wLmuVc/app-6. Start it with:

  cd /tmp/smithable-bench-m12-wLmuVc/app-6
  smithable run
```

### 7. A football club's site: teams, players, matches and results.

```text
Football Club
  A football club's site with teams, players, matches and results.

Pages
  - Football Club (a landing page: hero, teams and footer)
  - Teams (lists teams; search by name or description; sort by name or founded)
  - Players (lists players; search by name, position or nationality; filter by team or position; sort by name, number or birth date)
  - Matches (lists matches; search by location; filter by home team, away team, status or date; sort by date, home score or away score)

Teams
  Teams have:
  - a name (required)
  - a description
  - a sport (football, futsal or beach soccer, football by default)
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
Generated 85 files (85 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-wLmuVc/app-7/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
matches 11 columns 0 indexes 3 fks
players 11 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_supreme_hydra.sql 🚀

Created /tmp/smithable-bench-m12-wLmuVc/app-7. Start it with:

  cd /tmp/smithable-bench-m12-wLmuVc/app-7
  smithable run
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Left out, since it could not be made valid:
  addAction register: addAction would make smithable.yml invalid. Registration has a capacity per talk, but "talk" is not unique: one person can take several places. "add" of action "register": Registration also needs attendee, another required reference, which an action cannot fill yet; a model with another required reference cannot be added by an action. Registration in "add" of action "register": talk is filled with the record the action runs on; leave it out. Registration in "add" of action "register": Registration.attendee cannot be set, it is a reference.

Conference Registration
  Event registration for a conference: talks, speakers and attendees.

Pages
  - Home (a landing page: hero, talks, speakers, contact and footer)
  - Talks (lists talks)
  - Speakers (lists speakers; only for admins; visitors see speakers on the Home page)
  - Attendees (lists attendees; only for admins)
  - Registrations (lists registrations; “Cancel registration”; “Mark attended”; only for admins)
  - Team (who has access: invite people, change roles, remove users)

Talks
  Talks have:
  - a title (required)
  - a summary
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a room
  - a capacity (a whole number, required, 100 by default)
  - a speaker (a speaker, required)
  Each talk lists its registrations.
  Only admins can delete talks.
  Only admins can change talks.

Speakers
  Speakers have:
  - a name (required)
  - a bio
  - a photo (picture)
  - an email
  - a company
  Only admins can delete speakers.
  Only admins can change speakers.

Attendees
  Attendees have:
  - a name (required)
  - an email (required, unique)
  - a company
  - dietary restrictions
  Each attendee can have a user (a user).
  Only admins can delete attendees.
  Only admins can change attendees.

Registrations
  Registrations have:
  - a talk (a talk, required)
  - an attendee (an attendee, required)
  - registered at (a date and time, required, now by default)
  - status (registered, attended or cancelled, registered by default)
  Only the owner and admins can delete registrations.
  Only the owner and admins can change registrations.
  At most the talk's capacity registrations per talk.

Cancel registration
  For a registration that is registered; sets status to cancelled.
  Cancel this registration.

Mark attended
  For a registration that is registered; sets status to attended.
  Mark this registration as attended.
  Only admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Conference organizer. Manages talks, speakers, and attendees)
  - attendee (A conference attendee who registers for talks)
  New users get the attendee role.
  Open to anyone without signing in: the home page, the talks page, reading talks and reading speakers.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 105 files (105 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-wLmuVc/app-8/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
attendees 9 columns 1 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
registrations 8 columns 0 indexes 3 fks
session 8 columns 2 indexes 1 fks
speakers 9 columns 0 indexes 1 fks
talks 11 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_fast_silver_sable.sql 🚀

Created /tmp/smithable-bench-m12-wLmuVc/app-8. Start it with:

  cd /tmp/smithable-bench-m12-wLmuVc/app-8
  smithable run
/tmp/smithable-bench-m12-wLmuVc/app-8/smithable.yml:46:7  warning  Registration has a capacity per talk, but "talk" is not unique: one person can take several places.
    hint: Write "talk: Talk! unique" for one registration per person and talk (unique per owner with private access).
/tmp/smithable-bench-m12-wLmuVc/app-8/smithable.auth.yml:8:16  warning  Anyone on the internet can read Speaker, including personal data in email.
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
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-wLmuVc/app-9/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
tickets 9 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_chunky_triton.sql 🚀

Created /tmp/smithable-bench-m12-wLmuVc/app-9. Start it with:

  cd /tmp/smithable-bench-m12-wLmuVc/app-9
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
Generated 83 files (83 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-wLmuVc/app-10/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
ingredients 8 columns 0 indexes 2 fks
recipes 13 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
shopping_lists 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_stiff_meteorite.sql 🚀

Created /tmp/smithable-bench-m12-wLmuVc/app-10. Start it with:

  cd /tmp/smithable-bench-m12-wLmuVc/app-10
  smithable run
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  Live status of our API services, incidents and planned maintenance.

Pages
  - API Status (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the API Status page)
  - Maintenance (lists maintenances)
  - Team (who has access: invite people, change roles, remove users)
  - Overview (every kind of record, to find, open, change and delete)

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

Identified
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.
  Only staff users and admins can use it.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.
  Only staff users and admins can use it.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; asks for the incident update's message; adds an incident update (at now, status resolved).
  The incident is resolved; the incident moves to resolved, with an update saying so.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 113 files (113 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-wLmuVc/app-11/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_common_magdalene.sql 🚀

Created /tmp/smithable-bench-m12-wLmuVc/app-11. Start it with:

  cd /tmp/smithable-bench-m12-wLmuVc/app-11
  smithable run
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Web Shop Uptime
  Current status of our web shop services, outages and updates.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Maintenance (lists maintenances)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)

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
  For an incident that is investigating; sets status to identified; asks for the incident update's message; adds an incident update (at now, status identified).
  The cause is found; the incident moves to identified, with an update saying so.
  Only staff users and admins can use it.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; asks for the incident update's message; adds an incident update (at now, status monitoring).
  A fix is out; the incident is watched before it is closed, with an update saying so.
  Only staff users and admins can use it.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; asks for the incident update's message; adds an incident update (at now, status resolved).
  The incident is over, with an update saying so. The component's state stays what the team sets.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the uptime page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 113 files (113 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-wLmuVc/app-12/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_sour_guardian.sql 🚀

Created /tmp/smithable-bench-m12-wLmuVc/app-12. Start it with:

  cd /tmp/smithable-bench-m12-wLmuVc/app-12
  smithable run
```
