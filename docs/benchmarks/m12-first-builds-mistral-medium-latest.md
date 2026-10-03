# M12 first builds: mistral-medium-latest (2026-10-03)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 10 / 12 created, 10 type-check, 220,299 tokens, €0.1166.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 19,928 | €0.0121 | 29 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 9,558 | €0.0058 | 19 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 18,922 | €0.0104 | 25 s |
| A tool library where neighbors lend each other tools. | marketplace | **no** | **no** | 33,939 | €0.0162 | 20 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 8,564 | €0.0045 | 18 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 17,386 | €0.0087 | 22 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 8,461 | €0.0042 | 16 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 9,837 | €0.0057 | 20 s |
| A help desk for an IT team: tickets, priorities and who handles them. | records | yes | yes | 18,042 | €0.0098 | 24 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 9,015 | €0.0054 | 17 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 29,031 | €0.0151 | 31 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | **no** | **no** | 37,616 | €0.0187 | 21 s |

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest/](m12-first-builds-mistral-medium-latest/), one folder per description (app-1 …).

<!-- scorecard -->
## Against the earlier runs

The runs so far:
1. From main before #169 and #174.
2. After them (#176).
3. After #180 (#181).
4. After #190 (#193).
5. After #194 (#195).
6. After #196 and #197 (#199).
7. After #200 and #201 (#202).
8. This one: after #204 (computed fields through operations: `addField --formula`, the long form in `addModel`, and a `money = quantity * unitPrice` default mended into a formula).

- **Better: invoicing.** 3, the freelancer invoicing, is created again. InvoiceLine has `amount: formula: quantity * unitPrice`, and Invoice has `total: SUM(lines.amount)`, as in the starter.
- **Worse: two drafts fail that were created before.**
  - 4, the tool library: its Tool model never lands, three runs out of three, and only the pages that need it are named as refused.
  - 12, the web shop's uptime page: its history page never lands.
  - Both reported to session A as a likely consequence of #204's `addModel` schema.
- **Status:** 11 keeps 3 of 3 actions.

## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 0 | 4 / 6 (has 4) | 7 / 10 (has 8) | 0 / 0 (has 0) | private; admin, member (member) | admin: admin, team: admin, class-types: admin, instructors: admin, sessions: admin, schedule: admin | pages home, schedule; read ClassType, Instructor, Session; create none | 2 (no-timezone, public-personal-data) | none | 0 / 4 | mentions visitors; landing page |
| 2 | crm | 0 | 0 / 2 (has 4) | 1 / 3 (has 5) | 0 / 1 (has 4) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 0 | 4 / 4 (has 4) | 5 / 7 (has 5) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 3 / 4 | no mention; landing page |
| 5 | records (words: booking) | 2 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 0) | shared; admin, baker, manager (baker) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page |
| 6 | marketplace | 2 | 0 / 1 (has 2) | 1 / 4 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, jobs; read JobPost; create none | 0 | none | 0 / 2 | no mention; landing page |
| 7 | records | 0 | 0 / 1 (has 4) | 1 / 2 (has 5) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, teams, players, matches, results; read Team, Player, Match, Result; create none | 0 | none | 0 / 4 | mentions visitors; landing page |
| 8 | booking (words: records) | 2 | 0 / 6 (has 4) | 2 / 10 (has 7) | 0 / 0 (has 0) | shared; admin, organizer, attendee (attendee) | talks: organizer, speakers: organizer, attendees: organizer | pages home; read Talk, Speaker; create Attendee | 1 (public-personal-data) | none | 0 / 4 | no mention; landing page |
| 9 | records (words: invoicing) | 2 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 4) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page |
| 10 | records | 2 | 0 / 1 (has 4) | 1 / 2 (has 3) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, recipes; read Recipe; create none | 0 | none | 0 / 4 | no mention; landing page |
| 11 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names actions the draft dropped because they could not be made valid. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Pages
  - Home (a landing page: hero and footer)
  - Admin (every kind of record, to find, open, change and delete; only for admins)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Class types (lists class types; only for admins)
  - Instructors (lists instructors; only for admins)
  - Sessions (lists sessions; only for admins)
  - My bookings (lists bookings; only the viewer's own records)
  - Schedule (a calendar of sessions by week or month; only for admins)

Class types
  Class types have:
  - a name (required)
  - a description
  - a duration (a whole number, required, 60 by default)
  - a level (beginner, intermediate or advanced, beginner by default)
  - a price (an amount, required)
  Only admins can add class types.
  Only admins can change class types.
  Only admins can delete class types.

Instructors
  Instructors have:
  - a name (required)
  - a bio
  - a photo (a web address)
  - an email (required, unique)
  Only admins can add instructors.
  Only admins can change instructors.
  Only admins can delete instructors.

Sessions
  Sessions have:
  - a class type (a class type, required)
  - an instructor (an instructor, required)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a max capacity (a whole number, required, 20 by default)
  Each session lists its bookings.
  Only admins can add sessions.
  Only admins can change sessions.
  Only admins can delete sessions.

Bookings
  Bookings have:
  - a session (a session, required)
  - status (booked, attended or cancelled, booked by default)
  - booked at (a date and time, now by default)
  Each booking can have a user (a user).

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studio staff. Manage the schedule, classes and teachers)
  - member (A student who books classes)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors and reading sessions.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 109 files (109 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-f8S6fM/app-1/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
bookings 8 columns 0 indexes 3 fks
class_types 9 columns 0 indexes 1 fks
instructors 8 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_jittery_leper_queen.sql 🚀

Created /tmp/smithable-bench-m12-f8S6fM/app-1. Start it with:

  cd /tmp/smithable-bench-m12-f8S6fM/app-1
  smithable run
/tmp/smithable-bench-m12-f8S6fM/app-1/smithable.yml:25:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-f8S6fM/app-1/smithable.auth.yml:14:21  warning  Anyone on the internet can read Instructor, including personal data in email.
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Sales CRM
  A lightweight CRM for a small sales team to manage companies, contacts, deals and follow-ups.

Pages
  - Companies (lists companies; search by name or email)
  - Contacts (lists contacts; search by first name, last name or email)
  - Deals (lists deals; search by name, company or stage; filter by stage or company; “Mark deal won”; “Mark deal lost”)
  - Follow ups (lists follow ups; search by title, company or status; filter by status, due date or company; “Complete follow up”; “Cancel follow up”)
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
  - a contact (a contact)
  - a value (an amount)
  - a stage (prospecting, qualified, proposal, negotiation, closed won or closed lost, prospecting by default)
  - a close date
  - notes
  Only admins can delete deals.

Follow ups
  Follow ups have:
  - a title (required)
  - a company (a company, required)
  - a contact (a contact)
  - a deal (a deal)
  - a due date (required)
  - status (pending, completed or canceled, pending by default)
  - notes
  Only admins can delete follow ups.

Mark deal won
  For a deal that is negotiation; sets stage to closed won and close date to today.

Mark deal lost
  For a deal that is negotiation; sets stage to closed lost and close date to today.

Complete follow up
  For a follow up that is pending; sets status to completed.

Cancel follow up
  For a follow up that is pending; sets status to canceled.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - sales (Works with companies, contacts, deals and follow-ups)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 101 files (101 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-f8S6fM/app-2/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
companies 10 columns 0 indexes 2 fks
contacts 11 columns 0 indexes 2 fks
deals 11 columns 0 indexes 3 fks
follow_ups 11 columns 0 indexes 4 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_first_mister_sinister.sql 🚀

Created /tmp/smithable-bench-m12-f8S6fM/app-2. Start it with:

  cd /tmp/smithable-bench-m12-f8S6fM/app-2
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
  - Invoices (lists invoices; search by number; filter by status or client; “Mark sent”; “Mark paid”)
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
  - an invoice (an invoice, required)
  The amount is calculated as the quantity times the unit price.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - status (draft, sent, paid or overdue, draft by default)
  The due on is calculated as the issued on plus 30 days.
  Each invoice lists its invoice lines.
  The total is calculated as the total amount of its lines.

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
Generated 96 files (96 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-f8S6fM/app-3/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_tense_ikaris.sql 🚀

Created /tmp/smithable-bench-m12-f8S6fM/app-3. Start it with:

  cd /tmp/smithable-bench-m12-f8S6fM/app-3
  smithable run
```

### 4. A tool library where neighbors lend each other tools.

Failed:

```text
Starting from the marketplace starter.
Smithable model (mistral-medium-latest) · 33,939 tokens · €0.0162
No model drafted a valid project.
addPage: There is no model named "Tool".
addPage: There is no model named "Tool".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-f8S6fM/app-4 --starter marketplace

```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  Track ingredients, suppliers and stock levels for a small bakery.

Pages
  - Ingredients (lists ingredients; search by name, description or category)
  - Suppliers (lists suppliers; search by name, contact name or email)
  - Stock (lists stocks; search by ingredient or supplier)
  - Team (who has access: invite people, change roles, remove users)

Ingredients
  Ingredients have:
  - a name (required)
  - a description
  - a category (dry, wet or frozen, dry by default)
  - a unit (required)
  - a min stock (a whole number, 0 by default)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact name
  - an email
  - a phone
  - address
  Only manager users and admins can delete suppliers.
  Only manager users and admins can change suppliers.

Stocks
  Stocks have:
  - an ingredient (an ingredient, required)
  - a supplier (a supplier)
  - a quantity (a whole number, required)
  - a last updated (required, today by default)
  - an expiry date
  Only manager users and admins can delete stocks.
  Only baker users, manager users and admins can change stocks.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - baker (Manages ingredients and stock)
  - manager (Manages suppliers and stock)
  New users get the baker role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-f8S6fM/app-5/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
ingredients 9 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
stocks 9 columns 0 indexes 3 fks
suppliers 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_dusty_rachel_grey.sql 🚀

Created /tmp/smithable-bench-m12-f8S6fM/app-5. Start it with:

  cd /tmp/smithable-bench-m12-f8S6fM/app-5
  smithable run
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  A job board for a local union to post jobs and receive applications.

Pages
  - Jobs (lists job posts; search by title, description, company or location; filter by type, status or salary; sort by posted at or salary; records can be saved as favorites; contact the owner by mail)
  - Home (a landing page: hero, job posts where status is open and footer)
  - Applications (lists applications)

Job posts
  Job posts have:
  - a title (required)
  - a description (required)
  - a company (required)
  - a location
  - a salary (an amount)
  - a type (full time, part time, contract or temporary, full time by default)
  - status (open or closed, open by default)
  - posted at (a date and time, now by default)

Applications
  Applications have:
  - a job post (a job post, required)
  - a name (required)
  - an email (required)
  - a phone
  - a resume (a web address)
  - a cover letter
  - status (submitted, reviewed, shortlisted, rejected or hired, submitted by default)
  - applied at (a date and time, now by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Manages the job board)
  - member (Posts jobs and applies to them)
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page and reading job posts where status is open.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 83 files (83 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-f8S6fM/app-6/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
applications 12 columns 0 indexes 2 fks
job_posts 12 columns 0 indexes 1 fks
job_posts_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_steep_lyja.sql 🚀

Created /tmp/smithable-bench-m12-f8S6fM/app-6. Start it with:

  cd /tmp/smithable-bench-m12-f8S6fM/app-6
  smithable run
```

### 7. A football club's site: teams, players, matches and results.

```text
Football Club
  A football club's site with teams, players, matches and results.

Pages
  - Home (a landing page: hero, teams, matches where status is scheduled and footer)
  - Teams (lists teams)
  - Players (lists players)
  - Matches (lists matches)
  - Results (lists results)

Teams
  Teams have:
  - a name (required)
  - a description
  - a sport (football, futsal or beach, football by default)
  - a founded (a date)

Players
  Players have:
  - a name (required)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a team (a team, required)
  - a number (a whole number)
  - a birth date

Matches
  Matches have:
  - a home team (a team, required)
  - an away team (a team, required)
  - a date (a date and time, required)
  - a location
  - status (scheduled, played or canceled, scheduled by default)

Results
  Results have:
  - a match (a match, required)
  - a home score (a whole number, required)
  - an away score (a whole number, required)
  - scorers

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, the players page, the matches page, the results page, reading teams, reading players, reading matches and reading results.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 88 files (88 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-f8S6fM/app-7/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
matches 9 columns 0 indexes 3 fks
players 9 columns 0 indexes 2 fks
results 8 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_wooden_earthquake.sql 🚀

Created /tmp/smithable-bench-m12-f8S6fM/app-7. Start it with:

  cd /tmp/smithable-bench-m12-f8S6fM/app-7
  smithable run
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Registration
  Event registration for a conference with talks, speakers and attendees.

Pages
  - Home (a landing page: hero, talks, speakers, contact and footer)
  - Talks (lists talks; only for organizer users and admins; visitors see talks on the Home page)
  - Speakers (lists speakers; only for organizer users and admins; visitors see speakers on the Home page)
  - Attendees (lists attendees; only for organizer users and admins)
  - Registrations (lists registrations)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)

Talks
  Talks have:
  - a title (required)
  - a summary
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a room
  - a capacity (a whole number, required, 50 by default)
  - a speaker (a speaker, required)
  Each talk lists its registrations.
  Only organizer users and admins can add talks.
  Only organizer users and admins can change talks.
  Only organizer users and admins can delete talks.

Speakers
  Speakers have:
  - a name (required)
  - a bio
  - a photo (picture)
  - an email
  - a company
  Only organizer users and admins can add speakers.
  Only organizer users and admins can change speakers.
  Only organizer users and admins can delete speakers.

Registrations
  Registrations have:
  - a talk (a talk, required, unique)
  - registered at (a date and time, required, now by default)
  - an attendee (an attendee, required)
  Only organizer users, attendee users and admins can add registrations.
  Only organizer users, the owner and admins can delete registrations.
  At most the talk's capacity registrations per talk.

Attendees
  Attendees have:
  - a name (required)
  - an email (required, unique)
  - a company
  - dietary requirements
  Only organizer users, attendee users and admins can add attendees.
  Only organizer users, the owner and admins can change attendees.
  Only organizer users, the owner and admins can delete attendees.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - organizer (Manages talks, speakers, and registrations)
  - attendee (A conference participant)
  New users get the attendee role.
  Open to anyone without signing in: the home page, reading talks, reading speakers and adding attendees.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 113 files (113 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-f8S6fM/app-8/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
attendees 8 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
registrations 7 columns 1 indexes 3 fks
session 8 columns 2 indexes 1 fks
speakers 9 columns 0 indexes 1 fks
talks 11 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_parallel_grim_reaper.sql 🚀

Created /tmp/smithable-bench-m12-f8S6fM/app-8. Start it with:

  cd /tmp/smithable-bench-m12-f8S6fM/app-8
  smithable run
/tmp/smithable-bench-m12-f8S6fM/app-8/smithable.auth.yml:14:16  warning  Anyone on the internet can read Speaker, including personal data in email.
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  A help desk for an IT team to manage support tickets, priorities and assignments.

Pages
  - Tickets (lists tickets; search by title or description; sort by priority, status or date added; “Start work”; “Resolve”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users)

Tickets
  Tickets have:
  - a title (required)
  - a description
  - a priority (low, medium, high or critical, low by default)
  - status (open, in progress, resolved or closed, open by default)
  Each ticket can have an assignee (a user).
  Each ticket can have a requester (a user).
  Only admins can delete tickets.

Start work
  For a ticket that is open; sets status to in progress and assignee to whoever presses it.
  Assign the ticket to yourself and start working on it.

Resolve
  For a ticket that is in progress; sets status to resolved.
  Mark the ticket as resolved.

Close
  For a ticket that is resolved; sets status to closed.
  Close the resolved ticket.

Reopen
  For a ticket that is closed or resolved; sets status to open.
  Reopen the ticket for further work.

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
Reading config file '/tmp/smithable-bench-m12-f8S6fM/app-9/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
tickets 10 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_useful_machine_man.sql 🚀

Created /tmp/smithable-bench-m12-f8S6fM/app-9. Start it with:

  cd /tmp/smithable-bench-m12-f8S6fM/app-9
  smithable run
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A place to keep and share family recipes with ingredients and shopping lists.

Pages
  - Home (a landing page: hero, recipes where category is breakfast or lunch or dinner or dessert or snack or drink and footer)
  - Recipes (lists recipes; search by name, description, category or difficulty; filter by category or difficulty)
  - Shopping lists (lists shopping lists; filter by status or date; “Mark as in progress”; “Mark as completed”)

Recipes
  Recipes have:
  - a name (required)
  - a description
  - servings (a whole number, 4 by default)
  - a prep time
  - a cook time
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
  - status (planned, in progress or completed, planned by default)
  - a recipe (a recipe)
  Only admins can delete shopping lists.
  Only member users and admins can change shopping lists.
  Only member users and admins can add shopping lists.

Shopping items
  Shopping items have:
  - a name (required)
  - a quantity
  - a unit
  - a bought (yes or no, false by default)
  - a shopping list (a shopping list, required)

Mark as in progress
  For a shopping list that is planned; sets status to in progress.

Mark as completed
  For a shopping list that is in progress; sets status to completed.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Manages recipes and shopping lists)
  - member (Views and uses recipes and shopping lists)
  New users get the member role.
  Open to anyone without signing in: the home page, the recipes page and reading recipes.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 89 files (89 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-f8S6fM/app-10/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
ingredients 8 columns 0 indexes 2 fks
recipes 13 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
shopping_items 9 columns 0 indexes 2 fks
shopping_lists 8 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_icy_newton_destine.sql 🚀

Created /tmp/smithable-bench-m12-f8S6fM/app-10. Start it with:

  cd /tmp/smithable-bench-m12-f8S6fM/app-10
  smithable run
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  Live status of our API services, incidents, and planned maintenance.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Maintenance (lists maintenances)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)
  - Overview (a dashboard: open, per month and latest)

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
  Only admins can delete incidents.

Incident updates
  Incident updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)
  Only admins can delete incident updates.

Maintenances
  Maintenances have:
  - a title (required)
  - a component (a component)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description
  Only admins can delete maintenances.

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
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 116 files (116 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-f8S6fM/app-11/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_open_jimmy_woo.sql 🚀

Created /tmp/smithable-bench-m12-f8S6fM/app-11. Start it with:

  cd /tmp/smithable-bench-m12-f8S6fM/app-11
  smithable run
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

Failed:

```text
Starting from the status starter.
Smithable model (mistral-medium-latest) · 37,616 tokens · €0.0187
No model drafted a valid project.
setPublic: setPublic would make smithable.auth.yml invalid. There is no page named "history" in smithable.yml. Nobody receives mail at admin@webshop-status.example, so nobody can sign in as this administrator. Replace it with a real address (smithable op setAdmins you@your-domain).
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-f8S6fM/app-12 --starter status

```
