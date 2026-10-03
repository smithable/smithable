# M12 first builds: mistral-medium-latest (2026-10-03)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 9 / 12 created, 9 type-check, 165,560 tokens, €0.1063.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 19,679 | €0.0132 | 35 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 8,325 | €0.0052 | 22 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 9,367 | €0.0074 | 24 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 21,657 | €0.0104 | 22 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 8,155 | €0.0055 | 18 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 27,642 | €0.0173 | 53 s |
| A football club's site: teams, players, matches and results. | records | **no** | **no** | 8,671 | €0.0066 | 14 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 9,259 | €0.0065 | 58 s |
| A help desk for an IT team: tickets, priorities and who handles them. | records | yes | yes | 7,982 | €0.0052 | 39 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 8,662 | €0.0066 | 34 s |
| A status page for our API, with incidents and planned maintenance. | status | **no** | **no** | 16,638 | €0.0094 | 15 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | **no** | **no** | 19,523 | €0.0130 | 20 s |

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest/](m12-first-builds-mistral-medium-latest/), one folder per description (app-1 …).

<!-- scorecard -->
## Against the first run (before #169 and #174)

The baseline is this report's previous version: the same twelve descriptions, from main before #169 (shared drafts invite-only) and #174 (the first step in any language and with `--yes`; labels and texts in the description's language).

- **Better: sign-up and public data.** No draft is shared with open sign-up (open-shared-access warnings: 6 before, 0 now). One publishes personal data, against two before: 8, the conference, publishes its talks and speakers.
- **Starters now picked by meaning.** `new` picked a different starter from the word match in four cases: the tool library got marketplace (words: records), the bakery inventory records (words: booking), the conference booking (words: records), the help desk records (words: invoicing). Each reads as the better fit.
- **Questions.** The first step would ask questions for three descriptions (6, 8, 9); `--yes` answers none of them.
- **Worse: three drafts fail** (9 of 12 created; before, 12 of 12). In 7, 11 and 12 the content file ends with an empty `hero:`. `new` says it wrote the hero picture, but no `hero.webp` is in `public/images`. `dropMissingPictures` then removes `hero.image`, leaving the section with no value, and validation refuses the file. This is an engine bug, reported to session A.
- **Worse: an English description got Spanish titles.** 7, the football club's site, came out with page titles in Spanish (Equipos, Jugadores, Partidos, Resultados).

## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 0 | 5 / 6 | 8 / 10 | 0 / 0 | private; admin, member (member) | class-types: admin, instructors: admin, messages: admin, sessions: admin | pages home, schedule; read ClassType, Instructor, Session; create Message | 2 (capacity-no-unique, no-timezone) | none | 3 / 5 | mentions visitors; landing page |
| 2 | crm | 0 | 0 / 2 | 1 / 3 | 0 / 1 | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 0 | 4 / 4 | 4 / 7 | 0 / 0 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 4 | no mention; no landing page |
| 4 | marketplace (words: records) | 0 | 0 / 1 | 1 / 4 | 0 / 0 | private; admin, member (member) | none | pages home; read Tool; create none | 0 | none | 0 / 1 | no mention; landing page |
| 5 | records (words: booking) | 0 | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, baker (baker) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page |
| 6 | marketplace | 2 | 0 / 1 | 0 / 4 | 0 / 0 | private; admin, employer, member (member) | applications: employer/admin, jobs: employer/member/admin, myJobs: employer/admin | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page |
| 7 | records | 0 | 0 / 1 | 1 / 2 | 0 / 0 | private; admin, member (member) | none | pages home, teams, players, matches, results; read Team, Player, Match, Result; create none | 0 | none | 0 / 4 | mentions visitors; landing page |
| 8 | booking (words: records) | 2 | 0 / 6 | 1 / 10 | 0 / 0 | shared; admin, organizer (organizer) | none | pages home, talks; read Talk, Speaker; create none | 2 (capacity-no-unique, public-personal-data) | none | 0 / 4 | no mention; landing page |
| 9 | records (words: invoicing) | 3 | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, itSupport (itSupport) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page |
| 10 | records | 0 | 0 / 1 | 0 / 2 | 0 / 0 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page |
| 11 | status | 0 | 4 / 4 | 6 / 8 | 3 / 3 | shared; admin, staff (staff) | incidents: admin/staff, updates: admin/staff, components: admin, maintenance: admin/staff | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page |
| 12 | status | 0 | 4 / 4 | 6 / 8 | 3 / 3 | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Yoga Studio
  Class schedule and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, gallery, faq, contact, call to action and footer)
  - Class Types (lists class types; only for admins; visitors see class types on the Home page)
  - Instructors (lists instructors; only for admins)
  - Messages (lists messages; only for admins)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)
  - Sessions (lists sessions; only for admins)
  - My Bookings (lists bookings; only the viewer's own records)
  - Schedule (a calendar of sessions by week or month)

Class Types
  Class Types have:
  - a name (required)
  - a summary
  - a level (beginner, all levels or advanced, beginner by default)
  - a duration (minutes) (a whole number, required, 60 by default)
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
  Only admins can delete sessions.

Bookings
  Bookings have:
  - a session (a session, required)
  Each booking can have a user (a user).
  Only member users and admins can add bookings.
  Only member users, the owner and admins can delete bookings.
  At most the session's capacity bookings per session.

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studio staff. Manage the schedule, classes and teachers)
  - member (A student who books classes)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors, reading sessions and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 121 files (121 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-tGHm29/app-1/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_cuddly_chronomancer.sql 🚀

Created /tmp/smithable-bench-m12-tGHm29/app-1. Start it with:

  cd /tmp/smithable-bench-m12-tGHm29/app-1
  smithable run
/tmp/smithable-bench-m12-tGHm29/app-1/smithable.yml:45:7  warning  Booking has a capacity per session, but "session" is not unique: one person can take several places.
    hint: Write "session: Session! unique" for one booking per person and session (unique per owner with private access).
/tmp/smithable-bench-m12-tGHm29/app-1/smithable.yml:86:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Small Sales CRM
  A CRM for a small sales team to manage companies, contacts, deals and follow-ups.

Pages
  - Companies (lists companies; search by name or email)
  - Contacts (lists contacts; search by first name, last name or email)
  - Deals (lists deals; search by name or company; filter by stage or company; sort by value, close date or stage)
  - Follow ups (lists follow ups; search by title or deal; filter by status, due date or deal; sort by due date or status)
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
  - a stage (prospecting, qualification, proposal, negotiation, closed won or closed lost, prospecting by default)
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

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Sales management. Full access)
  - sales (Works with companies, contacts, deals and follow-ups)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 91 files (91 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-tGHm29/app-2/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_mushy_peter_quill.sql 🚀

Created /tmp/smithable-bench-m12-tGHm29/app-2. Start it with:

  cd /tmp/smithable-bench-m12-tGHm29/app-2
  smithable run
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Freelancer Invoicing
  Invoicing for freelancers, with clients, invoices and payments.

Pages
  - Overview (lists invoices)
  - Invoices (lists invoices; search by invoice number or client; filter by status, client or issued on; sort by invoice number, issued on, due on, total or status)
  - Clients (lists clients; search by name or email; sort by name or email)
  - Settings (lists business profiles)

Business Profiles
  Business Profiles have:
  - a business name (required)
  - a VAT number
  - an IBAN
  - a payment term (days) (a whole number, required, 30 by default)
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
  - an invoice number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required)
  - status (draft, sent, paid or overdue, draft by default)
  - a total (an amount)
  Each invoice lists its invoice lines.

Invoice Lines
  Invoice Lines have:
  - an invoice (an invoice, required)
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  - an amount (an amount)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member (A freelancer using the app)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 87 files (87 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-tGHm29/app-3/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_robust_cloak.sql 🚀

Created /tmp/smithable-bench-m12-tGHm29/app-3. Start it with:

  cd /tmp/smithable-bench-m12-tGHm29/app-3
  smithable run
```

### 4. A tool library where neighbors lend each other tools.

```text
Tool Library
  A tool library where neighbors lend each other tools.

Pages
  - Home (a landing page: hero, tools and footer)
  - My tools (lists tools; only the viewer's own records)
  - Tools (lists tools; search by name or description; filter by category, condition or available; sort by name or date added; records can be saved as favorites; contact the owner by mail)

Tools
  Tools have:
  - a name (required)
  - a description (required)
  - a category (garden, power, hand, measuring or other, garden by default)
  - a condition (like new, good or worn, like new by default)
  - an available (yes or no, true by default)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member (Lends and borrows tools)
  New users get the member role.
  Open to anyone without signing in: the home page and reading tools.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 77 files (77 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-tGHm29/app-4/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
tools 9 columns 0 indexes 1 fks
tools_favorites 4 columns 1 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_bitter_lester.sql 🚀

Created /tmp/smithable-bench-m12-tGHm29/app-4. Start it with:

  cd /tmp/smithable-bench-m12-tGHm29/app-4
  smithable run
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  Track ingredients, suppliers, and stock levels for a small bakery.

Pages
  - Ingredients (lists ingredients; search by name or category)
  - Suppliers (lists suppliers; search by name or contact person)
  - Stock (lists stock levels; search by ingredient; filter by ingredient or supplier)
  - Team (who has access: invite people, change roles, remove users)

Ingredients
  Ingredients have:
  - a name (required)
  - a description
  - a category (dry, wet or frozen, dry by default)
  - a unit (required)
  - a minimum stock (a whole number, 0 by default)
  Only baker users and admins can delete ingredients.

Suppliers
  Suppliers have:
  - a name (required)
  - a contact person
  - an email
  - a phone
  - address
  Only baker users and admins can delete suppliers.

Stock Levels
  Stock Levels have:
  - an ingredient (an ingredient, required)
  - a supplier (a supplier)
  - a quantity (a number, required)
  - a last restocked (a date)
  - an expiry date
  Only baker users and admins can delete stock levels.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - baker (Manages ingredients and stock)
  New users get the baker role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 85 files (85 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-tGHm29/app-5/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
ingredients 9 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
stocks 9 columns 0 indexes 3 fks
suppliers 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_reflective_old_lace.sql 🚀

Created /tmp/smithable-bench-m12-tGHm29/app-5. Start it with:

  cd /tmp/smithable-bench-m12-tGHm29/app-5
  smithable run
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  A job board for a local union to post jobs and receive applications.

Pages
  - Jobs (lists jobs; search by title, description, company or location; filter by type, status or salary; sort by posted at or salary; only for employer users, member users and admins)
  - Applications (lists applications; only for employer users and admins)
  - My jobs (lists jobs; only the viewer's own records; only for employer users and admins)

Applications
  Applications have:
  - a name (required)
  - an email (required)
  - a phone
  - a resume
  - a cover letter
  - status (submitted, reviewed, interviewed, hired or rejected, submitted by default)
  - a job (a job, required)
  Only member users, employer users and admins can add applications.
  Only employer users, the owner and admins can see applications.

Jobs
  Jobs have:
  - a title (required)
  - a description (required)
  - a company (required)
  - a location
  - a salary (an amount)
  - a type (full time, part time, contract or temporary, full time by default)
  - status (open or closed, open by default)
  - posted at (a date, 2025-01-01 by default)
  Only employer users and admins can add jobs.
  Only employer users and admins can delete jobs.

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Manages the job board)
  - employer (Posts job listings)
  - member (Applies to jobs)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 78 files (78 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-tGHm29/app-6/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
applications 11 columns 0 indexes 2 fks
jobs 12 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_bouncy_malcolm_colcord.sql 🚀

Created /tmp/smithable-bench-m12-tGHm29/app-6. Start it with:

  cd /tmp/smithable-bench-m12-tGHm29/app-6
  smithable run
```

### 7. A football club's site: teams, players, matches and results.

Failed:

```text
 anyone without signing in: the home page, the teams page, the players page, the matches page, the results page, reading teams, reading players, reading matches and reading results.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Left out a picture the texts named but the app does not have.
/tmp/smithable-bench-m12-tGHm29/app-7/smithable.content.yml:78:10  error  "hero" of page "home" must be a mapping of keys to values.

1 error in /tmp/smithable-bench-m12-tGHm29/app-7/smithable.content.yml.

```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Registration
  Event registration system for conference talks, speakers and attendees.

Pages
  - Conference Registration (a landing page: hero, talks, speakers, contact and footer)
  - Talks (lists talks; search by title, summary or room)
  - Speakers (lists speakers; search by name or company)
  - Attendees (lists attendees; search by name, email or company)
  - Registrations (lists registrations; filter by talk or status)
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
  Only organizer users and admins can delete talks.
  Only organizer users and admins can add talks.

Speakers
  Speakers have:
  - a name (required)
  - a bio
  - a photo (picture)
  - an email (required)
  - a company
  Only organizer users and admins can delete speakers.
  Only organizer users and admins can add speakers.

Attendees
  Attendees have:
  - a name (required)
  - an email (required, unique)
  - a company
  - dietary restrictions
  Only organizer users and admins can delete attendees.
  Only organizer users and admins can add attendees.

Registrations
  Registrations have:
  - a talk (a talk, required)
  - an attendee (an attendee, required)
  - status (registered, attended or cancelled, registered by default)
  At most the talk's capacity registrations per talk.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - organizer (Manages conference talks, speakers, and registrations)
  New users get the organizer role.
  Open to anyone without signing in: the home page, the talks page, reading talks and reading speakers.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 99 files (99 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-tGHm29/app-8/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
attendees 8 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
registrations 7 columns 0 indexes 3 fks
session 8 columns 2 indexes 1 fks
speakers 9 columns 0 indexes 1 fks
talks 11 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_complex_kat_farrell.sql 🚀

Created /tmp/smithable-bench-m12-tGHm29/app-8. Start it with:

  cd /tmp/smithable-bench-m12-tGHm29/app-8
  smithable run
/tmp/smithable-bench-m12-tGHm29/app-8/smithable.yml:44:7  warning  Registration has a capacity per talk, but "talk" is not unique: one person can take several places.
    hint: Write "talk: Talk! unique" for one registration per person and talk (unique per owner with private access).
/tmp/smithable-bench-m12-tGHm29/app-8/smithable.auth.yml:12:16  warning  Anyone on the internet can read Speaker, including personal data in email.
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  A help desk for an IT team to manage support tickets, priorities and assignments.

Pages
  - Tickets (lists tickets; search by title or description; sort by priority, status or date added)
  - Team (who has access: invite people, change roles, remove users)

Tickets
  Tickets have:
  - a title (required)
  - a description
  - a priority (low, medium, high or critical, low by default)
  - status (open, in progress, resolved or closed, open by default)
  Each ticket can have an assignee (a user).
  Only admins can delete tickets.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - itSupport (Handles IT support tickets)
  New users get the itSupport role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 76 files (76 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-tGHm29/app-9/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
tickets 9 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_friendly_wither.sql 🚀

Created /tmp/smithable-bench-m12-tGHm29/app-9. Start it with:

  cd /tmp/smithable-bench-m12-tGHm29/app-9
  smithable run
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A private collection of family recipes with ingredients and shopping lists.

Pages
  - Recept (lists recept; search by namn, beskrivning, kategori or svårighetsgrad; filter by kategori or svårighetsgrad)
  - Inköpslistor (lists inköpslistor)

Recept
  Recept have:
  - a namn (required)
  - a beskrivning
  - a portioner (a whole number, 4 by default)
  - a förberedelsetid (min) (a whole number)
  - a tillagningstid (min) (a whole number)
  - an instruktioner (required)
  - a kategori (frukost, lunch, middag, efterrätt, mellanmål or dryck, frukost by default)
  - a svårighetsgrad (lätt, medel or svår, lätt by default)
  - a bild (a web address)
  Only admins can delete recept.

Ingredienser
  Ingredienser have:
  - a namn (required)
  - a mängd
  - an enhet
  - a recipe (a recept, required)

Inköpslistor
  Inköpslistor have:
  - a namn (required)
  - a recipe (a recept)
  - an artiklar (required)
  - status (pågående or avslutad, pågående by default)
  - a förfallodatum (a date)
  Only admins can delete inköpslistor.

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member (Family member who can view and add recipes)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 78 files (78 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-tGHm29/app-10/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
ingredients 8 columns 0 indexes 2 fks
recipes 13 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
shopping_lists 9 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_dazzling_eddie_brock.sql 🚀

Created /tmp/smithable-bench-m12-tGHm29/app-10. Start it with:

  cd /tmp/smithable-bench-m12-tGHm29/app-10
  smithable run
```

### 11. A status page for our API, with incidents and planned maintenance.

Failed:

```text
g in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Left out a picture the texts named but the app does not have.
/tmp/smithable-bench-m12-tGHm29/app-11/smithable.content.yml:4:10  error  "hero" of page "home" must be a mapping of keys to values.

1 error in /tmp/smithable-bench-m12-tGHm29/app-11/smithable.content.yml.

```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

Failed:

```text
 in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Left out a picture the texts named but the app does not have.
/tmp/smithable-bench-m12-tGHm29/app-12/smithable.content.yml:74:10  error  "hero" of page "home" must be a mapping of keys to values.

1 error in /tmp/smithable-bench-m12-tGHm29/app-12/smithable.content.yml.

```
