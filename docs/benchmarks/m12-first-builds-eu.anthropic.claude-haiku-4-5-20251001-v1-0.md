# M12 first builds: eu.anthropic.claude-haiku-4-5-20251001-v1:0 (2026-10-04)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 12 / 12 created, 12 type-check, 343,157 tokens (321,389 in, 21,768 out), $0.1784; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

Prompt caching: of the input of the 30 calls the model answered (the response cache's are not counted), 297,936 tokens were read from the cache (the fixed system text, at a tenth of the price), 0 written to it (a quarter more than the price) and 39,342 were new.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 18,307 | 2,593 | $0.0180 | 0 | 3 | 65 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 17,910 | 1,266 | $0.0103 | 0 | 3 | 40 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 54,519 | 3,467 | $0.0299 | 0 | 4 | 50 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 35,248 | 1,578 | $0.0147 | 0 | 3 | 39 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 17,437 | 820 | $0.0073 | 0 | 3 | 24 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 17,529 | 875 | $0.0077 | 0 | 3 | 26 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 17,435 | 1,849 | $0.0130 | 0 | 2 | 26 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 18,304 | 1,300 | $0.0109 | 0 | 3 | 25 s |
| A help desk for an IT team: tickets, priorities and who handles them. | records | yes | yes | 70,749 | 2,339 | $0.0251 | 0 | 6 | 31 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 17,434 | 1,250 | $0.0097 | 0 | 3 | 22 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 18,255 | 2,232 | $0.0160 | 0 | 2 | 28 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 18,262 | 2,199 | $0.0158 | 0 | 3 | 27 s |

Each created app's four spec files are in [m12-first-builds-eu.anthropic.claude-haiku-4-5-20251001-v1-0/](m12-first-builds-eu.anthropic.claude-haiku-4-5-20251001-v1-0/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 0 | 6 / 6 (has 6) | 10 / 10 (has 10) | 0 / 0 (has 0) | private; admin, member (member) | sessions: admin, class-types: admin, instructors: admin, messages: admin, posts: admin, admin: admin | pages home, schedule, blog; read ClassType, Instructor, Session, Post; create Message | 0 | none | 4 / 6 | mentions visitors; landing page |
| 2 | crm | 3 | 0 / 2 (has 4) | 1 / 3 (has 5) | 0 / 1 (has 0) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 3 | 4 / 4 (has 4) | 5 / 7 (has 5) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 1 / 4 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 0 / 2 | no mention; landing page |
| 5 | records (words: booking) | 3 | 0 / 1 (has 3) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 0 / 4 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages jobs; read JobPost; create none | 1 (public-personal-data) | none | 0 / 2 | no mention; no landing page |
| 7 | records | 3 | 0 / 1 (has 4) | 1 / 2 (has 6) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages home; read Team, Player, Match, Result; create none | 0 | none | 0 / 4 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 1 / 10 (has 4) | 0 / 0 (has 0) | private; admin, attendee (attendee) | talks: admin, speakers: admin, registrations: admin | pages home; read Speaker, Talk; create Registration | 1 (public-personal-data) | none | 0 / 3 | no mention; landing page |
| 9 | records (words: invoicing) | 3 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 2); left out: assign | shared; admin, technician, manager (technician) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 1 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, recipes; read Recipe, Ingredient; create none | 0 | none | 0 / 4 | no mention; landing page |
| 11 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page |
| 12 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Yoga Studio Booking
  Class schedule and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, gallery, faq, call to action, posts where status is published, contact and footer)
  - Schedule (lists sessions)
  - Sessions (lists sessions; only for admins)
  - Class types (lists class types; only for admins; visitors see class types on the Home page)
  - Instructors (lists instructors; only for admins)
  - Messages (lists messages; only for admins)
  - Blog (posts as articles, newest first, each on its own page)
  - Posts (lists posts; only for admins; visitors see posts on the Home page)
  - My bookings (lists bookings)
  - Admin (every kind of record, to find, open, change and delete; only for admins)

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
Generated 139 files (139 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-p8Injg/app-1/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_glossy_lethal_legion.sql 🚀

Created /tmp/smithable-bench-m12-p8Injg/app-1. Start it with:

  cd /tmp/smithable-bench-m12-p8Injg/app-1
  smithable run
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Sales CRM
  Lightweight CRM for a small B2B sales team.

Pages
  - Companies (lists companies; search by name or email)
  - Contacts (lists contacts; search by name or email)
  - Deals (lists deals; search by name or company; filter by status or company)
  - Followups (lists follow ups)
  - Team (who has access: invite people, change roles, remove users)

Companies
  Companies have:
  - a name (required)
  - an email (unique)
  - a phone
  - a segment (smb, enterprise or government, smb by default)
  - notes
  Each company can have an account manager (a user).

Contacts
  Contacts have:
  - a name (required)
  - an email
  - a phone
  - a title
  - a company (a company, required)
  - notes

Deals
  Deals have:
  - a name (required)
  - a company (a company, required)
  - a contact (a contact)
  - an amount (an amount, required)
  - status (prospect, qualified, proposal, negotiation, won or lost, prospect by default)
  - an expected close date
  - closed at (a date and time)
  - notes

Follow ups
  Follow ups have:
  - a type (call, email, meeting or task, call by default)
  - a company (a company, required)
  - a contact (a contact)
  - a deal (a deal)
  - a scheduled for (a date and time, required)
  - completed at (a date and time)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Sales management. Full access)
  - sales (Works with companies, contacts and deals)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 98 files (98 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-p8Injg/app-2/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
companies 10 columns 1 indexes 2 fks
contacts 10 columns 0 indexes 2 fks
deals 12 columns 0 indexes 3 fks
follow_ups 11 columns 0 indexes 4 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_panoramic_nick_fury.sql 🚀

Created /tmp/smithable-bench-m12-p8Injg/app-2. Start it with:

  cd /tmp/smithable-bench-m12-p8Injg/app-2
  smithable run
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Invoicing
  Simple invoicing for freelancers. Each user manages their own clients and invoices.

Pages
  - Home (a landing page: hero, features, pricing, faq, call to action and footer)
  - Clients (lists clients)
  - Invoice lines (lists invoice lines)
  - Invoices (lists invoices; “Mark sent”; “Mark paid”)
  - Overview (a dashboard: latest, outstanding, overdue, paid and invoiced)

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
  - admin (Invoicely staff)
  - member (A freelancer using Invoicely)
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 99 files (99 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-p8Injg/app-3/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_big_black_tom.sql 🚀

Created /tmp/smithable-bench-m12-p8Injg/app-3. Start it with:

  cd /tmp/smithable-bench-m12-p8Injg/app-3
  smithable run
```

### 4. A tool library where neighbors lend each other tools.

```text
Tool Library
  Borrow and lend tools with your neighbors.

Pages
  - Bookings (lists bookings)
  - Home (a landing page: hero, tools and footer)
  - Tools (lists tools; search by name or description; filter by category, condition or available; sort by date added)
  - My tools (lists tools; only the viewer's own records)

Bookings
  Bookings have:
  - borrowed at (a date, required)
  - returned at (a date)
  - status (active or returned, active by default)
  - a tool (a tool, required)
  Each booking can have a borrower (a user).

Tools
  Tools have:
  - a name (required)
  - a description (required)
  - a category (hand tools, power tools, garden, outdoor or other, hand tools by default)
  - a condition (like new, good or worn, like new by default)
  - an available (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the library tidy)
  - member (Borrows and lends tools)
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 90 files (90 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-p8Injg/app-4/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 9 columns 0 indexes 3 fks
session 8 columns 2 indexes 1 fks
tools 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_cool_human_robot.sql 🚀

Created /tmp/smithable-bench-m12-p8Injg/app-4. Start it with:

  cd /tmp/smithable-bench-m12-p8Injg/app-4
  smithable run
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  Manage ingredients, suppliers and stock levels for a small bakery.

Pages
  - Ingredients (lists ingredients; search by name or description)
  - Suppliers (lists suppliers; search by name or contact)
  - Stock (lists stock levels; search by ingredient; filter by ingredient or recorded at)

Ingredients
  Ingredients have:
  - a name (required)
  - a description
  - a category (flour, sugar, dairy, leavening, flavorings or other, flour by default)
  - a unit (kg, g, l, ml or pieces, kg by default)
  - a minimum stock (a number, required)
  - a current stock (a number, required, 0 by default)
  - a supplier (a supplier, required)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact (an email address)
  - a phone
  - address
  - delivery days (a whole number)

Stock levels
  Stock levels have:
  - an ingredient (an ingredient, required)
  - a quantity (a number, required)
  - recorded at (a date and time, required, now by default)
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
Reading config file '/tmp/smithable-bench-m12-p8Injg/app-5/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
ingredients 11 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
stock_levels 8 columns 0 indexes 2 fks
suppliers 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_bent_wendell_vaughn.sql 🚀

Created /tmp/smithable-bench-m12-p8Injg/app-5. Start it with:

  cd /tmp/smithable-bench-m12-p8Injg/app-5
  smithable run
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  A job board for local union members to post and apply for jobs.

Pages
  - Jobs (lists job posts; search by title, description or location)
  - My posts (lists job posts; only the viewer's own records)
  - Applications (lists applications)
  - Team (who has access: invite people, change roles, remove users)

Job posts
  Job posts have:
  - a title (required)
  - a description (required)
  - a category
  - a location
  - a salary (an amount)
  - status (open or closed, open by default)
  Each job post can have a posted by (a user).
  Each job post lists its applications.

Applications
  Applications have:
  - a job post (a job post, required)
  - a resume
  - a cover letter
  - status (submitted, reviewed, accepted or rejected, submitted by default)
  - applied at (a date and time, required)
  Each application can have an applicant (a user).

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Manages the job board)
  - member (Posts jobs and applies for positions)
  New users get the member role.
  Open to anyone without signing in: the jobs page and reading job posts.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 90 files (90 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-p8Injg/app-6/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
applications 10 columns 0 indexes 3 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
job_posts 11 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_wise_gladiator.sql 🚀

Created /tmp/smithable-bench-m12-p8Injg/app-6. Start it with:

  cd /tmp/smithable-bench-m12-p8Injg/app-6
  smithable run
/tmp/smithable-bench-m12-p8Injg/app-6/smithable.auth.yml:15:10  warning  Anyone on the internet can read JobPost, including personal data in postedBy.
```

### 7. A football club's site: teams, players, matches and results.

```text
Football Club
  Manage teams, players, matches and results for the football club.

Pages
  - Home (a landing page: hero, teams, matches and footer)
  - Teams (lists teams; search by name or city)
  - Players (lists players; search by name or nationality; filter by position or team)
  - Matches (lists matches; search by venue; filter by status, home team or away team)
  - Results (lists results)
  - Team (who has access: invite people, change roles, remove users)

Teams
  Teams have:
  - a name (required)
  - a city
  - a founded (a whole number)
  - a coach
  Only admins can add teams.
  Only admins can change teams.
  Only admins can delete teams.

Players
  Players have:
  - a name (required)
  - a number (a whole number)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a team (a team, required)
  - a date of birth
  - a nationality
  Only admins can add players.
  Only admins can change players.
  Only admins can delete players.

Matches
  Matches have:
  - a home team (a team, required)
  - an away team (a team, required)
  - a date (required)
  - a time
  - a venue
  - a home score (a whole number)
  - an away score (a whole number)
  - status (scheduled, played or cancelled, scheduled by default)
  Only admins can add matches.
  Only admins can change matches.
  Only admins can delete matches.

Results
  Results have:
  - a match (a match, required)
  - home team goals (a whole number, required)
  - away team goals (a whole number, required)
  - a date (required, today by default)
  - notes
  Only admins can add results.
  Only admins can change results.
  Only admins can delete results.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages teams, players, matches and results)
  - member (Views teams, players, matches and results)
  New users get the member role.
  Open to anyone without signing in: the home page, reading teams, reading players, reading matches and reading results.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 100 files (100 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-p8Injg/app-7/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
matches 12 columns 0 indexes 3 fks
players 10 columns 0 indexes 2 fks
results 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_smiling_magik.sql 🚀

Created /tmp/smithable-bench-m12-p8Injg/app-7. Start it with:

  cd /tmp/smithable-bench-m12-p8Injg/app-7
  smithable run
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Registration
  Event registration for a conference: talks, speakers and attendees.

Pages
  - Home (a landing page: hero, speakers, talks, faq and footer)
  - Talks (lists talks; only for admins; visitors see talks on the Home page)
  - Speakers (lists speakers; only for admins; visitors see speakers on the Home page)
  - Registrations (lists registrations; only for admins)

Speakers
  Speakers have:
  - a name (required)
  - a bio
  - an email (required)
  Only admins can add speakers.

Talks
  Talks have:
  - a title (required)
  - a description
  - a speaker (a speaker, required)
  - starts at (a date and time, required)
  - duration minutes (a whole number, required, 60 by default)
  - a capacity (a whole number, required, 100 by default)
  Each talk lists its registrations.
  The spots left is calculated as the capacity minus the number of its registrations.
  Only admins can add talks.

Registrations
  Registrations have:
  - a talk (a talk, required, unique)
  - an attendee name (required)
  - an attendee email (required)
  At most the talk's capacity registrations per talk.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Conference organizer. Manage talks, speakers and registrations)
  - attendee (Conference attendee who registers for talks)
  New users get the attendee role.
  Open to anyone without signing in: the home page, reading speakers, reading talks and adding registrations.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 90 files (90 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-p8Injg/app-8/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
registrations 7 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
speakers 7 columns 0 indexes 1 fks
talks 11 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_secret_guardsmen.sql 🚀

Created /tmp/smithable-bench-m12-p8Injg/app-8. Start it with:

  cd /tmp/smithable-bench-m12-p8Injg/app-8
  smithable run
/tmp/smithable-bench-m12-p8Injg/app-8/smithable.auth.yml:7:10  warning  Anyone on the internet can read Speaker, including personal data in email.
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
Left out, since it could not be made valid:
  addAction assign: addAction would make smithable.yml invalid. "set" of action "assign": Ticket.assignee cannot be set, it is a reference.

Help Desk
  An IT team's help desk for managing support tickets, priorities and assignments.

Pages
  - Team (who has access: invite people, change roles, remove users)
  - Tickets (lists tickets; search by title or description; filter by priority or status; sort by priority, status or date added; “Resolve”; “Close”)

Tickets
  Tickets have:
  - a title (required)
  - a description
  - a priority (low, normal or high, low by default)
  - status (open, in progress, resolved or closed, open by default)
  - resolved at (a date and time)
  Each ticket can have an assignee (a user).

Resolve
  For a ticket that is in progress; sets status to resolved and resolved at to now.

Close
  For a ticket that is resolved; sets status to closed.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - technician (Handles support tickets and resolves issues)
  - manager (Oversees tickets and team performance)
  New users get the technician role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 87 files (87 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-p8Injg/app-9/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
tickets 10 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_noisy_shadowcat.sql 🚀

Created /tmp/smithable-bench-m12-p8Injg/app-9. Start it with:

  cd /tmp/smithable-bench-m12-p8Injg/app-9
  smithable run
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipe Collection
  A place to keep and organize family recipes with ingredients and shopping lists.

Pages
  - Home (a landing page: hero, recipes and footer)
  - Recipes (lists recipes; search by name or description; filter by difficulty)
  - Shopping lists (lists shopping lists)

Recipes
  Recipes have:
  - a name (required)
  - a description
  - servings (a whole number, 4 by default)
  - a prep time (a whole number)
  - a cook time (a whole number)
  - a difficulty (easy, medium or hard, easy by default)
  - added on (a date, required, today by default)
  Only admins can add recipes.
  Only admins can change recipes.
  Only admins can delete recipes.

Ingredients
  Ingredients have:
  - a name (required)
  - a quantity (a number, required)
  - a unit (required)
  - a recipe (a recipe, required)

Shopping lists
  Shopping lists have:
  - a name (required)
  - created on (a date, required, today by default)
  - a completed (yes or no, false by default)
  Only admins can add shopping lists.
  Only admins can change shopping lists.
  Only admins can delete shopping lists.

Shopping items
  Shopping items have:
  - a name (required)
  - a quantity (a number, required)
  - a unit (required)
  - a checked (yes or no, false by default)
  - a shopping list (a shopping list, required)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Manages recipes and shopping lists)
  - member (Views recipes and shopping lists)
  New users get the member role.
  Open to anyone without signing in: the home page, the recipes page, reading recipes and reading ingredients.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 91 files (91 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-p8Injg/app-10/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
ingredients 8 columns 0 indexes 2 fks
recipes 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
shopping_items 9 columns 0 indexes 2 fks
shopping_lists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_thankful_trish_tilby.sql 🚀

Created /tmp/smithable-bench-m12-p8Injg/app-10. Start it with:

  cd /tmp/smithable-bench-m12-p8Injg/app-10
  smithable run
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status Page
  Is it working? The state of our services, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Team (who has access: invite people, change roles, remove users)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Overview (a dashboard: open, per month and latest)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description

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
  Other programs can read and change components and incidents with a key, and run resolve.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 117 files (117 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-p8Injg/app-11/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_bored_misty_knight.sql 🚀

Created /tmp/smithable-bench-m12-p8Injg/app-11. Start it with:

  cd /tmp/smithable-bench-m12-p8Injg/app-11
  smithable run
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Web Shop Status
  Is it working? The state of our services, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Team (who has access: invite people, change roles, remove users)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Maintenance (lists maintenances)
  - Overview (a dashboard: open, per month and latest)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description

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
  Other programs can read and change components and incidents with a key, and run resolve.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 117 files (117 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-p8Injg/app-12/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_jittery_mephisto.sql 🚀

Created /tmp/smithable-bench-m12-p8Injg/app-12. Start it with:

  cd /tmp/smithable-bench-m12-p8Injg/app-12
  smithable run
```
