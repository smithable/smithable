# M12 first builds: mistral-medium-latest (2026-10-03)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 12 / 12 created, 11 type-check, 154,447 tokens, €0.1041.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | **no** | 25,508 | €0.0200 | 45 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 9,111 | €0.0057 | 19 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 20,015 | €0.0131 | 28 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 23,818 | €0.0114 | 22 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 7,892 | €0.0039 | 13 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 9,063 | €0.0062 | 19 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 9,631 | €0.0074 | 21 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 9,417 | €0.0058 | 20 s |
| A help desk for an IT team: tickets, priorities and who handles them. | records | yes | yes | 8,266 | €0.0047 | 16 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 8,800 | €0.0058 | 19 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 11,847 | €0.0108 | 28 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 11,079 | €0.0093 | 25 s |

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest/](m12-first-builds-mistral-medium-latest/), one folder per description (app-1 …).

<!-- scorecard -->
## Against the earlier runs

The runs so far:
1. From main before #169 and #174.
2. After them (#176).
3. After #180, A's fixes (#181): 12 of 12 created and type-checking.
4. This one: after #184 (the English hint, `setProviders`), #187 (invoicing's mark sent and mark paid, admins before the domain check), #188 (a starter's sample domains removed) and #190 (the status starter's actions made standard).

- **Worse: the status drafts drop their actions.** 11 and 12 keep 0 of the starter's 3 actions (identified, monitoring, resolve); in the third run they kept 3 of 3, then as custom code. Neither draft has an `actions:` block or an action button, and both specs validate cleanly. Reported to session A.
- **Better: invoicing keeps its new actions.** 3, the freelancer invoicing, keeps mark sent and mark paid (2 of 2).
- **Worse: one draft does not type-check.** In 1, the yoga studio, a calculator page's formulas file imports `F` and never uses it (TS6133). This is a generator bug, reported to session A.
- **English stays English.** 7, the football club, has English titles (Football Club, Teams, Players).
- **Personal data.** One draft publishes it, 6, the job board (public-personal-data). In the third run it was 8, the conference.

## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 0 | 6 / 6 | 10 / 10 | 0 / 0 | private; admin, member (member) | class-types: admin, instructors: admin, posts: admin, messages: admin, admin: admin, team: admin, sessions: admin, my-bookings: member/admin, schedule: member/admin | pages home, schedule, blog; read ClassType, Instructor, Session; create Message | 3 (capacity-no-unique, calculator-no-result, no-timezone) | none | 4 / 6 | mentions visitors; landing page |
| 2 | crm | 0 | 0 / 2 | 1 / 3 | 0 / 1 | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 0 | 4 / 4 | 6 / 7 | 2 / 2 | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 2 | 0 / 1 | 1 / 4 | 0 / 0 | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 0 / 1 | no mention; landing page |
| 5 | records (words: booking) | 2 | 0 / 1 | 0 / 2 | 0 / 0 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page |
| 6 | marketplace | 2 | 0 / 1 | 1 / 4 | 0 / 0 | private; admin, member (member) | none | pages home, jobs; read JobPost; create none | 1 (public-personal-data) | none | 0 / 2 | no mention; landing page |
| 7 | records | 0 | 0 / 1 | 1 / 2 | 0 / 0 | private; admin, member (member) | none | pages home, teams, players, matches; read Team, Player, Match; create none | 0 | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 2 | 0 / 6 | 0 / 10 | 0 / 0 | shared; admin, organizer, attendee (attendee) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page |
| 9 | records (words: invoicing) | 2 | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, itSupport (itSupport) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page |
| 10 | records | 2 | 0 / 1 | 1 / 2 | 0 / 0 | private; admin, member (member) | none | pages home, recipes; read Recipe; create none | 0 | none | 0 / 4 | no mention; landing page |
| 11 | status | 0 | 4 / 4 | 8 / 8 | 0 / 3 | shared; admin, staff (staff) | components: admin, team: admin | pages home, history; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page |
| 12 | status | 0 | 4 / 4 | 8 / 8 | 0 / 3 | shared; admin, staff (staff) | components: admin | pages home, history; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Yoga Studio Booking
  Class schedule and online booking for a yoga studio.

Pages
  - Yoga Studio (a landing page: hero, class types, gallery, faq, posts, contact and footer)
  - Class Types (lists class types; only for admins; visitors see class types on the Yoga Studio page)
  - Instructors (lists instructors; only for admins)
  - Posts (lists posts; only for admins)
  - Messages (lists messages; only for admins)
  - Membership Calculator (a calculator: classes per month, drop in, pass, without pass and saved give )
  - Blog (posts as articles, newest first, each on its own page)
  - Admin (every kind of record, to find, open, change and delete; only for admins)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Sessions (lists class sessions; search by class type or instructor; filter by class type, instructor or start time; records can be saved as favorites; only for admins)
  - My Bookings (lists bookings; only the viewer's own records; “Cancel booking”; only for member users and admins)
  - Class Schedule (a calendar of sessions by week or month; only for member users and admins)

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
  - a biography (formatted text)
  - a portrait (picture)
  Only admins can add instructors.

Posts
  Posts have:
  - a title (required)
  - address (unique)
  - a summary
  - a cover image (picture)
  - a content (formatted text, required)
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

Class Sessions
  Class Sessions have:
  - a class type (a class type, required)
  - an instructor (an instructor, required)
  - a start time (a date and time, required)
  - a capacity (a whole number, required, 12 by default)
  Each class session lists its bookings.
  Only admins can add class sessions.
  Only admins can change class sessions.
  Only admins can delete class sessions.

Bookings
  Bookings have:
  - a class session (a class session, required)
  - status (booked, attended or canceled, booked by default)
  Only member users and admins can add bookings.
  Only member users, the owner and admins can change bookings.
  Only member users, the owner and admins can delete bookings.
  At most the session's capacity bookings per session.

Cancel booking
  For a booking that is booked; sets status to canceled.
  Cancel this booking.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studio staff. Manage the schedule, classes and teachers)
  - member (A student who books classes)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the blog page, reading class types, reading instructors, reading sessions and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 142 files (142 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-S2OV8n/app-1/drizzle.config.ts'
12 tables
account 13 columns 1 indexes 1 fks
bookings 6 columns 0 indexes 2 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
messages 7 columns 0 indexes 1 fks
posts 11 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 8 columns 0 indexes 3 fks
sessions_favorites 4 columns 1 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_cloudy_silver_sable.sql 🚀

Created /tmp/smithable-bench-m12-S2OV8n/app-1. Start it with:

  cd /tmp/smithable-bench-m12-S2OV8n/app-1
  smithable run
/tmp/smithable-bench-m12-S2OV8n/app-1/smithable.yml:59:7  warning  Booking has a capacity per session, but "session" is not unique: one person can take several places.
    hint: Write "session: Session! unique" for one booking per person and session (unique per owner with private access).
/tmp/smithable-bench-m12-S2OV8n/app-1/smithable.yml:93:7  warning  Page "estimate" has no formula field, so it calculates nothing.
/tmp/smithable-bench-m12-S2OV8n/app-1/smithable.yml:120:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Sales CRM
  A lightweight CRM for a small sales team to manage companies, contacts, deals, and follow-ups.

Pages
  - Companies (lists companies; search by name or industry)
  - Contacts (lists contacts; search by first name, last name or email)
  - Deals (lists deals; search by name, company or stage; filter by company, stage or close date; sort by value, close date or stage; “Mark deal won”; “Mark deal lost”)
  - Follow ups (lists follow ups; search by title, company or status; filter by company, status or due date; sort by due date or status; “Complete follow up”; “Cancel follow up”)
  - Team (who has access: invite people, change roles, remove users)

Companies
  Companies have:
  - a name (required)
  - an industry
  - a website (a web address)
  - notes
  Each company can have an account manager (a user).
  Only admins can delete companies.

Contacts
  Contacts have:
  - a first name (required)
  - a last name (required)
  - an email
  - a phone
  - a company (a company, required)
  - a role
  - notes
  Only admins can delete contacts.

Deals
  Deals have:
  - a name (required)
  - a company (a company, required)
  - a contact (a contact)
  - a value (an amount)
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
  - sales (Works with companies, contacts, deals, and follow-ups)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 100 files (100 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-S2OV8n/app-2/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
companies 9 columns 0 indexes 2 fks
contacts 11 columns 0 indexes 2 fks
deals 11 columns 0 indexes 3 fks
follow_ups 11 columns 0 indexes 4 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_brief_thunderball.sql 🚀

Created /tmp/smithable-bench-m12-S2OV8n/app-2. Start it with:

  cd /tmp/smithable-bench-m12-S2OV8n/app-2
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
  - Admin (every kind of record, to find, open, change and delete)
  - Invoices (lists invoices; search by number or client; filter by status, client or issued on; sort by number, issued on, due on, total or status; “Mark sent”; “Mark paid”)
  - Invoice lines (lists invoice lines)
  - Overview (a landing page: hero and footer)

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
Generated 112 files (112 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-S2OV8n/app-3/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_clever_the_fallen.sql 🚀

Created /tmp/smithable-bench-m12-S2OV8n/app-3. Start it with:

  cd /tmp/smithable-bench-m12-S2OV8n/app-3
  smithable run
```

### 4. A tool library where neighbors lend each other tools.

```text
Tool Library
  A tool library where neighbors lend each other tools.

Pages
  - Home (a landing page: hero, tools where available is yes and footer)
  - My tools (lists tools; only the viewer's own records)
  - Tools (lists tools; search by name or description; filter by category, condition or available; sort by name or date added; records can be saved as favorites; contact the owner by mail)

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
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 77 files (77 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-S2OV8n/app-4/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
tools 9 columns 0 indexes 1 fks
tools_favorites 4 columns 1 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_silky_shape.sql 🚀

Created /tmp/smithable-bench-m12-S2OV8n/app-4. Start it with:

  cd /tmp/smithable-bench-m12-S2OV8n/app-4
  smithable run
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  Track ingredients, suppliers, and stock levels for a small bakery.

Pages
  - Ingredients (lists ingredients; search by name, description or category)
  - Suppliers (lists suppliers; search by name, contact person or email)
  - Stock (lists stocks; search by ingredient or supplier; filter by ingredient, supplier or quantity)

Ingredients
  Ingredients have:
  - a name (required)
  - a description
  - a category (dry, wet or frozen, dry by default)
  - a unit (required)
  - a min stock level (a whole number, 0 by default)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact person
  - an email
  - a phone
  - address

Stocks
  Stocks have:
  - an ingredient (an ingredient, required)
  - a supplier (a supplier)
  - a quantity (a whole number, required)
  - a last restocked (a date)
  - an expiry date

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 81 files (81 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-S2OV8n/app-5/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
ingredients 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stocks 9 columns 0 indexes 3 fks
suppliers 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_true_shocker.sql 🚀

Created /tmp/smithable-bench-m12-S2OV8n/app-5. Start it with:

  cd /tmp/smithable-bench-m12-S2OV8n/app-5
  smithable run
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  A job board for local union members to post and apply for jobs.

Pages
  - Jobs (lists job posts; search by title, description, location or job type; sort by deadline, salary or date added)
  - My jobs (lists job posts; only the viewer's own records)
  - Applications (lists applications)
  - Union Job Board (a landing page: hero and footer)

Job Posts
  Job Posts have:
  - a title (required)
  - a description (required)
  - a job type (full time, part time, contract, temporary or seasonal, full time by default)
  - a location (required)
  - a salary (an amount)
  - status (open, filled or expired, open by default)
  - a deadline (a date)
  - requirements
  - a contact email
  Each job post can have a posted by (a user).
  Only the owner and admins can delete job posts.
  Only member users and admins can add job posts.

Applications
  Applications have:
  - a job post (a job post, required)
  - a cover letter (required)
  - a resume
  - status (submitted, reviewed, shortlisted, rejected or hired, submitted by default)
  - submitted at (a date and time, now by default)
  Each application can have an applicant (a user).
  Only the owner and admins can delete applications.
  Only member users and admins can add applications.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Manages the job board)
  - member (Posts jobs and applies for them)
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page and reading job posts where status is open.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 83 files (83 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-S2OV8n/app-6/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
applications 10 columns 0 indexes 3 fks
job_posts 14 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_vengeful_solo.sql 🚀

Created /tmp/smithable-bench-m12-S2OV8n/app-6. Start it with:

  cd /tmp/smithable-bench-m12-S2OV8n/app-6
  smithable run
/tmp/smithable-bench-m12-S2OV8n/app-6/smithable.auth.yml:7:12  warning  Anyone on the internet can read JobPost, including personal data in postedBy, contactEmail.
```

### 7. A football club's site: teams, players, matches and results.

```text
Football Club
  A football club's site with teams, players, matches and results.

Pages
  - Football Club (a landing page: hero, teams, matches where status is scheduled or in progress and footer)
  - Teams (lists teams; search by name or description)
  - Players (lists players; search by name or position)
  - Matches (lists matches; filter by status, date, home team or away team; “Start match”; “End match”; “Cancel match”)

Teams
  Teams have:
  - a name (required)
  - a description
  - a sport (football, futsal or beach soccer, football by default)
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
  - status (scheduled, in progress, completed or canceled, scheduled by default)
  - a home score (a whole number, 0 by default)
  - an away score (a whole number, 0 by default)

Start match
  For a match that is scheduled; sets status to in progress.
  Start the match.

End match
  For a match that is in progress; sets status to completed.
  End the match.

Cancel match
  For a match that is scheduled or in progress; sets status to canceled.
  Cancel the match.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, the players page, the matches page, reading teams, reading players and reading matches.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 90 files (90 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-S2OV8n/app-7/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
matches 11 columns 0 indexes 3 fks
players 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
teams 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_secret_miracleman.sql 🚀

Created /tmp/smithable-bench-m12-S2OV8n/app-7. Start it with:

  cd /tmp/smithable-bench-m12-S2OV8n/app-7
  smithable run
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Registration
  Event registration system for conference talks, speakers and attendees.

Pages
  - Talks (lists talks)
  - Speakers (lists speakers)
  - Attendees (lists attendees)
  - Registrations (lists registrations)
  - Team (who has access: invite people, change roles, remove users)

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

Speakers
  Speakers have:
  - a name (required)
  - a bio
  - a photo (picture)
  - an email (required)
  - a company

Registrations
  Registrations have:
  - a talk (a talk, required, unique)
  - registered at (a date and time, required, now by default)
  - an attendee (an attendee, required)
  At most the talk's capacity registrations per talk.

Attendees
  Attendees have:
  - a name (required)
  - an email (required, unique)
  - a company
  - dietary requirements

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - organizer (Manages conference talks, speakers, and registrations)
  - attendee (A conference participant who registers for talks)
  New users get the attendee role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 96 files (96 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-S2OV8n/app-8/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_rainy_tusk.sql 🚀

Created /tmp/smithable-bench-m12-S2OV8n/app-8. Start it with:

  cd /tmp/smithable-bench-m12-S2OV8n/app-8
  smithable run
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
  - a priority (low, medium, high or urgent, low by default)
  - status (open, in progress, resolved or closed, open by default)
  Each ticket can have an assignee (a user).
  Only itSupport users and admins can delete tickets.

Start work
  For a ticket that is open; sets status to in progress.
  Start working on a ticket.

Resolve
  For a ticket that is in progress; sets status to resolved.
  Mark a ticket as resolved.

Close
  For a ticket that is resolved or in progress; sets status to closed.
  Close a ticket.

Reopen
  For a ticket that is closed or resolved; sets status to open.
  Reopen a closed or resolved ticket.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - itSupport (Handles IT support tickets)
  New users get the itSupport role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 85 files (85 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-S2OV8n/app-9/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
tickets 9 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_famous_saracen.sql 🚀

Created /tmp/smithable-bench-m12-S2OV8n/app-9. Start it with:

  cd /tmp/smithable-bench-m12-S2OV8n/app-9
  smithable run
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A place to keep and share family recipes with ingredients and shopping lists.

Pages
  - Home (a landing page: hero, recipes where category is breakfast or lunch or dinner or dessert or snack or drink and footer)
  - Recipes (lists recipes; search by name, description, category or difficulty; filter by category or difficulty; sort by name, servings, prep time or cook time)
  - Shopping lists (lists shopping lists; search by name; filter by status or date; sort by name, date or status; “Mark completed”)

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
  Only admins can change recipes.
  Only member users and admins can add recipes.

Ingredients
  Ingredients have:
  - a name (required)
  - a quantity
  - a unit
  - a recipe (a recipe, required)
  Only admins can delete ingredients.
  Only member users and admins can change ingredients.
  Only member users and admins can add ingredients.

Shopping lists
  Shopping lists have:
  - a name (required)
  - a date (required, today by default)
  - status (pending or completed, pending by default)
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
  Only admins can delete shopping items.
  Only member users and admins can change shopping items.
  Only member users and admins can add shopping items.

Mark completed
  For a shopping list that is pending; sets status to completed.
  Mark a shopping list as completed.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Manages recipes and shopping lists)
  - member (Views recipes and shopping lists)
  New users get the member role.
  Open to anyone without signing in: the home page, the recipes page and reading recipes.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-S2OV8n/app-10/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
ingredients 8 columns 0 indexes 2 fks
recipes 13 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
shopping_items 9 columns 0 indexes 2 fks
shopping_lists 8 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_aromatic_bulldozer.sql 🚀

Created /tmp/smithable-bench-m12-S2OV8n/app-10. Start it with:

  cd /tmp/smithable-bench-m12-S2OV8n/app-10
  smithable run
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  Live status of our API services, incidents and planned maintenance.

Pages
  - API Status (a landing page: hero, components, incidents where status is investigating or identified or monitoring and footer)
  - Incident History (lists incidents)
  - Incidents (lists incidents; search by title or summary; filter by status or component)
  - Incident Updates (lists incident updates; search by message; filter by status or incident)
  - Components (lists components; search by name or description; filter by status; only for admins; visitors see components on the API Status page)
  - Planned Maintenance (lists maintenance; search by title or description; filter by component)
  - Overview (lists incidents)
  - Team (who has access: invite people, change roles, remove users; only for admins)

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

Incident Updates
  Incident Updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)
  Only admins can delete incident updates.

Maintenance
  Maintenance have:
  - a title (required)
  - a component (a component)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description
  Only admins can delete maintenance.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, the history page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 100 files (100 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-S2OV8n/app-11/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_first_leo.sql 🚀

Created /tmp/smithable-bench-m12-S2OV8n/app-11. Start it with:

  cd /tmp/smithable-bench-m12-S2OV8n/app-11
  smithable run
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Uptime
  Current status of our web shop services and outage updates.

Pages
  - Shop Uptime (a landing page: hero, services, outages where status is investigating or identified or monitoring and footer)
  - Incident History (lists outages)
  - Incidents (lists outages; search by title; filter by status or component)
  - Updates (lists updates)
  - Components (lists services; only for admins; visitors see services on the Shop Uptime page)
  - Maintenance (lists maintenance windows)
  - Overview (lists outages)
  - Team (who has access: invite people, change roles, remove users)

Services
  Services have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each service lists its outages.

Outages
  Outages have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a service)
  - detected at (a date and time, required)
  - resolved at (a date and time)
  - a summary (formatted text)
  Each outage lists its updates.

Updates
  Updates have:
  - an incident (an outage, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)

Maintenance Windows
  Maintenance Windows have:
  - a title (required)
  - a component (a service)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the uptime page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, the history page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 100 files (100 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-S2OV8n/app-12/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_peaceful_calypso.sql 🚀

Created /tmp/smithable-bench-m12-S2OV8n/app-12. Start it with:

  cd /tmp/smithable-bench-m12-S2OV8n/app-12
  smithable run
```
