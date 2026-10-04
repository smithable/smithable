# M12 first builds: mistral-medium-latest (2026-10-04)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 11 / 12 created, 11 type-check, 177,570 tokens, €0.1002.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 10,569 | €0.0067 | 56 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 9,766 | €0.0057 | 40 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 10,039 | €0.0062 | 41 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 8,866 | €0.0044 | 34 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 8,850 | €0.0045 | 30 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 9,539 | €0.0058 | 38 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 9,636 | €0.0061 | 31 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 28,282 | €0.0136 | 35 s |
| A help desk for an IT team: tickets, priorities and who handles them. | records | yes | yes | 9,045 | €0.0049 | 26 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 9,617 | €0.0061 | 31 s |
| A status page for our API, with incidents and planned maintenance. | status | **no** | **no** | 39,327 | €0.0198 | 27 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 24,034 | €0.0164 | 44 s |

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
8. After #204 (#205).
9. After #206 (#207): 12 of 12.
10. This one: after #211 (booking through capacity, not an action), #212 (a warning for a unique capacity reference on shared records) and #213 (a record's form shows it as an action left it).

- **Better: booking.** 1, the yoga studio, and 8, the conference, book through a capacity, and nothing is left out (1 left out `book` in the ninth run).
- **New warning, a real case.** 8 gets `capacity-unique-shared`. Its default access is private, but Registration lets every attendee read every registration. Its `talk: Talk! unique` then allows one registration per talk in all. The app is created with the warning; reported to session A, with the suggestion that a draft treat it as a refusal.
- **Worse: 11, the API status page, fails.** `setPublic` names the starter's history page, which this draft never added. Reported.
- **Status keeps 3 of 3 actions in 12; invoicing keeps 2 of 2.**

## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 0 | 6 / 6 (has 6) | 10 / 10 (has 11) | 0 / 0 (has 0) | private; admin, member (member) | class-types: admin, instructors: admin, sessions: admin, posts: admin, messages: admin, admin: admin, team: admin | pages home, schedule, blog; read ClassType, Instructor, Session; create Message | 1 (no-timezone) | none | 4 / 6 | mentions visitors; landing page |
| 2 | crm | 0 | 0 / 2 (has 4) | 1 / 3 (has 5) | 0 / 1 (has 0) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 0 | 4 / 4 (has 4) | 3 / 7 (has 3) | 2 / 2 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 4 | no mention; no landing page |
| 4 | marketplace (words: records) | 0 | 0 / 1 (has 1) | 1 / 4 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, tools; read Tool; create none | 0 | none | 0 / 1 | no mention; landing page |
| 5 | records (words: booking) | 2 | 0 / 1 (has 3) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page |
| 6 | marketplace | 2 | 0 / 1 (has 2) | 1 / 4 (has 3) | 0 / 0 (has 5) | private; admin, member (member) | applications: admin | pages home, jobs; read JobPost; create Application | 0 | none | 0 / 2 | no mention; landing page |
| 7 | records | 0 | 0 / 1 (has 3) | 1 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, teams, players, matches; read Team, Player, Match; create none | 0 | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 2 | 0 / 6 (has 4) | 1 / 10 (has 5) | 0 / 0 (has 0) | private; admin, attendee (attendee) | talks: admin, speakers: admin, attendees: admin, registrations: admin/attendee | pages home, talks; read Talk, Speaker; create none | 2 (capacity-unique-shared, public-personal-data) | none | 0 / 4 | no mention; landing page |
| 9 | records (words: invoicing) | 2 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 4) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page |
| 10 | records | 0 | 0 / 1 (has 4) | 1 / 2 (has 3) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, recipes; read Recipe; create none | 0 | none | 0 / 4 | no mention; landing page |
| 12 | status | 0 | 4 / 4 (has 4) | 8 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | incidents: admin/staff, updates: admin/staff, components: admin, maintenance: admin/staff, overview: admin/staff, team: admin | pages home, history; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names actions the draft dropped because they could not be made valid. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Yoga Studio Booking
  Class schedule and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, estimate, gallery, faq, posts, contact and footer)
  - Class types (lists class types; only for admins; visitors see class types on the Home page)
  - Instructors (lists instructors; only for admins)
  - Sessions (lists sessions; only for admins)
  - My bookings (lists bookings)
  - Posts (lists posts; only for admins)
  - Messages (lists messages; only for admins)
  - Schedule (a calendar of sessions by week or month)
  - Blog (posts as articles, newest first, each on its own page)
  - Admin (every kind of record, to find, open, change and delete; only for admins)
  - Team (who has access: invite people, change roles, remove users; only for admins)

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
  Open to anyone without signing in: the home page, the schedule page, the blog page, reading class types, reading instructors, reading sessions and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 137 files (137 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-PZmp2q/app-1/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
bookings 5 columns 1 indexes 2 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
messages 7 columns 0 indexes 1 fks
posts 11 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_boring_cloak.sql 🚀

Created /tmp/smithable-bench-m12-PZmp2q/app-1. Start it with:

  cd /tmp/smithable-bench-m12-PZmp2q/app-1
  smithable run
/tmp/smithable-bench-m12-PZmp2q/app-1/smithable.yml:96:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Sales CRM
  A lightweight CRM for a small sales team to manage companies, contacts, deals, and follow-ups.

Pages
  - Companies (lists companies; search by name or email)
  - Contacts (lists contacts; search by first name, last name or email)
  - Deals (lists deals; search by name or company; filter by stage, company or contact; sort by value, close date or stage)
  - Follow ups (lists follow ups; search by title, company or contact; filter by status, due date, company, contact or deal; sort by due date or status)
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
  - a value (an amount, required)
  - a stage (lead, qualified, proposal, negotiation, closed won or closed lost, lead by default)
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

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Sales management. Full access)
  - sales (Works with companies, contacts, deals, and follow-ups)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 93 files (93 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-PZmp2q/app-2/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_smart_mandroid.sql 🚀

Created /tmp/smithable-bench-m12-PZmp2q/app-2. Start it with:

  cd /tmp/smithable-bench-m12-PZmp2q/app-2
  smithable run
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Freelance Invoicing
  Invoicing for freelancers, with clients, invoices and payments.

Pages
  - Clients (lists clients; search by name, email or VAT number; sort by name)
  - Invoices (lists invoices; search by number or client; filter by client, status, issued on or due on; “Mark sent”; “Mark paid”)
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
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 91 files (91 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-PZmp2q/app-3/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_hesitant_magus.sql 🚀

Created /tmp/smithable-bench-m12-PZmp2q/app-3. Start it with:

  cd /tmp/smithable-bench-m12-PZmp2q/app-3
  smithable run
```

### 4. A tool library where neighbors lend each other tools.

```text
Tool Library
  A tool library where neighbors lend each other tools.

Pages
  - Tools (lists tools; search by name or description; filter by category, condition or available; sort by name or date added; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Home (a landing page: hero and footer)

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
  - admin (Keeps the tool library organized)
  - member (Lends and borrows tools)
  New users get the member role.
  Open to anyone without signing in: the home page, the tools page and reading tools.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 79 files (79 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-PZmp2q/app-4/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
tools 9 columns 0 indexes 1 fks
tools_favorites 4 columns 1 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_silly_mad_thinker.sql 🚀

Created /tmp/smithable-bench-m12-PZmp2q/app-4. Start it with:

  cd /tmp/smithable-bench-m12-PZmp2q/app-4
  smithable run
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  Track ingredients, suppliers, and stock levels for a small bakery.

Pages
  - Ingredients (lists ingredients; search by name, description or category)
  - Suppliers (lists suppliers; search by name, contact person or email)
  - Stock updates (lists stock updates; filter by ingredient, type, date or supplier)

Ingredients
  Ingredients have:
  - a name (required)
  - a description
  - a category (dry, wet or frozen, dry by default)
  - a unit (required, grams by default)
  - a min stock level (a whole number, 10 by default)
  - a current stock (a whole number, 0 by default)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact person
  - an email
  - a phone
  - address

Stock updates
  Stock updates have:
  - an ingredient (an ingredient, required)
  - a date (required, today by default)
  - a quantity (a whole number, required)
  - a type (in or out, in by default)
  - a supplier (a supplier)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 84 files (84 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-PZmp2q/app-5/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
ingredients 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stock_updates 10 columns 0 indexes 3 fks
suppliers 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_greedy_agent_zero.sql 🚀

Created /tmp/smithable-bench-m12-PZmp2q/app-5. Start it with:

  cd /tmp/smithable-bench-m12-PZmp2q/app-5
  smithable run
```

### 6. A job board for a local union, with job posts and applications.

```text
Local Union Job Board
  A job board for a local union to post jobs and receive applications.

Pages
  - Home (a landing page: hero and footer)
  - Jobs (lists job posts; search by title, description, company or location; filter by type, status or salary; sort by posted at or salary; “Close job”)
  - Applications (lists applications; “Review application”; “Interview application”; “Hire application”; “Reject application”; only for admins)

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
  - a resume
  - a cover letter
  - status (submitted, reviewed, interviewed, hired or rejected, submitted by default)
  - applied at (a date and time, now by default)

Close job
  For a job post that is open; sets status to closed.
  Close a job post when it is no longer accepting applications.

Review application
  For an application that is submitted; sets status to reviewed.
  Mark an application as reviewed.

Interview application
  For an application that is reviewed; sets status to interviewed.
  Mark an application for interview.

Hire application
  For an application that is interviewed; sets status to hired.
  Mark an application as hired.

Reject application
  For an application that is submitted, reviewed or interviewed; sets status to rejected.
  Reject an application.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page, reading job posts where status is open and adding applications.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 92 files (92 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-PZmp2q/app-6/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
applications 12 columns 0 indexes 2 fks
job_posts 12 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_dazzling_ink.sql 🚀

Created /tmp/smithable-bench-m12-PZmp2q/app-6. Start it with:

  cd /tmp/smithable-bench-m12-PZmp2q/app-6
  smithable run
```

### 7. A football club's site: teams, players, matches and results.

```text
Football Club
  A football club's site with teams, players, matches and results.

Pages
  - Welcome to Football Club (a landing page: hero, teams, matches where status is scheduled or in progress and footer)
  - Teams (lists teams; search by name or description)
  - Players (lists players; search by name, position or bio)
  - Matches (lists matches; filter by status, home team or away team)

Teams
  Teams have:
  - a name (required)
  - a description
  - a founded (a whole number)
  - a logo (a web address)

Players
  Players have:
  - a name (required)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a team (a team, required)
  - a number (a whole number)
  - a birth date
  - a bio

Matches
  Matches have:
  - a home team (a team, required)
  - an away team (a team, required)
  - a date (a date and time, required)
  - a location
  - status (scheduled, in progress, completed or canceled, scheduled by default)
  - a home score (a whole number, 0 by default)
  - an away score (a whole number, 0 by default)

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
Reading config file '/tmp/smithable-bench-m12-PZmp2q/app-7/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
matches 11 columns 0 indexes 3 fks
players 10 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_chubby_anthem.sql 🚀

Created /tmp/smithable-bench-m12-PZmp2q/app-7. Start it with:

  cd /tmp/smithable-bench-m12-PZmp2q/app-7
  smithable run
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Registration
  Event registration system for conference talks, speakers and attendees.

Pages
  - Home (a landing page: hero, talks, speakers, contact and footer)
  - Talks (lists talks; only for admins; visitors see talks on the Home page)
  - Speakers (lists speakers; only for admins; visitors see speakers on the Home page)
  - Attendees (lists attendees; only for admins)
  - Registrations (lists registrations; only for attendee users and admins)

Talks
  Talks have:
  - a title (required)
  - a description
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a room
  - a capacity (a whole number, required, 50 by default)
  - a speaker (a speaker, required)
  Each talk lists its registrations.
  Only admins can see talks.
  Only admins can add talks.
  Only admins can change talks.
  Only admins can delete talks.

Speakers
  Speakers have:
  - a name (required)
  - a bio
  - an email (required)
  - a photo (picture)
  Only admins can see speakers.
  Only admins can add speakers.
  Only admins can change speakers.
  Only admins can delete speakers.

Attendees
  Attendees have:
  - a name (required)
  - an email (required, unique)
  - a company
  - a phone
  Only attendee users, the owner and admins can see attendees.
  Only attendee users and admins can add attendees.
  Only attendee users, the owner and admins can change attendees.
  Only the owner and admins can delete attendees.

Registrations
  Registrations have:
  - a talk (a talk, required, unique)
  - an attendee (an attendee, required)
  - registered at (a date and time, required, now by default)
  Only attendee users, the owner and admins can see registrations.
  Only attendee users and admins can add registrations.
  Only the owner and admins can delete registrations.
  At most the talk's capacity registrations per talk.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Conference organizer. Manages talks, speakers and registrations)
  - attendee (A conference participant who registers for talks)
  New users get the attendee role.
  Open to anyone without signing in: the home page, the talks page, reading talks and reading speakers.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 96 files (96 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-PZmp2q/app-8/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
attendees 8 columns 1 indexes 1 fks
registrations 7 columns 1 indexes 3 fks
session 8 columns 2 indexes 1 fks
speakers 8 columns 0 indexes 1 fks
talks 11 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_natural_meggan.sql 🚀

Created /tmp/smithable-bench-m12-PZmp2q/app-8. Start it with:

  cd /tmp/smithable-bench-m12-PZmp2q/app-8
  smithable run
/tmp/smithable-bench-m12-PZmp2q/app-8/smithable.auth.yml:4:16  warning  Registration.talk is unique, and Registration records are not private to their owners, so that means one registration per talk in all: the capacity of talk.capacity is never reached. "unique" is one per person only when each person reads just their own records.
    hint: Remove "unique" from talk, or make the model's records private.
/tmp/smithable-bench-m12-PZmp2q/app-8/smithable.auth.yml:7:16  warning  Anyone on the internet can read Speaker, including personal data in email.
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  A help desk for an IT team to manage tickets, priorities and assignments.

Pages
  - Tickets (lists tickets; search by title or description; “Start work”; “Resolve”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users)

Tickets
  Tickets have:
  - a title (required)
  - a description
  - a priority (low, medium, high or critical, low by default)
  - status (open, in progress, resolved or closed, open by default)
  Each ticket can have an assigned to (a user).
  Only admins can delete tickets.

Start work
  For a ticket that is open; sets status to in progress and assigned to to whoever presses it.
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
  - agent (Handles tickets)
  New users get the agent role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 84 files (84 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-PZmp2q/app-9/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
tickets 9 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_volatile_roulette.sql 🚀

Created /tmp/smithable-bench-m12-PZmp2q/app-9. Start it with:

  cd /tmp/smithable-bench-m12-PZmp2q/app-9
  smithable run
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A place to keep and share family recipes with ingredients and shopping lists.

Pages
  - Home (a landing page: hero, recipes where category is breakfast or lunch or dinner or dessert and footer)
  - Recipes (lists recipes; search by name, description or category; filter by category or difficulty; sort by name, servings, prep time or cook time)
  - Shopping lists (lists shopping lists; search by name; filter by status or date; “Mark completed”; “Mark in progress”)

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
  Only member users and admins can change recipes.

Ingredients
  Ingredients have:
  - a name (required)
  - a quantity
  - a unit
  - a recipe (a recipe, required)
  Only the owner and admins can delete ingredients.
  Only the owner and admins can change ingredients.

Shopping lists
  Shopping lists have:
  - a name (required)
  - a date (required, today by default)
  - status (planned, in progress or completed, planned by default)
  Each shopping list lists its shopping items.
  Only the owner and admins can delete shopping lists.
  Only the owner and admins can change shopping lists.

Shopping items
  Shopping items have:
  - a name (required)
  - a quantity
  - a unit
  - a bought (yes or no, false by default)
  - a shopping list (a shopping list, required)
  Only the owner and admins can delete shopping items.
  Only the owner and admins can change shopping items.

Mark completed
  For a shopping list that is planned or in progress; sets status to completed.

Mark in progress
  For a shopping list that is planned; sets status to in progress.

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
Reading config file '/tmp/smithable-bench-m12-PZmp2q/app-10/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
ingredients 8 columns 0 indexes 2 fks
recipes 13 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
shopping_items 9 columns 0 indexes 2 fks
shopping_lists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_lethal_earthquake.sql 🚀

Created /tmp/smithable-bench-m12-PZmp2q/app-10. Start it with:

  cd /tmp/smithable-bench-m12-PZmp2q/app-10
  smithable run
```

### 11. A status page for our API, with incidents and planned maintenance.

Failed:

```text
Starting from the status starter.
Smithable model (mistral-medium-latest) · 39,327 tokens · €0.0198
No model drafted a valid project.
setPublic: setPublic would make smithable.auth.yml invalid. There is no page named "history" in smithable.yml. Nobody receives mail at ops@your-domain.example, so nobody can sign in as this administrator. Replace it with a real address (smithable op setAdmins you@your-domain).
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-PZmp2q/app-11 --starter status

```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Uptime
  A public uptime page for a web shop: which services work, outages and their updates.

Pages
  - Shop Uptime (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incident History (lists incidents)
  - Incidents (lists incidents; search by title; filter by status or component; only for staff users and admins; visitors see incidents on the Shop Uptime page)
  - Updates (lists updates; only for staff users and admins)
  - Components (lists components; only for admins; visitors see components on the Shop Uptime page)
  - Maintenance (lists maintenances; only for staff users and admins; visitors see maintenances on the Shop Uptime page)
  - Overview (lists incidents; only for staff users and admins; visitors see incidents on the Shop Uptime page)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each component lists its incidents.
  Only admins can add components.
  Only admins can change components.
  Only admins can delete components.

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a component)
  - detected at (a date and time, required)
  - resolved at (a date and time)
  - a summary (formatted text)
  Each incident lists its updates.
  Only staff users and admins can add incidents.
  Only staff users and admins can change incidents.
  Only staff users and admins can delete incidents.

Updates
  Updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)
  Only staff users and admins can add updates.
  Only staff users and admins can change updates.
  Only staff users and admins can delete updates.

Maintenances
  Maintenances have:
  - a title (required)
  - a component (a component)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description
  Only staff users and admins can add maintenances.
  Only staff users and admins can change maintenances.
  Only staff users and admins can delete maintenances.

Identified
  For an incident that is investigating; sets status to identified; adds an update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.
  Only staff users and admins can use it.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.
  Only staff users and admins can use it.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an update (at now, status resolved, message This incident is resolved.).
  The incident is over, with an update saying so.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the uptime page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, the history page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 108 files (108 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-PZmp2q/app-12/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_careless_spot.sql 🚀

Created /tmp/smithable-bench-m12-PZmp2q/app-12. Start it with:

  cd /tmp/smithable-bench-m12-PZmp2q/app-12
  smithable run
```
